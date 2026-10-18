# Soli Isle

自托管、单作者、中英双语的博客，内容分为长文（Article）与推文（Post）：长文有标题、分类、标签和多语言版本；推文是短图文，只出现在信息流里。

- 没有注册、评论、多用户或投稿。整个部署只有一个作者身份，后台只认一个密码。
- 内容只存在两处：一个 SQLite 数据库，一个图片目录。备份时复制 `data/`，并连同 `.env` 一起保存（密码哈希在里面）。
- 单容器部署。应用只监听明文 HTTP，TLS 与边缘限流交给反向代理。
- 默认中文（`/zh`），同时提供英文（`/en`）。

技术栈：Next.js 15（App Router）、React 19、TypeScript、SQLite + Drizzle + better-sqlite3、sharp、Argon2id。

## 目录

- [功能](#功能)
- [文档](#文档)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [密码设置与重置](#密码设置与重置)
- [管理后台](#管理后台)
- [本地开发](#本地开发)
- [演示数据](#演示数据)
- [配置参考](#配置参考)
- [备份与恢复](#备份与恢复)
- [反向代理与 HTTPS](#反向代理与-https)
- [升级与回滚](#升级与回滚)
- [健康检查](#健康检查)
- [排错](#排错)
- [项目结构](#项目结构)
- [限制与说明](#限制与说明)

## 功能

### 读者端

- 首页 `/{locale}` 直接展示最近的长文流。**没有** `/{locale}/articles` 这样的文章列表页。
- 长文详情 `/{locale}/articles/{slug}`：封面、摘要、富文本正文、目录、脚注、上一篇/下一篇。
- 分类 `/{locale}/categories` 与嵌套分类，例如 `/zh/categories/essays`、`/zh/categories/essays/on-writing`。
- 标签 `/{locale}/tags/{slug}`，只列长文。
- 归档 `/{locale}/archive`，按月份列出所有读者可见的长文。
- 搜索 `/{locale}/search?q=...`，只搜长文，匹配标题、正文、标签与分类。
- 推文 Feed `/{locale}/feed`：短图文按时间倒序，支持 `?tag={slug}` 过滤，例如 `/zh/feed?tag=longform`。推文没有独立页面。
- 多语言：列表只展示“有当前语言版本”的内容；长文详情页在当前语言缺版本时可以回退到默认语言，并明确提示读者。
- 永久删除的长文，旧地址返回 `410 Gone`；归档的长文离开列表，但原地址仍可打开。
- 图片由 `/media/{assetId}/{original|display|thumb}.{ext}` 提供；站点有 `/sitemap.xml`。

### 作者端

- 管理后台：总览、长文、推文、分类、标签、资源库。
- 长文编辑器：标题、URL 标识（slug）、摘要、分类、封面（可选）、标签、多语言版本。
- 富文本正文：标题、加粗/斜体/下划线/删除线/高亮、有序/无序/任务列表、引用、代码块、表格、提示块、折叠块、公式（块级与行内）、脚注、图片、链接、分隔线。
- 预览、自动保存、本地恢复、保存冲突处理（丢弃本地改动，或把本地版本另存为新草稿）。
- 发布面板：立即发布、指定时刻发布、归档/取消归档、永久删除；状态分为读者可见、等待发布时刻、草稿、已归档。
- 推文编辑器：正文、图片（顺序即展示顺序）、标签、多语言版本、发布。
- 分类树管理、标签管理、图片资源库（多文件上传、引用列表、未引用图片清理）。

### 运维

- 单容器；SQLite WAL；启动时自动执行数据库迁移。
- `GET /api/health` 检查数据库与图片目录，Docker healthcheck 直接使用它。
- `data/` 同时包含数据库和图片，备份/恢复只需要处理这一个目录（外加 `.env`）。
- 登录按来源 IP 与全局双重限流；会话存在服务端数据库，退出登录会撤销全部会话。

## 文档

- [`CONTEXT.md`](CONTEXT.md)：领域词汇表（Author、Article、Post、Locale、Publication State 等），写代码或读代码前先看这里。
- [`docs/specs/001-soli-isle.md`](docs/specs/001-soli-isle.md)：功能规格与验收要求。
- [`docs/adr/`](docs/adr/)：架构决策记录。
- [`docs/agents/`](docs/agents/)：给自动化代理看的仓库约定。
- [`AGENTS.md`](AGENTS.md)：仓库级协作说明。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| Docker（推荐） | Docker Engine + Compose v2 |
| Node.js（本地开发/脚本） | `>= 24` |
| 默认端口 | `3000` |
| 生产入口 | 建议放在反向代理后面，由代理终止 TLS |
| 磁盘 | 数据库很小；主要占用是上传的图片 |

Docker 镜像基于 `node:24-bookworm-slim`，已安装 `libvips42`，不需要在宿主机额外准备 sharp 的系统依赖。

## 快速开始

### Docker Compose（推荐）

#### 1. 准备代码与配置

```sh
git clone <repo-url> soli-isle
cd soli-isle
cp .env.example .env
```

`.env` 已被 `.gitignore` 忽略，不会提交。默认只把应用发布到 `127.0.0.1:3000`，适合前面再放一个反向代理。

#### 2. 设置作者密码

如果宿主机有 Node.js 24：

```sh
npm ci
npm run auth:reset-password
```

按提示输入两次密码。脚本会写入 `.env`（自动处理 `$` 转义）、初始化数据库，并撤销已有会话。

如果宿主机没有 Node.js，见[密码设置与重置](#密码设置与重置)里的 Docker 方式：用容器生成哈希，手工写进 `.env`。

#### 3. 构建并启动

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

首次启动会自动建目录、跑迁移。日志里出现监听信息后，按 `Ctrl-C` 退出日志跟踪即可，容器仍在后台运行。

#### 4. 打开站点

- 站点：<http://127.0.0.1:3000>，会自动跳到 `/zh` 或 `/en`。
- 后台：<http://127.0.0.1:3000/admin>，未登录会跳到登录页。
- 健康检查：<http://127.0.0.1:3000/api/health>，正常返回 `200`。

> 如果之前用 Docker 跑过，`data/` 可能属于 root。之后在宿主机上跑 `auth:reset-password` 或 `seed:demo` 前，先执行 `sudo chown -R "$(id -u):$(id -g)" data`，否则会遇到 `SQLITE_READONLY` 或 `EACCES`。

### 直接用 Node.js 部署

不用 Docker 时，Node.js 24 进程本身就是应用服务器：

```sh
cp .env.example .env
npm ci
npm run auth:reset-password
npm run build
npm start
```

`npm start` 会先执行数据库迁移，再启动 `next start`。用 systemd、supervisor 等进程管理器托管时：

- `WorkingDirectory` 指向项目根目录，让 Next.js 自己读取 `.env`。
- 确保运行用户对 `data/` 有读写权限。
- 不要把 `npm run dev` 当作生产服务。

## 密码设置与重置

站点没有用户表，也没有注册流程：作者就是这个部署本身，密码哈希放在 `.env` 的 `AUTHOR_PASSWORD_HASH`。后台没有改密码页面，也没有邮件找回；**忘记密码只能用命令行重置**。

### 首次设置

宿主机有 Node.js 24 时（推荐）：

```sh
cp .env.example .env
npm ci
npm run auth:reset-password
```

- 密码输入是隐藏的，需要输入两次；为空或两次不一致会直接退出。
- 脚本把 Argon2id 哈希写进 `.env`，然后打开数据库、执行迁移、撤销全部会话、清除失败登录记录。
- 成功输出类似：`Password hash written to .env. Revoked 0 sessions, cleared 0 failed-login records.`
- 这一步不要求应用正在运行；它会自己创建 `data/database/`。

如果宿主机没有 Node.js，可以用 Docker 生成哈希：

```sh
docker compose build
docker compose run --rm app npm run --silent auth:hash-password
```

把输出的哈希手工写进 `.env`，并将每个 `$` 写成 `\$`（见下一节）。然后 `docker compose up -d --build`。这种方式不会撤销旧会话，也不会清理失败登录记录；首次部署时没有旧会话，所以没关系。

> `auth:hash-password` 只打印哈希，不写 `.env`、不碰数据库、不撤销会话。`auth:reset-password` 才会写文件并清理会话。

### `.env` 里的哈希为什么要转义

Argon2id 哈希长这样：

```text
$argon2id$v=19$m=19456,p=1,t=2$SALT$HASH
```

但 Next.js 和 Docker Compose 都会把 `.env` 里的 `$` 当成变量展开。直接写会被打碎成 `=19=19456,p=1,t=2...` 之类的值，登录时表现为“密码永远不对”。

正确写法是放在双引号里，并在每个 `$` 前加反斜杠：

```dotenv
AUTHOR_PASSWORD_HASH="\$argon2id\$v=19\$m=19456,p=1,t=2\$SALT\$HASH"
```

要点：

- 每个 `$` 都要转义，包括 `$argon2id`、`$v`、`$m`、salt 前和 hash 前的分隔符。
- `m`、`t`、`p` 的具体数值可能因生成工具不同；只要以 `$argon2id$v=19$` 开头且各段完整即可。
- 必须用双引号；在 Next.js 里单引号**不能**保护 `$`。
- `npm run auth:reset-password` 会自动完成转义；只有手工粘贴 `auth:hash-password` 的输出时才需要自己处理。
- 改完 `.env` 后要让容器重新创建：`docker compose up -d --force-recreate`。

验证容器里实际拿到的值：

```sh
docker compose exec app printenv AUTHOR_PASSWORD_HASH
```

正常应以 `$argon2id$v=19$m=` 开头，后面跟着完整的参数、salt 和 hash 段（`m`/`t`/`p` 的具体数值可能因生成工具而异）。如果开头是 `=19`、中间缺段，或者输出为空，说明转义或变量传递有问题。

### 修改或忘记密码

先停应用，避免在容器运行时改数据库。宿主机有 Node.js 时：

```sh
docker compose stop app

# 仅当 data/ 是 root 属主时执行
sudo chown -R "$(id -u):$(id -g)" data

npm run auth:reset-password

docker compose up -d --force-recreate
```

不用 Docker 时，先用 systemd、supervisor 等停掉应用，执行同样的 `npm run auth:reset-password`，再重新启动。

这会：

- 把新哈希写进 `.env`；
- 撤销**全部**作者会话（所有浏览器/设备都要重新登录）；
- 清除失败登录记录，解除登录限流。

如果数据库步骤失败，脚本会输出：

```text
Password hash was written to .env, but sessions were not revoked: ...
```

此时新密码已经生效，但旧会话还没撤销。修好数据库/权限问题后再跑一次，或者直接启动应用后用新密码登录，点一次“退出登录”——退出登录会撤销全部会话。

只有 Docker、没有 Node.js 时：用 `docker compose run --rm app npm run --silent auth:hash-password` 生成哈希，手工改 `.env`（记得转义），再 `docker compose up -d --force-recreate`。旧会话仍然有效；登录后点一次“退出登录”可以撤销全部会话，然后重新登录。

### 会话与登录保护

- 登录页是 `/admin/login`，只有密码，没有用户名。
- 登录成功写入 `soli-session` Cookie：`HttpOnly`、`SameSite=Lax`、`Path=/`、30 天有效；反向代理传 `X-Forwarded-Proto: https` 时再加 `Secure`。
- 会话是数据库里的服务端记录，不是签名令牌；30 天内每次访问会滚动续期。
- “退出登录”是 `POST /admin/logout`，会撤销**所有**会话，不只是当前浏览器。
- 登录限流默认：同一来源 IP 15 分钟内失败 3 次后开始指数退避（30 秒起，上限 30 分钟）；全局 10 分钟内失败 20 次后同样退避（5 分钟起，上限 60 分钟）。触发时返回 `Retry-After`。
- 没有配置 `AUTHOR_PASSWORD_HASH` 时，登录会做一次常量时间的假校验，然后一律失败。
- `AUTHOR_TOTP_SECRET` 是预留项，当前版本没有接入 TOTP，设置它不会生效。
- 建议用长密码或密码管理器生成的口令；`.env` 里的哈希等同于后台凭据，不要提交、不要发到聊天里。

## 管理后台

### 入口

- 直接访问 <http://127.0.0.1:3000/admin>，未登录会 307 到 `/admin/login`。
- 登录成功后回到 `/admin`。
- 反向代理部署后就是 `https://你的域名/admin`。

后台页面：

| 路径 | 作用 |
| --- | --- |
| `/admin` | 总览：全部长文/推文、发布状态与快捷操作 |
| `/admin/articles` | 长文列表 |
| `/admin/articles/{articleId}` | 长文编辑器 |
| `/admin/posts` | 推文列表 |
| `/admin/posts/{postId}` | 推文编辑器 |
| `/admin/categories` | 分类树 |
| `/admin/tags` | 标签 |
| `/admin/assets` | 图片资源库 |

后台导航是：总览、长文、推文、分类、标签、资源库。

### 写长文

1. 在总览点“新建长文”，或在 `/admin/articles` 新建。
2. 填标题、URL 标识（slug）、摘要，选择分类、封面（可选）和标签。
3. 写正文。输入 `/` 可以插入表格、提示块、折叠块、公式、脚注等块；工具栏有标题、列表、引用、代码块、图片、链接等。
4. 需要英文版时添加语言版本；默认语言版本不能删除，最后一个语言版本也不能删除。
5. 用预览检查版式。
6. 在发布面板选择：
   - **立即发布**：马上对读者可见；
   - **定时发布**：到达发布时刻（按站点时区）后可见；
   - **归档**：离开首页、列表、搜索，但原 URL 仍可打开，不参与索引；可取消归档；
   - **永久删除**：从站点彻底消失，旧 slug 返回 `410`，不可恢复。

编辑器会自动保存。断网或保存冲突时，本地改动会保留，并给出两个选择：丢弃本地改动，或把本地版本另存为一篇新草稿。

slug 是长文的 URL 身份。改 slug 后，列表、导航和 canonical 会使用新地址；旧 slug 仍能打开这篇文章（历史 slug），但已经发出去的链接最好更新。

### 写推文

推文没有标题，也没有独立页面，只出现在 Feed 里：

1. 新建推文。
2. 写正文，添加图片（可以多张，顺序就是信息流里的展示顺序），选择标签。
3. 需要英文版时添加语言版本。
4. 发布、定时发布、归档或永久删除。

### 分类、标签与资源库

- **分类**：一棵树。可以新建、改名、调整上级分类、删除。删除时如果有子分类，要先移走或删除；如果有长文属于它，要先选择把这些长文迁到哪个分类。
- **标签**：跨长文与推文的话题。URL 标识是身份，显示名每种语言一份。被长文或推文引用时不能直接删除，要先在内容里取消关联。
- **资源库**：支持 JPEG、PNG、WebP、AVIF、GIF，单个文件上限 25MB。上传后生成 `original` 原图、`display`（宽最多 1600）和 `thumb`（宽最多 800）两个 WebP 变体；GIF 原图保留动画，派生图是静态首帧。可以查看引用、清理未被任何内容引用的图片。

### 安全建议

- 用长且唯一的密码，不要把 `.env` 或哈希发给别人。
- 生产环境必须走 HTTPS；否则密码和会话 Cookie 都以明文经过网络。
- 可以在反向代理层对 `/admin`、`/api/admin` 再加 IP 允许列表或 basic auth。
- 不用的设备及时“退出登录”（会撤销全部会话）。
- 定期备份 `data/` 和 `.env`；备份里包含密码哈希和会话，按敏感数据保管。
- 当前版本没有 2FA，预留的 TOTP 配置尚未生效。

## 本地开发

### 准备

```sh
node -v        # 需要 >= 24
npm ci
cp .env.example .env
npm run auth:reset-password
npm run dev
```

打开 <http://localhost:3000>。`npm run dev` 会先跑 `predev` 迁移，再启动 `next dev`；首次访问某个页面时按需编译，会稍慢。

如果之前用 Docker 跑过，先处理数据目录权限：

```sh
sudo chown -R "$(id -u):$(id -g)" data
```

### 端口

默认 `3000`。被占用时可以换端口：

```sh
npm run dev -- -p 3100
npm run start -- -p 3100
```

### 生产模式本地验证

```sh
npm run build
npm start
```

`npm start` 的 `prestart` 会先迁移数据库。验证生产构建时不要用 `npm run dev`。

### 数据目录与迁移

默认路径：

- 数据库：`data/database/soli-isle.sqlite`
- 图片：`data/images/`

两者都相对启动目录解析。SQLite 使用 WAL 模式；运行时还会看到 `-wal`、`-shm` 文件，这是正常的。

单独执行迁移：

```sh
npm run db:migrate
```

想从空站点重新开始（如果 `.env` 里改过 `DATABASE_PATH` / `RESOURCE_DIR`，先按[下一节](#env-与脚本的加载规则)导出）：

```sh
docker compose stop app
sudo rm -rf data
npm run db:migrate
docker compose up -d
```

这会删除数据库、图片、分类、标签、会话和上传资源，但**不会改密码**：作者身份不在数据库里，密码哈希在 `.env`。应用启动时会重新迁移数据库；图片目录会在首次上传或健康检查时创建。用原密码即可登录。

### `.env` 与脚本的加载规则

这里有一个容易踩的坑：

- Next.js（`next dev` / `next start`）会自动加载 `.env`。
- `tsx` 脚本**不会**自动加载 `.env`：`db:migrate`、`seed:demo` 只读进程环境变量和默认值。
- `auth:reset-password` 是例外：它显式读取 `.env`，再用进程环境变量覆盖，所以能正确找到自定义数据库路径。
- `npm run dev` 的 `predev` 和 `npm start` 的 `prestart` 也是 `tsx` 脚本，因此也只读进程环境变量。

如果你在 `.env` 里改了 `DATABASE_PATH` 或 `RESOURCE_DIR`，跑任何 npm 脚本前先把它们导出，否则迁移可能打到默认数据库，而 Next 用的是另一个：

```sh
export DATABASE_PATH="$PWD/data/database/soli-isle.sqlite"
export RESOURCE_DIR="$PWD/data/images"
npm run dev
```

### 检查

```sh
npm run lint
npm run typecheck
npm test
```

CI 也在 Node 24 上跑这三项。测试使用内存 SQLite、固定时钟和临时资源目录，不会碰 `data/`。

## 演示数据

`seed:demo` 用来快速得到一份可浏览的完整站点：3 篇长文、5 条推文、6 张图片、两个分类、三个标签。

### 内容

| 内容 | 说明 |
| --- | --- |
| 长文 `element-by-element` | 中文《一篇元素齐全的长文》，带英文版；分类“关于写作”，标签“写作”“技术”，有封面；正文覆盖大部分富文本块 |
| 长文 `without-a-cover` | 中文《没有封面的长文》；分类“随笔”，标签“长文”；用来检查无封面卡片的回落版式 |
| 长文 `an-english-essay` | 只有英文版《An English Essay》；用来检查语言切换与缺失提示 |
| 推文 1 | 40 段长推文，用来检查折叠与“展开全文” |
| 推文 2 | 3 张图的图集，标签“写作” |
| 推文 3 | 带“技术”“长文”标签，用来检查 Feed 标签筛选 |
| 推文 4 | 一句话推文 |
| 推文 5 | 英文推文 |

分类是根分类“随笔”（`essays`）和它的子分类“关于写作”（`on-writing`）；标签是“写作”（`writing`）、“技术”（`engineering`）、“长文”（`longform`）。发布时间都在 2025 年 6 月（UTC），因此现在全部可见。

### 运行

```sh
npm run seed:demo
```

输出：

```text
seed:demo wrote 3 Articles, 5 Posts and 6 images
  database  /path/to/soli-isle/data/database/soli-isle.sqlite
  images    /path/to/soli-isle/data/images
```

默认用 sharp 画占位图；也可以换成自己的图片：

```sh
npm run seed:demo -- --images ~/Pictures/blog
```

- 读取 PNG、JPEG、WebP、AVIF、GIF，按文件名排序后循环使用。
- 图片会走真实的 `uploadAsset` 管线，所以 `display`/`thumb` 变体和真实上传一致。
- 少于 6 张会重复使用；目录里没有可读图片会报错 `<目录> holds no image the uploader can read`。
- 这是**破坏性**操作：会删掉当前数据库里的全部长文、推文、分类、标签、图片记录和 `<RESOURCE_DIR>/assets`，然后重建。它保留会话，也不会改密码。
- 可以重复运行，每次得到同一份站点，不会翻倍。
- 如果 `NODE_ENV=production`，会拒绝运行并打印：`seed:demo replaces every Article and Post in the database it is pointed at, so it refuses to run with NODE_ENV=production.`

### 在 Docker 里 seed

Compose 给应用设了 `NODE_ENV=production`，所以不能直接 `docker compose exec app npm run seed:demo`。用一次性容器覆盖环境：

```sh
docker compose stop app
docker compose run --rm -e NODE_ENV=development app npm run seed:demo
docker compose up -d
```

换成自己的图片目录：

```sh
docker compose run --rm -e NODE_ENV=development \
  -v "$HOME/Pictures/blog:/seed-images:ro" \
  app npm run seed:demo -- --images /seed-images
```

`docker compose run` 使用当前镜像；改过代码后先 `docker compose build`。也可以停掉容器后在宿主机直接 `npm run seed:demo`，默认操作同一个 `./data`（自定义路径先 `export`）。

### 用 seed 内容逛站点

| 地址 | 看什么 |
| --- | --- |
| `/zh` | 首页长文流 |
| `/zh/articles/element-by-element` | 元素齐全的中文长文（可切英文版） |
| `/zh/articles/without-a-cover` | 无封面长文的版式 |
| `/en/articles/an-english-essay` | 只有英文版的长文 |
| `/zh/categories` | 分类索引 |
| `/zh/categories/essays` | 根分类“随笔” |
| `/zh/categories/essays/on-writing` | 嵌套子分类“关于写作” |
| `/zh/tags/writing` | 标签“写作”下的长文 |
| `/zh/archive` | 长文归档 |
| `/zh/search?q=元素` | 只搜长文 |
| `/zh/feed` | 推文 Feed |
| `/zh/feed?tag=longform` | 按标签过滤 Feed |
| `/admin` | 后台总览，能看到 3 篇长文、5 条推文的状态 |

注意没有 `/zh/articles` 这个列表页；文章入口在首页、分类、标签、归档和搜索结果里。归档、搜索和 Feed 页面都标记了 `noindex`，它们只用于浏览，不进入搜索引擎索引。

### 重新 seed 或清空

- 再跑一次 `npm run seed:demo`：替换全部内容，结果一致。
- 只想清空内容：停应用，删除 `data/`，重新迁移并启动（见[本地开发](#本地开发)的“数据目录与迁移”）。密码不会变。
- 也可以直接在后台逐篇永久删除，但图片资源要另外在资源库清理。

## 配置参考

### 环境变量

`.env` 同时被两种东西读取：宿主机上的 Next.js，以及 Docker Compose 的 `${...}` 插值。容器里的 `DATABASE_PATH`、`RESOURCE_DIR`、`NODE_ENV`、`HOSTNAME`、`PORT` 由 `docker-compose.yml` 显式设置，会覆盖 `.env` 里的同名值；`AUTHOR_PASSWORD_HASH` 从 `.env` 插值传入容器，`APP_HOST`、`APP_PORT` 只用于 Compose 的端口映射，不会进入容器。

| 变量 | 默认值 | 作用 | 备注 |
| --- | --- | --- | --- |
| `DATABASE_PATH` | `./data/database/soli-isle.sqlite` | SQLite 文件路径 | 相对启动目录；Docker 中固定为 `/data/database/soli-isle.sqlite` |
| `RESOURCE_DIR` | `./data/images` | 图片根目录 | Docker 中固定为 `/data/images` |
| `AUTHOR_PASSWORD_HASH` | 空 | 作者密码的 Argon2id 哈希 | 空 = 所有登录失败；`$` 必须写成 `\$` |
| `AUTHOR_TOTP_SECRET` | 空 | 预留的 TOTP 密钥 | 当前版本未接入，设置无效 |
| `HOSTNAME` | `0.0.0.0` | Node 监听地址 | Docker 中由 compose 固定为 `0.0.0.0` |
| `PORT` | `3000` | 应用监听端口 | Docker 中固定为 `3000` |
| `APP_HOST` | `127.0.0.1` | Compose 发布到宿主机的地址 | 只影响 Docker；改成 `0.0.0.0` 会直接暴露到公网 |
| `APP_PORT` | `3000` | Compose 发布到宿主机的端口 | 只影响 Docker；改完需要 `docker compose up -d` |
| `NODE_ENV` | 未设置 | 运行环境 | Compose 设为 `production`；`seed:demo` 在该值下拒绝运行 |

注意：

- `.env` 里的 `DATABASE_PATH` / `RESOURCE_DIR` 不会改变容器内路径。要改容器路径，得改 `docker-compose.yml` 和 volume。
- 在宿主机跑脚本时，自定义路径需要 `export`（见[本地开发](#本地开发)）。
- 改 `APP_PORT` 后，反向代理的 `proxy_pass` 和健康检查地址也要跟着改。

### 站点级配置

语言、默认语言和站点时区在 `src/config/site.ts`：

```ts
export const siteConfig = {
  locales: ["zh", "en"],
  defaultLocale: "zh",
  timeZone: "Asia/Shanghai",
} as const;
```

- `locales` 决定 URL 前缀、语言切换和内容版本。
- `defaultLocale` 决定内容回退的默认语言，也影响裸 `/` 的重定向。
- `timeZone` 用于后台“发布时刻（站点时区）”的解释和显示。
- 增加语言不只是改这个数组：还要补 `src/messages/` 的界面文案（含语言名称）、内容校验和相关测试，然后重新构建。

### 上传限制

- 单文件上限 25MB。
- 支持 JPEG、PNG、WebP、AVIF、GIF。
- 生成 `display`（宽最多 1600）和 `thumb`（宽最多 800）两个 WebP 变体；原图格式不变。
- 反向代理的请求体上限要大于 25MB（Nginx 建议 `client_max_body_size 30m`），否则大图会在代理层收到 413。

### 数据布局

```text
data/
├── database/
│   ├── soli-isle.sqlite
│   ├── soli-isle.sqlite-wal
│   └── soli-isle.sqlite-shm
└── images/
    └── assets/
        └── <asset-uuid>/
            ├── original.jpg
            ├── display.webp
            └── thumb.webp
```

`-wal` / `-shm` 是 SQLite 运行时文件。备份时要么停应用，要么使用 SQLite 的在线备份方式，不要只拷贝主文件。

## 备份与恢复

### 备份什么

- `data/`：数据库 + 全部图片。
- `.env`：密码哈希和端口配置。**没有它，后台密码无法恢复**，只能重置。

`.env` 等同于后台凭据，备份要按密码保管，不要放进公开仓库或公开网盘。

### 备份

最稳妥的方式是停应用后打包：

```sh
docker compose stop app
tar -czf "soli-isle-$(date +%F).tar.gz" data .env
docker compose start app
```

- 停应用可以保证 SQLite 与 WAL 一致。
- 备份文件放在项目目录之外，或至少不要提交到仓库。
- 可以用 cron / systemd timer 定期执行；保留多份，定期做一次恢复演练。

### 恢复

```sh
docker compose stop app
mv data "data.before-restore-$(date +%s)" 2>/dev/null || true
tar -xzf soli-isle-2026-01-01.tar.gz -C /path/to/soli-isle
sudo chown -R "$(id -u):$(id -g)" data
docker compose up -d
```

恢复后检查：

- `curl -fsS http://127.0.0.1:3000/api/health`
- 首页图片是否正常（数据库和 `data/images` 必须来自同一次备份）
- 后台能否登录

注意：恢复旧备份会把备份时刻的会话一起带回来。如果担心这一点，恢复后运行一次 `npm run auth:reset-password`（或至少登录后点一次“退出登录”）来撤销全部会话。

### 备份策略建议

- 每天一次数据库 + 图片，保留 7～30 天。
- 每次升级前手动备份一次。
- 图片增长快时，可以单独备份 `data/images/`，但数据库和图片要能对上。
- 定期在另一台机器上解包、启动、访问，验证备份真的可用。

## 反向代理与 HTTPS

应用本身只监听明文 HTTP，并信任代理传来的 `X-Forwarded-For` 和 `X-Forwarded-Proto`。生产环境应当：

- 让应用只发布到 `127.0.0.1`（Compose 默认就是）。
- 由 Nginx/Caddy/Traefik 终止 TLS。
- 代理设置 `Host`、`X-Forwarded-For`、`X-Forwarded-Proto`。
- 代理的请求体上限大于 25MB。

Nginx 示例：

```nginx
server {
    listen 80;
    server_name blog.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name blog.example.com;

    ssl_certificate     /etc/letsencrypt/live/blog.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # 上传上限 25MB，留一点 multipart 余量
    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

要点：

- `X-Forwarded-Proto: https` 决定会话 Cookie 是否带 `Secure`，也影响应用生成的绝对 URL。漏掉它，HTTPS 站点可能表现不正常。
- `X-Forwarded-For` 让登录限流按真实来源 IP 计数；不传的话，所有请求看起来都来自代理。应用取这个头的第一个地址：单层代理用 `$remote_addr`，不要用 `$proxy_add_x_forwarded_for`，否则客户端可以自带伪造值绕过按 IP 的登录限流；如果前面还有 CDN，用 real_ip 模块把真实客户端地址还原到 `$remote_addr`。
- `client_max_body_size` 太小会让图片上传在代理层就失败（413）。
- 不要缓存 `/admin`、`/api`；`/media/` 可以交给 CDN 或浏览器缓存。
- 需要额外保护时，可以在代理层对 `/admin`、`/api/admin` 加 IP 允许列表或 basic auth，但记得保留上面的转发头。

## 升级与回滚

### 升级

```sh
# 先备份 data/ 和 .env
git pull
docker compose build --pull
docker compose up -d
docker compose logs -f app
curl -fsS http://127.0.0.1:3000/api/health
```

- 应用启动时会自动执行尚未应用的数据库迁移。
- 迁移是向前的；升级前备份是回滚的前提。
- 升级后打开首页、一篇长文、Feed 和后台各看一次，确认图片与登录正常。

不用 Docker 时：

```sh
git pull
npm ci
npm run build
# 重启你的进程管理器
```

### 回滚

如果新版本有问题：

1. 停应用。
2. 恢复升级前的 `data/` 备份。
3. 切回旧版本代码。
4. 重新构建/重启。

不要只回退代码却保留新版本的数据库结构：旧代码可能不认识新迁移。先恢复数据，再回退代码，顺序不要反。

## 健康检查

```sh
curl -i http://127.0.0.1:3000/api/health
```

- `200`：SQLite 可连接，图片目录可写、可读、可清理临时文件。
- `503`：其中一项失败，响应里会有原因。

Docker Compose 已配置 healthcheck（每 30 秒一次，启动后 20 秒开始）。查看状态：

```sh
docker compose ps
docker compose logs app
```

如果 `docker compose ps` 显示 `unhealthy`，先看日志里的数据库或权限错误，再看磁盘是否写满。

## 排错

### 登录一直提示密码错误

最常见的原因是 `.env` 里的哈希被 `$` 展开打碎了：

```sh
docker compose exec app printenv AUTHOR_PASSWORD_HASH
```

正常应以 `$argon2id$v=19$m=` 开头，并且参数、salt、hash 各段完整。如果看到 `=19...`、缺段或空值，按[密码设置与重置](#密码设置与重置)重新生成，或手工把每个 `$` 改成 `\$`，然后 `docker compose up -d --force-recreate`。

### 登录成功后又跳回登录页

- 浏览器是否禁用了 Cookie，或处在会清理 Cookie 的隐私模式。
- 反向代理是否正确传递 `X-Forwarded-Proto`。应用看到 `https` 时会给 Cookie 加 `Secure`；如果浏览器实际通过 HTTP 访问（例如绕过代理直接访问 `http://...:3000`），Cookie 不会被发送，就会循环。
- 数据库是否可写。登录需要写入 `session` 表；只读挂载或 root 属主问题会导致登录失败。
- 服务器时间是否准确。会话有 30 天有效期，严重的时间偏差会造成异常。

### 提示 `rate-limited`

登录失败次数触发了限流。等待 `Retry-After` 指示的时间，或运行 `npm run auth:reset-password` 清除失败记录（重置密码也会撤销全部会话）。默认同一 IP 15 分钟 3 次失败后开始退避，全局 10 分钟 20 次。

### 502 Bad Gateway

反向代理连不上应用。检查：

```sh
docker compose ps
docker compose logs app
curl -i http://127.0.0.1:3000/api/health
```

常见原因是容器没起来、端口改了但代理没改、应用启动时迁移失败。

### 健康检查 503

看响应和日志。常见原因：

- `data/` 或 `data/images/` 权限不对；
- 磁盘满；
- 数据库文件被删除或损坏；
- `RESOURCE_DIR` 指向了不存在且无法创建的路径。

### `SQLITE_READONLY` / `EACCES`

宿主机脚本打不开数据库或图片目录。Docker 以 root 运行，生成的 `data/` 可能属于 root；宿主机用户无法写。停应用后：

```sh
sudo chown -R "$(id -u):$(id -g)" data
```

然后重试。不要用 `chmod 777` 代替。

### `seed:demo` 拒绝运行

如果看到：

```text
seed:demo replaces every Article and Post in the database it is pointed at, so it refuses to run with NODE_ENV=production.
```

说明当前 `NODE_ENV=production`。本地去掉该变量；Docker 里用：

```sh
docker compose run --rm -e NODE_ENV=development app npm run seed:demo
```

### seed 写到了错误的数据库

`tsx` 脚本不读 `.env`。如果你在 `.env` 里自定义了 `DATABASE_PATH`，先 `export` 再跑 `seed:demo`，否则它会用默认路径。

### 上传图片 413

反向代理的请求体上限太小。把 Nginx 的 `client_max_body_size` 调到 `30m` 或更大，然后 reload。

### 图片 404

- 数据库里的资源记录和 `data/images/` 是否来自同一次备份。
- `RESOURCE_DIR` 是否指向了正确目录。
- 是否在容器外删过 `data/images/assets`。
- 重新上传，或重新跑 `seed:demo`（会重建演示图片）。

### `npm ci` 编译原生依赖失败

`argon2`、`better-sqlite3`、`sharp` 在部分平台需要本地编译工具。安装 Python 3、make、g++ 后重试；或者改用 Docker 生成哈希/运行。Docker 镜像已经包含所需系统库。

### 端口被占用

改 `.env` 的 `APP_PORT`（Docker 发布端口），或本地用 `npm run dev -- -p 3100`。容器内部端口仍是 3000。

### 迁移失败

不要删除数据库“重来”，先备份 `data/` 并查看完整错误。确认磁盘空间、文件权限和代码版本匹配。迁移失败时应用不应继续对外服务。

### `AUTHOR_TOTP_SECRET` 没反应

这是预留配置，当前版本没有接入 TOTP 验证，属于预期行为。

## 项目结构

```text
src/
├── app/          App Router 页面与路由处理器
├── components/   界面组件
├── config/       site、auth、runtime、env-file 配置
├── db/           schema、连接、迁移执行
├── domain/       领域类型与规则（发布状态、URL、资源地址、会话 Cookie）
├── editor/       Tiptap 编辑器相关
├── http/         请求/响应适配（登录、上传、JSON API）
├── messages/     zh/en 界面文案
├── security/     密码哈希等安全原语
├── server/       应用上下文、鉴权、demo seed
├── services/     用例：长文、推文、分类、标签、资源、阅读
├── storage/      本地文件存储
└── test/         测试支撑
drizzle/          SQL 迁移
scripts/          migrate、seed、密码脚本
docs/             spec、ADR、agent 文档
public/           静态资源
data/             运行时数据（gitignored）
```

大致分层是：页面只做路由与编排，用例在 `src/services/`，领域规则在 `src/domain/`，数据库访问在 `src/db/`。时间、存储等外部依赖通过上下文注入，测试可以换成固定时钟和临时目录。

## 限制与说明

- **单作者**：没有用户表、注册、多用户角色、评论或投稿。作者身份就是部署本身。
- **没有 2FA**：`AUTHOR_TOTP_SECRET` 是预留钩子，当前未接线。
- **没有邮件找回密码**：忘记密码只能跑 `auth:reset-password`。
- **没有 RSS**：`/{locale}/feed` 是站内推文信息流，不是 RSS。
- **推文没有独立页面**：只出现在 Feed 里。
- **没有文章列表页**：首页就是长文流，另有分类、标签、归档、搜索入口。
- **图片只存本地磁盘**：不支持 S3 等对象存储。SQLite 和本地图片也意味着应当单实例运行，不要水平扩多副本。
- **应用不做 TLS 和边缘限流**：TLS、WAF、全局限流交给反向代理；应用内只有登录限流。
- **没有 LICENSE 文件**：仓库目前未声明许可证，分发或开源前请先补充。

## 许可证

仓库目前没有 `LICENSE` 文件。如需开源或对外分发，请先添加许可证并在此说明。
