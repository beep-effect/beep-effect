import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const textStream = (text: string) => (Str.isEmpty(text) ? Stream.empty : Stream.make(new TextEncoder().encode(text)));

const outputHandle = (stdout: string, exitCode: number) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    stdout: textStream(stdout),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });

/** One scripted child process answer: stdout and exit code, keyed by the joined argv. */
export interface ScriptedProcess {
  readonly exitCode?: number;
  readonly stdout: string;
}

/**
 * A spawner that answers each `command args…` line from `script` and records
 * every line it was asked for; an unscripted line exits 1.
 */
export const scriptedSpawner = (script: Readonly<Record<string, ScriptedProcess>>) => {
  const spawned: Array<string> = [];
  const spawner = ChildProcessSpawner.make((command) => {
    if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected piped command");
    const line = A.join(
      A.prepend(
        A.map(command.args, (word) => (Redacted.isRedacted(word) ? Redacted.value(word) : word)),
        command.command
      ),
      " "
    );
    spawned.push(line);
    const answer = O.fromUndefinedOr(script[line]);
    return Effect.succeed(
      pipe(
        answer,
        O.match({
          onNone: () => outputHandle("", 1),
          onSome: (scripted) => outputHandle(scripted.stdout, scripted.exitCode ?? 0),
        })
      )
    );
  });
  return { spawner, spawned };
};

/** One scripted HTTP answer. */
export interface ScriptedReply {
  readonly body: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly status: number;
}

/** A `fetch` that answers every request with `reply(path)` and records the request paths and headers. */
export const recordingFetch = (reply: (path: string) => ScriptedReply) => {
  const calls: Array<{ readonly path: string; readonly authorization: string }> = [];
  const fetch = Object.assign(
    (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const target = input instanceof URL ? input.href : input;
      const request = typeof target === "string" ? new Request(target, init ?? {}) : new Request(target, init ?? {});
      const path = new URL(request.url).pathname;
      calls.push({ path, authorization: request.headers.get("authorization") ?? "" });
      const answer = reply(path);
      const response = new Response(answer.body, {
        status: answer.status,
        headers: { "content-type": "application/json", ...answer.headers },
      });
      Object.defineProperty(response, "url", { value: request.url });
      return Promise.resolve(response);
    },
    { preconnect: globalThis.fetch.preconnect }
  );
  return { fetch, calls, count: () => calls.length };
};

/** GitHub's rate-limit headers for a scripted reply. */
export const rateLimitHeaders = (options: {
  readonly remaining: number;
  readonly used: number;
  readonly resource: string;
  readonly reset?: number;
}): Record<string, string> => ({
  "x-ratelimit-limit": "5000",
  "x-ratelimit-remaining": `${options.remaining}`,
  "x-ratelimit-used": `${options.used}`,
  "x-ratelimit-reset": `${options.reset ?? 1_800_000_000}`,
  "x-ratelimit-resource": options.resource,
});

/**
 * Provide a layer to an effect by building it in a scope, so a test can
 * swap layers per case without `Effect.provide`.
 */
export const withLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, Exclude<R, ROut> | RIn> =>
    layer.pipe(
      Layer.build,
      Effect.flatMap((context) => Effect.provideContext(effect, context)),
      Effect.scoped
    );
