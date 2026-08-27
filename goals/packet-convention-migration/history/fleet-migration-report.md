# Packet convention migration report

Mode: `apply`
Probed: 160 goal manifests
Translations: 65
Genesis seeds: 65

## Drift summary

- breaking: 65 packets
- additive: 14 packets
- cosmetic: 0 packets

## Translations

- `agent-effectiveness-loop`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `agent-pipeline-velocity`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `agent-reflection-loop`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `agentic-professional-runtime`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `ai-metrics-stack`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `beep-schema-topology`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `box-driver`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status (breaking, additive); seed=yes
- `canonical-slice-factory`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `canvas`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `chat-input-and-theming`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `chat-surface-parity`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `codex-security-findings-2026-06`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `codex-security-findings-2026-06-17`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `codex-security-findings-2026-07-08`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `desktop-chat-surface`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `domain-kernel-hardening`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `effect-native-migration`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `epistemic-claim-lifecycle-gate`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `fallow-advisory-ratchets`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `fallow-quality-enforcement`: schemaVersion -> initiative-manifest/v2; add packetPath from the scanned directory (breaking, additive); seed=yes
- `fallow-zero-dead-code`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `file-processing-capability`: schemaVersion -> initiative-manifest/v2; add packetPath from the scanned directory (breaking, additive); seed=yes
- `firecrawl-driver`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `gov-legal-data-driver-codegen`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `gov-legal-data-driver-delivery`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `identity-iri-core`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `jsdoc-worker-eval`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `langextract-capability`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `law-practice-office-action-extraction-rung`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `law-practice-office-action-spike`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `legal-document-intake`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `lint-advisory-hardening`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `lint-toolchain-modernization`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `m365-driver`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `m365-mcp`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `mcp-host-retrofit`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `mcp-kit`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `nlp-adjunct-port`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `official-data-sync-foundation`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `oip-web-production-hardening`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `one-round-loop`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `ontology-agent-surface`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `ontology-interop-roadmap`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `ontology-workbench`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `oppold-corpus-pipeline`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `oppold-corpus-refresh`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `pandoc-ast-foundation`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `provenance-shared-claim-kernel`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `quality-gate-ratchets`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `repo-cli-modularization`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `repo-crispening-orchestration`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `repo-quality-convergence`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `repo-quality-throughput`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `rich-text-foundation`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `schema-first-v4-capabilities`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `schema-first-zero-actionables`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `semantic-foundation`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `skillopt-training-pilot`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `standards-remediation`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `storybook-app`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `trustgraph-doc-ontology`: schemaVersion -> initiative-manifest/v2; add lifecycle from initiative.status; add packetPath from the scanned directory (breaking, additive); seed=yes
- `unified-ai-toolchain`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `uspto-mcp`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `workspace-thread-domain`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes
- `yeet-agent-ergonomics`: schemaVersion -> initiative-manifest/v2 (breaking); seed=yes

## Issues

- warning: `law-docketing-patent-spine` [unmigrated-reference] — packet reference "goals/m365-driver" resolves, but its target is not yet v2
- warning: `schema-first-zero-actionables` [unmigrated-reference] — packet reference "standards-remediation" resolves, but its target is not yet v2

## Assumptions

- `agent-effectiveness-loop` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `agent-effectiveness-loop` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `agent-effectiveness-loop` — The scanned goals/<slug> directory is the packet's canonical path.
- `agent-pipeline-velocity` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `agent-reflection-loop` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `agentic-professional-runtime` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `agentic-professional-runtime` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `agentic-professional-runtime` — The scanned goals/<slug> directory is the packet's canonical path.
- `ai-metrics-stack` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `beep-schema-topology` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `beep-schema-topology` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `beep-schema-topology` — The scanned goals/<slug> directory is the packet's canonical path.
- `box-driver` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `box-driver` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `canonical-slice-factory` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `canonical-slice-factory` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `canonical-slice-factory` — The scanned goals/<slug> directory is the packet's canonical path.
- `canvas` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `canvas` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `canvas` — The scanned goals/<slug> directory is the packet's canonical path.
- `chat-input-and-theming` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `chat-surface-parity` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `codex-security-findings-2026-06` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `codex-security-findings-2026-06-17` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `codex-security-findings-2026-07-08` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `desktop-chat-surface` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `domain-kernel-hardening` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `effect-native-migration` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `effect-native-migration` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `effect-native-migration` — The scanned goals/<slug> directory is the packet's canonical path.
- `epistemic-claim-lifecycle-gate` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `fallow-advisory-ratchets` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `fallow-quality-enforcement` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `fallow-quality-enforcement` — The scanned goals/<slug> directory is the packet's canonical path.
- `fallow-zero-dead-code` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `file-processing-capability` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `file-processing-capability` — The scanned goals/<slug> directory is the packet's canonical path.
- `firecrawl-driver` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `gov-legal-data-driver-codegen` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `gov-legal-data-driver-delivery` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `identity-iri-core` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `jsdoc-worker-eval` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `jsdoc-worker-eval` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `jsdoc-worker-eval` — The scanned goals/<slug> directory is the packet's canonical path.
- `langextract-capability` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `law-practice-office-action-extraction-rung` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `law-practice-office-action-spike` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `legal-document-intake` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `lint-advisory-hardening` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `lint-toolchain-modernization` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `m365-driver` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `m365-mcp` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `mcp-host-retrofit` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `mcp-kit` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `nlp-adjunct-port` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `nlp-adjunct-port` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `nlp-adjunct-port` — The scanned goals/<slug> directory is the packet's canonical path.
- `official-data-sync-foundation` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `oip-web-production-hardening` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `oip-web-production-hardening` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `oip-web-production-hardening` — The scanned goals/<slug> directory is the packet's canonical path.
- `one-round-loop` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `ontology-agent-surface` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `ontology-interop-roadmap` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `ontology-workbench` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `oppold-corpus-pipeline` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `oppold-corpus-refresh` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `pandoc-ast-foundation` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `provenance-shared-claim-kernel` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `quality-gate-ratchets` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `repo-cli-modularization` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `repo-crispening-orchestration` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `repo-quality-convergence` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `repo-quality-convergence` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `repo-quality-convergence` — The scanned goals/<slug> directory is the packet's canonical path.
- `repo-quality-throughput` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `rich-text-foundation` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `schema-first-v4-capabilities` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `schema-first-zero-actionables` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `semantic-foundation` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `skillopt-training-pilot` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `standards-remediation` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `storybook-app` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `trustgraph-doc-ontology` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `trustgraph-doc-ontology` — lifecycle is a compatibility mirror of initiative.status, not independent history.
- `trustgraph-doc-ontology` — The scanned goals/<slug> directory is the packet's canonical path.
- `unified-ai-toolchain` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `uspto-mcp` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `workspace-thread-domain` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.
- `yeet-agent-ergonomics` — The observed initiative/status/completion-gate shape is compatible with the lenient v2 contract.

## Fleet lint

Duplicate slugs: 0
Dependency cycles: 0
Unreachable packet references: 0
Known but not-yet-v2 references: 2

## Post-apply verification

- remaining translations: 0
- remaining genesis seeds: 0
- translation issues: 0
- fleet findings: 0
