# @beep/repo-cli Modularization

## Status

**COMPLETE - final reconciliation verified; PR closeout in progress**

## Owner

@beep-team

## Created / Updated

- **Created:** 2026-07-07
- **Updated:** 2026-07-08

## Purpose

`@beep/repo-cli` (`packages/tooling/tool/cli`) has grown to ~92k LOC across 28
command groups, with 27 source files at or above 1000 lines (11 above 2000, the
largest at 5680). Concerns are mixed inside monolith files, near-identical
helpers are reimplemented across command groups (subprocess capture, git
plumbing, JSON rendering, ratchet/baseline lifecycles, JSONC editing), and
several groups violate the canonical CLI role topology in
`standards/ARCHITECTURE.md`.

This goal modularizes the package to promote reuse, navigation, and
comprehension: split monoliths along natural seams into canonical role files,
extract a shared internal substrate, bring touched groups to full topology
compliance, and raise JSDoc on touched files to the
`.patterns/jsdoc-documentation.md` rubric.

## Closeout Evidence

- Waves P0-P9 landed on `repo-cli-modularization`; the original PR #339 was
  closed after #326 rewrote the same standards surfaces on `main`.
- The final reconciliation kept `origin/main` as source of truth, removed stale
  inventory/allowlist state, fixed the remaining repo-cli quality blockers, and
  preserved the behavior-preserving campaign boundary.
- `bun run beep yeet verify` passed end-to-end on 2026-07-08 after the
  reconciliation: build, check, knip, jsdoc, lint, full docgen, unit tests,
  type tests, integration tests, fallow, repo sanity, secrets, security, SAST,
  and Nix.
- Closeout reflection: `history/reflections/2026-07-08-codex.md`.

## Reading Order

- [SPEC.md](./SPEC.md) - normative decisions, guarantees, and target topology
- [PLAN.md](./PLAN.md) - staged wave plan and verification
- [ops/manifest.json](./ops/manifest.json) - machine-readable goal metadata
- [ops/discovery/](./ops/discovery/) - discovery inventory: `synthesis.json`
  (shared-module catalog, ranked targets, wave rationale), `reuse.json`,
  `audits.json`, `infra.json`, `tests.json`, and per-group file seam analyses
  under `files/<Group>.json`

## Current Decisions

- Placement is internal-first: extracted helpers default to
  `src/internal/<area>/` inside `@beep/repo-cli`; code moves to
  `@beep/repo-utils`, `@beep/repo-ai-metrics`, or `@beep/schema` only when that
  package already owns the substrate. No new packages in this campaign.
- Scope is every source file >= 1000 LOC plus full canonical role topology for
  every command group the campaign touches; untouched groups remain
  cleanup-on-touch.
- Waves are behavior-preserving. Near-duplicate helpers consolidate through
  parameterization that preserves each call site; genuine behavior unification
  is proposed explicitly in the wave commit message, never applied silently.
- The public export catalog stays stable; extracted modules are private
  `internal/` files. Facade growth happens only where tests or cross-group
  consumers currently deep-import and is called out per wave.
- JSDoc on every touched file is brought to the
  `.patterns/jsdoc-documentation.md` rubric in the same wave: compilable
  meaningful examples (no `console.log(fn)` placeholders), conditional
  `@remarks`/`@returns`/`@throws`/`@param`/`@see` only where they add
  information beyond the types.
- Delivery is a single campaign branch (`repo-cli-modularization`) with
  wave-sized commits verified locally (`yeet verify`), and one PR at the end
  (CI runner cost).
- `QualityTaskStep` and the step-runner promote to
  `src/internal/process/StepExec.ts`, retiring the Graphiti -> Quality and
  Lint -> Quality cross-group deep imports.
- Moved schemas re-derive their `$RepoCliId` identity from the new module path;
  each wave regenerates `standards/schema-catalog.generated.jsonc` via
  `bun run beep lint schema-catalog --write`.
- Tests migrate to `@beep/repo-cli/test/<Group>` aliases against group facades
  and test-kits; deep internal specifiers are nulled once migrated.
- Specialized sub-agent definitions live in `.claude/agents/` as repo-general
  specialists (not CLI-specific), mirrored for Codex through the `.agents/`
  symlink convention; campaign-specific instructions live in this packet.

## Non-Negotiable Boundaries

- `@beep/repo-cli` stays the canonical repo-operational CLI
  (`standards/architecture/07-non-slice-families.md`); no product semantics
  enter tooling.
- Command flags, output text, exit codes, and tracked-baseline semantics do not
  change without an explicit, reviewed proposal.
- Earned role files are semantic (`.render.ts`, `.plan.ts`, `.progress.ts`,
  ...); `<Group>.utils.ts` is forbidden.
- Only package root and `@beep/repo-cli/commands/<Group>` facades are public;
  deep role files and `internal/` stay private.
