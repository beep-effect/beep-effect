# Round 2 JSDoc inventory — glob, semver, schemastore, memfs

Independent editorial re-review after round-1 fixes. Mechanical census is
already `openModuleCount: 0` / `openOwningExportCount: 0`. Zero `@example` /
`@remarks` / `@module` / `@template`. Runtime `@effected/*` service ids
(`VersionCache`, `SchemaFile`, `SchemaValidator`, `MemoryFileSystem.Volume`)
are not findings.

Pack files reviewed from `scratchpad/.jsdoc-loop/packs.json`. Census owning
counts: glob 20, semver 34, schemastore 47, memfs 18. Every exporting module
in the four packs was read; glob `internal/**` owning declarations were
reviewed even where the census slice is thinner than the raw `export` list.

---

### glob-R2-001: Internal value-level Examples never invoke the documented symbol

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (Kind-split Example law; Example quality: “shows the symbol doing its actual job”; placeholder Examples are defects)
- `affectedFiles`: glob/internal/assertValidPattern.ts:26, glob/internal/ast.ts:213, glob/internal/balancedMatch.ts:62, glob/internal/balancedMatch.ts:98, glob/internal/braceExpansion.ts:145, glob/internal/braceExpressions.ts:74, glob/internal/escape.ts:47, glob/internal/unescape.ts:53, glob/internal/limits.ts:162, glob/internal/limits.ts:190, glob/internal/limits.ts:216, glob/internal/minimatch.ts:142, glob/internal/minimatch.ts:188, glob/internal/types.ts:121
- `symbol`: assertValidPattern, AST, balanced, range, expand, parseClass, escape, unescape, GuardExceeded, isGuardExceeded, assertCap, braceExpand, Minimatch, GLOBSTAR
- `kind`: value
- `evidence`: Every listed Example imports `@beep/scratchpad/glob` and calls `GlobPattern.compileResult` / `GlobPattern.escape` / `GlobPatternOptions.make`. None of the fences mention or invoke the documented identifier. Worst cases: `balanced`/`range` never show delimiter offsets (`pre`/`body`/`post` or `[start,end]`); `isGuardExceeded` never calls the guard (it inspects `GlobPatternError.reason`); `assertCap` try/catches `GlobPatternOptions.make({ braceExpandMax: 0 })`; `GLOBSTAR` demonstrates `crossesSegments`; `Minimatch`'s title is literally “Match through the public facade”. Sibling kit `semver/internal/*` already compiles relative imports of the owning symbols (`../../semver/internal/grammar.ts`).
- `impact`: Hover/docs for engine helpers teach the public facade instead of the helper. A caller of `balanced("{", "}", "a{b,c}d")` or `isGuardExceeded(e)` cannot see the actual result shape. Placeholder-style Examples fail the quality bar even when they typecheck.
- `suggestedFix`: Rewrite each fence to import the owning module relatively (same pattern as `scratchpad/semver/internal/grammar.ts`) and call the symbol with realistic inputs: `balanced`/`range` on `"a{b,c}d"`; `expand("a{b,c}d")` plus a budget trip; `parseClass("[a-z]", 0)` and `"[_]"`; `escape`/`unescape` with shared options; `assertValidPattern` TypeError vs `GuardExceeded`; `isGuardExceeded(new GuardExceeded(...))`; `assertCap("braceExpandMax", 0)` in try/catch; `braceExpand` with `nobrace: true`; `new Minimatch("**/*.ts", {})`; `GLOBSTAR` compared with `Minimatch.set`. Keep one titled fence and an observable `console.log` / `// =>`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### glob-R2-002: `expand` omits the Bash leading-`{}` Gotcha the implementation already warns about

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (Details/Gotchas contain only information not obvious from the signature); scratchpad/.jsdoc-loop/REVIEW-BRIEF.md (“Missing Gotcha that the implementation comments already warn about”)
- `affectedFiles`: glob/internal/braceExpansion.ts:138
- `symbol`: expand
- `kind`: value
- `evidence`: Current Gotchas cover only `ExpansionBudgetExceeded` and `NestingDepthExceeded`. The function body still documents a non-obvious Bash 4.3 rule: a leading `{}` is escaped only at the top level (`{},a}b` does not expand; `a{},b}c` expands to `[a}c,abc]`). That warning is not in the JSDoc.
- `impact`: Direct `expand` callers (and anyone diagnosing “braces did nothing”) will not learn the leading-`{}` rule from the hover. Signature (`string` → `Array<string>`) cannot communicate it.
- `suggestedFix`: Add one Gotchas sentence for the top-level leading-`{}` escape, with the two short examples from the implementation comment. Optional: extend the existing Example with `expand("{},a}b")` vs `expand("a{},b}c")`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R2-001
- `status`: open
- `fixedCommit`: pending

### schemastore-R2-001: Service/pipeline Examples log an unresolved `Promise` (one claims `[]`)

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (Example quality: observable result; “A void-discarded value is a compile trick, not documentation”)
- `affectedFiles`: schemastore/SchemaFile.ts:331, schemastore/SchemaPipeline.ts:315, schemastore/SchemaValidator.ts:218
- `symbol`: SchemaFile, SchemaPipeline, SchemaValidator
- `kind`: value
- `evidence`: All three class Examples build a real program, then `console.log(Effect.runPromise(...))`. That logs a Promise object, not a `WriteResult`, check result, or findings array. `SchemaValidator` additionally comments `// => []` on the following line, which is false for that expression. Round-1 fixer residual already noted SchemaFile/SchemaPipeline “log a Promise rather than asserting a live WriteResult”.
- `impact`: Callers of the three IO/validation surfaces never see the value the symbol returns. The validator fence actively mis-teaches the result as `[]`. This is the same class of defect as `console.log(fn)`.
- `suggestedFix`: Observe the resolved value: `Effect.runPromise(program).then((result) => console.log(result))` with a truthful `// =>` on the logged payload (`{ outcome, change }`, check `blocked`/`wouldWrite`, or `[]`). Prefer that over top-level `await` unless the extracted example is already async. Do not leave `console.log(Effect.runPromise(program))` as the only statement.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: schemastore
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### memfs-R2-001: Internal `makeInspectable` Example documents the public `{ volume }` shape, not `{ entries }`

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md (Example must show the symbol doing its actual job)
- `affectedFiles`: memfs/internal/volume.ts:2902
- `symbol`: makeInspectable
- `kind`: value
- `evidence`: Owning `makeInspectable` returns `InspectableFileSystem` `{ fileSystem, entries }`. The titled Example does `const { fileSystem, volume } = yield* MemoryFileSystem.makeInspectable` then `volume.text("/out.txt")`. That is the public facade (`MemoryFileSystemInspectable.volume`), not this export. `volume` is not a field of `InspectableFileSystem`. Sibling internals `make` / `layer` are identity aliases of `MemoryFileSystem.make` / `MemoryFileSystem.layer` and are not opened.
- `impact`: A caller who imports `makeInspectable` from `internal/volume.ts` and follows the hover will fail to typecheck (`volume` does not exist) and will never see `entries()` or the live-`Uint8Array` snapshot contract on `VolumeEntrySnapshot.data`.
- `suggestedFix`: Import `makeInspectable` from `../../memfs/internal/volume.ts` (or show `MemoryFileSystem.makeInspectable` only on the public class). Yield `{ fileSystem, entries }`, write a file, and log `entries().find((e) => e.path === "/out.txt")?.data` (copy if asserting bytes) or a decoded text from that snapshot. Keep `.then(console.log)` so the result is observable.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: memfs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Rejected / not opened

- Runtime `@effected/*` Context service ids and JSDoc mentions of `@effected/semver` / `@effected/workspaces` / `@effected/yaml` as kit names.
- Semver `$I.annote` / `$I.annoteSchema` — round 1 explicitly did not open this (runtime schema identity; class schemas already double as decoded types).
- Schemastore `Schema.Defect()` without `includeStack: true` (R1-036) — runtime encoding, not JSDoc.
- Extra titled Examples on class members when the owning class already has one.
- Glob public `GlobPattern` / `GlobSet` sibling choice — Gotchas already use inline `{@link}` for bang semantics.
- Glob cap constants (`MAX_PATTERN_LENGTH`, `EXPANSION_MAX`, …) whose Examples show the public compile failure at that numeric bound rather than naming the const.
- Memfs `internal.make` / `internal.layer` Examples that go through `MemoryFileSystem.make` / `.layer` — those are the same bindings.
- Taste-only category debates (`SemVerBump` constructors, `AnnotationCarriers` combinators, `DocumentDiff` utilities).

## Pack verdict

- files reviewed: 40 (glob 13, semver 10, schemastore 14, memfs 3)
- owning exports reviewed: 119 census-owning (glob 20, semver 34, schemastore 47, memfs 18), plus glob internal owning declarations listed in glob-R2-001
- confirmed mechanical items: 0
- editorial items: 4
- rejected false positives: 8 (grouped above)
- accepted findings: 4

semver is clean on this pass: module headers, kind-split Examples, described `@see`, Gotchas for trim vs `isValid`, dual `(version, range)`, caret 0.x, and internal relative-import Examples all hold.

If the four items above are declined as out of round-2 scope, the residual risk is the glob internal facade-proxy Examples, the three schemastore Promise logs, and the memfs `makeInspectable` shape mismatch.
