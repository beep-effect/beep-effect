# Round 3 JSDoc inventory — glob, semver, schemastore, memfs

Independent editorial re-review after round-2 fixes. Mechanical census is
already `openModuleCount: 0` / `openOwningExportCount: 0`. Zero `@example` /
`@remarks` / `@module` / `@template`. Runtime `@effected/*` service ids
(`VersionCache`, `SchemaFile`, `SchemaValidator`, `MemoryFileSystem.Volume`)
and kit-name mentions in prose are not findings.

Pack files reviewed from `scratchpad/.jsdoc-loop/packs.json`. Slice owning
counts: glob 34, semver 34, schemastore 47, memfs 18. Every exporting module
in the four packs was read, including glob `internal/**` owning declarations.

Round-2 closures verified on the live source (not re-opened):

| ID | Live check |
| --- | --- |
| glob-R2-001 | Internals relatively-import the owning module and call the named symbol (`balanced`/`range` offsets, `expand` + budget trip, `parseClass` tuples, shared `escape`/`unescape` options, `assertValidPattern` TypeError vs `GuardExceeded`, `isGuardExceeded`, `assertCap`, `braceExpand` + `nobrace`, `new Minimatch`, `GLOBSTAR` vs `Minimatch.set`). |
| glob-R2-002 | `expand` Gotchas include the Bash 4.3 top-level leading-`{}` rule; the Example logs `{},a}b` vs `a{},b}c`. |
| schemastore-R2-001 | `SchemaFile` / `SchemaPipeline` / `SchemaValidator` observe the resolved value via `.then((result) => console.log(...))` with truthful `// =>` payloads. |
| memfs-R2-001 | `makeInspectable` imports `../../memfs/internal/volume.ts`, destructures `{ fileSystem, entries }`, and decodes a sliced snapshot of `/out.txt`. |

No new lead/Example/Gotcha/`@see`/`@category` contradictions, vacuous fences,
or unlifted implementation-comment Gotchas met the open bar.

---

## Rejected / not opened

- Runtime `@effected/*` Context service ids and JSDoc mentions of
  `@effected/semver` / `@effected/workspaces` / `@effected/yaml` / `@effected/glob`
  as kit names (`assertCap` TypeError text included).
- Semver `$I.annote` / `$I.annoteSchema` — round 1 explicitly did not open this
  (runtime schema identity; class schemas already double as decoded types).
- Schemastore `Schema.Defect()` without `includeStack: true` — runtime encoding,
  not JSDoc.
- Extra titled Examples on class members when the owning class already has one
  (`GlobPattern.compileResult`, `GlobSet.matches`, `MemoryFileSystem.layerFaulty`,
  `Range.parseResult`, `SemVer.parseResult`, `VersionCache` error constructors).
- Glob public `GlobPattern` / `GlobSet` sibling choice — Gotchas already use
  inline `{@link}` for bang semantics.
- Glob cap constants (`MAX_PATTERN_LENGTH`, `EXPANSION_MAX`,
  `MAX_GLOBSTAR_RECURSION`, `MAX_EXTGLOB_RECURSION`, `MAX_NESTING_DEPTH`) whose
  Examples show the public compile/match contract at that numeric bound rather
  than naming the const. Round-2 already rejected this.
- Schemastore `internal/limits.ts` `MAX_NESTING_DEPTH` Example that observes the
  numeric `256` cap via sibling error constructors rather than importing the
  const — same class as the glob cap-constant reject.
- Memfs `internal.make` / `internal.layer` Examples that go through
  `MemoryFileSystem.make` / `.layer` — those are the same bindings.
- Glob/semver/memfs-internal two-level relative imports
  (`../../<kit>/internal/…`) vs toml's three-level extract-dir path. Round-1
  residual risk; glob/memfs internals are `@internal` (docgen `Parser.shouldIgnore`);
  round-2 treated the two-level convention as holding. No new compilation evidence.
- StoreDocument `restoreDefsRefs` `__proto__` own-property comment. Unlike the
  jsonc parser, this walk is defense-in-depth on generated Draft-07 output that
  core already strips; not a caller-facing Gotcha.
- Taste-only category debates (`SemVerBump` constructors, `AnnotationCarriers`
  combinators, `DocumentDiff` utilities, `MemoryFileSystem` adapters).
- Re-export graph edges (`glob/index.ts`, `minimatch.ts` `GLOBSTAR`, kit barrels).

## Pack verdict

- files reviewed: 40 (glob 13, semver 10, schemastore 14, memfs 3)
- owning exports reviewed: 133 slice-owning (glob 34, semver 34, schemastore 47,
  memfs 18), including glob internal owning declarations
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 12 (grouped above)
- accepted findings: 0

Every exporting module and every owning export in the four packs was reviewed.
Round-2 glob/schemastore/memfs items are closed on the live source. Semver
remains clean: module headers, kind-split Examples, described `@see`, Gotchas
for trim vs `isValid`, dual `(version, range)`, caret 0.x, empty-range
match-all, and internal relative-import Examples that invoke the named symbol.

accepted findings: 0.
