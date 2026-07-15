# PLAN — Dock Substrate Landing

Execution model (durable owner directive): codex `gpt-5.6-sol` medium
reasoning writes the token-heavy M1/M2 lanes in isolated worktrees via
codex-companion background tasks with XML operator prompts; Fable designs,
reviews, and writes the M3 frontend. One write lane at a time. Every
milestone runs a quality-review-fix-loop-shaped pass (3–4 role-bundled codex
reviewers, read-only, evidence-cited; codex fixers on disjoint write
surfaces; Fable triages) before yeet publish.

## P0 — Doctrine + packet (rides in the M1 PR)

- This packet (manifest, GOAL, SPEC, PLAN, README, SOURCES).
- `standards/architecture/DECISIONS.md` entry (ui-system → drivers, narrow).
- `standards/ARCHITECTURE.md` ceiling row + `07-non-slice-families.md` mirror.
- `standards/architecture/GLOSSARY.md` "Headless UI Kernel".
- Exploration gate-release + graduation notes (README Trail, MAP, manifest).
- `bun run beep goals index --write`.

## P1 — M1 `@beep/dock` (codex lane A: build; codex lane B: docs)

Lane A: package skeleton from pretext template → move + decompose kernel
sources per SPEC table → `src/internal/` split → `$DockId` swap → move tests
→ vitest config → registration (`bun install`, `tsconfig-sync`,
`fallow:boundaries:write`) → package gates green (`beep:check`, `beep:lint`,
`beep:test`).

Lane B (after A green): JSDoc lane — compiling `@example` + `@category` +
`@since` for every public export; in-package `bun run docgen` green;
`beep:preflight` green.

Then: codex reviewer panel (architecture-boundary + schema/effect-law +
docs/tests bundles) → Fable triage → codex fixers → Fable final verify →
stage → `bun run beep yeet publish --pr`.

## P2 — M2 `@beep/dock-react` (codex lane, same loop)

Adapter decomposition per SPEC → tests + setup harness move → demo rewire →
storybook story → scratchpad kernel/adapter deletion → residue migration to
README → registration + gates → reviewer panel → publish.

## P3 — M3 desktop shell (Fable writes)

defaultDesktopWorkspace + DockShell over DockviewReact → persistence atoms →
CSS/theme port → nav/HomeSurface command dispatch → tests (existing green +
three new proofs) → codex review pass → publish.

## P4 — M4 QA + close

Repo-wide quality loop to zero required blockers → codex browser QA scenario
list on the running shell (vite :1420/Tauri) → fix lanes per finding →
reflection via `/reflect` → manifest phases complete + lifecycle flip in the
same PR → INDEX regen → exploration Trail close → workspace-substrate §7
checkoff.

## P4 Closeout Checklist

1. `history/reflections/<date>-<agent>.md` written; `bun run beep lint
   reflection-artifacts` green.
2. `ops/manifest.json` phases all `complete`; `initiative.status` +
   `lifecycle` → `completed-retained`; `updated` bumped.
3. README "Latest evidence" updated with PR numbers/SHAs.
4. `bun run beep goals index --write`.
5. Same-PR flip law: reflection + manifest flip + final work in one PR.
