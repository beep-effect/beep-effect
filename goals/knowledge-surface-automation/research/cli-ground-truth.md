# CLI ground-truth survey

Date: 2026-07-31

Scope: static, read-only inspection of the current repository. No command was executed that
writes, installs dependencies, or contacts the network. All paths below are repo-relative.

## 1. Goals command family

### Command tree and entry points

| User surface | Current entry point | Ground truth |
| --- | --- | --- |
| `beep goals doctor` | `packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:796-818` | Registered command; read-only unless `--write-baseline` is supplied. |
| `beep goals index` | `packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:226-290` | Prints by default, writes with `--write`, or checks exact bytes with `--check`. |
| `beep goals set-status` | `packages/tooling/tool/cli/src/commands/Goals/SetStatus.ts:151-221` | Updates one manifest/README and regenerates `goals/INDEX.md`. |
| Goal migration | `packages/tooling/tool/cli/src/commands/Goals/SetStatus.ts:36-88` | Not a standalone command: `set-status --migrate`, dry-run by default, writes with `--write`. |
| Goal inventory | `packages/tooling/tool/cli/src/commands/Goals/Inventory.ts:113-149` | Internal reusable scanner, not registered as a CLI subcommand. |
| Family registration | `packages/tooling/tool/cli/src/commands/Goals/Goals.command.ts:12-40` | Explicitly composes doctor, index, and set-status. |

The family barrel exports the command, errors, schemas, inventory, migration, index, and
set-status APIs (`packages/tooling/tool/cli/src/commands/Goals/index.ts:14-63`). The package export
is declared at `packages/tooling/tool/cli/package.json:37` and `:95`; the top-level command is
imported and added to the root list at `packages/tooling/tool/cli/src/commands/Root.ts:22,51-81`.

### `initiative-manifest/v2` schema

The schema is `GoalManifest` in
`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:291-313`; its decoder is
`decodeGoalManifest` at `:328`. The exact modeled fields are:

- required `initiative` (`GoalInitiative`, `:221-233`): required `id`, required `status`, and
  optional `title`, `created`, `updated`, and `packetAnchorDocument`;
- required `completionGate` (`GoalCompletionGate`, `:190-202`): required `operator`,
  `requiresPullRequest`, `requiresMergeable`, `statement`, and `grandfathered`, plus optional
  `grandfatheredNote`;
- optional top-level `schemaVersion`, `lifecycle`, `packetPath`, `executionCapable`,
  `reflectionRequired`, `mission` (`string | null`), `statusNote`, `blockedBy` (`string[]`),
  `supersededBy`, `supersededByNote`, `claimedBy`, `claimedAt`, `discoveredFrom`, and `phases`;
- `phases` may be an array of `GoalPhase` or a string-keyed record of `GoalPhase`; each phase has
  required `status` and optional `id`, `name`, and `exit` (`:251-261,291-313`).

Literal domains are centralized with `LiteralKit`: goal statuses are `active`, `paused`,
`completed-retained`, `superseded`, and `reference`
(`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:41-45`); phase statuses are
`pending`, `in-progress`, `complete`, and `superseded` (`:94-98`); accepted schema versions are
`initiative-manifest/v2`, `initiative-manifest/v1`, and `1.0.0` (`:146-150`). Derived
`S.is(...)` guards are exported for the status domains (`:75,128`).

Unknown-key behavior is important:

- The file explicitly describes the decoder as lenient
  (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:4-10`).
- `decodeGoalManifest` calls `S.decodeUnknownEffect(GoalManifest)` without an excess-property
  override (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:328`).
- The installed Effect implementation documents `onExcessProperty: "ignore"` as the default;
  `"error"` and `"preserve"` are opt-ins
  (`node_modules/effect/src/SchemaAST.ts:441-483`).
- Thus an additive raw `provides` array does **not** fail current decode, but it is stripped from
  the decoded result. The live initiative already demonstrates this: its raw manifest contains
  `provides` (`goals/knowledge-surface-automation/ops/manifest.json:17-22`) while the schema has no
  such field. The same applies to template fields such as `provenance` and
  `currentSourceOfTruth` (`goals/_template/ops/manifest.json:14-26`).
- The comment saying unknown keys “pass through undecoded”
  (`packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:269-270`) is
  imprecise: raw JSON remains available to callers that retain it, but the schema's output does
  not preserve the keys. Doctor's bespoke `provenance.exploration` check reads the raw object for
  exactly this reason (`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:415-455`).

### Inventory, migration, and status mutation

`readGoalInventory` scans direct children of `goals/`, excludes hidden directories and
`_template`, and sorts by slug
(`packages/tooling/tool/cli/src/commands/Goals/Inventory.ts:39,53,113-149`). Each record contains the paths and
optional contents of `ops/manifest.json`, `README.md`, and `GOAL.md` (`:76-89`). JSONC parsing is
object-only and returns `None` on parse/type failure (`:166-190`). README title/mission extraction
is bounded, and phase flattening supports both array and record shapes (`:267-356`). This is the
right canonical packet census for projection commands; a second directory walker would drift.

Migration is a pure planning layer over JSONC edits
(`packages/tooling/tool/cli/src/commands/Goals/Migration.ts:1-11,521-582`). It maps legacy
initiative and phase statuses to canonical literals (`:55-102`), recognizes already canonical
values through the schema-derived guards (`:122-142`), and parks unknown or missing status rather
than guessing (`:521-582`). Missing manifests are generated only for a fixed census-backed set of
five packets (`:177-241,356-369`). Existing JSONC is edited surgically for status, lifecycle,
supersession, and phases (`:371-491`), and the planner is idempotent.

`set-status` requires a decodable manifest and recognizable README `Lifecycle:` line. It edits
`initiative.status`, conditionally edits an existing top-level `lifecycle`, updates the date,
writes both files, then regenerates the portfolio index
(`packages/tooling/tool/cli/src/commands/Goals/SetStatus.ts:90-149`). The writes and index regeneration are sequential, not one atomic
transaction. `--migrate` cannot be combined with slug/status arguments (`:151-221`).

### `goals/INDEX.md` generation

`PortfolioIndex` builds rows from the shared inventory, parses JSONC, decodes `GoalManifest`, and
places decode failures in an invalid section
(`packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:175-211`). Title precedence is
manifest title then slug; mission precedence is manifest mission then README extraction. A phase
counts complete only when its canonical status is `complete`.

Rendering is deterministic for the same inputs
(`packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:93-160`):

- status sections follow `GoalStatus.Options`, not discovery order;
- valid rows are sorted by slug inside each section;
- invalid rows are sorted by slug;
- mission text is sanitized/truncated; and
- no timestamp is emitted.

The destination is `goals/INDEX.md`
(`packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:40`). `--check` compares current and
rendered bytes exactly; `--write` writes the render; neither flag prints the render; both together
are rejected (`:226-290`). Tests explicitly reverse inventory input and assert stable output and
group order (`packages/tooling/tool/cli/test/goals-command.test.ts:283-298`).

### Doctor findings and baseline ratchet

Doctor's finding kinds are a `LiteralKit` domain
(`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:91-109`) and severities are another
(`:126-130`). Blocking checks cover missing/invalid manifests, manifest/README lifecycle mismatch,
missing README status lines, oversized `GOAL.md`, active packets with terminal phases, and invalid
reflection artifacts. Advisories cover staleness, missing launcher links, old schema versions,
unsatisfied completion-gate evidence, missing supersession pointers, and missing exploration
backlinks. Finding identity is the stable `kind:slug:detail` key (`:154-195`).

The baseline schema is `goals-doctor-baseline/v1` with optional note and a string-key array
(`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:167-180`). The checked-in baseline is
`goals/goals-doctor.baseline.jsonc:1-19`; it currently contains inherited
`readme-status-line-missing` keys and says it may only shrink.

At runtime, current blocking keys are set-differenced against baseline keys to classify
introduced, inherited, and resolved findings
(`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:248-264`). Missing baseline means an
empty baseline, so every blocker is introduced; an invalid baseline is an operational error
(`:682-703`). Normal doctor exits nonzero only for introduced blockers and can therefore report
`OK: no new blocking findings` while listing inherited advisories/blockers (`:705-794`).
`--write-baseline` replaces the file with all current blocking keys, sorted (`:664-680`); the code
does not enforce the “may only shrink” policy, so callers/review must prevent baseline growth.

Doctor also uses Git history heuristics for staleness and completion evidence, skipping when Git
history is unavailable/shallow
(`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:531-646`). Those checks are distinct from the proposed
Git-tree-resolved URI integrity model.

## 2. Skills command family

### Current command and data model

The only registered subcommand is `update`; its flags are `--check`, `--dry-run`, and repeatable
`--skill` (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:963-1007`). There is no
independent `skills check`: the check surface is `skills update --check`.

The same 1,000-line command file currently owns schemas, GitHub retrieval, hashing, filesystem
mutation, TOML rendering, lock rendering, and CLI wiring. Its managed locations are
`.claude/skills`, `.agents/skills`, `.codex/config.toml`, and `skills-lock.json`
(`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:27-30`). The family barrel exports the command and typed operational/drift
errors (`packages/tooling/tool/cli/src/commands/Skills/index.ts:14-21`;
`packages/tooling/tool/cli/src/commands/Skills/Skills.errors.ts:61-137`).

The v1 lock schema is:

- root `{ version: 1, skills: Record<string, SkillLockEntry> }`
  (`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:133-142`);
- each entry requires `source`, `sourceType` (`github | local`), and `computedHash`; `ref` and
  `skillPath` are optional (`:105-117`);
- `sourceType` and GitHub tree entry types use `LiteralKit`
  (`:77-89,105-117,146-170`).

The checked-in file follows that schema (`skills-lock.json:1-145`). GitHub entries record a
repository URL, mutable `main` ref, skill path, and one computed hash
(`skills-lock.json:39-45,76-88,120-132`). It does not record resolved commit SHA, pristine
upstream hash, ordered patches, reconstructed-output hash, license, or per-target hashes.

### Exact hash semantics

`computeSkillHash` recursively reads regular files, sorts them lexically by normalized relative
path, and feeds SHA-256 this framing for every file
(`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:323-378,425-474`):

```text
UTF8(relativePath) NUL UTF8(decimalByteLength) NUL rawFileBytes NUL
```

The final value is lowercase SHA-256 hex. The hash includes file names, lengths, and bytes. It
does not include directory entries, file modes/executable bits, symlink targets, ownership, or
timestamps; non-files and symlinks are not hashed. It is an application-level tree digest, not a
Git tree object ID. Local installed trees and fetched remote snapshots use the same algorithm.

### Update/check mechanics

Remote sources are hard-coded and currently point at `ref: "main"`
(`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:234-265`). Update fetches a recursive GitHub tree for that ref, rejects a
truncated result, locates the directory by its `SKILL.md`, fetches descendant blobs with bounded
concurrency, and hashes the fetched bytes (`:519-589`). Path containment/traversal checks guard
download and write targets (`:293-321,614-639`).

The desired lock always covers all installed skills and is serialized with sorted keys
(`:656-710`). For selected remote skills, the desired hash comes from the freshly fetched
snapshot. For an unselected installed skill—even one known as GitHub-backed—the desired hash is
recomputed from its installed directory while retaining GitHub metadata. The existing lock is
schema-validated and byte-compared, but its prior hashes do not drive reconstruction.

The main runner always fetches the selected configured remote sources, including in `--check`
mode (`:890-961`). It compares fetched remote bytes with installed `.claude/skills`; normal update
replaces drifted directories, `--dry-run` reports without writing, and `--check` fails on drift.
It then compares rendered lock/config bytes and verifies `.agents/skills` is the expected symlink.
Consequently the current check is network-dependent and is not a lockfile-only reproducibility
check.

### `.codex/config.toml` management

The generated model is a `[skills]` table with `include_instructions = true`, followed by one
enabled `[[skills.config]]` table per sorted installed skill name
(`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:173-209,714-723`). The text renderer replaces the existing `[skills]` block
through the next non-nested TOML table, while preserving later tables; if absent, it appends the
block (`:741-764`). Comments or custom formatting inside the owned block are not preserved.

The current `.codex/config.toml` has `[skills]` and `include_instructions = true` but no generated
`[[skills.config]]` entries (`.codex/config.toml:1-22`). `.agents/skills` is expected to be a
symlink to `../.claude/skills`; its check/write logic is at
`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:793-833`.

## 3. CLI framework and canonical authoring pattern

Commands use `Command`, `Argument`, and `Flag` from `effect/unstable/cli`. The root command is a
static `Command.make("beep-cli")` plus `Command.withSubcommands([...])`
(`packages/tooling/tool/cli/src/commands/Root.ts:9-36,51-82`). A new top-level family therefore
requires all of:

1. a family directory and barrel under `packages/tooling/tool/cli/src/commands/`;
2. an explicit import and list entry in `packages/tooling/tool/cli/src/commands/Root.ts`;
3. a package subpath export in `packages/tooling/tool/cli/package.json:22-63,80-115`; and
4. tests using `Command.runWith`/`Command.run` against the family command.

The full command path builds Bun filesystem, path, terminal, HTTP, and crypto services plus
`FsUtilsLive` and `TSMorphServiceLive`, then runs the root command in a scope
(`packages/tooling/tool/cli/src/bin-main.ts:101-116,229-245`). New family-specific dependencies
should be supplied at the subcommand boundary, not added globally unless multiple families need
them.

The best existing pattern to copy is
`packages/tooling/tool/cli/src/commands/Image/Image.command.ts`:

- family-local errors, renderer, schemas, and service imports (`:8-23`);
- typed `Flag` declarations (`:25-40`);
- thin handlers that decode unknown CLI input, obtain a service, execute, and render (`:70-92`);
- subcommands that provide their service `Layer` at the boundary (`:94-122`); and
- a group command that only composes subcommands (`:139-142`).

Its service defines the interface and a repo-identity `Context.Service`, constructs a live Layer,
and exposes Effect-returning operations
(`packages/tooling/tool/cli/src/commands/Image/Image.service.ts:56-92,273-300,318-346`). Its barrel exports command, errors, schemas, and
service (`packages/tooling/tool/cli/src/commands/Image/index.ts:14-35`). This gives `knowledge` a concrete
`Knowledge.schemas.ts` / `Knowledge.errors.ts` / `Knowledge.service.ts` /
`Knowledge.command.ts` / `index.ts` shape.

Schemas are normally family-local. Cross-family execution primitives live under
`src/internal/`; domain schema helpers come from `@beep/schema`. Literal domains in the surveyed
commands consistently use `LiteralKit`, including goals status/version, doctor finding/severity,
skills source/tree-entry types, and repo proof surfaces
(`packages/tooling/tool/cli/src/internal/repo-run/RepoRun.proofs.ts:69-73`).

Generic Git execution is already centralized in
`packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts`: it adapts typed errors, parses
NUL-delimited paths deterministically, and exposes bounded `runGitOutput`, `runGitPathList`, and
`runGitLines` helpers (`:1-13,46-54,68-89,125-244`; barrel at
`packages/tooling/tool/cli/src/internal/repo-run/index.ts:8-11`). Knowledge's `ls-tree`, `cat-file`, `merge-base`, and `archive`
helpers should extend this shared module rather than duplicate it or depend on Yeet internals.

## 4. Adjacent lint and quality surfaces

### `lint roadmap-refs`

`RoadmapRefs` is deliberately narrow (`packages/tooling/tool/cli/src/commands/Lint/RoadmapRefs.ts:1-7`):

- it scans only `docs/ROADMAP.md`;
- it recognizes Markdown inline/reference links whose target begins `./` or `../` and then
  `goals/` or `explorations/` (`:29-31,74-107`);
- it strips query and fragment before path resolution (`:109`);
- it checks target existence in the current filesystem;
- for goal links with an asserted `(done/total)` suffix, it reads the linked manifest through
  `decodeGoalManifest` and emits advisory phase-count mismatches (`:127-193`); and
- missing targets are blocking while phase mismatch is warning-only (`:208-254`).

Overlap with Workstream A is therefore only “a reference target exists” and reuse of the goal
manifest decoder. It has no general Markdown/JSON/JSONC corpus registry, typed
`repo://`/`host://`/`upstream://` grammar, producer-specific ownership, anchor validation,
Git-tree object resolution, governed rewrite, or rename transaction. It should become a thin
producer/evaluator client of Knowledge (or share an extracted Markdown-link parser), not the
foundation of the new bus.

### Reflection artifacts and other path checks

`lint reflection-artifacts` enforces a closeout artifact for every `completed-retained` packet
unless `reflectionRequired: false`
(`packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts:1-8,216-224,256-347`). It validates a
`LiteralKit`-backed frontmatter schema, required headings, and the dated filename convention
(`:40-95,151-214`). Missing/invalid artifacts block; explicit opt-out is advisory. Doctor reuses
the same reflection validator
(`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:276-305`). This gate is adjacent packet governance, not
reference integrity.

Existing specialized reference/path checks include:

- Doctor's current-working-tree exploration backlink check
  (`packages/tooling/tool/cli/src/commands/Goals/Doctor.ts:415-455`);
- QA judge round-relative evidence path containment/existence
  (`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:247-270`);
- changeset package names against the workspace dependency graph
  (`packages/tooling/tool/cli/src/commands/Quality/ChangesetGraph.ts:409-473,526-558`); and
- TypeScript project references against the filesystem
  (`packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:874-910`).

These have useful local techniques but different identifier domains. Markdownlint is also in the
policy lane (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1086`), but
`.markdownlint-cli2.jsonc:1-43` configures syntax/style
and exclusions; it is not a link-target resolver.

### Where the Stage-1 gate belongs

The canonical policy aggregation is
`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1064-1092`. It already runs reflection,
roadmap refs, goals doctor, and exact index check. `runRootLintPolicyTask` executes that list
(`:1125-1133`), while repo-wide root lint adds the same policy siblings to the aggregate Turbo
lint (`:1147-1152`). Tests assert the exact ordered labels
(`packages/tooling/tool/cli/test/quality-tasks.test.ts:935-999`).

CI's required `Lint Policy` matrix lane invokes `beep ci lane lint-policy`
(`.github/workflows/check.yml:46-99,186-224`), whose descriptor maps to
`bun run beep lint policy`
(`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:320-326,809-811`). Yeet's verify planner
includes the pre-push proof
(`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:345-350,557-568`), and the quality
proof includes root lint. Therefore adding a no-baseline semantic-delta step to
`rootRepoLintPolicySteps` reaches all required surfaces without a new workflow job.

If implemented as a new `beep lint <name>` command, its name must also be added to
`packages/tooling/tool/cli/src/bin-main.ts:12-23`; that allowlist prevents policy subcommands from
being mistaken for the root quality-task fast path. A `beep knowledge doctor --stage1` policy
step does not need that fast-path edit.

## 5. Integration map

| Planned surface | Placement | Mandatory reuse | Refactor/prerequisite |
| --- | --- | --- | --- |
| `beep knowledge refs\|relink\|rename\|doctor` | New `packages/tooling/tool/cli/src/commands/Knowledge/` family; Root and package exports | `packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts`, repo-root/path-safety utilities, typed error/render conventions, `GoalManifest`/inventory for goal targets, policy finding logger | Add generic Git object/tree/archive operations; extract producer registry and Markdown reference parser; do not build on working-tree-only RoadmapRefs semantics. |
| `beep skills provenance\|materialize` | Add subcommands and modules under existing `packages/tooling/tool/cli/src/commands/Skills/` | Existing hash framing, source fetch/path containment, installed-name discovery, TOML renderer, symlink manager, typed errors | Split the monolith first; introduce a versioned warehouse/lock schema and immutable source identity; separate pristine, patch, effective, and installed states. |
| `beep goals bootstrap` | Add to `packages/tooling/tool/cli/src/commands/Goals/Goals.command.ts`; shared compiler/materialization service under the same family | `GoalManifest`, `GoalStatus`, `GoalPhase`, `readGoalInventory`, JSONC conventions, index builder, doctor validators | Extend the canonical schema before compilation; factor plan vs atomic executor; do not shell out from other commands. |
| `beep goals next\|explain\|scout\|respec` | Add to `packages/tooling/tool/cli/src/commands/Goals/Goals.command.ts`; projection service under the same family | One sorted inventory, canonical status/phase domains, shared capability schemas, portfolio renderer | Add defaulted `provides`/`requires`; define provenance/respec fields; provide in-memory `bun:sqlite` Layer plus pure reference evaluator; make all consumers share one projection. |
| `beep explore graduate` | New `packages/tooling/tool/cli/src/commands/Explore/` family; Root and package exports | Goals compiler/executor, goal schema/inventory/index/doctor, knowledge relinking | First formalize `exploration-manifest/v1`; compile graduation into the same overlay/journal as bootstrap; update exploration manifest/ATLAS/backlinks atomically. |

Build bootstrap/graduation as a pure plan that produces the complete overlay, validates it with
knowledge refs + doctor + projection, and only then passes it to one atomic executor/journal.
`scout --bootstrap` and `explore graduate` should call that service directly, never invoke the CLI
as a subprocess. Index/Mermaid output must consume the same sorted projection as `next` and
`explain`, not independently re-read manifests.

The exploration contract currently exists only as documentation/template: stages and
`exploration-manifest/v1` are described in `explorations/README.md:23-70,101-137`, which explicitly
says validation is conversational and there is no lint gate. Graduation is a manual convention
covering goal scaffold, seeded spec, bidirectional backlinks, manifest status, and ATLAS update
(`explorations/README.md:139-165`; `.claude/skills/explore/SKILL.md:82-95`). Formalizing that schema
and plan is a prerequisite to safe automated graduation.

## 6. Risks and open questions

1. **Lenient versus strict manifest decode.** Global strictness would break existing bespoke and
   forward-compatible fields. Keep the outer manifest additive/lenient, add typed/defaulted
   capability fields, and decide separately whether new nested capability records reject excess
   keys. Add tests proving old manifests decode and new keys are retained.
2. **Schema ownership.** Is `GoalManifest` to be renamed/aliased as the canonical
   `InitiativeManifest`, or will a second schema exist? A second divergent decoder would recreate
   today's raw-versus-decoded split and should be avoided.
3. **Index determinism under projection.** Current output is stable, but mission fallback reads
   working files and invalid manifests form a separate group. SQLite/Mermaid generation must use
   explicit ordering and the same normalized projection. Tests should permute discovery and SQL
   insertion order.
4. **Atomicity.** `set-status` currently writes manifest, README, then index sequentially.
   Bootstrap, respec, rename, and graduate need an overlay validated before commit plus
   crash-recovery/journal semantics; current writers cannot simply be chained.
5. **Doctor baseline governance.** `--write-baseline` can grow the baseline even though the file
   says shrink-only. Stage-1 semantic delta should have no baseline, and new Knowledge findings
   need an explicit decision about whether they join Doctor's ratchet or remain hard failures.
6. **Git-tree selection.** Define exact defaults for base/head, unborn/shallow repositories,
   dirty/untracked files, submodules, symlinks, case sensitivity, and fragment/anchor rules.
   Existing path checks answer none of these consistently.
7. **Rename transaction semantics.** Specify collision behavior, case-only renames, JSONC/comment
   preservation, producer ownership, generated indexes, rollback, and whether uncommitted edits
   are rejected or included in the overlay.
8. **Lock hash meaning.** The current digest omits modes and symlinks and conflates upstream and
   effective content. Decide whether to retain that algorithm for content compatibility or adopt
   a Git-compatible tree hash; whichever is chosen must be versioned.
9. **Mutable skill refs.** Hard-coded `main` refs make provenance time-dependent. Materialization
   requires a locked immutable commit/object plus stored pristine bytes, not a fresh ref lookup.
10. **Partial skill update semantics.** `--skill` refreshes selected remotes but derives unselected
    remote hashes from installed output. A v2 lock must not accidentally bless patched/effective
    output as pristine upstream.
11. **Offline verification.** Current `skills update --check` always contacts remotes. Define a
    warehouse-only reproducibility check separately from an explicit upstream freshness check.
