# REPORT — 2026-09-03

Window 2026-08-31 08:52 → 2026-09-03 08:49 America/Chicago (71h57m). Status: **partial** (X search `client-not-enrolled` on every axis, x=0; no Sol/Luna). 15 claims. Collision rate 0.267 against prior digests (four URL collisions: ODP, Effect #7446, Effect #7265, drizzle #6162; novel-URL collision 0). selfReject false. Refutation quota: 4 standing claims challenged (all HOLD; #7265 HOLD+MOVED, not broken). Thursday: no weekly consolidation, no tombstone reaper. Leave 2026-08-30 tombstones as-is.

The 2026-08-31 packet (#942) merged 2026-09-02T18:19:29-05:00. No open research PR at preflight. Closed-unmerged #862 claims stay at `research/ledger/excluded-packets/2026-08-27.jsonl`. SPEC amendment 2026-09-03: P0 only; nightly CLI and timers remain planned.

## Delta

### New

- **CoCounsel grew two governed-record bridges; neither is MCP GA.** Sept 1 iManage/TR expands CoCounsel links and HighQ/Noetica/Contract Express/Legal Tracker access to iManage-managed documents and matter records. Existing APIs are available; MCP support is only due to follow and is described as preserving access controls, ethical walls, and privilege. Same day, Everlaw announced a CoCounsel bridge that would join matter evidence with Westlaw/Practical Law. The Everlaw copy is future-facing (“will be able”), not GA. Do not call either MCP or the Everlaw bridge shipped. Many Worlds filed Aug 31 in ED Texas alleging OpenAI infringes five patents (8,676,742; 8,843,433; 10,699,202; 12,307,388; 12,299,603) on contextual/personalized retrieval, vector search, recommendation, and probabilistic generation; seeks damages/injunction and anticipates Section 101. Filing is the fact; infringement is the allegation.
- **Effect pin did not move; Jazz rehearsal is not a release.** Published latest remains `effect@4.0.0-rc.112` (Aug 25). #7446 still OPEN (updated 2026-09-03T13:17:05Z) staging unpublished rc.113. #7265 still OPEN (updated 2026-09-02T16:32:07Z): v2026_07_28 adapter / InputRequired / Schema structured outputs pending release. drizzle #6162 still OPEN, no update since Aug 25. Jazz #2467 (integration CI rehearsal) opened and closed unmerged Aug 31 and must not merge independently; alpha.54 RC #2361 remains OPEN.
- **Skills got a policy-integrity attack, a repo-distillation library, and an invocation-time lease paper.** SkillShift (arXiv 2609.02564) formalizes Skill Policy Integrity and reports covert utility-preserving steering at 81.33%/63.33% with 100% utility preservation, transfer, and scanner misses — distinct post-tombstone evidence; add watch. DisCo Repo-To-Skill (2609.02749) reports 5,000+ verified skills from 1,000 ML repos / 20 areas / 178 families and author-reported fixed-harness gains (+134.3% MLE-bench, +34.4% PaperBench, +9.2% FrontierCS, +14.0% PassNet). ACLE-MCP (2609.02690) binds workload freshness/operation/object/params/downstream/receipts in a short-lived sender-constrained lease; author-reported prototype blocked all evaluated attacks at pooled p95 12.20→15.34ms (+25.7%) vs OAuth-only. EFFECTBOUND (2609.02866) decides policy-relative effect closure (strategy / certificate / no-verdict) and finds a GitHub merge tool may merge a different commit than reviewed — head-SHA binding and receipts. SafeEvolve (2609.02786) reports bounded reversible harness prompt/skill updates plus SFT/RL (3× AgentDojo ASR cut; benign utility 59.79→61.86% on Qwen3.5-4B). CodePoisonRAG (2609.02774): one task-matched poison; 85 artifacts / 10 CWEs at 0.7% corpus ratio all Top-3; ASR 0.80–0.93, 0.40–0.71 against CodeGuarder. kitter (what1f/kitter, created 2026-09-02T15:44:45Z) is a local-first skill manager; 93 stars at preflight; metadata volatile, no quality inference.

### Moved

- **w-effect-mcp-adapter.** #7265 still OPEN and still unpublished. Updated in-window, so the standing “adapter pending release” claim HOLDS and MOVES. Not a break. Do not pin beep kits on it.
- **w-jazz-wire-v1.** #2467 CI rehearsal closed unmerged (must not merge independently). alpha.54 RC #2361 still OPEN. Identity (#2347) already landed last packet; release is not complete.
- **w-legal-dms-mcp / w-imanage-mcp-write.** Sept 1 iManage/TR + Everlaw-CoCounsel are API/future integrations, not MCP GA. Standing iManage MCP write-back Oct 2026 watch is a different surface; do not collapse them.
- **w-schema-binary / w-effect-rc113.** Still no published rc.113. #7446 updated 2026-09-03T13:17:05Z and still stages it.

### Contradicted

None of the standing claims broke.

### Settled (refutation quota)

- **USPTO ODP four-field gate — HOLDS.** Live `data.uspto.gov/support` on Sep 3 still requires Job Title, Organization Name, Organization Type, Intended Use to retain ODP products/API key. No rollback. includeDocuments HTTP 500 remains unverified (no authenticated probe).
- **effect@4.0.0-rc.112 / no rc.113 — HOLDS.** Published latest is still rc.112 (2026-08-25). #7446 OPEN, updated 2026-09-03T13:17:05Z, stages unpublished rc.113.
- **Effect #7265 MCP 2026-07-28 adapter — HOLDS, moved.** Still OPEN. Updated 2026-09-02T16:32:07Z. Adapter / InputRequired / Schema structured outputs pending release.
- **drizzle TaggedErrorClass — HOLDS.** #6162 still OPEN. No update since 2026-08-25.

Cheap-check MOVE (not quota): Jazz #2467 closed unmerged; #2361 still OPEN. SEP-2640 checked OPEN unchanged (note only; no 16th claim).

## Intersections with today's repo-replay

Merged since the 2026-08-31 packet cut: #942 (prior nightly); Semantica C2 #938 #939 #944 #945; beep-ci-ops / explorations #940 #957 #963 #969 #972 (SPEC amendment: P0 only); repo-cli / ship-velocity / time-to-certainty #941 #950 #953 #954 #956 #961 #962 #964 #965 #966 #968 #970; box #947 #959; quality/tsgo/deps #943 #948 #952 #958; skills 1Password shim #951; agent cleanup #955; practice-box closeout #960. Open non-research at publish: #978 #975. Do not babysit them.

Many Worlds retrieval/personalization patents sit next to citation-verified-span and any vector-store retrieval story: the filing names vector stores and file search. iManage/Everlaw CoCounsel bridges sit next to `gov-legal-mcp` / legal-DMS watches — APIs now, MCP later, Everlaw not GA. SkillShift next to skill-contract-kernel / TrustShift / skillscan: scanners that miss utility-preserving steering are the new gap. ACLE-MCP + EFFECTBOUND next to yeet merge / head-SHA binding and MCP kit receipts. Repo-To-Skill + kitter next to skill libraries; kitter is a pointer, not a quality claim. #7265 + #7446 remain the pin watch for effect-v4 kits.

## Frictions

- Native X post/news search attempted across all axes; all returned `client-not-enrolled`. x=0. Same resume: enroll App in a Project at console.x.com, then re-search this window.
- Sol/Luna blinded verify unavailable. Packet stays `partial`. Resume: retry verify on the same 15 records.
- GitHub / arXiv / web worked. Writer composed from structured sanitized records only.

## Appendix — topical notes

Law: two CoCounsel integrations in one day, both governed-record stories, both not MCP GA. Many Worlds is a live ED Texas complaint against retrieval/personalization/generation — watch Section 101, do not treat the patents as construed. ODP four-field HOLD unchanged; includeDocuments 500s still unverified.

Effect: still no rc.113. #7265 moved on the clock and not on the registry. Jazz rehearsal closed unmerged on purpose; alpha.54 is the live RC.

Agents: SkillShift is the post-tombstone skill-policy paper (add watch). ACLE-MCP and EFFECTBOUND are the invocation-time binding pair (leases + effect closure; add watch). Repo-To-Skill is author-reported library scale (add watch). SafeEvolve and CodePoisonRAG are author-reported harness/RAG numbers. kitter is a new local-first skill manager with volatile metadata.
