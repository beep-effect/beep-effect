#!/usr/bin/env bun
/** SSH-only adapter. stdout belongs exclusively to SSH's askpass channel. */
import * as Fs from "node:fs";
import * as Effect from "effect/Effect";
import { requestCode, runAdapter } from "./transport.ts";

/** Classify trusted callback metadata before starting any collection. */
export function classify(env: NodeJS.ProcessEnv, args: readonly string[]) {
  if (env.SSH_ASKPASS_PROMPT === "none") return "notification";
  if (env.SSH_ASKPASS_PROMPT === "confirm") return "confirmation";
  if (env.SSH_ASKPASS_PROMPT) return "unknown";
  const expected = (env.PLASMA_AUTH_SSH_PROMPT ?? "").replace(/[ \t]+$/, "");
  const title = env.PLASMA_AUTH_TITLE ?? "",
    label = env.PLASMA_AUTH_LABEL ?? "";
  if (
    !expected.startsWith("(") ||
    !expected.includes(") ") ||
    args.length !== 1 ||
    args[0]?.replace(/[ \t]+$/, "") !== expected
  )
    return "refused";
  if ([title, label, expected].some((value) => !value || [...value].length > 500 || /[\x00-\x1f]/.test(value)))
    return "refused";
  return "text";
}

const main = Effect.scoped(
  Effect.gen(function* () {
    const kind = classify(process.env, process.argv.slice(2));
    if (kind === "notification") return 0;
    if (kind === "confirmation" || kind === "unknown") return 2;
    const parent = process.ppid;
    const comm = yield* Effect.try(() => Fs.readFileSync(`/proc/${parent}/comm`, "utf8").trim());
    if (comm !== "ssh") return 2;
    let delivered = false;
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        if (!delivered && process.ppid === parent) {
          try {
            process.kill(parent, "SIGTERM");
          } catch {}
        }
      })
    );
    if (kind !== "text") return 2;
    const result = yield* Effect.acquireRelease(
      Effect.interruptible(
        requestCode(process.env.PLASMA_AUTH_TITLE ?? "", process.env.PLASMA_AUTH_LABEL ?? "", 60, process.env)
      ),
      (result) =>
        Effect.sync(() => {
          result.answer.fill(0);
        })
    );
    if (result.status === 1 || result.status === 3) return 1;
    if (result.status !== 0 || !result.answer.length) return 2;
    // Only the verified direct SSH parent receives this private callback channel.
    yield* Effect.try(() => {
      Fs.writeSync(1, result.answer);
      Fs.writeSync(1, "\n");
    });
    delivered = true;
    return 0;
  })
).pipe(Effect.catchCause(() => Effect.succeed(2)));
if (import.meta.main) process.exitCode = await runAdapter(main, 1);
