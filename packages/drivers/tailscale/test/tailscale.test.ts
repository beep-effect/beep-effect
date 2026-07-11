import {
  buildTailscaleHttpsBaseUrl,
  disableTailscaleServe,
  ensureTailscaleServe,
  isTailscaleIpv4Address,
  parseTailscaleMagicDnsName,
  parseTailscaleStatus,
  readTailscaleStatus,
  TAILSCALE_STATUS_TIMEOUT,
  TailscaleCommandExitError,
  TailscaleCommandSpawnError,
  TailscaleCommandTimeoutError,
  TailscaleStatus,
  TailscaleStatusParseError,
} from "@beep/tailscale";
import { assert, describe, it, layer } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const encoder = new TextEncoder();
const tailscaleStatusJson = `{"Self":{"DNSName":"desktop.tail.ts.net.","TailscaleIPs":["100.100.100.100","fd7a:115c:a1e0::1","192.168.1.20"]}}`;
const tailscaleStatusWithSingleIpJson = `{"Self":{"DNSName":"desktop.tail.ts.net.","TailscaleIPs":["100.90.1.2"]}}`;

function mockHandle(result: { stdout?: string; stderr?: string; code?: number }) {
  return ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(result.code ?? 0)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(result.stdout ?? "")),
    stderr: Stream.make(encoder.encode(result.stderr ?? "")),
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });
}

function neverFinishingMockHandle() {
  return ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.never,
    isRunning: Effect.succeed(true),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: Stream.empty,
    stderr: Stream.empty,
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });
}

function mockSpawnerLayer(
  handler: (command: string, args: ReadonlyArray<string>) => { stdout?: string; stderr?: string; code?: number }
) {
  return Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) =>
      ChildProcess.isStandardCommand(command)
        ? Effect.succeed(mockHandle(handler(command.command, command.args)))
        : Effect.die("Expected a standard tailscale command")
    )
  );
}

describe("tailscale", () => {
  it.effect("detects Tailnet IPv4 addresses", () =>
    Effect.sync(() => {
      assert.equal(isTailscaleIpv4Address("100.64.0.1"), true);
      assert.equal(isTailscaleIpv4Address("100.127.255.254"), true);
      assert.equal(isTailscaleIpv4Address("100.128.0.1"), false);
      assert.equal(isTailscaleIpv4Address("192.168.1.44"), false);
    })
  );

  it.effect("parses MagicDNS names from tailscale status", () =>
    Effect.gen(function* () {
      const dnsName = yield* parseTailscaleMagicDnsName(tailscaleStatusJson);
      assert.deepEqual(dnsName, O.some("desktop.tail.ts.net"));
      assert.deepEqual(yield* parseTailscaleMagicDnsName("{}"), O.none());
    })
  );

  it.effect("parses status facts", () =>
    Effect.gen(function* () {
      const status = yield* parseTailscaleStatus(tailscaleStatusJson);
      assert.deepEqual(
        status,
        TailscaleStatus.make({
          magicDnsName: O.some("desktop.tail.ts.net"),
          tailnetIpv4Addresses: ["100.100.100.100"],
        })
      );
    })
  );

  it.effect("preserves status decoding failures without exposing cause text", () =>
    Effect.gen(function* () {
      const error = yield* parseTailscaleStatus("{not-json").pipe(Effect.flip);

      assert.instanceOf(error, TailscaleStatusParseError);
      assert.equal(error.message, "Failed to decode tailscale status JSON.");
      assert.isDefined(error.cause);
      assert.notInclude(error.message, String(error.cause));
    })
  );

  it.effect("builds clean HTTPS base URLs", () =>
    Effect.sync(() => {
      assert.equal(buildTailscaleHttpsBaseUrl({ magicDnsName: "desktop.tail.ts.net" }), "https://desktop.tail.ts.net/");
      assert.equal(
        buildTailscaleHttpsBaseUrl({ magicDnsName: "desktop.tail.ts.net", servePort: 8443 }),
        "https://desktop.tail.ts.net:8443/"
      );
    })
  );

  layer(
    mockSpawnerLayer((command, args) => {
      assert.equal(command, "tailscale");
      assert.deepEqual(args, ["status", "--json"]);
      return {
        stdout: tailscaleStatusWithSingleIpJson,
      };
    })
  )("with a successful tailscale status process", (it) => {
    it.effect("reads tailscale status through the process spawner service", () =>
      Effect.gen(function* () {
        const status = yield* readTailscaleStatus;
        assert.deepEqual(
          status,
          TailscaleStatus.make({
            magicDnsName: O.some("desktop.tail.ts.net"),
            tailnetIpv4Addresses: ["100.90.1.2"],
          })
        );
      })
    );
  });

  const systemCause = new Error("private executable lookup detail");
  const spawnCause = PlatformError.systemError({
    _tag: "NotFound",
    module: "ChildProcess",
    method: "spawn",
    cause: systemCause,
  });
  const SpawnFailureLayer = Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.fail(spawnCause))
  );

  layer(SpawnFailureLayer)("with a failing tailscale process spawn", (it) => {
    it.effect("preserves tailscale spawn failures as causes", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(readTailscaleStatus);

        assert.instanceOf(error, TailscaleCommandSpawnError);
        assert.equal(error.executable, "tailscale");
        assert.equal(error.subcommand, "status");
        assert.equal(error.argumentCount, 2);
        assert.strictEqual(error.cause, spawnCause);
        assert.equal(error.message, "Failed to spawn tailscale status.");
        assert.notInclude(error.message, systemCause.message);
      })
    );
  });

  layer(
    mockSpawnerLayer(() => ({
      code: 7,
      stderr: "not logged in tskey-auth-secret-token-value",
    }))
  )("with a nonzero tailscale status exit", (it) => {
    it.effect("keeps nonzero exit diagnostics structured", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(readTailscaleStatus);

        assert.instanceOf(error, TailscaleCommandExitError);
        assert.equal(error.executable, "tailscale");
        assert.equal(error.subcommand, "status");
        assert.equal(error.argumentCount, 2);
        assert.equal(error.exitCode, 7);
        assert.equal(error.stdoutLength, 0);
        assert.equal(error.stderrLength, 43);
        assert.notProperty(error, "command");
        assert.notProperty(error, "stderr");
        assert.notInclude(error.message, "tskey-auth-secret-token-value");
        assert.equal(error.message, "tailscale status exited with code 7.");
      })
    );
  });

  const StatusTimeoutLayer = Layer.mergeAll(
    TestClock.layer(),
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() => Effect.succeed(neverFinishingMockHandle()))
    )
  );

  layer(StatusTimeoutLayer)("with a non-terminating tailscale status process", (it) => {
    it.effect("times out tailscale status through TestClock", () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.flip(readTailscaleStatus).pipe(Effect.forkScoped);
        yield* Effect.yieldNow;
        yield* TestClock.adjust(TAILSCALE_STATUS_TIMEOUT);
        const error = yield* Fiber.join(fiber);

        assert.instanceOf(error, TailscaleCommandTimeoutError);
        assert.equal(error.executable, "tailscale");
        assert.equal(error.subcommand, "status");
        assert.equal(error.argumentCount, 2);
        assert.equal(error.timeoutMs, 1_500);
        assert.isTrue(Cause.isTimeoutError(error.cause));
        assert.equal(error.message, "tailscale status timed out after 1500ms.");
      })
    );
  });

  layer(
    mockSpawnerLayer((command, args) => {
      assert.equal(command, "tailscale");
      assert.deepEqual(args, ["serve", "--bg", "--https=8443", "http://127.0.0.1:13773"]);
      return {};
    })
  )("with a successful tailscale serve process", (it) => {
    it.effect("configures tailscale serve through the process spawner service", () =>
      ensureTailscaleServe({ localPort: 13773, servePort: 8443 })
    );
  });

  layer(
    mockSpawnerLayer(() => ({
      code: 1,
      stderr: "serve permission denied tskey-auth-secret-token-value",
    }))
  )("with a nonzero tailscale serve exit", (it) => {
    it.effect("retains tailscale serve exit diagnostics", () =>
      Effect.gen(function* () {
        const error = yield* ensureTailscaleServe({ localPort: 13773, servePort: 8443 }).pipe(Effect.flip);

        assert.instanceOf(error, TailscaleCommandExitError);
        assert.equal(error.executable, "tailscale");
        assert.equal(error.subcommand, "serve");
        assert.equal(error.argumentCount, 4);
        assert.equal(error.exitCode, 1);
        assert.equal(error.stderrLength, 53);
        assert.notProperty(error, "command");
        assert.notProperty(error, "stderr");
        assert.notInclude(error.message, "tskey-auth-secret-token-value");
      })
    );
  });

  const commands: Array<{ readonly command: string; readonly args: ReadonlyArray<string> }> = [];
  layer(
    mockSpawnerLayer((command, args) => {
      commands.push({ command, args });
      assert.equal(command, "tailscale");
      assert.deepEqual(args, ["serve", "--https=8443", "off"]);
      return {};
    })
  )("with a successful tailscale serve disable process", (it) => {
    it.effect("disables tailscale serve through the process spawner service", () =>
      Effect.gen(function* () {
        yield* disableTailscaleServe({ servePort: 8443 });
        assert.deepEqual(commands, [{ command: "tailscale", args: ["serve", "--https=8443", "off"] }]);
      })
    );
  });
});
