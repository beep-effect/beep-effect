import { CiBinaryClosure, ciBinaryClosureCommand } from "@beep/repo-cli/commands/Ci/CiBinaryClosure";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";

// beep-ci-binary.yml runs `beep ci binary-closure --out <asset>` with no `--list`. The first main
// pushes after #3145 failed there because `--list` had no default and the CLI required it.

const platform = Layer.mergeAll(FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)), Digest.layerWebCrypto);
const runClosureCommand = Command.runWith(ciBinaryClosureCommand, { version: "0.0.0" });
const decodeClosureJson = S.decodeEffect(S.fromJsonString(CiBinaryClosure));

describe("ci binary-closure command", () => {
  it.layer(platform, { timeout: "60 seconds" })((it) => {
    it.effect("runs the workflow's --out-only invocation and prints the digest it writes", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // The closure's paths are relative to the canonical checkout root the command walked.
        const found = yield* findRepoRoot();
        const root = yield* fs.realPath(found);
        const directory = yield* fs.makeTempDirectoryScoped();
        const out = `${directory}/beep-linux-x64.closure.json`;
        yield* runClosureCommand(["--out", out]);
        const lines = yield* TestConsole.logLines;
        const written = yield* fs.readFileString(out);
        const closure = yield* decodeClosureJson(written);
        expect(closure.entry).toBe("packages/tooling/tool/cli/src/bin-ci.ts");
        expect(closure.digest).toMatch(/^[0-9a-f]{64}$/u);
        expect(lines).toStrictEqual([closure.digest]);
        const entryExists = yield* fs.exists(`${root}/${closure.entry}`);
        expect(entryExists).toBe(true);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
