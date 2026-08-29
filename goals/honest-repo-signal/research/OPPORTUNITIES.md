# Opportunities

Friction receipts for this packet. Redacted. No secrets, no home paths.

## 2026-08-13 — `beep goals bootstrap` is specified and not implemented

- **Doing:** operator asked to create this packet with the goal bootstrap
  command.
- **Evidence:** `bun run beep goals --help` lists `doctor`, `index`,
  `set-status` only. `packages/tooling/tool/cli/src/commands/Goals/` has no
  Bootstrap module. `compileMaterializationPlan` is not in `packages/`.
  `goals/knowledge-surface-automation` Workstream E and
  `research/p1-bootstrap-adopt-plan-design.md` still say design-only / phase-0
  `--plan` with no writer.
- **What would have prevented it:** either land KSA E's plan compiler and
  say so in `beep goals` help, or stop referring to `beep goals bootstrap` as
  if it exists. Current legal scaffold is `goals/_template`.
- **Disposition:** follow-up on KSA, not this packet. This packet copied
  `_template`. Update 2026-08-24: PR #762 landed the read-only planner
  (`beep goals bootstrap --plan` and `adopt`); only the materializing writer
  remains pending.

## 2026-08-24 — gitignored build residue falsifies directory-existence checks

- **Doing:** P4 closeout — running this packet's verification matrix in a
  checkout that had built the deleted packages before PR #680 and PR #690
  merged.
- **Evidence:** `test ! -d` on the three deleted driver trees failed on a
  clean git tree until `.turbo/`, `dist/`, `docs/`, and `.beep/docgen/`
  residue was removed by hand. Worse, `test -d packages/drivers/protobuf`
  kept passing after PR #690 deleted the package — `git ls-files
  packages/drivers/protobuf` is empty — a false green from the same residue,
  caught by Codex review on PR #777.
- **What would have prevented it:** verify deletions against tracked state
  (`git ls-files` emptiness) instead of directory existence, or pair package
  deletion PRs with an explicit residue-cleanup step.
- **Disposition:** verification commands in this packet's `GOAL.md`,
  `PLAN.md`, and `SPEC.md` rewritten to `git ls-files` checks in the closeout
  PR; the expired protobuf ownership guard retired.
