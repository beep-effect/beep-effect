# Gate D — Feasibility and sequencing review (2026-09-22)

Headless grok reviewer (`grok-4.6`, effort high, no web search) over `BRIEF.md`, `MAP.md`, `DECISIONS.md`, the two graduated goal packets, and the cited code. Note: the reviewer's checkout predated the #1177 merge, so citations into `RESEARCH.md` may reference pre-rc.117 wording.

**Verdict:** `not-ready`

The two-goal PR train is not executable in the stated order. Goal A PR 1 drops every mcp-session-id read while the sidecar and its integration proofs still key GovernedTierGate on that header, and Goal B is not allowed to start until that same PR merges — a deadlock. Several other stated bricks are also wrong: @beep/mcp-kit/client cannot be a src/client/** tree under the existing ./* file export; Goal B's blockedBy waits on all of Goal A including the nlp-mcp hold; rc.117 does not type-export a 2026 ClientRpcs group with server/discover; and the conformance harness is not in the installed package.

## Findings

### seq-session-drop-before-run-key — blocker — A PR 1 drops mcp-session-id before B can replace the run key, and sidecar proofs still require it

- **Evidence:** Goal A PLAN.md:19-25 and GOAL.md:38-42 require PR 1 to “drop every Mcp-Session-Id read” with “Hosts untouched”. MAP.md:87 says Goal B starts “after A PR 1 merges”. The kit still builds identity from that header (SanitizedSpan.ts:202, :314-321) and only when McpServerClient is present; runIdOf is still `session:${sessionId}` else `client:${clientId}` (GovernedTierGate.gate.ts:188-197). The live sidecar pin is still v2025_06_18 (OntologyMcpTransport.ts:180). The HTTP integration proof is explicit that a clientId-keyed gate would fail: ontology-mcp-http.test.ts:279-293 (“the HTTP protocol mints a fresh clientId per request”) with the harness echoing mcp-session-id (ontology-mcp-harness.ts:154-178). Goal A’s scope (GOAL.md:31-33) forbids touching the sidecar, so A PR 1 cannot rewrite those tests, and B cannot start until the PR that would break them has merged.
- **Proposal:** Keep the 2025 header read in A PR 1 (dual-read McpRequestContext, do not delete mcp-session-id). Move “no mcp-session-id read remains in mcp-kit/src” into Goal B’s acceptance and land it in the same merge as the launch-digest run key and the sidecar pin. If the drop must stay in A PR 1, stack B’s identity PR on A PR 1 and merge them together so main never runs a session-keyed gate without the header.
- **Grill question:** Will A PR 1 keep the mcp-session-id read until B’s launch-key is live, or will the drop and the run-key ship in one merge?

### export-client-subpath — major — Stated @beep/mcp-kit/client directory does not match the existing ./* file export

- **Evidence:** D-client-home (DECISIONS.md:191-192) and MAP.md:22-23 put a “module set under packages/foundation/capability/mcp-kit/src/client/** exported as @beep/mcp-kit/client (the ./* export exists)”. mcp-kit package.json:46-48 is `".": "./src/index.ts"` and `"./*": "./src/*.ts"`. Node resolves @beep/mcp-kit/client to src/client.ts, the same pattern as the working @beep/mcp-kit/SanitizedSpan import (OntologyMcpTransport.ts:18). A src/client/index.ts tree is not that mapping. Goal B’s precondition and harness cutover (GOAL.md:26-27, SPEC.md:48-50) both import that subpath.
- **Proposal:** In A PR 1 either add `"./client": "./src/client/index.ts"` (and `"./client/*"` if the tree stays) to mcp-kit exports, or put a barrel at src/client.ts so the existing ./* map works. Update MAP/D-client-home to the chosen layout.

### blockedby-whole-goal-a — major — Goal B blockedBy waits on all of Goal A, including the nlp-mcp hold, against the stated overlap

- **Evidence:** MAP.md:87: “Goal B PR 1 (after A PR 1 merges; can overlap A PR 2–4)”. Goal B GOAL.md:26-27 and SPEC.md:67 say the precondition is A PR 1. The machine edge is ops/manifest.json:13-16 `blockedBy: ["goals/mcp-stateless-kit-and-drivers"]` with statusNote that PR 1 is enough. GoalManifest.blockedBy is a packet-slug array (Goals.schemas.ts:459) with no PR grain. nlp-mcp is an entrance-gated last host (DECISIONS.md:147-157, MAP.md:103-106) that can stay on 2025 while Goal A still closes; B does not need that flip. An orchestrator honoring blockedBy will hold the sidecar until A PR 4’s vendor capture.
- **Proposal:** Drop packet-level blockedBy on Goal B (keep statusNote). Set Goal B lifecycle to paused until A PR 1 merges, then unpause so B can overlap A PR 2–4. Record the kit-ready checkpoint in Goal A’s README rather than blocking on the nlp-mcp re-entry gate.

### rc117-no-typed-2026-clientrpcs — major — rc.117 does not expose a typed 2026 ClientRpcs group with server/discover

- **Evidence:** Goal A SPEC.md:43-46 and D-client-home (DECISIONS.md:191-195) require “the 2026 ClientRpcs group with server/discover”. Public McpSchema.ClientRequestRpcs is Ping/Initialize/Complete/SetLevel/GetPrompt/ListPrompts/ListResources/ListResourceTemplates/ReadResource/Subscribe/Unsubscribe/CallTool/ListTools (McpSchema.js:2371); ClientRpcs merges that with notifications (McpSchema.js:2386). server/discover exists only on the @internal 2026 schema (internal/mcpSchema/v2026_07_28.js:317-322, :527). That file is runtime-resolvable, but its published .d.ts is `export * from "./v2025_11_25.ts"` (v2026_07_28.d.ts:1), so TypeScript still has no Discover. First vertical slice (MAP.md:95-98) cannot drive server/discover through the public group.
- **Proposal:** In A PR 1 re-declare a kit-owned 2026 RpcGroup from the internal JS (Discover, CallTool, ListTools, GetPrompt, …). Do not import public McpSchema.ClientRpcs and do not type-import effect/unstable/ai/internal/mcpSchema/v2026_07_28. Spell that in SPEC target surfaces.

### conformance-harness-not-installed — major — Conformance port cites Effect test sources that this checkout does not have

- **Evidence:** MAP.md:27-28 names the brick as `effect:packages/effect/test/unstable/ai/McpServer/**`. Lane 11-u2 (research/11-u2-stateless-runtime.md:810-817) lists v2026_07_28.test.ts, McpConformance/*Test.ts, and TestUtils harnesses. node_modules/effect has no test/ tree (package.json files: src, dist, AGENTS, ai-docs). .repos/effect is unprovisioned here. D-conformance (DECISIONS.md:208-209) and Goal A acceptance (SPEC.md:85-86, :73) require every flipped host to pass that port, including A PR 1’s test host.
- **Proposal:** Make `bash scripts/setup-effect-ref.sh` a written PR 1 precondition, and copy the 11-u2 §10 file list into Goal A PLAN as the port inventory. Until the clone is linked, do not treat node_modules/effect as the conformance source.

### http-meta-keys-unspecified — major — 2026 HTTP client injector as specified omits required _meta keys and will 400

- **Evidence:** Goal A SPEC.md:44-46 names headers MCP-Protocol-Version, Mcp-Method, Mcp-Name and “_meta” with params.name / params.uri (those name keys match mcpRuntime.js:35-44). On the stateless HTTP path rc.117 also requires params._meta.io.modelcontextprotocol/protocolVersion matching the header (mcpRuntime.js:96-108, else 400 “Required request metadata is missing”) and params._meta.io.modelcontextprotocol/clientCapabilities as an object (mcpRuntime.js:109-116). Goal B’s sidecar is HTTP (OntologyMcpTransport.ts:176-180); a header-only kit client cannot prove the harness cutover.
- **Proposal:** Specify the two _meta keys (and header/metadata equality) in Goal A SPEC client requirements and in the first vertical slice. Include a kit test that a POST missing either key is 400 before claiming HTTP SSE unwrap works.

### phantom-research-and-sizing — major — SPEC/PLAN cite RESEARCH.md numbered sections and research/sizing.md, which are not there

- **Evidence:** Goal A SPEC.md:29-31 ranks “RESEARCH.md §2 (adapter semantics), §3.1–3.2 (kit, hosts)” above the installed Effect source. Goal B SPEC.md:30 ranks “RESEARCH.md §3.3–3.4”. Goal A PLAN.md:11 lists RESEARCH.md as the P0 exit. explorations/effect-mcp-2026-07-28/RESEARCH.md:9-22 is still the three template headings with placeholder prose. BRIEF.md:23-24 and MAP.md:4 cite research/sizing.md for the 24–34 day appetite and stage ids S1–S5a; that file is absent. DECISIONS.md has no 2026-09-21 entry even though Goal A SPEC.md:29 lists “G1–G9, 2026-09-21, 2026-09-22 rulings”.
- **Proposal:** Either write RESEARCH.md §2–§6 as a synthesis of the lane reports (and add research/sizing.md plus a 2026-09-21 DECISIONS note that S0/S5b retired because rc.117 is on main), or retarget both SPECs’ source hierarchy at the existing lane files (10-u1, 11-u2, 20-r1, 21-r2, 22-r3, 24-r5) and stop citing missing paths.

### goal-b-proof-omits-desktop — major — Goal B launcher verification never runs the sidecar package that the goal pins

- **Evidence:** Goal B’s in-scope surfaces are apps/professional-desktop/server/{OntologyMcpTransport,RpcSessionAuth}.ts, the integration harness, ontology/server, and ontology/config (GOAL.md:31-36, SPEC.md:37-50). PLAN.md:39-40 says “Hosted Heavy / Test Integration is the exit proof for the sidecar wire; local tier-1 green is not sufficient”. The GOAL.md:70-76 and PLAN.md:44-50 command lists are only package-verify @beep/epistemic-server and @beep/ontology-config. The chain-intact proof that B must rewrite lives in apps/professional-desktop/test/integration/ontology-mcp-http.test.ts:284-293.
- **Proposal:** Add professional-desktop integration (the SPEC.md:91-92 `beep ci lane test-integration` command, or the package’s test:integration script) to Goal B GOAL.md verification and PLAN commands, and name ontology-mcp-http.test.ts as the launch-key successor of the session-key chain assertion.

## Disposition

| # | Disposition |
| --- | --- |
| seq-session-drop-before-run-key | fixed: A PR 1 keeps the 2025 read; deletion moved to Goal B (amendment 2) |
| export-client-subpath | fixed: client.ts barrel + explicit ./client export (amendment 3) |
| blockedby-whole-goal-a | fixed: blockedBy dropped; statusNote keeps the PR 1 checkpoint |
| rc117-no-typed-2026-clientrpcs | fixed: kit-owned 2026 RpcGroup re-declared (amendment 3) |
| conformance-harness-not-installed | fixed: setup-effect-ref.sh precondition; 11-u2 §10 inventory in PLAN |
| http-meta-keys-unspecified | fixed: both _meta keys named in SPEC, first slice, and a 400 test |
| phantom-research-and-sizing | stale checkout: the reviewer ran before #1177; RESEARCH §2–§6, sizing.md and the 2026-09-21 entry are on main |
| goal-b-proof-omits-desktop | fixed: test-integration lane in Goal B GOAL/PLAN; ontology-mcp-http.test.ts cases named |
