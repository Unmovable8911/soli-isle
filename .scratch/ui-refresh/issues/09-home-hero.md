# 09: 首页 — 最新五篇的 Hero 轮播

**What to build:** 首页的主推从「最新一篇静态分栏」变成编辑式 Hero 轮播。

- Hero 取最新 5 篇已发布长文，按发布时间倒序，每 5s 自动切换。
- 封面内叠加分类胶囊、标题（Lora 大号）、摘要（截取前两行）、发布日期。
- 底部右侧为位置指示：当前篇是长条，其余是圆点；圆点可点击切换。
- 指针进入 Hero 显示左右箭头；触屏没有 hover，改用圆点。
- 右上角常驻暂停/继续按钮；悬停、聚焦、标签页隐藏时也暂停。
- `prefers-reduced-motion: reduce` 时初始暂停，读者可手动继续。
- 无封面是设计态：实心墨色底＋同样的文字，不留灰色占位。
- 网格改取第 6 篇起的 20 篇，Hero 与网格不重复；页面共取 25 篇。
- 不足 2 篇时不出箭头、圆点与暂停，轮播退化为单张 Hero。

**Blocked by:** 03（沿用其网格）

**Status:** resolved

- [ ] 首页只渲染 5 个 Hero slide，顺序为最新在前。
- [ ] 自动播放延时为 5000ms；手动切换后重新计时。
- [ ] 圆点可点击、可键盘聚焦，当前项有 `aria-current`。
- [ ] 指针进入显示箭头，离开隐藏；键盘聚焦也能显示。
- [ ] 悬停、聚焦、隐藏标签页、手动暂停、减少动效都不前进。
- [ ] Hero 内文字只用 token 对，不依赖封面照片的颜色。
- [ ] 手机 360px 不横向滚动；Hero 高度由最长 slide 决定，不裁切标题。
- [ ] 首页不出现推文；空状态不渲染空轮播。

## Comments

「摘要截取前两行」沿用 Article 的 `summary`（dek），不另取正文：首页卡片一直只读 `summary`，Hero 再引入第二种摘要来源会让同一篇文章在首页出现两段不同的话。

种子补了 5 篇长文，最新五篇正好填满轮播：`a-quieter-web`（有封面、长摘要）、`read-slowly`（长标题）、`without-a-summary`（无摘要）、`notes-from-the-margin`（仅英文，只在 en 首页）、`a-short-article`（无封面）。zh 与 en 首页各自留下 1 篇网格文章。

## Resolution

**resolved** — 提交 `43752c8`；种子随后补到八篇长文。

- 新增 `src/components/home-hero.tsx`（client）：5s `setTimeout` 链，`wrapIndex` 共享 `src/domain/carousel.ts`；所有 slide 叠在同一 CSS grid cell，容器高度取最长篇，非当前篇 `inert` + `aria-hidden`。
- `ReaderHome` 在服务端把 Article 映射成纯 DTO（链接、Locale 日期、封面），客户端不 import `@/services/reading`；`HOME_HERO_LIMIT = 5`、`HOME_GRID_LIMIT = 20`，页面共取 25 篇。
- 视觉：scrim 用 `--fg`、文字用 `--bg`（深色主题自动反相），分类胶囊 `--accent`/`--on-accent`；箭头/暂停为 `--bg` 圆底 `--fg` 图标；当前圆点拉成 1.5rem 长条。
- 桌面箭头独占左侧 2.5rem 栏，避免压在分类胶囊上；`hover: none` 下隐藏箭头。
- 测试：`home-hero.test.tsx` 覆盖时钟、暂停、圆点、箭头、键盘与 SSR 结构；`reader-home.test.tsx` 改为 5＋20 的分片；`globals-css.test.ts` 新增 hero 几何、token、两行截取与 44px 控件的断言。
