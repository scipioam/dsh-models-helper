# Roadmap

各阶段的目标、交付物、验收标准与实施情况。设计依据见 [docs/DESIGN.md](docs/DESIGN.md)，技术细节见 [AGENTS.md](AGENTS.md)。

## 总览

| 阶段 | 目标 | 状态 |
|---|---|---|
| **M0** | 技术验证：确认设计依赖的 DSH 接口都可用 | ✅ 已完成（2026-11-13） |
| **M1** | 克隆内置供应商、绑定参数来源、检查更新与应用 | ✅ 已完成（2026-11-17） |
| **M2** | 价格表与花费估算（每轮、会话、含子智能体） | ✅ 已完成（2026-11-18） |
| **M3** | 智能体工具、打磨与发布 | 🟡 M3.0–M3.4 已完成（2026-11-18）；M3.5 暂缓 |
| 后续 | v1 之外的候选功能 | 💭 待评估 |

目标 DSH 版本：0.2.2-rc.2。DSH 升级后需要先复查 M0 中验证过的接口。

---

## M0 · 技术验证 ✅

**目标**：在运行中的 DSH 上逐项确认设计依赖的能力，行不通的地方在动工前调整设计。

**交付物**

- 项目骨架：TypeScript + esbuild 构建、单进程 vitest、零运行时依赖的 bundle 结构。
- Host：仅 owner 可达的 RPC 路由；pi-ai 模板加载器；models.dev / OpenRouter 读取、归一化与磁盘缓存；一组探针方法。
- Client：模型页的两个验证面板（供应商卡片内、页面底部）。
- 设计文档，以及首批单元测试（来源归一化）。

**结论**：全部通过，明细见 [DESIGN.md](docs/DESIGN.md) §11。确认可用的能力有：pi-ai 模板读取、Client↔Host RPC、`settings.describe/mutate` 读写 `llm-pi-ai` 与插件自身配置、写入后路由即时生效、版本号冲突检测、模型页两个 slot、两个数据源。

**对后续阶段的影响**

- 差异与快照必须基于 `describe().user` 并归一化默认值（`value` 含 schema 物化的默认值）。
- 克隆路由要使用独立凭据引用，不能与内置路由共用 key，否则在模型页删除原路由会连带删除凭据（M1 已实现：克隆时复制 key 到 `<ROUTE>_API_KEY`）。

**遗留到 M1 的清理（✅ 已清理）**：删除 `src/host/probe.ts` 中的写入测试和 `probe-results/` 落盘逻辑，把验证面板替换为正式界面；`probe-results/` 目录已在 M1 收尾时删除。

---

## M1 · 克隆、绑定与同步 ✅

**目标**：在「设置 → 模型」里，把一个混用多种协议的内置供应商（如 opencode-go）克隆为若干条参数完整的自定义供应商，并能持续检查更新。

**任务**

| # | 任务 | 状态 |
|---|---|---|
| 1 | 合并引擎（纯函数）：SourceModel × 模板 × 绑定 × 快照 → 期望的路由配置 + 字段来源标注（DESIGN §4） | 已完成 |
| 2 | 模板转换：`thinkingLevelMap` → `reasoningEfforts`；按协议过滤出可写（offered）的 compat；协议组公共 compat 提升到路由级；Gemini 档位约束 | 已完成 |
| 3 | 同系列推断：family / 最长公共前缀 / 最新发布日期；推断值打标 | 已完成 |
| 4 | 差异引擎（纯函数）：快照 / 当前 user 层 / 来源三方比较，分为新增、候选、更新、冲突、已下架，并给出默认勾选（DESIGN §5） | 已完成 |
| 5 | 配置读写层：`user` 层归一化；把勾选项生成为 `settings.mutate` 操作；处理 revision 冲突 | 已完成 |
| 6 | 绑定与价格覆盖（插件 Config，volatile）、模型字段快照与价格快照（数据目录下的 JSON） | 已完成 |
| 7 | 克隆向导：选择来源 → 协议组（可取消、可改 id 和显示名）→ 模型勾选（搜索、全选）→ 自动纳入新模型开关 → 确认 | 已完成 |
| 8 | 绑定已有自定义供应商 | 已完成 |
| 9 | 检查更新：每次都强制联网（条件请求），失败回退缓存并标注数据获取时间；分组列表、字段级新旧值对比、来源标注、勾选与应用；价格快照随检查更新刷新；页脚「全部检查更新」 | 已完成 |
| 10 | 字段锁定 | 已完成 |
| 11 | 克隆后提示切换默认模型（`agentDefaultModel`）；克隆路由使用独立凭据引用（复制原 key），早期共享引用可一键拆分；原路由卡片上提示删除风险 | 已完成 |
| 12 | 元数据缓存状态与手动刷新（页脚「刷新」只更新缓存，不改价格快照） | 已完成 |
| 13 | 清理 M0 探针；补齐中英文文案 | 已完成 |
| 14 | 单元测试：合并、模板转换、推断、差异、归一化 | 已完成 |

**验收标准**

- 克隆 opencode-go 后按协议生成多条路由；各路由的模型参数（上下文、输出上限、输入类型、推理档位、compat）与内置目录中同 id 模型一致，且每条路由至少有一个模型能正常对话。
- 克隆路由拥有独立的凭据引用 `<ROUTE>_API_KEY`（已复制原 key）；删除/改键原内置路由后克隆路由仍可用。
- models.dev 上有而内置目录没有的模型会出现在克隆结果中，参数取自 models.dev，推断出的字段带标注。
- 在模型页手动修改某个模型的字段后再检查更新：该字段不会被默认覆盖；上游同时变化时显示为冲突。
- 数据源下架的模型显示为"来源已下架"，默认不删除。
- 另一标签页并发修改配置后应用，会提示冲突并重新计算，不会覆盖对方的修改。
- 写入结果只包含必要字段，不包含 schema 默认值。
- 点击「检查更新」一定会发起网络请求：在线时得到新数据；断网/失败时回退最近缓存，并显示「在线获取失败」与数据获取时间；没有缓存时只报错，不生成差异。
- 检查更新成功后价格快照与来源价一致（手动覆盖值不变）；克隆成功后同样写入价格快照。

**验证记录（2026-11-17）**

- 在运行中的 DSH 0.2.2-rc.2 上完成冒烟验证：openrouter（单协议组）与 opencode-go（多协议组）克隆、独立凭据、模型勾选裁剪、检查更新与应用、自动纳入开关、绑定/解绑已有自定义路由、字段锁定、页脚全部检查更新与来源缓存刷新、默认模型切换提示、路由卡片删除/共用 key 提示。
- 失败回退、304 校验、并发 revision 重试、应用选择等无法稳定手工构造的路径由单元测试覆盖。
- `pnpm run check` 通过：tsc + vitest（69 个测试）+ esbuild；单测覆盖合并/模板转换/同系列推断/差异/归一化/缓存回退/应用选择/动作层/凭据拆分。
- 测试产物未入库（`.cache/`、`.pnpm-store/`、`node_modules/`、`LOCAL.md` 均在 `.gitignore` 中）。

---

## M2 · 价格与花费 ✅

**目标**：每个模型都有可查、可改的单价；对话界面能看到每一轮和整个会话（含子智能体）的估算花费。

**任务**

| # | 任务 | 状态 |
|---|---|---|
| 1 | 价格表与本地价格快照：手动覆盖 → 快照（克隆/检查更新写入）→ 模板 `cost`（离线兜底）；内置路由用模板价；支持按上下文分段；价格快照只随克隆/检查更新刷新 | 已完成 |
| 2 | 价格表界面：在供应商卡片内展示来源价、覆盖值与数据获取时间，可编辑与恢复来源价；修改后估算立即重算 | 已完成 |
| 3 | Host 会话投影：折叠 `assistant/message` / `assistant/attempt` 的用量，按 (provider, model) 累计 token，经 `wire.view` 交给 Client（分段由 Client 按本地价格选档，见 DESIGN §10 的近似说明） | 已完成 |
| 4 | 每轮花费：`conversation.chat.turnTail`，悬停显示明细；按本地价格表实时计算，不联网 | 已完成 |
| 5 | 会话累计：`conversation.session.header.utilities`，点开按模型分项；按本地价格表实时计算，不联网 | 已完成 |
| 6 | 子智能体聚合 | 已完成 |
| 7 | 单元测试：计费公式、分段选择、缺失单价的回退 | 已完成 |

**验收标准**

- 一轮对话结束后显示本轮花费，与按单价手算的结果一致。
- 会话累计包含子智能体会话；修改单价后，估算立即更新（无需刷新页面）。
- 价格只在你点击「克隆」或「检查更新」后变化；页面渲染与估算不发起网络请求，断网时仍按已有本地价格表显示估算。
- 检查更新失败回退缓存时，价格与估算仍按该缓存数据计算，并显示数据获取时间。
- 没有价格的模型显示 `—`，不显示为 0。
- 同一会话重新打开或刷新页面后，数字保持不变（只依赖会话日志与本地价格表）。

**实现备注（2026-11-18）**

- 已确认（读安装源码）：plain JS 插件可通过 `ctx.inject(['sessionProjections'])` 注册单元；注册表只调用 `stateSchema.parse` / `wire.viewSchema.parse`，因此用 `{ parse }` 结构类型即可，不必引入 zod；`wire.view` 让值经 baseline/`session/projection` 帧到达 Client，slot 标准 props 提供 `useProjection`。
- 用量拆成两个单元：`modelsHelperUsage`（整会话累计，summary 可见，供列表行携带并聚合子智能体）与 `modelsHelperTurns`（按轮明细，`summary: false`，只给当前会话）。
- 价格覆盖改为插件 Config 顶层 `priceOverrides`（route → model），与绑定解耦，内置/未绑定路由也能改价；`Binding.priceOverrides` 仅兼容读取。
- 已在运行中的 DSH 0.2.2-rc.2 上完成 Host 侧验证（2026-11-18）：
  - 两个投影单元注册成功；`summaryKeys()` 只包含 `modelsHelperUsage`，`modelsHelperTurns` 因 `summary: false` 未进入会话列表（临时探针已删除）。
  - 折叠结果与 DSH 自带的 `tokenUsage` 投影逐桶完全一致（本会话实测：input 281,949 / output 121,044 / cacheRead 28,790,400 / cacheWrite 0），`modelsHelperTurns` 同时有 turn 1、turn 2 两轮数据；按本地价（deepseek-v4.1-flash：0.15/0.6/0.003）手算期望值：turn 1 ≈ $0.2001，turn 2 ≈ $0.0052，会话 ≈ $0.2053。
  - `prices.list` 在真实配置上返回 7 条路由：内置 `opencode-go` 32 个模型全部取模板价；4 条克隆路由与 `openrouter-custom` 取价格快照并带获取时间；目录中的其余内置供应商不再返回（只保留已配置或有绑定的路由）。
- 界面验证（2026-11-18，用户确认）：自定义供应商卡片的价格表正常显示，可改价与恢复来源价；对话每轮下方显示「本轮花费」，会话标题栏显示「会话花费」并可点开按模型分项；金额与 Host 侧手算值一致。
- 纯逻辑（预算、子会话聚合、投影值收窄）由 `test/cost-view.test.ts` 覆盖；`pnpm run check` 通过（tsc + 111 个测试 + esbuild）。

---

## M3 · 智能体工具、打磨与发布 🟡

**目标**：让智能体以和界面完全相同的方式读取状态、检查更新与应用差异（写入前必须经用户审批）；同时收口界面、图标、详情页与文档，使 v1 处于「可发布」状态。发布本身按用户要求暂缓。

**任务**

| # | 任务 | 状态 |
|---|---|---|
| 1 | 工具预验证：`ctx.tools.register` 的结构化声明、`tools/pre-execute` 审批、无 DSH import | 已完成 |
| 2 | `models_helper_status`：本地路由、绑定、模板、缓存时间、默认模型 | 已完成 |
| 3 | `models_helper_check`：强制联网检查、失败回退缓存、刷新价格快照、分组计数与推荐选择 | 已完成 |
| 4 | `models_helper_apply`：复用 `bindingApply`，`ask` 审批，拒绝/无通道/`never` 一律不写 | 已完成 |
| 5 | 输出裁剪、`selection` 必须是最近一次差异的子集、单测与错误映射 | 已完成 |
| 6 | 界面与体验评审及修复（差异默认勾选、错误本地化、重试、页脚确认、价格编辑、大列表、焦点） | 已完成（代码/单测；浏览器效果待用户确认） |
| 7 | 正式图标、`docs/DETAIL.md` / `DETAIL.zh.md` / `preview.svg`、locale `meta.detail` | 已完成（渲染待用户确认） |
| 8 | README、AGENTS.md、DESIGN.md、ROADMAP.md、LOCAL.md 更新 | 已完成 |
| 9 | 发布到 npm，接入插件市场（可选） | 暂缓（M3.5） |

**工具清单**

| 工具 | 参数 | 联网 | 写入 | 说明 |
|---|---|---|---|---|
| `models_helper_status` | 无 | 否 | 无 | 与卡片/页脚共用 `helperStatus`；不含凭据引用 |
| `models_helper_check` | `route?` | 是，强制在线；失败回退缓存 | 只刷新本地价格快照 | 与界面「检查更新」共用 `bindingDiff`；返回计数、`revision`、推荐选择 |
| `models_helper_apply` | `route`、`revision`、`accept?: "recommended"` 或 `selection` | 否 | `llm-pi-ai` + 模型字段快照 | 与界面「应用」共用 `bindingApply`；执行前 `ask` |

**设计与安全**

- 三个工具都调用 Host 的同一份 action，不复制业务逻辑；界面与智能体结果一致。
- `tools/pre-execute` 只对 apply 返回 `ask`，reason/displayReason 带路由与新增/更新/删除计数。审批通道缺失或策略为 `never` 时失败关闭，不提供绕过开关。
- `bindingApply` 新增选择校验：新增/删除行必须在该组，更新字段必须在该差异列出过；引用不存在或已变化的差异返回 `refresh-required` / `revision`。
- 工具结果有上限：status 最多 100 条路由/绑定；check 最多 20 个路由、每路由 20 行、总计 120 行、10 条价格变化，超出显式 `truncated`；推荐选择超过 100 行时省略并标记，提示用 `accept: "recommended"`。
- `models_helper_check` 和界面「检查更新」一样会刷新本地价格快照（不写 `llm-pi-ai`）；`models_helper_status` 不联网。
- 差异缓存在 Host 内存：插件重载后必须先重新 check 才能 apply；这是有意的，避免旧选择写入。

**实现备注（2026-11-18）**

- `pnpm run check` 通过：tsc + 140 个测试 + esbuild；`lib/index.js` 约 145 KB，`lib/client.js` 约 100 KB。
- Host 已通过 `plugin_manager set_bundle` 先禁用再启用完成重载，`include:models-helper` 当前为 `active`；Client 需要用户刷新页面加载新的 `lib/client.js`。
- 新增 `src/host/tools.ts`、`src/host/tool-summary.ts`、`src/shared/selection.ts`、`src/shared/errors.ts`、`src/client/errors.ts`、`src/client/diff-selection.ts`；工具用结构类型声明，未 import 任何 DSH 包。
- 修复评审发现的阻断问题：差异面板默认勾选此前忽略 `defaultChecked`，会把候选模型加入、把来源已下架模型删除；现在 added/updates 才默认选中，candidates/removed 不选，conflicts 只选未设置的字段。回归测试见 `test/diff-selection.test.ts`。
- 其他修复：Host 错误按稳定 code 本地化（`errorCode.*`，中英文键集合由 `test/locales.test.ts` 校验）；`diff.error` 改带 `errorCode`；页脚/卡片 status 共享一份快照并可重试；解除绑定增加行内确认并提示会删除价格快照；价格表缓存单价非法输入不再静默丢弃、恢复来源价只在有覆盖时出现、分段价可见；价格列表限高；差异面板加「全选本组/全不选」与「重新检查」；会话花费弹层支持 Escape；补充焦点样式。
- 运行中工具冒烟（2026-11-18，由新起的子智能体在注册后调用）：
  - `models_helper_status` 可用；首次返回 47 条路由（含 40+ 个未配置内置供应商），据此把摘要收敛为「已配置/已绑定/默认模型」相关路由，重新构建并重载后只返回 5 条实际路由（openrouter-custom 与四个 opencode-go 协议组）。
  - `models_helper_check({route:"opencode-go-gemini"})` 成功：`online: true`、`fetchedAt` 为本轮时间、1 个 `candidate` 且 `defaultChecked: false`、无价格变化，与 `autoIncludeNew: false` 的预期一致。
  - `models_helper_apply` 的拒绝路径：审批门禁触发，工具在 dispatch 前终止，没有写入。
  - `models_helper_apply` 的批准路径（2026-11-18，新会话 `session-4e490cc8-da66-46f4-9f48-e7525b0d0d5d`）：check 得到 revision 2；apply 触发 `approval/asked`（seq 30），`approval/decided` 为 `allowed-once`（seq 31）；工具返回 `{route:"opencode-go-gemini", changed:1, revision:3}`（seq 32）；随后 status 显示 `modelCount: 2`、`llmRevision: 3`，绑定仍在。用户随后在模型页删除了测试模型；复查 status：`opencode-go-gemini.modelCount = 1`、`llmRevision = 4`，清理完成。
- **尚未验证**：界面/图标/详情页的最终视觉需要用户刷新页面确认（本机无浏览器控制）。

**验收标准**

- [x] 工具定义、审批门禁、选择校验、输出裁剪与错误映射有单测；`pnpm run check` 通过。
- [x] 运行中实例：三个工具可见；`status`/`check` 与界面一致；apply 在 `ask` 下弹审批且拒绝不写。
- [x] apply 在用户批准后写入：审批 `allowed-once`，`changed:1`、`llmRevision` 2→3，`modelCount` 1→2，结果与界面应用一致。
- [ ] 英文界面不出现中文 Host 错误；页脚/卡片错误可重试；解除绑定有确认。
- [x] 图标、详情页、locale `meta.detail` 文件存在且通过 XML/路径校验。
- [ ] 插件管理中英文标题、描述、详情页与图标渲染正确（需用户确认）。
- [x] README/AGENTS/DESIGN/ROADMAP 与实现一致。
- [ ] npm 发布与安装验证（M3.5 暂缓）。

---

## 后续候选（v1 之外）

- 定时自动同步：只新增模型、只更新未锁定字段，不删除。
- 多币种：按绑定设置币种，或全局显示币种加汇率。
- 支持更多数据源：供应商自身的 `/models` 接口、用户自定义 JSON 源。
- 单一协议的内置目录：直接在内置路由上追加新模型，保留原生 compat。
- 其他 settings namespace（如 `llm-deepseek`）。
