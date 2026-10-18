# 01: 设计基座 — token、字体、CSS 分层、契约测试、seed、Cover 迁移

**What to build:** 让新视觉有地方落脚，并且让「重设计但 AA 不退化」这件事继续被测试证明。

- `src/app/tokens.css`：八个颜色角色（`--bg --surface --fg --muted --border --border-strong --accent --on-accent`）的浅色与深色两套值，只此一处允许出现颜色字面量；`base.css` 承担 reset、字体、焦点环、skip link、reduced-motion；`globals.css` 只做 `@import`。
- `public/fonts/`：Lora Variable 与 Inter Variable 的 latin 子集 woff2、`@font-face`、`font-display: swap`、OFL 许可说明；拉丁与中文字体栈按 spec 定义，`:lang(zh)` 单独调行高与字距。
- 扩展 `globals-css.test.ts`：新 token 的对比度配对（`fg/bg`、`muted/bg`、`accent/bg`、`on-accent/accent`、`border-strong/bg`）、文本颜色只来自 token、控件边界不得使用装饰线、44px、14px、焦点环、动效必须包在 motion 查询里。
- 迁移：`article.cover_asset_id`（可空、外键 → `asset`、`on delete set null`），资源引用登记；阅读服务返回的卡片 DTO 带上封面地址与尺寸。
- `npm run seed:demo`：仅本地可跑；生成占位图（`sharp`）或读取 `--images <dir>`，经真实上传管线写入；内容见 spec。

**Blocked by:** 无

**Status:** ready-for-agent

- [ ] `tokens.css` 是唯一出现颜色字面量的文件；深浅两套主题都通过对比度断言。
- [ ] 字体自托管、无外部请求；中英混排的标题与正文在两种语言下都使用预期的字体栈。
- [ ] 契约测试扩展完成，且旧断言（44px、14px、焦点、动效）仍然生效。
- [ ] 迁移可从空库一次跑通；无封面是合法状态。
- [ ] seed 脚本可重复执行，不污染生产，图片变体由真实管线生成。

## Comments

不要顺手把 `--line` 改名成 `--border` 就算完：`--border` 是装饰发丝线（`#e4e4e7` 对 `#fafafa` 仅 1.22:1），`--border-strong` 才承担 1.4.11 的 3:1 控件边界，测试要按角色分别断言，否则「好看」会悄悄把输入框边框降到 1.2:1。
