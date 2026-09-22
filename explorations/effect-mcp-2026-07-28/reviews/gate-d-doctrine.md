# Gate D — Doctrine compliance review (2026-09-22)

Headless grok reviewer (`grok-4.6`, effort high, no web search) over `BRIEF.md`, `MAP.md`, `DECISIONS.md`, the two graduated goal packets, and the cited code. Note: the reviewer's checkout predated the #1177 merge, so citations into `RESEARCH.md` may reference pre-rc.117 wording.

**Verdict:** `not-ready`

Goal B’s run-key service cannot be executed as written without breaking the 2026-07-25 foundation-mediated inversion (ontology and epistemic both need the same run id and must not import each other, while the packet forbids run keys in mcp-kit). The client subpath, kit identity copy, gate span, and README consumer table also fight architecture 06/07/09/12. No new architecture DECISIONS.md row or shared-kernel promotion record is required; the existing inversion decision and package README coupling records are the missing touch points.

## Findings

### D-INV-RUNKEY — blocker — Run-key service as specified breaks foundation-mediated inversion

- **Evidence:** standards/architecture/DECISIONS.md:1107-1124 (active 2026-07-25): a foundation port “carries no product semantics”, “lives in foundation/*”, and “Both slices import only foundation, never each other”; the README of each coupled package records the producer/consumer pair. goals/ontology-sidecar-stateless-identity/SPEC.md:42-45 puts RunKey + Context.Service in packages/epistemic/server/.../GovernedTierGate.gate.ts, and SPEC.md:44-45 / GOAL.md:50 key OntologyChangeActor in packages/ontology/server to that same run id. packages/ontology/server/src/tools/OntologyToolHandlers.ts:80-91 currently mints the actor from mcp-kit CurrentMcpCaller only. explorations/effect-mcp-2026-07-28/BRIEF.md:95-97: “No identity fields, bearers, or run keys in mcp-kit schemas”. Lane 22-r3 already named the rule: “identity stays a kit-shaped value; ontology/epistemic still must not import each other.” Goal B Non-Goals (SPEC.md:22-23) forbids a new architecture DECISIONS.md entry.
- **Proposal:** Do not add a new architecture DECISIONS.md row. Follow 2026-07-25: put a product-neutral dispatch-anchor Context.Reference in @beep/mcp-kit (branded string, no bearer, no “launch”/sidecar vocabulary). apps/professional-desktop/server provides launch:<digest>; epistemic/server runIdOf and ontology/server OntologyChangeActor both read that kit value. Narrow the no-go to “no bearer and no launch/sidecar semantics in kit schemas”. Record the new producer/consumer pair and the desktop binding site on the mcp-kit, epistemic/server, and ontology/server READMEs (the inversion’s required coupling record, not a shared-kernel promotion).
- **Grill question:** Will both GovernedTierGate and OntologyChangeActor read one kit-shaped dispatch id provided at the desktop entrypoint, or is the actor allowed to diverge from the ledger run?

### D-CAP-CLIENT — major — Client tree + stdio helper is not a legal capability /client surface as written

- **Evidence:** explorations/effect-mcp-2026-07-28/MAP.md:22-23: NET-NEW under packages/foundation/capability/mcp-kit/src/client/** exported as @beep/mcp-kit/client, justified because “the ./* export exists” (DECISIONS.md D-client-home). packages/foundation/capability/mcp-kit/package.json:46-48 maps "./*" to "./src/*.ts", which resolves @beep/mcp-kit/client only to src/client.ts, not a directory tree. standards/ARCHITECTURE.md:400-405: wildcard ./* exports are compatibility leftovers; “explicit subpaths are the only canonical boundary contract” for new work. ARCHITECTURE.md:690 lists foundation/capability file roles as optional *.client.ts, not a /client export family. ARCHITECTURE.md:501-502: foundation roots must be runtime-neutral or browser-safe; environment-specific surfaces need an explicit environment entrypoint. BRIEF.md:67-68 forbids numbered-doc edits. Goal A also parks Effect’s conformance harness on that same /client (MAP.md:27-28; SPEC.md:47-49). architecture 07-non-slice-families.md:49-53 forbids tooling purpose in foundation/capability; 07:243-244 puts reusable test helpers in tooling/test-kit.
- **Proposal:** Ship the runtime client as src/client.ts (architecture 07 *.client.ts role) with an explicit package.json "./client" export. Keep HTTP header injection runtime-neutral on that module. Put the stdio NDJSON helper on an explicit Node entrypoint (e.g. src/client.node.ts / @beep/mcp-kit/client/node). Keep the conformance runner on a test-only surface (mcp-kit test alias or existing @beep/test-utils), not the production /client export. If a directory-shaped /client is still wanted, add one sentence to architecture 07 naming that explicit subpath and the Node entrypoint — the current “no numbered-doc edits” no-go cannot stand next to src/client/**.
- **Grill question:** Is @beep/mcp-kit/client a single runtime-neutral *.client.ts module, or a new canonical capability /client tree that architecture 07 must name?

### D-ID-KIT-SCHEMA — major — Session-as-run-key semantics still live in a foundation schema; Goal B leaves them unchanged

- **Evidence:** packages/foundation/capability/mcp-kit/src/McpCaller.ts:21-28 and :45-48 annotate sessionId as “the only stable per-session key available to a dispatch” / “the mcp-session-id header minted at initialize”. SanitizedSpan.ts:199-202 and :308-316 still read mcp-session-id for that purpose. architecture 07-non-slice-families.md:50: foundation/capability admits “no product semantics”. Goal A SPEC.md:35-39 lists SanitizedSpan, ApiKeyRequired, TierGate, ToolkitComposition, Version, and src/client/** — not McpCaller.ts. Goal B MAP.md:57-58 and GOAL.md:47: “McpCallerIdentity (unchanged: transport facts only)”.
- **Proposal:** Make McpCaller.ts a Goal A target. Rewrite the class JSDoc and sessionId annotateKey to transport facts only (optional protocol header; never a grant-run key). Goal B must not say “unchanged” until that copy is gone. Keep the Option<NonEmptyString> field if the dual-read still surfaces it as None on 2026.

### D-OBS-GATE-SPAN — major — Gate span rename is aimed at the wrong package and never names architecture 12 identifiers

- **Evidence:** Goal B SPEC.md:44-45 and MAP.md:62-64: rename “the gate span” in packages/ontology/server and keep correlation off kit mcp.tool.call.* spans. The load-bearing gate spans are Effect.fn names in packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:342 (“Epistemic.GovernedTierGate.evaluate”) and :469 (recordOutcome). Kit technical spans are SanitizedSpan.ts:324 (`mcp.tool.call.${tool.name}`). ontology/server has no withSpan on the gate; Ontology.Tools.authenticatedMcpActor / gatedMutation are separate Effect.fn names (OntologyToolHandlers.ts:80, :95). standards/architecture/12-observability.md:17-28: format `<slice>.<concept>.<action>`, snake_case, slice name matches package path (epistemic), adapter spans stay in a technical namespace. 12-observability.md:47-50: domain attributes are `<slice>.<concept>.<field>` on the architectural span.
- **Proposal:** Name the architectural spans `epistemic.governed_tier_gate.evaluate` and `epistemic.governed_tier_gate.record_outcome` in Goal B SPEC/PLAN, attach `epistemic.governed_tier_gate.run_id` (the digest, never the bearer) on those spans, and list GovernedTierGate.gate.ts — not ontology/server — as the span target. Leave kit `mcp.tool.call.*` technical. No architecture 12 doc edit is required if the SPEC pins those names.

### D-CAP-CONSUMERS — major — Architecture 07 consumer table is specified as six hosts, not every importer

- **Evidence:** architecture 07-non-slice-families.md:55-59: ≥2 named consumers, “The README must name each importer with a one-line note on what it uses the capability for; this list is checked at PR review.” Goal A SPEC.md:94: “mcp-kit README consumer table names the six consumers with their protocol state.” Current README.md:9-20 still lists uspto-mcp as “In progress” and omits landed importers. Live `@beep/mcp-kit` imports include packages/drivers/gov-legal-mcp/src/Server.ts, packages/law-practice/server/src/Tools.ts, packages/ontology/use-cases/src/tools/OntologyToolkit.ts, and packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.layer.ts:17.
- **Proposal:** Change the Goal A acceptance line to: refresh packages/foundation/capability/mcp-kit/README.md so every current importer is named (stdio hosts plus ontology/use-cases, epistemic/server, and the desktop binding site), with protocol state and the inversion coupling. Host count is not the 07 gate.

### D-ERR-ORIGIN-TAG — major — Origin 403 stays a Data.TaggedError on a surface Goal B rewrites

- **Evidence:** apps/professional-desktop/server/OntologyMcpTransport.ts:60-63 defines OntologyMcpOriginForbidden as Data.TaggedError. standards/architecture/09-errors-across-boundaries.md:29: “Every typed error class extends S.TaggedError from effect/Schema directly.” Goal B SPEC.md:64-65 / D-origin keep this middleware as the single typed-403 Origin check. grill-with-docs: cleanup-on-touch when current code disagrees with doctrine.
- **Proposal:** In the Origin rewrite, replace OntologyMcpOriginForbidden with an S.TaggedError (ontology-config or desktop-server $I), keep the 403 JSON body and ontology.mcp.origin metric/span, and add the one-line translator if the HTTP mapping is more than status: 403.

### D-CFG-ORIGIN-DEFAULT — minor — “Safe default” on OntologyMcpServerConfig can smuggle desktop host URLs into slice config

- **Evidence:** Goal B SPEC.md:46-47: OntologyMcpServerConfig “gains the Origin allow-list field with a safe default.” Current allow-list is the desktop-host literal in OntologyMcpTransport.ts:50-58 (professional-desktop.beep.localhost:1355, Vite 1421, tauri://localhost). standards/architecture/06-configuration-boundaries.md:93-98: config packages “are not broad settings packages”; constants stay “near the concept that gives them meaning.” D-origin correctly moves the field to @beep/ontology-config/server (already exported from packages/ontology/config/src/server.ts:15-20).
- **Proposal:** Define the field as ReadonlyArray<URL origin> with a deny-all default (empty list). Have the desktop ConfigProvider supply the five host origins. Do not encode professional-desktop URLs as OntologyMcpServerConfig schema defaults.

## Disposition

| # | Disposition |
| --- | --- |
| D-INV-RUNKEY | fixed: dispatch anchor Context.Reference in the kit; no new architecture DECISIONS row (amendment 1) |
| D-CAP-CLIENT | fixed: client.ts + ./client export, client.node.ts Node entry, test-only conformance runner (amendment 3) |
| D-ID-KIT-SCHEMA | fixed: McpCaller.ts is a Goal A target; Goal B no longer says "unchanged" |
| D-OBS-GATE-SPAN | fixed: spans named epistemic.governed_tier_gate.* in GovernedTierGate.gate.ts with run_id (amendment 4) |
| D-CAP-CONSUMERS | fixed: README names every importer (amendment 6) |
| D-ERR-ORIGIN-TAG | fixed: S.TaggedError cleanup-on-touch (amendment 5) |
| D-CFG-ORIGIN-DEFAULT | fixed: deny-all default; desktop ConfigProvider supplies origins (amendment 5) |
