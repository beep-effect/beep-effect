// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { checkPlan, guardedKindOf, parsePlanLog } from "../../stack/PlanGuard.ts";
import { failureTag } from "./Harness.ts";

const esc = String.fromCharCode(27);
const color = (code: number, text: string) => `${esc}[${code}m${text}${esc}[0m`;

/** A first prod plan as the census predicts it, colored the way the CI renderer prints it. */
const firstProdPlan = A.join(
  [
    `${color(1, "Plan:")} 1 to create, 13 to adopted`,
    `${color(2, "[AssetsBucket]")} ${color(32, "create")}`,
    "[Dns-oip-law] adopted",
    "[Dns-www-oip-law] adopted",
    "[Domain-oip-law] adopted",
    "[EnvHubSpotServiceKey] adopted",
    "[Project] adopted",
    "",
  ],
  "\n"
);

describe("PlanGuard", () => {
  it("parses resource lines and ignores everything else", () => {
    expect(parsePlanLog(firstProdPlan)).toEqual([
      { fqn: "AssetsBucket", action: "create" },
      { fqn: "Dns-oip-law", action: "adopted" },
      { fqn: "Dns-www-oip-law", action: "adopted" },
      { fqn: "Domain-oip-law", action: "adopted" },
      { fqn: "EnvHubSpotServiceKey", action: "adopted" },
      { fqn: "Project", action: "adopted" },
    ]);
    expect(parsePlanLog("Planning stage prod\n[Project] wobble\n")).toEqual([]);
  });

  it("classifies guarded resources by the last FQN segment", () => {
    expect(guardedKindOf("Project")).toEqual(O.some("project"));
    expect(guardedKindOf("Domain-www-oip-law")).toEqual(O.some("domain"));
    expect(guardedKindOf("Dns-oip-law")).toEqual(O.some("dns"));
    expect(guardedKindOf("AssetsBucket")).toEqual(O.some("bucket"));
    expect(guardedKindOf("Ns/Project")).toEqual(O.some("project"));
    expect(guardedKindOf("EnvNextDisablePwa")).toEqual(O.none());
  });

  it.effect("accepts creates, updates, adoptions and an environment variable replacement", () =>
    Effect.gen(function* () {
      const entries = yield* checkPlan(`${firstProdPlan}[EnvNextDisablePwa] replace\n[Dns-oip-law] update\n`);
      expect(entries.length).toBe(8);
      const empty = yield* checkPlan("Plan: no resources\n");
      expect(empty).toEqual([]);
    })
  );

  it.effect("refuses a replace, delete or orphan of a project, domain, DNS record or bucket", () =>
    Effect.gen(function* () {
      for (const line of [
        "[Project] replace",
        "[Domain-oip-law] delete",
        "[Dns-www-opip-law] orphaned",
        "[AssetsBucket] replace",
      ]) {
        const exit = yield* Effect.exit(checkPlan(`Plan: 1 to change\n${line}\n`));
        expect(failureTag(exit)).toEqual(O.some("PlanRefused"));
      }
    })
  );

  it.effect("reads the timestamped logger format a CI plan prints", () =>
    Effect.gen(function* () {
      // Verbatim shape of the 2026-11-14 `dev_elpresidank` plan log.
      const personalPlan = A.join(
        [
          "[20:33:00.808] INFO: Plan · dev_elpresidank",
          "[20:33:03.094] INFO: Plan ready (2.3s)",
          "[20:33:03.096] INFO: Plan: 4 to create",
          "[20:33:03.096] INFO: [AssetsBucket] create",
          "[20:33:03.096] INFO: [EnvHubSpotAccountId] create",
          "[20:33:03.096] INFO: [EnvNextDisablePwa] create",
          "[20:33:03.096] INFO: [Project] create",
        ],
        "\n"
      );
      const entries = yield* checkPlan(personalPlan);
      expect(A.map(entries, (entry) => entry.fqn)).toEqual([
        "AssetsBucket",
        "EnvHubSpotAccountId",
        "EnvNextDisablePwa",
        "Project",
      ]);
      const refused = yield* Effect.exit(
        checkPlan("[20:33:03.096] INFO: Plan: 1 to replace\n[20:33:03.096] INFO: [Dns-oip-law] replace\n")
      );
      expect(failureTag(refused)).toEqual(O.some("PlanRefused"));
    })
  );

  it.effect("fails closed on a log without a plan summary", () =>
    Effect.gen(function* () {
      const crashed = yield* Effect.exit(checkPlan("Error: state store not bootstrapped\n"));
      expect(failureTag(crashed)).toEqual(O.some("PlanUnreadable"));
    })
  );
});
