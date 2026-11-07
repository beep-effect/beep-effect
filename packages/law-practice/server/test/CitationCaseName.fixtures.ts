/** Original find_case_name through a single captured scan/process invocation.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationCaseName } from "@beep/law-practice-server/internal/Citation/CaseName";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  assertCitationCaseNamePatch,
  CitationCaseNameSnapshot,
  readCitationCaseNameProcessCorpus,
} from "./CitationCaseNameProcess.fixtures.ts";
import { citationCaseNameScanErrorReason, readCitationCaseNameScanCorpus } from "./CitationCaseNameScan.fixtures.ts";
import {
  assertCitationWorkerCompositionReleased,
  makeCitationMetadataFixture,
  readCitationOracleFixture,
} from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationCaseName");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-plain-case-name/v1"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        scanCase: S.Natural,
        short: S.Boolean,
        seeded: S.Boolean,
        before: CitationCaseNameSnapshot,
        after: CitationCaseNameSnapshot,
        processed: S.Boolean,
        error: S.NullOr(S.Literals(["IndexError", "TypeError", "KeyError"])),
        regexCalls: S.Array(S.String),
      })
    ).check(S.isBetweenLength(256, 256)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original whole-helper mutations, guard decisions and regex-call counts over all sealed scan inputs.",
  })
);
/** Read the sealed original corpus and reusable native helper configuration. */
export const readCitationCaseNameCorpus = Effect.fn("CaseNameTest.load")(function* () {
  const scan = yield* readCitationCaseNameScanCorpus();
  const process = yield* readCitationCaseNameProcessCorpus();
  const corpus = yield* readCitationOracleFixture(
    "plain-case-name",
    "a63b136ccfac79f2dbf0c3ca38797d40cdb2d8296eb06b035ac676ed563ba1a2"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  return { scan, corpus, configuration: { scan: scan.configuration, process: process.configuration } };
});
const install = makeCitationMetadataFixture({ load: readCitationCaseNameCorpus, make: makeCitationCaseName });
type Row = (typeof Corpus.Type.cases)[number];
const assertRow = Effect.fn("CaseNameTest.row")(function* (
  setup: Effect.Success<ReturnType<typeof install>>,
  row: Row,
  kind: CitationNativeRuntimeKind
) {
  const source = A.getUnsafe(setup.scan.cases, row.scanCase);
  const effect = setup.stage.extract({ ...source.request, spanStart: row.before.span[0], short: row.short });
  if (row.error !== null) {
    const failure = yield* effect.pipe(Effect.flip);
    expect(failure).toMatchObject({
      _tag: "CitationCaseNameScanFailure",
      reason: citationCaseNameScanErrorReason(row.error, source),
    });
  } else {
    const result = yield* effect;
    expect(result.state).toEqual(source.state);
    yield* assertCitationCaseNamePatch(result, row, kind);
  }
});
/** Retain false-candidate/year guards, source failures, versus and seeded short names. */
export const replayCitationCaseName = Effect.fn("CaseNameTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const setup = yield* install(kind);
  const rows = A.filter(
    setup.corpus.cases,
    (row) => full || A.contains([1, 12, 20, 23, 56, 59, 93, 145, 156, 188], row.id)
  );
  let children = 0;
  for (const row of rows) {
    yield* assertRow(setup, row, kind);
    children += row.regexCalls.length;
  }
  expect(rows).toHaveLength(full ? 256 : 10);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, children);
});

/** A near-complete allowance must fail during processing instead of resetting after scan. */
export const assertCitationCaseNameSharedBudget = Effect.fn("CaseNameTest.sharedBudget")(function* () {
  const regular = yield* install("bun", undefined, true);
  const row = A.getUnsafe(regular.corpus.cases, 20);
  const source = A.getUnsafe(regular.scan.cases, row.scanCase);
  const request = { ...source.request, spanStart: row.before.span[0], short: row.short };
  const result = yield* regular.stage.extract(request);
  const total = yield* regular.budget.snapshot;
  expect(total).toBe(result.reservedUnits);
  yield* assertCitationWorkerCompositionReleased(
    regular.operation,
    regular.admission,
    regular.observed.snapshot,
    row.regexCalls.length
  );
  const tight = yield* install("bun", total - 1, true);
  const refused = yield* tight.stage.extract(request).pipe(Effect.flip);
  expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
  const used = yield* tight.budget.snapshot;
  expect(used).toBeGreaterThan(0);
  expect(used).toBeLessThanOrEqual(total - 1);
  const children = yield* tight.observed.snapshot;
  expect(children.spawned).toBeGreaterThan(source.calls.length);
  expect(children.spawned).toBeLessThanOrEqual(row.regexCalls.length);
  yield* assertCitationWorkerCompositionReleased(
    tight.operation,
    tight.admission,
    tight.observed.snapshot,
    children.spawned
  );
});
