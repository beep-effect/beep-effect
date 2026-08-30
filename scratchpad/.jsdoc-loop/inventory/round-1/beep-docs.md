# Pack beep-docs (round 1)

Read-only JSDoc review of every exporting module and owning export under
`scratchpad/beep-docs/`. Binding law: `.patterns/jsdoc-documentation.md`,
`.agents/skills/jsdoc-annotation-specialist/references/conventions.md`,
`.agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md`.

Census input claimed 9 modules, 95 owning exports, 0 open modules, and 1 open
owning (`CodeSnippetLanguageFromExtension` namespace missing `@example`).

## Files reviewed

| File | Owning | Module header | Notes |
| --- | ---: | --- | --- |
| `beep-docs/api-reference/ApiReference.ts` | 18 | lead, `@packageDocumentation`, `@since 0.0.0` | `moduleView` / `codeExamples` editorial |
| `beep-docs/api-reference/ApiReferenceDataset.ts` | 12 | same | two vacuous Examples |
| `beep-docs/api-reference/CodeSnippet.ts` | 11 | same | census FP + two editorial |
| `beep-docs/api-reference/DatasetPath.ts` | 2 | same | `resolveWithinDataset` actually observes a run |
| `beep-docs/api-reference/Reflection.ts` | 8 | same | two vacuous Examples |
| `beep-docs/api-reference/index.ts` | 0 | none (barrel) | re-export graph edges; not documented as new symbols |
| `beep-docs/domain/ApiReference.ts` | 26 | same | schemas, codecs, Gotcha on slug encode; no accepted findings |
| `beep-docs/domain/ApiReferenceSnapshot.ts` | 7 | same | no accepted findings |
| `beep-docs/domain/SearchMetadata.ts` | 11 | same | union Examples apply `.guards` to a decoded record (the quality bar the loader unions miss) |

Pack-wide conventions left standing (not taste churn):

- Same-name type companions and Encoded namespaces use `@category models` with a
  `{@link}` in the lead rather than `@category type-level` plus `@see`.
- Non-class schemas carry `$I.annoteSchema` and a same-name type alias; classes
  carry `$I.annote`.
- No `@example` / `@remarks` / `@module` / `@template` JSDoc carriers. The only
  `@example` string in source is TypeDoc tag matching inside `codeExamples`.
- No named `Schema` / `Option` / `Array` / `Predicate` / `Record` imports in
  Examples; no `@effected/*`.

## Rejected census findings

Census `beep-docs/api-reference/CodeSnippet.ts:72`
`CodeSnippetLanguageFromExtension` (`kind: value`, `exportKind: namespace`,
`missing=@example`) is a **false positive**.

The declaration is an Encoded companion:

```ts
export declare namespace CodeSnippetLanguageFromExtension {
  export type Encoded = typeof CodeSnippetLanguageFromExtension.Encoded;
}
```

Kind-split law: pure type-level exports (namespaces, `.Encoded` companions,
same-name schema type aliases) need precise prose, not an Example. The block
already has a useful lead (“Encoded (extension) side”), `@category`, and
`@since 0.0.0`. Census `isTypeOnly` only treats a namespace as type-level when
`node.body === undefined`, so a `declare namespace` with a type-only body is
miskinded as `value` and then required to have `@example`.

Do not add an Example to satisfy that miss.

---

## Findings

### beep-docs-R1-001: `loadApiReferenceDataset` Example only logs `typeof program`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: beep-docs/api-reference/ApiReferenceDataset.ts:528
- `symbol`: loadApiReferenceDataset
- `kind`: value
- `evidence`: Titled **Example** (Load a dataset with Bun services) constructs `program` then ends with `console.log(typeof program)`. Runtime `typeof` of an Effect is always `"object"`; the example never loads, never inspects entries, and never shows a failure. Same file’s `DatasetPath.resolveWithinDataset` Example actually `Effect.runPromise(program).then(console.log)`. Law: a titled Example must show the symbol doing its job with an observable result; `import { fn }; console.log(fn)` placeholders are defects. `typeof program` is that class of compile trick.
- `impact`: Callers copying the hover Example never see dataset shape, empty-missing-directory behavior (already in Details), or the error union.
- `suggestedFix`: Keep the Bun `provide`, then observe a load result the way `resolveWithinDataset` does (`Effect.runPromise(program).then(...)` logging `entries.length` / ids) or `Effect.match` a constructed failure. Do not keep `typeof program`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: beep-docs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### beep-docs-R1-002: `LoadApiReferenceDatasetError` Example only logs `typeof` a guard

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: beep-docs/api-reference/ApiReferenceDataset.ts:296
- `symbol`: LoadApiReferenceDatasetError
- `kind`: value
- `evidence`: Title is **Example** (Guard a failure) but the body is `console.log(typeof LoadApiReferenceDatasetError.guards.PathEscapesDataset)`. No failure is constructed, no guard is applied. Contrast `beep-docs/domain/SearchMetadata.ts` `SearchMetadata` / `StagedSearchMetadata`, which decode a record and log `*.guards.*(record)`.
- `impact`: Hover docs do not teach how to discriminate loader failures, which is the only reason the tagged union exists.
- `suggestedFix`: Construct one member (for example `DatasetReadFailed.make(...)`) and log `LoadApiReferenceDatasetError.guards.DatasetReadFailed(error)` / a negative sibling guard, matching the SearchMetadata Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: beep-docs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### beep-docs-R1-003: `loadReflection` Example only logs `typeof program`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: beep-docs/api-reference/Reflection.ts:185
- `symbol`: loadReflection
- `kind`: value
- `evidence`: Title **Example** (Load a reflection with Bun services) builds a realistic `ApiReferenceEntry` and `program`, then `console.log(typeof program)`. Same vacuous-observation defect as R1-001. Details about single-read digest coverage never appear in the Example.
- `impact`: The expensive part of the Example (entry construction) is wasted; callers never see a reflection name, digest mismatch, or Path escape.
- `suggestedFix`: Observe the provided Effect (`runPromise` of `reflection.name`, or `Effect.match` on a missing file / digest mismatch). Drop `typeof program`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: beep-docs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### beep-docs-R1-004: `LoadReflectionError` Example never branches

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: beep-docs/api-reference/Reflection.ts:141
- `symbol`: LoadReflectionError
- `kind`: value
- `evidence`: Title **Example** (Branch on the failure) builds `LoadReflectionError.match({...})` then `console.log(typeof describe)`. The matcher is never applied. `typeof describe` is `"function"`.
- `impact`: Callers do not see exhaustive `_tag` branching, which is the union’s job. The title claims a branch that never happens.
- `suggestedFix`: Construct one member (`ReflectionReadFailed.make({ path, cause })`) and `console.log(describe(error))` with the expected string in a trailing comment.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: beep-docs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### beep-docs-R1-005: `languageFromInfoString` lead hides the empty-string default

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: beep-docs/api-reference/CodeSnippet.ts:173
- `symbol`: languageFromInfoString
- `kind`: value
- `evidence`: Lead says it returns `None` “when it names no known language.” Sibling `CodeSnippetLanguageFromInfoString` Details already state “An empty info string defaults to `typescript`.” The helper is `S.decodeOption(CodeSnippetLanguageFromInfoString)`, so `languageFromInfoString("")` / `"   "` is `Some("typescript")`, not `None`. The Example shows `"mjs"` and `"cobol"` only. No `{@link}` / `@see` to the schema a caller must choose (Issue-bearing codec vs Option helper).
- `impact`: Callers treating empty fences as unknown will mishandle the default TypeScript language. The Option helper and the schema look like two APIs without a stated relationship.
- `suggestedFix`: Add a Details sentence that empty/whitespace info strings become `typescript` (not `None`). Extend the Example with `languageFromInfoString("")`. Add a described `@see {@link CodeSnippetLanguageFromInfoString}` for the throwing/Issue codec form.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: beep-docs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### beep-docs-R1-006: `CodeSnippetLanguageFromInfoString` encode is not invertible

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: beep-docs/api-reference/CodeSnippet.ts:132
- `symbol`: CodeSnippetLanguageFromInfoString
- `kind`: value
- `evidence`: Implementation encode is `SchemaGetter.passthrough({ strict: false })`. Decode maps `"ts"` / `" ts "` / `""` onto `"typescript"`; encode cannot restore the original info string. Same-pack `PackageSlugFromPackageName` already documents this class of codec Gotcha (“The scope is not recoverable, so encoding returns the slug unchanged”). This codec’s Details cover empty default and extension mapping but not encode.
- `impact`: Callers using encode as a round-trip from a fence info string will persist canonical language ids (`typescript`) instead of the source token (`ts`).
- `suggestedFix`: Add a **Gotchas** sentence that encode is passthrough of the canonical language and does not restore the original info string / extension, mirroring `PackageSlugFromPackageName`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: beep-docs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### beep-docs-R1-007: `moduleView` omits duplicate-anchor suffixing

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: beep-docs/api-reference/ApiReference.ts:501
- `symbol`: moduleView
- `kind`: value
- `evidence`: `uniqueAnchor` suffixes **every** colliding declaration with `-${kind}` (`map` function + `map` type become `map-function` and `map-type`; neither keeps `#map`). Lead only mentions grouping by `@category`. Example uses a unique name `sum` and only demonstrates the `category-other` default. No Gotcha / Details about fragment ids.
- `impact`: Callers writing in-page links as `#<name>` break as soon as a value and type share a name. That is the exact case `TypeKind` exists to describe.
- `suggestedFix`: Add a **Gotchas** (or Details) sentence: when two children normalize to the same `DeclarationAnchor`, all of them receive a kind suffix; the bare name is not kept. Optional: one colliding pair in the existing Example (`function` + `type` named `map`) logging both anchors.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: beep-docs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### beep-docs-R1-008: `codeExamples` silent drops and `@example` collection are undocumented

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: beep-docs/api-reference/ApiReference.ts:1035
- `symbol`: codeExamples
- `kind`: value
- `evidence`: Lead says it collects “every fenced code example” while walking signatures/params/accessors. Implementation also (1) accepts TypeDoc `@example` block tags as well as `**Example**` summary fences, and (2) drops a fence when `languageFromInfoString` is `None` (`parseFencedCode` → `O.flatMap(CodeSnippet.languageFromInfoString)`), with no error. The Example only shows a titled summary fence with `ts`.
- `impact`: Callers expecting unknown languages to surface as errors lose examples silently. Callers migrating off `@example` cannot tell from the docs that the collector still reads that carrier.
- `suggestedFix`: Add **Details** that both `**Example**` summary fences and TypeDoc `@example` tags are collected, and a **Gotchas** that an unknown info string omits the fence. Optionally `@see {@link languageFromInfoString}` for the accepted language set.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: beep-docs
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Pack verdict

- files reviewed: 9
- owning exports reviewed: 95
- confirmed mechanical items: 0
- editorial items: 8
- rejected false positives: 1
- accepted findings: 8

The census mechanical miss is rejected (type-level Encoded namespace). Accepted
findings are editorial: four vacuous `typeof` Examples on the dataset/reflection
loaders and their error unions, one misleading Option default on
`languageFromInfoString`, one missing encode Gotcha on
`CodeSnippetLanguageFromInfoString`, one missing duplicate-anchor Gotcha on
`moduleView`, and missing collector Details/Gotchas on `codeExamples`. Domain
schema modules (`domain/ApiReference.ts`, `ApiReferenceSnapshot.ts`,
`SearchMetadata.ts`) and `DatasetPath.ts` were reviewed and have no accepted
findings.
