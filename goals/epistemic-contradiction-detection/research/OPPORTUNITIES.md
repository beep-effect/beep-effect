# Opportunities

## 2026-10-09 — Existing-package concept generation

Action: `bun run beep architecture add concept epistemic ContradictionDetection --domain-kind values --dry-run`.
Result: plans missing package AGENTS.md, LICENSE, test/.gitkeep, a differing
WorkPriority values barrel, and low/normal/high model/behavior/test placeholders.
Applying would partially write before "Architecture operation would overwrite a differing file".
Used the plan as reference only; hand-authored the four concept files.
Prevention: preflight the entire plan and offer additive existing-package
concept generation that preserves package metadata and existing barrels.

## 2026-10-09 — Inherited knowledge-reference gate

Action: `CI=true bun run beep knowledge refs --check` at P0 head `685602ef61`.
Result: one live gated external-mirror-reference observation in
`goals/repository-simplification-confidence/SPEC.md:374:4`.
Attribution: the same portable-path prohibition is present in origin/main
`36027982f2`; its blob SHA256 is
`88560c9b67b0ca30a7b104d998b08047ca8f48dd1f3793471b28cf3c3181f85b`.
This lane did not touch that packet. The scanner interprets a prohibited path
prefix in normative prose as a live external mirror reference. Repair belongs
to the owning packet or consolidated main repair, not detector scope.
Prevention: recognize path-prohibition examples as audit-pattern literals.

## 2026-10-09 — Repair missed the reported codec call

Action: repair a domain package-verify typed-decoder diagnostic.
Result: the audit repeated at ContradictionDetection.test.ts:67 because the
first repair changed another codec call. Read the exact numbered source span
before changing a reported compiler diagnostic; the actual call is now repaired
in 9edd003a48. No fresh package proof covers that repair. The repeated-blocker
condition ended the lane, with full qualification still outstanding.
Prevention: attach the diagnostic span to the repair and verify that the
reported line itself changed before spending another heavy admission.

## 2026-10-09 — Heavy admission has no visible queue position

Action: submit the two authorized resume package-verification jobs via beep-heavy.
Result: both remain alive waiting for the three machine-wide flock slots across
repeated 60-second result polls. Slot-holder changes are visible, but the wrapper
reports only "all 3 slots busy, waiting", with no queue position or wait estimate.
No caps were raised and no other lane's work was interrupted.
Prevention: expose ordered admission position and elapsed wait in the wrapper so
queued lanes can distinguish progress from starvation without bypassing admission.

## 2026-10-09 — Additive aliases force global docgen qualification

Action: `bun run docgen:local` after the owned config-sync alias addition.
Result: "full docgen proof required" because tsconfig.json changed, although
both generated files add exactly one detection alias. Retrying with `--full`
through heavy admission; package-level docgen remains separate evidence.
Prevention: let the docgen planner recognize owner-generated additive alias
changes and verify the corresponding package exports without expanding scope.

## 2026-10-09 — Cheap gates caught test and entrypoint gaps

Action: Yeet publish's collected cheap gates after successful focused/package tests.
Result: seven introduced Effect/Vitest findings in the two new tests and one
Knip unused-file finding for the new client-safe detection index.
Repair: canonical Boolean assertion helpers, registered Effect property tests,
Exit capture with the existing typed-error-tag assertion, and server-barrel
reachability for the client-safe schemas. Committed as `a7271fb15e`; the P0
cheap-gate row is acknowledged against that repair. Golden suite passes twice.
Prevention: run test-law/entrypoint discovery before package qualification so
syntax-only violations do not consume a second publication attempt.

## 2026-10-09 — Brief and newly merged private-release policy conflict

Action: merge current main and publish the required private-package patch note.
Result: Repo Sanity job 113991105046 rejects both private package entries with
"private workspaces must not accumulate release notes". Main #1566 also removes
the brief's named execution-ledger note precedent. The lane is stopped under
the materially contradictory source condition; its required note is retained.
Prevention: update active lane briefs when a program-wide release-policy change
lands so required artifacts match the current authoritative gate.

## 2026-10-09 — Runtime conformance missed proposal array type

Action: inspect the completed Storybook job 113991101860 immediately.
Result: introduced TS2322 at ContradictionDetection.layer.ts:135; encoding
proposals through S.Array loses the shipped non-empty tuple contract. The
runtime golden vectors pass, while the full use-cases audit remains queued and
is cancelled at the stop. The source error remains outstanding.
Prevention: retain the two-proposal tuple through sorting/encoding and run the
full use-cases package proof before claiming the build contract is qualified.

## 2026-10-09 — Package test checks exposed law and fixture typing gaps

Action: run both final package-verification audits after tuple repair.
Result: domain test lines 56-60 use nested Result assertions; use-cases tests
contain a helper-level Layer provide, typed wires decoded as unknown, nested
Result/Exit assertions, and JSON fixture union inference at A.getUnsafe.
The old typed-ref diagnostic did not recur. Use instrumented it.layer at the
test entrypoint, typed decoders for encoded wires, pipe form for Results/Exits,
and decode then encode the fixture before homogeneous array operations.
Prevention: package test typechecking must accompany focused runtime goldens;
root test-tsgo intentionally skips package tests covered by their own scripts.

## 2026-10-09 — Run-3 heavy-admission fallback

Action: resubmit repaired use-cases package proof through beep-heavy.
Result: queued from 19:54:47Z past 20:14:47Z with no command execution.
Verified the unit belongs to this lane, stopped it, and ran the identical
proof in the existing lane cgroup under the run-3 explicit fallback ruling.
TURBO_CONCURRENCY remains 2; MemoryHigh 36G / MemoryMax 40G unchanged.
Prevention: queue starvation diagnostics and bounded admission with a documented
cgroup fallback; neither duplicate execution nor higher caps is required.

## 2026-10-09 — Test Layer and clock boundary diagnostics diverge

Action: qualify golden tests with compiler laws and Effect/Vitest syntax policy.
Result: shared it.layer passes package tsgo but requires hook/clock ownership
evidence. Moving Layer provide into an Effect.fn pipeline passes runtime tests
but strictEffectProvide still rejects its placement. Scoped Layer.build plus
Context provision in the existing helper passes both audits and full-scan lint.
Prevention: document a canonical scoped test Context pattern that preserves
per-test TestClock isolation and passes both compiler and syntax diagnostics.
