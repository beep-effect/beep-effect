/**
 * Pinned TypeScript donor export/test evidence and disposition obligations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("internal/citationTypescriptDonors");
const DonorId = LiteralKit(["eyecite-ts", "eyecite-js"]);
const PositionFields = {
  path: S.NonEmptyString,
  line: S.Natural,
  column: S.Natural,
  endLine: S.Natural,
  sourceSha256: Sha256Hex,
  declarationSha256: Sha256Hex,
  material: LiteralKit(["tracked", "generated"]),
};
const Position = S.Struct(PositionFields);
const File = S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex });
const Member = S.Struct({ name: S.NonEmptyString, syntaxKind: S.NonEmptyString, origin: Position });
const PublicExport = S.Struct({
  id: S.NonEmptyString,
  entrypoint: S.NonEmptyString,
  name: S.NonEmptyString,
  targetName: S.NonEmptyString,
  hasValue: S.Boolean,
  hasType: S.Boolean,
  origins: S.Array(Position),
  members: S.Array(Member),
});
const SourceImport = S.Struct({
  module: S.NonEmptyString,
  imported: S.NonEmptyString,
  local: S.NonEmptyString,
  typeOnly: S.Boolean,
});
const TestDeclaration = S.Struct({
  ...PositionFields,
  id: S.NonEmptyString,
  runtimeLine: S.Natural,
  runtimeColumn: S.Natural,
  callee: S.NonEmptyString,
  titleExpression: S.String,
  argumentCount: S.Natural,
  imports: S.Array(SourceImport),
  parameterized: S.Boolean,
});
const Assertion = S.Struct({
  ...PositionFields,
  id: S.NonEmptyString,
  ownerDeclarationId: S.NullOr(S.NonEmptyString),
  matcher: S.NonEmptyString,
  expression: S.NonEmptyString,
});
const Static = S.Struct({
  publishedEntrypoints: S.Array(S.Struct({ subpath: S.NonEmptyString, sourcePath: S.NonEmptyString })),
  parser: S.NonEmptyString,
  generatorSha256: Sha256Hex,
  fixtures: S.Array(File),
  files: S.Array(File),
  entrypoints: S.Array(S.NonEmptyString),
  exports: S.Array(PublicExport),
  testDeclarations: S.Array(TestDeclaration),
  assertionSources: S.Array(Assertion),
});
const RuntimeCase = S.Struct({
  path: S.NonEmptyString,
  line: S.Natural,
  column: S.NullOr(S.Natural),
  title: S.String,
  ancestors: S.Array(S.String),
  status: LiteralKit(["passed", "skipped", "todo"]),
  declarationId: S.NonEmptyString,
  ordinal: S.Natural,
  id: S.NonEmptyString,
  normalizedSha256: Sha256Hex,
});
const Unobserved = S.Struct({
  declarationId: S.NonEmptyString,
  reason: S.tag("Conditional skip registration has no qualifying fixture rows; not a passing behavior observation."),
  fixturePath: S.NonEmptyString,
  fixtureSha256: Sha256Hex,
  fixtureRows: S.Natural,
  qualifyingRows: S.tag(0),
});
const Suite = S.Struct({
  passed: S.Natural,
  skipped: S.Natural,
  todo: S.Natural,
  failed: S.tag(0),
  command: S.NonEmptyString,
  runner: S.NonEmptyString,
  runtime: S.NonEmptyString,
});
const DonorFields = {
  static: Static,
  runtimeCases: S.Array(RuntimeCase),
  unobservedDeclarations: S.Array(Unobserved),
  suite: Suite,
  packageExports: S.JsonObject,
  postSuiteTrackedChanges: S.Array(S.NonEmptyString),
};
const Donor = S.Union([
  S.Struct({
    ...DonorFields,
    id: S.tag("eyecite-ts"),
    repository: S.tag("https://github.com/medelman17/eyecite-ts"),
    commit: S.tag("34133d03143ea65861f48a5ed0eb32c931581666"),
    tree: S.tag("f1243d0723cea1e53a5263ef67c9e066230729fc"),
    version: S.tag("0.34.2"),
    license: S.tag("MIT"),
    licenseSha256: S.tag("4035b4eb4428ec60e5e02ed53b546ae17b3cd3c039ad42f61611ef8f389d6264"),
    lockPath: S.tag("pnpm-lock.yaml"),
    lockSha256: S.tag("bc48a7e3a4ee02128b8c656889e4e24ce2c003bc16273cefe4801c478ac1b7c3"),
  }),
  S.Struct({
    ...DonorFields,
    id: S.tag("eyecite-js"),
    repository: S.tag("https://github.com/beshkenadze/eyecite-js"),
    commit: S.tag("53a49f2412da668aaf262e5f92584c2c3781043b"),
    tree: S.tag("521fc394d7130f9b21e206d2bf236ffebcca932c"),
    version: S.tag("2.7.6-alpha.28"),
    license: S.tag("BSD-2-Clause"),
    licenseSha256: S.tag("91cde2e1ec770d3a7a0b769fbf344de33588312b994ff4219f0e75d7fa6db025"),
    lockPath: S.tag("bun.lock"),
    lockSha256: S.tag("a4789b18815600b0fdb2a6c5a851ade5b023623abc25186d1d8a194e65de15a9"),
  }),
]);
const SourceKind = LiteralKit(["publicExport", "exportedMember", "testBehavior", "unobservedDeclaration"]);
const Disposition = S.Struct({
  id: S.NonEmptyString,
  donorId: DonorId,
  kind: S.tag("extension"),
  sourceKind: SourceKind,
  sourceId: S.NonEmptyString,
  disposition: LiteralKit(["unresolved", "adopted", "subsumed", "rejected", "follow-up"]),
  workflowState: LiteralKit(["audit", "blocked", "ready", "complete"]),
  rationale: S.NullOr(S.NonEmptyString),
  proof: S.NullOr(S.Struct({ command: S.NonEmptyString, result: S.tag("passed"), evidencePath: S.NonEmptyString })),
  targetTest: S.NullOr(S.Struct({ path: S.NonEmptyString, name: S.NonEmptyString })),
  successorGoal: S.NullOr(S.NonEmptyString),
});

/**
 * Attributed donor public exports and independently registered test behaviors.
 *
 * **Details**
 *
 * A passing donor case proves that donor observation only. Terminal dispositions
 * additionally need rationale and applicable target/successor proof. Skips,
 * todos and an empty conditional registration remain explicit source evidence.
 *
 * **Example** (Reject unversioned donor evidence)
 *
 * ```ts
 * import { CitationTypescriptDonors } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 * console.log(S.is(CitationTypescriptDonors)({})) // false
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationTypescriptDonors extends S.Opaque<CitationTypescriptDonors, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("citation-typescript-donors/v1"),
    scope: S.tag("Pinned donor export/test evidence and independent target disposition accounting."),
    exporterSha256: Sha256Hex,
    staticExporterSha256: Sha256Hex,
    donors: S.Array(Donor),
    dispositions: S.Array(Disposition),
  }).pipe(
    $I.annoteSchema("CitationTypescriptDonors", {
      description:
        "Exact-pin, licensed TypeScript donor exports, class members, static registrations and runtime expansions with separate disposition obligations.",
    })
  )
) {}
