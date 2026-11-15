import { GitHubAppMint, gitHubAppMintLayer, makeGitHubAppMintHandler } from "@beep/repo-cli/commands/Github";
import { gitHubAppManifestPath } from "@beep/repo-configs/PolicyData";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const UnknownJson = S.fromJsonString(S.Unknown);
const encodeUnknownJson = S.encodeUnknownEffect(UnknownJson);
const PLACEHOLDER = Str.repeat(4096)("placeholder-only");
const textEncoder = new TextEncoder();

// SHA-256 of each manifest as `scripts/github-app/<app>.manifest.json` held it before the move
// into repo-configs policy data; `--dry-run` must keep reproducing these bytes exactly.
const ORIGINAL_MANIFEST_SHA256 = {
  "beep-reviewer": "8d33e82f78e2d341a70b096193079a3dd230bee5cce78163785ddb1da66cc18c",
  "beep-knowledge-mint": "921bbec705af05189744d649c0675db61b8216a574b4501347d3850168629cbf",
  // Added in repo-configs directly (no scripts/ predecessor): the checked-in bytes at registration.
  "beep-infra-github": "3cbdc34b0d235c8d9e47e09e5c22cd8f44ef94414dcf3676fed0aa91ba606195",
} as const;

// A fake `op` that accepts only a real pipe carrying the complete template.
// No real key, conversion, or vault mutation is involved.
const fakeOp = (exitCode: number, title: string, fieldCount: number, slugCheck: string) => `#!/usr/bin/env bun
import { fstatSync } from "node:fs";
if (!fstatSync(0).isFIFO()) process.exit(80);
const input = JSON.parse(await new Response(Bun.stdin.stream()).text());
if (input.category !== "API_CREDENTIAL" || input.title !== "${title}") process.exit(81);
const field = (id) => input.fields.find((entry) => entry.id === id);
if (input.fields.length !== ${fieldCount}) process.exit(82);
if (field("private_key")?.type !== "CONCEALED" || field("private_key")?.value !== "${PLACEHOLDER}") process.exit(83);
${slugCheck}
if (field("client_id")?.value !== "fixture-client") process.exit(84);
if (field("app_id")?.value !== "123" || field("installation_id")?.value !== "") process.exit(85);
if (process.argv.slice(2).join(" ") !== "item create --vault BEEP_SECRETS -") process.exit(86);
process.exit(${exitCode});
`;

const appCases = {
  "beep-reviewer": {
    title: "beep-reviewer GitHub App",
    fieldCount: 4,
    slug: "beep-reviewer",
    slugCheck: 'if (field("slug") !== undefined) process.exit(87);',
  },
  "beep-knowledge-mint": {
    title: "beep-knowledge-mint GitHub App",
    fieldCount: 5,
    slug: "beep-knowledge-mint-2",
    slugCheck: 'if (field("slug")?.value !== "beep-knowledge-mint-2") process.exit(87);',
  },
  "beep-infra-github": {
    title: "beep-infra-github GitHub App",
    fieldCount: 5,
    slug: "beep-infra-github-3",
    slugCheck: 'if (field("slug")?.value !== "beep-infra-github-3") process.exit(87);',
  },
} as const;

type App = keyof typeof appCases;

// Fake op and op-doctor on PATH; the spawner wrapper hands that PATH to every child.
const harness = Effect.fn("GitHubAppMintTest.harness")(function* (app: App, opExit: number, conversionStatus: number) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ambientPath = yield* Config.String("PATH");
  const bin = yield* fs.makeTempDirectoryScoped({ prefix: "github-app-mint-test-" });
  const doctorLog = path.join(bin, "op-doctor.log");
  const { title, fieldCount, slug, slugCheck } = appCases[app];
  yield* fs.writeFileString(path.join(bin, "op"), fakeOp(opExit, title, fieldCount, slugCheck));
  yield* fs.chmod(path.join(bin, "op"), 0o700);
  yield* fs.writeFileString(path.join(bin, "op-doctor"), `#!/bin/sh\necho ran >> "${doctorLog}"\n`);
  yield* fs.chmod(path.join(bin, "op-doctor"), 0o700);
  const base = yield* ChildProcessSpawner.ChildProcessSpawner;
  // Own double: decorates the real platform spawner, putting the fixture `op` / `op-doctor` scripts on PATH.
  // biome-ignore lint/plugin/no-unrecorded-spawner-double: Own double, reason above
  const spawner = ChildProcessSpawner.make((command) =>
    base.spawn(ChildProcess.setEnv(command, { PATH: `${bin}:${ambientPath}` }))
  );
  const conversion = yield* encodeUnknownJson({
    id: 123,
    slug,
    client_id: "fixture-client",
    pem: PLACEHOLDER,
  });
  const client = HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(conversion, { status: conversionStatus, headers: { "content-type": "application/json" } })
      )
    )
  );
  const handler = yield* makeGitHubAppMintHandler({ app, nonce: "fixture-state", manifestJson: '{"name":"x"}' });
  const get = Effect.fn("GitHubAppMintTest.get")(function* (url: string) {
    const response = yield* handler.pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(new Request(url))),
      Effect.provideService(HttpClient.HttpClient, client),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
    );
    const web = HttpServerResponse.toWeb(response);
    const text = yield* Effect.promise(() => web.text());
    return { status: web.status, text };
  });
  const doctorRuns = fs.readFileString(doctorLog).pipe(
    Effect.map((log) => A.length(Str.split("ran")(log)) - 1),
    Effect.orElseSucceed(() => 0)
  );
  return { get, doctorRuns };
});

const register = Effect.fn("GitHubAppMintTest.register")(function* (
  app: App,
  opExit: number,
  conversionStatus: number
) {
  // The console layer is shared across this suite, so only lines written by this case count.
  const logsBefore = yield* Effect.map(TestConsole.logLines, A.length);
  const errorsBefore = yield* Effect.map(TestConsole.errorLines, A.length);
  const { get, doctorRuns } = yield* harness(app, opExit, conversionStatus);
  const foreign = yield* get("http://evil.example:8787/");
  expect(foreign.status).toBe(400);
  const form = yield* get("http://localhost:8787/");
  expect(form.text).toContain("organizations/beep-effect/settings/apps/new?state=fixture-state");
  expect(form.text).toContain(`<button>Create ${app} in beep-effect</button>`);
  expect(form.text).toContain('value="{&quot;name&quot;:&quot;x&quot;}"');
  const wrongState = yield* get("http://localhost:8787/callback?code=fixture-code&state=wrong");
  expect(wrongState.status).toBe(400);
  const callback = yield* get("http://127.0.0.1:8787/callback?code=fixture-code&state=fixture-state");
  expect(callback.text).not.toContain("placeholder-only");
  expect(callback.text).not.toContain("fixture-client");
  const replay = yield* get("http://localhost:8787/callback?code=fixture-code&state=fixture-state");
  expect(replay.status).toBe(400);
  const render = (lines: ReadonlyArray<unknown>, before: number) => A.join(A.map(A.drop(lines, before), String), "\n");
  const logs = yield* Effect.map(TestConsole.logLines, (lines) => render(lines, logsBefore));
  const errors = yield* Effect.map(TestConsole.errorLines, (lines) => render(lines, errorsBefore));
  expect(`${logs}${errors}`).not.toContain("placeholder-only");
  const runs = yield* doctorRuns;
  return { callback, logs, errors, doctorRuns: runs };
}, Effect.scoped);

it.layer(Layer.mergeAll(NodeServices.layer, TestConsole.layer), { timeout: "30 seconds" })(
  "github app mint registration",
  (it) => {
    it.effect("reviewer stores the four-field template through a real pipe", () =>
      Effect.gen(function* () {
        const { callback, errors, doctorRuns } = yield* register("beep-reviewer", 0, 201);
        expect(callback.status).toBe(200);
        expect(callback.text).toContain("Stored in 1Password. Stop this server");
        expect(errors).toBe("");
        expect(doctorRuns).toBe(0);
      })
    );

    it.effect("reviewer reports a failed vault write and diagnoses once", () =>
      Effect.gen(function* () {
        const { callback, errors, doctorRuns } = yield* register("beep-reviewer", 17, 201);
        expect(callback.status).toBe(500);
        expect(callback.text).toContain("Conversion or vault write failed.");
        expect(errors).toContain("1Password item creation exited 17; secret diagnostics suppressed.");
        expect(doctorRuns).toBe(1);
      })
    );

    it.effect("knowledge mint stores the slugged template and reports only the slug", () =>
      Effect.gen(function* () {
        const { callback, logs, doctorRuns } = yield* register("beep-knowledge-mint", 0, 201);
        expect(callback.status).toBe(200);
        expect(callback.text).toContain('Stored in 1Password as "beep-knowledge-mint GitHub App"');
        expect(logs).toContain("App beep-knowledge-mint-2 (app_id 123)");
        expect(doctorRuns).toBe(0);
      })
    );

    it.effect("knowledge mint reports a failed vault write by exit code and forbids a reload", () =>
      Effect.gen(function* () {
        const { callback, errors, doctorRuns } = yield* register("beep-knowledge-mint", 17, 201);
        expect(callback.status).toBe(500);
        expect(callback.text).toContain("Do not reload this page");
        expect(errors).toContain("1Password item creation exited 17");
        expect(doctorRuns).toBe(1);
      })
    );

    it.effect("infra-github mint stores its own slugged template and reports only the slug", () =>
      Effect.gen(function* () {
        const { callback, logs, doctorRuns } = yield* register("beep-infra-github", 0, 201);
        expect(callback.status).toBe(200);
        expect(callback.text).toContain('Stored in 1Password as "beep-infra-github GitHub App"');
        expect(logs).toContain('[infra-github] Stored "beep-infra-github GitHub App"');
        expect(logs).toContain("App beep-infra-github-3 (app_id 123)");
        expect(doctorRuns).toBe(0);
      })
    );

    it.effect("infra-github mint reports a failed vault write by exit code and forbids a reload", () =>
      Effect.gen(function* () {
        const { callback, errors, doctorRuns } = yield* register("beep-infra-github", 17, 201);
        expect(callback.status).toBe(500);
        expect(callback.text).toContain("Do not reload this page");
        expect(errors).toContain("1Password item creation exited 17");
        expect(doctorRuns).toBe(1);
      })
    );

    it.effect("knowledge mint stores nothing when the manifest conversion is refused", () =>
      Effect.gen(function* () {
        const { callback, errors, doctorRuns } = yield* register("beep-knowledge-mint", 99, 422);
        expect(callback.status).toBe(500);
        expect(callback.text).toContain("returned HTTP 422");
        expect(errors).toContain("Manifest conversion returned HTTP 422; nothing was stored.");
        expect(doctorRuns).toBe(0);
      })
    );
  }
);

// The checkout itself is the owner: the dry run must read the committed policy data.
const DryRunLayer = Layer.unwrap(
  Effect.map(
    Path.Path.use((path) => path.fromFileUrl(new URL("../../../../../", import.meta.url))),
    gitHubAppMintLayer
  )
).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      NodeServices.layer,
      Digest.layerWebCrypto,
      SecureRandom.layerWebCrypto,
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make(() => Effect.never)
      )
    )
  )
);

it.layer(DryRunLayer, { timeout: "30 seconds" })("github app mint dry run", (it) => {
  for (const app of ["beep-reviewer", "beep-knowledge-mint", "beep-infra-github"] as const) {
    it.effect(`prints the ${app} manifest byte for byte`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const owner = yield* path.fromFileUrl(new URL("../../../../../", import.meta.url));
        const digest = yield* Digest.Digest;
        const text = yield* GitHubAppMint.use((mint) => mint.manifestText(app));
        const checkedIn = yield* fs.readFileString(path.join(owner, gitHubAppManifestPath(app)));
        const hash = yield* digest.digestHex(Digest.sha256, textEncoder.encode(text));
        expect(text).toBe(checkedIn);
        expect(hash).toBe(ORIGINAL_MANIFEST_SHA256[app]);
      })
    );
  }
});
