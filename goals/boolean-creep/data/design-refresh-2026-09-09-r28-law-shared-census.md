# R28 law-practice and shared-document census adjudication

Frozen HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`; corpus main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Parent P2 source adjudication
of the completed independent domain/runtime/shared reports. This does not
advance independent P3, implementation or dry-round status.

## Ineligible owners

| Stable ID | Current source proof |
| --- | --- |
| `r3-domains-court-reporter-vocab-drift-probes` | `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.compatibility.ts`: CourtReporterVocabulary.compatibility.ts:171-193 defines three comparison functions; the actual producer has only additiveRangeSplit at351 and invokes hasSemanticDrift at353. No three-Boolean driftProbes owner. |
| `r3-domains-hohfeld-orbit-guards` | `packages/law-practice/domain/src/values/HohfeldPositionKind/HohfeldPositionKind.model.ts`: HohfeldPositionKind.model.ts:147,207,267 declares typed predicate functions for existing literal subdomains. |
| `r3-domains-act-frame-shape-probes` | `packages/law-practice/domain/src/entities/ActFrame/ActFrame.values.ts`: ActFrame.values.ts:345-346 and362 defines callable validators passed into S.makeFilter at517/523; no stored Boolean pair. |
| `r3-domains-patent-normalizer-shape-guards` | `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts`: PatentDocument.normalizer.ts:35-36 derives S.is guards consumed for distinct values at217/334, not a shared Boolean owner. |
| `r25-law-practice-runtime-email-walk-file-kind-guards` | `packages/law-practice/server/src/PracticeKg.emails.ts`: PracticeKg.emails.ts:82-85 invokes FileInfo.guards.Directory/File on a tagged stat value; the guards themselves are functions. |
| `r25-law-practice-runtime-effective-dispositions` | `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.service.ts`: CandorPolicy.service.ts:68-76 takes retired as a HashSet and filters through a lifecycle predicate and inline set membership. There are no active/retired Boolean locals; the footer callable label is too broad for the actual non-Boolean set parameter. |

## Retained cursor state independence

The new shared-document D1 row has an actual schema owner, VaultSyncStatus,
with connected at line70 and cursorPosition at84. Its recorded synthetic
`.cursorPosition` symbol suffix is corrected to the real class name. The
server readStatus writer reads persisted cursor state separately from the
connection probe and retains that cursor through disconnection. A connected
provider may have no cursor before bootstrap, which the schema documentation
explicitly permits. Thus cursor presence does not duplicate connection state.
The full cursor string and constructor/encoded absence semantics remain intact.
This two-member relation is distinct from the existing disconnectReason and
probedAt pairs, and is census-only: no replacement design is authorized.

The four named single-member law models remain separate pending eligibility
audits; this integration does not silently remove them or reinterpret their
optional payloads. The original domain/runtime/shared raw evidence is preserved.

## Source hashes

- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts`: `84550653385405ad90878a7b3bf8d0ebdc1a5790aa6b2063c9e0ec3dbb30d374`
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts`: `6bd7223acd3c8b572b92cba3a7878a4e595dc96dda24e2ebe588fb09d09eaf68`
- `packages/law-practice/domain/src/entities/ActFrame/ActFrame.values.ts`: `a15b4f8f25b17a327a4bcc1b458721ae31fad326429fa6554c62d7fd34de92f6`
- `packages/law-practice/domain/src/values/CourtReporterVocabulary/CourtReporterVocabulary.compatibility.ts`: `1cebbebef1fb8f7068686f8340d61be868897a4818395cc7cc0461fba36c647e`
- `packages/law-practice/domain/src/values/HohfeldPositionKind/HohfeldPositionKind.model.ts`: `99b3a77337eabd2cf9bd245c66c6f58bd6b14d7ac1fa03ff298475157570aa24`
- `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts`: `4de772b98daa217ef1f820bcabdc17def7ba433f4cf8050f97318cb20007d571`
- `packages/law-practice/server/src/PracticeKg.emails.ts`: `d56d923fc9ec8a315c11e892178d4c8b4bee66c8ab364f446687f40125eee80d`
- `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.service.ts`: `70081e3b236451ed862c5574c1613dcab3e742050fca765de5b8aec9f159820d`
