# 首页列表：分类筛选与分页留在首页，不进入站点导航

> 与 ADR-0005 的关系：ADR-0005 把分类目录移入归档、并从站点导航里删掉「分类」入口，本 ADR 不恢复那个入口。首页网格上方的分类筛选条是列表自身的一个过滤器，不承担导航职责；筛选态地址 `/{locale}?category=…` 也不是分类详情地址。

## 决定

- 首页网格展示全部已发布长文，**包含 Hero 已经展示过的那几篇**；每页 12 篇（`HOME_PAGE_SIZE = 12`）。
- Hero 始终是全站最新 5 篇（`HOME_HERO_LIMIT = 5`），不受筛选与页码影响：筛选只作用于网格。
- 网格上方是一条扁平的分类筛选条：「最新」（全部）+ 顶层分类；当前项带 `aria-current="page"`，不显示计数。
- 筛选按 Category 路径**含子分类**（`isWithinCategoryPath`），与分类详情页同一套语义。
- 状态全部落在查询串：`/{locale}?category=<path>&page=<n>`，服务端渲染，不需要 JS。参数顺序固定为 category 在前、page 在后，便于比较 URL。
- 任何编辑坏了的输入都收敛而不是报错：未知 / 重复（取首值）/ 空的 category 当作「最新」，非法页码当作第 1 页，越界页码收敛到末页；不 404，也不重定向。
- 首页不输出 canonical 与 robots：筛选态和第 N 页都没有自己的 canonical，`/{locale}` 是它唯一的地址。
- 分类页、标签页、搜索页仍然一次列全，不分页。

## 理由

- 首页原先把 Hero 的 5 篇从网格里剔除，读者向下滚动看到的那份「全部长文」是残缺的，同一条列表在页面上出现两次而第二次缺了开头。一份列表就该完整，并且自己带着翻页。
- 分页只在首页做：只有首页是「全部」视图；分类、标签、搜索本来就是一个收窄后的集合，再切页只会让读者多点一次。
- 用查询串而不是路由段（`/page/2`）：筛选与翻页是同一个列表的视图参数，不是新的地址空间，不需要新的路由、metadata 与重定向规则，也不会和 `usePathname` 一类的东西打架。
- 服务端渲染、没有客户端状态：列表本来就在服务端查询，把页码放进客户端只会让 URL 与视图之间存在第二份真相。
- 连续路径 `?category=notes/tools` 而不是 id 或 slug 拼接：与分类详情地址 `/{locale}/categories/notes/tools` 保持同一种路径语义，读者能从 URL 认出位置。

## 后果

- `ReaderHome` 接收 `articles` / `categories` / `locale` / `categoryPath` / `page`，自己决定 Hero、筛选条、网格与分页；`HOME_GRID_LIMIT` 与页面里的 `HOME_LIMIT` 删除。
- 首页每次请求读一次全量卡片，Hero、网格与分页共用这一份；不再用 limit 截断。分类树仍然带回每个节点的计数，首页用不到。
- 新增 `src/domain/pagination.ts`（`parsePageNumber` / `pageCountOf` / `paginate`）与 `src/domain/home-listing.ts`（`firstQueryValue` / `resolveCategoryPath`）；`src/domain/public-paths.ts` 新增 `buildHomeListingPath`。
- 新增 `.home-filter` 与 `.home-pagination` 两组样式。筛选条是下划线标签（与页面的刊头语言一致），分页是胶囊控件（它是按钮，不是标签）。
- 分类树为空时整条筛选条不渲染；选中的分类下没有长文时用站点共用的 `EmptyState`，与分类页一致。

**Considered Options**

- 网格继续排除 Hero 的 5 篇：读者永远看不到首页最上面那几篇的卡片形态，而且「每页 12 篇」在列表被削掉一段之后没有确定含义。
- 用 `/{locale}/page/2` 这类路由段：要新增路由、metadata、重定向，还要处理与 `?category` 的组合，收益只是 URL 好看一点。
- 客户端分页：得把全量数据送到浏览器，并且多一份需要与 URL 对齐的状态。
- 分类页 / 标签页 / 搜索页也分页：这些页本身已经收窄，没有「全部」的语义，先不做。
