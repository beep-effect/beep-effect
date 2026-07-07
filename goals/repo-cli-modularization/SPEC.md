# @beep/repo-cli Modularization Specification

## Status

**ACTIVE**

## Mission

Make `@beep/repo-cli` navigable by path and reusable by construction: every
command group reads through its canonical role files, monolith files are split
along natural seams, cross-command machinery lives once in a shared internal
substrate, and every touched export carries rubric-quality JSDoc.

## Target Topology

The binding rules are `standards/ARCHITECTURE.md` (Canonical File-Role Anchors)
and `standards/architecture/07-non-slice-families.md` (Repo CLI Command
Topology). In brief:

- `commands/<Group>/` holds `<Group>.command.ts` (flags + `Command` tree),
  `<Group>.schemas.ts`, `<Group>.errors.ts` (one `<Group>CommandError`),
  `<Group>.service.ts` (`Context.Service` contract + default live layer), and
  `index.ts` (curated facade).
- Earned semantic roles when substance warrants: `<Group>.render.ts`,
  `<Group>.progress.ts`, `<Group>.paths.ts`, `<Group>.media.ts`,
  `<Group>.plan.ts`; `<Group>.config.ts` only for runtime/config-provider
  settings; `<Group>.layer.ts` only for non-trivial layer variants.
- Command-private machinery lives in `commands/<Group>/internal/` with
  semantic module names. Cross-command machinery lives in `src/internal/<area>/`
  (`cli/`, `process/`, `repo-run/`, `github/`, `ratchet/`, `artifacts/`,
  `quality/`, `schema/`).
- Single-file leaf commands stay flat while they have no schemas, service,
  renderers, or subcommands.

## Placement Policy (locked)

1. Default: `src/internal/<area>/` inside `@beep/repo-cli`.
2. Adopt an existing owner instead of reimplementing:
   `@beep/repo-utils` (fs walking, workspace discovery, package refs),
   `@beep/repo-ai-metrics` (DuckDb provider, shellQuote, metrics IO),
   `@beep/schema` (schema concepts, `LiteralKit`, JSONC decode).
   Extending those packages is in scope where they already own the substrate.
3. No new workspace packages in this campaign. Promotion of an internal module
   to a library waits for a second non-CLI consumer.

## Behavior Guarantees (locked)

- Splits are behavior-preserving: flags, help text, stdout/stderr shapes, exit
  codes, artifact formats, and baseline semantics are unchanged.
- Near-duplicates consolidate into one parameterized helper that reproduces
  each call site's current behavior. Divergences discovered during
  consolidation (e.g. `warn` vs `warning` severity literals) are preserved via
  parameters/aliases and recorded in the wave commit message as explicit
  unification proposals for a later decision.
- Tracked baselines and generated artifacts may be regenerated with their
  `--write` modes only when a wave legitimately moves findings (file renames,
  schema identity re-derivation); the regenerated diff is reviewed as generated
  churn, never hand-edited.

## Public Surface & Identity (locked)

- The public export catalog stays stable. New shared modules are private.
- Facade growth is allowed only to replace an existing deep import by a test or
  cross-group consumer, and is enumerated in the wave commit message.
- `QualityTaskStep` + step-runner move to `src/internal/process/StepExec.ts`;
  Graphiti, Lint, and Quality consume the internal module (retires the
  cross-group deep imports).
- Moved schemas re-derive `$I` from the new module path
  (`$RepoCliId.create("internal/..." | "commands/...")`); each wave that moves
  schemas runs `bun run beep lint schema-catalog --write` and commits the
  regenerated catalog.

## Tests (locked)

- Tests import through source-only `@beep/repo-cli/test/<Group>` aliases
  targeting group facades and test-kits. Where tests genuinely need internals,
  the group test-kit (or curated facade) grows an export; deep internal
  specifiers are nulled once their last test migrates.
- `test/create-package-identity-template.test.ts` (asserts literal source
  strings in `CreatePackage/Handler.ts`) is rewritten against the extracted
  identity-registration module in the CreatePackage wave.
- Gate is "no NEW failures": pre-existing failures are recorded per wave, not
  fixed opportunistically unless the wave touches their subject.
- Pure logic extracted into `src/internal/` gets focused unit tests when the
  module has meaningful branching (ratchet diffing, glob translation, wire
  contract codecs).

## JSDoc (locked)

Every file a wave touches is brought to `.patterns/jsdoc-documentation.md`
compliance in that wave:

- At least one compilable, meaningful `@example` per export — placeholder
  examples (`import ...; console.log(fn)`) are removed on sight.
- `@remarks`, `@param`, `@returns`, `@throws`, `@see` only where they add
  information beyond names and types, per the pattern doc's conditional-tag
  table and TSDoc grammar hard rules.
- `@category`/`@since` retained per existing conventions.
- Proof: `bun run docgen:local` green for the wave diff.

## Delivery Model (locked)

- Single campaign branch `repo-cli-modularization`; one commit (or small commit
  cluster) per wave; every wave locally verified before the next starts:
  `bun run --cwd packages/tooling/tool/cli check` + package tests +
  `bun run docgen:local`, with `bun run beep yeet verify` at wave boundaries.
- One PR at campaign end via `bun run beep yeet publish --message` (CI runner
  cost). The branch carries its own non-empty changeset listing changed
  packages.
- Wave 0 lands the pre-existing dirty working-tree edits as their own
  commit(s) so wave diffs stay attributable.

## Specialist Sub-Agents

Repo-general agent definitions in `.claude/agents/` (mirrored for Codex via the
`.agents/` symlink convention). Campaign-specific instructions stay in
[PLAN.md](./PLAN.md); agents receive them per task.

| Agent | Charter | Anchored on |
|---|---|---|
| `modularization-analyst` | Seam analysis and split design for oversized files (read-only) | `standards/ARCHITECTURE.md` role anchors |
| `architecture-guardian` | Topology/facade/boundary review of a diff or package (read-only) | `standards/ARCHITECTURE.md`, `standards/architecture/*` |
| `code-patterns-strategist` | Reuse discovery: find the existing helper before new code is written (read-only) | `repo-symbol-discovery` skill |
| `effect-first-developer` | Implementation in Effect-first repo style | `effect-first-development` skill |
| `schema-first-developer` | Schema authoring/refactoring, LiteralKit domains | `schema-first-development` skill |
| `crispener` | Absorb invariants into schemas, delete helper walls on touched code | `crispen` skill |
| `jsdoc-annotation-specialist` | Bring touched files to the JSDoc rubric; docgen proof | `jsdoc-annotation-specialist` skill, `.patterns/jsdoc-documentation.md` |

## Verification Catalog

- `bun run --cwd packages/tooling/tool/cli check`
- `bun run --cwd packages/tooling/tool/cli test` (no NEW failures)
- `bun run docgen:local`
- `bun run beep lint schema-catalog --write` (waves that move schemas)
- `bun run beep lint schema-first`, `bun run beep laws dual-arity` and sibling
  ratchets (with `--write` only under the regeneration rule above)
- `bun run beep yeet verify` at wave boundaries
- `bun run beep yeet publish --message "..."` once, at campaign end
