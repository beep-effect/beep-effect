/**
 * Required checks a newer workflow run hides from the base ruleset.
 *
 * **Details**
 *
 * At merge time GitHub's ruleset reads, per Actions workflow file and
 * triggering event on the head commit, only the newest workflow run's check
 * suite. A check run that exists only in an older run's suite of the same
 * workflow and event does not count, and the context reads as "expected",
 * even though the GraphQL status rollup and the gates' newest-run-per-name
 * read still show it. On 2026-11-12 an `unblocks-main` label started a second
 * Heavy Admit run on #3133 whose jobs all skipped, so `Heavy / Check`,
 * `Heavy / Docgen` and `Heavy / Doctest`, green only in the first run's suite,
 * failed the merge request after the gate said GATE-MET.
 *
 * The gates therefore model the ruleset's view of the required contexts
 * before they judge red, pending or green: {@link gateCountsCheck} drops a
 * required context's check run in a replaced suite (see
 * {@link rulesetReadsSuite}), and its newest run per name is taken from what
 * remains (live suites, suites no Actions run owns, runs with no suite id). A
 * required context left with no counted run is hidden, and
 * {@link hiddenRequiredChecks} judges it by its newest hidden copy, never
 * drops it: a red copy stays red, a green copy is shadowed, and a copy still
 * running, or one whose replacing run is, is pending. An optional check is
 * not the ruleset's to read, so it keeps its newest run per name over every
 * run on the head, a red in a replaced suite included. All three gates
 * (`yeet merge-gate`, `yeet gh`, `yeet gate-table`) read that one
 * classification.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { GithubWorkflowRunRecord } from "../../../internal/github/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/SuiteShadow");

/**
 * One Actions workflow run on the head commit and the check suite its check
 * runs report into.
 *
 * **Details**
 *
 * `workflowPath` and `event` key the runs the ruleset compares; the newest
 * run per key (latest `createdAt`, then highest `runId`) owns the one live
 * suite for that key. `conclusion` is none while the run is going, and
 * encodes as `null`, so the gate table's JSON report carries it.
 *
 * **Example** (The skipped Heavy Admit run of #3133)
 *
 * ```ts
 * import { HeadWorkflowSuite } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const suite = HeadWorkflowSuite.make({
 *   runId: 43329206623,
 *   checkSuiteId: 117334931047,
 *   workflowPath: ".github/workflows/heavy-admit.yml",
 *   event: "pull_request",
 *   createdAt: DateTime.makeUnsafe("2026-11-12T23:28:51Z"),
 *   status: "completed",
 *   conclusion: O.some("skipped"),
 * })
 * console.log(suite.event) // "pull_request"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeadWorkflowSuite extends S.Opaque<HeadWorkflowSuite, { readonly brand: unique symbol }>()(
  S.Struct({
    runId: S.Int,
    checkSuiteId: S.Int,
    workflowPath: S.String,
    event: S.String,
    createdAt: S.DateTimeUtcFromString,
    status: S.String,
    conclusion: S.OptionFromNullOr(S.String),
  }).pipe(
    $I.annoteSchema("HeadWorkflowSuite", {
      description: "One Actions workflow run on the head commit and the check suite its check runs report into.",
    })
  )
) {}

/**
 * How a gate reads one check run: completed with `success`, `skipped` or
 * `neutral` is green, any other completed run is red, and a run not yet
 * completed is pending.
 *
 * **Example** (Narrow a verdict)
 *
 * ```ts
 * import { HeadCheckVerdict } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(HeadCheckVerdict.is.red("red")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HeadCheckVerdict = LiteralKit(["green", "red", "pending"]).pipe(
  $I.annoteSchema("HeadCheckVerdict", {
    description: "Whether a check run on the head passed, failed or is still going, by the gates' own test.",
  })
);

/**
 * Type of {@link HeadCheckVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type HeadCheckVerdict = typeof HeadCheckVerdict.Type;

/**
 * One check run on the head, reduced to what the shadow read needs.
 *
 * **Details**
 *
 * `verdict` is the gate's own reading of the run and `conclusion` its GitHub
 * conclusion, none while it runs. `checkSuiteId` is none when GitHub sent no
 * suite; such a run, like one whose suite belongs to no Actions run (another
 * app), always counts.
 *
 * **Example** (A green run in the first Heavy Admit suite)
 *
 * ```ts
 * import { HeadSuiteCheck } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const check = HeadSuiteCheck.make({
 *   id: 1,
 *   name: "Heavy / Check",
 *   checkSuiteId: O.some(117334542882),
 *   verdict: "green",
 *   conclusion: O.some("success"),
 * })
 * console.log(check.verdict) // "green"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeadSuiteCheck extends S.Opaque<HeadSuiteCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Finite,
    name: S.String,
    checkSuiteId: S.Option(S.Int),
    verdict: HeadCheckVerdict,
    conclusion: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("HeadSuiteCheck", {
      description: "One check run on the head: its id, name, check suite, verdict and conclusion.",
    })
  )
) {}

/**
 * What the shadow read decides from: the base ruleset's required contexts,
 * the head's check runs and the head's workflow runs.
 *
 * **Example** (An empty read)
 *
 * ```ts
 * import { RequiredShadowInput } from "@beep/repo-cli/test/Yeet"
 *
 * const input = RequiredShadowInput.make({ requiredContexts: ["Lint"], checks: [], suites: [] })
 * console.log(input.requiredContexts.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RequiredShadowInput extends S.Opaque<RequiredShadowInput, { readonly brand: unique symbol }>()(
  S.Struct({
    requiredContexts: S.Array(S.String),
    checks: S.Array(HeadSuiteCheck),
    suites: S.Array(HeadWorkflowSuite),
  }).pipe(
    $I.annoteSchema("RequiredShadowInput", {
      description: "Required contexts, head check runs and head workflow runs the shadow read decides from.",
    })
  )
) {}

/**
 * How the gates judge a required context the ruleset reads no run of, from
 * its newest hidden copy.
 *
 * **Details**
 *
 * - `red`: the copy completed red. It is judged like a live red, whatever the
 *   replacing run is doing, so a relaxed merge never records it as pending.
 * - `shadowed`: the copy passed and the replacing run has finished, so the
 *   ruleset reads the context as expected until a person re-applies the
 *   label.
 * - `pending`: the copy is still running, or it passed and the replacing run
 *   is still going and may yet report the context itself.
 *
 * **Example** (Narrow a state)
 *
 * ```ts
 * import { HiddenRequiredState } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(HiddenRequiredState.is.shadowed("shadowed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HiddenRequiredState = LiteralKit(["red", "shadowed", "pending"]).pipe(
  $I.annoteSchema("HiddenRequiredState", {
    description: "How the gates judge a required context the ruleset reads no run of, from its newest hidden copy.",
  })
);

/**
 * Type of {@link HiddenRequiredState}.
 *
 * @category models
 * @since 0.0.0
 */
export type HiddenRequiredState = typeof HiddenRequiredState.Type;

/**
 * A required context with no run the ruleset reads, judged by its newest
 * hidden copy.
 *
 * **Details**
 *
 * `copy` is the context's check run in the newest replaced suite that
 * reported it (suites ordered by their run's `createdAt`, then run id, as
 * {@link rulesetReadsSuite} orders them; the newest attempt within that
 * suite), `hiddenIn` the replaced run that owns that suite, and `replacedBy`
 * the newest run of the same workflow and event, whose suite the ruleset
 * reads instead.
 *
 * **Example** (Heavy / Check on #3133)
 *
 * ```ts
 * import { HeadSuiteCheck, HeadWorkflowSuite, HiddenRequiredCheck } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const run = (runId: number, checkSuiteId: number, at: string, conclusion: string) =>
 *   HeadWorkflowSuite.make({
 *     runId,
 *     checkSuiteId,
 *     workflowPath: ".github/workflows/heavy-admit.yml",
 *     event: "pull_request",
 *     createdAt: DateTime.makeUnsafe(at),
 *     status: "completed",
 *     conclusion: O.some(conclusion),
 *   })
 * const hidden = HiddenRequiredCheck.make({
 *   context: "Heavy / Check",
 *   state: "shadowed",
 *   copy: HeadSuiteCheck.make({
 *     id: 1,
 *     name: "Heavy / Check",
 *     checkSuiteId: O.some(117334542882),
 *     verdict: "green",
 *     conclusion: O.some("success"),
 *   }),
 *   hiddenIn: run(43329058531, 117334542882, "2026-11-12T23:27:45Z", "success"),
 *   replacedBy: run(43329206623, 117334931047, "2026-11-12T23:28:51Z", "skipped"),
 * })
 * console.log(hidden.replacedBy.runId) // 43329206623
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HiddenRequiredCheck extends S.Opaque<HiddenRequiredCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    context: S.String,
    state: HiddenRequiredState,
    copy: HeadSuiteCheck,
    hiddenIn: HeadWorkflowSuite,
    replacedBy: HeadWorkflowSuite,
  }).pipe(
    $I.annoteSchema("HiddenRequiredCheck", {
      description:
        "A required context with no run the ruleset reads, judged by its copy in the newest check suite a newer run of the same workflow and event replaced.",
    })
  )
) {}

/**
 * What to do about a shadowed required context once the run that shadows it
 * has finished.
 *
 * **Example** (Read the remedy)
 *
 * ```ts
 * import { SHADOWED_REQUIRED_REMEDY } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(SHADOWED_REQUIRED_REMEDY.startsWith("re-apply ready-for-heavy")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SHADOWED_REQUIRED_REMEDY =
  "re-apply ready-for-heavy (remove and add the label) so the newest Heavy Admit run runs and reports it again, or merge with --relaxed and an attribution";

/**
 * Reduce the head's workflow runs to the suites the ruleset compares.
 *
 * **Details**
 *
 * A run for another head sha, or one GitHub reported without a check suite
 * id, is dropped: its suite cannot shadow anything, and its check runs count
 * as they always have.
 *
 * **Example** (Keep the head's runs)
 *
 * ```ts
 * import { GithubWorkflowRunRecord } from "@beep/repo-cli/test/SharedInternals"
 * import { headWorkflowSuites } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const run = GithubWorkflowRunRecord.make({
 *   id: 9,
 *   name: "Check",
 *   status: "completed",
 *   conclusion: O.some("success"),
 *   headSha: "abc",
 *   checkSuiteId: O.some(90),
 *   path: ".github/workflows/check.yml",
 *   event: "pull_request",
 *   createdAt: DateTime.makeUnsafe("2026-11-12T23:20:00Z"),
 * })
 * console.log(headWorkflowSuites([run], "abc").length) // 1
 * console.log(headWorkflowSuites("def")([run]).length) // 0
 * ```
 *
 * @param runs - The REST workflow runs listed for the head.
 * @param headSha - The head commit the runs were listed for.
 * @returns One suite per run of the head that names its check suite.
 * @category mappers
 * @since 0.0.0
 */
export const headWorkflowSuites: {
  (headSha: string): (runs: ReadonlyArray<GithubWorkflowRunRecord>) => ReadonlyArray<HeadWorkflowSuite>;
  (runs: ReadonlyArray<GithubWorkflowRunRecord>, headSha: string): ReadonlyArray<HeadWorkflowSuite>;
} = dual(
  2,
  (runs: ReadonlyArray<GithubWorkflowRunRecord>, headSha: string): ReadonlyArray<HeadWorkflowSuite> =>
    A.getSomes(
      A.map(
        A.filter(runs, (run) => run.headSha === headSha),
        (run) =>
          O.map(run.checkSuiteId, (checkSuiteId) =>
            HeadWorkflowSuite.make({
              runId: run.id,
              checkSuiteId,
              workflowPath: run.path,
              event: run.event,
              createdAt: run.createdAt,
              status: run.status,
              conclusion: run.conclusion,
            })
          )
      )
    )
);

const suiteKey = (suite: HeadWorkflowSuite): string => `${suite.event}:${suite.workflowPath}`;

const newerSuite: Order.Order<HeadWorkflowSuite> = Order.combine(
  Order.mapInput(DateTime.Order, (suite: HeadWorkflowSuite) => suite.createdAt),
  Order.mapInput(Order.Number, (suite: HeadWorkflowSuite) => suite.runId)
);

// The newest run per (event, workflow file): the run whose suite the ruleset reads.
const liveRunPerKey = (suites: ReadonlyArray<HeadWorkflowSuite>): HashMap.HashMap<string, HeadWorkflowSuite> =>
  A.reduce(suites, HashMap.empty<string, HeadWorkflowSuite>(), (live, suite) =>
    HashMap.set(
      live,
      suiteKey(suite),
      HashMap.get(live, suiteKey(suite)).pipe(
        O.map((current) => Order.max(newerSuite)(current, suite)),
        O.getOrElse(() => suite)
      )
    )
  );

// Every replaced suite, keyed by its id, to its own run and the live run that replaced it.
const replacedSuites = (
  suites: ReadonlyArray<HeadWorkflowSuite>
): HashMap.HashMap<number, { readonly hiddenIn: HeadWorkflowSuite; readonly replacedBy: HeadWorkflowSuite }> => {
  const live = liveRunPerKey(suites);
  return HashMap.fromIterable(
    A.getSomes(
      A.map(suites, (suite) =>
        HashMap.get(live, suiteKey(suite)).pipe(
          O.filter((newest) => newest.runId !== suite.runId),
          O.map((newest) => [suite.checkSuiteId, { hiddenIn: suite, replacedBy: newest }] as const)
        )
      )
    )
  );
};

/**
 * Decide, from the head's workflow runs, whether the base ruleset reads a
 * check run, by the check suite it reports into.
 *
 * **Details**
 *
 * A suite whose workflow run is not the newest run of its workflow file and
 * event (latest `createdAt`, then highest `runId`) is replaced, and the
 * ruleset ignores every check run in it, however new its id (a re-run of an
 * older run keeps that run's `createdAt`). A check run with no suite id, or in
 * a suite no listed Actions run owns (another app), is read. The gates filter
 * the required contexts' check runs through it before taking the newest run
 * per name (see {@link gateCountsCheck}).
 *
 * **Example** (A newer skipped run replaces the admitted suite)
 *
 * ```ts
 * import { HeadWorkflowSuite, rulesetReadsSuite } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const run = (runId: number, checkSuiteId: number, at: string) =>
 *   HeadWorkflowSuite.make({
 *     runId,
 *     checkSuiteId,
 *     workflowPath: ".github/workflows/heavy-admit.yml",
 *     event: "pull_request",
 *     createdAt: DateTime.makeUnsafe(at),
 *     status: "completed",
 *     conclusion: O.some("success"),
 *   })
 * const reads = rulesetReadsSuite([run(1, 10, "2026-11-12T23:27:45Z"), run(2, 20, "2026-11-12T23:28:51Z")])
 * console.log(reads(O.some(10)), reads(O.some(20)), reads(O.none())) // false true true
 * ```
 *
 * @param suites - The head's workflow runs with their check suites.
 * @returns Whether the ruleset reads a check run in the given suite.
 * @category predicates
 * @since 0.0.0
 */
export const rulesetReadsSuite = (
  suites: ReadonlyArray<HeadWorkflowSuite>
): ((checkSuiteId: O.Option<number>) => boolean) => {
  const replaced = replacedSuites(suites);
  return (checkSuiteId) => !O.exists(checkSuiteId, (suiteId) => HashMap.has(replaced, suiteId));
};

/**
 * Decide whether a gate counts a check run on the head when it takes the
 * newest run per name: a required context's run only when the base ruleset
 * reads its suite, any other check's run always.
 *
 * **Details**
 *
 * The replaced-suite model is how the ruleset reads its required contexts,
 * so it applies to them alone (see {@link rulesetReadsSuite}). An optional
 * check keeps the newest run per name over every run on the head, wherever it
 * reported, as the gates read it before #3133: a red in a replaced suite stays
 * that check's red, so the relaxed merge record, the strict optional-red hold,
 * `yeet gh` and the gate table still see it.
 *
 * **Example** (An optional red in the replaced admitted suite still counts)
 *
 * ```ts
 * import { gateCountsCheck, HeadWorkflowSuite } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const run = (runId: number, checkSuiteId: number, at: string) =>
 *   HeadWorkflowSuite.make({
 *     runId,
 *     checkSuiteId,
 *     workflowPath: ".github/workflows/heavy-admit.yml",
 *     event: "pull_request",
 *     createdAt: DateTime.makeUnsafe(at),
 *     status: "completed",
 *     conclusion: O.some("success"),
 *   })
 * const suites = [run(1, 10, "2026-11-12T23:27:45Z"), run(2, 20, "2026-11-12T23:28:51Z")]
 * const counts = gateCountsCheck(suites, ["Heavy / Check"])
 * console.log(counts("Heavy / Check", O.some(10)), counts("Heavy / Lint Policy", O.some(10))) // false true
 * console.log(gateCountsCheck(["Heavy / Check"])(suites)("Heavy / Check", O.some(20))) // true
 * ```
 *
 * @param suites - The head's workflow runs with their check suites.
 * @param requiredContexts - The base ruleset's required contexts.
 * @returns Whether the gates count a check run of the given name in the given suite.
 * @category predicates
 * @since 0.0.0
 */
export const gateCountsCheck: {
  (
    requiredContexts: ReadonlyArray<string>
  ): (suites: ReadonlyArray<HeadWorkflowSuite>) => (name: string, checkSuiteId: O.Option<number>) => boolean;
  (
    suites: ReadonlyArray<HeadWorkflowSuite>,
    requiredContexts: ReadonlyArray<string>
  ): (name: string, checkSuiteId: O.Option<number>) => boolean;
} = dual(
  2,
  (
    suites: ReadonlyArray<HeadWorkflowSuite>,
    requiredContexts: ReadonlyArray<string>
  ): ((name: string, checkSuiteId: O.Option<number>) => boolean) => {
    const reads = rulesetReadsSuite(suites);
    const required = HashSet.fromIterable(requiredContexts);
    return (name, checkSuiteId) => !HashSet.has(required, name) || reads(checkSuiteId);
  }
);

// The newest replaced suite first (its run's createdAt, then run id), then the newest attempt in it;
// never check-run id across suites, since a re-run of an older run takes higher ids.
const newerCopy: Order.Order<HiddenRequiredCheck> = Order.combine(
  Order.mapInput(newerSuite, (hidden: HiddenRequiredCheck) => hidden.hiddenIn),
  Order.mapInput(Order.Number, (hidden: HiddenRequiredCheck) => hidden.copy.id)
);

// A red copy is red whatever the replacing run does; a green one waits on a replacing run still going.
const hiddenState = (copy: HeadSuiteCheck, replacedBy: HeadWorkflowSuite): HiddenRequiredState =>
  HeadCheckVerdict.match(copy.verdict, {
    red: (): HiddenRequiredState => "red",
    pending: (): HiddenRequiredState => "pending",
    green: (): HiddenRequiredState => (replacedBy.status === "completed" ? "shadowed" : "pending"),
  });

// One check run judged as a hidden copy of its context; none when the ruleset reads it.
const hiddenCopy =
  (context: string, replaced: ReturnType<typeof replacedSuites>) =>
  (copy: HeadSuiteCheck): O.Option<HiddenRequiredCheck> =>
    O.flatMap(copy.checkSuiteId, (suiteId) =>
      O.map(HashMap.get(replaced, suiteId), ({ hiddenIn, replacedBy }) =>
        HiddenRequiredCheck.make({ context, state: hiddenState(copy, replacedBy), copy, hiddenIn, replacedBy })
      )
    );

// Any run the ruleset reads leaves the context to the gates; a context with no run at all is missing.
const hiddenContext = (
  context: string,
  runs: ReadonlyArray<HeadSuiteCheck>,
  replaced: ReturnType<typeof replacedSuites>
): O.Option<HiddenRequiredCheck> =>
  O.all(A.map(runs, hiddenCopy(context, replaced))).pipe(
    O.flatMap(A.match({ onEmpty: O.none, onNonEmpty: (copies) => O.some(A.max(copies, newerCopy)) }))
  );

/**
 * A gate read's `workflowSuites` field: the head's workflow suites, where an absent key decodes as,
 * and an omitted constructor value builds, no suites.
 *
 * **Example** (A read that never listed workflow runs)
 *
 * ```ts
 * import { HeadWorkflowSuitesField } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const Read = S.Struct({ workflowSuites: HeadWorkflowSuitesField })
 * console.log(S.decodeUnknownSync(Read)({}).workflowSuites.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HeadWorkflowSuitesField = S.Array(HeadWorkflowSuite).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<HeadWorkflowSuite>())),
  S.withDecodingDefaultTypeKey(Effect.succeed(A.empty<HeadWorkflowSuite>()))
);

/**
 * Judge a gate's required contexts from its own check-run records: each run becomes a
 * {@link HeadSuiteCheck} under the gate's verdict, then {@link hiddenRequiredChecks} decides.
 *
 * **Example** (No hidden required check without suites)
 *
 * ```ts
 * import { hiddenRequiredChecksOf } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const hidden = hiddenRequiredChecksOf({
 *   requiredContexts: ["Lint"],
 *   runs: [{ id: 1, name: "Lint", checkSuiteId: O.some(9), conclusion: "success" }],
 *   suites: [],
 *   verdictOf: () => "green",
 * })
 * console.log(hidden.length) // 0
 * ```
 *
 * @param read - The required contexts, the gate's check runs, the head's workflow suites and the
 * gate's verdict for one run.
 * @returns The required contexts no live run reports, each judged by its newest hidden copy.
 * @category decisions
 * @since 0.0.0
 */
export const hiddenRequiredChecksOf = <
  Run extends {
    readonly id: number;
    readonly name: string;
    readonly checkSuiteId: O.Option<number>;
    readonly conclusion: string | null;
  },
>(read: {
  readonly requiredContexts: ReadonlyArray<string>;
  readonly runs: ReadonlyArray<Run>;
  readonly suites: ReadonlyArray<HeadWorkflowSuite>;
  readonly verdictOf: (run: Run) => HeadCheckVerdict;
}): ReadonlyArray<HiddenRequiredCheck> =>
  hiddenRequiredChecks(
    RequiredShadowInput.make({
      requiredContexts: read.requiredContexts,
      checks: A.map(read.runs, (run) =>
        HeadSuiteCheck.make({
          id: run.id,
          name: run.name,
          checkSuiteId: run.checkSuiteId,
          verdict: read.verdictOf(run),
          conclusion: O.fromNullishOr(run.conclusion),
        })
      ),
      suites: read.suites,
    })
  );

/**
 * Judge every required context the base ruleset reads no run of by its
 * newest hidden copy. Pure, so recorded payloads prove every case.
 *
 * **Details**
 *
 * A context is hidden when it has check runs and every one sits in a suite a
 * newer run of the same workflow and event replaced (see
 * {@link rulesetReadsSuite}). A context with any run the ruleset reads is left
 * to the gates, which judge that run red, pending or green, so a copy in a
 * replaced suite never hides or overrides a live run. A context with no run
 * at all is missing, not hidden. Runs of different events never replace each
 * other: a `push` run does not replace a `pull_request` one.
 *
 * The newest hidden copy decides (see {@link HiddenRequiredCheck} for the
 * order, which is never check-run id across suites): `red` when it completed
 * red, `shadowed` when it passed and the replacing run finished, `pending`
 * otherwise (see {@link HiddenRequiredState}). An older green copy never
 * hides a newer red one.
 *
 * **Example** (A newer skipped run hides an older green suite)
 *
 * ```ts
 * import { HeadSuiteCheck, HeadWorkflowSuite, hiddenRequiredChecks, RequiredShadowInput } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const run = (runId: number, checkSuiteId: number, at: string, conclusion: string) =>
 *   HeadWorkflowSuite.make({
 *     runId,
 *     checkSuiteId,
 *     workflowPath: ".github/workflows/heavy-admit.yml",
 *     event: "pull_request",
 *     createdAt: DateTime.makeUnsafe(at),
 *     status: "completed",
 *     conclusion: O.some(conclusion),
 *   })
 * const hidden = hiddenRequiredChecks(
 *   RequiredShadowInput.make({
 *     requiredContexts: ["Heavy / Check"],
 *     checks: [
 *       HeadSuiteCheck.make({
 *         id: 1,
 *         name: "Heavy / Check",
 *         checkSuiteId: O.some(10),
 *         verdict: "green",
 *         conclusion: O.some("success"),
 *       }),
 *     ],
 *     suites: [run(1, 10, "2026-11-12T23:27:45Z", "success"), run(2, 20, "2026-11-12T23:28:51Z", "skipped")],
 *   })
 * )
 * console.log(hidden.map((entry) => [entry.state, entry.replacedBy.runId])) // [["shadowed", 2]]
 * ```
 *
 * @param input - The required contexts, the head's check runs and its workflow runs.
 * @returns One entry per hidden required context, in ruleset order.
 * @category workflows
 * @since 0.0.0
 */
export const hiddenRequiredChecks = (input: RequiredShadowInput): ReadonlyArray<HiddenRequiredCheck> => {
  const replaced = replacedSuites(input.suites);
  return A.getSomes(
    A.map(A.dedupe(input.requiredContexts), (context) =>
      hiddenContext(
        context,
        A.filter(input.checks, (check) => check.name === context),
        replaced
      )
    )
  );
};

const describeRun = (run: HeadWorkflowSuite): string =>
  run.status === "completed" ? O.getOrElse(run.conclusion, () => "no conclusion") : `still ${run.status}`;

const conclusionOf = (copy: HeadSuiteCheck): string => O.getOrElse(copy.conclusion, () => "none");

// What the newest hidden copy did, as a verb phrase.
const copyOutcome = (copy: HeadSuiteCheck): string =>
  HeadCheckVerdict.match(copy.verdict, {
    green: () => "passed",
    red: () => "failed",
    pending: () => "still running",
  });

const copyLabel = (entry: HiddenRequiredCheck): string =>
  HeadCheckVerdict.is.red(entry.copy.verdict) ? `${entry.context}=${conclusionOf(entry.copy)}` : entry.context;

const replacedByText = (run: HeadWorkflowSuite): string =>
  `newer ${run.workflowPath} ${run.event} run ${run.runId} (${describeRun(run)})`;

const renderHiddenGroup = (group: A.NonEmptyReadonlyArray<HiddenRequiredCheck>): string => {
  const { copy, replacedBy } = A.headNonEmpty(group);
  const suites = A.join(
    A.map(A.dedupe(A.map(group, (entry) => entry.hiddenIn.checkSuiteId)), (suite) => `${suite}`),
    ", "
  );
  return `${A.join(A.map(group, copyLabel), ", ")} ${copyOutcome(copy)} only in check suite ${suites}, replaced by ${replacedByText(replacedBy)}`;
};

/**
 * Render hidden required contexts for a hold or a refusal, one clause per
 * replacing run and copy outcome: the contexts (a red one with its
 * conclusion), the replaced suites their newest copy sits in, and the run that
 * replaced them.
 *
 * **Example** (One shadowing run)
 *
 * ```ts
 * import { HeadSuiteCheck, HeadWorkflowSuite, HiddenRequiredCheck, renderHiddenRequiredChecks } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const run = (runId: number, checkSuiteId: number, conclusion: string) =>
 *   HeadWorkflowSuite.make({
 *     runId,
 *     checkSuiteId,
 *     workflowPath: ".github/workflows/heavy-admit.yml",
 *     event: "pull_request",
 *     createdAt: DateTime.makeUnsafe("2026-11-12T23:28:51Z"),
 *     status: "completed",
 *     conclusion: O.some(conclusion),
 *   })
 * const copy = HeadSuiteCheck.make({
 *   id: 1,
 *   name: "Heavy / Check",
 *   checkSuiteId: O.some(10),
 *   verdict: "red",
 *   conclusion: O.some("failure"),
 * })
 * const hidden = HiddenRequiredCheck.make({
 *   context: "Heavy / Check",
 *   state: "red",
 *   copy,
 *   hiddenIn: run(1, 10, "failure"),
 *   replacedBy: run(2, 20, "skipped"),
 * })
 * console.log(renderHiddenRequiredChecks([hidden]))
 * // "Heavy / Check=failure failed only in check suite 10, replaced by newer .github/workflows/heavy-admit.yml pull_request run 2 (skipped)"
 * ```
 *
 * @param hidden - The hidden required contexts.
 * @returns The clauses joined with `; `, empty for no entries.
 * @category formatting
 * @since 0.0.0
 */
export const renderHiddenRequiredChecks = (hidden: ReadonlyArray<HiddenRequiredCheck>): string =>
  A.join(
    A.map(
      R.values(A.groupBy(hidden, (entry) => `${entry.copy.verdict} run ${entry.replacedBy.runId}`)),
      renderHiddenGroup
    ),
    "; "
  );

/**
 * The attribution a relaxed (S11) merge records for a hidden required
 * context no `--tolerate` named: its state, what its newest hidden copy did
 * and where, and which run replaced that suite.
 *
 * **Details**
 *
 * The merge gate uses it for `shadowed` and `pending` contexts. A `red` one
 * is attributed like a live red, from the base evidence, never from here.
 *
 * **Example** (Attribute a shadowed context)
 *
 * ```ts
 * import { HeadSuiteCheck, HeadWorkflowSuite, HiddenRequiredCheck, hiddenRequiredAttribution } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const run = (runId: number, checkSuiteId: number, conclusion: string) =>
 *   HeadWorkflowSuite.make({
 *     runId,
 *     checkSuiteId,
 *     workflowPath: ".github/workflows/heavy-admit.yml",
 *     event: "pull_request",
 *     createdAt: DateTime.makeUnsafe("2026-11-12T23:28:51Z"),
 *     status: "completed",
 *     conclusion: O.some(conclusion),
 *   })
 * const hidden = HiddenRequiredCheck.make({
 *   context: "Heavy / Check",
 *   state: "shadowed",
 *   copy: HeadSuiteCheck.make({
 *     id: 1,
 *     name: "Heavy / Check",
 *     checkSuiteId: O.some(10),
 *     verdict: "green",
 *     conclusion: O.some("success"),
 *   }),
 *   hiddenIn: run(1, 10, "success"),
 *   replacedBy: run(2, 20, "skipped"),
 * })
 * console.log(hiddenRequiredAttribution(hidden).startsWith("shadowed: passed in check suite 10")) // true
 * ```
 *
 * @param hidden - One hidden required context.
 * @returns The attribution text.
 * @category formatting
 * @since 0.0.0
 */
export const hiddenRequiredAttribution = (hidden: HiddenRequiredCheck): string =>
  `${hidden.state}: ${copyOutcome(hidden.copy)} in check suite ${hidden.hiddenIn.checkSuiteId}; ${replacedByText(hidden.replacedBy)} replaced it, so the ruleset reads it as expected`;
