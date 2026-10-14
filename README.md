<p align="center">
  <strong>简体中文</strong> | <a href="README_EN.md"><strong>English</strong></a>
</p>

<div align="center">
  <img src="backend/logo.png" alt="TG Vault Logo" width="150" />

  <h1>TG Vault</h1>

  <p>
    <strong>Telegram 文件转存与归档</strong>
  </p>
  <p>
    面向个人与小团队的 Telegram 转存、媒体归档和多存储源文件管理系统。
  </p>

  <p>
    <a href="#-快速部署-docker-compose"><strong>快速部署</strong></a>
    ·
    <a href="#-功能概览"><strong>功能概览</strong></a>
    ·
    <a href="#-telegram-bot-命令"><strong>Bot 命令</strong></a>
    ·
    <a href="deploy/DEPLOY.md"><strong>部署指南</strong></a>
  </p>

  <p>
    <a href="https://github.com/hicocos/tg-vault/releases"><img src="https://img.shields.io/github/v/release/hicocos/tg-vault?style=for-the-badge&logo=github&color=2f81f7" alt="Latest Release" /></a>
    <a href="https://github.com/hicocos/tg-vault/blob/main/LICENSE"><img src="https://img.shields.io/github/license/hicocos/tg-vault?style=for-the-badge&color=00b894" alt="License" /></a>
    <a href="https://github.com/hicocos/tg-vault/stargazers"><img src="https://img.shields.io/github/stars/hicocos/tg-vault?style=for-the-badge&logo=github&color=f1c40f" alt="Stars" /></a>
    <a href="https://github.com/hicocos/tg-vault/network/members"><img src="https://img.shields.io/github/forks/hicocos/tg-vault?style=for-the-badge&logo=github&color=8e44ad" alt="Forks" /></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Telegram-Bot-26A5E4?style=flat-square&logo=telegram&logoColor=white" alt="Telegram Bot" />
    <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker Compose" />
    <img src="https://img.shields.io/badge/React-TypeScript-3178C6?style=flat-square&logo=react&logoColor=white" alt="React TypeScript" />
    <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  </p>
</div>

从 Telegram 私聊、频道或群组保存文件，在 Web 中浏览和管理。支持本地磁盘、OneDrive、Google Drive、OSS、S3 和 WebDAV。

---

## ✨ 功能概览

- **文件管理**：上传、预览、整理文件夹，在浏览器中管理归档内容；文件夹列表始终完整显示，无需展开或收起。语言与主题等组合控件的焦点框沿完整外框显示；普通输入、下拉框不叠加重复描边，保留键盘焦点提示。
- **媒体预览**：打开、关闭文件详情保留视频与音频播放器，播放位置和播放/暂停状态不会因详情切换重置。
- **Telegram 转存**：发送文件给 Bot，或从频道、群组批量保存媒体。
- **订阅同步**：订阅频道，自动保存后续更新。
- **任务中心**：Web 删除展示记录后，Bot `/tasks` 同步隐藏对应频道任务；任务状态或下载明细更新后会重新显示。失败任务单独统计，不计入等待数量。
- **下载进度卡**：相册任务显示实时下载速度与已下载字节，文件大小完整时按字节计算百分比；静默卡显示汇总速度。暂停、继续与取消按钮支持完整任务 ID，停传或速度采样过期后不保留旧速度。
- **条目计数同步**：普通 Telegram 任务的完成数、失败数及暂停状态变化不受进度写入节流限制；Web 在任务仍处于内存队列时，条目计数与字节进度统一读取实时快照，避免暂停后保留旧条目数。
- **静默任务控制**：私聊、群组和频道的按钮回调使用真实聊天 ID 刷新原进度卡；后台刷新保留所属用户的暂停状态。取消先终止会话刷新，再显示取消结果并移除按钮，避免旧进度覆盖取消提示。
- **保存去向**：下载、保存和完成卡显示任务锁定的存储账户名称、存储类型、账户短 ID 与保存目录；相册完成摘要包含已成功保存文件的总大小，保留 v2.0.0 的成功/失败统计、完成时间与文件记录入口。目录以任务实际目标为准，不从相册标题推测。
- **限流与暂停**：账号下载使用 Telegram MTProto API。文件分片遇到 FLOOD_WAIT 时保留已写入偏移、等待后续传；同账号共享冷却，触发限流后一分钟内串行读取。暂停阻止后续读取并保留临时文件，已发出的请求或存储写入可能仍需收尾。多账号按文件分配，不将一个文件跨账号分片。
- **启动等待**：Bot 可先于用户账号下载器就绪。启动隔离窗口内提交的账号下载会等待账号恢复完成，不再直接报“无可用账号”；等待期间可取消任务。
- **网页任务控制**：普通 Telegram 单文件和相册任务与频道任务一样支持暂停、继续；Bot 聊天范围暂停同步更新正在下载任务的状态与快照版本，Web 下一次刷新显示已暂停。网页单独继续一个任务不会恢复同聊天的其他暂停任务，再次暂停聊天会重新覆盖该任务。控制使用任务自身的聊天与用户范围，已结束或重启后失效的任务不会误操作其他任务。
- **多种存储**：支持本地磁盘、OneDrive、Google Drive、OSS、S3 和 WebDAV。
- **自动归档**：按来源、频道和文件类型整理文件。
- **访问保护**：管理员登录、Bot 用户权限和双重验证。

---

## 🚀 快速部署 (Docker Compose)

准备一台 Linux 服务器，以及用于网页和 API 的两个域名。

### 1. 下载项目

```bash
git clone https://github.com/hicocos/tg-vault.git
cd tg-vault
```

### 2. 运行一键脚本

```bash
./deploy/install.sh
```

按提示检查环境，填写 Web 和 API 地址，确认后开始安装。

### 3. 开始使用

按照[部署指南](deploy/DEPLOY.md#4-配置宿主机反向代理)为两个域名配置 HTTPS，然后打开网页创建管理员账号。

进入 **设置 → Telegram** 连接 Bot；需要频道转存或订阅同步时，再登录 Telegram 账号。其他存储服务可在 **设置 → 存储** 中添加。

[查看完整部署指南](deploy/DEPLOY.md) · [Telegram 配置说明](docs/configuration.md#-telegram-配置与能力)

---

## 🧭 Telegram Bot 命令

连接 Bot 后，发送 `/start` 开始使用，发送 `/help` 查看帮助。

| 命令 | 用途 |
| --- | --- |
| `/tasks` | 查看和管理任务 |
| `/storage` | 查看存储状态 |
| `/path_rules` | 设置保存位置 |
| `/tg_download` | 打开频道、群组下载向导 |
| `/tg_sub` | 添加频道订阅 |
| `/tg_subs` | 查看订阅 |

频道下载与订阅需要登录有访问权限的 Telegram 账号。

Bot 不再提供 `/list` 和 `/find`，文件浏览与搜索请使用 Web 文件管理。

任务中心的频道进度按已处理条目统计（成功、失败和跳过均计入），同时分别显示各项数量；100% 不代表全部成功。扫描或收尾尚未完成时不会显示 100%。数据量显示已成功保存的文件大小与已发现的文件总大小；已压缩的历史明细不再显示不完整的数据量。Bot 的失败完成卡持久保存频道任务关联，清理界面缓存或重启服务后仍可查看失败明细、重试失败项。

频道失败项重试入队后，两端任务列表均保留该任务并显示等待中；只有条目已被下载器领取，才显示下载中。后台恢复扫描默认每 5 分钟执行一次，因此排队期间不代表文件正在传输。

日期/标签下载新增扫描过程展示：已检查消息数、发现文件数、评论扫描计数及扫描到的时间。Bot 任务卡、任务详情和 Web 任务中心均可查看；无媒体及不匹配消息也计入已检查数量，相册文件去重计数。无需额外 Telegram 统计请求，不展示未知总量的扫描百分比。

升级时需应用 `2026101201_telegram_background_job_status_text` 数据库迁移（后端启动自动执行），修复 `completed_with_errors` 超过旧状态列长度而无法收尾的问题，并创建完成卡记录表。

<details>
<summary>更多命令</summary>

- **文件管理**：`/delete <至少 8 位 ID 前缀>` 删除文件；`/setup_2fa` 设置双重验证。
- **任务控制**：`/task_pause [任务ID]`、`/task_resume [任务ID]`、`/task_cancel <任务ID或all>`、`/stop_tasks`。
- **保存目录**：`/p <目录>` 仅用于下一次下载；`/ps <目录>` 用于当前会话；`/pc` 清除自定义目录。
- **批量下载**：`/tg_download date <频道> <开始日期> <结束日期>`、`/tg_download tag <频道> <#标签>`。
- **订阅与重试**：`/tg_unsub <频道或订阅ID前缀>` 取消订阅；`/tg_retry [数量] [任务ID]` 重试失败任务。
- **下载设置**：`/download_workers`、`/file_concurrency`、`/duplicate_mode`、`/cleanup_settings`。

</details>

---

## 🔄 维护与更新

进入自己的 TG Vault 项目目录，运行一键升级脚本：

```bash
./deploy/install.sh
```

---

## 📚 文档

- [部署指南](deploy/DEPLOY.md)：安装、域名配置、环境兼容与故障排查。
- [配置与使用](docs/configuration.md)：Telegram 接入、访问权限与高级配置。
- [本地存储位置](docs/local-storage.md)：选择和查看文件保存目录。
- [版本更新](https://github.com/hicocos/tg-vault/releases)：查看新增功能与修复。

---

## 📂 项目结构

```text
TG Vault/
├── frontend/           # React 网页前端
├── backend/            # Node.js API 与 Telegram 服务
├── init.sql            # 数据库初始化脚本
├── docker-compose.yml  # Docker Compose 部署配置
├── .env.example        # 环境变量模板
└── LICENSE             # MIT License
```

---

## 📄 开源协议

基于 [MIT License](LICENSE) 开源。

作者：[hicocos](https://github.com/hicocos) · 仓库：[hicocos/tg-vault](https://github.com/hicocos/tg-vault)

---

## 📊 项目数据


<div align="center">
  <a href="https://www.star-history.com/#hicocos/tg-vault&amp;type=date&amp;legend=top-left">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=hicocos/tg-vault&amp;type=date&amp;legend=top-left&amp;theme=dark" />
      <img alt="TG Vault Star History Chart" src="https://api.star-history.com/svg?repos=hicocos/tg-vault&amp;type=date&amp;legend=top-left" />
    </picture>
  </a>
</div>
