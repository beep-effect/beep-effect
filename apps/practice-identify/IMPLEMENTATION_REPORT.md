# Practice identification implementation report

Implementation stays in the requested worktree. All fixtures and generated test data are synthetic.
No direct git commands, publication, live network tests, model calls or private corpus evaluation were run.

41 synthetic tests pass (18 use-cases, 9 server, 14 app). Both package builds, source-only TypeScript,
Biome and JSDoc lint pass. Use-cases and server docgen pass. Full package verification remains blocked
by the managed sandbox denying the tsgo shim's child-process spawn (`EPERM`).

## Files

Created:

- `packages/law-practice/use-cases/src/DocumentIdentification/Identification.contacts.ts`
- `packages/law-practice/use-cases/src/DocumentIdentification/Identification.evaluation.ts`
- `packages/law-practice/use-cases/src/DocumentIdentification/Identification.pairs.ts`
- `packages/law-practice/use-cases/src/DocumentIdentification/Identification.ports.ts`
- `packages/law-practice/use-cases/src/DocumentIdentification/Identification.resolver.ts`
- `packages/law-practice/use-cases/src/DocumentIdentification/Identification.schemas.ts`
- `packages/law-practice/use-cases/src/DocumentIdentification/index.ts`
- `packages/law-practice/use-cases/test/DocumentIdentification/Identification.test.ts`
- `packages/law-practice/server/src/DocumentIdentification/Identification.contacts.ts`
- `packages/law-practice/server/src/DocumentIdentification/Identification.extraction.ts`
- `packages/law-practice/server/src/DocumentIdentification/Identification.prompts.ts`
- `packages/law-practice/server/src/DocumentIdentification/Identification.rdap.ts`
- `packages/law-practice/server/src/DocumentIdentification/Identification.uspto.ts`
- `packages/law-practice/server/src/DocumentIdentification/index.ts`
- `packages/law-practice/server/test/DocumentIdentification/Identification.adapters.test.ts`
- `apps/practice-identify/src/bin.ts`
- `apps/practice-identify/src/entrypoint.ts`
- `apps/practice-identify/src/PracticeIdentify.command.ts`
- `apps/practice-identify/src/PracticeIdentify.config.ts`
- `apps/practice-identify/test/PracticeIdentify.command.test.ts`
- `apps/practice-identify/test/PracticeIdentify.runtime.test.ts`
- `apps/practice-identify/IMPLEMENTATION_REPORT.md`

Changed:

- `packages/law-practice/use-cases/src/server.ts`
- `packages/law-practice/use-cases/package.json (exports only)`
- `packages/law-practice/server/package.json (exports only)`
- `apps/practice-identify/src/runtime/Layer.ts`
- `apps/practice-identify/package.json`
- `apps/practice-identify/README.md`

Removed HTTP scaffold:

- `apps/practice-identify/src/Api.ts`
- `apps/practice-identify/src/main.ts`
- `apps/practice-identify/test/health.test.ts`

The app manifest keeps the generator's package metadata and canonical task scripts. It adds the CLI bin
and runtime dependencies, removes the HTTP dev script, and was processed with
`bun run beep lint package-scripts --write` (zero drift). The app intentionally has no source exports.

## Exported pure API

`@beep/law-practice-use-cases/DocumentIdentification` and the server-only
`DocumentIdentification` namespace in `@beep/law-practice-use-cases/server` expose:

```ts
normaliseContacts(cards: ReadonlyArray<RawContactCard>): ReadonlyArray<Contact>
projectContacts(contacts: ReadonlyArray<Contact>): ReadonlyArray<ContactProjection>
buildClientIndex(rows: ReadonlyArray<IndexEvidence>): ReadonlyArray<ClientIndexEntry>
buildClientDocketPairs(rows: ReadonlyArray<IndexEvidence>): ReadonlyArray<ClientDocketPair>
linkContacts(contacts: ReadonlyArray<Contact>, rows: ReadonlyArray<IndexEvidence>,
  clients: ReadonlyArray<ClientIndexEntry>): ReadonlyArray<Contact>
fitTokenFilter(training: ReadonlyArray<TrainingDocument>, context: ResolverContext): TokenFilter
resolve(document: IdentificationDocument, context: ResolverContext, filter: TokenFilter): Resolution
holdOutSplit(documents: ReadonlyArray<TrainingDocument>): HoldOutSplit
evaluate(cases: ReadonlyArray<EvaluationCase>, trainSize: number): EvaluationReport
evaluateHoldOut(documents: ReadonlyArray<TrainingDocument>, context: ResolverContext): EvaluationReport
organiseDocument(path: string, text: string, docType: string, hasPrincipalParty: boolean,
  rules: OrganisationRules): OrganisationDecision
```

Every multi-argument pure helper also has a data-last overload: pass the arguments after the first
to receive a function accepting the first argument. All value schemas below use annotated `S.Class`,
`LiteralKit`, or branded schemas and have same-name runtime types. Schema expressions in the table
show constructor fields; `optional(...)` is `S.OptionFromNullOr(...)`, encoded as a value or null.

| Export | Schema fields or literal domain |
| --- | --- |
| `ContactSource` | `["outlook-csv", "vcard"]` |
| `ContactLinkSource` | `[ "attorney-answer", "attorney-pc-folder", "attorney-docket-sheet", "attorney-filed-email", "org-name-match", "email-subject-ref", ]` |
| `IndexSource` | `[ "attorney-answer", "attorney-pc-folder", "attorney-docket-sheet", "attorney-filed-email", "kg-register", "org-name-match", "email-subject-ref", ]` |
| `ClientNumber` | `branded string, five digits` |
| `DocketId` | `branded string, KG family/country/sequence format` |
| `ClientKey` | `ClientNumber \| new:<input-key>` |
| `ContentHash` | `branded lowercase SHA-256 string` |
| `ContactEmail` | `{ address: S.String.check(S.isTrimmed(), S.isLowercased(), S.isPattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u)), role: S.Boolean, }` |
| `PhoneNumber` | `{ e164: S.String.check(S.isPattern(/^\+[1-9][0-9]{7,14}$/u)), areaCode: optional(S.String.check(S.isPattern(/^[2-9][0-9]{2}$/u))), }` |
| `ContactLink` | `{ clientNumber: ClientNumber, familyKey: optional(S.NonEmptyString), source: ContactLinkSource, evidence: S.NonEmptyString, }` |
| `RawContactCard` | `{ displayName: S.String, organization: optional(S.NonEmptyString), titles: S.Array(S.String), emails: S.Array(S.String), phones: S.Array(S.String), addresses: S.Array(S.String), source: ContactSource, }` |
| `Contact` | `{ contactId: ContentHash, displayName: S.String, organization: optional(S.NonEmptyString), titles: S.Array(S.String), emails: S.Array(ContactEmail), domains: S.Array(S.String), phones: S.Array(PhoneNumber), addresses: S.Array(S.String), sources: S.Array(ContactSource), links: S.Array(ContactLink), }` |
| `ContactProjection` | `{ contactId: ContentHash, displayName: S.String, organization: optional(S.NonEmptyString), emails: S.Array(ContactEmail), sources: S.Array(ContactSource), links: S.Array(ContactLink), }` |
| `SourceCount` | `{ source: IndexSource, count: S.Natural, }` |
| `ClientDocketPair` | `{ clientNumber: ClientNumber, docket: DocketId, sources: S.Array(SourceCount), }` |
| `ClientName` | `{ name: S.NonEmptyString, source: IndexSource, }` |
| `ClientIndexEntry` | `{ clientNumber: ClientNumber, names: S.Array(ClientName), folders: S.Array(S.String), }` |
| `IndexEvidence` | `{ clientNumber: optional(ClientNumber), names: S.Array(S.String), references: S.Array(S.String), folders: S.Array(S.String), emails: S.Array(S.String), contactIds: S.Array(ContentHash), source: IndexSource, }` |
| `IdentificationIndex` | `{ clients: S.Array(ClientIndexEntry), pairs: S.Array(ClientDocketPair), contacts: S.Array(Contact), }` |
| `PartyKind` | `["person", "organization"]` |
| `PartyRole` | `[ "applicant", "inventor", "assignee", "assignor", "client", "counterparty", "addressee", "signatory", "author", "recipient", "other", ]` |
| `DocumentType` | `[ "agreement", "assignment", "declaration-or-power", "correspondence-letter", "email", "office-action", "response-or-amendment", "application-or-specification", "claims", "drawings", "invoice-or-billing", "search-or-opinion", "filing-receipt-or-notice", "form", "note-or-memo", "other", ]` |
| `ExtractedParty` | `{ name: S.NonEmptyString, kind: PartyKind, role: PartyRole, quote: S.NonEmptyString, }` |
| `ExtractedDocket` | `{ text: S.NonEmptyString, quote: S.NonEmptyString, }` |
| `DocumentExtraction` | `{ docType: DocumentType, title: optional(S.String), parties: S.Array(ExtractedParty), dockets: S.Array(ExtractedDocket), applicationNumbers: S.Array(S.String), patentNumbers: S.Array(S.String), emails: S.Array(S.String), dates: S.Array(S.String), }` |
| `CriticVerdict` | `{ keepParties: S.Array(S.Natural), keepDockets: S.Array(S.Natural), docType: DocumentType, problems: S.Array(S.String), }` |
| `ConfirmedExtraction` | `{ extraction: DocumentExtraction, verdict: CriticVerdict, }` |
| `ExtractionRecord` | `{ id: S.NonEmptyString, extraction: DocumentExtraction, }` |
| `CriticRecord` | `{ id: S.NonEmptyString, verdict: CriticVerdict, }` |
| `EvidenceKind` | `[ "identical-copy", "full-reference", "uspto-docket", "uspto-applicant", "contact-address", "contact-domain", "contact-phone", "contact-name", "client-name", "learned-name", "known-pair", "attorney-answer", "organisation-form", "organisation-firm", ]` |
| `EvidenceLine` | `{ kind: EvidenceKind, detail: S.NonEmptyString, }` |
| `ConfidenceTier` | `[ "identified", "identified-content", "candidate", "ambiguous", "unknown", ]` |
| `Resolution` | `{ clientNumber: optional(ClientKey), docket: optional(DocketId), tier: ConfidenceTier, evidence: S.Array(EvidenceLine), }` |
| `TierEvaluation` | `{ tier: ConfidenceTier, resolved: S.Natural, right: S.Natural, wrong: S.Natural, precision: optional(S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }))), coverage: S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 })), }` |
| `EvaluationReport` | `{ trainSize: S.Natural, testSize: S.Natural, tiers: S.Array(TierEvaluation), }` |
| `UsptoRecordFacts` | `{ docketNumber: optional(S.NonEmptyString), firstApplicant: optional(S.NonEmptyString), }` |
| `LookupKind` | `["application", "patent"]` |
| `UsptoQuery` | `{ kind: LookupKind, number: S.String.check(S.isPattern(/^[0-9]+$/u)), }` |
| `UsptoEvidence` | `{ query: UsptoQuery, facts: UsptoRecordFacts, }` |
| `UsptoLookupResult` | `{ query: UsptoQuery, facts: optional(UsptoRecordFacts), }` |
| `ClientAlias` | `{ from: ClientKey, to: ClientKey, }` |
| `PseudoClient` | `{ key: S.String.check(S.isPattern(/^new:[^\s].*$/u)), names: S.Array(S.NonEmptyString), }` |
| `ResolverContext` | `{ clients: S.Array(ClientIndexEntry), pairs: S.Array(ClientDocketPair), contacts: S.Array(Contact), aliases: S.Array(ClientAlias), pseudoClients: S.Array(PseudoClient), excludedDomains: S.Array(S.String), }` |
| `IdenticalCopy` | `{ contentHash: ContentHash, clientNumber: ClientNumber, docket: optional(DocketId), }` |
| `IdentificationDocument` | `{ documentId: S.NonEmptyString, contentHash: ContentHash, text: S.String, sourcePath: S.String, extraction: optional(ConfirmedExtraction), uspto: S.Array(UsptoEvidence), copies: S.Array(IdenticalCopy), }` |
| `TrainingDocument` | `{ document: IdentificationDocument, clientNumber: ClientNumber, docket: optional(DocketId), }` |
| `HoldOutSplit` | `{ train: S.Array(TrainingDocument), test: S.Array(TrainingDocument), }` |
| `TokenOwnership` | `{ token: S.NonEmptyString, clients: S.Array(ClientNumber), }` |
| `TokenFilter` | `{ ownership: S.Array(TokenOwnership), training: S.Array(TrainingDocument), }` |
| `ResolutionRecord` | `{ documentId: S.NonEmptyString, contentHash: ContentHash, resolution: Resolution, }` |
| `EvaluationCase` | `{ truth: TrainingDocument, resolution: Resolution, }` |
| `OrganisationRules` | `{ firmFolders: S.Array(S.String), formFolders: S.Array(S.String), }` |
| `OrganisationKind` | `["form", "firm", "unresolved"]` |
| `OrganisationDecision` | `{ kind: OrganisationKind, }` |

## Ports and failures

Every port has an annotated `S.Class` shape (`<PortName>Shape`) and a `Context.Service` tag:

```ts
ContactCardSource.cards(): Stream<RawContactCard, IdentificationError>
UsptoRecordLookup.byApplication(number: string): Effect<Option<UsptoRecordFacts>, IdentificationError>
UsptoRecordLookup.byPatent(number: string): Effect<Option<UsptoRecordFacts>, IdentificationError>
DomainRegistrantLookup.registrant(domain: string): Effect<Option<string>, IdentificationError>
DocumentExtractionSource.extraction(documentId: string): Effect<Option<ConfirmedExtraction>, IdentificationError>
IdentificationError.make({ operation: string,
  reason: "invalid-input" | "unavailable" | "conflicting-records" | "unsafe-output" }): IdentificationError
```

`cards()` intentionally follows the SPEC's thunk contract. A narrowly scoped `lazyEffect` diagnostic
directive documents this contract exception. Other introduced Effect diagnostics were repaired.

## Server API

`@beep/law-practice-server/DocumentIdentification` exposes:

```ts
parseOutlookCsv(text: string): Effect<ReadonlyArray<RawContactCard>, IdentificationError>
parseVcards(text: string): Effect<ReadonlyArray<RawContactCard>, IdentificationError>
registrantFromRdap(input: unknown): Effect<Option<string>, IdentificationError>
ContactFilesConfig.make({ csvPath: string, vcardPath: string }): ContactFilesConfig
ContactFilesLocation: Context.Service<ContactFilesLocation, ContactFilesConfig>
ContactCardSourceFile: Layer<ContactCardSource, never, FileSystem | ContactFilesLocation>
ExtractionBatchesConfig.make({ directories: ReadonlyArray<string> }): ExtractionBatchesConfig
ExtractionBatchesLocation: Context.Service<ExtractionBatchesLocation, ExtractionBatchesConfig>
DocumentExtractionSourceFile: Layer<DocumentExtractionSource, IdentificationError,
  FileSystem | Path | ExtractionBatchesLocation>
UsptoRecordLookupLive: Layer<UsptoRecordLookup, never, Uspto>
DomainRegistrantLookupLive: Layer<DomainRegistrantLookup, never, HttpClient>
documentExtractorPrompt: string
documentCriticPrompt: string
```

The HTTP import uses the installed Effect v4 export `effect/http`. This installation does not export
`effect/unstable/http`. No Node HTTP or crypto module is imported in the new source; hashing uses
`@noble/hashes`. USPTO numbers are validated before any call. Patent lookups filter exact matches,
404s become None, other provider failures remain typed failures, and conflicting records fail closed.
RDAP returns organisation names only and is not resolver evidence by default.

## App-local API and command inputs

These symbols are app-local modules, not package exports:

```ts
ContactsInput.make({ csv, vcard, output, projection }): ContactsInput
IndexInput.make({ input, contacts, output }): IndexInput
UsptoInput.make({ input, output, ledger }): UsptoInput
ResolveInput.make({ input, context, training, batches, uspto, output }): ResolveInput
EvaluateInput.make({ input, context, output }): EvaluateInput
// Every field above is a required nonempty string path.
IdentificationStagesShape: S.Class with contacts/index/uspto/resolve/evaluate methods
// Each method: (correspondingInput) => Effect<number, IdentificationError>
IdentificationStages: Context.Service<IdentificationStages, IdentificationStagesShape>
makeIdentificationStages<E>(lookups: Layer<UsptoRecordLookup, E>):
  Layer<IdentificationStages, never, FileSystem | Path>
IdentificationStagesLive: Layer<IdentificationStages, never, FileSystem | Path>
makePracticeIdentifyCommand<E, R>(stages: Layer<IdentificationStages, E, R>): Command
RunMain: <A, E>(effect: Effect<A, E>) => void
makeRunEntrypoint(run: RunMain): <A, E>(input: {
  isMain: boolean, program: Effect<A, E, BunServices>
}) => void
runEntrypoint: ReturnType<typeof makeRunEntrypoint>
```

The commands are `contacts | index | uspto | resolve | evaluate`; flags and wire codecs are documented
in README.md. Output files are created exclusively with mode 0600 outside worktrees, after resolving
parent symlinks. The ledger appends attempted query shapes and counts, never query numbers or results.
Existing ledger permissions are restricted to 0600. Canonical input/ledger aliases are rejected.
Contact deduplication is transitive and deterministic. Docket parsing reuses the KG reference and path
parsers and country domains. Strong conflicting clients remain ambiguous; multiple dockets for one
identified client leave the docket absent. Content identification requires independent provenance,
critic-confirmed quotes and the threefold margin; candidates require a twofold margin. Evaluation
fits training ownership only, keeps duplicate content in one partition and removes copy/folder signals.

## Gate evidence

Commands below are run from their owning package unless noted. Test tails are verbatim.

### Use-case synthetic tests: passed

`timeout 60s bunx --bun vitest run --pool=threads --maxWorkers=1 test/DocumentIdentification`

```text
 RUN  v5.0.3 /home/elpresidank/YeeBois/projects/beep-effect11-worktrees/practice-identify/packages/law-practice/use-cases


 Test Files  1 passed (1)
      Tests  18 passed (18)
   Start at  17:17:03
   Duration  1.10s (import 68%, transform 21%, setup 9%, tests 2%)

```

### Server synthetic tests: passed

`timeout 60s bunx --bun vitest run --pool=threads --maxWorkers=1 test/DocumentIdentification`

```text
 RUN  v5.0.3 /home/elpresidank/YeeBois/projects/beep-effect11-worktrees/practice-identify/packages/law-practice/server


 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  17:23:15
   Duration  1.14s (import 70%, transform 18%, setup 9%, tests 2%)

```

### App synthetic tests: passed

`timeout 60s bunx --bun vitest run --pool=threads --maxWorkers=1`

```text
 RUN  v5.0.3 /home/elpresidank/YeeBois/projects/beep-effect11-worktrees/practice-identify/apps/practice-identify


 Test Files  2 passed (2)
      Tests  14 passed (14)
   Start at  17:23:15
   Duration  1.73s (import 76%, setup 11%, transform 10%, tests 3%)

```

### Source-only TypeScript: passed

`bun node_modules/typescript/bin/tsc -p /tmp/identify-tsconfig.json`

Verbatim tail is empty (exit 0, no diagnostics).

### Use-case build: passed

`bun run beep:build`

```text
$ tsc -p tsconfig.json
```

### Server build: passed

`bun run beep:build`

```text
$ tsc -p tsconfig.json
```

### Biome: passed

`bunx --no-install biome check <allowed changed source, tests, app>`

```text
Checked 26 files in 1417ms. No fixes applied.
```

### Generated scripts: passed

`bun run beep lint package-scripts --write`

```text
$ bun run packages/tooling/tool/cli/src/bin.ts -- lint package-scripts --write
package-scripts: 152 manifests, 0 drifting, 0 written
```

### Use-case JSDoc: passed

`bun run beep lint jsdoc --package packages/law-practice/use-cases`

```text
$ bun run packages/tooling/tool/cli/src/bin.ts -- lint jsdoc --package packages/law-practice/use-cases
```

### Server JSDoc: passed

`bun run beep lint jsdoc --package packages/law-practice/server`

```text
$ bun run packages/tooling/tool/cli/src/bin.ts -- lint jsdoc --package packages/law-practice/server
```

### App JSDoc: passed

`bun run beep lint jsdoc --package apps/practice-identify`

```text
$ bun run packages/tooling/tool/cli/src/bin.ts -- lint jsdoc --package apps/practice-identify
```

### Package verify @beep/law-practice-use-cases: blocked

`bun run beep quality package-verify @beep/law-practice-use-cases`

```text
  fail audit 5.1s   ok docgen 8.5s
}

Node.js v24.20.0
error: script "beep:check" exited with code 1
error: script "beep:audit" exited with code 1

pkg-verify failed.
error: script "beep" exited with code 1
```

### Package verify @beep/law-practice-server: blocked

`bun run beep quality package-verify @beep/law-practice-server`

```text
  fail audit 5.5s   ok docgen 10.4s
}

Node.js v24.20.0
error: script "beep:check" exited with code 1
error: script "beep:audit" exited with code 1

pkg-verify failed.
error: script "beep" exited with code 1
```

### Package verify @beep/practice-identify: blocked

`bun run beep quality package-verify @beep/practice-identify`

```text
  fail audit 7.7s   skip docgen
}

Node.js v24.20.0
error: script "beep:build" exited with code 1
error: script "beep:audit" exited with code 1

pkg-verify failed.
error: script "beep" exited with code 1
```

An initial Vitest forks run timed out before tests; the passing final runs explicitly use the threads pool.

Package verifies ran one at a time. Introduced schema, pipeability and JSDoc failures from earlier
attempts were repaired. The final use-case and server builds pass, both docgen lanes pass, and the
remaining audits fail at the tsgo shim with `spawnSync ... node EPERM`. Failed gate receipts remain
in the local Yeet inbox with acknowledgements; they are not represented as passing full proof.
The temporary TypeScript config covers the new source and tests directly, without relying on
project-reference build outputs. It does not substitute for the denied canonical tsgo gate.
CLI `bun src/bin.ts --help` also exited 0 and listed all five subcommands.

## Anything not done / limits

- Full package verification is not green: the sandbox blocks the canonical tsgo subprocess.
- Private held-out evaluation and reproduction of the SPEC's measured counts were not run. No private
  data or counts were written into the packet, and no empirical precision claim is made for this code.
- The scope permitted only export edits to the two library manifests. `@noble/hashes` still needs a
  dependency declaration in use-cases, and `@beep/uspto` in server. Current monorepo resolution builds
  successfully, but those manifest declarations remain necessary before publication or isolated installs.
- Extraction batch JSONL uses the exported canonical nested record codecs, not the private script's
  flat record layout. Existing runners must emit the shared contract described by the prompt constants.
- `index` consumes typed provenance assertions; translating proprietary questionnaire, spreadsheet,
  mailbox and KG exports into those assertions is an external input-preparation step.
- Administrative form/firm organisation is an exported pure rule with input-supplied folders. The CLI
  emits client/docket resolutions and does not assign administration destination paths or perform moves.
- vCard 3/4 text, grouped properties, escaping and folding are supported. Legacy quoted-printable or
  base64 property encodings fail closed rather than being silently decoded incorrectly.
- Contact ids follow the specified hash of sorted emails (otherwise name + organisation). Distinct
  role-only cards sharing the same complete email list can therefore share an id; name and organisation
  remain distinct, and role mailboxes do not merge their cards or establish email links.
- No git commit, PR, publication, live RDAP/USPTO call, paid endpoint or Box write was performed.
- Packet lifecycle, reflection and the workstation session ledger were not edited because the requested
  write scope excludes them. This report is the durable handoff inside the allowed app directory.

Graft retrieval estimated 31,820 tokens saved (one call).
