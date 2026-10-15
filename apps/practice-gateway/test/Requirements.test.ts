import {
  CapabilityDeclined,
  CapabilitySupported,
  PracticeProfile,
  SetupRequirementId,
} from "@beep/law-practice-domain";
import {
  baseRequirements,
  profileSelects,
  RequirementCatalog,
  requirementsFor,
  requirementsForSaved,
} from "@beep/practice-gateway/Requirements";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { fullProfile, gapProfile, itLimits } from "./fixtures.ts";

const ids = A.map((requirement: { readonly id: string }) => requirement.id);

describe("requirementsFor", () => {
  it("uses the workstation requirements before any profile is saved", () => {
    expect(ids(requirementsForSaved(O.none()))).toEqual([
      "claude-desktop-installed",
      "claude-signed-in",
      "bitlocker-on",
    ]);
    expect(A.every(baseRequirements, (requirement) => requirement.capability === "workstation")).toBe(true);
  });

  it("puts Claude first and BitLocker last around the selected providers", () => {
    expect(ids(requirementsFor(fullProfile))).toEqual([
      "claude-desktop-installed",
      "claude-signed-in",
      "box-drive-installed",
      "box-drive-signed-in",
      "box-drive-folder-available",
      "m365-consented",
      "m365-token-cached",
      "practice-kg-bundle-present",
      "practice-kg-self-check",
      "bitlocker-on",
    ]);
  });

  it("carries the choice's capability and the catalog's dependencies", () => {
    const signedIn = A.findFirst(
      requirementsFor(fullProfile),
      (requirement) => requirement.id === "box-drive-signed-in"
    );
    assertSome(
      O.map(signedIn, (requirement) => requirement.capability),
      "documents"
    );
    assertSome(
      O.map(signedIn, (requirement) => requirement.dependsOn),
      [SetupRequirementId.make("box-drive-installed")]
    );
  });

  it("serves a gap through its fallback provider", () => {
    expect(ids(requirementsFor(gapProfile))).toContain("box-drive-installed");
    expect(profileSelects(gapProfile, "box-drive")).toBe(true);
  });

  it("brings a provider once when two capabilities choose it", () => {
    const profile = PracticeProfile.make({
      ...fullProfile,
      choices: [
        CapabilitySupported.make({ capability: "documents", provider: "microsoft-365" }),
        CapabilitySupported.make({ capability: "mail-calendar", provider: "microsoft-365" }),
        CapabilityDeclined.make({ capability: "practice-billing" }),
      ],
      itLimits,
    });
    const requirements = requirementsFor(profile);
    expect(ids(requirements)).toEqual([
      "claude-desktop-installed",
      "claude-signed-in",
      "m365-consented",
      "m365-token-cached",
      "bitlocker-on",
    ]);
    expect(profileSelects("practice-kg")(profile)).toBe(false);
  });

  it("marks Box Drive install and the Microsoft 365 sign-in page as the automatic remediations", () => {
    const automatic = A.filter(R.values(RequirementCatalog), (entry) => entry.remediation.kind === "automatic");
    expect(ids(automatic)).toEqual(["box-drive-installed", "m365-consented"]);
  });
});
