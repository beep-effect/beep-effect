import {
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryDocument,
  LibraryIntake,
  LibraryIntakeFile,
  LibraryIntakeRoot,
  LibraryMineBatchError,
  LibraryMineOptions,
  LibraryMinePrivateRouteError,
  LibraryMineReceipt,
  LibraryMineRunner,
  LibraryMineSpanError,
  LibraryMineUnreadError,
  LibraryModelRun,
  LibraryOccurrence,
  LibraryReadingOutput,
  LibrarySource,
  LibraryTriageOutput,
  loadCatalog,
  mineLibraryRead,
  mineLibrarySynthesize,
  mineLibraryTriage,
  saveImmutable,
  withCatalog,
} from "@beep/repo-cli/commands/Research";
import { checkLibraryMineSpans, planLibraryMine } from "@beep/repo-cli/test/ResearchLibrary";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { LibraryMineRunRequest } from "@beep/repo-cli/commands/Research";

const UnknownJson = S.fromJsonString(S.Unknown);
const ModelRunJson = S.fromJsonString(LibraryModelRun);
const CatalogJson = S.fromJsonString(LibraryCatalog);
const ReceiptJson = S.fromJsonString(LibraryMineReceipt);
const ReadingOutputJson = S.fromJsonString(LibraryReadingOutput);
const TriageOutputJson = S.fromJsonString(LibraryTriageOutput);
const readingEquivalent = S.toEquivalence(LibraryReadingOutput);
const triageEquivalent = S.toEquivalence(LibraryTriageOutput);
const encodeJson = S.encodeUnknownEffect(UnknownJson);

const publicText = "Bitemporal stores keep valid time and transaction time apart. They support audit queries.";
const privateText = "A private note about retrieval spans and citation checks.";

const services = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const webCapture = Effect.fn("test.webCapture")(function* (
  root: string,
  id: string,
  url: string,
  text: string,
  accessClass: "public" | "private"
) {
  const save = Effect.fn(function* (name: string, body: string, role: string, mediaType: string) {
    const saved = yield* saveImmutable(root, `evidence/${id}/${name}`, new TextEncoder().encode(body));
    return LibraryArtifact.make({ ...saved, role, mediaType, accessClass });
  });
  const html = `<html><body>${text}</body></html>`;
  const response = yield* encodeJson({
    data: { markdown: text, rawHtml: html, metadata: { sourceURL: url, statusCode: 200 } },
  });
  const artifacts = [
    yield* save("source.md", text, "extracted-full-text", "text/markdown"),
    yield* save("source.html", html, "raw-full-text", "text/html"),
    yield* save("response.json", response, "raw-response", "application/json"),
  ];
  return LibraryCapture.make({
    id: `capture-${id}`,
    sourceId: id,
    status: "readable",
    method: "firecrawl",
    recordedAt: "2026-11-06",
    capturedRevision: "abc",
    requestedRevision: "abc",
    complete: true,
    artifacts,
    reason: "",
  });
});

const occurrence = (id: string, sourceId: string, locator: string) =>
  LibraryOccurrence.make({
    id,
    documentId: "report",
    sourceId,
    revision: "abc",
    locator,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 2,
    label: locator,
    form: "url",
  });

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "research-library-mine-" });
  const repo = yield* fs.makeTempDirectoryScoped({ prefix: "research-library-mine-repo-" });
  yield* fs.makeDirectory(path.join(repo, "goals/demo-memory/ops"), { recursive: true });
  const manifest = yield* encodeJson({ initiative: { id: "demo-memory", title: "Demo memory" } });
  yield* fs.writeFileString(path.join(repo, "goals/demo-memory/ops/manifest.json"), manifest);
  const reportText = "See https://example.com/one and https://example.com/two";
  const report = yield* saveImmutable(root, "intakes/2026-11-06/raw/report.md", new TextEncoder().encode(reportText));
  const sources = A.map(
    [
      ["one", "https://example.com/one", "public"],
      ["two", "https://example.com/two", "private"],
    ] as const,
    ([id, url, accessClass]) =>
      LibrarySource.make({
        id,
        accessClass,
        kind: "web",
        canonicalUrl: url,
        identity: url,
        revision: "abc",
        repository: "",
        ownership: "external",
        locators: [url],
      })
  );
  const captures = [
    yield* webCapture(root, "one", "https://example.com/one", publicText, "public"),
    yield* webCapture(root, "two", "https://example.com/two", privateText, "private"),
  ];
  const catalog = LibraryCatalog.make({
    schema: "beep.research.library/v2",
    documents: [
      LibraryDocument.make({
        id: "report",
        originalPath: path.join(repo, "report.md"),
        snapshotPath: report.path,
        sha256: report.sha256,
        bytes: report.bytes,
        title: "Report",
        reportDate: "2026-11-06",
        expectedOccurrences: 2,
      }),
    ],
    intakes: [
      LibraryIntake.make({
        id: "intake-2026-11-06",
        date: "2026-11-06",
        createdAt: "2026-11-06T00:00:00.000Z",
        repoCommit: "",
        inputRoots: [LibraryIntakeRoot.make({ path: repo, repoCommit: "" })],
        manifestPath: "intakes/2026-11-06/manifest.json",
        files: [
          LibraryIntakeFile.make({
            originalPath: path.join(repo, "report.md"),
            snapshotPath: report.path,
            sha256: report.sha256,
            bytes: report.bytes,
            parseable: true,
          }),
        ],
      }),
    ],
    sources,
    occurrences: [
      occurrence("o1", "one", "https://example.com/one"),
      occurrence("o2", "two", "https://example.com/two"),
    ],
    captures,
    qualifications: [],
  });
  yield* withCatalog(root, () => Effect.succeed(catalog));
  return { root, repo, fs, path };
});

const options = (
  repo: string,
  profile: LibraryMineOptions["profile"],
  overrides: Partial<Pick<LibraryMineOptions, "dryRun" | "excludePrivate" | "limit">> = {}
) =>
  LibraryMineOptions.make({
    intake: "2026-11-06",
    profile,
    limit: overrides.limit ?? O.none(),
    concurrency: 2,
    dryRun: overrides.dryRun ?? false,
    excludePrivate: overrides.excludePrivate ?? false,
    repoRoot: O.some(repo),
  });

type Answer = (request: LibraryMineRunRequest) => string;

const fakeRunner = Effect.fn("test.fakeRunner")(function* (answer: Answer) {
  const calls = yield* Ref.make<ReadonlyArray<LibraryMineRunRequest>>([]);
  const service = LibraryMineRunner.of({
    run: Effect.fn("LibraryMineRunner.run")(function* (request) {
      yield* Ref.update(calls, A.append(request));
      return answer(request);
    }),
  });
  return { calls, service };
});

const selectAll: Answer = () => '{"decision":"select","reason":"on topic","topicIds":["goals/demo-memory","nope"]}';

const isPublicJob = (request: LibraryMineRunRequest) => Str.includes("capture-one")(request.jobKey);

const readings: Answer = (request) =>
  isPublicJob(request)
    ? `\`\`\`json
{"coverage":"complete","summary":"bitemporal","findings":[{"citoRelation":"supports","span":"keep valid time and transaction time apart","summary":"separation","topicIds":["goals/demo-memory"]}]}
\`\`\``
    : '{"coverage":"partial","summary":"skimmed","findings":[{"citoRelation":"supports","span":"retrieval spans","summary":"x","topicIds":[]},{"citoRelation":"discusses","span":"citation checks","summary":"y","topicIds":[]}]}';

const receiptsUnder = Effect.fn("test.receiptsUnder")(function* (root: string, tier: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(root, "ops/mine", tier, "receipts");
  const listed = yield* fs.readDirectory(directory, { recursive: true });
  const files = A.filter(listed, Str.endsWith(".json"));
  return yield* Effect.forEach(files, (file) =>
    fs.readFileString(path.join(directory, file)).pipe(Effect.flatMap(S.decodeEffect(ReceiptJson)))
  );
});

const triageAll = Effect.fn("test.triageAll")(function* (root: string, repo: string) {
  const runner = yield* fakeRunner(selectAll);
  yield* mineLibraryTriage(root, options(repo, "codex-luna")).pipe(
    Effect.provideService(LibraryMineRunner, runner.service)
  );
  return runner;
});

describe("research library mine", () => {
  it.effect("decodes a legacy ModelRun row without argv", () =>
    Effect.gen(function* () {
      const legacyRow = {
        id: "run",
        model: "gpt-6-luna",
        effort: "medium",
        route: "codex-cli",
        startedAt: "2026-10-01T00:00:00.000Z",
      };
      const legacy = yield* encodeJson(legacyRow);
      const decoded = yield* S.decodeEffect(ModelRunJson)(legacy);
      expect(decoded.argv).toStrictEqual([]);
      const catalogText = yield* encodeJson({
        schema: "beep.research.library/v2",
        modelRuns: [legacyRow],
        documents: [],
        sources: [],
        occurrences: [],
        captures: [],
        qualifications: [],
      });
      const catalog = yield* S.decodeEffect(CatalogJson)(catalogText);
      expect(A.map(catalog.modelRuns, (run) => run.argv)).toStrictEqual([[]]);
    })
  );

  it.effect.prop(
    "round-trips schema-derived runner answers and accepts every verbatim span",
    {
      reading: LibraryReadingOutput,
      triage: LibraryTriageOutput,
      start: S.Int.check(S.isBetween({ minimum: 0, maximum: 40 })),
    },
    ({ reading, triage, start }) =>
      Effect.gen(function* () {
        const answer = LibraryReadingOutput.make(reading);
        const readingText = yield* S.encodeEffect(ReadingOutputJson)(answer);
        const readingBack = yield* S.decodeEffect(ReadingOutputJson)(readingText);
        assertTrue(readingEquivalent(readingBack, answer));
        const decision = LibraryTriageOutput.make(triage);
        const triageText = yield* S.encodeEffect(TriageOutputJson)(decision);
        const triageBack = yield* S.decodeEffect(TriageOutputJson)(triageText);
        assertTrue(triageEquivalent(triageBack, decision));
        const span = Str.slice(start, start + 12)(publicText);
        yield* checkLibraryMineSpans("capture:a", publicText, [span]);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect("rejects spans that are not verbatim capture text", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(checkLibraryMineSpans("capture:a", publicText, ["valid time", "invented"]));
      assertInstanceOf(error, LibraryMineSpanError);
      expect(error.spans).toStrictEqual(["invented"]);
      yield* checkLibraryMineSpans("capture:a", publicText, ["valid time"]);
    })
  );

  it.effect("resolves a whitespace-only span difference to the verbatim capture slice", () =>
    Effect.gen(function* () {
      const text = "Analysis confirms that 98% of\nparent-child relationships (p < 0.05) occur locally.";
      const spans = yield* checkLibraryMineSpans("capture:a", text, [
        "98% of parent-child relationships (p < 0.05)",
        "occur locally.",
      ]);
      expect(spans).toStrictEqual(["98% of\nparent-child relationships (p < 0.05)", "occur locally."]);
      const error = yield* Effect.flip(checkLibraryMineSpans("capture:a", text, ["98% of parent child relationships"]));
      expect(error.spans).toStrictEqual(["98% of parent child relationships"]);
    })
  );
});

it.layer(services, { timeout: "30 seconds" })("research library mine runs", (it) => {
  it.effect("plans one job per readable text artifact and dry runs spawn nothing", () =>
    Effect.gen(function* () {
      const { root, repo } = yield* fixture;
      const plan = yield* planLibraryMine(root, "intake-2026-11-06");
      expect(A.map(plan, (job) => [job.sourceId, job.accessClass])).toStrictEqual([
        ["one", "public"],
        ["two", "private"],
      ]);
      const runner = yield* fakeRunner(selectAll);
      yield* mineLibraryTriage(root, options(repo, "codex-luna", { dryRun: true })).pipe(
        Effect.provideService(LibraryMineRunner, runner.service)
      );
      strictEqual((yield* Ref.get(runner.calls)).length, 0);
      strictEqual((yield* loadCatalog(root)).modelRuns.length, 0);
    })
  );

  it.effect("triage records every readable artifact once with launch argv and resumes", () =>
    Effect.gen(function* () {
      const { root, repo } = yield* fixture;
      const first = yield* triageAll(root, repo);
      const calls = yield* Ref.get(first.calls);
      strictEqual(calls.length, 2);
      const catalog = yield* loadCatalog(root);
      strictEqual(catalog.modelRuns.length, 2);
      const run = A.getUnsafe(catalog.modelRuns, 0);
      expect([run.model, run.effort, run.route]).toStrictEqual(["gpt-6-luna", "medium", "codex-cli"]);
      expect(A.take(run.argv, 4)).toStrictEqual(["codex", "exec", "-m", "gpt-6-luna"]);
      assertTrue(A.contains(run.argv, "--output-schema"));
      assertTrue(A.contains(run.argv, 'model_reasoning_effort="medium"'));
      const receipts = yield* receiptsUnder(root, "t1");
      expect(A.map(receipts, (receipt) => receipt.outcome)).toStrictEqual(["completed", "completed"]);
      expect(A.flatMap(receipts, (receipt) => receipt.droppedTopicIds)).toStrictEqual(["nope", "nope"]);
      const again = yield* triageAll(root, repo);
      strictEqual((yield* Ref.get(again.calls)).length, 0);
      strictEqual((yield* loadCatalog(root)).modelRuns.length, 2);
    })
  );

  it.effect("refuses private artifacts for junie and cursor before any launch", () =>
    Effect.gen(function* () {
      const { root, repo } = yield* fixture;
      yield* triageAll(root, repo);
      for (const profile of ["junie", "cursor"] as const) {
        const runner = yield* fakeRunner(readings);
        const error = yield* Effect.flip(
          mineLibraryRead(root, options(repo, profile)).pipe(Effect.provideService(LibraryMineRunner, runner.service))
        );
        assertInstanceOf(error, LibraryMinePrivateRouteError);
        expect(error.artifactIds).toHaveLength(1);
        strictEqual((yield* Ref.get(runner.calls)).length, 0);
      }
      const publicOnly = yield* fakeRunner(readings);
      yield* mineLibraryRead(root, options(repo, "junie", { excludePrivate: true })).pipe(
        Effect.provideService(LibraryMineRunner, publicOnly.service)
      );
      const calls = yield* Ref.get(publicOnly.calls);
      expect(A.map(calls, (call) => call.profile.id)).toStrictEqual(["junie"]);
      assertTrue(A.some(A.getUnsafe(calls, 0).argv, Str.startsWith("--task=Read the job file")));
    })
  );

  it.effect("reads selected artifacts into span-checked findings and drops affirmative partial claims", () =>
    Effect.gen(function* () {
      const { root, repo } = yield* fixture;
      yield* triageAll(root, repo);
      const runner = yield* fakeRunner(readings);
      yield* mineLibraryRead(root, options(repo, "claude")).pipe(
        Effect.provideService(LibraryMineRunner, runner.service)
      );
      const catalog = yield* loadCatalog(root);
      const urlOf = (sourceId: string) =>
        O.match(
          A.findFirst(catalog.sources, (source) => source.id === sourceId),
          { onNone: () => sourceId, onSome: (source) => source.canonicalUrl }
        );
      expect(
        A.map(catalog.findings, (finding) => [urlOf(finding.sourceId), finding.citoRelation, finding.span])
      ).toStrictEqual([
        ["https://example.com/one", "supports", "keep valid time and transaction time apart"],
        ["https://example.com/two", "discusses", "citation checks"],
      ]);
      expect(A.getUnsafe(catalog.findings, 0).topicIds).toStrictEqual(["goals/demo-memory"]);
      const runIds = A.map(catalog.modelRuns, (run) => run.id);
      assertTrue(A.every(catalog.findings, (finding) => A.contains(runIds, finding.modelRunId)));
      const readRun = O.getOrThrow(A.findFirst(catalog.modelRuns, (run) => Str.startsWith("mine:t2:")(run.id)));
      expect(A.take(readRun.argv, 6)).toStrictEqual([
        "claude",
        "-p",
        "--model",
        "claude-opus-5-5",
        "--effort",
        "medium",
      ]);
      const again = yield* fakeRunner(readings);
      yield* mineLibraryRead(root, options(repo, "claude")).pipe(
        Effect.provideService(LibraryMineRunner, again.service)
      );
      strictEqual((yield* Ref.get(again.calls)).length, 0);
    })
  );

  it.effect("rejects a reading whose span is not verbatim and records the rejection receipt", () =>
    Effect.gen(function* () {
      const { root, repo } = yield* fixture;
      yield* triageAll(root, repo);
      const runner = yield* fakeRunner(
        () =>
          '{"coverage":"complete","summary":"s","findings":[{"citoRelation":"supports","span":"time travel is solved","summary":"x","topicIds":[]}]}'
      );
      const error = yield* Effect.flip(
        mineLibraryRead(root, options(repo, "claude", { limit: O.some(1) })).pipe(
          Effect.provideService(LibraryMineRunner, runner.service)
        )
      );
      assertInstanceOf(error, LibraryMineBatchError);
      strictEqual((yield* loadCatalog(root)).findings.length, 0);
      const receipts = yield* receiptsUnder(root, "t2");
      expect(A.map(receipts, (receipt) => [receipt.outcome, receipt.errorTag])).toStrictEqual([
        ["rejected", "LibraryMineSpanError"],
      ]);
    })
  );

  it.effect("synthesize imports a T3 file with an orchestrator ModelRun once and rejects unbound captures", () =>
    Effect.gen(function* () {
      const { root, repo, fs, path } = yield* fixture;
      const author = { model: "claude-fable-5-1", effort: "medium", route: "claude-code", argv: ["claude"] };
      const file = path.join(repo, "t3.json");
      const synthesisText = yield* encodeJson({
        id: "t3-memory",
        author,
        findings: [
          {
            sourceId: "one",
            captureId: "capture-one",
            citoRelation: "citesAsEvidence",
            span: "They support audit queries.",
            summary: "audit",
            topicIds: ["goals/demo-memory"],
          },
        ],
      });
      yield* fs.writeFileString(file, synthesisText);
      const imported = yield* mineLibrarySynthesize(root, file, O.some(repo), false);
      strictEqual(imported.findings, 1);
      yield* mineLibrarySynthesize(root, file, O.some(repo), false);
      const catalog = yield* loadCatalog(root);
      expect(A.map(catalog.modelRuns, (run) => [run.id, run.model, run.route])).toStrictEqual([
        ["mine:t3:t3-memory", "claude-fable-5-1", "claude-code"],
      ]);
      strictEqual(catalog.findings.length, 1);
      const unbound = path.join(repo, "t3-unbound.json");
      const unboundText = yield* encodeJson({
        id: "t3-unbound",
        author,
        findings: [
          {
            sourceId: "one",
            captureId: "capture-two",
            citoRelation: "supports",
            span: "x",
            summary: "y",
            topicIds: [],
          },
        ],
      });
      yield* fs.writeFileString(unbound, unboundText);
      const error = yield* Effect.flip(mineLibrarySynthesize(root, unbound, O.some(repo), false));
      assertInstanceOf(error, LibraryMineUnreadError);
    })
  );
});
