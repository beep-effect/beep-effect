import { DrawingsCommandError, drawingsCommand, renderManifestSummary } from "@beep/repo-cli/commands/Drawings";
import {
  BoundingBox,
  Camera,
  EngineInfo,
  FigureRecord,
  ModelSummary,
  RenderManifest,
  SheetOptions,
} from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import { Command } from "effect/cli";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as TestConsole from "effect/testing/TestConsole";

// Command-level coverage that needs no native PDF tools: every case fails or
// prints before a tool would run, so it holds on hosted runners too.
const runDrawings = Command.runWith(drawingsCommand, { version: "0.0.0" });
const TestLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);

const logged = TestConsole.logLines.pipe(Effect.map((lines) => lines.join("\n")));

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
      expect(renderManifestSummary({ manifest: manifestWith(O.some(requested)), requested })).toContain(
        "sheet: letter, margins cfr-cm"
      );
      // manifests rendered before the sheet was recorded print no sheet line
      expect(
        A.filter(renderManifestSummary({ manifest: manifestWith(O.none()), requested }), (line) =>
          line.startsWith("sheet:")
        )
      ).toEqual([]);
    })
  );
});

describe("beep drawings command", () => {
  it.layer(TestLayer, { timeout: "60 seconds" })((it) => {
    it.effect(
      "lists its subcommands, and the sign group lists its routes",
      Effect.fnUntraced(function* () {
        yield* runDrawings([]);
        yield* runDrawings(["sign"]);
        const output = yield* logged;
        expect(output).toContain("drawings commands: render, validate, judge, judge-ingest, statement, sign");
        expect(output).toContain("drawings sign commands: email, pdf");
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
