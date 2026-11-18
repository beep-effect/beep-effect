---
title: "Stop B2 at startup-only engine selection for mixed-dialect invocations"
date: 2026-11-14
lane: "feat/citation-regex-session"
reversal: "Specify per-job engine authority or another reviewed mixed-dialect contract, then resume B2."
---

B2 is stopped again under the implementation brief's explicit conflict rule.
The depth stop is resolved by owner ruling 3195ce21182. This stop concerns source
engine identity, not depth, the B1 spawner/Clock fixture fixes or capacity.

## Binding contract and live source

- Design rev 2, explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md:102-110
  puts limits and engine in startup; the v3 job has sequence, descriptor and the
  v2 payload fields, with no engine.
- packages/law-practice/server/src/internal/Citation/RegexEngine.ts:8-14 defines
  two exact pinned dialects, python-re and python-regex-v0, and explicitly says
  the engine is never inferred from flags.
- Tokenizer.ts:150-154 installs its evaluator without an engine argument;
  RegexWorker.ts:32-36 defaults that evaluator to python-re.
- ContextMatcher.ts:88 installs its evaluator with python-regex-v0. Its search
  calls evaluate at lines 89-98. These evaluators share CitationInvocation.regex.
- RegexSessionProgram.ts:42-44 decodes startup once; lines 63-65 pass that same
  startup engine plus each job's descriptor to makeCitationRegexEvaluation.
- RegexWorkerEvaluation.ts:45-48 creates the descriptor registry and compiler
  under startup.engine. RegexSession.ts starts the process only when no transport
  exists. A subsequent evaluator's engine has no wire field to change it.
- RegexProgram.ts:701-702 rejects a global inline case directive after tokens in
  python-re, while python-regex-v0 permits that construct. Other dialect branches
  exist at lines 419, 436, 595, 663, 803 and 907.

One invocation therefore needs both dialects, but the designed wire fixes one
dialect for all jobs in that process. A descriptor carries hash, flags and
profile, not engine identity. Inferring the engine or silently using one dialect
for both changes matching behavior. Restarting on an engine change abandons the
one-process plain-text count target.

## Observations

The real-child session transport proofs pass 18/18, including both Bun and Node
children, and the structural regressions pass 4/4. Those homogeneous-engine tests
do not prove mixed-engine extraction.

The serial public replay exposed the conflict: CitationCanonicalDump.test.ts
fails on both Bun and Node with CitationRegexTranslationFailure,
reason unsupported-syntax, while running ContextMatcher from post-case metadata
after the session is already in use. CitationCanonicalAnnotationWorkflow,
CitationCanonicalCourts, CitationCanonicalExtraction and further public replays
fail at the public boundary with CitationInputError. Do not attribute these B2
mixed-engine failures to the B1 fixture work.

A separate read-only probe compiled the same synthetic native ASCII pattern
a(?i)b with flags 0 under both current compilers and unchanged default limits:
python-re rejected it with CitationRegexTranslationFailure/unsupported-syntax;
python-regex-v0 accepted it. This confirms a real dialect distinction without
relaxing a guard or running regex in the parent.

The queued test batch was stopped after its current file completed. Remaining
tests and the final canonical count gate are not claimed. Full receipts and
limits are in history/evidence/2026-11-14-b2-regex-session.md.

## Resolution options

1. Recommended: amend protocol v3 so every job carries the explicit
   parent-selected CitationRegexEngine. The worker must construct that job's
   registry/compiler with the job engine. Move engine out of startup, or specify
   why a startup copy remains. Include the engine in exact size preflight and
   the finite property ceiling; retain depth 4, descriptor binding, strict
   decoding, all timers and confirmed retirement. Add a real-process regression
   alternating dialects in one process and then run the unchanged ten-process,
   291-evaluation count gate.
2. Define and prove a new common execution dialect that is equivalent to both
   pinned sources for every admitted pattern and Unicode/case/verbose behavior.
   This needs a new design and source-family evidence, not an implementation
   substitution.
3. Restart on engine changes and explicitly revise the lifetime/count objective.
   This cannot claim the current ten-process acceptance target.

No resolution was implemented. No per-job engine field, inferred engine,
shared dialect, new pool or engine-switch respawn was added. The transport work
is committed locally for review of the stop; B2 is incomplete and not in review.
No success checkpoint, push, PR, rebase or base merge was performed.
