---
title: "Remove v2 wire adapters and migrate surviving protocol tests to v3"
date: 2026-11-14
reversal: "Restore the deleted v2 program and adapters from the B2 parent"
---

B3 removes the unimported one-request RegexWorkerProgram and the v2-only wire schemas, codecs and preparation adapter. Keep shared native payload fields as CitationRegexPayload, without a v2 version or Evaluate tag. V3 still owns framing, preparation and evaluation. Invocation already has no regexOwner; bundled entries already run the v3 session. Shard timing changes are held by the operator for a CI-driver ruling. Test deletion and coverage receipts are recorded in history/evidence/2026-11-14-b3-remove-v2.md. Surviving protocol and text-capacity tests are rewritten against production v3 codecs; no baseline for a surviving source may change.

Deleted test cases (no whole test file is deleted):

- `CitationRegexWorker.test.ts`, "runs the one-request program with complete mode results and closed limit failures": its sole subject, the v2 program, no longer exists. The surviving v3 program is exercised by `CitationRegexSessionProgram.test.ts`, including two jobs and a closed policy failure.
- Same file, "rejects missing requests and sanitizes each broken reply stage": the v2 startup/stdin-EOF conversation no longer exists. The stdout failure coverage moves to `CitationRegexSessionProgram.test.ts`, "rejects a wrong sequence and sanitizes actual stdout sink failures": a valid sequence-zero job injects failure separately at Ready, Started and Complete, asserting the exact emitted tag prefix and stage count plus `CitationRegexWorkerFailure` / `channel-failed`. Complete is produced by the real native evaluator through the RPC completion callback. Sequenced startup and wrong-sequence refusal remain covered.
- Same file, "rejects missing startup arguments and capture metadata beyond the installation budget": v2 descriptor-bearing startup is deleted. Session RPC tests retain missing startup refusal; session protocol tests cover per-job descriptor bounds before allocation.
- `CitationRegexSessionRpc.test.ts`, "preserves the v2 startup capture-name bound while sharing the argument encoder": tests only the deleted startup schema/encoder. Shared argument bounds and v3 descriptor size guards remain covered by real tests.
- `CitationRegexEngine.test.ts`, "requires an explicit known child engine and round-trips either selected identity": tests the deleted v2 startup engine field. V3 jobs carry the engine; session tests exercise both dialects in one real process and malformed-engine refusal. The real-child engine character/folding cases remain.

Protocol preparation, exact-size, framing, malformed carrier and text/native ordering tests survive and now use v3. The malformed source evaluator case survives with the shared payload. The negative quota case survives unchanged. Existing standalone evaluator spawn counts remain exact because each fixture-bound evaluation owns a separate invocation; the count fixture already asserts ten processes in B2.

The requested remote base does not exist: `git fetch origin feat/citation-regex-session` reports "couldn't find remote ref". Use inherited B2 tip `8fb3b8c4fa7` for the supplementary scoped audit, recording the unavailable named command separately. This changes no branch or remote ref. Reverse by rerunning against the named ref if the owner restores it.

The full serial run exposed one additional v2 consumer outside package source:
`goals/citation-extraction-engine/ops/qualify-regex-translator.child.mjs` imports
both deleted v2 models. Both translator integration files failed at import/bundle
startup, before qualification. Migrate this retained qualification child to the
shared native payload and explicit evaluator configuration. Preserve its pinned
corpora, assertions and the existing goal-path reference in the test fixture.
This is part of deleting the v2 evaluator adapter, not a change to qualification.

Removing the v2 program tests also removed in-process evaluator coverage that
real-child matching cannot contribute to the parent's coverage map. Add
"evaluates every mode and empty source through the surviving native evaluator"
to `CitationRegexWorker.test.ts`: real native matching, exact match counts and
typed quota refusal, with no spawner stub. The fresh evaluator coverage is
95.74% lines, 90.90% statements, 80% functions and 80.76% branches, exactly its
existing floors. Five other edited surviving sources reach 100% in every metric.
Remove only the now-stale schema-first inventory exception for the deleted v2
startup codec test; no inventory growth or surviving coverage floor changes.
