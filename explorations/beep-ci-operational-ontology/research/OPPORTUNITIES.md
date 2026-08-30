# Research friction receipts

## 2026-08-27: Firecrawl CLI lacks the research subcommand

- **Work:** finding and verifying the papers for the R3 scheduling-formalisms lane through the
  repository's required research-index workflow.
- **Evidence:** `firecrawl research search-papers ...` exited 1 with `unknown command 'research'`
  and suggested the unrelated `search` command.
- **Cost:** the lane had to use primary-source web search and inspect papers individually rather
  than use semantic paper search and citation-graph expansion.
- **Prevention:** install a Firecrawl CLI version that provides the documented `research
  search-papers`, `related-papers`, `inspect-paper`, and `read-paper` commands, or make the skill
  detect the installed CLI capabilities and name the supported paper-retrieval fallback.

## 2026-08-29: auditor engine churn during the §4b normalization run

- **Work:** running the `ontology-foundational-auditor` skill over the S4 harvest in a dedicated
  worktree while the skill itself was being hardened in a parallel session.
- **Evidence:** the archived run manifest (`ontology/extraction/s4/beep-ci-ops/runs/`) records five
  mid-run engine re-locks (validator `c8229fc304bd` → `039564222bd0` → `982650ee041d` →
  `04b06d94567a` → `6aec64cde23f`; contracts `ee9e30584f63` → `fd8cb801a7b3` → `e1338e75966c`)
  and, before the final freeze, the canonical Claude skill installation was emptied by that
  restructuring session; the run finished on the Codex skills-mirror snapshot of the engine.
- **Cost:** every re-lock re-verified the whole tree (1,097 observations, 692 hypotheses, later
  235 reviews) before the next stage could start, and the repository-shipped skill (vendored by
  PR #880 at validator `c036e5316511`) no longer reproduces the pinned digests, so the judging
  engine had to be vendored post hoc as `runs/history/<run-id>.engine/`.
- **Prevention:** vendor the engine snapshot (validator, `_shared` contracts closure, prompts,
  templates) into the packet at run START and point every seat at that snapshot; treat the
  skills checkout as frozen for the run's duration (branch or tag it); have the validator print
  the digests it will demand at run start so a drift is caught before seats spend tokens.

## 2026-08-29: proposal revisions overwrote the bytes earlier review rounds bound

- **Work:** the adversary → revision → re-review loop of the same run (five rounds).
- **Evidence:** each `*.review.yaml` round binds a `target_sha256` of the proposal bytes it judged,
  but revisions rewrote `work/proposals/otp-*.yaml` in place while `work/` was untracked, so only
  the latest round's target and chain digests are reconstructible from the committed tree.
- **Cost:** earlier FAIL rounds and the `revision_log` entries that answer them are recorded
  history rather than independently re-verifiable bindings; an auditor can replay the ratified
  (latest) round only.
- **Prevention:** the skill should retain every reviewed proposal revision under a
  content-addressed path (for example `work/proposals/history/<sha256>.yaml`) and the validator
  should verify each round's `target_sha256` against it; commit `work/` at every round boundary
  so git history keeps the bytes even before the skill does.

## 2026-08-30: an unrelated format sweep rewrote digest-locked run evidence

- **Work:** starting the S5 stint on fresh main after the §4b packet merged (PR #889).
- **Evidence:** PR #865 (court-reporter vocabulary) carried a repo-wide Biome write sweep that
  reformatted `ontology/extraction/s4/beep-ci-ops/adapters/adapter-typescript.ts` (line joins,
  interface key sorting) and `adapters/golden/typescript/input.ts` without touching the
  `adapter-typescript.ts.sha256` sidecar — on main the frozen adapter failed its own engine
  check (tree sha `ee276c25…` vs sidecar `fc6dec09…`).
- **Cost:** the committed copy of the run's engine diverged from the archived manifest and the
  pin; anyone replaying the adapter got a hard verify_engine refusal until the bytes were
  restored from the retention tag lineage.
- **Prevention:** Biome `files.includes` now excludes the packet's `adapters/` and `runs/`
  trees (this change); frozen evidence must always ship with a formatter exemption in the same
  PR that freezes it, since a digest lock can only detect corruption, not stop a write sweep.
