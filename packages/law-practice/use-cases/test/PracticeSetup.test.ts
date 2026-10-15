import {
  AutomaticRemediation,
  HumanRemediation,
  ProbeMissing,
  ProbeSatisfied,
  SetupRequirement,
  SetupRequirementId,
} from "@beep/law-practice-domain";
import {
  makeSetupApprovals,
  orderRequirements,
  SetupApprovals,
  SetupDoctor,
  SetupProbes,
  SetupProbesShape,
} from "@beep/law-practice-use-cases/PracticeSetup";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { RepairDecision } from "@beep/law-practice-use-cases/PracticeSetup";

const id = S.decodeUnknownEffect(SetupRequirementId);

const requirements = Effect.gen(function* () {
  const installedId = yield* id("box-drive-installed");
  const signedInId = yield* id("box-drive-signed-in");
  const base = {
    capability: "documents",
    provider: "box-drive",
    explain: "Box Drive keeps your documents here.",
  } as const;
  const install = SetupRequirement.make({
    ...base,
    id: installedId,
    dependsOn: [],
    remediation: AutomaticRemediation.make({ summary: "Install Box Drive" }),
  });
  const signIn = SetupRequirement.make({
    ...base,
    id: signedInId,
    dependsOn: [installedId],
    remediation: HumanRemediation.make({ step: "sign-in", instruction: "Sign in to Box Drive." }),
  });
  return { install, signIn, all: [signIn, install] };
});

const fakeMachine = (decision: RepairDecision) => {
  const satisfied = MutableHashMap.empty<SetupRequirementId, boolean>();
  const repaired: Array<SetupRequirementId> = [];
  const probes = Layer.succeed(
    SetupProbes,
    SetupProbesShape.make({
      probe: (requirement) =>
        Effect.succeed(
          O.getOrElse(MutableHashMap.get(satisfied, requirement.id), () => false)
            ? ProbeSatisfied.make({})
            : ProbeMissing.make({ detail: `${requirement.id} is not set up.` })
        ),
      repair: (requirement) =>
        Effect.sync(() => {
          repaired.push(requirement.id);
          MutableHashMap.set(satisfied, requirement.id, true);
        }),
    })
  );
  const approvals = Layer.succeed(
    SetupApprovals,
    makeSetupApprovals(() => Effect.succeed(decision))
  );
  return {
    satisfied,
    repaired,
    layer: SetupDoctor.layer.pipe(Layer.provide(Layer.mergeAll(probes, approvals))),
  };
};

describe("orderRequirements", () => {
  it.effect("puts dependencies first", () =>
    Effect.gen(function* () {
      const { all, install, signIn } = yield* requirements;
      const ordered = yield* orderRequirements(all);
      expect(ordered.map((requirement) => requirement.id)).toEqual([install.id, signIn.id]);
    })
  );

  it.effect("rejects duplicates, unknown dependencies and cycles", () =>
    Effect.gen(function* () {
      const { install, signIn } = yield* requirements;
      const duplicate = yield* Effect.flip(orderRequirements([install, install]));
      expect(duplicate.problem).toBe("duplicate-id");
      const unknown = yield* Effect.flip(orderRequirements([signIn]));
      expect(unknown.problem).toBe("unknown-dependency");
      const cyclic = SetupRequirement.make({
        id: install.id,
        capability: install.capability,
        provider: install.provider,
        dependsOn: [signIn.id],
        remediation: install.remediation,
        explain: install.explain,
      });
      const cycle = yield* Effect.flip(orderRequirements([signIn, cyclic]));
      expect(cycle.problem).toBe("cycle");
    })
  );
});

const approving = fakeMachine("approved");

describe("SetupDoctor with approvals", () => {
  it.layer(approving.layer, { timeout: "10 seconds" })((it) => {
    it.effect("blocks dependents and lists only actionable human steps", () =>
      Effect.gen(function* () {
        const { all, install, signIn } = yield* requirements;
        const doctor = yield* SetupDoctor;
        const report = yield* doctor.check(all);
        expect(report.checks.map((check) => check.state)).toEqual(["probed", "blocked"]);
        expect(report.humanSteps).toEqual([]);
        expect(report.complete).toBe(false);

        const repaired = yield* doctor.repair({ requirements: all, requirement: install.id });
        expect(repaired.status).toBe("satisfied");
        expect(approving.repaired).toEqual([install.id]);

        const next = yield* doctor.check(all);
        expect(next.checks.map((check) => check.state)).toEqual(["probed", "probed"]);
        expect(next.humanSteps.map((step) => step.requirement)).toEqual([signIn.id]);
        expect(next.complete).toBe(false);
      })
    );
  });
});

const declining = fakeMachine("declined");

describe("SetupDoctor refusals", () => {
  it.layer(declining.layer, { timeout: "10 seconds" })((it) => {
    it.effect("refuses declined, human and already-satisfied repairs", () =>
      Effect.gen(function* () {
        const { all, install, signIn } = yield* requirements;
        const doctor = yield* SetupDoctor;
        const refusedByLawyer = yield* Effect.flip(doctor.repair({ requirements: all, requirement: install.id }));
        expect(refusedByLawyer._tag === "SetupRepairRefused" && refusedByLawyer.refusal).toBe("declined");
        expect(declining.repaired).toEqual([]);

        const humanOnly = yield* Effect.flip(doctor.repair({ requirements: all, requirement: signIn.id }));
        expect(humanOnly._tag === "SetupRepairRefused" && humanOnly.refusal).toBe("needs-human");

        MutableHashMap.set(declining.satisfied, install.id, true);
        const done = yield* Effect.flip(doctor.repair({ requirements: all, requirement: install.id }));
        expect(done._tag === "SetupRepairRefused" && done.refusal).toBe("already-satisfied");
      })
    );
  });
});
