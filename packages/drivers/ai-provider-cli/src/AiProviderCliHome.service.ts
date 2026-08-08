/**
 * Effect service for provider CLI HOME resolution, child-env construction,
 * and Codex shadow-home maintenance.
 *
 * Mechanics ported from t3code (MIT, Copyright 2026 T3 Tools Inc.)
 * `apps/server/src/provider/Drivers/CodexHomeLayout.ts` and `ClaudeHome.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeOS from "node:os";
import { $AiProviderCliId } from "@beep/identity";
import * as HostPath from "@beep/utils/Path";
import { Context, Effect, FileSystem, flow, Layer, Match, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  AiProviderCliHomeEntryConflictError,
  AiProviderCliHomeFileSystemError,
  AiProviderCliHomePathConflictError,
  AiProviderCliHomePrivateEntrySymlinkError,
} from "./AiProviderCliHome.errors.ts";
import {
  AiProviderCliCodexHomeLayout,
  AiProviderCliCodexLocalEntry,
  AiProviderCliCodexPrivateEntry,
  AiProviderCliCodexSharedDirectory,
  AiProviderCliHomeMode,
} from "./AiProviderCliHome.models.ts";
import type * as PlatformError from "effect/PlatformError";
import type { AiProviderCliHomeError, AiProviderCliHomeFsOperation } from "./AiProviderCliHome.errors.ts";

const $I = $AiProviderCliId.create("AiProviderCliHome.service");

/**
 * Runtime shape exposed by the provider CLI home service.
 *
 * @category services
 * @since 0.0.0
 */
interface AiProviderCliHomeShape {
  readonly ensureCodexShadowHome: (layout: AiProviderCliCodexHomeLayout) => Effect.Effect<void, AiProviderCliHomeError>;
  readonly makeClaudeEnv: (input: {
    readonly baseEnv: Readonly<Record<string, string>>;
    readonly homePath: O.Option<string>;
  }) => Readonly<Record<string, string>>;
  readonly makeCodexEnv: (input: {
    readonly baseEnv: Readonly<Record<string, string>>;
    readonly layout: AiProviderCliCodexHomeLayout;
  }) => Readonly<Record<string, string>>;
  readonly resolveClaudeHome: (homePath: O.Option<string>) => string;
  readonly resolveCodexHomeLayout: (input: {
    readonly homePath: O.Option<string>;
    readonly shadowHomePath: O.Option<string>;
  }) => AiProviderCliCodexHomeLayout;
}

/** Shared/effective home pair threaded through shadow-home maintenance. */
interface HomeContext {
  readonly effectiveHomePath: string;
  readonly sharedHomePath: string;
}

const LinkState = S.TaggedUnion({
  Missing: {},
  NotSymlink: {},
  Symlink: { target: S.String },
});
type LinkState = typeof LinkState.Type;

const linkMissing: LinkState = { _tag: "Missing" };
const linkNotSymlink: LinkState = { _tag: "NotSymlink" };
const linkSymlink = (target: string): LinkState => ({ _tag: "Symlink", target });

const isPrivateEntry = S.is(AiProviderCliCodexPrivateEntry);
const isLocalEntry = S.is(AiProviderCliCodexLocalEntry);

const isEinvalCause = (cause: unknown): boolean =>
  P.isObject(cause) && P.hasProperty(cause, "code") && cause.code === "EINVAL";

// `readLink` on a regular file/directory surfaces as EINVAL, which the
// platform layer normalizes to the `Unknown` reason tag.
const isNotSymlinkFailure = (error: PlatformError.PlatformError): boolean =>
  error.reason._tag === "Unknown" && isEinvalCause(error.reason.cause);

// Drop configured values that are unset or whitespace-only.
const configuredPath = flow(O.map(Str.trim), O.filter(Str.isNonEmpty));

/**
 * Expands a leading `~` or `~/` segment to the current user's home directory.
 *
 * **Details**
 *
 * Spawned CLI processes get no shell expansion, so configured HOME and
 * executable paths that start with a tilde must be expanded before they reach
 * the process runner.
 *
 * **Example** (Expand tilde to home)
 *
 * ```ts
 * import * as NodeOS from "node:os"
 * import { expandTildePath } from "@beep/ai-provider-cli"
 *
 * console.log(expandTildePath("~") === NodeOS.homedir()) // true
 * console.log(expandTildePath("/usr/bin/claude")) // "/usr/bin/claude"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const expandTildePath: (value: string) => string = Match.type<string>().pipe(
  Match.when("~", () => NodeOS.homedir()),
  Match.whenOr(Str.startsWith("~/"), Str.startsWith("~\\"), (value) =>
    HostPath.join(NodeOS.homedir(), pipe(value, Str.slice(2)))
  ),
  Match.orElse((value) => value)
);

const makeHome = (fs: FileSystem.FileSystem, path: Path.Path): AiProviderCliHomeShape => {
  const expandTilde = expandTildePath;

  const resolveClaudeHome: AiProviderCliHomeShape["resolveClaudeHome"] = (homePath) =>
    path.resolve(configuredPath(homePath).pipe(O.map(expandTilde), O.getOrElse(NodeOS.homedir)));

  const makeClaudeEnv: AiProviderCliHomeShape["makeClaudeEnv"] = (input) =>
    configuredPath(input.homePath).pipe(
      O.match({
        onNone: () => input.baseEnv,
        onSome: (configured) => ({ ...input.baseEnv, HOME: path.resolve(expandTilde(configured)) }),
      })
    );

  const resolveCodexHomeLayout: AiProviderCliHomeShape["resolveCodexHomeLayout"] = (input) => {
    const configuredHome = configuredPath(input.homePath);
    const sharedHomePath = path.resolve(
      configuredHome.pipe(
        O.map(expandTilde),
        O.getOrElse(() => path.join(NodeOS.homedir(), ".codex"))
      )
    );

    return configuredPath(input.shadowHomePath).pipe(
      O.match({
        onNone: () =>
          AiProviderCliCodexHomeLayout.make({
            effectiveHomePath: O.map(configuredHome, () => sharedHomePath),
            mode: "direct",
            sharedHomePath,
          }),
        onSome: (shadow) =>
          AiProviderCliCodexHomeLayout.make({
            effectiveHomePath: O.some(path.resolve(expandTilde(shadow))),
            mode: "authOverlay",
            sharedHomePath,
          }),
      })
    );
  };

  const makeCodexEnv: AiProviderCliHomeShape["makeCodexEnv"] = (input) =>
    O.match(input.layout.effectiveHomePath, {
      onNone: () => input.baseEnv,
      onSome: (effectiveHomePath) => ({ ...input.baseEnv, CODEX_HOME: effectiveHomePath }),
    });

  const fsFailure =
    (input: {
      readonly context: HomeContext;
      readonly entryName: O.Option<string>;
      readonly operation: AiProviderCliHomeFsOperation;
      readonly path: string;
      readonly targetPath: O.Option<string>;
    }) =>
    (cause: PlatformError.PlatformError) =>
      Effect.fail(
        AiProviderCliHomeFileSystemError.make({
          cause: O.some(cause),
          effectiveHomePath: input.context.effectiveHomePath,
          entryName: input.entryName,
          operation: input.operation,
          path: input.path,
          sharedHomePath: input.context.sharedHomePath,
          targetPath: input.targetPath,
        })
      );

  const readLinkState = Effect.fn("AiProviderCliHome.readLinkState")(function* (input: {
    readonly context: HomeContext;
    readonly entryName: string;
    readonly linkPath: string;
  }) {
    return yield* fs.readLink(input.linkPath).pipe(
      Effect.map(linkSymlink),
      Effect.catchTag("PlatformError", (cause) =>
        Match.value(cause).pipe(
          Match.when(
            (error: PlatformError.PlatformError) => error.reason._tag === "NotFound",
            () => Effect.succeed(linkMissing)
          ),
          Match.when(isNotSymlinkFailure, () => Effect.succeed(linkNotSymlink)),
          Match.orElse(
            fsFailure({
              context: input.context,
              entryName: O.some(input.entryName),
              operation: "readLink",
              path: input.linkPath,
              targetPath: O.none(),
            })
          )
        )
      )
    );
  });

  const ensureSymlink = Effect.fn("AiProviderCliHome.ensureSymlink")(function* (input: {
    readonly context: HomeContext;
    readonly entryName: string;
  }) {
    const target = path.join(input.context.sharedHomePath, input.entryName);
    const link = path.join(input.context.effectiveHomePath, input.entryName);
    const state = yield* readLinkState({ context: input.context, entryName: input.entryName, linkPath: link });

    const createLink = fs.symlink(target, link).pipe(
      Effect.catchTag(
        "PlatformError",
        fsFailure({
          context: input.context,
          entryName: O.some(input.entryName),
          operation: "symlink",
          path: link,
          targetPath: O.some(target),
        })
      )
    );

    yield* LinkState.match<Effect.Effect<void, AiProviderCliHomeFileSystemError | AiProviderCliHomeEntryConflictError>>(
      state,
      {
        Missing: () => createLink,
        NotSymlink: () =>
          Effect.fail(
            AiProviderCliHomeEntryConflictError.make({
              effectiveHomePath: input.context.effectiveHomePath,
              entryName: input.entryName,
              linkPath: link,
              sharedHomePath: input.context.sharedHomePath,
              targetPath: target,
            })
          ),
        Symlink: ({ target: existingTarget }) =>
          path.resolve(path.dirname(link), existingTarget) === target
            ? Effect.void
            : fs.remove(link).pipe(
                Effect.catchTag(
                  "PlatformError",
                  fsFailure({
                    context: input.context,
                    entryName: O.some(input.entryName),
                    operation: "remove",
                    path: link,
                    targetPath: O.none(),
                  })
                ),
                Effect.flatMap(() => createLink)
              ),
      }
    );
  });

  const removePrivateSymlink = Effect.fn("AiProviderCliHome.removePrivateSymlink")(function* (input: {
    readonly context: HomeContext;
    readonly entryName: string;
  }) {
    const privatePath = path.join(input.context.effectiveHomePath, input.entryName);
    const state = yield* readLinkState({
      context: input.context,
      entryName: input.entryName,
      linkPath: privatePath,
    });

    yield* LinkState.match<Effect.Effect<void, AiProviderCliHomeFileSystemError>>(state, {
      Missing: () => Effect.void,
      NotSymlink: () => Effect.void,
      Symlink: () =>
        fs.remove(privatePath).pipe(
          Effect.catchTag(
            "PlatformError",
            fsFailure({
              context: input.context,
              entryName: O.some(input.entryName),
              operation: "remove",
              path: privatePath,
              targetPath: O.none(),
            })
          )
        ),
    });
  });

  const ensureShadowAuthIsPrivate = Effect.fn("AiProviderCliHome.ensureShadowAuthIsPrivate")(function* (
    context: HomeContext
  ) {
    const entryName = AiProviderCliCodexPrivateEntry.Enum["auth.json"];
    const authPath = path.join(context.effectiveHomePath, entryName);
    const state = yield* readLinkState({ context, entryName, linkPath: authPath });

    yield* LinkState.match<Effect.Effect<void, AiProviderCliHomePrivateEntrySymlinkError>>(state, {
      Missing: () => Effect.void,
      NotSymlink: () => Effect.void,
      Symlink: () =>
        Effect.fail(
          AiProviderCliHomePrivateEntrySymlinkError.make({
            effectiveHomePath: context.effectiveHomePath,
            entryName,
            path: authPath,
            sharedHomePath: context.sharedHomePath,
          })
        ),
    });
  });

  const materializeShadowHome = Effect.fn("AiProviderCliHome.materializeShadowHome")(function* (context: HomeContext) {
    yield* context.sharedHomePath === context.effectiveHomePath
      ? Effect.fail(
          AiProviderCliHomePathConflictError.make({
            effectiveHomePath: context.effectiveHomePath,
            sharedHomePath: context.sharedHomePath,
          })
        )
      : Effect.void;

    const makeDirectory = (directoryPath: string) =>
      fs.makeDirectory(directoryPath, { recursive: true }).pipe(
        Effect.catchTag(
          "PlatformError",
          fsFailure({
            context,
            entryName: O.none(),
            operation: "makeDirectory",
            path: directoryPath,
            targetPath: O.none(),
          })
        )
      );

    yield* Effect.all(
      [
        makeDirectory(context.sharedHomePath),
        makeDirectory(context.effectiveHomePath),
        ...A.map(AiProviderCliCodexSharedDirectory.Options, (directory) =>
          makeDirectory(path.join(context.sharedHomePath, directory))
        ),
      ],
      { concurrency: "unbounded" }
    );

    const sharedEntryNames = yield* fs.readDirectory(context.sharedHomePath).pipe(
      Effect.catchTag(
        "PlatformError",
        fsFailure({
          context,
          entryName: O.none(),
          operation: "readDirectory",
          path: context.sharedHomePath,
          targetPath: O.none(),
        })
      )
    );

    const linkedEntries = A.dedupe(
      A.appendAll(
        AiProviderCliCodexSharedDirectory.Options,
        A.filter(sharedEntryNames, (entryName) => !isPrivateEntry(entryName) && !isLocalEntry(entryName))
      )
    );

    // Stale private symlinks other than auth.json are silently removed;
    // auth.json is validated below and refused when it is a symlink.
    yield* Effect.forEach(
      AiProviderCliCodexPrivateEntry.omitOptions(["auth.json"]),
      (entryName) => removePrivateSymlink({ context, entryName }),
      { discard: true }
    );

    yield* Effect.forEach(linkedEntries, (entryName) => ensureSymlink({ context, entryName }), { discard: true });

    yield* ensureShadowAuthIsPrivate(context);
  });

  const ensureCodexShadowHome = Effect.fn("AiProviderCliHome.ensureCodexShadowHome")(function* (
    layout: AiProviderCliCodexHomeLayout
  ) {
    yield* AiProviderCliHomeMode.$match(layout.mode, {
      direct: () => Effect.void,
      authOverlay: () =>
        O.match(layout.effectiveHomePath, {
          onNone: () => Effect.void,
          onSome: (effectiveHomePath) =>
            materializeShadowHome({ effectiveHomePath, sharedHomePath: layout.sharedHomePath }),
        }),
    });
  });

  return {
    ensureCodexShadowHome,
    makeClaudeEnv,
    makeCodexEnv,
    resolveClaudeHome,
    resolveCodexHomeLayout,
  };
};

/**
 * Effect service for provider CLI home isolation mechanics.
 *
 * **Details**
 *
 * Claude instances are isolated by pointing `HOME` at a dedicated directory;
 * Codex instances are isolated by pointing `CODEX_HOME` at either the shared
 * home (`direct`) or a shadow home (`authOverlay`). `ensureCodexShadowHome`
 * materializes the shadow layout: shared directories become symlinks into the
 * shared home, private credential entries (`auth.json`, `models_cache.json`)
 * stay real files, and a symlinked `auth.json` is refused.
 *
 * **Example** (Ensure Codex shadow home)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { AiProviderCliHome } from "@beep/ai-provider-cli"
 *
 * const program = Effect.gen(function* () {
 *   const home = yield* AiProviderCliHome
 *   const layout = home.resolveCodexHomeLayout({
 *     homePath: O.some("~/.codex"),
 *     shadowHomePath: O.some("~/.codex-work")
 *   })
 *   yield* home.ensureCodexShadowHome(layout)
 *   return home.makeCodexEnv({ baseEnv: {}, layout })
 * })
 *
 * console.log(program)
 * ```
 *
 * @effects
 * `ensureCodexShadowHome` creates directories and manages symlinks beneath
 * the configured shared and shadow home paths through the provided
 * `FileSystem`; the resolve and env helpers perform no filesystem writes.
 * @category services
 * @since 0.0.0
 */
export class AiProviderCliHome extends Context.Service<AiProviderCliHome, AiProviderCliHomeShape>()(
  $I`AiProviderCliHome`
) {
  /**
   * Live provider CLI home layer backed by platform `FileSystem` and `Path`.
   *
   * **Example** (Access live home layer)
   *
   * ```ts
   * import { AiProviderCliHome } from "@beep/ai-provider-cli"
   *
   * const layer = AiProviderCliHome.layer
   *
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<AiProviderCliHome, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
    AiProviderCliHome,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      return AiProviderCliHome.of(makeHome(fs, path));
    })
  );
}
