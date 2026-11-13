/**
 * The check-suite shape that failed #3133's merge on 2026-11-12 (head
 * d3c952d664), for the merge gates' shadow tests.
 *
 * `ready-for-heavy` (23:27:45) started Heavy Admit run 43329058531, whose check
 * suite 117334542882 reported the heavy matrix green. `unblocks-main`
 * (23:28:51) started Heavy Admit run 43329206623, suite 117334931047, whose
 * `Heavy Admission` and `Heavy` jobs both skipped because the job `if` read the
 * event's label. The base ruleset then read `Heavy / Check`, `Heavy / Docgen`
 * and `Heavy / Doctest` as "expected"; `Heavy / Test Integration` reports into
 * the Check workflow's suite and counted. The run and suite ids of the two
 * Heavy Admit runs are the recorded ones; the Check run's are stand-ins.
 */

import { HeadWorkflowSuite } from "@beep/repo-cli/test/Yeet";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";

const CHECK_WORKFLOW = ".github/workflows/check.yml";
export const HEAVY_ADMIT_WORKFLOW = ".github/workflows/heavy-admit.yml";

/** Check's own run on the head (stand-in ids, created before both labels). */
const CHECK_RUN = 43328811111;
export const CHECK_SUITE = 117334100000;
/** The `ready-for-heavy` Heavy Admit run: its suite reported the heavy matrix green. */
const ADMITTED_RUN = 43329058531;
export const ADMITTED_SUITE = 117334542882;
/** The `unblocks-main` Heavy Admit run: both jobs skipped. */
export const SKIPPED_RUN = 43329206623;
export const SKIPPED_SUITE = 117334931047;

/** The required contexts the ruleset read as "expected". */
export const SHADOWED_CONTEXTS = ["Heavy / Check", "Heavy / Docgen", "Heavy / Doctest"];

/** The heavy matrix lanes the admitted Heavy Admit run reported (required or not). */
const ADMITTED_LANES = [...SHADOWED_CONTEXTS, "Heavy / Build", "Heavy / Lint Policy"];

export const workflowSuite = (
  fields: Partial<Parameters<typeof HeadWorkflowSuite.make>[0]> &
    Pick<Parameters<typeof HeadWorkflowSuite.make>[0], "runId" | "checkSuiteId">
): HeadWorkflowSuite =>
  HeadWorkflowSuite.make({
    workflowPath: HEAVY_ADMIT_WORKFLOW,
    event: "pull_request",
    createdAt: DateTime.makeUnsafe("2026-11-12T23:27:45Z"),
    status: "completed",
    conclusion: O.some("success"),
    ...fields,
  });

export const checkSuite = workflowSuite({
  runId: CHECK_RUN,
  checkSuiteId: CHECK_SUITE,
  workflowPath: CHECK_WORKFLOW,
  createdAt: DateTime.makeUnsafe("2026-11-12T23:20:02Z"),
});
export const admittedSuite = workflowSuite({ runId: ADMITTED_RUN, checkSuiteId: ADMITTED_SUITE });
export const skippedSuite = workflowSuite({
  runId: SKIPPED_RUN,
  checkSuiteId: SKIPPED_SUITE,
  createdAt: DateTime.makeUnsafe("2026-11-12T23:28:51Z"),
  conclusion: O.some("skipped"),
});

/**
 * A later Heavy Admit run on the head that reported the heavy checks itself, so its suite is the
 * live one (stand-in ids). An older run re-run after it keeps its own `created_at`, so the older
 * suite stays replaced even when its check runs take higher ids.
 */
export const LIVE_SUITE = 117335000001;
export const liveSuite = workflowSuite({
  runId: 43329400001,
  checkSuiteId: LIVE_SUITE,
  createdAt: DateTime.makeUnsafe("2026-11-12T23:40:00Z"),
});

/** The three workflow runs on #3133's head when the merge failed. */
export const pr3133Suites: ReadonlyArray<HeadWorkflowSuite> = [checkSuite, admittedSuite, skippedSuite];

/** The suite a recorded check run reported into: heavy lanes in the admitted run, the rest in Check's. */
export const suiteOfCheck = (name: string): number => (A.contains(ADMITTED_LANES, name) ? ADMITTED_SUITE : CHECK_SUITE);

/** The two check runs the skipped Heavy Admit run reported, newer than every recorded run. */
export const skippedSuiteChecks: ReadonlyArray<{ readonly id: number; readonly name: string }> = [
  { id: 112231300001, name: "Heavy Admission" },
  { id: 112231300002, name: "Heavy" },
];
