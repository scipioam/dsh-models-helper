# dsh-models-helper · 模型助手

DeepSeek Harness 插件：把内置供应商克隆为自定义供应商，模型列表、参数和价格跟随 [models.dev](https://models.dev) 与 OpenRouter 同步，不必逐个手填；并估算每轮、每个会话的花费。

> **当前状态：M0 技术验证。** 目前插件只会在「设置 → 模型」里显示验证面板，还没有克隆和同步功能。设计见 [docs/DESIGN.md](docs/DESIGN.md)。

## 开发

本机资源有限，所有命令都是单进程运行。

```sh
pnpm install --store-dir .pnpm-store   # 仅开发依赖；运行时零依赖
pnpm run typecheck
pnpm run build                         # 生成 lib/index.js（Host）与 lib/client.js（Client）
```

构建产物 `lib/` 随源码一起提交，所以安装时不需要跑构建。

### 在本机 DSH 中调试

1. 在 DSH 的插件管理里以本地目录安装本仓库（`link:` 方式）。
2. 修改源码并 `pnpm run build` 后：
   - Host 端：在插件管理里把 `dsh-models-helper` 停用再启用，触发 profile 重组，加载新代码；
   - Client 端：刷新页面。

## 目录

| 路径 | 内容 |
|---|---|
| `src/host/` | Host 端：RPC 路由、pi-ai 模板读取、元数据来源与缓存、M0 探针 |
| `src/client/` | Client 端：模型页面板（TSX，React 由页面的模块加载器在运行时注入） |
| `src/shared/` | 前后端共用的 RPC 约定 |
| `scripts/build.mjs` | esbuild 构建脚本 |
| `docs/DESIGN.md` | 设计文档 |
