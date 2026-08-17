/**
 * Post-push check registration for Yeet monitor sessions.
 *
 * **Details**
 *
 * `gh pr checks` answers "this head has no check runs" and "this head's checks
 * are done" through two different surfaces, and only one of them is terminal.
 * A head GitHub has not finished wiring up yet reports *no checks at all* — an
 * error, exit 1, `no checks reported on the '<branch>' branch` — which arrives
 * in the same shape as a genuine failure and within a second or two of the push
 * that created the head. Treating that as the watch's answer ends the monitor
 * before the pipeline it was asked to watch has begun.
 *
 * This module is the distinction: {@link yeetCheckRegistration} classifies one
 * watch attempt, and {@link awaitYeetCheckRegistration} re-attempts an
 * unregistered head on a bounded backoff before letting the result stand.
 *
 * **Gotchas**
 *
 * Exhausting the backoff is not a green. The results are handed back exactly as
 * observed — still non-zero, still `awaiting-registration` — so the caller
 * fails the phase. A head that never registers a check is a real condition
 * (a workflow whose path filters excluded every file, a disabled Actions
 * setting) and the operator has to be told about it, not have it rounded down
 * to "nothing to watch, carry on".
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Console, Duration, Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { RepoStepRunResult } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/MonitorChecks");

/**
 * Matches `gh pr checks`' empty-registration error text.
 *
 * **Details**
 *
 * `gh pr checks` prints "no checks reported on the '<branch>' branch", and
 * "no required checks reported on ..." under `--required`. Both mean the same
 * thing to a freshly pushed head: nothing has registered yet. This is the ONLY
 * non-zero checks exit that may be read as an empty rollup — any other failure
 * (authentication, rate limit, network) is a poll error, and treating it as
 * empty converts an outage into a green completion.
 *
 * **Example** (Match the registration message)
 *
 * ```ts
 * import { NO_CHECKS_REPORTED } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(NO_CHECKS_REPORTED.test("no checks reported on the 'feat/x' branch")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NO_CHECKS_REPORTED = /no (?:required )?checks reported/iu;

/**
 * Whether a check watch found checks to watch.
 *
 * **Details**
 *
 * `awaiting-registration` is deliberately narrow: it means the watch found
 * *zero* checks, which is the only state a later attempt can change on its own.
 * A watch that saw checks and reported a red is `registered` — that answer is
 * about the code, and no amount of waiting improves it.
 *
 * **Example** (Name the states)
 *
 * ```ts
 * import { YeetCheckRegistration } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetCheckRegistration.is["awaiting-registration"]("awaiting-registration")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetCheckRegistration = LiteralKit(["registered", "awaiting-registration"]).pipe(
  $I.annoteSchema("YeetCheckRegistration", {
    title: "Yeet Check Registration",
    description: "Whether a pull request head had any check runs registered when the watch ran.",
  })
);

/**
 * Whether a check watch found checks to watch.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetCheckRegistration = typeof YeetCheckRegistration.Type;

/**
 * Classify one `gh pr checks --watch` result.
 *
 * **Details**
 *
 * Both conditions are required. A zero exit means the watch ran to a verdict,
 * so it is `registered` whatever it printed; a non-zero exit whose output does
 * not name the empty-check condition is an ordinary failure — a denied token,
 * no pull request, a network error — and re-attempting it would just spend the
 * backoff on a failure that is already the answer.
 *
 * **Example** (Classify an unregistered head)
 *
 * ```ts
 * import { RepoStepRunResult } from "@beep/repo-cli/internal/repo-run"
 * import { yeetCheckRegistration } from "@beep/repo-cli/test/Yeet"
 *
 * const result = RepoStepRunResult.make({
 *   stepId: "monitor:02-pr-checks-watch",
 *   commandText: "gh pr checks --watch --fail-fast",
 *   exitCode: 1,
 *   output: "no checks reported on the 'feat/x' branch",
 * })
 * console.log(yeetCheckRegistration(result)) // awaiting-registration
 * ```
 *
 * @param result - One executed check-watch step result.
 * @returns `awaiting-registration` when the head carried no checks, else `registered`.
 * @category predicates
 * @since 0.0.0
 */
export const yeetCheckRegistration = (result: RepoStepRunResult): YeetCheckRegistration =>
  result.exitCode !== 0 && NO_CHECKS_REPORTED.test(O.getOrElse(O.fromUndefinedOr(result.output), () => Str.empty))
    ? YeetCheckRegistration.Enum["awaiting-registration"]
    : YeetCheckRegistration.Enum.registered;

/**
 * Whether any step in a watch attempt found no checks registered.
 *
 * **Example** (An empty attempt is not awaiting anything)
 *
 * ```ts
 * import { isAwaitingYeetCheckRegistration } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(isAwaitingYeetCheckRegistration([])) // false
 * ```
 *
 * @param results - The results of one check-watch attempt.
 * @returns True when at least one result reported zero registered checks.
 * @category predicates
 * @since 0.0.0
 */
export const isAwaitingYeetCheckRegistration = (results: ReadonlyArray<RepoStepRunResult>): boolean =>
  A.some(results, (result) => YeetCheckRegistration.is["awaiting-registration"](yeetCheckRegistration(result)));

/**
 * The waits between check-registration attempts, in order.
 *
 * **Details**
 *
 * Registration normally lands within a few seconds of the push, so the first
 * wait is short and the tail widens to cover a slow control plane without
 * hammering it. Its length is the bound: five entries, six attempts,
 * ~95 seconds of patience, after which the empty result is the answer. The
 * bound is what keeps this a fix and not a new way for a monitor to hang.
 *
 * **Example** (Read the bound)
 *
 * ```ts
 * import { YEET_CHECK_REGISTRATION_BACKOFF } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_CHECK_REGISTRATION_BACKOFF.length) // 5
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_CHECK_REGISTRATION_BACKOFF: ReadonlyArray<Duration.Duration> = [
  Duration.seconds(5),
  Duration.seconds(10),
  Duration.seconds(20),
  Duration.seconds(30),
  Duration.seconds(30),
];

// Printed by the loop below rather than exported: the line's content is proven
// where it is emitted, and a three-parameter renderer has no meaningful
// data-last partner to satisfy the pipeable-signature rule with.
const renderRegistrationWait = (attempt: number, attempts: number, delay: Duration.Duration): string =>
  `[yeet] no checks registered for this head yet; retrying in ${Duration.format(delay)} (${attempt}/${attempts})`;

/**
 * Report that no check ever registered for the pushed head.
 *
 * **Example** (Render the exhausted verdict)
 *
 * ```ts
 * import { renderYeetCheckRegistrationExhausted, YEET_CHECK_REGISTRATION_BACKOFF } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(renderYeetCheckRegistrationExhausted(YEET_CHECK_REGISTRATION_BACKOFF))
 * ```
 *
 * @param delays - The backoff that was exhausted.
 * @returns The operator line naming the condition and what to check.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetCheckRegistrationExhausted = (delays: ReadonlyArray<Duration.Duration>): string =>
  `No checks registered for the pushed head after ${A.length(delays) + 1} attempts over ${Duration.format(
    A.reduce(delays, Duration.zero, (total, delay) => Duration.sum(total, delay))
  )}; GitHub never reported a check run for it. Confirm the workflows' path filters cover this diff and that Actions is enabled for the repository.`;

/**
 * Re-run a check watch while the pushed head has no checks registered.
 *
 * **Details**
 *
 * The attempt is passed as an effect and re-executed, rather than a result
 * being inspected once, because "watch the checks" and "wait for the checks to
 * exist" are the same command — the second attempt is just the first one run
 * again after the control plane has had time to catch up. The bound comes from
 * `delays`, which the caller supplies so tests can exercise the loop without
 * waiting for real seconds.
 *
 * The bound is a required argument rather than a default, so every call site
 * states how much patience it is buying and a test can buy none.
 *
 * **Example** (Wrap a check watch)
 *
 * ```ts
 * import { awaitYeetCheckRegistration, YEET_CHECK_REGISTRATION_BACKOFF } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const watched = Effect.succeed([]).pipe(awaitYeetCheckRegistration(YEET_CHECK_REGISTRATION_BACKOFF))
 * console.log(Effect.isEffect(watched)) // true
 * ```
 *
 * @param delays - Waits between attempts, in order; its length is the bound.
 * @returns A combinator over one check-watch attempt, yielding the results of
 * the first attempt that found checks, or of the last attempt made.
 * @category execution
 * @since 0.0.0
 */
export const awaitYeetCheckRegistration =
  (delays: ReadonlyArray<Duration.Duration>) =>
  <Failure, Requirements>(
    attempt: Effect.Effect<ReadonlyArray<RepoStepRunResult>, Failure, Requirements>
  ): Effect.Effect<ReadonlyArray<RepoStepRunResult>, Failure, Requirements> =>
    Effect.flatMap(attempt, (first) =>
      Effect.reduce(
        delays,
        () => first,
        (results, delay, index) =>
          isAwaitingYeetCheckRegistration(results)
            ? pipe(
                Console.log(renderRegistrationWait(index + 1, A.length(delays), delay)),
                Effect.andThen(Effect.sleep(delay)),
                Effect.andThen(attempt)
              )
            : Effect.succeed(results)
      )
    );
