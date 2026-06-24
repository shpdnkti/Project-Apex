# 志愿规划助手

一个 Material 风格的高考志愿数据工作台。应用在浏览器端解析省份、分数、位次和专业偏好，并基于轻量样本数据输出冲/稳/保建议。

## 功能

- 聊天式高考志愿咨询，支持多会话、本地保存、报考/娱乐双模式
- 浏览器端解析省份、分数、位次、专业偏好和排斥方向
- 基于轻量样本数据输出冲/稳/保推荐
- 可选 OpenAI 兼容 API 增强回答，可选 Tavily 联网摘要
- 深色模式、API 设置、本地数据覆盖说明和来源列表

## 数据说明

`public/data/admissions.json` 是用于前端演示的轻量样本：

- 原始数据规模：260,884 行
- Web 样本：5,796 行
- 覆盖：安徽、山东、浙江、黑龙江；2024/2025；常见热门专业

这是轻量 Web 版本，不等同于完整官方数据库。正式填报前必须以省教育考试院和学校招生网为准。

## 启动

```bash
npm install
npm run dev
```

构建检查：

```bash
npm run lint
npm run build
```

## Cloudflare Pages

本项目是纯前端 Vite 应用，推荐部署到 Cloudflare Pages。Wrangler 配置见 `wrangler.jsonc`，构建输出目录为 `dist`。

当前依赖使用 Vite 8，Cloudflare Pages 构建环境需要使用 Node 22.12+。仓库已通过 `.node-version` 固定 Node 版本，保持「编码 → 提交仓库 → Cloudflare 自动部署」即可。

Dashboard 构建配置建议：

- Production branch: `main`
- Build command: `npm run build`
- Build directory: `dist`

如果 Dashboard 里历史配置仍是 `npm run cf:deploy`，该脚本也只会执行构建，让 Git 连接的 Cloudflare Pages 自动发布 `dist`。不要在 Git 自动部署里调用 `wrangler pages deploy`。

```bash
npm run cf:list
npm run cf:create
npm run cf:dev
```

如果 Cloudflare Dashboard 中已有同名 Pages 项目，可先运行：

```bash
npm run cf:download-config
```

注意：该命令会用 Dashboard 配置覆盖本地 Wrangler 配置。

## 许可

本项目使用 GNU Affero General Public License v3.0。完整协议见 `LICENSE`。
