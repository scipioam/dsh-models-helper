# AGENTS.md — dsh-models-helper 技术综述

面向编码智能体和新加入的开发者：读完本文就能定位代码、理解它与 DeepSeek Harness（DSH）的接合方式，并开始开发。产品层面的介绍见 [README.md](README.md)，设计细节见 [docs/DESIGN.md](docs/DESIGN.md)，阶段与进度见 [ROADMAP.md](ROADMAP.md)。

> 如果仓库根目录有 `LOCAL.md`，那是当前机器的本地说明（不入库），记录了本机路径、资源限制和环境特殊情况，请一并阅读。

## 1. 一句话

一个 DSH **bundle**，包含 Host 插件和 Web Client 插件：从 models.dev / OpenRouter 拉取模型元数据，结合 DSH 自带的 pi-ai 模型目录（作为 compat 与推理档位的模板），生成或更新 `llm-pi-ai` 中的自定义供应商配置；并依据会话用量估算花费。当前处于 **M0 已完成、M1 未开始**，代码里的界面仍是 M0 的技术验证面板。

## 2. 必读顺序

1. [docs/DESIGN.md](docs/DESIGN.md) §1–§5：问题根因、核心概念（来源 / 模板 / 协议组 / 绑定 / 快照）、字段合并规则、差异分类。
2. [docs/DESIGN.md](docs/DESIGN.md) §11：M0 验证结论，列出所有已确认可用的 DSH 接口和实测到的坑。
3. [ROADMAP.md](ROADMAP.md)：当前阶段的任务清单与验收标准。
4. 本文 §5：DSH 集成点速查。

## 3. 技术栈与硬性约定

| 约定 | 原因 |
|---|---|
| TypeScript 源码，esbuild 打包到 `lib/index.js`（Host，ESM/Node）与 `lib/client.js`（Client，IIFE） | DSH 直接加载 `lib/`；本地目录安装是 `link:`，不会替你构建 |
| **`lib/` 必须随源码一起提交**；改了 `src/` 就重新构建再提交 | 安装方无需运行构建脚本 |
| **运行时零依赖**：`@deepseek-ai/schemastery` 打包进 Host bundle；`dependencies` 保持为空 | `link:` 安装不会为被链接目录安装依赖；也避免安装脚本审批 |
| **不 import 任何 DSH 包**（包括类型）。所需服务的形状在 `src/host/dsh.ts`、`src/client/dsh.ts` 里按结构声明 | profile 插件无法稳定解析 DSH 内部包；结构类型让 DSH 小版本变动只影响局部 |
| Client 不 `require` 任何 DSH Client 包；React 由页面模块加载器在工厂函数执行时注入（`src/client/runtime.ts` 的 live binding） | DSH 的插件实践要求；Client 包随时可能变 |
| 样式只用 `--dsw-alias-*` 主题 token，类名统一 `dmh-` 前缀，以 `<style>` 元素渲染在组件内 | 跟随宿主主题与明暗模式，卸载即清理 |
| 文案全部走 Client locale 服务，命名空间 `dsh-models-helper`；`src/client/locales.ts` 中 `zh` 是键集合的真源，`en` 必须同键 | 中英文界面 |
| 插件配置字段一律 `.volatile()` | 才能通过 `settings.mutate` 在线修改且不重启插件 |
| **网络只在显式动作发生**：克隆、检查更新（含全部检查更新）、页脚刷新；页面渲染、价格表与花费估算只读本地数据 | 用户明确要求：价格不在渲染路径联网；检查更新每次都必须发请求，失败才回退缓存 |
| **价格不写入 llm-pi-ai**：来源价快照存数据目录、手动覆盖存插件配置；金额不持久化，渲染时按本地价格表计算 | 保持 llm-pi-ai 配置干净；改价或同步后估算即时重算 |
| 构建和测试保持单进程：vitest 单 fork、无 watch，tsc 不与其他重任务并行 | 项目需要能在低配机器上开发 |

## 4. 目录结构

```
README.md               产品说明：是什么、怎么装、怎么用
AGENTS.md               本文
ROADMAP.md              阶段目标、任务、验收标准与进度
LOCAL.md                （不入库）当前机器的本地说明
cordis.patch.yml        bundle 补丁：插入 Loader 行 id=models-helper, name=dsh-models-helper
package.json            dsh.bundle / dsh.client 声明、exports、files
locale/{en,zh}.json     插件管理里显示的 meta.title / meta.description
icon.svg                插件图标（36×36）
lib/                    构建产物（入库）
scripts/build.mjs       esbuild：先 Host 后 Client，顺序执行
vitest.config.ts        单 fork、文件串行、无测试文件时通过
pnpm-workspace.yaml     不运行 esbuild 的安装脚本
src/shared/rpc.ts       前后端共用的 RPC 约定：endpoint 常量、方法表 RpcMethods 及其参数/结果类型
src/host/
  index.ts              Host 入口：导出 name / Config / apply；在 connection 可用时注册 RPC 方法
  rpc.ts                精确 Fetch 路由 /api/dsh-models-helper/rpc，说 Connection 的 client-request/server-response 信封
  dsh.ts                Host 侧 DSH 服务的结构类型
  pi-ai.ts              在运行时定位并加载已安装的 pi-ai 目录（模板）
  sources.ts            models.dev / OpenRouter 的读取与归一化为 SourceModel
  cache.ts              大文档的磁盘缓存（并发去重、下载失败时回退旧副本；只在显式动作时拉取）
  probe.ts              M0 探针（M1 起逐步被正式功能替换）
src/client/
  index.tsx             Client 入口：window.__ModuleLoader__.load({ id, factory })，注册 locale 与 slot
  runtime.ts            React live binding
  api.ts                Host RPC 的类型化调用封装（传输错误折叠为 { ok: false }）
  dsh.ts                Client 侧 DSH 服务与 slot owner props 的结构类型
  locales.ts            zh / en 词典
  styles.ts             组件内样式（只用主题 token）
  ProbeViews.tsx        M0 验证面板（provider-card 与 footer）
test/                   vitest 单元测试（纯逻辑，不依赖 DSH 运行时）
docs/DESIGN.md          设计文档
```

## 5. DSH 集成点速查（以 0.2.2-rc.2 为准）

### Host

| 服务（`ctx.get(...)`） | 用途 | 代码位置 |
|---|---|---|
| `connection` | `connection.fetch.register({ path: '/api/dsh-models-helper/rpc', methods: ['POST'], requestBody: 'buffered', fetch })` 注册精确路由；**只有 owner Peer 能到达** | `src/host/rpc.ts` |
| `settings` | `describe()` 读各 namespace 的 `value`（生效值）/ `user`（profile 层）/ `revision`；`mutate(ns, ops, revision)` 按路径写入 | `src/host/probe.ts` |
| `configEditor` | `entries()` 找 llm-pi-ai 的 Loader 行（用于定位其包目录） | `src/host/pi-ai.ts` |
| `pluginPackages` | `packageOf(specifier, parentURL)` 按 profile 的解析规则定位包目录 | `src/host/pi-ai.ts` |
| `llm` | `listConfigurableProviders()`：每条路由的 `declared`（`false` 为内置目录路由，`true` 为手工声明）等 | `src/host/probe.ts` |
| `profileContext` | `home`（DSH home）→ 数据目录 `<home>/integrations/dsh-models-helper/` | `src/host/probe.ts` |

相关 settings namespace：`llm-pi-ai`（所有 pi-ai 供应商，路径 `providers.<routeId>`）与 `models-helper`（本插件，即 Loader 行 id）。

### Client

| 服务 / slot | 用途 |
|---|---|
| `connection.rpc.call('/api', 'dsh-models-helper/rpc', { method, args }, signal)` | 调用 Host；返回 `{ ok, value }` 或 `{ ok: false, error }` |
| `locale.register(ns, locale, dict)` / slot 选项 `locale: NS` | 组件通过 `props.t(key, params)` 取文案，`{name}` 占位插值 |
| `slots.inject(name, () => slots.register(options, Component))` | slot 消失时自动撤销、恢复时自动重装 |
| `settings.models.provider-card`（keyed，key=`llm-pi-ai`） | 每张 pi-ai 供应商卡片内的扩展区；owner props：`provider`（含 `provider` 路由 id、`declared`、`displayName`…）、`configured`、`keyConfigured` |
| `settings.models.footer`（list） | 模型页底部扩展区 |
| 计划使用：`conversation.chat.turnTail`、`conversation.session.header.utilities` | M2 的每轮花费与会话累计 |

`package.json` 的 `dsh.client.inject` 列出需要先激活的 Client 包（connection、locale、settings-models），只用于排序激活，不会被 import。

### pi-ai 模板加载

`@earendil-works/pi-ai` 是 `@deepseek-ai/dsh-llm-pi-ai` 的私有依赖，不能按名字 import。加载链：`configEditor.entries()` 中 name 为 `@deepseek-ai/dsh-llm-pi-ai` 的行 → `entry.parent.tree.ctx.baseUrl` → `pluginPackages.packageOf()` 得到 llm-pi-ai 目录 → 以该目录为起点再定位 pi-ai（失败时沿 `node_modules` 向上查找）→ 读 pi-ai 的 `exports["./providers/*"].import`，把 `*` 换成 `all` 后动态 import → `getBuiltinModels(providerId)`。加载失败不缓存，下次调用会重试。

## 6. 必须知道的坑

1. **`describe().value` 含 schema 物化的默认值**（`modelOverrides: {}`、`compat.chatTemplateKwargs: {}`、`defaultContextWindow` 等）。做差异和快照时要读 `describe().user` 并对默认值做归一化，否则所有字段都会被误判为手改。
2. **`settings.mutate` 只接受 volatile 字段路径**，并以 `revision` 做乐观锁；过期会抛出 `changed since it was read`。应对方式是重新 describe 并重算差异，不要盲目重试。
3. **pi-ai 的 compat 分 offered / withheld**。自定义路由上写 withheld 字段（如 `supportsMidConvoSystemMessages`、`sessionAffinityFormat`、`openRouterRouting`）会被 llm-pi-ai 拒绝，合并引擎必须过滤掉。可写字段清单以已安装 llm-pi-ai 的 `src/catalog.ts` 里的 `*_COMPAT_GATE` 为准。
4. **compat 字段只能写到声明它的协议上**：模型级写错协议会报错，路由级会被跳过，但如果路由上没有任何模型能读到该字段，同样报错。
5. **Gemini（`google-generative-ai`）路由**的推理档位只允许 `minimal/low/medium/high`，且值必须等于档位名。
6. **`reasoningEfforts`** 中只有 `off` 可以留空（null）；至少要有一个 `off` 以外的档位；`false` 表示不推理。
7. **内置路由的 key 引用**通常是模型页派生的 `<ROUTE>_API_KEY`。在模型页删除该路由会连凭据一起删除，克隆出的路由会因此失效。
8. **models.dev 的 api.json 约 6 MB**：只缓存原文到磁盘，每次解析后只保留需要的供应商，不要把整个对象常驻内存。
9. **精确 Fetch 路由路径必须以 `/api/` 开头**；endpoint 的每一段只能包含 `[A-Za-z0-9_$.-]`。
10. **Host 代码更新不会自动生效**：`link:` 安装下文件变化要等下一次 profile 重组。需要在插件管理里把本插件包停用再启用（或执行任一会触发重组的插件管理操作）；Client 端刷新页面即可。
11. **价格只在显式同步时从网上取**：克隆/检查更新写入价格快照，界面与花费估算只读本地（覆盖 → 快照 → 模板 `cost`）；页脚「刷新」只更新元数据缓存，不改价格快照。
12. **检查更新每次都强制联网**（条件请求，304 也算成功），失败才回退缓存并标注数据获取时间与失败原因；不能因缓存未过期而跳过请求；无缓存时只报错、不生成差异。

## 7. 常用命令

```sh
pnpm install          # 只有开发依赖
pnpm run typecheck    # tsc --noEmit（含 test/、scripts/）
pnpm run test         # vitest，单 fork，无测试文件时也通过
pnpm run build        # 生成 lib/
pnpm run check        # 以上三步顺序执行；提交前运行
```

只有带构建脚本的依赖才需要审批；esbuild 的二进制来自平台可选依赖，`pnpm-workspace.yaml` 已将其安装脚本设为不运行。

## 8. 开发与验证循环

1. 修改 `src/`，运行 `pnpm run check`。
2. **首次**：把仓库目录作为本地插件安装（插件页的「添加插件」，或智能体的 `plugin_manager install_bundle`，target 为仓库绝对路径）。
3. **之后**：停用再启用插件包，让 Host 加载新代码；刷新页面，让 Client 加载新代码。
4. 验证手段（按优先级）：
   - 有浏览器控制时直接看页面；没有时用 Cordis inspect（`Slots.listSubTree` 看 slot 是否被占用，`Config.listConfigs` 看 Loader 行），并请用户操作。
   - M0 期间，Host 会把每个探针结果写到 `<DSH_HOME>/integrations/dsh-models-helper/probe-results/<name>.json`，用户点完按钮即可读取（M1 清理）。
   - 纯逻辑（归一化、合并、差异）一律写 vitest 单测，不依赖 DSH 运行时。
5. 测试中改动过的用户状态（如临时供应商）必须恢复。写入测试本身就遵循"增加后立即删除"。
6. 涉及来源同步的改动要验证两条路径：在线成功（拿到新数据）与失败回退（缓存数据 + 数据获取时间标注）；价格与估算相关改动还要确认渲染路径没有发起来源请求。

## 9. 编码约定

- RPC：方法名形如 `<领域>.<动作>`，例如 `probe.status`、未来的 `binding.diff`。在 `src/shared/rpc.ts` 的 `RpcMethods` 中声明参数和结果类型，在 `src/host/index.ts` 中实现；业务错误抛 `RpcError(code, message)`，code 统一以 `models-helper/` 为前缀。
- 一个操作只实现一次，放在 Host；界面和（M3 的）智能体工具调用同一个 Host 方法。
- 合并引擎、差异计算写成纯函数，输入为 SourceModel、模板模型、绑定和快照，输出期望配置和差异；I/O 留在边缘。
- 注释说明"为什么"；对 DSH 行为的假设写明出处（README 或源码文件）。
- 新增文案同时加 zh 和 en；不要硬编码界面字符串。
- 不在组件外操作 DOM，不向 `document.body` 追加节点；弹层需要时使用宿主 slot。

## 10. 查找 DSH 事实

- 以**运行中的 DSH 安装**为准，不凭记忆。在 DSH 会话里加载 `dsh-doc` skill，它会说明如何定位安装目录、用户文档和各包源码。
- 安装目录下 `docs/user/` 是用户文档；`node_modules/@deepseek-ai/<包>/README.md` 与 `src/` 是各包的约定。常用：`dsh-llm-pi-ai`（配置 schema、目录合并、compat 门控）、`dsh-client-ui-settings-models`（模型页及其 slot 契约）、`dsh-settings`（describe/mutate 语义）、`dsh-client-connection`（RPC 与精确路由）。
- 有 Cordis inspect 工具时，先用 `Service.listService`、`Event.listEvents`、`Slots.listSubTree`、`Theme.listTokens` 核实接口。
