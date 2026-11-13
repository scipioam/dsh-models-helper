# dsh-models-helper · 模型助手

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件。它把内置模型供应商克隆为**自定义供应商**，让模型列表、模型参数和价格跟随 [models.dev](https://models.dev) 与 OpenRouter 的公开数据同步，不用再逐个手填；同时估算每一轮对话和每个会话的花费。

*A DeepSeek Harness plugin that clones built-in model providers into custom providers whose model lists, parameters and prices stay in sync with models.dev and OpenRouter, and estimates per-turn and per-session cost.*

> **项目状态：开发中。** 技术验证（M0）已完成，克隆与同步等功能尚未实现。目前安装后只会在「设置 → 模型」里显示技术验证面板。进度见 [ROADMAP.md](ROADMAP.md)。

## 它解决什么问题

DSH 内置供应商（如 `opencode-go`、`openrouter`）的模型目录随 DSH 版本打包，网关上线了新模型，往往要等下一次 DSH 发版才能用到。

改用指向同一网关的自定义供应商可以立刻用上新模型，但每个模型的参数都要手填：上下文窗口、最大输出、输入类型、推理等级、请求兼容性开关（compat），全部从零开始。很多网关同时提供多种协议（例如 opencode-go 同时有 Chat Completions、Responses、Anthropic Messages 和 Gemini 四种），手工维护的成本更高。

模型助手把这些参数从公开的数据源和 DSH 自带的模型目录里取出来，替你写好，并在数据源更新后给出差异，由你确认后再应用。

## 功能

| 功能 | 状态 |
|---|---|
| **克隆内置供应商**：一键生成自定义供应商，沿用原来的 API key，混用多种协议时按协议拆成几条路由，参数自动补全 | 计划中（M1） |
| **绑定已有的自定义供应商**：为手工建的供应商指定参数来源，补全缺失参数 | 计划中（M1） |
| **检查更新**：对比数据源和当前配置，按"新增 / 候选 / 字段更新 / 冲突 / 来源已下架"分组列出差异，勾选后应用；自动识别并保留你手改过的值 | 计划中（M1） |
| **价格表**：每个模型的输入、输出、缓存读、缓存写单价（美元 / 百万 token），可手动覆盖 | 计划中（M2） |
| **花费估算**：每一轮末尾显示本轮花费；会话标题栏显示会话累计，含子智能体 | 计划中（M2） |
| **智能体工具**：让智能体查看状态和差异，经你审批后应用 | 计划中（M3） |

## 工作原理

- **数据源**：models.dev（pi-ai 内置目录的上游）和 OpenRouter 官方 `/api/v1/models`，提供模型列表、上下文/输出上限、输入模态、推理档位、价格，以及每个模型使用的协议。
- **模板**：DSH 自带的 pi-ai 模型目录。数据源不提供的请求兼容性开关和推理档位写法从这里取；新模型沿用同系列模型的设置，并在差异中标注为"推断"。
- **写入**：只通过 DSH 的设置接口写 `llm-pi-ai`（模型供应商）和本插件自己的配置，与「设置 → 模型」页面走同一条路径，并带版本号，避免覆盖并发修改。每次写入都要你在差异面板里确认。

详细规则见 [docs/DESIGN.md](docs/DESIGN.md)。

## 环境要求

- DeepSeek Harness **0.2.2-rc.2**，使用 Web 界面。其他版本尚未验证。
- DSH 所在机器需要能访问 `https://models.dev` 和 `https://openrouter.ai`。

## 安装

**从本地目录安装**（目前唯一的方式）：

1. 克隆本仓库。仓库已提交构建产物 `lib/`，安装时不需要构建。
2. 在 DSH 的 **插件** 页面选择 **添加插件**，指定本仓库所在目录。也可以让 DSH 的智能体执行 `plugin_manager install_bundle`，把目录的绝对路径作为 target。
3. 刷新页面，打开「设置 → 模型」。

发布到 npm 后也可以从插件市场安装（计划中）。

## 使用

**当前（M0）**：「设置 → 模型」中每张 pi-ai 供应商卡片下方有一个「模型助手」面板，点「检查模板与来源」可查看该供应商在内置目录和数据源中的模型数量与协议分组；页面底部的技术验证面板可以运行一次写入测试，它会临时添加一个名为 `models-helper-probe` 的供应商并立即删除。

**计划中的使用流程（M1 起）**：

1. 在内置供应商卡片上点「克隆为自定义供应商」，选择数据源、协议组、要纳入的模型，确认后生成自定义供应商。
2. 需要时在模型选择器里切换到克隆出的供应商；插件会提示把默认模型一并切换过去。
3. 之后在绑定的供应商卡片上点「检查更新」，查看差异、勾选、应用。

> **注意**：克隆出的供应商沿用原内置供应商的 API key 引用。如果原供应商的 key 是在模型页保存的，在模型页删除原供应商会连同 key 一起删除，克隆出的供应商随之失效。需要隐藏原供应商时，请保留它的 key。

## 数据与隐私

- 插件只请求上面两个公开接口，**不携带任何 API key**。
- 下载的元数据缓存在 `<DSH_HOME>/integrations/dsh-models-helper/cache/`，默认 6 小时后过期，可以随时删除。
- 不读取对话内容；花费估算（M2）只读取会话日志里记录的 token 用量。

## 卸载

在插件管理中移除 `dsh-models-helper`。克隆出的自定义供应商是普通的 `llm-pi-ai` 配置，卸载后仍可继续使用和手工编辑；不再需要时可以删除 `<DSH_HOME>/integrations/dsh-models-helper/` 目录。

## 开发

```sh
pnpm install
pnpm run check    # 类型检查 + 单元测试 + 构建
```

架构、目录结构、DSH 集成点和开发流程见 [AGENTS.md](AGENTS.md)。

## 文档

| 文档 | 内容 |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | 设计：背景、字段合并规则、差异分类、价格与花费、界面、风险，以及 M0 验证结论 |
| [ROADMAP.md](ROADMAP.md) | 各阶段目标、验收标准与进度 |
| [AGENTS.md](AGENTS.md) | 面向开发者和编码智能体的技术综述 |

## 许可证

[MIT](LICENSE)
