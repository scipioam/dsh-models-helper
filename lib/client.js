"use strict";
(() => {
  // src/client/runtime.ts
  var React = void 0;
  function setReact(value) {
    React = value;
  }

  // src/shared/rpc.ts
  var RPC_ENDPOINT = "dsh-models-helper/rpc";
  var PACKAGE_NAME = "dsh-models-helper";
  function deriveKeyRef(route) {
    return `${route.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
  }

  // src/client/api.ts
  function createApi(connection) {
    return {
      async call(method, args, signal) {
        try {
          return await connection.rpc.call("/api", RPC_ENDPOINT, { method, args }, signal);
        } catch (error) {
          return { ok: false, error: { code: "models-helper/transport", message: error instanceof Error ? error.message : String(error), details: {} } };
        }
      }
    };
  }

  // src/client/locales.ts
  var NS = "dsh-models-helper";
  var zh = {
    "title": "模型助手",
    "error": "出错：{message}",
    "busy": "处理中…",
    "cancel": "取消",
    "close": "关闭",
    "time.unknown": "未知",
    "time.lastSync": "上次同步：{time}",
    "time.never": "尚未同步",
    "time.fetched": "数据获取：{time}",
    "time.checked": "上次校验：{time}",
    "value.none": "未设置",
    "source.models-dev": "models.dev",
    "source.openrouter": "OpenRouter API",
    "provenance.source": "来源",
    "provenance.template": "模板",
    "provenance.inferred": "推断",
    "provenance.same": "未变",
    "field.name": "名称",
    "field.contextWindow": "上下文",
    "field.maxTokens": "最大输出",
    "field.input": "输入类型",
    "field.reasoningEfforts": "推理档位",
    "field.compat": "兼容开关",
    "card.builtin": "内置供应商",
    "card.declared": "自定义供应商",
    "card.clone": "克隆为自定义供应商",
    "card.cloneHint": "生成参数随来源更新的自定义供应商；原供应商保持不变。",
    "card.deleteKeyWarn": "克隆路由共用凭据引用 {key}；在模型页删除原供应商会一并删除凭据，克隆路由将失效。",
    "card.sharedKeyWarn": "此路由与 {others} 共用凭据引用 {key}；删除或修改原路由的密钥会影响它。",
    "card.splitKey": "创建独立密钥",
    "card.splittingKey": "复制中…",
    "card.splitKeyDone": "已创建独立密钥引用 {ref}；此后两个路由的密钥互不影响。",
    "card.defaultNote": "当前默认模型使用这个供应商。",
    "card.check": "检查更新",
    "card.checking": "检查中…",
    "card.boundTo": "更新来源：{source} · 模板：{template}",
    "card.autoInclude": "自动纳入新模型",
    "card.unbind": "解除更新绑定",
    "card.unbindConfirm": "解除后插件不再为这个路由检查更新；不会删除路由、模型配置或 API key。确定解除？",
    "card.lockedCount": "已锁定 {count} 个字段",
    "card.bind": "绑定更新来源",
    "card.bindHint": "为这个自定义路由指定更新来源与模板，之后可以检查更新；解除绑定只停止更新，不影响路由和密钥。",
    "clone.title": "克隆 {provider}",
    "clone.source": "来源：{source}",
    "clone.stale": "在线获取失败，使用 {time} 的缓存数据：{reason}",
    "clone.templateVersion": "模板 pi-ai {version}",
    "clone.group": "{api} · {baseURL}",
    "clone.groupSelect": "克隆这个协议组",
    "clone.routeId": "路由 id",
    "clone.displayName": "显示名",
    "clone.autoInclude": "自动纳入来源新增的模型",
    "clone.models": "{count} 个模型",
    "clone.search": "搜索模型",
    "clone.selectAll": "全选",
    "clone.selectNone": "全不选",
    "clone.withheld": "{count} 个模型的 withheld 兼容开关已跳过",
    "clone.templateOnly": "{count} 个模型仅存在于内置模板",
    "clone.noTemplate": "{count} 个模型没有内置模板，相关参数为推断",
    "clone.confirm": "开始克隆",
    "clone.applying": "正在写入…",
    "clone.done": "已创建路由：{routes}",
    "clone.keyCopied": "已为 {routes} 创建独立密钥引用（已复制原供应商的密钥）。",
    "clone.keyPending": "未能自动复制密钥；请在模型页为 {routes} 填写 API key（引用 {ref}）。",
    "clone.defaultPrompt": "当前默认模型 {model} 在 {provider} 上；是否切换默认模型到新路由？",
    "clone.switchDefault": "切换默认模型",
    "clone.keepDefault": "保持默认模型",
    "clone.noSelection": "至少选择一个协议组",
    "clone.hint": "每个协议组生成一条自定义路由；勾选的模型会带上来源参数与模板 compat。",
    "clone.templateOnlyBadge": "仅模板",
    "clone.inferredBadge": "推断",
    "bind.title": "绑定更新来源",
    "bind.source": "来源",
    "bind.template": "模板",
    "bind.confirm": "绑定并检查",
    "bind.hint": "更新来源决定模型列表与价格，模板决定兼容开关与推理档位写法；绑定只影响检查更新，不改动当前路由配置。",
    "bind.noTemplates": "已安装目录中没有匹配的模板；将只使用来源数据。",
    "bind.noSources": "没有找到与该路由协议组匹配的来源。",
    "diff.title": "检查更新",
    "diff.stale": "在线获取失败，使用 {time} 的缓存数据：{reason}",
    "diff.online": "数据获取时间 {time}",
    "diff.error": "无法检查：{message}",
    "diff.warning.template-missing": "已安装的 pi-ai 模板不可用，兼容开关与推理档位只能从来源推断。",
    "diff.added": "新增模型（{count}）",
    "diff.candidates": "候选模型（{count}）",
    "diff.updates": "字段更新（{count}）",
    "diff.conflicts": "冲突（{count}）",
    "diff.removed": "来源已下架（{count}）",
    "diff.priceChanges": "价格变化（只读，自动生效）",
    "diff.priceOverridden": "手动覆盖中",
    "diff.empty": "没有需要更新的内容。",
    "diff.apply": "应用所选",
    "diff.applying": "正在应用…",
    "diff.applied": "已应用 {count} 项",
    "diff.recheck": "重新检查",
    "diff.conflictHint": "这些字段在你手改之后来源也变了，默认不勾选。",
    "diff.removedHint": "勾选后从路由删除这些模型。",
    "diff.lock": "锁定/解锁字段",
    "diff.unlockHint": "已锁定的字段不参与检查更新",
    "diff.lockedNote": "锁定 {count} 个字段",
    "footer.title": "模型助手",
    "footer.bindings": "{count} 个更新绑定",
    "footer.none": "还没有更新绑定。在自定义供应商卡片上绑定更新来源，或从内置供应商克隆。",
    "footer.checkAll": "全部检查更新",
    "footer.checking": "检查中…",
    "footer.results": "检查结果",
    "footer.applyDefault": "应用默认勾选",
    "footer.applied": "已应用",
    "footer.cache": "来源缓存",
    "footer.cacheLine": "{source}：数据获取 {fetched} · 上次校验 {checked}",
    "footer.cacheMissing": "尚未获取（点「刷新来源缓存」拉取）",
    "footer.cacheValue": "数据获取 {fetched} · 上次校验 {checked}",
    "footer.refresh": "刷新来源缓存",
    "footer.refreshing": "刷新中…",
    "footer.refreshDone": "已刷新",
    "footer.stale": "上次获取失败：{reason}",
    "footer.refreshHint": "刷新只更新来源缓存，不改价格快照；价格随克隆与检查更新更新。",
    "footer.orphans": "{count} 个绑定对应的路由已不存在",
    "footer.unbind": "清除更新绑定",
    "footer.partial": "已应用 {applied} 个路由，{failed} 个失败",
    "footer.bindingsTitle": "已绑定更新来源"
  };
  var en = {
    "title": "Models helper",
    "error": "Error: {message}",
    "busy": "Working…",
    "cancel": "Cancel",
    "close": "Close",
    "time.unknown": "unknown",
    "time.lastSync": "Last sync: {time}",
    "time.never": "Never synced",
    "time.fetched": "Data fetched: {time}",
    "time.checked": "Last checked: {time}",
    "value.none": "not set",
    "source.models-dev": "models.dev",
    "source.openrouter": "OpenRouter API",
    "provenance.source": "source",
    "provenance.template": "template",
    "provenance.inferred": "inferred",
    "provenance.same": "unchanged",
    "field.name": "name",
    "field.contextWindow": "context",
    "field.maxTokens": "max output",
    "field.input": "input types",
    "field.reasoningEfforts": "reasoning levels",
    "field.compat": "compat switches",
    "card.builtin": "Built-in provider",
    "card.declared": "Custom provider",
    "card.clone": "Clone as custom provider",
    "card.cloneHint": "Creates a custom provider whose parameters follow the source; the original stays untouched.",
    "card.deleteKeyWarn": "Cloned routes share credential reference {key}; deleting the original provider on the Models page deletes that credential and breaks the clones.",
    "card.sharedKeyWarn": "This route shares credential reference {key} with {others}; changing or deleting the original key affects it.",
    "card.splitKey": "Create independent key",
    "card.splittingKey": "Copying…",
    "card.splitKeyDone": "Created independent credential reference {ref}; the two routes no longer affect each other.",
    "card.defaultNote": "The current default model uses this provider.",
    "card.check": "Check for updates",
    "card.checking": "Checking…",
    "card.boundTo": "Update source: {source} · template: {template}",
    "card.autoInclude": "Auto-include new models",
    "card.unbind": "Remove update binding",
    "card.unbindConfirm": "Stop checking updates for this route? The route, its models and its API key are kept.",
    "card.lockedCount": "{count} locked fields",
    "card.bind": "Bind update source",
    "card.bindHint": "Pick an update source and template for this custom route; removing the binding only stops update checks and keeps the route and key.",
    "clone.title": "Clone {provider}",
    "clone.source": "Source: {source}",
    "clone.stale": "Online fetch failed; using cached data from {time}: {reason}",
    "clone.templateVersion": "Template pi-ai {version}",
    "clone.group": "{api} · {baseURL}",
    "clone.groupSelect": "Clone this protocol group",
    "clone.routeId": "Route id",
    "clone.displayName": "Display name",
    "clone.autoInclude": "Auto-include models added by the source",
    "clone.models": "{count} models",
    "clone.search": "Search models",
    "clone.selectAll": "Select all",
    "clone.selectNone": "Select none",
    "clone.withheld": "{count} models had withheld compat switches dropped",
    "clone.templateOnly": "{count} models exist only in the installed template",
    "clone.noTemplate": "{count} models have no installed template; their parameters are inferred",
    "clone.confirm": "Clone",
    "clone.applying": "Writing…",
    "clone.done": "Created routes: {routes}",
    "clone.keyCopied": "Created independent credential references for {routes} (copied the original provider key).",
    "clone.keyPending": "Could not copy the key automatically; enter an API key for {routes} on the Models page (reference {ref}).",
    "clone.defaultPrompt": "The current default model {model} runs on {provider}; switch the default to a cloned route?",
    "clone.switchDefault": "Switch default model",
    "clone.keepDefault": "Keep default model",
    "clone.noSelection": "Select at least one protocol group",
    "clone.hint": "Each protocol group becomes one custom route; selected models carry source parameters and template compat.",
    "clone.templateOnlyBadge": "template only",
    "clone.inferredBadge": "inferred",
    "bind.title": "Bind update source",
    "bind.source": "Source",
    "bind.template": "Template",
    "bind.confirm": "Bind and check",
    "bind.hint": "The update source supplies model lists and prices; the template supplies compat switches and reasoning spellings. Binding only affects update checks.",
    "bind.noTemplates": "No matching template in the installed catalog; source data only.",
    "bind.noSources": "No source matches this route protocol group.",
    "diff.title": "Check for updates",
    "diff.stale": "Online fetch failed; using cached data from {time}: {reason}",
    "diff.online": "Data fetched {time}",
    "diff.error": "Cannot check: {message}",
    "diff.warning.template-missing": "The installed pi-ai template is unavailable; compat and reasoning levels can only be inferred from the source.",
    "diff.added": "New models ({count})",
    "diff.candidates": "Candidate models ({count})",
    "diff.updates": "Field updates ({count})",
    "diff.conflicts": "Conflicts ({count})",
    "diff.removed": "Removed from source ({count})",
    "diff.priceChanges": "Price changes (read-only, applied automatically)",
    "diff.priceOverridden": "manually overridden",
    "diff.empty": "Nothing to update.",
    "diff.apply": "Apply selected",
    "diff.applying": "Applying…",
    "diff.applied": "Applied {count} items",
    "diff.recheck": "Check again",
    "diff.conflictHint": "These fields changed upstream after you edited them; unchecked by default.",
    "diff.removedHint": "Checking removes these models from the route.",
    "diff.lock": "Lock/unlock field",
    "diff.unlockHint": "Locked fields are skipped by update checks",
    "diff.lockedNote": "{count} fields locked",
    "footer.title": "Models helper",
    "footer.bindings": "{count} update bindings",
    "footer.none": "No bindings yet. Bind a source on a custom provider card, or clone a built-in provider.",
    "footer.checkAll": "Check all for updates",
    "footer.checking": "Checking…",
    "footer.results": "Check results",
    "footer.applyDefault": "Apply defaults",
    "footer.applied": "Applied",
    "footer.cache": "Source cache",
    "footer.cacheLine": "{source}: data fetched {fetched} · checked {checked}",
    "footer.cacheMissing": 'Not fetched yet (use "Refresh source cache")',
    "footer.cacheValue": "data fetched {fetched} · checked {checked}",
    "footer.refresh": "Refresh source cache",
    "footer.refreshing": "Refreshing…",
    "footer.refreshDone": "Refreshed",
    "footer.stale": "Last fetch failed: {reason}",
    "footer.refreshHint": "Refreshing only updates the source cache, not price snapshots; prices follow clones and update checks.",
    "footer.orphans": "{count} bindings point at routes that no longer exist",
    "footer.unbind": "Remove binding",
    "footer.partial": "Applied {applied} routes, {failed} failed",
    "footer.bindingsTitle": "Bound update sources"
  };

  // src/client/styles.ts
  var CSS = `
.dmh-panel {
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.5;
}
.dmh-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dmh-spread { justify-content: space-between; }
.dmh-title { font-weight: 600; }
.dmh-sub { font-weight: 600; margin-top: 8px; }
.dmh-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dmh-badge {
  display: inline-flex; align-items: center;
  padding: 0 6px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px; line-height: 18px;
}
.dmh-badge-ok { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.dmh-badge-warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.dmh-badge-err { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.dmh-button {
  appearance: none; cursor: pointer;
  padding: 3px 10px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px;
}
.dmh-button:hover:not(:disabled) { border-color: var(--dsw-alias-brand-primary); }
.dmh-button:disabled { cursor: default; opacity: 0.6; }
.dmh-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dmh-button-primary { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.dmh-button-danger { color: var(--dsw-alias-state-error-primary); }
.dmh-input, .dmh-select {
  box-sizing: border-box;
  padding: 2px 6px; border-radius: 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 12px;
}
.dmh-input:focus-visible, .dmh-select:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dmh-list { margin: 6px 0 0; padding: 0; list-style: none; }
.dmh-list li { display: flex; gap: 8px; padding: 2px 0; align-items: baseline; }
.dmh-scroll { max-height: 260px; overflow-y: auto; }
.dmh-ok { color: var(--dsw-alias-state-success-primary); flex: none; }
.dmh-fail { color: var(--dsw-alias-state-error-primary); flex: none; }
.dmh-warn { color: var(--dsw-alias-state-warn-primary); }
.dmh-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; word-break: break-all; }
.dmh-group { margin-top: 10px; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; }
.dmh-check { display: flex; gap: 6px; align-items: baseline; padding: 1px 0; }
.dmh-check input { margin: 0; flex: none; }
.dmh-field { display: flex; gap: 6px; align-items: baseline; padding: 1px 0 1px 22px; flex-wrap: wrap; }
.dmh-old { color: var(--dsw-alias-state-warn-primary); }
.dmh-new { color: var(--dsw-alias-state-success-primary); }
.dmh-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dmh-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.dmh-banner { margin-top: 6px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); font-size: 12px; }
.dmh-banner-err { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.dmh-banner-ok { border-color: var(--dsw-alias-state-success-primary); color: var(--dsw-alias-state-success-primary); }
.dmh-sep { height: 1px; background: var(--dsw-alias-border-l1); margin: 8px 0; }
.dmh-lock { appearance: none; background: none; border: none; cursor: pointer; padding: 0 2px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dmh-lock:hover { color: var(--dsw-alias-brand-primary); }
`;

  // src/client/ui.tsx
  function Styles() {
    return /* @__PURE__ */ React.createElement("style", null, CSS);
  }
  function useStatus(api) {
    const [status, setStatus] = React.useState(void 0);
    const [error, setError] = React.useState(void 0);
    const [busy, setBusy] = React.useState(false);
    const reload = React.useCallback(async () => {
      setBusy(true);
      const result = await api.call("helper.status", {});
      setBusy(false);
      if (result.ok) {
        setStatus(result.value);
        setError(void 0);
      } else {
        setError(result.error.message);
      }
    }, [api]);
    React.useEffect(() => {
      void reload();
    }, [reload]);
    return { status, error, reload, busy };
  }
  function Banner({ kind, children }) {
    const variant = kind === "ok" ? " dmh-banner-ok" : kind === "err" ? " dmh-banner-err" : "";
    return /* @__PURE__ */ React.createElement("div", { className: `dmh-banner${variant}` }, children);
  }
  function fmtTime(value, t) {
    if (value === void 0 || value.length === 0) return t("time.unknown");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function fieldLabel(t, field) {
    return t(`field.${field}`);
  }
  function fieldText(value) {
    if (value === void 0) return "—";
    if (value === null) return "null";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  }
  function sourceLabel(t, source) {
    if (source.kind === "openrouter") return t("source.openrouter");
    return `${t("source.models-dev")} · ${source.provider}`;
  }
  function ProvenanceBadge({ t, provenance }) {
    if (provenance === void 0 || provenance === "same") return null;
    return /* @__PURE__ */ React.createElement("span", { className: `dmh-badge${provenance === "inferred" ? " dmh-badge-warn" : ""}` }, t(`provenance.${provenance}`));
  }

  // src/client/DiffPanel.tsx
  function entryFor(mode, fields) {
    return { mode, fields: new Set(fields) };
  }
  function defaultApplySelection(diff) {
    const rows = [];
    for (const row of diff.added) rows.push({ id: row.id, mode: "add" });
    for (const row of diff.updates) {
      const fields = row.fields.map((field) => field.field);
      if (fields.length > 0) rows.push({ id: row.id, mode: "update", fields });
    }
    return rows;
  }
  function defaultSelection(diff) {
    const map = /* @__PURE__ */ new Map();
    for (const row of diff.added) map.set(row.id, entryFor("add", []));
    for (const row of diff.updates) map.set(row.id, entryFor("update", row.fields.map((field) => field.field)));
    for (const row of diff.conflicts) map.set(row.id, entryFor("update", []));
    for (const row of diff.removed) map.set(row.id, entryFor("remove", []));
    for (const row of diff.candidates) map.set(row.id, entryFor("add", []));
    return map;
  }
  function DiffPanel(props) {
    const { route, diff, api, t, onApplied } = props;
    const [selection, setSelection] = React.useState(() => defaultSelection(diff));
    const [locked, setLocked] = React.useState(() => new Set(diff.locked));
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(void 0);
    const [message, setMessage] = React.useState(void 0);
    React.useEffect(() => {
      setSelection(defaultSelection(diff));
      setLocked(new Set(diff.locked));
      setError(void 0);
      setMessage(void 0);
    }, [diff]);
    const selectedCount = [...selection.values()].reduce((count, entry) => count + (entry.mode === "add" || entry.mode === "remove" ? 1 : entry.fields.size), 0);
    const toggleModel = (row, checked2) => {
      setSelection((previous) => {
        const next = new Map(previous);
        if (!checked2) next.delete(row.id);
        else if (row.kind === "added" || row.kind === "candidate") next.set(row.id, entryFor("add", []));
        else if (row.kind === "removed") next.set(row.id, entryFor("remove", []));
        else next.set(row.id, entryFor("update", row.fields.map((field) => field.field)));
        return next;
      });
    };
    const toggleField = (row, field, checked2) => {
      setSelection((previous) => {
        const next = new Map(previous);
        const current = next.get(row.id) ?? entryFor("update", []);
        const fields = new Set(current.fields);
        if (checked2) fields.add(field);
        else fields.delete(field);
        if (fields.size === 0) next.delete(row.id);
        else next.set(row.id, { mode: "update", fields });
        return next;
      });
    };
    const toggleLock = async (row, field) => {
      const key = `${row.id}/${field}`;
      const nextLocked = !locked.has(key);
      setBusy(true);
      const result = await api.call("binding.lock", { route, model: row.id, field, locked: nextLocked });
      setBusy(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setLocked(new Set(result.value.locked));
      if (nextLocked) {
        setSelection((previous) => {
          const next = new Map(previous);
          const current = next.get(row.id);
          if (current === void 0) return next;
          const fields = new Set(current.fields);
          fields.delete(field);
          if (fields.size === 0) next.delete(row.id);
          else next.set(row.id, { mode: "update", fields });
          return next;
        });
      }
    };
    const apply2 = async () => {
      const rows = [];
      for (const [id, entry] of selection) {
        if (entry.mode === "add" || entry.mode === "remove") rows.push({ id, mode: entry.mode });
        else if (entry.fields.size > 0) rows.push({ id, mode: "update", fields: [...entry.fields] });
      }
      if (rows.length === 0) return;
      setBusy(true);
      setError(void 0);
      const result = await api.call("binding.apply", { route, revision: diff.revision, selection: rows });
      setBusy(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMessage(t("diff.applied", { count: rows.length }));
      onApplied(t("diff.applied", { count: rows.length }));
    };
    const checked = (row) => {
      const entry = selection.get(row.id);
      if (entry === void 0) return false;
      if (entry.mode === "add" || entry.mode === "remove") return true;
      return entry.fields.size > 0;
    };
    const fieldChecked = (row, field) => selection.get(row.id)?.fields.has(field) === true;
    const fieldRow = (row, change, selectable) => {
      const key = `${row.id}/${change.field}`;
      const isLocked = locked.has(key);
      return /* @__PURE__ */ React.createElement("div", { className: "dmh-field", key: change.field }, selectable ? /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: fieldChecked(row, change.field), disabled: busy || isLocked, onChange: (event) => toggleField(row, change.field, event.target.checked) }) : /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, "·"), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, fieldLabel(t, change.field)), change.old === void 0 ? null : /* @__PURE__ */ React.createElement("span", { className: "dmh-old dmh-mono" }, fieldText(change.old)), change.old === void 0 ? null : /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, "→"), /* @__PURE__ */ React.createElement("span", { className: "dmh-new dmh-mono" }, fieldText(change.new)), /* @__PURE__ */ React.createElement(ProvenanceBadge, { t, provenance: change.provenance }), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-lock", title: t("diff.lock"), disabled: busy, onClick: () => {
        void toggleLock(row, change.field);
      } }, isLocked ? "🔒" : "🔓"));
    };
    const group = (title, rows, selectable, fieldSelectable, hint) => {
      if (rows.length === 0) return null;
      return /* @__PURE__ */ React.createElement("div", { className: "dmh-group" }, /* @__PURE__ */ React.createElement("div", { className: "dmh-row" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-sub" }, title), hint === void 0 ? null : /* @__PURE__ */ React.createElement("span", { className: "dmh-hint" }, hint)), /* @__PURE__ */ React.createElement("ul", { className: "dmh-list dmh-scroll" }, rows.map((row) => /* @__PURE__ */ React.createElement("li", { key: row.id, style: { display: "block" } }, /* @__PURE__ */ React.createElement("label", { className: "dmh-check" }, selectable ? /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: checked(row), disabled: busy, onChange: (event) => toggleModel(row, event.target.checked) }) : null, /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, row.id)), row.fields.map((change) => fieldRow(row, change, fieldSelectable))))));
    };
    if (diff.error !== void 0) {
      return /* @__PURE__ */ React.createElement("div", { className: "dmh-group", "data-dmh-diff": route }, /* @__PURE__ */ React.createElement(Styles, null), /* @__PURE__ */ React.createElement(Banner, { kind: "err" }, t("diff.error", { message: diff.error })));
    }
    const priceRows = diff.priceChanges.map((change) => /* @__PURE__ */ React.createElement("li", { key: change.id }, /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, change.id), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted dmh-mono" }, `${change.old?.input ?? "—"}/${change.old?.output ?? "—"} → ${change.new?.input ?? "—"}/${change.new?.output ?? "—"}`), change.overridden ? /* @__PURE__ */ React.createElement("span", { className: "dmh-badge dmh-badge-warn" }, t("diff.priceOverridden")) : null));
    return /* @__PURE__ */ React.createElement("div", { className: "dmh-group", "data-dmh-diff": route }, /* @__PURE__ */ React.createElement(Styles, null), /* @__PURE__ */ React.createElement("div", { className: "dmh-row dmh-spread" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-title" }, t("diff.title")), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, diff.online ? t("diff.online", { time: fmtTime(diff.fetchedAt, t) }) : null)), diff.online ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "warn" }, t("diff.stale", { time: fmtTime(diff.fetchedAt, t), reason: diff.staleReason ?? "" })), diff.warning === "template-missing" ? /* @__PURE__ */ React.createElement(Banner, { kind: "warn" }, t("diff.warning.template-missing")) : null, diff.locked.length > 0 ? /* @__PURE__ */ React.createElement("div", { className: "dmh-hint" }, t("diff.lockedNote", { count: diff.locked.length })) : null, group(t("diff.added", { count: diff.added.length }), diff.added, true, false), group(t("diff.candidates", { count: diff.candidates.length }), diff.candidates, true, false), group(t("diff.updates", { count: diff.updates.length }), diff.updates, true, true), group(t("diff.conflicts", { count: diff.conflicts.length }), diff.conflicts, true, true, t("diff.conflictHint")), group(t("diff.removed", { count: diff.removed.length }), diff.removed, true, false, t("diff.removedHint")), priceRows.length === 0 ? null : /* @__PURE__ */ React.createElement("div", { className: "dmh-group" }, /* @__PURE__ */ React.createElement("div", { className: "dmh-row" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-sub" }, t("diff.priceChanges"))), /* @__PURE__ */ React.createElement("ul", { className: "dmh-list" }, priceRows)), diff.added.length + diff.candidates.length + diff.updates.length + diff.conflicts.length + diff.removed.length === 0 && diff.priceChanges.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "dmh-hint" }, t("diff.empty")) : null, error === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "err" }, t("error", { message: error })), message === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "ok" }, message), /* @__PURE__ */ React.createElement("div", { className: "dmh-actions" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-primary", disabled: busy || selectedCount === 0, onClick: () => {
      void apply2();
    } }, busy ? t("diff.applying") : t("diff.apply"))));
  }

  // src/client/Wizards.tsx
  function initialGroups(plan) {
    const map = /* @__PURE__ */ new Map();
    for (const group of plan.groups) {
      map.set(`${group.api}\0${group.baseURL}`, {
        selected: true,
        routeId: group.suggestedId,
        displayName: group.suggestedName,
        autoInclude: group.autoIncludeNew,
        modelIds: new Set(group.models.map((model) => model.id)),
        search: ""
      });
    }
    return map;
  }
  function CloneWizard(props) {
    const { plan, api, t, isOpenRouter, onSource, onCancel, onDone } = props;
    const [groups, setGroups] = React.useState(() => initialGroups(plan));
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(void 0);
    const update = (key, apply2) => {
      setGroups((previous) => {
        const next = new Map(previous);
        const current = next.get(key);
        if (current !== void 0) next.set(key, apply2(current));
        return next;
      });
    };
    const confirm = async () => {
      const chosen = [];
      for (const group of plan.groups) {
        const state = groups.get(`${group.api}\0${group.baseURL}`);
        if (state === void 0 || !state.selected) continue;
        chosen.push({
          api: group.api,
          baseURL: group.baseURL,
          routeId: state.routeId.trim(),
          displayName: state.displayName.trim(),
          autoIncludeNew: state.autoInclude,
          modelIds: group.models.filter((model) => state.modelIds.has(model.id)).map((model) => model.id)
        });
      }
      if (chosen.length === 0) {
        setError(t("clone.noSelection"));
        return;
      }
      setBusy(true);
      setError(void 0);
      const result = await api.call("clone.apply", { provider: plan.provider, source: plan.source, groups: chosen });
      setBusy(false);
      if (result.ok) onDone(result.value);
      else setError(result.error.message);
    };
    const groupCard = (group) => {
      const key = `${group.api}\0${group.baseURL}`;
      const state = groups.get(key);
      if (state === void 0) return /* @__PURE__ */ React.createElement("div", { key });
      const search = state.search.trim().toLowerCase();
      const models = group.models.filter((model) => search.length === 0 || model.id.toLowerCase().includes(search));
      const toggleAll = (checked) => {
        update(key, (current) => ({ ...current, modelIds: checked ? new Set(group.models.map((model) => model.id)) : /* @__PURE__ */ new Set() }));
      };
      return /* @__PURE__ */ React.createElement("div", { className: "dmh-group", key }, /* @__PURE__ */ React.createElement("label", { className: "dmh-check" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: state.selected, onChange: (event) => update(key, (current) => ({ ...current, selected: event.target.checked })) }), /* @__PURE__ */ React.createElement("span", { className: "dmh-sub" }, t("clone.groupSelect")), /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, group.api), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted dmh-mono" }, group.baseURL), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, t("clone.models", { count: group.models.length }))), group.withheldCompat > 0 ? /* @__PURE__ */ React.createElement("div", { className: "dmh-hint" }, t("clone.withheld", { count: group.withheldCompat })) : null, group.templateOnly > 0 ? /* @__PURE__ */ React.createElement("div", { className: "dmh-hint" }, t("clone.templateOnly", { count: group.templateOnly })) : null, group.noTemplate > 0 ? /* @__PURE__ */ React.createElement("div", { className: "dmh-hint" }, t("clone.noTemplate", { count: group.noTemplate })) : null, state.selected ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dmh-row", style: { marginTop: 6 } }, /* @__PURE__ */ React.createElement("label", { className: "dmh-hint" }, t("clone.routeId"), /* @__PURE__ */ React.createElement("input", { className: "dmh-input dmh-mono", value: state.routeId, onChange: (event) => update(key, (current) => ({ ...current, routeId: event.target.value })) })), /* @__PURE__ */ React.createElement("label", { className: "dmh-hint" }, t("clone.displayName"), /* @__PURE__ */ React.createElement("input", { className: "dmh-input", value: state.displayName, onChange: (event) => update(key, (current) => ({ ...current, displayName: event.target.value })) })), /* @__PURE__ */ React.createElement("label", { className: "dmh-check" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: state.autoInclude, onChange: (event) => update(key, (current) => ({ ...current, autoInclude: event.target.checked })) }), /* @__PURE__ */ React.createElement("span", { className: "dmh-hint" }, t("clone.autoInclude")))), /* @__PURE__ */ React.createElement("div", { className: "dmh-row", style: { marginTop: 6 } }, /* @__PURE__ */ React.createElement("input", { className: "dmh-input", placeholder: t("clone.search"), value: state.search, onChange: (event) => update(key, (current) => ({ ...current, search: event.target.value })) }), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", onClick: () => toggleAll(true) }, t("clone.selectAll")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", onClick: () => toggleAll(false) }, t("clone.selectNone")), /* @__PURE__ */ React.createElement("span", { className: "dmh-hint" }, t("clone.models", { count: state.modelIds.size }))), /* @__PURE__ */ React.createElement("ul", { className: "dmh-list dmh-scroll" }, models.map((model) => /* @__PURE__ */ React.createElement("li", { key: model.id }, /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "checkbox",
          checked: state.modelIds.has(model.id),
          onChange: (event) => {
            update(key, (current) => {
              const modelIds = new Set(current.modelIds);
              if (event.target.checked) modelIds.add(model.id);
              else modelIds.delete(model.id);
              return { ...current, modelIds };
            });
          }
        }
      ), /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, model.id), model.fields.name === void 0 ? null : /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, model.fields.name), model.templateOnly ? /* @__PURE__ */ React.createElement("span", { className: "dmh-badge dmh-badge-warn" }, t("clone.templateOnlyBadge")) : null, !model.inTemplate ? /* @__PURE__ */ React.createElement("span", { className: "dmh-badge dmh-badge-warn" }, t("clone.inferredBadge")) : null)))) : null);
    };
    return /* @__PURE__ */ React.createElement("div", { className: "dmh-group", "data-dmh-wizard": "clone" }, /* @__PURE__ */ React.createElement(Styles, null), /* @__PURE__ */ React.createElement("div", { className: "dmh-row dmh-spread" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-title" }, t("clone.title", { provider: plan.provider })), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", onClick: onCancel }, t("cancel"))), /* @__PURE__ */ React.createElement("div", { className: "dmh-muted" }, t("clone.source", { source: plan.source.kind === "openrouter" ? t("source.openrouter") : `${t("source.models-dev")} · ${plan.source.provider}${plan.sourceName === void 0 ? "" : ` (${plan.sourceName})`}` })), plan.templateVersion === void 0 ? null : /* @__PURE__ */ React.createElement("div", { className: "dmh-muted" }, t("clone.templateVersion", { version: plan.templateVersion })), plan.online ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "warn" }, t("clone.stale", { time: plan.fetchedAt, reason: plan.staleReason ?? "" })), isOpenRouter ? /* @__PURE__ */ React.createElement("div", { className: "dmh-actions" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", onClick: () => onSource({ kind: "models-dev", provider: plan.provider }) }, t("source.models-dev")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", onClick: () => onSource({ kind: "openrouter" }) }, t("source.openrouter"))) : null, /* @__PURE__ */ React.createElement("div", { className: "dmh-hint" }, t("clone.hint")), plan.groups.map(groupCard), error === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "err" }, t("error", { message: error })), /* @__PURE__ */ React.createElement("div", { className: "dmh-actions" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-primary", disabled: busy, onClick: () => {
      void confirm();
    } }, busy ? t("clone.applying") : t("clone.confirm")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", disabled: busy, onClick: onCancel }, t("cancel"))));
  }
  function BindPanel(props) {
    const { options, api, t, onCancel, onBound } = props;
    const [sourceIndex, setSourceIndex] = React.useState(0);
    const [templateIndex, setTemplateIndex] = React.useState(0);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(void 0);
    const source = options.sources[sourceIndex];
    const template = options.templates[templateIndex];
    const bind = async () => {
      if (source === void 0) {
        setError(t("bind.noSources"));
        return;
      }
      if (template === void 0) {
        setError(t("bind.noTemplates"));
        return;
      }
      setBusy(true);
      setError(void 0);
      const result = await api.call("binding.bind", {
        route: options.route,
        option: { source: source.source, template, api: options.api, baseURL: options.baseURL }
      });
      setBusy(false);
      if (result.ok) onBound(result.value.diff);
      else setError(result.error.message);
    };
    return /* @__PURE__ */ React.createElement("div", { className: "dmh-group", "data-dmh-wizard": "bind" }, /* @__PURE__ */ React.createElement(Styles, null), /* @__PURE__ */ React.createElement("div", { className: "dmh-row dmh-spread" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-title" }, t("bind.title")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", onClick: onCancel }, t("cancel"))), /* @__PURE__ */ React.createElement("div", { className: "dmh-hint" }, t("bind.hint")), /* @__PURE__ */ React.createElement("div", { className: "dmh-row", style: { marginTop: 6 } }, /* @__PURE__ */ React.createElement("label", { className: "dmh-hint" }, t("bind.source"), /* @__PURE__ */ React.createElement("select", { className: "dmh-select", value: sourceIndex, onChange: (event) => setSourceIndex(Number(event.target.value)) }, options.sources.map((candidate, index) => /* @__PURE__ */ React.createElement("option", { key: `${candidate.source.kind}:${candidate.source.kind === "openrouter" ? "" : candidate.source.provider}`, value: index }, `${candidate.label} (${candidate.modelCount})`)))), /* @__PURE__ */ React.createElement("label", { className: "dmh-hint" }, t("bind.template"), /* @__PURE__ */ React.createElement("select", { className: "dmh-select", value: templateIndex, onChange: (event) => setTemplateIndex(Number(event.target.value)) }, options.templates.map((candidate, index) => /* @__PURE__ */ React.createElement("option", { key: candidate, value: index }, candidate))))), options.sources.length === 0 ? /* @__PURE__ */ React.createElement(Banner, { kind: "err" }, t("bind.noSources")) : null, options.templates.length === 0 ? /* @__PURE__ */ React.createElement(Banner, { kind: "warn" }, t("bind.noTemplates")) : null, error === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "err" }, t("error", { message: error })), /* @__PURE__ */ React.createElement("div", { className: "dmh-actions" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-primary", disabled: busy || options.sources.length === 0 || options.templates.length === 0, onClick: () => {
      void bind();
    } }, busy ? t("busy") : t("bind.confirm")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", disabled: busy, onClick: onCancel }, t("cancel"))));
  }

  // src/client/Card.tsx
  function Card(props) {
    const { provider, t, api } = props;
    const { status, error, reload } = useStatus(api);
    const [state, setState] = React.useState({ kind: "none" });
    const [busy, setBusy] = React.useState(void 0);
    const [actionError, setActionError] = React.useState(void 0);
    const [cloneResult, setCloneResult] = React.useState(void 0);
    const [applied, setApplied] = React.useState(void 0);
    const [keyMessage, setKeyMessage] = React.useState(void 0);
    const [confirmUnbind, setConfirmUnbind] = React.useState(false);
    const route = status?.routes.find((row) => row.id === provider.provider);
    const binding = status?.bindings.find((row) => row.route === provider.provider);
    const declared = route?.declared ?? provider.declared === true;
    const startClone = async (source) => {
      setBusy("plan");
      setActionError(void 0);
      setCloneResult(void 0);
      const result = await api.call("clone.plan", { provider: provider.provider, ...source === void 0 ? {} : { source } });
      setBusy(void 0);
      if (result.ok) setState({ kind: "clone", clone: result.value });
      else setActionError(result.error.message);
    };
    const startBind = async () => {
      setBusy("bind-options");
      setActionError(void 0);
      const result = await api.call("bind.options", { route: provider.provider });
      setBusy(void 0);
      if (result.ok) setState({ kind: "bind", bind: result.value });
      else setActionError(result.error.message);
    };
    const check = async () => {
      setBusy("check");
      setActionError(void 0);
      setApplied(void 0);
      const result = await api.call("binding.diff", { route: provider.provider });
      setBusy(void 0);
      if (result.ok) {
        const diff = result.value.results[0];
        if (diff !== void 0) setState({ kind: "diff", diff });
      } else {
        setActionError(result.error.message);
      }
    };
    const unbind = async () => {
      setBusy("unbind");
      const result = await api.call("binding.unbind", { route: provider.provider });
      setBusy(void 0);
      setConfirmUnbind(false);
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setState({ kind: "none" });
      await reload();
    };
    const splitKey = async () => {
      setBusy("split");
      setActionError(void 0);
      setKeyMessage(void 0);
      const result = await api.call("route.separateKey", { route: provider.provider });
      setBusy(void 0);
      if (result.ok) {
        setKeyMessage(t("card.splitKeyDone", { ref: result.value.ref }));
        await reload();
      } else {
        setActionError(result.error.message);
      }
    };
    const refreshLists = async () => {
      await reload();
    };
    return /* @__PURE__ */ React.createElement("div", { className: "dmh-panel", "data-dmh-card": provider.provider }, /* @__PURE__ */ React.createElement(Styles, null), /* @__PURE__ */ React.createElement("div", { className: "dmh-row dmh-spread" }, /* @__PURE__ */ React.createElement("div", { className: "dmh-row" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-title" }, t("title")), /* @__PURE__ */ React.createElement("span", { className: "dmh-badge" }, declared ? t("card.declared") : t("card.builtin")), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, provider.provider)), route === void 0 ? null : /* @__PURE__ */ React.createElement("div", { className: "dmh-row" }, !declared && binding === void 0 ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-primary", disabled: busy !== void 0, onClick: () => {
      void startClone();
    } }, busy === "plan" ? t("busy") : t("card.clone")) : null, declared && binding === void 0 ? /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-primary", disabled: busy !== void 0, onClick: () => {
      void startBind();
    } }, busy === "bind-options" ? t("busy") : t("card.bind")) : null, declared && binding !== void 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-primary", disabled: busy !== void 0, onClick: () => {
      void check();
    } }, busy === "check" ? t("card.checking") : t("card.check")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-danger", disabled: busy !== void 0, onClick: () => setConfirmUnbind(true) }, t("card.unbind"))) : null)), error === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "err" }, t("error", { message: error })), actionError === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "err" }, t("error", { message: actionError })), !declared && route !== void 0 && route.sharedKeyWith !== void 0 && route.sharedKeyWith.length > 0 ? /* @__PURE__ */ React.createElement(Banner, { kind: "warn" }, t("card.deleteKeyWarn", { key: route.apiKeyEnv ?? "?" })) : null, declared && route?.apiKeyEnv !== void 0 && route.apiKeyEnv !== deriveKeyRef(provider.provider) && (route.sharedKeyWith?.length ?? 0) > 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Banner, { kind: "warn" }, t("card.sharedKeyWarn", { key: route.apiKeyEnv, others: (route.sharedKeyWith ?? []).join(", ") })), /* @__PURE__ */ React.createElement("div", { className: "dmh-actions" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", disabled: busy !== void 0, onClick: () => {
      void splitKey();
    } }, busy === "split" ? t("card.splittingKey") : t("card.splitKey")))) : null, keyMessage === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "ok" }, keyMessage), status?.defaultSelection?.provider === provider.provider ? /* @__PURE__ */ React.createElement("div", { className: "dmh-hint" }, t("card.defaultNote")) : null, binding === void 0 ? null : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dmh-muted" }, t("card.boundTo", { source: sourceLabel(t, binding.source), template: binding.template })), /* @__PURE__ */ React.createElement("div", { className: "dmh-muted" }, binding.lastSync === void 0 ? t("time.never") : t("time.lastSync", { time: fmtTime(binding.lastSync, t) }), " · ", binding.autoIncludeNew ? t("card.autoInclude") : "", binding.locked.length > 0 ? ` · ${t("card.lockedCount", { count: binding.locked.length })}` : "")), confirmUnbind ? /* @__PURE__ */ React.createElement("div", { className: "dmh-actions" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-warn" }, t("card.unbindConfirm")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-danger", disabled: busy !== void 0, onClick: () => {
      void unbind();
    } }, t("card.unbind")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", onClick: () => setConfirmUnbind(false) }, t("cancel"))) : null, applied === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "ok" }, applied), state.kind === "clone" && state.clone !== void 0 ? /* @__PURE__ */ React.createElement(
      CloneWizard,
      {
        plan: state.clone,
        api,
        t,
        isOpenRouter: provider.provider === "openrouter",
        onSource: (source) => {
          void startClone(source);
        },
        onCancel: () => setState({ kind: "none" }),
        onDone: (result) => {
          setCloneResult(result);
          setState({ kind: "none" });
          void refreshLists();
        }
      }
    ) : null, cloneResult === void 0 ? null : /* @__PURE__ */ React.createElement("div", { className: "dmh-group" }, /* @__PURE__ */ React.createElement(Banner, { kind: "ok" }, t("clone.done", { routes: cloneResult.routes.join(", ") })), cloneResult.keys === void 0 ? null : cloneResult.keys.map((key) => key.status === "copied" ? /* @__PURE__ */ React.createElement("div", { key: key.route, className: "dmh-muted" }, t("clone.keyCopied", { routes: key.route })) : /* @__PURE__ */ React.createElement(Banner, { key: key.route, kind: "warn" }, t("clone.keyPending", { routes: key.route, ref: key.ref }))), cloneResult.defaultSuggestion === void 0 ? null : /* @__PURE__ */ React.createElement(DefaultSuggestion, { api, t, suggestion: cloneResult.defaultSuggestion })), state.kind === "bind" && state.bind !== void 0 ? /* @__PURE__ */ React.createElement(
      BindPanel,
      {
        options: state.bind,
        api,
        t,
        onCancel: () => setState({ kind: "none" }),
        onBound: (diff) => {
          setState({ kind: "diff", diff });
          void refreshLists();
        }
      }
    ) : null, state.kind === "diff" && state.diff !== void 0 ? /* @__PURE__ */ React.createElement(
      DiffPanel,
      {
        route: state.diff.route,
        diff: state.diff,
        api,
        t,
        onApplied: (message) => {
          setApplied(message);
          void refreshLists();
        }
      }
    ) : null);
  }
  function DefaultSuggestion(props) {
    const { api, t, suggestion } = props;
    const [busy, setBusy] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const [error, setError] = React.useState(void 0);
    const use = async () => {
      setBusy(true);
      const result = await api.call("defaultModel.use", suggestion);
      setBusy(false);
      if (result.ok) setDone(true);
      else setError(result.error.message);
    };
    if (done) return /* @__PURE__ */ React.createElement(Banner, { kind: "ok" }, t("clone.switchDefault"));
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dmh-hint" }, t("clone.defaultPrompt", { model: suggestion.model, provider: suggestion.provider })), /* @__PURE__ */ React.createElement("div", { className: "dmh-actions" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-primary", disabled: busy, onClick: () => {
      void use();
    } }, t("clone.switchDefault"))), error === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "err" }, t("error", { message: error })));
  }

  // src/client/Footer.tsx
  function Footer(props) {
    const { api, t } = props;
    const { status, error, reload } = useStatus(api);
    const [results, setResults] = React.useState(void 0);
    const [busy, setBusy] = React.useState(void 0);
    const [notice, setNotice] = React.useState(void 0);
    const [actionError, setActionError] = React.useState(void 0);
    const checkAll = async () => {
      setBusy("check");
      setActionError(void 0);
      setNotice(void 0);
      const result = await api.call("binding.diff", {});
      setBusy(void 0);
      if (result.ok) {
        setResults(result.value.results);
        await reload();
      } else {
        setActionError(result.error.message);
      }
    };
    const applyDefaults = async (diff) => {
      const selection = defaultApplySelection(diff);
      if (selection.length === 0) return;
      setBusy(`apply:${diff.route}`);
      setActionError(void 0);
      const result = await api.call("binding.apply", { route: diff.route, revision: diff.revision, selection });
      setBusy(void 0);
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setNotice(`${diff.route}: ${t("footer.applied")}`);
      setResults((previous) => previous?.filter((row) => row.route !== diff.route));
      await reload();
    };
    const refreshCache = async () => {
      setBusy("cache");
      setActionError(void 0);
      setNotice(void 0);
      const result = await api.call("cache.refresh", {});
      setBusy(void 0);
      if (result.ok) {
        setNotice(result.value.online ? t("footer.refreshDone") : result.value.staleReason ?? t("footer.refreshDone"));
        await reload();
      } else {
        setActionError(result.error.message);
      }
    };
    const unbind = async (route) => {
      setBusy(`unbind:${route}`);
      const result = await api.call("binding.unbind", { route });
      setBusy(void 0);
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setResults((previous) => previous?.filter((row) => row.route !== route));
      await reload();
    };
    const cacheLine = (source, entry) => /* @__PURE__ */ React.createElement("li", { key: source }, /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, source), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, entry?.fetchedAt === void 0 ? t("footer.cacheMissing") : t("footer.cacheValue", { fetched: fmtTime(entry.fetchedAt, t), checked: fmtTime(entry.checkedAt, t) })), entry?.staleReason === void 0 ? null : /* @__PURE__ */ React.createElement("span", { className: "dmh-warn" }, t("footer.stale", { reason: entry.staleReason })));
    const bindings = status?.bindings ?? [];
    const routeIds = new Set((status?.routes ?? []).map((route) => route.id));
    const orphans = bindings.filter((binding) => !routeIds.has(binding.route));
    return /* @__PURE__ */ React.createElement("div", { className: "dmh-panel", "data-dmh-footer": "" }, /* @__PURE__ */ React.createElement(Styles, null), /* @__PURE__ */ React.createElement("div", { className: "dmh-row dmh-spread" }, /* @__PURE__ */ React.createElement("div", { className: "dmh-row" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-title" }, t("footer.title")), /* @__PURE__ */ React.createElement("span", { className: "dmh-badge" }, t("footer.bindings", { count: bindings.length }))), /* @__PURE__ */ React.createElement("div", { className: "dmh-row" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-primary", disabled: busy !== void 0 || bindings.length === 0, onClick: () => {
      void checkAll();
    } }, busy === "check" ? t("footer.checking") : t("footer.checkAll")))), error === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "err" }, t("error", { message: error })), actionError === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "err" }, t("error", { message: actionError })), notice === void 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "ok" }, notice), bindings.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "dmh-muted" }, t("footer.none")) : null, bindings.length === 0 ? null : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dmh-sub" }, t("footer.bindingsTitle")), /* @__PURE__ */ React.createElement("ul", { className: "dmh-list" }, bindings.map((binding) => /* @__PURE__ */ React.createElement("li", { key: binding.route }, /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, binding.route), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, sourceLabel(t, binding.source)), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, binding.lastSync === void 0 ? t("time.never") : t("time.lastSync", { time: fmtTime(binding.lastSync, t) })), routeIds.has(binding.route) ? null : /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button dmh-button-danger", disabled: busy !== void 0, onClick: () => {
      void unbind(binding.route);
    } }, t("footer.unbind"))))), orphans.length === 0 ? null : /* @__PURE__ */ React.createElement(Banner, { kind: "warn" }, t("footer.orphans", { count: orphans.length }))), results === void 0 || results.length === 0 ? null : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "dmh-sub" }, t("footer.results")), /* @__PURE__ */ React.createElement("ul", { className: "dmh-list" }, results.map((diff) => {
      const counts = diff.error === void 0 ? `${t("diff.added", { count: diff.added.length })} · ${t("diff.updates", { count: diff.updates.length })} · ${t("diff.conflicts", { count: diff.conflicts.length })} · ${t("diff.removed", { count: diff.removed.length })}` : t("diff.error", { message: diff.error });
      const selection = defaultApplySelection(diff);
      return /* @__PURE__ */ React.createElement("li", { key: diff.route, style: { display: "block" } }, /* @__PURE__ */ React.createElement("div", { className: "dmh-row" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, diff.route), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, counts), diff.online ? null : /* @__PURE__ */ React.createElement("span", { className: "dmh-warn" }, t("diff.stale", { time: fmtTime(diff.fetchedAt, t), reason: diff.staleReason ?? "" })), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", disabled: busy !== void 0 || selection.length === 0, onClick: () => {
        void applyDefaults(diff);
      } }, busy === `apply:${diff.route}` ? t("diff.applying") : t("footer.applyDefault"))));
    }))), /* @__PURE__ */ React.createElement("div", { className: "dmh-sep" }), /* @__PURE__ */ React.createElement("div", { className: "dmh-row dmh-spread" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-sub" }, t("footer.cache")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", disabled: busy !== void 0, onClick: () => {
      void refreshCache();
    } }, busy === "cache" ? t("footer.refreshing") : t("footer.refresh"))), /* @__PURE__ */ React.createElement("ul", { className: "dmh-list" }, cacheLine("models.dev", status?.cache.modelsDev), cacheLine("OpenRouter", status?.cache.openrouter)), /* @__PURE__ */ React.createElement("div", { className: "dmh-hint" }, t("footer.refreshHint")));
  }

  // src/client/index.tsx
  var OTHER_LOCALES = ["ja", "de", "es", "fr", "pt", "ru"];
  function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, "zh", zh), "models-helper: zh");
    ctx.effect(() => ctx.locale.register(NS, "en", en), "models-helper: en");
    for (const locale of OTHER_LOCALES) {
      ctx.effect(() => ctx.locale.register(NS, locale, en), `models-helper: ${locale}`);
    }
    const api = createApi(ctx.connection);
    ctx.slots.inject("settings.models.provider-card", () => ctx.slots.register({
      name: "settings.models.provider-card",
      key: "llm-pi-ai",
      locale: NS,
      inject: () => ({ api })
    }, Card));
    ctx.slots.inject("settings.models.footer", () => ctx.slots.register({
      name: "settings.models.footer",
      id: "dsh-models-helper",
      order: 50,
      locale: NS,
      inject: () => ({ api })
    }, Footer));
  }
  window.__ModuleLoader__.load({
    id: PACKAGE_NAME,
    factory(require2) {
      setReact(require2("react"));
      return { inject: ["slots", "locale", "connection"], apply };
    }
  });
})();
