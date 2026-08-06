# Codex Security Findings Index (2026-08-04)

Captured from the authenticated Codex Cloud Security view for
`kriegcloud/beep-effect` on 2026-08-04 through Chrome control and CSV export.
All 27 source commits are ancestors of the packet branch. Full reports remain ignored under
`raw/`; tracked records omit signed URLs, auth values, and raw local paths.

## Severity Summary

| Severity | Count |
| --- | ---: |
| Medium | 13 |
| Low | 7 |
| Informational | 7 |

## Findings

| ID | Severity | Status | Title | Owner area |
| --- | --- | --- | --- | --- |
| [CSF-001](./CSF-001.md) | Medium | remediated; local proof green | Unbounded source resolution enables sidecar memory DoS | epistemic/workspace source resolution |
| [CSF-002](./CSF-002.md) | Medium | remediated; local proof green | QA judge manifests can follow symlinks outside the round | repo-cli QA judge |
| [CSF-003](./CSF-003.md) | Medium | remediated; local proof green | Hosted provider URLs allow plaintext HTTP | OpenClaw config |
| [CSF-004](./CSF-004.md) | Medium | remediated; local proof green | Agent prompts and session keys exposed via process argv | OpenClaw CLI |
| [CSF-005](./CSF-005.md) | Medium | remediated; local proof green | Claims batch follows symlinks and can leak local files | practice claims |
| [CSF-006](./CSF-006.md) | Medium | remediated; local proof green | KG build follows corpus symlinks into local files | practice email import |
| [CSF-007](./CSF-007.md) | Medium | remediated; local proof green | Mutation-off MCP can publish workspace TTL files | ontology MCP |
| [CSF-008](./CSF-008.md) | Medium | remediated; local proof green | Digest-to-extraction TOCTOU in files process | files process/Tika/libpff |
| [CSF-009](./CSF-009.md) | Medium | remediated; local proof green | Gitleaks allowlist can hide 64-hex API tokens | gitleaks config |
| [CSF-010](./CSF-010.md) | Medium | remediated; local proof green | Image audit can be DoSed by large image sets | image curation |
| [CSF-011](./CSF-011.md) | Medium | remediated; local proof green | MCP mutation tools are auto-approved when registered | ontology MCP policy |
| [CSF-012](./CSF-012.md) | Medium | remediated; local proof green | Tika Server engine trusts arbitrary file locators | Tika server |
| [CSF-013](./CSF-013.md) | Medium | remediated; local proof green | PGlite extension loaded from poisonable temp path | desktop PGlite |
| [CSF-014](./CSF-014.md) | Low | remediated; local proof green | Changed-file JSDoc ratchet follows untrusted symlinks | JSDoc ratchet |
| [CSF-015](./CSF-015.md) | Low | remediated; local proof green | Hook-pulse schema leaks raw local paths | AI metrics |
| [CSF-016](./CSF-016.md) | Low | remediated; local proof green | Unvalidated language tags allow Turtle triple injection | ontology fold |
| [CSF-017](./CSF-017.md) | Low | remediated; local proof green | Migration erases usage Activity provenance | desktop migrations |
| [CSF-018](./CSF-018.md) | Low | remediated; local proof green | kg_provenance leaks local bundle filesystem path | practice KG MCP |
| [CSF-019](./CSF-019.md) | Low | remediated; local proof green | Unbounded PST EML assembly can exhaust memory | libpff |
| [CSF-020](./CSF-020.md) | Low | remediated; local proof green | Execution grants ignore principal during authorization | execution authority |
| [CSF-021](./CSF-021.md) | Informational | remediated; local proof green | CodeMode sparse arrays can bypass execution bounds | scratchpad CodeMode |
| [CSF-022](./CSF-022.md) | Informational | remediated; local proof green | Claims batch can falsely succeed with zero extractions | practice claims |
| [CSF-023](./CSF-023.md) | Informational | remediated; local proof green | Script text can spoof the new test-typecheck lint | package lint |
| [CSF-024](./CSF-024.md) | Informational | remediated; local proof green | Plugin writer allows manifest path traversal | scratchpad Claude plugin |
| [CSF-025](./CSF-025.md) | Informational | remediated; local proof green | Absolute local paths leaked in research catalog | academia corpus catalog |
| [CSF-026](./CSF-026.md) | Informational | remediated; local proof green | Goal packet verification fails on trailing whitespace | OpenClaw goal packet |
| [CSF-027](./CSF-027.md) | Informational | remediated; targeted proof green | Unescaped PR comments printed to terminal | Yeet monitor |

## Closeout Mapping

- `remediate` or `already-fixed` -> close as `Already fixed` after merge.
- Strictly proven invalid -> close as `False positive` with evidence recorded.
- Accepted risk / `Won't fix` is unavailable.
