# Owned native cleaner entry for Document handoff

Document preparation must hand its original value to clean_text without first
reconstructing a JavaScript string. The existing raw-text pipeline necessarily
calls runtime.fromText; that path cannot represent literal surrogate pairs as
distinct native Python points or retain an already-issued object's identity.
CleanerValues and the registry already own those capabilities. The pipeline now
also accepts an owned input through a private runOwned entry.

## Existing execution, not another cleaner

The owned invocation contains a live issued value and registered server plan
selector. Its schema preserves the actual handle; a structural clone receives
no ownership authority. The captured runtime asserts ownership and measures the
native source before plan invocation. Effective source overflow is refused
without opening the plan or making a display projection. Non-text owned values
remain available to the existing server protocols; an empty plan retains a
None-like host value and produces no text charge.

Both raw text and owned input use one shared runInitial implementation with the
same work issuance, nested execution, reservation consumption, clean/operation
timers, sanitization and acquireUseRelease close path. Owned preflight itself
runs inside those captured timers. The admitted cleaner operation delegates
runOwned through its existing admission owner. Methods have R=never. No new
registry, interpreter, reservation ledger, timer or native transport is added.
The raw-text entry preserves its prior source preflight and conversion order.

## Passed proof and retained failures

All 25 focused tests pass across the new owned-input cases, existing cleaner
pipeline and real registry in 1.83 seconds. They prove:

- Empty-plan identity and exact native storage for two literal surrogate points.
- A None-like owned input remains the same handle through an empty plan.
- Captured callbacks receive the exact original handle.
- The real underscore builtin retains both literal surrogate points without
  combining them into a scalar. Direct original CPython execution confirms that
  the source double underscore disappears, leaving three Python points.
- Forged same-slot handles fail with unissued-value; native source overflow
  fails before any plan callback.
- A blocked owned text-units preflight fails at the captured cleaner deadline.
- Compile-time assignment retains the inferred closed error union with R=never.

The first test callback lacked the host key's hash/equality hooks and was refused
by the real registry. A second test expectation incorrectly retained one
underscore; checking the pinned original corrected the expected bytes. Initial
receipts remain in .beep/cleaner-owned-tests.log and
.beep/cleaner-owned-tests-final.log. A reusable test-function compiler diagnostic
was corrected with Effect.fn. Package lint/source/test type checks, the final
focused run and normal policy remain unchanged; no threshold or safety ceiling
was relaxed.

This is the required value-preserving cleaner handoff primitive, not completion
of the Document constructor. Argument truth/clean-step protocols, mutation and
implicit html insertion, callback output types, complete cleaner/geometry budget
composition and source input-mode traces remain to be connected and qualified.
HTML names, full engine/service composition, hosted exact-head acceptance,
exhaustive accounting and every remaining goal obligation stay open.
