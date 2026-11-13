/**
 * The seam between a publish that opens its pull request ready and the
 * `yeet ready` gate that owns the final-check receipt rule.
 *
 * **Details**
 *
 * A publish opens a pull request ready only when the head carries a passing
 * `yeet final-check` receipt (decision 2026-11-13, open ready at
 * content-final). That rule, the ancestor carry and the worker-profile
 * deferrals live in `ReadyGate.ts`, which imports the handler; the handler
 * reads them through this reference instead of importing the gate back. The
 * command layer provides the real hooks; the default refuses, so a publish
 * wired without them can never open a ready pull request unproven.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { YeetCommandError } from "../Yeet.errors.ts";
import type { Git } from "@beep/git/Git";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as O from "effect/Option";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/OpenReady");

type OpenReadyServices =
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
  | Git;

/**
 * What a publish asks of the ready gate when it opens a pull request ready.
 *
 * **Details**
 *
 * `requireProof` runs before the push and fails unless `headSha` carries a
 * passing final-check receipt (its own, or an ancestor's under the refresh
 * rule). `afterOpen` runs once the ready pull request exists: it records the
 * start of the review round and requests the reviewer, and never fails the
 * publish.
 *
 * **Example** (Stub the hooks in a test)
 *
 * ```ts
 * import type { YeetOpenReadyHooks } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const hooks: YeetOpenReadyHooks = { requireProof: () => Effect.void, afterOpen: () => Effect.void }
 * console.log(typeof hooks.requireProof) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface YeetOpenReadyHooks {
  readonly afterOpen: (
    context: RepoRunContext,
    prNumber: number,
    headSha: string
  ) => Effect.Effect<void, never, OpenReadyServices>;
  /** Test seam for the open pull request lookup; the handler reads GitHub when omitted. */
  readonly findOpen?: (context: RepoRunContext) => Effect.Effect<O.Option<unknown>, YeetCommandError>;
  readonly requireProof: (
    context: RepoRunContext,
    headSha: string
  ) => Effect.Effect<void, YeetCommandError, OpenReadyServices>;
}

const unwired: YeetOpenReadyHooks = {
  requireProof: () =>
    Effect.fail(
      YeetCommandError.make({
        message:
          "yeet publish refused to open the pull request ready: the final-check receipt reader is not wired into this run. Open a draft with --draft instead.",
        exitCode: 1,
      })
    ),
  afterOpen: () => Effect.void,
};

/**
 * The ready-gate hooks a publish uses when it opens a pull request ready.
 *
 * **Example** (The default refuses)
 *
 * ```ts
 * import { YeetOpenReady } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(typeof Effect.runSync(Effect.service(YeetOpenReady)).requireProof) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const YeetOpenReady: Context.Reference<YeetOpenReadyHooks> = Context.Reference($I`YeetOpenReady`, {
  defaultValue: () => unwired,
});
