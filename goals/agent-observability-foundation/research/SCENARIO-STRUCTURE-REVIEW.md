# Recovery scenario structure review

Independent Astra review accepted four structural test changes against
`ae89646bded05f2a249a2a91896e27ad8c0c9a2e` without an actionable finding.
The retention case still puts five distinct one-event pages in one journal;
the reclamation case still puts all five states on one accepted page.
Named sequential setup preserves pending, accepted-unverified, visible,
rejected and unresolved state counts, replay, expiry and mixed admission.
Creating a visibility value does not persist it; only the visible case records it.

The crash test separates protocol qualification without introducing a resource
scope or fiber boundary. Spawn, readiness, unfinished-body join, child kill,
exit and before/after-commit assertions retain their original order.
The transcript mock separates POST privacy and durable-attempt assertions
from independent stored-row projection and deliberately corrupt responses.
No production matching logic is shared with that mock.

Reviewed hashes:
- evidence-retention.test.ts: `4af5e165462e39e0f1a573471e47f762bcaa51f6b3122cddcadfcb109605b570`
- payload-reclamation.test.ts: `9d6fe8852ef6376fe3af81f55ad0951f1344350a91156d8ca5135bf292750fcd`
- native-http-crash.test.ts: `12223f8c63679224b40a12beeb0942ab096253a96e31957f2d959ae447c48420`
- transcript-export.test.ts: `c6a6cc33ab9fc4334cf2026b5b3ec21315e12b6f6b01218209f52a57a02b040c`

Focused execution passed under a tighter 2 GiB controlled-stop budget and
4 GiB hard cap, retaining the 16 GiB host reserve. Peak observed memory was
about 552 MiB with zero PID-limit events. The default 24 GiB admission floor
remains for broad checks; the measured small fixture batch used 20 GiB.
No kernel OOM or deliberate exhaustion was requested. Package verification
and structural remeasurement are recorded separately.
