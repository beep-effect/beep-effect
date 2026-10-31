# Independent foundation review — Astra panel seat

Initial and follow-up reviews: 2026-10-29 UTC.

## Changed-epoch qualification — final v5 adjudication, 2026-10-29

**Accept the bounded changed-epoch qualification.** The two v4 proof defects
reported below are corrected and exercised by the current retained v5 receipt.
No further concrete defect was found in this focused review. The whole-CLI
quality failure, repository/hosted delivery and closeout requirements remain
open; full-goal acceptance and the historical recovery hold are unchanged.

This seat independently compared the current files against
`ops/epoch-backend-verification.json`: fixture SHA-256
`7fe8102995530123a6c4a28e2ff910b30cccb85be9f2e3248bdf4269112bfb8b`,
verifier `c352838343459a358b3047262b3ea66af3ea301c33fc883fd329aa206214d6b7`,
and collector template
`20bce80b8a5dd72030facdb46e60822720fd1bff57f94c1bb38bbff708658526`
all match. The v5 log digest matches, and all 167 source/test hashes in the
retirement package receipt remain current. The previous v4 receipt is preserved
as `ops/epoch-backend-pre-review-verification.json`, with the original reviewed
fixture/verifier hashes; its limited result and the review objections below have
not been overwritten.

The fixture enables an explicitly synthetic replay policy bound to the actual
target, with a 3000 ms minimum delay, then advances the scheduler clock by 5000 ms
(`ops/epoch-backend-fixture.ts:187-208`). It requires a completed tick with exactly
one `Reconciled(Mismatch)` outcome and unchanged attempt count (`:209-215`). The
receipt contains that actual outcome, one accepted attempt before and after the
tick, and the sampled 5000 ms accepted age. This exercises the mismatch guard;
it no longer succeeds merely because a pre-query delay or absent replay option
holds the event. The fixture's qualification marker grants no production replay
authority.

The verifier now waits for exactly two successful collector span exports and
an empty queue, stops the owned collector, and requires three byte-identical
backend samples (`ops/verify-epoch-backend.py:75-90`). It then checks one complete
result row, exact stable trace/span/event identity and a 15-token total, plus
the lifecycle and disposition assertions (`:91-114`). The retained result is:

- Epoch zero: exact read-back becomes Visible, verified payload is reclaimed,
  and the retired window retains one visible observation.
- Epoch one: the same projected event has a new receipt and changed encoded
  bytes while its source event/trace/span identities remain stable. Both
  submissions complete upstream. The pinned Phoenix retains the original single
  row without the later epoch attributes during the sampled quiet window.
- Exact manual and scheduled read-back return Mismatch. The new local
  observation remains accepted-unverified with one attempt; no visibility is
  fabricated and no automatic replay occurs despite the enabled synthetic policy.
- Explicit synthetic-age expiry retains acceptedUnverified=1 and visible=0.
  The backend's one stored row carries 15 tokens, not two 15-token observations.

This closes the previously identified changed-epoch evidence gap for the exact
pinned disposable images and observed route. It establishes truthful mismatch
and disposition behavior, not successful visibility of a second epoch. The
lifecycle ages use an injected clock; network deadlines use real timers. Three
stable samples are a bounded observation, not a permanence guarantee, a real
elapsed-day retention run, an aggregate-UI proof or a promise about another
backend/image. The receipt records owned resource cleanup; this seat performed
no service/backend probe or test rerun. `research/EPOCH-BACKEND-QUALIFICATION.md`
states these limits consistently.

## Whole-foundation acceptance follow-up — 2026-10-29

**Verdict: accept the repaired source, synthetic qualification and declared
two-record live-canary scope; hold full-goal acceptance.** No new concrete
runtime defect was found in this follow-up. Changed-epoch backend qualification
is now closed at the bounded v5 scope above; the whole-CLI quality result and
repository delivery remain open as detailed below. This section supersedes
earlier pending labels for the final retirement
installed proof and collector default, while preserving all earlier findings and
failed-run history. It is one independent panel seat's review, not a substitute
for the other seats, hosted gates or operator deployment decisions.

The inspected Beep checkout remains the owned dirty foundation worktree at
`bea57177a342284007f242a65a126c029791aea8`; the sibling Dankserver foundation
worktree supplies the Ansible sources. Source hashes, rather than HEAD alone,
bind these conclusions. `src/` and `test/` below resolve under
`packages/tooling/library/ai-metrics/`; `ops/` and `research/` under this goal;
Dankserver paths resolve in the sibling checkout.

### Current evidence and retirement qualification

- `ops/history/retirement-package-verification.json`: all 167 source/test hashes remain
  current. Full audit/docgen passed; the retained log digest was independently
  checked. The 42 final focused reclamation/retirement cases qualify the F11–F16
  fixes described in the preceding review. No already-fixed finding is reopened.
- `ops/history/retirement-live-verification.json`: the actual installed worker/frontend
  proof passed, with source stability during its run. Its 1024-page journal uses
  an 8 MiB worker file ceiling. Private maintenance includes paused create-only
  backup, occupied-slot preservation, invalid destination/body/concurrency
  refusals and stale-context refusal after restart (`:119-146`). The receipt
  explicitly says age-based expiry was **not** exercised in the installed run
  (`:144`); expiry/retirement integrity is qualified by controlled-clock package
  tests, not by pretending the live run waited for the policy's real age.
- That installed receipt's 85 Beep hashes matched when first examined. At this
  follow-up, 84 still match; only `ops/live_canary_support.py` changed for explicit
  collector-mode selection. The newer migration receipt covers that helper.
  This is an explicit evidence bridge, not a claim that all old installed inputs
  remain byte-identical. The worker/library implementation remains covered by
  the current package and installed source sets.
- The actual canary retains exactly two readable `fixture.cli.agent` and
  `fixture.desktop.agent` observations in `foundation-canary-d8b2289bc828`, with
  exact synthetic provenance/source-time metadata, two visibility receipts,
  private-content rejection and rollback preserving backend evidence
  (`retirement-live-verification.json:9-117`). It does not establish real harness
  capture. Cleanup records both owned units removed with PID 0, the collector
  removed and the independent monitor stopped (`:115-117,219-248`).
- All 24 files in `ops/history/retirement-proof-archive.json` were independently hashed
  and size-checked: 53,745,965 bytes, no mismatch. This is a retained same-host
  archive. Do not execute its deliberately tampered bundle; it is neither an
  off-device backup nor authority to replay historical data.
- `ops/history/driver-package-verification.json` has passing full package audit/docgen
  for `@beep/phoenix` and `@beep/ai-provider-cli`. Their 9 and 28 recorded source
  hashes and both log digests match. The separate whole-CLI failure is not
  concealed by these passes.

### Collector default and migration finding — bounded source closure

The destructive default is repaired. The template defaults metadata mode to
false; legacy 4318 traces retain their allowlist/batching and do not open the new
persistent trace store (`ansible/roles/monitoring/templates/otel-config.yaml.j2:1-20,52-59,109-125,148-154`).
Explicit metadata mode selects the already-reviewed bounded queue and projection
contract. Compose publishes its 4319 port only on loopback and only in that mode
(`templates/compose.yaml.j2:87-89`). The collision transform remains in the
metrics pipeline (`otel-config.yaml.j2:79-85,140-144`).

`ops/collector-migration-verification.json` records 13 monitoring tests passing
with pinned-image integration enabled and no skips. All nine Dankserver and two
Beep hashes match current files. Direct source inspection confirms that
`tests/test_otel_migration.py:73-117` sends exact synthetic identities through
legacy → metadata → legacy, requires old-route HTTP 404 during metadata mode and
compares the queue's file hashes after reversal. This is a drained synthetic
transition; separate queue tests qualify crash/replay of pending data. It does
not establish a production producer cutover.

This seat independently rendered the current metadata template with the last
canary's project/endpoint/30-second retry substitutions. Parsed configuration
equals the archived canary configuration whose SHA-256 is
`b49814316b91999f148f2d0b73f835c36be70fa4e24cab2f1588b8d7fc05ea56`.
It also rendered the current alert template in both modes: the
`beep-observation-worker` group equals the archived installed-proof rule group
in both. Therefore mode-specific collector alert gating does not invalidate the
qualified worker rules. This source/render bridge is not a fresh live canary,
production role application or cross-host transport qualification.
`research/COLLECTOR-MIGRATION.md` and the monitoring test README correctly retain
pause/drain, queue preservation, route inventory and explicit reversal duties.

### Current disposition of the thirteen normative criteria

The numbering below follows `SPEC.md:33-45`. “Qualified” means supported within
the stated foundation boundary, not completed-retained or fleet deployment.
Detailed source/test evidence from the initial audit and subsequent repairs is
retained below; the current source-bound package receipts cover those tests.

| AC | Current disposition | Evidence and practical limit |
| --- | --- | --- |
| 1. Inventory and independent denominators | Qualified for declared roots/surfaces | Typed inventory, coverage fixtures and the 28-root/seven-harness inventory distinguish capability, launch and expected-event evidence. Unknown populations remain unknown; installation is not capture. See the initial AC1 source/test references and `research/WORKSTATION-ROOT-INVENTORY.md`. |
| 2. Separate identity levels/global Codex attribution | Qualified at source/fixture boundary | Launch facts, Git/root evidence and transcript occurrence fixtures preserve separate identities without assigning the ingestion checkout to global Codex inputs. Existing IDs remain compatible; missing native/task identity is not fabricated. See initial AC2 references. |
| 3. Fair bounded discovery | Qualified for required synthetic cases | Current package coverage retains N+1 fairness, failure/retired-root handling, rotation/truncation, copies, partial tails and oversized growth. Discovery progress is separate from durable accepted offsets. The forwarder rollback proof has the limited boundary below. |
| 4. Event time and no invented duration | Qualified | Actual encoded historical/offset fixtures plus native/transcript wire decoding preserve source time. `src/native-readback.ts:219-243` enforces endpoint order, point-event shape, strict sub-microsecond representational tolerance and exact source attributes. The 870 ns live fixture demonstrates the actual rounded backend representation. |
| 5. Bounded metadata-only intake/journal | Qualified within the documented ACK boundary | Positive projection, body/decompression/admission bounds, atomic intake, verified SQLite profile, real process/resource proof and credential isolation are present. Pre-commit/pre-intake loss and downstream visibility remain separate; HTTP acceptance does not establish global coverage. |
| 6. Exclusive delivery states and recovery | Qualified for the reviewed same-epoch and changed-epoch boundaries | F1/F6 reconstruction/permanent-refusal repairs, durable query reservations, real lost-ACK/qualified replay and F11–F16 integrity/capacity repairs are accepted. Never-enrolled expired references remain separate from enrolled five-state populations. The final v5 proof above separately qualifies truthful changed-epoch Mismatch/no-replay/expiry; it does not assert visibility of the second epoch. |
| 7. Claude/native usage and Phoenix totals | Qualified for pinned synthetic conventions | Cache-exclusive Claude inputs are normalized once; inclusive OpenInference inputs and unknown/incomplete totals remain distinct. Native/reconstructed streams are not additive. Existing actual backend/API proof supports its pinned values, not all provider conventions or lifetime deduplication. The separate changed-epoch v5 proof observes one 15-token backend row after both upstream completions. |
| 8. Collision transform/render qualification | Qualified for current source and declared route | Current migration receipt and independent semantic comparison above preserve the deployed metric transform and selected metadata behavior. Legacy default safety is repaired. No production collector application is inferred. |
| 9. Queue bounds and health signals | Qualified for bounded route/source semantics | Byte/file caps, fixed refusal counters, sampled unresolved event age, source/filesystem monitoring and missing-self-metric rules are present. Actual independent scrape/stopped-worker alert reached a local simulated Alertmanager receiver (`retirement-live-verification.json:219-236`). This is not human notification delivery or installation of the optional root timer/node_exporter integration. Sample age is not fleet-oldest pending age. |
| 10. Health path, backup and exact retention reporting | Qualified at source/synthetic boundary | Managed health URL, backup failure/prior-success fixtures and exact retention policy/project assignment read-back remain supported by the earlier inspected Dankserver tests. They do not prove live backup rotation, retained production data or successful production policy mutation. |
| 11. Historical recovery hold | Satisfied as a continuing hold | No reviewed installer starts old units or reingests archives. Parent refreshed masked/inactive status; this seat's attempted read-only user-bus probe lacked bus environment, so it does not independently claim a fresh service-state check. Preserve the hold and the separate integrity/resource investigation. |
| 12. CLI/desktop-marked disposable and bounded live fixtures | Qualified for exactly the required finite scope | The retained disposable proof and final two-record live canary establish readable finite surface labels, exact metadata visibility and owned rollback. `SPEC.md:44` requires marked fixtures, not universal actual application enrollment. No unknown or excluded population is turned into a capture claim. |
| 13. Ownership, compatibility, producer identity and rollback | Qualified for held/canary policy; legacy migrations remain explicit | `research/STORAGE-OWNERSHIP.md:13-25,27-43,45-76` names custody, finite capacities, unresolved disposition and recovery boundaries. Private maintenance is installed-qualified; archives are preserved. Changed-epoch mismatch/disposition is qualified by v5 above. Legacy summary omission/overcommit refuse migration instead of deleting evidence. Off-host backup and persistent real-source enrollment remain deployment prerequisites. |

### Remaining acceptance work and holds

**Historical changed-epoch evidence gap — closed by the final v5 adjudication
above.** The original gap was not an established duplicate or false-visibility
defect. Native export preserves the original trace/span IDs
while adding epoch/history-retired attributes in later epochs
(`src/native-export.ts:161-162,182-187`). The retirement unit test re-admits the
same batch in epoch 1, but injects visibility through its fixture helper
(`test/evidence-retention.test.ts:132-187`); it does not observe how Phoenix treats
the changed metadata. Same-byte duplicate-send qualification cannot answer that.
The reconciler requires exact managed metadata before recording visibility
(`src/native-readback.ts:226-250`), and scheduler mismatch/error does not authorize
qualified replay (`src/native-schedule.ts:392-419`), which limits the failure mode.

The remaining bounded proof should send the same native identity across an
actual retirement/re-admission boundary, inspect backend cardinality and exact
epoch attributes, and reconcile both local outcome/disposition and API usage
totals. If the pinned backend keeps old attributes, require Mismatch with no new
visibility or automatic replay; if it replaces them, record that history limit;
if it duplicates/returns ambiguous evidence, retain uncertainty. This was the
requested proof scope before the v4/v5 follow-ups; the final v5 result above now
qualifies its bounded outcome.

First actual proof follow-up: `ops/epoch-backend-verification.json` and its v4 log
match the recorded fixture/verifier/template hashes. The real projector, intake,
send/read-back and retirement lifecycle records initial Visible, a new epoch
receipt with changed encoded bytes, then manual Mismatch and explicit expiry
with acceptedUnverified=1/visible=0. The inspected backend response has one row,
the original attributes and 15 tokens. This is useful actual evidence, but two
assertions need tightening before closing the entire boundary. In the v4 fixture,
the second send and scheduler tick use the same frozen wall clock
(`ops/epoch-backend-fixture.ts:173,196,215`), so elapsed=0 returns Held(query-delay)
at `src/native-schedule.ts:375-379`. Replay opt-in is also absent. Unchanged
attempts therefore does not exercise the Mismatch replay guard. Advance the
synthetic clock beyond the delays, enable the target-bound replay policy and
assert a Reconciled(Mismatch) tick plus unchanged attempts. The verifier also
needs evidence of both exporter submissions completing upstream and an empty
queue before concluding the backend retained old metadata after processing the
changed bytes; a fixed three-second wait followed by collector stop is not that
proof (`ops/verify-epoch-backend.py:72-95`). These are proof limitations, not new
runtime implementation defects. The current source already refuses replay on
Mismatch. This initial v4 assessment remains historical if a corrected receipt
is subsequently qualified.

**Whole-CLI quality is still failed, not OOM and not waived.**
`ops/whole-cli-runtime-abort-verification.json:3-20` records Bun 1.4.4 SIGABRT,
guard exit 1, no guard stop and no kernel OOM. All 1,421 source hashes and the log
digest match; the actual retained log contains the runtime abort. It does not
establish the ultimate root cause or a passing gate. Scoped CLI compiler/tests
do not replace this result. Diagnose or route the remaining checks through the
current canonical repository process, preserving an explicit failure/skip record
where policy permits; do not repeatedly launch broad jobs without new evidence.

**Repository delivery remains required.** `SPEC.md:58-62`, `GOAL.md:15-17` and
`PLAN.md:9-11` require current touched-package/Yeet/hosted readiness, panel/review
adjudication, delivery/merge evidence and reflection before completed-retained.
`AGENTS.md` makes hosted CI authoritative and permits appropriately recorded
constrained-compute handling; it does not convert the current local abort into
success. This seat neither publishes nor merges.

The held forwarder's compatibility receipt qualifies its previous implementation
file against the additive cursor table with **current dependencies** and a
synthetic database; it does not qualify a whole historical binary or historical
store. `research/FORWARDER-RECOVERY-HOLD.md:9-28` states that boundary correctly.
Do not unmask the old service, drop the cursor table, reset claim authority,
execute retained bundles or replay raw archives as a consequence of this review.

This follow-up used read-only source/test/log/archive inspection, hashing and
in-memory template rendering. It launched no tests, services, providers, backend
queries or production mutations. Only this review artifact was changed.

## Unregistered-expiry repair — final source/package review, 2026-10-29

**Current verdict: accept the bounded source/package repair for F11–F16; hold
full-goal acceptance.** No further concrete defect was found after the final
corrections. The source-bound full package receipt below qualifies this result.
The installed proof for this exact delta is pending. Earlier defect reproductions
and intermediate findings are retained below as history; this final disposition
supersedes their open labels for the reviewed source/package scope.

### Final retained qualification

`ops/history/retirement-package-verification.json` reports passed. All 167 source/test
hashes match the files inspected by this seat, and the retained full quality log
hash matches. Audit completed in 131.1 seconds and docgen in 12.0 seconds, with
exit 0 and no guard stop. The guard records 5,971,836,928 peak observed bytes and
48,905,031,680 minimum host-available bytes. The final focused v4 suite covers 42
reclamation/retirement cases; source tests were inspected directly as described
below rather than accepting only the receipt's claim.

F11/F12 are repaired for owned journals under the installed retention contract:
validated never-enrolled references can expire without fabricated enrollment,
and new receipts reserve terminal-disposition capacity. F13/F14 prevent damaged
membership/history or conflicting transcript identities from entering that
capacity escape. F15 preserves a checkable enrolled canonical ownership set
through disposal and refuses changed membership before seal. F16 removes repeated
whole-owner registration within one expiry transaction.

Legacy dispositions remain readable/restorable but cannot newly seal without the
required enrolled-ownership proof; their existing bytes are not retroactively
rewritten. Already-overcommitted standalone journals refuse retention-policy
installation without discarding pages. The test at
`test/payload-reclamation.test.ts:635-652` covers that transactional refusal.
Legacy migration, arbitrary-policy record/recovery/physical capacity, production
rollout and full repository/goal completion remain separate requirements.
`research/RETIREMENT-CAPACITY.md` states these limits. The current installed proof
is pending; prior installed receipts do not qualify these new source changes.

### F13 — P2, correction accepted: missing membership can conceal existing delivery history

The first repair classified `ledger.state(eventId) === None` as never-enrolled
without rejecting existing attempt/query/visibility evidence. `state` exits early
when the delivery-event row is absent (`src/delivery-ledger.ts:428-433`). Deleting
that row from a registered/sent event therefore left intact delivery history but
allowed expiry to create an unenrolled disposition. The initial seal orphan
check only required an attempt to have any membership, so it could retire that
contradiction. This is an integrity case, not legitimate capacity exhaustion.

The parent added event-linked attempt/visibility/query checks before expiry
(`src/payload-reclamation.ts:131-136`) and corresponding missing-event joins at
seal (`src/evidence-retention.ts:159-162`). It also rejects an absent canonical
native membership for the page's own cached registration, and absent transcript
membership for a cached registered transcript page. Those changes address the
initial reported cases in source; final regression/receipt qualification is
pending.

One remaining variant was reported: a duplicate-only native page can reference a
different canonical owner's registered-but-missing pending event. There may be
no attempt, query or visibility row to trip the new guard. Enrollment of that
owner returns its cached page count, while the duplicate page owns zero native
identities, so checking only the duplicate page's ownership summary does not
catch the contradiction (`src/payload-reclamation.ts:234-246,279-282`). Seal now
refuses it later, but the duplicate payload has already been deleted. Before
expiry, for every native accepted reference, join its canonical owner receipt to
delivery_pages and reject a missing event row if that owner was registered. A
regression should delete a pending canonical owner's event row and then attempt
to expire its duplicate-only page; both payloads and all evidence must remain.

### F14 — P2, correction accepted: an earlier capacity failure can hide a conflicting transcript identity

`registerPage` stops at the first capacity failure, before necessarily inspecting
all subsequent candidates. After the transaction rolls back, the new independent
`verifyMember` path checks each frame against existing ledger rows only
(`src/payload-reclamation.ts:124-145,218-227`). For an absent identity it cannot
detect two different frame hashes under that same occurrence ID within the page.
For example, a contradictory page ordered A, B, conflicting-A under maxEvents=1
hits capacity on B before seeing the later conflict. All rows roll back; the
independent checks then see missing A and B, and event-ID deduplication hides the
contradiction while expiry removes the page.

This is not a normal owned-reader output; it is hand-built or contradictory
stored transcript evidence. Nevertheless the stated capacity-only escape must
not turn that conflict into an unenrolled disposition. Build a bounded
occurrence-ID-to-frame-hash check over the entire retained accepted-frame
population before deletion, and refuse any unequal hash for a repeated ID.
Retain the payload, cursor and all existing delivery facts on refusal. Test the
conflict placed after the candidate that triggers capacity so the registration
short-circuit cannot supply the expected failure accidentally.

Follow-up source inspection finds the reported F13/F14 corrections present.
`src/payload-reclamation.ts:130-156` now checks native canonical owner registration
for every reference as well as orphan attempt/query/visibility evidence; the
transcript HashMap at `:232-240` checks the entire accepted-frame ID/hash
population. Tests at `test/payload-reclamation.test.ts:574-630` reproduce the
pending duplicate-owner deletion and A/B/conflicting-A cases. Own-page cached
registration checks and native seal orphan joins remain. These source changes
address the specific findings and are included in the final package receipt above.

### F15 — P2, correction accepted: deleted pending transcript membership could pass seal

The new after-expiry native owner join in `src/evidence-retention.ts:162` does not
cover reconstructed transcript events, which have no native index. Admit and
register one accepted transcript event, expire the page with pending=1, delete
its delivery-event row, then seal. There need be no attempt, query or visibility
row to trip the other orphan checks. The delivery_pages membership still exists,
the original disposition has no unenrolledReferences, and the transcript branch
at `:241-248` consequently accepts it. The later event scan finds zero events and
can retire pending/eventObservations as zero despite the retained registered
page/disposition evidence.

This gap predates the new expiry path but remains relevant to the claim that
registered state accounting survives corruption checks. Add an independently
checkable registered transcript ownership/population invariant before seal; do
not infer consistency solely from existence of a delivery_pages row. A simple
count must account correctly for deduplicated/repeated references rather than
assuming arbitrary schema-valid transcript pages contain only unique new IDs.
Add the one-pending-transcript-event corruption-after-expiry regression and
require unchanged epoch and preserved compact evidence. The current analogous
native test at `test/evidence-retention.test.ts:820-831` does not establish this
transcript property. This seat did not execute a reproduction.

### F16 — P2, correction accepted: capacity fallback repeated whole-page enrollment per event

Expiry calls enroll for its selected receipt, then calls it again for each native
event's original receipt when that owner is not disposed
(`src/payload-reclamation.ts:187,253-259`). For an oversized first native batch,
registration fails capacity and never creates its cached delivery_pages row.
All 1024 possible events can share the same owner. Each repeated registration
therefore reloads, validates and hashes the entire native batch again before
hitting the same capacity refusal (`src/delivery-ledger.ts:250-258,281-294`). The
new valid-input repair can perform roughly 1025 full registrations of that one
page, rather than one, making its work quadratic and risking repeated cooperative
maintenance timeouts under the same fixed input.

Track owner receipts attempted within the current expiry transaction, seed the
set with the selected receipt, and attempt each additional owner at most once.
Keep that cache local to the transaction so failures/retries revalidate normally.
Verify with a bounded large-page/call-count regression rather than relying on a
timing-sensitive benchmark. This is a source-derived repeated-work defect; no
large benchmark or measured timeout was run by this seat.

Final source follow-up: F15 now has canonical enrolled ownership summaries
(`src/internal/unenrolled-evidence.ts:49-63`) over ordered eventId/payloadHash rows
owned by the selected receipt. The digest binds that receipt and a distinct
domain. Both new verified and expired dispositions include the summary, even
when count=0 (`src/payload-reclamation.ts:327-349`). Seal compares count and digest
before retirement (`src/evidence-retention.ts:213-223`). Earlier dispositions
remain readable without the optional key, but sealing them refuses configuration
rather than inventing missing integrity evidence. Their bytes and logical
recovery semantics remain preserved; a qualified migration is still required.
The transcript deletion and readable-legacy-hold regression at
`test/evidence-retention.test.ts:838-883` covers the reported F15 gap.

F16 now uses a transaction-local HashSet seeded with the selected receipt
(`src/payload-reclamation.ts:190-191,262-266`). Each other undisposed owner is
attempted once; independent reference validation still runs and separate expiry
calls do not inherit the set. The test at
`test/evidence-retention.test.ts:889-926` uses 32 distinct native events over a
one-event enrollment budget and requires exactly one registration lookup plus
one cached-registration integrity lookup. The source addresses the repeated-work
finding without a timing-sensitive performance claim.

The 167 source/test hashes in the parent's frozen v3 snapshot were independently
compared and matched during this review. No further concrete defect was found in
this bounded delta. The final package receipt is qualified above; installed proof remains pending.
Neither closes the full-goal or migration boundaries.

Only this review report was edited; no implementation or tests were run by this
seat. The final package gate is distinguished from earlier intermediate passes above.

## Unregistered-page retirement adjudication — 2026-10-29

**Prior adjudication verdict: hold retirement/full-goal acceptance.** The delivery-event
capacity deadlock is a valid-input defect, now reproduced by the parent. Ordinary
native producer identity conflicts do not reproduce the claimed enrollment
conflict; those are already filtered at admission. A separate terminal-disposition
capacity cycle also exists and needs an admission or explicit rollover boundary.
This review recommends a repair but does not claim implementation or verification
of that repair.

### F11 — P1, open: accepted pages can exhaust enrollment capacity and prevent the only capacity renewal

Native admission checks retained page/byte budgets, independently of the delivery
event budget (`src/native-intake.ts:187-192`). `registerPage` checks maxEvents
while inserting candidates transactionally (`src/delivery-ledger.ts:281-301`).
Once that limit is full, a further valid admitted page cannot enroll. Even with
explicit expiry enabled and the page old enough, disposal unconditionally calls
registration (`src/payload-reclamation.ts:136-142`), so it fails before writing a
disposition. Expiring previously registered pages preserves their compact event
rows. Seal requires no retained pages (`src/evidence-retention.ts:124-126`), and
only seal clears those event rows (`:278-288`). The result is circular capacity
exhaustion; no malformed input, damaged database or forged event is needed.

The parent's new test at `test/payload-reclamation.test.ts:499-515` uses two valid
single-event native pages with maxEvents=1. The first enrolls and expires after
24 hours; the second refuses enrollment with capacity and expiry with storage,
retaining its original payload and no disposition. The mapping to storage comes
from the reclaimer's generic error wrapper (`src/payload-reclamation.ts:79-80`);
it obscures a legitimate capacity refusal but preserves the data.
`ops/history/retirement-capacity-characterization.json` records this undesired result as
`defect-reproduced`, `fixed: false`. Its four source/test hashes match current
files. This seat inspected the 14-pass focused log; that passing characterization
is evidence of the bug, not passing retirement acceptance.

A single admitted page containing more new events than maxEvents produces the
same problem from an empty ledger: enrollment rolls back all candidates, so
there is no partial enrollment to drain. The existing test at
`test/delivery-ledger.test.ts:218-226` already establishes this admission and
atomic-capacity-refusal shape. A repair must cover this case as well as a second
page arriving after the ledger fills.

### Conflict adjudication: retain the integrity boundary

For native intake, differing metadata under an existing event ID is recorded in
conflictIndices (`src/native-intake.ts:197-217`) and is not returned as a canonical
new event (`:245-270`). Registration uses only those new canonical events
(`src/delivery-ledger.ts:250-258`), and expiry excludes conflict/expired indices
from accepted references (`src/payload-reclamation.ts:150-159`). A legitimate
producer conflict therefore does not itself reach the ledger's digest-conflict
branch. `test/native-intake.test.ts:131-145` verifies that the conflicting page
has zero accepted/new candidates and preserves the original metadata. Conflict-
only pages can be registered with zero events, subject to separate disposition
capacity.

For the owned transcript reader, accepted occurrence IDs derive from generation
and byte offset; normal cursor advancement does not repeat an accepted offset,
and observed replacement/truncation/rewrite selects a new generation
(`src/transcript-page.ts:417-460,507-547`). Sweep passes the stored cursor through
read and compare-and-swap admission (`src/transcript-sweep.ts:165-186`;
`src/transcript-intake.ts:440-450`). No normal owned-reader path producing two
accepted payloads for the same occurrence was established in this review.
Schema-valid hand-built pages can supply their own occurrence IDs and cursors;
that is not a reproduction from the owned reader. Damaged indexes or forged
pages likewise do not justify a capacity escape hatch. Preserve and refuse an
actual conflicting digest or contradictory/checksum-invalid evidence; never
catch an arbitrary registration storage/conflict error and delete the page.

### Smallest honest disposition direction and required checks

1. Extend the existing explicit, paused, age-gated expiry operation to account
   for fully validated accepted references that were never enrolled, without
   allocating delivery-event slots. Validate the retained receipt, exact payload
   digest/shape, native canonical ownership/index and any existing ledger hash
   independently before choosing that path. Missing enrollment must also have
   no orphan attempt, result, query or visibility evidence. Registered references
   continue to use the current five delivery-state populations and quiet-period
   rule. A missing row is not evidence of backend Rejected or successful delivery.
2. Retain separate, clearly named unregistered-reference accounting in a
   checksummed disposition. Keep canonical enrolled event totals and all five
   state counters unchanged. Page-level references can repeat across native
   duplicate pages and must not be presented as globally unique events. Update
   the disposition population invariant explicitly, rather than silently
   treating unregistered references as enrolled pending events. Preserve legacy
   disposition interpretation and make any new encoding/version boundary clear.
3. Retain a bounded count and digest of the ordered native canonical identities
   owned by this receipt but absent from the ledger: include event ID, metadata
   payload hash and owner receipt. Validate it before payload deletion. At seal,
   recompute from retained native indexes and require the same count/digest
   before permitting that specific missing-ledger exception. This replaces the
   independent hash-consistency evidence otherwise lost when payloads disappear.
   Registered canonical identities still require the existing ledger hash
   equality. References owned by another page must not be counted again as
   canonical identities owned by this disposition.
4. Change the seal orphan checks narrowly. Currently every disposition requires
   a delivery_pages row, and every native index identity requires a matching
   delivery_events row (`src/evidence-retention.ts:153-160`). Permit absence only
   when justified by the new exact validated disposition. Do not simply remove
   either orphan check or create a fake successful registration row. A corrupt
   or missing disposition, changed index digest, or unaccounted identity must
   still hold the epoch. Reconcile separate unregistered-reference aggregates
   with page dispositions while preserving native accepted/rejected occurrence
   and transcript-frame counts.
5. Keep disposal/disposition and seal/recovery-copy transactions atomic. Logical
   restore must recover the new compact disposition and all associated native
   index facts, without promising payload restoration. Preserve original source
   files/cursors and exact expired-replay refusal. Test mixed registered states,
   never-enrolled canonical events, duplicate pages in both disposal orders,
   conflict-only pages, the oversized first batch, malformed indexes and injected
   failures/capacity exhaustion. An independent private backup remains the
   payload-recovery path; logical restore is not such a backup.

These are source-review requirements for a future repair, not new implemented
semantics. A capacity refusal can enter the explicitly validated accounting path;
an integrity refusal must continue to preserve the evidence for owned recovery.

### F12 — P2, open: compact disposition capacity can independently overcommit accepted pages

There is a second valid-input cycle at the disposition limit. With
maxDispositions=1, accept A, age/dispose A, then accept B. Intake's retained
page/byte budget allows B, but its later disposal fails at
`src/payload-reclamation.ts:219-222` because A's compact disposition consumes the
only slot. Seal cannot run while B remains. The existing test at
`test/payload-reclamation.test.ts:191-222` already follows this sequence with
backend-verified pages and asserts the refusal. An unregistered-event expiry
repair does not fix it: B can be fully enrolled and Visible.

For new admissions, reserve enough terminal-disposition capacity for every
retained receipt, counting retained pages plus existing dispositions against the
owned budget. Refuse further intake before that commitment would be exceeded,
while preserving exact receipt retries. Do not rely on maxPages alone: disposal
frees that slot before the evidence epoch is sealed. Coordinate this admission
invariant with maxRecords/recovery limits rather than weakening deletion or
checksum safeguards. Already overcommitted stores need an explicit qualified
migration/rollover/recovery route; deleting compact facts or increasing a bound
silently is not a repair. This seat identified the cycle in current source and
the existing test; it did not run a new reproduction.

Only the review report was edited. No implementation, heavy tests, services,
backend operations or historical-store changes were performed by this seat.

## Durable read-back query pacing delta review — 2026-10-29

**Prior delta verdict: accept this bounded source/package delta; hold full-goal
acceptance.** No concrete correctness, privacy or replay-safety defect was found
in the new query reservation path. This disposition covers the source and the
matching full AI metrics package receipt. The later current installed proof is
now qualified below; it is not inferred from earlier installed receipts.

### Reservation, delay and replay boundaries

- `src/native-schedule.ts:206-211,311-346` defines one replaceable reservation
  per event, with a query ordinal in 1..31, latest attempt, reservation time and
  checksum. The checksum includes the existing profile, which binds host,
  namespace, target and encoded immutable scheduling policy (`:237-242`). A
  damaged row fails closed; clock regression holds work. A changed attempt
  resets its ordinal without accepting a damaged previous row. The bounded
  exponential calculation caps at max(reconcileDelayMillis,
  maxRetryDelayMillis), with the ordinal saturating at 31.
- The reservation transaction completes at `:346` before read-back starts at
  `:394-404`. Interruption after that commit consumes a pacing interval even if
  no backend request begins. That conservative reservation is not evidence of a
  backend response. Interruption before a committed reservation cannot be
  followed by this code's network operation. The existing per-instance permit
  and deployed single-process owner remain necessary; this is not a new
  distributed scheduling or aggregate fleet-QPS limit.
- The original send delay remains before the first query (`:375-379`). Query
  delay is independent of the send-attempt ledger and cannot produce a send
  fact. Failed queries return Failed; Mismatch/Visible return reconciliation
  results. Only a fresh Missing with explicit matching-target qualification and
  minimum delay can advance to the prior permanent-refusal check, remaining
  attempt capacity, send backoff and fresh deterministic attempt ID
  (`:405-431`). The new delay does not weaken those earlier safeguards.
- The new table is created with the bounded ledger
  (`src/delivery-ledger.ts:204-208`). Its event primary key and replacement write
  prevent append-only query growth; normal creation follows registered event
  selection and state validation (`src/native-schedule.ts:353-362`). Existing
  event/database ceilings remain the storage limits. Only hashes, finite
  ordinals and timestamps are added; no source content, secret or free-form
  backend response is retained.

### Retention, restoration and compatibility

`src/internal/observation-journal-tables.ts:22` includes the new table in the
shared ownership/backup boundary. `src/internal/evidence-recovery.ts:16` includes
all five columns in the bounded, checksummed logical snapshot. Capture still
runs inside the seal transaction before deletion, and query rows are cleared
with the retired epoch (`src/evidence-retention.ts:277-289`). Restoration accepts
only the exact successor window with unchanged admission/attempt sequences and
empty current tables, then verifies the snapshot chain before committing
(`src/internal/evidence-recovery.ts:134-186`). The existing row/byte/deadline and
physical database bounds still apply; an extra recovery row can cause safe
capacity refusal rather than partial retirement.

The test at `test/evidence-retention.test.ts:430-444` injects a synthetic row with
an intentionally nonfunctional checksum, verifies removal at seal and exact
preservation after restore. It proves byte-preserving reservation recovery, not
that a restored live candidate observes a cooldown. That limitation is accepted:
seal already requires disposed payloads, and logical restore does not restore
those payloads. A scheduler-generated-row integration would strengthen coverage
but does not repair an observed correctness defect.

Forward opening adds an initially empty auxiliary table without altering existing
send/acceptance/visibility facts or the v2 schedule profile. Prior query timing
was never persisted, so an upgraded journal has no historical cooldown to
recover until its first new reservation. Older binaries reject the new table
through the strict ownership allowlist (`src/transcript-intake.ts:259-268`);
rollback is stop-and-preserve, not an in-place binary downgrade or deletion of
the auxiliary table. `research/QUERY-BACKOFF.md` and the SPEC decision now state
this boundary explicitly. No historical store migration or old-binary reopen
was performed by this review seat.

### Evidence inspected and limits

The new tests at `test/native-schedule.test.ts:600-659` exercise repeated Missing
with capped delay across factory reconstruction, failure/interruption after
reservation, no additional sends, and damaged-row refusal before query/send.
Existing qualified replay, mismatch and permanent-refusal tests remain in the
package gate. The interruption test uses Effect interruption and scheduler
reconstruction over the current SQL store; it is not a killed-process or
power-loss proof specific to query reservations.

`ops/history/query-backoff-package-verification.json` reports full package audit/docgen
success. All 165 listed source/test hashes match current files. Its quality log
hash also matches the inspected terminal log: audit 121.1 seconds, docgen 12.1
seconds, exit 0. The guard records no stop, 5,864,685,568 peak observed bytes and
49,816,064,000 minimum host-available bytes. The receipt preserves the earlier
20-pass/two-red regression and intermediate 22-pass result without calling
those the final package result.

Follow-up installed evidence: `ops/history/query-backoff-live-verification.json` reports
passed and sourceStableDuringRun=true, and all 83 source hashes match the runtime
files inspected during retirement adjudication. Its two labelled synthetic
records in project `foundation-canary-303222edde9d` acquired two local visibility
receipts. Both owned worker/frontend PIDs are zero and exact unit files removed;
the owned collector and independent health monitor stopped, with backend/queue
evidence retained. The stopped-worker alert reached the local receiver. This
qualifies the installed current artifact and bounded canary, not a new real
backend Missing/backoff or killed-process experiment. The later capacity
characterization changed a test after the full package gate; that next repair
must rerun affected verification.

Recognition latency can grow by the capped query interval plus fair traversal
and backend latency. Per-event pacing does not establish a fleet load budget or
visibility SLO; those qualifications are explicit in QUERY-BACKOFF.md. Production
rollout, full CLI/repository gates and full-goal acceptance remain held. Only this
review report was edited; this seat ran no tests, services, providers or external
operations.

## Explicit synthetic fixture-surface delta review — 2026-10-29

**Prior delta verdict: hold full-goal acceptance.** The finite opt-in fixture-label
projection and collector guards are sound at the inspected source boundary.
F9's managed-key correction and F10's timestamp/shape correction are accepted
at the inspected source boundary and supported by the current package and
rounded disposable backend and refreshed installed/live-canary receipts. No
additional concrete defect was found in this bounded delta. No real CLI or
desktop instrumentation is inferred from declared fixture labels, and the whole
CLI/repository/goal gates remain separately held.

### F9 — P2, correction accepted: ordinary records did not verify absence of fixture metadata

The initially inspected `src/native-readback.ts:89-123` optional managed-key allowlist lacked
`ai_metrics.synthetic`, `ai_metrics.fixture.surface` and
`ai_metrics.fixture.provenance`. For a labelled fixture those keys appear in the
expected encoded attributes and are requested. For an ordinary record they are
absent, so the reader does not request them (`:198-203`). The Phoenix adapter
filters returned attributes to the caller's allowlist
(`packages/drivers/phoenix/src/Phoenix.span-readback.ts:185-186`). An otherwise
matching ordinary `agent.*` record carrying unexpected fixture metadata can
therefore pass the metadata count/value comparison and acquire a Visible fact.

Add all three new managed keys to the optional allowlist, and exercise ordinary
records with each unexpected key in the read-back test. Those records must be
Mismatch without adding visibility. The collector guard cannot substitute for
this invariant because direct Phoenix delivery remains supported and the reader
claims managed-metadata equality independently of the transport route.

The current source adds all three keys at `src/native-readback.ts:90-93`. The
regression modes at `test/native-readback.test.ts:224-237` inject each unexpected
key into an otherwise matching ordinary record and require Mismatch without a
visibility fact. The source correction addresses F9; the final current test and
package results are bound below.

### F10 — P2, correction accepted: timestamp quantization contract and point-span invariants

The parent reported a failed bounded canary whose exact source start was
1793258010837194870 ns while Phoenix's standard start was
`2026-10-29T07:13:30.837195+00:00`: Phoenix rounded upward instead of truncating to
837194 microseconds. The exact source attribute was preserved. The parent traced
this to the pinned image's integer-nanoseconds → floating-point-seconds → Python
datetime conversion, cleaned up the failed owned run and retained its two
records without blind resend. Those runtime observations are attributed to the
parent; this seat did not query the live backend or inspect its container.

The reviewed correction at `src/native-readback.ts:127-138` requires stored
standard timestamps to be microsecond-aligned and uses integer arithmetic to
accept strictly less than 1000 ns difference from the original encoded endpoint.
Only its floor/ceil microsecond buckets can match; already aligned source values
must match exactly. Exact source-nanosecond attributes and all identity/metadata
comparisons remain unchanged. This is an acceptable representation contract,
with larger drift held as Mismatch rather than silently broadening tolerance.
Far-future float conversion behavior is not universally qualified by this bound.

One additional invariant was reported during source review: separate endpoint
tolerance alone can accept a fractional point span whose stored start is floored
and end is ceiled, creating a one-microsecond standard duration. It can also
accept reversed stored endpoints for a short positive interval. A deterministic
conversion of equal endpoints cannot legitimately split them, nor can ordinary
rounding reverse their order. Require stored end >= start, and require stored
start == end whenever the original encoded endpoints are equal.

The current repair implements both invariants at `src/native-readback.ts:221-225`
and includes that result in the comparison at `:238`. The split-point and
reversed-short-interval tests at `test/native-readback.test.ts:326-346` exercise
otherwise permissible endpoint buckets, and the point test also confirms that
consistently rounded equal endpoints become Visible. The tests at `:291-321`
cover upward rounding, extra precision, larger drift, changed exact nanoseconds,
aligned timestamps and second rollover. This source correction resolves the
concrete shape concern. The parent reports red reproduction followed by eight
passing read-back tests. This seat inspected the eight-test passing log at
`/tmp/foundation-review-readback-shape-green.log` and bound final evidence to the
retained current package/backend receipts below; it did not execute the tests.

### Source and initial evidence inspected

- `src/native-trace.ts:53-55,84-86,118,369-406` permits only the optional literal
  true owner policy and the finite `cli`/`desktop` labels. The producer attribute
  is ignored when policy is absent; when enabled, non-string, conflicting or
  unapproved selected values fail the span through the existing positive decoder.
  Route identity is still owner-supplied. Source event IDs remain unchanged and
  absent optional fields stay omitted from encoded metadata. The tests at
  `test/native-trace.test.ts:270-291` check disabled equivalence, omitted encoding,
  enabled labels, preserved event IDs and invalid-label rejection.
- `src/native-http.ts:272` and `src/observation-launch.ts:53,207` propagate the
  owner policy. `src/native-export.ts:166-181` emits only finite
  `fixture.<surface>.<kind>` names, the boolean synthetic marker and
  `declared_synthetic_fixture` provenance. Ordinary names/attributes remain
  unchanged. `test/native-export.test.ts:237-255` verifies the actual encoded
  attributes and names. No raw producer name, session, arbitrary label or content
  was added to the plaintext projection.
- Dank `ansible/roles/monitoring/templates/otel-config.yaml.j2:40-47` retains
  fail-closed filter error behavior, admits the finite fixture name vocabulary,
  requires matching surface/synthetic/provenance annotations and rejects fixture
  annotations on ordinary names. Its metrics pipeline still retains
  `transform/prom-label-collisions` (`:124-128`). These remain route guards,
  not an authentication or general raw-content sanitization boundary.
- The actual disposable receipt `ops/surface-label-duplicate-verification.json`
  reports nine stored spans: three native records labelled CLI/desktop and six
  reconstructed records, with nine invalid projection combinations filtered and
  repeated native submissions retaining three unique spans. The verifier checks
  exact fixture names, kinds, marker/provenance and surface
  (`ops/verify-phoenix-native-proof.py:43-47`), and the collector probe includes
  missing, unsupported and mismatched labels plus fixture keys on ordinary names
  (`ops/verify-native-collector-route.py:149-182`). The passing flag is scoped to
  that retained run, not the final reader repair or all future projections.
- `ops/live_canary_support.py:117-139,160-171` explicitly enables fixture metadata
  for its bounded route, sends exactly two synthetic CLI/desktop-labelled records,
  checks their stored names and annotations and retains
  `actualHarnessCoverage: false`. It does not claim actual application enrollment.
  The refreshed actual live-run result is not inferred merely from this code.

### Current retained evidence and remaining limits

- `ops/surface-label-source-verification.json`: all 12 listed Beep source/test/
  verifier hashes and both Dank collector/template-test hashes match current
  files. It records 19 focused projection tests and eight read-back tests.
- `ops/surface-rounded-recovery-verification.json`: the refreshed disposable
  pinned-image proof passes with three fixture-labelled native and six
  reconstructed spans, nine invalid projection combinations filtered, exact
  source nanoseconds retained and local Visible receipts. The inspected verifier
  now requires the actual 870 ns sources and upward-rounded standard timestamps
  (`ops/verify-phoenix-native-proof.py:60-65`). Qualified recovery still records
  seven native transport attempts, one dropped before upstream and six upstream
  submissions, retaining three unique native spans. Owned resources are removed.
  This is transport-drop/scheduler-reconstruction proof, not process-crash proof.
- `ops/surface-label-package-verification.json`: full AI metrics package audit
  and docgen passed (139.6/11.7 seconds); all 165 source/test hashes match. The
  guard records exit 0, no guard stop and 6,054,535,168 peak observed bytes.
- `ops/surface-label-cli-verification.json`: the two scoped CLI compiler checks
  and 29 tests passed; all 11 listed hashes match. This is not the whole CLI
  package gate. The final state records inactive/PID 0/success.

- `ops/history/surface-label-live-verification.json` is byte-identical to the retained
  `/tmp/obs-deploy-n37n8w3m/evidence.json`, reports passed and
  `sourceStableDuringRun: true`, and all 83 source hashes match current files.
  Project `foundation-canary-c04d2cf89339` contains exactly two retained synthetic
  records, `fixture.cli.agent` and `fixture.desktop.agent`, with their matching
  finite surface, boolean synthetic marker and declared-fixture provenance.
  Their standard timestamps round the 870 ns source remainders upward by 130 ns;
  exact source attributes remain intact, and both acquire local visibility
  receipts. No private content appears in the backend. The verifier explicitly
  compares local/backend event sets and pauses intake before rollback.
- That installed receipt also records both owned worker/frontend PIDs as zero
  with their exact unit files removed, the owned collector stopped/removed and
  its private queue retained, plus backend evidence preserved after rollback.
  The independent health monitor observed the stopped worker, delivered an alert
  to the disposable local receiver and stopped. This remains local alert-path
  proof, not human notification or production monitor enrollment.
- `ops/surface-label-proof-archives.json` records same-host preservation of the
  failed and passing runs, with file hashes and a do-not-run-retained-bundles
  restriction. This seat inspected the receipt, not every archived file. No
  off-host recovery or archive execution is claimed.

The earlier failed live fixture run remains evidence of the real rounding issue,
not a passing live canary; the separate source-bound successful run supersedes
that specific runtime gap. Production collector deployment, real harness
enrollment, production independent-monitor enrollment, human alert delivery,
whole-repository quality and goal closeout are not inferred from these bounded
proofs. F9 and F10 are closed for the reviewed metadata/representation contract;
previous independent-panel findings and repository-delivery gates retain their
separate dispositions.

Only this report was edited by the review seat. No tests, services, providers,
backend queries or production mutations were launched.

## Installed maintenance delta review — 2026-10-29

**Prior delta verdict: hold full-goal acceptance.** F7's hop-count evidence correction
is now qualified against the retained refreshed backend proof. The new private
maintenance API exposed F8 below; its process/target context correction is
accepted in source review and the final installed/context proof. No further
concrete defect was found in this bounded maintenance dispatch. The current
installed proof, full AI metrics package gate and scoped CLI gate now pass with
matching source fingerprints, as recorded below. Other panel findings, the whole
CLI package gate and final repository delivery/closeout remain separately open.

### F8 — P2, source correction accepted: host and salt namespace did not select one worker

The initial `src/observation-maintenance-http.ts:64-69,124` request compared only
hostId and namespaceId. The latter identifies the salt namespace, so two workers
on the same host using the same salt could accept a request intended for the
other backend/project or journal. Window/Pages/Backup/Seal needed no receipt ID;
deterministic native receipt IDs could also overlap. This contradicted the API's
claimed exact destination binding, independently of private-socket ownership.

The correction publishes a bounded private context containing host, namespace,
actual ledger target and a fresh UUID per maintenance-owner construction
(`src/observation-maintenance-http.ts:49-75,133-145`), then requires all four fields
before any POST dispatch (`:161-168`). This distinguishes even identical-policy
journals and refuses stale requests after a worker restart. The context is
explicitly not authentication or persisted journal identity. Socket ownership
still authenticates the caller; after restart the operator must explicitly
select the intended process's new context before reconciling an uncertain
operation. The test at `test/observation-worker.test.ts:523-533` checks a foreign
target and another instance with the same worker/configuration. This source
correction is accepted. The revised installed verifier also checks changed
instance identity, preserved host/namespace/target, stale-context refusal and
occupied backup preservation across a real restart
(`ops/verify-observation-deployment.py:265-284`). Source inspection alone did not
establish those assertions; the final matching installed receipt below now
confirms them, closing F8 for this process-selection boundary.

### Maintenance behavior inspected

Only the owned private socket dispatches `/maintenance`; the frontend route
allowlist still excludes it. POST admits one request without queuing, reads at
most 4096 bytes within a one-second body deadline, rejects unknown fields and
non-UTF-8 input, and uses fixed command variants and safe errors
(`src/observation-maintenance-http.ts:103-111,146-196`). GET returns only the fixed
context. The 30-second Effect operation deadline is cooperative: synchronous
SQLite work remains subject to the existing process limits, as documented by
`src/observation-backup.ts:189`. Do not describe it as a preemptive SQL deadline.

The new paused page list returns at most 32 receipt summaries, without raw source
paths or contents. Reclaim/Expire use `control.maintain`, preserving exclusive
paused/drained admission and existing age, visibility, quiet-period and atomic
disposition checks (`src/observation-worker.ts:146-162`;
`src/payload-reclamation.ts:88,180-251`). Seal/RestoreEvidence keep the existing
epoch/digest compare-and-swap and reversible transaction rules; they do not
restore physical payloads or launch claims. Four fixed backup slots contain
create-only snapshot directories. Caller-selected destinations are absent from
the request schema, and occupied or incomplete generations are not overwritten
(`src/observation-maintenance-http.ts:33-41,130-132,177-184`;
`src/observation-backup.ts:122-137,242-268`). The manifest/database remain bounded
by the journal ceiling and separate from the preserved source.

The inspected HTTP tests exercise active refusal, finite pagination, young-page
ineligibility, occupied slot preservation, age-eligible expiry, exact logical
seal/restore, wrong digest refusal and remaining paused
(`test/observation-worker.test.ts:519-579`). Earlier process/crash tests cover
snapshot partial publication and interrupted logical restore. These inspected
tests are not independent reruns by this seat. The installed verifier deliberately
labels actual age-based expiry as unexercised; simulated-age HTTP tests and
installed dispatch/backup tests are different evidence.

### F7 closure and current evidence

`ops/native-qualified-recovery-hop-verification.json` is identical to
`/tmp/foundation-qualified-recovery-hop-proof.json`. It now records seven native
transport attempts, one dropped before upstream and six upstream submissions,
with three unique native backend spans. The verifier checks the exact total proxy
request count including the six reconstructed sends
(`ops/verify-native-collector-route.py:244,267-269`). All five fingerprints in
`ops/native-qualified-recovery-hop-source.json` matched current ledger, scheduler,
scheduler tests, fixture and verifier. This closes F7 and binds the refreshed
actual-backend recovery receipt to the F6 repair, within the unchanged pinned
backend/identical-payload limitations.

The first maintenance installed receipt is an earlier snapshot. The observed
`/tmp/foundation-review-maintenance-quality-v3.log` ended with a test-source
strict-boolean diagnostic, not success. The owner corrected that expression and
completed the subsequent gate. Final evidence inspected by this seat:

- `ops/history/maintenance-installed-verification.json` is identical to
  `/tmp/obs-deploy-dnv_nm1d/evidence.json`, recorded 06:57:47 UTC. All 82 recorded
  source fingerprints match current files. It proves the actual private stalled
  body receives 408, concurrent POST receives 503, malformed/oversized input is
  refused, the public maintenance route is denied, active backup is refused,
  paused backup is created, occupied/invalid slots and arbitrary destinations
  are refused, stale context is refused after a real restart, backup contents
  survive that restart and the worker remains paused. The actual installed
  age-based expiry flag remains false; that path retains simulated-age HTTP test
  evidence rather than an implied live expiry demonstration.
- The same installed receipt refreshes actual worker scraping and stopped-worker
  alert delivery to the disposable local Alertmanager v2 receiver. The owned
  monitor and exact worker/frontend processes were stopped and their unit files
  removed. Production enrollment and human notification delivery remain unproven.
- `ops/maintenance-package-verification.json` reports full package audit/docgen
  success after F6 and F8, exit zero and no guard stop. All 165 source/test
  fingerprints matched. `ops/maintenance-cli-verification.json` reports passing
  scoped tsgo/tsrs and 29 tests; all six fingerprints matched. It explicitly
  excludes the whole CLI package gate. These are inspected retained results,
  not independent test reruns.
- `ops/maintenance-proof-archive.json` records a 53,671,277-byte same-host archive
  and explicitly marks the deliberately tampered bundle as not runnable. This
  is retained proof material, not off-device recovery or installation authority;
  this seat did not independently rehash the entire archive.

This review changed only this report and launched no services, jobs, providers
or external mutations.

## Replay, atomic pause and installed-credential delta review — 2026-10-29

**Prior delta verdict: hold full-goal acceptance.** The reviewed credential isolation,
journal sizing and atomic scanner-pause corrections are accepted within their
stated boundaries. Target-qualified replay exposed F6 below; the parent reproduced
both cases, repaired the issue and obtained twenty passing scheduler tests.
That narrow correction is accepted in source review. The full package gate
predates F6 and must be refreshed for the eventual implementation. The separate
open items in `research/PANEL-REMEDIATION.md` remain open; this delta review is not
a vote to close the full goal. A minor replay receipt hop-count label is recorded
as F7 below.

This seat inspected the current source/tests, actual-backend proof driver and
fixture, installed proof driver, and retained receipts. It performed only reads
and hash comparisons, with this report as its sole write. It ran no test job,
service, provider or backend request. Paths abbreviated `src/` and `test/` below
are in `packages/tooling/library/ai-metrics`; CLI references name their command
subdirectory under `packages/tooling/tool/cli`.

### F6 — P2, correction accepted: later permanent refusal did not stop qualified replay

The reviewed scheduler selected replay from the derived `accepted-unverified` or
`unresolved` state after a fresh Missing query and target qualification
(`src/native-schedule.ts:335-383` in the initially inspected delta).
`src/delivery-ledger.ts` intentionally lets prior acceptance or ambiguity survive
a later refusal, so the sequence Accepted/Unknown → Missing → HTTP 400 → Missing
produced a third POST, continuing to the attempt ceiling. The immutable state was
correct; it was insufficient to determine whether another transport send was
permitted. `src/delivery-response.ts:64,71-73` distinguishes retryable statuses
from permanent refusal.

The parent reproduced red for both earlier acceptance and interruption, with
eighteen existing tests green. The correction adds bounded, checksummed
`ledger.readOutcome` (`src/delivery-ledger.ts:357-368`) and checks the latest
attempt's Rejected outcome after read-back and before another send
(`src/native-schedule.ts:372-375`). Queries can still discover older successful
delivery, historical state is preserved, and no new send occurs after the
terminal refusal. The two regressions at `test/native-schedule.test.ts:563-592`
assert two POSTs, two read-backs, the refusal hold and the original
accepted-unverified/unresolved state. This seat read
`/tmp/foundation-review-terminal-refusal-green.log`: twenty scheduler tests pass
and the guarded service exits successfully. This addresses F6; it is not a fresh
full-package or actual-backend proof for the final combined implementation.

### F7 — P3, evidence correction pending: distinguish front-hop requests from upstream submissions

`ops/verify-native-collector-route.py:232` verifies at least seven proxy request
bodies during qualified recovery, including the one deliberately dropped before
upstream delivery (`:195-200`). The common receipt at `:263-266` still labels the
value six as `nativeNetworkSubmissions`. Six is the native upstream submission
count; the exercised producer-facing network has seven submissions. Rename or
split the field so the qualified-recovery receipt identifies its hop, retaining
the explicit dropped-request count. This is an evidence-label defect, not a
failure of the observed three unique backend spans or replay identity.

The parent plans to split producer-facing transport attempts, dropped-before-
upstream requests and upstream submissions, then refresh the actual-backend
receipt against the repaired scheduler. No such final replacement receipt is
claimed by this review delta.

### Accepted delta and evidence boundaries

- **Target-qualified replay:** the opt-in defaults absent, must match the actual
  target ID and enters the immutable scheduling profile
  (`src/native-schedule.ts:75-129,225-253`). Target derivation binds export endpoint,
  query origin, project and projection versions (`src/native-delivery.ts:154-168`),
  and both sender and reader reject inconsistent configuration. The scheduler
  requires fresh Missing, minimum delay, retry backoff and remaining capacity;
  query failure and mismatch do not authorize replay. The reader first validates
  the original population/digest (`src/native-readback.ts:161-173`). The
  qualification digest is explicitly an owner-supplied reference, not automatic
  validation of a receipt or permission to generalize to other backend versions,
  projects, metadata changes or evidence epochs.
- **Actual backend evidence:** `ops/native-qualified-recovery-verification.json`
  records one deliberately dropped transport request, scheduler reconstruction,
  a fresh attempt with the same payload digest and subsequent visibility. The
  fixture implements those checks at
  `test/fixtures/native-phoenix-proof.ts:202-265`. Its explicit duplicate sends at
  `:267-287`, the collector export-count check and post-stop backend enumeration
  (`ops/verify-native-collector-route.py:239-267`) support three unique native
  spans after repeated byte-identical submissions. The qualification digest
  matched the retained duplicate receipt, and the fixture fingerprint matched.
  `ops/native-qualified-recovery-source.json` bound the earlier scheduler/tests;
  those two hashes changed for F6, while the fixture and verifier still matched
  at this inspection. This is not a process-crash proof or changed-epoch proof.
- **Atomic pause:** `src/observation-control.ts:135-150` holds the same exclusive
  permit across admission closure, drain and the after-drain action;
  `src/observation-worker.ts:106-116` puts source suspension inside it. The test at
  `test/observation-control.test.ts:143-167` blocks inside suspension, checks that
  resume/maintenance refuse and normal work remains paused, then checks failure
  leaves admission closed. No further concrete race was found in this correction.
- **Credentials:** CLI `commands/AIMetrics/internal/ObservationDeployment.ts:162-186`
  uses dedicated systemd credentials and positive environment allowlists for
  persistent worker/frontend processes. CLI `internal/ObservationWorker.ts:185-236`
  validates the present credential directory, owner, names, file type/link count,
  permission and 1–4096-byte bounds, uses fatal UTF-8 decoding, rejects line/NUL
  delimiters and never falls back from an invalid credential directory to ambient
  secrets. Namespace validation occurs before opening the database. The direct
  process-fixture environment route remains explicitly separate. No new concrete
  credential privacy defect was found.
- **Installed evidence and sizing:** `ops/history/credential-health-installed-verification.json`
  records the 06:21:34 UTC installed run, exact allowed environment key sets,
  synthetic ambient secrets absent from main-process environment/argv/health,
  four malformed credentials refused before journal mutation, an optional query
  credential, independent stopped-worker alert delivery and owned cleanup.
  The verifier exercises these assertions at
  `ops/verify-observation-deployment.py:173-201,215-239`. Its six recorded direct
  source hashes matched. The optional credential test proves startup/loading and
  isolation; it is not successful authentication to an external protected backend.
  The same run refreshes the earlier journal-sizing proof: 1024 pages and an
  actual 8 MiB file limit. The renderer derives that limit from page capacity
  (`ObservationDeployment.ts:56-58,99-102,156`); the worker independently refuses
  an insufficient ceiling (`ObservationWorker.ts:150-161`).
- **Quality/retention evidence:** all 164 hashes in
  `ops/atomic-pause-package-verification.json` matched before F6, and its full
  package audit/docgen result is passing. The older replay-package receipt differed
  only in the three then-updated pause files. All four source hashes in
  `ops/credential-cli-verification.json` matched its passing scoped compiler and
  29-test run; it explicitly excludes the whole CLI package gate. The credential
  archive receipt declares a same-host, non-runnable preserved proof archive and
  does not claim off-device recovery. This seat inspected that receipt but did
  not independently rehash the entire archive.

The prior independent-health limits still apply: optional root timer and
node_exporter installation, real monitor enrollment, multiple-host coverage and
human notification delivery were not qualified by a disposable local receiver.
Installed maintenance, conflict/retirement behavior, changed-epoch adjudication,
transport migration, typed surface provenance and the other separately recorded
panel items are outside this narrow delta's accepted corrections.

**Prior verdict after the independent-health re-review: hold full acceptance
and closeout.** F1–F5, including the two follow-up F3 defects below, are addressed
for this bounded foundation. No concrete source-level finding remains from this
seat's review. The guarded AI metrics package gate now reports success. F3's
actual-worker scrape and stopped-worker alert delivery to a disposable local
receiver are qualified against the final current probe/rule files by the v4
receipt. No production monitor enrollment or human notification delivery is
inferred. The new section supersedes older provisional dispositions; original
findings remain as history. Full-goal acceptance still requires the remaining
repository quality, panel/delivery and merge/closeout evidence.

## Independent-health re-review — 2026-10-29

This seat read the independent probe, optional Ansible enrollment and unit
templates, rendered-alert test definitions, proof driver and fresh receipt, and
the corresponding runtime/source metric implementations. It launched no tests,
services or network requests and edited only this report.

**Evidence accepted at its stated boundary.** The fresh v3 run in
`/tmp/foundation-independent-health-proof-v3.log` points to
`/tmp/obs-deploy-4h6chh7d/evidence.json` (recorded 05:30:48 UTC). It records actual
installed-worker scraping, stopped-worker observation, delivery of
`BeepObservationWorkerUnavailable` to a local simulated Alertmanager v2 receiver,
and stopping the owned monitor. Both Dank source fingerprints and the Beep
verifier/support fingerprints matched the inspected files at first inspection;
the later F3b rule repair below intentionally changes that rules fingerprint.
The proof driver
reads the actual private metrics socket, queries Prometheus for the sampled
worker-up series, stops the worker, refreshes the probe while waiting for the
real rule's one-minute hold, and checks receipt of the expected alert
(`ops/observation_health_support.py:74-145`;
`ops/verify-observation-deployment.py:182-190`). It does not merely assert that an
alert rule renders. The script and rule hashes are checked again before success.

**Final source binding:** the v4 replay completed at 05:38:00 UTC and is retained
as `ops/history/independent-health-verification.json`, identical to
`/tmp/obs-deploy-5kf8m3um/evidence.json`. This seat verified the final probe SHA256
`0d00370d3e510cd9a18e8ad2b80422c5b2d82e30f8cc941f785dd9a66044ff6b`, final rule
SHA256 `8391aa8164ea4f225f3604841dea4710cc7fb913382b9f06fc52653e8f6a5e56`, and all
five recorded direct Beep source fingerprints against current files. It again
records the actual worker scrape, expected stopped-worker alert received at the
local v2 receiver, owned monitor stopped, and exact worker/frontend PIDs zero
with their unit files removed. F3 is closed for the bounded foundation health
requirement, subject to the installation and notification limits below.

The bounded observer is independently scheduled, with a five-second total probe
deadline, 32 KiB response limit, fixed metric/label allowlists, no source/journal
row reads, and atomic timestamped publication. Failed reads replace old worker
samples with worker-up zero while retaining filesystem measurements; failed
publication leaves a timestamp that the independent scraper can age. The service
has an eight-second start deadline, 64 MiB memory cap, zero swap, CPU/task/file
limits, read-only home/system and only the textfile directory writable
(Dank `monitoring/files/observation-health-snapshot.py:20-86,100-150,153-196`;
`monitoring/templates/observation-health.service.j2:4-23`). No private path,
arbitrary label, source identity or response body is published by the probe.
Configured sources calculate stale/stopped/degraded state at each health read,
independently of the delivery loop's latest outcome
(`src/observation-runtime.ts:301-343`). The alert group covers observer absence,
worker failure, runtime failure, independently expected but unconfigured sources,
source access failures, acceptance-age samples, intake refusals and journal
filesystem pressure. Enrollment remains explicitly disabled by default
(Dank `ansible/group_vars/all.yml:907-913`).

### F3a — P2, source correction accepted: a configured non-root probe identity cannot publish

Dank `ansible/roles/monitoring/tasks/main.yml:68` owns the textfile directory as
root:root with mode 0755. At discovery the new enrollment accepted a configurable
identity (`monitoring/tasks/observation-health.yml:7`), placed it in the service's
`User=` (`monitoring/templates/observation-health.service.j2:6-7`), and published directly
into that directory. `monitoring/files/observation-health-snapshot.py:153-163`
must create a temporary file before atomic replacement. Any ordinary non-root
identity therefore fails publication indefinitely even if it can connect to the
worker socket. `ReadWritePaths` does not grant Unix write permission.

The requested correction was a narrowly owned writable publication directory
exposed to the scraper, or explicit restriction to the supported root identity.
The default root worked; the defect was the accepted configuration surface.
The disposable proof uses the invoking identity and a writable temporary
directory, so it does not cover this Ansible permission boundary.

The parent chose the second correction. The current assertion at
`monitoring/tasks/observation-health.yml:7-10` requires root and reports unsupported
non-root enrollment clearly; `ansible/group_vars/all.yml:910-912` explains the
ownership requirement. This correction is accepted without expanding directory
permissions or claiming a non-root deployment was tested.

### F3b — P2, source correction accepted: a continuous lag-alert hold suppresses intermittent bounded samples

At discovery Dank `monitoring/templates/prometheus-alerts.yml.j2:254-260` required
the latest-pass accepted-age sample to remain above 300 seconds continuously for two
minutes. The scheduler skips visible/rejected events before sampling and only
visits the bounded next selection (`src/native-schedule.ts:284-290,350-374`). A
subsequent pass over retained visible events has no maximum, which the metric
renderer omits (`src/observation-runtime.ts:418-459`). One old unresolved event
among other retained pages can therefore repeatedly produce a high sample and
then an absent sample, resetting the alert's pending duration forever.

The requested correction was a bounded range observation or removal of the
continuous-duration condition, plus a promtool fixture with alternating high and
absent/zero samples. The initial test at
Dank `monitoring/tests/test_observation_health.py:115` covered only a continuously
high value. This finding did not ask for a whole-journal/fleet-oldest scan or a
new persistent event-age index.

The current rule at `monitoring/templates/prometheus-alerts.yml.j2:254-259` uses
`max_over_time(...[5m]) > 300` without a `for` duration. Its description explicitly
limits the claim to a recent sample and says the sampled event may no longer be
pending. The regression at `monitoring/tests/test_observation_health.py:116`
alternates `600 stale 0 stale 600 stale 0`; the parent reports all four Python
tests, including eleven promtool scenarios, pass. This source correction is
accepted; the final v4 replay above binds its changed rule fingerprint to the
actual scrape/alert receipt.

**Other dispositions and limits.** The new F5 regression deliberately supplies
an end-only timestamp at the exact rounding boundary and expects one millisecond
of source age (`test/native-schedule.test.ts:193-213`); the multi-event recovery
test now begins at `:219`. F2 now explicitly checks malformed/unsupported/oversize,
storage and overloaded counters (`test/native-http.test.ts:185-218,248-259`).
The parent reports its focused runs passing, and
`/tmp/foundation-review-health-quality-v7.log` plus
`ops/review-health-package-verification.json` independently document exit zero
for the guarded `@beep/repo-ai-metrics` package gate. These are inspected results,
not tests rerun by this seat. `ops/review-health-cli-verification.json` also records
successful scoped tsgo/tsrs checks plus 28 CLI tests, exit zero, no guard stop and
peak observed memory 2,530,803,712 bytes. Its scope explicitly excludes the whole
CLI package gate.

The four Python tests and their eleven promtool scenarios are parent-reported
passes; their source was inspected. The actual health proof substitutes a local
HTTP textfile bridge for node_exporter and runs the probe directly, so it does
not qualify installation of the optional root systemd timer, target permissions,
or production Prometheus routing. The existing node scrape names one same-host
target; do not infer multiple-worker coverage. The receiver explicitly simulates
Alertmanager's v2 API and sends no human notification. Source freshness, missing
root and disk-pressure alerts have synthetic rule evidence, not live production
fault injection. Broad CLI quality, final repository/panel delivery and merge
evidence remain outside the passing library gate and keep the full goal held.

## Re-review of F1, F2 and F4 — 2026-10-29

The same independent seat inspected the current scheduler, retained-page reader,
runtime health, native HTTP handler, worker composition, CLI private publication,
focused tests and `research/STORAGE-OWNERSHIP.md`. No implementation was edited
and no test/service was launched by this seat. The parent reports F1 reproduced
red before repair, then eight scheduler tests passed; its subsequent three-file
run passed 28 scheduler/runtime/HTTP tests. Those are attributed parent results,
not an independent test rerun or a completed package gate.

- **F1: source correction accepted.**
  `src/native-schedule.ts:305-322` finds the earliest original-page member of the
  retained attempt and compares the selected contiguous slice as a set. The
  original-byte digest check remains in `src/native-readback.ts:167-173`.
  `test/native-schedule.test.ts:185-203` forces non-lexical IDs, issues one
  multi-event POST and requires a later backend query without resend. This
  directly addresses the failure; no new recovery flaw was found in the repair.
- **F2: instrumentation correction accepted, with the exact boundary retained.**
  `src/native-http.ts:31-94,195-230,240-308` uses a fixed twelve-field counter
  record, atomic in-process updates, saturation at the safe integer ceiling,
  an intake-instance start timestamp and content-free response classifications.
  It counts response decisions, not transmitted replies, events, durable loss or
  lifetime totals. `src/observation-worker.ts:120` exposes read-only health, and
  CLI `internal/ObservationWorker.ts:250-263` includes it in private health and
  metrics. No unbounded labels, payload capture or journal mutation was added.
  Tests at `test/native-http.test.ts:110-139,265-275` directly assert capacity,
  partial, accepted and timeout observations. Existing malformed/overload/storage
  scenarios exercise their routes, but at re-review they do not assert those
  respective counters; add those assertions before calling counter coverage
  complete. Frontend/header rejections before the worker are outside these
  counters and must not be represented as measured intake decisions.
- **F4: ownership-policy gap closed for the present disabled/canary scope.**
  `research/STORAGE-OWNERSHIP.md:3-25` assigns the workstation UID, named server
  roles and operator disposition responsibilities and declares store bounds.
  `:27-43` owns unresolved/refused metadata and conservative expiry semantics;
  `:45-59` preserves old identities and project-producer meaning; `:61-76`
  requires deployment-specific backup/rotation/failure-domain facts before
  persistent real-source enrollment and keeps claim loss held. That meets the
  requested policy-record gap without pretending operational backup is deployed.
- **F3: partially advanced, still open.** The new sample at
  `src/native-schedule.ts:270-290,350-378` is bounded by the 32-event pass limit,
  excludes already visible/permanently rejected events, samples before each
  operation, and drops partial observations on deadline. The runtime labels
  sampled maxima as pass observations rather than journal/fleet-oldest age
  (`src/observation-runtime.ts:418-459`). Missing and future timestamps remain
  distinct, and all-negative samples omit maxima rather than emitting zero.
  This is a defensible bounded sample, subject to F5. Independent worker/source
  availability, journal-filesystem alerts and alert-delivery proof are still open.

### F5 — P3: native source-age extraction rounds nanoseconds and ignores a known end-only endpoint

**Source correction observed; new boundary regression verification pending.**

In the initially re-reviewed `src/internal/observation-export-reader.ts:145-154`, native
source time is `Math.floor(Number(nano) / 1_000_000)` and selects only start time.
The floating-point conversion happens before reducing precision. A read-only
numeric check reproduced:

| Source nanoseconds | Current milliseconds | Exact truncated milliseconds |
| --- | ---: | ---: |
| `1793000000000999999` | 1793000000001 | 1793000000000 |
| `18446744073708999999` | 18446744073709 | 18446744073708 |

Use integer division before converting the reduced, safely representable value,
for example `Number(BigInt(nano) / 1000000n)`, so a one-millisecond age/clock
classification does not depend on number rounding. Also use the same start-or-end
choice as `src/native-export.ts:156-159`: an end-only native record already has
`time_basis=source_event`, but the new helper currently calls its source time
unknown. Alternatively, explicitly change the metric contract to source-start age;
that is not how the current generic source-age help and unknown counter read.
Qualify the exact fractional boundary and end-only timestamp with focused tests.
This does not affect encoded OTLP timestamps or the durable receipt identities.

After the report to the orchestrator, this seat observed both repairs at
`src/internal/observation-export-reader.ts:148-149`: start-or-end selection and
integer nanosecond division before conversion to number. The revised arithmetic
and known/unknown choice address the finding. A new focused test result for these
two cases was not yet available to this seat; the previously reported 28-test run
predates this adjustment.

## Review authority and boundaries

- Separate native review seat, assigned `review.panel`, `gpt-6-astra`, `xhigh` by
  the parent. Repository rule: `AGENTS.md:53-59`. The launch metadata is owned by
  the parent/native collaboration record; this document does not invent a CLI argv.
- Beep worktree:
  `/home/elpresidank/YeeBois/projects/beep-effect-worktrees/agent-observability-foundation`,
  HEAD `bea57177a342284007f242a65a126c029791aea8`, with substantial owned dirty work.
- Dankserver worktree:
  `/home/elpresidank/YeeBois/projects/dankserver-worktrees/agent-observability-foundation`,
  HEAD `33d932c7abfc132b0ced363f77cb1a0fe43da493`, also dirty.
- Read both AGENTS files, SPEC, GOAL and PLAN. Followed targeted live-source
  discovery. Inspected source, tests, verifier scripts and selected receipts;
  compared selected receipt source hashes to current files.
- No source edits, tests that create files, provider launches, service changes,
  network mutations or deployment runs were performed by this seat. The sole
  write is this report. No raw transcripts, credentials or historical stores
  were opened. Tests below are inspected test coverage, not independently rerun
passing tests.
- The tree changed concurrently as the orchestrator addressed reported findings.
  Line references identify the inspected implementation; final review must bind
  the completed source and relevant verification, not just the unchanged HEAD.
- Scope is the 13 normative bullets at `SPEC.md:33-45`. Universal real-harness
  enrollment is **not** a completion requirement. Unknown populations are permitted
  (`SPEC.md:22`), and AC12 asks for CLI/desktop-marked fixtures plus a bounded live
  route (`SPEC.md:44`), not proof that every real session was captured.

## Initial findings retained for review history

### F1 — P2: recovery of a retained multi-event attempt confuses a sorted set with wire order

**Original defect confirmed by source inspection; repair observed, verification pending.**

`packages/tooling/library/ai-metrics/src/native-delivery.ts:214-226` constructs the
body and event IDs from the selected page slice in source order. Public sends
support multiple events. `src/delivery-ledger.ts:305-306` then sorts the stored
attempt's event IDs lexically. The original `src/native-schedule.ts:249-255`
located `attempt.eventIds[0]` in the page and required the next IDs to equal the
sorted array in order. This is not a valid reconstruction of the request.

For an accepted or ambiguous request whose page order is `[B, A]`, the persisted
attempt is `[A, B]`. Recovery starts at page offset 1, obtains only `[A]`, and
returns a storage failure before any backend query. With longer permutations it
also fails the positional comparison. Repeated cadence visits cannot repair it;
the event stays accepted-unverified/unresolved even when the backend has it.
The current autonomous single-event send path is unaffected, which explains why
the earlier scheduler tests did not detect it.

After this was reported, the orchestrator changed `src/native-schedule.ts:249-258`
to select the earliest source member and compare the contiguous slice as an ID
set. `src/native-readback.ts:167-173` still checks the rebuilt payload digest and
population, so the source-order fix does not weaken byte matching. A new test at
`test/native-schedule.test.ts:141-159` deliberately asserts non-lexical page order,
sends five events once and expects one backend read without another POST after
scheduler reconstruction. That is an appropriate regression. Require its passing
result and the touched-package gate before closing F1. Keep the original finding
history rather than treating the earlier green scheduler receipt as proof of this
case.

### F2 — P2: native intake refusal is invisible to worker health

**Open in the inspected source.**

`packages/tooling/library/ai-metrics/src/native-http.ts:177-189` maps body failures,
projection failures, expired references, journal capacity/storage failures and
admission overflow directly to responses. It records no bounded health observation
or refusal counter. `src/observation-runtime.ts:157-174` derives unhealthy status
only from downstream delivery-pass outcomes; the renderer at `:389-414` publishes
retained counts and delivery-pass gauges, not intake refusals.

A journal full of already-visible retained records can therefore refuse every
new POST with 503 while its delivery loop remains active. The collector alerts
cannot detect these refusals: rejected requests never reach that collector.
This leaves AC9's refusal signal incomplete even if the downstream queue alerts
are all correct.

Add bounded process-lifetime refusal observations/counters with fixed reasons and
explicit restart semantics, expose them on the private health/metrics surface,
and qualify capacity, overload, malformed/oversized body and storage failure
cases. Do not log rejected bodies or use caller strings as labels. The existing
`test/native-http.test.ts` capacity and concurrency cases are suitable extensions.
Durable producer-loss accounting is a different boundary and should remain
explicitly unknown where the producer cannot supply it.

### F3 — acceptance evidence: replacement-worker monitoring is not independently qualified

**AC9 remains open; the parent is already addressing this gap.**

The reviewed runtime reports cycle freshness and selected delivery outcomes, and
source health reports traversal counts. Neither is source-event lag:
`src/observation-runtime.ts:271-297,366-418` and
`src/observation-source-health.ts:145-228`.
The dankserver queue-backlog alert expressly measures continuous queue occupancy,
not age of an event (`ansible/roles/monitoring/templates/prometheus-alerts.yml.j2:148-155`).

The actual worker exposes health/metrics only on the private Unix socket
(`packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationWorker.ts:249-257`),
while the rendered frontend permits only POST traces and returns 404 for other
paths (`internal/ObservationDeployment.ts:190-224`). This isolation is good, but
there is no reviewed independently running consumer/alert-delivery proof for this
worker. A process that has stopped cannot update its own health response.
`research/RUNTIME-HEALTH.md` and `research/OBSERVATION-DEPLOYMENT.md` correctly
acknowledge this remaining work.

Qualify a bounded independent observer of the declared route, including stopped
worker, stale timestamp, missing metrics and missing declared source, and state
who receives/owns the resulting alert. Include a measured event-age signal with
known/unknown/clock-regression semantics; a bounded pass sample must be labelled
as such, not fleet-oldest age. Disk-pressure evidence must address the filesystem
that owns the replacement journal as well as the dankserver collector queue.
This requires a declared-route proof, not broad fleet enrollment or release of
the historical hold.

### F4 — acceptance evidence: storage/disposition ownership is still deferred

**AC13 is partial.** Privacy projection, epoch-scoped compatibility, recovery
mechanics and tested canary rollback are present. The packet still explicitly
defers backup owner, generation/capacity limits and storage failure-domain policy
(`research/CLAIM-STORE-DISASTER-REHEARSAL.md:62-64`;
`research/PHYSICAL-BACKUP.md:7`). The installed units intentionally have finite
lifetimes, and no recurring maintenance responsibility follows from their render.

Before declaring the foundation complete, publish a concrete owner/policy record
for the declared foundation route: journal and collector queue, unresolved or
permanently rejected events, explicit expiry, compact evidence, physical backup,
and the independent launch-claim store. Record who may dispose or release a hold,
the retained evidence and capacity limits, and the rollback/reconciliation steps.
It is legitimate to keep real-source enrollment disabled. A clear disabled/held
policy is preferable to silently relying on library proof defaults. This finding
does not require inventing automatic claim-store restoration or performing a
production deployment merely to complete documentation.

## Initial normative acceptance audit

The following table preserves the **initial** audit snapshot and evidence.
“Supported” means inspected source/tests and applicable captured evidence support
the criterion's declared scope; it is not an independent fresh test run or
repository-delivery approval. The current re-review above supersedes all initial
open/partial dispositions: AC6's recovery defect is repaired and verified, AC9's
bounded health implementation and local alert proof are qualified, and AC13's
policy gap is closed for the disabled/canary scope. Their operational limits and
the full-goal hold remain explicit in the current verdict.

In the table, `src/` and `test/` resolve under
`packages/tooling/library/ai-metrics/`; `research/` and `ops/` resolve under
`goals/agent-observability-foundation/`. Dankserver `phoenix/`, `phoenix_backup/`
and monitoring template/test references resolve under `ansible/roles/` in the
sibling worktree named above.

| AC | Review result | Source and evidence inspected |
| --- | --- | --- |
| 1. Typed inventory and independent denominators | Supported for the declared population | `src/observation-inventory.ts:87-108,136-146,175-217` separates enumerated/unknown populations, capabilities, exclusions and heartbeat; `test/observation-inventory.test.ts:66-230` exercises separation, host binding and distinct states. `test/observation-coverage.test.ts:59-161` checks independent expected IDs, partial backend queries and route mismatch. `research/WORKSTATION-ROOT-INVENTORY.md` publishes 28 declared roots and seven harness entries with unknown capability/activity populations. Its receipt's six source hashes matched during review. Broader unknown roots are not fabricated zeroes. |
| 2. Separate identity levels and global Codex attribution | Supported at the typed/fixture boundary | `src/observation-launch-facts.ts:31-64` keeps repository/clone/worktree/task/attempt, launch/process and source session distinct; `src/transcript-page.ts:302-357,401-460` separates session/message/content/file occurrence evidence. `test/git-root-evidence.test.ts:67-136` distinguishes linked worktrees from separate clones. `test/ingest.test.ts:1344` checks global transcripts have no verified repository identity; `:2468-2486` checks additive source-root compatibility. No invented native task/provider identity is emitted by `src/transcript-export.ts:75,132-158`. |
| 3. Fair bounded incremental discovery | Supported for the stated synthetic cases | `src/transcript-page.ts:373-553` uses fixed page/line/frame budgets, pinned handles, anchors, explicit resets and partial-tail preservation. `test/transcript-page.test.ts:56-271` covers UTF-8/partial lines, rotation/truncation, copies, repeated records, oversized growth and mutation. `test/transcript-sweep.test.ts:49-132` covers N+1 fairness, capacity refusal and retired roots. `test/transcript-discovery.test.ts:139-190,258-285` covers real permissions, symlinks, bounded traversal and persistent partial/backlog evidence. Anchors explicitly do not prove absence of every possible unobserved rewrite. |
| 4. Actual encoded event time and no invented duration | Supported | `src/internal/source-event-time.ts:62-82` validates calendar/time-zone/nanosecond bounds. `src/native-export.ts:153-189` preserves source endpoints and labels fallback points; `src/transcript-export.ts:104-142` emits point observations with unknown duration. `test/ingest.test.ts:2860-2901` sends 1,200 records through the real protobuf exporter, alternating equivalent 2020 timestamps with differing offsets, and checks actual wire fields 7/8 across chunks. Native/transcript export tests independently decode wire bytes and check missing timing, cache data and privacy. |
| 5. Bounded metadata-only native intake and acknowledgment | Supported within the documented hop boundary | `src/native-trace.ts:96-120,322-430` positively projects bounded data; `src/native-http.ts:145-187` limits a single admission, body bytes/decompression and timeout, with 200 only after `acceptBatch`. `src/native-intake.ts:147-241` commits metadata/index/receipt atomically. `src/transcript-intake.ts:249-280` refuses foreign state and verifies the owned SQLite profile. Native HTTP/socket/process tests and `research/NATIVE-INTAKE-NOTES.md` distinguish producer pre-intake loss, local commit and backend visibility. No raw-payload persistence was found in the new path. |
| 6. Exclusive delivery state, append-only facts and recovery | Partial: F1 regression needs passing verification | `src/delivery-ledger.ts:301-403,408-475` has single-use reservations, immutable outcome/visibility facts and one derived state. `test/delivery-ledger.test.ts:126-300`, delivery crash tests, native sender crash tests and reclamation/retirement tests cover partial success, ambiguity, later refusal, restart, capacity and atomic disposition. F1 exposed the gap between correct receipt facts and scheduled multi-event recovery. The observed repair preserves original wire order and the read-back digest check. |
| 7. Claude/native usage and Phoenix reconciliation | Supported for pinned synthetic conventions | `src/native-export.ts:101-144` adds Claude-exclusive cache categories once, treats OpenInference prompt as inclusive, omits standard totals on non-LLM/reconstructed records and preserves unknowns. `test/native-export.test.ts:112-208` covers complete/incomplete/cache/overflow cases. `ops/verify-phoenix-native-proof.py:40-61,76-101,106-164` checks exact stored values, distinct streams, non-additivity and actual GraphQL aggregate semantics. The documented UI/API subtotal differs from complete-record totals by design; unknown cost is not a measured zero. No generic proxy-provider inference was found. |
| 8. Preserve collision transform and qualify render | Supported for source and isolated rollout | Dankserver `ansible/roles/monitoring/templates/otel-config.yaml.j2:61-70,122-132` keeps the collision transform on metrics, separates projected traces and removes asynchronous trace batching before persistence. `tests/test_otel_config.py:67-85` checks render order and pinned collector behavior. Live-canary verifier renders that owned template with declared project/endpoint/retry overrides and validates exact-image limits. No production collector rollout is claimed. |
| 9. Queue bounds and complete health signals | Open: F2 and F3 | Collector queue is byte bounded with fsync, no silent recreation and a physical cap (`otel-config.yaml.j2:1-12,92-108`); queue crash/capacity tests exist. Collector unavailable/missing instrumentation/refusal/export/disk alerts are present (`prometheus-alerts.yml.j2:117-190`). Worker intake-refusal observation, measured event-age semantics and independent worker/source/alert-delivery evidence remain incomplete in this snapshot. |
| 10. Health path, backup reporting and exact retention | Supported for source and synthetic qualification | Phoenix task uses the configured managed health URL (`ansible/roles/phoenix/tasks/main.yml:139-148`). `phoenix_backup/tests/test_backup_metrics.py:77-105` covers restart failure, stale healthy endpoint, publication failure and prior-success preservation. `phoenix/files/reconcile-retention.py:66-127` checks exact policy ID/name/schedule/type, complete bounded project enumeration and assignment, then fresh read-back; `phoenix/tests/test_retention.py:87-185` tests unrelated first policy, drift, partial/error replies and lost mutation acknowledgments. Live retention mutation is not inferred from these tests. |
| 11. Preserve historical recovery hold | Supported by retained evidence; not live re-probed by this seat | The new installer/render path neither names nor starts old units; the worker is separately owned and starts paused. `research/LIVE-CANARY.md` records the old forwarder/timer as masked/inactive after bounded cleanup. No reviewed change performs raw archive reingestion or automatic release. The full resource-integrity investigation is not replaced by the canary; keep the hold. |
| 12. CLI/desktop-marked fixture and bounded live canary with rollback | Supported for the exact limited route | `ops/live_canary_support.py:127-175` creates exactly two synthetic CLI/desktop-labelled sessions, POSTs once, checks two exact local/backend event sets and visibility facts; `:177-214` pauses, proves rejection, removes owned collector and verifies backend evidence survives. `ops/verify-observation-deployment.py:141-187` checks private route denial, actual PID/socket ownership, limits, dependent stop and tamper refusal. `ops/history/live-canary-installed-verification.json` contains two stored records and finite cleanup; its five direct source hashes matched during review. Disposable route/worker fixtures provide the earlier stage. These labels are explicitly not real application instrumentation. |
| 13. Privacy/retention/dead-letter ownership, compatibility, producers and rollback | Partial: F4 | Positive projection, immutable dispositions, explicit epoch-limited dedupe and latest-retirement recovery are implemented. `test/observation-backup.test.ts:100-215` and process fixtures test independent restoration and foreign/damaged-state refusal. Claim storage remains separate from collector restore (`src/observation-launch-claims.ts:305-319,377-412`); `research/CLAIM-STORE-DISASTER-REHEARSAL.md:50-64` requires hold after its loss. `research/LIVE-PHOENIX-PROJECTS.md` names producer contracts and preserves legacy projects. Canary rollback is proven. Concrete ongoing ownership/disposition policy is still deferred. |

## Evidence limitations and closeout requirements

The live-canary receipt fingerprints only five direct source files, not the
transitive worker source closure. It therefore supports the recorded built bundle
and that run; it does not automatically qualify later scheduler, intake or runtime
changes. The older native-scheduling, runtime-health and reconstructed-delivery
receipts contain source hashes that now differ from this evolving tree. This is
expected in an active packet, but those receipts cannot be cited as current full
package proof. The claim-store disaster receipt's 28 recorded source hashes and
the root-probe receipt's six hashes matched when checked.

No independent rerun, fresh backend request, production configuration comparison,
or current systemd hold probe was performed by this seat. Captured live evidence
was assessed against the verifier and implementation rather than accepted on its
`passed` flag alone. No new production-canary repetition is required merely for
this report; select regression and runtime checks according to actual changed
boundaries and record any coverage limitation honestly.

The whole CLI package gate and any other required remaining package gates, final
panel disposition, exact-head hosted/review
delivery and merge evidence remain required by `SPEC.md:58-62`, `GOAL.md:15-17`
and `PLAN.md:9-11`. A passing bounded canary or resolution of F1 alone cannot mark
the packet completed-retained. Record remaining disabled routes and unknown
populations explicitly; do not expand this foundation into universal enrollment
to satisfy a requirement the SPEC does not contain.
