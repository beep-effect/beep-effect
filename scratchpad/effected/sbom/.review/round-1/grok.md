I'll review the sbom port at that commit against the pinned upstream oracle and the binding decisions, and report findings only.### grok-1-1
- file: scratchpad/effected/sbom/SigstoreSigner.ts:67
- class: law   severity: required
- standard: D9 and section 14; D5; `effect/Schema.ts` `TaggedError` (`identifier ?? tag`) and `Schema.Error` (`name: identifier`)   evidence: upstream `Schema.TaggedError<SigningError>()("SigningError", …)` leaves `name` as `"SigningError"`. The lab passes `$I\`SigningError\`` (`$ScratchpadId.create("effected/sbom/SigstoreSigner")`), which `Schema.Error` installs as `name` (`@beep/scratchpad/effected/sbom/SigstoreSigner/SigningError`). The same identifier is the `Context.Service` key (`IdentityToken.ts:87`, `SigstoreSigner.ts:218`), replacing `@effected/sbom/IdentityToken` and `@effected/sbom/SigstoreSigner`. `makeTest` now throws `UnstubbedSigstoreSignerError` (`SigstoreSigner.ts:183`) where upstream throws `Error`. `String(error)` and the first line of `Cause.pretty` follow `name`. README Deviations is "None" and `PORT_LEDGER.json` `w4-sbom.deviations` is `[]`.
- failure: error `name`, pretty-printed causes, and service keys differ from upstream, and the difference is unrecorded. `_tag` and the overridden `message` text stay the same, so the existing tests still pass.
- fix: keep the identity (law-forced). Add one ledger deviation for this class (`reason: law:D5`) covering every tagged error and both service keys, plus the `makeTest` throw, cite a small test that pins `name` and the service id, and copy that entry under Port notes → Deviations.

### grok-1-2
- file: scratchpad/effected/sbom/SbomDocument.ts:175
- class: law   severity: required
- standard: D9 and section 14; `~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md` (Number accepts every number; Finite rejects `NaN`, `Infinity`, and `-Infinity`); effect-tsgo `schema-number`   evidence: upstream `SbomDocument.version` is `Schema.Number` (`src/SbomDocument.ts:171`). The lab is `S.Finite`. That rule is on at error, so the edit is law-forced. No deviation is recorded.
- failure: `Schema.decodeUnknown(SbomDocument)` rejects a non-finite `version` that upstream accepts. `Sbom.generate` still stamps `1`, so the emitter tests do not see it.
- fix: keep `S.Finite`. Record one `law:schema-number` deviation, and pin it with a decode of a non-finite `version` that expects failure.

### grok-1-3
- file: scratchpad/effected/sbom/SbomDocument.ts:34
- class: schema   severity: required
- standard: AGENTS.md Code Laws; `.agents/skills/schema-first-development/references/repo-laws.md` (LiteralKit for a named literal domain; `S.Literals` only for an anonymous union never referenced by name); D5   evidence: the four beep laws do not check this. Named, exported domains are `S.Literals`: `ComponentType` (`SbomDocument.ts:34`), `ExternalReferenceType` (`SbomDocument.ts:53`), `NtiaElementId` (`NtiaReport.ts:32`), `SigningErrorKind` (`SigstoreSigner.ts:47`). Each is referenced by name.
- failure: the literal domains do not have `LiteralKit`'s `.Enum`, `.is`, and `.$match` surface. Wire values stay the same strings, so this is not a D9 deviation.
- fix: replace each `S.Literals([...])` with `LiteralKit([...])` and keep the existing `$I.annoteSchema` pipe. Do not add `as const` on the array.

### grok-1-4
- file: scratchpad/effected/sbom/README.md:199
- class: docs   severity: backlog
- standard: section 10.3 Attribution and Dependency backlog; section 13 (`@sigstore/bundle`, `@sigstore/sign` → keep, isolate behind a port interface at promotion); D3   evidence: Attribution lists source lines (`SbomDocument.ts` SPDX import, a copyright comment, a sigstore re-export comment, `type CopyrightYears`) rather than vendored-engine notices. Dependency backlog says "None". `w4-sbom.newDeps` has both sigstore packages with `replacement: null`, and `backlog` is `[]`.
- failure: Port notes claim there is nothing to carry forward for attribution or for the two runtime dependencies section 13 already names.
- fix: replace those attribution bullets with "none" unless a real vendored-engine header exists upstream, and add the two section 13 rows to Port notes and to `newDeps[].replacement`.

### grok-1-5
- file: scratchpad/effected/sbom/SbomMetadataSource.ts:55
- class: jsdoc   severity: backlog
- standard: section 10.2; `.patterns/jsdoc-documentation.md`   evidence: S2 has not run. Exported blocks still use `@remarks`, `@example`, and `@public` (this interface, and the same carriers across the module). No `@category` or `@since`.
- failure: docgen's beep carrier checks are not satisfied yet. This is the pending S2 conversion, not a gate miss.
- fix: convert carriers in the S2 pass: `@remarks` to `**Details**` or `**Gotchas**`, `@example` to `**Example** (Title)`, add `@category` and `@since 0.0.0`, and keep every upstream sentence.

### grok-1-6
- file: scratchpad/effected/sbom/README.md:3
- class: docs   severity: backlog
- standard: section 10.3   evidence: npm, license, Node, and TypeScript badges are still on lines 3–6; the pre-1.0 stability block is lines 10–20; Install is lines 30–42. Quick-start samples still import from `@effected/sbom` (line 49).
- failure: the README is still the upstream package page with a lab title and a Port notes footer.
- fix: during S2, drop the badges, the stability block, and Install; rewrite samples to lab relative imports; keep the Why, API, and fidelity prose.

### grok-1-7
- file: scratchpad/test/sbom/Sbom.test.ts:44
- class: test   severity: backlog
- standard: section 11.2 and 11.4; `goals/effect-vitest-canon/SPEC.md`; D10   evidence: S3 has not run. Suites are still plain `it` around pure functions, with `node:fs` reads in `conformance.test.ts` and `new Set` / `Object.keys` at `conformance.test.ts:174`. No `Arbitrary.schema` round-trip property for the exported schemas.
- failure: the vitest canon and the property floor are not in place. Upstream assertions were kept, so this is not a weakened test.
- fix: do this in the S3 pass: `it.effect` where the body is an Effect, canon assert helpers for Option and Result, and one `fcRuns` round-trip property per exported schema. Leave the environment-bound reachability failures in `TESTS_NOT_PASSING.md` until that recorded ruling is applied.

REQUIRED: 3
BACKLOG: 4
