# Practice Document Identification Spec

## Objective

Give the practice a repeatable, measured way to answer "which client and which
docket does this document belong to?" for documents that were never filed by
hand: old-drive files, unplaced uploads, and new intake. The tooling turns the
attorney's own data (his answers, his client folders, his filed email, his
contacts) plus public USPTO records and extracted document content into a
resolution per document: a client, a docket, an evidence list, and a
confidence tier whose precision has been measured on documents he filed
himself.

This packet makes the private, one-off identification passes of
`goals/practice-box-onboarding` (passes 2 and 3, 2026-10-06) into
repository tooling, at the operator's request.

## Non-Goals

- No Box writes. The tooling produces a plan; applying it stays with the Box
  content migration engine and an explicit go.
- No client data in the repository: contacts, documents, extractions,
  evaluation sets, and plans are inputs and outputs on private paths.
  Fixtures are synthetic.
- No people-search OSINT. Organisation lookups only, through public
  registration data, and only for domains the attorney's own data does not
  cover.
- No new paid endpoint. Extraction runs on an existing model subscription
  outside the repository; the repository reads its output.
- No guessing: a document without enough evidence stays unresolved.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development).
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/law-practice/use-cases/src/DocumentIdentification/` — schemas,
  service contracts (ports), and the pure resolver and evaluator.
- `packages/law-practice/server/src/DocumentIdentification/` — adapters:
  contact file parsing, USPTO record lookup (through `@beep/uspto`),
  registration-data lookup (RDAP), and a reader for extractor/critic output.
- `apps/practice-identify/` — a runnable command with subcommands for each
  stage, reading and writing private paths given as flags.
- This packet.

## Design

Design order is schema, then service contract, then implementation.

### Schemas (use-cases slice)

| Schema | Purpose | Key fields |
| --- | --- | --- |
| `ContactSource` | Where a card came from | `LiteralKit(["outlook-csv", "vcard"])` |
| `ContactEmail` | One address | `address` (lower-cased, trimmed), `role` (boolean: shared or role mailbox) |
| `PhoneNumber` | One number | `e164`, `areaCode` (Option, North American numbers) |
| `Contact` | One deduplicated person or organisation | `contactId` (stable hash), `displayName`, `organization` (Option), `titles`, `emails`, `domains`, `phones`, `addresses`, `sources`, `links` |
| `ContactLinkSource` | Strength ladder of a link | `LiteralKit(["attorney-answer", "attorney-pc-folder", "attorney-docket-sheet", "attorney-filed-email", "org-name-match", "email-subject-ref"])` |
| `ContactLink` | Contact to client or matter | `clientNumber`, `familyKey` (Option), `source`, `evidence` |
| `ClientNumber` | Five-digit client number | branded string |
| `DocketId` | Family + country + sequence | branded string, e.g. family `10003`, `US`, `01` |
| `ClientDocketPair` | Known (client, docket) | `clientNumber`, `docket`, `sources` (counts per source) |
| `ClientIndexEntry` | One client | `clientNumber`, `names` (with source), `folders` |
| `ExtractedParty` | One party in a document | `name`, `kind`, `role` (`LiteralKit`), `quote` |
| `DocumentExtraction` | Extractor output | `docType` (`LiteralKit`), `title`, `parties`, `dockets`, `applicationNumbers`, `patentNumbers`, `emails`, `dates` |
| `CriticVerdict` | Critic output | `keepParties`, `keepDockets`, `docType`, `problems` |
| `EvidenceKind` | Kind of an evidence line | `LiteralKit` of the signals in the tier table |
| `EvidenceLine` | One reason | `kind`, `detail` (no document text) |
| `ConfidenceTier` | Outcome tier | `LiteralKit(["identified", "identified-content", "candidate", "ambiguous", "unknown"])` |
| `Resolution` | Answer for one document | `clientNumber` (Option), `docket` (Option), `tier`, `evidence` |
| `EvaluationReport` | Measured quality | per tier: `resolved`, `right`, `wrong`, `precision`, `coverage`; split sizes |

### Service contracts (use-cases slice)

| Service | Method | Notes |
| --- | --- | --- |
| `ContactCardSource` | `cards(): Stream<RawContactCard>` | Reads Outlook CSV and vCard input |
| `UsptoRecordLookup` | `byApplication(number)`, `byPatent(number)` → `Option<UsptoRecordFacts>` (docket number, first applicant) | Sends only the number |
| `DomainRegistrantLookup` | `registrant(domain)` → `Option<string>` | RDAP; redacted answers are `None` |
| `DocumentExtractionSource` | `extraction(documentId)` → `Option<{extraction, verdict}>` | Reads extractor/critic output produced outside the repository |

Pure functions (no services): `normaliseContacts`, `buildClientDocketPairs`,
`linkContacts`, `fitTokenFilter` (from the training split only), `resolve`
(one document, all evidence), `holdOutSplit` (deterministic, by content hash),
`evaluate`.

### Confidence tiers

| Tier | Rule | Measured on the hold-out (2026-10-06) |
| --- | --- | --- |
| identified | an identical copy sits in his client folder, or the document carries an explicit client.docket reference, or a USPTO record lists his client.docket for an application the document cites | 448 / 449 right (99.8%) |
| identified-content | critic-confirmed extraction matches one client through at least two independent sources, with a 3× margin over the next client (score ≥ 5) | 51 / 51 right (6 / 6 on the default split) |
| candidate | one client leads by 2× on weaker evidence (score ≥ 3) | 194 / 194 right on the pass-3 split, 220 / 220 on the default split; never applied without the attorney (pass 3's stricter rule measured 17 / 18) |
| ambiguous / unknown | conflicting or insufficient evidence | stays where it is |

### Pipeline stages (app subcommands)

1. `contacts` — Outlook CSV + vCard → deduplicated contacts with role
   mailboxes marked; a projection without phones and addresses for other
   consumers.
2. `index` — client index and (client, docket) pairs from the attorney's
   answers, his client folders, his docket sheet, the practice KG register,
   and references in old email subjects; contact links.
3. `uspto` — public record lookups for application and patent numbers found
   in unresolved documents; every query shape and count appended to a
   ledger.
4. `resolve` — one resolution per document, using all evidence above plus
   the extractor/critic output.
5. `evaluate` — fixed 80/20 split of the documents he filed himself; filters
   fitted on the 80% only; precision and coverage per tier on the 20%.

## Constraints

- Docket numbers repeat across clients (the attorney's note): every match is
  on a (client, docket) pair, never on a docket alone.
- An evidence token seen in more than one client's training documents
  (letterhead phones, the attorney's own name) carries no client signal.
- Every extracted party and docket used as evidence carries a verbatim quote
  the critic confirmed.
- Outputs carry ids, hashes, tiers, and evidence kinds; they never echo
  document text.
- Every external lookup is logged by query shape and count.

## Decision Log

| # | Date | Decision | Why |
| --- | --- | --- | --- |
| D1 | 2026-10-06 | Build the identification passes as repository tooling: a `DocumentIdentification` slice in `@beep/law-practice` use-cases and server, and an `apps/practice-identify` command. | Operator: "ideally this isn't one off & we have dedicated tooling for it in the repo after." The mail-tagging slice and app are the precedent. |
| D2 | 2026-10-06 | Match on (client number, docket) pairs only. | The attorney's note: the same docket numbers live under different client-number folders. 77 of 673 dockets in the pairs appear under more than one client. |
| D3 | 2026-10-06 | Measure on documents the attorney filed himself, with a fixed 20% hold-out by content hash, filters fitted on the 80% only, and the identical-copy signal off while scoring. | An earlier 92% figure was fitted on machine-attributed files; on his own filing the explicit-reference tier is 99.8% and the 21 "errors" were run-1 attributions the document's own reference contradicts. |
| D4 | 2026-10-06 | Extraction by an extractor and a separate critic, each party and docket quoted verbatim; only critic-confirmed items count. | Same adversarial pattern as docket intake; token matching alone misattributed letterhead and the attorney's own name. |
| D5 | 2026-10-06 | Use the public USPTO record (attorney docket number, first applicant) for numbers found in documents; send numbers only. | It added 32 identified documents; most records carry the prior firm's docket format, so the gain is modest. |
| D6 | 2026-10-06 | Registration-data lookups (RDAP) stay available but are not used as evidence by default. | 3 of 52 domains named a registrant; 35 were redacted. |
| D7 | 2026-10-06 | Blank agreement forms (placeholders, no principal party) and the old firm folder's files are organised into firm administration folders without a client. | 616 documents moved out of "unknown" with no client risk. |
| D8 | 2026-10-06 | The second attorney questionnaire (v3, 88 questions) is not deployed; the target is at most 20 hard cases after machine resolution. | Operator: "we need to rethink & do a better job of identifying & organizing things before we give him another large review to do." |
| D9 | 2026-10-06 | Identified moves (844) are held until the operator rules on the measured precision. | Orchestrator ruling: a misfile in a client matter is worse than a day's delay. |
| D10 | 2026-10-06 | The Box service account's storage allocation was raised to unlimited through the API, with the operator's approval in chat. | It was 10 GB with 21.9 GB used, so every upload returned HTTP 403. |
| D11 | 2026-10-06 | The hold-out split is `sha256(salt \| contentHash) mod 5 = 0`, with the salt a CLI flag (`--split-salt`, default `holdout`). | Reusing a salt reproduces an earlier split exactly; pass 3 used `pass3`, and the repo CLI reproduces its numbers on it. |
| D12 | 2026-10-06 | The resolver carries pass 3's weighted rule: role weights (applicant/assignee/client 3, addressee/recipient/inventor/assignor 2, signatory/author 1), content votes per party, text votes capped at 3 and counted as one source, `identified-content` at score ≥ 5 with ≥ 2 independent sources and a 3× margin, `candidate` at score ≥ 3 with a 2× margin. | Unweighted votes gave different tiers on the same documents; the measured rule is the contract. |
| D13 | 2026-10-06 | The practice KG docket stage list gains the codes the attorney's own folders and email subjects use (IT, TW, CL, CO, TR, MY, EM, EO, ZK). | The index silently dropped 12 real (client, docket) pairs whose stage code was not in the list; the index now carries 846 pairs. The matter-lookup reference extractor widens with it. |
| D14 | 2026-10-06 | Private JSON inputs carry every optional field explicitly as `null`; the vCard reader skips inline binary properties (photos) and accepts `\r\r\n` line endings. | `S.OptionFromNullOr` rejects a missing key; the attorney's vCard export carried eight embedded photos and doubled carriage returns and failed as a whole. |
| D15 | 2026-10-06 | Learned-name filters store normalised training text once (`LearningText`); phrase matchers compile once per contact. | The first `evaluate` run took over four minutes re-normalising text per phrase; it now takes about a minute. |
| D16 | 2026-10-06 | The 844 identified moves and the 616 organise moves were applied on 2026-10-06 after the operator's approval, relayed by the orchestrator; an undo journal records every folder created and every file moved. The second questionnaire runs as a 20-question loopback preview for the operator only. | Supersedes D9's hold. Measured precision of the identified tier met the 99% stop condition with room. |

## Acceptance Criteria

- [x] Schemas and service contracts above exist in the use-cases slice with
      synthetic fixtures and tests.
- [x] Adapters exist in the server slice; USPTO and RDAP adapters are tested
      against recorded, synthetic responses with no live calls in tests.
- [x] `apps/practice-identify` runs each stage from private input paths and
      writes private outputs; nothing it writes enters the repository.
- [x] Running `evaluate` on the private data reproduces the hold-out numbers
      in the tier table within one document, and the report lands in
      `history/` as counts only.
- [x] Package verify passes for every touched workspace.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/practice-document-identification/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/practice-document-identification/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/practice-document-identification` | Passes |
| Use-cases verify | `bun run beep quality package-verify @beep/law-practice-use-cases` | Passes |
| Server verify | `bun run beep quality package-verify @beep/law-practice-server` | Passes |
| App verify | `bun run beep quality package-verify @beep/practice-identify` | Passes |
| Held-out evaluation | `history/` report, counts only | Recorded |

## Stop Conditions

- Anything that costs money, including a new paid model endpoint.
- A request to put client documents, contacts, or extractions in the
  repository.
- Measured precision of a tier proposed for automatic filing below 99% on the
  hold-out.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
