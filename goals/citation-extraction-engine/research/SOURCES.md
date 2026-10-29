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
| [freelawproject/eyecite](https://github.com/freelawproject/eyecite) | `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e` | `a35a58fac03400f71a93a93485b77f1d56f2b02f` | BSD-2-Clause | `$HOME/YeeBois/research/law_stuff/repos/eyecite` | Normative pinned oracle; port/reimplement with attribution |
| [medelman17/eyecite-ts](https://github.com/medelman17/eyecite-ts) | `34133d03143ea65861f48a5ed0eb32c931581666` | `f1243d0723cea1e53a5263ef67c9e066230729fc` | MIT | `$HOME/YeeBois/research/law_stuff/repos/eyecite-ts` | Differential and extension reference; never a runtime dependency |
| [beshkenadze/eyecite-js](https://github.com/beshkenadze/eyecite-js) | `53a49f2412da668aaf262e5f92584c2c3781043b` | `521fc394d7130f9b21e206d2bf236ffebcca932c` | BSD-2-Clause | `$HOME/YeeBois/dev/eyecite-js` | Differential and extension reference; never a runtime dependency |

File hashes captured on 2026-07-29:

| File | SHA-256 |
| --- | --- |
| official eyecite `LICENSE` | `db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772` |
| official eyecite `pyproject.toml` | `7e7c3c44dddca0d38122db36e0c9bfec5ae50b8031b0127fddc46c15092c731f` |
| `eyecite-ts/LICENSE` | `4035b4eb4428ec60e5e02ed53b546ae17b3cd3c039ad42f61611ef8f389d6264` |
| `eyecite-js/LICENSE` | `91cde2e1ec770d3a7a0b769fbf344de33588312b994ff4219f0e75d7fa6db025` |

The official pin declares version 2.7.6 and production/stable status. See
[`EYECITE_BASELINE.md`](./EYECITE_BASELINE.md) for executable proof.

## Frozen runtime implementation reference

CPython 3.11.15 is an implementation reference for dictionary behavior observed
through the pinned eyecite runtime. It does not become another citation oracle
or a production dependency. The server-private combined/general-key table
adaptation is attributed in THIRD_PARTY_NOTICES.md, with the complete upstream
license and a summary of the TypeScript/Effect changes.

- Source: [Objects/dictobject.c at v3.11.15](
  https://github.com/python/cpython/blob/v3.11.15/Objects/dictobject.c).
- Source SHA-256:
  `474b899187e73c5ec416b82e17346d2c17616b1b662e1c2fd1c7e53bb2bf19d8`.
- Complete license SHA-256:
  `3b2f81fe21d181c499c59a256c8e1968455d6689d269aa85373bfb6af41da3bf`.
- Scope and remaining integration proof:
  [runtime dictionary evidence](
  ../history/evidence/2026-10-29-runtime-dictionary.md).

No C implementation file or Python interpreter is incorporated. The isolated
backend proof does not promote the three mutable-key engine cases or any
canonical/donor/safety/divergence row.

## Exact case/resource hash reference

The private case-resource hash helper adapts the pinned eyecite models.py
FullCaseCitation/Resource methods and utils.py hash_sha256. It preserves source
JSON spacing, ASCII escaping and frozen CPython integer reduction. BSD-2-Clause
attribution is retained in its module and the existing root notice.

The [hash evidence](../history/evidence/2026-10-29-case-resource-hashes.md)
records twenty-four actual source observations, fixture digest, source hashes,
controlled identity-hook scope, fresh replay and remaining live integration.
No source process address is incorporated or inferred from citation content.
This proof does not promote the three mutable-key engine cases.

The [live case-resource composition evidence](
../history/evidence/2026-10-29-live-case-resources.md) records five actual
Resource/dictionary histories and thirty-eight events. The private registry
adapts Resource.__hash__/__eq__ through the exact hash helper and captures the
semantic owner through an injected service. Attribution remains BSD-2-Clause.
This component proof does not establish final default callback integration.

The [publication resource hash evidence](
../history/evidence/2026-10-29-publication-resource-hashes.md) records twenty-two
actual law/journal hash observations. Complete source edition/reporter payloads
and exact datetime strings are consumed through private trusted-adapter data.
Stable abbreviation ties qualify candidate-bag normalization. Attribution is
BSD-2-Clause; live artifact authentication and callback integration remain open.

The [authenticated frozen edition adapter](
../history/evidence/2026-10-29-frozen-edition-adapter.md) binds all 2,430 reporter
and 2,533 edition artifacts to actual pinned source dataclasses. It verifies a
reviewed manifest and each original content digest before lookup. All source
runtime payloads are independently compared; order and duplicates are retained
at lookup. Attribution is BSD-2-Clause; final asset loading remains open.

The [mixed live-resource evidence](
../history/evidence/2026-10-29-mixed-resource-objects.md) records six histories,
eighty-nine events and independent candidate/selection snapshots across all
full-citation families. Actual frozen Georgia/Rutgers abbreviation ties prove
order-sensitive hashes; empty candidate lists retain source selections. The
semantic membership filters were corrected accordingly. Attribution remains
BSD-2-Clause; final callback-owner integration remains open.

The [registered callback dictionary evidence](
../history/evidence/2026-10-29-registered-callback-dictionary.md) executes the
three recorded mutable default-key scenes through the owner and default
callbacks. Existing source fixtures are unchanged; complete events and final
groups match. Registered references and list handles remain operation-owned.
Attribution remains eyecite BSD-2-Clause and the previously recorded CPython
implementation license. Host normalization and unconditional Layer cutover
remain open.

The [controlled host-resource evidence](
../history/evidence/2026-10-29-host-resource-protocol.md) records eight mixed-key
histories, forty-eight operations and three actual full/default-Id scenes.
Exact native hook traces, current views, ordered entries and retained lists
match in the target through an explicitly captured adapter. Source metadata and
fresh replay remain pinned; attribution remains BSD-2-Clause and the existing
CPython notice. Automatic native values, source set semantics and reentrancy
remain open.

The [candidate-set evidence](
../history/evidence/2026-10-29-candidate-runtime-set.md) binds CPython 3.11.15
setobject.c and its complete existing license notice. Eight histories and
seventy-one operations preserve exact comparison/iteration behavior; twelve
actual eyecite resolver scenes match host hook traces and final groups through
default short/supra/reference callbacks. The add-only TypeScript adaptation
preserves source hash-before-pointer checks and cached-hash growth order.
Native-value normalization and reentrant mutation remain open.

The [insertion-entry receipt evidence](
../history/evidence/2026-10-29-insertion-entry-receipts.md) uses the unchanged
model-mutation fixture and all three actual registered callback executions.
Receipt v3 preserves multiple entries for one authority with independent cg1
identities; trusted binding expectations verify exact entry positions and list
nodes through source restoration. Automatic session projection remains open.

The [dispatch decision evidence](
../history/evidence/2026-10-29-dispatch-decision-capture.md) records eight actual
source histories and nineteen return/append decisions with exact host hook
traces. Its observational list subclass performs no additional key operations;
unique-list scenes normalize allocation slots without asserting general shared
list selection. Source metadata, fresh replay and eight corruption controls
remain separate from target execution. Attribution remains BSD-2-Clause.

The [issued-session producer evidence](
../history/evidence/2026-10-29-issued-session-document-producer.md) reuses the
unchanged eight dispatch histories and three mutable default-resource scenes.
Automatic document/binding construction preserves exact groups without replaying
native hooks. Issuance, tamper isolation, anchor retention and independent replay
controls are target identity/proof laws, not extra oracle capabilities. The pure
trusted descriptor port still needs its default registered implementation.

The [canonical session descriptor evidence](
../history/evidence/2026-10-29-canonical-session-descriptors.md) reuses the
unchanged case/publication hash corpora and authenticated frozen editions.
Source-observed decimal hashes independently determine expected labels for
three case rows and real law/journal rows. Owned origin classification,
presentation spoofing, unused null-page failure and independent replay are
target proof laws. They do not expand source runtime coverage or complete the
production Layer. Attribution remains the existing eyecite BSD-2-Clause notice.

The [registered default resolver evidence](
../history/evidence/2026-10-29-registered-default-resolution.md) reuses four
controlled source-id rows from the case-hash corpus, all 46 focused default
contexts and all 30 existing default operation observations. Source replay
matches every decoded focused-fixture field. Explicit injected identity inputs
and successful document restoration prove integration; sequential test adapter
integers do not prove a production native allocator. No source coverage count
or semantic waiver changes; the existing BSD-2-Clause attribution applies.

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
| Verified anchors | Public contracts available | See compatibility record |
| Court/reporter vocabulary | Public contract available | No raw imports |
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
