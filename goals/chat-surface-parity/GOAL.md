# GOAL: bring the desktop chat surface to full POC parity

Repo: this `beep-effect` checkout.

Outcome: `apps/professional-desktop` reaches feature parity with the
`effect-lexical-chat` POC — restore the dropped observability/devtooling/UX
affordances, repair invalid streamed blocks (not drop them), and add the richer
block vocabulary (mermaid, tables, youtube) so it streams, validates, persists
as `@beep/md`, and renders.

Prerequisite: `goals/desktop-chat-surface` is closed. Stop if not.

Compact `/goal` launcher — the packet files are the contract:

- `goals/chat-surface-parity/SPEC.md` (normative)
- `goals/chat-surface-parity/PLAN.md` (phased P0–P4 + file touch-points)
- `goals/chat-surface-parity/research/2026-06-15-poc-parity-audit.md` (evidence)
- `goals/chat-surface-parity/{README.md,ops/manifest.json}`

Read those, then `AGENTS.md`, `CLAUDE.md`, and standards named by `SPEC.md`.
Proof-repo (read-only): the machine-local `effect-lexical-chat` checkout
— esp. `server/{AssistantTurn,BlockRepair,MermaidValidator,Observability}.ts`.

The atom architecture is ALREADY at parity (our `Chat.atoms.ts` is a verbatim
port). Do NOT redo it.

Scope (full parity, phased):

- P1 obs/UX: sidecar Effect DevTools via `@beep/observability/server` (compose,
  don't hand-roll); app `RegistryProvider` (mirror `apps/oip-web`); error toasts
  via `@beep/ui` sonner (from the UI layer); turn-lifecycle metrics; title
  derivation; Grafana chat dashboard.
- P2 repair: driver `Anthropic.repair.ts` (Haiku, 2-attempt plan; call-shape per
  P0 gate) → server `BlockRepair.ts`
  (validate→repair→re-validate, drop-if-unrepairable; `RepairError`→
  `BlockRepairFailed`) → orchestrator tail (`BlockRepairFailed`→`ChatActionError`).
- P3 rich blocks: mermaid as `Pre[language="mermaid"]`; new table + youtube
  nodes across `@beep/md` + lexical + `@beep/editor`; lifts, validators, system
  prompt, `Checked*Block` codec filters; render in streaming + viewer.

Locked decisions (SPEC.md normative):

- Mermaid = `@beep/md` `Pre` node with `language="mermaid"` — NOT a dedicated
  node; rendered by a language-aware `@beep/editor` decorator.
- Keep the no-partial-row-on-cancel contract; do NOT adopt the POC's partial persist.

Preserve (must not revert): `@beep/md` model, turn-grouped timeline, PGlite,
fixture/anthropic split, `ChatActionError` boundary, runtime-origin OTLP
detection, `CostRollup`/version selector/`UsageRecord`.

Doctrine: table/youtube nodes change a shared `@beep/md` foundation contract
(broadly consumed; `@beep/editor` has one consumer today) — treat as foundation
additions, add round-trip + JSON-boundary tests, verify no regression in md
consumers. `@beep/agents-client` must not import `@beep/ui`.

Workflow:

1. Re-validate the audit vs current `main` and the POC (may have drifted).
2. Land phases smallest-first (P1 can ship before P2/P3); smallest change that
   satisfies `SPEC.md`; preserve unrelated changes; tie decisions to evidence.
3. At P4 Close, write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; `bun run beep lint
   reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` criteria satisfied; new foundation nodes round-trip (Md↔Lexical
      + JSON-boundary) with no md-consumer regression.
- [ ] Verification passes (or unrelated failures recorded separately); no
      unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/chat-surface-parity/GOAL.md)" -le 4000
jq . goals/chat-surface-parity/ops/manifest.json
git diff --check -- goals/chat-surface-parity
bun run beep yeet verify
```

Stop and report before changing public API, schema, migrations, auth, infra,
security, dependencies, lockfiles, or generated files unless `SPEC.md` requires
it. Real-LLM runs need an Anthropic key — the fixture agent covers CI.

Done only when acceptance passes and verification is complete, or a blocker is
reported with file/command evidence.
