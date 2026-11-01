import {
  PageTextRequest,
  PdfTools,
  PdfToolsConfig,
  PdfToolsError,
  PixelBox,
  RasterMetrics,
  RasterRequest,
  SvgToPdfRequest,
  SvgToPdfResult,
} from "@beep/pdf-tools";
import {
  DrawingsCommandError,
  drawingsCommand,
  GeometryEngineOcctLive,
  PdfBackendFromPdfTools,
  PdfBackendToolsLive,
  renderManifestSummary,
} from "@beep/repo-cli/commands/Drawings";
import {
  BoundingBox,
  Box,
  Camera,
  cameraForView,
  DrawingError,
  EngineInfo,
  FigureRecord,
  FontPin,
  GeometryEngine,
  LabelFontAlias,
  ModelSpec,
  ModelSummary,
  OmissionProof,
  Part,
  PdfBackend,
  RenderManifest,
  Sha256Hex,
  SheetFinding,
  SheetFonts,
  SheetOptions,
  sha256Hex,
  structuralFindings,
  ValidationOptions,
  ValidationReport,
} from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { PDFDocument, StandardFonts } from "pdf-lib";

// Command-level coverage that needs no native PDF tools: every case fails or
// prints before a tool would run, so it holds on hosted runners too.
const runDrawings = Command.runWith(drawingsCommand, { version: "0.0.0" });
const TestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer);

it.layer(PdfBackendToolsLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))), {
  timeout: "30 seconds",
})((it) => {
  it.effect(
    "maps real PDF page and font facts through the drawing backend adapter",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped();
      const pdfPath = path.join(dir, "facts.pdf");
      const doc = yield* Effect.promise(() => PDFDocument.create({ updateMetadata: false }));
      const font = yield* Effect.promise(() => doc.embedFont(StandardFonts.Helvetica));
      doc.addPage([612, 792]).drawText("adapter fixture", { font });
      yield* fs.writeFile(pdfPath, yield* Effect.promise(() => doc.save({ useObjectStreams: false })));
      const backend = yield* PdfBackend;
      const facts = yield* backend.inspect(pdfPath);
      deepStrictEqual(
        A.map(facts.pages, (page) => [page.widthPt, page.heightPt]),
        [[612, 792]]
      );
      deepStrictEqual(
        A.map(facts.fonts, (entry) => [entry.name, entry.embedded]),
        [["Helvetica", false]]
      );
      expect(facts.annotationCount).toBe(0);
      expect(facts.encrypted).toBe(false);
      deepStrictEqual(facts.undecodableStreams, []);
    })
  );

  it.effect(
    "carries a FlateDecode stream a strict reader refuses into the facts, and the validator fails the file",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped();
      const pdfPath = path.join(dir, "undecodable.pdf");
      const doc = yield* Effect.promise(() => PDFDocument.create({ updateMetadata: false }));
      doc.addPage([612, 792]);
      // bytes declared FlateDecode that are not zlib data at all
      const stream = doc.context.register(
        doc.context.stream(new TextEncoder().encode("not zlib data"), { Filter: "FlateDecode" })
      );
      yield* fs.writeFile(pdfPath, yield* Effect.promise(() => doc.save({ useObjectStreams: false })));
      const facts = yield* (yield* PdfBackend).inspect(pdfPath);
      deepStrictEqual(
        A.map(facts.undecodableStreams, (s) => [s.objectNumber, s.generation]),
        [[stream.objectNumber, stream.generationNumber]]
      );
      const findings = structuralFindings({ facts, options: ValidationOptions.make({ expectedPages: O.some(1) }) });
      // pdf-lib writes a 1.7 header, which is flagged on its own; the stream is the finding under test
      deepStrictEqual(
        A.filter(
          A.map(findings, (f) => f.code),
          (code) => code !== "pdf-version"
        ),
        ["pdf-stream-undecodable"]
      );
    })
  );

  it.effect(
    "forwards pinned font settings to the PDF driver and preserves a missing-directory failure",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped();
      const fontDirectory = path.join(dir, "missing-fonts");
      const backend = yield* PdfBackend;
      const error = yield* Effect.flip(
        backend.svgToPdf(
          [path.join(dir, "sheet.svg")],
          path.join(dir, "out.pdf"),
          O.some(
            SheetFonts.make({
              directory: fontDirectory,
              families: [LabelFontAlias.make({ requested: "Arial", family: "Label Boxes" })],
            })
          )
        )
      );
      assertInstanceOf(error, DrawingError);
      expect(error.reason).toBe("pdf");
      expect(O.getOrThrow(error.cause)).toContain(`The pinned font directory "${fontDirectory}" does not exist.`);
    })
  );
});

// A one-byte inflate limit stops the stream check at the first FlateDecode stream: the backend carries
// `limit-reached` into the facts and the validator fails the file as unverified.
it.layer(
  PdfBackendFromPdfTools.pipe(
    Layer.provide(PdfTools.makeLayer(PdfToolsConfig.make({ maxInflatedBytes: 1 }))),
    Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))
  ),
  { timeout: "30 seconds" }
)((it) => {
  it.effect(
    "carries exhausted container discovery through the backend even when discovered streams inflate",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped();
      const pdfPath = path.join(dir, "undiscovered.pdf");
      const doc = yield* Effect.promise(() => PDFDocument.create({ updateMetadata: false }));
      doc.addPage([612, 792]);
      doc.context.register(doc.context.stream(A.join(A.replicate("/ObjStm ", 129), "")));
      yield* fs.writeFile(pdfPath, yield* Effect.promise(() => doc.save({ useObjectStreams: false })));
      const facts = yield* (yield* PdfBackend).inspect(pdfPath);
      expect(facts.containerDiscovery).toBe("limit-reached");
      expect(facts.streamCheck).toBe("complete");
      expect(facts.undecodableStreams).toEqual([]);
      const findings = structuralFindings({ facts, options: ValidationOptions.make({ expectedPages: O.some(1) }) });
      expect(A.map(findings, (finding) => finding.message)).toContain(
        "PDF container discovery is limit-reached; global stream inspection is incomplete, so the file is unverified."
      );
    })
  );
  it.effect(
    "carries a stream check that stopped at the inflate limit into the facts, and the validator fails the file",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped();
      const pdfPath = path.join(dir, "unchecked.pdf");
      const doc = yield* Effect.promise(() => PDFDocument.create({ updateMetadata: false }));
      doc.addPage([612, 792]);
      // a valid FlateDecode stream that inflates past the one-byte limit
      doc.context.register(doc.context.flateStream("q 0 0 m 100 100 l S Q\n"));
      yield* fs.writeFile(pdfPath, yield* Effect.promise(() => doc.save({ useObjectStreams: false })));
      const facts = yield* (yield* PdfBackend).inspect(pdfPath);
      deepStrictEqual(facts.undecodableStreams, []);
      expect(facts.streamCheck).toBe("limit-reached");
      expect(facts.containerDiscovery).toBe("complete");
      const findings = structuralFindings({ facts, options: ValidationOptions.make({ expectedPages: O.some(1) }) });
      // pdf-lib writes a 1.7 header, which is flagged on its own; the unfinished check is the finding under test
      deepStrictEqual(
        A.filter(
          A.map(findings, (f) => f.code),
          (code) => code !== "pdf-version"
        ),
        ["pdf-stream-undecodable"]
      );
    })
  );
});

class PdfRequests extends Context.Service<PdfRequests, Ref.Ref<ReadonlyArray<unknown>>>()(
  "@beep/repo-cli/test/drawings-command.test/PdfRequests"
) {}
const unusedPdfOperation = () => Effect.die("This PDF port is not used by the adapter fixture.");
const driverFailure = PdfToolsError.make({ reason: "tool-failed", message: "fixture tool refusal" });
const fakeTools = Layer.effect(
  PdfTools,
  Effect.gen(function* () {
    const calls = yield* PdfRequests;
    return PdfTools.of({
      annotations: unusedPdfOperation,
      inkCoverage: unusedPdfOperation,
      inspect: unusedPdfOperation,
      pageWords: unusedPdfOperation,
      renderPng: unusedPdfOperation,
      measurePage: Effect.fn("TestPdfTools.measurePage")(
        (request: RasterRequest): Effect.Effect<RasterMetrics, PdfToolsError> =>
          request.pdfPath === "missing.pdf"
            ? Effect.fail(driverFailure)
            : Ref.update(calls, A.append(request)).pipe(
                Effect.as(
                  RasterMetrics.make({
                    width: 100,
                    height: 80,
                    dpi: request.dpi,
                    inkBox: O.some(PixelBox.make({ minX: 10, minY: 20, maxX: 40, maxY: 50 })),
                    inkPixels: 100,
                    impurePixels: 2,
                    chromaPixels: 0,
                    largestBlackSquare: 3,
                  })
                )
              )
      ),
      pageText: Effect.fn("TestPdfTools.pageText")(
        (request: PageTextRequest): Effect.Effect<string, PdfToolsError> =>
          request.pdfPath === "missing.pdf"
            ? Effect.fail(driverFailure)
            : Ref.update(calls, A.append(request)).pipe(Effect.as("adapter fixture"))
      ),
      svgToPdf: Effect.fn("TestPdfTools.svgToPdf")((request: SvgToPdfRequest) =>
        Ref.update(calls, A.append(request)).pipe(
          Effect.as(
            SvgToPdfResult.make({
              outputPath: request.outputPath,
              pageCount: 1,
              bytes: 100,
            })
          )
        )
      ),
    });
  })
);

const pdfAdapterFixture = PdfBackendFromPdfTools.pipe(
  Layer.provide(fakeTools),
  Layer.provideMerge(Layer.effect(PdfRequests, Ref.make<ReadonlyArray<unknown>>([])))
);
it.layer(pdfAdapterFixture, { timeout: "10 seconds" })((it) => {
  it.effect(
    "maps PDF raster and text ports and preserves driver failures without native executables",
    Effect.fnUntraced(function* () {
      const calls = yield* PdfRequests;
      const backend = yield* PdfBackend;
      const measured = yield* backend.measurePage({ pdfPath: "fixture.pdf", page: 2, dpi: 144, antiAlias: false });
      expect([measured.width, measured.height, measured.dpi, measured.antiAliased]).toEqual([100, 80, 144, false]);
      expect(O.getOrThrow(measured.inkBounds)).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 50 });
      expect([measured.inkPixels, measured.impurePixels, measured.largestBlackSquare]).toEqual([100, 2, 3]);
      expect(yield* backend.pageText("fixture.pdf", 2)).toBe("adapter fixture");
      yield* backend.svgToPdf(["sheet.svg"], "out.pdf", O.none());
      const requests = yield* Ref.get(calls);
      deepStrictEqual(requests, [
        RasterRequest.make({ pdfPath: "fixture.pdf", page: 2, dpi: 144, antiAlias: false }),
        PageTextRequest.make({ pdfPath: "fixture.pdf", page: 2 }),
        SvgToPdfRequest.make({ svgPaths: ["sheet.svg"], outputPath: "out.pdf", fonts: O.none() }),
      ]);
      const failures = yield* Effect.all([
        Effect.flip(backend.pageText("missing.pdf", 1)),
        Effect.flip(backend.measurePage({ pdfPath: "missing.pdf", page: 1, dpi: 72, antiAlias: true })),
      ]);
      expect(A.map(failures, (error) => [error.reason, error.message])).toEqual([
        ["pdf", "The PDF backend failed."],
        ["pdf", "The PDF backend failed."],
      ]);
    })
  );
});

it.layer(GeometryEngineOcctLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))), {
  timeout: "30 seconds",
})((it) => {
  it.effect(
    "adapts kernel identity, solid summaries and projections with typed port errors",
    Effect.fnUntraced(function* () {
      const engine = yield* GeometryEngine;
      const info = yield* engine.info;
      expect(info.name).toBe("replicad/opencascade.js");
      expect(info.version).not.toBe("");
      const model = ModelSpec.make({
        parts: [
          Part.make({
            name: "box",
            add: [Box.make({ min: [0, 0, 0], max: [10, 20, 30] })],
          }),
        ],
      });
      const summary = yield* engine.summarize(model);
      expect(summary.volume).toBeCloseTo(6000);
      const views = yield* engine.project(model, [Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] })], O.none());
      expect(A.length(views)).toBe(1);
      expect(A.length(views[0]!.visible)).toBeGreaterThan(0);
      const degenerate = ModelSpec.make({
        parts: [
          Part.make({
            name: "zero-width",
            add: [Box.make({ min: [0, 0, 0], max: [0, 10, 10] })],
          }),
        ],
      });
      const buildFailure = yield* Effect.flip(engine.summarize(degenerate));
      expect([buildFailure.reason, buildFailure.message]).toEqual([
        "geometry",
        "The kernel could not build the model.",
      ]);
      const projectionFailure = yield* Effect.flip(
        engine.project(model, [Camera.make({ eye: [0, 0, 0], up: [0, 0, 1] })], O.none())
      );
      expect([projectionFailure.reason, projectionFailure.message]).toEqual([
        "projection",
        "Hidden-line projection failed.",
      ]);
    })
  );
});

const logged = TestConsole.logLines.pipe(Effect.map((lines) => A.join(A.map(lines, String), "\n")));

const manifestWith = (sheet: O.Option<SheetOptions>) =>
  RenderManifest.make({
    title: "Synthetic block",
    specSha256: "00",
    engine: EngineInfo.make({ name: "fake", version: "0", binarySha256: "" }),
    model: ModelSummary.make({
      boundingBox: BoundingBox.make({ min: [0, 0, 0], max: [1, 1, 1] }),
      volume: 1,
      faceCount: 6,
      edgeCount: 12,
    }),
    scale: 2,
    figures: [
      FigureRecord.make({
        figure: 1,
        view: "top-perspective",
        description: "is a top view",
        svgFile: "fig-1.svg",
        svgSha256: "00",
        visibleSegments: 4,
        camera: O.some(Camera.make({ eye: [-1, -1, 1], up: [0, 0, 1] })),
      }),
      FigureRecord.make({
        figure: 2,
        view: "bottom-perspective",
        description: "is a bottom view",
        svgFile: "fig-2.svg",
        svgSha256: "00",
        visibleSegments: 4,
        camera: O.some(Camera.make({ eye: [-1, -1, -1], up: [0, 0, 1], focus: O.some(10) })),
      }),
      FigureRecord.make({
        figure: 3,
        view: "front",
        description: "is a front view",
        svgFile: "fig-3.svg",
        svgSha256: "00",
        visibleSegments: 4,
      }),
    ],
    omissions: [],
    pdfFile: "sheets.pdf",
    pdfSha256: "00",
    validation: O.none(),
    sheet,
  });

describe("beep drawings render summary", () => {
  it.effect(
    "names the sheet standard, the spec as its source, and each pictorial's projection",
    Effect.fnUntraced(function* () {
      const requested = SheetOptions.make({});
      const fromSpec = renderManifestSummary({
        manifest: manifestWith(O.some(SheetOptions.make({ margins: "cfr-strict" }))),
        requested,
      });
      expect(fromSpec).toContain("sheet: letter, margins cfr-strict (from the spec; the --format flag was not used)");
      expect(fromSpec).toContain("  FIG. 1 top-perspective: fig-1.svg (4 segments, isometric)");
      expect(fromSpec).toContain("  FIG. 2 bottom-perspective: fig-2.svg (4 segments, perspective)");
      expect(fromSpec).toContain("  FIG. 3 front: fig-3.svg (4 segments)");
      // a converging pictorial with a facing sight is the two-point perspective
      const twoPoint = manifestWith(O.some(requested));
      const camera = cameraForView({
        view: "top-perspective",
        box: twoPoint.model.boundingBox,
        projection: "two-point",
      });
      const withCamera = (pictorial: Camera) =>
        RenderManifest.make({
          ...twoPoint,
          figures: A.map(twoPoint.figures, (f) =>
            f.figure === 1 ? FigureRecord.make({ ...f, camera: O.some(pictorial) }) : f
          ),
        });
      expect(renderManifestSummary({ manifest: withCamera(camera), requested })).toContain(
        "  FIG. 1 top-perspective: fig-1.svg (4 segments, two-point)"
      );
      // a level converging camera without a sight is not labelled two-point
      expect(
        renderManifestSummary({ manifest: withCamera(Camera.make({ ...camera, sight: O.none() })), requested })
      ).toContain("  FIG. 1 top-perspective: fig-1.svg (4 segments, perspective)");
      expect(renderManifestSummary({ manifest: manifestWith(O.some(requested)), requested })).toContain(
        "sheet: letter, margins cfr-cm"
      );
      // manifests rendered before the sheet was recorded print no sheet line
      expect(
        A.filter(renderManifestSummary({ manifest: manifestWith(O.none()), requested }), (line) =>
          Str.startsWith("sheet:")(line)
        )
      ).toEqual([]);
    })
  );
});

describe("beep drawings command", () => {
  it.layer(TestLayer, { timeout: "60 seconds" })((it) => {
    it.effect(
      "lists its subcommands, and the sign and critics groups list their routes",
      Effect.fnUntraced(function* () {
        yield* runDrawings([]);
        yield* runDrawings(["sign"]);
        yield* runDrawings(["critics"]);
        const output = yield* logged;
        expect(output).toContain(
          "drawings commands: render, validate, judge, judge-ingest, statement, sign, deliver, review, intake"
        );
        expect(output).toContain("drawings sign commands: email, pdf");
        expect(output).toContain("Subcommands: pack, run, summary. See --help.");
      })
    );

    it.effect(
      "statement refuses a manifest that does not decode",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const manifest = path.join(dir, "manifest.json");
        yield* fs.writeFileString(manifest, "{}");
        const error = yield* Effect.flip(runDrawings(["statement", "--manifest", manifest]));
        assertInstanceOf(error, DrawingsCommandError);
        expect(error.message).toContain("Invalid render manifest");
      })
    );

    it.effect(
      "sign pdf refuses a deliverer that is not an email address before reading anything",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const manifest = path.join(dir, "manifest.json");
        const pdf = path.join(dir, "approval.pdf");
        yield* fs.writeFileString(manifest, "{}");
        yield* fs.writeFileString(pdf, "%PDF-1.6");
        const error = yield* Effect.flip(
          runDrawings([
            "sign",
            "pdf",
            "--manifest",
            manifest,
            "--by",
            "developer",
            "--pdf",
            pdf,
            "--page",
            "2",
            "--attested-by",
            "operator",
            "--delivered-by",
            "not-an-email",
            "--corpus-root",
            dir,
          ])
        );
        assertInstanceOf(error, DrawingsCommandError);
        expect(error.message).toBe('"not-an-email" is not an email address.');
      })
    );

    it.effect(
      "judge-ingest refuses a reply without a JSON inventory",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const reply = path.join(dir, "reply.md");
        yield* fs.writeFileString(reply, "no inventory here\n");
        const error = yield* Effect.flip(runDrawings(["judge-ingest", "--pack", dir, "--reply", reply]));
        assertInstanceOf(error, DrawingsCommandError);
      })
    );
  });
});

describe("beep drawings render summary of a full manifest", () => {
  it.effect(
    "prints shading, part overlaps, label fonts, omissions, and every validator finding",
    Effect.fnUntraced(function* () {
      const requested = SheetOptions.make({});
      const base = manifestWith(O.some(requested));
      const finding = (code: SheetFinding["code"], page: O.Option<number>, message: string) =>
        SheetFinding.make({ code, page, message });
      const shaded = RenderManifest.make({
        ...base,
        shaded: true,
        model: ModelSummary.make({ ...base.model, partOverlaps: 2 }),
        fonts: [
          FontPin.make({
            family: "Label Boxes",
            file: "/fonts/label.ttf",
            sha256: Sha256Hex.make(Str.repeat(64)("a")),
          }),
        ],
        figures: [
          FigureRecord.make({
            figure: 1,
            view: "top-perspective",
            description: "is a top view",
            svgFile: "fig-1.svg",
            svgSha256: "00",
            visibleSegments: 4,
            shadingSegments: 6,
          }),
        ],
        omissions: [OmissionProof.make({ omitted: "rear", shown: "front", relation: "mirror", proven: true })],
        validation: O.some(
          ValidationReport.make({
            pdfSha256: "00",
            pageCount: 2,
            findings: [
              finding("pdf-version", O.none(), "PDF header is 1.7"),
              finding("margin-top", O.some(2), "top margin is 1.2 cm"),
            ],
          })
        ),
      });
      deepStrictEqual(renderManifestSummary({ manifest: shaded, requested }), [
        'rendered "Synthetic block": 1 shaded sheet(s) at 2 pt/unit → sheets.pdf',
        "sheet-set sha256 00",
        "warning: 2 pair(s) of parts overlap (rendered under --allow-part-overlaps)",
        "sheet: letter, margins cfr-cm",
        `label font: Label Boxes → /fonts/label.ttf (sha256 ${Str.repeat(64)("a")})`,
        // a pictorial figure without a recorded camera carries no projection note
        "  FIG. 1 top-perspective: fig-1.svg (4 segments, 6 shading)",
        "  omitted rear: mirror to front — proven",
        "validator: 2 finding(s) on 2 page(s), sha256 00",
        "  [pdf-version] PDF header is 1.7",
        "  [margin-top] page 2: top margin is 1.2 cm",
      ]);
      const clean = RenderManifest.make({
        ...base,
        validation: O.some(ValidationReport.make({ pdfSha256: "00", pageCount: 3, findings: [] })),
      });
      expect(renderManifestSummary({ manifest: clean, requested })).toContain("validator: ok (3 page(s), sha256 00)");
    })
  );
});

const encodeManifest = S.encodeEffect(S.fromJsonString(RenderManifest));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const textBytes = (text: string) => new TextEncoder().encode(text);

// A synthetic sheet set: sheets.pdf and a manifest recording its hash, or the
// hash of other bytes when `stale`; `figures: false` writes a manifest without
// sheets, so nothing has to be rasterised.
const writeSheetSet = Effect.fnUntraced(function* (options: { readonly figures: boolean; readonly stale: boolean }) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped();
  const bytes = textBytes("%PDF-1.6\n% synthetic sheet set\n");
  yield* fs.writeFile(path.join(dir, "sheets.pdf"), bytes);
  const base = manifestWith(O.none());
  const manifest = RenderManifest.make({
    ...base,
    pdfSha256: yield* sha256Hex(options.stale ? textBytes("another sheet set") : bytes),
    figures: options.figures ? base.figures : [],
  });
  const manifestPath = path.join(dir, "manifest.json");
  yield* fs.writeFileString(manifestPath, yield* encodeManifest(manifest));
  return { dir, manifest: manifestPath, pdf: path.join(dir, "sheets.pdf") };
});

const judgeReply = {
  schemaVersion: "qa-inventory/v1",
  round: 1,
  sessionRef: "../../manifest.json",
  judge: { model: "claude-opus-5-5", effort: "inherited" },
  findings: [
    {
      id: "R1-01",
      severity: "P1",
      lens: "orientation",
      title: "The reference photo shows the tab folded down",
      evidence: [{ kind: "sheet", path: "photos/article.jpg", eventIds: [] }],
      repro: "Compare the photo with FIG. 1.",
      fix: "Flip the tab rotation sign in the spec.",
    },
  ],
  requiredCount: 1,
};

const failureMessage = (args: ReadonlyArray<string>) =>
  Effect.flip(runDrawings(args)).pipe(Effect.map((error) => error.message));

// Every route below fails or finishes before a native PDF tool or a reviewer
// process would run, so the cases hold on hosted runners without poppler.
describe("beep drawings command routes", () => {
  it.layer(TestLayer, { timeout: "120 seconds" })((it) => {
    it.effect(
      "render and validate map figure-set failures and print the findings of a sheet set without pages",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const spec = path.join(dir, "spec.json");
        yield* fs.writeFileString(spec, "{}");
        const render = yield* Effect.flip(runDrawings(["render", "--spec", spec, "--out", path.join(dir, "out")]));
        assertInstanceOf(render, DrawingsCommandError);
        expect(render.message).toContain(`Rendering the figure set failed: Invalid figure-set spec "${spec}". (`);

        const notPdf = path.join(dir, "notes.pdf");
        yield* fs.writeFileString(notPdf, "not a pdf\n");
        expect(yield* failureMessage(["validate", notPdf])).toContain(
          "Validating the sheet set failed: The PDF backend failed. ("
        );

        const empty = path.join(dir, "empty.pdf");
        const doc = yield* Effect.promise(() => PDFDocument.create({ updateMetadata: false }));
        // pdf-lib adds a blank page to an empty document unless told not to
        const bytes = yield* Effect.promise(() => doc.save({ useObjectStreams: false, addDefaultPage: false }));
        yield* fs.writeFile(empty, bytes);
        const findings = yield* Effect.flip(runDrawings(["validate", empty]));
        assertInstanceOf(findings, DrawingsCommandError);
        expect(findings.message).toMatch(/^\d+ validator finding\(s\)\.$/u);
        expect(yield* logged).toMatch(/validator: \d+ finding\(s\) on 0 page\(s\), sha256 [0-9a-f]{64}/u);
      })
    );

    it.effect(
      "statement warns that no round guards a set and refuses a PDF that no longer matches its manifest",
      Effect.fnUntraced(function* () {
        const set = yield* writeSheetSet({ figures: true, stale: true });
        const error = yield* Effect.flip(runDrawings(["statement", "--manifest", set.manifest]));
        assertInstanceOf(error, DrawingsCommandError);
        expect(error.message).toContain(`"${set.pdf}" no longer matches its manifest`);
        expect(yield* logged).toContain(`warning: no review/ directory in "${set.dir}" or any directory above it`);
      })
    );

    it.effect(
      "sign pdf refuses a sheet set that records no approver",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const set = yield* writeSheetSet({ figures: true, stale: false });
        const reviewDir = yield* fs.makeTempDirectoryScoped();
        const message = yield* failureMessage([
          "sign",
          "pdf",
          "--manifest",
          set.manifest,
          "--by",
          "operator",
          "--pdf",
          set.pdf,
          "--page",
          "1",
          "--attested-by",
          "operator",
          "--delivered-by",
          "approver@example.test",
          "--corpus-root",
          set.dir,
          "--review-dir",
          reviewDir,
        ]);
        expect(message).toBe(
          "Approval refused: the sheet set records no approver. Add `approver` to the spec and render again."
        );
      })
    );

    it.effect(
      "judge builds a pack for a set without sheets and judge-ingest stores the judge's reply",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const set = yield* writeSheetSet({ figures: false, stale: false });
        const photos = path.join(set.dir, "photos-in");
        yield* fs.makeDirectory(photos);
        yield* fs.writeFileString(path.join(photos, "article.jpg"), "jpeg");
        yield* runDrawings(["judge", "--manifest", set.manifest, "--photos", photos]);
        const packDir = path.join(set.dir, "judge", "round-1");
        const reply = path.join(set.dir, "reply.json");
        yield* fs.writeFileString(reply, yield* encodeJson(judgeReply));
        yield* runDrawings(["judge-ingest", "--pack", packDir, "--reply", reply]);
        const output = yield* logged;
        expect(output).toContain(`judge pack: ${packDir}\n  0 sheet(s), 1 reference photo(s)\n`);
        expect(output).toContain(
          "inventory: 1 finding(s), REQUIRED FINDINGS: 1\n  R1-01 P1 [orientation] The reference photo shows the tab folded down"
        );
        expect(yield* fs.exists(path.join(packDir, "inventory.json"))).toBe(true);

        const unreadable = path.join(set.dir, "unreadable.json");
        yield* fs.writeFileString(unreadable, "{}");
        expect(yield* failureMessage(["judge", "--manifest", unreadable])).toContain(
          `Could not read the render manifest "${unreadable}".`
        );
      })
    );

    it.effect(
      "review routes refuse a round below one, and deliver refuses an empty message id",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const set = yield* writeSheetSet({ figures: true, stale: false });
        const round = ["--corpus-root", set.dir, "--matter", set.dir, "--round", "0"];
        const dispositions = path.join(set.dir, "dispositions.json");
        yield* fs.writeFileString(dispositions, "{}");
        const refusals = yield* Effect.forEach(
          [
            ["review", "status", ...round],
            ["review", "plan", ...round, "--dispositions", dispositions],
            ["review", "ingest", ...round, "--manifest", set.manifest, "--pdf", set.pdf],
          ],
          failureMessage
        );
        deepStrictEqual(refusals, A.replicate("Round 0 is not a valid round.", 3));

        const draft = path.join(set.dir, "draft.json");
        yield* fs.writeFileString(draft, "{}");
        expect(
          yield* failureMessage([
            "deliver",
            "record",
            "--manifest",
            set.manifest,
            "--draft",
            draft,
            "--sent-message-id",
            "",
          ])
        ).toBe("The delivery flags are not valid.");
      })
    );

    it.effect(
      "critics pack, run, and summary check their inputs before any reviewer runs",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* fs.makeTempDirectoryScoped();
        const manifest = path.join(dir, "manifest.json");
        const brief = path.join(dir, "BRIEF.md");
        yield* fs.writeFileString(manifest, "{}");
        yield* fs.writeFileString(brief, "# Brief\n");
        const pack = ["critics", "pack", "--manifest", manifest, "--out", path.join(dir, "pack"), "--brief", brief];
        expect(yield* failureMessage([...pack, "--zoom", "fig-1"])).toBe('"fig-1" is not fig:x,y,width,height:label.');
        expect(yield* failureMessage([...pack, "--zoom", "1:10,20,300,200:tab"])).toContain(
          `Could not decode the render manifest "${manifest}".`
        );

        const packDir = path.join(dir, "empty-pack");
        yield* fs.makeDirectory(packDir);
        const run = ["critics", "run", "--pack", packDir, "--loop-dir", path.join(dir, "loop-1")];
        expect(yield* failureMessage([...run, "--reviewers", "nobody"])).toContain('"nobody" is not a known reviewer');
        expect(yield* failureMessage([...run, "--reviewers", "grok-4.7", "--loop", "0"])).toBe(
          "The critic run flags do not form a run request; --loop and --timeout-minutes must be at least 1."
        );
        expect(yield* failureMessage([...run, "--reviewers", "grok-4.7"])).toContain(
          `"${packDir}" holds no readable pack.json; build the pack first.`
        );

        const loopDir = path.join(dir, "loop-0");
        yield* fs.makeDirectory(loopDir);
        yield* runDrawings(["critics", "summary", "--loop-dir", loopDir]);
        expect(yield* logged).toContain("# Findings already reported in this loop");
      })
    );
  });
});
