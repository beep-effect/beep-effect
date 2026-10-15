/**
 * Windows smoke check for `WindowsSecretStore.layerWindows`.
 *
 * Writes, reads, overwrites and deletes a throwaway Credential Manager entry,
 * checks the 2,560-byte cap, and round-trips bytes through DPAPI. Prints one
 * `PASS`/`FAIL` line per step and a final verdict; exits non-zero on any
 * failure. Secret values are never printed.
 *
 * Run on Windows from the repository root:
 *
 *   bun run packages/drivers/windows-secrets/scripts/smoke.ts
 *
 * or cross-compile a standalone binary on any host and copy it to the VM:
 *
 *   bun build --compile --target=bun-windows-x64 \
 *     packages/drivers/windows-secrets/scripts/smoke.ts --outfile windows-secrets-smoke.exe
 *
 * @since 0.0.0
 */

import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Random from "effect/Random";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CredentialBlobMaxBytes, SecretTarget, WindowsSecretStore } from "../src/index.ts";

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);

const holds = (value: O.Option<Redacted.Redacted<string>>, expected: string): boolean =>
  O.exists(value, (secret) => Redacted.value(secret) === expected);

class SmokeFailed extends S.TaggedError<SmokeFailed, { readonly brand: unique symbol }>()("SmokeFailed", {
  failedSteps: S.Int,
}) {
  override get message() {
    return `${this.failedSteps} windows-secrets smoke step(s) failed.`;
  }
}

const step = (name: string, check: Effect.Effect<boolean, { readonly _tag: string; readonly message: string }>) =>
  check.pipe(
    Effect.map((passed) => (passed ? `PASS ${name}` : `FAIL ${name}: unexpected result`)),
    Effect.catch((error) => Effect.succeed(`FAIL ${name}: ${error._tag}: ${error.message}`)),
    Effect.tap(Console.log),
    Effect.map(Str.startsWith("PASS"))
  );

const program = Effect.gen(function* () {
  const store = yield* WindowsSecretStore;
  const nonce = yield* Random.nextIntBetween(100_000, 999_999);
  const now = yield* Clock.currentTimeMillis;
  const target = SecretTarget.make(`beep/smoke/run-${now}-${nonce}`);
  // Non-ASCII content proves the UTF-16LE round trip; the value itself is never printed.
  const first = `smoke-value-${nonce}-ü\u{1f511}`;
  const second = `smoke-value-${now}-second`;
  const plaintext = new TextEncoder().encode(`dpapi-payload-${nonce}`);

  const results = yield* Effect.all([
    step("get before set is none", Effect.map(store.get(target), O.isNone)),
    step(
      "set then get round-trips",
      Effect.andThen(store.set(target, Redacted.make(first)), store.get(target)).pipe(
        Effect.map((value) => holds(value, first))
      )
    ),
    step(
      "set overwrites",
      Effect.andThen(store.set(target, Redacted.make(second)), store.get(target)).pipe(
        Effect.map((value) => holds(value, second))
      )
    ),
    step(
      "value at the cap is accepted",
      Effect.andThen(
        store.set(target, Redacted.make(Str.repeat(CredentialBlobMaxBytes / 2)("c"))),
        Effect.map(store.get(target), O.isSome)
      )
    ),
    step(
      "value past the cap fails with SecretTooLarge",
      store.set(target, Redacted.make(Str.repeat(CredentialBlobMaxBytes / 2 + 1)("c"))).pipe(
        Effect.as(false),
        Effect.catchTag("SecretTooLarge", (error) => Effect.succeed(error.bytes === CredentialBlobMaxBytes + 2))
      )
    ),
    step(
      "remove deletes the credential",
      Effect.andThen(store.remove(target), Effect.map(store.get(target), O.isNone))
    ),
    step("remove of a missing credential succeeds", Effect.as(store.remove(target), true)),
    step(
      "DPAPI protect changes the bytes and unprotect restores them",
      Effect.gen(function* () {
        const sealed = yield* store.protect(plaintext);
        const opened = yield* store.unprotect(sealed);
        return !sameBytes(sealed, plaintext) && sameBytes(opened, plaintext);
      })
    ),
    step(
      "DPAPI round-trips empty input",
      Effect.gen(function* () {
        const opened = yield* store.unprotect(yield* store.protect(new Uint8Array(0)));
        return opened.byteLength === 0;
      })
    ),
  ]).pipe(Effect.ensuring(Effect.ignore(store.remove(target))));

  const failedSteps = A.length(A.filter(results, (passed) => !passed));
  yield* Console.log(failedSteps === 0 ? "PASS windows-secrets smoke" : "FAIL windows-secrets smoke");
  if (failedSteps > 0) {
    return yield* SmokeFailed.make({ failedSteps });
  }
});

// Build the live layer into a Context and provide it at this entry point,
// keeping scope lifetimes correct and satisfying effect(strictEffectProvide).
const main = WindowsSecretStore.layerWindows.pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(program, context)),
  Effect.scoped
);

BunRuntime.runMain(main);
