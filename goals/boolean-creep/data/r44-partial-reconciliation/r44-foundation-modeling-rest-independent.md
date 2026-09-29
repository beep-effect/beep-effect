# R44 lane `r44-foundation-modeling-rest`: independent reconciliation

## Bindings

- Source is `862327c74e` and main is `8c16e648527a`, verified without changing refs.
- `packages/` has no diff against main.
- All 177 lane files match their `frozen-inputs` hashes: 175 `.ts`, `legal-intake.ttl` and `legal-intake.jsonld`.

| Artifact | SHA-256 |
|---|---|
| Seed | `3bb91f7f…` |
| Receipt | `38330286…` |
| Transcript | `6dd66f86…` |
| Raw report (empty) | `e3b0c442…` |

## Result

`independentCoverageAccepted: true`, for this lane only.

- No new records.
- No classification changes.
- No unresolved owner questions.
- Three kind-metadata corrections are recommended. They do not change any contract.

## Scanner run

The scanner ran 63 greps, several of them head-limited, and read 28 files. That is not sufficient coverage by itself, and the empty report earns nothing on its own.

Its classifications match this review. Its claim that all seed metadata is unchanged misses the three kind corrections listed below.

The parent's search files were used only as a cross-check.

## Coverage of 177 files

I ran five independent passes:

1. **Owner pass.** A brace-scoped search for owners with two or more Boolean members. It recognizes `S.Boolean` and its wrappers, `: boolean`, `Option<boolean>`, and literal `true`/`false`. It found 8 files, and every owner is seeded.
2. **Alias sweep.** `SchemaUtils.BoolKeyDefault*` aliases are missed by literal matching, so I searched for them separately. In this lane the only multi-Boolean owner using them is the seeded `AllowListUrlPolicySpec`. `TaskItem.checked` and `Table.headerRow` are single Booleans.
3. **Inferred-local pass.** 50 clusters in 26 files, each read at its site.
4. **Inheritance check.** The Lexical base classes carry no Boolean fields, so each Lexical node has at most one Boolean.
5. **TTL/JSON-LD.** Neither file contains any Boolean literals or `xsd:boolean`.

None of the non-seeded candidates is eligible. Each is one of:

- a predicate or combinator;
- a single latch;
- a function or callback parameter (for example `hasLeadingSpace` and `insideAnchor`);
- a non-Boolean value (the Fold warning arrays);
- a pair that never coexists. In `Glob.ts:401`, `isHiddenPath` returns before `isDirectory` is declared.

The generated `Html.meta.ts` and `Html.model.ts` are not in the lane inventory.

## The five qualified HTML invariants hold

| Owner | Lines | Why the invariant holds |
|---|---|---|
| `html-img-sizes-disposition` | :984-1022 | `incompatibleSizes` and `sizesIsExactlyAuto` imply `hasSizes`. `missingSizes` implies `hasSrcset` and not `hasSizes`, so missing and incompatible are mutually exclusive. The consumer emits at most one issue. |
| `html-link-imagesizes-disposition` | :1026-1060 | `imageSizesIncompatible` implies `hasImageSizes`, which excludes the missing condition. |
| `html-select-child-grammar` | :1923 | `traditional` and `customizable` are exclusive (`button` first). |
| `html-dl-child-grammar` | :1797 | `direct` and `wrapped` are exclusive. |
| `html-datalist-child-grammar` | :1895 | `mixed` implies `optionMode`. |

## All 24 seeds are upheld

**Qualified (5):** the five HTML owners in the table above.

**D1 (18):**

- Glob options: `glob-options-scan-flags`, `resolved-glob-options-scan-flags`
- `rm-sync-options-flags`
- NLP token flags: `nlp-token-annotation-flags`
- Allow-list URL policy: `allow-list-url-policy-relative-flags`
- Picture source: `html-picture-source-sizes-auto`
- Taxonomy manifest: `taxonomy-loader-manifest-presence`. A kind-only row is a raw parse diagnostic, not a supported state.
- Identity descriptors: `identity-property-descriptor-flags`
- Struct descriptors: `struct-from-entries-property-descriptor-flags`
- Media: `html-media-child-grammar`
- Auto-button: `r3-foundation-auto-button-command-presence`. Both-true is handled explicitly.
- Skill-completion bindings: `r3-foundation-skill-completion-summary-bindings`
- Foreign entry: `r2-foundation-html-foreign-entry-flags`
- Attribute requirement: `r3-foundation-attribute-requirement-gates`
- IRI segment facts: `r2-foundation-iri-ipv6-segment-facts`. These are raw-input diagnostics.
- Link-sizes issues: `r24-foundation-modeling-rest-link-sizes-issue-flags`
- Recovery coherence: `r24-foundation-modeling-rest-recovery-budget-coherence`
- Gate-summary coherence: `r24-foundation-modeling-rest-gate-summary-coherence`

**D2 (1):** `r28-foundation-modeling-rest-bun-glob-scan-options`, the Bun `GlobScanOptions`.

## Metadata corrections (kind only; classification unaffected)

All three sites are actual constructed objects:

| Seed | Location | Change | Object |
|---|---|---|---|
| `taxonomy-loader-manifest-presence` | `TaxonomyLoader.ts:527` `decodeLoadManifestEntry` | `sibling-state` → `object-literal` | `Match.value({hasLoadKind, hasLoadStatus})` |
| `r3-foundation-auto-button-command-presence` | `Html.form-control.ts:264` `resolveAutoButtonState` | `type-literal` → `object-literal` | `Match.value({...})`, members at 265-267 |
| `struct-from-entries-property-descriptor-flags` | `Struct.ts:698` `fromEntries` | `type-literal` → `object-literal` | `Reflect.defineProperty` descriptor; the object opens at 697 and the first Boolean member is at 698 |

**Optional note refresh:** `allow-list-url-policy-relative-flags` cites the evaluator at 404-407; it currently spans 402-410.

## Scope

This reconciliation covers one lane. It does not make the round complete or dry, and it gives no P3, design-ratification or implementation credit. I made no edits, ran no tests, made no git mutations or provider calls, and did not touch the runtime.
