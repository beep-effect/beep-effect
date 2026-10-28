# Prerequisite compatibility — 2026-10-28

Reviewer: Codex. Reviewed base: `4cf7cbef916cdc0d0b8a13c1bc44f7ea8d35de94`.

Result: the published anchor and court/reporter identity contracts are available
and compatible with the engine's representation and ownership requirements.
The packet's former assertion that both public contracts are unfinished is
stale. This clears that dependency hold only; P0 accounting, normalized corpus,
regex strategy, limits, and all later parity gates remain open.

## Exact contracts

- `@beep/provenance/SourceTextIdentity`, package `0.0.0`:
  `SourceTextIdentity`, `SourceTextDigest`, `SourceTextExtractor`.
  Source identity retains extractor/normalization versions and exact
  artifact/text digests.
- `@beep/provenance/TextAnchor`, package `0.0.0`:
  `TextAnchor`, `isUtf16Boundary`. Half-open UTF-16 coordinates:
  `startChar`, `endChar`, `quote`.
- `@beep/provenance/VerifiedTextAnchor`, package `0.0.0`:
  `VerifySourceTextIdentityInput`, `VerifiedSourceText`,
  `verifySourceTextIdentity`, `VerifyTextAnchorAgainstVerifiedSourceInput`,
  `verifyTextAnchorAgainstVerifiedSource`, `VerifyTextAnchorInput`,
  `verifyTextAnchor`, `VerifiedTextAnchor`, `TextAnchorVerificationReceipt`,
  `toTextAnchorVerificationReceipt`, `VerifiedTextAnchorError`.
  Runtime capabilities are from-self proofs; structural receipts require
  re-verification.
- `@beep/langextract/VerifiedSpan`, package `0.0.0`:
  `TextOffsetRange`, `Utf16TextRange`, `convertTextOffsetRange`,
  `RawTextChunk`, `reconstructSourceText`, `locateRawText`,
  `locateGroundedExtractions`, `VerifiedSpanError`,
  `VERIFIED_SPAN_NORMALIZATION_VERSION`, `MAX_SOURCE_TEXT_LENGTH`.
  Normalization `1`; source limit 1,000,000 UTF-16 units.
- `@beep/law-practice-domain/values/CourtReporterVocabulary`,
  package `0.0.2`: `CourtId`, `ReporterId`, `CourtReporterArtifactContract`,
  `CourtReporterArtifact`, `CourtVocabulary`, `ReporterVocabulary`,
  `findCourtById`, `findReporterById`, `findCourtsByAlias`,
  `findReportersByAlias`, `isCurrentCourtReporterArtifactVersion`,
  `classifyCourtReporterArtifactCompatibility`.
  Schema `court-reporter-vocabulary/v1`; projection `1`;
  artifact `crv1:f353e51400a5:fad63b383b92`.

Source paths and package export maps were inspected. Both prerequisite READMEs
now declare `completed-retained`. This record establishes current consumer
compatibility; it does not independently re-certify their historical hosted
merge receipts.

## Approved adaptations and boundaries

1. Convert Python code-point ranges through `convertTextOffsetRange` using the
   exact raw source. The consumer test proves `A😀B` range `[1,2)` becomes
   UTF-16 `[1,3)` and reproduces the emoji. Do not create a second public span
   or offset converter in law-practice.
2. Verify the full raw source once, then verify each occurrence against the
   opaque `VerifiedSourceText`. Capture the `Crypto` service in the live Layer
   so engine methods still have `R = never`; the prerequisite's own verifier
   legitimately requires `Crypto` at construction/composition time.
3. Keep runtime `VerifiedTextAnchor` proofs distinct from persistable
   `TextAnchorVerificationReceipt`. A structured receipt is not proof and
   cannot be decoded into a runtime capability without canonical source text.
   Persist the receipt, re-verify on restoration, and preserve that boundary in
   the future mention codec. No guessed structural replacement is approved.
4. Respect the prerequisite's 1,000,000-unit source ceiling when freezing the
   engine limits. Tighter limits are permitted; silently bypassing a public
   prerequisite limit is not.
5. Consume the version-gated public vocabulary and ambiguity-preserving alias
   lookups. `Woolw.` returns two reporters. The engine must retain candidates
   until date/court context can disambiguate them. No first-match shortcut or
   import from `internal/generated/` is approved.
6. Public vocabulary records intentionally omit parsing regexes and raw
   template data. Parser-pattern acquisition and exact oracle-data coverage
   remain separate P0 accounting work. These identity checks do not prove that
   all oracle reporters/laws/journals or pattern families are representable.
7. The public verified-span barrel exposes location/conversion/reconstruction,
   not its private normalization offset-map implementation. Use the public
   operations. Any engine-local cleaning map must remain private, retain exact
   raw-source verification, and be justified case by case; no new public
   durable-locator contract or private-module reach-through is approved.

## Reproduction and observed results

Run from the feature checkout:

```sh
bun run --cwd packages/law-practice/use-cases test -- test/CitationPrerequisites.test.ts
(cd packages/foundation/modeling/provenance && \
  bunx vitest run test/TextAnchor.test.ts test/VerifiedTextAnchor.test.ts)
(cd packages/foundation/capability/langextract && \
  bunx vitest run test/VerifiedSpanSpike.test.ts test/VerifiedSpanHistory.test.ts)
(cd packages/law-practice/domain && bunx vitest run test/CourtReporterVocabulary.test.ts)
```

| Lane | Result |
| --- | --- |
| Engine public-import compatibility | 2 passed |
| Provenance anchor construction, receipts, scope/digest/drift | 21 passed |
| Verified-span Unicode, normalization, straddle, history | 37 passed |
| Vocabulary artifact/identity/lifecycle contracts | 15 passed |

The consumer test imports only published subpaths. Its exact artifact check
accepts the current version and rejects `stale`, validates 2,809 courts and
1,262 reporters, resolves a stable court ID, and preserves reporter ambiguity.
No production schema, engine service, or public API was frozen by this probe.
