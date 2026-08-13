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
  `_template`.
