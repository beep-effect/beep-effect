# Security Cloud findings capture

The authenticated findings app moved to
[Security Cloud](https://chatgpt.com/mcp-app/connector_openai_defense_factory/open_defense_factory#/findings).
Use the `codex-findings` skill and `beep codex findings ingest`; never hand-build
remediation packets.

## Access decision (verified 2026-10-05)

The authenticated Codex in-app browser can display findings and their detail
pages without the Chrome computer-control extension. Prefer supported cloud
connector tools when the agent session actually exposes list/get/export actions,
then page-defined WebMCP tools if available, then the authenticated in-app UI.
The `mcp-app` route identifies an app surface; it does not itself document an
external MCP endpoint or grant this agent callable connector tools.

The investigated session exposed no Security Cloud connector tools, and the
signed-in document's WebMCP inventory returned no tools. This establishes the
current session's limits, not permanent absence of a provider API. Do not infer
capabilities from connector names, extract browser credentials, or implement an
undocumented authenticated fetch client.

The official [CLI reference](https://learn.chatgpt.com/docs/security/cli/reference)
describes local findings history and local occurrence triage. The
[Cloud FAQ](https://learn.chatgpt.com/docs/security/faq) distinguishes Cloud scans
of connected repositories from local plugin tasks. The upstream
[TypeScript SDK](https://github.com/openai/codex-security/blob/main/sdk/typescript/README.md)
documents publishing scans to Cloud; this does not establish Cloud list/get or
closure APIs. Keep the existing sealed local scan lane separate.

## Current CSV import

In the authenticated app, scope to one repository and intended statuses, then
choose **More finding actions → Export CSV**. Confirm the external download link
if prompted; never save its signed URL in receipts.

```sh
bun run beep codex findings ingest \
  --from security-findings.csv \
  --date 2026-10-05 --expected-count 15 --dry-run --json
```

Use the actual capture date and count. The current filename has no date; an
explicit date makes ingestion reproducible. Remove `--dry-run` to create the
packet once its scope is established. All packet generation after file export is
programmatic; the CLI does not authenticate to ChatGPT.

The parser recognizes two exact headers:

- Legacy 17-column export: `finding_url`, `repository`, and report description,
  with personal-data columns dropped at the boundary.
- Current 10-column export: `Finding ID`, `Source`, `Repository`, `Title`,
  `Summary`, `Severity`, `Status`, `Paths`, `Observed revision`, `Detected at`.

Current diff-scan identities are `commit:<32 lowercase hexadecimal characters>`.
Preserve the whole identifier. Repository is a canonical GitHub URL; ingestion
normalizes it to owner/repository and rejects mixed repositories. Unknown
headers, sources, malformed rows, and duplicate IDs fail closed. Other scan
source formats need actual export evidence before adding an adapter.

## Evidence and closure

The current CSV provides **Summary**, not the complete report. Before a P2
verdict, read the finding's Validation, Evidence, and Attack-path analysis. Keep
full captured detail material ignored under `raw/`; tracked prose contains only
reviewed metadata, sanitized summaries, decisions, and proof. If detail evidence
is unavailable, record the gap and hold verdicts that need it.

The current status UI offers New, Triaged, In Progress, Fixed, Won't fix,
Duplicate, and False positive. Open view filters use `new`, `triaged`, and
`in_progress`; inspected additional filters use `wontfix` and `false_positive`.
After merge and merged-revision proof, close only the packet's exact cloud-ID
allowlist as **Fixed** or a strictly proven **False positive**. Won't fix and
Duplicate do not satisfy the remediation packet's completion gate. Record the
full identity, decision, proof revision, and observed final state; verify zero
packet-applicable open findings independently of PR merge readiness.

Current detail routes use `#/findings/commit%3A<id>` on the MCP-app URL. Navigate
from the list if a direct detail route is unavailable. Never submit local
`local:csf_…` identities to cloud actions.

## Historical packets and future connector work

Refresh requires an exact full-snapshot superset and stable capture provenance.
Bare legacy IDs and namespaced current IDs are distinct identities; there is no
verified migration map. Do not strip namespaces, overwrite historical triage,
or use `--force` as migration. Start a new capture or obtain authoritative
identity mapping before designing a separate reviewed migration.

A fully programmatic Cloud lane needs a supported authenticated interface for
listing with pagination and filters, reading complete detail evidence, and
setting statuses with observable final-state receipts. When such tools become
available, add a separate adapter with source-bound provenance and contract
fixtures. Keep CSV import as a deterministic fallback. App navigation alone and
local scan-upload capability are insufficient evidence to implement that lane.
