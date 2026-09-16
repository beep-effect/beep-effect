---
"@beep/epistemic-domain": patch
"@beep/epistemic-use-cases": patch
"@beep/epistemic-ui": patch
"@beep/qa-capture": patch
---

Expose exact-source claim explanations and portable human approval receipts.
Keep assertion, subject, evidence, scope, extraction confidence, and source
identity together. Reverify the current source before approving; retain earlier
approvals as stale history after the claim, document, or extractor changes.

Add an interactive Storybook document-to-approval example. The Storybook host now
resolves epistemic stories through its declared epistemic-ui dependency, so Turbo
tracks the new package's build and transit dependencies. Existing cache settings,
outputs, and qualification scope are retained. The cache baseline review accepts
this dependency edge for audit, build, check, deprecated API lint, Storybook build,
and test; it grants no additional cache qualification.

Apply the QA collector's CORS middleware globally so recorded browser journeys
receive the configured origin headers and preflight responses.
