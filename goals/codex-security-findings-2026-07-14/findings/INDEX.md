# Codex Security Findings Index (2026-07-14)

Captured from Codex Cloud Security for `kriegcloud/beep-effect` on 2026-07-14 via codex's Chrome extension. **9** open findings were captured and triaged — the exact `1-9 of 9` batch the `2026-07-08` packet closeout flagged as newer work and left untouched. Full report text, evidence paths, source commits, and attack analysis stay in gitignored raw evidence under `raw/`; tracked rows carry title, severity, disposition, owner area, and workflow state only.

Disposition -> Codex close reason: remediate -> Already fixed after merge. Accepted risk / Won't fix is intentionally unavailable for this packet. No `.repos/**` out-of-scope findings appear in this batch.

## Severity Summary

| Severity | Count |
|---|---:|
| Medium | 5 |
| Low | 3 |
| Informational | 1 |

## Disposition Summary

| Disposition | Count | Codex reason |
|---|---:|---|
| remediate | 9 | Already fixed post-merge |

## Remediation Lanes

| Lane | Findings | Owner | Scope |
|---|---|---|---|
| RL-001 | CSF-001 | codex gpt-5.6-sol/medium | agents ProviderInstance + ai-provider-cli execution sink |
| RL-002 | CSF-003, CSF-005 | codex gpt-5.6-sol/medium | documents-server intake + vault sync, doc-text driver, desktop runtime |
| RL-003 | CSF-004, CSF-006 | codex gpt-5.6-sol/medium | ontology provenance export + SHACL/rdf/semantic-web validation |
| RL-004 | CSF-002, CSF-007, CSF-008, CSF-009 | codex (#2,#7,#8) + Fable (#9 bun.lock) | repo MCP config, goals-doctor CLI, docs scrub, lockfile dedupe |

## Findings

| ID | Severity | Verdict | Disposition | Codex Status | Lane | Title | Owner Area | Codex Close Reason |
|---|---|---|---|---|---|---|---|---|
| [CSF-001](./CSF-001.md) | Medium | real | remediate | Open | RL-001 | ProviderInstance probe can launch client-chosen executables | agents / ai-provider-cli | pending post-merge |
| [CSF-002](./CSF-002.md) | Medium | real | remediate | Open | RL-004 | Auto-enabled Grafana MCP runs unpinned Docker with host network | repo MCP config | pending post-merge |
| [CSF-003](./CSF-003.md) | Medium | real | remediate | Open | RL-002 | Vault sync follows symlinks during file upload reads | documents server vault sync | pending post-merge |
| [CSF-004](./CSF-004.md) | Medium | real | remediate | Open | RL-003 | Provenance export CAS can overwrite unrelated TTL files | ontology provenance export | pending post-merge |
| [CSF-005](./CSF-005.md) | Medium | real | remediate | Open | RL-002 | Unbounded document text extraction enables intake DoS | document intake / doc-text | pending post-merge |
| [CSF-006](./CSF-006.md) | Low | real | remediate | Open | RL-003 | Blank-node SHACL datatype repairs can crash validation | SHACL datatype repair | pending post-merge |
| [CSF-007](./CSF-007.md) | Low | real | remediate | Open | RL-004 | Goals doctor allows arbitrary path existence probing | repo-cli goals doctor | pending post-merge |
| [CSF-008](./CSF-008.md) | Low | real | remediate | Open | RL-004 | Committed docs leak developer filesystem paths | docs/agent-memory-infra | pending post-merge |
| [CSF-009](./CSF-009.md) | Informational | real | remediate | Open | RL-004 | Stale nested Next versions left in lockfile | apps/oip-web lockfile | pending post-merge |
