/**
 * The hook-pulse hash namespace: which salt pseudonymizes `sessionId`, `cwd`
 * and `transcriptPath`, and the dated global projection that fixes it for every
 * harness child on a workstation.
 *
 * **Details**
 *
 * `.claude/hooks/hook-pulse.sh` and the TypeScript half resolve the salt through
 * the same four rungs, in order: `BEEP_HOOK_PULSE_HASH_SALT`, the owned
 * projection file, `BEEP_AI_METRICS_HASH_SALT`, and the library default. The
 * projection file is the operator-ruled single global projection
 * (`~/.cache/beep/telemetry/namespace-projection.json`, issue #1865): it carries
 * the salt every hook child uses regardless of its launcher's environment, plus
 * the UTC cutover instant that separates the new regime from the historical ones.
 * Rows written before the cutover stay under the salt their session had at the
 * time; readers join under both the current salt and the previous regime and
 * never fold the two into one measurement window.
 *
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { XdgBase } from "@beep/xdg/XdgBase";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AI_METRICS_LOCAL_INSECURE_HASH_SALT, resolveAiMetricsHashSaltValue } from "./privacy.ts";
import type * as Path from "effect/Path";

const $I = $RepoAiMetricsId.create("hook-pulse-namespace");

/**
 * Regime the rows written before a projection's cutover belong to.
 *
 * **Details**
 *
 * `library-default` means those rows were hashed with
 * `AI_METRICS_LOCAL_INSECURE_HASH_SALT` because their session exported neither
 * salt variable (a desktop-launched harness child, for example). A projection
 * names the regime it supersedes so a reader can rebuild the previous namespace
 * without guessing.
 *
 * **Example** (The one supported previous regime)
 *
 * ```ts
 * import { HookPulseNamespaceRegime } from "@beep/repo-ai-metrics"
 *
 * console.log(HookPulseNamespaceRegime.literals) // ["library-default"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseNamespaceRegime = LiteralKit(["library-default"]).pipe(
  $I.annoteSchema("HookPulseNamespaceRegime", {
    description: "Salt regime that a namespace projection supersedes.",
  })
);
/**
 * Decoded HookPulseNamespaceRegime value.
 * @category models
 * @since 0.0.0
 */
export type HookPulseNamespaceRegime = typeof HookPulseNamespaceRegime.Type;

/**
 * Where the resolved hook-pulse salt came from.
 *
 * **Example** (Rungs in precedence order)
 *
 * ```ts
 * import { HookPulseNamespaceSource } from "@beep/repo-ai-metrics"
 *
 * console.log(HookPulseNamespaceSource.literals)
 * // ["hook-pulse-env", "projection", "ai-metrics-env", "library-default"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseNamespaceSource = LiteralKit([
  "hook-pulse-env",
  "projection",
  "ai-metrics-env",
  "library-default",
]).pipe(
  $I.annoteSchema("HookPulseNamespaceSource", {
    description: "Rung of the salt chain that supplied the hook-pulse hash salt.",
  })
);
/**
 * Decoded HookPulseNamespaceSource value.
 * @category models
 * @since 0.0.0
 */
export type HookPulseNamespaceSource = typeof HookPulseNamespaceSource.Type;

const SupportedSaltText = S.String.check(S.isPattern(/^[^\u0000-\u001f\u007f-\u009f]*(?![\s\S])/)).pipe(
  $I.annoteSchema("SupportedSaltText", {
    description: "Salt text without control characters that shell variables cannot preserve safely.",
  })
);
const isSupportedSaltText = S.is(SupportedSaltText);

const ProjectionHashSalt = SupportedSaltText.check(S.isPattern(/\S/)).pipe(
  $I.annoteSchema("ProjectionHashSalt", {
    description: "Hook-pulse hash salt carried by the projection; whitespace-only is invalid, never a silent fallback.",
  })
);

// Restrict the wire instant before DateTime's permissive parser can normalize
// impossible calendar dates. The shell validates this same UTC wire format.
const ProjectionCutover = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/),
  S.makeFilter(
    (text) =>
      O.exists(
        DateTime.make(text),
        (instant) => DateTime.formatIso(instant) === (Str.length(text) === 20 ? `${Str.slice(0, -1)(text)}.000Z` : text)
      ),
    $I.annote("ProjectionCutoverCalendar", {
      title: "Valid UTC cutover",
      description: "A real UTC calendar instant, without parser normalization.",
      message: "Expected a valid UTC cutover instant.",
    })
  )
).pipe(
  S.decodeTo(S.DateTimeUtcFromString),
  $I.annoteSchema("ProjectionCutover", {
    description: "A real UTC cutover at second or millisecond precision, without calendar normalization.",
  })
);

/**
 * The owned global projection file: one salt and one dated cutover.
 *
 * **Details**
 *
 * The file is one JSON document with these required keys; extra keys are ignored.
 * `cutoverUtc` is the instant the
 * projection was applied; rows timestamped before it belong to
 * `previousRegime`. The shell writer reads `hashSalt` with `jq` and refuses to
 * write a row when the file exists but does not decode, so a damaged projection
 * fails closed on both halves instead of silently splitting the namespace.
 *
 * **Example** (Decode a projection document)
 *
 * ```ts
 * import { HookPulseNamespaceProjection } from "@beep/repo-ai-metrics"
 * import * as Result from "effect/Result"
 *
 * const decoded = HookPulseNamespaceProjection.decodeJsonResult(
 *   '{"version":1,"cutoverUtc":"2026-11-02T04:00:00.000Z","hashSalt":"example","previousRegime":"library-default"}'
 * )
 * console.log(Result.isSuccess(decoded)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HookPulseNamespaceProjection extends S.Opaque<
  HookPulseNamespaceProjection,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag(1),
    cutoverUtc: ProjectionCutover,
    hashSalt: ProjectionHashSalt,
    previousRegime: HookPulseNamespaceRegime,
  }).pipe(
    $I.annoteSchema("HookPulseNamespaceProjection", {
      description:
        "Owned global hook-pulse namespace projection: current salt, UTC cutover, and the regime it supersedes.",
    })
  )
) {
  static readonly decodeJsonResult = S.decodeResult(S.fromJsonString(HookPulseNamespaceProjection));
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(HookPulseNamespaceProjection));
  static readonly encodeJsonEffect = S.encodeEffect(S.fromJsonString(HookPulseNamespaceProjection));
}

/**
 * Typed failure raised when the projection file exists but cannot be used.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { HookPulseNamespaceError } from "@beep/repo-ai-metrics"
 *
 * const error = HookPulseNamespaceError.new("Projection is a symlink.", { kind: "symlink" })
 * console.log(error._tag) // "HookPulseNamespaceError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HookPulseNamespaceError extends S.TaggedError<HookPulseNamespaceError, { readonly brand: unique symbol }>(
  $I`HookPulseNamespaceError`
)(
  "HookPulseNamespaceError",
  {
    cause: S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent)),
    message: S.String,
  },
  $I.annoteError<HookPulseNamespaceError>("HookPulseNamespaceError", {
    description: "The hook-pulse namespace projection exists but is unreadable, a symlink, or undecodable.",
  })
) {
  static readonly new = (message: string, _cause: unknown): HookPulseNamespaceError =>
    HookPulseNamespaceError.make({ message, cause: { kind: "namespace-invalid" } });
  static readonly wrap =
    (message: string) =>
    (cause: unknown): HookPulseNamespaceError =>
      HookPulseNamespaceError.new(message, cause);
}

const projectionRelativePath = "beep/telemetry/namespace-projection.json";

/**
 * Where the owned projection file lives, resolved exactly as the shell writer resolves it.
 *
 * **Details**
 *
 * `BEEP_HOOK_PULSE_NAMESPACE_PROJECTION` names the file outright (fixtures use
 * it); otherwise the file is `beep/telemetry/namespace-projection.json` under the
 * XDG cache home (`$XDG_CACHE_HOME`, else `$HOME/.cache`). The shell mirror is
 * `${BEEP_HOOK_PULSE_NAMESPACE_PROJECTION:-${XDG_CACHE_HOME:-$HOME/.cache}/beep/telemetry/namespace-projection.json}`.
 * Absent means no home directory could be resolved either, which only happens in
 * scrubbed environments; the salt chain then skips this rung.
 *
 * **Example** (Resolve from a fixed provider)
 *
 * ```ts
 * import { hookPulseNamespaceProjectionPath } from "@beep/repo-ai-metrics"
 * import * as ConfigProvider from "effect/ConfigProvider";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const provider = ConfigProvider.fromUnknown({ HOME: "/home/ada" })
 * console.log(O.getOrNull(Effect.runSync(hookPulseNamespaceProjectionPath.parse(provider))))
 * // /home/ada/.cache/beep/telemetry/namespace-projection.json
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const hookPulseNamespaceProjectionPath: Config.Config<O.Option<string>> = Config.String(
  "BEEP_HOOK_PULSE_NAMESPACE_PROJECTION"
).pipe(
  Config.option,
  Config.flatMap((explicit) =>
    O.match(O.filter(explicit, Str.isNonEmpty), {
      onSome: (file) => Config.succeed(O.some(file)),
      onNone: () => XdgBase.dir("cache").pipe(Config.map(O.map((cache) => `${cache}/${projectionRelativePath}`))),
    })
  )
);

/**
 * Read the owned projection: `None` when the file is absent, a typed failure when it exists but cannot be trusted.
 *
 * **Details**
 *
 * A symlinked projection is refused rather than followed: the apply script
 * never writes one, so a link there is drift. An unreadable or undecodable file
 * fails too. Both match the shell writer, which refuses the row with
 * `namespace-projection-invalid` in the same cases, so neither half ever falls
 * back to a different salt than the other.
 *
 * **Example** (Absent projection resolves to none)
 *
 * ```ts
 * import { readHookPulseNamespaceProjection } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 *
 * const program = readHookPulseNamespaceProjection.pipe(
 *   Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
 *   Effect.provide(NodeServices.layer)
 * )
 * console.log(typeof program) // "object"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const readHookPulseNamespaceProjection: Effect.Effect<
  O.Option<HookPulseNamespaceProjection>,
  HookPulseNamespaceError,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const file = yield* hookPulseNamespaceProjectionPath.pipe(
    Effect.mapError(HookPulseNamespaceError.wrap("Cannot resolve the hook-pulse namespace projection path."))
  );
  if (O.isNone(file)) return O.none<HookPulseNamespaceProjection>();
  // Inspect links before exists(), which follows targets and hides dangling links.
  const link = yield* fs.readLink(file.value).pipe(Effect.option);
  if (O.isSome(link)) {
    return yield* HookPulseNamespaceError.new("Hook-pulse namespace projection must not be a symlink.", {
      kind: "symlink",
    });
  }
  const exists = yield* fs
    .exists(file.value)
    .pipe(Effect.mapError(HookPulseNamespaceError.wrap("Cannot inspect the hook-pulse namespace projection.")));
  if (!exists) return O.none<HookPulseNamespaceProjection>();
  const info = yield* fs
    .stat(file.value)
    .pipe(Effect.mapError(HookPulseNamespaceError.wrap("Cannot stat the hook-pulse namespace projection.")));
  if (info.type !== "File") {
    return yield* HookPulseNamespaceError.new("Hook-pulse namespace projection must be a regular file.", {
      kind: info.type,
      file: file.value,
    });
  }
  const text = yield* fs
    .readFileString(file.value)
    .pipe(Effect.mapError(HookPulseNamespaceError.wrap("Cannot read the hook-pulse namespace projection.")));
  const pipe1 = yield* HookPulseNamespaceProjection.decodeJsonEffect(text).pipe(
    Effect.mapError(HookPulseNamespaceError.wrap("Hook-pulse namespace projection does not decode."))
  );
  return O.some(pipe1);
});

/**
 * One salt the join resolves under, tagged with the regime it belongs to.
 *
 * **Example** (Describe the current regime)
 *
 * ```ts
 * import { HookPulseNamespaceSalt } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const current = HookPulseNamespaceSalt.make({ regime: "current", hashSalt: O.some("salt") })
 * console.log(current.regime) // "current"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HookPulseNamespaceSalt extends S.Opaque<HookPulseNamespaceSalt, { readonly brand: unique symbol }>()(
  S.Struct({
    regime: LiteralKit(["current", "previous"]),
    hashSalt: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("HookPulseNamespaceSalt", {
      description: "A hash salt the reader joins under, tagged current or previous regime.",
    })
  )
) {}

/**
 * The resolved hook-pulse namespace: current salt, its source, and the projection when one is applied.
 *
 * **Details**
 *
 * {@link hookPulseNamespaceSalts} lists the current salt first and, when a
 * projection is applied and its previous regime differs from the current salt,
 * the previous regime's salt second (`None`, the library default). Readers hash
 * transcript identities under every listed salt and report matches per regime;
 * they never merge the two regimes into one window.
 *
 * **Example** (Describe a namespace without a projection)
 *
 * ```ts
 * import { HookPulseNamespace } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const namespace = HookPulseNamespace.make({ hashSalt: O.none(), source: "library-default", projection: O.none() })
 * console.log(namespace.source) // "library-default"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HookPulseNamespace extends S.Opaque<HookPulseNamespace, { readonly brand: unique symbol }>()(
  S.Struct({
    hashSalt: S.Option(S.String),
    source: HookPulseNamespaceSource,
    projection: S.Option(HookPulseNamespaceProjection),
  }).pipe(
    $I.annoteSchema("HookPulseNamespace", {
      description: "Resolved hook-pulse hash namespace: current salt, its rung, and the applied projection when any.",
    })
  )
) {}

/**
 * The salts a reader joins under: the current salt first, then the superseded regime's salt when a projection applies.
 *
 * **Details**
 *
 * With no projection, or when the current salt already is the library default,
 * there is one entry. With a projection whose `previousRegime` is
 * `library-default`, the second entry carries `None`, which
 * `hashPrivateIdentifier` resolves to `AI_METRICS_LOCAL_INSECURE_HASH_SALT`.
 *
 * **Example** (One salt without a projection)
 *
 * ```ts
 * import { HookPulseNamespace, hookPulseNamespaceSalts } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const namespace = HookPulseNamespace.make({ hashSalt: O.none(), source: "library-default", projection: O.none() })
 * console.log(hookPulseNamespaceSalts(namespace).length) // 1
 * ```
 *
 * @param namespace - The resolved namespace.
 * @returns The current salt first, then the previous regime's salt when a projection applies.
 * @category utilities
 * @since 0.0.0
 */
export const hookPulseNamespaceSalts = (
  namespace: HookPulseNamespace
): A.NonEmptyReadonlyArray<HookPulseNamespaceSalt> => {
  const current = HookPulseNamespaceSalt.make({ regime: "current", hashSalt: namespace.hashSalt });
  return O.match(namespace.projection, {
    onNone: () => A.of(current),
    onSome: (projection) =>
      HookPulseNamespaceRegime.match(projection.previousRegime, {
        "library-default": () =>
          resolveAiMetricsHashSaltValue(namespace.hashSalt) === AI_METRICS_LOCAL_INSECURE_HASH_SALT
            ? A.of(current)
            : A.make(current, HookPulseNamespaceSalt.make({ regime: "previous", hashSalt: O.none() })),
      }),
  });
};

/**
 * The projection's cutover instant in epoch milliseconds, absent without a projection.
 *
 * **Example** (No projection, no cutover)
 *
 * ```ts
 * import { HookPulseNamespace, hookPulseNamespaceCutoverMillis } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const namespace = HookPulseNamespace.make({ hashSalt: O.none(), source: "library-default", projection: O.none() })
 * console.log(O.isNone(hookPulseNamespaceCutoverMillis(namespace))) // true
 * ```
 *
 * @param namespace - The resolved namespace.
 * @returns The cutover as epoch milliseconds, or `None` without a projection.
 * @category utilities
 * @since 0.0.0
 */
export const hookPulseNamespaceCutoverMillis = (namespace: HookPulseNamespace): O.Option<number> =>
  O.map(namespace.projection, (projection) => DateTime.toEpochMillis(projection.cutoverUtc));

const nonBlank = (value: O.Option<string>): O.Option<string> =>
  O.filter(value, (text) => Str.isNonEmpty(Str.trim(text)));

/**
 * Resolve the hook-pulse namespace through the same chain as `.claude/hooks/hook-pulse.sh`.
 *
 * **Details**
 *
 * Rungs, in order: `BEEP_HOOK_PULSE_HASH_SALT`; the owned projection file; `BEEP_AI_METRICS_HASH_SALT`;
 * the library default. The projection outranks the repo-wide ai-metrics variable
 * on purpose: it is the global projection of this instrument's namespace, and
 * only an explicit per-instrument override may displace it. Environment
 * variables are read through `Config`, so a test pins a `ConfigProvider` and a
 * replay pass can reproduce a pre-cutover corpus by pinning a provider that
 * carries neither variable and no projection path.
 *
 * **Gotchas**
 *
 * An empty or whitespace-only environment rung is treated as absent. Control
 * characters are refused before fallthrough, and significant spaces are preserved.
 * An explicit instrument override bypasses the projection, including its cutover. {@link hookPulseHashSalt}
 * keeps its documented two-rung behaviour for the codec; this resolver is for
 * readers (reconciliation, the forwarder) that can open the projection file.
 *
 * **Example** (Resolve under a pinned environment)
 *
 * ```ts
 * import { hookPulseNamespace } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 *
 * const program = hookPulseNamespace.pipe(
 *   Effect.provideService(
 *     ConfigProvider.ConfigProvider,
 *     ConfigProvider.fromUnknown({ BEEP_HOOK_PULSE_HASH_SALT: "fixture" })
 *   ),
 *   Effect.provide(NodeServices.layer)
 * )
 * console.log(typeof program) // "object"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const hookPulseNamespace: Effect.Effect<
  HookPulseNamespace,
  HookPulseNamespaceError,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function* () {
  const readRung = (name: string) =>
    Config.String(name).pipe(
      Config.option,
      Effect.mapError(HookPulseNamespaceError.wrap(`Cannot read ${name}.`)),
      Effect.flatMap((value) =>
        O.isSome(value) && !isSupportedSaltText(value.value)
          ? Effect.fail(
              HookPulseNamespaceError.new("Hook-pulse hash salt contains unsupported control characters.", {})
            )
          : value.pipe(nonBlank, Effect.succeed)
      )
    );
  const instrument = yield* readRung("BEEP_HOOK_PULSE_HASH_SALT");
  if (O.isSome(instrument)) {
    return HookPulseNamespace.make({ hashSalt: instrument, source: "hook-pulse-env", projection: O.none() });
  }
  const projection = yield* readHookPulseNamespaceProjection;
  if (O.isSome(projection)) {
    return HookPulseNamespace.make({
      hashSalt: O.some(projection.value.hashSalt),
      source: "projection",
      projection,
    });
  }
  const repoWide = yield* readRung("BEEP_AI_METRICS_HASH_SALT");
  return O.isSome(repoWide)
    ? HookPulseNamespace.make({ hashSalt: repoWide, source: "ai-metrics-env", projection })
    : HookPulseNamespace.make({ hashSalt: O.none(), source: "library-default", projection });
});
