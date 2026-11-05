/**
 * Test-only source/runtime discovery contract for the pinned citation oracle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("internal/citationOracleDiscovery");

const SourceDeclarationKind = LiteralKit([
  "publicOperation",
  "modelFamily",
  "helperFamily",
  "testMethod",
  "caseDeclaration",
  "regexCandidate",
]).pipe(
  $I.annoteSchema("SourceDeclarationKind", {
    description: "Closed source discovery categories; regex candidates still require family review.",
  })
);

const SourceDeclarationFields = {
  id: S.NonEmptyString,
  path: S.NonEmptyString,
  line: S.Natural,
  column: S.Natural,
  symbol: S.NonEmptyString,
  sourceSha256: Sha256Hex,
};
const SourceDeclaration = SourceDeclarationKind.toTaggedUnion("kind")({
  publicOperation: SourceDeclarationFields,
  modelFamily: SourceDeclarationFields,
  helperFamily: SourceDeclarationFields,
  testMethod: SourceDeclarationFields,
  caseDeclaration: SourceDeclarationFields,
  regexCandidate: SourceDeclarationFields,
}).pipe(
  $I.annoteSchema("SourceDeclaration", {
    description: "One independently discovered AST declaration at an exact source-content hash.",
  })
);

const FixtureDeclaration = S.Struct({
  kind: S.tag("fixture"),
  id: S.NonEmptyString,
  path: S.NonEmptyString,
  sourceSha256: Sha256Hex,
}).pipe(
  $I.annoteSchema("FixtureDeclaration", {
    description: "One source fixture discovered independently of runtime execution.",
  })
);

const SourceRow = S.Union([SourceDeclaration, FixtureDeclaration]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("SourceRow", {
    description: "A closed declaration or fixture discovery row; not a parity disposition.",
  })
);

const SourceFile = S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex }).pipe(
  $I.annoteSchema("SourceFile", {
    description: "Pinned implementation or test file and its complete SHA-256 content digest.",
  })
);

const AssertionEvent = S.Struct({
  id: S.NonEmptyString,
  test: S.NonEmptyString,
  declarationId: S.NonEmptyString,
  ordinal: S.Natural,
  assertion: S.NonEmptyString,
}).pipe(
  $I.annoteSchema("AssertionEvent", {
    description: "One observed expansion of an independently discovered assertion call.",
  })
);

const DiscoveryRun = S.Struct({
  successful: S.tag(true),
  testsRun: S.Natural,
  failures: S.tag(0),
  errors: S.tag(0),
  skipped: S.tag(0),
  assertionEvents: S.Array(AssertionEvent),
  unobservedDeclarations: S.Array(S.NonEmptyString).check(S.isMaxLength(0)),
}).pipe(
  $I.annoteSchema("DiscoveryRun", {
    description: "A successful, unskipped official suite run and its assertion discovery events.",
  })
);

const OracleDiscovery = S.Struct({
  schemaVersion: S.tag("citation-oracle-audit/v1"),
  scope: S.tag("source-and-runtime-assertion-discovery; not normalized parity proof"),
  commit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  tree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
  python: S.NonEmptyString,
  license: S.tag("BSD-2-Clause"),
  licenseSha256: S.tag("db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"),
  exporterSha256: Sha256Hex,
  sourceFiles: S.Array(SourceFile),
  sourceRows: S.Array(SourceRow),
  runtime: DiscoveryRun,
});

const unique = (ids: ReadonlyArray<string>) => A.length(A.dedupe(ids)) === A.length(ids);

const DiscoveryAccounting = S.makeFilter(
  (report: typeof OracleDiscovery.Type) => {
    const declarations = A.filter(report.sourceRows, SourceRow.guards.caseDeclaration);
    const events = report.runtime.assertionEvents;
    return (
      unique(A.map(report.sourceRows, (row) => row.id)) &&
      unique(A.map(report.sourceFiles, (file) => file.path)) &&
      unique(A.map(events, (event) => event.id)) &&
      A.every(
        events,
        (event) =>
          A.some(declarations, (row) => row.id === event.declarationId) &&
          event.ordinal > 0 &&
          event.id === `${event.test}::${event.declarationId}::${event.ordinal}`
      ) &&
      A.every(declarations, (row) => A.some(events, (event) => event.declarationId === row.id)) &&
      A.length(A.filter(report.sourceRows, SourceRow.guards.testMethod)) === report.runtime.testsRun &&
      A.length(A.dedupe(A.map(events, (event) => event.test))) === report.runtime.testsRun &&
      A.every(
        report.sourceRows,
        (row) =>
          SourceRow.guards.fixture(row) ||
          A.some(report.sourceFiles, (file) => file.path === row.path && file.sha256 === row.sourceSha256)
      )
    );
  },
  $I.annote("DiscoveryAccounting", {
    title: "Oracle Discovery Accounting",
    description: "Unique source/event identities, complete assertion observation, method counts and file hashes agree.",
    message: "Oracle discovery has duplicate, missing, unclassified or source-inconsistent observations.",
  })
);

/**
 * Validated P0 discovery evidence for the exact official eyecite pin.
 *
 * **Details**
 *
 * Assertion discovery does not prove semantic case completeness, regex-family
 * coverage, normalized outputs, or target parity. Those remain separate gates.
 *
 * **Example** (Reject an unknown discovery version)
 *
 * ```ts
 * import { CitationOracleDiscovery } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CitationOracleDiscovery)({ schemaVersion: "unknown" })) // false
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class CitationOracleDiscovery extends S.Opaque<CitationOracleDiscovery, { readonly brand: unique symbol }>()(
  OracleDiscovery.check(DiscoveryAccounting).pipe(
    $I.annoteSchema("CitationOracleDiscovery", {
      description: "Pinned, licensed source/runtime assertion discovery with explicit limits on its evidence scope.",
    })
  )
) {}
