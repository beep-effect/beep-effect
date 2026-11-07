import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { githubCommand } from "@beep/repo-cli/commands/Github";
import { gitHubAppManifestPath } from "@beep/repo-configs/PolicyData";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as TestConsole from "effect/testing/TestConsole";
import { vi } from "vitest";

// `beep github app mint` through its command value, with the Bun loopback server replaced: the
// suite never binds port 8787. `server.fail` selects a refused bind or a server that accepts.
const server = vi.hoisted(() => ({ fail: true, options: [] as Array<unknown> }));
vi.mock("@effect/platform-bun/BunHttpServer", () =>
  Promise.all([
    import("effect/Effect"),
    import("effect/http/HttpServer"),
    import("effect/http/HttpServerError"),
    import("effect/Layer"),
    import("effect/net/NetAddress"),
  ]).then(([Effect, HttpServer, HttpServerError, Layer, NetAddress]) => ({
    layer: (options: unknown) => {
      server.options.push(options);
      return server.fail
        ? Layer.effect(
            HttpServer.HttpServer,
            Effect.fail(new HttpServerError.ServeError({ cause: new Error("EADDRINUSE: injected") }))
          )
        : Layer.succeed(
            HttpServer.HttpServer,
            HttpServer.make({
              serve: () => Effect.void,
              address: NetAddress.inetAddressUnsafe(NetAddress.ipv4Loopback, 8787),
            })
          );
    },
  }))
);

const runGithub = Command.runWith(githubCommand, { version: "0.0.0" });

const services = Layer.mergeAll(
  NodeServices.layer,
  SecureRandom.layerWebCrypto,
  ScriptedSpawner.make(() => ({ exit: 0 })).layer,
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() => Effect.never)
  )
);

const LISTENING =
  "Open http://localhost:8787 as kriegcloud. The callback never displays credentials. Ctrl-C stops the server.";

it.layer(services, { timeout: "30 seconds" })("github app mint command", (it) => {
  it.effect(
    "prints the group help lines and the dry-run manifest byte for byte",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* findRepoRoot();
      const written = yield* Ref.make("");
      const stdio = Stdio.make({
        args: Effect.succeed([]),
        stdin: Stream.empty,
        stdout: () => Sink.forEach((chunk: string | Uint8Array) => Ref.update(written, (text) => `${text}${chunk}`)),
        stderr: () => Sink.drain,
      });
      yield* runGithub([]);
      yield* runGithub(["app"]);
      yield* runGithub(["app", "mint", "beep-knowledge-mint", "--dry-run"]).pipe(
        Effect.provideService(Stdio.Stdio, stdio)
      );
      const logged = yield* Effect.map(TestConsole.logLines, A.map(String));
      const printed = yield* Ref.get(written);
      const checkedIn = yield* fs.readFileString(path.join(root, gitHubAppManifestPath("beep-knowledge-mint")));
      expect(logged).toContain("github commands: app");
      expect(logged).toContain("github app commands: mint");
      expect(printed).toBe(checkedIn);
    })
  );

  it.effect(
    "fails with the loopback address when the server cannot bind",
    Effect.fnUntraced(function* () {
      server.fail = true;
      const failure = yield* runGithub(["app", "mint", "beep-reviewer"]).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "GithubCommandError",
        path: "127.0.0.1:8787",
        message: "Cannot start the registration server.",
      });
      expect(server.options).toContainEqual({ hostname: "127.0.0.1", port: 8787 });
    })
  );

  it.effect(
    "announces the registration page once the server is up and serves until interrupted",
    Effect.fnUntraced(function* () {
      server.fail = false;
      const fiber = yield* runGithub(["app", "mint", "beep-reviewer"]).pipe(Effect.forkChild);
      const announced = TestConsole.logLines.pipe(Effect.map((lines) => A.contains(A.map(lines, String), LISTENING)));
      yield* Effect.yieldNow.pipe(Effect.andThen(announced), Effect.repeat({ until: (seen) => seen }));
      yield* Fiber.interrupt(fiber);
    })
  );
});
