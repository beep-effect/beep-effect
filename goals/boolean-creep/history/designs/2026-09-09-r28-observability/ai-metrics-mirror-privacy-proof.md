# Instance

- id: `ai-metrics-mirror-privacy-proof`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/library/ai-metrics/src/mirror.ts:552`
- symbol: `AiMetricsMirrorPrivacyProof`
- members: `safe`, `forbiddenMatches`
- evidence: E3/E1 at `mirror.ts:521-531,826-849` — `safe` is exactly
  the emptiness of `forbiddenMatches`, and the production constructor derives
  both from one scan.

# Current shape

The exported schema stores `checkedTokens`, `forbiddenMatches`,
`omittedTables`, and `safe`. It is nested at
`AiMetricsMirrorBundleManifest.privacyProof` (`mirror.ts:653-683`), encoded into
`manifest.json` at lines 1008-1019, and written only after the unsafe guard at
1022-1031. The probe placeholder at 991-1007 is safe plus empty matches and is
replaced by `privacyProofFor` before the final encode. Public JSDoc and
`test/mirror.test.ts:13-69` also construct and assert the safe arm.

# Cardinality gap

Coarsening the array to empty/nonempty yields four representable pairs. Two are
legitimate: safe with an empty array and unsafe with a nonempty array. The
unsafe arm is produced by the scanner but aborts before persistence; it remains
a supported in-process proof outcome. No writer or documentation gives either
mixed pair meaning.

# Target schema

Define schema classes `AiMetricsMirrorPrivacySafe` and
`AiMetricsMirrorPrivacyUnsafe`, tagged by `status`. Keep `checkedTokens` and
`omittedTables` on both. The safe arm carries no match payload; the unsafe arm
carries `forbiddenMatches: S.NonEmptyArray(S.String)`. Combine them with
`S.toTaggedUnion("status")`.

Keep a private encoded schema with the exact legacy fields and order:
`checkedTokens`, `forbiddenMatches`, `omittedTables`, `safe`. Connect it to the
decoded tagged union with `S.decodeTo` and a named fallible transformation.
Decode only safe+empty and unsafe+nonempty; encode the inverse. The public
`AiMetricsMirrorPrivacyProof` remains the compatibility codec and its decoded
TypeScript constructor shape migrates atomically.

# Migration inventory

- `mirror.ts:516-562` — add the two annotated cases, tagged union, exact legacy
  encoded schema, and bidirectional transformation; update public examples.
- `mirror.ts:653-683,746-763` — keep the manifest/result codecs and nested field
  position unchanged while their decoded proof type becomes the union.
- `mirror.ts:826-849` — construct safe or unsafe directly from the filtered
  matches; remove the derived boolean write.
- `mirror.ts:991-1023` — build the placeholder safe case, replace it with the
  scanned result, and match the union before any status/manifest/pointer write.
- `mirror.ts:1083-1125` and `test/mirror.test.ts:13-69` — migrate direct
  constructors and retain exact bundle JSON.

# Guard-deletion accounting

Delete the `safe: A.isReadonlyArrayEmpty(forbiddenMatches)` field write and the
boolean/array coherence burden. Replace `if (!privacyProof.safe)` with the
tagged-union unsafe branch. Retain the privacy failure itself before all writes;
the new type removes only the possibility of testing an incoherent pair.

# Encoded-side impact

Tier 2 persisted manifest compatibility. Compare old and new canonical
`encode(decode(payload))` for safe+empty and representative unsafe+nonempty
proofs, preserving field names, array order, string contents, boolean values,
and property order. Preserve the exact manifest fixture bytes at
`mirror.test.ts:69`. Explicitly reject the two incoherent legacy pairs; schema
permissiveness alone is not a supported contract. Status and latest-pointer
encodings are unchanged.

# Test impact

Retain the exact safe manifest snapshot and bundle build/write-order tests. Add
codec equality for both legitimate arms and decode failures for mixed pairs.
Use synthetic forbidden labels only. Prove unsafe returns the existing
`AiMetricsMirrorError` before status, manifest, latest-pointer, sync, or cleanup
success behavior can claim a bundle.

# Risk and sequencing

Keep the change within `@beep/repo-ai-metrics` and its tests. The key risk is
accidentally making the persisted-only-safe invariant erase the supported
pre-write unsafe result; model both arms, then retain the existing failure gate.
Do not change forbidden token detection or mirror privacy policy.
