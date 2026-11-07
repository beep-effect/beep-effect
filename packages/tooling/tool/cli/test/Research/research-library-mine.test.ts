import { PdfTools } from "@beep/pdf-tools";
import * as Rdf from "@beep/rdf/Rdf";
import {
  LibraryArtifact,
  LibraryCapture,
  LibraryCatalog,
  LibraryDerivation,
  LibraryDocument,
  LibraryFinding,
  LibraryHopGateInput,
  LibraryHopPolicy,
  LibraryIntake,
  LibraryIntakeFile,
  LibraryIntakeRoot,
  LibraryMineBatchError,
  LibraryMineLaunchPaths,
  LibraryMineOptions,
  LibraryMinePrivateRouteError,
  LibraryMineReceipt,
  LibraryMineRunner,
  LibraryMineSpanError,
  LibraryMineUnreadError,
  LibraryModelRun,
  LibraryOccurrence,
  LibraryPacketConcept,
  LibraryReadingOutput,
  LibraryReadingRecord,
  LibrarySource,
  LibraryTriageOutput,
  libraryHopGate,
  libraryMineArgv,
  libraryMineProfile,
  libraryMineProfileServes,
  loadCatalog,
  mineLibraryRead,
  mineLibrarySynthesize,
  mineLibraryTriage,
  saveImmutable,
  withCatalog,
} from "@beep/repo-cli/commands/Research";
import {
  assembleLibraryOntology,
  libraryShapes,
  libraryShapesDataset,
} from "@beep/repo-cli/commands/Research/Library/Library.ontology";
import { catalogDataset } from "@beep/repo-cli/commands/Research/Library/Library.projection";
import { checkLibraryMineSpans, planLibraryMine } from "@beep/repo-cli/test/ResearchLibrary";
import { ShaclValidationRequest, ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import { ShaclValidationServiceLive } from "@beep/shacl";
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
const FindingJson = S.fromJsonString(LibraryFinding);
const ReadingRecordJson = S.fromJsonString(LibraryReadingRecord);
const ReadingOutputJson = S.fromJsonString(LibraryReadingOutput);
const TriageOutputJson = S.fromJsonString(LibraryTriageOutput);
const readingEquivalent = S.toEquivalence(LibraryReadingOutput);
const triageEquivalent = S.toEquivalence(LibraryTriageOutput);
const encodeJson = S.encodeUnknownEffect(UnknownJson);

const publicText = "Bitemporal stores keep valid time and transaction time apart. They support audit queries.";
const privateText = "A private note about retrieval spans and citation checks.";
const reportText = "See https://example.com/one and https://example.com/two";
const dmText = "# DM archive\n\nWe agreed the ledger stays append-only.";

const platform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, ShaclValidationServiceLive);
const services = PdfTools.makeLayer().pipe(Layer.provideMerge(platform));

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

/**
 * Add hop-0 intake documents: a nightly whose bytes equal source one's captured text
 * (the same bytes a Box route captured) and a private DM archive markdown file.
 */
const documentFixture = Effect.gen(function* () {
  const base = yield* fixture;
  const { root, repo, path } = base;
  const add = Effect.fn(function* (id: string, name: string, text: string, accessClass: "public" | "private") {
    const saved = yield* saveImmutable(root, `intakes/2026-11-06/raw/${name}`, new TextEncoder().encode(text));
    const originalPath = path.join(repo, name);
    return {
      document: LibraryDocument.make({
        id,
        accessClass,
        originalPath,
        snapshotPath: saved.path,
        sha256: saved.sha256,
        bytes: saved.bytes,
        title: id,
        reportDate: "2026-11-06",
        expectedOccurrences: 0,
      }),
      file: LibraryIntakeFile.make({
        accessClass,
        originalPath,
        snapshotPath: saved.path,
        sha256: saved.sha256,
        bytes: saved.bytes,
        parseable: true,
      }),
    };
  });
  const added = [
    yield* add("nightly", "nightly.md", publicText, "public"),
    yield* add("dm", "dm.md", dmText, "private"),
  ];
  yield* withCatalog(root, (catalog) =>
    Effect.succeed(
      LibraryCatalog.make({
        ...catalog,
        documents: [...catalog.documents, ...A.map(added, (entry) => entry.document)],
        intakes: A.map(catalog.intakes, (intake) =>
          LibraryIntake.make({ ...intake, files: [...intake.files, ...A.map(added, (entry) => entry.file)] })
        ),
      })
    )
  );
  return base;
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
const isReportJob = (request: LibraryMineRunRequest) => Str.startsWith("document-report-")(request.jobKey);
const isDmJob = (request: LibraryMineRunRequest) => Str.startsWith("document-dm-")(request.jobKey);

const readings: Answer = (request) =>
  isReportJob(request)
    ? '{"coverage":"complete","summary":"links","findings":[{"citoRelation":"citesAsRelated","span":"See https://example.com/one","summary":"link list","topicIds":["goals/demo-memory"]}]}'
    : isDmJob(request)
      ? '{"coverage":"complete","summary":"dm","findings":[{"citoRelation":"discusses","span":"the ledger stays append-only","summary":"ledger","topicIds":["goals/demo-memory"]}]}'
      : isPublicJob(request)
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
  it("pins the codex-sol T2 fallback to gpt-6.1-sol medium in a read-only sandbox", () => {
    const profile = libraryMineProfile("codex-sol");
    const argv = libraryMineArgv(
      profile,
      LibraryMineLaunchPaths.make({
        cwd: "/s",
        schemaPath: "/s/t2.json",
        outputPath: "/s/a.json",
        promptPath: "/s/p.md",
      })
    );
    expect([profile.model, profile.effort, profile.route, profile.externalLane]).toEqual([
      "gpt-6.1-sol",
      "medium",
      "codex-cli",
      false,
    ]);
    expect([libraryMineProfileServes(profile, "t2"), libraryMineProfileServes(profile, "t1")]).toEqual([true, false]);
    expect(A.take(argv, 6)).toEqual(["codex", "exec", "-m", "gpt-6.1-sol", "-c", 'model_reasoning_effort="medium"']);
    expect(A.contains(argv, "read-only")).toBe(true);
  });

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
      const ohm = "experiences, \u2126 (usually 1-3) bound the memory";
      const folded = yield* checkLibraryMineSpans("capture:a", ohm, ["experiences, \u03a9 (usually 1-3)"]);
      expect(folded).toStrictEqual(["experiences, \u2126 (usually 1-3)"]);
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
      expect(A.map(plan, (job) => [job.kind, job.sourceId, job.documentId, job.accessClass])).toStrictEqual([
        ["source", "one", "", "public"],
        ["source", "two", "", "private"],
        ["document", "", "report", "public"],
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
      strictEqual(calls.length, 3);
      const catalog = yield* loadCatalog(root);
      strictEqual(catalog.modelRuns.length, 3);
      const run = A.getUnsafe(catalog.modelRuns, 0);
      expect([run.model, run.effort, run.route]).toStrictEqual(["gpt-6-luna", "medium", "codex-cli"]);
      expect(A.take(run.argv, 4)).toStrictEqual(["codex", "exec", "-m", "gpt-6-luna"]);
      assertTrue(A.contains(run.argv, "--output-schema"));
      assertTrue(A.contains(run.argv, 'model_reasoning_effort="medium"'));
      const receipts = yield* receiptsUnder(root, "t1");
      expect(A.map(receipts, (receipt) => receipt.outcome)).toStrictEqual(["completed", "completed", "completed"]);
      expect(A.flatMap(receipts, (receipt) => receipt.droppedTopicIds)).toStrictEqual(["nope", "nope", "nope"]);
      const again = yield* triageAll(root, repo);
      strictEqual((yield* Ref.get(again.calls)).length, 0);
      strictEqual((yield* loadCatalog(root)).modelRuns.length, 3);
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
      expect(A.map(calls, (call) => call.profile.id)).toStrictEqual(["junie", "junie"]);
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
        A.map(catalog.findings, (finding) => [
          urlOf(finding.sourceId),
          finding.documentId,
          finding.citoRelation,
          finding.span,
        ])
      ).toStrictEqual([
        ["https://example.com/one", "", "supports", "keep valid time and transaction time apart"],
        ["https://example.com/two", "", "discusses", "citation checks"],
        ["", "report", "citesAsRelated", "See https://example.com/one"],
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

  it.effect("plans parseable intake documents, skips byte-identical captures and keeps document access", () =>
    Effect.gen(function* () {
      const { root } = yield* documentFixture;
      const plan = yield* planLibraryMine(root, "2026-11-06");
      expect(A.map(plan, (job) => [job.kind, job.captureId || job.documentId, job.accessClass])).toStrictEqual([
        ["source", "capture-one", "public"],
        ["source", "capture-two", "private"],
        ["document", "report", "public"],
        ["document", "dm", "private"],
      ]);
      const dm = O.getOrThrow(A.findFirst(plan, (job) => job.documentId === "dm"));
      expect([dm.artifact.path, dm.artifact.mediaType, dm.captureId]).toStrictEqual([
        dm.artifact.path,
        "text/markdown",
        "",
      ]);
      assertTrue(Str.startsWith("intakes/2026-11-06/raw/")(dm.artifact.path));
    })
  );

  it.effect("refuses a private intake document for junie before any launch", () =>
    Effect.gen(function* () {
      const { root, repo } = yield* documentFixture;
      yield* triageAll(root, repo);
      const runner = yield* fakeRunner(readings);
      const error = yield* Effect.flip(
        mineLibraryRead(root, options(repo, "junie")).pipe(Effect.provideService(LibraryMineRunner, runner.service))
      );
      assertInstanceOf(error, LibraryMinePrivateRouteError);
      expect(A.some(error.artifactIds, Str.startsWith("document:dm:"))).toBe(true);
      strictEqual((yield* Ref.get(runner.calls)).length, 0);
    })
  );

  it.effect("binds T2 document findings to documentId, checks spans on the snapshot and passes SHACL", () =>
    Effect.gen(function* () {
      const { root, repo } = yield* documentFixture;
      yield* triageAll(root, repo);
      const runner = yield* fakeRunner(readings);
      yield* mineLibraryRead(root, options(repo, "claude")).pipe(
        Effect.provideService(LibraryMineRunner, runner.service)
      );
      const calls = yield* Ref.get(runner.calls);
      const prompts = A.map(A.filter(calls, isDmJob), (call) => call.prompt);
      assertTrue(A.every(prompts, Str.includes("one hop-0 intake report")));
      const catalog = yield* loadCatalog(root);
      const documentFindings = A.filter(catalog.findings, (finding) => Str.isNonEmpty(finding.documentId));
      expect(
        A.map(documentFindings, (finding) => [finding.documentId, finding.sourceId, finding.captureId, finding.span])
      ).toStrictEqual([
        ["dm", "", "", "the ledger stays append-only"],
        ["report", "", "", "See https://example.com/one"],
      ]);
      const runIds = A.map(catalog.modelRuns, (run) => run.id);
      assertTrue(A.every(documentFindings, (finding) => A.contains(runIds, finding.modelRunId)));
      const receipts = yield* receiptsUnder(root, "t2");
      assertTrue(
        A.some(
          receipts,
          (receipt) => Str.startsWith("document:dm:")(receipt.artifactId) && receipt.outcome === "completed"
        )
      );
      const validator = yield* ShaclValidationService;
      const ontology = yield* assembleLibraryOntology();
      const shapes = libraryShapes(ontology);
      const validate = (dataset: Rdf.Dataset) =>
        validator.validate(
          ShaclValidationRequest.make({ dataset, shapes, shapesDataset: O.some(libraryShapesDataset(shapes)) })
        );
      const dataset = yield* catalogDataset(catalog);
      const result = yield* validate(dataset);
      expect(result.violations).toStrictEqual([]);
      assertTrue(result.conforms);
      const findingEdges = (key: string) =>
        A.filter(
          dataset.quads,
          (quad) => Str.includes("/Finding/")(quad.subject.value) && Str.endsWith(`/${key}`)(quad.predicate.value)
        );
      assertTrue(
        A.every([...findingEdges("sourceId"), ...findingEdges("documentId")], (q) => q.object.termType === "NamedNode")
      );
      strictEqual(findingEdges("documentId").length, 2);
      const unbound = yield* validate(
        Rdf.makeDataset(A.filter(dataset.quads, (quad) => !A.contains(findingEdges("documentId"), quad)))
      );
      assertTrue(!unbound.conforms);
      const [sourceEdge] = findingEdges("sourceId");
      const doubled = yield* validate(
        Rdf.makeDataset([
          ...dataset.quads,
          Rdf.makeQuad(
            O.getOrThrow(O.fromNullishOr(sourceEdge)).subject,
            A.getUnsafe(findingEdges("documentId"), 0).predicate,
            A.getUnsafe(findingEdges("documentId"), 0).object
          ),
        ])
      );
      assertTrue(!doubled.conforms);
    })
  );

  it.effect("decodes legacy findings and reading records without documentId", () =>
    Effect.gen(function* () {
      const legacy = {
        id: "f",
        sourceId: "one",
        captureId: "capture-one",
        citoRelation: "discusses",
        span: "x",
        summary: "y",
        topicIds: [],
        modelRunId: "run",
        recordedAt: "2026-11-01",
      };
      const legacyText = yield* encodeJson(legacy);
      const finding = yield* S.decodeEffect(FindingJson)(legacyText);
      expect([finding.sourceId, finding.documentId]).toStrictEqual(["one", ""]);
      const recordText = yield* encodeJson({
        artifactId: "capture-one:abc",
        sourceId: "one",
        captureId: "capture-one",
        artifactSha256: Str.repeat(64)("a"),
        coverage: "complete",
        summary: "s",
        findings: [legacy],
        modelRunId: "run",
        modelRun: { id: "run", model: "m", effort: "medium", route: "r", startedAt: "2026-11-01" },
        recordedAt: "2026-11-01",
      });
      const record = yield* S.decodeEffect(ReadingRecordJson)(recordText);
      expect([record.documentId, A.getUnsafe(record.findings, 0).documentId]).toStrictEqual(["", ""]);
    })
  );

  it.effect("ignores a hop-0 document finding with live topics in the routed-parent hop gate", () =>
    Effect.sync(() => {
      const source = (id: string, url: string) =>
        LibrarySource.make({
          id,
          kind: "web",
          canonicalUrl: url,
          identity: url,
          revision: "",
          repository: "",
          ownership: "external",
          locators: [url],
        });
      const parent = source("parent", "https://parent.example/a");
      const child = source("child", "https://child.org/b");
      const edge = (hopDepth: number, from: string, to: string) =>
        LibraryDerivation.make({
          id: `d-${to}`,
          derivedId: to,
          sourceId: from,
          intakeId: "intake-2026-11-06",
          rootId: "report",
          hopDepth,
          recordedAt: "2026-11-06",
        });
      const finding = (id: string, sourceId: string, documentId: string) =>
        LibraryFinding.make({
          id,
          sourceId,
          documentId,
          citoRelation: "discusses",
          summary: "s",
          topicIds: ["goals/demo-memory"],
          recordedAt: "2026-11-06",
        });
      const decide = (findings: ReadonlyArray<LibraryFinding>) =>
        A.map(
          libraryHopGate(
            LibraryCatalog.make({
              schema: "beep.research.library/v2",
              documents: [],
              sources: [parent, child],
              occurrences: [],
              derivations: [edge(1, "report", "parent"), edge(2, "parent", "child")],
              findings,
              captures: [],
              qualifications: [],
            }),
            LibraryHopGateInput.make({
              concepts: [
                LibraryPacketConcept.make({
                  id: "goals/demo-memory",
                  initiativeId: "demo-memory",
                  status: "active",
                  live: true,
                }),
              ],
              policy: LibraryHopPolicy.make({}),
            })
          ),
          (decision) => [decision.sourceId, decision.admitted, decision.reason]
        );
      expect(decide([finding("doc-finding", "", "report")])).toStrictEqual([["child", false, "unrouted-parent"]]);
      expect(decide([finding("doc-finding", "", "report"), finding("src-finding", "parent", "")])).toStrictEqual([
        ["child", true, "routed-parent"],
      ]);
    })
  );
});
