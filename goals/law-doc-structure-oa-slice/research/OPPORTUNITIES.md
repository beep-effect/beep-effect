# OA slice friction receipts

## 2026-10-09 — Heavy launcher user bus

- Task: prerequisite dependency build from the lane launcher.
- Evidence: `beep-heavy` exited 1: `Failed to connect to user scope bus`;
  `XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS` were undefined.
- Attribution: environment-only, before any build started.
- Recovery: explicit existing user-session bus variables; job queued normally.
- Prevention: export the user bus variables in the lane unit environment.

## 2026-10-09 — Official OA images supply no qualified text

- Task: build the non-client positive corpus through the existing USPTO driver.
- Evidence: 16 downloads succeeded; each `pdffonts` result contained zero fonts;
  `pdftotext -layout` emitted only page separators (6–29 characters).
- Outcome: zero eligible real-OA positives. The brief's public-form-language
  fallback is used; no OCR engine or guessed selected checkbox was introduced.
- Prevention: a public born-digital sample catalog with explicit text lineage.

## 2026-10-09 — Blind-label report and freeze ordering

- Task: audit blind labels and freeze label A before reading B.
- Evidence: B line 28 has a malformed JSON string. The A freeze script also
  failed on an incorrectly named local module; a subsequent batched read exposed
  the discarded B output before A was saved.
- Outcome: first run void. Preserve its audit, rerun once in a fresh blind directory,
  and freeze A before opening the second result. The provisional A judgments were
  authored before either B result was opened, and their source remains private.
- Prevention: make dependent audit/freeze/read steps sequential and fail closed
  between steps; never batch a dependent labels read with its prerequisite.

## 2026-10-09 — Second blind run unavailable

- Evidence: fresh B report also fails JSON parsing (`Unterminated string`).
- Outcome: both runs void; no B labels used. Per brief step 4, label A remains
  the sole available text judgment and every fixture goes on the attorney sheet.
  Do not repair malformed B output and treat it as a valid independent result.
- Prevention: a model-output schema boundary with generation-time validation.

## 2026-10-09 — Package handoff gate admission latency

- Task: package-verify the fixture-owning use-cases package before handoff.
- Evidence: the owned `beep-heavy` result log continued to report all three slots
  busy for at least ten minutes; the package command had not begun.
- Outcome: retained the queued gate and polled without changing other workers.
- Prevention: a visible fair admission queue with estimated start time would
  distinguish capacity latency from package verification time.

## 2026-10-09 — P0 publication gate

- Evidence: wave 1 cheap gates stopped before any push: missing use-cases
  changeset and one new effect-vitest finding in OfficeActionFixtures.test.ts.
- Attribution: introduced fixture-package changes and legacy test-runner import.
- Repair: patch changeset and direct canonical @effect/vitest import; no baseline
  refresh or policy suppression.
- Prevention: use direct Effect Vitest imports for new tests, and include fixture
  packages in changeset admission even when production exports are unchanged.

## 2026-10-09 — Fixture audit API repair

- Evidence: package audit rejected a Node filesystem import, an untyped JSON
  decoder, and two String.includes calls with the wrong argument order.
- Attribution: introduced fixture test only.
- Repair: Effect FileSystem with the Bun platform layer, decodeEffect for JSON
  strings, and the curried String helper. Platform test dependency and lockfile
  regenerated through bun install.
- Prevention: check the Effect v4 declarations before adapting native helpers.

## 2026-10-09 — Fixture input lifetime

- Evidence: effect-vitest rejected platform-filesystem import and per-test
  resource provision introduced by the fixture audit repair.
- Attribution: introduced test only; the detector baseline stays unchanged.
- Repair: import immutable fixture payloads as raw test data, decode JSON strings
  with Schema, and remove the unnecessary platform test dependency.
- Prevention: distinguish fixture data from a filesystem subject before choosing
  the canonical test layer and resource lifetime.

## 2026-10-09 — Private-package changeset gate conflict

- Evidence: publication cheap gates require a changeset naming the changed
  private product workspace; hosted Repo Sanity rejects that exact changeset
  because private workspace release notes are forbidden (PR #1573).
- Attribution: the lane note triggers an inherited contradiction between the
  changeset-status and changeset-graph contracts.
- Outcome: retain the admission-required notes and route the tooling policy
  repair to the orchestrator consolidated red fix under ruling S11. Changing
  package privacy or the out-of-scope gate would exceed this slice.
- Prevention: both gates should share the same private-workspace policy.

## 2026-10-09 — Restart proof scheduling

- Evidence: the shared Vitest configuration runs suites concurrently; the
  restart reader raced the initial writer and found no retained attempt.
- Attribution: introduced ordered integration test, not a persistence failure.
- Repair: explicitly sequential canonical layer blocks with a ten-second hook
  budget; use assertSome for the linked predecessor.
- Prevention: state the ordering requirement where a restart test shares bytes.

## 2026-10-09 — Opaque proof declaration emission

- Evidence: declaration/docgen compiler TS4094 named private verified-source
  and verified-anchor capability fields in inferred exported schema types.
- Attribution: introduced inferred boundary schema types, not a runtime proof
  failure or a reason to weaken provenance.
- Repair: explicitly annotate the consumed proof codecs and exported tagged
  unions with public named types. Runtime predicates and capability brands stay
  intact; there is no cast, suppression, substrate edit or structural substitute.
- Prevention: name public opaque-proof schema types before declaration emission.

## 2026-10-09 — Named opaque-proof class bases

- Evidence: TS4094 persisted at candidate class declarations after codec and
  tagged-union annotations; the server decoder also accepted an unintended index
  as its optional parse-options argument.
- Attribution: introduced declaration and callback boundaries.
- Repair: reuse the named, explicitly typed schema-class base pattern already in
  IrToLaw and VerifiedSpan; pass only the JSON line to the decoder. The opaque
  capability predicate remains unchanged.
- Prevention: verify declaration emission alongside runtime proof construction.

## 2026-10-09 — Failed cross-scope attempt history

- Evidence: the store originally keyed the chain by the presented source scope,
  which would reject a cross-scope failure’s authorized predecessor.
- Attribution: introduced persistence identity choice found during review.
- Repair: group chains by expected source scope and document id; retain the
  actual mismatched identity on the failed attempt. Add a cross-scope failure
  and recovery test without weakening verification.
- Prevention: mirror the substrate’s authorized-matter history semantics.

## 2026-10-09 — Explicit opaque-proof field schemas

- Evidence: TS4094 moved from exported classes to inferred Struct declarations
  after the named-base repair. Runtime and source-floor tests continued to pass.
- Attribution: introduced declaration inference.
- Repair: give each opaque-proof Struct a named field type and explicit schema
  annotation, completing the existing named-base pattern without a type cast.
- Prevention: include field-schema annotations in the opaque-proof example.

## 2026-10-09 — Effect array schema type name

- Evidence: TS2724 reports that Schema’s array type is `$Array`; its constructor
  is `Array`. The wrong annotation propagated unresolved services into server
  declarations.
- Attribution: introduced field-schema annotation, not an inherited API failure.
- Repair: use the live Effect v4 `$Array` interface for the OCR page schema.
- Prevention: check constructor and interface names independently in declarations.

## 2026-10-09 — Typed test decoder inputs

- Evidence: package test typecheck rejected an encoded extraction union spread
  with a span and an iterator index passed as decoder parse options. Runtime
  focused tests alone had not exposed either type error.
- Attribution: introduced tests and fixture helper.
- Repair: state the exact-alignment discriminator on the deliberately inverted
  decoder input; pass only the JSON line to the fixture decoder.
- Prevention: retain package test typechecking alongside the focused runtime loop.

## 2026-10-09 — Cross-package fixture declaration context

- Evidence: the server test config includes its own src/test only, while its
  restart proof imports the immutable use-case fixture helper and raw payloads.
- Attribution: introduced shared test fixture type boundary found during review.
- Repair: explicitly reference the adjacent raw-module declarations from the
  fixture registry, so consumers retain the same immutable payload types.
- Prevention: make shared test fixture declarations travel with their registry.
