# Pack memfs — round 1 JSDoc review

Read-only review of `scratchpad/memfs/` against `.patterns/jsdoc-documentation.md` and the specialist conventions. Census input: `scratchpad/.jsdoc-loop/packs/memfs/{README.md,slice.json}`.

Covered: 3 exporting modules, 18 owning exports (13 in `MemoryFileSystem.ts`, 5 in `internal/volume.ts`). The barrel re-export in `memfs/index.ts` is a graph edge, not an owning symbol.

## Rejected / not opened

- Type-level owning exports were **not** flagged by census for a required Example; do not add placeholder Examples on the seed/fault interfaces.
- Do not document `memfs/index.ts` `export { ... }` as a new symbol.
- Do not open taste-only rewrites of the already-useful type leads (Volume, SyncFileSystem, seed/fault types).
- Do not require extra titled Examples on every `MemoryFileSystem` static once the class (and existing member Examples) are converted; convert the four legacy member `@example` blocks, do not invent one per static.
- Census `@effected` on `MemoryFileSystemSyncFileSystem` is a parser hit on the prose string `` `@effected/workspaces` ``, not a JSDoc tag. Not a finding.

## Findings

### memfs-R1-001: MemoryFileSystem.ts missing module header

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/MemoryFileSystem.ts:1
- `symbol`: MemoryFileSystem.ts
- `kind`: module
- `evidence`: Census `missing-module-summary|missing-packageDocumentation|missing-module-since` confirmed. File opens with a `//` port note (`The facade over the vendored engine...`), not a JSDoc fileoverview. No `@packageDocumentation`, no `@since 0.0.0`.
- `impact`: Exporting-module ratchet and docgen fileoverview extraction have nothing to render; callers landing on the file never get the kit contract (honest absence, unenforced modes, inspectable vs host FS).
- `suggestedFix`: Add a fileoverview JSDoc with a useful lead (in-memory `FileSystem` test double; seed / fault / inspectable kit on a vendored engine), then `@packageDocumentation` and `@since 0.0.0`. Do not copy the class block wholesale; point at {@link MemoryFileSystem}.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### memfs-R1-002: MemoryFileSystem.ts owning exports missing @category and @since

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/MemoryFileSystem.ts:39, scratchpad/memfs/MemoryFileSystem.ts:145, scratchpad/memfs/MemoryFileSystem.ts:164, scratchpad/memfs/MemoryFileSystem.ts:175, scratchpad/memfs/MemoryFileSystem.ts:197, scratchpad/memfs/MemoryFileSystem.ts:209, scratchpad/memfs/MemoryFileSystem.ts:222, scratchpad/memfs/MemoryFileSystem.ts:245, scratchpad/memfs/MemoryFileSystem.ts:258, scratchpad/memfs/MemoryFileSystem.ts:278, scratchpad/memfs/MemoryFileSystem.ts:294, scratchpad/memfs/MemoryFileSystem.ts:311, scratchpad/memfs/MemoryFileSystem.ts:703
- `symbol`: MemoryFileSystemVolume, MemoryFileSystemSyncFileSystem, MemoryFileSystemInspectable, MemoryFileSystemSeedFile, MemoryFileSystemSeedDirectory, MemoryFileSystemSeedSymlink, MemoryFileSystemSeedEntry, MemoryFileSystemSeed, MemoryFileSystemFaultMethod, MemoryFileSystemFaultHandler, MemoryFileSystemTransientFault, MemoryFileSystemFaults, MemoryFileSystem
- `kind`: type
- `evidence`: Census `missing-required-tags` confirmed on all 13 owning exports (`Missing @category, @since`). Census correctly did **not** demand an Example on the 12 type-level symbols. Value-level `MemoryFileSystem` (class, line 703) also lacks those tags; its Example presence is a retired `@example` (see memfs-R1-004), not a titled `**Example** (Title)`. Existing `@public` tags stay; insert `@category` then `@since 0.0.0` after them (tag order: `@public` → `@category` → `@since`).
- `impact`: jsdoc-ratchet / docgen grouping has no canonical role; every hover is missing the required trailing tags.
- `suggestedFix`: Keep the existing leads. Add `@since 0.0.0` on every owning export. Suggested `@category` (semantic role, not topology): interfaces `MemoryFileSystemVolume`, `MemoryFileSystemSyncFileSystem`, `MemoryFileSystemInspectable`, seed structs, `MemoryFileSystemTransientFault` → `models`; mapped aliases `MemoryFileSystemSeedEntry`, `MemoryFileSystemFaultMethod`, `MemoryFileSystemFaultHandler`, `MemoryFileSystemFaults` → `type-level`; class `MemoryFileSystem` → `adapters`. Convert the class Example carrier separately (memfs-R1-004).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### memfs-R1-003: MemoryFileSystem.ts retired @remarks carriers (types, class, members)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/MemoryFileSystem.ts:15, scratchpad/memfs/MemoryFileSystem.ts:92, scratchpad/memfs/MemoryFileSystem.ts:108, scratchpad/memfs/MemoryFileSystem.ts:121, scratchpad/memfs/MemoryFileSystem.ts:232, scratchpad/memfs/MemoryFileSystem.ts:287, scratchpad/memfs/MemoryFileSystem.ts:648, scratchpad/memfs/MemoryFileSystem.ts:713, scratchpad/memfs/MemoryFileSystem.ts:735, scratchpad/memfs/MemoryFileSystem.ts:756, scratchpad/memfs/MemoryFileSystem.ts:836, scratchpad/memfs/MemoryFileSystem.ts:856, scratchpad/memfs/MemoryFileSystem.ts:911, scratchpad/memfs/MemoryFileSystem.ts:933, scratchpad/memfs/MemoryFileSystem.ts:948, scratchpad/memfs/MemoryFileSystem.ts:962, scratchpad/memfs/MemoryFileSystem.ts:972, scratchpad/memfs/MemoryFileSystem.ts:1023, scratchpad/memfs/MemoryFileSystem.ts:1039, scratchpad/memfs/MemoryFileSystem.ts:1076, scratchpad/memfs/MemoryFileSystem.ts:1104, scratchpad/memfs/MemoryFileSystem.ts:1124, scratchpad/memfs/MemoryFileSystem.ts:1139
- `symbol`: MemoryFileSystemVolume, MemoryFileSystemSyncFileSystem, MemoryFileSystemSeed, MemoryFileSystemTransientFault, MemoryFileSystem
- `kind`: type
- `evidence`: Census `legacy-remarks` confirmed on owning `MemoryFileSystemVolume`, `MemoryFileSystemSyncFileSystem`, `MemoryFileSystemSeed`, `MemoryFileSystemTransientFault`, and class `MemoryFileSystem`. Same-file leftovers the census did not list as owning: `MemoryFileSystemVolume.mtime` (line 92), `MemoryFileSystemVolume.readLink` (line 108), and every documented static (`makeWith`, `makeFaulty`, `layerFaulty`, `layerFaultyWith`, `failTimes`, `file`, `directory`, `symlink`, `layer`, `layerWith`, `Volume`, `syncFileSystem`, `makeInspectable`, `makeInspectableWith`, `layerInspectable`, `layerInspectableWith`). Zero-legacy law forbids `@remarks` anywhere in a touched src file. The remarks bodies are not empty — they hold real contracts (literal vs follow-links, honest absence, per-build memoization, unenforced modes, `failTimes` suite-boundary counter, contradictory seed `orDie`).
- `impact`: `jsdoc-ratchet` zero-legacy fails the file on first land under `{packages,apps}/**/src`. Relocating (not deleting) the remarks is what keeps callers from confusing `Volume` (literal, `undefined` = absent) with `syncFileSystem` (follows links, throws `ENOENT`/`EISDIR`/`ENOTDIR`).
- `suggestedFix`: Move each `@remarks` body into `**Details**` and/or `**Gotchas**` (canonical order, before Examples). Preserve `{@link}` sentences. Do not add empty `**When to use**`. On member blocks, same conversion; members are not owning exports and do not need their own `@category`/`@since`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### memfs-R1-004: MemoryFileSystem retired @example carriers

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/MemoryFileSystem.ts:681, scratchpad/memfs/MemoryFileSystem.ts:795, scratchpad/memfs/MemoryFileSystem.ts:877, scratchpad/memfs/MemoryFileSystem.ts:990, scratchpad/memfs/MemoryFileSystem.ts:1059
- `symbol`: MemoryFileSystem
- `kind`: value
- `evidence`: Census `legacy-example` confirmed on the class (`Uses retired @example carrier; convert to **Example** (Title).`). Same-file leftovers: `layerFaulty` (795), `failTimes` (877), `layerWith` (990), `syncFileSystem` (1059). Each fence sits under `@example`, untitled, and is not last in a lawful body (remarks precede or follow). Example *quality* (imports, observability, compile) is memfs-R1-005 — this item is the carrier only.
- `impact`: Zero-legacy ratchet fails on `@example`. Value-level class has no lawful titled Example until the class fence is converted.
- `suggestedFix`: Replace each `@example` with a unique `**Example** (Title)` section containing exactly that one `ts` fence, last in the block, then tags. Titles must be unique within a block. Keep one Example on the class; convert the four member Examples in place rather than duplicating them on the class.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: memfs-R1-005
- `status`: open
- `fixedCommit`: pending

### memfs-R1-005: Examples import @effected/memfs and are vacuous or non-compiling

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/MemoryFileSystem.ts:682, scratchpad/memfs/MemoryFileSystem.ts:797, scratchpad/memfs/MemoryFileSystem.ts:879, scratchpad/memfs/MemoryFileSystem.ts:992, scratchpad/memfs/MemoryFileSystem.ts:1060
- `symbol`: MemoryFileSystem
- `kind`: value
- `evidence`: Law forbids `@effected/*` example imports; scratchpad mapping is `@beep/scratchpad/memfs` (`scratchpad/docgen.json`). Four fences start `import { MemoryFileSystem } from "@effected/memfs"`. Observability: class example ends `program.pipe(Effect.provide(SeededFs));` with no run/log (void-discarded Effect). `layerFaulty` and `failTimes` only construct layers. `layerWith` binds unused `shared` / `reseeded`. `syncFileSystem` is top-level `yield*` with no `Effect.gen`, no imports — will not compile under docgen (`erasableSyntaxOnly` + examples TS gate).
- `impact`: Docgen example compilation fails; even if it passed, callers never see a seeded read, a consumed `failTimes` counter, or a sync `readDirectory` result. Placeholder `console.log(fn)`-grade fences.
- `suggestedFix`: Import `import { MemoryFileSystem } from "@beep/scratchpad/memfs"` (and `Effect` / `FileSystem` / `Layer` / `PlatformError` from `effect` as needed). Class Example: `Effect.runPromise` (or an equivalent observable) of a seeded `readFileString` and show the fixture JSON. `layerWith`: actually run the one-provide vs two-provide programs and assert `"written"` vs `"seed"`. `failTimes`: provide, retry/read, and show the first two failures then success. `layerFaulty`: provide and show `chmod(0o444)` failing while another method delegates. `syncFileSystem`: wrap `makeInspectableWith` in `Effect.gen`/`runPromise`, then `sync.readDirectory("/repo") // => ["package.json", "packages"]`. No `any`, assertions, `declare`, or named `Schema`/`Option`/`Array` imports.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: memfs-R1-004
- `status`: open
- `fixedCommit`: pending

### memfs-R1-006: failTimes synchronous RangeError lacks @throws

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/MemoryFileSystem.ts:901
- `symbol`: MemoryFileSystem.failTimes
- `kind`: value
- `evidence`: Implementation `throw new RangeError(\`failTimes: times must be a non-negative integer, got ${String(times)}\`)` when `times` is negative or non-integer. Remarks already say this is a wiring bug, not runtime input, but there is no `@throws` tag. Law: `@throws` is required for synchronous throws outside a typed Effect error channel; write `@throws description` with no hyphen and no `{Type}` braces. This is a class static (not a census owning export) but it is the public factory callers type against.
- `impact`: Hover on `failTimes` hides that bad `times` blows the test process immediately, unlike `PlatformError` on the intercepted method.
- `suggestedFix`: After converting remarks to Gotchas, add `@throws Throws RangeError when \`times\` is negative or not an integer.` Keep `@param times -` / `@param error -`. Do not document the `RangeError` as an Effect failure.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: memfs-R1-003
- `status`: open
- `fixedCommit`: pending

### memfs-R1-007: MemoryFileSystem.file @param omits mtime

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/MemoryFileSystem.ts:917
- `symbol`: MemoryFileSystem.file
- `kind`: value
- `evidence`: Signature is `options?: { readonly mode?: number; readonly mtime?: number }`. Tag is `@param options - \`mode\`: initial permission bits (default \`0o644\`).` `MemoryFileSystemSeedFile` already documents `mtime` as epoch milliseconds (seeded entries otherwise share the volume clock). Implementation comment at the `utimes` call (lines 345–348) warns that a bare number is Unix **seconds** — the factory converts via `new Date(entry.mtime)` so callers must pass milliseconds. Factory JSDoc never mentions `mtime`.
- `impact`: A caller who only hovers `file()` will seed mode and miss the only way to make one seeded file older than another; a caller who guesses a unix-seconds `mtime` will be silently 1000× off if they later call `utimes` themselves with a number.
- `suggestedFix`: Extend the `@param options` sentence: `mode` default `0o644`; `mtime` epoch **milliseconds** (not unix seconds); omit `mtime` and every seeded entry shares the volume clock. Move the seconds-vs-milliseconds warning into `**Gotchas**` on `file` (and keep it out of empty When-to-use).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: memfs-R1-003
- `status`: open
- `fixedCommit`: pending

### memfs-R1-008: Sync port documents dangling links but not ELOOP-as-absence

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/MemoryFileSystem.ts:145, scratchpad/memfs/MemoryFileSystem.ts:453
- `symbol`: MemoryFileSystemSyncFileSystem
- `kind`: type
- `evidence`: Implementation comment at `MAX_LINK_HOPS = 40`: `a cycle resolves to absence rather than spinning`. `resolveLinks` returns `undefined` after 40 hops, so `exists` is `false` and `readFile`/`readDirectory` throw `ENOENT` — not `ELOOP`. `MemoryFileSystemSyncFileSystem` remarks already teach follow-links, dangling-as-absent, and throw codes `ENOENT`/`EISDIR`/`ENOTDIR`; they never mention cycles. Law: missing Gotcha that implementation comments already warn about.
- `impact`: A test that plants a cyclic symlink and expects Node's `ELOOP` will see honest absence instead and mis-blame the code under test.
- `suggestedFix`: In the SyncFileSystem (and `syncFileSystem` adapter) `**Gotchas**`, state that link cycles and >40 hops are reported as absence (`exists` false / `ENOENT`), not `ELOOP`. Keep `{@link MemoryFileSystemVolume}` as the literal sibling callers must choose.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: memfs-R1-003
- `status`: open
- `fixedCommit`: pending

### memfs-R1-009: index.ts fileoverview missing @since 0.0.0

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/index.ts:1
- `symbol`: index.ts
- `kind`: module
- `evidence`: Barrel has a useful lead and `@packageDocumentation` (census `hasLead`/`hasFileoverview`/`hasPackageDocumentation` true). `hasSince` is false and census `findings` is empty because `owningExportCount === 0` (re-export only), so `missing-module-since` is skipped in `census.ts`. REVIEW-BRIEF / FIXER-BRIEF still require `@since 0.0.0` on every exporting module. Not a false positive — a census false negative. Re-export line 29 is not an owning symbol (do not document it).
- `impact`: Package entry renders without the required `@since`; enforceVersion / module-header checks will fail once barrels are included.
- `suggestedFix`: Append `@since 0.0.0` after `@packageDocumentation`. Leave the lead and the re-export list alone.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### memfs-R1-010: internal/volume.ts missing module header

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/internal/volume.ts:1
- `symbol`: volume.ts
- `kind`: module
- `evidence`: Census `missing-module-summary|missing-packageDocumentation|missing-module-since` confirmed. File opens with MIT port `//` comments (PR #6573, watch recursion, nesting bound, `access` ignores mode, `copy` AlreadyExists path). No JSDoc fileoverview.
- `impact`: Internal exporting module is invisible to docgen overview; the adaptation-ledger notes never become a module lead.
- `suggestedFix`: Add a fileoverview with a useful lead (vendored in-memory `FileSystem` engine; public callers use {@link MemoryFileSystem}), `@packageDocumentation`, `@since 0.0.0`. Keep the `//` copyright/port notes below or fold only caller-facing facts into the lead — do not drop attribution.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### memfs-R1-011: internal/volume.ts owning exports missing leads, tags, and value Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/memfs/internal/volume.ts:2742, scratchpad/memfs/internal/volume.ts:2750, scratchpad/memfs/internal/volume.ts:2829, scratchpad/memfs/internal/volume.ts:2836, scratchpad/memfs/internal/volume.ts:2842
- `symbol`: make, VolumeEntrySnapshot, InspectableFileSystem, makeInspectable, layer
- `kind`: value
- `evidence`: Census confirmed on all five owning internals: `missing-summary` + `missing-required-tags`. Values `make`, `makeInspectable`, `layer` also miss a titled Example. Each declaration is `/** @internal */` only. Field comments on `VolumeEntrySnapshot` (`data` is a live reference — callers must copy) and `InspectableFileSystem.entries` (live walk, not a build-time copy) are not interface leads. Types do not need Examples; values do. Keep `@internal`; tag order `@internal` → `@category` → `@since`.
- `impact`: Engine constructors are undocumented next to the public facade; a caller who imports `internal/volume` gets no contract and no compilable Example. `VolumeEntrySnapshot.data` aliasing is an easy mutation bug if the lead stays missing.
- `suggestedFix`: Write a one-paragraph lead each. Point value constructors at the public {@link MemoryFileSystem.make} / {@link MemoryFileSystem.layer} / {@link MemoryFileSystem.makeInspectable} wrappers. Categories: `make` / `makeInspectable` → `constructors`; `layer` → `layers`; `VolumeEntrySnapshot` / `InspectableFileSystem` → `models`. `@since 0.0.0`. Value Examples: import from `@beep/scratchpad/memfs` and show `MemoryFileSystem.make` / `MemoryFileSystem.layer` / inspectable snapshot — do not teach people to import the internal path. Put the live-`data`/must-copy fact in `VolumeEntrySnapshot` Details. No `$I.annote` (these are not schemas).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Pack verdict

- files reviewed: 3
- owning exports reviewed: 18
- confirmed mechanical items: 6
- editorial items: 5
- rejected false positives: 0
- accepted findings: 11

Every owning export was reviewed. Zero accepted findings is not the case: the pack is open on module headers (`MemoryFileSystem.ts`, `internal/volume.ts`, plus barrel `@since`), required tags on all 18 owning exports, retired `@remarks`/`@example` throughout `MemoryFileSystem.ts`, `@effected/memfs` + vacuous/non-compiling Examples, and three caller-facing gaps (`failTimes` `@throws`, `file()` `mtime`, sync-port cycle-as-absence). No schemas, so no `$I.annote` / same-name alias work. Barrel re-export left undocumented as a graph edge.
