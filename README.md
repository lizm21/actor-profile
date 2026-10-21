# 幕前 · 演员档案

## 2026-10-21 云端测试版

当前 `dist/` 已接入腾讯云 PostgreSQL，点击「提交并预览」保存文字和压缩照片，并生成只读档案链接。打开链接可在不共享本机草稿的浏览器里下载 PDF；编辑、更新和撤回权限留在提交者的浏览器。

- 云端测试入口：https://actor-profile-codex-d2g25pxe97f6c229f.webapps.tcloudbase.com/
- CloudBase 环境：`codex-d2g25pxe97f6c229f`，上海，体验版到期 `2027-04-21 23:59:59`，本次未升级套餐。
- 部署版本：`actor-profile-003`，构建 ID `2609092520`。
- 演员广场：https://actor-profile-codex-d2g25pxe97f6c229f.webapps.tcloudbase.com/directory.html 。提交时主动勾选公开展示才加入目录，支持搜索、查看完整资料，公开页面不提供下载；取消勾选并重新提交可撤下。
- 微信「下载 PDF」立即弹出浏览器下载指引，提供已保存的云端链接；需要用户通过微信菜单或手动粘贴打开系统浏览器。
- 腾讯云默认域名会显示测试域名访问提醒，正式公开运营需另行解决域名与套餐限制。外网页面的确认访问步骤仍待用户完成，微信真机下载未验收。
- 体验版拒绝添加 `lizm21.github.io` 为安全域名，因此本次云端源码单独保存，**不要将本分支直接发布到 GitHub Pages**。原 GitHub 网站继续提供本机版。
- 迁移原 GitHub 网站草稿：在原网址下载 JSON 备份，再在云端版导入并提交。两个网址的本机草稿相互独立。

提交后点击「复制我的管理链接」并私密保存。换手机打开该链接，点击「恢复并编辑」，即可读取云端最新简历并继续修改原记录；也可在首页「恢复我的简历」粘贴链接。管理链接拥有修改、撤下和删除权限，请勿公开分享。

部署、安全设计、验证和后续工作见 [CLOUD-DEPLOYMENT.md](CLOUD-DEPLOYMENT.md)。下文保留原本机版的使用与发布记录，仅作历史参考。

---

## 原本机版记录

免登录的中文演员档案编辑器。填写艺名、照片、个人简述、演出经历和比赛荣誉，点击「提交并预览」弹出档案确认页，再导出可复制文字的 A4 PDF。

## 功能

- 一份本浏览器草稿，使用 IndexedDB 自动保存。
- 经历、荣誉可自由新增、删除、上下调整顺序。
- 一张 JPG、PNG 或 WebP 照片，最大 10 MB；本机等比例压缩，最长边不超过 1000px，目标不超过 180 KB，不裁切。
- JSON 备份与导入，覆盖或清空前确认。
- 中文 PDF、多页排版、空白章节省略、字体不支持的字符提示。
- 手机编辑／预览切换，以及生成 PDF 后的打开保存入口。

文字和照片不会由应用上传到服务器。没有账号、云数据库、统计脚本或大模型 API。第三方脚本和 PDF 字体均随网站提供。网站访问仍需加载静态资源，托管平台会处理普通访问请求。

## 使用提醒

草稿只保存在当前浏览器和当前网址下。清理浏览器数据、隐私模式、换设备或换网址后，不会自动恢复；请定期下载备份。

首次生成 PDF 需下载约 10.6 MB 的字体，网络慢时请等待。PDF 只保留本次使用的字形轮廓，测试无图档案约 212–235 KB，带图档案约 383 KB，实际大小随内容变化。没有自动下载时，可点击「保存 PDF」；在支持文件分享的设备上显示「保存 / 分享文件」。微信可能仍限制保存，且临时 PDF 文件不能跨浏览器使用。当前版本没有云端保存，微信真机效果仍需验证。页面已移除视图切换按钮和迁移码入口，使用「提交并预览」确认档案。

## GitHub Pages 发布

已发布：[打开演员档案编辑器](https://lizm21.github.io/actor-profile/)。演员无需登录 GitHub。

2026-10-21 发布验证：GitHub Actions 检查和部署成功；正式网页表单可打开；九个核心文件（包括中文字体与 PDF 组件）的 SHA-256 与本地版本一致；在线填写中文艺名后成功生成 PDF，浏览器未记录脚本错误。此验证不代表所有地区网络和微信内浏览器均可访问。

当前版本只在各自浏览器保存草稿，尚不包含统一收录、管理审核或公开演员目录。

迁移或重新发布时：

1. 创建空仓库，将本目录推送到 `main` 分支。若采用 GitHub Free 的免费 Pages 托管，使用公开仓库；公开的是编辑器代码，不包含演员草稿。
2. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
3. 在 Actions 页面运行 **Publish actor profile editor**，或向 `main` 推送更新。
4. 检查部署成功后 GitHub 返回的网址，不要把尚未创建的推测网址当作正式链接。

工作流先执行数据测试与语法检查，仅上传 `dist/`。不需要安装构建依赖或配置自有密钥。后续 `main` 更新自动发布。

CSS、JavaScript、字体等路径均为相对路径，支持 GitHub Pages 仓库子路径。未配置自定义域名。

官方文档：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 本地开发

在项目目录执行：

```sh
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

打开 http://127.0.0.1:4173 。不要直接双击 HTML 文件。

```sh
npm test
node tests/pdf-check.mjs
```

测试 PDF 写入 `tmp/qa/`，不会进入仓库。可选放入 `tmp/qa/portrait.jpg` 进行带图测试。PDF 渲染检查及已知验证边界见 `TESTING.md`；该文件记录原编辑器的本地功能验证；GitHub 托管检查见上方发布记录。

## 依赖

- pdf-lib 1.17.1，MIT：https://github.com/Hopding/pdf-lib
- @pdf-lib/fontkit 1.1.1，MIT：https://github.com/Hopding/fontkit
- Noto Sans SC，SIL OFL 1.1：https://github.com/notofonts/noto-cjk

许可证随资源提供。Noto 字体由官方变量 TTF 在 `wght=400` 实例化；PDF 保留原字形编号及复合字形依赖，仅移除未用轮廓，不经过 fontkit 的子集编码路径。已对中文与重音拉丁字母的轮廓、字体校验和及多页渲染进行检查。
