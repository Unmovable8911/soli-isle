import { createDb } from './index.js';
import { resolve, dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { languages } from './schema/languages.js';
import { uiTranslations } from './schema/ui-translations.js';
import { categories } from './schema/categories.js';
import { categoryTranslations } from './schema/category-translations.js';
import { tags } from './schema/tags.js';
import { tagTranslations } from './schema/tag-translations.js';
import { articles } from './schema/articles.js';
import { articleTranslations } from './schema/article-translations.js';
import { articleTags } from './schema/article-tags.js';
import { slugs } from './schema/slugs.js';
import { pages } from './schema/pages.js';
import { pageTranslations } from './schema/page-translations.js';
import { resources } from './schema/resources.js';
import { resourceTranslations } from './schema/resource-translations.js';
import type { InferInsertModel } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

const db = createDb(resolve(dataDir, 'soli-isle.db'));

const now = new Date().toISOString();

async function seed() {
  // Create default language
  const enId = crypto.randomUUID();
  const zhId = crypto.randomUUID();

  await db.insert(languages).values([
    { id: enId, code: 'en', name: 'English', is_default: 1 },
    { id: zhId, code: 'zh', name: '中文', is_default: 0 },
  ]);

  // UI translations for both languages
  type NewUiTranslation = InferInsertModel<typeof uiTranslations>;
  const uiKeys = ['nav.home', 'nav.articles', 'nav.moments', 'nav.resources', 'nav.about', 'published_on', 'read_more', 'no_content', 'back_to_list'];
  const enUi: NewUiTranslation[] = uiKeys.map(k => ({ id: crypto.randomUUID(), key: k, language_id: enId, value: k.replace('nav.', '').replace(/_/g, ' ') }));
  const zhUi: NewUiTranslation[] = uiKeys.map(k => ({ id: crypto.randomUUID(), key: k, language_id: zhId, value: k }));
  await db.insert(uiTranslations).values([...enUi, ...zhUi]);

  // Create category
  const techCatId = crypto.randomUUID();
  await db.insert(categories).values({ id: techCatId, slug: 'tech', created_at: now, updated_at: now });
  await db.insert(categoryTranslations).values([
    { id: crypto.randomUUID(), category_id: techCatId, language_id: enId, name: 'Technology' },
    { id: crypto.randomUUID(), category_id: techCatId, language_id: zhId, name: '技术' },
  ]);

  // Create tags
  const rustTagId = crypto.randomUUID();
  const jsTagId = crypto.randomUUID();
  await db.insert(tags).values([
    { id: rustTagId, slug: 'rust', created_at: now, updated_at: now },
    { id: jsTagId, slug: 'javascript', created_at: now, updated_at: now },
  ]);
  await db.insert(tagTranslations).values([
    { id: crypto.randomUUID(), tag_id: rustTagId, language_id: enId, name: 'Rust' },
    { id: crypto.randomUUID(), tag_id: rustTagId, language_id: zhId, name: 'Rust' },
    { id: crypto.randomUUID(), tag_id: jsTagId, language_id: enId, name: 'JavaScript' },
    { id: crypto.randomUUID(), tag_id: jsTagId, language_id: zhId, name: 'JavaScript' },
  ]);

  // Create sample article
  const artId = crypto.randomUUID();
  await db.insert(slugs).values({ id: crypto.randomUUID(), slug: 'hello-world', entity_type: 'article', entity_id: artId });
  await db.insert(articles).values({ id: artId, slug: 'hello-world', category_id: techCatId, published_at: now, is_draft: 0, created_at: now, updated_at: now });
  await db.insert(articleTranslations).values([
    { id: crypto.randomUUID(), article_id: artId, language_id: enId, title: 'Hello World', body: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Welcome to my blog!"}]}]}', excerpt: 'First post' },
    { id: crypto.randomUUID(), article_id: artId, language_id: zhId, title: '你好世界', body: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"欢迎来到我的博客！"}]}]}', excerpt: '第一篇文章' },
  ]);
  await db.insert(articleTags).values([
    { article_id: artId, tag_id: rustTagId },
    { article_id: artId, tag_id: jsTagId },
  ]);

  // Create sample page
  const aboutId = crypto.randomUUID();
  await db.insert(slugs).values({ id: crypto.randomUUID(), slug: 'about', entity_type: 'page', entity_id: aboutId });
  await db.insert(pages).values({ id: aboutId, slug: 'about', published_at: now, is_draft: 0, sort_order: 1, created_at: now, updated_at: now });
  await db.insert(pageTranslations).values([
    { id: crypto.randomUUID(), page_id: aboutId, language_id: enId, title: 'About Me', body: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"I write code."}]}]}' },
    { id: crypto.randomUUID(), page_id: aboutId, language_id: zhId, title: '关于我', body: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"我写代码。"}]}]}' },
  ]);

  // Create sample resource
  const resId = crypto.randomUUID();
  await db.insert(resources).values({ id: resId, url: 'https://example.com', category_id: techCatId, created_at: now, updated_at: now });
  await db.insert(resourceTranslations).values([
    { id: crypto.randomUUID(), resource_id: resId, language_id: enId, title: 'Example Resource', description: 'A useful example' },
    { id: crypto.randomUUID(), resource_id: resId, language_id: zhId, title: '示例资源', description: '一个有用的示例' },
  ]);

  console.log('Seed data inserted successfully.');
}

seed().catch(console.error);
