# 导航瘦身：搜索与分类退出常驻栏，分类目录移入归档

> 取代 ADR-0001 中“分类树需要常驻左栏”的判断，以及 ADR-0004 左栏/抽屉里的分类树安排；顶栏 + 左栏的外壳本身保留。

## 决定

- 顶栏的常驻搜索框不变；<64rem 仍用搜索图标作为一键入口，抽屉里的搜索表单不变。
- 侧边栏（含移动端抽屉）的站点导航只保留 `归档` 与 `推文`；删除 `分类` 和 `搜索` 两个链接。
- 页脚导航同样只保留 `归档` 与 `推文`。
- 左栏与抽屉不再渲染分类树；删除 `CategoryTree` / `CurrentCategoryTree` 组件。
- 分类目录移到归档页顶部，锚点 `#categories`：根分类卡片 + 计数，下面是按月归档。
- `/{locale}/categories` 索引重定向到 `/{locale}/archive#categories`；分类详情仍保留 `/{locale}/categories/...` 地址。
- 文章面包屑的分类根、归档里的分类链接仍指向各自分类详情；根面包屑指向归档的分类目录。

## 理由

- 顶栏已有搜索框，侧边栏和页脚再放一个只通向搜索页的链接是重复入口；删掉后站点导航只剩两个真正的栏目。
- 分类树长期占据 256px 栏的首屏，却只在找分类时有用；归档本来就是“按时间或主题找旧文”的地方，把分类目录放进去让归档成为完整的浏览入口。
- 分类详情 URL 不变，已有链接与文章内分类链接不受影响；只有索引地址变化并重定向。

## 后果

- `SiteShell` 不再接收分类数据；`[locale]/layout.tsx` 与 `global-not-found.tsx` 不再查询分类树。
- 删除 `src/components/category-tree.tsx`、`current-category-tree.tsx` 与 `category-tree.test.tsx`；`shell.css` 删除 `.site-tree` / `.site-categories` 规则；`globals-css.test.ts` 删除缩进与换行断言。
- `buildCategoryIndexPath()` 返回归档锚点；`buildCategoryPath()` 的非空路径仍以 `/{locale}/categories` 为基址。
- 归档页多一次分类查询；分类目录为空时不渲染该区块，归档为空时仍显示空状态。
- 新增 `.archive-categories` / `.archive-categories-head` 样式，归档顶部与月份之间用一条 hairline 分隔。

**Considered Options**

- 只删链接、保留分类树：栏里仍有一棵树占位，而且分类目录会与归档重复。
- 把分类树做成顶栏下拉：正是 ADR-0001 拒绝过的降级。
- 保留 `/categories` 索引页：与归档顶部的目录重复，且没有任何导航指向它。
