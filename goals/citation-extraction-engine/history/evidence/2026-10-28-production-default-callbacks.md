# Production default resolution callbacks

Date: 2026-10-28. Private callback integration and focused grouping proof;
final document projection and complete engine parity remain unfinished.

## Implementation and ownership

Private `DefaultCallbacks.ts` now constructs the five default callbacks adapted
from the pinned eyecite resolve.py. Every returned method captures its Crypto
and work dependencies and has R = never. Its mention/edition lookup tables are
allocated for the prepared operation, with no global cache or shared session.

Full callbacks produce the existing canonical authority descriptor. Short
callbacks compare corrected reporters and textual volumes, preserve lazy
missing-reporter errors, accept one distinct resource before party refinement,
and refine multiple candidates with the pinned punctuation behavior. Supra
uses nonempty antecedents and party substrings. Reference matching compares
the four reference names exactly against every nonempty metadata value of
prior full citations, including law/journal values and court representations.
Id. uses the actual last result and the first member of its current group,
including a non-full first member introduced by a custom callback.

None, falsy resources, ambiguous defaults and pin failures retain their source
grouping behavior. The existing document resolver remains the regression path
that also retains Ambiguous/Unresolved diagnostics. Its matching implementation
must be retired when the unified session's final document projection preserves
those diagnostics; no second permanent source of matching truth is intended.

## Per-operation work and preparation

`runDefaultCitationCallbackSession` verifies the server input once, allocates
fresh callbacks and work state, and runs the prepared session. The raw-input
session wrapper continues to prepare input for custom callers. The prepared
runner is private composition and requires input from the shared verifier.

Dispatch, group visits and default matching/key visits use one captured work
counter. Callback failures retain finite private reason codes so work
exhaustion remains `limit-exceeded`, rather than becoming a generic callback
failure. Copying the failure still drops extra payloads and nested causes.

The counter captures its numeric ceiling when created. Later mutation of its
input policy cannot increase it. The prepared runner rejects a supplied
counter whose ceiling differs from that operation's decoded policy. The
default wrapper allocates its counter per invocation, including concurrent
invocations; it cannot spend separate matching/dispatch budgets or reuse a
previous operation's allowance.

This is iteration accounting only. Complete deadline, message/field caps,
algorithm scaling and process-isolation proof remain open. Source verification
uses the caller's genuine canonical-source capability; the callback wrapper
does not rehash the raw source or verify each occurrence twice.

## Focused source proof

Five new tests cover:

- All 46 focused source contexts, including expected failures, and membership
  comparison with the existing default document resolver.
- Every one of the 30 committed default operation observations and its 94
  occurrences, using the exact operation corpus hash and direct source groups.
- A single shared work ceiling across dispatch/matching, equality at the
  tested ceiling, failure below it, and isolated concurrent operations.
- A captured ceiling that survives policy mutation, plus rejection of a
  counter from a different policy.
- Exactly one occurrence digest and one resource digest for a one-full
  operation, after the source capability has already been verified.

The existing 18-context custom trace lane now delegates its default branches
to the production callbacks. Duplicate test-only default matching/pin logic
was removed. Test adapters remain only for the explicit custom actions and
focused primitive resource normalization. All 53 callback events, successful
groups and expected failures remain comparison obligations.

Default context coverage remains 76 contexts / 210 input occurrences, now
also exercised through the production callback session. The separate custom
lane remains 18 contexts / 56 occurrences / 53 events. These totals describe
their respective private paths, not a combined full-engine parity verdict.

## Remaining integration

The default document resolver still owns richer outcome diagnostics. The
callback session still owns transient groups that can include empty or mutable
membership, and it does not automatically issue the trusted persistence
bindings. A lawful projection must reconcile these without dropping source
state, fabricating full mentions or weakening verified evidence.

Public use-case ports, live parser artifacts, general host normalization,
alias/model mutation, foreign citations, final error translation, bounded
runtime, extraction/cleaning/annotation, Bluebook transforms and exhaustive
target proof remain open. No canonical, donor, divergence or safety row is
promoted, and the complete goal and current phases remain active.

The final server package gate passes (audit 35.8 seconds, docgen 13.0 seconds),
including build/type checks, tests, lint and documentation. All five new default
callback tests and the updated three-test custom session suite pass alongside
the existing resolver, persistence, identity and Unicode/pin suites. Fresh
pinned Python replay matches all retained custom source observations.

The ten-component evidence audit and goals index pass; goals doctor reports no
new blocking findings. New-note and README Markdown checks pass. The complete
target comparator remains pending. Verification logs use the
`default-callbacks-` cache prefix.
