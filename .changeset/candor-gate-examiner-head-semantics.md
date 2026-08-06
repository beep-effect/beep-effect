---
{}
---

No release: pin the candor gate's examiner-head semantics and close the
`patent-citation-candor-gate` packet.

When an examiner-observed observation supersedes an AI-discovered one on the same source,
the group is cleared by dispositioning that examiner-observed head. That reads as a bug and
is not one. SPEC decision 4's "examiner events record without gating" constrains what
*initiates* gating — a source carrying no AI-discovered event returns early and never blocks
— rather than declaring an examiner observation ineligible to be the subject of a judgment.
Once it supersedes an AI finding it is the current observation of that source, and whether
the AI finding's history is discharged by the arrival of an examiner record is a legal
question the predicate must never compute. So it blocks until a human decides.

No behaviour changes here. The service diff is comment-only; what lands is proof that the
behaviour is intentional, on the three surfaces a future maintainer actually meets it:
a `**Gotchas**` note at the decision site in `evaluateGroup`, a scope clarification on SPEC
decision 4, and a both-direction pinning test — blocks while the examiner head is undisposed,
releases once a disposition binds to its `{eventId, textDigest}`.

Both directions are mutation-checked. Narrowing the head lookup to AI-discovered events
fails both assertions, and confirms the note's claim that doing so leaves zero unsuperseded
heads and trips `ambiguous-lineage` with no way to clear it. Forcing an examiner head to be
non-dispositionable fails exactly the clearability assertion — that mutation is precisely the
behaviour an earlier closeout note wrongly attributed to this code, so the test now catches
the error that note made.

The packet closes at `completed-retained` with every phase complete, and the reflection
carries a dated correction that keeps the original wrong finding visible rather than
rewriting it: the claim that the state "blocks forever" and "can never be dispositioned" was
asserted about code without tracing it, which is the same failure mode the packet already
recorded for `Order.string`.

The parked align question — widening the quantified set so examiner events gate in their own
right — is untouched.
