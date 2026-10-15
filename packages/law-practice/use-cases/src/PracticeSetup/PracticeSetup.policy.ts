/**
 * Pure setup-doctor policy: order requirements by dependency and assemble a
 * report from probe outcomes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  CheckBlocked,
  CheckProbed,
  PendingHumanStep,
  ProbeResult,
  Remediation,
  RequirementCheck,
  SetupReport,
  SetupRequirementId,
} from "@beep/law-practice-domain";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { SetupRequirement } from "@beep/law-practice-domain";

const $I = $LawPracticeUseCasesId.create("PracticeSetup/PracticeSetup.policy");

const SetupGraphProblemBase = LiteralKit(["duplicate-id", "unknown-dependency", "cycle"]);

/**
 * What is wrong with a requirement graph.
 *
 * **Example** (Check a problem kind)
 *
 * ```ts
 * import { SetupGraphProblem } from "@beep/law-practice-use-cases/PracticeSetup"
 *
 * console.log(SetupGraphProblem.is.cycle("cycle")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SetupGraphProblem = SetupGraphProblemBase.pipe(
  $I.annoteSchema("SetupGraphProblem", {
    description: "What is wrong with a setup requirement graph.",
  }),
  SchemaUtils.withLiteralKitStatics(SetupGraphProblemBase)
);

/**
 * Decoded type of {@link SetupGraphProblem}.
 *
 * **Example** (Type a problem)
 *
 * ```ts
 * import type { SetupGraphProblem } from "@beep/law-practice-use-cases/PracticeSetup"
 *
 * const problem: SetupGraphProblem = "unknown-dependency"
 * console.log(problem)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SetupGraphProblem = typeof SetupGraphProblem.Type;

/**
 * The requirement set cannot be ordered.
 *
 * **Details**
 *
 * A defect in the gateway's requirement catalog, not in the lawyer's machine:
 * duplicate ids, a dependency on an id not in the set, or a dependency cycle.
 *
 * **Example** (Report a cycle)
 *
 * ```ts
 * import { SetupGraphInvalid } from "@beep/law-practice-use-cases/PracticeSetup"
 * import * as O from "effect/Option"
 *
 * const error = SetupGraphInvalid.make({ problem: "cycle", requirement: O.none() })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SetupGraphInvalid extends S.TaggedError<SetupGraphInvalid, { readonly brand: unique symbol }>(
  $I`SetupGraphInvalid`
)(
  "SetupGraphInvalid",
  {
    problem: SetupGraphProblem.annotateKey({ description: "What is wrong with the graph." }),
    requirement: SetupRequirementId.pipe(
      S.OptionFromOptionalKey,
      S.annotateKey({ description: "The requirement where the problem was found, when known." })
    ),
  },
  $I.annoteError<SetupGraphInvalid>("SetupGraphInvalid", {
    title: "Setup requirement graph invalid",
    description: "The setup requirement set cannot be ordered by dependency.",
  })
) {}

/**
 * Order requirements so every dependency precedes its dependents.
 *
 * **Example** (Order two requirements)
 *
 * ```ts
 * import { HumanRemediation, SetupRequirement, SetupRequirementId } from "@beep/law-practice-domain"
 * import { orderRequirements } from "@beep/law-practice-use-cases/PracticeSetup"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = S.decodeUnknownEffect(SetupRequirementId)
 *   const installed = yield* id("box-drive-installed")
 *   const signedIn = yield* id("box-drive-signed-in")
 *   const remediation = HumanRemediation.make({ step: "sign-in", instruction: "Sign in to Box Drive." })
 *   const base = { capability: "documents", provider: "box-drive", remediation, explain: "Box Drive." } as const
 *   const ordered = yield* orderRequirements([
 *     SetupRequirement.make({ ...base, id: signedIn, dependsOn: [installed] }),
 *     SetupRequirement.make({ ...base, id: installed, dependsOn: [] }),
 *   ])
 *   return ordered.map((requirement) => requirement.id)
 * })
 * Effect.runPromise(program).then(console.log) // ["box-drive-installed", "box-drive-signed-in"]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const orderRequirements = Effect.fnUntraced(function* (requirements: ReadonlyArray<SetupRequirement>) {
  let indexById = HashMap.empty<SetupRequirementId, number>();
  for (const [index, requirement] of requirements.entries()) {
    if (HashMap.has(indexById, requirement.id)) {
      return yield* SetupGraphInvalid.make({ problem: "duplicate-id", requirement: O.some(requirement.id) });
    }
    indexById = HashMap.set(indexById, requirement.id, index);
  }
  for (const requirement of requirements) {
    if (!A.every(requirement.dependsOn, (dependency) => HashMap.has(indexById, dependency))) {
      return yield* SetupGraphInvalid.make({ problem: "unknown-dependency", requirement: O.some(requirement.id) });
    }
  }
  const graph = Graph.directed<SetupRequirement, undefined>((mutable) => {
    for (const requirement of requirements) {
      Graph.addNode(mutable, requirement);
    }
    for (const [index, requirement] of requirements.entries()) {
      for (const dependency of requirement.dependsOn) {
        Graph.addEdge(mutable, O.getOrThrow(HashMap.get(indexById, dependency)), index, undefined);
      }
    }
  });
  if (!Graph.isAcyclic(graph)) {
    return yield* SetupGraphInvalid.make({ problem: "cycle", requirement: O.none() });
  }
  return graph.pipe(Graph.topo(), Graph.values, A.fromIterable);
});

/**
 * Assemble a report from requirements already in dependency order.
 *
 * **Details**
 *
 * `outcomeOf` returns the probe result for a requirement whose dependencies
 * are all satisfied; requirements with an unsatisfied dependency are reported
 * blocked without probing. Human steps are listed only for probed, unsatisfied
 * requirements whose remediation needs the lawyer.
 *
 * **Example** (Report an empty requirement set)
 *
 * ```ts
 * import { assembleReport } from "@beep/law-practice-use-cases/PracticeSetup"
 * import * as Effect from "effect/Effect"
 *
 * const program = assembleReport([], () => Effect.die("never probed"))
 * Effect.runPromise(program).then((report) => console.log(report.complete)) // true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const assembleReport = Effect.fnUntraced(function* <E, R>(
  ordered: ReadonlyArray<SetupRequirement>,
  outcomeOf: (requirement: SetupRequirement) => Effect.Effect<ProbeResult, E, R>
) {
  let satisfied = HashMap.empty<SetupRequirementId, boolean>();
  const checks: Array<RequirementCheck> = [];
  const humanSteps: Array<PendingHumanStep> = [];
  for (const requirement of ordered) {
    const waitingOn = A.filter(
      requirement.dependsOn,
      (dependency) => O.getOrElse(HashMap.get(satisfied, dependency), () => false) === false
    );
    if (A.isReadonlyArrayNonEmpty(waitingOn)) {
      satisfied = HashMap.set(satisfied, requirement.id, false);
      checks.push(CheckBlocked.make({ requirement: requirement.id, waitingOn }));
      continue;
    }
    const result = yield* outcomeOf(requirement);
    const ok = ProbeResult.guards.satisfied(result);
    satisfied = HashMap.set(satisfied, requirement.id, ok);
    checks.push(CheckProbed.make({ requirement: requirement.id, result }));
    if (!ok && Remediation.guards["needs-human"](requirement.remediation)) {
      humanSteps.push(PendingHumanStep.make({ requirement: requirement.id, remediation: requirement.remediation }));
    }
  }
  return SetupReport.make({
    checks,
    humanSteps,
    complete: A.every(
      checks,
      (check) => RequirementCheck.guards.probed(check) && ProbeResult.guards.satisfied(check.result)
    ),
  });
});
