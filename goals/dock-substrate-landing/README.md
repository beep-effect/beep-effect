# Dock Substrate Landing

Lifecycle: `active`

Graduate the scratchpad dock system — pure schema-first kernel
(`scratchpad/dockview/poc`) + hook-free React adapter
(`scratchpad/dockview-react`) — into real packages `@beep/dock` and
`@beep/dock-react` under `packages/foundation/ui-system/`, then land the dock
workspace as the root shell of `apps/professional-desktop`, QA'd to green.

Product canon: `docs/product/workspace-substrate.md` (§7 names exactly this
sequencing). Provenance: `explorations/computable-workspace-geometry`
(stage `graduate`); kernel/adapter matured in scratchpad across PRs
#391/#396/#397/#399/#403.

## Structure

- `SPEC.md` — normative contract (locked decisions, per-milestone
  requirements, acceptance).
- `PLAN.md` — execution phases and writer/QA lanes.
- `GOAL.md` — compact `/goal` launcher.
- `ops/manifest.json` — machine state.
- `research/SOURCES.md` — grounding evidence.

## Milestones

| Milestone | Branch | Writer | State |
|---|---|---|---|
| M1 `@beep/dock` kernel package | `feat/dock-package` | codex | landed (this PR) |
| M2 `@beep/dock-react` + scratchpad retirement | `feat/dock-react-package` | codex | pending |
| M3 desktop dock shell | `feat/desktop-dock-shell` | Fable | pending |
| M4 QA-to-green + close | (fix lanes as needed) | codex QA | pending |

## Latest evidence

- 2026-07-15 — M1 landed on `feat/dock-package`: `@beep/dock` at
  `packages/foundation/ui-system/dock` (19 public role files + internals,
  curated barrel, `$DockId` identity, 86 vitest tests incl. two
  schema-derived property suites, 188 compiled `@example` blocks), doctrine
  DECISION + ceiling row + glossary, gate-release notes, full
  `beep:preflight` green. Three-reviewer codex panel: zero
  semantic-divergence findings; doc/metadata findings fixed or refuted in
  the same PR.
- 2026-07-14 — packet opened; grill locked six decisions (two ui-system
  packages; narrow ui-system→drivers DECISION; beep-effect6 gate released;
  four-coarse-panel shell scope; one packet / milestone-per-PR;
  codex-executed QA loop).

## Residue

Populated at M2 from `scratchpad/dockview/WHAT-IS-LEFT.md` (adapter drop
indicators, tab overflow, context menus; kernel popout windows, max
constraints/LayoutPriority/snap-to-collapse; a11y). Until then the scratchpad
ledger remains authoritative.
