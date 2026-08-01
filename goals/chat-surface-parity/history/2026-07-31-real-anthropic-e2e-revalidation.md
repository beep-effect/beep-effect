# 2026-07-31 — Real-Anthropic E2E re-validation (packet-state audit)

Context: a repo audit of the three chat packets (`desktop-chat-surface`,
`chat-surface-parity`, `chat-input-and-theming`) found their manifests/READMEs
correctly closed but the `PLAN.md` statuses and `SPEC.md` acceptance checkboxes
never flipped. Before reconciling the paperwork, the deepest P4 claim was
re-proven against current `main` (`3dbfcfb721`).

## Run

```sh
cd apps/professional-desktop
BEEP_TEST_REAL_ANTHROPIC_CHAT=1 \
AI_ANTHROPIC_API_KEY="op://BEEP_SECRETS/BEEP_SECRETS/AI_ANTHROPIC_API_KEY" \
op run -- npx vitest run --config vitest.integration.config.ts \
  test/integration/chat-real-anthropic.e2e.test.ts
```

Result: **1 passed (1)** in ~10.3s (vitest 4.1.10) — the live Anthropic kernel
streamed, validated, and persisted the parity blocks through the PGlite
integration path, unchanged from the 2026-06-15 closeout evidence.

## Notes

- The key was injected via `op run` (secret reference, never materialized in
  logs or files).
- Two gotchas for future runs: the app's default `vitest.config.ts` excludes
  `test/integration/**` — pass `--config vitest.integration.config.ts`; and the
  test self-skips unless `BEEP_TEST_REAL_ANTHROPIC_CHAT=1` is set.
