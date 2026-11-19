# P1 map: moving the RFC 3987 IRI schemas into `@beep/identity` (2026-11-19)

Phase P1 ("L0 identity: declared terms, one digest"), decision
`decisions/2026-11-19-p0-l0-homes-iri-in-identity-canonical-json-stays-in-jsonc.md`
item (1): the RFC 3987 schemas move from `@beep/rdf` to `@beep/identity`, their
`@beep/utils` calls are rewritten to `effect/Array` and `effect/String`, `@beep/rdf`
imports them from identity and keeps `canonicalizeSchemaOrgIri`, and every importer is
migrated in the P1 PR with no re-export left behind.

Base: worktree head `3dbdd1e46ba` (branch `goals/text-knowledge-stack-rebuild-p0-design`),
installed `effect@4.1.4` (`node_modules/effect/package.json`). Every count below was
measured at that head. File lists come from `git ls-files` (`.repos/` excluded).

## 1. Summary

- The file holds 4 exported schemas, their 4 exported types, 1 exported helper
  (`canonicalizeSchemaOrgIri`) and 73 private top-level declarations, `$I` included. Everything except the
  schema.org block (`Iri.ts:708-755`) moves.
- The moved code makes 34 `@beep/utils` calls. 33 of them keep their call form under
  `effect/Array` and `effect/String`. One call does not: `Str.startsWith(identifier, "Relative")`
  (`Iri.ts:783`) is data-first, and `effect/String.startsWith` has no data-first form.
- Importers of the moved symbols:
  - packages, apps and goals ops: 19 files (16 package files, 3 design-module files);
  - inside `@beep/rdf`: 6 `src` files, 2 tests and the root barrel;
  - scratchpad: 56 files.
  - No app imports them, and nothing imports `rdf/src/Iri.ts` through a relative path
    from outside the package.
- No `package.json` export map changes. Both packages export `"./*": "./src/*.ts"`.
  One package dependency drops: `@beep/documents-domain` stops importing `@beep/rdf`
  altogether. That removes one dependency, three tsconfig references, the
  `bun.lock` entry, the cache-baseline edges and one fallow-boundary allow entry.
- The moved schemas take `$IdentityId` from `./packages.ts`, following
  `Curie.ts:18` and `IdentityRegistry.ts:14`. This creates no self-cycle. It does
  change 18 path-derived code identities, from `@beep/rdf/iri/...` to
  `@beep/identity/Iri/...`. No tracked file pins any of them; section 4 gives the
  ruling this needs.
- Recommended file shape: move `canonicalizeSchemaOrgIri` into
  `rdf/src/Vocab/SchemaOrg.ts`, then `git mv rdf/src/Iri.ts identity/src/Iri.ts`.
  The coverage-baseline, fallow-health and `.fallowrc.jsonc` entries then move by
  rename, as the SPEC's S31 definition requires
  (`SPEC.md:260-264`: "moved packages carrying entries by rename only"). No inventory
  grows (section 9). If `rdf/src/Iri.ts` kept only the schema.org helper, the coverage
  baseline would gain one row.

## 2. Symbol inventory of `packages/foundation/modeling/rdf/src/Iri.ts` (1,018 lines)

| Lines | Symbols | Disposition |
| --- | --- | --- |
| `:1-15` | module doc, imports, `const $I = $RdfId.create("iri")` | rewritten in identity: imports become effect leaves plus `./packages.ts` (section 4) |
| `:17-31` | "RFC 3987 coverage notes" block comment | moves. 8 of its 15 lines are bare ` *` with the sentence text missing (`:21-30`); restore or cut it in the move |
| `:33-34` | `type ParseEnd`, `type CodePointPredicate` | move |
| `:36-42` | `COLON`, `DOT`, `FORWARD_SLASH`, `HASH`, `PERCENT`, `QUESTION_MARK`, `AT` | move |
| `:44-78` | `forbiddenBidiFormattingCodePoints`, `ucscharRanges`, `iprivateRanges` | move |
| `:80` | `slice` | moves. The schema.org block also uses it (`:708,753`), so `rdf` keeps its own copy or inlines `Str.slice` |
| `:82-195` | `codePointAt`, `findAsciiCharacter`, `findAsciiCharacterFromEnd`, `countAsciiCharacter`, `findDoubleColon`, `isCodePointInRanges`, `isAlpha`, `isDigit`, `isHexDigit`, `isAsciiUnreserved`, `isSubDelim`, `isForbiddenBidiFormattingCodePoint`, `isUcschar`, `isIprivate`, `isIunreserved`, `isPctEncodedAt` | move |
| `:197-256` | `scanComponent` (fallow ceiling at `.fallowrc.jsonc:594`; three `istanbul` comments naming "Owner: @beep/rdf" at `:210,243,248`), `scanEntireComponent` | move; change the comment owner to `@beep/identity` |
| `:258-426` | `isValidPort`, `isValidH16`, `isValidIPv4Octet`, `isValidIPv4Address`, `parseIpv6Side`, `isValidIPv6Address`, `isValidIPvFuture`, `isValidIpLiteral`, `isValidIRegName`, `isValidIUserInfo`, `isValidHostPort` | move |
| `:428-706` | `parseAuthority`, `parseIsegment`, `parseIPathAbempty`, `parseIPathAbsolute`, `parseIPathRootless`, `parseIPathNoScheme`, `parseIQuery`, `parseIFragment`, `parseOptionalComponent`, `parseIHierPart`, `parseIRelativePart`, `parseScheme`, `parseAbsoluteIriEnd`, `parseIriEnd`, `parseRelativeIriReferenceEnd`, `isAbsoluteIri`, `isIri`, `isRelativeIriReference`, `isIriReference` | move |
| `:708-719` | `SCHEMA_ORG_CANONICAL_ORIGIN`, `nonCanonicalSchemaOrgOrigins`, `schemaOrgOriginDelimiters`, `startsWithinOrigin` | **stay in rdf** (private helpers of the next row) |
| `:721-755` | `export canonicalizeSchemaOrgIri` | **stays in rdf**. It has no consumer outside `rdf/test/IRI.test.ts:113-123`. `rdf/src/Vocab/SchemaOrg.ts:10` already names it, and that file already imports `SCHEMA_ORG_NAMESPACE` (`:18`) |
| `:757-855` | `makeTrimmedSyntaxChecks`, `makeReferenceChecks`, `makeNonEmptyReferenceChecks`, `iriReferenceChecks`, `relativeIriReferenceChecks`, `absoluteIriChecks`, `iriChecks` | move |
| `:857-896` | `export const IRIReference`, `export type IRIReference` | move |
| `:898-936` | `export const RelativeIRIReference`, `export type RelativeIRIReference` | move |
| `:938-977` | `export const AbsoluteIRI`, `export type AbsoluteIRI` | move |
| `:979-1018` | `export const IRI`, `export type IRI` | move |

None of the four moved names exists in `identity`, `schema` or `utils` `src` today
(`rg '^export (const|type|...) (IRI|IRIReference|RelativeIRIReference|AbsoluteIRI)\b'`
is empty), so adding them to the identity root barrel collides with nothing.

## 3. `@beep/utils` calls to rewrite

`Iri.ts:8` imports `{ A, Str } from "@beep/utils"`. `@beep/utils/Array` is
`export * from "effect/Array"` (`utils/src/Array.ts:616`). `@beep/utils/Str` is
`export * from "effect/String"` (`utils/src/Str.ts:847`) plus local overrides, and one
of those overrides is `startsWith` (`Str.ts:577-590`, a dual narrowing predicate). Of
the call sites, only `startsWith` resolves to repo code; every other call is already
the effect function. In the moved file, replace the import line with
`import * as A from "effect/Array"` and `import * as Str from "effect/String"`. The
identity package already uses these aliases (`identity/src/Id.ts:31,39`,
`PnLocal.ts:8,14`).

| Call (moved lines) | Count | `effect@4.1.4` signature (validated) | Replacement |
| --- | --- | --- | --- |
| `Str.length(s)` `:88,100,117,131,207,255,261,271,355,361,431,472,488,497,520,542,602,620,636,700,702,704` | 22 | `String.ts:482` `length = (self: string): number` | unchanged |
| `Str.isEmpty(s)` `:291,300,343,406` | 4 | `String.ts:447` `isEmpty = (self: string): self is ""` | unchanged |
| `pipe(s, Str.split(sep))` `:281,295` | 2 | `String.ts:501` dual; data-last `(separator: string \| RegExp) => (self: string) => NonEmptyArray<string>` | unchanged (`.length` and `for…of` work on `NonEmptyArray`) |
| `pipe(s, Str.slice(start, end))` `:80` | 1 | `String.ts:429` `slice = (start?, end?) => (self: string): string` | unchanged |
| `pipe(s, Str.codePointAt(i), O.getOrUndefined)` `:83` | 1 | `String.ts:801` dual; data-last `(index: number) => (self: string) => Option<number>` | unchanged |
| `Str.startsWith(identifier, "Relative")` `:783` | 1 | `String.ts:579` `startsWith = (searchString: string, position?: number) => (self: string): boolean`; **no data-first form** | `pipe(identifier, Str.startsWith("Relative"))`. Kept as is, it fails to type-check, because `"Relative"` is not a `number` |
| `pipe(xs, A.some(pred))` `:145,180` | 2 | `Array.ts:9233` dual; data-last `(predicate) => (self) => self is NonEmptyReadonlyArray<A>` | unchanged |
| `pipe(xs, A.every(pred))` `:287` | 1 | `Array.ts:9106` dual; data-last `(predicate) => (self) => boolean` | unchanged |

That makes 34 call sites in the moved code. The other imports are already effect
leaves: `pipe`, `effect/Number` (`N.parse`, `Number.ts:1400`), `effect/Option`
(`getOrUndefined` `:1279`, `exists` `:4101`) and `effect/Schema`
(`check` `:5243`, `brand` `:5359`, `makeFilter` `:6804`, `makeFilterGroup` `:6866`,
`isTrimmed` `:6893`, `isNonEmpty` `:8589`). Nothing native needs replacing: the file
uses no `Set` or `Map`.

These calls stay in rdf, in the schema.org block, where `@beep/utils` remains a
dependency: `Str.length` `:708,753`, `slice` `:708,753`, `A.some` with
`Str.startsWith` (data-last) `:718` and `A.findFirst` `:750`.

## 4. Identity package constraints and the `$I` annotation

**Dependencies today** (`identity/package.json`):
- `dependencies`: `effect` only.
- `devDependencies`: `@beep/fc-runs`, `@beep/test-runner`, `@beep/types`,
  `@effect/vitest`, `@types/node` and `type-fest`.
- tsconfig references: `primitive/types`, `test-kit/fc-runs` and `test-kit/test-runner`
  (`identity/tsconfig.json`, `tsconfig.check.json` and `tsconfig.test.json`).

The moved code imports only `effect` leaves and one relative module, so none of these
change. Do not add `@beep/utils` even as a dev dependency: `utils` depends on
`identity`, and that would close a workspace cycle. The same rule binds the moved tests
(section 7).

**Exports.** `identity/package.json` maps `"./*": "./src/*.ts"`, and its publishConfig
maps `"./*": "./dist/*.js"`. So `@beep/identity/Iri` resolves as soon as the file
exists. The root `tsconfig.json:53` alias `@beep/identity/*` already covers it. Add
`export * from "./Iri.ts"` to `identity/src/index.ts` through `beep-cli codegen barrel`
(the package `codegen` script). `test/shape-stable.test.ts:345` checks that a list of
names is present, not that it is exhaustive, so the new barrel names do not break it.

**Annotation.** Use `const $I = $IdentityId.create("Iri")`, with `$IdentityId`
imported from `"./packages.ts"`. That is the pattern of `Curie.ts:18,22` and
`IdentityRegistry.ts:14,18`. Never import it through the `@beep/identity/packages`
specifier, which is a self-package import.

- Runtime graph: `Iri.ts → packages.ts → Id.ts`.
- `Id.ts` imports `Vocab.ts` as a type only (`Id.ts:44`).
- `Vocab.ts`, `Curie.ts`, `IdentityRegistry.ts` and the new L0 term modules may import
  `./Iri.ts` (for `TermIri`, `Namespace.iri`), with no runtime cycle.
- The binding rule: **`Id.ts` and `packages.ts` must never import `Iri.ts`.**
- The identity-registry lint's local-root scan skips identity itself
  (`cli/src/commands/Lint/IdentityRegistry.ts:333`). The `make("identity")` form in
  `Vocab.ts:13` would also pass that lint, but the packages composer is the one
  canonical composer.

**Identity delta, which needs a recorded ruling.** The file mints 18 identities:
- 4 `annoteSchema` calls;
- 14 check annotations: `TrimmedCheck`, `SyntaxCheck` and `Checks` for each of
  `IRIReference` and `RelativeIRIReference`, plus `NonEmptyCheck` for `AbsoluteIRI`
  and `IRI`.

All 18 become `@beep/identity/Iri/<Name>[/<Check>]` (IRI
`https://beep-effect.com/ns/identity/Iri/...`) instead of `@beep/rdf/iri/...`. Nothing
tracked pins the old values: `git grep -F '@beep/rdf/iri'`,
`git grep -F 'beep:rdf/iri'` and `git grep -F 'ns/rdf/iri'` are all empty. The
schema-catalog rows store only the short identity (`"identity":"IRI"`).

`TermIri` is `IRI.pipe(...)` (`ops/design/L0.identity.ts:152`), so this move has to
land before `TermBinding` and the `L0-3` snapshot exist. Two options:

1. **(Recommended) Re-home.** Use `$IdentityId.create("Iri")`. Record it as the first
   step of P1 in a decision file that cites the empty pin search. Record the `L0-3`
   snapshot's first base after the move, so the snapshot starts from the identity-owned
   set and needs no deprecation rows for these 18.
2. **Preserve.** Use `$RdfId.create("iri")`, imported from `./packages.ts:477`, which
   identity owns, so there is no cycle. All 18 values stay byte-identical, but
   identity-owned code then carries an `rdf` identity. This is the reversal path for
   option 1.

## 5. Importers of the moved symbols

Method: `scratchpad/.../importers.mjs` and `clauses.mjs` (run outside the repo). They
parse every `import`/`export … from "@beep/rdf"` and `"@beep/rdf/Iri"` clause, multi-line
included, in tracked TS files. To reproduce the file set, run:

```sh
rg -U -l -P "import\s+(type\s+)?\{[^}]*\b(IRI|IRIReference|RelativeIRIReference|AbsoluteIRI)\b[^}]*\}\s*from\s*[\"']@beep/rdf(/Iri)?[\"']" \
  packages apps scratchpad goals -g '*.ts' -g '*.tsx'
```

At this head it lists 78 files: goals 3, documents/domain 2, foundation/modeling 16
(ontology 13 + rdf 3), ontology/client 1 and scratchpad 56. "Usage lines" are lines
outside imports, comments and string contents that name a moved symbol as a code
token.

The census row (`research/consumer-census.md:275`: 273 lines / 16 files) counts the same
16 package files with a different line rule, which includes the import lines.

### 5a. Packages and goals ops (19 files; 22 code import lines, 11 JSDoc example lines)

| File | Import (line) | Specifier | Moved names | Other rdf names on the same file | Usage lines |
| --- | --- | --- | --- | --- | --- |
| `packages/documents/domain/src/values/Taxonomy/Taxonomy.model.ts` | `:9` | `@beep/rdf` | `IRIReference` | none | 4 |
| `packages/documents/domain/src/values/Taxonomy/Taxonomy.seed.ts` | `:9` | `@beep/rdf` | `IRIReference` | none | 28 |
| `packages/foundation/modeling/ontology/src/Classification.models.ts` | `:7` | `@beep/rdf` | `IRIReference` | none | 10 |
| `packages/foundation/modeling/ontology/src/ClassificationRegistry.ts` | `:7` | `@beep/rdf` | `IRIReference` | none | 1 |
| `packages/foundation/modeling/ontology/src/Fold.assembly.ts` | `:16` | `@beep/rdf/Iri` | `IRI` | `LanguageTag` from `@beep/rdf/Rdf` | 21 |
| `packages/foundation/modeling/ontology/src/Fold.models.ts` | `:17` | `@beep/rdf/Iri` | `IRI` | `LanguageTag` from `@beep/rdf/Rdf` | 13 |
| `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts` | `:9`; JSDoc `:178,211,284` (`@beep/rdf/Iri`) | `@beep/rdf` | `IRIReference` | none | 6 |
| `packages/foundation/modeling/ontology/src/SemanticFoundation.seed.ts` | `:9` | `@beep/rdf` | `IRIReference` | none | 1 |
| `packages/foundation/modeling/ontology/src/TaxonomyLoader.ts` | `:9`; JSDoc `:203,268,478,516` (`@beep/rdf/Iri`) | `@beep/rdf` | `IRIReference` | none | 11 |
| `packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts` | `:9`; JSDoc `:28,103,127,159` (`@beep/rdf/Iri`) | `@beep/rdf` | `IRIReference` | none | 6 |
| `packages/foundation/modeling/ontology/src/Vocabulary.models.ts` | `:7` | `@beep/rdf` | `IRIReference` | none | 4 |
| `packages/foundation/modeling/ontology/src/Vocabulary.seed.ts` | `:7` | `@beep/rdf` | `IRIReference` | none | 114 |
| `packages/foundation/modeling/ontology/test/Fold.test.ts` | `:6` | `@beep/rdf/Iri` | `IRI` | none | 1 |
| `packages/foundation/modeling/ontology/test/SemanticFoundation.test.ts` | `:28` | `@beep/rdf` | `IRIReference` | none | 15 |
| `packages/foundation/modeling/ontology/test/TaggedError.equivalence.test.ts` | `:14` | `@beep/rdf` | `IRIReference` | none | 8 |
| `packages/ontology/client/src/aggregates/Session/Session.atoms.ts` | `:49` | `@beep/rdf/Iri` | `IRI` | `makeLiteral`, `makeNamedNode`, `makeQuad`, `serializeQuad` (`@beep/rdf/Rdf`), `XSD_STRING` (`@beep/rdf/Vocab/Xsd`) | 1 |
| `goals/text-knowledge-stack-rebuild/ops/design/L0.identity.ts` | `:19` | `@beep/rdf/Iri` | `IRI` | none | 3 |
| `goals/text-knowledge-stack-rebuild/ops/design/L1.text.ts` | `:15` | `@beep/rdf/Iri` | `IRI` | none | 1 |
| `goals/text-knowledge-stack-rebuild/ops/design/L6.interchange.ts` | `:14` | `@beep/rdf/Iri` | `IRI` | `@beep/rdf/Rdf` namespace import | 2 |

By specifier form:
- root `@beep/rdf`: 12 files (10 ontology or documents `src` files, 2 ontology tests);
- `@beep/rdf/Iri`: 7 files (ontology `Fold.assembly.ts`, `Fold.models.ts`,
  `test/Fold.test.ts`; ontology-client `Session.atoms.ts`; the 3 design files);
- JSDoc examples: 11 lines in 3 ontology files.

Total usage: 250 lines.

Each of the 19 import lines names only moved symbols, so the rewrite replaces the
specifier with `@beep/identity/Iri`. None of the 19 needs an import split. The other
rdf names in five of the files come from separate `@beep/rdf/Rdf` or
`@beep/rdf/Vocab/Xsd` lines that stay.

No file under `apps/` imports a moved symbol. No tracked file outside rdf reaches the
symbols through a namespace import: the one namespace import of root `@beep/rdf` that
the clause parser found outside rdf, `scratchpad/effect-ontology/test/Domain/Rdf/Types.test.ts:2`,
destructures only RDF terms (`:11`).

### 5b. Inside `@beep/rdf` (stay in rdf, re-pointed)

| File | Import | Moved names | Usage lines |
| --- | --- | --- | --- |
| `rdf/src/JsonLd.ts` | `:13` `./Iri.ts` | `AbsoluteIRI`, `IRI`, `IRIReference` | 6 |
| `rdf/src/ProvRdf.ts` | `:21` `./Iri.ts` | `IRI` | 1 |
| `rdf/src/Rdf.ts` | `:18` `./Iri.ts` | `IRI` | 4 |
| `rdf/src/Evidence.ts` | `:13` `./Iri.ts` | `IRIReference` | 3 |
| `rdf/src/Adapters/DocumentAnnotation.ts` | `:12` `../Iri.ts` | `IRIReference` | 4 |
| `rdf/src/Adapters/WebAnnotation.ts` | `:24` `../Iri.ts` | `IRIReference` | 3 |
| `rdf/src/index.ts` | `:34-40` doc block plus `export * from "./Iri.ts"` | all four (the barrel re-export the decision forbids keeping) | n/a |
| `rdf/test/Rdf.test.ts` | `:17` `@beep/rdf/Iri` | all four | 10 (section 7) |
| `rdf/test/IRI.test.ts` | `:1` `@beep/rdf/Iri` | all four plus `canonicalizeSchemaOrgIri` | 30 (section 7) |
| `rdf/src/Iri.ts` JSDoc | `:738` (canonicalize), `:864,887,905,927,945,968,986,1009` | 8 moved-symbol example imports | move with the file, re-specified to `@beep/identity/Iri` |
| `rdf/README.md` | `:13` `import { IRI } from "@beep/rdf/Iri"`; `:5` "owns … IRI/URI identifiers" | — | prose edit |

The six `src` re-points import `@beep/identity/Iri` (`rdf` already depends on
`@beep/identity`; `rdf/package.json` `dependencies`). After the move, `rdf/src/index.ts`
loses `:34-40`, and the root barrel exports no IRI schema. `rdf/src/Uri.ts:92` carries a
`fallow-ignore-next-line code-duplication` that names "URI and IRI reference checks".
It stays, because the two check factories remain look-alikes across packages.

### 5c. Scratchpad (`scratchpad/effect-ontology`, workspace `@beep/scratchpad`): 56 files

- 52 files import a moved symbol in code (54 import lines; `Utils/Rdf.ts` has two):
  47 from `@beep/rdf` and 5 from `@beep/rdf/Iri`
  (`Cli/Commands/Link.ts:12`, `Domain/Model/Ontology.ts:9`,
  `test/Domain/Model/Behavior.test.ts:1`, `test/Service/Grounder.test.ts:1`,
  `test/Workflow/GroundingProvenance.test.ts:2`).
- 4 files name a moved symbol only in JSDoc examples. There are 51 JSDoc example lines
  in all, every one naming `IRI` from `@beep/rdf`.
- 341 usage lines. The moved symbols named in code imports are `IRI` (103 clause
  mentions, JSDoc included) and `AbsoluteIRI` (3).
- 32 of the 52 code files import nothing else from rdf, so their specifier is
  rewritten. The other 20 also import other rdf names, so their import is split:
  the moved names go to `@beep/identity/Iri` and the rest stay on `@beep/rdf`.

`scratchpad/package.json` already depends on `@beep/identity` (`:29`) and `@beep/rdf`
(`:41`), and `scratchpad/tsconfig.json` references both (`:62,77`), so no manifest
changes.

Per file (path under `scratchpad/effect-ontology/`; specifier, code-import lines,
JSDoc lines, usage lines; `split` means other rdf names are imported too):

- **Cli, Domain, Prompt, Repository, Runtime, Schema:**
  - `Cli/Commands/Link.ts` Iri 1/0/1
  - `Domain/Error/Base.ts` root 1/0/1
  - `Domain/Error/Ontology.ts` root 1/0/2 split
  - `Domain/Model/CoreOntology.ts` root 1/0/13
  - `Domain/Model/Entity.ts` root 1/1/2 split
  - `Domain/Model/EntityResolution.ts` root 1/0/3
  - `Domain/Model/Ontology.ts` Iri 1/9/56
  - `Domain/Model/OntologyAgent.ts` root 1/0/1
  - `Domain/Model/OntologyEmbeddings.ts` root 1/0/1
  - `Domain/Rdf/Constants.ts` root 1/0/4 split
  - `Domain/Schema/KnowledgeModel.ts` root 1/0/1 split
  - `Domain/Schema/OntologyBrowser.ts` root 1/0/12
  - `Domain/Schema/OntologyRegistry.ts` root 1/0/4
  - `Domain/Schema/Search.ts` root 1/0/9
  - `Domain/Schema/Timeline.ts` root 1/0/7
  - `Prompt/RuleSet.ts` root 1/0/9
  - `Repository/EntityRegistry.ts` root 1/2/6
  - `Runtime/HttpServer.ts` root 1/0/8 split
  - `Schema/RelationFactory.ts` root 1/0/1
- **Service:**
  - `Service/Assertion.ts` 1/0/17 split
  - `Service/Claim.ts` 1/0/7 split
  - `Service/Config.ts` 1/0/10 split
  - `Service/CrossBatchEntityResolver.ts` 1/1/12
  - `Service/Extraction.ts` 1/0/6
  - `Service/GraphRAG.ts` 1/5/2
  - `Service/Grounder.ts` 1/9/1
  - `Service/Nlp.ts` 1/1/6
  - `Service/Ontology.ts` 1/0/27 split
  - `Service/Rdf.ts` 1/0/18 split
  - `Service/RelationLinker.ts` 1/1/1
  - `Service/Shacl.ts` 1/0/4 split
  - `Service/SubgraphExtractor.ts` 1/0/2
  - All root.
- **Utils and Workflow** (root unless marked):
  - `Utils/ClaimFactory.ts` 1/1/16 split
  - `Utils/Datatype.ts` 1/1/2 split
  - `Utils/Entity.ts` 1/1/1
  - `Utils/Iri.ts` 1/7/27
  - `Utils/Rdf.ts` 2/2/1 split
  - `Utils/Similarity.ts` 0/4/0
  - `Workflow/DurableActivities.ts` 1/0/2 split
  - `Workflow/EntityResolution.ts` 0/1/0
  - `Workflow/EntityResolutionGraph.ts` 0/2/0
  - `Workflow/Merge.ts` 1/2/3 split
  - `Workflow/StreamingExtractionActivity.ts` 0/1/0
- **test/** (root unless marked Iri):
  - `Domain/Model/Behavior.test.ts` Iri 1/0/10
  - `Domain/Rdf/Constants.test.ts` 1/0/1 split
  - `Service/ConflictRepository.test.ts` 1/0/1
  - `Service/GraphRAG.test.ts` 1/0/6
  - `Service/Grounder.test.ts` Iri 1/0/2
  - `Service/R4SchemaClosure.test.ts` 1/0/1
  - `Service/Rdf.test.ts` 1/0/1
  - `Service/RepositoryOntologyIsolation.test.ts` 1/0/4
  - `Service/SchemaBoundaries.test.ts` 1/0/1 split
  - `Utils/Entity.test.ts` 1/0/1
  - `Workflow/DurableActivities.test.ts` 1/0/1 split
  - `Workflow/EntityResolutionGraph.test.ts` 1/0/2
  - `Workflow/GroundingProvenance.test.ts` Iri 1/0/4 split

## 6. Manifests and tsconfig references

| Package | Change | Where |
| --- | --- | --- |
| `@beep/identity` | none: exports wildcard, effect-only dependency, no new reference | `identity/package.json`, `tsconfig*.json` |
| `@beep/rdf` | none in manifests (`"./*"` stops resolving `Iri` once the file is gone). It keeps `@beep/utils` for the schema.org helper and its other modules | `rdf/package.json` |
| `@beep/documents-domain` | **remove** `"@beep/rdf": "workspace:^"` (`package.json:73`) and the rdf references in `tsconfig.json:18`, `tsconfig.check.json:12` and `tsconfig.test.json:24`. Its only rdf imports are the two moved ones (`git grep '@beep/rdf' -- packages/documents/domain` lists only `package.json` and the two Taxonomy files). It already depends on `@beep/identity` (`:72`). Leaving the dependency would be an unused dependency | `packages/documents/domain/` |
| `@beep/ontology` | none: it still imports `@beep/rdf/Rdf` (`Fold.models.ts`, `Fold.assembly.ts`) and already depends on identity (`package.json:66`) | |
| `@beep/ontology-client` | none: it still imports `@beep/rdf/Rdf` and `@beep/rdf/Vocab/Xsd` and depends on both (`package.json:64,68`) | |
| `@beep/scratchpad` | none (`scratchpad/package.json:29,41`) | |
| goals ops design | none: `ops/design/tsconfig.json` extends `tsconfig.configs.json`, whose `@beep/identity/*` path covers the new specifier | |
| `bun.lock` | the `@beep/documents-domain` workspace entry loses `@beep/rdf` | `bun install` |
| Changesets | `@beep/rdf` major, because it removes 4 schemas and 4 types from `@beep/rdf` and the `@beep/rdf/Iri` subpath (AGENTS.md Autonomy: "ship a breaking public API or schema change with a major changeset"); `@beep/identity` minor (new module); `@beep/documents-domain`, `@beep/ontology` and `@beep/ontology-client` patch. `@beep/scratchpad` is ignored (`.changeset/config.json` `ignore`) | `.changeset/*.md` |

## 7. Tests that move

Destination: `packages/foundation/modeling/identity/test/Iri.test.ts`. That name is
distinct from the existing `IriBinding.test.ts`. A `git mv` of `rdf/test/IRI.test.ts`
keeps the history.

| Source | Lines | Content | Disposition |
| --- | --- | --- | --- |
| `rdf/test/IRI.test.ts` | `:17-32` | decode/is/equivalence constants | move |
| `rdf/test/IRI.test.ts` | `:34-109` | `describe("IRI")`: facade accept/reject (2 `it.effect`) and 4 `it.effect.prop` round trips | move |
| `rdf/test/IRI.test.ts` | `:135-148` | schema.org forms through the generic `IRI` codec (no rdf import) | move |
| `rdf/test/IRI.test.ts` | `:111-124`, `:126-133` | `canonicalizeSchemaOrgIri` cases, and `makeNamedNode` with the facade (`@beep/rdf/Rdf`) | **stay in rdf** (new `rdf/test/SchemaOrg.test.ts`, importing `IRI`, `AbsoluteIRI` and `IRIReference` from `@beep/identity/Iri`) |
| `rdf/test/Rdf.test.ts` | `:201-414` `describe("@beep/rdf IRI schemas")` | RFC 3987 edge cases: IPv6, IPvFuture, ports, bidi, whitespace, native-URL divergence | **move**, so that the 100 % coverage row of the moved file stays 100 % without rdf's tests. Rename the describe to `@beep/identity IRI schemas` |
| `rdf/test/Rdf.test.ts` | `:168` `isIRI`, `:179-180` `decodeIriReference` and `decodeRelativeIriReference`, `:190-197` `canParseWithNativeUrl`, `:199` `bidiFormattingCharacters` | used only inside `:201-414` | move |
| `rdf/test/Rdf.test.ts` | `:177-178` `decodeIri`, `decodeAbsoluteIri`; uses at `:590,631,744,748,806,810` | JSON-LD, prefix-map and annotation tests | stay; `:17` becomes `import { AbsoluteIRI, IRI, IRIReference } from "@beep/identity/Iri"` |

Dependency adjustments in the moved test code:
- `fcRuns` from `@beep/test-utils` (`IRI.test.ts:4`) becomes `@beep/fc-runs`, as in
  `identity/test/Curie.test.ts:1`. Identity has no `@beep/test-utils` dependency.
- `A.map` from `@beep/utils` (`Rdf.test.ts:116`, used at block line `:331`) becomes
  `effect/Array`.
- `mapFailureTags` (`rdf/test/helpers/FailureTags.ts:34-40`, which 6 other rdf tests
  also use) is not available in identity. In the 3 assertions at `IRI.test.ts:51,57,63`,
  use
  `assertExitFailure(Exit.mapError(exit, Struct.get("_tag")), Cause.fail("SchemaError"))`
  (`Exit.ts:976`, `Struct.ts:148`). A schema decode exit has one typed failure, so this
  equals the helper. Copying the helper would create a fallow duplicate.

The `L0-1` and `L0-3` test files named in `research/law-test-plan.md:7,9`
(`Curie.laws.test.ts`, `TermStability.test.ts`) are new files, not part of this move.

## 8. Generated artifacts to regenerate

| Artifact | Effect of the move | Command |
| --- | --- | --- |
| `standards/schema-catalog/@beep/rdf.generated.jsonc` (`:33-36`) and `@beep/identity.generated.jsonc` | 4 rows move: rdf 98 → 94, identity 13 → 17 (`file` and `owner` change; `identity` stays the short name) | `bun run beep lint schema-catalog --write` (check: the same command without `--write`) |
| `identity/src/index.ts` barrel | gains `export * from "./Iri.ts"` with its doc block | `bun run --filter=@beep/identity codegen` (`beep-cli codegen barrel`) |
| `rdf/src/index.ts` barrel | loses `:34-40` | `bun run --filter=@beep/rdf codegen` |
| `standards/fallow.boundaries.generated.jsonc` | `@beep/documents-domain` `allow` loses `@beep/rdf` (`:2237-2248`); type-only lists likewise | `bun run beep fallow boundaries --write` (check `--check`) |
| `standards/cache-baseline/@beep/documents-domain.json` | 7 dependency edges on `@beep/rdf#build`/`#transit` (`:20,81,129,260,464,514,572`) disappear | `bun run beep cache audit`, then a reviewed `bun run beep cache baseline --request <request.json>` whose `previous` maps the subject to the SHA-256 of the current file text (`.claude/skills/yeet/references/gates-and-proof.md:222-240`). Identity and rdf are unchanged: their inputs are globs and their dependencies are the same |
| `standards/coverage.regression-baseline.jsonc` | the row key `packages/foundation/modeling/rdf/src/Iri.ts` (`:36335`, 100/100/100/100) moves under `@beep/identity` (`:16375` block) as `identity/src/Iri.ts`; package aggregates of both re-measure; `rdf/src/Vocab/SchemaOrg.ts` (`:36575`, 100 %) re-measures | `bun run coverage -- --filter=@beep/identity --write-baseline` and `--filter=@beep/rdf` (header `:2-6`). On a constrained host, run `bun run beep yeet final-check --skip coverage=<reason>` and let hosted Coverage Regression prove it |
| `standards/fallow.health.regression-baseline.jsonc` (`:95`, `complexity_moderate` 5, `crap_moderate` 4) | the key moves to `identity/src/Iri.ts` | `bun run fallow:health:baseline:write`; the diff must show only this key rename, and any other drift is discarded |
| `.fallowrc.jsonc:594` health ceiling for `scanComponent` | path edit to `packages/foundation/modeling/identity/src/Iri.ts` (configuration, hand-edited) | none (checked by `bun run fallow:health:baseline:check`) |
| `bun.lock` | documents-domain loses the rdf entry | `bun install` |
| Docgen output | new identity module, rdf module removed | `bun run docgen:local` (full `bun run docgen` for the repo-wide proof) |

Unchanged:
- `tsconfig.packages.json`, `turbo.json` and `standards/policy-tools.fingerprint.json`:
  no package is added or removed and no tooling source changes.
- `standards/instrumentation-catalog/@beep/identity.generated.jsonc`: the schemas carry
  no spans.

## 9. S31 inventories naming affected files

Counts are `grep -c` of the path at this head.

| Inventory | Entry naming a moved file | After the move (recommended shape) |
| --- | --- | --- |
| `standards/coverage.regression-baseline.jsonc` | `rdf/src/Iri.ts` (1). Rows for the importers exist but are path-keyed coverage rows that an import edit does not add or remove: Taxonomy.model/seed, ontology `ClassificationRegistry`, `Fold.assembly`, `Fold.models`, `SemanticFoundation.models/seed`, `TaxonomyLoader`, `TaxonomyRegistry`, client `Session.atoms`, and rdf `JsonLd`, `ProvRdf`, `Rdf`, `Evidence`, `WebAnnotation`, `DocumentAnnotation` | renamed: rdf 38 → 37, identity 8 → 9, total unchanged. If `rdf/src/Iri.ts` is kept, it grows by 1 |
| `standards/fallow.health.regression-baseline.jsonc` | `rdf/src/Iri.ts` (1) | renamed: rdf 1 → 0, identity 1 → 2, total unchanged |
| `.fallowrc.jsonc` | `rdf/src/Iri.ts` (1, `:594`) | renamed: rdf 1 → 0, identity 1 → 2, total unchanged |
| `standards/schema-first.inventory.jsonc` | none for `Iri.ts`; 2 symbol-keyed exceptions in `ontology/src/Fold.models.ts` (`OntologyFoldInput` `:697`, `TypedLiteral` `:705`), which an import edit does not touch | unchanged |
| `standards/effect-vitest.inventory.jsonc`, `standards/entity-kit-freeze.baseline.jsonc`, `standards/effect-laws.allowlist.jsonc`, `.gitleaks.toml`, `_typos.toml`, `biome.identity.jsonc`, `standards/fallow.dead-code.regression-baseline.jsonc`, `fallow.pilot.inventory.jsonc`, `check-census.regression-baseline.jsonc`, `jsdoc-totals.regression-baseline.jsonc`, `test-typecheck.blindspot-baseline.jsonc`, `goals/knowledge-doctor.baseline.jsonc`, `.gitleaksignore` | 0 entries for `rdf/src/Iri.ts`, `rdf/test/IRI.test.ts` or `rdf/test/Rdf.test.ts`. `effect-vitest` has 30 ontology and client lines and `entity-kit-freeze` has 4 documents-domain lines, all on files this move does not touch | unchanged |
| In-package suppressions (`biome-ignore`, `oxlint-disable`, `eslint-disable`, `@ts-expect-error`, `@ts-ignore`, `fallow-ignore`) | 0 in `Iri.ts` and in `IRI.test.ts`. The 3 `istanbul` comments are not counted and move with the file | unchanged |

Rule for every phase head: re-run the census grep
(`research/consumer-census.md` "S31 inventories"). The per-inventory totals must be at
or below the P0 base. A moved file carries its rows by rename, never as a new row
beside the old one.

`goals/boolean-creep/data/**` names `rdf/src/Iri.ts` in historical receipts. These are
frozen evidence of a completed goal, not live inventories, and are not edited.

## 10. Ordered edit plan

1. Record the identity-delta ruling as a decision file
   (`bun run beep goals decisions add text-knowledge-stack-rebuild --title "P1: IRI schemas re-home under $IdentityId (18 code identities change, none pinned)" --reversal "Use $RdfId.create(\"iri\") from ./packages.ts in identity/src/Iri.ts"`).
2. In `rdf/src/Vocab/SchemaOrg.ts`, add `canonicalizeSchemaOrgIri` with its private
   helpers (`Iri.ts:708-719`, a local `slice` or inline `Str.slice`, and the `A`/`Str`
   imports from `@beep/utils`). Update its JSDoc example import to
   `@beep/rdf/Vocab/SchemaOrg`.
3. `git mv packages/foundation/modeling/rdf/src/Iri.ts packages/foundation/modeling/identity/src/Iri.ts`,
   then edit the moved file:
   - delete the schema.org block (`:708-755`) and the `SCHEMA_ORG_NAMESPACE` import (`:13`);
   - replace `:7-8` with `import * as A from "effect/Array"`,
     `import * as Str from "effect/String"` and
     `import { $IdentityId } from "./packages.ts"`;
   - set `$I = $IdentityId.create("Iri")`;
   - rewrite `:783` to `pipe(identifier, Str.startsWith("Relative"))`;
   - change the `istanbul` owners at `:210,243,248` to `@beep/identity`;
   - re-specify the 8 JSDoc example imports to `@beep/identity/Iri`;
   - repair or cut the truncated note at `:17-31`.
4. Regenerate both barrels (`codegen` in identity and rdf).
5. Re-point the 6 rdf `src` importers (section 5b) to `@beep/identity/Iri`.
6. Tests:
   - `git mv rdf/test/IRI.test.ts identity/test/Iri.test.ts`; keep `:1-109` and
     `:135-148`, and swap in `@beep/fc-runs` and `Exit.mapError`;
   - append `Rdf.test.ts:201-414` and its helpers (`:168,179-180,190-199`), with
     `A` from `effect/Array`;
   - create `rdf/test/SchemaOrg.test.ts` from `IRI.test.ts:111-133`;
   - trim `Rdf.test.ts:17`.
7. Migrate the 19 package and goals-ops importers (section 5a). That is 19 specifier
   rewrites to `@beep/identity/Iri` plus the 11 ontology JSDoc lines.
8. Migrate the 56 scratchpad files: 32 specifier rewrites, 20 import splits and the
   51 JSDoc lines (4 of the files are JSDoc-only).
9. Drop the `@beep/rdf` dependency and the three tsconfig references from
   `@beep/documents-domain`, then run `bun install`.
10. Edit `.fallowrc.jsonc:594` and `rdf/README.md:5,13`, and add a line about the
    `Iri` module to `identity/README.md`.
11. Regenerate: `bun run beep lint schema-catalog --write`,
    `bun run beep fallow boundaries --write`, `bun run fallow:health:baseline:write`
    (keep only the rename), the coverage rows of identity and rdf, and the reviewed
    cache baseline for `@beep/documents-domain`.
12. Changesets: `@beep/rdf` major, `@beep/identity` minor, and
    `@beep/documents-domain`, `@beep/ontology`, `@beep/ontology-client` patch.

## 11. Verification for this part

```sh
# no moved symbol is imported from rdf anywhere (expect no output)
rg -U -l -P "import\s+(type\s+)?\{[^}]*\b(IRI|IRIReference|RelativeIRIReference|AbsoluteIRI)\b[^}]*\}\s*from\s*[\"']@beep/rdf(/Iri)?[\"']" \
  packages apps scratchpad goals -g '*.ts' -g '*.tsx'
git grep -n '@beep/rdf/Iri' -- '*.ts' '*.tsx' '*.md' ':!goals/boolean-creep' ':!explorations' ':!goals/*/research/2026-11-0*'
# identity stays effect-only and never imports utils, schema, jsonc or rdf
rg -n "from \"@beep/(utils|schema|jsonc|rdf|data)" packages/foundation/modeling/identity/src packages/foundation/modeling/identity/test
rg -n 'Iri\.ts' packages/foundation/modeling/identity/src/Id.ts packages/foundation/modeling/identity/src/packages.ts   # expect none
# package proofs (package handoff law)
bun run beep quality package-verify @beep/identity
bun run beep quality package-verify @beep/rdf
bun run beep quality package-verify @beep/ontology
bun run beep quality package-verify @beep/documents-domain
bun run beep quality package-verify @beep/ontology-client
bun run --filter=@beep/scratchpad check
bunx tsrs -p goals/text-knowledge-stack-rebuild/ops/design/tsconfig.json --noEmit
bunx tsrs -p goals/tsconfig.ops.json --noEmit
# generated artifacts and gates
bun run beep lint schema-catalog
bun run beep fallow boundaries --check
bun run fallow:health:baseline:check
bun run beep cache audit
bun run beep lint identity-registry
bun run beep lint schema-first
bun run docgen:local
# S31 totals (compare with section 9 and the census base)
for f in standards/coverage.regression-baseline.jsonc standards/fallow.health.regression-baseline.jsonc .fallowrc.jsonc; do
  grep -cE 'packages/foundation/modeling/(rdf|identity)/' "$f"; done
bun run beep yeet final-check
```

Expected:
- the two importer searches print nothing;
- identity `src` has no `@beep/*` runtime import other than its own relative modules;
- every package-verify passes;
- schema-catalog shows rdf 94 and identity 17 rows;
- the three S31 totals equal the base (46, 2 and 2 lines naming an rdf or identity
  path, measured at `3dbdd1e46ba`).
