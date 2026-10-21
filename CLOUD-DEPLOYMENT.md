# 云端演员档案：部署与交接

## 已部署

- 应用入口：https://actor-profile-codex-d2g25pxe97f6c229f.webapps.tcloudbase.com/
- 另一个文件托管入口：https://codex-d2g25pxe97f6c229f-1332018116.tcloudbaseapp.com/actor-profile/
- 环境：`codex-d2g25pxe97f6c229f` / `ap-shanghai`。
- 应用：`actor-profile` / 版本 `actor-profile-002` / 构建 `2609063842`，2026-10-21 更新。
- 静态文件上传核验：24/24 一致。
- 演员广场：https://actor-profile-codex-d2g25pxe97f6c229f.webapps.tcloudbase.com/directory.html

## 用户流程

填写时只保存当前浏览器草稿；点击「提交并预览」上传文字和压缩照片。成功后显示查看链接，并更新当前地址，方便微信菜单转系统浏览器。持链接者可读取指定档案并下载 PDF，不能修改、删除或枚举其他非公开档案。作者可重新提交更新同一链接，也可撤回云端资料。

勾选「公开展示在演员广场」并提交后，所有人可按艺名搜索、分页浏览、打开完整简历和下载 PDF。历史记录默认不公开；取消勾选并提交会同时保存内容、撤下公开展示。原持凭据的私人查看链接仍可用；删除云端档案则全部失效。公开详情链接形如 `/#public=<id>`，不携带编辑或私人查看凭据。

微信点击「下载 PDF」立即显示独立操作弹窗，等待最新内容保存后才展示可复制的链接；通过微信右上角菜单或手动粘贴到系统浏览器继续下载。网页不承诺自动唤起外部浏览器，也不在微信里展示通常无法保存的 blob 下载按钮。

免登录模式的编辑凭据保存在本浏览器 localStorage。清理数据或换设备后不能找回修改权限；JSON 备份包含资料，但不包含编辑凭据。其他浏览器的查看页不会覆盖自己的本机草稿。草稿留存 IndexedDB，云端提交失败时仍可导出本地 PDF。

## 后端与权限

`cloud/001-profiles.sql` 是空环境首次迁移，已执行。`cloud/002-public-directory.sql` 已部署，新增公开状态及目录 RPC；空环境须按顺序执行两个迁移。不要再次整体执行 001 到已有环境。前端只携带 `anon` 角色的 Publishable Key（`dist/cloud-config.mjs`），不是服务端 API Key。

- `public.muqian_profiles` 保存文字和压缩图片 JSON；`public.muqian_write_budget` 保存提交计数。
- 两张表启用 RLS，并撤销 PUBLIC / anon / authenticated 的全部表权限。
- `public.muqian_profile` 是固定 search_path 的 SECURITY DEFINER RPC；只允许 read/save/delete，逐项校验格式、长度、版本和凭据。新增可选 `p_public`，老客户端不传时保留当前公开状态；新档案默认 false。
- `public.muqian_directory` 仅允许 list/read，限定 `is_public AND NOT deleted`；列表每页 12 条、艺名子串查询最多 100 字、offset 最多 1000。返回白名单字段，不泄露凭据、哈希或非公开记录。
- 128 位随机档案 ID；独立 256 位查看/编辑凭据；数据库只存 SHA-256 摘要。查看凭据置于 URL fragment，设置 no-referrer，无统计脚本。
- 事务锁与版本检查保护并发写入；同样内容重试不会重复创建。删除清空资料并保留不可复用的失效 ID。
- 本试点主动限制：每天最多 50 份新档案、1000 次写入，累计最多 1000 个档案 ID（包括已撤回 ID）。这是应用限制，不是腾讯云套餐额度。扩大试点时需复核预算与滥用防护。
- 单份 JSON 最大 450 KB；照片 data URL 最多 350000 字符；艺名 200 字、简介 12000 字、经历/荣誉各 100 条。
- 管理员可通过腾讯云 PostgreSQL 控制台查看所有 `muqian_profiles` 中 `deleted=false` 的记录；演员广场只展示主动公开的资料，尚未制作独立管理员审核页面。

## 验证记录

2026-10-21：

- `npm test`：10 项通过；JavaScript 语法检查通过。
- `node tests/cloud-live.mjs`：真实云端创建、含图文字回读、重复提交、错误凭据、查看凭据不可修改/删除、旧版本拒绝覆盖、并发写入、无效数据拒绝、匿名直接访问表被拒绝、CORS、删除后不可读全部通过。脚本只创建合成测试资料并在 finally 中撤回。
- 内置浏览器本地 `127.0.0.1:4187`：填写合成档案、提交真实云端、生成链接、导出 PDF 成功。
- 独立存储来源 `localhost:4187`：仅凭查看链接恢复中文及换行；无编辑/删除入口；重新生成 PDF 成功。390px 布局未横向溢出。
- 所有本轮云端合成测试内容已清空/撤回，没有上传真实演员资料。
- 外网应用页面已到达腾讯云“页面访问提示”，提示测试域名未经审核并要求“确定访问”；没有替用户确认。用户尚未反馈最终表单访问情况。微信 iOS/Android 真机仍需测试。

## 发布

本项目无构建步骤。在已有 CLI 登录状态下，从项目根目录运行：

```powershell
tcb app deploy actor-profile -e codex-d2g25pxe97f6c229f --framework static --cwd dist --output-dir ./ --deploy-path /actor-profile --force --json
```

只上传 `dist/`，不要上传 `tmp/`、测试下载、部署登录凭据或演员资料。数据库更改通过官方 CLI `tcb db execute` 单独部署；`cloud/run-sql.mjs` 从文件传入 SQL，需要环境变量 `CLOUDBASE_CLI_PATH` 指向已安装 CLI 的 `bin/tcb`。

当前体验版 API 拒绝增加网站安全域名。旧 GitHub Pages 不满足云端 CORS 条件，所以其 main 分支未替换；本次源代码保存到独立云端分支。不要执行本分支现存的 GitHub Pages 手动发布流程。

## 下一步

微信 iOS/Android 真机仍需用户验证：手机填写 → 提交 → 下载指引 → 微信菜单在浏览器打开或手动粘贴 → 下载 PDF。若目标是无平台提示地正式公开使用，需要另行确认可用套餐、安全域名及自有域名方案，不能通过删除网页代码移除腾讯云的域名提醒。

### 第二轮验证（公开目录与微信指引）

- 单元测试 12 项通过；云端原权限测试、目录实际读写测试全部通过。覆盖默认私有、显式公开、查看者不可修改公开状态、并发版本冲突、旧客户端兼容、搜索分页、撤回与删除、无凭据泄露。
- 浏览器完成公开勾选提交 → 独立来源读取目录 → 无结果搜索 → 公开详情 → PDF 生成，以及撤回公开；390px 布局无横向溢出。
- `tests/serve-wechat-preview.py` 仅在本地强制开启微信分支用于 UI 验证，测试了公开/私人详情、提交中点击下载、指引弹窗和复制反馈；不等同于微信内核或真机测试。该文件不在 dist 中，未部署。
- 合成测试记录已撤回并清空内容；未公开任何历史演员资料。

官方依据：[PostgreSQL RPC](https://docs.cloudbase.net/database/postgresql/rpc)、[PostgreSQL 接入与凭据](https://docs.cloudbase.net/database/postgresql/initialization)、[默认域名限制及提示页](https://docs.cloudbase.net/service/alias)。
