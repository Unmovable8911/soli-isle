# 02: 公开站外壳 — 顶栏搜索 + 常驻左栏 + 移动端抽屉

**What to build:** 把页面外壳换成「sticky 顶栏 + 256px 常驻左栏」，并让分类树第一次拥有合适的位置。

- ≥64rem：顶栏 64px、1px 底边框，唯一内容是搜索表单（`<form action="/{locale}/search" method="get">`，字段名与搜索页一致），无 JS；左栏 sticky、自身滚动，内容顺序为 wordmark → 分类、归档、推文、搜索 → 分类树（全展开、按层缩进、当前项 `aria-current="page"`）→ 语言切换与主题三段控件。
- <64rem：顶栏只剩站名与菜单按钮，菜单用 `<details>` 包裹同样的内容；抽屉关闭时不占焦点顺序。
- skip link 仍是文档第一个可聚焦元素；焦点顺序改为 skip → 顶栏 → 左栏 → 主内容。
- `SiteNav` 从顶栏移入左栏；新增文案 key（菜单、搜索 placeholder、目录等）。

**Blocked by:** 01

**Status:** resolved

- [ ] 左栏在 64rem 以上常驻且不随页面滚动消失；内容可独立滚动。
- [ ] 移动端菜单无需 JavaScript 即可开合，键盘可达，Esc 不是必须（原生 `<details>` 行为）。
- [ ] 分类树体现层级与当前位置；长分类名换行而不是截断。
- [ ] 搜索框在桌面常驻、移动端隐藏；提交后落到正确的语言前缀。
- [ ] 关闭 JS 后导航与搜索仍可用。

## Comments

`<details>` 不是妥协：它带来的是原生开合、键盘可达与无 JS 可用，代价只是不能「点外部关闭」。这个站没有需要点击外部关闭的理由。左栏是导航，不是工具栏：语言与主题沉到栏底，避免每个页面顶部再出现一排控件。

## Resolution

**resolved** — merge `c8aee19` (分支 `ui/02-site-shell`；合并时 71 文件 / 770 测试)。

- ≥64rem：64px sticky 顶栏只放搜索表单（`action="/{locale}/search"`，字段 `q`，`role="search"`），256px 常驻左栏按「wordmark → 分类/归档/推文/搜索 → 分类树 → 语言与主题」排列，左栏自身滚动。
- <64rem：顶栏只剩站名与原生 `<details>` 抽屉。关闭时 `display:none`、0 client rects、不可聚焦（Playwright 实测）。
- **焦点顺序实测**（关闭 JS、1280px 逐次 Tab）：skip → 顶栏搜索框/按钮 → 左栏 wordmark/四个主链接/两级分类树/语言两颗/主题三颗 → 主内容；390px：skip → 站名 → 菜单 → 主内容。符合 spec 的 skip → 顶栏 → 左栏 → 主内容。
- 当前分类用 `usePathname()`（沿用 `locale-switcher.tsx` 已有做法）在客户端组件里换算成路径，**服务端渲染出的 HTML 已带 `aria-current="page"`**，所以关掉 JS 标记仍在。
- 分类长名换行不截断（100 字符实测 4 行，不撑破左栏）。
