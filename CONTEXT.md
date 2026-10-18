# Soli Isle

一个人的多语言博客：发布长文与短推文，只有作者能认证登录。

## Language

**Author**:
站点的唯一写作者与唯一能登录的人。不是一条数据记录，而是这个部署本身。
_Avoid_: 用户、账号、Admin、User

**Reader**:
匿名访客。读文章与推文，不产生任何身份，不留下任何评论。
_Avoid_: 访客账号、会员

## 内容模型

**Article**:
长文。有标题、URL 标识、分类与标签，面向被搜索引擎收录与长期引用。
_Avoid_: 文章、博客、帖子、长文（中文行文可用"长文"，模型与代码中一律用 Article）

**Post**:
短推文。无标题、无分类，不面向搜索引擎收录，仅在信息流中按时间倒序被人读到。
_Avoid_: 微博、动态、状态、短推文（中文行文可用"推文"，模型与代码中一律用 Post）、~~Note~~

**Category**:
长文的层级栏目，一棵树，一篇长文只属于一个分类。回答"这篇长文在站点的哪个位置"。
_Avoid_: 栏目分类、目录、Folder、Collection

**Tag**:
横切主题标签，一篇内容可挂多个。回答"它和哪些内容共享一个主题"。长文与 Post 都有标签，Category 只属于 Article。
_Avoid_: 分类、关键词、Label

**Cover**:
长文的题图。每篇一张、语言中立：同一 Article 的所有 ArticleTranslation 共用它；由作者显式选择，不从正文图片派生，用于列表卡片与长文页头部。
_Avoid_: 封面图（中文行文可用"封面"，模型与代码中一律用 Cover）、题图、featured image

## 语言

**Locale**:
一门被站点支持的语言，同时是界面语言与内容语言的唯一取值来源。"支持的语言列表"在整个系统里只有这一个定义。
_Avoid_: 语言版本、lang、语言（当需要与"翻译版本"区分时必须写 Locale）

**ArticleTranslation**:
某篇 Article 在某个 Locale 下的正文。同一 Article 的所有 ArticleTranslation 互为翻译版本，构成同一篇作品的各语言版本。
_Avoid_: 版本、译文、多语言内容

**PostTranslation**:
某条 Post 在某个 Locale 下的正文，与 ArticleTranslation 同构但独立成表。
_Avoid_: 同 ArticleTranslation 的规避词

**Locale Coverage**:
某篇作品在其所有翻译版本上实际覆盖到的 Locale 集合。是派生的，不是存储的。
_Avoid_: 翻译完成度、语言完整度

**Content Fallback**:
请求某 Locale 下的作品、而该作品没有这个 Locale 的翻译版本时，改为显示该作品的默认语言版本并明示"暂无此语言版本"。只作用于有明确 URL 的单篇作品，不作用于信息流。
_Avoid_: 语言回退、默认语言

## 发布与寻址

**Publication State**:
内容的阶段：草稿、已发布、已归档。与"何时可见"无关。
_Avoid_: 状态、发布状态（当需要与 Publish Time 区分时必须写全）

**Publish Time**:
内容变为可见的时刻，与 Publication State 正交：草稿 + 已设定 Publish Time 即为"定时发布"。
_Avoid_: 发布时间、定时状态、Scheduled（不是一种 Publication State）

**Slug**:
长文 URL 中可读且可被作者修改的那一段身份标识。改为新 Slug 后，旧 Slug 仍必须能到达同一篇长文。Post 没有 Slug。
_Avoid_: permalink、路径、别名、链接

**Feed**:
短推文的时间倒序信息流，是 Post 唯一被读到的场所。不是订阅源。
_Avoid_: 时间线、timeline、信息流（代码与模型中用 Feed）、RSS
