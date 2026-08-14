# Plan

## P0 Research And Scratch Proofs

Status: complete for packet creation, review round 01, and static-API packet
expansion.

- [x] Audit Effect v4 Schema docs and source modules.
- [x] Check current repo usage with grep/glob evidence.
- [x] Create default-combinator scratch examples in `scratchpad/index.ts`.
- [x] Create property-testing scratch with `S.toArbitrary`, FastCheck, and
      Faker in `scratchpad/test/schema-arbitrary-fastcheck.test.ts`.
- [x] Create static schema API scratch with `S.TaggedUnion`, `LiteralKit`,
      `MappedLiteralKit`, and schema-derived helpers in
      `scratchpad/test/schema-static-apis.test.ts`.
- [x] Add `@faker-js/faker` as a catalog-managed dev dependency.
- [x] Run packet-focused review round 01 and record findings in
      `reviews/round-01.md`.

## P1 Doctrine And Agent Steering

Status: complete for the immediate packet/scratch/docs expansion.

- [x] Update `standards/effect-first-development.md` with focused guidance on:
      schema defaults, schema-derived arbitraries, static schema APIs,
      equivalence, precision, and boundary codecs.
- [x] Update `.claude/skills/schema-first-development` references so agents
      naturally choose these patterns.
- [x] Add compact examples that point to the scratch files instead of copying
      long snippets everywhere.
- [x] Add a "property testing from schemas" rule to test-authoring guidance.
- [x] Add the laws-to-levers matrix or a compact derivative to the
      schema-first skill references.
- [x] Teach `annotate` vs `annotateKey`, seeded Faker arbitrary annotations,
      fixture/property-test coexistence, and local Effect v4 source preflight.

## P2 Enforcement Plumbing

Status: complete for the initial advisory rule-card set. Current schema-first
lint failures emit structured `[schema-first:issue]` lines, and Yeet parses
those lines into `schema-first-policy` issues with rule id, file, line,
remediation, and package routing. See `reviews/p2-enforcement-slice.md`.

- [x] Extend `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`.
- [x] Implement rule cards from `SPEC.md` one at a time, starting advisory:
      `SFV4-static-api`, `SFV4-precision-audit`, `SFV4-arbitrary-tests`,
      `SFV4-defaults`, `SFV4-equivalence`, `SFV4-numeric-domain`, and
      `SFV4-boundary-codec`.
  - [x] `SFV4-numeric-domain`: AST advisory inventory rule with focused tests.
        Live repo count is currently zero; see
        `reviews/p2-numeric-domain-advisory.md`.
  - [x] `SFV4-static-api`: first AST advisory inventory slice for schema
        static-helper modules that still switch on likely discriminators. Live
        repo count is currently zero; see
        `reviews/p2-static-api-switch-advisory.md`.
  - [x] `SFV4-boundary-codec`: first AST advisory inventory slice for direct
        `JSON.parse(...)` boundaries. Live repo count is currently zero after
        the Runpod generator remediation; see
        `reviews/p2-boundary-codec-json-parse-advisory.md` and
        `reviews/p4-runpod-boundary-codec-pilot.md`.
  - [x] `SFV4-defaults`: first AST advisory inventory slice for non-empty
        object-literal defaults on option-like parameters in schema-modeled
        files. Live repo count is currently zero; see
        `reviews/p2-defaults-parameter-object-advisory.md`.
  - [x] `SFV4-equivalence`: first AST advisory inventory slice for exported
        manual `equals` helpers in schema-modeled modules. Live repo count is
        currently zero after the LocalDate/Timestamp Wave 5 remediation; see
        `reviews/p2-equivalence-exported-helper-advisory.md`.
  - [x] `SFV4-precision-audit`: first AST advisory inventory slice for broad
        `email: S.String` fields where a precise email schema already exists.
        Live repo count is currently zero active advisories after the HubSpot
        request-email, shared `EmailString`, and precision-exception review
        pilots; see
        `reviews/p2-precision-email-field-advisory.md`.
  - [x] `SFV4-arbitrary-tests`: first AST advisory inventory slice for
        schema-heavy test files with repeated Schema codec assertions and no
        schema-derived property coverage. Hardened from the async-only codec
        list to the full Effect v4 sync/async codec family, which re-surfaced 34
        synchronous-codec advisory candidates now tracked for Wave 3; see
        `reviews/p2-arbitrary-tests-schema-codec-advisory.md` and
        `reviews/p2-arbitrary-tests-sync-codec-expansion.md`.
- [x] Prefer AST-aware or ts-morph checks over fragile regex for production
      enforcement.
- [x] Add rule-specific inventory entries with rule id, file, symbol, line, and
      reason before hard-failing line-based findings.
- [x] Emit structured schema-first lint output with file, rule id, remediation,
      severity, and category target.
- [x] Prove Yeet issue shape by either parsing that structured output in
      `QualityIssueIndex.ts` or splitting/capturing `lint:schema-first` as its
      own quality step.

## P3 Helper And Example Library

Status: closed with recorded deferrals. The first internal diagnostics helper
pilot is complete for repo-cli laws tooling; public `@beep/schema` helper
extraction and helper statics are deferred until repeated cross-package demand.
See
`reviews/p3-schema-diagnostics-helper-pilot.md`.

- [ ] Recorded deferral: evaluate a small `@beep/schema` law-test helper only
      after repeated cross-package demand for arbitrary/equivalence/codecs.
- [ ] Recorded deferral: evaluate helper statics for `S.Class` schemas only if
      the pattern repeats across packages.
- [x] Add reusable diagnostics formatting around
      `SchemaIssue.makeFormatterStandardSchemaV1` for the first internal
      laws-tooling call site.
- [x] Ensure diagnostics helpers format `SchemaError.issue` and handle redacted
      values before formatting, using public formatter hooks while
      `SchemaIssue.redact` is not exposed by installed package typings.
- [x] Keep helpers thin; prefer upstream `effect/Schema` directly where clear.

## P4 Ordered Remediation Waves

Status: closed with completed pilots retained and remaining waves deferred.
First Wave 3 pilots completed for
`packages/foundation/modeling/schema/test/Sha256.test.ts`,
`packages/foundation/modeling/schema/test/Markdown.test.ts`,
`packages/foundation/modeling/schema/test/HttpHeaders.test.ts`,
`packages/foundation/modeling/schema/test/Csv.test.ts`,
`packages/foundation/modeling/schema/test/LocalDate.test.ts`,
`packages/foundation/modeling/md/test/Md.test.ts`,
`packages/foundation/capability/file-processing/test/FileProcessing.test.ts`,
`packages/foundation/capability/nlp/test/Graph/Schema.test.ts`,
`packages/foundation/capability/nlp/test/PatternCore.test.ts`,
the since-removed semantic-web JSON-LD test suite,
`packages/foundation/capability/semantic-web/test/ServicesAndSurface.test.ts`,
`packages/shared/domain/test/LocalDate.test.ts`,
`packages/shared/domain/test/Organization.test.ts`,
`packages/shared/domain/test/IdentityNamespaces.test.ts`,
`packages/shared/domain/test/EntityKernel.test.ts`,
`packages/shared/ui/test/OrganizationDisplay.test.ts`, the repo-configs route
predicate pilot in
`packages/tooling/policy-pack/repo-configs/test/NextModels.schema.test.ts`,
and the tooling agent-effectiveness, AI-metrics, and files command pilots in
`packages/tooling/tool/cli/test/agent-effectiveness-command.test.ts`,
`packages/tooling/tool/cli/test/ai-metrics-command.test.ts`, and
`packages/tooling/tool/cli/test/files-command.test.ts`, plus the Libpff/Tika
driver pilots in `packages/drivers/libpff/test/Libpff.service.test.ts` and
`packages/drivers/tika/test/Tika.service.test.ts`, and the Venice AI driver
pilot in `packages/drivers/venice-ai/test/VeniceAI.service.test.ts`, the ACP
driver pilots in `packages/drivers/acp/test/agent.test.ts` and
`packages/drivers/acp/test/protocol.test.ts`, and the architecture-lab PgLite
pilot in
`packages/architecture-lab/server/test/integration/WorkItemDrizzleRepository.pglite.test.ts`;
see
`reviews/p4-sha256-arbitrary-pilot.md`,
`reviews/p4-markdown-arbitrary-pilot.md`,
`reviews/p4-md-ast-arbitrary-pilot.md`,
`reviews/p4-file-processing-arbitrary-pilot.md`,
`reviews/p4-nlp-graph-schema-arbitrary-pilot.md`,
`reviews/p4-nlp-pattern-core-arbitrary-pilot.md`,
`reviews/p4-semantic-web-jsonld-arbitrary-pilot.md`,
`reviews/p4-semantic-web-services-surface-arbitrary-pilot.md`,
`reviews/p4-form-core-builder-arbitrary-pilot.md`,
`reviews/p4-httpheaders-arbitrary-pilot.md`,
`reviews/p4-csv-arbitrary-pilot.md`,
`reviews/p4-localdate-arbitrary-pilot.md`,
`reviews/p4-shared-domain-localdate-arbitrary-pilot.md`,
`reviews/p4-shared-domain-organization-arbitrary-pilot.md`,
`reviews/p4-shared-domain-identity-namespaces-arbitrary-pilot.md`,
`reviews/p4-shared-domain-entity-kernel-arbitrary-pilot.md`, and
`reviews/p4-shared-ui-organization-display-arbitrary-pilot.md`, plus
`reviews/p4-repo-configs-nextmodels-arbitrary-pilot.md`,
`reviews/p4-tooling-agent-effectiveness-arbitrary-pilot.md`,
`reviews/p4-tooling-ai-metrics-arbitrary-pilot.md`, and
`reviews/p4-tooling-files-command-arbitrary-pilot.md`,
`reviews/p4-libpff-arbitrary-pilot.md`, and
`reviews/p4-tika-arbitrary-pilot.md`, and
`reviews/p4-venice-ai-arbitrary-pilot.md`,
`reviews/p4-acp-arbitrary-pilot.md`, and
`reviews/p4-architecture-lab-pglite-arbitrary-pilot.md`, plus the OIP and RDF
class-local decoder statics pilots in
`reviews/p4-oip-class-local-statics-pilot.md` and
`reviews/p4-rdf-class-local-statics-pilot.md`, and the repo-cli quality task
`LiteralKit` statics pilot in
`reviews/p4-quality-task-literalkit-statics-pilot.md`.

- [ ] Recorded deferral: remaining Wave 1 low-risk static schema API sites:
      `TaggedUnion.match`, `.cases`, `.guards`, `LiteralKit.Enum`,
      `LiteralKit.is`, `LiteralKit.Options`, `LiteralKit.pickOptions`, and
      `MappedLiteralKit` directional helpers.
  - [x] Pilot repo-cli quality task literal domains: moved loaded command
        adapter guards and canonical values to `LiteralKit` / `S.is` static
        surfaces while leaving the lazy `bin-main.ts` preflight untouched; see
        `reviews/p4-quality-task-literalkit-statics-pilot.md`.
- [ ] Recorded deferral: remaining Wave 2 broad-schema precision work,
      including `S.String`, `S.Number`, and unbounded arrays where the domain is
      narrower.
  - [x] Pilot `HubSpotUpsertContactRequest.email`: added a local precise
        non-redacted email schema for the outbound CRM identity field while
        leaving HubSpot error-context emails broad for invalid-input reporting;
        see `reviews/p4-hubspot-email-precision-pilot.md`.
  - [x] Pilot shared `EmailString`: split non-redacted normalized email strings
        from redacted `Email`, then migrated displayable package metadata,
        OIP content, and runtime draft recipient schemas; see
        `reviews/p4-email-string-precision-pilot.md`.
  - [x] Pilot precision exception counting: keep reviewed raw-input and
        diagnostic broad email fields in the inventory as `exception` entries
        while excluding them from active advisory counts; see
        `reviews/p4-precision-exception-counting.md`.
- [ ] Recorded deferral: remaining Wave 3 schema-derived property work uses
      `S.toArbitrary`, FastCheck, and seeded Faker annotations on existing
      source schemas. Keep fixtures for golden payloads, snapshots, external
      compatibility, migrations, and regression repros.
  - [x] Pilot `Sha256Hex`: added a source-schema `toArbitrary` annotation and
        a property test deriving canonical lowercase digest data from
        `S.toArbitrary(Sha256Hex)`.
  - [x] Pilot `Markdown`: added a property test deriving accepted Markdown
        document strings from `S.toArbitrary(Markdown)` without needing a
        custom source-schema arbitrary annotation.
  - [x] Pilot `@beep/md` AST: added a property test deriving `Inline`,
        `Block`, and `Document` values from source schemas and proving schema
        codec plus renderer handoff stability.
  - [x] Pilot `@beep/file-processing`: added valid-subset arbitrary
        annotations for prefixed SHA-256 ids, artifact names, and artifact
        extensions, then derived artifact and operation payloads from the
        source schemas.
  - [x] Pilot `@beep/nlp` graph schemas: added a property test deriving text
        nodes, edges, annotation nodes, and analysis summaries from source
        schemas and proving encode/decode stability.
  - [x] Pilot `@beep/nlp` PatternCore: added a property test deriving pattern
        options, pattern elements, and full patterns from source schemas and
        proving schema codec plus compact encode/decode stability.
  - [x] Pilot `@beep/semantic-web` ServicesAndSurface: added a property test
        deriving RDF datasets and canonicalization request DTOs from source
        schemas and proving encoded-boundary stability beside exact service
        fixtures.
  - [x] Pilot `@beep/semantic-web` JSON-LD: added a property test deriving
        JSON-LD context, literal, and frame DTOs from source schemas and
        proving encoded-boundary stability beside exact document/RDF fixtures.
        (The JSON-LD surface and its test suite were later removed from the
        package as unconsumed; the pilot's findings stand.)
  - [x] Pilot secure header options: added property tests deriving COEP/COOP/CORP
        option values from their source schemas and proving the rendered header
        name/value semantics.
  - [x] Pilot `CSV(UserRow)`: added a property test deriving row instances from
        `S.toArbitrary(UserRow)`, discovered the `-0` CSV text round-trip hole,
        and tightened the source row id schema to positive finite numbers.
  - [x] Pilot repo-configs `RouteHas`: added a property test deriving Next.js
        route predicate values from `S.toArbitrary(RouteHas)` and decoding them
        through the existing source-schema boundary.
  - [x] Pilot `LocalDate`: added a property test deriving `LocalDate` class
        instances from `S.toArbitrary(LocalDate)` and proving the schema
        encode/decode law without changing public calendar-date validation
        semantics.
  - [x] Pilot shared-domain `LocalDate.Model`: added a property test deriving
        valid calendar dates from `S.toArbitrary(Model)` and proving both class
        and ISO string codec round-trips.
  - [x] Pilot shared-domain `Organization`: added a property test deriving
        `LicenseTier` and `Settings` values from source schemas and proving
        literal guard and settings codec laws.
  - [x] Pilot shared-domain identity namespaces: added a property test deriving
        ids from every registered entity-id schema and proving decode/encode
        and equivalence laws across the namespace table.
  - [x] Pilot shared-domain `EntityKernel`: added a property test deriving
        `DocumentId` values from the source schema and proving entity-reference
        encode/decode and `makeResult` laws.
  - [x] Pilot shared-UI `OrganizationDisplay`: added a property test deriving
        `Display` and `Form` class instances from the source schemas and
        proving browser codec stability plus `primaryLabel`.
  - [x] Pilot `HttpStatus` (first sync-codec backlog pilot): added a property
        test deriving the full status-code domain from
        `S.toArbitrary(HttpStatus.Schema)` and proving the bijective name↔code
        round-trip, dropping the hardened arbitrary-tests advisories 34 → 33;
        see `reviews/p4-httpstatus-arbitrary-pilot.md`.
  - [x] Pilot `OptionFromOptionalNullishKey`: added a property test deriving
        `{ nickname: Option<string> }` payloads from the source combinator and
        proving the optional/nullish Option codec round-trips (Some and
        omitted-None forms), dropping the advisories 33 → 32; see
        `reviews/p4-options-arbitrary-pilot.md`.
  - [x] Orchestrated batch over the remaining 32 candidates (triage 6 genuine /
        8 exception / 18 defer): remediated the 6 genuine schema-law tests
        (`CanonicalizationSecurity`, `MutableHashMap`, `MutableHashSet`,
        wink `ToolValidation`, `Model`, `Rdf`) with verified round-trip
        properties, dropping the advisories 32 → 26; see
        `reviews/p4-wave3-arbitrary-remediation-batch.md`. Reclassified 8
        incidental/meta-combinator tests as inventory exceptions (26 → 18); see
        `reviews/p4-wave3-arbitrary-exceptions.md`.
  - [x] Source `toArbitrary` annotation batch over the deferred regex
        string-brands: added `fc.stringMatching` source annotations to
        `Kebab/Pascal/SnakeCaseStr`, `WindowsDriveRoot`, and
        `EthereumValidatorPublicKey` (with a branded-type cast caught by `tsc`),
        remediating `CaseStr`, `FilePath`, and `BlockchainRedacted` (18 → 15);
        5 non-regex brands were correctly reverted. See
        `reviews/p4-wave3-source-arbitrary-annotations.md`.
  - [x] Probe-first deferred-arbitraries batch (13 tractable; Glob/TypedArrays
        excluded as Bun-runtime-blocked): remediated 9 (FileName + TSMorph
        SymbolId source annotations, plus probe-only DateTimeUtcFromValid,
        RegExp, Duration, Color, URI, Observed), reverted IRI and PackageJson as
        flaky (caught by full-suite + stress runs), and reclassified
        PromiseSchema as an exception, dropping the advisories 15 → 5. See
        `reviews/p4-wave3-deferred-arbitraries.md`.
- [ ] Recorded deferral: Wave 4 options/config/request defaults. Resume only
      when a schema-heavy wave creates repeated demand for this capability.
  - [x] Pilot ontology Markdown projection options: moved `linkMode` fallback
        into `OntologyMarkdownProjectionOptions` with
        `S.withConstructorDefault(...)` and proved omitted/empty options render
        equivalently; see `reviews/p4-ontology-markdown-defaults-pilot.md`.
  - [x] Pilot secure-header aggregate options: moved the omitted options
        fallback for `createHeadersObject` / `createSecureHeaders` into a
        schema-owned argument object with `S.withConstructorDefault(...)` while
        preserving the public helper call shape; see
        `reviews/p4-secure-header-options-defaults-pilot.md`.
- [x] Wave 5: add `S.toEquivalence` where schema-modeled equality is manually
      encoded. Completed for `LocalDate.equals` and `Timestamp.equals`; see
      `reviews/p4-equivalence-wave.md`.
- [ ] Recorded deferral: Wave 6 class-local derived helpers. Resume only when
      repeated decode/encode/arbitrary/equivalence plumbing demands them.
  - [x] Pilot OIP schema classes: added class-local `decodeUnknownResult` and
        `decodeUnknownEffect` statics to `OipSiteContent`,
        `ContactSubmission`, and `ContactSubmissionFormPayload`, while keeping
        existing compatibility exports delegated to those statics.
  - [x] Pilot RDF schema classes: added class-local `decodeUnknownResult`
        statics to `NamedNode`, `Literal`, and `SemanticSchemaMetadata`, then
        moved private construction-helper decoders through those schema-owned
        statics.
- [x] Dropped: do not run the `SchemaRepresentation` generated-model spike.
      The packet closes without a generated-driver experiment.
- [x] Preserve the safety conclusion: no generated Box replacement was made.

## P5 Hardening And Closure

Status: docs-side closeout complete on 2026-07-14.

- [ ] Run `bun run beep lint schema-first` and iterate false positives.
- [ ] Run `bun run beep yeet verify --plan --json` to confirm the quality path.
- [x] Keep focused schema-first lint and Yeet parser tests proving structured
      `schema-first-policy` issue artifacts.
- [ ] Run `bun run beep yeet verify --tier review-fix` while iterating on
      PR-review or closeout findings.
- [ ] Run full Yeet verify when the implementation phase is ready.
- [ ] Use `bun run beep quality profile detect` / `config workstation` before
      choosing unusually heavy parallel proof work.
- [ ] On the PR branch, run
      `bun run beep yeet closeout --require-greptile-score 5/5 --require-greptile-issues 0 --require-review-comments 0`
      as the read-first hosted review gate.
- [ ] Use `publish --amend --no-edit --reuse-verified` or
      `publish --push-only --reuse-verified` only when Yeet accepts exact
      proof reuse for the current state.
- [ ] Use `publish --start-pr-early --monitor` only when the operator wants
      hosted checks/reviewers to start while local full proof continues.
- [x] Record known deferrals in the packet before closing. The false-positive
      and arbitrary-deferral ledger is final; the five retained arbitrary cases
      are Glob, TypedArrays, IRI, PackageJson, and Graph.

The remaining command-oriented P5 checks were not claimed as newly executed by
this documentation-only closeout. Existing shipped proof and review artifacts
remain the evidence for P0–P2 and the completed P4 pilots.

## Verification Ladder

Use the smallest relevant command first, then climb:

```sh
bunx vitest run --config scratchpad/vitest.config.ts
bunx tsc -p scratchpad/tsconfig.json --pretty false
bun run beep lint schema-first
bun run beep yeet verify --plan --json
bun run beep yeet verify --tier review-fix --plan --json
bun run beep yeet verify
```
