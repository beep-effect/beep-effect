/**
 * Who a gate's console is for, and which projection that audience gets:
 * an agent and a CI job get the plain agent projection, a person the
 * terminal projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoGateRunId } from "@beep/identity/packages";
import { Audience, AudienceKind } from "@beep/runtime-env/Audience";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as S from "effect/Schema";
import type { AudienceFlagInput } from "@beep/cli-kit/CliAudience";

const $I = $RepoGateRunId.create("GateAudience");

/**
 * The two consoles this package renders: the plain, bounded agent projection
 * and the coloured terminal projection with a live progress line.
 *
 * **Example** (Match a projection)
 *
 * ```ts
 * import { ProjectionKind } from "@beep/repo-gate-run/GateAudience";
 *
 * console.log(ProjectionKind.is.terminal("terminal")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProjectionKind = LiteralKit(["agent", "terminal"]).pipe(
  $I.annoteSchema("ProjectionKind", {
    description: "The console a gate renders: the plain agent projection or the coloured terminal projection.",
  })
);

/**
 * Type of {@link ProjectionKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProjectionKind = typeof ProjectionKind.Type;

/**
 * The projection an audience gets: a person gets the terminal projection;
 * an agent and a CI job get the agent projection, since the CI projection
 * is not built yet.
 *
 * **Example** (Project for CI)
 *
 * ```ts
 * import { projectionFor } from "@beep/repo-gate-run/GateAudience";
 *
 * console.log(projectionFor("ci")); // agent
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const projectionFor: (kind: AudienceKind) => ProjectionKind = AudienceKind.match({
  human: (): ProjectionKind => "terminal",
  agent: (): ProjectionKind => "agent",
  ci: (): ProjectionKind => "agent",
});

/**
 * More than one audience flag was given.
 *
 * **Example** (Build the error)
 *
 * ```ts
 * import { AudienceFlagConflict } from "@beep/repo-gate-run/GateAudience";
 *
 * console.log(AudienceFlagConflict.make({ given: ["agent", "human"] }).given.length); // 2
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AudienceFlagConflict extends S.TaggedError<AudienceFlagConflict, { readonly brand: unique symbol }>(
  $I`AudienceFlagConflict`
)(
  "AudienceFlagConflict",
  { given: S.Array(AudienceKind) },
  $I.annoteError<AudienceFlagConflict>("AudienceFlagConflict", {
    description: "More than one audience flag occurrence was given to a gate run.",
  })
) {}

const flaggedKinds = (flags: AudienceFlagInput): ReadonlyArray<AudienceKind> => [
  ...flags.audience,
  ...A.flatMap(AudienceKind.literals, (kind) => A.map(A.filter(flags[kind], identity), (): AudienceKind => kind)),
];

/**
 * The audience a gate renders for: the one audience flag given, else the
 * detected `Audience` (agent beats CI beats human).
 *
 * **Details**
 *
 * The flags are the four `@beep/cli-kit` `CliAudience` flags, counted as it
 * counts them: every `--audience` value and every true boolean occurrence.
 * More than one occurrence fails with {@link AudienceFlagConflict}. A
 * command run through `CliAudience.run` already sees the flag in `Audience`;
 * the flags here serve a caller that parses its own argv.
 *
 * **Example** (Let a flag override detection)
 *
 * ```ts
 * import { Audience } from "@beep/runtime-env/Audience";
 * import { selectAudience } from "@beep/repo-gate-run/GateAudience";
 * import * as Effect from "effect/Effect";
 *
 * const program = selectAudience({ audience: [], human: [true], agent: [], ci: [] }).pipe(
 *   Effect.provide(Audience.layerTest("agent"))
 * );
 * console.log(Effect.runSync(program)); // human
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const selectAudience = Effect.fn("GateAudience.selectAudience")(function* (flags: AudienceFlagInput) {
  const given = flaggedKinds(flags);
  if (given.length > 1) return yield* AudienceFlagConflict.make({ given });
  const ambient = yield* Audience;
  return A.match(given, { onEmpty: () => ambient.kind, onNonEmpty: A.headNonEmpty });
});
