import {
  CapabilityChoice,
  CapabilityGap,
  CapabilitySupported,
  ItLimits,
  PracticeProfile,
} from "@beep/law-practice-domain/values/PracticeProfile";
import {
  AutomaticRemediation,
  HumanRemediation,
  ProbeMissing,
  ProbeResult,
  Remediation,
  SetupCapability,
  SetupProvider,
  SetupRequirement,
  SetupRequirementId,
} from "@beep/law-practice-domain/values/SetupRequirement";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeProfile = S.decodeUnknownEffect(PracticeProfile);
const encodeProfile = S.encodeEffect(PracticeProfile);
const decodeRequirementId = S.decodeUnknownEffect(SetupRequirementId);

describe("PracticeProfile", () => {
  it.effect.prop(
    "round-trips any profile through its encoded form",
    { profile: Arbitrary.schema(PracticeProfile) },
    Effect.fnUntraced(function* ({ profile }) {
      const decoded = yield* decodeProfile(yield* encodeProfile(profile));
      deepStrictEqual(yield* encodeProfile(decoded), yield* encodeProfile(profile));
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect("round-trips supported, gap and declined choices", () =>
    Effect.gen(function* () {
      const profile = PracticeProfile.make({
        choices: [
          CapabilitySupported.make({ capability: "documents", provider: "box-drive" }),
          CapabilityGap.make({ capability: "practice-billing", namedProvider: "Clio", fallback: O.none() }),
          CapabilityGap.make({
            capability: "documents",
            namedProvider: "NetDocuments",
            fallback: O.some("box-drive"),
          }),
        ],
        itLimits: ItLimits.make({ adminRights: "available", proxy: "none" }),
        recordedAt: DateTime.makeUnsafe(1_760_000_000_000),
      });

      const encoded = yield* encodeProfile(profile);
      expect(encoded.choices[1]).toEqual({ kind: "gap", capability: "practice-billing", namedProvider: "Clio" });

      const decoded = yield* decodeProfile(encoded);
      expect(decoded.choices.map((choice) => choice.kind)).toEqual(["supported", "gap", "gap"]);
      expect(CapabilityChoice.guards.gap(decoded.choices[2])).toBe(true);
    })
  );

  it.effect("rejects an interview with no choices", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        decodeProfile({ choices: [], itLimits: { adminRights: "unknown", proxy: "unknown" }, recordedAt: 0 })
      );
      expect(result._tag).toBe("Failure");
    })
  );

  it.effect("rejects a provider without an adapter", () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        decodeProfile({
          choices: [{ kind: "supported", capability: "documents", provider: "netdocuments" }],
          itLimits: { adminRights: "unknown", proxy: "unknown" },
          recordedAt: 0,
        })
      );
      expect(result._tag).toBe("Failure");
    })
  );
});

describe("SetupRequirement", () => {
  it.effect("accepts kebab-case ids and rejects others", () =>
    Effect.gen(function* () {
      const id = yield* decodeRequirementId("box-drive-signed-in");
      expect(id).toBe("box-drive-signed-in");
      const bad = yield* Effect.exit(decodeRequirementId("Box_Drive"));
      expect(bad._tag).toBe("Failure");
    })
  );

  it.effect("builds a requirement graph edge with a human remediation", () =>
    Effect.gen(function* () {
      const installed = yield* decodeRequirementId("box-drive-installed");
      const requirement = SetupRequirement.make({
        id: yield* decodeRequirementId("box-drive-signed-in"),
        capability: "documents",
        provider: "box-drive",
        dependsOn: [installed],
        remediation: HumanRemediation.make({
          step: "sign-in",
          instruction: "Open Box Drive and sign in with your Box account.",
        }),
        explain: "Box Drive must be signed in so your documents are available.",
      });
      expect(requirement.dependsOn).toEqual([installed]);
      expect(Remediation.guards["needs-human"](requirement.remediation)).toBe(true);
      expect(Remediation.guards.automatic(AutomaticRemediation.make({ summary: "Install Box Drive" }))).toBe(true);
    })
  );

  it.effect("decodes a workstation requirement owned by Claude", () =>
    Effect.gen(function* () {
      const requirement = yield* S.decodeEffect(SetupRequirement)({
        id: "claude-signed-in",
        capability: "workstation",
        provider: "claude",
        dependsOn: [],
        remediation: { kind: "needs-human", step: "install", instruction: "Install Claude Desktop." },
        explain: "Claude runs the practice tools.",
      });
      expect(SetupCapability.is.workstation(requirement.capability)).toBe(true);
      expect(SetupProvider.is.claude(requirement.provider)).toBe(true);
      expect(SetupProvider.is["box-drive"]("box-drive")).toBe(true);
    })
  );

  it("discriminates probe results on status", () => {
    const result: ProbeResult = ProbeMissing.make({ detail: "Box Drive is not installed." });
    expect(ProbeResult.guards.missing(result)).toBe(true);
    expect(ProbeResult.guards.satisfied(result)).toBe(false);
  });
});
