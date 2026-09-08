# freshbooks-driver — friction ledger

Record friction at the moment it happens (what you were doing, evidence, what would have
prevented it). Public repo: redact secrets, replace absolute home paths with `~`, drop
session/machine ids, quote only the minimal identifying error text.

## 2026-09-03 — A red Lint Policy lane was attributed to the last-printed step, not the runner's summary

- **Doing:** attributing the `Heavy / Lint Policy` red on the driver PR (#987).
- **Evidence:** the job log tail read `[effect-governance-imports] corpus=markdown ...` followed by
  `ci:lint-policy exit 1`, so the Markdown import pass looked like the culprit and a no-op PR (#995)
  was opened to make it advisory. The runner's own summary, further up, named the real step:
  `[beep-cli] lint:policy: failed 1 step(s)` / `lint:effect-fn: exit 1`.
- **Would have prevented it:** print the per-step failure summary *after* all step output (or in the
  hosted job annotation), and say in the yeet skill to grep `[beep-cli] ... failed N step(s)` before
  attributing a policy red.

## 2026-09-03 — `laws effect-imports --mode markdown --check` is wired as a gate but cannot fail

- **Doing:** reading the `lint:effect-imports-markdown` policy step to understand its gating.
- **Evidence:** `EffectImports.ts` sets `strictFailure` only when
  `mode === "code" || candidate || enforceDocumentation`; the step passes `--check` in plain Markdown
  mode and carries a comment calling it advisory. Both the flag and the comment are no-ops, which is
  what made the misattribution above plausible.
- **Would have prevented it:** drop the dead `--check` from the step, or have the command reject
  `--check` in Markdown mode unless an enforcement flag is present.

## 2026-09-03 — A new package turns every partitioned lane red with a "Regenerate" hint that has no generator

- **Doing:** landing `@beep/freshbooks`, scaffolded with `bun run beep create-package`.
- **Evidence:** every `Lint (lint-a/b)` and `Test Unit (unit-a/b/repo-cli)` lane failed with
  `Package @beep/freshbooks has an executable test-unit task but no deterministic placement ...
  Repair: Regenerate the deterministic LPT placement`. `CiLanePartitions.ts` is a hand-maintained
  table and `ci-lane.test.ts` pins bin counts and union totals; nothing regenerates either. The
  all-lanes-red pattern was first misread as an environment failure.
- **Would have prevented it:** have `create-package` place the new package in the lightest bin and
  update the fixtures, or ship a `ci lane partitions --write` verb the repair hint can name.

## 2026-09-03 — Generated standards files re-conflict on every busy-`main` push

- **Doing:** keeping #987 mergeable across an afternoon of `main` activity.
- **Evidence:** three merges of `origin/main`, each conflicting only on
  `standards/jsdoc-documentation.inventory.{jsonc,md}` and `jsdoc-totals.regression-baseline.jsonc`;
  the resolution is always take-theirs, `quality jsdoc-inventory`, `quality jsdoc-ratchet
  --write-baseline` (about five minutes on a loaded workstation), commit, push, repeat.
- **Would have prevented it:** a merge driver or `yeet` step that resolves conflicts on generated
  standards paths by regeneration instead of by hand.

## 2026-09-03 — The stop-time Codex companion edited the checkout with no receipt

- **Doing:** verifying #987 locally after the lane-partition failure above.
- **Evidence:** `CiLanePartitions.ts`, `ci-lane.test.ts`, and a new changeset appeared in the working
  tree with no commit, no notice, and no message; only reading the environment of a live shell
  (`CODEX_COMPANION_SESSION_ID`) showed the edits came from this session's own companion rather than
  a foreign session. The edits were correct and were nearly overwritten.
- **Would have prevented it:** have the companion leave an on-disk receipt of the paths it touched
  (or commit to a side ref) so an orchestrator can tell delegated edits from foreign ones.
