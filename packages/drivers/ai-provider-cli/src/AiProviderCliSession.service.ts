/**
 * Private managed session implementation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AiProviderCliId } from "@beep/identity";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { openClaude } from "./AiProviderCliSession.claude.service.ts";
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
import type * as Scope from "effect/Scope";
import type * as Stream from "effect/Stream";
import type { ManagedSessionError } from "./AiProviderCliSession.errors.ts";
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
  }>;

interface SessionShape {
  readonly open: (
    profile: ManagedLaunchProfile
  ) => Effect.Effect<
    ManagedSession,
    ManagedSessionError,
    Scope.Scope | Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
}

const open = Effect.fn("AiProviderCliSession.open")(function* (profile: ManagedLaunchProfile) {
  yield* validateProfile(profile);
  if (profile.provider === "claude") return yield* openClaude(profile);
  if (profile.provider === "codex") yield* prepareCodex(profile).pipe(transportFailure("prepare-profile"));
  const sandboxHash = profile.provider === "grok" ? yield* prepareGrok(profile) : "none";
  return yield* openStdio(profile, sandboxHash);
});

/**
 * Opens one owned native runtime within the caller's scope.
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
