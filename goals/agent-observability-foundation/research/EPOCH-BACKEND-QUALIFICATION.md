# Changed-epoch native identity on the pinned backend

The synthetic proof exercises the real projector, journal, sender, reconciler,
reclaimer, evidence-window retirement and scheduler against the pinned disposable
collector and Phoenix images. Its lifecycle ages use an explicit fixed wall clock;
network operations and deadlines use real timers. It is not an elapsed-day test.

An initial native event becomes Visible. After the required synthetic quiet/age
interval, its verified payload is reclaimed and epoch zero seals with one visible
observation. Re-admitting the same projected batch creates a different receipt in
epoch one, with unchanged event/trace/span identities and different encoded bytes
(the new epoch attributes are explicit). The second send is accepted upstream.

The pinned Phoenix retains exactly one row with the original epoch-zero metadata,
not the later epoch attributes. Exact read-back returns Mismatch. The current
local observation remains accepted-unverified, with one send attempt before and
after a scheduler pass. The lifecycle clock advances past all delays and a
synthetic target-bound replay policy is enabled: the retained outcome is actually
Reconciled(Mismatch), not a pre-query timing hold. No visibility is fabricated
and no automatic replay occurs. The synthetic policy marker grants no production
replay qualification.
Explicit expiry after a synthetic 24-hour age records acceptedUnverified=1 and
visible=0. The collector confirms two successful span exports and an empty queue before
shutdown; three subsequent backend samples remain identical. Backend usage
remains one 15-token observation, not 30. This is a bounded quiet-window result,
not a permanence guarantee. This is a
backend retention/identity limitation, not evidence of an additional successful
observation. Byte-identical duplicate qualification must not be generalized to
changed epoch bytes. A later backend/image change needs a new qualification.

The synthetic-only source-bound receipt is ops/epoch-backend-verification.json.
All owned services, containers and network were removed. No production service,
historical archive or recovery hold changed. The first fixture attempts exposed
a syntax error, asynchronous project creation, and an unrecognized usage name;
those attempts remain failed, and the final complete run uses a recognized
synthetic Claude usage shape and handles only not-found during initial read-back.

Independent review rejected the earlier v4 no-replay claim because its clock did
not advance and replay was disabled. It also required explicit upstream completion
before interpreting backend retention. The v5 receipt fixes both proof defects;
`epoch-backend-pre-review-verification.json` retains the earlier limited result.
