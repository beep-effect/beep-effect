/**
 * Compiles the bun sidecar into a standalone binary named with the rust
 * target triple, which is where tauri's `externalBin` expects to find it
 * (`binaries/sidecar` → `binaries/sidecar-x86_64-unknown-linux-gnu`, …).
 *
 * Ported from the effect-lexical-chat POC (`scripts/build-sidecar.ts`), adapted
 * to this app's sidecar entry (`server/main.ts`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ } from "bun";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

class MissingTargetTripleError extends S.TaggedErrorClass<MissingTargetTripleError>()("MissingTargetTripleError", {
  message: S.String,
}) {}

const triple = (await $`rustc -vV`.text()).match(/host: (\S+)/)?.[1];
if (P.isUndefined(triple)) {
  throw new MissingTargetTripleError({
    message: "could not determine the target triple from `rustc -vV`",
  });
}

const outfile = `src-tauri/binaries/sidecar-${triple}`;
await $`bun build --compile server/main.ts --outfile ${outfile}`;
// build-script stdout, not application logging
// @effect-diagnostics-next-line globalConsole:off
console.log(`sidecar compiled → ${outfile}`);
