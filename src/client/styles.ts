/** Component-local styles; only `--dsw-alias-*` theme tokens, classes prefixed `dmh-`. */
export const CSS = `
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

.dmh-cost-turn { display: flex; gap: 6px; align-items: baseline; margin-top: 4px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dmh-cost-session { display: inline-flex; align-items: center; }
.dmh-cost-button {
  appearance: none; cursor: pointer; padding: 2px 8px;
  display: inline-flex; gap: 6px; align-items: baseline;
  border: 1px solid transparent; border-radius: 6px;
  background: none; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 12px;
}
.dmh-cost-button:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l1); }
.dmh-cost-label { color: var(--dsw-alias-label-secondary); }
.dmh-cost-value { color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }
.dmh-cost-na { color: var(--dsw-alias-label-secondary); }
.dmh-cost-backdrop { position: fixed; inset: 0; z-index: 40; background: transparent; }
.dmh-cost-pop {
  position: fixed; z-index: 41; min-width: 260px; max-width: 420px; max-height: 60vh; overflow: auto;
  padding: 10px 12px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  color: var(--dsw-alias-label-primary); font-size: 12px;
}
.dmh-cost-pop-title { font-weight: 600; margin-bottom: 6px; }
.dmh-cost-lines { list-style: none; margin: 0; padding: 0; }
.dmh-cost-line { display: flex; gap: 8px; align-items: baseline; padding: 2px 0; }
.dmh-cost-route { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dmh-cost-nums { color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.dmh-cost-line-amount { min-width: 64px; text-align: right; font-variant-numeric: tabular-nums; }
.dmh-cost-note { margin-top: 6px; color: var(--dsw-alias-label-secondary); }
.dmh-prices { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--dsw-alias-border-l1); }
.dmh-link { appearance: none; background: none; border: none; padding: 0; cursor: pointer; color: var(--dsw-alias-brand-primary); font: inherit; font-size: 12px; }
.dmh-link:hover { text-decoration: underline; }
.dmh-price-list { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.dmh-price-row { display: flex; gap: 8px; align-items: flex-start; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed var(--dsw-alias-border-l1); }
.dmh-price-main { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; min-width: 0; }
.dmh-price-model { flex: none; }
.dmh-price-nums { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.dmh-price-edit { display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-end; width: 100%; }
.dmh-price-field { display: flex; flex-direction: column; gap: 2px; font-size: 11px; }
.dmh-price-input { width: 84px; }
.dmh-price-edit-button { flex: none; }
`
