---
name: codex-findings
description: Capture Codex Cloud security findings into a goal packet. Use when asked to capture findings, pull the security findings, bootstrap a Codex security findings packet, or remediate the latest Codex Cloud security batch. Covers the signed-in CSV export, `beep codex findings ingest`, and post-merge closure.
---

# Codex Security Findings

The full loop is: **export → ingest → `/goal` → remediate → Yeet → close**.
Capture/export, detail enrichment, and final closure use supported cloud tools
or the authenticated in-app UI. Packet creation is `bun run beep codex findings
ingest`; remediation follows the normal packet workflow. See
`docs/runbooks/codex-security-cloud.md` for the verified access findings.

Never hand-build the packet. Five batches were transcribed by hand before this
command existed; the boilerplate is exactly what it eliminates.

## 1. Export (authenticated Security Cloud)

Open the current findings view:

```
https://chatgpt.com/mcp-app/connector_openai_defense_factory/open_defense_factory#/findings
```

Prefer an exposed, supported connector tool for cloud list/get/export when its
schema actually covers the operation and pagination. A URL containing
`mcp-app` does not establish that those tools are available to the agent. Check
session tools and the authenticated page's WebMCP inventory first; do not invent
connector names or endpoints. The local Security CLI findings commands are not
established substitutes for cloud retrieval or closure.

The signed-in **in-app browser** is the verified Chrome-extension-free fallback.
Scope the view to one repository and the intended statuses; use **More finding
actions → Export CSV**. An export can require confirming an external download
link. Do not record its signed URL. Chrome is optional when an authenticated
in-app session is available.

**The CLI never authenticates.** It reads a downloaded file. Do not extract
cookies, tokens, or authorization headers, pass credentials as flags, or build an
undocumented authenticated API client. No cloud connector was exposed in the
2026-10-05 session; the authenticated page exposed no WebMCP tools. This is a
session observation, not a claim that programmatic access can never exist.

The current export has 10 columns, source-qualified `commit:` IDs, a GitHub
repository URL, and **Summary only**. Finding details separately contain
Validation, Evidence, and Attack-path analysis. Preserve complete identities and
obtain that detail evidence before P2 verdicts; record unavailable evidence and
hold unsupported decisions. Never treat Summary as the complete report.

## 2. Ingest

```sh
bun run beep codex findings ingest --from <download-dir>/security-findings.csv --date YYYY-MM-DD --expected-count N
```

`<download-dir>` is the browser download directory (conventionally `~/Downloads`).
The current filename contains no date, so pass `--date` explicitly. Both the
legacy 17-column export and current 10-column export are detected by exact header.
`--source security-cloud-csv` explicitly requires the current format.

Useful flags:

| Flag | Use |
|---|---|
| `--dry-run` | Report the packet without writing anything. |
| `--expected-count N` | Fail closed if the export holds fewer than the dashboard reported. |
| `--slug` / `--branch` / `--date` | Override the derived packet identity. |
| `--refresh` | Append unseen IDs from a full snapshot while preserving prior triage and CSF prose. |
| `--force` | Replace an existing packet. **Destroys hand-written triage prose.** |
| `--json` | Machine-readable summary. |

`--refresh` and `--force` are mutually exclusive. A refresh requires an
existing decodable packet and an exact full-snapshot superset: missing prior
IDs, changed prior metadata, duplicate bindings, count drift, or packet
provenance drift all fail closed. Cross-format identity migration is unsupported;
never strip `commit:` to make a refresh pass. Keep historical packet identities
until an authoritative mapping and deliberate migration are available.

The capture date comes from the export filename, or `--date`. It never comes
from the clock, so re-ingesting the same export is byte-identical.

What lands: `README.md`, `GOAL.md`, `SPEC.md`, `PLAN.md`, `research/SOURCES.md`,
`ops/manifest.json`, `ops/triage.json`, `findings/INDEX.md`, one
`findings/CSF-NNN.md` per finding, and a gitignored `raw/`.

On refresh, existing triage entries, lanes, and CSF files are not regenerated.
Unseen findings append after the highest reserved ordinal as untriaged P2/P3
work; machine-owned counts and status surfaces are reconciled, and the ignored
normalized raw snapshot is refreshed. The human and `--json` summaries include
the preserved IDs, appended IDs, and changed paths. Repeating an identical full
snapshot is a no-op.

## 3. Execute

```
/goal follow the instructions in goals/<slug>/GOAL.md
```

The packet arrives at the **P1 capture → P2 validate** boundary. Every finding
is `untriaged` with no verdict, owner, or lane, and every CSF body carries
`_pending P2_` markers. That is deliberate: the capture knows metadata, not
judgment. Writing the public summary and the current-HEAD verdict is the
agent's job, from the ignored evidence in `raw/` and the separately obtained
current Security Cloud detail evidence.

## 4. Close (browser, after merge)

Close only the exact captured cloud IDs after merge and merged-revision
verification, as **Fixed** or an evidence-backed **False positive**. Use supported
connector actions if exposed; otherwise use the signed-in in-app browser.
Current UI also offers Won't fix and Duplicate, but these do not satisfy this
packet's remediation gate. Record each full identity, decision, proof revision,
and observed final state. Verify zero packet-applicable open findings separately
from repository merge readiness. Do not mutate statuses during capture.

Current details use `#/findings/commit%3A<32-hex-id>` on the MCP-app URL; list
navigation is the fallback if a direct link does not load. Legacy bare IDs and
local IDs must never be silently converted into this namespace.

## Invariants worth knowing

- **Identifiers are sticky.** Refresh preserves each `codexId → CSF-NNN`
  binding and appends new findings. A number is never reused, and a refresh
  refuses a snapshot that omits a previously captured identity.
- **Personal data never enters the CLI.** `author_email`, `assignee_name`, and
  `assignee_email` are dropped at the parse boundary, and the reject-scan
  independently refuses email addresses.
- **Reject, never redact.** Secret-shaped content, private paths, bidi
  controls, and spreadsheet-formula sigils fail the ingest rather than being
  silently rewritten. Missed redaction in a public repo is irreversible; a
  false rejection costs one hand-edit.
- **`raw/` is gitignored and holds the normalized capture only.** The CSV is
  never copied into the repository. Legacy exports carry personal-data columns;
  the current export carries summaries and paths that still require review.
- **Writes are staged and recoverable.** The complete packet is scanned and
  staged before promotion. Refresh moves the prior packet to a recovery backup,
  verifies its bytes again, restores it on a failed promotion, and removes the
  backup only after the new packet is in place.

## Refresh an existing packet

Export the complete filtered findings view again, then run:

```sh
bun run beep codex findings ingest --refresh --from <download-dir>/codex-security-findings-<timestamp>.csv
```

Do not pre-filter the refresh to only new rows: removals are indistinguishable
from a partial capture, so the command deliberately requires a full superset.

Source-commit ancestry is checked by a packet verification command rather than
the CLI, because this repository squash-merges and a valid finding's source
commit is frequently absent from the branch.

## Local sealed scan source

Use `docs/runbooks/codex-security.md` for the supported local scanner. Run
`beep codex security preflight` before an explicitly budgeted `scan`; both use
the pinned external runtime and `docs/security/threat-model.md`.

```sh
bun run beep codex findings ingest --source security-bundle --from <sealed-scan-directory> --dry-run --json
bun run beep codex findings ingest --source security-bundle --from <sealed-scan-directory>
```

Local imports require a completed, digest-bound committed-revision scan from
the supported producer. Preserve `local:csf_…` identities and private occurrence,
fingerprint, scope, and coverage evidence. Partial coverage never proves a clean
repository. Follow the generated local GOAL.md: targeted fix verification and
merged-revision receipts replace dashboard closure. Local IDs must never be
submitted to cloud finding actions. Bundle imports do not support `--refresh`,
`--force`, or `--date`; cloud imports retain their separate evidence and closure requirements.
