# Gov Legal MCP — Sources & Provenance

This implementation ledger reproduces the source corpus relevant to the MCP
sibling and collision contract. The exploration ledger remains primary:
[`explorations/gov-legal-data-driver-codegen/research/SOURCES.md`](../../../explorations/gov-legal-data-driver-codegen/research/SOURCES.md).

- **Source exploration:** `explorations/gov-legal-data-driver-codegen`
- **Gate evidence:** `@beep/govinfo` + `@beep/ecfr`, recorded in the predecessor goal README
- **Worked conventions:** `goals/mcp-kit`, `goals/uspto-mcp`, `goals/mcp-host-retrofit`

## 1. Mined source corpus

| Nugget | Upstream / license | MCP disposition |
| --- | --- | --- |
| TalentScore#7 | TalentScore / MIT | Port Effect Redacted-auth/retry wrapper patterns only. |
| doc-haus#14 | doc-haus / MIT | Reference CourtListener token/result shape; not current scope. |
| mcp-uspto#1 | mcp-uspto / MIT | Port token/rate patterns only where driver owns them; host does not duplicate transport. |
| mike#11 | mike / AGPL-3.0-only | Clean-room reference only; not current scope. |
| us-gov-open-data-mcp#2/#3 | license unverified | Clean-room declarative auth/retry/rate patterns; shipped mcp-kit/API transport supersede implementation. |
| us-legal-tools#3 | us-legal-tools / MIT | Port auth convention facts, never axios runtime. |
| harvest-mcp#8/#4 | license unknown | Reference-only error/auth vocabulary. |
| patent-search-mcp-server#6 | MIT | Port-with-attribution status/error pattern if needed. |
| patents-mcp-server#14 | MIT | Port committed deterministic codegen/report discipline. |
| us-legal-tools#1 | MIT | Study the dual SDK/MCP target idea; do not adopt Orval/axios/Zod output. |
| us-legal-tools#4 | MIT | Port structured parameter grouping and operationId metadata; wire names follow this goal’s collision contract. |
| uspto-patents-mcp#6 | MIT | Port deterministic key/digest patterns where useful for name truncation/reporting. |
| courtlistener#11 | AGPL-3.0-only | Clean-room reference only; outside this goal. |
| lawyergpt#5 | license unknown | Reference-only; outside this goal. |
| us-legal-tools#10 | MIT | Port deterministic regenerate/no-diff discipline, not a global turbo edge. |
| us-legal-tools#12 | MIT | Optional portal idea; out of scope. |
| us-legal-tools#2 | MIT | Reference low-boilerplate per-source registration shape. |

Exact upstream `file:line` locations, priority, themes, and disposition details
remain in the primary exploration ledger; those rows are authoritative for
attribution.

## 2. Upstream repositories and licenses

| Repo | License | Discipline |
| --- | --- | --- |
| TalentScore, doc-haus, us-legal-tools, patents-mcp-server, mcp-uspto, patent-search-mcp-server, uspto-patents-mcp | MIT | Port patterns with attribution; never import donor axios/Zod runtimes. |
| courtlistener, mike | AGPL-3.0-only | Clean-room pattern reference only. |
| us-gov-open-data-mcp | unverified | Reimplement only; shipped repo substrate takes precedence. |
| harvest-mcp, lawyergpt | unknown | Reference only; never vendor. |

## 3. External sources

Current implementation authority is bounded to:

- GovInfo official [API docs](https://api.govinfo.gov/docs/),
  [developer page](https://www.govinfo.gov/developers),
  [API overview](https://www.govinfo.gov/features/api), and
  [key signup](https://www.govinfo.gov/api-signup).
- eCFR keyless [API v1 documentation](https://www.ecfr.gov/developers/documentation/api/v1),
  [machine contract](https://www.ecfr.gov/developers/documentation/api/v1.json),
  and [developer resources](https://www.ecfr.gov/reader-aids/ecfr-developer-resources).
- api.data.gov [developer manual](https://api.data.gov/docs/developer-manual/)
  for the shared key/rate-limit contract.
- MCP [tools specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/server/tools),
  subject to the installed Effect server.
- Effect-native MCP behavior verified by the shipped `mcp-kit` and `uspto-mcp`
  packets; re-verify installed source during P0.

Federal Register, CourtListener, and DOL URLs remain reproduced in the primary
ledger because those sources are explicitly outside this goal’s bounded host.

## 4. In-repo capabilities

| Capability | Path | Disposition |
| --- | --- | --- |
| GovInfo proven keyed driver | `packages/drivers/govinfo` | Reuse public surface; `hard` gate. |
| eCFR proven keyless driver | `packages/drivers/ecfr` | Reuse public surface; `none` gate. |
| MCP host kit | `packages/foundation/capability/mcp-kit` | Reuse SourceAuth, gated composition, sanitized toolkit, annotations. |
| USPTO MCP | `packages/drivers/uspto-mcp` | Worked thin-host/auth/fixture/server example. |
| M365/NLP MCP | `packages/drivers/{m365-mcp,nlp-mcp}` | Worked server/toolkit examples. |
| API transport | `packages/foundation/capability/api-transport` | Driver-owned transport; do not duplicate in host. |
| Gov legal MCP package | `packages/drivers/gov-legal-mcp` | NET-NEW thin sibling and collision-report owner. |

## 5. Cross-links

- [`BRIEF`](../../../explorations/gov-legal-data-driver-codegen/BRIEF.md)
- [`DECISIONS`](../../../explorations/gov-legal-data-driver-codegen/DECISIONS.md)
- [`MAP`](../../../explorations/gov-legal-data-driver-codegen/MAP.md)
- [`predecessor`](../../gov-legal-data-driver-codegen/README.md)
- [`delivery boundary`](../../gov-legal-data-driver-delivery/README.md)
- [`mcp-kit`](../../mcp-kit/README.md) and [`uspto-mcp`](../../uspto-mcp/README.md)
