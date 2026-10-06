# Run 4 carried-rows docket

Run `orun-2026-10-06T15:51:01Z`, ontology `beep-ci-ops`. Advisory: the orchestrator rules at sitting 2. Machine-readable twin: `carried-clusters.yaml` (same directory). Prior index `runs/orun-2026-09-10T02:10:52Z.index.yaml`, sha256 `b9c140ccd31b`.

## Summary

- 138 carried rows: 91 source and 47 prose observations; 84 live (C(i) 14, C(ii) 2, C(iii) 68) and 54 carried run-2 rows (C(iv)).
- Recommendation: all 138 stay `unresolved` with fresh `needed_evidence` and `since: 2026-10-06`. None is mapped, proposed or retired.
- 48 rows sit on duties that need a new Must/Should CQ; each names the missing decision: "a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009".
- 38 distinct prior duties across 25 non-empty clusters; three frame clusters are empty and kept for the frame.
- No re-clustering. No run-4 source observation re-observes a prior chain (zero shared nonce or attemptId), and no run-4 analysis cites a prior id. Where run-4 records do bear on a cluster, the evidence is in that cluster's fresh text, not in a new grouping.
- Retirement candidates the sitting may want to revisit, each rejected below for now: `recovery-durations` (re-identification as so-8f99dd008608), `comparison-operand-binding` with the freshness duty (run-4 bookkeeping reading), `governing-specification-comparison` (contract says diagnostic only), and the origin-block rows (per-origin lock retired at #929).

## What changed on the run-4 surface

- **Proof ledgers are on record.** run4-ledger supplies writer-issued `proof-fact/v1` facts and shadows. This undoes the zero-ledger premise behind Ruling 17's issuance duties. Copy, correction (C4.2 unchecked) and custody are still absent.
- **Organic evictions.** Two lease evictions (so-860cff0d673e, so-a9ed1352e2bc) and one ticket eviction (so-29a5ac8607a2), each with its own enqueue row; the protocol stanza is `yeet-admission-protocol/v2` with `eviction=on` (so-a815a77c32ca). The lease evictions sit on one checkout about nine hours apart under new nonces. Their heartbeat-to-eviction gaps are about 4 s and about 30 min under the same reason.
- **Not present anywhere on the surface:** `blockedOnOriginAtMillis`, a capacity stamp or `capacityAtAdmissionTokens`, lock-file or proof-lock records, a package graph, a QA run, a checkout-binding pin, and any two-emission journal duplicate.
- **The S7 contract was amended (section 8).** The frozen replay report is never re-rendered, live replay evidence goes to a separate report that no run-4 observation transcribes, and same-checkout skips are a diagnostic attribution that is never modelled.

## C(i) ov-token-charge-removal (3 rows)

*Inferred token-charge removal in the frozen S7 replay.*

**Run 4 shows.** Run 4 shows what an observed reaping looks like (two organic lease evictions with their own admit instant, charge, last heartbeat and eviction instant, and the protocol stanza's eviction switch), but neither chain is the nonce the frozen replay infers, and the contract now freezes that report and routes replay evidence to a live report that no run-4 observation transcribes.

**Recommendation.** `unresolved` for all 3 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire the three rows as superseded by the W5 live replay. Rejected: the live-replay report is not on the run-4 observation surface (only the contract sentence po-a4d81c76e170 points to it), so supersession cannot be shown by an observation id.

**Sitting decision.** Whether the inferred-eviction duty stays bound to the frozen S6 snapshot (re-park as written here), or is moved to the live-replay report, which would need a transcription lane before any row can retire.

- Duty `ov-token-charge-removal-d1` (3 rows; prior text sha256 `3d2dc0172c14`)
  - Fresh needed evidence: Run 4 checked its admission surface for the eviction the frozen S6 replay infers. The run4-fleet chains carry two organic lease evictions, each with its own admit instant, charge (weightTokens=5), last heartbeat and evictedAtMillis under reason owner-dead-or-reused (so-860cff0d673e, so-a9ed1352e2bc), and the protocol stanza sets eviction=on (so-a815a77c32ca). Neither chain is the nonce the frozen report infers, and the S7 contract now freezes that report and routes replay evidence to a live report (po-a4d81c76e170) that no run-4 observation transcribes. Still needed: the S6 snapshot journal row, or a transcribed live-replay row, that records the inferred eviction's nonce, grant and instant, so the removed charge rests on an observed reaping rather than on active-count arithmetic.
  - Consulted: `so:sha256:860cff0d673e93aaa9ec8db4d85fe43cfdd89d22b92e5ba29966346fee8a35a1`, `so:sha256:a9ed1352e2bca5c2c3ca9f5bff72e936dd668a90cc4f1842ba3512cf9dd29020`, `so:sha256:6f5b7aebafecd74f1991f241f2ab447da364d854ef9a8f3d6a8352a532a8dcf8`, `so:sha256:29a5ac8607a2204f5c7518e009834a017dbc947407f1c9430c0b87119c33d677`, `so:sha256:a815a77c32ca00312a65d7b9c83e4bd0fc2a08938f4a1203e6072e1ab1fccefa`, `po:sha256:a4d81c76e170bb1692ab847b24189cf548ae5939ecf5ef3965aa3aefe0fcb792`, `dh:vfy-admission-termination:001`, `dh:vfy-seat-grant:001`
  - Rows: `po:sha256:519764a98f511e5f2137e8eb2d6b072d92d27b62a4417db97040359034bb3282`, `po:sha256:a3b740b147b88dd94b092bee660c397cabadbbed2f35ddd14b6347c6ccb2f3fe`, `po:sha256:f41f8934b51e0e14a0344efa0b46898ea051035f811e3cee5e8de69c1bf43e2a`

## C(i) seat-grant-organic-chains (1 row)

*Synthetic SeatGrant reading and organic renewal/transfer chains.*

**Run 4 shows.** Run 4 replaces the synthetic reading with organic chains (two lease evictions and one ticket eviction at the pin), but none shows a renewal or a transfer, and the holder is carried only by a capture surrogate.

**Recommendation.** `unresolved` for the row, with fresh needed evidence per duty below.

**Rejected alternative.** Retire the synthetic row because organic eviction chains now exist. Rejected: the withdrawal receipt names renewal/transfer continuity joined to an independently identified holder, and fa:vfy-seat-grant:001 is explicitly deferred on exactly that missing chain.

**Sitting decision.** Confirm that organic eviction alone does not discharge the receipt, and that the run-4 SeatGrant deferral and this row share one named chain requirement.

- Duty `seat-grant-organic-chains-d1` (1 row; prior text sha256 `a8d94efade56`)
  - Fresh needed evidence: Run 4 checked the organic run4-fleet chains against the synthetic SeatGrant reading. It has two organic lease evictions and one ticket eviction (so-860cff0d673e, so-a9ed1352e2bc, so-29a5ac8607a2), and the two lease chains sit on one checkout about nine hours apart under new nonces, which reads as two grants. No chain shows a renewal or a transfer, the holder is carried only by the capture surrogate ownerRef (dh:vfy-owning-agent:001), and fa:vfy-seat-grant:001 is deferred on the same gap. Still needed: an organic renewal or transfer chain that keeps or moves one admission, joined to a holder identified by something other than a capture surrogate.
  - Consulted: `so:sha256:860cff0d673e93aaa9ec8db4d85fe43cfdd89d22b92e5ba29966346fee8a35a1`, `so:sha256:a9ed1352e2bca5c2c3ca9f5bff72e936dd668a90cc4f1842ba3512cf9dd29020`, `so:sha256:29a5ac8607a2204f5c7518e009834a017dbc947407f1c9430c0b87119c33d677`, `dh:vfy-seat-grant:001`, `fa:vfy-seat-grant:001`, `dh:vfy-owning-agent:001`, `otp:vfy-seat-grant:001`
  - Rows: `so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f`

## C(i) recovery-durations (2 rows)

*Recovery detection durations without execution boundaries.*

**Run 4 shows.** Run 4 re-observes the same detection entry (same detectedAt, policy, task and both durations) as so-8f99dd008608, but no run-4 record gives either measured run its own start and end.

**Recommendation.** `unresolved` for all 2 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire both rows by re-identification as so-8f99dd008608, as run 3 did for the failure-signature rows. Rejected: dh:vfy-flake-detection:001 parks that observation on policy recurrence, not on execution boundaries, so re-identification would drop the CQ-007/CQ-013 duration duty.

**Sitting decision.** Re-identify only if the run-4 index row for so-8f99dd008608 also carries the boundary duty; otherwise keep these two rows as the duty's carrier.

- Duty `recovery-durations-d1` (2 rows; prior text sha256 `9a233b8c5b35`)
  - Fresh needed evidence: Run 4 re-observes this detection entry unchanged as so-8f99dd008608 (same detectedAt, policy, task and both durations), and dh:vfy-flake-detection:001 parks it on whether the policy names a recurring signature. No run-4 record gives the standalone run or the lane rerun its own start and end; fa:vfy-lane-execution:001 reads durationMs as a per-lane wall measure, not a bounded interval. Still needed: start and end instants for each measured run, joined to the detection, task, lane and attempt, before any complete recovery duration is derived; CQ-007 and CQ-013 stay unanswerable from these two values.
  - Consulted: `so:sha256:8f99dd0086080f972c55de23dc0457bea7fb782bf92c2ef41686163dbc03ebbc`, `dh:vfy-flake-detection:001`, `dh:vfy-lane-execution:001`, `fa:vfy-lane-execution:001`
  - Rows: `so:sha256:37968f126c464470a069ac2051cb358a0a29720dd49df7256625cb4d17bfa2c6`, `so:sha256:928e7ce7acb4292bbd03703746cd347b6fd0aeeb2c144ee33188512f3ff91939`

## C(i) assertion-boundary (2 rows)

*Termination notices versus attempt boundaries.*

**Run 4 shows.** Run 4 carries no synthetic corpus; its only attempt-terminated notice is organic and carries a reason and a recording instant but no start or admission join.

**Recommendation.** `unresolved` for all 2 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire the two synthetic notices because run 4 dropped the synthetic corpus. Rejected: the duty is about notice-versus-attempt boundaries, which the organic notice leaves just as open.

**Sitting decision.** Keep the duty and accept that it now has an organic carrier (so-f8f678d23c44) for the next capture to join to an attempt start.

- Duty `assertion-boundary-d1` (2 rows; prior text sha256 `60f999a131ff`)
  - Fresh needed evidence: Run 4 has no synthetic corpus. Its one attempt-terminated notice is organic (so-f8f678d23c44, reason=legacy-unowned-start) and, like the synthetic pair, carries only a recording instant; the attempt-finished verdict so-ca8b3f90e57c shows what a bounded attempt looks like, and the KPI law now counts a terminated attempt as red (po-fd56d2b008d1). No terminated notice is joined to its attempt start or admission. Still needed: a terminated attempt whose start row and admission chain are captured beside the notice, so the notice's recording instant can be kept apart from the attempt's end and from any queue interval.
  - Consulted: `so:sha256:f8f678d23c44ef0e6bd800f79b8b2160f75efc9ce296b64d362d6a0b3994e200`, `so:sha256:ca8b3f90e57c22461d21f2b3bf2dad01149119aa674f540e81317a908f3f0610`, `po:sha256:fd56d2b008d116a7298306590441fe49482be56357eb1f17166d6af2191cbf7e`, `dh:vfy-verification-attempt:001`
  - Rows: `so:sha256:650d8047f7efde8b68d19380b2c6229f038cc3c6c0290f1045d4feaca7b71a98`, `so:sha256:68c2cc4f0ebf9f6acb48375aa66da02ca62db1610e969434dc8e714502ef2d1f`

## C(i) checkout-cache-binding (2 rows)

*Checkout-cache binding identity experiment.*

**Run 4 shows.** Run 4 has no checkout-binding pin; the ledger shows cross-origin would-reuse hits that were never realized, and the checkout, cache-epoch and task-input hypotheses stay deferred or null.

**Recommendation.** `unresolved` for all 2 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire because CQ-015 needs only Checkout and SharedCache, not a binding object. Rejected: the withdrawal receipt keeps the class withdrawn pending the experiment, and the rows are its evidence carriers, not proposals.

**Sitting decision.** Record the CQ barrier as the binding row's named missing decision, beside the still-unrun same-cache experiment.

- Duty `checkout-cache-binding-d1` (2 rows; prior text sha256 `9d8e9ddd790d`; CQ barrier)
  - Fresh needed evidence: Run 4 carries no checkout-binding pin. Its ledger records cross-origin would-reuse hits that were never realized (so-dc1dce23ac11 is one hit), the checkout and cache-epoch analyses are explicitly deferred, and dh:vfy-task-input-state:001 keeps its null at task-hash grain. The same-cache experiment (two checkout identities, separate probe times, positive access and bounded absence, a binding change) was not run. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009 that addresses the binding object's identity rather than the qualified checkout/cache relation; the experiment and an observed consumer are still needed beside it.
  - Consulted: `dh:vfy-checkout:001`, `fa:vfy-checkout:001`, `dh:vfy-cache-epoch:001`, `fa:vfy-cache-epoch:001`, `dh:vfy-task-input-state:001`, `so:sha256:dc1dce23ac11e53e60777ea7d0f4db7338946ae293ed30cc50e768265c5c5fa0`
  - Rows: `so:sha256:a90c39610e4a49911ace23bfa329876914961182bc6fbf2b9e8049b49ad3e3b9`, `so:sha256:f4532e29f3f1752921effc1f49c1712e5662464ce09f553e1f81130927db3e6b`

## C(i) comparison-operand-binding (2 rows)

*Comparison operands (behindCount, mergeBase, overlappingPaths).*

**Run 4 shows.** Run 4 re-observes the same field family and reads it as workspace bookkeeping (dh:vfy-workspace-bookkeeping:001, null standing, CQ barrier named); no comparison-operand binding or validity decision appears.

**Recommendation.** `unresolved` for all 2 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire both rows as implementation bookkeeping on the run-4 reading. Rejected for now: that reading is an unreviewed run-4 hypothesis, and the C(iv) freshness duty over the same fields is still open.

**Sitting decision.** Whether the run-4 implementation-only reading, once reviewed, is accepted as a retirement ground for these rows and for the freshness duty in assessment-and-selector-governance together.

- Duty `comparison-operand-binding-d1` (2 rows; prior text sha256 `8a5abe72f249`)
  - Fresh needed evidence: Run 4 re-observes behindCount and mergeBase on a verdict (so-759ba7836a3c) and overlappingPaths on an attempt (so-ba38c5b8d80c), and dh:vfy-workspace-bookkeeping:001 reads all three as tool bookkeeping, its null standing. No run-4 record binds the operands of a comparison or shows a validity decision that changes with its result. Still needed: an explicit operand binding (which branch, which base, at which instant) and an observed decision that depends on the outcome; otherwise the sitting may adopt the bookkeeping reading as this row's retirement ground once it is reviewed.
  - Consulted: `so:sha256:759ba7836a3c2ec434bebcece5db53d4985f8d001bf84b7baef48eeb9a2d4ecc`, `so:sha256:ba38c5b8d80ccd24f9ea2714629fe1a0e82d998621fc35d72a1826ab837e2ed4`, `dh:vfy-workspace-bookkeeping:001`
  - Rows: `so:sha256:d8cf8154d2e1435f81698ec0c8d67ea4bce53283ef275029392ce1a2d2f2f03f`, `so:sha256:f353b053a061870ff15017fd51401ea9165d54f608052fa1ea8daea981cf5d73`

## C(i) wall-time-evidence-class (2 rows)

*Separately identified wall-time evidence class.*

**Run 4 shows.** Run 4 adds proof-ledger durationMs on fact/shadow pairs and per-lane durations, which the lane-execution proposal carries as qualified values; no pinned query needs a separate wall-time class.

**Recommendation.** `unresolved` for all 2 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire because CQ-025 is answered by qualified execution values. Rejected: the withdrawal receipt names a CQ as the reopening condition, so the row parks on that named decision rather than retiring.

**Sitting decision.** Record the CQ barrier as the named missing decision.

- Duty `wall-time-evidence-class-d1` (2 rows; prior text sha256 `714e8d48343a`; CQ barrier)
  - Fresh needed evidence: Run 4 adds proof-ledger durationMs on matching fact/shadow pairs (so-0d463294884b, so-e26c033721f6) and attempt elapsedMs (so-ca8b3f90e57c); otp:vfy-lane-execution:001 carries these as qualified values on an execution, which is what CQ-025 consumes. No run-4 query or consumer selects or rejects a verdict on a separate wall-time class. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009; an observed consumer of that class is also still missing.
  - Consulted: `otp:vfy-lane-execution:001`, `dh:vfy-lane-execution:001`, `so:sha256:0d463294884b11f7faaf24a3ba9b966e69f908900adf66458943b70c153833f4`, `so:sha256:e26c033721f68a2fd908e0351d8467383a21d63ac1a7539613f6d4974de32385`, `so:sha256:ca8b3f90e57c22461d21f2b3bf2dad01149119aa674f540e81317a908f3f0610`
  - Rows: `so:sha256:ebe4cdcf6e9eec35f3ac468a4e21b559e27b550b221042d8266b1bb55b3d3b30`, `so:sha256:f025dca6b8335e444986f450f43d7970deb3f4209456efce8a23a5e1c065d446`

## C(ii) governing-specification-comparison (1 row)

*Replay comparison and its governing specification.*

**Run 4 shows.** The amended S7 contract freezes the replay report, routes live evidence elsewhere and says live-replay disagreements are reported with a diagnostic attribution and never modelled; no run-4 record shows a decision consuming the comparison.

**Recommendation.** `unresolved` for the row, with fresh needed evidence per duty below.

**Rejected alternative.** Retire as irrelevant because the contract makes the comparison diagnostic. Rejected: 'never modelled' is said of the engine's admission model, not of every gate, and the old section 5 still lists the replay outcome under evidence and gates.

**Sitting decision.** Whether the section 8 diagnostic-only wording is read as a ruling that no decision consumes the replay comparison (then retire next run), or the row waits for a consuming gate.

- Duty `governing-specification-comparison-d1` (1 row; prior text sha256 `206ed05bafd9`)
  - Fresh needed evidence: Run 4 reads the amended S7 contract: the frozen replay report is never re-rendered and live evidence goes to a separate report (po-a4d81c76e170), and live-replay disagreements are reported with a diagnostic attribution and never modelled (po-983855896b09). The lane-plan specification hypothesis dh:lpl-lane-plan-application:001 stays unresolved. No run-4 record shows a gate or decision that consumes the replay or golden comparison. Still needed: such a consuming decision, or a ruling that the comparison is diagnostic only, which would turn this row into a retirement.
  - Consulted: `po:sha256:a4d81c76e170bb1692ab847b24189cf548ae5939ecf5ef3965aa3aefe0fcb792`, `po:sha256:983855896b09b9d9aa905075137e4ace72075aa786f829d6a0cdee065978db50`, `po:sha256:5e3730ea652ac4482c32856ad9810d7239e5841b3236e48748e7644dd842f94c`, `dh:lpl-lane-plan-application:001`
  - Rows: `po:sha256:2cc77ae5391bd35d736242a9fff5ee6d2e64ee35cc18a420060b5a541f947ca6`

## C(ii) deferred-tail (1 row)

*Deferred tail of the prescribed sequence.*

**Run 4 shows.** The emission golden that carries the deferred-tail assertion is unchanged at the pin, and the only run-4 account of requests being passed over is the contract's same-checkout skip prose, which no admission chain instantiates.

**Recommendation.** `unresolved` for the row, with fresh needed evidence per duty below.

**Rejected alternative.** Rebucket under the CQ-009 same-checkout arm. Rejected: CQ-009 asks about grants sharing a checkout, not about requests omitted from a prescribed sequence.

**Sitting decision.** Keep it decision-gated; name the same-checkout skip as the candidate consumer for the next capture.

- Duty `deferred-tail-d1` (1 row; prior text sha256 `b548018ad7d5`)
  - Fresh needed evidence: Run 4 confirms the emission golden carrying this deferred-tail assertion is unchanged at the pin (po-5e3730ea652a). The one run-4 account of requests being passed over is the contract's same-checkout skip (po-983855896b09), which dh:lpl-same-checkout-skip:001 holds as a description, not an observed occurrence. CQ-009's re-scope needs grants sharing a checkout, not omitted requests. Still needed: a decision that must identify requests left out of the prescribed sequence, for example an observed skipped request on a held checkout that a consumer treats as deferred.
  - Consulted: `po:sha256:5e3730ea652ac4482c32856ad9810d7239e5841b3236e48748e7644dd842f94c`, `po:sha256:983855896b09b9d9aa905075137e4ace72075aa786f829d6a0cdee065978db50`, `dh:lpl-same-checkout-skip:001`, `dh:lpl-same-checkout-exclusion-rule:001`
  - Rows: `po:sha256:f60ddfb04ede510a8ffe6a04a36eac20caeb92175e59245f6b436897c83907b8`

## C(iii) journal-entry-duplicate-payload (25 rows)

*Admission journal entry: duplicate-payload identity.*

**Run 4 shows.** Run 4's only identical-payload pair is one source span read twice by the adapter, not two emissions, and the store-record hypothesis keeps its null; no copy, replay or correction trace and no consumer appear.

**Recommendation.** `unresolved` for all 25 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Treat the record-10 pair (so-df1f4d8ba41f, so-3013eedf6f82) as the duplicate-payload trace. Rejected: both cite one journal stanza (record 10); the run-4 hypotheses read it as one span seen twice, never two individuals.

**Sitting decision.** Record the CQ barrier beside the still-missing trace as the AdmissionJournalEntry receipt's named missing decision.

- Duty `journal-entry-duplicate-payload-d1` (25 rows; prior text sha256 `2d3d790bdbc6`; CQ barrier)
  - Fresh needed evidence: Run 4 checked its journal surface for a duplicate-payload pair. The only identical-payload pair (so-df1f4d8ba41f, so-3013eedf6f82) is one journal stanza read twice by the adapter, not two emissions; so-363f9b7f07dc shows one chain written in two journal formats; and dh:vfy-admission-store-record:001 keeps its null. No copy, replay or correction trace and no consumer treatment appear. Still needed: two distinct emissions with equal semantic payload, their record and event times, any revision link and an observed consumer treatment. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009.
  - Consulted: `so:sha256:df1f4d8ba41f32b9b399d0a8872ac5d0ab743f6d23eef09fd66121ec5b68db71`, `so:sha256:3013eedf6f823e140ca1892f65e0bba8d491f54a42659231b17ecc35d3597a9c`, `so:sha256:363f9b7f07dcb4d4295f3193059e58f32cfb81c4efbf3fb587348c3ecb6aa467`, `dh:vfy-admission-store-record:001`
  - Rows: `so:sha256:01fe79ebf1f0cc28550c21c941e0c4ff963cbbbcff28cffe712d9b026288d99a`, `so:sha256:0385cf6e12920c8a96c520a7238b522f923a7c0116cd603fbeff793a7d0e6058`, `so:sha256:05fa73f187683c8b5cfb25a3958ed5b6f3d344d1b984cb1ce1cdffe5a9b2674a`, `so:sha256:0775b5fd356eaea7604537054326c7e97598c5f81504c0d815558297ebf0f50e`, `so:sha256:08149709f365cd0031ec1a4a17e6f76e957b70a4507b8c15e077e41ec998abce`, `so:sha256:10f2cebc7b17c5f7b15bd051ed0f0363d355c3e4cb2f927dd2b2852461ad2610`, `so:sha256:146d2b385ef6e3fb892821dbd2df82091184f2dca48f8cd9b9eaa5d01019d942`, `so:sha256:3b7f2e1876cc9602c8f4b911bdfec4bf8eb8b9a8355cec317b4e81bc900d2059`, `so:sha256:4a98ae2d71bc800fd8718d37ccc93288cf66cc48dbffa2eddc2a0c7c3297a7d6`, `so:sha256:522ce0efbf2933dac38a6f574c2ff640dadb305b695e06028dad7a5c0f25d91c`, `so:sha256:65609cedeaf3e99b51031c38b99ab7bc16ea0ef59fa66bea1d446ef3f7bd3333`, `so:sha256:6cf1d332ce7ea225c24cf5aea2e2192ab91ec06838463289be284bae7677e60c`, `so:sha256:7627bd8803b5da11524904bb2c7b2fdcd7c320ba034444204852ded9c164cfff`, `so:sha256:7e4e7d3c3f97a3907222c12d770c3f618aa1502dc1fd391f0738fd93f874dbbb`, `so:sha256:91d2cd56cb62e64ab02890e9792e172bcd9350420a034a74fda5d8c35367bb4a`, `so:sha256:a3d906985080a7bb34c6364829dd3add8d8d0a7235a3b00d027d9e9685e7eb19`, `so:sha256:b16055eff4bab382b33f0a5629c273a35a659e407651035b9532fb833f1a722c`, `so:sha256:b303cb0ce5ff71bf3353ee50bced00e443bbba7d77e4f3e5cf7e6e8476d054aa`, `so:sha256:b4093c2df6b7863d8c90b35246c348aecbbc5201cc8a3968132345e8e29c038e`, `so:sha256:c19aff86102184c4aafeecb71520216ed5ccf721d1d16cce9a382bdd170d1967`, `so:sha256:c1e15b1c4eaa7eb7c6aa06fd4e88909368ddeac9931936b7d68c2bf857b1bcfa`, `so:sha256:cf8f163c919cdad854f3e9aabddf18a7c7589844a69389646492c47ac1f7d8e8`, `so:sha256:dae7bbf3b41b449e027e7be2793340e99e86ffbfbc9e3781a15b2c412919fba3`, `so:sha256:e7ddc88d39dcd0ebbfa2a08af2a670b1921da6c0a721d6b64a2a41b179fd1964`, `so:sha256:f1e3e6b059c258e89fc802148a2976a93bd0ade9c8e5568b6052d81945140f7a`

## C(iii) allocation-double-count (28 rows)

*Allocation double-count across admission decisions.*

**Run 4 shows.** Run 4 shows a termination followed by a new admission on the same checkout under a new nonce and attempt, which reads as two grants, not continuity; it shows no accounting trace that counts one allocation twice and no rewrite history of heartbeats.

**Recommendation.** `unresolved` for all 28 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Fold into CQ-009's re-scoped same-checkout arm. Rejected: CQ-009 tests whether two active grants share a checkout at one time; the double-count duty tests whether one allocation is counted twice, which concurrent-exclusion evidence does not show.

**Sitting decision.** Keep the 28 rows on the double-count trace and accept the sequential eviction/re-admission pair as partial evidence for the new-grant reading only.

- Duty `allocation-double-count-d1` (28 rows; prior text sha256 `5cc30955f9f4`)
  - Fresh needed evidence: Run 4 checked the lease store and journal for a double count. The quarantined lease state record (so-a8d270b5e19d) carries one heartbeat stamp, not a rewrite history. Two organic chains on one checkout (so-860cff0d673e, then so-a9ed1352e2bc about nine hours later under a new nonce and attempt) show termination followed by a new admission, which reads as two grants. No accounting trace counts one allocation in two decisions, and no conferral or termination rule is captured. Still needed: an accounting trace time-aligned with the lease store over one held allocation, with a heartbeat rewrite and a reacquisition, showing whether the allocation is counted once or twice for one beneficiary and pool.
  - Consulted: `so:sha256:a8d270b5e19db57e5018ec2995ada6953c3306d8d585d72e1e5be947eddb3192`, `so:sha256:860cff0d673e93aaa9ec8db4d85fe43cfdd89d22b92e5ba29966346fee8a35a1`, `so:sha256:a9ed1352e2bca5c2c3ca9f5bff72e936dd668a90cc4f1842ba3512cf9dd29020`, `fa:vfy-seat-grant:001`, `fa:vfy-admission-charge:001`, `dh:vfy-coordination-protocol:001`
  - Rows: `so:sha256:0415a4f1590540c534d5ccc9027d36acddbfa4ffdd84445bda5155dac85ac5c6`, `so:sha256:05a0dfbb8f434d75b8be6d1bd7d396925b594cb0e9ceb6b72bda31e76e9685d3`, `so:sha256:0ac1b790ab6965774fb94a2741caa3d2254ad662e54f761a5ae8744e19e6b7af`, `so:sha256:0dcfbaeaa65aeeec90c1e9590be8a33c1ffe9438f29ebbe7d8617d09a5e45b08`, `so:sha256:0e50d84bdb1fbc2d463bced37bfe314caf8e1b5a8cc58dd5359978650ab1f53c`, `so:sha256:0e797a3deeedd27cfa75082643ce788d6c73e073bf87a640fe50ce3896a43e2b`, `so:sha256:126709ea74fec8cb4b03c021d7cf121aac566b19bea91c4ac8a452f33d01a94e`, `so:sha256:155a7c875acf08bae8c3073be1e54bebd65f2b8d5192697d7687da967e781ae6`, `so:sha256:232151f9f2afc0f8662cbd2c75d368bae594686ce7f0bdbac3e9f7238d6fd062`, `so:sha256:27ba4f5468b662c17e401817a599ad4e45c2091d51423b279d8de9fbe97880b7`, `so:sha256:2e58e1311fcc9f696bc06624bab0b4e23b6597ee1919f68e1516882ab067b53a`, `so:sha256:4bb535144f06b1e9abc6a8c75f0dcc3fc7d030f9b64214adfd1bed92ca384b08`, `so:sha256:5130545f45659ac9d904152da47d3e52ab06961250b57d626f3d8afc4993fe42`, `so:sha256:563cd0ce4e6678eca1af8e3cf2ff8cc59e08e587eb8853bb6f4b76e3a634dc67`, `so:sha256:6108f04e939048617511e050bbb2421593e88c3658829deaead9b406fcb811d9`, `so:sha256:636db00ceac88a2c4857664e7f2fb863833b68fe94f1e28a111e3451d3dfcbb1`, `so:sha256:675134527a157d157274937b2f8ad90b036d30b77340d61f1e202483d9ac828e`, `so:sha256:6abcdc65b395bfc82d08b2c5e49d3c9553e97a46bd942343457e68e8da0a85e7`, `so:sha256:7b8493be70e8285a866f898e5691df4cb02c5d51fd808635f508854d1ec5622c`, `so:sha256:7f98fb05e2fa6d6b3b08618e7f5af09ecdefc3ff88752bbf437aff900e73036a`, `so:sha256:94cda97bb49a7661b4b7bd7ed0cd0f5b8594223ad33ddbf9d9637e464ee5c902`, `so:sha256:997fca9994bcb3a70f034acd490a212d79ae083f17c0a18972bdbc8a924a5346`, `so:sha256:a4ff1bbe07b6d10ed237650df3bfbe94c9a94240167ba58443ebf37227476301`, `so:sha256:ad5ef0f6bca50e85da674990519818fb3d4a14a1650ccb135b89f2f10d875248`, `so:sha256:b0aa81e61691ffc2b4ef587508eae988e450f03407eefbfc524fb38a82c20cdc`, `so:sha256:cfb413d38b8e8e1903d6e83b8d2977c5fd102003636ca8403eaa958dc1791b6f`, `so:sha256:d90be1aaa963b3e017130d2add821e59f623ac0540f9563cd9dd1d607cae8ce9`, `so:sha256:e1936767a2458fe5eb08ac5e2ba0887e7ac51f70d06111cead6e54b854e39c17`

## C(iii) result-artifact-content-snapshot (14 rows)

*VerificationResultArtifact content-snapshot rival.*

**Run 4 shows.** Run 4 is the first run with writer-issued proof-ledger records on its surface, so issuance is now observed; but no pair of independent equal-content assessments of one attempt appears, correction (C4.2) is unchecked, and merged preview is dormant.

**Recommendation.** `unresolved` for all 14 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire the rival because fa:vfy-verification-evidence-record:001 individuates issued facts by their issuing write. Rejected: that analysis concerns proof-ledger facts, not the verdict artifact, and it cites no equal-content pair either.

**Sitting decision.** Whether issuance evidence from the proof ledger is admitted as the issuance half of this receipt, leaving only the equal-content pair and C4.2 correction lineage open.

- Duty `result-artifact-content-snapshot-d1` (14 rows; prior text sha256 `9fcd24a82925`)
  - Fresh needed evidence: Run 4 is the first run with writer-issued proof-ledger records on its surface (for example so-12d5a26fbfac and so-d6adeec15c79), so issuance writes with recordedAt and expiresAt are now observed, and fa:vfy-verification-evidence-record:001 individuates an issued fact by its write. The twin records it cites are one span read twice, not two assessments. No two independent equal-content assessments of one attempt appear, C4.2 correction is still unchecked (po-d1774b7edfc2), and merged preview is dormant in the window (po-82648cf8d37a). Still needed: two independent equal-content assessments of one attempt with an observed consumer treating them as one or two results, plus correction lineage from the C4.2 writer.
  - Consulted: `so:sha256:12d5a26fbfac613f030ac0f2edcaed9456998ba2a6f820e02176bb9abb4b3fa3`, `so:sha256:d6adeec15c79c1b03be5404b297f3e87cef2bbb88d92b350f98398ecd5abf002`, `so:sha256:fcbe894799eaef93ad777c7a676c529cb4329f46ddbbf0578751d37987372186`, `so:sha256:dc1dce23ac11e53e60777ea7d0f4db7338946ae293ed30cc50e768265c5c5fa0`, `dh:vfy-verification-evidence-record:001`, `fa:vfy-verification-evidence-record:001`, `po:sha256:82648cf8d37a61140f3d401033e492b8f3483209d3a76dfdddef77ff73c38a7c`, `po:sha256:d1774b7edfc21c7fd04105756bbd4441a0c12df37f7fa8a6c29346cc2f7415e2`
  - Rows: `so:sha256:05bdfd88fe028976d02147ad0bfa51ad66828d2ceae653806a6a947e8374aeda`, `so:sha256:1008941903be9f39b5f8ee44d50647d0b02ea0a1988e1712481a22f35e6a0465`, `so:sha256:18fe73166f5b7932c1ef8a529b9e26f0975324ad5451673374ff5b24bbfeb91c`, `so:sha256:34ba8416b74877505a8a69b9947fcebfab0c62e4f3bbd30218232b857e4539bf`, `so:sha256:74b8c4733f1c2049ac998444c4905ba5e016d2f0cd6cf310dc5e6fa7cd414af2`, `so:sha256:7947484312042fc0ac6c5bd485427b9cc3a28829e3745b39031f6400a9c1a9c8`, `so:sha256:7a639ef29784753fbf47a4860c76a214d945a67c34fe1675915e57253dd3d628`, `so:sha256:9078a6ab88adf6e8ae99c1baafab237dd8c100a21fa8425143ca76a0f5bb6fcc`, `so:sha256:929aa987fb5e550c58968f28fd06947d1bfd2b788815a77376329f06d9ca765a`, `so:sha256:a9a0813fdb533325632faeda662b8fa72b08b1e4868c9cfdf66c29939927dac9`, `so:sha256:b24d12302a876d81148174d1247fd84e7d304fababe40bf31e84e37093734224`, `so:sha256:e4e14fa1e17afc043cbd2edc24b341d044e7d0aed068e15549d6cd38a7f560d1`, `so:sha256:f19da17d5b8f8ff5107a9b96cf4ff9256ebf03da52491e0370413f941f085e5d`, `so:sha256:faeff009ed066ab59b310901f7f127fa174f0b0e2859613529a9ac69673c3230`

## C(iii) assessment-model-selection (1 row)

*Assessment-model selection over closeout readiness.*

**Run 4 shows.** Run 4 has two closeout-readiness records, one with requiredChecksGreen and one with checksGreen, but they belong to different attempts, pull requests and heads, so no single component changes between two assessments of one PR/head.

**Recommendation.** `unresolved` for the row, with fresh needed evidence per duty below.

**Rejected alternative.** Use the two run-4 readiness records as the paired experiment. Rejected: they assess different pull requests, so every component differs at once.

**Sitting decision.** Keep the experiment as specified; note that dh:vfy-closeout-readiness:001 falls back on the CQ barrier if no tier link appears.

- Duty `assessment-model-selection-d1` (1 row; prior text sha256 `c9a910f8025a`)
  - Fresh needed evidence: Run 4 has two closeout-readiness records: so-93883668edee with requiredChecksGreen and greptileScore, and so-968fbd04dbf5 with checksGreen and ready. They belong to different attempts, pull requests and heads, so no single component changes between them, and dh:vfy-closeout-readiness:001 keeps its null. Still needed: two assessments of one explicitly identified PR and head that differ in one component, with assessment instants, the consumer's criteria (checksGreen versus requiredChecksGreen) and its treatment of the second assessment as an update or a new snapshot.
  - Consulted: `so:sha256:93883668edeeac6fbab8532c248f0f56e52e6c311e82a9c687c69d7b8ba85afa`, `so:sha256:968fbd04dbf5aae6a2984398964aafb8cf6bca2d9c60ae793b6aa1602556bde6`, `dh:vfy-closeout-readiness:001`
  - Rows: `so:sha256:34866c142b067589cef10ea45947b1e31d1f7ae8e7518b45d705f5df5a3d31ee`

## C(iv) checkout-binding (0 rows)

*Checkout and cache binding.*

No rows: run 3 retired the fleet-checkout-identity row at its sitting 2. None; the cluster is kept only to preserve the fifteen-cluster frame.

## C(iv) grant-resource-contention (2 rows)

*Grant/resource contention and proof-lock paths.*

**Run 4 shows.** Run 4 names MachineProofLock only as a packet-side domain member and dates proof-lock relocation only in curated change rows; none of its 109 source observations is a lock file or proof-lock record, and overlappingPaths is read as workspace bookkeeping.

**Recommendation.** `unresolved` for all 2 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire because the change ledger shows proof locks moved under the admission runtime root. Rejected: ledger rows are seed data with observational status and say nothing about ownership, acquisition or outcome.

**Sitting decision.** Whether the next capture adds proof-lock ownership records; until then the rows re-park.

- Duty `grant-resource-contention-d1` (2 rows; prior text sha256 `44092f347195`)
  - Fresh needed evidence: Run 4 checked for proof-lock ownership. MachineProofLock appears only as a packet-side member of the contended-resource domain (po-d067a0787ac4), the change ledger dates proof locks moving under the admission runtime root (po-fd2608fb2e65, po-3c219ae9a673) as observational seed rows, and none of the 109 run-4 source observations is a lock file or proof-lock record. overlappingPaths (so-ba38c5b8d80c) is read as workspace bookkeeping. Still needed: lock-ownership records joined to grants, with acquisition and release instants, a waiting, winning or losing outcome, and the rule tying FleetContestedPath to that contention.
  - Consulted: `po:sha256:d067a0787ac432b22b76b62e369842928da6ca13e281c16fd56ef77e8e743908`, `po:sha256:3c219ae9a67306b44262ce221588e8a5ba129806c5bca6cc2e857a0d32ade524`, `po:sha256:fd2608fb2e655c02344a1d2b0f9e78e96b045caa6d56d2600979e46fc11e7ff4`, `so:sha256:ba38c5b8d80ccd24f9ea2714629fe1a0e82d998621fc35d72a1826ab837e2ed4`, `dh:vfy-workspace-bookkeeping:001`
  - Rows: `so:sha256:b42503da37767cc741db6196fbf13e019bdc59f71166ad4d95318966ca7ae123`, `po:sha256:5fa0d40013f2f1bace37c166a14058909069e91de0f63b823bd0921c40f68278`

## C(iv) admission-lifecycles (5 rows)

*Request and lease lifecycles, including the memory rider.*

**Run 4 shows.** Run 4 adds organic enqueue-admit-release and enqueue-admit-evict chains, a lease state record with one heartbeat stamp and the admission-engagement rival, but no heartbeat rewrite history, no ledger decrement and no pinned query that needs a lifecycle apart from request and grant.

**Recommendation.** `unresolved` for all 5 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Accept dh:vfy-admission-engagement:001 as the lifecycle referent. Rejected: it is unresolved with no warrant, and its own discriminator (a chain whose admitted row changes a member the enqueued row fixed) is unobserved.

**Sitting decision.** Record the CQ barrier as the named missing decision for all three duties; keep the memory rider separately parked under memory-measurement's evidence.

- Duty `admission-lifecycles-d1` (1 row; prior text sha256 `549b0d957785`; CQ barrier)
  - Fresh needed evidence: Run 4 adds organic enqueue-admit-release chains and states the lifecycle rival as dh:vfy-admission-engagement:001, unresolved with no warrant; memoryPeakBytes appears on release rows (so-95b7d78a061f) and peakRssKb on verdict lane entries (so-bbe03a405b80), never joined. Still needed for the lifecycle: authoritative continuity from one submission through grant to release or cancellation. Named missing decision for the lifecycle: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009. The memory rider stays separately parked: process boundary, sampling method and interval, and the relation to peakRssKb (fa:vfy-peak-memory-use:001 asks for a mid-hold reading).
  - Consulted: `dh:vfy-admission-engagement:001`, `dh:vfy-peak-memory-use:001`, `fa:vfy-peak-memory-use:001`, `so:sha256:95b7d78a061f4eadeca7bc45379f83a3696c58770863df88b0a13e5435ede7a1`, `so:sha256:bbe03a405b806751dca5ddeee93679d37cc8efada8cd69ecdbf478f09f0a70f6`
  - Rows: `so:sha256:c627961a8fcde9dca01027cbf052494763b5e6895805c1c0c50d8bf51ba3a7bb`
- Duty `admission-lifecycles-d2` (1 row; prior text sha256 `ecd7d6b80658`; CQ barrier)
  - Fresh needed evidence: Run 4 adds organic chains with both kinds of end: enqueue-admit-release (so-95b7d78a061f) and enqueue-admit-evict (so-860cff0d673e), plus a ticket eviction (so-29a5ac8607a2); unlike run 3's synthetic chains these keep their own enqueue rows. Causal continuity rests on the shared nonce, which dh:vfy-admission-engagement:001 says decides nothing, and dh:vfy-admission-termination:001 finds no pinned query that needs the end itself. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009 that needs the composite lifecycle apart from SeatRequest, SeatGrant and their end reports.
  - Consulted: `so:sha256:95b7d78a061f4eadeca7bc45379f83a3696c58770863df88b0a13e5435ede7a1`, `so:sha256:860cff0d673e93aaa9ec8db4d85fe43cfdd89d22b92e5ba29966346fee8a35a1`, `so:sha256:29a5ac8607a2204f5c7518e009834a017dbc947407f1c9430c0b87119c33d677`, `dh:vfy-admission-engagement:001`, `dh:vfy-admission-termination:001`
  - Rows: `so:sha256:d94bf0420d3457158959e6188c50d5949dc4fae4a48d07e7077f8c81df36fcb6`
- Duty `admission-lifecycles-d3` (3 rows; prior text sha256 `e1e2e2b810df`; CQ barrier)
  - Fresh needed evidence: Run 4 checked the lease side: the quarantined lease state record (so-a8d270b5e19d) carries one heartbeat stamp, the two lease evictions carry only a terminal lastHeartbeatAtMillis, and the domain table says the live store holds active leases only while released history is ETL-derived with no deployed state carrier (po-3d0afbe028ab, po-39213e5f7d01). No chain binds grant creation, a heartbeat rewrite history, the end, a ledger decrement and carrier lineage. Still needed: that provenance chain. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009 that requires the grant lifecycle apart from SeatGrant.
  - Consulted: `so:sha256:a8d270b5e19db57e5018ec2995ada6953c3306d8d585d72e1e5be947eddb3192`, `so:sha256:860cff0d673e93aaa9ec8db4d85fe43cfdd89d22b92e5ba29966346fee8a35a1`, `so:sha256:a9ed1352e2bca5c2c3ca9f5bff72e936dd668a90cc4f1842ba3512cf9dd29020`, `po:sha256:3d0afbe028ab88fe8cdca929c0d3fe27002f7d9c8fd04c9cf7430a5cfd3d1eb8`, `po:sha256:39213e5f7d01487ba0df48376cf630d5c8f722af131ec4296f6268f08c1e7cc1`, `fa:vfy-seat-grant:001`
  - Rows: `po:sha256:3aadb9c8ae061d71b2e8386d9b8af518d49df5a66abaa0bb0391783833a6eef4`, `po:sha256:51fa8a9b8fcef0856134c3599ef68eabe588532203230c5b0ac8c892da47c95a`, `po:sha256:56d67898f9daaa0ff3c1fb34ff05745d9a1f94cf2703726f7721d1f586f89e5f`

## C(iv) failure-signature-occurrences (0 rows)

*Failure-signature occurrence evidence.*

No rows: run 3 retired the three rows by re-identification at its sitting 2. None; kept for the frame.

## C(iv) cache-plan-resolution (1 row)

*Resolved cache plan applied to an execution.*

**Run 4 shows.** Run 4's only cache-plan text is the packet-side CachePosture domain row describing the deployed plan union; no run-4 observation carries a resolved plan joined to a Turbo execution.

**Recommendation.** `unresolved` for the row, with fresh needed evidence per duty below.

**Rejected alternative.** Answer from the literal-domain mapping. Rejected: a packet-side description of the union is not an observed resolver result for a particular execution.

**Sitting decision.** Keep the rider open under CQ-024 (should_have, so no CQ barrier).

- Duty `cache-plan-resolution-d1` (1 row; prior text sha256 `28473e39011f`)
  - Fresh needed evidence: Run 4's only cache-plan text is the packet-side CachePosture row describing the deployed plan union and its fail-closed path (po-bc1f5608d615). Proof-ledger facts carry inputSource and epochDigest (so-12d5a26fbfac) but no resolved plan, and no run-4 observation joins a resolver result to a Turbo execution. Still needed: an observed resolver result with its domain and version, joined to one execution and the posture actually applied, under CQ-024.
  - Consulted: `po:sha256:bc1f5608d615e7d78e834be1f177a297532c9cc240321ec70cb554620873aa36`, `so:sha256:12d5a26fbfac613f030ac0f2edcaed9456998ba2a6f820e02176bb9abb4b3fa3`, `dh:vfy-task-input-state:001`
  - Rows: `po:sha256:30be9d42308395a759ea42b1706c47b14bf2d995ff5d90eb85161cef24e27b61`

## C(iv) ordering-cluster (0 rows)

*CQ-020 ordering and governing specification.*

No rows: discharged at run-3 sittings 2 and 3. None; kept for the frame. Note that the S7 contract forbids reusing ordering-cluster terms for lane plans (po-79f91eaae90c).

## C(iv) assessment-and-selector-governance (9 rows)

*Freshness, review score, attribution and proof-tier governance.*

**Run 4 shows.** Run 4 re-observes greptileScore, behindCount/mergeBase, classified failures and proofTier, and adds the literal-domain statement that YeetProofTier is not AssuranceTierId; no governing contract for any of the four duties appears, and every cited proofTier is `full`.

**Recommendation.** `unresolved` for all 9 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire the freshness rows on the run-4 workspace-bookkeeping reading. Rejected for now, as for comparison-operand-binding.

**Sitting decision.** Rule jointly with comparison-operand-binding on the bookkeeping reading; record the CQ barrier for the proof-tier selector duty.

- Duty `assessment-and-selector-governance-d1` (3 rows; prior text sha256 `8c1d17bd4489`)
  - Fresh needed evidence: Run 4 re-observes behindCount and mergeBase (so-759ba7836a3c) and overlappingPaths (so-ba38c5b8d80c), and dh:vfy-workspace-bookkeeping:001 reads them as tool bookkeeping with its null standing. No branch-freshness contract appears: nothing defines merge-base, behind-count or overlap meanings, binds an assessment to its branch and base, or shows a decision that changes with the result. Still needed: that versioned contract and its consuming decision, unless the sitting adopts the bookkeeping reading as a retirement ground.
  - Consulted: `so:sha256:759ba7836a3c2ec434bebcece5db53d4985f8d001bf84b7baef48eeb9a2d4ecc`, `so:sha256:ba38c5b8d80ccd24f9ea2714629fe1a0e82d998621fc35d72a1826ab837e2ed4`, `dh:vfy-workspace-bookkeeping:001`
  - Rows: `so:sha256:0a7f99ebe45f22164f484b539becf4d1d57384861db25b0c065fc67cca2574a7`, `so:sha256:a4fa5b4f6b8142d813d5867e01c92a245a9a7ee7d64b8841a3e27a068c88e764`, `so:sha256:c1e2fd7731b1efe855f70c75df8e7dd0bd99853668c551eca8fb80593a621d06`
- Duty `assessment-and-selector-governance-d2` (2 rows; prior text sha256 `57e9ad2e6204`)
  - Fresh needed evidence: Run 4 re-observes greptileScore on a closeout-readiness record beside requiredChecksGreen and reviewDecisionAcceptable (so-93883668edee); dh:vfy-closeout-readiness:001 finds no record tying a readiness check to a tier, and dh:vfy-assurance-tier:001 cites the record without settling the link. No scale authority, version, reviewed subject or score-production provenance appears. Still needed: those, plus an observed closeout or assurance decision governed by the score.
  - Consulted: `so:sha256:93883668edeeac6fbab8532c248f0f56e52e6c311e82a9c687c69d7b8ba85afa`, `so:sha256:968fbd04dbf5aae6a2984398964aafb8cf6bca2d9c60ae793b6aa1602556bde6`, `dh:vfy-closeout-readiness:001`, `dh:vfy-assurance-tier:001`
  - Rows: `so:sha256:12f0a017acb17063246f77ebb5c128271f9df67ea7bc1666268052f2d58873d1`, `so:sha256:258d88bf5d120ca46af4e7964a5c3a5674c5c4984b67c0f84fe8f706e979c3f6`
- Duty `assessment-and-selector-governance-d3` (1 row; prior text sha256 `e55d742a52aa`)
  - Fresh needed evidence: Run 4 adds otp:vfy-committed-failure:001, which locates a failure at one step under a fail-fast policy (so-ca8b3f90e57c), and verdicts that carry a free-text repairCommand (so-bbe03a405b80). Neither states whether a failure was introduced, inherited, unrelated or environmental. Still needed: necessary conditions for each attribution class, their overlap or precedence rules, and an assessment record binding change, baseline, environment and assessment provenance.
  - Consulted: `so:sha256:ca8b3f90e57c22461d21f2b3bf2dad01149119aa674f540e81317a908f3f0610`, `so:sha256:bbe03a405b806751dca5ddeee93679d37cc8efada8cd69ecdbf478f09f0a70f6`, `otp:vfy-committed-failure:001`, `dh:vfy-committed-failure:001`
  - Rows: `po:sha256:a0460c0e2b60f310cb30b9c03ea0aa2e487e02aadaa0450c56bb04cff6b5c8c9`
- Duty `assessment-and-selector-governance-d4` (3 rows; prior text sha256 `7377e1b7c260`; CQ barrier)
  - Fresh needed evidence: Run 4 checked proofTier across attempt-started rows, the lease state record, verdict lanes and ledger facts (so-10c2570fe2f6, so-a8d270b5e19d, so-5ecc4af84671): every value is `full` under every stage, and the domain table separates YeetProofTier from AssuranceTierId with the mapping left open (po-2b7cdf8babec). dh:vfy-deployed-proof-tier:001 keeps its null. Still needed: records with the other proof-tier members and their lane sets, the planner authority and version that owns the selector, and the recorded mapping into assurance tiers. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009 whose decision consumes the selector.
  - Consulted: `dh:vfy-deployed-proof-tier:001`, `po:sha256:2b7cdf8babec65435dcb9a12a4477d6d6423207028baa810f4ec103f9817a1de`, `so:sha256:10c2570fe2f62edc08df8ba560eaf9a718c07c1e802988325eed47e54eadd20c`, `so:sha256:a8d270b5e19db57e5018ec2995ada6953c3306d8d585d72e1e5be947eddb3192`, `so:sha256:5ecc4af84671a1589c51ebd81bce2278400b5605cc536e23e41eab87ceb2db1f`
  - Rows: `po:sha256:8b0e7ebacbadd3d0a21df787d0070763c9151c438e5ad68ef69454c6bea0aca1`, `po:sha256:8d123d2b803018949aa079849fafabb4d38fbde7e7f77a5515d448cdc0a9f195`, `po:sha256:922212cafdb03daef5fb111352d661cfda30e1e9f3d3e8c3e6f45a19c6a82a50`

## C(iv) execution-boundaries-and-elapsed-scope (2 rows)

*Passed-step boundaries and elapsed-measure scope.*

**Run 4 shows.** Run 4 adds the lane-execution proposal and nested lanes via parentLaneId, but lane entries still carry durations without start and end instants, and no writer states what elapsedMs covers.

**Recommendation.** `unresolved` for all 2 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Close on otp:vfy-lane-execution:001. Rejected: its own analysis names a lane record with start and finish instants as missing evidence.

**Sitting decision.** Keep both duties; they are instrumentation requirements, not CQ edits.

- Duty `execution-boundaries-and-elapsed-scope-d1` (1 row; prior text sha256 `6f0582259d28`)
  - Fresh needed evidence: Run 4 adds otp:vfy-lane-execution:001 and nested lanes through parentLaneId (so-5d4b45aa3226); passed lane entries carry status, exitCode and durationMs (so-ca8b3f90e57c) but no start or end instant, and fa:vfy-lane-execution:001 names a lane record with start and finish instants as missing. Still needed: a passed-step execution record with its parent-attempt join, a per-run identity that separates reruns, and its own start and end.
  - Consulted: `so:sha256:ca8b3f90e57c22461d21f2b3bf2dad01149119aa674f540e81317a908f3f0610`, `so:sha256:5d4b45aa3226c4c535dbfc1d052a7d78900d8244f6417a238f327d8f6f8b8c27`, `otp:vfy-lane-execution:001`, `fa:vfy-lane-execution:001`
  - Rows: `so:sha256:3a8b51a1acc8602b1a583147d6d5e7e253481237fbf5806c9b13833698bc9090`
- Duty `execution-boundaries-and-elapsed-scope-d2` (1 row; prior text sha256 `16d83d58111e`)
  - Fresh needed evidence: Run 4 shows attempt elapsedMs on an attempt-finished verdict (so-ca8b3f90e57c), per-lane durationMs repeated identically on ledger fact/shadow pairs (so-0d463294884b, so-e26c033721f6), and the KPI law's retention and termination rules (po-fd56d2b008d1). None states what span a value measures: whole attempt, command, lane run or nested occurrence, with what clock and precision. Still needed: the writer's authoritative statement of each measured extent, keeping target, interval and provenance together.
  - Consulted: `so:sha256:ca8b3f90e57c22461d21f2b3bf2dad01149119aa674f540e81317a908f3f0610`, `so:sha256:0d463294884b11f7faaf24a3ba9b966e69f908900adf66458943b70c153833f4`, `so:sha256:e26c033721f68a2fd908e0351d8467383a21d63ac1a7539613f6d4974de32385`, `po:sha256:fd56d2b008d116a7298306590441fe49482be56357eb1f17166d6af2191cbf7e`, `dh:vfy-run-grouping:001`
  - Rows: `po:sha256:2092736911a0c68e96ae8d9638b00ec4b6992b4da0677f325e4fd420fb41b2a7`

## C(iv) memory-measurement (1 row)

*Memory measurement semantics.*

**Run 4 shows.** Run 4 carries both readings (peakRssKb on verdict lane entries, memoryPeakBytes on release rows) and a peak-memory hypothesis, but never on one joined record, and the foundational analysis leaves the bearer and sampling unresolved.

**Recommendation.** `unresolved` for the row, with fresh needed evidence per duty below.

**Rejected alternative.** Close on dh:vfy-peak-memory-use:001. Rejected: fa:vfy-peak-memory-use:001 is explicitly deferred and needs a mid-hold reading and the measured process boundary.

**Sitting decision.** Keep the row; the run-4 deferral and this duty ask for the same sampling and bearer evidence.

- Duty `memory-measurement-d1` (1 row; prior text sha256 `5ac91d5942d9`)
  - Fresh needed evidence: Run 4 carries peakRssKb on verdict lane entries (so-bbe03a405b80, so-93883668edee) and memoryPeakBytes on release rows (so-95b7d78a061f, so-363f9b7f07dc); dh:vfy-peak-memory-use:001 reads the latter as measured use, but fa:vfy-peak-memory-use:001 defers it with the bearer and sampling unresolved. No record carries both fields for one run. Still needed: the measured process boundary, sampling method and interval, unit and provenance for each field, and an authoritative comparison deciding whether they measure one family.
  - Consulted: `so:sha256:bbe03a405b806751dca5ddeee93679d37cc8efada8cd69ecdbf478f09f0a70f6`, `so:sha256:93883668edeeac6fbab8532c248f0f56e52e6c311e82a9c687c69d7b8ba85afa`, `so:sha256:95b7d78a061f4eadeca7bc45379f83a3696c58770863df88b0a13e5435ede7a1`, `so:sha256:363f9b7f07dcb4d4295f3193059e58f32cfb81c4efbf3fb587348c3ecb6aa467`, `dh:vfy-peak-memory-use:001`, `fa:vfy-peak-memory-use:001`
  - Rows: `so:sha256:78cf821b0771a1c60ef1f80746484a8da1df72bcf2b1eaa9ebed337144e5a245`

## C(iv) duration-and-comparison-issuance (2 rows)

*Duration individual and comparison issuance.*

**Run 4 shows.** Ruling 17's zero-ledger premise no longer holds: run 4 captures writer-issued proof facts with recordedAt and expiresAt. Copy, correction and custody lineage are still absent, and both concessions still need a Must/Should CQ.

**Recommendation.** `unresolved` for all 2 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Close the issuance leg on the run-4 ledger. Partly accepted as an evidence update only: issuance is observed, but the rows carry CQ duties that the ledger cannot discharge.

**Sitting decision.** Note that the issuance premise has changed; record the CQ barrier as the named missing decision for both rows.

- Duty `duration-and-comparison-issuance-d1` (1 row; prior text sha256 `109479f341b3`; CQ barrier)
  - Fresh needed evidence: Run 4 changes the premise of Ruling 17: writer-issued proof facts with recordedAt and expiresAt are now captured (so-12d5a26fbfac), and durations sit on ledger records (so-0d463294884b). fa:vfy-verification-evidence-record:001 finds no copy, correction or realized reuse, and C4.2 is unchecked (po-d1774b7edfc2). Still needed: copy and correction lineage for duration carriers. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009 that must traverse a RecordedWallDurationMeasurement rather than qualified execution values, and one that tells equal-content carriers apart.
  - Consulted: `so:sha256:12d5a26fbfac613f030ac0f2edcaed9456998ba2a6f820e02176bb9abb4b3fa3`, `so:sha256:0d463294884b11f7faaf24a3ba9b966e69f908900adf66458943b70c153833f4`, `fa:vfy-verification-evidence-record:001`, `otp:vfy-lane-execution:001`, `po:sha256:d1774b7edfc21c7fd04105756bbd4441a0c12df37f7fa8a6c29346cc2f7415e2`
  - Rows: `so:sha256:2a207d4986630e8590f790457dabe07ffeecdb9b2bfa79cf254c6bce508a2998`
- Duty `duration-and-comparison-issuance-d2` (1 row; prior text sha256 `80e865285086`; CQ barrier)
  - Fresh needed evidence: Run 4 re-observes the same detection entry with standaloneDurationMs and laneRerunDurationMs (so-8f99dd008608) and, for the first time, writer-issued proof facts (so-12d5a26fbfac). Neither identifies the two compared executions, their measurement assertions or the comparison's issuance. Still needed: those identities and their issuance. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009 for the duration individual and for a decision that consumes a distinct comparison record.
  - Consulted: `so:sha256:8f99dd0086080f972c55de23dc0457bea7fb782bf92c2ef41686163dbc03ebbc`, `dh:vfy-flake-detection:001`, `so:sha256:12d5a26fbfac613f030ac0f2edcaed9456998ba2a6f820e02176bb9abb4b3fa3`
  - Rows: `so:sha256:91988c625516a3fa1516b592a7dc4c6b197b56249390fde1fc1e116867ae1af3`

## C(iv) qa-and-conformance-evidence (4 rows)

*QA stages and conformance packages.*

**Run 4 shows.** Run 4 adds the W6 planner contract and a lane-plan golden, and the contract points to a live-replay report, but no QA record/extract/judge chain and no independently issued conformance package is on the surface.

**Recommendation.** `unresolved` for all 4 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Treat the lane-plan golden as a conformance artifact. Rejected: it is a planner test fixture, not a package with suite, build, inputs and issuance.

**Sitting decision.** Keep the QA-stage duty as an evidence requirement; record the CQ barrier for the suite-specification and replay-result duties.

- Duty `qa-and-conformance-evidence-d1` (1 row; prior text sha256 `8ffa6ba09258`)
  - Fresh needed evidence: Run 4's prose surface has the W6 planner amendment and a lane-plan golden (po-5e3730ea652a, po-0030b2144c3e) and a pointer to a live-replay report (po-a4d81c76e170); none is a record, extract or judge stage of a QA run. Still needed: one provenance chain joining the three QA stages to an in-scope Yeet or CI lane, its frozen tree and cache epoch, and the assurance obligation that consumes the result.
  - Consulted: `po:sha256:0030b2144c3e01002444ec77890baaad11b77ebfe67a2d4b6994e59fd5baae43`, `po:sha256:5e3730ea652ac4482c32856ad9810d7239e5841b3236e48748e7644dd842f94c`, `po:sha256:a4d81c76e170bb1692ab847b24189cf548ae5939ecf5ef3965aa3aefe0fcb792`
  - Rows: `po:sha256:3bf3cf7f37f4e3e046efb12751c4b9650dd3a2a16a0c99a1ec17563fa551048a`
- Duty `qa-and-conformance-evidence-d2` (3 rows; prior text sha256 `4a9f83441747`; CQ barrier)
  - Fresh needed evidence: Run 4 adds the W6 planner contract (determinism and errors, po-e97f691ea561, po-ef1a43d8c859), states that admission v1 and emission v2 are unchanged with a byte-equal golden (po-5e3730ea652a), and points to a live-replay report not transcribed here (po-a4d81c76e170). No independently issued conformance package, suite specification or replay-result artifact with issuance and custody appears. Still needed: the package manifest chain and the identified replay execution with result lineage. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009 for the separate suite specification and the separate replay-result artifact.
  - Consulted: `po:sha256:a4d81c76e170bb1692ab847b24189cf548ae5939ecf5ef3965aa3aefe0fcb792`, `po:sha256:e97f691ea561b37b93db3bee1bdb0de54a0c40a1b9809a47a459e3ec3025e248`, `po:sha256:ef1a43d8c85966a859f010500e53f554d45e12f1e47b0ebc0190721829cf96ca`, `po:sha256:5e3730ea652ac4482c32856ad9810d7239e5841b3236e48748e7644dd842f94c`
  - Rows: `po:sha256:059c20e6b0972ff269acf52884fea9e75f4fc5144fac7728dbac333221866181`, `po:sha256:06dd8aab73f74fd680b9cf55a760da82d4a3420f91fc8ea9d8bdb27c4c000d57`, `po:sha256:2338c92205c5fc08e5e18d149e7aabca98b83589cf5984e6b83fa81b2401a98c`

## C(iv) workspace-package-identity (7 rows)

*Workspace package identity.*

**Run 4 shows.** Run 4 reads no package graph or workspace manifest (the TS adapter stays a non-trigger), so package identity appears only as names in curated change titles and a detection entry.

**Recommendation.** `unresolved` for all 7 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire because run 4 has no package observations. Rejected: absence from this capture is a scope choice, not evidence that package identity is irrelevant, and CQ-004 needs PackageRef.

**Sitting decision.** Keep the seven rows on the package-continuity contract under CQ-004.

- Duty `workspace-package-identity-d1` (7 rows; prior text sha256 `1f530ead4f01`)
  - Fresh needed evidence: Run 4 reads no package graph, topological order or workspace manifest (the TS adapter stays a non-trigger); packages appear only as names in a curated change title (po-c1e5823a1716) and a detection entry (so-8f99dd008608). Nothing decides rename, move, version change, fork or delete-recreate. Still needed: an authoritative package-identity policy with observed lineage across those cases, under CQ-004's PackageRef.
  - Consulted: `po:sha256:c1e5823a17169f61139ee8782f7f97e45533ca31792c47cb840fc9e7e315b7ea`, `so:sha256:8f99dd0086080f972c55de23dc0457bea7fb782bf92c2ef41686163dbc03ebbc`
  - Rows: `po:sha256:08a398bab03363136254e3e9c3ed49ebb16ffd18fb94b434111d4446cdf50d69`, `po:sha256:1189ec1eca4fb79695201186157334124e71372bbe906bb6119996f42b9fe842`, `po:sha256:13b29fc0bebcac4b0914db214f136add0fa739ac50af65649c800b7013ccb67a`, `po:sha256:1c941c2e1e41a932dfd00e48631a9dd6217c6e51fe9c681369139a8c0402ea84`, `po:sha256:28e700021c9b4ba707087650a4e39ceed6540863e4d99b02af241b2b0fdbcaf8`, `po:sha256:2f816bb5f468d1cc4a06de84c4a9bb8e4c9393a070c41e364f53d951cbf172e1`, `po:sha256:51a827390306ccb0cf37e23d646c653fd4291f3ed346ae04e097e678a5097781`

## C(iv) dependency-and-selection-contracts (9 rows)

*Package ordering, docgen selection and affected-task selection.*

**Run 4 shows.** Run 4's ordered positions are lane steps derived from a lexicographic gate-order rule, not package positions; docgen and affected-selection changes appear only as dated curated ledger rows.

**Recommendation.** `unresolved` for all 9 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Read lane-plan laneStepIndex as the package-report ordering. Rejected: the contract derives lane order from a gate-order handoff and forbids reusing ordering-cluster terms; lanes are not packages.

**Sitting decision.** Keep all three duties; record the CQ barrier for the docgen-selection specialization duty.

- Duty `dependency-and-selection-contracts-d1` (6 rows; prior text sha256 `2c2753935504`)
  - Fresh needed evidence: Run 4's only ordered positions are lane steps (laneStepIndex, po-50062eb61a9b) derived by a lexicographic gate-order rule, with precedence derived from the index (po-9a020d6aeb34) and ordering-cluster terms barred from reuse (po-79f91eaae90c); lanes are not packages. No package-report contract is on the surface. Still needed: the contract that defines the report's numeric positions, ordering algorithm and dependency-edge meaning, the producing graph and version, and the verification decision that consumes it.
  - Consulted: `po:sha256:50062eb61a9b9c374285d41ac93a36b9fc0597810b4579860a8ba5ce63d4787f`, `po:sha256:9a020d6aeb341cdb7dbfa22d366e70a67a9785f8e5a576883302a996b95cbaf5`, `po:sha256:79f91eaae90c87e6a30b77aead2a836deadc1fe4d307a39f3c1532a9078a45cd`, `dh:lpl-lane-step:001`, `dh:lpl-lane-order-rule:001`
  - Rows: `po:sha256:5a59d414027abf00522737e1d86c7976c6837e7dcf88eb47112cc39709b2be1d`, `po:sha256:62ae30cfc28b391c7bf4a87534abeba849a8ca2ebd5f8ebe72cb5af81dcc50eb`, `po:sha256:64463ef1e1f2b77cb50713f8194bb055d35d02288f465e6902e337f9fc5f5edf`, `po:sha256:6e598d379ffd2f0565176b337833e4eedf0293941fa87936078ee572e63748a9`, `po:sha256:89165acdfec28c3a8692c411aead416ca1fd5f13333c0ea5c748e92aeab0cb98`, `po:sha256:90fa083c4887641658c0239762b509fd6c9bacc6f14cf29ee392ce08714572ff`
- Duty `dependency-and-selection-contracts-d2` (1 row; prior text sha256 `ee4cb2f6d34e`; CQ barrier)
  - Fresh needed evidence: Run 4 has only curated change rows about docgen selection: the local check gating directly selected packages (po-c5e4a3fa5cb9), the full proof running the metadata check (po-29ec308ddb8b) and a stray config removal (po-702c9ad1e7b9). These date changes; none is a selection artifact binding base, head, dirty snapshot and selected members. Still needed: that artifact and an independently versioned selection-rule authority. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009 for the specialization and the rule-versus-result specification.
  - Consulted: `po:sha256:c5e4a3fa5cb9cca578d93207a4aadc2c418e7d3186187c27493b1a5467c54826`, `po:sha256:29ec308ddb8ba42273b33b41212d92fc8dcb32afcc10bf4c04bccce61750e450`, `po:sha256:702c9ad1e7b9982dde9e8d3f63c4f83d4b1bbfafd5527ce6ddc302c9f21e639f`
  - Rows: `po:sha256:795d76d79fdc3ad235d204aee98c96f70dcdb10704c927558f31012749553995`
- Duty `dependency-and-selection-contracts-d3` (2 rows; prior text sha256 `3ba462d018dc`)
  - Fresh needed evidence: Run 4 has a curated change row on the coverage --affected planner's owner mapping (po-c1e5823a1716) and the ScopeKind domain with its affected member (po-be43f502f1ad); neither is a governed selection run. Still needed: the normative contract for how task inputs change membership and whether failure opens or closes the selection, an observed selected set under it, and the verification decision that trusts it (CQ-004 and CQ-019 are the existing warrants).
  - Consulted: `po:sha256:c1e5823a17169f61139ee8782f7f97e45533ca31792c47cb840fc9e7e315b7ea`, `po:sha256:be43f502f1ad33703d83d596ab8d0a2b65e4fa6282a305a88878758f3b126668`
  - Rows: `po:sha256:9cbd50f3655b7ae7102a1be9bfcfe939528b3eaebd0dc33257408365f9402062`, `po:sha256:a1f8202d5ff295e75dd7ad3f50f9454dad4bc2d53677e5936a6a0812250c5e43`

## C(iv) capacity-computation-and-snapshot (7 rows)

*Capacity computation and admission snapshot.*

**Run 4 shows.** Run 4 adds the admission charge per work kind and a hard-floor exception derived from a snapshot-global flag, but no run-4 observation carries a pre-grant capacity value or capacityAtAdmissionTokens.

**Recommendation.** `unresolved` for all 7 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Answer CQ-010 from weightTokens plus reconstructed totals. Rejected: the charge is a claim, not remaining capacity, and fa:vfy-admission-charge:001 keeps the snapshot-dependent reading open.

**Sitting decision.** Keep the computation duty under CQ-010; record the CQ barrier for the AdmissionSnapshot duty.

- Duty `capacity-computation-and-snapshot-d1` (2 rows; prior text sha256 `8774ef40fe36`)
  - Fresh needed evidence: Run 4 adds the admission charge per work kind (otp:vfy-admission-charge:001; 5, 3 and 1 tokens for merged-preview, full-proof and review-fix) and the hard-floor exception derived from a snapshot-global flag (po-ed915fad850a). No run-4 observation carries a computed remaining capacity or capacityAtAdmissionTokens, and fa:vfy-admission-charge:001 keeps a snapshot-dependent reading open. Still needed: the authoritative computation (unit conversion, reserve, hard floor) and a provenance-preserving join from its value to one observed admission, under CQ-010.
  - Consulted: `dh:vfy-admission-charge:001`, `fa:vfy-admission-charge:001`, `otp:vfy-admission-charge:001`, `po:sha256:ed915fad850ac373459d8a97baa970bde072b7cc7cda3aeb0db0a4a2c3e89b75`
  - Rows: `po:sha256:3c757a7975b27b8597ccf8c6d886eb72ad2b8b51aaba8eb59cf21cc9a1a7a3c6`, `po:sha256:518aee86882c8b9092469203add3bc23c72acfed1d7139f136a96e8763f0c8c7`
- Duty `capacity-computation-and-snapshot-d2` (5 rows; prior text sha256 `976f10710d5d`; CQ barrier)
  - Fresh needed evidence: Run 4 checked for a pre-grant capacity stamp: the lease state record (so-a8d270b5e19d) carries admission members and a heartbeat but no capacity value, and AdmissionSnapshot is named only as the source of the hard-floor flag (po-ed915fad850a). No pinned query traverses an AdmissionSnapshot. Still needed: a captured snapshot with its capture instant, machine and policy scope, correlated to the pre-grant decision. Named missing decision: a Must/Should CQ is required and run 4 admits no CQ edit beyond CQ-009 that traverses the snapshot.
  - Consulted: `po:sha256:ed915fad850ac373459d8a97baa970bde072b7cc7cda3aeb0db0a4a2c3e89b75`, `so:sha256:a8d270b5e19db57e5018ec2995ada6953c3306d8d585d72e1e5be947eddb3192`, `fa:vfy-admission-charge:001`
  - Rows: `po:sha256:6b31f817391e66aab8fc9796fed0c0bbdbd8285c9e86438e9172d1ce6bbaef61`, `po:sha256:8a555d65d66a8d7f44336fdb4ce8816f5a033a6ce448e311dc29615bfd8f41f2`, `po:sha256:8af3333c97798f24aeecfa40f40faefcf152f96fffb6717f647eabf0f5250a92`, `po:sha256:95037a7104c1dbd21fc02aeeeb45733f744c10ba07ea4c5db2a94db62d88e95a`, `po:sha256:95b57e4f4029739dacb78d5caa9b43939b1820fc17d3785a9ff32181d7d0e0b6`

## C(iv) origin-and-heartbeat-policy (5 rows)

*Origin-block and heartbeat-suspicion policy.*

**Run 4 shows.** No run-4 observation carries blockedOnOriginAtMillis, the change ledger dates the per-origin lock's retirement, and CQ-009 now holds an origin arm only as a legacy drain; the two organic lease evictions end about 4 s and about 30 min after their last heartbeats under the same reason, so no single staleness threshold is visible.

**Recommendation.** `unresolved` for all 5 rows, with fresh needed evidence per duty below.

**Rejected alternative.** Retire the three origin-block rows because #929 retired the per-origin lock. Rejected: the ledger row is observational seed data, the rows were observed after #929 landed, and CQ-009's legacy-drain arm still needs the origin regime.

**Sitting decision.** Whether origin-block semantics are now asked only through CQ-009's legacy-drain arm (re-word next run) or kept under CQ-023's starvation policy; heartbeat duties re-park unchanged in substance.

- Duty `origin-and-heartbeat-policy-d1` (1 row; prior text sha256 `35b46123102e`)
  - Fresh needed evidence: Run 4 carries no blockedOnOriginAtMillis member on any observation. The change ledger dates the per-origin lock's retirement after drain (po-2654950d9b96, observational), the lease state record runs under scheduler-origin-concurrency/v1 (so-a8d270b5e19d), the protocol stanza is v2 with eviction=on (so-a815a77c32ca), and CQ-009 keeps origin sharing only as a legacy-drain arm. Still needed: whether the grace rule still applies after the drain, and if so its threshold, unit, both consequences and one observed origin-blocked case governed by it.
  - Consulted: `po:sha256:2654950d9b964315bef9ac21e038fdd3078b24b9c8a88692dc9f4002854079b6`, `so:sha256:a8d270b5e19db57e5018ec2995ada6953c3306d8d585d72e1e5be947eddb3192`, `so:sha256:a815a77c32ca00312a65d7b9c83e4bd0fc2a08938f4a1203e6072e1ab1fccefa`, `dh:vfy-coordination-protocol:001`
  - Rows: `po:sha256:79df3741e52f870a9c5d7ac0f3c76fc333a1341bf8f15c7a7720f2b6982e88b3`
- Duty `origin-and-heartbeat-policy-d2` (2 rows; prior text sha256 `b095017fb7fe`)
  - Fresh needed evidence: Run 4 has two organic lease evictions under reason owner-dead-or-reused whose last heartbeats precede eviction by about 4 s (so-860cff0d673e) and about 30 min (so-a9ed1352e2bc), with eviction=on in the protocol stanza (so-a815a77c32ca). The two gaps show eviction is not read off one staleness interval, and no run-4 observation carries a suspicion threshold or its unit. Still needed: the deployed suspicion threshold and unit, an identified suspected holder in an observed stale-heartbeat case, and the rule separating suspicion from the owner-death check that authorizes eviction.
  - Consulted: `so:sha256:860cff0d673e93aaa9ec8db4d85fe43cfdd89d22b92e5ba29966346fee8a35a1`, `so:sha256:a9ed1352e2bca5c2c3ca9f5bff72e936dd668a90cc4f1842ba3512cf9dd29020`, `so:sha256:6f5b7aebafecd74f1991f241f2ab447da364d854ef9a8f3d6a8352a532a8dcf8`, `so:sha256:a815a77c32ca00312a65d7b9c83e4bd0fc2a08938f4a1203e6072e1ab1fccefa`, `so:sha256:a8d270b5e19db57e5018ec2995ada6953c3306d8d585d72e1e5be947eddb3192`
  - Rows: `po:sha256:cb78d031658bfe80535beb490352c2086b2b8f629e3819df4fba336fbeb37598`, `po:sha256:cb9064130b643be08d25e627bcfc5264739ac1397a236d353835b473c2df5734`
- Duty `origin-and-heartbeat-policy-d3` (2 rows; prior text sha256 `5394c0e56b55`)
  - Fresh needed evidence: Run 4 carries no blockedOnOriginAtMillis value and no originBusy wait on any observation; the per-origin lock's retirement is dated in the change ledger (po-2654950d9b96), and the starvation exception table names only the hard-floor exception (po-ed915fad850a). Still needed: an interpreted origin-block onset with its unit, the same ticket's observed origin wait, the starvation-policy decision under CQ-023 that uses it, and revision provenance across the ticket's transitions, or a ruling that post-drain origin questions belong to CQ-009's legacy-drain arm only.
  - Consulted: `po:sha256:2654950d9b964315bef9ac21e038fdd3078b24b9c8a88692dc9f4002854079b6`, `so:sha256:a8d270b5e19db57e5018ec2995ada6953c3306d8d585d72e1e5be947eddb3192`, `po:sha256:ed915fad850ac373459d8a97baa970bde072b7cc7cda3aeb0db0a4a2c3e89b75`, `dh:vfy-coordination-protocol:001`
  - Rows: `po:sha256:e362227f9f3d78e8fcb933ddf9f5523b1ef97776a2546ad12c7f702c33fc1cdd`, `po:sha256:edf38d10efe0552b7de770a0cc24a9596cc4b5141b693889e987465f4174b4bb`
