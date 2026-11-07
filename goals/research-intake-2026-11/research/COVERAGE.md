# Research intake 2026-11 — Coverage

Per-hop and per-intake denominators. Counts only; corpus bytes stay in the
out-of-repo library. The October intakes (143 files, 461 findings) are not part
of these denominators and their accounting is unchanged.

Reproduce the per-hop lines with:

```sh
bun run beep research library status --summary --intake <intake-id>
```

## Intakes

| Intake | Id (prefix) | Files | Private | Referenced media | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| November 2026 | `601863575ac4` | 368 | 148 | 41 | Nov-5 aggregation plus 37 staged Box files; private root `Research-11-5-26` |
| Box legal-ontology pile | `69640a7a5346` | 449 | 449 | 0 | `IP_LAW_ONTOLOGY_RESEARCH`, 449 unique SHA-256 (no byte duplicates), 337.6 MB |

Referenced media (`.mkv`, `.mp4`) are hashed in place with `retention:
referenced` and never copied into the library.

## November intake

### Hop 0

| Measure | Count |
| --- | ---: |
| Intake census files | 368 |
| Inventoried documents (Markdown, JSON, PDF reports) | 240 |
| — private documents | 97 |
| Citations extracted from hop-0 documents | 5,719 |

#### Box nightly series and local copies (census before the snapshot)

| Measure | Count |
| --- | ---: |
| Dated Box nightlies 2026-09-13 to 2026-11-05 | 34 |
| Nightly arriving after graduation (2026-11-06) | 1 |
| Misnamed byte-identical alias (`26-11-04` = `2026-11-04`) | 1 |
| **Box nightly files** | **36** (35 distinct objects) |
| Box spike paper (`beep-spikes`) | 1 |
| Local nightly copies byte-identical to the Box file of the same date | 11 |
| Local copies with different bytes (versions of the same date) | 5 |
| 11-05 variant byte-identical to a different Box date (`11-05 (3)` = `2026-10-21`) | 1 |
| 11-05 variants with distinct bytes | 3 |

Every Box file has a readable capture with a per-file receipt and a SHA-1 that
matches Box (37 of 37).

#### Nov-5 aggregation by file class

| Class | Files |
| --- | ---: |
| Markdown | 143 |
| JSON | 57 |
| WebVTT | 39 |
| Matroska (referenced by hash) | 38 |
| PNG | 35 |
| Text | 7 |
| PDF | 3 |
| MP4 (referenced by hash) | 3 |
| JPEG | 2 |
| HTML | 2 |
| **Total** | **332** (5.5 GB) |

### Hop 1

| Measure | Count |
| --- | ---: |
| Hop-1 identities | 2,116 |
| — cited only from the private partition | 1,289 |
| Readable capture | 1,140 |
| Reviewed disposition | 975 |
| Readable or reviewed | **2,116 (100%)** |

Reviewed dispositions by class:

| Disposition | Count | Basis |
| --- | ---: | --- |
| `internal` | 449 | repository paths, in-bundle anchors, module specifiers (internally owned) |
| `non-reference` | 421 | path or token fragments with no scheme or host, truncated URLs |
| `unavailable` | 39 | target 404, 410 or DNS failure, failed response retained |
| `tool-blocked` | 33 | access control, challenge pages, server errors, size bound, PDF on the web route, YouTube 429 without a VidBee bundle, Hugging Face ids without a proof route |
| `incomplete` | 29 | X posts (SPEC non-goal) and publisher landing pages without the paper |
| `operational` | 5 | API or service endpoints |

Routes used: Firecrawl web/docs/registry, paper, GitHub cited object, YouTube
captions, 45 VidBee bundle imports (caption fetches hit HTTP 429), Box.

### Hop 2

| Measure | Count |
| --- | ---: |
| Hop-2 identities catalogued | 75,918 |
| Admitted by the gate | 400 |
| Readable hop-2 identities (admitted or already captured) | 665 |
| Catalogued only | 75,141 |
| Refused: over the 400 budget | 40,455 |
| Refused: unrouted parent | 15,502 |
| Refused: non-content (chrome, fragments, assets, reserved hosts) | 9,481 |
| Refused: GitHub not transitive | 4,976 |
| Refused: domain cap | 3,032 |
| Refused: arXiv catalogue only | 1,660 |

Of the 400 admitted, 303 have readable captures. The other 97 (74 blocked, 12
unsupported, 11 failed) each keep their failed receipt and carry a reviewed
disposition: 78 `tool-blocked`, 13 `unavailable`, 5 `operational`, 1
`incomplete`. No GitHub source was acquired transitively and no hop-2 source
was acquired outside the gate.

### Mining

| Tier | Pool | Runs | Result |
| --- | --- | ---: | --- |
| T1 hop 0–1 | `gpt-6-luna` medium (codex-cli) | 1,434 | 1,187 select, 241 skip, 6 defer |
| T1 hop 2 | `claude-opus-5-5` medium (proxy) | 303 | 48 select |
| T2 | `gpt-6.1-sol` medium (codex-cli), then `claude-opus-5-5` medium (proxy); 2 Junie reads before its quota ran out | 1,235 | 12,330 span-checked findings |
| T3 | orchestrating session | — | `ROUTING.md`, `CONTRADICTIONS.md`, three `/deep-research` runs, `/adhd` portfolio |

Every reading and triage carries a `ModelRun` (model, effort, route, launch
argv). Findings route as follows (detail in [`ROUTING.md`](./ROUTING.md)):

| Disposition | Public | Private | Total |
| --- | ---: | ---: | ---: |
| routed | 5,609 | 2,863 | 8,472 |
| parked | 2,515 | 1,082 | 3,597 |
| rejected | 177 | 84 | 261 |

### Library verify

`bun run beep research library verify` over the whole library (13m46s, 35 GB peak):

| Measure | Result |
| --- | --- |
| SHACL | conforms, 0 violations |
| Integrity lines | 8, all from the 2026-10-06 intakes (4 version gaps, 2 census mismatches, 2 occurrence misses) |
| Missing sources | 4, all October |
| November and legal-pile sources missing or failing integrity | 0 |

The first full run failed on November data. It found 3,339 hop-1 derivations
whose report parent the shapes typed as a Source, 12 spans with astral-plane
characters rejected by `rdf-validation`'s `xsd:string` pattern, 14 census lines
on one report re-extracted against later hop-2 identities, 97 hop-2 sources
without reviewed dispositions, 6 private repository identities never acquired
and one paper cited at `v2` with only a `v3` capture. Each is fixed or captured;
see `decisions/2026-11-07-verify-november-defects.md`.

## Box legal-ontology pile

| Measure | Count |
| --- | ---: |
| Box items listed | 449 |
| Downloaded with per-file receipts, SHA-1 matched | 449 |
| Byte-identical duplicates | 0 |
| Readable PDF text (derived through `@beep/pdf-tools`) | 448 |
| No extractable text | 1 |
| T1 records (`gpt-6-luna`) | 448: 379 select, 69 skip |
| T2 readings | 0 (SPEC non-goal; re-entry is the exploration's gated `legal-ontology-pile-deep-read`) |

The 69 skips are off-topic strays (pharmacology, hardware design, energy
economics); their reviewed T1 skip records are their disposition.

## Private partition

| Measure | Count |
| --- | ---: |
| Private intake files (November) | 148 |
| Private documents (November) | 97 |
| Private sources (November scope) | 1,326 |
| Private findings | 4,029 |

Private rows appear in `routing.jsonl` with ids and disposition only. A
counts-only guard over the archive's 50 message ids and the participant handle
finds none in the repository's added lines.
