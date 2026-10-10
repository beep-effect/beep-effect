# P2 first bounded wave: pre-launch result

Run-8 authority follows merged #1609. Planned membership: ten distinct remaining
non-stub PST occurrences, ascending size then object identity; 27 remaining
eligible occurrences in the archive, 25 stub-sized occurrences outside this
first extraction wave. Input range 61,727,744 to 539,157,504 bytes. Other estate
obligations remain open. Basis: accepted P1 2.363134690x, family 822,686 ms,
and orchestrator-reported 20 GB peak RSS.

Retained bounds: ratio 4, attempt 7,200,000 ms, family 43,200,000 ms,
output 2,147,483,648 bytes per family; free-space floor 100,000,000,000 bytes.
One detached family unit at a time; 60 seconds between accepted seals; stop on
first sealed failure and diagnose before further work. No code change in wave.

Result: zero families started, zero P2 ledgers created. Launch is blocked by
missing public occurrence selection: slice always picks accepted P1, while full
selects the entire estate and is forbidden. Fresh run labels cannot change the
selected occurrence. A different expected count fails the denominator after
immutable start. The schema and CLI expose no object selector or bounded list.
No workaround, preservation mutation or direct internal runner was used.

Fresh prerequisites: both real sandbox smokes and four focused tests pass;
230,195,183,616 bytes free; engine identities and both sealed P1 ledger digests
unchanged; no active corpus family unit. Packet checks add no blocker.
P1 stays complete; P2 stays pending. The orchestrator must supply a bounded
selection contract or authorize a scoped implementation before launch.
Reversal: revert this packet plan; retain both sealed families and freeze records.
