# 幕前 · 演员档案

免登录的中文演员档案编辑器。填写艺名、照片、个人简述、演出经历和比赛荣誉，实时预览并导出可复制文字的 A4 PDF。

## 功能

- 一份本浏览器草稿，使用 IndexedDB 自动保存。
- 经历、荣誉可自由新增、删除、上下调整顺序。
- 一张 JPG、PNG 或 WebP 照片，最大 10 MB；本机等比例压缩，不裁切。
- JSON 备份与导入，覆盖或清空前确认。
- 中文 PDF、多页排版、空白章节省略、字体不支持的字符提示。
- 手机编辑／预览切换，以及生成 PDF 后的打开保存入口。

文字和照片不会由应用上传到服务器。没有账号、云数据库、统计脚本或大模型 API。第三方脚本和 PDF 字体均随网站提供。网站访问仍需加载静态资源，托管平台会处理普通访问请求。

## 使用提醒

草稿只保存在当前浏览器和当前网址下。清理浏览器数据、隐私模式、换设备或换网址后，不会自动恢复；请定期下载备份。

首次生成 PDF 需下载约 10.6 MB 的字体，网络慢时请等待。PDF 完整嵌入中文字体，文件约 6.5 MB。若未自动下载，可使用「打开 PDF 并保存」。微信及各手机浏览器的文件保存体验仍需真实设备验证。

## GitHub Pages 发布

本目录已经准备好发布配置，尚不代表远端仓库或网站已创建。

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

测试 PDF 写入 `tmp/qa/`，不会进入仓库。可选放入 `tmp/qa/portrait.jpg` 进行带图测试。PDF 渲染检查及已知验证边界见 `TESTING.md`；该文件记录原编辑器的本地功能验证，GitHub 托管仍需部署后检查。

## 依赖

- pdf-lib 1.17.1，MIT：https://github.com/Hopding/pdf-lib
- @pdf-lib/fontkit 1.1.1，MIT：https://github.com/Hopding/fontkit
- Noto Sans SC，SIL OFL 1.1：https://github.com/notofonts/noto-cjk

许可证随资源提供。Noto 字体由官方变量 TTF 在 `wght=400` 实例化；PDF 使用完整嵌入，避免子集路径的中文字形缺失。
