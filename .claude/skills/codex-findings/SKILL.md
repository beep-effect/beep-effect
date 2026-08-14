---
name: codex-findings
description: Capture Codex Cloud security findings into a goal packet. Use when asked to capture findings, pull the security findings, bootstrap a Codex security findings packet, or remediate the latest Codex Cloud security batch. Covers the signed-in CSV export, `beep codex findings ingest`, and post-merge closure.
---

# Codex Security Findings

The full loop is: **export → ingest → `/goal` → remediate → Yeet → close**.
Only the export and the final closure happen in a browser. Everything between
them is `bun run beep codex findings ingest` plus the normal packet workflow.

Never hand-build the packet. Five batches were transcribed by hand before this
command existed; the boilerplate is exactly what it eliminates.

## 1. Export (browser, signed in)

Open the findings view and use its own **Export findings as CSV** control:

```
https://chatgpt.com/codex/cloud/security/findings/
```

Scope the view to the repository and the statuses you intend to capture before
exporting — the export reflects the current filter.

**The CLI never authenticates.** It reads a file you already downloaded. Do not
extract cookies, tokens, or authorization headers, do not pass credentials as
flags, and do not script a fetch against the findings API — a same-origin fetch
returns 401 and the "fix" for that is exactly the credential handling this
design exists to avoid.

## 2. Ingest

```sh
bun run beep codex findings ingest --from ~/Downloads/codex-security-findings-<timestamp>.csv
```

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
provenance drift all fail closed.

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
agent's job, from the raw report in `raw/`.

## 4. Close (browser, after merge)

Close only the exact captured Codex IDs, as `Already fixed` (or an
evidence-backed `False positive`). Accepted risk is not available. Direct
`/findings/<id>` URLs render blank — navigate from the list view.

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
  never copied into the repository — it carries report bodies and an email
  address in every row.
- **Writes are staged and recoverable.** The complete packet is scanned and
  staged before promotion. Refresh moves the prior packet to a recovery backup,
  verifies its bytes again, restores it on a failed promotion, and removes the
  backup only after the new packet is in place.

## Refresh an existing packet

Export the complete filtered findings view again, then run:

```sh
bun run beep codex findings ingest --refresh --from ~/Downloads/codex-security-findings-<timestamp>.csv
```

Do not pre-filter the refresh to only new rows: removals are indistinguishable
from a partial capture, so the command deliberately requires a full superset.

Source-commit ancestry is checked by a packet verification command rather than
the CLI, because this repository squash-merges and a valid finding's source
commit is frequently absent from the branch.
