### fable-2-1
- file: scratchpad/effected/package-json/Person.ts:116
- class: bug   severity: required
- standard: D9 section 14 upstream-bug (same class as round-1 sol-1-2, promoted to required and recorded); wire.ts:57 and LenientManifest.ts:153 already use the null-prototype accumulator for exactly this hazard   evidence: Read-only Bun probe: S.decodeUnknownSync(Person.FromValue)(JSON.parse('{"name":"Ann","__proto__":{"x":1},"team":"docs"}')) gives person.rest own keys ["team"] (the own __proto__ key is gone, because restOf assigns rest["__proto__"] = v into a plain {} which sets the prototype instead of storing data). Unedited encode replays the raw wire so the key reappears by accident; Person.make({ ...p, email: "a@x" }) then S.encodeSync(Person.FromValue) emits own keys ["team","name","email"] only. The top-level Package control through makeWire keeps the key (rest own keys ["__proto__"]).
- failure: A nested author/contributor/maintainer object carrying an own "__proto__" key silently loses it after any edit to the person; restOf also rewrites the accumulator's prototype to caller data.
- fix: In restOf build the accumulator as `const rest: Record<string, unknown> = { __proto__: null };` (the module's existing pattern), leave the loop unchanged; add a Person.test.ts regression: decode the object form with an own __proto__ key, edit email, encode, assert the own key and value survive. Route the upstream-bug record to central bookkeeping.

### fable-2-2
- file: scratchpad/effected/package-json/Repository.ts:130
- class: bug   severity: required
- standard: D9 section 14 upstream-bug (same class as round-1 sol-1-2 and fable-2-1); operator ruling: null-prototype dictionaries for data keyed by caller strings   evidence: Same probe: S.decodeUnknownSync(Repository.FromValue)(JSON.parse('{"url":"o/n","__proto__":{"x":1}}')) yields repository.rest undefined; after Repository.make({ ...r, url: "o/m" }) the encode emits own keys ["url"] only. Three plain-{} accumulators assign caller keys: restOf (:130-134), Repository.FromValue decode (:376-379) and Bugs.FromValue decode (:486-489).
- failure: A repository or bugs object with an own "__proto__" key loses it on decode; the loss becomes visible on the first edited re-encode, and the accumulator's prototype is replaced by caller data.
- fix: Use `{ __proto__: null }` for the three rest accumulators (restOf, Repository decode, Bugs decode); add Repository.test.ts regressions for Repository and Bugs (decode object with own __proto__, edit url, encode, assert the key survives). Central bookkeeping records the upstream-bug entry.

### fable-2-3
- file: scratchpad/effected/package-json/Funding.ts:55
- class: bug   severity: required
- standard: D9 section 14 upstream-bug (same class as sol-1-2, fable-2-1, fable-2-2)   evidence: Same probe: S.decodeUnknownSync(Funding.FromValue)(JSON.parse('{"url":"https://x","__proto__":{"x":1}}')) yields funding.rest undefined; after Funding.make({ ...f, url: "https://y" }) the encode emits own keys ["url"] only. restOf (:54-60) assigns into a plain {}. isFaithfulObject (:73-75) reads wire[key] so it is unaffected once rest keeps the key.
- failure: A funding entry object with an own "__proto__" key loses it on decode and on every edited re-encode.
- fix: `const rest: Record<string, unknown> = { __proto__: null };` in restOf; add a Funding.test.ts regression through FromValue and FromField (object entry with own __proto__, edit url, encode, assert the key survives). Central bookkeeping records the upstream-bug entry.

### fable-2-4
- file: scratchpad/effected/package-json/PackageValidator.ts:339
- class: effect-idiom   severity: required
- standard: Operator later grilling 2026-10-09: restore unforced upstream shapes; D9; round-1 fable-1-7 reopened with new evidence against the ledger's tsgo-diagnostics clause 'validator callbacks use named Effect.fn'   evidence: effect-tsgo testdata/tests/effect-v3/effectFnOpportunity_{inferred,params}.ts and their baselines fire TS377047 only on exported functions whose body returns Effect.gen(function*(){...}); `_notExportedNoSuggestion` is explicitly unflagged and no fixture flags a forwarder returning another function's Effect. In this very module, exported noUnresolvedDepsRule.validate (:207-210) and noLocalDepsRule.validate (:239-245) return Effects unwrapped, and PackageJsonFile.ts:400 readText is an unwrapped Effect-returning arrow, all under the green gate. The pinned oracle has `validate: (pkg) => runRules(pkg, defaultRules)` (:179) and `(pkg) => runRules(pkg, config.rules)` (:189). runRules (:267) already opens the PackageValidator.validate span.
- failure: Every validate call opens two nested identical `PackageValidator.validate` spans (layer :339 and layerRules :368) with no law, diagnostic or ruling forcing the outer one; the trace surface diverges from upstream.
- fix: Restore `validate: (pkg) => runRules(pkg, defaultRules)` at :339 and `validate: (pkg) => runRules(pkg, config.rules)` at :368; central bookkeeping removes the 'validator callbacks use named Effect.fn' clause from the tsgo-diagnostics deviation.

### fable-2-5
- file: scratchpad/effected/package-json/Package.ts:1106
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21 (direct helper refs over trivial wrapper lambdas); precedent round-1 fable-1-5 (required)   evidence: `Result.getOrThrowWith(S.encodeUnknownResult(Package.schema)(this), (error) => error)` spells the identity function by hand while `Fn` (effect/Function) is already imported; PackageManifest.ts:177 repeats the same lambda. internal/format.ts:379-382 and EntryPoint.ts:97 use `identity` for the identical call, so the module is inconsistent and the terse-effect gate missed the bare identity lambda.
- failure: Two trivial wrapper lambdas violate the direct-helper rule.
- fix: Package.ts:1106 → `Result.getOrThrowWith(..., Fn.identity)`; PackageManifest.ts:177 → import `identity` from effect/Function and pass it.

### fable-2-6
- file: scratchpad/effected/package-json/EntryPoint.ts:127
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21 (tersest equivalent Effect helper form); AGENTS.md Discovery & Reuse; precedent fable-1-5   evidence: Four hand-rolled guards spell `P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value)`: EntryPoint.ts:127-128, internal/format.ts:178-179, PackageJsonFormat.ts:140-141, LenientManifest.ts:84-85 (isPlainRecord). Installed effect v4 Predicate.js:719-721 defines `isObject(input) { return typeof input === "object" && input !== null && !Array.isArray(input); }` (and isObjectKeyword is `typeof object && !null || isFunction`, so the three-term form reduces to exactly isObject), guard type `input is { [x: PropertyKey]: unknown }`, which is assignable to the `Record<string, unknown>` predicate the four sites declare.
- failure: Four copies of a predicate the Predicate module already exports; the terse-effect gate does not detect multi-term re-spellings.
- fix: Replace each guard body with `P.isObject` (keep the local name as `const isPlainObject: (value: unknown) => value is Record<string, unknown> = P.isObject;` where the narrower predicate type is relied on, or call P.isObject directly); drop the now-unused `A`/`P.isFunction` imports where applicable.

### fable-2-7
- file: scratchpad/effected/package-json/internal/format.ts:245
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21 (tersest equivalent Effect helper form); precedent fable-1-5   evidence: `R.keys(value).length === 0` / `R.keys(x).length > 0` at internal/format.ts:245, Person.ts:78,257, Repository.ts:157,161,384,493, Funding.ts:81,110. Installed Record.js:56 defines `isEmptyRecord = self => Object.keys(self).length === 0`, byte-identical semantics (R.keys is Object.keys).
- failure: Nine sites re-spell an exported Record helper; the terse-effect gate does not see the `.length === 0` form.
- fix: `R.isEmptyRecord(x)` for the `=== 0` sites and `!R.isEmptyRecord(x)` for the `> 0` sites, behaviour unchanged.

### fable-2-8
- file: scratchpad/effected/package-json/PackageValidator.ts:178
- class: effect-idiom   severity: required
- standard: Effect Laws Short Law 21; AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12-validator (required)   evidence: anyDependencyMatches (:176-179) builds `map.pipe(HashMap.values, A.fromIterable, A.some(predicate))` while installed HashMap.d.ts:2251 exports `HashMap.some(self, (a, k) => boolean)`. Native `specifier.startsWith(...)` survives at :208 (x2) and :242 (x3) although effect/String exports `Str.startsWith`; the lab already uses Str.startsWith in format.ts:205,275 and EntryPoint.ts:142.
- failure: Three-step collection detour where one HashMap predicate exists; five native string helper calls in domain predicates.
- fix: `A.some([pkg.dependencies, ...], (map) => HashMap.some(map, predicate))` (or `HashMap.some(map, predicate)` directly); `Str.startsWith("workspace:")(specifier) || Str.startsWith("catalog:")(specifier)` and the file:/link:/portal: triple likewise.

### fable-2-9
- file: scratchpad/effected/package-json/Repository.ts:59
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); Short Law 21 for the two trivial lambdas; precedent fable-1-12-repository (required)   evidence: Native string helpers survive at :59 (endsWith, slice), :71 (trim), :79-81 (indexOf, slice x2), :91 (startsWith, slice), :94 (indexOf, slice), :96 (replace), :103-105 (indexOf, lastIndexOf("@", colon), slice x2), :329 (`directory.split("/")`, `(segment) => segment.trim()`), :341 (`(segment) => encodeURIComponent(segment)`). Installed effect/String exports endsWith, slice, trim, indexOf/lastIndexOf (Option), startsWith, replace, split, includes (String.d.ts:273-853). Regex .test/.exec have no Effect equivalent and are not cited.
- failure: Domain string operations use native helpers despite equivalent Str.* helpers, and two trivial wrapper lambdas violate the direct-helper rule.
- fix: Replace with Str.endsWith/Str.slice/Str.trim/Str.indexOf (O.match)/Str.startsWith/Str.replace/Str.split; :104 becomes `Str.lastIndexOf("@")(Str.slice(0, colon)(withoutGitPlus))` (same answer as the fromIndex form); :329 `A.map(Str.split(directory, "/"), Str.trim)`; :341 `A.map(segments, encodeURIComponent)`. Keep every existing assertion.

### fable-2-10
- file: scratchpad/effected/package-json/Person.ts:29
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12   evidence: parsePersonString uses `input.match(/<([^>]+)>/)`, `input.match(/\(([^)]+)\)/)`, `name.replace(...)` x2 and `name.trim()` (:29-34); effect/String exports `Str.match(regExp)(self): Option<RegExpMatchArray>`, `Str.replace(search, replacement)(self)` and `Str.trim`.
- failure: Shorthand parsing uses native string helpers where Str.* equivalents exist.
- fix: `const emailMatch = Str.match(/<([^>]+)>/)(input)` (Option), `O.isSome` guards in place of `!== null`, `Str.replace(emailMatch.value[0], "")(name)`, `Str.trim(name)`; preserve the exact name/email/url extraction and the wire-fidelity tests.

### fable-2-11
- file: scratchpad/effected/package-json/License.ts:92
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12   evidence: isValidSpdx uses `value.startsWith("SEE LICENSE IN ")` while the module elsewhere uses `Str.startsWith` (format.ts:205,275; EntryPoint.ts:142).
- failure: One native string helper in a domain predicate.
- fix: `Str.startsWith("SEE LICENSE IN ")(value)` with `import * as Str from "effect/String"`; the length comparison stays.

### fable-2-12
- file: scratchpad/effected/package-json/PackageName.ts:147
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12   evidence: scope/unscoped/isScoped (:146-158) use `name.startsWith("@")` x3, `name.indexOf("/")` x2 and `name.slice(...)` x2; Str.startsWith, Str.indexOf (Option<number>) and Str.slice exist in installed effect/String.
- failure: Classification statics use native string helpers.
- fix: `Str.startsWith("@")(name)`; `O.flatMap(Str.indexOf("/")(name), (slash) => O.some(Str.slice(1, slash)(name)))` for scope and `O.getOrElse(O.map(Str.indexOf("/")(name), (slash) => Str.slice(slash + 1)(name)), () => name)` for unscoped; keep PackageName.test.ts assertions.

### fable-2-13
- file: scratchpad/effected/package-json/PackageManager.ts:154
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12   evidence: FromString decode uses `input.indexOf("@")`, `input.slice(0, at)`, `input.slice(at + 1)`, `rest.indexOf("+")`, `rest.slice(0, plus)`, `rest.slice(plus + 1)` (:154-183); Str.indexOf returns Option<number> and Str.slice is curried in installed effect/String.
- failure: Field parsing uses native string helpers.
- fix: Split on `Str.indexOf("@")(input)` with O.match (none → the existing format failure), then `Str.slice(0, at)(input)` / `Str.slice(at + 1)(input)`; same for the first `+`; keep every decode message and PackageManager.test.ts assertion.

### fable-2-14
- file: scratchpad/effected/package-json/PackageManagerRange.ts:67
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `String` over native helpers); precedent fable-1-12   evidence: singleComparator (:67-68) uses `matched.startsWith("^")`, `matched.startsWith("~")`, `matched.slice(operator.length)`; fromParts (:177-178,190) uses `tail.indexOf("+")`, `tail.slice(0, plus)`, `tail.slice(plus + 1)`; parseResult (:326-329) uses `input.indexOf("@")`, `input.slice(0, at)`, `input.slice(at + 1)`.
- failure: Range parsing uses native string helpers.
- fix: Str.startsWith/Str.slice in singleComparator (or read the regex capture groups already matched), `Str.indexOf("+")(tail)` with O.match in fromParts, `Str.indexOf("@")(input)` with O.match in parseResult; preserve the reason literals and PackageManagerRange.test.ts assertions.

### fable-2-15
- file: scratchpad/effected/package-json/PackageJsonFormat.ts:198
- class: effect-idiom   severity: required
- standard: AGENTS.md Code Laws (prefer effect helper modules `Array`/`String` over native helpers); precedent fable-1-12 (A.join was required there)   evidence: PackageJsonModifyError.message uses `this.path.join(", ")` (:198) and modify uses `source.includes("\r\n")` (:401); A.join (Iterable<string>) and Str.includes exist; the module already uses A.join in PackageValidator.ts:139.
- failure: Native array join and string includes survive in the format boundary.
- fix: :198 → `A.join(A.map(this.path, (segment) => `${segment}`), ", ")` (path carries numbers, A.join takes strings); :401 → `Str.includes("\r\n")(source) ? "\r\n" : "\n"`; keep the message text and Modify tests byte-identical.

### fable-2-16
- file: scratchpad/effected/package-json/LenientManifest.ts:291
- class: effect-idiom   severity: backlog
- standard: Effect Laws Short Law 21 (tersest equivalent form); not a restoration (the pinned oracle also used decodeUnknownExit + Cause.squash)   evidence: decodeResult runs `S.decodeUnknownExit(UnknownRecord)` and `Cause.squash(exit.cause)` while parseResult (:347) uses `S.decodeUnknownResult`; for a plain Record schema no defect is reachable, so the Exit path only adds the Cause/Exit imports.
- failure: Two sync decode primitives in one class use different machinery for the same job; no observable divergence.
- fix: `Result.map(Result.mapError(S.decodeUnknownResult(UnknownRecord)(input), (cause) => PackageDecodeError.make({ cause })), sift)` and drop the Cause/Exit imports.

### fable-2-17
- file: scratchpad/effected/package-json/internal/format.ts:246
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws (prefer effect helper modules over native helpers); no Short Law names the delete operator   evidence: stripEmptyDependencyMaps spreads then `delete result[key]`; installed Record.js:310 `R.remove` is the same spread-plus-delete and preserves an own __proto__ data key, so `A.reduce(STRIP_EMPTY_KEYS, raw, (acc, key) => P.isObject(acc[key]) && R.isEmptyRecord(acc[key]) ? R.remove(acc, key) : acc)` is equivalent.
- failure: Imperative delete on a copied record; no observable failure.
- fix: Fold over STRIP_EMPTY_KEYS with R.remove as above; Format.test.ts expectations stay byte-identical.

### fable-2-18
- file: scratchpad/effected/package-json/PackageValidator.ts:108
- class: schema   severity: backlog
- standard: AGENTS.md Discovery & Reuse; schema-first named building blocks   evidence: PackageValidationError.failures re-declares `message: S.String, path: S.Option(S.String)` inline although the exported RuleFailure struct (:37-40) owns those fields.
- failure: Two schema definitions of the same failure shape can drift; no runtime divergence.
- fix: `failures: S.Array(S.Struct({ rule: S.String, ...RuleFailure.fields }))` keeping the encoded shape identical.

### fable-2-19
- file: scratchpad/effected/package-json/License.ts:28
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (Example code uses Effect patterns; canonical @category on documented members); effect-tsgo newSchemaClass is at error for source   evidence: Examples at :28, :45 and :60 construct the error with `new InvalidSpdxLicenseError({...})` while every other example in the module uses `.make` and the ledger records `.make` as the gate-forced constructor; docgen examples are not under tsgo, so the gate misses it. The `message` getter (:52-65) and the `input` field (:37-50) carry no `@category` while every sibling message getter has `@category getters`.
- failure: Public examples teach a constructor form the lab's own gate rejects in source; member tags are inconsistent with the rest of the module.
- fix: Use `InvalidSpdxLicenseError.make({...})` in the three examples; add `@category getters` to the message getter (and `@category models` to the field, matching PackageName.ts:39).

### fable-2-20
- file: scratchpad/effected/package-json/Repository.ts:272
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md carrier and section grammar (cosmetic; docgen green)   evidence: Repository.ts:272-323 JSDoc lines are indented with two spaces instead of the tab-aligned ` *` used everywhere else; LenientManifest.ts:384,404 and Funding.ts:196,216,236,255 start their lead sentence with a double space after `*`; Person.ts:138-139 places the Example fence directly under the `**Example**` heading with no blank line, unlike every other Example in the module.
- failure: Rendered leads carry stray whitespace and one block is visually misaligned; no gate failure.
- fix: Re-indent the Repository block, delete the extra space in the six leads, insert the blank line after the Person Example heading.

### fable-2-21
- file: scratchpad/effected/package-json/README.md:187
- class: docs   severity: backlog
- standard: D4 README adapted (section 10.3); round-1 sol-1-6 changed the parse boundary after the README was written   evidence: README.md:187 says parseResult/parse 'also handles the raw `JSON.parse`' and :227 says PackageJsonParseError 'Carries `path` and the `SyntaxError`'; after sol-1-6 both paths decode through S.fromJsonString and PackageJsonFile.ts:150-154 documents `cause` as 'The schema decoding error'. Port notes (:258+) stay central and are not part of this finding.
- failure: The README body describes error causes the lab no longer produces.
- fix: Reword :187 to 'the pair that also parses the text' and :227 to 'Carries `path` and the `SchemaError` cause'.

### fable-2-22
- file: scratchpad/effected/package-json/README.md:287
- class: docs   severity: backlog
- standard: D2 superset export rule (additions listed under Port notes → Added exports and ledger exportsAdded); round-1 sol-1-5 routed this to the central codemod   evidence: index.ts:50 and :94 now export `LenientFieldIssue` and `RuleFailure` as values; the pinned oracle index.ts exports both as types only (ledger exportsExpected kind 'type'). README Added exports still reads 'None' and the ledger row has exportsAdded: [].
- failure: Two value additions are unrecorded, so ledger --verify cannot see the superset.
- fix: Central bookkeeping lists LenientFieldIssue and RuleFailure (kind value, entry '.') under Added exports and exportsAdded; no worker edit.

### fable-2-23
- file: scratchpad/effected/package-json/Person.ts:217
- class: effect-idiom   severity: backlog
- standard: AGENTS.md keep service boundaries explicit; operator identity-keys ruling (provenance as fields of our own objects); no law cited   evidence: Person.rememberWire (:217-219), Funding.rememberWire (:231-233) and Funding.rememberBareField (:270-272) are public static mutators of private provenance, needed only because the module-level helpers (rememberWire :52, decodeEntry :100) sit outside the class; Repository and Bugs write `#wire` inside their own static codecs and expose no setter.
- failure: Any caller can forge or clear wire provenance on a Person or Funding instance; the three classes disagree on API surface for the same mechanism.
- fix: Move the provenance-writing helpers into the class bodies (as Repository does) or make the setters module-private; keep the wireOf/isBareField readers and their tests.

REQUIRED: 15
BACKLOG: 8
