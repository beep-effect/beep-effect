import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { GitHubAppMint, gitHubAppMintLayer, makeGitHubAppMintHandler } from "@beep/repo-cli/commands/Github";
import { gitHubAppManifestPath } from "@beep/repo-configs/PolicyData";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { GitHubAppName } from "@beep/repo-configs/PolicyData";

// The callback outcomes github-app-mint.test.ts leaves out: refused or failed conversions, a
// conversion without a slug, a defect while diagnosing, and unreadable manifests. No child
// process runs; the vault write and op-doctor are scripted.

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const CALLBACK = "http://localhost:8787/callback?code=fixture-code&state=fixture-state";

const respond = (status: number, body: unknown) =>
  Effect.map(encodeJson(body), (text) =>
    HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(text, { status, headers: { "content-type": "application/json" } })
        )
      )
    )
  );

const unreachable = HttpClient.make((request) =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ request, description: "injected outage" }),
    })
  )
);

const callback = Effect.fn("GitHubAppMintOutcomesTest.callback")(function* (
  app: GitHubAppName,
  client: HttpClient.HttpClient,
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]
) {
  const handler = yield* makeGitHubAppMintHandler({ app, nonce: "fixture-state", manifestJson: "{}" });
  const response = yield* handler.pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(new Request(CALLBACK))),
    Effect.provideService(HttpClient.HttpClient, client),
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
  );
  const web = HttpServerResponse.toWeb(response);
  const text = yield* Effect.promise(() => web.text());
  return { status: web.status, text };
});

const scripted = (exit: number) =>
  ChildProcessSpawner.ChildProcessSpawner.use(Effect.succeed).pipe(
    provideSpawner(ScriptedSpawner.make(() => ({ exit })))
  );

const errorsSince = (before: number) => Effect.map(TestConsole.errorLines, A.drop(before));
const errorCount = Effect.map(TestConsole.errorLines, A.length);

const conversion = { id: 123, client_id: "fixture-client", pem: "placeholder-only" };

it.layer(NodeServices.layer, { timeout: "30 seconds" })("github app mint callback outcomes", (it) => {
  it.effect(
    "reviewer reports a refused conversion and a failed one with the same safe page",
    Effect.fnUntraced(function* () {
      const errorsBefore = yield* errorCount;
      const spawner = yield* scripted(0);
      const refusing = yield* respond(422, {});
      const refused = yield* callback("beep-reviewer", refusing, spawner);
      const failed = yield* callback("beep-reviewer", unreachable, spawner);
      expect(refused.status).toBe(500);
      expect(failed).toEqual({ status: 500, text: refused.text });
      expect(refused.text).toContain("Conversion or vault write failed.");
      const reported = yield* errorsSince(errorsBefore);
      expect(reported).toEqual(["[reviewer-bootstrap] Manifest conversion returned HTTP 422."]);
    })
  );

  it.effect(
    "knowledge mint stores nothing for a conversion without a slug or a failed conversion",
    Effect.fnUntraced(function* () {
      const errorsBefore = yield* errorCount;
      const spawner = yield* scripted(0);
      const converting = yield* respond(201, conversion);
      const unslugged = yield* callback("beep-knowledge-mint", converting, spawner);
      const failed = yield* callback("beep-knowledge-mint", unreachable, spawner);
      expect(unslugged.status).toBe(500);
      expect(unslugged.text).toContain("Do not reload this page.");
      expect(failed).toEqual(unslugged);
      const reported = yield* errorsSince(errorsBefore);
      expect(reported).toEqual([
        "[knowledge-mint] Conversion or vault write failed; diagnostics suppressed. Do not reload the callback.",
        "[knowledge-mint] Conversion or vault write failed; diagnostics suppressed. Do not reload the callback.",
      ]);
    })
  );

  it.effect(
    "turns a defect while diagnosing a failed vault write into a generic failure page",
    Effect.fnUntraced(function* () {
      const store = yield* scripted(17);
      // The vault write exits 17; op-doctor then dies instead of failing, which `Effect.ignore` passes on.
      // Own double: decorates the scripted store, dying only on the `op-doctor` spawn (a defect, which
      // `ScriptedSpawner` cannot script).
      // biome-ignore lint/plugin/no-unrecorded-spawner-double: Own double, reason above
      const spawner = ChildProcessSpawner.make((command) =>
        ChildProcess.isStandardCommand(command) && command.command === "op-doctor"
          ? Effect.die("injected op-doctor defect")
          : store.spawn(command)
      );
      const converting = yield* respond(201, conversion);
      const page = yield* callback("beep-reviewer", converting, spawner);
      expect(page).toEqual({ status: 500, text: "Registration failed; secret diagnostics suppressed." });
    })
  );
});

const ownerLayer = (owner: string) =>
  gitHubAppMintLayer(owner).pipe(
    Layer.provide(
      Layer.mergeAll(
        SecureRandom.layerWebCrypto,
        ScriptedSpawner.make(() => ({ exit: 0 })).layer,
        Layer.succeed(HttpClient.HttpClient, unreachable)
      )
    )
  );

it.layer(NodeServices.layer, { timeout: "30 seconds" })("github app mint manifest errors", (it) => {
  it.effect(
    "names the manifest path when it is missing or invalid",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const owner = yield* fs.makeTempDirectoryScoped({ prefix: "github-app-mint-owner-" });
      const manifest = path.join(owner, gitHubAppManifestPath("beep-reviewer"));
      // The service reads the owner directory this body creates, so it is built here rather than by it.layer.
      const mint = yield* Layer.build(ownerLayer(owner)).pipe(Effect.map(Context.get(GitHubAppMint)));
      const read = Effect.flip(mint.manifestText("beep-reviewer"));
      const missing = yield* read;
      expect(missing).toMatchObject({
        _tag: "GithubCommandError",
        path: manifest,
        message: "Cannot read the App manifest.",
      });
      yield* fs.makeDirectory(path.dirname(manifest), { recursive: true });
      yield* fs.writeFileString(manifest, '{"name": 1}\n');
      const invalid = yield* read;
      expect(invalid).toMatchObject({ _tag: "GithubCommandError", path: manifest, message: "Invalid App manifest." });
    })
  );
});
