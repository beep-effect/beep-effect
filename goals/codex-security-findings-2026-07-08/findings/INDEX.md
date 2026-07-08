# Codex Security Findings Index (2026-07-08)

Captured from Codex Cloud Security for `beep-effect/beep-effect` on 2026-07-08 using Codex Chrome control. **45** open findings were captured and triaged. Detailed report text, evidence paths, source commits, exploit analysis, and Codex patch bodies stay in gitignored raw evidence under `raw/`; tracked rows carry title, severity, disposition, owner area, and workflow state only. Non-remediation closeout completed in Codex on 2026-07-08T11:26:24.118Z. Remediation for the 30 legitimate maintained-code findings is complete locally and pending Yeet PR merge before Codex closure.

Disposition -> Codex close reason: remediate -> Already fixed after merge; already-fixed -> Already fixed; false-positive and out-of-scope -> False positive. Accepted risk / Won't fix is intentionally unavailable for this packet.

## Severity Summary

| Severity | Count |
|---|---:|
| High | 6 |
| Medium | 9 |
| Low | 11 |
| Informational | 19 |

## Disposition Summary

| Disposition | Count | Codex reason |
|---|---:|---|
| untriaged | 0 | pending validation |
| remediate | 30 | Already fixed post-merge |
| already-fixed | 4 | Already fixed |
| false-positive | 6 | False positive |
| out-of-scope (.repos) | 5 | False positive |

## Validation Summary

| Batch | Findings | Status |
|---|---|---|
| VB-001 | CSF-001..CSF-006 | complete |
| VB-002 | CSF-007..CSF-012 | complete |
| VB-003 | CSF-013..CSF-018 | complete |
| VB-004 | CSF-019..CSF-024 | complete |
| VB-005 | CSF-025..CSF-030 | complete |
| VB-006 | CSF-031..CSF-036 | complete |
| VB-007 | CSF-037..CSF-042 | complete |
| VB-008 | CSF-043..CSF-045 | complete |

## Remediation Lanes

| Lane | Findings | Status | Scope |
|---|---|---|---|
| RL-001 | CSF-001, CSF-005, CSF-007, CSF-011, CSF-014 | complete pending merge | CI, release, and repo-security policy |
| RL-002 | CSF-003, CSF-016, CSF-023, CSF-024, CSF-026, CSF-027, CSF-032 | complete pending merge | Agent/plugin and committed local-path surfaces |
| RL-003 | CSF-006, CSF-008, CSF-012, CSF-030, CSF-031 | complete pending merge | Repo-cli generators, skills updater, corpus, and codemod tooling |
| RL-004 | CSF-010, CSF-017, CSF-018, CSF-019, CSF-022, CSF-044 | complete pending merge | Foundation and editor boundary validation |
| RL-005 | CSF-015, CSF-025 | complete pending merge | Remote extraction and evidence integrity gates |
| RL-006 | CSF-029, CSF-033, CSF-036, CSF-038, CSF-040 | complete pending merge | Drivers and scratchpad generator/runtime hardening |

## Findings

| ID | Severity | Verdict | Disposition | Codex Status | Lane | Title | Owner Area | Codex Close Reason | Patch Captured |
|---|---|---|---|---|---|---|---|---|---|
| [CSF-001](./CSF-001.md) | High | real | remediate | New | RL-001 | Turbo token exposed to same-repo PR code | CI/GitHub Actions | pending post-merge | yes |
| [CSF-002](./CSF-002.md) | High | out-of-scope | out-of-scope | Closed | _none_ | Host header controls TLS SNI and certificate identity | .repos external/vendor checkout | False positive | yes |
| [CSF-003](./CSF-003.md) | High | real | remediate | New | RL-002 | DataMoat plugin installs code that captures local AI histories | agent plugin marketplace | pending post-merge | yes |
| [CSF-004](./CSF-004.md) | High | out-of-scope | out-of-scope | Closed | _none_ | Event-log RPC trusts client-supplied public keys | External effect-v4 mirror under .repos | False positive | yes |
| [CSF-005](./CSF-005.md) | High | real | remediate | New | RL-001 | Signing key is read before release approval | desktop release CI | pending post-merge | yes |
| [CSF-006](./CSF-006.md) | High | real | remediate | New | RL-003 | Unescaped upstream data can inject generated TypeScript | repo-cli SyncDataToTs data generation and data-sync workflow | pending post-merge | yes |
| [CSF-007](./CSF-007.md) | Medium | real | remediate | New | RL-001 | Workflow dispatch input enables shell injection | CI / GitHub Actions | pending post-merge | no |
| [CSF-008](./CSF-008.md) | Medium | real | remediate | New | RL-003 | Research daily can commit raw browser history on scan failure | repo-cli research command | pending post-merge | no |
| [CSF-009](./CSF-009.md) | Medium | out-of-scope | out-of-scope | Closed | _none_ | Unbounded event-log chunk reassembly enables DoS | .repos/effect-v4 vendored upstream Effect reference | False positive | no |
| [CSF-010](./CSF-010.md) | Medium | real | remediate | New | RL-004 | Tier gate permits non-read-only writes without approval | packages/foundation/capability/mcp-kit | pending post-merge | no |
| [CSF-011](./CSF-011.md) | Medium | real | remediate | New | RL-001 | Broad gitleaks allowlist disables secret scanning | repo-security-ci | pending post-merge | no |
| [CSF-012](./CSF-012.md) | Medium | real | remediate | New | RL-003 | Remote skill updater allows path traversal writes | repo-cli skills updater | pending post-merge | no |
| [CSF-013](./CSF-013.md) | Medium | out-of-scope | out-of-scope | Closed | _none_ | N3 writer allows RDF injection via unescaped IRIs | external N3 dependency / ignored research checkout | False positive | no |
| [CSF-014](./CSF-014.md) | Medium | real | remediate | New | RL-001 | Desktop signing job no longer uses protected environment | GitHub Actions desktop release / professional-desktop | pending post-merge | no |
| [CSF-015](./CSF-015.md) | Medium | real | remediate | New | RL-005 | Office actions sent to LLM provider without a guard | law-practice server / LangExtract | pending post-merge | no |
| [CSF-016](./CSF-016.md) | Low | real | remediate | New | RL-002 | Committed SkillOpt artifacts leak local filesystem paths | goals/skillopt-training-pilot generated SkillOpt history artifacts | pending post-merge | no |
| [CSF-017](./CSF-017.md) | Low | real | remediate | New | RL-004 | Unsafe Turtle IRI formatting permits RDF injection | foundation/modeling/identity | pending post-merge | no |
| [CSF-018](./CSF-018.md) | Low | real | remediate | New | RL-004 | Unsafe deepMerge permits prototype poisoning | foundation/modeling/utils | pending post-merge | no |
| [CSF-019](./CSF-019.md) | Low | real | remediate | New | RL-004 | Dynamic heading level enables HTML injection | @beep/md HTML renderer | pending post-merge | no |
| [CSF-020](./CSF-020.md) | Low | already-fixed | already-fixed | Closed | _none_ | Predictable /tmp inspector script path enables local code execution | dev-tooling / vendored subtree hygiene | Already fixed | no |
| [CSF-021](./CSF-021.md) | Low | out-of-scope | out-of-scope | Closed | _none_ | Schema.Void now accepts arbitrary input | Vendored/external Effect v4 dependency | False positive | no |
| [CSF-022](./CSF-022.md) | Low | real | remediate | New | RL-004 | Attachment size limit bypasses upload callback | @beep/editor chat composer attachments | pending post-merge | no |
| [CSF-023](./CSF-023.md) | Low | real | remediate | New | RL-002 | Developer-local paths committed in research prompt | goals/chat-input-and-theming research seed documentation | pending post-merge | no |
| [CSF-024](./CSF-024.md) | Low | real | remediate | New | RL-002 | Internal Tailnet service URL leaked in README | explorations/solo-firm-docketing docs | pending post-merge | no |
| [CSF-025](./CSF-025.md) | Low | real | remediate | New | RL-005 | Claim gate admits claims with fabricated evidence spans | epistemic claim admission / provenance spans | pending post-merge | no |
| [CSF-026](./CSF-026.md) | Low | real | remediate | New | RL-002 | 1Password skill exposes vault metadata to agent transcripts | repo-local agent skills / developer workflow | pending post-merge | no |
| [CSF-027](./CSF-027.md) | Informational | real | remediate | New | RL-002 | Training artifacts disclose local filesystem paths | goals/skillopt-training-pilot training history | pending post-merge | no |
| [CSF-028](./CSF-028.md) | Informational | false-positive | false-positive | Closed | _none_ | Path.basename one-argument calls now return a function | foundation/modeling/utils | False positive | no |
| [CSF-029](./CSF-029.md) | Informational | real | remediate | New | RL-006 | Unvalidated PACER report IDs used in cleanup DELETEs | @beep/pacer PACER PCL client | pending post-merge | no |
| [CSF-030](./CSF-030.md) | Informational | real | remediate | New | RL-003 | Static API codemod rewrites shadowed identifiers | repo-crispening-orchestration codemods | pending post-merge | no |
| [CSF-031](./CSF-031.md) | Informational | real | remediate | New | RL-003 | Unsanitized extract out-label permits path traversal | @beep/repo-cli corpus extract | pending post-merge | no |
| [CSF-032](./CSF-032.md) | Informational | real | remediate | New | RL-002 | Research docs leak private repo paths and internals | explorations/identity-as-iri research docs | pending post-merge | no |
| [CSF-033](./CSF-033.md) | Informational | real | remediate | New | RL-006 | Exported bin module starts MCP server on import | packages/drivers/uspto-mcp | pending post-merge | no |
| [CSF-034](./CSF-034.md) | Informational | false-positive | false-positive | Closed | _none_ | Inherited keys accepted as skill names | repo-cli skills updater | False positive | no |
| [CSF-035](./CSF-035.md) | Informational | false-positive | false-positive | Closed | _none_ | Removed overrides reintroduce vulnerable Autolinker | tooling/docgen | False positive | no |
| [CSF-036](./CSF-036.md) | Informational | real | remediate | New | RL-006 | PACER auth sends Option wrappers in login JSON | @beep/pacer authentication | pending post-merge | no |
| [CSF-037](./CSF-037.md) | Informational | false-positive | false-positive | Closed | _none_ | Schema default refactor drops defensive fallbacks | @beep/scratchpad ontology codegen | False positive | no |
| [CSF-038](./CSF-038.md) | Informational | real | remediate | New | RL-006 | Unsafe ontology IRI codegen allows TS code injection | @beep/scratchpad ontology codegen | pending post-merge | no |
| [CSF-039](./CSF-039.md) | Informational | false-positive | false-positive | Closed | _none_ | UTF-16 lastIndexOf returns code-unit offset | third-party dependency / Buffer compatibility | False positive | no |
| [CSF-040](./CSF-040.md) | Informational | real | remediate | New | RL-006 | Scratchpad logging code fails to compile and can crash | scratchpad/explore shared Logging | pending post-merge | no |
| [CSF-041](./CSF-041.md) | Informational | already-fixed | already-fixed | Closed | _none_ | PACER token rotation is not logged out on session release | @beep/pacer | Already fixed | no |
| [CSF-042](./CSF-042.md) | Informational | already-fixed | already-fixed | Closed | _none_ | Root utils import now loads Node-only filesystem modules | foundation/modeling/utils | Already fixed | no |
| [CSF-043](./CSF-043.md) | Informational | false-positive | false-positive | Closed | _none_ | Recharts pie story uses nullable index as a number | foundation/ui-system/ui Storybook chart stories | False positive | no |
| [CSF-044](./CSF-044.md) | Informational | real | remediate | New | RL-004 | IME Enter guard regression can submit mid-composition | foundation/ui-system editor chat composer | pending post-merge | no |
| [CSF-045](./CSF-045.md) | Informational | already-fixed | already-fixed | Closed | _none_ | ColorKit copy constructor now aliases mutable state | @beep/scratchpad / removed ColorKit sheet | Already fixed | no |
