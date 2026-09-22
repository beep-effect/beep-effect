# Gate C — Doctrine review (2026-09-17)

Headless grok reviewer (`grok-4.6`, effort high, no web search) over the Stage 2 synthesis drafts, the packet, and the Effect clone at `a7a71921de`.

Line references to `RESEARCH.md`, `research/impact-matrix.md`, and `research/SOURCES.md` point at the
pre-revision drafts the reviewer read; the committed files were rewritten against these findings
(see the Disposition table).

**Verdict:** `not-ready`

The drafts treat a still-open identity redesign as forced kit work keyed on McpRequestContext, which silently reverts decision 10 and parks product run semantics in foundation/capability. They also invent identity language in architecture 03/09/12, couple a 09 protocol-projection break into the P1 rebase, attach domain correlation onto kit spans, close the Origin-config grill without routing to @beep/ontology-config, and drop a P0–P5 train (with nonexistent grill-item indexes) into a research-stage artifact whose phase ids collide with goals/_template. Align cannot start from this as written.

## Findings

### D-B1 — blocker — Matrix B forces McpRequestContext fields as the sidecar gate key, silently reverting “a run is an MCP session”

- **Evidence:** impact-matrix.md:29 tags “Identity from McpRequestContext (clientId, clientInfo, requestMetadata)” **forced** for Sidecar “(gate key)”, and :30 tags McpCallerIdentity “sessionId retired or re-sourced” **forced** for sidecar. Combined with :69 “stop reading mcp-session-id”, HTTP identity collapses to McpRequestContext.clientId. That field is already documented as per-POST and unusable as a run key: RESEARCH.md:88–90; packages/foundation/capability/mcp-kit/src/McpCaller.ts:21–28; packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:188–197 (“clientId cannot key it… new run per dispatch”); goals/agent-execution-authority/SPEC.md:217 and :228–234 (decision 10 corrected off clientId). Lane 22-r3 already killed this as option E (explorations/effect-mcp-2026-07-28/research/22-r3-governance-identity.md:215). RESEARCH.md:176–180 still lists anchors as “none decided”, then P1 (RESEARCH.md:261) implements the kit redesign anyway.
- **Proposal:** Retag kit reads of McpRequestContext as transport facts only. Leave the GovernedTierGate run key as an align decision with an enumerated anchor list. Do not ship sessionId retirement or “stop reading mcp-session-id” until the replacement is server-minted and stable across HTTP POSTs. Cite goals/agent-execution-authority/SPEC.md decision 10, not architecture 03/09/12.
- **Grill question:** If mcp-session-id is gone and clientId is per POST, what server-minted, request-stable principal is the grant freeze actually keyed on — and which existing test (“keys the run on the session, not on the per-request client id”) are you willing to delete?

### D-B2 — blocker — P1 parks product run-identity in @beep/mcp-kit, violating foundation/capability’s “no product semantics” gate

- **Evidence:** RESEARCH.md:261 makes P1 “identity from McpRequestContext; McpCallerIdentity redesign” a kit PR that P4’s sidecar gate depends on. mcp-kit is foundation/capability; 07-non-slice-families.md:38–51 forbids product semantics there and requires the negative gate “no product semantics”. The existing inversion already puts run meaning in the slice: mcp-kit README:20 (epistemic/server implements TierGateShape; ontology/server consumes; binding at the app); GovernedTierGate.gate.ts:188–197 (runIdOf); agent-execution-authority SPEC.md:214–217 (decisions 6–7, 10). Redesigning McpCallerIdentity so it *is* the run key moves “a run is an MCP session” into foundation and keeps the session machine inside the kit — the complexity G4 (DECISIONS.md:54–62) was meant to remove. 03-driver-boundaries.md:35–36: if it needs slice language, it does not belong in a technical wrapper.
- **Proposal:** Keep McpCallerIdentity as transport caller facts (clientId, optional clientInfo). Own runIdOf, freeze, hash chain, and TTL in epistemic/server (and app composition). P4 depends on an align decision, not on a kit schema change. Update the mcp-kit README consumer note if the kit stops minting sessionId; do not invent a shared-kernel promotion record.
- **Grill question:** Why is the run principal a foundation schema field rather than a mapping inside GovernedTierGate, which already implements TierGateShape precisely so ontology and the kit do not name each other?

### D-M1 — major — P5/matrix E would write identity language into architecture 03/09/12, which do not contain it

- **Evidence:** impact-matrix.md:82: “Architecture docs 03, 09, 12 identity language (‘a run is an MCP session’)” forced when the anchor changes, targeting standards/architecture/. RESEARCH.md:265 repeats “architecture docs 03/09/12”. Grep of standards/ finds no “MCP session”, “mcp-session-id”, or “a run is an MCP session”. 03 is driver vs slice vs foundation; 09 is error translation; 12 is span/attribute conventions. The actual rule lives in goals/agent-execution-authority/SPEC.md:217, :228–234 and explorations/agent-execution-sandbox/DECISIONS.md:454. grill-with-docs requires architecture-wide doctrine changes to land in standards/architecture/DECISIONS.md, not as silent edits to unrelated numbered files. ARCHITECTURE.md:4–7: a proposal that contradicts the constitution must change the proposal or amend the constitution — this amends the wrong pages.
- **Proposal:** Delete 03/09/12 from the closeout row. If the run invariant becomes architecture-wide, add a dated standards/architecture/DECISIONS.md entry and, if needed, a glossary term. Otherwise keep it in the agent-execution-authority SPEC / epistemic package docs. Do not inject MCP session vocabulary into driver, error, or observability constitution.
- **Grill question:** Is “a run is an MCP session” architecture-wide doctrine, or a slice/goal invariant? If the former, why is it absent from ARCHITECTURE.md and the numbered packet today?

### D-M2 — major — Drafts name goals/ontology-agent-surface as the home of decision 10; that packet has no such decision

- **Evidence:** RESEARCH.md:167–169: “decision 10 of goals/ontology-agent-surface: ‘a run is an MCP session’”. scratchpad SOURCES.md:104: “Related goals: goals/ontology-agent-surface (decision 10, session identity)”. goals/ontology-agent-surface contains live-mcp-client.ts but no “decision 10” / “a run is an MCP session”. The decision is goals/agent-execution-authority/SPEC.md:217. This is a named path presented as if it owned the identity rule.
- **Proposal:** Cite goals/agent-execution-authority/SPEC.md decision 10 (and the sandbox exploration DECISIONS back-link). Keep ontology-agent-surface only for the live client/harness.

### D-M3 — major — P1 rebase silently changes the kit’s protocol error projection (09)

- **Evidence:** 09-errors-across-boundaries.md:3, :66: only declared failures cross a boundary; HTTP/RPC handlers translate public action errors to protocol shape; the signature is the contract. ApiKeyRequired.ts:6–13 and :31 of the kit README define the public contract as failureMode “return” shipped as CallToolResult isError: false. SanitizedSpan.ts:347 special-cases that. Snapshot registerToolkit maps isError: result.isFailure and drops structuredContent; parameter failures become InvalidParams (20-r1-mcp-kit.md:100–103, :157–158). RESEARCH.md:261 folds “failure classification” into the rebase and only then says “decide api_key_required and invalid-argument projections”. impact-matrix.md:34–35 tags both as “forced decision” but still lists them under the snapshot rebase, so an implementer matching upstream will flip every SourceAuth host’s wire contract before the decision exists. That is a 09 passthrough of an upstream protocol mapping through a foundation adapter.
- **Proposal:** Split protocol projection from the mechanical rebase. Record the CallToolResult vs InvalidParams and api_key_required isError mapping as align decisions with a <Concept>.error-translation home (kit protocol adapter, not host tools). Do not copy snapshot handleCause until those unions are declared. If isError: false is kept, it is kit-only value and must stay a named translator, not a comment.
- **Grill question:** Is api_key_required a public action failure that the MCP protocol handler must keep as a non-error envelope, or are you dropping that contract and translating it as isError: true like every other declared failure?

### D-M4 — major — Correlation on mcp.tool.call.* puts product run identity on foundation technical spans (12)

- **Evidence:** impact-matrix.md:73 tags “Correlation attribute on mcp.tool.call.* / ontology.mcp.origin” natural for both Sidecar and mcp-kit. RESEARCH.md:264 puts “correlation attribute on spans” in P4. 12-observability.md:32–52: domain-semantic attributes attach in use-cases; technical attributes attach in adapters; a driver MUST NOT attach domain-semantic attributes; keys are <slice>.<concept>.<field>. mcp.tool.call.* is a technical MCP namespace opened in SanitizedSpan.ts:324. 24-r5-http-security-observability.md:311: “Caller identity is in CurrentMcpCaller, not on the span.” Run/grant identity is epistemic product language (GovernedTierGate.gate.ts:188–197). Putting it on the kit span either leaks product attributes into foundation or invents a technical key that duplicates the gate. 12:221 also already flags Epistemic.GovernedTierGate.evaluate as a codepath name (24-r5:317); P4 touches that file and does not rename it.
- **Proposal:** Attach the run identifier on the gate span (after renaming it to an architectural name, e.g. epistemic.tier_gate.evaluate), not on mcp.tool.call.*. Keep kit spans technical (tool name, sanitized; no grant/run/session product keys). ontology.mcp.origin may carry a low-cardinality decision plus a chosen identifier only if that identifier is already the align-chosen principal.
- **Grill question:** If traces must join origin → auth → tool → ledger without mcp-session-id, which architectural span owns the run id — the kit dispatch wrapper, or the gate that already keys the chain?

### D-M5 — major — Origin allow-list tagged “natural (doctrine)” closes a grill question without the existing config home, and the 403 type violates 09

- **Evidence:** impact-matrix.md:68: “Origin allow-list literal → config declaration / natural (doctrine)”. RESEARCH.md:192–193 hedges “may require a config declaration”. 24-r5:292–295, :465 left this as grill Q8. 06-configuration-boundaries.md:91–103: constants are not a loophole; application-facing settings belong in slice config, not a free literal. The list is OntologyMcpTransport.ts:50–58. @beep/ontology-config already owns OntologyMcpServerConfig (packages/ontology/config/src/McpConfig.ts:66–76; server.ts:15–20) and does not mention origins. Tagging “config declaration” without that package invites a new home or another literal. Same file:60–63 OntologyMcpOriginForbidden extends Data.TaggedError, not S.TaggedError (09:29). jsonUnsafe of that class is the 403 body (OntologyMcpTransport.ts:80–86), not a declared protocol translation (09:66). P4’s “Origin middleware decision” (RESEARCH.md:264; impact-matrix.md:65–67) touches this boundary and does not mention either cleanup.
- **Proposal:** If Origin middleware or CORS is touched, add the allow-list to @beep/ontology-config/server (typed Config, not a new package), convert the 403 to S.TaggedError, and translate to the protocol shape with a correlation id. If the grill keeps the literal, say so as an explicit deferred exception, not “natural (doctrine)”.
- **Grill question:** When you touch OntologyMcpTransport, is the Origin list an OntologyMcpServerConfig field, an app-local constant with a written exception, or Effect allowedOrigins only — and does the 403 stay a Data.TaggedError dump?

### D-M6 — major — Research-stage PR train uses goals/_template phase ids, invents grill items 8–9, and is MAP.md content

- **Evidence:** Packet stage is research (explorations/effect-mcp-2026-07-28/ops/manifest.json:6–13) with align questions still open. explorations/README.md:73–78: stage 1 is landscape + inventory; stage 4 MAP.md is candidate goals and sequencing; :153–163 graduation requires BRIEF, empty openQuestions, and MAP. RESEARCH.md:255–269 is a six-PR train and a two-goal split with “P5 shared”. goals/_template/ops/manifest.json:47–71 and PLAN.md:11–15 already bind P0–P4 to Research / Implement / Verify / Yeet / Close. Draft P0 “snapshot pin” through P5 “closeout” will collide on graduate. RESEARCH.md:261, :262, :264 depend on “grill items 1, 2, 4”, “grill item 9”, “grill items 1, 8”; section 5 only numbers four evidence points and never defines items 8 or 9. A two-goal train with shared P5 has no closeout home in the one-PLAN-per-goal template (PLAN.md:36–48).
- **Proposal:** Strip the train from RESEARCH.md. Keep sizing as constraints, not a PR schedule. Put candidate goals in MAP.md after align, with slugs that do not reuse P0–P4. Enumerate grill questions in DECISIONS.md/openQuestions and depend on those ids. If two goals, each gets its own P0–P4; no shared P5.
- **Grill question:** What is grill item 9? If you cannot point to a numbered question in this packet, why is a proving-host PR blocked on it?

### D-M7 — major — Operator-contract row reimports G6-out-of-scope agent CLIs as a proving-host gate

- **Evidence:** G6 (DECISIONS.md:79–89): external agent clients do not gate the protocol flip; rejected “holding a host on its current protocol until each client catches up”. impact-matrix.md:50 tags “Operator contract for agent CLIs (MCP_PROTOCOL_NEGOTIATION=auto, Codex flag, grok unsupported)” **forced** for nlp-mcp under 2026-only. RESEARCH.md:261–262 makes that contract a P2 deliverable; :249 option 1 is “keep G4 and rewrite every in-repo client first with an operator contract for the agent CLIs”. That turns Claude/Codex/grok stdio defaults into acceptance criteria for the in-repo proving host, which G6 explicitly put out of scope. In-repo wire clients (harness, live-mcp-client, m365 test) are in scope; the three vendor CLIs are not.
- **Proposal:** Keep in-repo client rewrites (harness, live-mcp-client, m365 stdio, .mcp.json entry shape) as forced under G4. Demote vendor CLI env flags to optional operator notes, not a P2 gate. Do not let grok’s missing opt-in hold nlp-mcp.
- **Grill question:** If grok 1.0.34 cannot speak 2026 on stdio, does nlp-mcp stay 2026-only anyway, per G6, or is G6 withdrawn?

### D-M8 — major — P5 “mcp-kit promotion record” applies shared-kernel ritual to a foundation package

- **Evidence:** RESEARCH.md:265 and impact-matrix.md:81: “mcp-kit README protocol pin and promotion record”. 02-shared-kernel.md:95 and :188 define promotion records for shared/* exports. mcp-kit is foundation/capability; its gate is 07-non-slice-families.md:48–56 (≥2 named consumers in the package README). That list already exists (packages/foundation/capability/mcp-kit/README.md:9–26). A 02-style promotion record would mis-route the package into the shared kernel.
- **Proposal:** P5 docs work is README protocol pin plus the existing 07 consumer table (add sidecar/epistemic if the identity surface changes). Do not create a 02 promotion record unless the type is being promoted into shared/* — which this work must not do.

### D-N1 — minor — Section 5 “split G9” redefines G9 (host scope) as a protocol-posture split

- **Evidence:** RESEARCH.md:252: “split G9 (2026-only on HTTP, mixed on stdio)”. G9 (DECISIONS.md:113–120) answers which hosts are in scope (all in-repo servers). Protocol lists are G4 (DECISIONS.md:54–62). Relabeling a per-transport G4 exception as a G9 split will poison the align log.
- **Proposal:** Call it a G4 exception (HTTP-only 2026 vs stdio mixed), or a G4 reopen. Leave G9 as host membership.

### D-N2 — minor — P4 touches GovernedTierGate and leaves the codepath span name in place

- **Evidence:** 12-observability.md:221: “Span name leaks the codepath.” 24-r5-http-security-observability.md:317: Epistemic.GovernedTierGate.evaluate is already that anti-pattern (Effect.fn at GovernedTierGate.gate.ts:342). RESEARCH.md:264 / impact-matrix.md:69–73 change the run key and add correlation on that path without renaming the span.
- **Proposal:** If the gate file is opened for the new principal, rename the span to an architectural action (slice.concept.action) in the same change. Do not add a correlation attribute onto the old codepath name.

## Disposition

| # | Disposition |
| --- | --- |
| D-B1 | Fixed. Matrix B retags kit reads as transport facts; run key is D-run-key, owned in `epistemic/server`; SPEC decision 10 cited. |
| D-B2 | Fixed. Kit keeps caller facts only; `runIdOf`, freeze, chain, TTL stay in `epistemic/server`; no kit schema dependency for the sidecar. |
| D-M1 | Fixed. Architecture 03/09/12 removed from the docs rows; `standards/architecture/DECISIONS.md` route named if the invariant becomes architecture-wide. |
| D-M2 | Fixed. Decision 10 cited at `goals/agent-execution-authority/SPEC.md`; ontology-agent-surface kept for the live client only. |
| D-M3 | Fixed. D-projection split from the rebase; named translator at the kit protocol adapter. |
| D-M4 | Fixed. Correlation attribute moves to the gate span; kit spans stay technical. |
| D-M5 | Fixed. D-origin names `OntologyMcpServerConfig` as the config home and the 403 as a schema-declared error; no longer tagged natural. |
| D-M6 | Fixed. Train stripped from RESEARCH.md into `research/sizing.md` with S-ids; goals get their own phases in `MAP.md`; decisions named. |
| D-M7 | Grill (D-cli-contract). Recorded against PM-2; in-repo client rewrites stay forced. |
| D-M8 | Fixed. Promotion record removed; architecture 07 consumer table named. |
| D-N1 | Fixed. Per-transport split described as a G4 exception; G9 stays host membership. |
| D-N2 | Fixed. Gate span rename included in the sidecar stage. |
