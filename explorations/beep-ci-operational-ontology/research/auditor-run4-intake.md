# Auditor run 4 intake docket (pre-pin draft)

Assembled 2026-09-11 from main `e16e7a9297` as a **pre-pin draft**: no run-4 pin commit exists
yet, every count and digest below is re-verified at the pin, and queue placement is an
instruction to review evidence, not ratification or a claim that any named evidence requirement
has been met. Run 3 is complete and ratified (`orun-2026-09-10T02:10:52Z`, pin `1c7cd98289`,
PR #1078); the S5 gate amendment and the run-2/run-3 projection are on main (PR #1089); auditor
skill v15 is on main (PR #1092). This docket applies the run-3 corpora design rulings 1–16, the
Stage B rulings 17–21, the residue rulings 22–23, the run-3 launch entry, run-3 sittings 1–3, and
the S5 gate amendment rulings in `DECISIONS.md`. Nothing here re-litigates a ruling.

Path abbreviations are packet-relative unless explicitly repo-relative:

- `ONT` = `ontology/extraction/s4/beep-ci-ops`.
- `ARCH` = `ontology/extraction/s4/archives/beep-ci-ops`.
- `INDEX` = `ONT/runs/orun-2026-09-10T02:10:52Z.index.yaml`.
- `CORPUS` = `ONT/corpus`.
- Run-3 seat trees, sittings, review audit and gate logs are live under `ONT/work/`, and
  rat-053..rat-070 under `ONT/governance/ratifications/`, until the run-4 pin lane rotates them
  byte-identically to `ARCH/orun-2026-09-10T02:10:52Z.{work,governance}/` (the run-3 shelter
  recipe; validator v14+ refuses record-prefixed files under `runs/`). Their S5/S6 projection is
  already discharged (#1089), so the rotation is a clean pin this time.
- Run-2 records stay in `ARCH/orun-2026-09-03T02:46:18Z.*`.

## Gate: time-to-certainty C4

Run 4 proper does not launch before `goals/time-to-certainty` C4 (the proof-ledger writer). At
`e16e7a9297` that packet's `PLAN.md` still shows C3.3, C3.4, C3.5, C3.6, C4a, C4 and C5 unchecked.
Ruling 17's issuance and custody duties (Queue B: rat-047/048/051/052) and every C4-routed row
below cannot discharge before it. The gate is hard: the pin lane re-reads those checkboxes, and
if C4 is not checked it records the state in its report and stops without creating a pin, tag,
manifest or seat. Only a steward ruling scribed in `DECISIONS.md` can amend the gate; this docket
supplies no fallback.

## Prior-run chain (validator-enforced)

The run manifest must carry exactly:

```yaml
first_run: false
prior_index: runs/orun-2026-09-10T02:10:52Z.index.yaml
prior_index_sha256_12: b9c140ccd31b
```

The digest was recomputed from the committed index bytes at `e16e7a9297` and equals the value
the run-3 closeout recorded. Its 284 rows comprise 37 `proposed`, 77 `mapped`,
138 `unresolved` and 32 `irrelevant`; 84 of the 216 live rows and 54 of
the 68 carried rows are `unresolved`. All 138 unresolved observation ids appear exactly once in
Queue C below. The manifest requires each to be re-opened with new evidence or explicitly
accounted for through `carried_from_prior`; a verbatim re-park is rejected by the validator.
Run 3's gate arithmetic (84/198 = 42%, no waiver) is historical authority, not an automatic
waiver for run 4.

Engine v15 additions to the manifest: every `agents.<role>` entry carries `effort` (the launched
reasoning-effort setting; `default` for a model without an effort control), and the engine
digests are recomputed at the pin. Today, informationally: validator `fdbcefc9fd70`, framed
contracts `dcc8da4cc7f9` (21 files), `prompts/denotation.md` `ddec132ee905`, SKILL.md
`a12de4055976`, sandbox runner `ecb6dcab421b`; the other four prompts are unchanged since run 3.

## Queue by source

### Queue A: flagged accepts' deferrals (TAXONOMY `flags`)

Every accepted term whose TAXONOMY record carries `flags` after #1089 is listed with the
ratification that flagged it. The flag text is the verbatim deferral clause of the accepting
decision; the duty is what run 4 must observe to lift it. Lifting a flag is a sitting decision.

**Ordering cluster (rat-053..rat-065, ratified together at run-3 sitting 3, Ruling 1).** The four
sitting-1 Ruling-4 deferrals ride the cluster: token-charge repricing, rule-versus-application
identity, demand continuity and episode unity. Routing: the Stage C capture (organic admission
chains with repricing or resubmission), the emission-v2 fixture and Turtle sites for
rule-versus-application identity, and the C4 proof facts for episode closure. The cluster lifts
or re-flags together, as it ratified.

- **ScheduleProposal** (class, `rat-059`): with issuance-versus-content identity deferred to run 4 as flagged and its episode, governing-specification and request endpoint flags retained within the joint ordering cluster.
- **SeatRequest** (class, `rat-061`): with demand-versus-description grain and handling/resubmission continuity deferred to run 4 as flagged.
- **admissionChargeTokens** (property, `rat-053`): with repricing, assertion replacement, request/grant continuity and pre-admission capacity evidence deferred to run 4 as flagged.
- **hasOriginKey** (property, `rat-055`): with repository-origin identity and normalization deferred to run 4 as flagged, within the joint ordering cluster.
- **hasCurrentProposal** (property, `rat-054`): with the episode identity flag retained and any operational selection-situation identity deferred, only with joint ordering-cluster ratification.
- **AdmissionProjectionSpecification** (class, `rat-056`): with rule-versus-application identity explicitly deferred to run 4 as flagged and no equation of rules with input-bound contexts.
- **hasProjectionSpecification** (property, `rat-057`): with AdmissionProjectionSpecification's rule-versus-application identity flag retained, only with joint ordering-cluster ratification.
- **hasStep** (property, `rat-058`): retaining the component-versus-tuple choice as flagged and ratifying it only with the complete ordering cluster.
- **ScheduleStep** (class, `rat-060`): with tuple-versus-component and editable-instruction continuity retained as flags, only with joint ratification of its proposal, membership, position, request and scope relations.
- **stepIndex** (property, `rat-062`): with the quality, precedence and reified-assignment alternatives retained as flags, only with joint ordering-cluster ratification.
- **schedulesSeatRequest** (property, `rat-063`): preserving the distinction from WorkUnitSpecification and carrying SeatRequest's continuity flag, only with joint ordering-cluster ratification.
- **hasScopeTag** (property, `rat-064`): with annotation/classification identity retained as flagged and object-valued hasScope/Scope still parked, only with joint ordering-cluster ratification.
- **VerificationEpisode** (class, `rat-065`): with process/event category, unity, attempt membership and closure identity explicitly deferred to run 4 as flagged.

**Recorded-value reuse mappings (rat-066..rat-070, sitting-3 Ruling 2).** SeatGrant carries
rat-066 (`otp:admb-seat-grant:001`) on its TAXONOMY record; rat-067 (`otp:admb-seat-request:001`,
SeatRequest), rat-068 (`otp:att-admission-allocation:001`, SeatGrant) and rat-069
(`otp:att-verification-attempt:001`, VerificationAttempt) ride `later_ratifications` on their S5
DISPOSITIONS rows with the reuse grain in the justification; VerificationResultArtifact carries rat-070 at assessment-origin
grain. Routing: account-copy identity and effective authorization continuity need organic
lease renewal/transfer chains (Stage C); demand-versus-description grain needs an organic
withdrawal/resubmission chain with both ticket records (Stage C); equal-content assessment,
copy/correction and issuance identity wait for C4 (Queue C(iii), Queue D).

- **SeatGrant** (class, `rat-066`): with account-copy identity and effective authorization continuity deferred to run 4 as flagged.
- **VerificationResultArtifact** (class, `rat-070`): with equal-content assessment, copy/correction and issuance identity deferred to run 4 as flagged.

### Queue B: flagged provenance items rat-047 through rat-052 (run 2)

None of the six run-2 flags was discharged at run 3 (sitting-3 Ruling 3): rat-047, rat-048,
rat-051 and rat-052 re-parked to run 4 under Ruling 17; partial result-record evidence was
recorded against rat-048 and rat-051 without lifting their flags; rat-049 and rat-050 stay open
as contract and governance duties. The verbatim decisions and evidence requirements below are
carried from the run-3 docket (records in
`ARCH/orun-2026-09-03T02:46:18Z.governance/ratifications/`).

#### rat-047: `otp:jv-merge-readiness-assessment:001`

> Accept the merge-readiness VerificationEvidence reuse, provenance identity deferred to run 3 as flagged.

> Authoritative generation, issuance, custody, copy, correction, and claim-realization provenance across heterogeneous VerificationEvidence instances is required to decide content versus carrier identity.

Run-4 routing: **waits for C4.** The proof-ledger writer is the first source of issued claims;
until it exists the run-3 attempt/verdict projections support record-level review only.

#### rat-048: `otp:pa-projection-limitation-report:001`

> Accept the limitation-report VerificationResultArtifact reuse, result-provenance identity deferred as flagged.

> Authoritative result formation, issuance, producer, custody, copy, correction, and revocation provenance across heterogeneous VerificationResultArtifact records is required to choose content, record-token, or carrier-lineage identity. A separate limitation-report term additionally requires independent issuance and a Must/Should CQ that consumes it apart from the containing result.

Run-4 routing: **waits for C4** for the result-provenance identity; the run-3 partial
result-record evidence (embedded verdicts, the S7 replay report) stays recorded against the
flag without lifting it. The separate limitation-report term still needs its own independent
issuance and a Must/Should CQ that consumes it apart from the containing result; neither exists.

#### rat-049: `otp:pa-yeet-verification-workflow:001`

> Accept the yeet-workflow VerificationPlanSpecification reuse, plan-identity contract deferred as flagged.

> An authoritative identity contract across heterogeneous verification plans must define content, contextual-copy, replacement, and revision identity. A separate Yeet specialization additionally requires governed authority and version lineage deciding whether cheap-gates, review-fix, and monitor are one plan or coordinated subplans, plus a Must/Should CQ requiring it.

Run-4 routing: a **contract duty independent of C4.** Discharge needs an authored plan-identity
contract (content, contextual copy, replacement, revision) that the yeet planner and lane plans
are observed to follow, plus, for the Yeet specialization, the governed authority and version
lineage deciding whether cheap-gates, review-fix and monitor are one plan or coordinated
subplans and a Must/Should CQ that requires that decision; the run-3 checkout bindings supply
revision context only.

#### rat-050: `otp:pb-admission-priority-class:001`

> Accept AdmissionPriorityClass, registry lineage deferred to run 3 as flagged.

> Run-3 evidence must identify the authoritative priority-class registry, version and revision lineage, membership-change rules, and whether planner versions share one governed domain or issue semantically distinct copies.

Run-4 routing: a **governance duty independent of C4.** The `AdmissionPriority` LiteralKit and
the S6 POLICY priority enumeration are registry evidence; the missing pieces are the governed
membership-change rule and the shared-versus-copied domain decision across planner versions.

#### rat-051: `otp:pb-planned-lane-status:001`

> Accept the planned-lane-status VerificationResultArtifact reuse, result-provenance identity deferred as flagged.

> Authoritative result formation, issuance, producer, custody, copy, correction, and revocation provenance across heterogeneous VerificationResultArtifact records is required to choose content, record-token, or carrier-lineage identity. A separate planned-lane-status term additionally requires retained issuance, parent-attempt and execution joins, and a Must/Should CQ that consumes it separately.

Run-4 routing: **waits for C4** for the result-provenance identity; the run-3 parent-attempt
joins are recorded, not discharging. The separate planned-lane-status term still needs
retained issuance, the parent-attempt and execution joins, and its own Must/Should CQ.

#### rat-052: `otp:pb-verification-evidence-receipt:001`

> Accept the evidence-receipt VerificationEvidence reuse, claim-formation provenance deferred as flagged.

> Run-3 must provide authoritative claim-formation and realization rules plus issuance, producer, custody, copy, retention, correction, and revocation provenance across heterogeneous VerificationEvidence records.

Run-4 routing: **waits for C4** (claim-formation rules are the writer's contract).

Queue B totals: **6 flags**, **4 re-parked to run 4 under Ruling 17** (047, 048, 051, 052) and
**2 duties on the contract/governance route** (049, 050).

### Queue C: all 138 unresolved index rows

The four buckets are disjoint and total 138: 84 live rows in C(i)–C(iii) and the 54 carried
run-2 rows in C(iv). Counts are observation rows, not proposals or terms. The id census is copied
mechanically from `INDEX`; every `unresolved` id appears exactly once. Each bucket states what
run 3 showed and what run 4 must add; the index-close lane writes that as fresh `needed_evidence`
with the run-4 `since` date, never the run-3 text.

| Bucket | Rows | Meaning |
| --- | ---: | --- |
| C(i) | 14 | Live corpus-addressable duties: the Stage C capture, a scripted checkout-cache experiment, a verdict consumer, or CQ work can decide them. |
| C(ii) | 3 | Live decision-gated rows: a consuming decision or executable CQ must exist before evidence can be sought. |
| C(iii) | 67 | Live identity-experiment rows: the journal-entry duplicate-payload trace, the allocation double-count trace, and the VerificationResultArtifact content-snapshot rival. |
| C(iv) | 54 | Carried run-2 rows re-parked at run-3 sitting 2 (Rulings 2 and 3), grouped by the sitting's fifteen clusters. |
| Total | 138 | Every unresolved observation id exactly once. |

#### C(i): corpus-addressable duties (14 rows)

**ov-token-charge-removal** (3): three ov rows: the removed token charge needs the corresponding journal chain or a liveness/reaping event tying it to a particular active grant and instant (Stage C capture).

  - `po:sha256:519764a98f511e5f2137e8eb2d6b072d92d27b62a4417db97040359034bb3282`
  - `po:sha256:a3b740b147b88dd94b092bee660c397cabadbbed2f35ddd14b6347c6ccb2f3fe`
  - `po:sha256:f41f8934b51e0e14a0344efa0b46898ea051035f811e3cee5e8de69c1bf43e2a`

**seat-grant-organic-chains** (1): the synthetic SeatGrant operational reading; organic lease-eviction/renewal/transfer chains joined to an independently identified holder (Stage C capture; mirrors Queue D).

  - `so:sha256:27fc89410ea6dbdacff098a5500ba7a968df33a96e89d47c65b107e436fc301f`

**recovery-durations** (2): detection-and-recovery with standalone and lane-rerun components; needs independent execution boundaries before a complete duration can be derived (C4 proof facts).

  - `so:sha256:37968f126c464470a069ac2051cb358a0a29720dd49df7256625cb4d17bfa2c6`
  - `so:sha256:928e7ce7acb4292bbd03703746cd347b6fd0aeeb2c144ee33188512f3ff91939`

**assertion-boundary** (2): the assertion's emission/recording boundary versus the attempt boundary and record retention; needs the missing starts and admission joins (Stage C capture plus C4).

  - `so:sha256:650d8047f7efde8b68d19380b2c6229f038cc3c6c0290f1045d4feaca7b71a98`
  - `so:sha256:68c2cc4f0ebf9f6acb48375aa66da02ca62db1610e969434dc8e714502ef2d1f`

**checkout-cache-binding** (2): the same-cache accessibility/transfer experiment at task-input-hash and epoch grain with two checkout identities and separate probe times (a scripted run-4 capture, `run4-checkout-cache-binding-identity-consumer`).

  - `so:sha256:a90c39610e4a49911ace23bfa329876914961182bc6fbf2b9e8049b49ad3e3b9`
  - `so:sha256:f4532e29f3f1752921effc1f49c1712e5662464ce09f553e1f81130927db3e6b`

**comparison-operand-binding** (2): an explicit comparison-operand binding and an observed validity decision that depends on the result (yeet verdict consumer).

  - `so:sha256:d8cf8154d2e1435f81698ec0c8d67ea4bce53283ef275029392ce1a2d2f2f03f`
  - `so:sha256:f353b053a061870ff15017fd51401ea9165d54f608052fa1ea8daea981cf5d73`

**wall-time-evidence-class** (2): a Must/Should CQ requiring a separately identified wall-time evidence class plus an observed consumer (CQ work, not capture).

  - `so:sha256:ebe4cdcf6e9eec35f3ac468a4e21b559e27b550b221042d8266b1bb55b3d3b30`
  - `so:sha256:f025dca6b8335e444986f450f43d7970deb3f4209456efce8a23a5e1c065d446`

#### C(ii): decision-gated rows (3 rows)

**governing-specification-comparison** (1): a concrete decision consuming the comparison record or a demonstrated dependency under an existing question.

  - `po:sha256:2cc77ae5391bd35d736242a9fff5ee6d2e64ee35cc18a420060b5a541f947ca6`

**deferred-tail** (1): a decision that requires identifying requests omitted from the prescribed sequence.

  - `po:sha256:f60ddfb04ede510a8ffe6a04a36eac20caeb92175e59245f6b436897c83907b8`

**assessment-model-selection** (1): two assessments of one explicitly identified PR/head changing a single component (proof-ledger issuance, C4).

  - `so:sha256:34866c142b067589cef10ea45947b1e31d1f7ae8e7518b45d705f5df5a3d31ee`

#### C(iii): identity-experiment rows (67 rows)

**journal-entry-duplicate-payload** (25): 25 admission-journal rows whose identity question needs a trace with two entries of identical semantic payload, independently distinguished emission occurrences, revision links and an observed consumer treatment; this is the AdmissionJournalEntry withdrawal's named evidence (Queue D).

  - `so:sha256:01fe79ebf1f0cc28550c21c941e0c4ff963cbbbcff28cffe712d9b026288d99a`
  - `so:sha256:0385cf6e12920c8a96c520a7238b522f923a7c0116cd603fbeff793a7d0e6058`
  - `so:sha256:05fa73f187683c8b5cfb25a3958ed5b6f3d344d1b984cb1ce1cdffe5a9b2674a`
  - `so:sha256:0775b5fd356eaea7604537054326c7e97598c5f81504c0d815558297ebf0f50e`
  - `so:sha256:08149709f365cd0031ec1a4a17e6f76e957b70a4507b8c15e077e41ec998abce`
  - `so:sha256:10f2cebc7b17c5f7b15bd051ed0f0363d355c3e4cb2f927dd2b2852461ad2610`
  - `so:sha256:146d2b385ef6e3fb892821dbd2df82091184f2dca48f8cd9b9eaa5d01019d942`
  - `so:sha256:3b7f2e1876cc9602c8f4b911bdfec4bf8eb8b9a8355cec317b4e81bc900d2059`
  - `so:sha256:4a98ae2d71bc800fd8718d37ccc93288cf66cc48dbffa2eddc2a0c7c3297a7d6`
  - `so:sha256:522ce0efbf2933dac38a6f574c2ff640dadb305b695e06028dad7a5c0f25d91c`
  - `so:sha256:65609cedeaf3e99b51031c38b99ab7bc16ea0ef59fa66bea1d446ef3f7bd3333`
  - `so:sha256:6cf1d332ce7ea225c24cf5aea2e2192ab91ec06838463289be284bae7677e60c`
  - `so:sha256:7627bd8803b5da11524904bb2c7b2fdcd7c320ba034444204852ded9c164cfff`
  - `so:sha256:7e4e7d3c3f97a3907222c12d770c3f618aa1502dc1fd391f0738fd93f874dbbb`
  - `so:sha256:91d2cd56cb62e64ab02890e9792e172bcd9350420a034a74fda5d8c35367bb4a`
  - `so:sha256:a3d906985080a7bb34c6364829dd3add8d8d0a7235a3b00d027d9e9685e7eb19`
  - `so:sha256:b16055eff4bab382b33f0a5629c273a35a659e407651035b9532fb833f1a722c`
  - `so:sha256:b303cb0ce5ff71bf3353ee50bced00e443bbba7d77e4f3e5cf7e6e8476d054aa`
  - `so:sha256:b4093c2df6b7863d8c90b35246c348aecbbc5201cc8a3968132345e8e29c038e`
  - `so:sha256:c19aff86102184c4aafeecb71520216ed5ccf721d1d16cce9a382bdd170d1967`
  - `so:sha256:c1e15b1c4eaa7eb7c6aa06fd4e88909368ddeac9931936b7d68c2bf857b1bcfa`
  - `so:sha256:cf8f163c919cdad854f3e9aabddf18a7c7589844a69389646492c47ac1f7d8e8`
  - `so:sha256:dae7bbf3b41b449e027e7be2793340e99e86ffbfbc9e3781a15b2c412919fba3`
  - `so:sha256:e7ddc88d39dcd0ebbfa2a08af2a670b1921da6c0a721d6b64a2a41b179fd1964`
  - `so:sha256:f1e3e6b059c258e89fc802148a2976a93bd0ade9c8e5568b6052d81945140f7a`

**allocation-double-count** (28): 28 lease/accounting rows that need a time-aligned lease-store and admission-accounting trace showing one allocation counted in two decisions for the same independently identified beneficiary (Stage C capture plus the capacity contract of the carried cluster).

  - `so:sha256:0415a4f1590540c534d5ccc9027d36acddbfa4ffdd84445bda5155dac85ac5c6`
  - `so:sha256:05a0dfbb8f434d75b8be6d1bd7d396925b594cb0e9ceb6b72bda31e76e9685d3`
  - `so:sha256:0ac1b790ab6965774fb94a2741caa3d2254ad662e54f761a5ae8744e19e6b7af`
  - `so:sha256:0dcfbaeaa65aeeec90c1e9590be8a33c1ffe9438f29ebbe7d8617d09a5e45b08`
  - `so:sha256:0e50d84bdb1fbc2d463bced37bfe314caf8e1b5a8cc58dd5359978650ab1f53c`
  - `so:sha256:0e797a3deeedd27cfa75082643ce788d6c73e073bf87a640fe50ce3896a43e2b`
  - `so:sha256:126709ea74fec8cb4b03c021d7cf121aac566b19bea91c4ac8a452f33d01a94e`
  - `so:sha256:155a7c875acf08bae8c3073be1e54bebd65f2b8d5192697d7687da967e781ae6`
  - `so:sha256:232151f9f2afc0f8662cbd2c75d368bae594686ce7f0bdbac3e9f7238d6fd062`
  - `so:sha256:27ba4f5468b662c17e401817a599ad4e45c2091d51423b279d8de9fbe97880b7`
  - `so:sha256:2e58e1311fcc9f696bc06624bab0b4e23b6597ee1919f68e1516882ab067b53a`
  - `so:sha256:4bb535144f06b1e9abc6a8c75f0dcc3fc7d030f9b64214adfd1bed92ca384b08`
  - `so:sha256:5130545f45659ac9d904152da47d3e52ab06961250b57d626f3d8afc4993fe42`
  - `so:sha256:563cd0ce4e6678eca1af8e3cf2ff8cc59e08e587eb8853bb6f4b76e3a634dc67`
  - `so:sha256:6108f04e939048617511e050bbb2421593e88c3658829deaead9b406fcb811d9`
  - `so:sha256:636db00ceac88a2c4857664e7f2fb863833b68fe94f1e28a111e3451d3dfcbb1`
  - `so:sha256:675134527a157d157274937b2f8ad90b036d30b77340d61f1e202483d9ac828e`
  - `so:sha256:6abcdc65b395bfc82d08b2c5e49d3c9553e97a46bd942343457e68e8da0a85e7`
  - `so:sha256:7b8493be70e8285a866f898e5691df4cb02c5d51fd808635f508854d1ec5622c`
  - `so:sha256:7f98fb05e2fa6d6b3b08618e7f5af09ecdefc3ff88752bbf437aff900e73036a`
  - `so:sha256:94cda97bb49a7661b4b7bd7ed0cd0f5b8594223ad33ddbf9d9637e464ee5c902`
  - `so:sha256:997fca9994bcb3a70f034acd490a212d79ae083f17c0a18972bdbc8a924a5346`
  - `so:sha256:a4ff1bbe07b6d10ed237650df3bfbe94c9a94240167ba58443ebf37227476301`
  - `so:sha256:ad5ef0f6bca50e85da674990519818fb3d4a14a1650ccb135b89f2f10d875248`
  - `so:sha256:b0aa81e61691ffc2b4ef587508eae988e450f03407eefbfc524fb38a82c20cdc`
  - `so:sha256:cfb413d38b8e8e1903d6e83b8d2977c5fd102003636ca8403eaa958dc1791b6f`
  - `so:sha256:d90be1aaa963b3e017130d2add821e59f623ac0540f9563cd9dd1d607cae8ce9`
  - `so:sha256:e1936767a2458fe5eb08ac5e2ba0887e7ac51f70d06111cead6e54b854e39c17`

**result-artifact-content-snapshot** (14): 14 verdict rows carrying the VerificationResultArtifact content-snapshot rival: two independent equal-content assessments of one attempt whose consumers treat them as distinct or as one, plus issuance/correction provenance (C4).

  - `so:sha256:05bdfd88fe028976d02147ad0bfa51ad66828d2ceae653806a6a947e8374aeda`
  - `so:sha256:1008941903be9f39b5f8ee44d50647d0b02ea0a1988e1712481a22f35e6a0465`
  - `so:sha256:18fe73166f5b7932c1ef8a529b9e26f0975324ad5451673374ff5b24bbfeb91c`
  - `so:sha256:34ba8416b74877505a8a69b9947fcebfab0c62e4f3bbd30218232b857e4539bf`
  - `so:sha256:74b8c4733f1c2049ac998444c4905ba5e016d2f0cd6cf310dc5e6fa7cd414af2`
  - `so:sha256:7947484312042fc0ac6c5bd485427b9cc3a28829e3745b39031f6400a9c1a9c8`
  - `so:sha256:7a639ef29784753fbf47a4860c76a214d945a67c34fe1675915e57253dd3d628`
  - `so:sha256:9078a6ab88adf6e8ae99c1baafab237dd8c100a21fa8425143ca76a0f5bb6fcc`
  - `so:sha256:929aa987fb5e550c58968f28fd06947d1bfd2b788815a77376329f06d9ca765a`
  - `so:sha256:a9a0813fdb533325632faeda662b8fa72b08b1e4868c9cfdf66c29939927dac9`
  - `so:sha256:b24d12302a876d81148174d1247fd84e7d304fababe40bf31e84e37093734224`
  - `so:sha256:e4e14fa1e17afc043cbd2edc24b341d044e7d0aed068e15549d6cd38a7f560d1`
  - `so:sha256:f19da17d5b8f8ff5107a9b96cf4ff9256ebf03da52491e0370413f941f085e5d`
  - `so:sha256:faeff009ed066ab59b310901f7f127fa174f0b0e2859613529a9ac69673c3230`

#### C(iv): carried run-2 rows by sitting-2 cluster (54 rows)

Clusters follow `ONT/work/sittings/carried-clusters.yaml` (ids and order). Every row keeps
`carried_from_prior: true` in the run-4 index (the run-3 parser no longer emits these ids); each
cluster's posture is the fresh evidence run 4 must add.

**checkout-binding** (0): Run 3 retired the fleet-checkout-identity row (sitting-2 Ruling 1); no unresolved rows remain here.

**grant-resource-contention** (2): Lease snapshots share nonce, grant instant and charge but differ in heartbeat instant; run 3 supplies organic release/eviction reports and synthetic termination joins. Run 4 must add an organic contention episode: two requests competing for the same capacity with the losing side's wait and the winner's effective holding, joined through the Stage C capture.

  - `so:sha256:b42503da37767cc741db6196fbf13e019bdc59f71166ad4d95318966ca7ae123`
  - `po:sha256:5fa0d40013f2f1bace37c166a14058909069e91de0f63b823bd0921c40f68278`

**admission-lifecycles** (5): Run 3 supplies same-root/nonce enqueue-admit-release chains and explicitly synthetic withdrawal and eviction boundaries. Run 4 must add organic withdrawal, lease-eviction and ticket-eviction chains from the Stage C capture (the canonical root today holds 2 lease evictions, 1 ticket eviction and 20 withdrawals in 442 v3 rows), each with the causal continuity the pure lifecycle duty names.

  - `so:sha256:c627961a8fcde9dca01027cbf052494763b5e6895805c1c0c50d8bf51ba3a7bb`
  - `so:sha256:d94bf0420d3457158959e6188c50d5949dc4fae4a48d07e7077f8c81df36fcb6`
  - `po:sha256:3aadb9c8ae061d71b2e8386d9b8af518d49df5a66abaa0bb0391783833a6eef4`
  - `po:sha256:51fa8a9b8fcef0856134c3599ef68eabe588532203230c5b0ac8c892da47c95a`
  - `po:sha256:56d67898f9daaa0ff3c1fb34ff05745d9a1f94cf2703726f7721d1f586f89e5f`

**failure-signature-occurrences** (0): Retired at sitting 2 (Ruling 1): the three failure-signature rows were re-identified against the captured failureKind/failedStepId tuples; signature identity stays open on the run-3 verdict chain, not on these rows. No unresolved rows remain here.

**cache-plan-resolution** (1): The verdict-corpus search is complete within its captured fields: rider_evidence=absent with zero structured occurrences. Run 4 either observes a resolver-result-to-execution join in a new capture or retires the rider as unobservable at this corpus grain; a copied park is rejected.

  - `po:sha256:30be9d42308395a759ea42b1706c47b14bf2d995ff5d90eb85161cef24e27b61`

**ordering-cluster** (0): Discharged: the ten CQ-020 rows retired at sitting 2 and the cluster ratified at sitting 3 (rat-053..065). No unresolved rows remain here.

**assessment-and-selector-governance** (9): Run 3 records verdict comparisons, greptileScore, proofTier and classified failure tuples, but no governing contract for freshness, review-score meaning, attribution or proof-tier selection. Run 4 must cite the authoritative contract (scale authority and version, selector scheme lineage, attribution conditions) or park each row with that contract named as the missing decision-maker.

  - `so:sha256:0a7f99ebe45f22164f484b539becf4d1d57384861db25b0c065fc67cca2574a7`
  - `so:sha256:a4fa5b4f6b8142d813d5867e01c92a245a9a7ee7d64b8841a3e27a068c88e764`
  - `so:sha256:c1e2fd7731b1efe855f70c75df8e7dd0bd99853668c551eca8fb80593a621d06`
  - `so:sha256:12f0a017acb17063246f77ebb5c128271f9df67ea7bc1666268052f2d58873d1`
  - `so:sha256:258d88bf5d120ca46af4e7964a5c3a5674c5c4984b67c0f84fe8f706e979c3f6`
  - `po:sha256:a0460c0e2b60f310cb30b9c03ea0aa2e487e02aadaa0450c56bb04cff6b5c8c9`
  - `po:sha256:8b0e7ebacbadd3d0a21df787d0070763c9151c438e5ad68ef69454c6bea0aca1`
  - `po:sha256:8d123d2b803018949aa079849fafabb4d38fbde7e7f77a5515d448cdc0a9f195`
  - `po:sha256:922212cafdb03daef5fb111352d661cfda30e1e9f3d3e8c3e6f45a19c6a82a50`

**execution-boundaries-and-elapsed-scope** (2): Run 3 has attempts with startedAt/endedAt/elapsedMs and component statuses. Run 4 must obtain a passed-step execution record with its own boundary and the measured-extent authority (what an elapsed interval covers), which the proof-ledger writer (C4) is expected to carry.

  - `so:sha256:3a8b51a1acc8602b1a583147d6d5e7e253481237fbf5806c9b13833698bc9090`
  - `po:sha256:2092736911a0c68e96ae8d9638b00ec4b6992b4da0677f325e4fd420fb41b2a7`

**memory-measurement** (1): memoryPeakBytes now joins a release report through root and nonce. Run 4 must add the resource-using occurrence and process boundary, sampling method and interval; the Stage C capture rides the same admission histories.

  - `so:sha256:78cf821b0771a1c60ef1f80746484a8da1df72bcf2b1eaa9ebed337144e5a245`

**duration-and-comparison-issuance** (2): ExecutionDurationAssertion was withdrawn (Queue D). Run 4 must supply a Must/Should CQ whose executable query needs a separate wall-time evidence class plus an observed consumer, or keep the concession and retire the individuals.

  - `so:sha256:2a207d4986630e8590f790457dabe07ffeecdb9b2bfa79cf254c6bce508a2998`
  - `so:sha256:91988c625516a3fa1516b592a7dc4c6b197b56249390fde1fc1e116867ae1af3`

**qa-and-conformance-evidence** (4): Run 3 has the admission projection fixture, the property-suite contract and the S7 replay result, none of which is a record/extract/judge QA run or an issued conformance package. Run 4 must join a beep-qa session (record, extract, judge) to an in-scope decision, or park with that chain named.

  - `po:sha256:3bf3cf7f37f4e3e046efb12751c4b9650dd3a2a16a0c99a1ec17563fa551048a`
  - `po:sha256:059c20e6b0972ff269acf52884fea9e75f4fc5144fac7728dbac333221866181`
  - `po:sha256:06dd8aab73f74fd680b9cf55a760da82d4a3420f91fc8ea9d8bdb27c4c000d57`
  - `po:sha256:2338c92205c5fc08e5e18d149e7aabca98b83589cf5984e6b83fa81b2401a98c`

**workspace-package-identity** (7): Checkout bindings identify checkouts, not packages. Run 4 must obtain an authoritative package-continuity contract (workspace manifest identity across renames and moves) before any package-identity row can leave unresolved.

  - `po:sha256:08a398bab03363136254e3e9c3ed49ebb16ffd18fb94b434111d4446cdf50d69`
  - `po:sha256:1189ec1eca4fb79695201186157334124e71372bbe906bb6119996f42b9fe842`
  - `po:sha256:13b29fc0bebcac4b0914db214f136add0fa739ac50af65649c800b7013ccb67a`
  - `po:sha256:1c941c2e1e41a932dfd00e48631a9dd6217c6e51fe9c681369139a8c0402ea84`
  - `po:sha256:28e700021c9b4ba707087650a4e39ceed6540863e4d99b02af241b2b0fdbcaf8`
  - `po:sha256:2f816bb5f468d1cc4a06de84c4a9bb8e4c9393a070c41e364f53d951cbf172e1`
  - `po:sha256:51a827390306ccb0cf37e23d646c653fd4291f3ed346ae04e097e678a5097781`

**dependency-and-selection-contracts** (9): Step positions 0/1 describe an admission order, not a package graph; stored diff/head/tier context is not a governed affected-task selection run. Run 4 must obtain the package-report ordering contract, the docgen selection artifact with a dirty-tree pin, and the normative affected-task selection contract.

  - `po:sha256:5a59d414027abf00522737e1d86c7976c6837e7dcf88eb47112cc39709b2be1d`
  - `po:sha256:62ae30cfc28b391c7bf4a87534abeba849a8ca2ebd5f8ebe72cb5af81dcc50eb`
  - `po:sha256:64463ef1e1f2b77cb50713f8194bb055d35d02288f465e6902e337f9fc5f5edf`
  - `po:sha256:6e598d379ffd2f0565176b337833e4eedf0293941fa87936078ee572e63748a9`
  - `po:sha256:89165acdfec28c3a8692c411aead416ca1fd5f13333c0ea5c748e92aeab0cb98`
  - `po:sha256:90fa083c4887641658c0239762b509fd6c9bacc6f14cf29ee392ce08714572ff`
  - `po:sha256:795d76d79fdc3ad235d204aee98c96f70dcdb10704c927558f31012749553995`
  - `po:sha256:9cbd50f3655b7ae7102a1be9bfcfe939528b3eaebd0dc33257408365f9402062`
  - `po:sha256:a1f8202d5ff295e75dd7ad3f50f9454dad4bc2d53677e5936a6a0812250c5e43`

**capacity-computation-and-snapshot** (7): Run 3 quotes the projection inequality and records requested/granted weightTokens but no pre-grant capacity stamp (Ruling 9). Run 4 must obtain the authoritative capacity computation and a Must/Should executable CQ traversing an AdmissionSnapshot, its capture act and instant.

  - `po:sha256:3c757a7975b27b8597ccf8c6d886eb72ad2b8b51aaba8eb59cf21cc9a1a7a3c6`
  - `po:sha256:518aee86882c8b9092469203add3bc23c72acfed1d7139f136a96e8763f0c8c7`
  - `po:sha256:6b31f817391e66aab8fc9796fed0c0bbdbd8285c9e86438e9172d1ce6bbaef61`
  - `po:sha256:8a555d65d66a8d7f44336fdb4ce8816f5a033a6ce448e311dc29615bfd8f41f2`
  - `po:sha256:8af3333c97798f24aeecfa40f40faefcf152f96fffb6717f647eabf0f5250a92`
  - `po:sha256:95037a7104c1dbd21fc02aeeeb45733f744c10ba07ea4c5db2a94db62d88e95a`
  - `po:sha256:95b57e4f4029739dacb78d5caa9b43939b1820fc17d3785a9ff32181d7d0e0b6`

**origin-and-heartbeat-policy** (5): blockedOnOriginAtMillis=0 and lastHeartbeatAtMillis are captured; their governed meaning is not. Run 4 must obtain the deployed threshold/policy source for origin blocking and heartbeat suspicion, and read the zero against it.

  - `po:sha256:79df3741e52f870a9c5d7ac0f3c76fc333a1341bf8f15c7a7720f2b6982e88b3`
  - `po:sha256:cb78d031658bfe80535beb490352c2086b2b8f629e3819df4fba336fbeb37598`
  - `po:sha256:cb9064130b643be08d25e627bcfc5264739ac1397a236d353835b473c2df5734`
  - `po:sha256:e362227f9f3d78e8fcb933ddf9f5523b1ef97776a2546ad12c7f702c33fc1cdd`
  - `po:sha256:edf38d10efe0552b7de770a0cc24a9596cc4b5141b693889e987465f4174b4bb`

### Queue D: the eight withdrawn proposals and organic eviction evidence

Withdrawals are deferrals with named evidence, not rejections (sitting-3 Ruling 4). Receipts:
`ONT/work/sittings/withdrawals-bind-ver-r1.yaml`, `withdrawals-ver-r2.yaml`,
`withdrawals-sitting-3.yaml`, and the journal-entry duty in `ONT/work/sittings/ratification-docket.md`.

| Withdrawn proposal | Term | Named run-4 evidence |
| --- | --- | --- |
| `otp:admb-journal-entry:001` | AdmissionJournalEntry | An observed decision consumer independently addressing admission-assertion identity and a Must/Should executable CQ whose required answer needs the entry individual (`run4-admission-journal-entry-identity-consumer`); the C(iii) duplicate-payload trace is its evidence. |
| `otp:bind-checkout-cache-binding:001` | CheckoutCacheBindingRecord | The same-cache accessibility/transfer experiment at task-input-hash and epoch grain, two checkout identities, separate probe times, positive access and bounded local absence, and a binding change (C(i) `checkout-cache-binding`). |
| `otp:bind-grant-termination:001` | AdmissionGrantTermination | An organic lease's admission and effective holding before and after release or eviction, correlated by admission chain and attempt binding, with claim acknowledgement and the matching attempt-termination write. |
| `otp:bind-request-termination:001` | AdmissionRequestTermination | An organically queued request followed from enqueue through withdrawal or ticket eviction, with before/after effective membership, claim acknowledgement and matching attempt termination. |
| `otp:ver-wall-time-evidence:001` | ExecutionDurationAssertion | A Must/Should CQ whose executable query requires a separately identified wall-time evidence class plus an observed consumer selecting or rejecting a verdict on it (C(i) `wall-time-evidence-class`). |
| `otp:bind-admission-grant:001` | SeatGrant (synthetic operational reading) | Organic lease-eviction/renewal/transfer chains in a fleet capture showing effective allocation continuity, joined to an independently identified holder. |
| `otp:bind-admission-request:001` | SeatRequest (synthetic operational reading) | An organic withdrawal/resubmission chain with an independently tracked demand referent and both ticket records. |
| `otp:ver-attempt-verdict:001` | VerificationResultArtifact (content-snapshot rival) | Two independent equal-content assessments of one attempt whose consumers treat them as distinct or as one, plus the issuance/correction provenance the proof-ledger writer will carry (C4). |

**Organic eviction census (2026-09-11, counts only, no capture).** The admission histories that
`CORPUS/etl_run3b_fleet_corpus.py` enumerates through `admission_sources()` (the canonical
runtime root, the system temp root and the session temp root) hold today: canonical root 3
journal files, 202 `yeet-admission-journal/v1` rows and 442 `v3` rows with 220
`admission-enqueued`, 200 `admission-admitted`, 199 `admission-released`, 20
`admission-withdrawn`, 2 `admission-lease-evicted` and 1 `admission-ticket-evicted`; session
temp root 2 rows (one admitted, one released); system temp root absent. These are organic writer
rows, distinct from the labeled `run3b-synthetic` fixture output. Whether they are new relative
to the `run3b-fleet` capture (which reported 5 lease and 2 ticket evictions across its retained
chains) is decided by the **Stage C capture at the run-4 pin**: a new `run4-fleet` pin produced
by the run3b ETL mechanics under Rulings 10, 19 and 22 (synthetic labels retained; refreshed
pins carry `corpus_tree`/`corpus_base`; residue scans zero), not by editing any existing pin.

### Queue E: CQ-019 / CQ-020 leftovers (Ruling 16, sitting-3 Ruling 4)

1. Object-valued `hasScope` and `Scope` stay **PARKED with the no-punning record**; the run-3
   fixtures exercise only the literal `hasScopeTag` (ratified, rat-064). They ratify only if a
   run-4 emission exercises arm 2 with an object-valued scope individual.
2. `schedulesWorkUnit` remains CQ-019 arm 3's historical carrier, unratified and unrewritten.
3. The CQ-020 amendment is applied and its ordering rows are discharged; no CQ, seed or fixture
   edit is owed to run 4. Queue placement changes nothing in `ontology/docs/competency-questions.yaml`.

### Queue F: S6 POLICY provenance convention

`ontology/extraction/s6/POLICY.yaml` still pins its sources by `corpus_commit`. The authorized
later change adopts the run-3 `corpus_tree`/`corpus_base` and current-tree citation convention
(Ruling 22 refresh conventions; the receipt "capture provenance must survive squash merges" is
in `research/OPPORTUNITIES.md`). This docket schedules that edit for the run-4 pin lane as a
regenerate-and-verify step (`apply_s6_dispositions.py --check`, `run_shacl.py` green); it does
not edit POLICY.yaml.

### Non-triggers and carry-forwards

- **TS adapter stays a non-trigger (Ruling 7).** Run 4 reads journal/inventory properties, the
  Stage C capture and verbatim emission/prose observations; no compiler-derived TS
  SourceObservations are needed.
- **S8 IRI scheme stays deferred (Ruling 15).** Nonce literals carry identity evidence.
- **Seats follow the run-3 launch entry** unless the run-4 launch entry amends it: Codex seats
  `gpt-6-astra` at `max` (the packet's 2026-08-27 delegated-lane directive governs seats; the
  root routing note's `medium` governs ordinary token-heavy work), the adversary in an
  independent context, the blinded alternative as a headless `claudeg` session on `grok-4.6`
  with `-alt` ids. Every seat's launched effort is recorded in `agents.<role>.effort` (v15).
- **Denotation grain.** One hypothesis per candidate referent kind, grouping the individual
  chains that instantiate it; an observation with an empty candidate set still emits one
  hypothesis whose null stands (v15 prompt). Run 3's 109-record consolidation pass is not repeated.
- **Engine follow-ups NOT in this pin** (queued upstream, each a versioned amendment with its own
  self-test families): NDJSON configuration support (the `.ndjson` exclusion still forces paired
  `.properties` projections), historical archive-path handling for relocated report citations,
  and index rows that can reference more than one proposal per observation or a
  proposal-coverage rule (raised on PR #1092). If one lands before the pin, the launch entry
  records the new digests; otherwise run 4 pins v15 as it stands.
- **Run-3 rotation at the pin.** The pin lane shelters run-3 seat trees, sittings, review audit,
  gate logs and rat-053..070 byte-identically under `ARCH/orun-2026-09-10T02:10:52Z.*`; their
  projection is already on main, so no live-root exception is needed.
- **One end-of-run PR** with the run-3 choreography: pin commit → evidence tag
  `evidence/beep-ci-ops/<run_id>-pin` (pushed) → frozen run in a detached worktree at the tag,
  with `work/` and `governance/ratifications/` rsynced in for every gate → seats → mechanical
  gate BEFORE the adversary → sittings → scribe → rotation → closeout. Gate and doc fixes are
  pushed the moment they exist; the PR never holds red on the run's account.

## Engine deltas since run 3 (change run mechanics)

The authoritative skill is repo-vendored at `.claude/skills/ontology-foundational-auditor/`;
no user-scope copy is used. Changes since the run-3 pin (`REVIEW-HISTORY.md` "Field amendments", v15):

1. **Seat-effort provenance.** `run-manifest.schema.yaml` (under `.claude/skills/_shared/schemas/`)
   carries `effort` on every seat; `check_manifest` requires a non-blank string per role; the
   self-test has 158 families. The framed contracts digest therefore differs from run 3's
   `db5aefe804fe`; the manifest records the pin-time value.
2. **Denotation grain and empty-candidate clause** in `prompts/denotation.md` (digest
   `ddec132ee905` today versus run 3's `1d848ac2560f`); SKILL.md passes `EFFORT` on every Codex
   seat launch.
3. **Retained laws** (v14): runs-shelter poison guard, strict-first symlink-loop resolution,
   Python 3.12 pin with PyYAML for validator tooling, content/history/authority binding, sandbox
   and stdlib-only adapters, `.ndjson` still excluded from `CONFIG_EXTS`.
4. **Pin new judging bytes.** Validator, contracts, five prompts, SKILL.md and runner digests
   come from the pin lane at the pin; recompute the CQ-suite digest if any CQ edit lands first
   (none is scheduled).

### Capture provenance conventions seats must preserve

These fields describe capture and replay; they are **not domain vocabulary proposals** merely
because an adapter can observe them.

| Convention | Required reading |
| --- | --- |
| `corpus_commit` | Historical capture HEAD; may be unreachable after squash merge; never the run's frozen repository pin. |
| `corpus_tree` / `corpus_base` | Captured tree and base provenance on refreshed manifests; citations retain file/line/anchor and captured hash; replay checks the current tree. |
| `ownerRef` / `ownerRefVariant` | Capture-local surrogates (`pid_pair`, `ownerpid`, `attachedpid`, `weak`); no cross-capture continuity; never a substitute for nonce/attempt joins. |
| `security_resanitization` | Repair history and prior-manifest lineage (Rulings 22, 23), not a new capture or ratification. |
| `complete_within`, source receipts, `provenance: synthetic` | Scope statements for retained windows and fixture production; synthetic terminal joins demonstrate writer behaviour, not organic incidence. |

## Not in scope

- Running run 4, launching seats or reviews, ratifying anything, lifting any flag, or granting
  an unresolved-fraction waiver; the sittings own those judgments.
- New corpus capture, pin refresh, proof-ledger writer integration, S8 IRI design, or scheduler
  changes; the Stage C capture is a pin-lane step, not a docket step.
- Re-running runs 1–3, S5, S6 or S7; changing prior indexes, historical observations,
  ratification decisions, frozen evidence, or corpus pins.
- CQ, seed, fixture or contract edits; edits under `ontology/extraction/`, `.claude/`, or `goals/`.
- Commits, staging, tags or PR publication by any lane.
