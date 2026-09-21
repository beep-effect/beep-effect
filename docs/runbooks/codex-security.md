# Codex Security local scan and packet workflow

The cloud CSV workflow remains available. The local workflow uses the official
CLI with a pinned package and turns sealed findings into the existing goal
pipeline. It does not manage cloud scan editors, notifications, sharing, or
dashboard closure.

## Runtime

Install the pinned package outside the checkout:

```sh
npm install --prefix ~/.cache/beep/codex-security/0.1.27 \
  --ignore-scripts --no-audit --no-fund --save-exact @openai/codex-security@0.1.27
```

Use supported Node.js (22.13+, 24, or 26) and Python 3.10+ as specified by the
upstream package. The published package reports bundled plugin 0.1.95; the
documentation changelog may lag. Ingestion is pinned to that artifact contract.
Upgrades require fixtures and compatibility validation, not changing a version
string alone.

The adapter explicitly selects stored ChatGPT authentication and supplies only
HOME, PATH, and its private state directory to the child. It does not extract
cookies or forward ambient API keys. Scan execution still uses a hosted model
and the account's access and usage limits. Installing the runtime does not grant
security-model access.

## Preflight and scan

Choose a new private output directory whose parent exists outside the checkout:

```sh
mkdir -p ~/.cache/beep/security-results
bun run beep codex security preflight \
  --output-dir ~/.cache/beep/security-results/review-001 --max-cost 5
bun run beep codex security scan \
  --output-dir ~/.cache/beep/security-results/review-001 --max-cost 5 \
  --timeout-minutes 30 --path packages/tooling/tool/cli
```

Preflight invokes upstream dry-run without starting a scan. Standard scans use
gpt-6-astra with medium reasoning and docs/security/threat-model.md. The adapter
does not patch, publish, or create a PR. Cost is an estimate, not a hard cap;
the local timeout bounds execution separately. Budgets must be positive and at
most $100; timeout must be 1–120 minutes. Nonzero upstream results remain
failures, including partial/unknown coverage. Inspect retained private artifacts.

Use a clean, committed checkout for bundle ingestion. This first adapter accepts
only git_revision targets from completed scans. Dirty snapshots and diff targets
require a future evidence model; do not relabel them as committed scans.

## Ingest and execute

```sh
bun run beep codex findings ingest --source security-bundle \
  --from ~/.cache/beep/security-results/review-001 --dry-run --json
bun run beep codex findings ingest --source security-bundle \
  --from ~/.cache/beep/security-results/review-001
```

Pass the actual sealed scan directory containing scan-manifest.json. Ingest
checks bounded files (16 MiB each, 64 MiB total), canonical containment,
digests, scan IDs, duplicate identities, a supported producer, and privacy
before writing. It also invokes the pinned upstream exporter with discarded
output to validate the full sealed contract without starting a scan.
Synthetic mock results are rejected. When the manifest omits its
remote, the wrapper records a separate `beep-source.json` repository/commit
receipt. Ingest requires that receipt to agree with the sealed revision and any
sealed remote; it never rewrites the manifest. The manifest seal
establishes integrity, not authenticity or correctness of a finding.

The default packet ends in `-local`; use `--slug` for another scan on the same
date. Local finding identities are namespaced as `local:csf_…`; cloud IDs keep
their existing form. Original occurrence IDs, fingerprints, source revision,
coverage, and finding evidence stay in ignored raw/security-bundle.json.
Partial coverage remains evidence to review, not a clean security verdict.

Bundle imports cannot use --date, --refresh, or --force. A new scan gets a new
packet; cloud CSV refresh retains its existing preservation checks. Execute the
generated GOAL.md, validate against current HEAD, remediate, and complete Yeet.
Record targeted verification and the merged revision in local triage; do not
attempt to close local IDs in the cloud dashboard.

## Cloud configuration

PR Security Review can be configured to read docs/security/threat-model.md.
Configure triggers and reporting thresholds in Codex settings. Findings posted
to a public PR inherit that visibility. Existing cloud scan threat models must
be updated separately in the UI. Scan editors can administer those settings;
no supported cloud-settings API is assumed by these commands.

Sources checked 2026-09-16:

- https://learn.chatgpt.com/docs/security/cli/reference
- https://learn.chatgpt.com/docs/security/sdk
- https://learn.chatgpt.com/docs/security/security-review
- Published @openai/codex-security 0.1.27 runtime metadata and bundled schemas.
