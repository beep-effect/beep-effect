import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { fcRuns } from "@beep/fc-runs";
import {
  buildTailscaleHttpsBaseUrl,
  disableTailscaleServe,
  ensureTailscaleServe,
  isTailscaleIpv4Address,
  parseTailscaleMagicDnsName,
  parseTailscaleStatus,
  readTailscaleStatus,
  TAILSCALE_STATUS_TIMEOUT,
  TailnetIpv4Address,
  TailscaleCommandExitError,
  TailscaleCommandSpawnError,
  TailscaleCommandTimeoutError,
  TailscaleStatus,
  TailscaleStatusJson,
  TailscaleStatusParseError,
  TailscaleStatusSelf,
} from "@beep/tailscale";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";

const tailscaleStatusJson = `{"Self":{"DNSName":"desktop.tail.ts.net.","TailscaleIPs":["100.100.100.100","fd7a:115c:a1e0::1","192.168.1.20"]}}`;
const tailscaleStatusWithSingleIpJson = `{"Self":{"DNSName":"desktop.tail.ts.net.","TailscaleIPs":["100.90.1.2"]}}`;

/** The one tailscale invocation a scripted spawner saw, with the stdio and kill grace every call runs with. */
const assertTailscaleSpawn = (spawner: ScriptedSpawner, args: ReadonlyArray<string>, stdout: "pipe" | "ignore") => {
  assert.deepEqual(
    A.map(spawner.spawns, (spawn) => [spawn.command, ...spawn.args]),
    [["tailscale", ...args]]
  );
  for (const { options } of spawner.spawns) {
    assert.equal(options.stdin, "ignore");
    assert.equal(options.stdout, stdout);
    assert.equal(options.stderr, "pipe");
    assert.equal(options.forceKillAfter === undefined ? undefined : Duration.toMillis(options.forceKillAfter), 2_000);
  }
};

const encodeTailscaleStatusJson = S.encodeEffect(S.fromJsonString(TailscaleStatusJson));

describe("tailscale", () => {
  it.effect("detects Tailnet IPv4 addresses", () =>
    Effect.sync(() => {
      assert.equal(isTailscaleIpv4Address("100.64.0.1"), true);
      assert.equal(isTailscaleIpv4Address("100.127.255.254"), true);
      assert.equal(isTailscaleIpv4Address("100.128.0.1"), false);
      assert.equal(isTailscaleIpv4Address("192.168.1.44"), false);
    })
  );

  it.effect(
    "parses MagicDNS names from tailscale status",
    Effect.fnUntraced(function* () {
      const dnsName = yield* parseTailscaleMagicDnsName(tailscaleStatusJson);
      assert.deepEqual(dnsName, O.some("desktop.tail.ts.net"));
      const parsedTailscaleMagicDnsName = yield* parseTailscaleMagicDnsName("{}");
      assert.deepEqual(parsedTailscaleMagicDnsName, O.none());
    })
  );

  it.effect(
    "parses status facts",
    Effect.fnUntraced(function* () {
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

  it.effect.prop(
    "retains mixed status IPv4 addresses in order including duplicates",
    [Arbitrary.schema(S.Array(TailnetIpv4Address).check(S.isMaxLength(16)))],
    ([addresses]) =>
      Effect.gen(function* () {
        const expected = A.flatMap(addresses, (address) => [address, address]);
        const statusJson = TailscaleStatusJson.make({
          Self: TailscaleStatusSelf.make({
            TailscaleIPs: [
              "192.168.1.20",
              ...A.flatMap(addresses, (address) => [address, "fd7a:115c:a1e0::1", address, "100.128.0.1"]),
              "fd7a:115c:a1e0::2",
            ],
          }),
        });
        const encoded = yield* encodeTailscaleStatusJson(statusJson);
        const status = yield* parseTailscaleStatus(encoded);
        assert.deepEqual(status.tailnetIpv4Addresses, expected);
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "preserves status decoding failures without exposing cause text",
    Effect.fnUntraced(function* () {
      const error = yield* parseTailscaleStatus("{not-json").pipe(Effect.flip);

      assert.instanceOf(error, TailscaleStatusParseError);
      assert.equal(error.message, "Failed to decode tailscale status JSON.");
      assert.isDefined(error.cause);
      assert.notInclude(error.message, String(error.cause));
    })
  );

  it.effect(
    "rejects malformed MagicDNS status fields",
    Effect.fnUntraced(function* () {
      const error = yield* parseTailscaleStatus('{"Self":{"DNSName":42}}').pipe(Effect.flip);

      assert.instanceOf(error, TailscaleStatusParseError);
      assert.equal(error.message, "Failed to decode tailscale status JSON.");
    })
  );

  it.effect(
    "rejects malformed Tailscale IP status fields",
    Effect.fnUntraced(function* () {
      const error = yield* parseTailscaleStatus('{"Self":{"TailscaleIPs":["100.100.100.100",42]}}').pipe(Effect.flip);

      assert.instanceOf(error, TailscaleStatusParseError);
      assert.equal(error.message, "Failed to decode tailscale status JSON.");
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

  const statusSpawner = ScriptedSpawner.make(() => ({ stdout: tailscaleStatusWithSingleIpJson }));
  it.layer(statusSpawner.layer, { timeout: "10 seconds" })("with a successful tailscale status process", (it) => {
    it.effect(
      "reads tailscale status through the process spawner service",
      Effect.fnUntraced(function* () {
        yield* Effect.log("Tailscale phase: await in-memory status output and exit");
        const status = yield* readTailscaleStatus;
        assert.deepEqual(
          status,
          TailscaleStatus.make({
            magicDnsName: O.some("desktop.tail.ts.net"),
            tailnetIpv4Addresses: ["100.90.1.2"],
          })
        );
        assertTailscaleSpawn(statusSpawner, ["status", "--json"], "pipe");
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
  it.layer(ScriptedSpawner.make(() => spawnCause).layer, { timeout: "10 seconds" })(
    "with a failing tailscale process spawn",
    (it) => {
      it.effect(
        "preserves tailscale spawn failures as causes",
        Effect.fnUntraced(function* () {
          yield* Effect.log("Tailscale phase: await in-memory status failure");
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
    }
  );

  it.layer(ScriptedSpawner.make(() => ({ exit: 7, stderr: "not logged in tskey-auth-secret-token-value" })).layer, {
    timeout: "10 seconds",
  })("with a nonzero tailscale status exit", (it) => {
    it.effect(
      "keeps nonzero exit diagnostics structured",
      Effect.fnUntraced(function* () {
        yield* Effect.log("Tailscale phase: await in-memory status failure");
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

  const StatusTimeoutLayer = Layer.mergeAll(TestClock.layer(), ScriptedSpawner.make(() => ({ hang: true })).layer);

  it.layer(StatusTimeoutLayer, { timeout: "10 seconds" })("with a non-terminating tailscale status process", (it) => {
    it.effect(
      "times out tailscale status through TestClock",
      Effect.fnUntraced(function* () {
        yield* Effect.log("Tailscale phase: fork in-memory status wait");
        const fiber = yield* Effect.flip(readTailscaleStatus).pipe(Effect.forkScoped);
        yield* Effect.yieldNow;
        yield* Effect.log("Tailscale phase: advance owned timeout clock");
        yield* TestClock.adjust(TAILSCALE_STATUS_TIMEOUT);
        yield* Effect.log("Tailscale phase: join timed-out status wait");
        const error = yield* Fiber.join(fiber);

        assert.instanceOf(error, TailscaleCommandTimeoutError);
        assert.equal(error.executable, "tailscale");
        assert.equal(error.subcommand, "status");
        assert.equal(error.argumentCount, 2);
        assert.equal(error.timeoutMs, 10_000);
        assert.isTrue(Cause.isTimeoutError(error.cause));
        assert.equal(error.message, "tailscale status timed out after 10000ms.");
      })
    );
  });

  const serveSpawner = ScriptedSpawner.make(() => ({}));
  it.layer(serveSpawner.layer, { timeout: "10 seconds" })("with a successful tailscale serve process", (it) => {
    it.effect(
      "configures tailscale serve through the process spawner service",
      Effect.fnUntraced(function* () {
        yield* ensureTailscaleServe({ localPort: 13773, servePort: 8443 });
        assertTailscaleSpawn(serveSpawner, ["serve", "--bg", "--https=8443", "http://127.0.0.1:13773"], "ignore");
      })
    );
  });

  it.layer(
    ScriptedSpawner.make(() => ({ exit: 1, stderr: "serve permission denied tskey-auth-secret-token-value" })).layer,
    { timeout: "10 seconds" }
  )("with a nonzero tailscale serve exit", (it) => {
    it.effect(
      "retains tailscale serve exit diagnostics",
      Effect.fnUntraced(function* () {
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

  const disableSpawner = ScriptedSpawner.make(() => ({}));
  it.layer(disableSpawner.layer, { timeout: "10 seconds" })(
    "with a successful tailscale serve disable process",
    (it) => {
      it.effect(
        "disables tailscale serve through the process spawner service",
        Effect.fnUntraced(function* () {
          yield* disableTailscaleServe({ servePort: 8443 });
          assert.deepEqual(
            A.map(disableSpawner.spawns, ({ command, args }) => ({ command, args })),
            [{ command: "tailscale", args: ["serve", "--https=8443", "off"] }]
          );
        })
      );
    }
  );
});
