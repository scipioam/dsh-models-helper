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
    "probe.badge": "M0 技术验证",
    "probe.card.builtin": "内置供应商",
    "probe.card.declared": "自定义供应商",
    "probe.card.unknown": "类型未知",
    "probe.card.check": "检查模板与来源",
    "probe.card.checking": "检查中…",
    "probe.card.template": "内置模板：{count} 个模型",
    "probe.card.templateNone": "内置目录中没有这个供应商",
    "probe.card.groups": "协议组",
    "probe.card.modelsDev": "models.dev：{count} 个模型，其中 {extra} 个内置目录没有",
    "probe.card.openrouter": "OpenRouter 官方：{count} 个模型，其中 {extra} 个内置目录没有",
    "probe.card.extraList": "内置目录没有的模型",
    "probe.footer.title": "模型助手 · 技术验证",
    "probe.footer.refresh": "重新检查",
    "probe.footer.writeTest": "运行写入测试",
    "probe.footer.writeTest.hint": "会临时新增一个名为 models-helper-probe 的供应商再立即删除，并写入再清除本插件的一个字段。",
    "probe.footer.running": "运行中…",
    "probe.footer.routes": "llm-pi-ai 中已配置 {count} 个供应商（revision {revision}）",
    "probe.ok": "通过",
    "probe.fail": "失败",
    "error": "出错：{message}"
  };
  var en = {
    "title": "Models helper",
    "probe.badge": "M0 feasibility check",
    "probe.card.builtin": "Built-in provider",
    "probe.card.declared": "Custom provider",
    "probe.card.unknown": "Unknown kind",
    "probe.card.check": "Check template and sources",
    "probe.card.checking": "Checking…",
    "probe.card.template": "Built-in template: {count} models",
    "probe.card.templateNone": "The installed catalog does not describe this provider",
    "probe.card.groups": "Protocol groups",
    "probe.card.modelsDev": "models.dev: {count} models, {extra} not in the installed catalog",
    "probe.card.openrouter": "OpenRouter API: {count} models, {extra} not in the installed catalog",
    "probe.card.extraList": "Models missing from the installed catalog",
    "probe.footer.title": "Models helper · feasibility check",
    "probe.footer.refresh": "Check again",
    "probe.footer.writeTest": "Run write test",
    "probe.footer.writeTest.hint": "Temporarily adds a provider named models-helper-probe and removes it at once, then sets and clears one field of this plugin.",
    "probe.footer.running": "Running…",
    "probe.footer.routes": "{count} providers configured in llm-pi-ai (revision {revision})",
    "probe.ok": "OK",
    "probe.fail": "Failed",
    "error": "Error: {message}"
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
.dmh-title { font-weight: 600; }
.dmh-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.dmh-badge {
  display: inline-flex; align-items: center;
  padding: 0 6px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px; line-height: 18px;
}
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
.dmh-list { margin: 6px 0 0; padding: 0; list-style: none; }
.dmh-list li { display: flex; gap: 8px; padding: 2px 0; }
.dmh-ok { color: var(--dsw-alias-state-success-primary); flex: none; }
.dmh-fail { color: var(--dsw-alias-state-error-primary); flex: none; }
.dmh-warn { color: var(--dsw-alias-state-warn-primary); }
.dmh-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; word-break: break-all; }
.dmh-details summary { cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 12px; }
`;

  // src/client/ProbeViews.tsx
  function Styles() {
    return /* @__PURE__ */ React.createElement("style", null, CSS);
  }
  function CheckList({ checks, t }) {
    return /* @__PURE__ */ React.createElement("ul", { className: "dmh-list" }, checks.map((check) => /* @__PURE__ */ React.createElement("li", { key: check.id }, /* @__PURE__ */ React.createElement("span", { className: check.ok ? "dmh-ok" : "dmh-fail" }, check.ok ? "✓" : "✗"), /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, check.id), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted dmh-mono" }, check.detail))));
  }
  function ProbeCard(props) {
    const { provider, t, api } = props;
    const [state, setState] = React.useState({ busy: false });
    const kind = provider.declared === true ? t("probe.card.declared") : provider.declared === false ? t("probe.card.builtin") : t("probe.card.unknown");
    const run = React.useCallback(async () => {
      setState({ busy: true });
      const [template, sources] = await Promise.all([
        api.call("probe.template", { provider: provider.provider }),
        api.call("probe.sources", { provider: provider.provider })
      ]);
      setState({
        busy: false,
        ...template.ok ? { template: template.value } : { error: template.error.message },
        ...sources.ok ? { sources: sources.value } : { error: sources.error.message }
      });
    }, [api, provider.provider]);
    const md = state.sources?.modelsDev;
    const or = state.sources?.openrouter;
    return /* @__PURE__ */ React.createElement("div", { className: "dmh-panel", "data-dmh-card": provider.provider }, /* @__PURE__ */ React.createElement(Styles, null), /* @__PURE__ */ React.createElement("div", { className: "dmh-row" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-title" }, t("title")), /* @__PURE__ */ React.createElement("span", { className: "dmh-badge" }, t("probe.badge")), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted" }, `${provider.provider} · ${kind}`), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", disabled: state.busy, onClick: () => {
      void run();
    } }, state.busy ? t("probe.card.checking") : t("probe.card.check"))), state.error === void 0 ? null : /* @__PURE__ */ React.createElement("div", { className: "dmh-fail" }, t("error", { message: state.error })), state.template === void 0 ? null : /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", null, state.template.modelCount > 0 ? t("probe.card.template", { count: state.template.modelCount }) : t("probe.card.templateNone")), state.template.groups.length === 0 ? null : /* @__PURE__ */ React.createElement("ul", { className: "dmh-list" }, state.template.groups.map((group) => /* @__PURE__ */ React.createElement("li", { key: `${group.api} ${group.baseURL}` }, /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, group.api), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted dmh-mono" }, group.baseURL), /* @__PURE__ */ React.createElement("span", null, group.count))))), md === void 0 ? null : md.ok ? /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", null, t("probe.card.modelsDev", { count: md.count ?? 0, extra: md.onlyInSource?.length ?? 0 })), /* @__PURE__ */ React.createElement("div", { className: "dmh-muted" }, md.detail), md.groups === void 0 ? null : /* @__PURE__ */ React.createElement("ul", { className: "dmh-list" }, Object.entries(md.groups).map(([key, count]) => /* @__PURE__ */ React.createElement("li", { key }, /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, key), /* @__PURE__ */ React.createElement("span", null, count)))), md.onlyInSource === void 0 || md.onlyInSource.length === 0 ? null : /* @__PURE__ */ React.createElement("details", { className: "dmh-details" }, /* @__PURE__ */ React.createElement("summary", null, t("probe.card.extraList")), /* @__PURE__ */ React.createElement("div", { className: "dmh-mono" }, md.onlyInSource.join(", ")))) : /* @__PURE__ */ React.createElement("div", { className: "dmh-warn" }, md.detail), or === void 0 ? null : or.ok ? /* @__PURE__ */ React.createElement("div", null, t("probe.card.openrouter", { count: or.count ?? 0, extra: or.onlyInSource ?? 0 })) : /* @__PURE__ */ React.createElement("div", { className: "dmh-warn" }, or.detail));
  }
  function ProbeFooter(props) {
    const { api, t } = props;
    const [status, setStatus] = React.useState();
    const [writeChecks, setWriteChecks] = React.useState();
    const [busy, setBusy] = React.useState();
    const [error, setError] = React.useState();
    const refresh = React.useCallback(async () => {
      setBusy("status");
      const result = await api.call("probe.status", {});
      setBusy(void 0);
      if (result.ok) {
        setStatus(result.value);
        setError(void 0);
      } else setError(result.error.message);
    }, [api]);
    React.useEffect(() => {
      void refresh();
    }, [refresh]);
    const writeTest = async () => {
      setBusy("write");
      const result = await api.call("probe.writeTest", {});
      setBusy(void 0);
      if (result.ok) setWriteChecks(result.value.checks);
      else setError(result.error.message);
      void refresh();
    };
    return /* @__PURE__ */ React.createElement("div", { className: "dmh-panel", "data-dmh-footer": "" }, /* @__PURE__ */ React.createElement(Styles, null), /* @__PURE__ */ React.createElement("div", { className: "dmh-row" }, /* @__PURE__ */ React.createElement("span", { className: "dmh-title" }, t("probe.footer.title")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", disabled: busy !== void 0, onClick: () => {
      void refresh();
    } }, busy === "status" ? t("probe.footer.running") : t("probe.footer.refresh")), /* @__PURE__ */ React.createElement("button", { type: "button", className: "dmh-button", disabled: busy !== void 0, title: t("probe.footer.writeTest.hint"), onClick: () => {
      void writeTest();
    } }, busy === "write" ? t("probe.footer.running") : t("probe.footer.writeTest"))), /* @__PURE__ */ React.createElement("div", { className: "dmh-muted" }, t("probe.footer.writeTest.hint")), error === void 0 ? null : /* @__PURE__ */ React.createElement("div", { className: "dmh-fail" }, t("error", { message: error })), status === void 0 ? null : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(CheckList, { checks: status.checks, t }), /* @__PURE__ */ React.createElement("div", { className: "dmh-muted" }, t("probe.footer.routes", { count: status.routes.length, revision: status.llmPiAiRevision ?? "?" })), /* @__PURE__ */ React.createElement("ul", { className: "dmh-list" }, status.routes.map((route) => /* @__PURE__ */ React.createElement("li", { key: route.id }, /* @__PURE__ */ React.createElement("span", { className: "dmh-mono" }, route.id), /* @__PURE__ */ React.createElement("span", { className: "dmh-muted dmh-mono" }, `declared=${String(route.declared)} key=${route.apiKeyEnv ?? "-"} api=${route.api ?? "-"} models=${route.modelCount}`))))), writeChecks === void 0 ? null : /* @__PURE__ */ React.createElement(CheckList, { checks: writeChecks, t }));
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
    }, ProbeCard));
    ctx.slots.inject("settings.models.footer", () => ctx.slots.register({
      name: "settings.models.footer",
      id: "dsh-models-helper",
      order: 50,
      locale: NS,
      inject: () => ({ api })
    }, ProbeFooter));
  }
  window.__ModuleLoader__.load({
    id: PACKAGE_NAME,
    factory(require2) {
      setReact(require2("react"));
      return { inject: ["slots", "locale", "connection"], apply };
    }
  });
})();
