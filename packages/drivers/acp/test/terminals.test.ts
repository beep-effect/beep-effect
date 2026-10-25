import * as AcpClient from "@beep/acp/client";
import * as AcpJson from "@beep/acp/json";
import { AcpClientTerminalLimits, AcpClientTerminals, layer, make, register } from "@beep/acp/terminals";
import { fcRuns } from "@beep/test-utils";
import { currentHostPlatform, HostProcessPlatform } from "@beep/utils/HostProcess";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeInMemoryStdio } from "./helpers.ts";

const node = process.execPath;
const script = (source: string) => ({ command: node, args: ["-e", source] });
const cwd = process.cwd();

const encoder = new TextEncoder();
const encodeJsonText = S.encodeUnknownEffect(AcpJson.fromJsonText(S.Unknown));
const decodeResponse = S.decodeEffect(AcpJson.fromJsonText(S.Struct({ id: S.Finite, result: S.Unknown })));
const decodeTerminalId = S.decodeUnknownEffect(S.Struct({ terminalId: S.String }));
const decodeErrorResponse = S.decodeEffect(
  AcpJson.fromJsonText(
    S.Struct({
      id: S.Finite,
      error: S.Struct({ code: S.Finite, message: S.String }),
    })
  )
);

// The spawner reads the filesystem only to check that an explicit cwd is accessible; every
// command here runs in the test's own working directory.
const SpawnerLayer = Layer.merge(
  NodeChildProcessSpawner.layer,
  Layer.succeed(HostProcessPlatform, currentHostPlatform)
).pipe(Layer.provide(Layer.mergeAll(FileSystem.layerNoop({ access: () => Effect.void }), NodePath.layer)));

it.layer(SpawnerLayer, { timeout: "30 seconds" })("AcpClientTerminals", (it) => {
  it.effect(
    "registers every terminal handler on the ACP client",
    Effect.fnUntraced(function* () {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const client = yield* AcpClient.make(stdio);
      const terminals = yield* make({ defaultCwd: cwd });
      yield* register.pipe(
        Effect.provideService(AcpClient.AcpClient, client),
        Effect.provideService(AcpClientTerminals, terminals)
      );
      for (const [id, method] of A.make("create", "output", "wait_for_exit", "kill", "release").entries()) {
        const params =
          method === "create"
            ? { sessionId: "session", command: "/nonexistent/acp-terminal-command" }
            : { sessionId: "session", terminalId: "missing" };
        const message = yield* encodeJsonText({ jsonrpc: "2.0", id, method: `terminal/${method}`, params });
        yield* Queue.offer(input, encoder.encode(`${message}\n`));
        const response = yield* Queue.take(output).pipe(Effect.flatMap(decodeErrorResponse));
        assert.strictEqual(response.id, id);
        assert.strictEqual(response.error.code, -32603);
        assert.include(response.error.message, method === "create" ? "Could not start" : "unknown terminal ID");
      }
    })
  );

  it.effect.prop(
    "answers terminal/output for any unknown terminal ID with an error",
    [Arbitrary.schema(S.String)],
    Effect.fnUntraced(function* ([terminalId]) {
      const { stdio, input, output } = yield* makeInMemoryStdio();
      const client = yield* AcpClient.make(stdio);
      const terminals = yield* make({ defaultCwd: cwd });
      yield* register.pipe(
        Effect.provideService(AcpClient.AcpClient, client),
        Effect.provideService(AcpClientTerminals, terminals)
      );
      const params = { sessionId: "session", terminalId };
      const message = yield* encodeJsonText({ jsonrpc: "2.0", id: 1, method: "terminal/output", params });
      yield* Queue.offer(input, encoder.encode(`${message}\n`));
      const response = yield* Queue.take(output).pipe(Effect.flatMap(decodeErrorResponse));
      assert.strictEqual(response.id, 1);
      assert.strictEqual(response.error.code, -32603);
      assert.include(response.error.message, "unknown terminal ID");
    }),
    { arbitrary: fcRuns(12) }
  );

  it.effect(
    "runs a command, buffers output, and reports the exit status",
    Effect.fnUntraced(function* () {
      const context = yield* Layer.build(layer({ defaultCwd: cwd }));
      const terminals = Context.get(context, AcpClientTerminals);
      const { terminalId } = yield* terminals.create({
        sessionId: "session",
        ...script("console.log('hello from acp'); process.exit(3);"),
      });

      const exit = yield* terminals.waitForExit({ sessionId: "session", terminalId });
      assert.strictEqual(exit.exitCode, 3);
      assert.isNull(exit.signal);

      const output = yield* terminals.output({ sessionId: "session", terminalId });
      assert.include(output.output, "hello from acp");
      assert.isFalse(output.truncated);
      assert.strictEqual(output.exitStatus?.exitCode, 3);
      assertSome(terminals.commandLine(terminalId), `${node} -e console.log('hello from acp'); process.exit(3);`);
    })
  );

  it.effect(
    "layers session and request variables over a complete base environment",
    Effect.fnUntraced(function* () {
      const terminals = yield* make(
        { defaultCwd: cwd, environment: O.some({ BASE_ONLY: "base", OVERRIDDEN: "base" }) },
        (sessionId) => ({ OVERRIDDEN: `session-${sessionId}` })
      );
      const read = Effect.fnUntraced(function* (
        sessionId: string,
        env: ReadonlyArray<{ name: string; value: string }>
      ) {
        const { terminalId } = yield* terminals.create({
          sessionId,
          env,
          ...script(
            "process.stdout.write([process.env.BASE_ONLY, process.env.OVERRIDDEN, process.env.HOME ?? 'no-home'].join(','))"
          ),
        });
        yield* terminals.waitForExit({ sessionId, terminalId });
        return (yield* terminals.output({ sessionId, terminalId })).output;
      });

      assert.strictEqual(yield* read("a", []), "base,session-a,no-home");
      assert.strictEqual(yield* read("b", [{ name: "OVERRIDDEN", value: "request" }]), "base,request,no-home");
    })
  );

  it.effect(
    "runs shell source when shell commands are enabled",
    Effect.fnUntraced(function* () {
      const terminals = yield* make({ defaultCwd: cwd, shellCommands: true }, () => ({ ACP_PROBE: "mailbox-probe" }));
      const { terminalId } = yield* terminals.create({
        sessionId: "shell",
        command: 'printf "%s\\n" "$ACP_PROBE" | tr a-z A-Z',
      });
      const exit = yield* terminals.waitForExit({ sessionId: "shell", terminalId });
      const output = yield* terminals.output({ sessionId: "shell", terminalId });

      assert.strictEqual(exit.exitCode, 0);
      assert.strictEqual(Str.trim(output.output), "MAILBOX-PROBE");
    })
  );

  it.effect(
    "truncates from the beginning at the byte limit on a character boundary",
    Effect.fnUntraced(function* () {
      const terminals = yield* make({ defaultCwd: cwd });
      const ascii = yield* terminals.create({
        sessionId: "session",
        outputByteLimit: 16,
        ...script("process.stdout.write('a'.repeat(64) + 'TAIL');"),
      });
      // Each euro sign is three bytes, so a 16-byte limit cuts through one of them.
      const multiByte = yield* terminals.create({
        sessionId: "session",
        outputByteLimit: 16,
        ...script("process.stdout.write('\\u20ac'.repeat(20));"),
      });
      yield* terminals.waitForExit({ sessionId: "session", ...ascii });
      yield* terminals.waitForExit({ sessionId: "session", ...multiByte });

      const asciiOutput = yield* terminals.output({ sessionId: "session", ...ascii });
      assert.isTrue(asciiOutput.truncated);
      assert.strictEqual(asciiOutput.output, `${Str.repeat(12)("a")}TAIL`);

      const multiByteOutput = yield* terminals.output({ sessionId: "session", ...multiByte });
      assert.isTrue(multiByteOutput.truncated);
      assert.strictEqual(multiByteOutput.output, Str.repeat(5)("€"));

      // A one-byte limit retains only the final continuation byte of the euro sign.
      const continuationOnly = yield* terminals.create({
        sessionId: "session",
        outputByteLimit: 1,
        ...script("process.stdout.write('\\u20ac');"),
      });
      yield* terminals.waitForExit({ sessionId: "session", ...continuationOnly });
      const continuationOutput = yield* terminals.output({ sessionId: "session", ...continuationOnly });
      assert.isTrue(continuationOutput.truncated);
      assert.strictEqual(continuationOutput.output, "");
    })
  );

  it.effect(
    "kills a running command and rejects the released handle while keeping its snapshot",
    Effect.fnUntraced(function* () {
      const terminals = yield* make({ defaultCwd: cwd });
      const { terminalId } = yield* terminals.create({
        sessionId: "session",
        ...script("setInterval(() => {}, 1000);"),
      });

      yield* terminals.kill({ sessionId: "session", terminalId });
      const exit = yield* terminals.waitForExit({ sessionId: "session", terminalId });
      if ((yield* HostProcessPlatform) === "win32") assert.isNull(exit.signal);
      else assert.strictEqual(exit.signal, "SIGTERM");

      yield* terminals.release({ sessionId: "session", terminalId });
      const rejected = yield* Effect.flip(terminals.output({ sessionId: "session", terminalId }));
      assert.include(rejected.message, "unknown terminal ID");
      assert.strictEqual(rejected.code, -32603);
      assertSome(terminals.readOutputSnapshot("session", terminalId), {
        output: "",
        truncated: false,
        exitStatus: exit,
      });
    })
  );

  it.effect(
    "reserves live-terminal capacity across concurrent creates",
    Effect.fnUntraced(function* () {
      const terminals = yield* make({ defaultCwd: cwd, limits: AcpClientTerminalLimits.make({ maxLiveTerminals: 3 }) });
      const results = yield* Effect.all(
        A.makeBy(4, () =>
          terminals.create({ sessionId: "session", ...script("setInterval(() => {}, 1000);") }).pipe(Effect.result)
        ),
        { concurrency: "unbounded" }
      );

      assert.lengthOf(A.filter(results, Result.isSuccess), 3);
      assert.lengthOf(A.filter(results, Result.isFailure), 1);
    })
  );

  it.effect(
    "bounds unreleased terminals without invalidating existing ids",
    Effect.fnUntraced(function* () {
      const terminals = yield* make({
        defaultCwd: cwd,
        limits: AcpClientTerminalLimits.make({ maxUnreleasedTerminals: 3 }),
      });
      const ids = yield* Effect.forEach(A.range(0, 2), (index) =>
        terminals
          .create({ sessionId: "session", ...script(`process.stdout.write('${index}');`) })
          .pipe(Effect.tap((created) => terminals.waitForExit({ sessionId: "session", ...created })))
      );

      const rejected = yield* terminals.create({ sessionId: "session", ...script("") }).pipe(Effect.flip);
      assert.include(rejected.message, "3 unreleased terminals");
      for (const [index, { terminalId }] of ids.entries())
        assertSome(terminals.readOutputSnapshot("session", terminalId), {
          output: `${index}`,
          truncated: false,
          exitStatus: { exitCode: 0, signal: null },
        });
    })
  );

  it.effect(
    "bounds output retained across terminals and prunes old released snapshots",
    Effect.fnUntraced(function* () {
      const terminals = yield* make({
        defaultCwd: cwd,
        limits: AcpClientTerminalLimits.make({ maxRetainedOutputBytes: 1024, maxRetainedReleasedTerminals: 1 }),
      });
      const ids = yield* Effect.forEach(A.range(0, 2), () =>
        terminals
          .create({ sessionId: "session", ...script("process.stdout.write('x'.repeat(1000));") })
          .pipe(Effect.tap((created) => terminals.waitForExit({ sessionId: "session", ...created })))
      );
      const retained = A.reduce(
        A.filterMap(ids, ({ terminalId }) =>
          Result.fromOption(terminals.readOutputSnapshot("session", terminalId), () => undefined)
        ),
        0,
        (total, snapshot) => total + snapshot.output.length
      );
      assert.isAtMost(retained, 1024);

      yield* Effect.forEach(ids, ({ terminalId }) => terminals.release({ sessionId: "session", terminalId }));
      assertNone(terminals.readOutputSnapshot("session", ids[0]?.terminalId ?? ""));
      // Trimming takes the oldest output first, so the newest terminal keeps all of its output.
      assertSome(terminals.readOutputSnapshot("session", ids[2]?.terminalId ?? ""), {
        output: Str.repeat(1000)("x"),
        truncated: false,
        exitStatus: { exitCode: 0, signal: null },
      });
    })
  );

  it.effect(
    "rejects terminal handles from a different session",
    Effect.fnUntraced(function* () {
      const terminals = yield* make({ defaultCwd: cwd });
      const { terminalId } = yield* terminals.create({
        sessionId: "owner",
        ...script("process.stdout.write('owned');"),
      });
      const foreign = { sessionId: "foreign", terminalId };
      const results = yield* Effect.all(
        [
          Effect.result(terminals.output(foreign)),
          Effect.result(terminals.waitForExit(foreign)),
          Effect.result(terminals.kill(foreign)),
          Effect.result(terminals.release(foreign)),
        ],
        { concurrency: "unbounded" }
      );

      assertTrue(A.every(results, Result.isFailure));
      yield* terminals.waitForExit({ sessionId: "owner", terminalId });
      assertNone(terminals.readOutputSnapshot("foreign", terminalId));
      assertSome(terminals.readOutputSnapshot("owner", terminalId), {
        output: "owned",
        truncated: false,
        exitStatus: { exitCode: 0, signal: null },
      });
    })
  );

  it.effect(
    "reports a command that cannot start as an internal error",
    Effect.fnUntraced(function* () {
      const terminals = yield* make({ defaultCwd: cwd });
      const error = yield* terminals
        .create({ sessionId: "session", command: "/nonexistent/acp-terminal-command" })
        .pipe(Effect.flip);

      assert.strictEqual(error.code, -32603);
      assert.include(error.message, "Could not start terminal command");
    })
  );
});

// The kill grace and the exit-output grace need the real clock.
it.layer(SpawnerLayer, { excludeTestServices: true, timeout: "30 seconds" })(
  "AcpClientTerminals on the real clock",
  (it) => {
    it.effect(
      "serves an agent's terminal requests through the client once registered",
      Effect.fnUntraced(function* () {
        const { stdio, input, output } = yield* makeInMemoryStdio();
        const acp = yield* AcpClient.make(stdio);
        const call = Effect.fnUntraced(function* (id: number, method: string, params: unknown) {
          const line = yield* encodeJsonText({ jsonrpc: "2.0", id, method, params });
          yield* Queue.offer(input, encoder.encode(`${line}\n`));
          const response = yield* Effect.flatMap(Queue.take(output), decodeResponse);
          assert.strictEqual(response.id, id);
          return response.result;
        });

        const terminals = Context.get(yield* Layer.build(layer({ defaultCwd: cwd })), AcpClientTerminals);
        yield* register.pipe(
          Effect.provideService(AcpClient.AcpClient, acp),
          Effect.provideService(AcpClientTerminals, terminals)
        );

        const { terminalId } = yield* decodeTerminalId(
          yield* call(1, "terminal/create", {
            sessionId: "session",
            ...script("process.stdout.write('served over acp'); process.exit(5);"),
          })
        );
        const terminal = { sessionId: "session", terminalId };
        assert.deepEqual(yield* call(2, "terminal/wait_for_exit", terminal), { exitCode: 5, signal: null });
        assert.deepEqual(yield* call(3, "terminal/output", terminal), {
          output: "served over acp",
          truncated: false,
          exitStatus: { exitCode: 5, signal: null },
        });
        assert.deepEqual(yield* call(4, "terminal/kill", terminal), {});
        assert.deepEqual(yield* call(5, "terminal/release", terminal), {});
      })
    );

    it.effect(
      "escalates terminal/kill to SIGKILL when the command ignores SIGTERM",
      Effect.fnUntraced(function* () {
        const terminals = yield* make({ defaultCwd: cwd, forceKillAfter: Duration.millis(200) });
        const { terminalId } = yield* terminals.create({
          sessionId: "session",
          ...script("process.on('SIGTERM', () => {}); process.stdout.write('ready'); setInterval(() => {}, 1000);"),
        });
        // Kill only once the SIGTERM handler is installed, or the default disposition ends the child.
        yield* terminals.output({ sessionId: "session", terminalId }).pipe(
          Effect.tap(() => Effect.yieldNow),
          Effect.repeat({ until: (output) => output.output === "ready" }),
          Effect.timeout("10 seconds")
        );

        yield* terminals.kill({ sessionId: "session", terminalId }).pipe(Effect.timeout("5 seconds"));
        const exit = yield* terminals.waitForExit({ sessionId: "session", terminalId });
        if ((yield* HostProcessPlatform) !== "win32") assert.strictEqual(exit.signal, "SIGKILL");
      })
    );

    it.effect(
      "reports the exit of a command whose background process still holds its output",
      Effect.fnUntraced(function* () {
        const terminals = yield* make({ defaultCwd: cwd, shellCommands: true, exitOutputGrace: Duration.millis(200) });
        const { terminalId } = yield* terminals.create({ sessionId: "session", command: "sleep 20 & echo started" });

        const exit = yield* terminals
          .waitForExit({ sessionId: "session", terminalId })
          .pipe(Effect.timeout("5 seconds"));
        assert.strictEqual(exit.exitCode, 0);
        const output = yield* terminals.output({ sessionId: "session", terminalId });
        assert.strictEqual(Str.trim(output.output), "started");
        assert.strictEqual(output.exitStatus?.exitCode, 0);
        yield* terminals.release({ sessionId: "session", terminalId }).pipe(Effect.timeout("10 seconds"));
      })
    );
  }
);
