# dsh-models-helper 设计文档

> 状态：M0 技术验证已通过（见 §11），待开始 M1 · 目标 DSH 版本：0.2.2-rc.2（pi-ai 1.5.2）

**基本约定**：npm 包名 `dsh-models-helper`；显示名「模型助手」/ *Models helper*；TypeScript + esbuild，源码与构建产物一同入库（安装时无需构建脚本）；单元测试用 vitest；提供中英文文案。

## 1. 背景与根因

| # | 事实 | 后果 |
|---|---|---|
| 1 | 内置供应商的模型目录 = DSH 打包的 pi-ai 生成目录，只随 DSH 升级更新；模型页对内置供应商"获取可用模型"直接读这份目录，不联网。 | 新模型要等 DSH 发版。 |
| 2 | 内置路由写 `models` 列表会整体替换目录，条目按同 id 继承目录参数；**目录外的 id 什么也继承不到**（容量回落 1M/128K、仅文本、无推理、无 compat）。 | 手工追加新模型等于从零配置。 |
| 3 | 目录外模型需要路由级唯一协议；混合协议目录（opencode-go：anthropic-messages 5 / openai-completions 21 / openai-responses 5 / gemini 1；openrouter：anthropic-messages 20 / openai-completions 383）对新模型直接报 `needs an api`，设路由级 `api` 又会改写所有模型。 | 内置路由上实际无法追加新模型。 |
| 4 | 自定义路由一条只能一种协议、参数全手填；pi-ai 目录里的部分 compat 被列为 *withheld*（如 `supportsMidConvoSystemMessages`、`sessionAffinityFormat`、`openRouterRouting`），自定义路由上写会被拒绝。 | 改用自定义供应商 = 参数全丢 + 少量原生特性永久丢失。 |
| 5 | pi-ai 目录有 `cost`，但 DSH 显式置零、无任何消费者。`TokenUsage` 提供互斥的 input / output / cacheRead / cacheWrite。 | 价格只能由插件自存自用；花费估算可行。 |
| 6 | models.dev/api.json 是 pi-ai 目录的上游，实时可取（opencode-go 当前 40 个 vs 内置 32 个）；OpenRouter `/api/v1/models` 公开可取（当前 475 个）。 | 有可靠的新鲜数据源。 |

## 2. 目标与非目标

**目标（v1）**

1. 一键把内置供应商克隆为**绑定了参数来源**的自定义供应商（复用同一 API key 引用，按协议组拆分），参数自动补全。
2. 已有自定义供应商可事后绑定参数来源。
3. 手动"检查更新 → 字段级差异 → 勾选应用"；自动识别并保护手改值。
4. 每个模型的单价展示与编辑；估算每轮、会话（含子智能体）花费并显示在对话界面。

**非目标（v1）**

- 不修改内置供应商路由本身；克隆后原路由保留不动。
- 不做定时自动写入；不支持多币种（统一 USD / 百万 token）。
- 只处理 `llm-pi-ai` 命名空间；`llm-deepseek`、DeepSeek 账号不在范围内。
- 无法恢复自定义路由上被 withheld 的 compat。

## 3. 核心概念

- **来源（Source）**：产出标准化 `SourceModel` 列表的元数据提供者。
  - `models.dev:<providerId>`：models.dev 中某个供应商。
  - `openrouter`：OpenRouter 官方 `/api/v1/models`，仅用于 OpenRouter 网关。
- **模板（Template）**：已安装 pi-ai 目录中的某个内置供应商（如 `opencode-go`），**只**用来补 compat 和推理档位写法。
- **协议组（Protocol group）**：来源中 `(api, baseURL)` 相同的模型集合；一个协议组对应一条自定义路由。
- **绑定（Binding）**：一条自定义路由 ↔ `{ source, template, group, autoIncludeNew, priceOverrides, locks }`。
- **快照（Snapshot）**：上次应用时插件写入的每个模型、每个字段的值，用于识别手改。

### 3.1 SourceModel（标准化记录）

```ts
interface SourceModel {
  id: string
  name?: string
  family?: string              // models.dev family，用于找"同系列"模板
  api?: PiAiProtocol           // openai-completions | openai-responses | anthropic-messages | google-generative-ai
  baseURL?: string
  contextWindow?: number
  maxTokens?: number
  input?: ('text' | 'image')[]
  reasoning?: { supported: boolean; efforts?: string[]; kind?: 'effort' | 'toggle' | 'budget' }
  cost?: Price                 // USD / 1M tokens
  releaseDate?: string
  status?: string              // models.dev: alpha/beta/deprecated…
}
interface Price {
  input: number; output: number; cacheRead?: number; cacheWrite?: number
  tiers?: { inputTokensAbove: number; input: number; output: number; cacheRead?: number; cacheWrite?: number }[]
}
```

### 3.2 来源字段映射

| 字段 | models.dev | OpenRouter `/api/v1/models` |
|---|---|---|
| api | 模型 `provider.npm` ?? 供应商 `npm`：`@ai-sdk/openai-compatible`→openai-completions，`@ai-sdk/openai`→openai-responses，`@ai-sdk/anthropic`→anthropic-messages，`@ai-sdk/google`→google-generative-ai，`@openrouter/ai-sdk-provider`→openai-completions；其他 npm 跳过并提示 | `endpoints` 含 `/api/v1/messages` 且模板同 id 用 anthropic-messages → anthropic-messages，否则 openai-completions |
| baseURL | 模型 `provider.api` ?? 供应商 `api`；anthropic-messages 去掉末尾 `/v1`（SDK 会补 `/v1/messages`） | completions：`https://openrouter.ai/api/v1`；messages：`https://openrouter.ai/api` |
| contextWindow | `limit.context` | `top_provider.context_length` ‖ `context_length` |
| maxTokens | `limit.output` | `top_provider.max_completion_tokens` |
| input | `modalities.input ∩ {text,image}` | `architecture.input_modalities ∩ {text,image}` |
| reasoning | `reasoning` + `reasoning_options`（effort 值列表 / toggle / budget_tokens） | `supported_parameters` 含 `reasoning` / `reasoning_effort` |
| cost | `cost.input/output/cache_read/cache_write`，`tiers[].tier.type=context` → `inputTokensAbove` | `pricing.prompt/completion/input_cache_read/input_cache_write` × 1e6 |

协议组划分以"模板中同 id 模型的协议"为最高优先级（保证 opencode-go 的 Claude 仍走 anthropic-messages），其次是来源声明。

## 4. 字段合并规则

对绑定中的每个模型，自上而下取第一个有值的层：

| 字段 | 优先级（高 → 低） | 写入位置 |
|---|---|---|
| `name` | 锁定/手改 → 来源 → 模板同 id → 不写（回落 id） | 模型 |
| `contextWindow` | 锁定/手改 → 来源 → 模板同 id → 不写（路由默认 1M） | 模型 |
| `maxTokens` | 锁定/手改 → 来源 → 模板同 id → 不写（路由默认 128K） | 模型 |
| `input` | 锁定/手改 → 来源 → 模板同 id → 不写（仅文本） | 模型 |
| `reasoningEfforts` | 锁定/手改 → 模板同 id `thinkingLevelMap` → 同系列模板 → 来源档位推导 → 来源 `reasoning:false` 时写 `false` | 模型 |
| `compat` | 锁定/手改 → 模板同 id（仅 offered 字段）→ 同协议同系列模板 → 不写 | 模型（与路由级相同的字段省略） |
| 路由 `compat` | 协议组内全部模板模型 offered compat 的公共交集 | 路由 |
| 价格 | 绑定价格覆盖 → 来源 → 模板 `cost` | 插件配置（不写入 llm-pi-ai） |

补充规则：

- **thinkingLevelMap → reasoningEfforts**：值为字符串 → 该档位发送该值；值为 `null` → 不提供；缺省 → `off` 视为"支持且不发送"（`off:` 留空），`minimal…high` 视为以档位名发送，`xhigh`/`max` 视为不提供。
- **来源档位推导**：effort 值 `none` → `off: none`；其余值若是 pi-ai 档位名则原样（`off/minimal/low/medium/high/xhigh/max`），不是则丢弃并在差异里提示；toggle → `{ off:, high: high }` 并标记"推断"；budget_tokens → `{ off:, low: low, medium: medium, high: high }` 并标记"推断"。
- **同系列**：优先 models.dev `family` 相同的模板模型；否则取 id 最长公共前缀；多个候选取 `release_date` 最新者。
- **来源标注（provenance）**：每个字段记住取自哪一层；差异面板中"推断"来源（同系列 / 档位推导）单独标识。
- `maxTokens` 写入会成为每次请求的默认上限；pi-ai 本就以 `model.maxTokens`（并按上下文裁剪）作为默认值，因此行为不变。
- Gemini 路由的推理档位只允许 `minimal/low/medium/high`，且值必须等于档位名（与 llm-pi-ai 约束一致）。

## 5. 手改识别与差异

三方比较：**快照**（上次写入值） vs **当前配置** vs **来源新值**。

| 情况 | 分类 | 默认勾选 |
|---|---|---|
| 来源有、路由无，且 `autoIncludeNew` 开 | 新增模型 | ✓ |
| 来源有、路由无，且 `autoIncludeNew` 关 | 候选模型 | ✗ |
| 当前 = 快照，来源 ≠ 快照 | 字段更新 | ✓ |
| 当前 ≠ 快照，来源 = 快照 | 手改（无变化，不显示） | — |
| 当前 ≠ 快照，来源 ≠ 快照 | 冲突 | ✗ |
| 路由有、来源无 | 来源已下架 | ✗（勾选才删除） |
| 字段被锁定 | 不参与比较 | — |
| 无快照（首次绑定已有路由） | 当前值视为手改 | 与当前值不同的字段按冲突处理 |

- 应用时一次 `settings.mutate('llm-pi-ai', ops, revision)`，只对勾选项生成 set/unset；成功后更新快照。
- revision 冲突（另一标签页或手改 `cordis.patch.yml`）→ 提示并重新计算差异。
- `autoIncludeNew` 默认：协议组模型数 ≤ 80 时开，否则关（OpenRouter 关）。

## 6. 用户流程

### 6.1 克隆内置供应商

1. 模型页内置供应商卡片 →「克隆为自定义供应商」。
2. 选来源：自动匹配同 id 的 models.dev 供应商；`openrouter` 额外提供"OpenRouter 官方"。模板默认就是该内置供应商。
3. 协议组列表（显示模型数），默认全选；每组可取消、可改路由 id（预填 `<内置id>-<协议后缀>`，如 `opencode-go-chat`、`opencode-go-anthropic`、`opencode-go-responses`、`opencode-go-gemini`）与显示名（如 `OpenCode Go · Anthropic`）。
4. 每组的模型勾选列表（搜索、全选/全不选）与"自动纳入新模型"开关。
5. 确认 → 写入每条新路由（`api`、`baseURL`、`apiKeyEnv` 复用原路由引用、路由 compat、`models`）、写入绑定、记录快照。
6. 若当前默认模型指向原路由且克隆中有同名模型 → 提示一键切换默认模型。原路由保留，已有会话不受影响。

### 6.2 绑定已有自定义供应商

自定义供应商卡片 →「绑定参数来源」→ 选来源、模板、协议组 → 直接进入首次差异。

### 6.3 检查更新

绑定卡片 →「检查更新」→ 差异面板（新增 / 候选 / 更新 / 冲突 / 已下架 分组，字段级 old → new，带来源标注）→ 勾选 →「应用」。页脚「全部检查更新」对所有绑定执行同一流程。

## 7. 价格与花费估算

- **单位**：USD / 1M tokens；字段 input / output / cacheRead / cacheWrite，可选按输入上下文分段（tiers）。
- **价格查找**（适用于任何路由，不限绑定）：绑定价格覆盖 → 绑定来源价格 → 模板/内置目录 `cost`（内置路由也能估算）→ 无价格显示 `—`。
- **单次调用花费** = input×p.in + output×p.out + cacheRead×p.cacheRead + cacheWrite×p.cacheWrite（`TokenUsage` 各项互斥）；分段按 input+cacheRead+cacheWrite 选档；缺 cacheRead/cacheWrite 单价时按 input 单价计。
- **数据流**：Host 侧 session projection 纯折叠 `assistant/message` 的 usage，按 `(provider, model, tier)` 累计 token（不存金额，保持日志可重放）；经 `wire.view` 交给 Client，Client 用价格表算钱。价格修改后所有估算按新价格重算（不追溯当时价格——已知限制）。
- **显示**：
  - `conversation.chat.turnTail`：每轮花费，悬停显示 输入/输出/缓存读/缓存写 明细。
  - `conversation.session.header.utilities`：会话累计（含子智能体会话），点开按模型分项。
- **子智能体**：通过子会话列表聚合各子会话的投影结果。

## 8. 界面

| 位置 | 内容 |
|---|---|
| `settings.models.provider-card`（key `llm-pi-ai`）· 内置供应商 | 「克隆为自定义供应商」；来源新鲜度提示（如"models.dev 有 8 个内置目录没有的模型"） |
| 同上 · 已绑定的自定义供应商 | 来源徽标、上次同步时间、「检查更新」→ 差异面板、价格表（可覆盖 / 恢复来源价）、字段锁 |
| 同上 · 未绑定的自定义供应商 | 「绑定参数来源」 |
| `settings.models.footer` | 绑定汇总、「全部检查更新」、元数据缓存时间与「刷新」 |
| 对话区 | 每轮花费、会话累计（见 §7） |

UI 遵循宿主主题 token（`--dsw-alias-*`）与 locale，中英文文案；不引用宿主 Client 包组件，控件自绘。

## 9. 架构

```
Host（index.js）
├─ SourceRegistry      拉取 + 缓存 models.dev / OpenRouter（缓存于插件存储，TTL 6h，可手动刷新）
├─ TemplateCatalog     运行时读取已安装 pi-ai 目录（compat、thinkingLevelMap、cost）
├─ MergeEngine         纯函数：SourceModel × 模板 × 绑定 × 快照 → 期望配置 + 差异
├─ BindingStore        绑定与价格覆盖 → 插件自己的 Config（configEditor 写 cordis.patch.yml）
├─ SnapshotStore       快照 → 插件存储（派生缓存）
├─ Writer              settings.mutate('llm-pi-ai', ops, revision)
├─ CostProjection      sessionProjections 单元 + wire.view
└─ RPC 端点            供 Client 调用（clone / bind / diff / apply / prices / refresh）
Client（client.js，esbuild 由 JSX 打包）
├─ provider-card 面板 / 克隆向导 / 差异面板 / 价格表
├─ footer 汇总
└─ turnTail、session header 花费显示
```

## 10. 风险与已知限制

- **模板读取路径**：pi-ai 不是 profile 插件可直接 import 的包，需要在运行时从 `llm-pi-ai` 的安装目录定位 `@earendil-works/pi-ai/providers/all`（M0 已验证可行，见 §11）。DSH 升级可能改变目录结构；读取失败时降级为"无模板"（compat 留空并在面板醒目提示）。
- **withheld compat 丢失**：例如 kimi-k3 的 mid-convo 系统消息、opencode 的 session affinity、OpenRouter 路由偏好；克隆路由上的这些模型会以用户角色提醒接收后续系统文本。
- **推断值可能不准**：新模型的 compat/档位来自同系列推断，差异中明确标注。
- **数据源误差**：models.dev / OpenRouter 的容量或价格可能有误；所有写入都经手动确认。
- **选择器重复**：原内置路由与克隆路由在模型选择器里并存。
- **删除原路由会删 key**：若原路由的 `apiKeyEnv` 是模型页派生的 `<ROUTE>_API_KEY`，在模型页删除原路由会连带删除凭据，克隆路由随之失效；插件在原路由卡片上提示这一点。
- **花费为估算**：按当前价格表计算，不追溯历史价格；不含网关额外费用（如 OpenRouter web search）。

## 11. M0 技术验证结论（2026-11-13，DSH 0.2.2-rc.2）

全部探针在运行中的 Web 实例上通过；原始结果曾落盘在 `~/.dsh/integrations/dsh-models-helper/probe-results/`。

| 问题 | 结论 | 实现方式 |
|---|---|---|
| 能否读取 pi-ai 模板 | ✅ pi-ai 1.5.2，43 个供应商 | `configEditor.entries()` 找到 llm-pi-ai 行 → `pluginPackages.packageOf()` 定位其包目录 → 再从该目录定位 `@earendil-works/pi-ai` → 按 `exports["./providers/*"]` 动态 import `providers/all.js` |
| Client ↔ Host 通信 | ✅ | Host：`ctx.connection.fetch.register()` 注册精确路由 `/api/dsh-models-helper/rpc`（仅 owner 可达）；Client：`ctx.connection.rpc.call('/api', 'dsh-models-helper/rpc', …)`，信封为 `client-request` / `server-response` |
| 读 llm-pi-ai 配置 | ✅ | `ctx.settings.describe()` 的 `llm-pi-ai` 描述符；`apiKeyEnv`（credential-ref）可读：opencode-go=`OPENCODE_GO_API_KEY`，openrouter=`OPENROUTER_API_KEY` |
| 写 llm-pi-ai 配置 | ✅ 新路由即时注册为 `declared=true`，无需重启；过期 revision 被拒绝；删除干净 | `ctx.settings.mutate('llm-pi-ai', ops, revision)` |
| 写插件自身配置 | ✅ | 同上，作用于本插件 namespace `models-helper`（字段需 `.volatile()`） |
| 模型页挂载点 | ✅ 卡片内面板与页脚面板正常显示 | `settings.models.provider-card`（key `llm-pi-ai`）、`settings.models.footer` |
| 来源可用性 | ✅ | models.dev：opencode-go 40 个（内置没有的 8 个），4 个协议组与模板一致（Anthropic 端点去掉 `/v1` 后与模板完全相同）；OpenRouter 官方：408 个支持工具调用的模型（内置没有的 13 个） |
| 数据目录 | ✅ | `~/.dsh/integrations/dsh-models-helper/`：`cache/`（models-dev.json 6.1 MB、openrouter-models.json 0.9 MB）+ 后续的快照 |

**对后续实现的影响**

- `describe().value` 是**生效值**，包含 schema 物化的默认值（如 `modelOverrides: {}`、`compat.chatTemplateKwargs: {}`、`defaultContextWindow`）。差异比较与快照必须基于 `describe().user`（profile 层）并对默认值做归一化，否则每个字段都会被误判为"手改"。
- 内置路由的 key 引用正是模型页派生的 `<ROUTE>_API_KEY`，§10 中"在模型页删除原路由会连带删除凭据"的风险对这两家确实成立，克隆向导需要明确提示。
- 开发循环：仓库以 `link:` 方式安装；重建后 Host 端需要一次 Plugin Manager 操作（停用再启用本插件包）触发重组，Client 端需要刷新页面。
- 尚未验证（留到对应里程碑）：`agentDefaultModel.saveSelection()`（M1）、session projection + `wire.view` 与对话区 slot（M2）、智能体工具与审批（M3）。

## 12. 里程碑

| 阶段 | 内容 |
|---|---|
| M0 | 技术验证：pi-ai 模板读取、Client↔Host RPC、`settings.mutate` 写 llm-pi-ai、provider-card slot 渲染 |
| M1 | 来源 + 模板 + 合并引擎 + 克隆向导 + 绑定 + 差异/应用（模型页） |
| M2 | 价格表 + 每轮/会话花费 + 子智能体聚合 |
| M3 | Agent 工具：查看状态与差异（只读）、应用差异（与界面共用同一 Host 方法，写入前经审批）；打磨、文档与图标 |
