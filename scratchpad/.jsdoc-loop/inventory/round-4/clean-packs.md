# Round 4 JSDoc inventory — clean packs

Independent editorial re-review of packs that closed at `accepted findings: 0`
in round 3: glob, semver, schemastore, memfs, codemode, beep-docs, ontoskills,
metadata, microdata.

Mechanical census is already `openModuleCount: 0` / `openOwningExportCount: 0`.
Zero `@example` / `@remarks` / `@module` / `@template` JSDoc carriers. The only
`@example` token is TypeDoc tag matching inside `beep-docs` `codeExamples`.

This pass hunts **caller-confusion residuals only**: hover/docs that teach the
wrong contract (title vs fence, fence vs implementation, unlifted implementation
Gotchas, Examples that never invoke the symbol, `// =>` that cannot be true).
Taste, extra Examples, category churn, and closed mechanical misses are not
reopened.

No source was edited.

Binding law: `.patterns/jsdoc-documentation.md`.

Slice owning counts from `scratchpad/.jsdoc-loop/packs.json` /
pack READMEs: glob 34, semver 34, schemastore 47, memfs 18, codemode 353,
beep-docs 95, remainder (ontoskills + metadata + microdata) 334.

---

## Hunt results

| Class | Result |
| --- | --- |
| Legacy `@example` / `@remarks` / `@module` / `@template` | **Clean.** |
| Bare `@see` / `@returns -` / `{type}` in tags | **Clean.** |
| Named `Schema`/`Option`/`Array` imports, `@effected/*` Example imports, `@effect/schema` | **Clean.** |
| Vacuous `void` discards / `import { fn }; console.log(fn)` | **Clean** as a class. Remaining `console.log` observes a decode, guard, construct, match, or Effect result. |
| Empty `$I` `description: ""` | **Clean** in these packs (the only empty description in `scratchpad/` is `exec.ts`, out of scope). |
| Non-canonical `@category` topology slugs | **Clean.** |
| Title/fence contradictions (`Reject`/`Trip`/`Fail` that succeed, `Overflow` that never overflows, `Combine` that is identity) | **Clean.** Spot-checked every such title in these packs. |
| Round-2 glob internals proxying the public facade | **Closed.** Internals relatively-import the owning module and call the named symbol. |
| Round-2 `expand` Bash 4.3 leading-`{}` | **Closed.** Gotchas + fence log `{},a}b` vs `a{},b}c`. |
| Round-2 schemastore `console.log(Effect.runPromise(...))` | **Closed.** Observed via `.then((result) => console.log(...))` with truthful `// =>` payloads. |
| Round-2 memfs `makeInspectable` | **Closed.** Imports `../../memfs/internal/volume.ts`, destructures `{ fileSystem, entries }`, logs decoded `/out.txt` bytes. |
| Round-2 beep-docs LiteralKit Enum logs | **Closed.** `CodeSnippetLanguage` / `DeclarationKind` / `SearchContentSource` `S.is` a member and a reject token. |
| Round-2 OfficeParser nested `T["k"] = literal` placeholders | **Closed.** Parent Examples construct realistic objects. Nested primitive fences are gone. |
| Unlifted implementation-comment Gotchas | **Clean** on the surfaces that previously had them (glob leading-`{}`, memfs unenforced modes / per-build layer memoization, semver trim vs `isValid` / dual `(version, range)` / caret 0.x / empty-range match-all, microdata unbounded lexemes, schemastore `$schema` trailing `#` / `compare: "bytes"`). |

---

## Round-2 / round-3 closures re-checked on live source

| ID | Live check |
| --- | --- |
| glob-R2-001 | `balanced`/`range` offsets, `expand` + budget trip, `parseClass` tuples, shared `escape`/`unescape` options, `assertValidPattern` TypeError vs `GuardExceeded`, `isGuardExceeded`, `assertCap`, `braceExpand` + `nobrace`, `new Minimatch`, `GLOBSTAR` vs `Minimatch.set`. |
| glob-R2-002 | `expand` Gotchas include the Bash 4.3 top-level leading-`{}` rule; the Example logs `{},a}b` vs `a{},b}c`. |
| schemastore-R2-001 | `SchemaFile` / `SchemaPipeline` / `SchemaValidator` observe the resolved value via `.then(...)` with truthful `// =>` payloads. |
| memfs-R2-001 | `makeInspectable` imports the owning module and reads a sliced snapshot of `/out.txt`. |
| beep-docs-R2-001 | `S.is(...)(Enum.member) // true` and a reject token `// false`. |
| remainder-R2-001 | Nested placeholder fences deleted; `OfficeParserAST` builds a `docx` fragment and observes `type` / `content[0]?.text`. |

---

## Rejected / not opened

Do not reopen these; they were independently re-checked and still fail the
caller-confusion bar:

- Runtime `@effected/*` Context service ids (`VersionCache`, `SchemaFile`,
  `SchemaValidator`, `MemoryFileSystem.Volume`) and kit-name mentions in prose
  (`assertCap` TypeError text included).
- Glob / schemastore cap-constant Examples that observe the public compile /
  sibling-error contract at that numeric bound rather than importing the const
  (`MAX_PATTERN_LENGTH`, `EXPANSION_MAX`, `MAX_GLOBSTAR_RECURSION`,
  `MAX_EXTGLOB_RECURSION`, `MAX_NESTING_DEPTH`). Titles do not claim overflow.
- Memfs `internal.make` / `internal.layer` Examples that go through
  `MemoryFileSystem.make` / `.layer` — those are the same bindings.
- Extra titled Examples on class members when the owning class already has one.
  Docgen-era member fences that proxy through `CodeMode.make` + `runtime.execute`
  with a guest program that actually hits that path (`evaluateIfStatement` /
  `readMember` optional-chain / `requireIteratorObject`) are not
  glob-R2-001 residuals.
- `UriFunctionName` / `DiagnosticKind` / `GeneratorRequestKind` Enum reads under
  **Select** / **Match** titles. Not `console.log(fn)` of the schema; sibling
  kits in the same file also use `.is`.
- `HttpMethod` logging `To.Enum.POST` after `decodeOption("post")`. The fence
  already runs the codec.
- `TypeKind` / `BareTsPropertyName` / `mathConstants` logging several `S.is`
  results without `// true`/`// false` comments. Observable; stronger assertions
  are cleanup-on-touch.
- KeywordFamilies Gotcha (`x-taplofoo` admitted, `x-tombifoo` rejected) not
  duplicated in the Example. The fence is truthful (`x-taplo` /
  `markdownDescription` / `x-custom`). Extra Example forbidden.
- `unsupportedSyntax` titled **Reject a class declaration** constructs the error
  factory — that is the symbol's job; it is not a parser-entry Example miss.
- `FromSpecResult` empty-`paths` fence that logs `skipped: []`. The skip-reason
  contract lives on `fromSpec` Gotchas; this is not a combine-is-identity defect.
- Semver `$I.annote` / `$I.annoteSchema` (runtime schema identity; class schemas
  already double as decoded types).
- Schemastore `Schema.Defect()` without `includeStack: true` — runtime encoding.
- StoreDocument `restoreDefsRefs` `__proto__` own-property comment: defense-in-depth
  on generated Draft-07 output that core already strips; not a caller-facing Gotcha.
- Barrel headers on `codemode/interpreter/index.ts` and
  `beep-docs/api-reference/index.ts` (`owning=0`).
- Census namespace Example false positives (`CodeSnippetLanguageFromExtension`,
  OntoSkills `ProcedureStep` / `BulletItem` / `ContentBlock` / `Section` /
  `SkeletonNode`). Type-level; Example optional.
- `./File.ts` / `./Metadata.models.ts` Example imports vs three-level extract-dir
  paths. Known extraction-path cleanup, not new residual doctrine.
- OfficeParser nested `styleMap` / `metadataOverrides` / `embeddingFunction` /
  `sentenceBoundaryRegex` / `abbreviations` fences (mammoth selectors, CJK
  boundaries, callable embedding stub).
- Taste-only category debates (`models` vs `type-level` on same-name aliases;
  OntoSkills LiteralKits at `@category models`; microdata `@category schemas`;
  `SemVerBump` constructors; `AnnotationCarriers` combinators; `DocumentDiff`
  utilities; `MemoryFileSystem` adapters).
- Private `Interpreter` methods lacking `@category`. Docgen required
  description / Example / `@since`; those are present. Members are not owning
  exports.
- Re-export graph edges (`glob/index.ts`, `minimatch.ts` `GLOBSTAR`, kit barrels).

---

## Pack verdict: glob

- files reviewed: 13
- owning exports reviewed: 34 (including `internal/**`)
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 3 (cap-constant facade Examples; member extras;
  `@effected/glob` kit-name in `assertCap`)
- accepted findings: 0

Public `GlobPattern` / `GlobSet` bang semantics, noglobstar rewrite, escape
default asymmetry, and compile-vs-match guard policy stay consistent across
lead, Gotchas, and fences.

## Pack verdict: semver

- files reviewed: 10
- owning exports reviewed: 34
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 1 (`$I` identity on class schemas)
- accepted findings: 0

Dual `(version, range)`, caret 0.x, empty-range match-all, trim vs `isValid`,
and internal relative-import Examples that invoke the named symbol remain
compliant.

## Pack verdict: schemastore

- files reviewed: 14
- owning exports reviewed: 47
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 3 (`MAX_NESTING_DEPTH` via sibling constructors;
  `Schema.Defect` encoding; `__proto__` restore walk)
- accepted findings: 0

IO/validation fences observe resolved values. `CanonicalJson` refuses
`undefined`. `DocumentDiff.isClean("created")` is false. `KeywordFamilies`
admits declared families and rejects `x-custom`.

## Pack verdict: memfs

- files reviewed: 3
- owning exports reviewed: 18
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 1 (`internal.make` / `internal.layer` via public
  bindings)
- accepted findings: 0

Per-build layer memoization, unenforced permission modes, and
`failTimes` suite-boundary Gotchas are in JSDoc. `makeInspectable` still
calls the owning symbol.

## Pack verdict: codemode

- files reviewed: 34
- owning exports reviewed: 353
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 5 (Select-titled Enum reads; `HttpMethod` Enum
  after decode; stdlib/internal named-symbol fences already in place; empty
  `fromSpec` skipped list; barrel header)
- accepted findings: 0

Value-level owning exports have titled, single-fence, observable Examples.
`fromSpec` still documents skipped operations vs `InvalidOpenApiOptions`.
`Promise.race([])` fence observes the never-settle message. Interpreter
private-method fences that go through `CodeMode.make` execute a guest program
that hits that path.

## Pack verdict: beep-docs

- files reviewed: 9
- owning exports reviewed: 95
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 3 (barrel header; namespace Example; missing
  `// true`/`// false` comments on multi-`S.is` logs)
- accepted findings: 0

Round-2 LiteralKit Enum-log finding stays closed. `languageFromInfoString`
covers known / empty / unknown. `codeExamples` collects a realistic summary
fence.

## Pack verdict: ontoskills / metadata / microdata

- files reviewed: 5
- owning exports reviewed: 334
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 4 (5 OntoSkills namespace Examples; OfficeParser
  leave-standing nested fences; `./` Example imports; category churn)
- accepted findings: 0

Round-2 OfficeParser placeholder finding stays closed. Microdata module
Gotchas still warn that unbounded lexemes need a transport budget. Choice
clusters keep described `@see`. `DurationFromSeconds` round-trips seconds.
`IsUserInvocable` decodes `"yes"` / `"no"`. Registry empty-class shells still
`make({})` with Gotchas against invented fields.

---

## Combined verdict

- files reviewed: 88
- owning exports reviewed: 915
- confirmed mechanical items: 0
- editorial items: 0
- rejected false positives: 20 (grouped above)
- accepted findings: 0

Every exporting module and every owning export in these packs was reviewed.
Round-2 / round-3 accepted findings remain closed on the live source. No new
caller-confusion residual met the doctrine bar.

accepted findings: 0.
