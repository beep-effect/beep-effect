import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Stream from "effect/Stream";

const bootstrapUrl = new URL("../scripts/CreateKnowledgeMintApp.ts", import.meta.url).href;
const PLACEHOLDER = "placeholder-only".repeat(4096);

// A fake `op` that accepts only a real pipe carrying the complete template.
// No real key, conversion, or vault mutation is involved.
const fakeOp = (exitCode: number) => `#!/usr/bin/env bun
import { fstatSync } from "node:fs";
if (!fstatSync(0).isFIFO()) process.exit(80);
const input = JSON.parse(await new Response(Bun.stdin.stream()).text());
if (input.category !== "API_CREDENTIAL" || input.title !== "beep-knowledge-mint GitHub App") process.exit(81);
const field = (id) => input.fields.find((entry) => entry.id === id);
if (input.fields.length !== 5) process.exit(82);
if (field("private_key")?.type !== "CONCEALED" || field("private_key")?.value !== "${PLACEHOLDER}") process.exit(83);
if (field("slug")?.value !== "beep-knowledge-mint-2" || field("client_id")?.value !== "fixture-client") process.exit(84);
if (field("app_id")?.value !== "123" || field("installation_id")?.value !== "") process.exit(85);
if (process.argv.slice(2).join(" ") !== "item create --vault BEEP_SECRETS -") process.exit(86);
process.exit(${exitCode});
`;

const harness = (conversionStatus: number, expectedStatus: number, expectedText: string) => `
globalThis.fetch = async () => new Response(JSON.stringify({
  id: 123, slug: "beep-knowledge-mint-2", client_id: "fixture-client", pem: "${PLACEHOLDER}"
}), { status: ${conversionStatus}, headers: { "content-type": "application/json" } });
const { makeKnowledgeMintHandler } = await import(${JSON.stringify(bootstrapUrl)});
const handle = makeKnowledgeMintHandler("fixture-state", JSON.stringify({ name: "beep-knowledge-mint" }));
const get = (url) => handle(new Request(url));
if ((await get("http://evil.example:8787/")).status !== 400) process.exit(90);
const form = await (await get("http://localhost:8787/")).text();
if (!form.includes("organizations/beep-effect/settings/apps/new?state=fixture-state")) process.exit(91);
if ((await get("http://localhost:8787/callback?code=fixture-code&state=wrong")).status !== 400) process.exit(92);
const callback = await get("http://127.0.0.1:8787/callback?code=fixture-code&state=fixture-state");
const text = await callback.text();
if (callback.status !== ${expectedStatus}) process.exit(93);
if (!text.includes(${JSON.stringify(expectedText)})) process.exit(94);
if (text.includes("placeholder-only") || text.includes("fixture-client")) process.exit(95);
if ((await get("http://localhost:8787/callback?code=fixture-code&state=fixture-state")).status !== 400) process.exit(96);
process.exit(0);
`;

// Runs the handler in a Bun child: the bootstrap uses Bun.spawn, and the fake op on PATH
// fails unless its stdin is a real pipe carrying the complete template.
const run = Effect.fn("KnowledgeMintBootstrapTest.run")(function* (
  opExit: number,
  conversionStatus: number,
  expectedStatus: number,
  expectedText: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ambientPath = yield* Config.String("PATH");
  const bin = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-mint-bootstrap-test-" });
  yield* fs.writeFileString(path.join(bin, "op"), fakeOp(opExit));
  yield* fs.chmod(path.join(bin, "op"), 0o700);
  // A fake op-doctor that marks its one call, so the failure path proves it diagnosed once.
  yield* fs.writeFileString(path.join(bin, "op-doctor"), "#!/bin/sh\necho op-doctor-ran\n");
  yield* fs.chmod(path.join(bin, "op-doctor"), 0o700);
  const handle = yield* ChildProcess.make("bun", ["--eval", harness(conversionStatus, expectedStatus, expectedText)], {
    env: { PATH: `${bin}:${ambientPath}` },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [code, stdout, stderr] = yield* Effect.all(
    [
      handle.exitCode,
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
    ],
    { concurrency: "unbounded" }
  );
  expect(code).toBe(0);
  expect(`${stdout}${stderr}`).not.toContain("placeholder-only");
  return { stdout, stderr };
}, Effect.scoped);

it.layer(NodeServices.layer, { timeout: "30 seconds" })("knowledge mint manifest bootstrap", (it) => {
  it.effect("stores the full template through a real pipe and reports only the slug", () =>
    Effect.gen(function* () {
      const { stdout } = yield* run(0, 201, 200, "Stored in 1Password");
      expect(stdout).toContain("App beep-knowledge-mint-2 (app_id 123)");
      expect(stdout).not.toContain("op-doctor-ran");
    })
  );

  it.effect("reports a failed vault write by exit code and forbids a reload", () =>
    Effect.gen(function* () {
      const { stdout, stderr } = yield* run(17, 201, 500, "Do not reload this page");
      expect(stderr).toContain("1Password item creation exited 17");
      expect(stdout.split("op-doctor-ran").length - 1).toBe(1);
    })
  );

  it.effect("stores nothing when the manifest conversion is refused", () =>
    Effect.gen(function* () {
      const { stderr } = yield* run(99, 422, 500, "returned HTTP 422");
      expect(stderr).toContain("Manifest conversion returned HTTP 422; nothing was stored.");
    })
  );
});
