# USPTO Prosecution Read — Sources & Provenance

This implementation ledger reproduces the source-exploration entries relevant
to the known-application observation, native vocabularies, transport, consent,
and `PTMNFEE2` compatibility. The exploration ledger remains primary:
[`explorations/uspto-patent-driver-depth/research/SOURCES.md`](../../../explorations/uspto-patent-driver-depth/research/SOURCES.md).

- **Source exploration:** `explorations/uspto-patent-driver-depth`
- **Primary ledger:** `explorations/uspto-patent-driver-depth/research/SOURCES.md`
- **Cross-packet transport decision:** `explorations/effect-orchestration-patterns/DECISIONS.md`

## 1. Relevant mined source corpus

| Nugget | Upstream source | License stance | Disposition here |
| --- | --- | --- | --- |
| `mcp-uspto#4` | `mcp-uspto/src/tools/patent-status.ts:13-53` | MIT; port with attribution after license verification | prosecution timeline shape only; correct field to `eventDataBag` |
| `mcp-uspto#6` | `mcp-uspto/src/tools/patent-documents.ts:57-63` | MIT; port with attribution after license verification | document-listing observation shape |
| `patents-mcp#6` | `patents-mcp/src/patent_mcp_server/patents.py:412-464` | MIT; port with attribution after license verification | ODP endpoint map; live P0 proof remains authoritative |
| `patents-mcp-server#8` | `patents-mcp-server/src/tools/utility.tools.ts:15-46` | MIT; pattern reference | vocabulary axis only; map is known corrupt and must not be copied |
| `us-gov-open-data-mcp#7` | `us-gov-open-data-mcp/src/apis/uspto/sdk.ts:42-67` | MIT; port with attribution after verification | transaction/document type shapes |
| `uspto_pfw_mcp#7` | `uspto_pfw_mcp/src/patent_filewrapper_mcp/util/package_manager.py:57-60` | MIT; public code facts only | document codes; leave litigation tiers to law practice |
| `patents-mcp#7` | `patents-mcp/src/patent_mcp_server/util/errors.py:14-68` | MIT; reference | enumerate real upstream error variants as typed technical failures |
| `patents-mcp-server#4` | `patents-mcp-server/src/tools/office-actions.tools.ts:20-27` | MIT; reference | durable authoritative-source fallback/provenance pattern |

No upstream vocabulary map is decode authority. USPTO government-authored
status/event/document facts are generated from pinned primary sources; raw
unknown values survive explicit failures.

## 2. Relevant upstream repositories and licenses

| Repo | License | Port discipline | What informs this goal |
| --- | --- | --- | --- |
| mcp-uspto | MIT | port with attribution after file-license verification | transaction and document record shapes |
| patents-mcp | MIT | port with attribution after verification | endpoint and error variants |
| patents-mcp-server | MIT | reference/port with attribution | vocabulary axis and OA provenance pattern |
| us-gov-open-data-mcp | MIT | port with attribution after verification | ODP native type shapes |
| uspto_pfw_mcp | MIT | public facts/pattern reference | document-code namespace |

The source exploration warns that several repo licenses were not independently
confirmed. Verify before verbatim copying; otherwise use clean-room shapes only.

## 3. Relevant external research sources

- [USPTO Patent File Wrapper](https://data.uspto.gov/patent-file-wrapper)
- [USPTO ODP API query spec](https://data.uspto.gov/documents/documents/ODP-API-Query-Spec.pdf)
- [USPTO Appendix A, application status codes](https://www.uspto.gov/sites/default/files/documents/Appendix%20A.pdf)
- [USPTO Appendix B, transaction event codes](https://www.uspto.gov/sites/default/files/documents/Appendix%20B.pdf)
- [USPTO IFW document codes](https://www.uspto.gov/sites/default/files/documents/IFW-Doc-Codes-and-Descriptions.xlsx)
- [USPTO `PTMNFEE2` product](https://data.uspto.gov/bulkdata/datasets/ptmnfee2)
- [Federal `PTMNFEE2` catalog record](https://catalog.data.gov/dataset/patent-maintenance-fee-events-1981-present)
- [USPTO Maintenance Fees Event File launch notice](https://www.uspto.gov/web/offices/com/sol/og/2010/week05/TOC.htm)
- [USPTO ODP bulk-data Search API](https://data.uspto.gov/apis/bulk-data/search)
- [USPTO ODP registration announcement](https://www.uspto.gov/about-us/news-updates/uspto-open-data-portal-require-registration-access-beginning-june-18-2026)
- [USPTO Terms of Use](https://www.uspto.gov/terms-use-uspto-websites)
- [`Retry-After`, RFC 9110 section 10.2.3 reference](https://http.dev/retry-after)

The current `PTMNFEE2` layout, complete companion code list, sizes, numeric rate
limits, anonymous resolved-file access, and authenticated ODP retry headers are
P0 facts, not claims established by this ledger.

## 4. In-repo capability references

| Capability | Path | Disposition |
| --- | --- | --- |
| `@beep/uspto` service/models/errors | `packages/drivers/uspto/src/` | extend in place for the native observation, failures, generator, and fixtures |
| Existing USPTO MCP host | `packages/drivers/uspto-mcp` | extend; retain shipped soft gate |
| `SourceAuth` and tier dispatch | `packages/foundation/capability/mcp-kit/src/` | reuse for technical capability metadata; not matter consent |
| Promoted API transport | `packages/foundation/capability/api-transport/src/Transport.ts` | adopt for every request; verify ODP-specific headers/status/idempotency in P0 |
| Existing transport adopters | `packages/drivers/govinfo`, `packages/drivers/ecfr` | reuse adoption precedent |
| Patent-spine intake | `goals/law-docketing-patent-spine` and law-practice use-cases/server | consumer-owned port and sole legal translation boundary |
| Reliability orchestration | `goals/law-docketing-reliability` | consumer-owned sequential scheduler/cursor/sweep/recovery |
| Shared bulk vocabulary consumer | `goals/uspto-ptmnfee2-ingest` | dependent sibling; reuse this generator |

## 5. Cross-links and provenance

- Source packet: [`README`](../../../explorations/uspto-patent-driver-depth/README.md),
  [`BRIEF`](../../../explorations/uspto-patent-driver-depth/BRIEF.md),
  [`MAP`](../../../explorations/uspto-patent-driver-depth/MAP.md),
  [`DECISIONS`](../../../explorations/uspto-patent-driver-depth/DECISIONS.md), and
  [`PTMNFEE2` note](../../../explorations/uspto-patent-driver-depth/research/ptmnfee2-maintenance-fee-dataset.md).
- Transport provenance: [`effect-orchestration-patterns` decision](../../../explorations/effect-orchestration-patterns/DECISIONS.md#2026-07-14--locked-uspto-transport-adoption-folds-into-its-sibling).
- Goal contract: [`SPEC.md`](../SPEC.md) and [`PLAN.md`](../PLAN.md).
- Dependent sibling: [`goals/uspto-ptmnfee2-ingest`](../../uspto-ptmnfee2-ingest/README.md).
