/** Linux FIFO transport for authorized adapters; values never cross argv or env. */
import * as Fs from "node:fs";
import { spawn } from "node:child_process";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { privatePipe } from "./prompt.ts";

/** Drain a real inherited FIFO concurrently with the masked helper.
 * **Example** (Synthetic use)
 * Call from an authorized adapter with nonsecret title/label and its selected GUI environment.
 */
export const requestCode = Effect.fn("Plasma.requestCode")(
  (title: string, label: string, timeout: number, env: NodeJS.ProcessEnv) =>
    Effect.scoped(
      Effect.gen(function* () {
        const pipe = privatePipe();
        if (!pipe) return { status: 2, answer: Buffer.alloc(0) };
        const resource = yield* Effect.acquireRelease(
          Effect.try(() => {
            const child = spawn(
              process.execPath,
              [
                "--no-env-file",
                "--config=/dev/null",
                new URL("prompt.ts", import.meta.url).pathname,
                "--write-fd",
                "3",
                "--title",
                title,
                "--label",
                label,
                "--timeout",
                `${timeout}`,
              ],
              {
                env,
                stdio: ["ignore", "ignore", "ignore", pipe.writer],
              }
            );
            Fs.closeSync(pipe.writer);
            const output: Buffer[] = [];
            const resource = { child, output, length: 0 };
            const done = new Promise<number>((resolve) => {
              child.once("error", () => resolve(2));
              child.once("exit", (code) => resolve(code ?? 1));
            });
            const reader = Fs.createReadStream("", { fd: pipe.reader, autoClose: true });
            const drained = new Promise<void>((resolve) => {
              reader.on("data", (chunk) => {
                const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                resource.length += bytes.length;
                if (resource.length > 4096) {
                  bytes.fill(0);
                  child.kill("SIGTERM");
                } else output.push(bytes);
              });
              reader.once("end", resolve);
              reader.once("error", () => {
                child.kill("SIGTERM");
                resolve();
              });
            });
            return { resource, done, reader, drained };
          }).pipe(
            Effect.onError(() =>
              Effect.sync(() => {
                for (const fd of [pipe.reader, pipe.writer]) {
                  try {
                    Fs.closeSync(fd);
                  } catch {}
                }
              })
            )
          ),
          ({ resource, done, reader }) =>
            Effect.gen(function* () {
              const { child, output } = resource;
              if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
              yield* Effect.tryPromise(() => done).pipe(
                Effect.timeout("5 seconds"),
                Effect.catchCause(() =>
                  Effect.gen(function* () {
                    child.kill("SIGKILL");
                    yield* Effect.tryPromise(() => done).pipe(Effect.timeout("5 seconds"), Effect.ignore);
                  })
                )
              );
              reader.destroy();
              for (const chunk of output) chunk.fill(0);
            })
        );
        const status = yield* Effect.tryPromise(() =>
          Promise.all([resource.done, resource.drained]).then(([code]) => code)
        ).pipe(
          Effect.timeout(`${timeout + 10} seconds`),
          Effect.catchTag("TimeoutError", () => Effect.succeed(-3)),
          Effect.catchCause(() => Effect.succeed(2))
        );
        const answer =
          status === 0 && resource.resource.length <= 4096 ? Buffer.concat(resource.resource.output) : Buffer.alloc(0);
        return { status: answer.length ? status : status || 2, answer };
      })
    )
);

/** Run a silent adapter boundary and interrupt its owned work on cancellation. */
export async function runAdapter<A>(effect: Effect.Effect<A, unknown>, cancelled: A): Promise<A> {
  const fiber = Effect.runFork(effect);
  const cancel = () => {
    Effect.runFork(Fiber.interrupt(fiber));
  };
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);
  const exit = await Effect.runPromise(Fiber.await(fiber));
  process.removeListener("SIGTERM", cancel);
  process.removeListener("SIGINT", cancel);
  return exit._tag === "Success" ? exit.value : cancelled;
}
