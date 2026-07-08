/**
 * Shared fail-on-growth ratchet enforcement skeleton.
 *
 * @remarks
 * Every complete repo-cli ratchet (Knip, JSDoc inventory totals, coverage
 * regression) enforces its committed baseline with the same control flow: run
 * an ordered list of regression checks, short-circuit into a tagged failure on
 * the first present one after printing its `[tag] regression:` stderr block,
 * otherwise print the `[tag] ok:` line and — when the baseline can be tightened
 * — the `[tag] tighten-baseline:` stdout nudge. {@link enforceRatchet}
 * reproduces exactly that flow while leaving every emitted string to the
 * caller, so migrated commands stay byte-identical.
 *
 * The regression stderr blocks and tighten nudges are assembled from
 * {@link @beep/repo-cli/internal/artifacts/ArtifactIo!renderTruncatedLines};
 * baseline regeneration is `formatJsonc` + `writeArtifact` from the same
 * module, applied to each command's own `schema_version`-carrying baseline
 * schema. The inventory-merge ratchets (`DualArity`, `Lint/SchemaFirst`) keep
 * their bespoke per-diagnostic logging and strict-failure gating; see the
 * divergence catalog in the wave report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe } from "@beep/utils";
import { Console, Effect } from "effect";

/**
 * Enforce a fail-on-growth ratchet: fail on the first present regression,
 * otherwise print the ok line and any tighten-baseline nudge.
 *
 * @remarks
 * Reproduces the shared `enforceComparison` control flow. Each regression's
 * `lines` is the complete stderr block for that check (header, findings, and
 * remediation footer, already truncated). Regressions are evaluated in order
 * (for example JSDoc checks its missing-metrics block before its
 * increased-totals block); the first one whose `present` is `true` prints its
 * stderr block and fails with its `error`. When none are present the `okLine`
 * is logged, then the `tighten` stdout block when the baseline can be tightened.
 *
 * @param input - Ordered regression checks, the ok line, and an optional
 * tighten-baseline block.
 * @returns Effect that fails with the first present regression's error.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { enforceRatchet } from "@beep/repo-cli/test/Ratchet"
 *
 * const program = enforceRatchet({
 *   regressions: [
 *     { present: false, lines: ["[knip] regression: ..."], error: new Error("grew") }
 *   ],
 *   okLine: "[knip] ok: current=0 baseline=0 introduced=0",
 *   tighten: O.none()
 * })
 * console.log(Effect.isEffect(program))
 * ```
 * @category enforcement
 * @since 0.0.0
 */
export const enforceRatchet = <E>(input: {
  readonly regressions: ReadonlyArray<{
    readonly present: boolean;
    readonly lines: ReadonlyArray<string>;
    readonly error: E;
  }>;
  readonly okLine: string;
  readonly tighten: O.Option<ReadonlyArray<string>>;
}): Effect.Effect<void, E> =>
  Effect.gen(function* () {
    const firstRegression = A.findFirst(input.regressions, (regression) => regression.present);
    if (O.isSome(firstRegression)) {
      yield* Console.error(A.join(firstRegression.value.lines, "\n"));
      return yield* Effect.fail(firstRegression.value.error);
    }

    yield* Console.log(input.okLine);

    yield* pipe(
      input.tighten,
      O.match({
        onNone: () => Effect.void,
        onSome: (lines) => Console.log(A.join(lines, "\n")),
      })
    );
  });
