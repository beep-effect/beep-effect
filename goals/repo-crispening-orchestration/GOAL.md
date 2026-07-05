# GOAL: Orchestrate the repo-wide schema crispening to a self-enforcing end state

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the repo-wide crispening is orchestrated from this packet to a
durable, self-enforcing end state — four novel lint cards live as AST
detectors, the per-owner blocking policy ratchet engaged, the Law 20/47
amendment and DECISIONS entry merged, and the schema catalog tracked.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/repo-crispening-orchestration/README.md`
- `goals/repo-crispening-orchestration/SPEC.md`
- `goals/repo-crispening-orchestration/PLAN.md`
- `goals/repo-crispening-orchestration/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict. `research/decisions-locked.md` locks D1–D5 and
G1–G7 — do not reopen them.

Scope:

- In: first-party source under `packages/**` and `apps/**`, minus generated
  code; the P0 enforcement surfaces —
  `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts` (novel cards),
  `standards/schema-crispening.policy.jsonc` (new),
  `standards/schema-first.inventory.jsonc`,
  `.claude/skills/effect-first-development/SKILL.md` plus mirrors (Law 20/47),
  `standards/architecture/DECISIONS.md`; the catalog
  `standards/schema-catalog.generated.jsonc`; this packet's own files.
- Out: the nine §6 fences (see SPEC.md Non-Goals) — service-contract
  carve-out, SQL absence encodes `null`, no error-tag merging, no
  trust-boundary weakening, no `declare namespace` recursion blocks, no
  `Graph`/`MutableHash*` schema-ification, no native-collection migration
  (`effect-native-migration`'s seam), touch-scoped waves only, no public-form
  change without the same-PR consumer sweep. Never edit `.repos/**` or
  generated files.

Workflow:

1. Inspect referenced files and current repo state; reconcile against
   `ops/progress.json` and skip work already `done`.
2. Run the phases in order — P0 Enforce foundations → P1 Baseline & rank →
   P1.5 Mechanize → P2 Remediation waves → P3 Catalog & ship → P4 Close —
   making the smallest change that satisfies `SPEC.md`; update
   `ops/progress.json` after every step.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command
   output; re-verify cited symbols with `rg` (training data is Effect v3;
   this repo is v4).
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection under `history/reflections/` via
   the `/reflect` skill (see `PLAN.md` P4);
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (§5.1 Definition of Done).
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/repo-crispening-orchestration/GOAL.md)" -le 4000
jq . goals/repo-crispening-orchestration/ops/manifest.json
git diff --check -- goals/repo-crispening-orchestration
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it. Also halt per SPEC.md Stop
Conditions: a failed §5.3 parity proof, a §6 fence violation, a red wave-gate
`yeet verify`, or reaching the `SFV4-getsomes-struct` sweep before the
Law 20/47 amendment merges (D5).

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
