import { relations } from 'drizzle-orm';
import { languages } from './languages.js';
import { uiTranslations } from './ui-translations.js';
import { categories } from './categories.js';
import { categoryTranslations } from './category-translations.js';
import { tags } from './tags.js';
import { tagTranslations } from './tag-translations.js';
import { articles } from './articles.js';
import { articleTranslations } from './article-translations.js';
import { articleTags } from './article-tags.js';
import { moments } from './moments.js';
import { momentTranslations } from './moment-translations.js';
import { momentTags } from './moment-tags.js';
import { resources } from './resources.js';
import { resourceTranslations } from './resource-translations.js';
import { pages } from './pages.js';
import { pageTranslations } from './page-translations.js';
import { slugs } from './slugs.js';

// Language relations
export const languagesRelations = relations(languages, ({ many }) => ({
  uiTranslations: many(uiTranslations),
  articleTranslations: many(articleTranslations),
  momentTranslations: many(momentTranslations),
  resourceTranslations: many(resourceTranslations),
  pageTranslations: many(pageTranslations),
  categoryTranslations: many(categoryTranslations),
  tagTranslations: many(tagTranslations),
}));

// UITranslation relations
export const uiTranslationsRelations = relations(uiTranslations, ({ one }) => ({
  language: one(languages, { fields: [uiTranslations.language_id], references: [languages.id] }),
}));

// Category relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  translations: many(categoryTranslations),
  articles: many(articles),
  resources: many(resources),
}));

export const categoryTranslationsRelations = relations(categoryTranslations, ({ one }) => ({
  category: one(categories, { fields: [categoryTranslations.category_id], references: [categories.id] }),
  language: one(languages, { fields: [categoryTranslations.language_id], references: [languages.id] }),
}));

// Tag relations
export const tagsRelations = relations(tags, ({ many }) => ({
  translations: many(tagTranslations),
  articleTags: many(articleTags),
  momentTags: many(momentTags),
}));

export const tagTranslationsRelations = relations(tagTranslations, ({ one }) => ({
  tag: one(tags, { fields: [tagTranslations.tag_id], references: [tags.id] }),
  language: one(languages, { fields: [tagTranslations.language_id], references: [languages.id] }),
}));

// Article relations
export const articlesRelations = relations(articles, ({ one, many }) => ({
  category: one(categories, { fields: [articles.category_id], references: [categories.id] }),
  translations: many(articleTranslations),
  articleTags: many(articleTags),
}));

export const articleTranslationsRelations = relations(articleTranslations, ({ one }) => ({
  article: one(articles, { fields: [articleTranslations.article_id], references: [articles.id] }),
  language: one(languages, { fields: [articleTranslations.language_id], references: [languages.id] }),
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, { fields: [articleTags.article_id], references: [articles.id] }),
  tag: one(tags, { fields: [articleTags.tag_id], references: [tags.id] }),
}));

// Moment relations
export const momentsRelations = relations(moments, ({ many }) => ({
  translations: many(momentTranslations),
  momentTags: many(momentTags),
}));

export const momentTranslationsRelations = relations(momentTranslations, ({ one }) => ({
  moment: one(moments, { fields: [momentTranslations.moment_id], references: [moments.id] }),
  language: one(languages, { fields: [momentTranslations.language_id], references: [languages.id] }),
}));

export const momentTagsRelations = relations(momentTags, ({ one }) => ({
  moment: one(moments, { fields: [momentTags.moment_id], references: [moments.id] }),
  tag: one(tags, { fields: [momentTags.tag_id], references: [tags.id] }),
}));

// Resource relations
export const resourcesRelations = relations(resources, ({ one, many }) => ({
  category: one(categories, { fields: [resources.category_id], references: [categories.id] }),
  translations: many(resourceTranslations),
}));

export const resourceTranslationsRelations = relations(resourceTranslations, ({ one }) => ({
  resource: one(resources, { fields: [resourceTranslations.resource_id], references: [resources.id] }),
  language: one(languages, { fields: [resourceTranslations.language_id], references: [languages.id] }),
}));

// Page relations
export const pagesRelations = relations(pages, ({ many }) => ({
  translations: many(pageTranslations),
}));

export const pageTranslationsRelations = relations(pageTranslations, ({ one }) => ({
  page: one(pages, { fields: [pageTranslations.page_id], references: [pages.id] }),
  language: one(languages, { fields: [pageTranslations.language_id], references: [languages.id] }),
}));

// Re-export all tables
export {
  languages,
  uiTranslations,
  categories,
  categoryTranslations,
  tags,
  tagTranslations,
  articles,
  articleTranslations,
  articleTags,
  moments,
  momentTranslations,
  momentTags,
  resources,
  resourceTranslations,
  pages,
  pageTranslations,
  slugs,
};
