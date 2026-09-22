# Effect MCP 2026-07-28 Stateless Protocol Adoption — Decisions

<!--
Stage 2 (align) log. One entry per resolved branch-closing question, newest
last. Unresolved questions live in ops/manifest.json `openQuestions` until they
land here. Deferred questions get an entry too, marked DEFERRED with the reason.

G1–G9 were settled on 2026-09-16 in the grounding grill that preceded the
research plan (plan-mode session, AskUserQuestion rounds, recommendation first).
They scope the research; the post-research /grill-with-docs session appends the
design decisions below them.
-->

## 2026-09-16 — G1 release vehicle

**Question:** #7265 merged after `effect@4.0.0-rc.115` was cut and rc.116 (#8201) is unpublished.
Wait for rc.116, pin a pkg.pr.new snapshot, or research only?

**Answer:** Pin a pkg.pr.new snapshot of upstream main, following the #1060 (`c8349ed`) precedent,
and swap to the published RC once one carries the adapter.

**Rationale:** Starting implementation does not have to wait on an unscheduled release. The repo
has already run a snapshot campaign end to end.

**Rejected:** research now and gate implementation on rc.116 (recommended at the time: one bump,
no re-pin); research only with no goal until rc.116 ships.

## 2026-09-16 — G2 ambition

**Question:** Migration only, full adoption, or kit plus one proving host?

**Answer:** Full adoption, staged: absorb the snapshot's breaking changes, move hosts to
2026-07-28, and wire new capabilities where the protocol makes them natural. Order is mcp-kit
first, then a proving host, then the remaining hosts.

**Rationale:** The kit is shared by every host, so a kit-first order proves the design once.

**Rejected:** migration only (stay on 2025-06-18, defer features); kit plus one proving host with
the other hosts as later goals.

## 2026-09-16 — G3 packet vehicle

**Question:** Exploration packet that graduates, or a goal packet directly?

**Answer:** This exploration packet, driven through `/explore` (capture, research, align via
`/grill-with-docs`, shape, decompose, graduate), producing one goal or a short goal train sized by
the evidence.

**Rationale:** The work is research-heavy and the design has open branches; the exploration
pipeline carries the provenance and the graduation checks.

**Rejected:** scaffolding `goals/<slug>/` directly (faster, skips the definition-of-ready gate).

## 2026-09-16 — G4 protocol posture

**Question:** Which protocol adapters should each host negotiate: 2026-07-28 plus legacy
fallbacks, a per-host matrix, or 2026-07-28 only?

**Answer:** `McpProtocol.v2026_07_28` only. No mixed protocol lists.

**Rationale:** The goal is a clean stateless protocol, not a compatibility layer; carrying the
session-era runtime alongside it keeps the complexity the upgrade is meant to remove.

**Rejected:** `[v2026_07_28, v2025_11_25, v2025_06_18]` negotiation (recommended at the time);
a research-driven per-host protocol matrix.

## 2026-09-16 — G5 motivation

**Question:** Which new capabilities (MRTR `InputRequired`, `subscriptions/listen`, JSON
`structuredContent`, `server/discover` with `instructions` and prompt titles) have product pull?

**Answer:** None specifically. The driver is "an actually good protocol"; capabilities get wired
where the protocol makes them the natural shape, not because a product feature demands them.

**Rationale:** Operator statement. Research and the align grill decide per capability whether it
is forced, natural, or optional for each host.

## 2026-09-16 — G6 client compatibility scope

**Question:** What happens when a client in use cannot speak 2026-07-28 (for example cursor-agent)?

**Answer:** Out of scope. The work targets the in-repo MCP servers; external agent clients do not
gate the protocol flip.

**Rationale:** Operator statement: "This is for the in package mcp servers we have mostly in
./packages/drivers. cursor-agent is irrelevant here".

**Rejected:** holding a host on its current protocol until each client catches up; a flagged
temporary legacy fallback.

## 2026-09-16 — G7 snapshot PR shape

**Question:** How should the snapshot bump land, given 29 non-MCP changesets on upstream main?

**Answer:** Its own first PR, pinned to the newest upstream main snapshot at implementation start,
absorbing every repo-wide breaking change (as #1060 did) while hosts stay compiling. Stateless MCP
work follows in later PRs; the swap to rc.116 happens when it publishes.

**Rationale:** Keeps repo-wide migration noise out of the MCP design review.

**Rejected:** pinning at `769f6046a2` (#8242) to avoid the later commits; folding the pin into the
first MCP PR.

## 2026-09-16 — G8 upstream documentation

**Question:** `effect:packages/effect/MCP.md` does not cover 2026-07-28. Contribute docs upstream?

**Answer:** Research records the doc gaps with evidence; the goal carries an optional, non-blocking
lane for a docs PR from the `beep-effect/effect` fork, using examples proven on in-repo hosts.

**Rejected:** a required upstream docs deliverable in acceptance; no upstream work.

## 2026-09-16 — G9 host scope

**Question:** Beyond the four drivers, are the practice-kg server and the desktop ontology HTTP
sidecar (with `GovernedTierGate`) in scope?

**Answer:** Yes: all in-repo servers. `packages/drivers/{nlp,m365,uspto,gov-legal}-mcp`,
`packages/law-practice/server` with `apps/practice-kg-mcp`,
`apps/professional-desktop/server/OntologyMcpTransport.ts`, and `@beep/mcp-kit`.

**Rationale:** mcp-kit is shared; leaving any host on the session protocol keeps the
`McpServerClient` path alive inside the kit. The `GovernedTierGate` identity redesign becomes the
central research and grill topic.

**Rejected:** drivers plus practice-kg only (sidecar deferred); drivers only.

## 2026-09-21 — G1 and G7 revisited: the RC shipped first

**Question:** `effect@4.0.0-rc.116` (2026-09-18) and `rc.117` (2026-09-21) were published after
the research froze on `a7a71921de`, and #1173 moved the repo catalog to rc.117 on 2026-09-21. Does
the snapshot-pin plan survive?

**Answer:** No. G1 (pin a pkg.pr.new snapshot) and G7 (the snapshot bump as its own first PR) are
closed by events: rc.117 carries `McpProtocol.v2026_07_28` and `McpRequestContext`, is installed
on `main`, and every host still compiles on `v2025_06_18`. #1173 is the S0 PR that
`research/sizing.md` sized: it re-keyed the platform-node-shared patch and added the SSE-unwrap
to the sidecar harness. D-pin-sha is withdrawn from the align agenda; S0 and S5b are struck from
the draft train; S1 depends on "rc.117 on `main`" instead of S0.

**Rationale:** `a7a71921de` is an ancestor of the rc.117 tag, so the verified research still
describes the installed adapter. The one MCP-surface commit between them (Effect-TS/effect#8326,
identified output schemas normalised to object roots across revisions) is recorded in
`RESEARCH.md` and not re-researched; it touches the kit's `withTopLevelObjectInputSchema` question
only, which S1 re-checks against the installed source.

**Rejected:** re-running the blast-radius census on rc.117 (the census was for a pkg.pr.new
tarball that will never be pinned; #1173's hosted proof is the census now); keeping S5b as a
"verify the RC" stage (nothing to swap).

## 2026-09-22 — D-posture: keep G4, per-host cutover, no mixed interim

**Question:** A 2026-only list rejects `initialize` from every current wire client; a mixed list
accepts everyone but mints a 2025 session even for a client that offers 2026-07-28 (compatibility,
not adoption) and keeps both identity machines alive in mcp-kit. Keep G4, relax, stage, or exempt
per transport?

**Answer:** Keep G4. Every host ends on `[McpProtocol.v2026_07_28]`; hosts flip one at a time
(stdio drivers first, nlp-mcp last behind D-cli-contract, sidecar last of all with D-run-key).
There is no mixed interim: the proof vehicle is the in-repo 2026 client (D-client-home), not
vendor CLIs.

**Rationale:** G5 ("an actually good protocol") is only honoured if a host actually runs
stateless; a mixed list never does. Sizing 24–34 agent-days accepted.

**Rejected:** per-transport exception (stdio hosts would stay on the session protocol in
practice); mixed everywhere (reverses G4, nothing proven); mixed now then cut over (two
campaigns, no host ever proves 2026 until the second).

## 2026-09-22 — D-cli-contract: live capture is an entrance criterion for nlp-mcp

**Question:** Claude Code, Codex and grok binaries contain the 2026-07-28 string, but lane 14-s2
found all three default stdio to `initialize` (Claude Code stdio probes only under
`MCP_PROTOCOL_NEGOTIATION=auto`, Codex behind a feature flag, grok stdio has no modern path).
Is a live first-message capture an entrance criterion before the `.mcp.json` host flips?

**Answer:** Yes. Before nlp-mcp goes 2026-only, capture the first stdio message from Claude Code
(and Codex if cheap) against a 2026-only build. If no CLI the user runs daily speaks 2026 on
stdio, nlp-mcp stays last in the order and its flip is held as a re-entry gate in `MAP.md`; the
other stdio hosts and the in-repo client carry the proof meanwhile.

**Rationale:** the pre-mortem's "a proving host nobody's CLI can speak is a failed proof" applies
to the one host the user depends on every day; G6 still holds for every other host.

**Rejected:** operator notes only (loses the daily nlp server silently); flip nlp-mcp last with no
capture (no evidence when it breaks).

## 2026-09-22 — D-run-key: the run is a sidecar launch, keyed by the verified bearer's digest

**Question:** Without `Mcp-Session-Id` and with HTTP `clientId` per-POST, what mints the
`GovernedTierGate` run key (grant freeze, hash chains, TTL)?

**Answer:** A server-side digest of the per-launch bearer that `requireRpcSessionToken` already
verifies on every request (`launch:<digest>`), composed in `apps/professional-desktop/server`
and consumed by `epistemic/server` through a run-key service; `McpCallerIdentity` in mcp-kit
carries transport facts only and never a bearer. Decision 10 in
`goals/agent-execution-authority/SPEC.md` becomes "a run is a sidecar launch". The test "keys
the run on the session, not the per-request client id" is deleted and replaced by "keys the run
on the launch".

**Rationale:** the client cannot rotate the key (no TTL-reset defect), no new wire field, the raw
token never reaches a ledger. Coarser than a conversation, matching today's process-scoped
`GovernedEgress`.

**Rejected:** explicit open-run tool (client-echoed token, agent-dependent); signed `requestState`
(spec-native but no client echoes it yet; revisit once the kit client exists); MRTR per-call
approval (deletes the grant-freeze semantics PR 5 built).

## 2026-09-22 — D-client-home: `@beep/mcp-kit/client`

**Question:** Effect's 2026 client group is `@internal`; the in-repo clients (sidecar harness,
`live-mcp-client.ts`, m365 stdio test) are scattered. Where does the 2026 client live?

**Answer:** A client role module under the existing `foundation/capability/mcp-kit` package,
exported as `@beep/mcp-kit/client` (the `./*` export exists): the 2026 `ClientRpcs` group with
`server/discover`, the `MCP-Protocol-Version`/`Mcp-Method`/`Mcp-Name` and `_meta` injector, a
stdio NDJSON helper that sends `discover`, the SSE unwrap ported from the #1173 harness, and the
conformance harness port.

**Rationale:** domain-agnostic protocol substrate next to the server adapter; no new package,
one import for harnesses, live proof and driver tests.

**Rejected:** a new `mcp-client-kit` package (package gates for one consumer set); test-side only
(the live proof and the D-cli-contract capture would run on duplicated code).

## 2026-09-22 — D-conformance: conformance per host, stdio error-shape gap filed upstream

**Question:** Must a 2026-only host pass a 2026-07-28 conformance run, and who owns the stdio
`-32022`-without-`data.supported` mismatch?

**Answer:** Every flipped host passes an in-repo port of Effect's conformance harness for
2026-07-28 through `@beep/mcp-kit/client`. The stdio error-shape gap is filed as the G8 upstream
lane (fork PR), not waived in-repo. nlp-mcp additionally needs the D-cli-contract capture.

**Rationale:** one proof standard for six hosts; the gap is Effect's to fix.

**Rejected:** sidecar-only conformance; in-repo smoke only.

## 2026-09-22 — D-projection: keep `api_key_required`, invalid arguments become `InvalidParams`

**Question:** Under strict 2026 tools, upstream rejects invalid input as JSON-RPC `InvalidParams`
and projects declared failures as `isError`; the kit returns two canned non-error results today.

**Answer:** `api_key_required` stays a named non-error `CallToolResult` envelope (agent-actionable
kit value), declared as error translation at the kit protocol adapter (architecture 09).
Invalid arguments stop being canned and surface as upstream `InvalidParams`.

**Rationale:** one named translator, less fork drift, protocol-native validation.

**Rejected:** everything native (agents lose the "go get a key" hint); keep both canned
(fights strict decode, more drift).

## 2026-09-22 — D-origin: config-owned allow-list, one Origin check, spec fixes

**Question:** Home of the Origin allow-list, keep or drop the sidecar's own Origin middleware,
`OPTIONS` and Origin-less POST behaviour, browser clients.

**Answer:** The allow-list becomes an `OntologyMcpServerConfig` field (`@beep/ontology-config`);
the sidecar middleware stays as the single Origin check (typed 403 + `ontology.mcp.origin`
metric) and feeds Effect's `allowedOrigins` from the same value; attacker-Origin `OPTIONS`
answers 403; Origin-less POST stays denied (in-repo clients always send Origin); no
browser-origin `/mcp` client is in scope, so CORS gains `mcp-method`/`mcp-name` only for the
in-repo client and drops `mcp-session-id`.

**Rationale:** architecture 06 (config, not literals); the metric and typed error are product
value Effect's check lacks.

**Rejected:** Effect `allowedOrigins` only (loses metric and typed 403); app-local literal with
a written exception.

## 2026-09-22 — Goal split: two goals, one train

**Question:** One, two or three goal packets for S1–S5a?

**Answer:** Two. Goal A `mcp-stateless-kit-and-drivers` = S1 kit rebase + `@beep/mcp-kit/client`
+ conformance port, S2/S3 host cutover (m365, uspto, gov-legal, practice-kg, then nlp-mcp behind
the capture), kit README. Goal B `ontology-sidecar-stateless-identity` = S4 run key, sidecar pin,
Origin/CORS, agent-execution-authority SPEC wording. B depends on A's kit; both have their own
PR train and closeout reflection.

**Rejected:** one goal (two owners, cannot close until the sidecar lands); three goals (packet
overhead without a review benefit).

## 2026-09-22 — Gate D amendments (three grok reviewers, `reviews/gate-d-*.md`)

**Question:** Which Gate D findings change a ruling rather than a packet sentence?

**Answer:** Six amendments, none reopening a decision's intent:
1. D-run-key carrier: the run key crosses packages through a product-neutral dispatch anchor in
   `@beep/mcp-kit` (a branded string `Context.Reference`, no bearer, no launch or sidecar
   vocabulary), following the 2026-07-25 foundation-mediated inversion; the desktop provides
   `launch:<digest>`, `epistemic/server` and `ontology/server` both read the anchor and never
   import each other. "Never a kit schema field" now reads "never identity semantics in the kit".
2. Sequencing: Goal A PR 1 keeps the 2025 `mcp-session-id` read (dual-read) so `main` never runs
   a session-keyed gate with no key; the read is deleted in Goal B's identity PR.
3. D-client-home layout: `@beep/mcp-kit/client` is a `client.ts` barrel with an explicit
   `./client` export (the `./*` map resolves single files, not a directory); the stdio NDJSON
   helper is a Node entry (`client.node.ts`); the conformance runner is a test-only surface.
   The kit re-declares its own 2026 RpcGroup (rc.117 exposes no public typed
   `server/discover` group; the internal one is not imported).
4. Spans: the architectural spans are the gate's own (`epistemic.governed_tier_gate.evaluate`,
   `epistemic.governed_tier_gate.record_outcome`) in `GovernedTierGate.gate.ts`, carrying
   `epistemic.governed_tier_gate.run_id` (the digest); kit `mcp.tool.call.*` spans stay technical.
5. D-origin: the allow-list field defaults to deny-all (empty); the desktop ConfigProvider
   supplies its host origins; `OntologyMcpOriginForbidden` becomes an `S.TaggedError`
   (cleanup-on-touch, architecture 09).
6. Consumer table: the mcp-kit README names every importer (eleven packages today), not six hosts.

**Rationale:** each is a doctrine or mechanics correction with `file:line` evidence; none
changes the posture, run-key source, client home, proof standard, projection, or origin policy.

**Rejected:** a new architecture-wide `DECISIONS.md` row for the run-key anchor (the 2026-07-25
inversion already covers it); Goal B `blockedBy` on all of Goal A (the machine edge has no PR
grain; B keeps a status note and starts after A PR 1).
