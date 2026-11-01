# Remaining complexity adjudication

Independent Astra read-only review at HEADae89646bded05f2a249a2a91896e27ad8c0c9a2e.
No new correctness defect identified. All21 coverage values are estimated, not
measured percentages. The reviewer hash-verified all23 archived worker-proof
artifacts. The managed-process fixture exactly matches current source; worker
proof differs only by the independently verified S.Literal(0) to S.tag(0) change.
Current-source installed proof remains required; old proof is not a substitute.

## Worker

- Extract credential resolution and journal/stale-socket preparation from startup;
  preserve qualification, credentials, existing-file checks, socket handling and
  SQLite-open order. Keep acquisition/ownership/finalizers/runtime join visible.
- Credential reader is a cohesive refusal boundary. CRAP-only candidate156 for
  its unique exact-file function selector, subject to current installed proof.
  Do not replace its permission predicate with isPrivateObservationFile: systemd
  0400 credentials are intentionally accepted; the latter helper requires0600.
- Credential-source selection is cohesive; naming/extracting it is useful.
  CRAP-only candidate132, subject to installed proof. Invalid present directories
  must not fall back to ambient credentials.
- Use finite method/URL matching for routes. Keep URL-only maintenance delegation,
  worker-handler fallback and outer safe503 mapping.
- Socket finalizer can reuse existing sameFileIdentity without changing finalizer
  placement, ownership presence check or socket-type check.

## Tests and fixtures

- managed-observation-process program: exact-file CRAP-only56 candidate. Actual
  entrypoint proof invokes initialize and retry, verifies lost acknowledgment,
  restart reconciliation and claimed/no-relaunch. Preserve cohesive lifecycle.
- AiProviderCliSession registration callback: give only outer callback a unique
  name. Nine top-level loops register finite matrices, not one953-line scenario.
  Narrow cognitive9/CRAP32 candidate after naming and proof, never generic arrow.
- observation-root-probe clone/worktree scenario: preserve actual Git operations,
  identity/population/privacy assertions; unique test-selector CRAP38 candidate.
- native-http-crash start: extract protocol qualification block, preserving child
  acquisition/cleanup and before/after-commit kill/restart assertions together.
- evidence-retention and payload-reclamation mixed-state scenarios: replace
  numeric-index state setup with explicit named actions, preserving one mixed
  journal/batch and independent state/count/replay/re-admission assertions.
- transcript-export mock handler: separate POST capture/privacy from GET stored
  row/corruption logic; do not share production matching logic with the mock.

## Remaining source

- recordReads: keep full pre-mutation validation; separate outcome classification
  while preserving accepted/partial/backlog precedence and one-shot checks.
- discovery next/operation still have genuine cognitive findings; preserve cursor,
  budgets, owner-scope, semaphore, terminal-event and failure placement.
- launch claims: extract exact-replay sync and new-transition validation; separate
  prior-receipt compare/sync from new-receipt publication without changing ordering,
  permit or timeout. No exception approved for these three findings.
- AgentMessage readPrivateDocument/body and export-reader prepare are CRAP-only;
  insufficient fresh function-specific proof for exception approval in this pass.

## Any exception qualification

Exact file plus unique function and only approved dimension. Remeasure after any
rename/extraction. No broad ignores, generic anonymous/arrow selectors or global
threshold changes. Reason names boundary and receipt; review by2026-11-30 and
sooner on body/selector/ownership/protocol change, measured coverage or a simpler
equivalent design. Lower/remove when no longer needed. No exception applied yet.

Reviewed SHA256s:
- ObservationWorker.ts:32e403417ae094438ccb5a94bb2852d7d0a84feb21a064500b098878ef892b9e
- managed-observation-process.ts:088055ea862eb05f214540c0107d7de2e09bb978ea84031bfe472dbc3016aa39
- AiProviderCliSession.test.ts:31054cec53a76feb1179eeccb3c47a8d5c04b1c5792826b482a4933916646c95
- native-http-crash.test.ts:90cb0f8915f3906e3c0457853d2f227d37cd6a4e553af908782fad9f8973b493
- raw Fallow v17:0ab9890039e48fd368476d8577da121c7188e24288dc96752175155345f4db01
- .fallowrc.jsonc:8e31b7a900d5a3343c6800ef0a09873793739079838d09d98dad8ca51acbbcdc

This is bounded review evidence, not measured branch coverage, installed proof,
repository delivery or full goal acceptance. Recovery hold remains intact.
