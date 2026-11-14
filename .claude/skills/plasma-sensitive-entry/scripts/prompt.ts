#!/usr/bin/env bun
/** Masked Plasma input. Only the inherited FIFO receives successful bytes. */
import * as Fs from "node:fs";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import * as ChildProcess from "effect/process/ChildProcess";
import * as BunServices from "@effect/platform-bun/BunServices";
import { dlopen, FFIType, ptr } from "bun:ffi";

const libc = dlopen("libc.so.6", {
  fcntl: { args: [FFIType.i32, FFIType.i32, FFIType.i32], returns: FFIType.i32 },
  pipe2: { args: [FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
});
const guiKeys = new Set(["DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY", "DBUS_SESSION_BUS_ADDRESS", "XDG_RUNTIME_DIR"]);

/** Create a Linux FIFO, with close-on-exec on both parent descriptors. */
export function privatePipe() {
  const pair = new Int32Array(2);
  if (libc.symbols.pipe2(ptr(pair), 0x80000) !== 0) return undefined;
  const [reader, writer] = pair;
  if (reader === undefined || writer === undefined) return undefined;
  return { reader, writer };
}

/** Capture an owned process and reap its entire process group on interruption. */
export const runOwned = Effect.fn("Plasma.runOwned")(function* (
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  timeout: number
) {
  const [command, ...args] = argv;
  if (!command) return { status: 2, output: Buffer.alloc(0) };
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const child = yield* ChildProcess.make(command, args, {
        env,
        extendEnv: false,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "ignore",
        detached: true,
        killSignal: "SIGKILL",
        forceKillAfter: "1 second",
      });
      const [chunks, status] = yield* Effect.all([Stream.runCollect(child.stdout), child.exitCode], { concurrency: 2 });
      return { status: Number(status), output: Buffer.concat(chunks) };
    }).pipe(Effect.timeout(`${timeout} seconds`))
  );
});

type RunOwned = (argv: readonly string[], env: NodeJS.ProcessEnv, timeout: number) => ReturnType<typeof runOwned>;

/** Return status only: 0 delivered, 1 cancelled, 2 unavailable, 3 timed out. */
export const prompt = Effect.fn("Plasma.prompt")(function* (
  fd: number,
  title: string,
  label: string,
  timeout = 60,
  environment: NodeJS.ProcessEnv = process.env,
  run: RunOwned = runOwned
) {
  const target = yield* Effect.try(() => Fs.fstatSync(fd));
  if (fd < 3 || !target.isFIFO() || !Number.isInteger(timeout) || timeout < 1 || timeout > 300) return 2;
  for (const standard of [0, 1, 2]) {
    const stream = yield* Effect.try(() => Fs.fstatSync(standard)).pipe(Effect.option);
    if (stream._tag === "Some" && target.dev === stream.value.dev && target.ino === stream.value.ino) return 2;
  }
  const dialog = Bun.which("kdialog", { PATH: environment.PATH ?? "" });
  if (!dialog) return 2;
  const env = Object.fromEntries(
    Object.entries(environment).filter(([key]) => guiKeys.has(key) || ["PATH", "HOME", "LANG", "LC_ALL"].includes(key))
  );
  if (!(env.DBUS_SESSION_BUS_ADDRESS && (env.WAYLAND_DISPLAY || env.DISPLAY))) {
    const session = yield* run(["systemctl", "--user", "show-environment"], env, 5);
    if (session.status !== 0) return 2;
    const discovered: NodeJS.ProcessEnv = {};
    for (const line of session.output.toString("utf8").split(/\r?\n/)) {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator);
      if (separator >= 0 && guiKeys.has(key)) discovered[key] = line.slice(separator + 1);
    }
    if (Object.entries(discovered).some(([key, value]) => key in env && env[key] !== value)) return 2;
    Object.assign(env, discovered);
  }
  if (!env.DBUS_SESSION_BUS_ADDRESS || !(env.WAYLAND_DISPLAY || env.DISPLAY)) return 2;
  const result = yield* run([dialog, "--title", title, "--password", label], env, timeout).pipe(
    Effect.catchTag("TimeoutError", () => Effect.succeed({ status: -1, output: Buffer.alloc(0) }))
  );
  if (result.status !== 0) {
    result.output.fill(0);
    return result.status === -1 ? 3 : 1;
  }
  const answer = result.output.subarray(0, result.output.at(-1) === 10 ? -1 : undefined);
  try {
    if (!answer.length || answer.some((byte) => byte === 10 || byte === 13 || byte === 0)) return 2;
    const flags = libc.symbols.fcntl(fd, 3, 0);
    if (flags < 0 || libc.symbols.fcntl(fd, 4, flags | 0x800) < 0) return 2;
    const deadline = performance.now() + 5000;
    let offset = 0;
    while (offset < answer.length) {
      if (performance.now() >= deadline) return 2;
      const written = yield* Effect.try(() => Fs.writeSync(fd, answer, offset, answer.length - offset)).pipe(
        Effect.catchIf(
          (e) => e.cause instanceof Error && "code" in e.cause && e.cause.code === "EAGAIN",
          () => Effect.succeed(0)
        )
      );
      offset += written;
      if (!written) yield* Effect.sleep("10 millis");
    }
    return 0;
  } finally {
    result.output.fill(0);
  }
});

if (import.meta.main) {
  const args = process.argv.slice(2);
  const value = (key: string) => args[args.indexOf(key) + 1];
  const fd = args.includes("--write-fd") ? Number(value("--write-fd")) : -1;
  const title = args.includes("--title") ? value("--title") : undefined,
    label = args.includes("--label") ? value("--label") : undefined;
  const program =
    title !== undefined && label !== undefined
      ? prompt(fd, title, label, args.includes("--timeout") ? Number(value("--timeout")) : 60)
      : Effect.succeed(2);
  const fiber = Effect.runFork(
    program.pipe(
      Effect.provide(BunServices.layer),
      Effect.catchCause(() => Effect.succeed(2))
    )
  );
  const cancel = () => {
    Effect.runFork(Fiber.interrupt(fiber));
  };
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);
  const exit = await Effect.runPromise(Fiber.await(fiber));
  process.exitCode = exit._tag === "Success" ? exit.value : 1;
}
