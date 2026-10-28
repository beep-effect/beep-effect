/** Verify focused probes; strict mode also requires target and remaining coverage proof. */
import { convertTextOffsetRange, TextOffsetRange } from "@beep/langextract/VerifiedSpan";
import { CitationSupplementalExtraction } from "@beep/law-practice-use-cases/test";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

class SupplementalError extends S.TaggedError<SupplementalError, { readonly brand: unique symbol }>()(
  "CitationSupplementalError",
  { message: S.String }
) {}
const reject = () => Effect.fail(SupplementalError.make({ message: "Citation supplemental validation failed." }));
const hash = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const read = (path: string | URL) => Effect.tryPromise(() => Bun.file(path).text());
const same = S.toEquivalence(S.Json);
const root = new URL("../../../", import.meta.url);
const program = Effect.gen(function* () {
  const args = A.drop(process.argv, 2);
  let fixtures: string | URL = new URL("packages/law-practice/use-cases/test/fixtures/eyecite/", root);
  let evidence: string | URL = new URL("../history/evidence/", import.meta.url);
  let audit = false;
  const seen: Array<string> = [];
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === undefined || A.contains(seen, flag)) return yield* reject();
    seen.push(flag);
    if (flag === "--audit") {
      audit = true;
      continue;
    }
    const value = args[++index];
    if (value === undefined || (flag !== "--fixtures" && flag !== "--evidence")) return yield* reject();
    if (flag === "--fixtures") fixtures = `${value}/`;
    else evidence = `${value}/`;
  }
  const file = (base: string | URL, name: string) =>
    typeof base === "string" ? `${base}${name}` : new URL(name, base);
  const report = yield* read(file(fixtures, "supplemental-extraction.json")).pipe(
    Effect.flatMap(S.decodeEffect(S.fromJsonString(CitationSupplementalExtraction)))
  );
  const planRaw = yield* read(new URL("./supplemental-extraction-plan.json", import.meta.url));
  const plan = yield* S.decodeEffect(
    S.fromJsonString(
      S.Struct({
        schemaVersion: S.tag("citation-supplemental-extraction-plan/v1"),
        scope: S.String,
        cases: S.Array(
          S.Struct({
            id: S.String,
            text: S.String,
            expectedKinds: S.Array(S.String),
            expectedAuthorityGroups: S.Natural.pipe(S.Array, S.Array),
          })
        ),
        remainingCoverage: S.Array(S.String),
      })
    )
  )(planRaw);
  const producer = yield* read(new URL("./export-supplemental.py", import.meta.url));
  if (
    hash(planRaw) !== report.planSha256 ||
    hash(producer) !== report.exporterSha256 ||
    plan.scope !== report.scope ||
    !same(plan.remainingCoverage, report.remainingCoverage)
  )
    return yield* reject();
  const inventory = yield* read(file(fixtures, "source-inventory.json")).pipe(
    Effect.flatMap(
      S.decodeEffect(
        S.fromJsonString(S.Struct({ rows: S.Array(S.Struct({ path: S.String, sourceSha256: S.String })) }))
      )
    )
  );
  const operations = yield* read(file(fixtures, "operation-cases.json")).pipe(
    Effect.flatMap(S.decodeEffect(S.fromJsonString(S.Struct({ dependencies: S.Record(S.String, S.String) }))))
  );
  if (!same(operations.dependencies, report.dependencies) || R.size(report.sourceHashes) !== 4) return yield* reject();
  for (const path of ["eyecite/find.py", "eyecite/models.py", "eyecite/helpers.py", "eyecite/resolve.py"]) {
    if (!A.some(inventory.rows, (row) => row.path === path && row.sourceSha256 === report.sourceHashes[path]))
      return yield* reject();
  }
  const ids = A.map(report.cases, (row) => row.id);
  if (
    ids.length !== 13 ||
    A.dedupe(ids).length !== ids.length ||
    !same(
      ids,
      A.map(plan.cases, (row) => row.id)
    )
  )
    return yield* reject();
  let coordinates = 0;
  for (const row of report.cases) {
    const expected = A.findFirst(plan.cases, (item) => item.id === row.id);
    if (expected._tag === "None") return yield* reject();
    const value = row.payload.value;
    if (
      hash(row.payload.raw) !== row.normalizedSha256 ||
      value.text !== expected.value.text ||
      !same(
        A.map(value.citations, (cite) => cite.kind),
        expected.value.expectedKinds
      ) ||
      !same(value.authorityGroups, expected.value.expectedAuthorityGroups)
    )
      return yield* reject();
    if (row.targetProof !== null) {
      const target = new URL(row.targetProof.path, root);
      if (!Str.startsWith(root.href)(target.href)) return yield* reject();
      const targetBytes = yield* Effect.tryPromise(() => Bun.file(target).bytes());
      const targetText = new TextDecoder().decode(targetBytes);
      if (hash(targetBytes) !== row.targetProof.evidenceSha256 || !Str.includes(row.targetProof.name)(targetText))
        return yield* reject();
    }
    const count = value.citations.length;
    if (value.equality.length !== count || A.some(value.equality, (matrixRow) => matrixRow.length !== count))
      return yield* reject();
    for (let left = 0; left < count; left++)
      for (let right = 0; right < count; right++) {
        if (
          value.equality[left]?.[right] !== value.equality[right]?.[left] ||
          (left === right && value.equality[left]?.[right] !== true)
        )
          return yield* reject();
      }
    const members = A.flatten(value.authorityGroups);
    if (A.dedupe(members).length !== members.length || A.some(members, (index) => index >= count))
      return yield* reject();
    for (const cite of value.citations)
      for (const span of R.values(cite.spans)) {
        const converted = yield* convertTextOffsetRange(
          TextOffsetRange.make({ start: span.python[0], end: span.python[1], unit: "unicode-code-point" }),
          value.text
        );
        if (
          converted.startChar !== span.utf16[0] ||
          converted.endChar !== span.utf16[1] ||
          Str.slice(span.utf16[0], span.utf16[1])(value.text) !== span.text
        )
          return yield* reject();
        coordinates++;
      }
  }
  const legacy = yield* read(file(evidence, "cit-identity-merger-probe.json")).pipe(
    Effect.flatMap(
      S.decodeEffect(
        S.fromJsonString(
          S.Struct({
            input: S.String,
            equal: S.Boolean,
            authorityGroups: S.Natural.pipe(S.Array, S.Array),
            modelSourceSha256: S.String,
            resolveSourceSha256: S.String,
            citations: S.Array(
              S.Struct({
                kind: S.String,
                correctedReporter: S.String,
                groups: S.Record(S.String, S.String),
                span: S.Tuple([S.Natural, S.Natural]),
              })
            ),
          })
        )
      )
    )
  );
  const merger = report.cases[0]?.payload.value;
  if (
    merger === undefined ||
    legacy.input !== merger.text ||
    legacy.equal !== false ||
    merger.equality[0]?.[1] !== false ||
    !same(legacy.authorityGroups, merger.authorityGroups) ||
    legacy.modelSourceSha256 !== report.sourceHashes["eyecite/models.py"] ||
    legacy.resolveSourceSha256 !== report.sourceHashes["eyecite/resolve.py"] ||
    !same(
      legacy.citations,
      A.map(merger.citations, (cite) => ({
        kind: cite.kind,
        correctedReporter: cite.correctedReporter,
        groups: cite.groups,
        span: cite.spans.span.python,
      }))
    )
  )
    return yield* reject();
  if (
    !audit &&
    (report.remainingCoverage.length > 0 ||
      A.some(report.cases, (row) => row.workflowState !== "complete" || row.targetProof === null))
  )
    return yield* reject();
  yield* Console.log(
    `Supplemental extraction valid: 13 probes, ${coordinates} coordinate slices; ${report.remainingCoverage.length} coverage families and target proof remain open.`
  );
});
BunRuntime.runMain(program);
