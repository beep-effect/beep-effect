---
{}
---

No release: land the patent citation candor gate — a derived, fail-closed predicate that
blocks filing promotion until every current AI-discovered patent citation carries an
attorney judgment bound to its exact observation version.

`CandorPolicy` (`packages/law-practice/use-cases/src/CandorPolicy/`) recomputes its verdict
from recorded events and recorded judgments on every call. There is no stored "duty
satisfied" state anywhere — blocked-ness is derived from the uncovered list rather than
carried as a field — and nothing in the package computes a legal judgment. Every branch
either finds a human decision bound to an exact observation version, or declines to treat
the event as covered and says which of nine fail-closed reasons applies.

Currency is declared, never inferred. `SourceTextIdentity` carries digests and pinned
extractor versions but no revision order, parent relation, or head marker, so an
observation stays current until another event explicitly supersedes it by naming both the
prior event id and the exact prior text digest. Heads are derived from those links alone,
which is why arrival order does not matter and why forked lineage — two unsuperseded
observations of one source, a dangling link, a digest that does not match the event it
names — leaves every event in the group uncovered instead of guessing.

`CandorPolicy.test.ts` was written failing first and now proves 19 scenarios over
in-memory layers with real SHA-256 digests and live `verifyTextAnchor` re-verification: a
superseded event stops blocking only once the newer event is dispositioned; an
out-of-order ingest and a replayed observation release nothing; a withdrawn or superseded
disposition stops covering its event; an `Agent`-kind principal's disposition never covers
an AI-discovered finding; a source that will not resolve or an anchor that will not
re-verify blocks rather than skipping the check; quarantined and possible-duplicate events
stay uncovered; and examiner-observed events record without gating.

Durability lands the law-practice slice's **first** db-admin migration
(`20260806031625_law_practice_candor_gate`). All three tables carry
`BEFORE UPDATE OR DELETE` and `BEFORE TRUNCATE` append-only triggers, and the PGlite proof
asserts the exact constraint and trigger name sets before showing that both an UPDATE and a
DELETE against a recorded disposition are rejected. Two fresh databases rather than two
probes in one session, because an implicit-transaction pglite host rolls the whole session
back after an intentional failure.

`IdsSubmissionFact` records 37 CFR 1.97/1.98 mechanics as presence-only facts, each
submission act an independent append-only record with its own operative date. The 1.97
window is a *candidate* label with its controlling dates and edge cases recorded beside it
— certificate of mailing, Priority Mail Express, weekend-or-DC-holiday shift, withdrawn
closing action, same-day-as-closing filing — and `indeterminate` is a first-class answer.
Office treatment is recorded exactly as marked, never as evidence of reliance or
materiality, and every record cites which CFR capture and MPEP revision its fact
vocabulary was modeled from.

Two P0 findings are recorded in the packet rather than worked around. The two cross-slice
shapes the SPEC authorized are both unavailable — the repo has no domain-event transport of
any kind, and an event cannot express "do not proceed"; the promoted `shared/use-cases`
contract fails its own ≥2-consumer promotion bar — while a third mechanism ratified
2026-07-25 (foundation-mediated port inversion) fits exactly and needs an owner-approved
package. And the rung-2 live-invocation criterion is not achievable as written, because the
filing-promotion path has no runtime implementation and no app composes both slices. Both
are deferred with evidence instead of being claimed.
