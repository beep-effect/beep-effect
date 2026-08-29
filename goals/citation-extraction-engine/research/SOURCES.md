# Citation Extraction Engine — Sources and Provenance

This ledger is authoritative for provenance within the governing repository
order. The originating exploration remains useful context, but the 2026-07-29
capability-parity decision supersedes its narrow-v1 and
preserve-existing-shapes assumptions.

## Governing authority

This provenance ledger does not define repository authority. Apply the order in
`goals/README.md`: user objective, repo instructions/skills, architecture and
package standards, `SPEC.md`, `PLAN.md`, `GOAL.md`, then supporting packet
files. No external repository can override that order.

## Behavior and provenance oracle hierarchy

| Priority | Source | Role |
| --- | --- | --- |
| 1 | Official Free Law Project `eyecite` pin | Normative behavior, models, regressions, fixtures, regexes, cleaning, extraction, resolution, and annotation |
| 2 | Published prerequisite public contracts | Canonical source-anchor and vocabulary representations within repo law |
| 3 | `eyecite-ts` pin | Independent differential oracle and extension candidate inventory |
| 4 | `eyecite-js` pin | Near-source TS comparison oracle and extension candidate inventory |
| 5 | Earlier exploration and other legal tools | Context only; cannot override the sources above |

Official eyecite is normative only for observable citation behavior. Repository
architecture determines TypeScript ownership, services, errors, resource
safety, and public representation.

## Pinned repositories

| Repository | Commit | Tree | License | Local reference | Disposition |
| --- | --- | --- | --- | --- | --- |
| [freelawproject/eyecite](https://github.com/freelawproject/eyecite) | `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e` | `a35a58fac03400f71a93a93485b77f1d56f2b02f` | BSD-2-Clause | `/home/elpresidank/YeeBois/research/law_stuff/repos/eyecite` | Normative pinned oracle; port/reimplement with attribution |
| [medelman17/eyecite-ts](https://github.com/medelman17/eyecite-ts) | `34133d03143ea65861f48a5ed0eb32c931581666` | `f1243d0723cea1e53a5263ef67c9e066230729fc` | MIT | `/home/elpresidank/YeeBois/research/law_stuff/repos/eyecite-ts` | Differential and extension reference; never a runtime dependency |
| [beshkenadze/eyecite-js](https://github.com/beshkenadze/eyecite-js) | `53a49f2412da668aaf262e5f92584c2c3781043b` | `521fc394d7130f9b21e206d2bf236ffebcca932c` | BSD-2-Clause | `/home/elpresidank/YeeBois/dev/eyecite-js` | Differential and extension reference; never a runtime dependency |

File hashes captured on 2026-07-29:

| File | SHA-256 |
| --- | --- |
| official eyecite `LICENSE` | `db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772` |
| official eyecite `pyproject.toml` | `7e7c3c44dddca0d38122db36e0c9bfec5ae50b8031b0127fddc46c15092c731f` |
| `eyecite-ts/LICENSE` | `4035b4eb4428ec60e5e02ed53b546ae17b3cd3c039ad42f61611ef8f389d6264` |
| `eyecite-js/LICENSE` | `91cde2e1ec770d3a7a0b769fbf344de33588312b994ff4219f0e75d7fa6db025` |

The official pin declares version 2.7.6 and production/stable status. See
[`EYECITE_BASELINE.md`](./EYECITE_BASELINE.md) for executable proof.

## Incorporated-source discipline

- A local clone is research state, not an incorporated dependency.
- Copied/adapted code, regular expressions, or fixtures must carry source
  commit/path/case identifiers and the applicable license.
- Generated normalized oracle fixtures must carry generator version, source
  case ID, source commit, and content hash.
- Root [`THIRD_PARTY_NOTICES.md`](../../../THIRD_PARTY_NOTICES.md) already
  records the official eyecite BSD-2 terms and affected-material categories.
  Extend it before incorporating material from either TypeScript port.
- Do not copy AGPL CourtListener application code. Public request/result facts
  remain clean-room context only.

## Supporting data sources

| Source | License | Consumption rule |
| --- | --- | --- |
| [reporters-db](https://github.com/freelawproject/reporters-db) | BSD-2-Clause | Consume only the vocabulary goal's stable public IDs, lookups, version, and compatibility API |
| [courts-db](https://github.com/freelawproject/courts-db) | BSD-2-Clause | Consume only the vocabulary goal's stable public IDs, lookups, version, and compatibility API |
| CourtListener application | AGPL-3.0-only | Facts/behavioral observation only; no code or fixture transcription |
| us-legal-tools | MIT | Optional result-shape comparison; not a parity oracle |

## In-repo source evidence

| Capability | Current state | Required disposition |
| --- | --- | --- |
| Law-practice citation values | Broad provisional schema surface, largely shaped after `eyecite-ts` | Rebuild per `SCHEMA_DISPOSITION.md`; no compatibility promise |
| Generic `TextAnchor` | Basic half-open anchor exists in provenance | Do not treat as the unfinished verified-span/source-drift contract |
| Generated courts/reporters data | Internal raw artifacts exist | Do not import directly; wait for public vocabulary contract |
| Root eyecite notice | Official BSD-2 terms and pin already present | Preserve and extend for newly incorporated TS-port material |

## Related research

- [`CAPABILITY_LEDGER.md`](./CAPABILITY_LEDGER.md)
- [`SCHEMA_DISPOSITION.md`](./SCHEMA_DISPOSITION.md)
- [`PARITY_METHOD.md`](./PARITY_METHOD.md)
- [`EYECITE_BASELINE.md`](./EYECITE_BASELINE.md)
- [Source exploration](../../../explorations/citation-grounding-hallucination-guard/README.md)
- [Legal parser landscape](../../../explorations/citation-grounding-hallucination-guard/research/legal-citation-parser-landscape.md)
- [Verified-span sources](../../citation-verified-span-substrate/research/SOURCES.md)
- [Court/reporter vocabulary audit](../../court-reporter-vocabulary/research/EYECITE_DATA_AUDIT.md)
