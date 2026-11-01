### fable-1-1
- file: scratchpad/effected/sbom/Sbom.ts:67
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native Array.prototype.sort; use A.sort with an explicit Order); D9   evidence: `components: [...input.components].sort((a, b) => a.name.localeCompare(b.name))`. The four mechanical checkers that are green (effect-imports, effect-fn, terse-effect, native-runtime) do not scan for `.sort(` on a spread receiver (rg over the policy-pack native-runtime checker finds no sort rule), so the gate did not enforce this. Installed effect 4.0.2 has `Order.make<A>(compare: (self, that) => -1|0|1)`, `Order.mapInput`, `A.sort` (copies via Array.from then sorts: same stable ordering) and `Str.localeCompare(that)(self)` = `Number.sign(self.localeCompare(that))`, so the fix can keep the upstream `localeCompare` ordering exactly (upstream Sbom.test.ts:42 pins ['alpha','zulu']).
- failure: Law 10 is violated in module source while the law gate reports green; a reviewer reading the lab as law-clean is misled.
- fix: Add `import * as A from "effect/Array"; import * as Order from "effect/Order"; import * as Str from "effect/String";` and replace the spread-sort with `A.sort(input.components, Order.mapInput(Order.make<string>((a, b) => Str.localeCompare(b)(a)), (c: Component) => c.name))`. Do not switch to `Order.String` (code-unit order differs from localeCompare for mixed case; that would be an unlicensed D9 deviation).

### fable-1-2
- file: scratchpad/effected/sbom/SbomDocument.ts:34
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains, especially annotation-bearing ones; S.Literals only for anonymous inline unions never referenced by name); AGENTS.md Code Laws; D5 (kits during S4)   evidence: Four exported, named, annotation-bearing literal domains are built with `S.Literals([...]).pipe($I.annoteSchema(...))`: `ComponentType` (SbomDocument.ts:34), `ExternalReferenceType` (SbomDocument.ts:53), `NtiaElementId` (NtiaReport.ts:32), `SigningErrorKind` (SigstoreSigner.ts:47); each is referenced by name as a field schema and as `typeof X.Type`. Precedent in the modules already at the bar: jsonl JsonlError.ts:513 `LiteralKit(["truncated","replaced"]).pipe($I.annoteSchema(...))`, jsonc JsoncNode.ts:111. No law gate checks the constructor choice.
- failure: The domains lack LiteralKit's `.Enum`, `.is`, `$match` surface and diverge from the kit's own idiom; wire values are unchanged so this is not a D9 deviation.
- fix: In each of the four sites replace `S.Literals([` with `LiteralKit([` (import `{ LiteralKit } from "@beep/schema/LiteralKit"`), keep the existing `.pipe($I.annoteSchema(...))`, the `.annotateKey(...)` call sites and `export type X = typeof X.Type`; no `as const` on the arrays.

### fable-1-3
- file: scratchpad/effected/sbom/SbomDocument.ts:171
- class: law   severity: required
- standard: D9 (behaviour-preserving; every deviation recorded in README Port notes → Deviations and the ledger, citing the adjusted upstream test); EFFECTED_PORT_GOAL.md section 14 (write the ledger entry first); 2026-10-09 ruling: one entry per module per systemic class (identity keys, S.Finite, tagged errors)   evidence: README Port notes say `Deviations: None` and ledger row `w4-sbom.deviations` is `[]`, yet the commit carries three systemic-class deviations: (1) `version: S.Finite` where upstream is `Schema.Number` — read-only probe: `SbomDocument.make({..., version: Infinity})` and `NaN` throw `Schema validation failed` in the lab while upstream accepts them; (2) SigstoreSigner.ts:177-187 `unstubbed` now throws `UnstubbedSigstoreSignerError` (a `S.TaggedError`, law 7) instead of `new Error(...)` — `name`/`_tag` differ, message preserved (the upstream `/not stubbed/` assertion at SigstoreSigner.test.ts:264 still passes); (3) identity keys: every error identifier and both `Context.Service` keys are now `$I`-derived (`@beep/scratchpad/effected/sbom/...`) instead of `@effected/sbom/...`, and reachability.test.ts:109,112,132-136,150-153 were retargeted from `["effect"]` to `["@beep/identity/packages", "effect/..."]` sets — adjusted upstream assertions that no entry cites. jsonl (23) and jsonc (12) already carry such entries; sbom carries none.
- failure: Accepted inputs, error identity and the confinement assertions differ from the oracle with no recorded cause or cited adjusted test, so the module cannot pass the D9 gate and the differences are invisible to the next session.
- fix: Keep the law-forced code. Add `w4-sbom.deviations` entries (one per systemic class: `law:schema-finite` for SbomDocument.ts:171, `law:effect-laws-v1#7` for the unstubbed error, `law:D5-identity`/`law:effect-laws-v1#2` for identifiers, service keys and the reachability retargets) each naming the sites and the adjusted test lines above, and mirror them under README Port notes → Deviations (the codemod the 2026-10-09 ruling names produces exactly this).

### fable-1-4
- file: scratchpad/effected/sbom/InTotoStatement.ts:106
- class: schema   severity: required
- standard: D5 (`$ScratchpadId` identity annotations on every exported schema); EFFECTED_PORT_GOAL.md step 4 (every schema takes its identity from the IdentityComposer)   evidence: `export const Sha256Digest = class extends S.String.pipe(S.check(S.isPattern(SHA256_RE)), S.brand("Sha256Digest")) {...}` carries no `$I.annoteSchema`. Read-only probe: `Sha256Digest.ast.annotations` is `null`, while sibling exported schemas in the same module and package carry `identifier`/`title`/`iri`/`curie` (e.g. `ComponentType.ast.annotations.identifier === "@beep/scratchpad/effected/sbom/SbomDocument/ComponentType"`). The step-4 commit (6dfdd9c6f1) missed this export.
- failure: The one exported branded schema has no canonical identity, so JSON Schema/docgen output and identity-keyed tooling cannot name it; the step-4 bar is not met for this module.
- fix: Insert `$I.annoteSchema("Sha256Digest", { description: "A SHA-256 digest as 64 lowercase hexadecimal characters, without an algorithm prefix." })` as the last step of the `S.String.pipe(...)` chain the class extends; the pattern, brand and the `schema.pattern` assertion at InTotoStatement.test.ts:193 are unaffected.

### fable-1-5
- file: scratchpad/effected/sbom/InTotoStatement.ts:107
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (named domain constraints are schemas first; derive guards with `S.is(...)`)   evidence: `static isValid = (value: string): boolean => SHA256_RE.test(normalizeDigest(value));` keeps a second, regex-based predicate for the same constraint that `parseResult` (line 89) already derives from the schema via `S.is(Sha256Digest)(normalized)`. Probe: `S.is(Sha256Digest)` and `SHA256_RE.test` agree on every tested input (lowercase hex true, uppercase false), so the swap is behaviour-neutral.
- failure: Two sources of truth for one domain constraint; a later edit to the schema check (e.g. the annotation in fable-1-4 or a stricter pattern) would silently diverge from `isValid`.
- fix: `static isValid = (value: string): boolean => S.is(Sha256Digest)(normalizeDigest(value));` (the arrow resolves `Sha256Digest` at call time, as `parseResult` already does).

### fable-1-6
- file: scratchpad/effected/sbom/NtiaReport.ts:143
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws (prefer effect helper modules over native/raw forms); repo precedent `Result.isSuccess` 184 uses vs `._tag === "Success"` 3 in packages/**, 8 vs 0 in jsonl+jsonc   evidence: `stamped !== undefined && parseTimestamp(stamped)._tag === "Success" ? stamped : undefined` compares the Result discriminant by string. Behaviour is correct: installed `S.DateFromString` is `String → new Date(u) → Date (rejects NaN getTime)`, which the probe confirmed matches `!Number.isNaN(Date.parse(s))` on ISO, loose ("March 5, 2024"), numeric and garbage inputs, so this is idiom only.
- failure: Raw discriminant comparison instead of the Result guard the rest of the repo uses; no observable failure.
- fix: `Result.isSuccess(parseTimestamp(stamped))` with `import * as Result from "effect/Result"`.

### fable-1-7
- file: scratchpad/effected/sbom/SigstoreSigner.ts:245
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (direct helper refs over trivial wrapper lambdas); the terse-effect checker is green, so it missed this wrapper   evidence: `sign: overrides.sign ?? (() => unstubbed())` wraps a zero-arg `() => never` in another zero-arg lambda; `unstubbed` is assignable to `(statement) => Effect<...>` because `never` is assignable to any return. Same shape in the test at SigstoreSigner.test.ts:37: `Result.getOrThrowWith(..., (error) => error)` instead of `identity` from `effect/Function`. Upstream carries the first wrapper verbatim, so this is lab-idiom only.
- failure: None observable; a wrapper the terse law forbids survives a green gate.
- fix: `sign: overrides.sign ?? unstubbed` and `Result.getOrThrowWith(Sha256Digest.parseResult(HEX), identity)`.

### fable-1-8
- file: scratchpad/effected/sbom/SlsaProvenance.ts:58
- class: schema   severity: backlog
- standard: EFFECTED_PORT_GOAL.md step 4 (annotations on fields and schemas); jsdoc-annotation-specialist rubric ($I.annote/annotateKey gaps); S2 pending by operator order   evidence: Only the top-level fields of `SlsaBuildDefinition`, `SlsaRunDetails` and `SlsaProvenance` got `annotateKey`; the nested `S.Struct` fields keep their `/** */` comments but no AST annotation: `externalParameters.workflow.{ref,repository,path}` (59-67), `internalParameters.github.{event_name,repository_id,repository_owner_id,runner_environment}` (70-80), `resolvedDependencies[].{uri,digest}` (85-90), `builder.id` (101-104), `metadata.invocationId` (106-108). Likewise `UnstubbedSigstoreSignerError.message` at SigstoreSigner.ts:180 is the only error field in the module without `annotateKey`.
- failure: Field descriptions are lost to JSON Schema and docgen for the nested provenance shape; no runtime effect.
- fix: Move each nested `/** ... */` comment into `.annotateKey({ description })` on that field (and annotate the `message` field); shapes and decoding unchanged.

### fable-1-9
- file: scratchpad/effected/sbom/README.md:199
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3 (Port notes → Attribution lists vendored-engine notices); D4   evidence: Lines 199-202 under Attribution are raw scan hits, not attribution: `SbomDocument.ts:11 import { License, isValidExpression } ...`, `SbomMetadataSource.ts:16 // ... copyright year.`, `SigstoreBundle.ts:7 // re-exported from @sigstore/bundle.`, `index.ts:40 type CopyrightYears,` — every line contains `License`/`copyright`/`re-export`, i.e. the attribution keyword scan dumped its matches. Upstream carries no vendored-engine notice for sbom.
- failure: The port notes assert attribution obligations that do not exist and omit the real section-13 dependency rows (`@sigstore/bundle`, `@sigstore/sign` sit in `newDeps` with `replacement: null` while Dependency backlog says None).
- fix: Replace the four bullets with `None` and fill Dependency backlog with the two `@sigstore/*` rows; fix the attribution scanner in the runner (outside this surface) to require a real notice header, not a keyword hit.

### fable-1-10
- file: scratchpad/effected/sbom/README.md:33
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3 (README adaptation); standards/effect-laws-v1.md law 2 (root `effect` barrel not used, including in Markdown examples); S2 pending by operator order   evidence: Only the title and the Port notes footer differ from upstream README.md. Install (33, 37) still says `npm install @effected/sbom effect`; every example imports from `"@effected/sbom"` (49, 74, 94, 128, 152, 167) and `{ Effect } from "effect"` / `{ Effect, Layer } from "effect"` (75, 95, 129, 153, 168).
- failure: The README documents the npm package, not the lab module, and its examples violate the import law the source already satisfies.
- fix: In the S2 pass rewrite examples to `../../effected/sbom/index.ts` (or the lab entry) with per-module `effect/*` imports, drop Install/badges/stability block, keep the Why/Features/fidelity prose verbatim.

### fable-1-11
- file: scratchpad/test/sbom/reachability.test.ts:178
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 16 (never native Set/Map) vs section 11.1 (S1 keeps upstream tests verbatim); S3 canon migration pending by operator order; D6   evidence: Upstream-verbatim tests keep native collections: `const declared = new Set([...])` (reachability.test.ts:178), `const known = new Set(Object.keys(...))` (conformance.test.ts:267 and the `known(name)` helper feeding lines 174-180), plus native `.sort()` on the reachable-import arrays (reachability.test.ts:139, 142). Tests are outside the law scope, so no gate flags them.
- failure: The test surface contradicts the kit's hard rule once S3 runs; no behaviour impact.
- fix: In S3 replace the `Set` sites with `HashSet.fromIterable`/`HashSet.has` from `effect/HashSet` and the `.sort()` calls with `A.sort(..., Order.String)`, keeping every assertion.

### fable-1-12
- file: scratchpad/effected/sbom/NtiaReport.ts:97
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 17 (named domain constraints modeled as schemas first); crispen (absorb invariants into schemas)   evidence: NTIA element 4 is checked with an ad-hoc predicate `purl?.startsWith("pkg:") === true` and `present` (71-75) hand-rolls trim-non-empty; `SbomMetadataSource.ts:137` builds the vcs Option with a ternary `pkg.repository === undefined ? O.none<string>() : pkg.repository.browseUrl` instead of an Option chain. All are behaviour-neutral to replace.
- failure: Constraints the report is named for (purl shape, non-blank value) live in predicates rather than schemas, so they cannot be reused by `Component.purl` or surfaced in JSON Schema.
- fix: Introduce `const Purl = S.String.pipe(S.startsWith("pkg:"))` and a trimmed non-empty string schema, derive `S.is(...)` guards for `uniqueIdentifier`/`present`; write the vcs lookup as `O.fromNullable(pkg.repository).pipe(O.flatMap((r) => r.browseUrl))`.

REQUIRED: 5
BACKLOG: 7
