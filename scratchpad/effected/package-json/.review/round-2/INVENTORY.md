# package-json — round-2 inventory

Seats read: `grok.md`, `sol.md`, `fable.md` and their shared `BRIEF.md`; no part-N directories exist. The brief pins review commit `a12bef261998d2ad92153dada46373be06950692` and oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. All 28 seat records are accounted for.

REQUIRED: 16  BACKLOG: 7  CODEMOD: 2  REJECTED: 0  GROUPS: 5

Binding precedence: the complete operator revision block (including the 2026-10-09 rulings and later grilling), D1–D20, sections 12.4–12.5 and 14, and the task's tighter write-surface/history rules. Live branch is `@lab/effected-2`, rather than the named `@lab/effected`; this inventory does not switch branches or implement fixes. Module source/tests have no live dirty diff. No package-json entries remain in `standards/effect-laws.allowlist.jsonc`, so there are no new `allow-<n>` records.

The seven overlapping prototype-loss seat findings are one root-cause finding. The four independent object-guard definitions in fable-2-6 have suffixed ids, as in round 1, so each belongs to one disjoint write group; counts reflect these actionable records. Green-gate misses retain concrete source evidence; documentation/JSDoc work stays backlog as instructed. History reclassifies fable-2-4 as forced bookkeeping despite the earlier round-1 restoration opinion.

`required.json` owns every required source/test file exactly once: g1 has 4 source files, g2 has 3, g3 has 2, g4 has 1, g5 has 4. Only g1's three regression test files must change; the other fixes preserve existing assertions and need source edits only. Other suites may be verified read-only. No group owns repository config, root package.json, bun.lock, PORT_LEDGER.json, allowlist edits or README Port notes. Central bookkeeping receives upstream-bug receipts and per-class deviation/added-export records. No compiler, vitest, coverage, session, closeout or ledger command ran for this merge.

## Required

### grok-2-1

- file: scratchpad/effected/package-json/Person.ts:115-120; scratchpad/effected/package-json/Funding.ts:54-60; scratchpad/effected/package-json/Repository.ts:129-134,376-379,486-489
- class: bug   severity: required
- standard: D9; D11; section 14 verified upstream-bug exception; unknown-key wire-fidelity contract; later grilling requires public records built with R.fromEntries.
- evidence: Sol's read-only probes in both the reviewed lab and pinned oracle decode JSON.parse objects with an own __proto__ data field, edit name/url, and encode without that field: Person returns {"name":"Bob"}; Funding, Repository and Bugs return {"url":"new"}. Decoded rest has no own keys. Fable also supplies a second unknown key and observes only ["team"] surviving. All five live partitions assign caller keys into {}; the inherited __proto__ setter consumes the field and can replace the accumulator's prototype. Grok traces S.Record's assignProperty preservation of the input key and explains why Repository's shared fidelity helper must change along with both decode partitions. Unedited remembered-wire replay conceals the defect; ordinary-name tests and green gates miss it.
- failure: Editing a modeled Person, Funding, Repository or Bugs field silently deletes the unknown __proto__ JSON field. The accumulator can inherit caller-provided properties. Fixing only the Repository/Bugs decode loops leaves their shared faithfulness comparison inconsistent.
- fix: Construct all five filtered unknown-key records with R.fromEntries over ordered R.toEntries, excluding the appropriate known-key HashSet; reuse Repository.restOf in both decode branches where equivalent. Use the R.fromEntries remedy from Grok/Sol, not the alternative null-prototype accumulators proposed by Fable (later grilling replaces those). Add Person.test.ts, Funding.test.ts and Repository.test.ts regressions using JSON.parse or the schema JSON codec to supply an OWN __proto__ data field: assert own-key/value preservation, ordinary record prototype, and decode → modeled-field edit → encode fidelity, including Funding.FromField and both Repository/Bugs codecs. Keep existing wire order and replay assertions. Supply one verified upstream-bug receipt and test references to central bookkeeping; do not edit ledger or README Port notes.
- seats: grok-2-1, sol-2-1, sol-2-2, sol-2-3, fable-2-1, fable-2-2, fable-2-3

### sol-2-4

- file: scratchpad/effected/package-json/Funding.ts:69-76
- class: bug   severity: required
- standard: D9; D11; section 14 verified upstream-bug exception; Funding.ts:63-67 replay must preserve edits.
- evidence: Sol's read-only lab and pinned-oracle probes decode { url: "https://fund.example", keep: 1, remove: 2 } via Funding.FromField, delete entries[0].rest.remove or replace rest with {}, then encode. Both return the original object with keep and remove restored. The live guard iterates only current rest keys at 73-75, never checking for original keys that disappeared. No existing gate covers extension deletion.
- failure: Removing one funding extension or clearing all extensions is silently undone by remembered-object replay.
- fix: Require equal unknown-key sets between restOf(wire) and funding.rest ?? {} before replay, checking both additions and deletions and retaining existing value comparisons with own-key-safe access. Add Funding.test.ts regressions for deleting one key and clearing rest, covering bare-object and array FromField encoding while retaining representation/order promises. Coordinate with grok-2-1's R.fromEntries partition fix. Supply the verified upstream-bug receipt and test references to central bookkeeping; do not edit ledger or README Port notes.
- seats: sol-2-4

### fable-2-5

- file: scratchpad/effected/package-json/Package.ts:1106; scratchpad/effected/package-json/PackageManifest.ts:177
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21 (direct helper refs over trivial wrapper lambdas); precedent round-1 fable-1-5 (required)
- evidence: `Result.getOrThrowWith(S.encodeUnknownResult(Package.schema)(this), (error) => error)` spells the identity function by hand while `Fn` (effect/Function) is already imported; PackageManifest.ts:177 repeats the same lambda. internal/format.ts:379-382 and EntryPoint.ts:97 use `identity` for the identical call, so the module is inconsistent and the terse-effect gate missed the bare identity lambda.
- failure: Two trivial wrapper lambdas violate the direct-helper rule.
- fix: Package.ts:1106 → `Result.getOrThrowWith(..., Fn.identity)`; PackageManifest.ts:177 → import `identity` from effect/Function and pass it.
- seats: fable-2-5

### fable-2-6-entrypoint

- file: scratchpad/effected/package-json/EntryPoint.ts:127-128
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21; AGENTS.md Discovery & Reuse and preference for Effect helper modules; D11 cited idiom violation.
- evidence: At EntryPoint.ts:127-128, the local record guard is P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value). Fable cites installed Effect 4 Predicate.js:719-721: P.isObject excludes null, functions and arrays and has an assignable PropertyKey-record predicate type. The live three-term guard survives the reported green gate; terse-effect does not detect this composite re-spelling. This record owns only this independent guard definition.
- failure: The local guard duplicates the existing equivalent Predicate helper.
- fix: Replace this local guard with P.isObject directly, retaining the explicit (value: unknown) => value is Record<string, unknown> type where needed. Remove only imports made unused in this file; preserve array/function/null rejection and every current assertion. No cross-file helper or test rewrite is needed.
- seats: fable-2-6

### fable-2-6-format

- file: scratchpad/effected/package-json/internal/format.ts:178-179
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21; AGENTS.md Discovery & Reuse and preference for Effect helper modules; D11 cited idiom violation.
- evidence: At internal/format.ts:178-179, the local record guard is P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value). Fable cites installed Effect 4 Predicate.js:719-721: P.isObject excludes null, functions and arrays and has an assignable PropertyKey-record predicate type. The live three-term guard survives the reported green gate; terse-effect does not detect this composite re-spelling. This record owns only this independent guard definition.
- failure: The local guard duplicates the existing equivalent Predicate helper.
- fix: Replace this local guard with P.isObject directly, retaining the explicit (value: unknown) => value is Record<string, unknown> type where needed. Remove only imports made unused in this file; preserve array/function/null rejection and every current assertion. No cross-file helper or test rewrite is needed.
- seats: fable-2-6

### fable-2-6-package-json-format

- file: scratchpad/effected/package-json/PackageJsonFormat.ts:140-141
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21; AGENTS.md Discovery & Reuse and preference for Effect helper modules; D11 cited idiom violation.
- evidence: At PackageJsonFormat.ts:140-141, the local record guard is P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value). Fable cites installed Effect 4 Predicate.js:719-721: P.isObject excludes null, functions and arrays and has an assignable PropertyKey-record predicate type. The live three-term guard survives the reported green gate; terse-effect does not detect this composite re-spelling. This record owns only this independent guard definition.
- failure: The local guard duplicates the existing equivalent Predicate helper.
- fix: Replace this local guard with P.isObject directly, retaining the explicit (value: unknown) => value is Record<string, unknown> type where needed. Remove only imports made unused in this file; preserve array/function/null rejection and every current assertion. No cross-file helper or test rewrite is needed.
- seats: fable-2-6

### fable-2-6-lenient

- file: scratchpad/effected/package-json/LenientManifest.ts:84-85
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21; AGENTS.md Discovery & Reuse and preference for Effect helper modules; D11 cited idiom violation.
- evidence: At LenientManifest.ts:84-85, the local record guard is P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value). Fable cites installed Effect 4 Predicate.js:719-721: P.isObject excludes null, functions and arrays and has an assignable PropertyKey-record predicate type. The live three-term guard survives the reported green gate; terse-effect does not detect this composite re-spelling. This record owns only this independent guard definition.
- failure: The local guard duplicates the existing equivalent Predicate helper.
- fix: Replace this local guard with P.isObject directly, retaining the explicit (value: unknown) => value is Record<string, unknown> type where needed. Remove only imports made unused in this file; preserve array/function/null rejection and every current assertion. No cross-file helper or test rewrite is needed.
- seats: fable-2-6

### fable-2-7

- file: scratchpad/effected/package-json/internal/format.ts:245; scratchpad/effected/package-json/Person.ts:78,257; scratchpad/effected/package-json/Repository.ts:157,161,384,493; scratchpad/effected/package-json/Funding.ts:81,110
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21 (tersest equivalent Effect helper form); precedent fable-1-5
- evidence: `R.keys(value).length === 0` / `R.keys(x).length > 0` at internal/format.ts:245, Person.ts:78,257, Repository.ts:157,161,384,493, Funding.ts:81,110. Installed Record.js:56 defines `isEmptyRecord = self => Object.keys(self).length === 0`, byte-identical semantics (R.keys is Object.keys).
- failure: Nine sites re-spell an exported Record helper; the terse-effect gate does not see the `.length === 0` form.
- fix: `R.isEmptyRecord(x)` for the `=== 0` sites and `!R.isEmptyRecord(x)` for the `> 0` sites, behaviour unchanged.
- seats: fable-2-7

### fable-2-8

- file: scratchpad/effected/package-json/PackageValidator.ts:178
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21; AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12-validator (required)
- evidence: anyDependencyMatches (:176-179) builds `map.pipe(HashMap.values, A.fromIterable, A.some(predicate))` while installed HashMap.d.ts:2251 exports `HashMap.some(self, (a, k) => boolean)`. Native `specifier.startsWith(...)` survives at :208 (x2) and :242 (x3) although effect/String exports `Str.startsWith`; the lab already uses Str.startsWith in format.ts:205,275 and EntryPoint.ts:142.
- failure: Three-step collection detour where one HashMap predicate exists; five native string helper calls in domain predicates.
- fix: Replace map.pipe(HashMap.values, A.fromIterable, A.some(predicate)) with HashMap.some(map, predicate), preserving short-circuiting across the four dependency maps. Use Str.startsWith for workspace:/catalog: and file:/link:/portal: predicates; import effect/String. Keep all validation messages, rule order and upstream assertions unchanged.
- seats: fable-2-8

### fable-2-9

- file: scratchpad/effected/package-json/Repository.ts:59
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); Short Law 21 for the two trivial lambdas; precedent fable-1-12-repository (required)
- evidence: Native string helpers survive at :59 (endsWith, slice), :71 (trim), :79-81 (indexOf, slice x2), :91 (startsWith, slice), :94 (indexOf, slice), :96 (replace), :103-105 (indexOf, lastIndexOf("@", colon), slice x2), :329 (`directory.split("/")`, `(segment) => segment.trim()`), :341 (`(segment) => encodeURIComponent(segment)`). Installed effect/String exports endsWith, slice, trim, indexOf/lastIndexOf (Option), startsWith, replace, split, includes (String.d.ts:273-853). Regex .test/.exec have no Effect equivalent and are not cited.
- failure: Domain string operations use native helpers despite equivalent Str.* helpers, and two trivial wrapper lambdas violate the direct-helper rule.
- fix: Replace with Str.endsWith/Str.slice/Str.trim/Str.indexOf (O.match)/Str.startsWith/Str.replace/Str.split; :104 becomes `Str.lastIndexOf("@")(Str.slice(0, colon)(withoutGitPlus))` (same answer as the fromIndex form); :329 `A.map(Str.split(directory, "/"), Str.trim)`; :341 `A.map(segments, encodeURIComponent)`. Keep every existing assertion. Preserve first-colon/last-@ boundary behavior; Str.indexOf/lastIndexOf return Option, so handle missing delimiters explicitly without casts.
- seats: fable-2-9

### fable-2-10

- file: scratchpad/effected/package-json/Person.ts:29
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12
- evidence: parsePersonString uses `input.match(/<([^>]+)>/)`, `input.match(/\(([^)]+)\)/)`, `name.replace(...)` x2 and `name.trim()` (:29-34); effect/String exports `Str.match(regExp)(self): Option<RegExpMatchArray>`, `Str.replace(search, replacement)(self)` and `Str.trim`.
- failure: Shorthand parsing uses native string helpers where Str.* equivalents exist.
- fix: `const emailMatch = Str.match(/<([^>]+)>/)(input)` (Option), `O.isSome` guards in place of `!== null`, `Str.replace(emailMatch.value[0], "")(name)`, `Str.trim(name)`; preserve the exact name/email/url extraction and the wire-fidelity tests.
- seats: fable-2-10

### fable-2-11

- file: scratchpad/effected/package-json/License.ts:92
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12
- evidence: isValidSpdx uses `value.startsWith("SEE LICENSE IN ")` while the module elsewhere uses `Str.startsWith` (format.ts:205,275; EntryPoint.ts:142).
- failure: One native string helper in a domain predicate.
- fix: `Str.startsWith("SEE LICENSE IN ")(value)` with `import * as Str from "effect/String"`; the length comparison stays.
- seats: fable-2-11

### fable-2-12

- file: scratchpad/effected/package-json/PackageName.ts:147
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12
- evidence: scope/unscoped/isScoped (:146-158) use `name.startsWith("@")` x3, `name.indexOf("/")` x2 and `name.slice(...)` x2; Str.startsWith, Str.indexOf (Option<number>) and Str.slice exist in installed effect/String.
- failure: Classification statics use native string helpers.
- fix: Use Str.startsWith("@")(name); implement scope using O.map(Str.indexOf("/")(name), (slash) => Str.slice(1, slash)(name)), and unscoped using O.getOrElse(O.map(Str.indexOf("/")(name), (slash) => Str.slice(slash + 1)(name)), () => name). Import effect/String; preserve all current classification results and PackageName.test.ts assertions.
- seats: fable-2-12

### fable-2-13

- file: scratchpad/effected/package-json/PackageManager.ts:154
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12
- evidence: FromString decode uses `input.indexOf("@")`, `input.slice(0, at)`, `input.slice(at + 1)`, `rest.indexOf("+")`, `rest.slice(0, plus)`, `rest.slice(plus + 1)` (:154-183); Str.indexOf returns Option<number> and Str.slice is curried in installed effect/String.
- failure: Field parsing uses native string helpers.
- fix: Split on `Str.indexOf("@")(input)` with O.match (none → the existing format failure), then `Str.slice(0, at)(input)` / `Str.slice(at + 1)(input)`; same for the first `+`; keep every decode message and PackageManager.test.ts assertion.
- seats: fable-2-13

### fable-2-14

- file: scratchpad/effected/package-json/PackageManagerRange.ts:67
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12
- evidence: singleComparator (:67-68) uses `matched.startsWith("^")`, `matched.startsWith("~")`, `matched.slice(operator.length)`; fromParts (:177-178,190) uses `tail.indexOf("+")`, `tail.slice(0, plus)`, `tail.slice(plus + 1)`; parseResult (:326-329) uses `input.indexOf("@")`, `input.slice(0, at)`, `input.slice(at + 1)`.
- failure: Range parsing uses native string helpers.
- fix: Str.startsWith/Str.slice in singleComparator (or read the regex capture groups already matched), `Str.indexOf("+")(tail)` with O.match in fromParts, `Str.indexOf("@")(input)` with O.match in parseResult; preserve the reason literals and PackageManagerRange.test.ts assertions.
- seats: fable-2-14

### fable-2-15

- file: scratchpad/effected/package-json/PackageJsonFormat.ts:198
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `Array`/`String` over native helpers); precedent fable-1-12 (A.join was required there)
- evidence: PackageJsonModifyError.message uses `this.path.join(", ")` (:198) and modify uses `source.includes("\r\n")` (:401); A.join (Iterable<string>) and Str.includes exist; the module already uses A.join in PackageValidator.ts:139.
- failure: Native array join and string includes survive in the format boundary.
- fix: :198 → `A.join(A.map(this.path, (segment) => `${segment}`), ", ")` (path carries numbers, A.join takes strings); :401 → `Str.includes("\r\n")(source) ? "\r\n" : "\n"`; keep the message text and Modify tests byte-identical.
- seats: fable-2-15

## Backlog

### fable-2-16

- file: scratchpad/effected/package-json/LenientManifest.ts:291
- class: effect-idiom   severity: backlog
- standard: Effect Laws Short Law 21 (tersest equivalent form); not a restoration (the pinned oracle also used decodeUnknownExit + Cause.squash) Disposition: Consistency/consolidation preference with no demonstrated bug or mandatory primitive choice; outside D11 required criteria.
- evidence: decodeResult runs `S.decodeUnknownExit(UnknownRecord)` and `Cause.squash(exit.cause)` while parseResult (:347) uses `S.decodeUnknownResult`; for a plain Record schema no defect is reachable, so the Exit path only adds the Cause/Exit imports.
- failure: Two sync decode primitives in one class use different machinery for the same job; no observable divergence.
- fix: `Result.map(Result.mapError(S.decodeUnknownResult(UnknownRecord)(input), (cause) => PackageDecodeError.make({ cause })), sift)` and drop the Cause/Exit imports.
- seats: fable-2-16

### fable-2-17

- file: scratchpad/effected/package-json/internal/format.ts:246
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws (prefer effect helper modules over native helpers); no Short Law names the delete operator Disposition: No cited law forbids delete here and no observable failure or qualifying performance evidence; outside D11 required criteria.
- evidence: stripEmptyDependencyMaps spreads then `delete result[key]`; installed Record.js:310 `R.remove` is the same spread-plus-delete and preserves an own __proto__ data key, so `A.reduce(STRIP_EMPTY_KEYS, raw, (acc, key) => P.isObject(acc[key]) && R.isEmptyRecord(acc[key]) ? R.remove(acc, key) : acc)` is equivalent.
- failure: Imperative delete on a copied record; no observable failure.
- fix: Fold over STRIP_EMPTY_KEYS with R.remove as above; Format.test.ts expectations stay byte-identical.
- seats: fable-2-17

### fable-2-18

- file: scratchpad/effected/package-json/PackageValidator.ts:108
- class: schema   severity: backlog
- standard: AGENTS.md Discovery & Reuse; schema-first named building blocks Disposition: Schema reuse/consolidation opportunity without a demonstrated constraint or encoded-shape defect; outside D11 required criteria.
- evidence: PackageValidationError.failures re-declares `message: S.String, path: S.Option(S.String)` inline although the exported RuleFailure struct (:37-40) owns those fields.
- failure: Two schema definitions of the same failure shape can drift; no runtime divergence.
- fix: `failures: S.Array(S.Struct({ rule: S.String, ...RuleFailure.fields }))` keeping the encoded shape identical.
- seats: fable-2-18

### fable-2-19

- file: scratchpad/effected/package-json/License.ts:28
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (Example code uses Effect patterns; canonical @category on documented members); effect-tsgo newSchemaClass is at error for source Disposition: JSDoc work is explicitly deferred to Backlog for this inventory merge.
- evidence: Examples at :28, :45 and :60 construct the error with `new InvalidSpdxLicenseError({...})` while every other example in the module uses `.make` and the ledger records `.make` as the gate-forced constructor; docgen examples are not under tsgo, so the gate misses it. The `message` getter (:52-65) and the `input` field (:37-50) carry no `@category` while every sibling message getter has `@category getters`.
- failure: Public examples teach a constructor form the lab's own gate rejects in source; member tags are inconsistent with the rest of the module.
- fix: Use `InvalidSpdxLicenseError.make({...})` in the three examples; add `@category getters` to the message getter (and `@category models` to the field, matching PackageName.ts:39).
- seats: fable-2-19

### fable-2-20

- file: scratchpad/effected/package-json/Repository.ts:272-323; scratchpad/effected/package-json/LenientManifest.ts:384,404; scratchpad/effected/package-json/Funding.ts:196,216,236,255; scratchpad/effected/package-json/Person.ts:138-139
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md carrier and section grammar (cosmetic; docgen green) Disposition: Documentation/JSDoc formatting is explicitly deferred to Backlog for this inventory merge.
- evidence: Repository.ts:272-323 JSDoc lines are indented with two spaces instead of the tab-aligned ` *` used everywhere else; LenientManifest.ts:384,404 and Funding.ts:196,216,236,255 start their lead sentence with a double space after `*`; Person.ts:138-139 places the Example fence directly under the `**Example**` heading with no blank line, unlike every other Example in the module.
- failure: Rendered leads carry stray whitespace and one block is visually misaligned; no gate failure.
- fix: Re-indent the Repository block, delete the extra space in the six leads, insert the blank line after the Person Example heading.
- seats: fable-2-20

### fable-2-21

- file: scratchpad/effected/package-json/README.md:187
- class: docs   severity: backlog
- standard: D4 README adapted (section 10.3); round-1 sol-1-6 changed the parse boundary after the README was written Disposition: Documentation updates are explicitly deferred to Backlog for this inventory merge.
- evidence: README.md:187 says parseResult/parse 'also handles the raw `JSON.parse`' and :227 says PackageJsonParseError 'Carries `path` and the `SyntaxError`'; after sol-1-6 both paths decode through S.fromJsonString and PackageJsonFile.ts:150-154 documents `cause` as 'The schema decoding error'. Port notes (:258+) stay central and are not part of this finding.
- failure: The README body describes error causes the lab no longer produces.
- fix: Reword :187 to 'the pair that also parses the text' and :227 to 'Carries `path` and the `SchemaError` cause'.
- seats: fable-2-21

### fable-2-23

- file: scratchpad/effected/package-json/Person.ts:217-219; scratchpad/effected/package-json/Funding.ts:231-233,270-272
- class: effect-idiom   severity: backlog
- standard: AGENTS.md keep service boundaries explicit; operator identity-keys ruling (provenance as fields of our own objects); no law cited Disposition: Public provenance-setter consolidation has no cited mandatory law or demonstrated serialization bug; outside D11 required criteria.
- evidence: Person.rememberWire (:217-219), Funding.rememberWire (:231-233) and Funding.rememberBareField (:270-272) are public static mutators of private provenance, needed only because the module-level helpers (rememberWire :52, decodeEntry :100) sit outside the class; Repository and Bugs write `#wire` inside their own static codecs and expose no setter.
- failure: Any caller can forge or clear wire provenance on a Person or Funding instance; the three classes disagree on API surface for the same mechanism.
- fix: Move the provenance-writing helpers into the class bodies (as Repository does) or make the setters module-private; keep the wireOf/isBareField readers and their tests.
- seats: fable-2-23

## Handled by the deviation codemod

### fable-2-4

- file: scratchpad/effected/package-json/PackageValidator.ts:339,368
- class: effect-idiom   severity: backlog
- standard: Binding inventory history rule: step-2/S1/law-commit changes are forced unless the diff demonstrates otherwise; D9; later grilling centralizes forced-deviation bookkeeping.
- evidence: Read git log --format=%h:%s -- PackageValidator.ts and the --all history because current history is squashed into 7929b1f529. Commit 3ab7e3bc55 (effected-port step 2), 'clear package-json type, lint and tsgo diagnostics', explicitly changes BOTH plain validate forwarders to named Effect.fn wrappers and states only diagnostic-required edits. Read its diff, plus 03bf79d41b's law diff and 3b20e2f289's S1 diff: none reverses that provenance. Fable cites generator-only effectFnOpportunity fixtures and nearby unwrapped callbacks, but those do not show that the original diagnostic pass was unforced. The ledger's tsgo-diagnostics class records the wrapper change.
- failure: The two forwarders introduce an outer PackageValidator.validate span; under the binding history rule this is a diagnostic-forced deviation, not an admitted unforced restoration defect.
- fix: Keep the diagnostic-forced forwarders. Central per-module/per-class deviation bookkeeping retains or reconciles their tsgo-diagnostics record, sites and adjusted upstream tests (no wrapper-specific rewritten test lines are identified). Do not restore the upstream callbacks or remove their deviation clause on this evidence. No module worker owns PORT_LEDGER.json or README Port notes.
- seats: fable-2-4

### fable-2-22

- file: scratchpad/effected/package-json/README.md:287
- class: docs   severity: backlog
- standard: D2; later grilling records added exports through the central deviation codemod, exportsAdded.
- evidence: index.ts:50 and :94 now export `LenientFieldIssue` and `RuleFailure` as values; the pinned oracle index.ts exports both as types only (ledger exportsExpected kind 'type'). README Added exports still reads 'None' and the ledger row has exportsAdded: [].
- failure: Two value additions are unrecorded, so ledger --verify cannot see the superset.
- fix: Central bookkeeping lists the added value exports LenientFieldIssue and RuleFailure (entry '.') in exportsAdded and README Port notes → Added exports, preserving their original type surface. No source, test, ledger or README Port-notes worker edit is required for this record.
- seats: fable-2-22

## Rejected

None. Duplicate records are merged above. The null-prototype accumulator remedies in grok/fable were replaced by the stronger, ruling-compatible R.fromEntries fix; they do not create additional defects or rejected-record counts.

