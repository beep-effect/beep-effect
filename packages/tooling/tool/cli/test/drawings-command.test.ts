import { DrawingsCommandError, drawingsCommand } from "@beep/repo-cli/commands/Drawings";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path } from "effect";
import { Command } from "effect/cli";
import * as TestConsole from "effect/testing/TestConsole";

// Command-level coverage that needs no native PDF tools: every case fails or
// prints before a tool would run, so it holds on hosted runners too.
const runDrawings = Command.runWith(drawingsCommand, { version: "0.0.0" });
const TestLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);

const logged = TestConsole.logLines.pipe(Effect.map((lines) => lines.join("\n")));

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
