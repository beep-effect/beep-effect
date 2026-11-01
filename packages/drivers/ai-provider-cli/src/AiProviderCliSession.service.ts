/**
 * Private managed session implementation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AiProviderCliId } from "@beep/identity";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import { openClaude } from "./AiProviderCliSession.claude.service.ts";
import { observeManagedSession } from "./AiProviderCliSession.lifecycle.ts";
import {
  prepareCodex,
  prepareGrok,
  transportFailure,
  validateProfile,
} from "./AiProviderCliSession.profile.service.ts";
import { openStdio } from "./AiProviderCliSession.stdio.service.ts";
import type * as Crypto from "effect/Crypto";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type * as Stream from "effect/Stream";
import type { ManagedSessionError } from "./AiProviderCliSession.errors.ts";
import type { ManagedSessionObserver, ManagedSessionProcess } from "./AiProviderCliSession.lifecycle.ts";
import type {
  ManagedLaunchProfile,
  ManagedSessionEvent,
  ManagedSessionIdentity,
  ManagedSessionMessage,
  ManagedSessionSteering,
  ManagedTurnResult,
} from "./AiProviderCliSession.models.ts";

const $I = $AiProviderCliId.create("AiProviderCliSession.service");
/**
 * Owned runtime handle; prompts serialize at the next turn boundary.
 * @category ports
 * @since 0.0.0
 */
interface SessionOperations {
  readonly cancel: Effect.Effect<void, ManagedSessionError>;
  readonly close: Effect.Effect<void, ManagedSessionError>;
  prompt(message: ManagedSessionMessage): Effect.Effect<ManagedTurnResult, ManagedSessionError>;
  steer(request: ManagedSessionSteering): Effect.Effect<void, ManagedSessionError>;
}
/**
 * An owned operational handle with immutable identity and event access.
 * **Example** (Inspect a correlated message)
 * ```ts
 * import type { ManagedSession } from "@beep/ai-provider-cli"
 * const inspect = (session: ManagedSession) => session.identity.provider
 * console.log(inspect)
 * ```
 * @category ports
 * @since 0.0.0
 */
export type ManagedSession = SessionOperations &
  Readonly<{
    events: Stream.Stream<ManagedSessionEvent>;
    identity: ManagedSessionIdentity;
    process: ManagedSessionProcess;
  }>;

interface SessionShape {
  readonly open: (
    profile: ManagedLaunchProfile,
    observer?: ManagedSessionObserver
  ) => Effect.Effect<
    ManagedSession,
    ManagedSessionError,
    Scope.Scope | Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
}

const openNative = Effect.fn("AiProviderCliSession.openNative")(function* (
  profile: ManagedLaunchProfile,
  observer?: ManagedSessionObserver
) {
  yield* validateProfile(profile);
  if (profile.provider === "claude") return yield* openClaude(profile, observer);
  if (profile.provider === "codex") yield* prepareCodex(profile).pipe(transportFailure("prepare-profile"));
  const sandboxHash = profile.provider === "grok" ? yield* prepareGrok(profile) : "none";
  return yield* openStdio(profile, sandboxHash, observer);
});

const open = Effect.fn("AiProviderCliSession.open")(
  (profile: ManagedLaunchProfile, observer?: ManagedSessionObserver) =>
    Effect.uninterruptibleMask(
      Effect.fnUntraced(function* (restore) {
        const scope = yield* Scope.fork(yield* Scope.Scope);
        const acquire = Effect.gen(function* () {
          const session = yield* openNative(profile, observer);
          if (observer !== undefined)
            yield* observeManagedSession(
              "observe-bound",
              Effect.suspend(() => observer.bound(session.identity))
            );
          return { ...session, close: session.close.pipe(Effect.onExit((exit) => Scope.close(scope, exit))) };
        });
        return yield* restore(acquire.pipe(Effect.provideService(Scope.Scope, scope))).pipe(
          Effect.onError((cause) => Scope.close(scope, Exit.failCause(cause)))
        );
      })
    )
);

/**
 * Opens one owned native runtime within the caller's scope.
 * **Details** An optional observer receives actual spawn and validated-session
 * evidence. Failed or interrupted initialization closes its child scope before
 * returning; explicit close also releases that scope. Observation failure may
 * follow a committed write, so reconcile the owning attempt instead of retrying
 * open. The driver does not provide a durable launch-attempt fence.
 * **Example** (Inspect the service layer)
 * ```ts
 * import { AiProviderCliSession } from "@beep/ai-provider-cli"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(AiProviderCliSession.layer))
 * ```
 * @category services
 * @since 0.0.0
 */
export class AiProviderCliSession extends Context.Service<AiProviderCliSession, SessionShape>()(
  $I`AiProviderCliSession`
) {
  static readonly layer = Layer.succeed(AiProviderCliSession, { open });
}
