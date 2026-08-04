# P1 Provenance + Langextract Substrate Evidence

Date: 2026-07-29
Scope: `@beep/provenance` and `@beep/langextract` only
Verdict: PASS for this owned slice

## Implemented Contract

- `@beep/provenance/SourceTextIdentity` exports:
  - `SourceTextDigest` as branded `sha256:<64 lowercase hex>`;
  - `SourceTextExtractor` with pinned `name` and `version`;
  - `SourceTextIdentity` with opaque `scopeRef`/`sourceRef`, resolver locator,
    source/text digests, extractor identity, and normalization version.
- `@beep/provenance/VerifiedTextAnchor` is an opaque runtime proof produced only
  after rejecting cross-scope identities, source/digest/version drift,
  malformed UTF-16 boundaries, and raw quote mismatch. Its one-way structural
  `TextAnchorVerificationReceipt` is the wire and persistence contract; a
  receipt cannot be decoded back into runtime proof.
- `@beep/langextract/VerifiedSpan` implements normalization version `1`:
  NFKC, typographic-quote folding, and whitespace collapse for location only.
  It maps normalized UTF-16 code units back to raw clusters, enumerates every
  distinct occurrence, rejects ambiguity, and always emits the exact raw slice.
- Explicit adapters convert declared Unicode code-point or UTF-16 ranges into
  canonical UTF-16, reconstruct only contiguous chunks with separators already
  represented as raw data, and consume `GroundedExtraction[]` directly while
  ignoring legacy fuzzy/lesser authorization metadata.

## Focused Proof

```sh
cd packages/foundation/modeling/provenance
bun run beep:audit
```

Result: build, typecheck, 2 test files / 13 tests, and Biome all passed.

```sh
cd packages/foundation/capability/langextract
bun run beep:audit
```

Result: build, source/test typechecks, 4 test files / 31 tests, and Biome all
passed. The promoted hostile-text regression remains 9/9.

Package-local docgen also passed:

- provenance: 4 modules and 18 typechecked examples;
- langextract: 7 modules and 43 typechecked examples.

The coordinated consumer proof is also green:

- `@beep/file-processing`: 3 files / 22 tests, build, lint, and 105 docgen
  examples;
- `@beep/workspace-server`: 3 files / 19 tests, build, lint, and 24 docgen
  examples;
- live source-page emission re-resolves canonical text and re-verifies the
  persisted receipt before returning the highlighted page.

## Doctrine Pass

- `bun run beep laws native-runtime --check`: PASS, zero warnings/errors.
- `bun run beep laws effect-fn --check`: PASS, zero violations.
- Crispen/terse-effect initially found one optional-field spread in
  `VerifiedSpanError.fromReason`; it was replaced with the canonical
  `Option`/`getSomesStruct` form. The rerun reports no finding in this slice.
- `git diff --check` and manifest JSON validation passed for the packet and both
  owned packages.

The remaining packet work is broader than this coordinated PR: persist
re-anchor history and typed negative verification attempts. The root quality
loop and Yeet closeout for the consumer PR are tracked by the contradiction
packet.
