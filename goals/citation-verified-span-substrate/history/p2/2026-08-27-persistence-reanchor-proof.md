# P2 persistence and re-anchor proof

Date: 2026-08-27
Verdict: PASS for the owned acceptance matrix

## Implemented contract

- Provenance now exposes a source-manifestation check that proves the expected
  identity, resolved identity, and SHA-256 digest before an attempt can trust
  the raw text.
- Langextract persists append-only verification and re-anchor attempts. Each
  record keeps the matter reference, expected and resolved source identities,
  raw `GroundedExtraction[]` candidates, attempt and engine identity, engine
  and normalization versions, predecessor, and a closed outcome.
- Only a verified outcome can contain anchor receipts. Empty candidate batches
  persist as `no-candidates` only after source verification. Other failures
  retain a stage, typed reason, and optional candidate index without an anchor.
- Re-anchor requires a retained `stale-source` predecessor. The new source must
  match the re-anchor's expected identity, pass its digest check, and produce
  exact raw slices again. Persistence decode rejects broken links, duplicate
  attempt ids, invalid transitions, contradictory outcomes, and mismatched
  re-anchor authority.

## Acceptance proof

| Requirement | Evidence |
| --- | --- |
| Hostile Unicode, raw UTF-16 equality, duplicates, foreign offsets, and page straddle | `VerifiedSpanSpike.test.ts`, 24 passing tests |
| Exact source identity and anchor proof | provenance package, 3 files and 18 passing tests |
| Drift retention and non-destructive re-anchor | `VerifiedSpanHistory.test.ts` preserves the original receipt, appends `stale-source`, then appends a linked verified re-anchor at new raw offsets |
| Persistence after restart | `S.fromJsonString(VerifiedSpanHistory)` round-trips success, drift, re-anchor, and negative attempts |
| Negative extraction policy | Empty candidates persist as `no-candidates` with no anchor or citation-entity field; drifted empty input persists `stale-source` instead |
| Matter, digest, and version failures | Focused tests persist `cross-scope`, `stale-source`, ambiguity, and `normalization-version-mismatch` without anchors |
| Schema boundary integrity | Decode tests reject broken predecessor links, invalid re-anchor transitions, source-authority mismatch, and candidates paired with `no-candidates` |

## Commands and results

```sh
cd packages/foundation/modeling/provenance
bun run beep:audit
```

Passed build, source and test typechecks, 3 test files with 18 tests, and
Biome.

```sh
cd packages/foundation/capability/langextract
bun run beep:audit
```

Passed build, source and test typechecks, 7 test files with 77 tests, and
Biome. The hostile-text and history files account for 30 focused tests.

Direct package docgen passed 21 provenance examples and 83 langextract
examples. `bun run beep lint schema-first`, `bun run beep laws native-runtime
--check`, and `bun run beep laws effect-fn --check` each reported zero findings.
`bun run beep lint reflection-artifacts` reported zero blocking findings.

`bun run beep yeet repair` ended with a success verdict after all 12 cheap
gates, the full 130-package docgen run, affected build/lint feedback, and the
focused 18/77 test proof. The exact-head full verify and hosted merge-ready
receipt remain the P3 completion gate.

## Attribution note

An earlier `bun run docgen:local` failed on the unchanged
`professional-desktop` export `dispatchTurnWithConfirm` and its unregistered
`@category actions`. Both changed packages passed direct docgen, and the later
full docgen run passed all 130 scheduled packages. The branch did not edit the
desktop file. The mismatch is recorded in `research/OPPORTUNITIES.md` rather
than repaired outside this packet.
