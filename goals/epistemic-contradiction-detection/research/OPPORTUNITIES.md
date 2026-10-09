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
