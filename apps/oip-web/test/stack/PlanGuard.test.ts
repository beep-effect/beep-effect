// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { checkPlan, guardedKindOf, parsePlanLog } from "../../stack/PlanGuard.ts";
import { failureTag } from "./Harness.ts";

const esc = String.fromCharCode(27);
const color = (code: number, text: string) => `${esc}[${code}m${text}${esc}[0m`;

/** A first prod plan as the census predicts it, colored the way the CI renderer prints it. */
const firstProdPlan = A.join(
  [
    `${color(1, "Plan:")} 1 to create, 5 to adopted`,
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
    expect(guardedKindOf("EnvNextDisablePwa")).toEqual(O.some("envVar"));
    expect(guardedKindOf("SomethingElse")).toEqual(O.none());
  });

  it.effect("accepts creates, updates and adoptions", () =>
    Effect.gen(function* () {
      const entries = yield* checkPlan(
        "Plan: 1 to create, 1 to update, 2 to adopted\n[AssetsBucket] create\n[Dns-oip-law] update\n[EnvNextDisablePwa] adopted\n[Project] adopted\n[Domain-oip-law] noop\n"
      );
      expect(entries.length).toBe(5);
      const prod = yield* checkPlan(firstProdPlan);
      expect(prod.length).toBe(6);
      const empty = yield* checkPlan("Plan: no resources\n");
      expect(empty).toEqual([]);
    })
  );

  it.effect("refuses a replace, delete or orphan of a project, variable, domain, DNS record or bucket", () =>
    Effect.gen(function* () {
      for (const line of [
        "[Project] replace",
        "[EnvNextDisablePwa] replace",
        "[EnvHubSpotServiceKey] delete",
        "[Domain-oip-law] delete",
        "[Dns-www-opip-law] orphaned",
        "[AssetsBucket] replace",
      ]) {
        const action = O.getOrElse(A.get(Str.split(" ")(line), 1), () => "");
        const exit = yield* Effect.exit(checkPlan(`Plan: 1 to ${action}\n${line}\n`));
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

describe("PlanGuard fails closed", () => {
  const unreadable = (log: string) =>
    Effect.map(Effect.exit(checkPlan(log)), (exit) => expect(failureTag(exit)).toEqual(O.some("PlanUnreadable")));

  it.effect("on a resource line with an action it does not know", () =>
    Effect.gen(function* () {
      yield* unreadable("Plan: 1 to create\n[AssetsBucket] create\n[Project] transmogrify\n");
      // A reshaped line: the action is no longer a bare word after the FQN.
      yield* unreadable("Plan: 1 to update\n[Project] (update)\n");
    })
  );

  it.effect("when the summary counts disagree with the resource lines", () =>
    Effect.gen(function* () {
      // A silently dropped line: the summary counts two adoptions, the log lists one.
      yield* unreadable("Plan: 2 to adopted\n[Project] adopted\n");
      // A line the summary does not count.
      yield* unreadable("Plan: 1 to create\n[AssetsBucket] create\n[Dns-oip-law] update\n");
      // A summary action the guard does not know.
      yield* unreadable("Plan: 1 to frobnicate\n");
      // No resources, yet a resource line.
      yield* unreadable("Plan: no resources\n[Project] create\n");
    })
  );

  it.effect("reads a logger prefix that carries a fiber id", () =>
    Effect.gen(function* () {
      const entries = yield* checkPlan(
        "[05:10:00.001] INFO (#7): Plan: 1 to update\n[05:10:00.002] INFO (#7): [Project] update\n"
      );
      expect(entries).toEqual([{ fqn: "Project", action: "update" }]);
    })
  );
});
