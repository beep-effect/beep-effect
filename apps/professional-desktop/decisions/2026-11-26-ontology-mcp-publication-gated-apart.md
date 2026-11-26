---
title: Ontology MCP publication is gated apart from workspace mutations
date: 2026-11-26
reversal: Grant the publication tool through the workspace TierGate and register it on every install.
governs:
  - server/OntologyMcpTransport.ts#ontologyWorkspaceSink
  - server/OntologyMcpTransport.ts#ontologyEgressSink
  - server/OntologyMcpTransport.ts#ontologySessionGrantTtl
  - server/OntologyMcpTransport.ts#makeOntologyMcpTransportLayer
enforcedBy: []
---

Sinks are composition-root constants classified by construction: every governed mutation writes the local workspace (`workspace://ontology`), and the URL-parsing resolver stays for network-egress destinations. The ledger records a sink's digest, never the raw destination.

Publication has its own TierGate against `network://governed-egress`, a sink naming the class of egress, because `ToolCallRequest` carries no parameters and the gate cannot see a dispatch's destination. The gate decides whether the session may publish; the governed egress `Fetch` decides which destination a request may reach; each writes its own decision row. Both gates draw from one approval list, so a test can register the publication tool while granting nothing. The tool is registered only when `destinationAllowlist` is non-empty, so a stock install ships neither the sink nor its control.

Rejected: granting publication through the workspace gate, a second authority for it against the workspace sink.

Rejected: registering the publication tool with an empty allowlist.

Accepted limit: grants live 12 hours, longer than any interactive session; a session's frozen grants expire together and an expired run can only deny.
