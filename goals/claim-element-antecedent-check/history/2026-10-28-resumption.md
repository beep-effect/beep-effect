# Claim-element antecedent check: resumption evidence (2026-10-28)

## State and scope

Started from `origin/main` at `d3c684edea` in the dedicated
`feat/claim-element-antecedent-check-resume` worktree. Existing source-checkout
changes were preserved. Packet lifecycle remains `active`; no completion is
claimed and no PR was created in this unit of work.

## Access evidence

Status-only authenticated HTTPS probes, using the existing USPTO secret via
the approved agent `op` route, returned:

| Read | Result |
| --- | --- |
| `GET /api/v1/patent/applications/16123456` | HTTP 403 |
| `GET /api/v1/patent/applications/16123456/documents` | HTTP 403 |

Secret values and response bodies were neither printed nor persisted.
The agent route resolved the reference successfully. The doctor reported that
the current-shell shim and service-account identity worked; its user-service
PATH and user-bus checks failed in this execution environment. No desktop
sign-in was requested. The desktop Environments MCP was unavailable and skipped.
An HTTP 403 establishes denied access, not its precise cause. The operator
must restore authorized access through the USPTO account and update the existing
secret before the live acquisition can be resumed.

## Implementation

- Added `UsptoDocumentDownloadOption`, preserving each schema-valid source
  option's URL and optional format label in `UsptoDocumentReference.downloadOptions`.
- Retained the first `downloadUrl` for existing driver callers.
- `UsptoClaimsLive` selects a labelled XML option (`XML`, `application/xml`,
  `text/xml`, case-insensitive) and fails before download when none exists.
- The adapter fixture now lists PDF before XML; the adapter still yields the
  normalized XML claims. Driver regression assertions cover ordering, format
  preservation, unlabelled URLs, and malformed options.
- Corrected the SPEC verification command to the actual combined
  `ClaimElement.rules.test.ts` suite.

## Verification

| Check | Result |
| --- | --- |
| Domain `ClaimElement.test.ts` | 15 tests passed |
| Domain `ClaimElement.rules.test.ts` | 34 tests passed |
| Use-cases `ClaimSelfCheck.test.ts` | 6 tests passed |
| Server `UsptoClaims.test.ts` after repair | 2 tests passed |
| Driver `Uspto.service.test.ts` | 12 tests passed |
| `quality package-verify @beep/uspto` | audit and docgen passed |
| `quality package-verify @beep/law-practice-domain` | audit and docgen passed |
| `quality package-verify @beep/law-practice-use-cases` | audit and docgen passed |
| `quality package-verify @beep/law-practice-server` | audit and docgen passed |
| Launcher <= 4,000 characters; manifest JSON | passed |
| `beep goals doctor` | no new blocking findings; none names this packet |
| `git diff --check` | passed |
| `beep lint reflection-artifacts` | zero blocking or advisory findings; final closeout reflection still pending |
| `PatentDocument.model.ts` diff against `origin/main` | empty |

The first driver package verification exposed a decoder callback signature
error and a pipe-style diagnostic introduced in this repair. Both were fixed;
the full driver verification then passed. Package verification exercises
synthetic/recorded fixtures, not live USPTO evidence.

## Completion audit and remaining work

| Requirement | Evidence and current disposition |
| --- | --- |
| P0 schemas / stable PatentClaim | Existing schemas and 15 passing round-trip tests; PatentClaim diff empty |
| P1 contracts | Existing service/port contracts; domain and use-cases package verification passed |
| P2 deterministic rules / service / adapter | Existing 34 rule tests and 6 service tests pass; XML-selection regression repaired; public data not verified |
| Real rejection vertical slice | Incomplete: no office-action identifier, rejection date and in-force XML claims bound in a gold fixture |
| ~60 labelled families / ~200 allowed sets | Incomplete: access denied; no new public corpus acquired or labelled |
| Extractor/critic loop and attorney spot-check | Incomplete: no corpus or attorney agreement evidence; agent tests cannot substitute |
| P3 read tool and review envelope round-trip / projection | Pending: P2 exit criteria not met; sibling review-verdict packet is completed-retained |
| Strict structural evaluation, per-rule metrics, typed-edge F1 | Incomplete: no qualified labelled set |
| Adjudicated false-positive rate and interval | Incomplete: no allowed sample and attorney adjudication |
| Non-US, non-gold IPRally smoke test | Pending P3 |
| Advisory findings and exclusions | Repair touches only download selection, driver models, tests and packet docs; no gate, PatentClaim change, NC dataset, client data or gated feature added |
| Yeet PR to mergeable / completed-retained / close reflection | Not reached; do not flip packet state or present the repair as goal completion |

Resume with a status-only ODP probe after the existing secret is updated.
Then acquire provenance-bound public XML claims and real rejection records,
perform the bounded labelling and attorney review, and advance through P3
evaluation, Yeet and the final reflection in the order required by PLAN.md.

## Access restored after operator update

The operator reported the secret updated. Fresh authenticated reads of both
the application and document-list endpoints returned HTTP 200. Application
`16123456` has 52 listed documents, including two `CLM` records with PDF then
XML options, and one `CTNF` record with PDF, MS_WORD and XML options.
This supersedes the current access blocker above, while preserving its history.
Live XML shape and real-rejection qualification remain to be verified.

## Native source qualification and adapter extension

Live file-wrapper XML options were TAR containers whose extracted claims XML
has namespaced `Claim` / `ClaimText`, OCR-confidence records and amendment
markup. These were excluded from gold acquisition.

ODP application metadata exposes `pgpubDocumentMetaData` and
`grantDocumentMetaData`, including individual native XML download references.
The native publication for application `15752303` was downloaded and parsed as
`us-patent-application` with 16 claims, SHA-256
`2a2f1f4d403354098d494d0863c90301a029dce4764ef98721d926decb180edd`.
A weekly archive was also fetched during source discovery (148,573,863 bytes);
the individual-record route avoids requiring that bulk transfer in the adapter.

Office-action text retrieval returned 10 antecedent rejection candidates with
public application/document IDs, dates and explicit rejection sections. The
minimal candidate receipt is `research/office-action-candidates.json`. These
are **not gold labels**: in-force claim versions, eligibility, CPC strata and
attorney review remain outstanding.

The driver now retains native publication references, and the adapter's
existing publication source branch resolves a matching application and reads
its native XML. Download redirects are explicit and credential-scoped.
A live invocation of `ClaimSelfCheck.checkPublished` encountered a typed
`rate-limited` driver failure; no end-to-end success is claimed for that call.

### Live native pipeline passed after redirect qualification

The native publication downloads redirect from `api.uspto.gov` to
`data.uspto.gov` (file-wrapper XML redirects to `data-documents.uspto.gov`).
Both exact HTTPS hosts are now accepted as bounded redirects, with the API
key omitted on the cross-host request. A regression test covers both and
rejects a lookalike host before requesting it.

`ClaimSelfCheck.checkPublished` succeeded live for `US20200109732A1`:
16 normalized claims, 16 element trees, zero undecomposed claims and 191
advisory findings. This supersedes the transient rate-limit and first narrow
redirect failure; it is pipeline proof, not a structural accuracy score.

Claim 1's native publication text matches the original filed claim 1's
non-whitespace characters. The original `CLM` document predates the rejection;
the next listed claim amendment postdates both the rejection and publication.
The office action explicitly identifies claim 1's phrase `the foot`; the
checker emitted `missing-antecedent` at `[356, 364)` quoting that exact phrase.
The independently labelled expected tree and a network-free native-source
replay test are being reviewed; attorney spot-check remains outstanding.

### Independent labelling and coverage correction

A separate GPT-6.1-Sol medium extractor labelled claim 1 without reading
implementation output. A separate GPT-6.1-Sol medium critic audited the
proposal and original/publication version correspondence. Both accepted
at 0.99 confidence against the 0.95 threshold. Their review found a coverage
omission: `its forward part` was silently skipped. The bounded scan now
retains `its` / `their` as `bare` terms and the policy emits
`pattern-not-covered` (`unsupported-determiner`) without pronoun resolution.
Both agents independently re-reviewed the amended label in a second round.
The final expected tree has two elements, ten terms and one typed edge.
Exact technical regression checks include the missing-antecedent span
`the foot` `[356,364)` and the uncovered possessive `[199,215)`.
Attorney sampling remains pending.

Native allowed-claim source collection is running separately. Its candidates
are not clean negatives: exclude out-of-scope formats/chemistry, normalize and
stratify them, then adjudicate before calculating false-positive rates.
ODP metadata search enforces a 100-row page limit (a 200-row request returned
400); acquisition now uses pages of 100.

### Verification after the native-source and coverage changes

All four full package verifications passed again on the local source:
`@beep/uspto`, `@beep/law-practice-domain`,
`@beep/law-practice-use-cases`, `@beep/law-practice-server`.
The standalone domain schema/rules run passed 50 tests; the public native
slice plus adapter run passed four tests. The final server package audit
includes the new slice and the explicit possessive abstention assertion.
`goals doctor` reports no new blocking findings and none naming this packet;
`lint reflection-artifacts` has zero findings.

The selected first vertical slice is technically verified. P2c remains open:
one claim's accepted tree is not a labelled family, the full corpus is not
yet qualified, and no attorney agreement or adjudicated FP score exists.

### Corpus source acquisition checkpoint

The first paced native-grant pass processed 192 references: 187 native claim
sets containing 2,367 claims were acquired; five responses failed native XML
parsing/qualification. These counts are pre-scope-screening and
pre-adjudication, not a false-positive denominator. An additional utility
metadata page supplies 99 references; source acquisition is continuing with
cache hashes preserved. Candidate metadata and claims-only XML remain in the
local acquisition cache until scope, strata, provenance and source eligibility
are verified. The larger real-rejection candidate pool is being acquired
through the bound ODP office-action text source.

Next work: finish current native acquisition; remove design/chemistry and
unqualified sources; choose and record CPC strata; bind original in-force
claim versions for approximately 60 positive families; run the bounded
extractor/critic loop; prepare attorney spot-check/adjudication artifacts;
only then enter P3. No accuracy, FP rate or corpus completion is claimed.

### Source acquisition terminal checkpoint

The expanded native-grant pass processed 291 references and acquired
286 native claim sets containing 3960 claims.
This is a source pool, not the final approximately 200 in-scope allowed sets.
Design/chemistry exclusions, CPC sampling and attorney adjudication still apply.

The office-action candidate query yielded 100 distinct public applications.
Metadata qualification has processed 100 at this checkpoint;
83 have an original-version chronology candidate, and
91 provide native publication links. Original text correspondence
and actual scope still require verification before these count as positives.

## Semantic-reference correction and complete source audit

The independent protocol critic found a fidelity defect: annotation had required P2 parser heuristics, turning reference answers into rule-conformance receipts. Fourteen active family drafts (81 trees, 1,409 schema-valid anchors) were preserved under `history/label-conformance-drafts/` and removed from gold paths. No accuracy claim is supported by those drafts. semantic-reference/v2 now follows source grammar and schema noun-phrase meanings, labels clear unsupported transitions, and retains implementation coverage failures separately. Production rules remain fixed.

All 60 source proposals received extractor source audits: 39 eligible proposals, 18 unresolved and 3 ineligible. Independent critic review is still pending. Material failures include competing claim versions, merged claim numbering, false independent roots, absent original corroboration and excerpts without a statutory ground. Dates/inventory alone are insufficient. Native identity/hash checks passed; they do not prove in-force wording. Source-qualified replacements and source clarification remain P2 work.

Latest full server package verification passed audit and docgen after correcting the frozen-sample test schemas to finite numbers. Corpus source hashes/quotas and the native public vertical slice remain covered. No semantic gold corpus, human agreement or false-positive estimate is complete.

## First source-qualified replacement

Replaced ineligible B slot `13978201-root-24` (12 selected claims) with the only unused pre-action B candidate `14657939-root-1` (9 selected). Independent source extractor/critic verified all nine against surviving marked-original wording, actual112(b) rejection of1–11, numbered examiner phrases, full59-row inventory and source digests. Explicit DeletedText resolves the original4/9 alternatives. No predictions were inspected for replacement selection. Former source and conformance draft remain archived; new semantic labels remain pending. Frozen60-slot proposal now totals557 selected claims. Other source holds and two ineligible slots remain.

## Source freeze and independent semantic checkpoint

All60 active source families now pass independent source criticism, with538 selected claims and unchanged CPC quotas. Ten failed original proposals were retained under source exclusions and replaced by independently qualified source-only choices. The expanded100-application source pool supplied59 additional native publications (1186 claims); only source-qualified replacements entered the sample. No positive checker predictions were used for selection. `positive-source-freeze.json` binds the final IDs/scopes/native hashes and OA provenance by a canonical SHA256 digest.

The last snapshot before targeted granularity repairs contained24 semantic draft families/195 resolved trees;19 families/156 claims had passed semantic agents and root integrity, while draft review remained active. These are progress counts, not corpus completion or correctness metrics. Later current counts live in `source-audit-summary.json`. Root found and routed an at-least-one determiner schema error; the independent round2 critic verified the exact correction.

Independent protocol review found that v2 did not require a separate term for every relative/reciprocal connector. The declared entity-mentions/v1 clarification retains determiner NPs (including abstract manner), preserves relative/reciprocal linking language as functional text when participants are explicit, and retains substantive bare/possessive references. A literal consistency inventory identified19 connector terms and2 missing a-manner phrases in prior drafts; source-specific repair/review is underway. The sole affected16068637 item already reached3 agent rounds and is reserved for actual attorney review, with prior approval retained rather than silently recertified. No production rule was changed to improve the floor.

A public positive-source integrity test now checks60 unique source slots, CPC quotas, selected scopes, source number membership and XML hashes. Its package typecheck passed after using explicit Option guards for numeric source attributes. Runtime source/reference tests and final package checks remain to be rerun on stable references. All known acquisition/rendering jobs completed; no live-data job is needed for the current frozen corpus.
