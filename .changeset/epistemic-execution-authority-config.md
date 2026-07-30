---
"@beep/epistemic-config": patch
"@beep/ontology-config": patch
"@beep/professional-desktop": patch
"@beep/identity": patch
---

Add `@beep/epistemic-config` and move the ontology MCP registration flag onto typed config.

`@beep/epistemic-config` owns the execution-authority settings the rest of the slice is
evaluated against: the destination allowlist (`EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST`,
fail-closed when absent) and the pinned policy revision (`EPISTEMIC_POLICY_REVISION`).
Audience is not configured — `resolveSinkAudience` derives it from the destination, so a
caller can never declare the friendlier one. The package also ships the deterministic
frozen grant-set fixture the execution-authority acceptance test chains ledger rows
against; its digest stability is asserted, not assumed.

`@beep/ontology-config` gains `OntologyMcpConfig`, a service separate from the filesystem
authority contract, carrying `ONTOLOGY_MCP_MUTATIONS_ENABLED`. The desktop sidecar
entrypoint no longer reads that flag through a module-top-level
`Effect.runSync(Config.boolean(...))`; the MCP transport resolves it inside `Layer.unwrap`
so the registration branch stays where the layer is built. The flag is now declared in
`.env.example` and `turbo.json` `passThroughEnv`, neither of which listed it before.

This is PR 2 of goals/agent-execution-authority.
