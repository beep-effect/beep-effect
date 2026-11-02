/**
 * Shared process harness for the archive-fence invoker scripts.
 *
 * Each invoker runs one lane-removal program on `FenceInvokerLayer`, prints
 * one JSON line `{ ok, message }` and exits 0 when the program succeeded.
 */

import { Git } from "@beep/git/Git";
import { WorktreeRemovalServiceLive } from "@beep/repo-cli/commands/Worktree";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

// `Git` rides beside the platform services: repo-cli's typed git readers take it from the context (W1a).
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));

/** Node services plus the live worktree removal service. */
const platformLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer);
export const FenceInvokerLayer = Layer.mergeAll(
  platformLayer,
  WorktreeRemovalServiceLive.pipe(Layer.provide(platformLayer))
);

const encodeOutcome = S.encodeEffect(S.fromJsonString(S.Unknown));

/**
 * Prints a program's `{ ok, message }` outcome as one JSON line and succeeds
 * with `ok`.
 */
export const reportFenceOutcome =
  <A, E>(message: { readonly onFailure: (error: E) => string; readonly onSuccess: (value: A) => string }) =>
  <R>(program: Effect.Effect<A, E, R>): Effect.Effect<boolean, S.SchemaError, R> =>
    Effect.result(program).pipe(
      Effect.map(
        Result.match({
          onFailure: (error) => ({ ok: false, message: message.onFailure(error) }),
          onSuccess: (value) => ({ ok: true, message: message.onSuccess(value) }),
        })
      ),
      Effect.tap((outcome) => encodeOutcome(outcome).pipe(Effect.flatMap(Console.log))),
      Effect.map((outcome) => outcome.ok)
    );
