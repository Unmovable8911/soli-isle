# 样式层用纯 CSS + token 文件，CSS 契约测试是硬门禁

样式拆成 `tokens.css` / `base.css` / `reader/*.css` / `admin/*.css`，`globals.css` 只做导入；颜色只允许出现在 `tokens.css`，由 `globals-css.test.ts` 逐对计算 WCAG 对比度、检查触控与字号下限、检查动效是否都在 motion 查询内。

理由是颜色必须留在**能被程序审计**的地方。Tailwind 会把颜色写进 JSX，测试再也看不见它们；CSS Modules 会打散现在这份唯一的视觉契约，而组件测试里已经引用的可访问名与 href 需要全部重写。纯 CSS 加 token 文件让「重设计」和「AA 不能退化」同时成立。

**Considered Options**

- Tailwind：开发快，但对比度退化只能靠人看图。
- CSS Modules：组件样式就近，但共享的扁平 class 词汇与测试耦合会被打断。

**Consequences**

- 新设计需要的颜色角色多于现有五个，逐个登记对比度配对。
- **装饰发丝线与控件边界必须分开**：`#e4e4e7` 在 `#fafafa` 上只有 1.22:1，够做卡片分隔线，不够做输入框边界（1.4.11 要求 3:1），所以新增 `--border-strong` 承担控件边界，`--border` 只做装饰。
- 深色主题的强调色需要一提亮版本；绿 `#3D7A5B` 在浅色底上是 4.90:1，在 `#09090b` 上不达标。
