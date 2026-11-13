import {
  CiBinaryClosure,
  ciBinaryClosureCommand,
  computeCiBinaryClosure,
} from "@beep/repo-cli/commands/Ci/CiBinaryClosure";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
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

    it.effect("prints the digest and then every closure file with --list", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const found = yield* findRepoRoot();
        const root = yield* fs.realPath(found);
        yield* runClosureCommand(["--list"]);
        const lines = yield* TestConsole.logLines;
        const closure = yield* computeCiBinaryClosure(root);
        expect(lines).toStrictEqual([
          closure.digest,
          ...A.map(closure.files, (file) => `${file.sha256}  ${file.path}`),
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports a closure that cannot be written and exits non-zero", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();
        const blocker = yield* fs.realPath(directory);
        yield* fs.writeFileString(`${blocker}/file`, "not a directory\n");
        const out = `${blocker}/file/beep-linux-x64.closure.json`;
        const failure = yield* Effect.flip(runClosureCommand(["--out", out]));
        const errors = yield* TestConsole.errorLines;
        expect(String(failure)).toContain(`Failed to write ${out}.`);
        expect(errors).toStrictEqual([`[ci] Failed to write ${out}.`]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("fails with the root it could not read workspaces from", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped();
        const missing = `${yield* fs.realPath(directory)}/missing`;
        const error = yield* Effect.flip(computeCiBinaryClosure(missing));
        expect(error.message).toBe(`Cannot read the workspaces under ${missing}.`);
      })
    );
  });
});
