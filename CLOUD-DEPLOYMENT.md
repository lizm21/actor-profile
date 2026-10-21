# 云端演员档案：部署与交接

## 已部署

- 应用入口：https://actor-profile-codex-d2g25pxe97f6c229f.webapps.tcloudbase.com/
- 另一个文件托管入口：https://codex-d2g25pxe97f6c229f-1332018116.tcloudbaseapp.com/actor-profile/
- 环境：`codex-d2g25pxe97f6c229f` / `ap-shanghai`。
- 应用：`actor-profile` / 版本 `actor-profile-001` / 构建 `2609063774`。
- 静态文件上传核验：20/20 一致；应用 URL 的 HTML、JS、CSS、字体均可获取，模块 MIME 正确。

## 用户流程

填写时只保存当前浏览器草稿；点击「提交并预览」上传文字和压缩照片。成功后显示查看链接，并更新当前地址，方便微信菜单转系统浏览器。持链接者可读取指定档案并下载 PDF，不能修改、删除或枚举其他档案。作者可重新提交更新同一链接，也可撤回云端资料。

免登录模式的编辑凭据保存在本浏览器 localStorage。清理数据或换设备后不能找回修改权限；JSON 备份包含资料，但不包含编辑凭据。其他浏览器的查看页不会覆盖自己的本机草稿。草稿留存 IndexedDB，云端提交失败时仍可导出本地 PDF。

## 后端与权限

`cloud/001-profiles.sql` 是空环境首次迁移，已执行。不要再次整体执行到已有环境；修改后端时单独应用函数更新。前端只携带 `anon` 角色的 Publishable Key（`dist/cloud-config.mjs`），不是服务端 API Key。

- `public.muqian_profiles` 保存文字和压缩图片 JSON；`public.muqian_write_budget` 保存提交计数。
- 两张表启用 RLS，并撤销 PUBLIC / anon / authenticated 的全部表权限。
- 唯一前端入口 `public.muqian_profile` 是固定 search_path 的 SECURITY DEFINER RPC；只允许 read/save/delete，逐项校验格式、长度、版本和凭据。
- 128 位随机档案 ID；独立 256 位查看/编辑凭据；数据库只存 SHA-256 摘要。查看凭据置于 URL fragment，设置 no-referrer，无统计脚本。
- 事务锁与版本检查保护并发写入；同样内容重试不会重复创建。删除清空资料并保留不可复用的失效 ID。
- 本试点主动限制：每天最多 50 份新档案、1000 次写入，累计最多 1000 个档案 ID（包括已撤回 ID）。这是应用限制，不是腾讯云套餐额度。扩大试点时需复核预算与滥用防护。
- 单份 JSON 最大 450 KB；照片 data URL 最多 350000 字符；艺名 200 字、简介 12000 字、经历/荣誉各 100 条。
- 管理员可通过腾讯云 PostgreSQL 控制台查看所有 `muqian_profiles` 中 `deleted=false` 的记录；尚未制作独立的管理员档案列表、搜索或审核页面。

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

先由用户在应用入口阅读并确认腾讯云测试域名访问提醒，验证手机填写 → 提交 → 复制链接 → 系统浏览器打开 → 下载 PDF。若目标是无平台提示地正式公开使用，需要另行确认可用套餐、安全域名及自有域名方案，不能通过删除网页代码移除腾讯云的域名提醒。

官方依据：[PostgreSQL RPC](https://docs.cloudbase.net/database/postgresql/rpc)、[PostgreSQL 接入与凭据](https://docs.cloudbase.net/database/postgresql/initialization)、[默认域名限制及提示页](https://docs.cloudbase.net/service/alias)。
