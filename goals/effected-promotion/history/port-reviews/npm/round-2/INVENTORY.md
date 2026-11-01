# npm — round-2 merged review inventory

Seats read: `grok.md`, `sol.md`, and `fable.md`, with `BRIEF.md` and the third-seat `BRIEF.grok3.md`. No `part-N` reports exist. The third seat is the separate grok-4.7 medium session identified in `fable.md`. Review baseline: `60fcfb5ebcdc26765a66cc1f13afc88adcb05d11`; pinned oracle: `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.

Counts: **Required 5 · Backlog 0 · Codemod 0 · Rejected 0 · Groups 4**. Nine seat findings normalize to five defects. The native string-helper sites share one root cause; the independent hex encoder is a separate defect. `grok-2-1` contributes evidence to both. All contributing finding ids appear below.

Binding basis: the complete operator revision block (including the 2026-10-09 rulings and later grilling), D1–D20, sections 12.4–12.5 and 14, and the task's S2/S3 and write-surface restrictions. Claims of completed S2/S3 in the briefs do not override those restrictions. No docs, JSDoc, coverage, or vitest-canon findings were submitted. Evidence from seat probes is attributed rather than represented as a new test run.

The live branch is `@lab/effected-2`. A read-only diff against the review baseline shows no changes under npm source or tests. File history on both the live head and review baseline exposes the squashed port commit `7929b1f529` (`feat(scratchpad): effected kit port, round 1 and S2/S3 progress (effected-port) (#1592)`); its file diffs add these module files. No finding below calls a lab change unforced or asks to restore a diagnostic/law-forced change. The defects are remaining upstream behavior or idioms, not unsupported claims about pre-squash diagnostic provenance.

The current `standards/effect-laws.allowlist.jsonc` contains **zero npm entries** (and zero `scratchpad/effected` entries). Consequently there are no new `allow-<n>` records. Round-1 `allow-1` and `allow-2` concern schema-static replacements already present in the reviewed source; historical inventory entries are not live allowlist entries.

Groups own disjoint source and test files, with one source file per group. IntegrityHash's two findings share g2. The tests listed in `required.json` are the concrete regression/contract files assigned for any necessary changes; existing unrelated coverage and property files remain verification inputs. Ledger, README Port notes, allowlist registry, and repository configuration are outside every group's write surface. Supply any new deviation evidence to the central codemod without editing its bookkeeping surfaces.

## Required

### npm-2-1

- file: scratchpad/effected/npm/Manifest.ts:431
- class: bug   severity: required
- standard: D9; section 14, verified upstream bug; Manifest dependency-map preservation contract
- evidence: `sol-2-1` reports read-only probes against both the reviewed commit and pinned oracle: decoding `{"dependencies":{"__proto__":"1.0.0","p":"1.2.3"}}` preserves both keys before resolution, but resolving with no-op resolver layers yields only `{"dependencies":{"p":"1.2.3"}}`. Source inspection confirms `resolved` is an ordinary `{}` at :403 and all three branches assign `resolved[dependency]` at :410, :428, and :431. Round-1 `npm-1` and its existing tests address the separate unknown-field decoder path, not dependency resolution.
- failure: Resolving a manifest silently loses an own `__proto__` dependency entry because assignment invokes the inherited prototype setter. Concrete specifiers that require no lookup are affected too; green gates did not detect this data loss.
- fix: Collect resolved dependency entries in every branch and construct each output section with `effect/Record.fromEntries`. Add a regression in `scratchpad/test/npm/Manifest.test.ts` asserting that resolution preserves the complete own dependency map, including `__proto__`; cover concrete and resolver-produced values without weakening existing oracle assertions. Supply this additional upstream-bug correction and the regression reference to the central deviation codemod.
- seats: sol-2-1
- group: g1

### npm-2-2

- file: scratchpad/effected/npm/IntegrityHash.ts:128
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; AGENTS.md Code Laws; D5/D11
- evidence: The remaining native string helpers are `slice`/`indexOf` in `algorithmOf` (:128–130), `indexOf`/`slice` in `decodeBase64` (:443–445), `slice` in `bytesOfHex` (:492), `startsWith`/`endsWith`/`slice` in `unwrapJsonQuotes` (:512), `startsWith`/`slice` in `corepackOfSri` (:520–521), and `slice` in `sriOfCorepack` (:530). All three seats identify these sites and equivalent `effect/String` helpers. `NoNativeRuntime.ts` defines only `split`, `trim`, `startsWith`, and `endsWith` as string methods (:88) and checks them only in hotspot scope (:467); it does not enforce this full EF-5 requirement. These are different sites from the closed round-1 helper findings.
- failure: Integrity parsing and conversion retain native domain string helpers despite the equivalent Effect helpers required by EF-5. Reported green gates do not cover these concrete sites.
- fix: Replace the listed calls with equivalent `effect/String` helpers. Preserve `indexOf`'s missing-index behavior by converting its `Option` result to the existing `-1` branch, and preserve every substring cut, quote-unwrapping rule, and strict base64 check. Keep the canonical base64 sextet loops and `charCodeAt`/`charAt` logic. Keep `bytesOfHex`'s validated-pair `Number.parseInt` loop, replacing its string slicing; do not introduce `Hex.decode`'s additional failure channel merely to address these calls. Preserve and, if necessary, extend the separator, quoted/unpadded-input, and malformed-input assertions in `scratchpad/test/npm/IntegrityHash.test.ts`.
- seats: grok-2-1, sol-2-2, fable-2-1
- group: g2

### npm-2-3

- file: scratchpad/effected/npm/IntegrityHash.ts:486
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; AGENTS.md Code Laws; D5/D11; same encoding idiom as round-1 npm-36
- evidence: `hexOfBytes` (:486–487) still uses `bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")`. `grok-2-1` and `fable-2-2` cite `effect/encoding/Hex.encode`'s equivalent lowercase two-digit byte spelling. Its only caller passes `decodeBase64` bytes masked with `& 0xff`; constructing a `Uint8Array` therefore preserves those values. The native-runtime string detector does not include `padStart` or `join`, and the four reported law gates do not enforce this encoding substitution. Round-1 npm-36 fixed PackagePublish's encoder, not this one.
- failure: The corepack SHA-512 bridge retains a hand-built native array/string encoder where an equivalent Effect encoder exists. This is a cited idiom defect, not a performance claim or a bookkeeping-only omission.
- fix: Implement `hexOfBytes` with `Hex.encode(new Uint8Array(bytes))` imported from `effect/encoding/Hex`, deleting the map/padStart/join body. Preserve the existing known SHA-512 conversion and canonical padded-SRI inverse assertions in `scratchpad/test/npm/IntegrityHash.test.ts`; extend that file only if needed to establish byte-for-byte lowercase hex equivalence. Leave the stricter custom base64 decoder in place.
- seats: grok-2-1, fable-2-2
- group: g2

### npm-2-4

- file: scratchpad/effected/npm/ReleaseAgeGate.ts:102
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5; AGENTS.md Code Laws; D5/D11
- evidence: All three seats identify `if (!pattern.includes("*")) return false`. `Str` is already imported, and `effect/String.includes` delegates to the same native operation with the same arguments. `NoNativeRuntime.ts:88` does not include `includes`, so the reported green law gate does not enforce this site. Recorded date/collection deviations do not authorize this native string helper.
- failure: The release-age exclusion matcher retains a direct native string helper in domain logic in violation of EF-5.
- fix: Replace `!pattern.includes("*")` with `!Str.includes("*")(pattern)`. Preserve exact-name and pnpm wildcard behavior, including matching across `/`, and keep the two-pointer scan unchanged. No test-file edit is required for this equivalent substitution; use the existing ReleaseAgeGate test suites as verification inputs.
- seats: grok-2-2, sol-2-3, fable-2-3
- group: g3

### npm-2-5

- file: scratchpad/effected/npm/CatalogAssemblyError.ts:96
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 20; standards/effect-first-development.md EF-13; D5/D11; D9 external-boundary compatibility
- evidence: `source` (:68) and optional `reason` (:96–98) are independent fields of the tagged error. The source says that reason belongs only to hooks failures, yet the public schema permits a manifest/catalog payload with `reason: "fetchFailed"`; no internal source-specific schema normalizes this bag. `fable-2-4` identifies the same shape in the oracle. Round-1 npm-19/npm-20/npm-21 introduced analogous internal variants for other errors, and `NpmRegistry.ts:176–221` supplies an existing public-payload/internal-union projection pattern. Green type/lint and the four law gates do not establish the relationship between these two fields; the round-trip property also generates from the same permissive schema.
- failure: The domain has no validated distinction between hooks-specific resolution reasons and manifest/catalog assembly failures. This is the case-specific optional-bag pattern forbidden by law 20 and EF-13, not a documentation finding.
- fix: Add annotated internal variants discriminated by `source`: manifest and catalog with path/cause and no reason, hooks with path/cause and optional reason. Normalize the compatible public payload through a facade/transform and use the internal model for source-specific interpretation, following the existing NpmRegistry pattern. Preserve the public error tag, fields, messages, cause behavior, and existing encoded inputs; accepting the external bag remains compatible while irrelevant reason fields are absent from internal manifest/catalog cases. Add variant/projection regressions in `scratchpad/test/npm/CatalogAssemblyError.test.ts` and adjust `scratchpad/test/npm/CatalogAssemblyError.property.test.ts` only as needed for the normalized schema contract. Identify any law-forced adjusted upstream assertion for central deviation recording; do not hand-write ledger or Port notes.
- seats: fable-2-4
- group: g4

## Backlog

None. No submitted finding falls outside D11, concerns deferred S2/S3 work, or requires a repository-level write.

## Handled by the deviation codemod

None as standalone findings. The seats require actual code corrections rather than merely recording an already forced change. Incidental deviation/export bookkeeping requested alongside an accepted correction belongs to the central per-module, per-class codemod and creates no additional required record or write assignment.

## Rejected

None. Each deduplicated defect has concrete evidence, a cited binding standard or verified bug, and an in-surface fix. Green-gate blind spots are explained above. Duplicate seat records are merged rather than counted as rejections. `grok-2-1`'s optional Hex.decode expansion is narrowed to the demonstrated defects; validated hex parsing can retain its existing failure-free loop with Effect string slicing.
