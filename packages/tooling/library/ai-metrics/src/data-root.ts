/**
 * Canonical AI metrics data-root precedence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, FilePath, Fn, LiteralKit, SchemaUtils, WindowsDrivePath, WindowsUncPath } from "@beep/schema";
import { Str } from "@beep/utils";
import { Effect, pipe, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AiMetricsDeployTarget } from "./models.ts";

const $I = $RepoAiMetricsId.create("data-root");

const dankserverDataRoot = "/srv/data/ai-metrics";

const NonBlankStringInput = S.Union([S.String, S.Option(S.String)]);
const OptionalNonBlank = S.optionalKey(NonBlankStringInput).pipe(
  S.decodeTo(
    S.Option(S.String),
    SchemaTransformation.transformOptional({
      decode: (value) =>
        O.some(
          pipe(
            value,
            O.flatMap((input) => (O.isOption(input) ? input : O.some(input))),
            O.map(Str.trim),
            O.filter(Str.isNonEmpty)
          )
        ),
      encode: O.flatten,
    })
  ),
  SchemaUtils.withNoneDefault
);

const AiMetricsAbsoluteDataRootCheck = S.makeFilter(
  (value: FilePath) => pipe(value, Str.startsWith("/")) || WindowsDrivePath.is(value) || WindowsUncPath.is(value),
  {
    identifier: $I`AiMetricsAbsoluteDataRootCheck`,
    title: "AI Metrics Absolute Data Root",
    description: "A non-root absolute POSIX, Windows drive, or Windows UNC file path.",
    message: "AI metrics data root must be an absolute path with a non-root leaf segment",
  }
);

/**
 * Branded absolute, non-root filesystem path safe for AI metrics persistence.
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsAbsoluteDataRoot = FilePath.check(AiMetricsAbsoluteDataRootCheck).pipe(
  S.brand("AiMetricsAbsoluteDataRoot"),
  SchemaUtils.withEffectCodecStatics,
  $I.annoteSchema("AiMetricsAbsoluteDataRoot", {
    description: "Absolute non-root filesystem path accepted for an AI metrics data root.",
  })
);

/**
 * Runtime type for {@link AiMetricsAbsoluteDataRoot}.
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsAbsoluteDataRoot = typeof AiMetricsAbsoluteDataRoot.Type;

const withoutTrailingSlash = (value: string): string =>
  pipe(value, Str.replace(/\/+$/u, ""), (trimmed) => (Str.isEmpty(trimmed) ? value : trimmed));

/**
 * Precedence rung that produced a resolved AI metrics data root.
 *
 * **Details**
 *
 * The rung is recorded rather than inferred because the same absolute path can
 * arrive from an operator flag, from `BEEP_AI_METRICS_DATA_ROOT`, or from the
 * XDG default, and a store whose provenance is unknown is exactly the failure
 * this module exists to rule out. `target-default` is reserved for the
 * dankserver deploy target, whose root is a server-owned location rather than a
 * per-user state directory.
 *
 * **Example** (Reading the rung off a resolved root)
 *
 * ```ts
 * import { AiMetricsDataRootSource } from "@beep/repo-ai-metrics"
 *
 * console.log(AiMetricsDataRootSource.Enum.flag) // "flag"
 * console.log(AiMetricsDataRootSource.is.flag("environment")) // false
 * ```
 *
 * @see {@link resolveAiMetricsDataRoot} for the precedence that assigns it.
 * @category models
 * @since 0.0.0
 */
export const AiMetricsDataRootSource = LiteralKit(["flag", "environment", "xdg-state-home", "target-default"]).pipe(
  $I.annoteSchema("AiMetricsDataRootSource", {
    description: "Precedence rung that produced a resolved AI metrics data root.",
  })
);

/**
 * Decoded precedence rung carried by a resolved AI metrics data root.
 *
 * @see {@link AiMetricsDataRootSource} for the runtime schema, its guards, and its enum keys.
 * @category models
 * @since 0.0.0
 */
export type AiMetricsDataRootSource = typeof AiMetricsDataRootSource.Type;

type AiMetricsDataRootRung = {
  readonly path: string;
  readonly source: AiMetricsDataRootSource;
};

/**
 * Everything the data-root precedence needs, gathered at the process edge.
 *
 * **Details**
 *
 * `flagDataRoot` and `envDataRoot` are separate keys so a caller that reads the
 * environment itself keeps the two rungs distinguishable in the resolved
 * {@link AiMetricsDataRoot}. A CLI whose flag already carries an environment
 * fallback leaves `envDataRoot` unset and lets the flag rung report `flag`.
 * Blank and whitespace-only values are treated as absent, so an exported but
 * empty `BEEP_AI_METRICS_DATA_ROOT` falls through instead of being taken
 * literally.
 *
 * **Gotchas**
 *
 * Every key is optional, `homeDir` included: a caller that only knows the flag,
 * or that is probing which rung wins before it pays to read `HOME`, supplies
 * exactly what it has. An absent — or blank — `homeDir` is the one input that
 * can leave {@link resolveAiMetricsDataRoot} with nothing to return, which is
 * why that function is `Option`-valued instead of accepting a `""` sentinel and
 * silently anchoring the store at the filesystem root.
 *
 * There is deliberately no working-directory input. A relative flag or
 * environment value is carried through as-is rather than being absolutized
 * against some ambient directory, because the CLI's law is to *reject* a
 * relative root, not to quietly resolve it into whatever directory the process
 * happened to inherit.
 *
 * **Example** (Gathering the process edge)
 *
 * ```ts
 * import { AiMetricsDataRootInput } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const input = AiMetricsDataRootInput.make({ homeDir: O.some("/home/dev") })
 *
 * console.log(input.target) // "local"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsDataRootInput extends S.Class<AiMetricsDataRootInput>($I`AiMetricsDataRootInput`)(
  {
    envDataRoot: OptionalNonBlank,
    flagDataRoot: OptionalNonBlank,
    homeDir: OptionalNonBlank,
    stateHome: OptionalNonBlank,
    target: AiMetricsDeployTarget.pipe(
      S.withConstructorDefault(Effect.succeed(AiMetricsDeployTarget.Enum.local)),
      S.withDecodingDefaultKey(Effect.succeed(AiMetricsDeployTarget.Enum.local))
    ),
  },
  $I.annote("AiMetricsDataRootInput", {
    description: "Flag, environment, home, and target inputs consumed by AI metrics data-root precedence.",
  })
) {}

/**
 * A resolved AI metrics data root together with the rung that produced it.
 *
 * **Example** (Inspecting a resolved root)
 *
 * ```ts
 * import { AiMetricsDataRoot } from "@beep/repo-ai-metrics"
 *
 * const resolved = AiMetricsDataRoot.make({
 *   path: "/home/dev/.local/state/beep/ai-metrics",
 *   source: "xdg-state-home",
 *   target: "local"
 * })
 *
 * console.log(resolved.source) // "xdg-state-home"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsDataRoot extends S.Class<AiMetricsDataRoot>($I`AiMetricsDataRoot`)(
  {
    path: S.String,
    source: AiMetricsDataRootSource,
    target: AiMetricsDeployTarget,
  },
  $I.annote("AiMetricsDataRoot", {
    description: "Resolved AI metrics data root and the precedence rung that produced it.",
  })
) {}

/**
 * Typed failure raised when a data root fails the absolute-path law.
 *
 * **Example** (Constructing the failure)
 *
 * ```ts
 * import { AiMetricsDataRootError } from "@beep/repo-ai-metrics"
 *
 * const error = AiMetricsDataRootError.make({
 *   cause: ".beep/ai-metrics",
 *   message: "AI metrics data root must be an absolute path."
 * })
 *
 * console.log(error._tag) // "AiMetricsDataRootError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsDataRootError extends S.TaggedError<AiMetricsDataRootError>($I`AiMetricsDataRootError`)(
  "AiMetricsDataRootError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<AiMetricsDataRootError>("AiMetricsDataRootError", {
    description: "Typed failure raised when an AI metrics data root is not an absolute path.",
  })
) {}

/**
 * The two rungs {@link aiMetricsStateHome} reads to derive an XDG state home.
 *
 * **Details**
 *
 * A strict subset of {@link AiMetricsDataRootInput}'s keys, so the fuller
 * process-edge input satisfies this contract directly and the precedence
 * resolver hands its own input straight through. Both keys are optional
 * because a caller probing which rung wins supplies only what it has.
 *
 * **Example** (Gathering the two rungs)
 *
 * ```ts
 * import { AiMetricsStateHomeInput } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const input = AiMetricsStateHomeInput.make({ homeDir: O.some("/home/dev") })
 *
 * console.log(input.homeDir) // /home/dev
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsStateHomeInput extends S.Class<AiMetricsStateHomeInput>($I`AiMetricsStateHomeInput`)(
  {
    homeDir: OptionalNonBlank,
    stateHome: OptionalNonBlank,
  },
  $I.annote("AiMetricsStateHomeInput", {
    description: "Home directory and XDG_STATE_HOME inputs consumed by AI metrics state-home resolution.",
  })
) {}

const AiMetricsStateHome = Fn({
  input: AiMetricsStateHomeInput,
  output: S.Option(S.String),
}).pipe(
  $I.annoteSchema("AiMetricsStateHome", {
    description: "Schema-backed resolution of the XDG state home an AI metrics data root hangs beneath.",
  })
);

/**
 * Resolve the XDG state home a data root should hang beneath.
 *
 * **Details**
 *
 * Mirrors the shell convention `${XDG_STATE_HOME:-$HOME/.local/state}`. Blank
 * and whitespace-only values are treated as unset on **both** inputs, matching a
 * shell that exports a variable without a value.
 *
 * **Gotchas**
 *
 * The result is `O.none()` when neither input carries a usable value. That case
 * has no honest answer: interpolating a blank home would yield
 * `/.local/state`, an absolute path anchored at the filesystem root that every
 * downstream absolute-path guard happily accepts.
 *
 * The contract is executable rather than declared: the input decodes through
 * {@link AiMetricsStateHomeInput} and the result validates against
 * `S.Option(S.String)` on every call, so a caller that hands over a shape the
 * schema rejects fails here instead of silently resolving a store somewhere
 * unintended.
 *
 * **Example** (Falling back to the home directory)
 *
 * ```ts
 * import { aiMetricsStateHome } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * console.log(aiMetricsStateHome({ homeDir: O.some("/home/dev"), stateHome: O.none() }))
 * // { _id: 'Option', _tag: 'Some', value: '/home/dev/.local/state' }
 * console.log(O.getOrThrow(aiMetricsStateHome({ homeDir: O.some("/home/dev"), stateHome: O.some("/custom/state") })))
 * // /custom/state
 * console.log(O.isNone(aiMetricsStateHome({ homeDir: O.some("  "), stateHome: O.none() }))) // true
 * ```
 *
 * @param input - Optional home directory and optional `XDG_STATE_HOME` value.
 * @returns The state home beneath which `beep/ai-metrics` lives, when one is derivable.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsStateHome: (input: AiMetricsStateHomeInput) => O.Option<string> =
  AiMetricsStateHome.implementSync((input) =>
    pipe(
      input.stateHome,
      O.orElse(() =>
        pipe(
          input.homeDir,
          O.map((home) => `${withoutTrailingSlash(home)}/.local/state`)
        )
      ),
      O.map(withoutTrailingSlash)
    )
  );

/**
 * Resolve the canonical AI metrics store beneath an XDG state home.
 *
 * **Details**
 *
 * Deliberately mirrors {@link agentEvidenceRoot}, which resolves
 * `${stateHome}/beep/agent-evidence`. The two subtrees are siblings under
 * `${stateHome}/beep`, so neither can ever nest inside the other and an
 * operation scoped to one store can never reach the other's evidence.
 *
 * **Example** (Locating the canonical store)
 *
 * ```ts
 * import { aiMetricsStateHome, aiMetricsStateRoot } from "@beep/repo-ai-metrics"
 *
 * import * as O from "effect/Option"
 *
 * console.log(aiMetricsStateRoot(O.getOrThrow(aiMetricsStateHome({ homeDir: O.some("/home/dev"), stateHome: O.none() }))))
 * // /home/dev/.local/state/beep/ai-metrics
 * ```
 *
 * @param stateHome - XDG state home, i.e. `XDG_STATE_HOME` or `$HOME/.local/state`.
 * @returns The `beep/ai-metrics` root that owns raw, derived, and identity state.
 * @category utilities
 * @since 0.0.0
 */
export const aiMetricsStateRoot = (stateHome: string): string => `${stateHome}/beep/ai-metrics`;

/**
 * Resolve the AI metrics data root by precedence, without touching the filesystem.
 *
 * **Details**
 *
 * Precedence is `flagDataRoot`, then `envDataRoot`, then the deploy-target
 * default. The dankserver target defaults to `/srv/data/ai-metrics`; every
 * other target defaults to the XDG store. Flag and environment values are
 * returned as supplied apart from a trailing-slash trim — a relative value
 * stays relative.
 *
 * **Gotchas**
 *
 * The function never fails and never reads the environment itself, but it is
 * `Option`-valued: the local target's XDG rung has nothing to resolve when
 * neither `stateHome` nor `homeDir` carries a usable value, and `O.none()` says
 * exactly that instead of interpolating a blank home into `/.local/state`.
 *
 * A `Some` is therefore not a promise of absoluteness. Resolution deliberately
 * does not absolutize a relative value, because the operator laws want such a
 * root *refused*, not silently rebased onto an ambient working directory.
 * {@link requireAbsoluteAiMetricsDataRoot} and `requireInstallDataRoot` are
 * where absoluteness is enforced; guard anything destined for a systemd unit or
 * a persisted registry there rather than trusting the returned shape.
 *
 * **Example** (Default XDG store for the local target)
 *
 * ```ts
 * import { AiMetricsDataRootInput, resolveAiMetricsDataRoot } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const resolved = resolveAiMetricsDataRoot(
 *   AiMetricsDataRootInput.make({ homeDir: O.some("/home/dev") })
 * )
 *
 * console.log(O.getOrThrow(resolved).path)
 * // /home/dev/.local/state/beep/ai-metrics
 * console.log(O.getOrThrow(resolved).source) // xdg-state-home
 * ```
 *
 * **Example** (An operator flag outranks the environment)
 *
 * ```ts
 * import { AiMetricsDataRootInput, resolveAiMetricsDataRoot } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * const resolved = resolveAiMetricsDataRoot(
 *   AiMetricsDataRootInput.make({
 *     envDataRoot: O.some("/var/lib/ai-metrics"),
 *     flagDataRoot: O.some("/srv/store")
 *   })
 * )
 *
 * console.log(O.getOrThrow(resolved).path) // /srv/store
 * console.log(O.getOrThrow(resolved).source) // flag
 * ```
 *
 * @param input - Flag, environment, home, and target values gathered at the process edge.
 * @returns The resolved root and the rung that produced it, when the input names one.
 * @category constructors
 * @since 0.0.0
 */
export const resolveAiMetricsDataRoot = (input: AiMetricsDataRootInput): O.Option<AiMetricsDataRoot> => {
  const rung = (path: string, source: AiMetricsDataRootSource): AiMetricsDataRootRung => ({ path, source });
  const targetRung: O.Option<AiMetricsDataRootRung> = AiMetricsDeployTarget.$match(input.target, {
    dankserver: () => O.some(rung(dankserverDataRoot, AiMetricsDataRootSource.Enum["target-default"])),
    local: () =>
      pipe(
        aiMetricsStateHome(input),
        O.map((stateHome) => rung(aiMetricsStateRoot(stateHome), AiMetricsDataRootSource.Enum["xdg-state-home"]))
      ),
  });

  return pipe(
    input.flagDataRoot,
    O.map((value) => rung(withoutTrailingSlash(value), AiMetricsDataRootSource.Enum.flag)),
    O.orElse(() =>
      pipe(
        input.envDataRoot,
        O.map((value) => rung(withoutTrailingSlash(value), AiMetricsDataRootSource.Enum.environment))
      )
    ),
    O.orElse(() => targetRung),
    O.map((resolved) => AiMetricsDataRoot.make({ ...resolved, target: input.target }))
  );
};

/**
 * Require a data root to be absolute before it is rendered or persisted.
 *
 * **When to use**
 *
 * Use when a data root is about to be interpolated into a systemd unit, into a
 * planned operator command, or into the identity registry. A relative root
 * inside a unit binds to `WorkingDirectory`, which is how the canonical store
 * ended up inside a clone in the first place.
 *
 * **Example** (Rejecting a clone-relative root)
 *
 * ```ts
 * import { requireAbsoluteAiMetricsDataRoot } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = Effect.flip(requireAbsoluteAiMetricsDataRoot(".beep/ai-metrics"))
 *
 * console.log(Effect.runSync(program)._tag) // AiMetricsDataRootError
 * ```
 *
 * @param dataRoot - Data root destined for a unit file, planned command, or registry.
 * @returns The unchanged data root when it is absolute.
 * @category utilities
 * @since 0.0.0
 */
export const requireAbsoluteAiMetricsDataRoot: (
  dataRoot: string
) => Effect.Effect<AiMetricsAbsoluteDataRoot, AiMetricsDataRootError> = Effect.fn(
  "AiMetrics.requireAbsoluteAiMetricsDataRoot"
)(function* (dataRoot: string) {
  return yield* AiMetricsAbsoluteDataRoot.decodeEffect(dataRoot).pipe(
    Effect.mapError((cause) =>
      AiMetricsDataRootError.make({
        cause,
        message: "AI metrics data root must be an absolute path with a non-root leaf segment.",
      })
    )
  );
});
