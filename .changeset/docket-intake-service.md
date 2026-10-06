---
"@beep/law-practice-server": minor
"@beep/docket-intake": minor
"@beep/identity": patch
---

Add the docket intake service. `@beep/law-practice-server/DocketIntake` holds
the live adapters of the intake pipeline: Graph mailbox and calendar ports over
the app-only Microsoft 365 lane, the paralegal and secretary agents over a
language model, a file-backed state store with a digest archive, and a matter
lookup that reports itself as not wired. The new `@beep/docket-intake` app runs
the pipeline as `poll`, `run` and `smoke` commands configured from the
environment. `@beep/identity` registers the app's identity composer.
