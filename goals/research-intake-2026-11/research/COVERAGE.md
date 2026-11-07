# Research intake 2026-11 — Coverage

Per-hop and per-intake denominators. Counts only; corpus bytes stay in the
out-of-repo library. The October intakes (143 files, 461 findings) are not
part of these denominators.

## Hop 0 census (pre-snapshot, 2026-11-07)

Measured before any acquisition. The snapshot freezes after the Box route
from `research-library-routes` downloads the Box nightlies.

### Nov-5 aggregation (local operator research root)

| Class | Files |
| --- | ---: |
| Markdown (`.md`) | 143 |
| JSON | 57 |
| WebVTT (`.vtt`) | 39 |
| Matroska (`.mkv`, referenced by hash, never in `objects/`) | 38 |
| PNG | 35 |
| Text | 7 |
| PDF | 3 |
| MP4 | 3 |
| JPEG | 2 |
| HTML | 2 |
| **Total** | **332** (5.5 GB) |

### Box nightly series (Box root folder, authoritative for nightlies)

| Measure | Count |
| --- | ---: |
| Dated nightlies 2026-09-13 to 2026-11-05 | 34 |
| Nightly arriving after graduation (2026-11-06) | 1 |
| Misnamed byte-identical alias (`26-11-04` = `2026-11-04`, same SHA-1) | 1 |
| **Box nightly files** | **36** (35 distinct objects) |

### Local nightly copies reconciled against Box SHA-1

| Relation | Count | Files |
| --- | ---: | --- |
| Byte-identical to the Box file of the same date (share one object) | 11 | 10-17, 10-19, 10-24, 10-25, 10-27, 10-28, 10-29, 10-30, 10-31, 11-03, 11-04 |
| Same date, different bytes (version, `nearDuplicateOf`) | 5 | 10-18, 10-20, 10-22, 10-23, 11-05 |
| 11-05 variant byte-identical to a different Box date | 1 | `11-05 (3)` = Box `2026-10-21` |
| 11-05 variants with distinct bytes (versions of 11-05) | 3 | `11-05 (1)`, `(2)`, `(4)` |
| **Local nightly copies** | **20** | |

### Box spike paper and legal-ontology pile

| Source | Count | Intake |
| --- | ---: | --- |
| `beep-spikes` paper | 1 | November hop 0 |
| `IP_LAW_ONTOLOGY_RESEARCH` items | 449 (337.6 MB, Box listing 2026-11-07) | separate snapshot, T1 only |

## Hop 1

Pending: inventory hop extraction (`research-library-routes`). The
exploration survey counted 835 URLs in the Nov-5 pile.

## Hop 2

Pending: routed-finding gate.

## Private partition

Counted separately once imported; no identifiers recorded here.
