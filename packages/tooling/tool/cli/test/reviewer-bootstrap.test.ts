import { it } from "@beep/test-runner";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const encodeString = S.String.pipe(S.fromJsonString, S.encodeEffect);
const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeCrypto.layer, NodeFileSystem.layer, NodePath.layer))
);
const bootstrapUrl = new URL("../scripts/CreateReviewerApp.ts", import.meta.url).href;

// The spawned Bun process must execute real fixture files; MemoryFileSystem cannot provide them.
it.layer(PlatformLayer, { timeout: "30 seconds" })("reviewer manifest bootstrap", (it) => {
  for (const writeExit of [0, 17]) {
    it.effect(`passes the complete template through a real pipe and handles write exit ${writeExit}`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "reviewer-bootstrap-test-" });
        // A large public placeholder catches both missing input and incomplete flushing.
        // No real key, credentials, conversion, or vault mutation is involved.
        yield* fs.writeFileString(
          path.join(directory, "op"),
          `#!/usr/bin/env bun
import { fstatSync } from "node:fs";
if (!fstatSync(0).isFIFO()) process.exit(80);
const input = JSON.parse(await new Response(Bun.stdin.stream()).text());
if (input.category !== "API_CREDENTIAL" || input.title !== "beep-reviewer GitHub App") process.exit(81);
if (input.fields.length !== 4) process.exit(82);
if (input.fields.find(field => field.id === "private_key")?.value !== "placeholder-only".repeat(4096)) process.exit(83);
if (process.argv.slice(2).join(" ") !== "item create --vault BEEP_SECRETS -") process.exit(84);
process.exit(${writeExit});
`
        );
        yield* fs.chmod(path.join(directory, "op"), 0o700);
        yield* fs.writeFileString(path.join(directory, "op-doctor"), "#!/bin/sh\nexit 0\n");
        yield* fs.chmod(path.join(directory, "op-doctor"), 0o700);
        const moduleUrl = yield* encodeString(bootstrapUrl);
        const searchPath = yield* Config.String("PATH");
        const harness = `
globalThis.fetch = async () => new Response(JSON.stringify({
  id: 123, client_id: "fixture-client", pem: "placeholder-only".repeat(4096)
}), { status: 201, headers: { "content-type": "application/json" } });
Bun.serve = options => {
  queueMicrotask(async () => {
    try {
      const page = await options.fetch(new Request("http://localhost:8787/"));
      const state = (await page.text()).match(/state=([^"&]+)/)?.[1];
      if (!state) process.exit(85);
      const callback = await options.fetch(new Request("http://localhost:8787/callback?code=fixture-code&state=" + state));
      const text = await callback.text();
      if (callback.status !== ${writeExit === 0 ? 200 : 500}) process.exit(86);
      if (text.includes("placeholder-only") || text.includes("fixture-client")) process.exit(87);
      const replay = await options.fetch(new Request("http://localhost:8787/callback?code=fixture-code&state=" + state));
      if (replay.status !== 400) process.exit(88);
      process.exit(0);
    } catch { process.exit(89); }
  });
  return { port: 8787 };
};
await import(${moduleUrl});
`;
        const handle = yield* ChildProcess.make("bun", ["--eval", harness], {
          env: { PATH: `${directory}:${searchPath}` },
          extendEnv: false,
          stdout: "pipe",
          stderr: "pipe",
        });
        const [stdout, stderr, exitCode] = yield* Effect.all(
          [
            handle.stdout.pipe(Stream.decodeText, Stream.mkString),
            handle.stderr.pipe(Stream.decodeText, Stream.mkString),
            handle.exitCode,
          ],
          { concurrency: 3 }
        );
        expect(exitCode).toBe(0);
        expect(stdout).not.toContain("placeholder-only");
        expect(stderr).not.toContain("placeholder-only");
        if (writeExit !== 0) expect(stderr).toContain("1Password item creation exited 17");
      })
    );
  }
});
