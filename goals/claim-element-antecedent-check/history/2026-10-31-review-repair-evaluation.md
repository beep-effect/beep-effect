# Review repair: retained recovery with safer normalization and delivery

PR: https://github.com/beep-effect/beep-effect/pull/2411

The fixed benchmark remains **37/538 exact structures**, retaining all 34 protected matches and all 37 matches from v19. No reference, selection, strict scorer or previous result was changed. This is a development-set repair, not held-out accuracy or attorney validation.

## Review findings and repairs

The normalizer previously preferred a later “characterized by” clause whenever the earlier transition was `having`, `including` or `wherein`. This incorrectly moved a component description into the preamble. It now prefers a defining clause only when it is a standalone clause or explicitly repeats the claimed subject. Synthetic tests retain both component-description boundaries and valid implicit, repeated and bare claimed subjects. Existing assertions remain intact.

The first correction, v20, was too restrictive: it scored **35/538**, losing protected claims `12447956-root-7:13` and `15752303-root-1:6` through their parent-claim normalization. That attempt is rejected. Its full positive/allowed results and source freeze remain separate records. v21 restores valid defining clauses; v22 adds canonical documentation categories without changing behavior. Both score **37/538**, with no lost previous match. Every version's raw results and successful prediction reports is copied into a separate durable archive and byte-verified. Complete 21-file source snapshots are available for v21/v22; the v20 archive recovers 20/21 source files, with its normalizer represented by the original verified source hash rather than a separately recovered source snapshot.

The automated-reference validator now checks that each decision's `id` equals its stated `familyId:claimNumber` and that the number is an integer before reading evidence. Copying a different decision while retaining the original ID is rejected. All original boundary tests remain, with three additional ownership tests: six tests pass. Revalidating both original reviewers produces a summary identical to the retained reference summary: 33 agree, three revise, 14 uncertain, and one unresolved convention. Original validator/test source bytes are archived as text; the reviewer receipts and reference labels remain untouched.

The review tool now counts the UTF-8 JSON bytes of unchecked-claim errors, review items and candidates during projection, with a conservative **1 MiB response budget**. An oversized result returns the typed `review-response-too-large` failure. It delivers no misleading empty or partial clean result: its message says every supplied claim still requires review, reports the unchecked count and requests a smaller claim set with dependency context. The existing small-result and unchecked-claim tests remain, and an amplified 5,000-candidate synthetic case verifies the refusal. The tool remains read-only and does not persist candidates.

All four Boolean compatibility helpers use canonical `predicates` documentation; the parser export uses `parsing`. No new `domain-logic` category remains among the changed source files.

## Current measurement and uncertainty

v22 has 37 strict matches, 443 structural mismatches and 58 input failures, with no undecomposed selected claim among normalized inputs. Typed-edge F1 is **30.0454%**, a secondary diagnostic: 1,855 matching edges, 5,438 predicted edges and 6,910 reference edges. Strict recovery remains poor.

The unchanged allowed cohort still has 200 selected sets and 3,184 claims. The replay checks 196 sets and 3,108 claims, leaves 76 claims as input failures, has no undecomposed checked claim, and emits 21,533 raw findings. Three allowed sets have changed predictions. None belongs to the original random 30-claim adjudication sample. Every successful prediction report for that sample is byte-identical, and sampled input-failure outcomes are identical. The exact review evidence is therefore carried forward as **historical automated judgments**, with no claim of fresh independent review or attorney judgment.

The sample retains 21 erroneous-alert claims, seven negatives and two unknowns: identification bounds **70–76.7%**, with the conditional conservative 95% Wilson envelope **52.1–88.2%**. These are estimates for the fixed allowed cohort conditional on automated adjudication. They do not account for shared-model error, establish legal indefiniteness or demonstrate general reliability. Findings remain advisory.

The new IPRally smoke receipt is identical to v19: one non-US/non-gold claim/tree, 523 tokens, 78 unreviewed findings, 16 coverage warnings and no undecomposed claim. No licensed raw input is committed.

## Verification and delivery state

Full package audit/docgen pass for domain, use-cases, server and the runnable app. Fallow health has zero findings; audit has zero introduced findings and the same four nonblocking inherited inventory findings. The 631 reference/history pins remain exact. Of the 1,136 pre-integration snapshot files, 1,134 are byte-identical; the only two changed files are the validator and its test, whose original bytes are separately hash-verified in the new code archive. All 21 current runtime pins pass.

The e999 content-final attempt was controlled-stopped after real review findings arrived; it is not a passing final receipt. Its old-test replays passed. A new committed-head final check, hosted checks, review replies/resolutions, readiness window and packet closeout remain required. Attorney attendance remains optional under autonomous acceptance v1.
