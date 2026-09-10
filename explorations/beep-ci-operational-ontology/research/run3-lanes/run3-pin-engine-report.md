# Run-3 pin engine report

Prepared 2026-09-09 on `ontology-run3`, HEAD `85cc86d1f3fd99088bf6317bfc639743de539331`.
No commit, branch change, stash, reset, `git add`, or repository-wide formatter was run.
The required `git mv` operations stage their own renames. Authored files remain uncommitted.

## Result and blockers

The v1.1.0 adapter and its golden are built and proved in both sandbox modes.
The transcriber is built and produces 64 authenticated records. The rotation
moves 365 seat-tree files and 17 ratifications byte-identically. `ONT/work/`
is empty; the provisional manifest and all emitted records were removed.

The complete launch acceptance is **blocked**, for these measured reasons:

1. Four accepted ratifications have no accepted S5/S6 authority projection.
   Per the brief they remain in the live root. Their four dangling proposal
   references remain scanner violations until the status projections are reconciled.
2. V14 requires all 68 prior unresolved disposition rows even without `--gate`
   and before observe. These are predecessor-ledger checks, not archived records
   being scanned. The requested zero-run-2-id residual list is impossible on
   an empty work tree with this predecessor and the unchanged v14 validator.
3. Archived ordering quotes po-736ad92a1de7 and po-35a69c5bcbf7 changed in the
   S7 contract and are absent verbatim at HEAD. No coordinate recovery can
   restore their wording. Their re-mint remains blocked; no substitute is emitted.
4. The verdict projections contain no cache-plan result or posture keys.
   The Stage A manifest explicitly records this absence. The cache-plan
   selection rule is implemented and golden-tested, but supplies zero live rider records.

The brief also asks for primary/linked/canonical-runtime checkout classes.
The recorded `kind` values are `clone` and `linked-worktree`; no binding records
a `canonical-runtime` kind. The adapter preserves these names and never infers
a third kind from a filename. All remote-cache-configured values are false,
which is not evidence of runtime disablement.

## Emission rules

`ONT` means `ontology/extraction/s4/beep-ci-ops` relative to this packet.
The adapter reads only properties projections in the four run-3 pins. Its
only other repository read is the provisional run manifest commit declaration.
Corpus manifests were inspected during preparation; the adapter does not read raw payloads.

| Rule | Selection | Facts and evidence retained |
| --- | --- | --- |
| Vocabulary census | First representable first-occurrence key per `(pin, kind)`; lexicographic repo-relative files; root snapshot is a separate kind | Newly seen keys; file emits only when it adds a key, unless selected by a docket rule |
| Synthetic | Every projection in run3b-synthetic, including protocol and attempts | All representable pairs, original synthetic labels, complete excerpt |
| Checkout binding classes | First file per kind, local-cache-present flag, remote-cache-configured flag, and same/linked/absent git-dir/common-dir relation | All representable pairs; no invented missing-value facts |
| First admission family | First v3 enqueued, withdrawn, lease-evicted, ticket-evicted, or checkout-and-branch-bearing release per root | Full event stanza, unless already covered by a selected chain |
| Contention chain | Each nonce with an eviction or an enqueue preceding an admitted/withdrawn outcome, scoped separately to pin and root | All events for that nonce, all pairable fields, first-to-last source span and exact full excerpt |
| Failure signature | First verdict file per `(failureKind, failedStepId)` | Repeated step ids and statuses survive alongside the signature tuple |
| Cache plan | First verdict per value of cachePlan, cachePlanTag, turboCachePlan, turboCachePlanTag, cachePosture, resolvedCachePosture, resolverResult; tag/_tag values caller-controlled/local-only/remote-read | Whole-file pair evidence; no live matches at this pin |
| Other attempts/live state | Vocabulary census only | No extra inferred identity or issuance joins |

Docket records subsume overlapping vocabulary selections. First-family events
already inside a chain need no duplicate event record. Interleaved chain spans
include other nonces in `source_excerpt`; only the selected nonce contributes
the chain facts. The excerpt is byte-identical to the entire source span, and
the independent proof checks it as well as the validator-required content digest.

V14 pairing and comment behavior are mirrored, including document BOM, CR/CRLF,
leading hash/bang comments with form feed, raw quote and inline-marker payloads,
nonempty/no-whitespace config objects, and the continuation guard. No values
are shortened, decoded, paraphrased, or fabricated. A selected span with no
representable fact has a separate unrepresentable-construct record. Flattened
properties do not restore raw JSON nesting.

## Adapter census

| Pin | Kind | Properties inspected | SourceObservations | Representable vocabulary keys |
| --- | --- | ---: | ---: | ---: |
| run3-fleet | admission | 2 | 54 | 20 |
| run3-fleet | attempts | 364 | 5 | 61 |
| run3-fleet | live | 3 | 2 | 25 |
| run3-fleet | verdicts | 594 | 21 | 49 |
| run3-checkout-identity | bindings | 107 | 3 | 33 |
| run3-checkout-identity | snapshot | 1 | 1 | 23 |
| run3b-fleet | admission | 3 | 55 | 21 |
| run3b-fleet | attempts | 364 | 5 | 61 |
| run3b-fleet | live | 3 | 2 | 25 |
| run3b-synthetic | admission | 2 | 2 | 21 |
| run3b-synthetic | attempts | 2 | 2 | 6 |
| **Total** | | **1,445** | **152** | Per-kind counts above |

Primary selection counts after overlap: 106 nonce-chain records, 26 vocabulary
records, 13 verdict-class records, 3 binding-class records, and 4 synthetic
records. All first-family selections in the live pins are already covered by chains.

Each fleet pin contributes 53 nonce chains containing 125 selected events:
46 enqueued, 28 admitted, 21 released, 23 withdrawn, 5 lease-evicted, and
2 ticket-evicted. Every selected event contributes all validator-pairable fields.
Of these events, 29 lack checkoutRoot and 31 lack branch in each pin. The
adapter records that source limitation; it fills neither field from another event.

The 13 signature classes span both recorded failureKind values and 12 failed-step
references. Cache classes have zero live matches. Binding classes are clone/linked-worktree,
same/linked/absent git-dir linkage, true/false local-cache presence, and false
remote-cache configuration. Absent linkage selects a degraded binding without
asserting an absence fact.

## Rotation and authority check

All paths in this table are packet-relative. Term-name presence alone did not
count as accepted authority when the status explicitly remained parked or deferred.

| Retained ratification | Accepted term | Current status evidence |
| --- | --- | --- |
| rat-032 | FailureSignature | ontology/extraction/s5/DISPOSITIONS.yaml:90-94 still says parked-run-2 |
| rat-033 | VerificationAttempt | ontology/extraction/s5/DISPOSITIONS.yaml:151-155 still says parked-run-2 |
| rat-037 | dependsOnTransitive | ontology/extraction/s6/PREDICATES.yaml:146-151 still says parked-run-2 |
| rat-039 | VerificationLane | ontology/docs/s6-abox-contract.md:123 still defers placement to run 2 |

| Relocated ratification(s) | Accepted term projection |
| --- | --- |
| rat-034 | TAXONOMY.yaml:119 SeatRequest |
| rat-035 | TAXONOMY.yaml:354 DocgenAffectedWorkUnit |
| rat-036 | TAXONOMY.yaml:361 FallowAuditLane |
| rat-038 | TAXONOMY.yaml:180 WorkUnitSpecification |
| rat-040, rat-041, rat-044, rat-046 | TAXONOMY.yaml:28 AdmissionPolicy; ABOX.yaml:9 |
| rat-042 | TAXONOMY.yaml properties entry for dependsOn |
| rat-043 | TAXONOMY.yaml:67 CachePosture |
| rat-045 | TAXONOMY.yaml:58 Agent, anti_rigid |
| rat-047, rat-052 | TAXONOMY.yaml:145 VerificationEvidence |
| rat-048, rat-051 | TAXONOMY.yaml:170 VerificationResultArtifact |
| rat-049 | TAXONOMY.yaml:162 VerificationPlanSpecification |
| rat-050 | TAXONOMY.yaml:34 AdmissionPriorityClass; ABOX.yaml:200 |

TAXONOMY.yaml above is under ontology/extraction/s5; ABOX.yaml is under
ontology/extraction/s6. The relocation README states that the operation is
incomplete. No ratification, proposal, or archived payload byte was edited.
The historical gate in research/scripts/validate_packet.py includes both live
ratifications and every sibling `orun-*.governance` archive. The historical
join_s4b.py generator still reads the live directory; it was not rerun.

### Exact provisional validator residual list

The command used Python 3.12 and no `--gate` or `--repo`, as required by the
rotation proof. The provisional manifest used current HEAD, `first_run: false`,
prior index `runs/orun-2026-09-03T02:46:18Z.index.yaml`, prior digest
`a207a106de68`, current engine/prompt digests, `dirty: true`, and no waiver.
There were 74 violations, exit 1. None names an archived path. Four name
retained ratifications; 68 name prior unresolved observation ids through the
manifest/index join. The complete output follows unchanged:

```text
VIOLATIONS (74):
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: dirty source requires pin_waived: true with a reason
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-032.yaml: proposal_ref 'otp:jv-failure-signature:001' does not resolve to a proposal
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-033.yaml: proposal_ref 'otp:jv-verification-attempt:001' does not resolve to a proposal
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-037.yaml: proposal_ref 'otp:pa-package-dependency-closure:001' does not resolve to a proposal
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-039.yaml: proposal_ref 'otp:pa-turbo-task-specification:002' does not resolve to a proposal
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:0d096342f5ba116307ca177adcbc3fc775b860ae0e5fd62dfd4d090d86c660a3 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:b42503da37767cc741db6196fbf13e019bdc59f71166ad4d95318966ca7ae123 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:5fa0d40013f2f1bace37c166a14058909069e91de0f63b823bd0921c40f68278 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:0a7f99ebe45f22164f484b539becf4d1d57384861db25b0c065fc67cca2574a7 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:12f0a017acb17063246f77ebb5c128271f9df67ea7bc1666268052f2d58873d1 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:258d88bf5d120ca46af4e7964a5c3a5674c5c4984b67c0f84fe8f706e979c3f6 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:2a207d4986630e8590f790457dabe07ffeecdb9b2bfa79cf254c6bce508a2998 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:3a8b51a1acc8602b1a583147d6d5e7e253481237fbf5806c9b13833698bc9090 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:78cf821b0771a1c60ef1f80746484a8da1df72bcf2b1eaa9ebed337144e5a245 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:91988c625516a3fa1516b592a7dc4c6b197b56249390fde1fc1e116867ae1af3 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:a4fa5b4f6b8142d813d5867e01c92a245a9a7ee7d64b8841a3e27a068c88e764 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:c1e2fd7731b1efe855f70c75df8e7dd0bd99853668c551eca8fb80593a621d06 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:c627961a8fcde9dca01027cbf052494763b5e6895805c1c0c50d8bf51ba3a7bb has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation so:sha256:d94bf0420d3457158959e6188c50d5949dc4fae4a48d07e7077f8c81df36fcb6 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:0121af7b661484de9197ede12df6eaa5c69240214339b7ea6844a4f09901fea8 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:059c20e6b0972ff269acf52884fea9e75f4fc5144fac7728dbac333221866181 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:06dd8aab73f74fd680b9cf55a760da82d4a3420f91fc8ea9d8bdb27c4c000d57 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:08a398bab03363136254e3e9c3ed49ebb16ffd18fb94b434111d4446cdf50d69 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:1189ec1eca4fb79695201186157334124e71372bbe906bb6119996f42b9fe842 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:13b29fc0bebcac4b0914db214f136add0fa739ac50af65649c800b7013ccb67a has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:14e01baa9a4fa23873722680039d098e43c3e0f315d5f6805159154577794e06 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:1c941c2e1e41a932dfd00e48631a9dd6217c6e51fe9c681369139a8c0402ea84 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:2092736911a0c68e96ae8d9638b00ec4b6992b4da0677f325e4fd420fb41b2a7 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:2338c92205c5fc08e5e18d149e7aabca98b83589cf5984e6b83fa81b2401a98c has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:28e700021c9b4ba707087650a4e39ceed6540863e4d99b02af241b2b0fdbcaf8 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:2d69bdb38dd2c7618a64b60834a6993abe999b6776d721aef8b6eb947c9b2e91 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:2f816bb5f468d1cc4a06de84c4a9bb8e4c9393a070c41e364f53d951cbf172e1 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:30be9d42308395a759ea42b1706c47b14bf2d995ff5d90eb85161cef24e27b61 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:3aadb9c8ae061d71b2e8386d9b8af518d49df5a66abaa0bb0391783833a6eef4 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:3bf3cf7f37f4e3e046efb12751c4b9650dd3a2a16a0c99a1ec17563fa551048a has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:3c757a7975b27b8597ccf8c6d886eb72ad2b8b51aaba8eb59cf21cc9a1a7a3c6 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:4ce41ce65957b0594e01c672972fb68722ee30c3df62444b2d323fe6d70e07cf has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:4ec767a335e920a2a80204127a6c3146cded1e5eb3d748b11a87dfc4579fc735 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:518aee86882c8b9092469203add3bc23c72acfed1d7139f136a96e8763f0c8c7 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:51a827390306ccb0cf37e23d646c653fd4291f3ed346ae04e097e678a5097781 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:51fa8a9b8fcef0856134c3599ef68eabe588532203230c5b0ac8c892da47c95a has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:56d67898f9daaa0ff3c1fb34ff05745d9a1f94cf2703726f7721d1f586f89e5f has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:5a59d414027abf00522737e1d86c7976c6837e7dcf88eb47112cc39709b2be1d has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:62ae30cfc28b391c7bf4a87534abeba849a8ca2ebd5f8ebe72cb5af81dcc50eb has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:64463ef1e1f2b77cb50713f8194bb055d35d02288f465e6902e337f9fc5f5edf has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:6b31f817391e66aab8fc9796fed0c0bbdbd8285c9e86438e9172d1ce6bbaef61 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:6e598d379ffd2f0565176b337833e4eedf0293941fa87936078ee572e63748a9 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:6fa9ae087c8d411c0218a0491a20989f722773cb08d8b57d733514a58cc86742 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:795d76d79fdc3ad235d204aee98c96f70dcdb10704c927558f31012749553995 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:79df3741e52f870a9c5d7ac0f3c76fc333a1341bf8f15c7a7720f2b6982e88b3 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:88f09e0224cf8cc48710903fe1e017b9369bc5dada8def6024d42f2841f9a654 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:89165acdfec28c3a8692c411aead416ca1fd5f13333c0ea5c748e92aeab0cb98 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:8a555d65d66a8d7f44336fdb4ce8816f5a033a6ce448e311dc29615bfd8f41f2 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:8af3333c97798f24aeecfa40f40faefcf152f96fffb6717f647eabf0f5250a92 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:8b0e7ebacbadd3d0a21df787d0070763c9151c438e5ad68ef69454c6bea0aca1 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:8d123d2b803018949aa079849fafabb4d38fbde7e7f77a5515d448cdc0a9f195 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:90fa083c4887641658c0239762b509fd6c9bacc6f14cf29ee392ce08714572ff has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:922212cafdb03daef5fb111352d661cfda30e1e9f3d3e8c3e6f45a19c6a82a50 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:95037a7104c1dbd21fc02aeeeb45733f744c10ba07ea4c5db2a94db62d88e95a has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:959a603a7bc88415101c1c6e9073034271081d03a55dd625f763898feb579ea2 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:95b57e4f4029739dacb78d5caa9b43939b1820fc17d3785a9ff32181d7d0e0b6 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:9cbd50f3655b7ae7102a1be9bfcfe939528b3eaebd0dc33257408365f9402062 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:a0460c0e2b60f310cb30b9c03ea0aa2e487e02aadaa0450c56bb04cff6b5c8c9 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:a1f8202d5ff295e75dd7ad3f50f9454dad4bc2d53677e5936a6a0812250c5e43 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:cb78d031658bfe80535beb490352c2086b2b8f629e3819df4fba336fbeb37598 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:cb9064130b643be08d25e627bcfc5264739ac1397a236d353835b473c2df5734 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:d9e1c6941fe61eb8e8a4f7e40853d6090190ec18523931c3af4551bb2b880c76 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:e362227f9f3d78e8fcb933ddf9f5523b1ef97776a2546ad12c7f702c33fc1cdd has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:ed86c2d18b12ff797604eac97a917b36527e390ce417fce35ac583fd829b2709 has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:edf38d10efe0552b7de770a0cc24a9596cc4b5141b693889e987465f4174b4bb has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:736ad92a1de7991caa17d905c310e2dac02d5a4d9b7cd3b709adfcabd690e4cc has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:35a69c5bcbf7493cc0aa7f248d138d65f2d5c8beff49e80308ef85b43a0f559d has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: prior unresolved observation po:sha256:d1f555913267743bc009bfd030c3bafd841e6f7baa081d7a1ecc0704fc2b2d2d has NO row in this run's index
 - explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/work/run-manifest.yaml: run produced ZERO observations without a substantive empty_corpus_reason
```

## Prose transcription

All control inputs and source bytes are read with `git show HEAD:`. HEAD is
checked again before output. Quotes preserve wording modulo the schema-defined
whitespace normalization. Recovery checks the declared coordinates first, then
the smallest containing window of at most 40 lines, in source order.

| Source | Selected | Emitted | Missing |
| --- | ---: | ---: | ---: |
| Archived ordering captures from s7-projection-contract.md | 2 | 0 | 2 |
| Archived ordering capture from s7/work-s7/impl-report.md | 1 | 1 | 0 |
| apps/labs/ciops/test/fixtures/emission-v2.ttl | 30 | 30 | 0 |
| apps/labs/ciops/src/projection/Turtle.ts | 17 unique sites | 17 | 0 |
| ontology/docs/s7-projection-contract.md, heading-plus-first-block rule | 12 | 12 | 0 |
| research/s7-replay-evidence.md, heading-plus-first-block rule | 4 | 4 | 0 |
| **Total** | **66** | **64** | **2** |

The Turtle fixture uses one terminated subject statement per triple. Repeated
subjects begin new blocks after their dots, giving 30 records. The term table
has an rdf:type row overlapping the five class-emission sites; each unique
site emits once, giving 17 source-line records. No coordinate corrections
were needed for the one surviving archived quote. The two others cannot be
found anywhere in the current contract and remain explicit issues.

Both dry-run and real-run return exit 1 to disclose the missing evidence. Dry-run
created no directory. The real run wrote the 64 records under
`~/.cache/beep/run3-pin-scratch/engine/prose-records/`. Independent v14 checks
validated all 64 schemas, canonical ids and verbatim HEAD-blob pairings. The
only repo-fidelity diagnostic was the expected tracked-dirty state. No
DECISIONS, CQ wording, or ratification was transcribed as evidence.

## Engine facts and runtime

| Artifact | sha256_12 |
| --- | --- |
| validate_artifacts.py | `45e4f856a371` |
| Full framed contract closure | `db5aefe804fe` |
| SKILL.md | `27f2fe20ce06` |
| run_adapter_sandbox.sh | `ecb6dcab421b` |
| adapter-journal-run3.py | `028dcb1d7953` |
| po_transcriber_run3.py | `3341d7bcbc5a` |
| denotation seat prompt | `1d848ac2560f` |
| foundational seat prompt | `3d94feb0629c` |
| synthesis seat prompt | `117d82b29904` |
| adversary seat prompt | `9dbfb7fc9d4c` |
| alternative seat prompt | `4563e5726438` |

The contract digest is the exact `check_manifest` framing over 21 members:
`_shared/schemas/*.yaml`, `_shared/*.yaml`, `_shared/*.md`, `_shared/*.json`,
and the skill templates/*.yaml, sorted by path relative to the skills directory.
Each member contributes relative path, newline, decimal byte length, newline,
and exact bytes to the SHA-256. No CQ-suite digest or count is recorded here;
lane B owns those final values.

| Validator runtime | Rule families passing | Failing | Exit |
| --- | ---: | ---: | ---: |
| Python 3.12 | 157 | 0 | 0 |
| Python 3.13 | 157 | 0 | 0 |

Run 3 should pin Python 3.12 for continuity with the proven run-2 validator
lane. V14 also passes on 3.13; the old 3.13 incompatibility is not reproduced.
The duplicate-run-id and malformed-run-id refusal messages are expected
self-test assertions, not failed families. The unchanged adapter sandbox
runner explicitly launches its system Python; its runtime is a separate
runner dependency from the uv validator pin.

## Verification and preservation

- Sandbox self-check passes with 31 expected records. It compares the full
  filename and byte sets, not only ids or counts. Repository sandbox mode
  passes with 152 records, and rerunning produces identical output.
- Independent v14 checks validate all 31 golden records and 152 repository
  records, with 3,573 authenticated config pairings. Assertions additionally
  cover first-occurrence/no-new-key suppression, malformed and duplicate pins,
  interleaved chain facts, cross-root isolation, backwards-chain refusal, and
  every field of all 250 selected organic events across the two pins.
- The reviewed adapter was authored outside the repository in a mode-0700
  trusted directory, proved through the runner, then installed byte-identically
  as the repository provenance copy. Its old v1.0.0 sibling is unchanged.
- All 7,704 snapshotted immutable files other than the expressly permitted
  appended README are unchanged. All 382 relocated payloads retain their
  SHA-256. The five pins, four generators and tests, old adapter/golden,
  run ledgers, and pre-existing archives were not rewritten.
- New/edited engine files passed the Stage B generator's scan_output_bytes
  routine. The report itself and four unchanged moved filenames also exercise
  an inherited scanner false positive: the unanchored provider prefix matches
  inside the word task in long filenames. Four moved paths are flagged; all
  382 moved bodies pass. The report cites those literal paths, so its full
  byte scan has the same documented false positive. No matching private
  material was found, and the frozen generator was not changed.
- One older numeric fixture example in OPPORTUNITIES.md was changed to the
  class placeholder uid-<n> so that edited receipt file passes the byte scan.
- Repository typos check: exit 2 across all 445 files, with one inherited
  digest-token false positive at the moved denotation-batches/batch-prose-c.txt:47.
  All 63 authored files pass separately. Frozen digest bytes were preserved.
- Both unstaged and staged `git diff --check` pass. The work directory is empty,
  all authored paths are lane-owned, and HEAD remains unchanged.
- This is preparation proof on an uncommitted tree. It is not a final manifest
  pin or a passed run gate. The new adapter/golden must enter the orchestrator
  pin commit before their manifest digests can authenticate against HEAD.

Friction receipts were appended when the unprojected authority, missing quotes,
absent cache fields, predecessor-row scan behavior, and scanner false positives
were found. Lane B's ontology/docs, ontology/tests/fixtures and intake edits
were left to that lane. Existing DECISIONS.md edits and untracked lane briefs
were preserved. No production corpus refresh, ontology ratification, live
scheduler operation, or remote mutation was performed.

## Exact relocation payload inventory

Every path below is relative to `explorations/beep-ci-operational-ontology/`.
Each line is an exact old -> new move with unchanged file bytes.

<details>
<summary>382 byte-identical file moves</summary>

```text
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-jv-actual-wall-duration-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-jv-actual-wall-duration-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-jv-admission-lifecycle-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-jv-admission-lifecycle-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-jv-failure-signature-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-jv-failure-signature-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-jv-lane-diagnostic-comparison-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-jv-lane-diagnostic-comparison-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-jv-memory-peak-measurement-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-jv-memory-peak-measurement-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-jv-merge-readiness-assessment-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-jv-merge-readiness-assessment-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-jv-verification-attempt-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-jv-verification-attempt-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-jv-verification-step-execution-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-jv-verification-step-execution-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-ov-has-scope-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-ov-has-scope-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-ov-has-step-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-ov-has-step-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-ov-schedule-step-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-ov-schedule-step-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-ov-schedules-seat-request-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-ov-schedules-seat-request-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-ov-step-index-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-ov-step-index-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-admission-lease-lifecycle-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-admission-lease-lifecycle-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-admission-request-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-admission-request-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-docgen-work-unit-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-docgen-work-unit-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-fallow-audit-evidence-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-fallow-audit-evidence-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-package-dependency-closure-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-package-dependency-closure-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-projection-conformance-evidence-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-projection-conformance-evidence-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-projection-contract-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-projection-contract-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-projection-limitation-report-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-projection-limitation-report-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-turbo-task-specification-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-turbo-task-specification-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-workspace-package-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-workspace-package-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pa-yeet-verification-workflow-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pa-yeet-verification-workflow-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-admission-capacity-state-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-admission-capacity-state-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-admission-policy-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-admission-policy-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-admission-priority-aging-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-admission-priority-aging-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-admission-priority-class-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-admission-priority-class-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-docgen-affected-scope-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-docgen-affected-scope-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-failure-attribution-category-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-failure-attribution-category-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-package-dependency-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-package-dependency-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-planned-lane-status-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-planned-lane-status-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-resolved-cache-posture-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-resolved-cache-posture-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-review-fix-class-cap-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-review-fix-class-cap-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-schedule-projection-specification-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-schedule-projection-specification-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-scheduler-process-owner-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-scheduler-process-owner-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-verification-evidence-receipt-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-verification-evidence-receipt-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pb-yeet-proof-tier-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pb-yeet-proof-tier-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pc-projection-contract-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pc-projection-contract-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/fa-pc-token-capacity-policy-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/fa-pc-token-capacity-policy-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-jv-actual-wall-duration-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-jv-actual-wall-duration-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-jv-admission-lifecycle-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-jv-admission-lifecycle-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-jv-failure-signature-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-jv-failure-signature-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-jv-lane-diagnostic-comparison-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-jv-lane-diagnostic-comparison-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-jv-memory-peak-measurement-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-jv-memory-peak-measurement-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-jv-merge-readiness-assessment-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-jv-merge-readiness-assessment-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-jv-verification-attempt-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-jv-verification-attempt-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-jv-verification-step-execution-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-jv-verification-step-execution-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-ov-has-scope-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-ov-has-scope-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-ov-has-step-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-ov-has-step-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-ov-schedule-step-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-ov-schedule-step-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-ov-schedules-seat-request-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-ov-schedules-seat-request-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-ov-step-index-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-ov-step-index-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-admission-lease-lifecycle-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-admission-lease-lifecycle-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-admission-request-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-admission-request-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-docgen-work-unit-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-docgen-work-unit-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-fallow-audit-evidence-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-fallow-audit-evidence-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-package-dependency-closure-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-package-dependency-closure-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-projection-conformance-evidence-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-projection-conformance-evidence-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-projection-contract-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-projection-contract-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-projection-limitation-report-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-projection-limitation-report-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-turbo-task-specification-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-turbo-task-specification-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-workspace-package-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-workspace-package-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pa-yeet-verification-workflow-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pa-yeet-verification-workflow-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-admission-capacity-state-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-admission-capacity-state-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-admission-policy-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-admission-policy-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-admission-priority-aging-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-admission-priority-aging-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-admission-priority-class-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-admission-priority-class-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-docgen-affected-scope-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-docgen-affected-scope-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-failure-attribution-category-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-failure-attribution-category-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-package-dependency-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-package-dependency-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-planned-lane-status-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-planned-lane-status-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-resolved-cache-posture-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-resolved-cache-posture-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-review-fix-class-cap-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-review-fix-class-cap-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-schedule-projection-specification-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-schedule-projection-specification-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-scheduler-process-owner-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-scheduler-process-owner-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-verification-evidence-receipt-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-verification-evidence-receipt-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pb-yeet-proof-tier-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pb-yeet-proof-tier-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pc-projection-contract-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pc-projection-contract-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/alternative/ic-pc-token-capacity-policy-alt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/ic-pc-token-capacity-policy-alt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-jv-actual-wall-duration-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-jv-actual-wall-duration-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-jv-admission-lifecycle-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-jv-admission-lifecycle-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-jv-failure-signature-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-jv-failure-signature-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-jv-lane-diagnostic-comparison-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-jv-lane-diagnostic-comparison-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-jv-memory-peak-measurement-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-jv-memory-peak-measurement-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-jv-merge-readiness-assessment-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-jv-merge-readiness-assessment-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-jv-verification-attempt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-jv-verification-attempt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-jv-verification-step-execution-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-jv-verification-step-execution-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-ov-has-scope-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-ov-has-scope-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-ov-has-step-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-ov-has-step-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-ov-schedule-step-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-ov-schedule-step-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-ov-schedules-seat-request-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-ov-schedules-seat-request-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-ov-step-index-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-ov-step-index-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-admission-lease-lifecycle-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-admission-lease-lifecycle-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-admission-request-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-admission-request-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-docgen-work-unit-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-docgen-work-unit-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-fallow-audit-evidence-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-fallow-audit-evidence-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-package-dependency-closure-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-package-dependency-closure-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-projection-conformance-evidence-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-projection-conformance-evidence-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-projection-contract-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-projection-contract-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-projection-limitation-report-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-projection-limitation-report-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-turbo-task-specification-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-turbo-task-specification-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-workspace-package-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-workspace-package-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pa-yeet-verification-workflow-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pa-yeet-verification-workflow-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-admission-capacity-state-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-admission-capacity-state-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-admission-policy-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-admission-policy-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-admission-priority-aging-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-admission-priority-aging-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-admission-priority-class-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-admission-priority-class-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-docgen-affected-scope-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-docgen-affected-scope-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-failure-attribution-category-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-failure-attribution-category-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-package-dependency-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-package-dependency-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-planned-lane-status-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-planned-lane-status-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-resolved-cache-posture-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-resolved-cache-posture-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-review-fix-class-cap-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-review-fix-class-cap-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-schedule-projection-specification-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-schedule-projection-specification-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-scheduler-process-owner-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-scheduler-process-owner-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-verification-evidence-receipt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-verification-evidence-receipt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pb-yeet-proof-tier-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pb-yeet-proof-tier-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pc-projection-contract-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pc-projection-contract-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/fa-pc-token-capacity-policy-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/fa-pc-token-capacity-policy-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-jv-actual-wall-duration-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-jv-actual-wall-duration-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-jv-admission-lifecycle-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-jv-admission-lifecycle-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-jv-failure-signature-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-jv-failure-signature-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-jv-lane-diagnostic-comparison-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-jv-lane-diagnostic-comparison-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-jv-memory-peak-measurement-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-jv-memory-peak-measurement-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-jv-merge-readiness-assessment-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-jv-merge-readiness-assessment-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-jv-verification-attempt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-jv-verification-attempt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-jv-verification-step-execution-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-jv-verification-step-execution-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-ov-has-scope-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-ov-has-scope-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-ov-has-step-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-ov-has-step-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-ov-schedule-step-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-ov-schedule-step-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-ov-schedules-seat-request-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-ov-schedules-seat-request-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-ov-step-index-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-ov-step-index-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-admission-lease-lifecycle-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-admission-lease-lifecycle-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-admission-request-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-admission-request-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-docgen-work-unit-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-docgen-work-unit-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-fallow-audit-evidence-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-fallow-audit-evidence-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-package-dependency-closure-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-package-dependency-closure-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-projection-conformance-evidence-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-projection-conformance-evidence-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-projection-contract-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-projection-contract-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-projection-limitation-report-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-projection-limitation-report-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-turbo-task-specification-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-turbo-task-specification-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-workspace-package-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-workspace-package-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pa-yeet-verification-workflow-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pa-yeet-verification-workflow-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-admission-capacity-state-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-admission-capacity-state-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-admission-policy-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-admission-policy-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-admission-priority-aging-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-admission-priority-aging-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-admission-priority-class-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-admission-priority-class-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-docgen-affected-scope-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-docgen-affected-scope-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-failure-attribution-category-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-failure-attribution-category-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-package-dependency-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-package-dependency-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-planned-lane-status-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-planned-lane-status-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-resolved-cache-posture-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-resolved-cache-posture-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-review-fix-class-cap-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-review-fix-class-cap-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-schedule-projection-specification-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-schedule-projection-specification-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-scheduler-process-owner-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-scheduler-process-owner-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-verification-evidence-receipt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-verification-evidence-receipt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pb-yeet-proof-tier-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pb-yeet-proof-tier-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pc-projection-contract-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pc-projection-contract-001.yaml
ontology/extraction/s4/beep-ci-ops/work/foundational/ic-pc-token-capacity-policy-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/ic-pc-token-capacity-policy-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-actual-wall-duration-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-actual-wall-duration-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-admission-lifecycle-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-admission-lifecycle-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-base-freshness-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-base-freshness-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-failure-signature-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-failure-signature-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-greptile-score-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-greptile-score-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-lane-diagnostic-comparison-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-lane-diagnostic-comparison-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-memory-peak-measurement-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-memory-peak-measurement-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-merge-readiness-assessment-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-merge-readiness-assessment-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-option-encoding-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-option-encoding-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-staged-only-marker-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-staged-only-marker-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-verification-attempt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-verification-attempt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-jv-verification-step-execution-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-jv-verification-step-execution-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-ov-has-current-proposal-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-ov-has-current-proposal-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-ov-has-scope-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-ov-has-scope-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-ov-has-step-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-ov-has-step-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-ov-schedule-step-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-ov-schedule-step-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-ov-schedules-seat-request-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-ov-schedules-seat-request-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-ov-step-index-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-ov-step-index-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-admission-capacity-expression-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-admission-capacity-expression-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-admission-lease-lifecycle-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-admission-lease-lifecycle-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-admission-request-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-admission-request-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-affected-reason-field-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-affected-reason-field-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-boundary-provenance-schema-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-boundary-provenance-schema-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-cache-plan-resolution-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-cache-plan-resolution-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-changeset-enforcement-mode-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-changeset-enforcement-mode-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-ci-lane-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-ci-lane-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-closeout-source-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-closeout-source-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-collection-mode-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-collection-mode-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-docgen-work-unit-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-docgen-work-unit-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-elapsed-ms-field-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-elapsed-ms-field-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-execution-context-literals-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-execution-context-literals-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-failure-signature-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-failure-signature-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-fallow-audit-evidence-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-fallow-audit-evidence-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-optional-dependencies-token-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-optional-dependencies-token-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-package-dependency-closure-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-package-dependency-closure-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-package-verify-step-symbol-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-package-verify-step-symbol-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-projection-conformance-evidence-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-projection-conformance-evidence-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-projection-contract-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-projection-contract-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-projection-limitation-report-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-projection-limitation-report-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-qa-evidence-workflow-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-qa-evidence-workflow-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-resume-eligibility-literals-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-resume-eligibility-literals-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-ticket-removal-operation-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-ticket-removal-operation-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-turbo-task-specification-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-turbo-task-specification-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-typecheck-report-headings-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-typecheck-report-headings-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-workspace-package-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-workspace-package-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pa-yeet-verification-workflow-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pa-yeet-verification-workflow-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-admission-capacity-state-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-admission-capacity-state-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-admission-policy-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-admission-policy-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-admission-priority-aging-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-admission-priority-aging-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-admission-priority-class-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-admission-priority-class-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-affected-task-input-mode-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-affected-task-input-mode-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-attempt-event-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-attempt-event-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-attempt-retention-limit-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-attempt-retention-limit-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-audit-lane-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-audit-lane-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-boundary-violation-severity-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-boundary-violation-severity-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-ci-timeout-flake-label-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-ci-timeout-flake-label-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-coverage-lane-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-coverage-lane-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-docgen-affected-scope-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-docgen-affected-scope-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-docgen-proof-marker-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-docgen-proof-marker-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-failure-attribution-category-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-failure-attribution-category-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-fallow-dead-code-command-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-fallow-dead-code-command-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-fallow-failure-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-fallow-failure-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-fallow-provenance-schema-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-fallow-provenance-schema-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-jsdoc-ratchet-lane-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-jsdoc-ratchet-lane-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-knip-lane-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-knip-lane-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-labs-lane-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-labs-lane-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-lint-fix-lane-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-lint-fix-lane-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-origin-block-grace-window-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-origin-block-grace-window-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-package-dependency-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-package-dependency-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-package-verification-heading-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-package-verification-heading-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-pilot-recorded-at-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-pilot-recorded-at-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-planned-lane-status-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-planned-lane-status-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-quality-issue-category-type-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-quality-issue-category-type-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-repo-run-mode-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-repo-run-mode-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-repo-wide-proof-label-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-repo-wide-proof-label-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-resolved-cache-posture-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-resolved-cache-posture-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-review-fix-class-cap-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-review-fix-class-cap-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-runner-loss-flake-label-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-runner-loss-flake-label-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-schedule-projection-specification-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-schedule-projection-specification-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-scheduler-process-owner-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-scheduler-process-owner-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-scheduler-progress-interval-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-scheduler-progress-interval-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-security-lane-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-security-lane-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-topological-package-report-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-topological-package-report-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-turbo-config-proof-task-label-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-turbo-config-proof-task-label-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-turbo-empty-outputs-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-turbo-empty-outputs-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-turbo-env-passthrough-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-turbo-env-passthrough-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-turbo-global-configuration-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-turbo-global-configuration-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-turbo-output-logging-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-turbo-output-logging-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-verification-evidence-receipt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-verification-evidence-receipt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pb-yeet-proof-tier-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pb-yeet-proof-tier-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-admission-action-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-admission-action-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-affected-query-invocation-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-affected-query-invocation-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-attempt-identifier-field-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-attempt-identifier-field-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-checkout-root-field-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-checkout-root-field-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-ci-lane-labels-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-ci-lane-labels-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-environment-config-tokens-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-environment-config-tokens-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-failure-kind-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-failure-kind-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-fallow-gate-value-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-fallow-gate-value-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-heartbeat-suspicion-policy-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-heartbeat-suspicion-policy-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-malformed-read-classification-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-malformed-read-classification-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-migration-posture-phrase-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-migration-posture-phrase-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-origin-blocked-timestamp-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-origin-blocked-timestamp-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-package-topology-report-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-package-topology-report-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-persistent-task-flag-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-persistent-task-flag-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-plan-task-constructor-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-plan-task-constructor-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-projection-contract-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-projection-contract-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-proof-selector-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-proof-selector-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-proof-task-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-proof-task-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-quality-stage-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-quality-stage-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-replay-evidence-artifact-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-replay-evidence-artifact-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-replay-fidelity-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-replay-fidelity-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-s7-implementation-report-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-s7-implementation-report-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-staleness-domain-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-staleness-domain-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-token-capacity-policy-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-token-capacity-policy-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-turbo-cache-output-config-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-turbo-cache-output-config-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-turbo-future-flags-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-turbo-future-flags-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-turbo-task-identifiers-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-turbo-task-identifiers-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-verdict-state-vocabulary-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-verdict-state-vocabulary-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-workspace-dependency-declaration-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-workspace-dependency-declaration-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-worktree-creation-mode-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-worktree-creation-mode-001.yaml
ontology/extraction/s4/beep-ci-ops/work/hypotheses/dh-pc-yeet-proof-tier-planning-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/dh-pc-yeet-proof-tier-planning-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-jv-failure-signature-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-jv-failure-signature-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-jv-failure-signature-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-jv-failure-signature-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-jv-failure-signature-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-jv-failure-signature-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-jv-merge-readiness-assessment-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-jv-merge-readiness-assessment-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-jv-merge-readiness-assessment-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-jv-merge-readiness-assessment-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-jv-merge-readiness-assessment-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-jv-merge-readiness-assessment-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-jv-verification-attempt-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-jv-verification-attempt-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-jv-verification-attempt-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-jv-verification-attempt-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-jv-verification-attempt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-jv-verification-attempt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-admission-request-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-admission-request-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-admission-request-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-admission-request-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-admission-request-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-admission-request-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-docgen-work-unit-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-docgen-work-unit-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-docgen-work-unit-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-docgen-work-unit-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-docgen-work-unit-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-docgen-work-unit-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-fallow-audit-evidence-002-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-fallow-audit-evidence-002-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-fallow-audit-evidence-002.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-fallow-audit-evidence-002.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-fallow-audit-evidence-002.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-fallow-audit-evidence-002.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-package-dependency-closure-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-package-dependency-closure-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-package-dependency-closure-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-package-dependency-closure-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-package-dependency-closure-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-package-dependency-closure-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-projection-limitation-report-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-projection-limitation-report-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-projection-limitation-report-001-r3.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-projection-limitation-report-001-r3.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-projection-limitation-report-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-projection-limitation-report-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-projection-limitation-report-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-projection-limitation-report-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-turbo-task-specification-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-turbo-task-specification-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-turbo-task-specification-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-turbo-task-specification-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-turbo-task-specification-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-turbo-task-specification-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-turbo-task-specification-002-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-turbo-task-specification-002-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-turbo-task-specification-002.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-turbo-task-specification-002.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-turbo-task-specification-002.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-turbo-task-specification-002.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-yeet-verification-workflow-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-yeet-verification-workflow-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-yeet-verification-workflow-001-r3.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-yeet-verification-workflow-001-r3.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-yeet-verification-workflow-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-yeet-verification-workflow-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pa-yeet-verification-workflow-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pa-yeet-verification-workflow-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-admission-policy-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-admission-policy-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-admission-policy-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-admission-policy-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-admission-policy-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-admission-policy-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-admission-priority-aging-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-admission-priority-aging-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-admission-priority-aging-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-admission-priority-aging-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-admission-priority-aging-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-admission-priority-aging-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-admission-priority-class-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-admission-priority-class-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-admission-priority-class-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-admission-priority-class-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-admission-priority-class-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-admission-priority-class-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-package-dependency-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-package-dependency-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-package-dependency-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-package-dependency-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-package-dependency-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-package-dependency-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-planned-lane-status-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-planned-lane-status-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-planned-lane-status-001-r3.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-planned-lane-status-001-r3.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-planned-lane-status-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-planned-lane-status-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-planned-lane-status-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-planned-lane-status-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-resolved-cache-posture-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-resolved-cache-posture-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-resolved-cache-posture-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-resolved-cache-posture-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-resolved-cache-posture-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-resolved-cache-posture-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-review-fix-class-cap-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-review-fix-class-cap-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-review-fix-class-cap-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-review-fix-class-cap-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-review-fix-class-cap-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-review-fix-class-cap-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-scheduler-process-owner-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-scheduler-process-owner-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-scheduler-process-owner-001-r3.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-scheduler-process-owner-001-r3.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-scheduler-process-owner-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-scheduler-process-owner-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-scheduler-process-owner-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-scheduler-process-owner-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-verification-evidence-receipt-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-verification-evidence-receipt-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-verification-evidence-receipt-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-verification-evidence-receipt-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pb-verification-evidence-receipt-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pb-verification-evidence-receipt-001.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pc-token-capacity-policy-001-r2.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pc-token-capacity-policy-001-r2.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pc-token-capacity-policy-001.review.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pc-token-capacity-policy-001.review.yaml
ontology/extraction/s4/beep-ci-ops/work/proposals/otp-pc-token-capacity-policy-001.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/otp-pc-token-capacity-policy-001.yaml
ontology/extraction/s4/beep-ci-ops/work/denotation-batches/adversary-a.txt -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/denotation-batches/adversary-a.txt
ontology/extraction/s4/beep-ci-ops/work/denotation-batches/adversary-b.txt -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/denotation-batches/adversary-b.txt
ontology/extraction/s4/beep-ci-ops/work/denotation-batches/adversary-r2-a.txt -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/denotation-batches/adversary-r2-a.txt
ontology/extraction/s4/beep-ci-ops/work/denotation-batches/adversary-r2-b.txt -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/denotation-batches/adversary-r2-b.txt
ontology/extraction/s4/beep-ci-ops/work/denotation-batches/batch-journal.txt -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/denotation-batches/batch-journal.txt
ontology/extraction/s4/beep-ci-ops/work/denotation-batches/batch-ordering.txt -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/denotation-batches/batch-ordering.txt
ontology/extraction/s4/beep-ci-ops/work/denotation-batches/batch-prose-a.txt -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/denotation-batches/batch-prose-a.txt
ontology/extraction/s4/beep-ci-ops/work/denotation-batches/batch-prose-b.txt -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/denotation-batches/batch-prose-b.txt
ontology/extraction/s4/beep-ci-ops/work/denotation-batches/batch-prose-c.txt -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/denotation-batches/batch-prose-c.txt
ontology/extraction/s4/beep-ci-ops/work/review-audit/validity-report.md -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/review-audit/validity-report.md
ontology/extraction/s4/beep-ci-ops/work/sittings/carried-clusters.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/sittings/carried-clusters.yaml
ontology/extraction/s4/beep-ci-ops/work/sittings/carried-rows-docket.md -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/sittings/carried-rows-docket.md
ontology/extraction/s4/beep-ci-ops/work/sittings/ratification-docket.md -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/sittings/ratification-docket.md
ontology/extraction/s4/beep-ci-ops/work/sittings/ratification-docket.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/sittings/ratification-docket.yaml
ontology/extraction/s4/beep-ci-ops/work/sittings/sitting-1-decisions-entry.md -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/sittings/sitting-1-decisions-entry.md
ontology/extraction/s4/beep-ci-ops/work/sittings/sitting-2-decisions-entry.md -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/sittings/sitting-2-decisions-entry.md
ontology/extraction/s4/beep-ci-ops/work/sittings/sitting-3-decisions-entry.md -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/sittings/sitting-3-decisions-entry.md
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-034.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-034.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-035.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-035.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-036.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-036.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-038.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-038.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-040.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-040.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-041.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-041.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-042.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-042.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-043.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-043.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-044.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-044.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-045.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-045.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-046.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-046.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-047.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-047.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-048.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-048.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-049.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-049.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-050.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-050.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-051.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-051.yaml
ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-052.yaml -> ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-052.yaml
```

</details>

### Files

Paths below are relative to `explorations/beep-ci-operational-ontology/`.
Directory moves include every child, itemized in the report's exact relocation
payload inventory. No commit was created; `ontology/extraction/s4/beep-ci-ops/work/` is empty.

Created or edited:

- `research/run3-lanes/run3-pin-engine-report.md`
- `research/OPPORTUNITIES.md`
- `ontology/extraction/s4/beep-ci-ops/adapters/adapter-journal-run3.py`
- `ontology/extraction/s4/beep-ci-ops/adapters/README.md`
- `ontology/extraction/s4/beep-ci-ops/corpus/po_transcriber_run3.py`
- `ontology/extraction/s4/beep-ci-ops/runs/orun-2026-09-03T02:46:18Z.README.md`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/README.md`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-042a0878d960.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-0472df5b1c1d.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-0739289e4cbc.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-0a952c2b02e4.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-1cbd494ab947.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-1f7ebed27efb.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-21ebe1c3199d.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-24d707d0b0e2.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-2a476bc6839a.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-3eeb112e2c2d.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-400f043b8fc7.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-4bdac49b0f0d.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-4f13dd515d19.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-52162838e234.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-6704a56ebbdc.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-67c9eb5580ff.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-7120db8d369f.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-73c870c03d7f.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-89911abdb5d9.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-a5cba4f5b23e.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-aedb815bd509.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-b56cfe2d0004.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-bc15f6abfbfe.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-c02a2b1dd7c2.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-d4ae38cef5ef.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-d8a8d0d683fe.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-ddaa23bdcf0d.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-e05802e29bf9.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-e9a83c50f4e2.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-f4f3a0bf796c.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected/so-fd785c9dc671.yaml.expected`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/expected-metadata.yaml`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-checkout-identity/bindings/a.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-checkout-identity/bindings/b.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-checkout-identity/bindings/c.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-checkout-identity/bindings/d.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-checkout-identity/bindings/e.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-checkout-identity/fleet-snapshot.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-fleet/admission/canonical/journal.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-fleet/admission/session-tmp/journal.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-fleet/attempts/a/a/attempts.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-fleet/attempts/a/b/attempts.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-fleet/attempts/a/c/attempts.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-fleet/live/grammar.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-fleet/verdicts/a/a/verdict.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-fleet/verdicts/a/b/verdict.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-fleet/verdicts/a/c/verdict.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3-fleet/verdicts/a/d/verdict.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3b-fleet/admission/canonical/journal.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3b-fleet/admission/canonical/protocol.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3b-fleet/admission/session-tmp/journal.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3b-fleet/attempts/a/a/attempts.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3b-synthetic/admission/synthetic/journal.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3b-synthetic/admission/synthetic/protocol.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3b-synthetic/attempts/a/scenario/attempts.properties`
- `ontology/extraction/s4/beep-ci-ops/adapters/golden/journal-run3/input/run3b-synthetic/attempts/b/scenario/attempts.properties`

Moved with unchanged bytes:

- `ontology/extraction/s4/beep-ci-ops/work/alternative/` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/alternative/` (80 files)
- `ontology/extraction/s4/beep-ci-ops/work/foundational/` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/foundational/` (80 files)
- `ontology/extraction/s4/beep-ci-ops/work/hypotheses/` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/hypotheses/` (121 files)
- `ontology/extraction/s4/beep-ci-ops/work/proposals/` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/` (67 files)
- `ontology/extraction/s4/beep-ci-ops/work/denotation-batches/` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/denotation-batches/` (9 files)
- `ontology/extraction/s4/beep-ci-ops/work/review-audit/` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/review-audit/` (1 file)
- `ontology/extraction/s4/beep-ci-ops/work/sittings/` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/sittings/` (7 files)
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-034.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-034.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-035.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-035.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-036.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-036.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-038.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-038.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-040.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-040.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-041.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-041.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-042.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-042.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-043.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-043.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-044.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-044.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-045.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-045.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-046.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-046.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-047.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-047.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-048.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-048.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-049.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-049.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-050.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-050.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-051.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-051.yaml`
- `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-052.yaml` -> `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-052.yaml`
