# 配置与使用指南

[返回首页](../README.md) · [部署指南](../deploy/DEPLOY.md)

## 🛠️ 环境变量配置

常用变量如下，完整模板见 [`.env.example`](../.env.example)。

<details open>
<summary><strong>新手只需填写（2 项）</strong></summary>

- **`VITE_API_URL`** — 前端访问后端的公网地址；示例：`https://api.example.com`
- **`CORS_ORIGIN`** — 允许跨域的前端来源；示例：`https://cloud.example.com`

两项填写完整 origin（协议、域名及可选端口），不带路径、查询参数或末尾 `/`；生产环境使用 HTTPS。安装器会询问并校验地址，无需预先复制模板。若已复制 `.env.example`，必须将示例地址换成实际域名；按 Enter 会保留已有值。

</details>

<details>
<summary><strong>安装脚本自动生成</strong></summary>

- **`DB_PASSWORD`** — 自动生成 64 位十六进制 PostgreSQL 密码
- **`SESSION_SECRET`** / **`STORAGE_CREDENTIALS_SECRET`** — 新安装时自动生成并保留；升级旧部署时不会覆盖 `/data/secrets` 中已有的持久密钥

版本号不保存在 `.env`。安装时会直接从 `backend/package.json` 读取应用版本，并从当前 Git 提交读取源码修订号，只把它们临时传给 Docker 构建。

</details>

<details>
<summary><strong>高级部署覆盖</strong></summary>

- **`OAUTH_CALLBACK_BASE_URL`** — 默认继承 `VITE_API_URL`；仅特殊 API 入口时填写
- **`OAUTH_FRONTEND_ORIGIN`** — 默认继承 `CORS_ORIGIN` 的第一个地址；仅多前端入口时填写

</details>

<details>
<summary><strong>Telegram 运行配置</strong></summary>

Telegram 凭证、允许用户、账号登录、来源白名单和下载并发均属于运行配置，统一在 Web **设置 → Telegram** 中管理。新部署不需要在 `.env` 中填写 Telegram 变量，也不需要手动生成 session 文件。

旧版本 `.env` 变量仍会被兼容读取，但只用于升级和迁移；不要在新部署中同时维护两套配置。Web 中的设置优先于环境变量。

</details>

<details>
<summary><strong>常用可选项</strong></summary>

- **`PORT`** `51947` — 后端监听端口
- **`UPLOAD_DIR`** `/data/uploads` · **`THUMBNAIL_DIR`** `/data/thumbnails` · **`CHUNK_DIR`** `/data/chunks`
- **`DUPLICATE_FILE_MODE`** `copy` — `copy` 生成副本；`skip` 跳过同名、同目录且同大小的文件
- **`AUTO_CLEANUP_ORPHANS`** `true` — 自动清理未登记到数据库的本地孤儿文件

</details>

<details>
<summary><strong>限流与安全项</strong></summary>

- **普通消息限流** — `TELEGRAM_RATE_WINDOW_MS=60000`，`TELEGRAM_RATE_MAX=30`
- **重型命令限流** — `TELEGRAM_HEAVY_RATE_WINDOW_MS=600000`，`TELEGRAM_HEAVY_RATE_MAX=5`
- **`TRUST_PROXY`** `loopback` · **`COOKIE_SECURE`** `true` · **`JSON_BODY_LIMIT`** `2mb`
- **分片限制** — `MAX_UPLOAD_CHUNK_MB=32`，`MAX_CHUNK_UPLOAD_GB=20`，`CHUNK_GLOBAL_BUDGET_GB=40`
- **磁盘与数量保护** — `CHUNK_DISK_RESERVE_GB=8`，`MAX_TOTAL_CHUNKS=50000`
- **`ORPHAN_CLEANUP_MIN_AGE_MS`** `600000` — 10 分钟内不清理本地孤儿文件

</details>

## 🤖 Telegram 配置与能力

### Bot 与账号级下载器的区别

**只启用 Bot 即可使用：**

- ✅ 私聊发送文件给 Bot 转存
- ✅ 任务管理、存储统计和删除文件

**额外启用账号级下载器后增加：**

- ✅ 频道/群组按日期或标签批量抓取
- ✅ 频道订阅自动同步
- ✅ 下载受 Bot 限制影响的大文件（仍受 Telegram 账号权限和限流约束）

### 创建和管理频道下载

`/tg_download` 按“类型 → 频道 → 日期或标签 → 目录 → 确认”创建任务。目录可点击“使用默认目录”；确认卡可修改频道、范围、目录或切换评论区选项。点击确认开始，也可回复当前确认卡发送 `确认`；旧卡不能提交新的向导。输入错误会保留草稿，创建失败可重试。

确认卡在创建成功后变为回执，下载进度使用独立任务卡；一次性存储目标仅在任务创建成功后消费，取消不改变目标。Bot 和 Web 使用相同的暂停、继续、取消和失败重试逻辑。暂停会等待当前文件处理完毕；继续可以解除手动暂停，若存在服务限额仍自动等待。

“处理中”只统计实际工作线程，领取但尚未执行的文件归入排队。速度为当前任务下载采样的合计，保存大小不是下载速度。部分文件大小未知时，`+` 表示已知下限。任务卡随持久化任务恢复，重启后沿用已有卡片；已结束任务移除无效控制按钮，失败项可单独重试。Web 账号面板在可见时每 5 秒刷新，短时请求限流不单独报警。

日期/标签任务在 Bot 任务卡、`/tasks` 详情和 Web 任务中心显示已检查的频道消息数、发现的文件数、评论扫描计数和当前扫描到的消息时间。频道消息数包含检查后不符合日期/标签或无可下载文件的消息，不把相册补查出的文件重复算作已检查消息。进度在每页扫描后更新，评论分页和文件发现期间最多每 5 秒持久化一次；Bot 卡每 5 秒检查更新。扫描总量事先未知，不额外请求 Telegram 统计总量，也不显示扫描百分比；现有百分比仍表示已发现文件的处理进度。暂停、失败后保留扫描信息，部分页进度不会提前推进恢复游标。

扫描默认每页 `TG_JOB_SCAN_SEGMENT_SIZE=100` 条，单任务串行分页。多个任务共享账号池，每个账号同一时间只执行一个扫描；同账号的扫描 RPC（包括来源解析、内部翻页、相册补查和评论扫描）共用至少 1 秒的请求启动间隔，不占用文件下载名额。扫描遇到 FloodWait 时，遵守 Telegram 返回的冷却时间，并将该账号的扫描间隔加倍，最长 60 秒；持续成功扫描满 10 分钟后逐步减半，最低恢复至 1 秒，长时间空闲不计入恢复。`TELEGRAM_RATE_MAX` 和 `TELEGRAM_HEAVY_RATE_MAX` 限制的是用户命令，不是扫描 RPC。

### 获取 Bot Token

1. 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather) 并开始对话。
2. 发送 `/newbot`，按提示创建机器人。
3. 复制 BotFather 返回的 `HTTP API TOKEN`。
4. 在 TG Vault Web 的“设置 → Telegram”中填写 Token。

### 获取 API ID 和 API Hash

1. 访问 [my.telegram.org](https://my.telegram.org) 并登录 Telegram 账号。
2. 进入 `API development tools`。
3. 创建应用后复制 `api_id` 和 `api_hash`。
4. 在 **设置 → Telegram → Telegram Bot 连接** 中与 Bot Token 一起填写，先测试连接，再保存并启用。连接卡片保留连接状态与 Bot 名称；“更换凭证”“修改 Bot PIN”“刷新状态”位于第一行，“删除配置”单独位于第二行。
5. 需要账号级下载器时，在同页使用手机号、验证码和可选两步验证密码登录；无需手工生成或编辑 session 文件。

### Telegram Bot 允许用户

TG Vault 会限制能通过 Bot PIN 登录的 Telegram 用户。推荐进入 **设置 → Telegram → Telegram Bot 用户权限**，填写一个或多个数字 user id；多个 ID 用英文逗号分隔。

获取 user id：让用户在 Telegram 私聊 `@userinfobot` 查看 `Id`。如果允许列表留空，并且后台还没有任何 Telegram 用户认证成功，第一个正确输入 Bot PIN 的用户可自动加入允许列表。之后应在 Web 中明确维护列表。

### 账号级下载器什么时候需要？

账号级下载器使用登录的 Telegram 用户账号读取媒体，适用于：

- 频道/群组转存：用户账号需要加入对应频道/群组，并确保能看到历史媒体。
- 按日期/标签批量抓取：`/tg_download date`、`/tg_download tag` 依赖用户账号访问来源消息。
- 频道订阅同步：`/tg_sub` 后台扫描依赖用户账号读取频道/群组新消息。
- 大文件下载：Bot 无法直接下载的文件，可尝试通过有访问权限的用户账号下载。

仅登录或明确启用账号时才应连接个人账号；更改界面语言或查看设置不应激活账号。只转存有权访问和保存的内容，遵守 Telegram 限流；遇到冷却或账号限制时，不要反复重试或提高并发。

### Telegram 下载设置

下载并发在 Web **设置 → 维护 → 高级任务设置** 中调整。单文件分片并发与 Bot `/download_workers` 共用，同时下载文件数与 `/file_concurrency` 共用；页面不再常驻显示二次确认阈值，但选择高并发时仍需确认。保留默认值，确有需要时再修改；不要通过提高并发绕过账号冷却。

下载设置中的“下载中”仅统计账号正在执行的文件下载，不含排队、扫描和存储上传；“权限检测”为来源权限最近检查时间。“来源权限汇总”按账号累计，同一来源可重复计入。

### 多账号调度与自动恢复

- 频道任务仍按批次领取持久化条目，但每个文件进入执行阶段后独立选择账号。排队和后续存储上传不占用账号下载名额；同一任务的不同文件可以分配给不同账号。
- 调度跳过禁用、断线、登录失效、冷却和已知无来源权限的账号。已确认来源权限优先，再按权重与当前占用选择；同负载时优先使用更久未被选择的账号，避免空闲时始终使用同一账号。
- 扫描频道、评论和补全元数据也经过调度。扫描、元数据和文件下载分别计数，共享账号冷却；扫描采用独立的串行与请求间隔策略，下载和元数据使用自适应并发上限。
- FloodWait 只冷却返回限制的账号，遵守 Telegram 指定的等待时间；扫描请求会增大扫描间隔，文件下载会降低账号并发上限。当前文件可由另一个有权限的账号重新读取并下载。未完成文件重新下载，不支持跨账号续传分片；已完成文件不重新入队。
- 所有合适账号都忙或冷却时自动等待，释放名额会唤醒等待者，最长每秒重新检查一次；等待可取消。全部账号禁用、断线、登录失效或无来源权限时返回明确错误，不回退到默认账号。账号等待仍占用一个全局文件执行槽，因此全局并发保持原有上限。
- 下载或元数据请求遇到 FloodWait 时，将该账号的运行时并发上限减半，最低为 1。冷却结束后稳定成功运行满 60 秒，每次恢复 1，最多恢复至账号配置上限。自适应上限在进程重启后重置；持久化冷却时间继续生效。
- 全局文件并发仍默认 2、可设置为 1～4；添加账号不会自动提高它，也不会提高服务器带宽或存储服务上传额度。私密频道需要接力账号各自具备访问权限。
- 转发且带可读取来源的媒体使用同一账号调度；直接发给 Bot、没有可重读来源的消息仍通过 Bot 下载，因为 Bot 对话消息 ID 不属于用户账号对话。

## 🔐 安全与访问控制

TG Vault 默认采用“首次初始化”模式保护 Web 和 API：

1. 服务启动后，首次访问 Web 页面需创建至少 8 位的管理员密码，使用 `scrypt` 加盐哈希保存到数据库。请在开放给其他用户前完成初始化。
2. 如果此时已经通过环境变量配置 Telegram Bot，初始化页还会要求创建 Bot 4 位 PIN；新安装也可以先完成网页初始化，再到 **设置 → Telegram** 配置 Bot 和 PIN。
3. 登录成功后，浏览器会获得 HttpOnly Cookie 会话，前端不再把访问 token 写入 `localStorage`。
4. 修改类请求会校验 `Origin`，请确保 `.env` 中的 `CORS_ORIGIN` 与前端公网地址一致。

> [!IMPORTANT]
> 生产环境请使用 HTTPS。默认 `COOKIE_SECURE=true` 时，浏览器只会在 HTTPS 下发送登录 Cookie；如果你只在本地 HTTP 调试，可临时设置 `COOKIE_SECURE=false`。
> `deploy/install.sh` 生成的正式部署会额外写入 `COOKIE_SECURE_FORCE=true`，防止遗留环境值意外关闭 HTTPS Cookie；本地 HTTP 调试请不要沿用该强制值，或同时设为 `false`。

### 自动密钥说明

安装器为新部署生成 `.env` 密钥；未显式配置的内部密钥由应用保存到数据卷的 `/data/secrets/`。迁移时同时备份 `.env`、数据库和完整数据卷。丢失密钥可能导致登录会话失效，TOTP 和第三方存储凭证无法解密。

完整的宿主机 Nginx 部署、健康检查、协调备份与隔离恢复校验流程见 [`deploy/DEPLOY.md`](../deploy/DEPLOY.md)。仓库提供 `deploy/backup.sh` 和只读归档检查脚本 `deploy/restore-verify.sh`；备份包含密钥材料，必须加密并异地保存。

### 双重验证 (TOTP)

TG Vault 内置支持 TOTP 双重验证（如 Google Authenticator）：

- Web 端：在个人设置中扫码激活
- Telegram Bot：发送 `/setup_2fa` 获取设置二维码，并在对话框输入验证码激活
- 启用后，网页登录和使用 Bot 均需二次验证

---

## 🌐 反向代理建议

如果你使用 Nginx、Nginx Proxy Manager 或 Caddy 部署，请参考以下映射：

- **前端 / 网页入口**
  - 示例域名：`https://cloud.example.com`
  - 转发地址：`127.0.0.1:47832`
- **后端 / API 接口**
  - 示例域名：`https://api.example.com`
  - 转发地址：`127.0.0.1:51947`

如果前后端使用不同域名，请在后端环境变量中设置：

```env
VITE_API_URL=https://api.example.com
CORS_ORIGIN=https://cloud.example.com
COOKIE_SECURE=true
```

> [!CAUTION]
> 开启 HTTPS 后，`.env` 中的 `VITE_API_URL` 和 `CORS_ORIGIN` 都应使用 `https://`，否则浏览器可能拦截请求。修改 `VITE_API_URL` 后必须重新构建前端镜像，因为它会被打包进静态文件。
