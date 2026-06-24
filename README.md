# 志愿规划助手

一个 Material 风格的高考志愿数据工作台。应用在浏览器端解析省份、分数、位次和专业偏好，基于轻量样本数据输出冲/稳/保建议，并通过 Cloudflare Pages Functions 统一提供后台推理和 Tavily 联网摘要。

## 功能

- 聊天式高考志愿咨询，支持多会话、本地保存、报考/娱乐双模式
- 浏览器端解析省份、分数、位次、专业偏好和排斥方向
- 基于轻量样本数据输出冲/稳/保推荐
- 后台统一调用 OpenAI 兼容推理服务和 Tavily，浏览器不保存第三方 API Key
- 前台密码认证、深色模式、本地数据覆盖说明和来源列表

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

`npm run dev` 只启动 Vite 前端，适合调试静态界面。需要验证登录、后台推理和 Tavily 时，请使用 Cloudflare Pages 本地模式：

```bash
npm run cf:dev
```

本地后台变量放在 `.dev.vars`，不要提交：

```dotenv
APP_PASSWORD=replace-with-login-password
SESSION_SECRET=replace-with-long-random-secret
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
TAVILY_API_KEY=tvly-...
```

构建检查：

```bash
npm run lint
npm run build
```

## Cloudflare Pages

本项目使用 Vite 前端和 Cloudflare Pages Functions 后台。Wrangler 配置见 `wrangler.jsonc`，构建输出目录为 `dist`，Functions 位于 `functions/`。

当前构建工具链兼容 Node 18.17+，仓库已通过 `.node-version` 固定 Cloudflare Pages 构建使用 Node 20.19.0。保持「编码 → 提交仓库 → Cloudflare 自动部署」即可。

Dashboard 构建配置建议：

- Production branch: `main`
- Build command: `npm run build`
- Build directory: `dist`

生产环境需要在 Pages 项目中配置以下 Secrets/变量：

```bash
npx wrangler pages secret put APP_PASSWORD --project-name project-apex
npx wrangler pages secret put SESSION_SECRET --project-name project-apex
npx wrangler pages secret put LLM_API_KEY --project-name project-apex
npx wrangler pages secret put TAVILY_API_KEY --project-name project-apex
```

`LLM_BASE_URL` 和 `LLM_MODEL` 可按供应商配置；未配置时默认使用 `https://api.deepseek.com` 和 `deepseek-chat`。如果供应商 base URL 已包含 `/v1`，后台会直接复用；否则会自动请求 `/v1/chat/completions`。

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
