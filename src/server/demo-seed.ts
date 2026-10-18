import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import type { DatabaseConnection } from "@/db/database";
import {
  addArticleTranslation,
  createArticleDraft,
  publishArticle,
  updateArticleMeta,
  type ArticleContext,
} from "@/services/articles";
import { uploadAsset, type AssetContext, type AssetSummary } from "@/services/assets";
import { createCategory, setCategoryName, type CategoryContext } from "@/services/categories";
import {
  createPostDraft,
  publishPost,
  setPostImages,
  setPostTags,
  type PostContext,
} from "@/services/posts";
import type { ReadingContext } from "@/services/reading";
import { createTag, setTagName, type TagContext } from "@/services/tags";

/**
 * The demo the local site is walked through on. It is deliberately not a set of
 * fixtures: every image goes through uploadAsset, so the variants a Reader
 * loads are the ones sharp made, and every body is a real ProseMirror document
 * that the real renderer and the real Markdown derivation have to survive.
 *
 * Two rules hold for the whole file:
 *  - the run is local only. It replaces all content in the database it is
 *    pointed at, so it refuses production outright;
 *  - the run is re-runnable. It resets its own content first, so a second
 *    npm run seed:demo leaves the same site rather than a doubled one.
 */

export class DemoSeedRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoSeedRefusedError";
  }
}

export interface DemoSeedContext {
  database: DatabaseConnection;
  assets: AssetContext;
  articles: ArticleContext & CategoryContext & TagContext;
  posts: PostContext;
  reading: ReadingContext;
  /** Uploaded variants live under <resourceDir>/assets; the reset clears it. */
  resourceDir: string;
  /** Use the Author's own pictures instead of the generated placeholders. */
  imagesDir?: string | null;
}

export interface DemoSeedSummary {
  articles: number;
  posts: number;
  images: number;
}

export function assertLocalSeed(env: { NODE_ENV?: string }): void {
  if (env.NODE_ENV === "production") {
    throw new DemoSeedRefusedError(
      "seed:demo replaces every Article and Post in the database it is pointed at, so it refuses to run with NODE_ENV=production.",
    );
  }
}

export function parseSeedArguments(argv: readonly string[]): { imagesDir: string | null } {
  let imagesDir: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (argument === "--images") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--images needs a directory of images to read");
      }
      imagesDir = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  return { imagesDir };
}

interface ImageSlot {
  fileName: string;
  width: number;
  height: number;
  label: string;
}

interface UploadedImage {
  fileName: string;
  bytes: Uint8Array;
}

interface ImageSource {
  take(slot: ImageSlot): Promise<UploadedImage>;
}

/** Two muted pairs, alternated: a placeholder is scaffolding, not a photograph. */
const PLACEHOLDER_TONES = [
  { paper: "#e8e4dc", ink: "#8a8477" },
  { paper: "#e2e5e2", ink: "#77807a" },
] as const;

async function placeholderImage(slot: ImageSlot, index: number): Promise<UploadedImage> {
  const tone = PLACEHOLDER_TONES[index % PLACEHOLDER_TONES.length] ?? PLACEHOLDER_TONES[0];
  const inset = Math.round(Math.min(slot.width, slot.height) * 0.08);
  const fontSize = Math.round(Math.min(slot.width, slot.height) * 0.06);
  const captionSize = Math.round(fontSize * 0.5);
  const markup = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${slot.width}" height="${slot.height}">`,
    `  <rect width="100%" height="100%" fill="${tone.paper}"/>`,
    `  <rect x="${inset}" y="${inset}" width="${slot.width - inset * 2}" height="${slot.height - inset * 2}" fill="none" stroke="${tone.ink}" stroke-opacity="0.3" stroke-width="2"/>`,
    `  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${fontSize}" fill="${tone.ink}">${slot.label}</text>`,
    `  <text x="50%" y="${Math.round(slot.height / 2 + fontSize * 2)}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${captionSize}" fill="${tone.ink}" fill-opacity="0.7">${slot.width} x ${slot.height}</text>`,
    "</svg>",
  ].join("\n");
  const bytes = await sharp(Buffer.from(markup)).png().toBuffer();
  return { fileName: slot.fileName, bytes };
}

async function createImageSource(imagesDir: string | null | undefined): Promise<ImageSource> {
  if (imagesDir === null || imagesDir === undefined) {
    let index = 0;
    return {
      async take(slot) {
        const image = await placeholderImage(slot, index);
        index += 1;
        return image;
      },
    };
  }

  const resolved = path.resolve(imagesDir);
  const names = (await readdir(resolved))
    .filter((name) => /\.(?:png|jpe?g|webp|avif|gif)$/i.test(name))
    .sort();
  if (names.length === 0) {
    throw new Error(`${resolved} holds no image the uploader can read`);
  }
  const files = await Promise.all(
    names.map(async (name) => ({
      fileName: name,
      bytes: await readFile(path.join(resolved, name)),
    })),
  );

  let cursor = 0;
  return {
    async take() {
      const file = files[cursor % files.length];
      cursor += 1;
      if (file === undefined) {
        throw new Error(`${resolved} holds no image the uploader can read`);
      }
      return file;
    },
  };
}

/** The content tables a re-run replaces, children before parents. */
const CONTENT_DELETES = [
  "DELETE FROM article_revision;",
  "DELETE FROM article_tag;",
  "DELETE FROM article_translation;",
  "DELETE FROM article_slug_history;",
  "DELETE FROM article_slug;",
  "DELETE FROM article;",
  "DELETE FROM post_image;",
  "DELETE FROM post_tag;",
  "DELETE FROM post_translation;",
  "DELETE FROM post;",
  "DELETE FROM tag_translation;",
  "DELETE FROM tag;",
  "DELETE FROM asset_reference;",
  "DELETE FROM asset_variant;",
  "DELETE FROM asset;",
];

/**
 * A demo reset, not a content migration: the content tables are emptied so a
 * re-run cannot double the site. Sessions and the Author row are untouched, so
 * the console still signs in afterwards.
 */
async function resetContent(context: DemoSeedContext): Promise<void> {
  const sqlite = context.database.sqlite;
  sqlite.exec(CONTENT_DELETES.join("\n"));

  // A Category points at its parent with ON DELETE RESTRICT, so the tree has to
  // come down a generation at a time.
  for (;;) {
    const removed = sqlite
      .prepare(
        "DELETE FROM category WHERE id NOT IN (SELECT parent_id FROM category WHERE parent_id IS NOT NULL)",
      )
      .run().changes;
    if (removed === 0) {
      break;
    }
  }

  await rm(path.join(context.resourceDir, "assets"), { recursive: true, force: true });
}

function displayAddress(asset: AssetSummary): string {
  const variant = asset.variants.find((candidate) => candidate.variant === "display");
  if (variant === undefined) {
    throw new Error(`${asset.fileName} uploaded without a display variant`);
  }
  return variant.address;
}

interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
}

function text(value: string): DocNode {
  return { type: "text", text: value };
}

function paragraph(value: string): DocNode {
  return { type: "paragraph", content: [text(value)] };
}

function heading(level: 2 | 3, value: string): DocNode {
  return { type: "heading", attrs: { level }, content: [text(value)] };
}

function codeBlock(language: string, value: string): DocNode {
  return { type: "codeBlock", attrs: { language }, content: [text(value)] };
}

function image(source: string, alt: string, width: number, height: number): DocNode {
  return { type: "image", attrs: { src: source, alt, width, height } };
}

function callout(tone: "note" | "tip" | "warn" | "danger", value: string): DocNode {
  return { type: "callout", attrs: { tone }, content: [paragraph(value)] };
}

function blockMath(latex: string): DocNode {
  return { type: "blockMath", attrs: { latex } };
}

function table(rows: readonly (readonly string[])[]): DocNode {
  return {
    type: "table",
    content: rows.map((row, rowIndex) => ({
      type: "tableRow",
      content: row.map((cell) => ({
        type: rowIndex === 0 ? "tableHeader" : "tableCell",
        content: [paragraph(cell)],
      })),
    })),
  };
}

function fold(summary: string, ...body: DocNode[]): DocNode {
  return {
    type: "details",
    content: [
      { type: "detailsSummary", content: [text(summary)] },
      { type: "detailsContent", content: body },
    ],
  };
}

function footnoteRef(label: string): DocNode {
  return { type: "footnoteRef", attrs: { label } };
}

function footnoteSection(...notes: readonly string[]): DocNode {
  return {
    type: "footnoteSection",
    content: notes.map((note, index) => ({
      type: "footnoteItem",
      attrs: { label: String(index + 1) },
      content: [paragraph(note)],
    })),
  };
}

/** The long article: every element the spec expects a real essay to have. */
function elementalDocument(illustration: string): DocNode {
  return {
    type: "doc",
    content: [
      paragraph("一篇用来检查版式的长文。它不需要写得很好，它需要什么都有。"),
      heading(2, "一 · 开头"),
      paragraph(
        "先是一段普通的正文。中文的正文走系统字体栈里的宋体或苹方，行高比拉丁文松一点，因为汉字是方的，密了就糊。",
      ),
      paragraph(
        "再一段，用来确认段间距与测量宽度。测宽 65ch：一行放得下大约四十个汉字，眼睛回行的时候不会迷路。",
      ),
      callout("note", "提示块：正文之外的一句话，语气比正文轻，但比脚注重。"),
      heading(2, "二 · 图片与代码"),
      image(illustration, "占位插图", 1200, 800),
      paragraph("上面这张图按原比例显示，不裁切。卡片上的封面才裁切成 16:10。"),
      codeBlock(
        "typescript",
        'export async function read(target: string): Promise<string> {\n  return readFile(target, "utf8");\n}',
      ),
      heading(2, "三 · 公式、表格与折叠块"),
      blockMath("\\int_0^1 x^2 \\, dx = \\frac{1}{3}"),
      table([
        ["元素", "用途"],
        ["表格", "把对照关系摆平"],
        ["折叠块", "把次要的长内容收起来"],
        ["脚注", "把补充留在原地"],
      ]),
      fold("折叠块里放什么", paragraph("放那些读者需要时才想看的段落：运行记录、修订说明、一段更长的解释。")),
      heading(2, "四 · 引用与结尾"),
      {
        type: "blockquote",
        content: [paragraph("引用不是装饰，它是把别人的声音和我的声音分开的那条线。")],
      },
      {
        type: "paragraph",
        content: [
          text("最后一段带一个脚注"),
          footnoteRef("1"),
          text("，用来确认脚注的往返链接还在。"),
        ],
      },
      footnoteSection("脚注一：它的编号存在文档里，不在渲染时数出来。"),
    ],
  };
}

function englishDocument(illustration: string): DocNode {
  return {
    type: "doc",
    content: [
      paragraph("The same work, read in English: the cover, the Category and the tags are shared."),
      heading(2, "One · A Latin body"),
      paragraph(
        "Lora sets the headings and Inter sets the body, so a line of English sits tighter than a line of Chinese — and is meant to.",
      ),
      image(illustration, "Placeholder illustration", 1200, 800),
      heading(2, "Two · The same footnotes"),
      {
        type: "paragraph",
        content: [text("A sentence with a note"), footnoteRef("1"), text(" at its end.")],
      },
      footnoteSection("A note is one paragraph, so the Markdown definition round-trips."),
    ],
  };
}

function plainDocument(...paragraphs: readonly string[]): DocNode {
  return { type: "doc", content: paragraphs.map(paragraph) };
}

export async function seedDemo(context: DemoSeedContext): Promise<DemoSeedSummary> {
  await resetContent(context);
  const source = await createImageSource(context.imagesDir);

  const essays = await createCategory(context.articles, {
    locale: "zh",
    name: "随笔",
    slug: "essays",
  });
  if (!essays.ok) {
    throw new Error(`could not create the essays Category: ${essays.reason}`);
  }
  await setCategoryName(context.articles, {
    categoryId: essays.category.id,
    locale: "en",
    name: "Essays",
  });

  const onWriting = await createCategory(context.articles, {
    parentId: essays.category.id,
    locale: "zh",
    name: "关于写作",
    slug: "on-writing",
  });
  if (!onWriting.ok) {
    throw new Error(`could not create the nested Category: ${onWriting.reason}`);
  }
  await setCategoryName(context.articles, {
    categoryId: onWriting.category.id,
    locale: "en",
    name: "On Writing",
  });

  const writing = await createTag(context.articles, { locale: "zh", name: "写作", slug: "writing" });
  const engineering = await createTag(context.articles, {
    locale: "zh",
    name: "技术",
    slug: "engineering",
  });
  const longform = await createTag(context.articles, { locale: "zh", name: "长文", slug: "longform" });
  if (!writing.ok || !engineering.ok || !longform.ok) {
    throw new Error("could not create the demo Tags");
  }
  await setTagName(context.articles, { tagId: writing.tag.id, locale: "en", name: "Writing" });
  await setTagName(context.articles, {
    tagId: engineering.tag.id,
    locale: "en",
    name: "Engineering",
  });
  await setTagName(context.articles, { tagId: longform.tag.id, locale: "en", name: "Longform" });

  const cover = await uploadAsset(
    context.assets,
    await source.take({ fileName: "demo-cover.png", width: 1600, height: 1000, label: "Cover" }),
  );
  const illustration = await uploadAsset(
    context.assets,
    await source.take({
      fileName: "demo-illustration.png",
      width: 1200,
      height: 800,
      label: "Figure one",
    }),
  );
  const secondIllustration = await uploadAsset(
    context.assets,
    await source.take({
      fileName: "demo-second-illustration.png",
      width: 1200,
      height: 800,
      label: "Figure two",
    }),
  );
  const gallery: AssetSummary[] = [];
  for (const index of [1, 2, 3]) {
    gallery.push(
      await uploadAsset(
        context.assets,
        await source.take({
          fileName: `demo-gallery-${index}.png`,
          width: 1200,
          height: 1500,
          label: `Gallery ${index}`,
        }),
      ),
    );
  }

  const elemental = await createArticleDraft(context.articles, {
    title: "一篇元素齐全的长文",
    summary: "从提示块到脚注，把一份长文能有的元素都摆一遍，用来检查版式。",
    locale: "zh",
    defaultLocale: "zh",
    slug: "element-by-element",
    bodyJson: JSON.stringify(elementalDocument(displayAddress(illustration))),
  });
  await addArticleTranslation(context.articles, {
    articleId: elemental.id,
    locale: "en",
    title: "A Long Essay, Element by Element",
    summary: "Every element a long essay carries, once each, to check the layout.",
    bodyJson: JSON.stringify(englishDocument(displayAddress(illustration))),
  });
  await updateArticleMeta(context.articles, {
    articleId: elemental.id,
    categoryId: onWriting.category.id,
    tagIds: [writing.tag.id, engineering.tag.id],
    coverAssetId: cover.id,
  });
  await publishArticle(context.articles, {
    articleId: elemental.id,
    publishTime: "2025-06-10T09:00:00.000Z",
  });

  const uncovered = await createArticleDraft(context.articles, {
    title: "没有封面的长文",
    summary: "没有封面是合法状态：卡片回落成文字版，长文头部不留空。",
    locale: "zh",
    defaultLocale: "zh",
    slug: "without-a-cover",
    bodyJson: JSON.stringify({
      type: "doc",
      content: [
        paragraph("这篇长文没有封面。信息流和列表里的卡片必须有回落版式，而不是只做有图的版本。"),
        heading(2, "正文里仍然可以有图"),
        image(displayAddress(secondIllustration), "正文插图", 1200, 800),
        paragraph("正文图片与封面是两件事：封面属于作品，正文图片属于某一种语言的正文。"),
      ],
    }),
  });
  await updateArticleMeta(context.articles, {
    articleId: uncovered.id,
    categoryId: essays.category.id,
    tagIds: [longform.tag.id],
  });
  await publishArticle(context.articles, {
    articleId: uncovered.id,
    publishTime: "2025-06-05T09:00:00.000Z",
  });

  const english = await createArticleDraft(context.articles, {
    title: "An English Essay",
    summary: "A work that exists only in English, so the language switch has a case to show.",
    locale: "en",
    defaultLocale: "en",
    slug: "an-english-essay",
    bodyJson: JSON.stringify(
      plainDocument(
        "A work with no Chinese version at all: the Article page offers the Locale it has and says so.",
        "The Chinese stack is still worth loading, because the shell is read in either language.",
      ),
    ),
  });
  await updateArticleMeta(context.articles, {
    articleId: english.id,
    categoryId: essays.category.id,
    tagIds: [longform.tag.id],
  });
  await publishArticle(context.articles, {
    articleId: english.id,
    publishTime: "2025-06-01T09:00:00.000Z",
  });

  const longParagraphs = Array.from({ length: 40 }, (_unused, index) =>
    `第 ${index + 1} 段。一条推文可以很长，长到需要折叠；折叠之后仍然要有「展开全文」，而不是一条截断的预言。`,
  );
  const longPost = await createPostDraft(context.articles, {
    locale: "zh",
    defaultLocale: "zh",
    bodyJson: JSON.stringify(plainDocument(...longParagraphs)),
  });
  await publishPost(context.posts, {
    postId: longPost.id,
    publishTime: "2025-06-15T21:00:00.000Z",
  });

  const galleryPost = await createPostDraft(context.articles, {
    locale: "zh",
    defaultLocale: "zh",
    bodyJson: JSON.stringify(
      plainDocument(
        "一条多图的推文。图集横向滑动，手机上 4:5，桌面上 16:9。",
        "图片顺序就是数组顺序。",
      ),
    ),
  });
  await setPostImages(context.articles, {
    postId: galleryPost.id,
    assetIds: gallery.map((asset) => asset.id),
  });
  await setPostTags(context.articles, { postId: galleryPost.id, tagIds: [writing.tag.id] });
  await publishPost(context.posts, {
    postId: galleryPost.id,
    publishTime: "2025-06-14T21:00:00.000Z",
  });

  const taggedPost = await createPostDraft(context.articles, {
    locale: "zh",
    defaultLocale: "zh",
    bodyJson: JSON.stringify(plainDocument("带标签的推文，用来检查信息流顶部的标签筛选。")),
  });
  await setPostTags(context.articles, {
    postId: taggedPost.id,
    tagIds: [engineering.tag.id, longform.tag.id],
  });
  await publishPost(context.posts, {
    postId: taggedPost.id,
    publishTime: "2025-06-13T21:00:00.000Z",
  });

  const shortPost = await createPostDraft(context.articles, {
    locale: "zh",
    defaultLocale: "zh",
    bodyJson: JSON.stringify(plainDocument("一句话的推文。")),
  });
  await publishPost(context.posts, {
    postId: shortPost.id,
    publishTime: "2025-06-12T21:00:00.000Z",
  });

  const englishPost = await createPostDraft(context.articles, {
    locale: "en",
    defaultLocale: "en",
    bodyJson: JSON.stringify(plainDocument("A post in English, so the Feed has one too.")),
  });
  await publishPost(context.posts, {
    postId: englishPost.id,
    publishTime: "2025-06-11T21:00:00.000Z",
  });

  return { articles: 3, posts: 5, images: 3 + gallery.length };
}
