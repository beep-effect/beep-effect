import {
  AwsSettingsOutputs,
  checkPlan,
  LiveSettings,
  liveSettingsFromAws,
  parsePlanLog,
} from "@beep/infra-cost-controls/PlanCheck";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { PlanCheckFailed } from "@beep/infra-cost-controls/PlanCheck";

const esc = String.fromCharCode(27);
const replaceIn = (text: string, search: string, replacement: string) => Str.replace(search, replacement)(text);
const line = (text: string) => `[18:22:59.111] INFO: ${text}`;
const colored = (fqn: string, action: string) => line(`${esc}[1m[${fqn}]${esc}[0m ${esc}[33m${action}${esc}[0m`);

const singletons = [
  "AccountServicesMonitor",
  "AppTag",
  "BeepCiTag",
  "ComputeOptimizer",
  "CostOptimizationHub",
  "DataClassTag",
  "GhrEnvironmentTag",
  "ManagedByTag",
  "ProjectTag",
];

const adoptedClean = (fqn: string) => [colored(fqn, "adopted"), line("  no declared property changes"), line("")];

const firstPlan = A.join(
  [
    line("Plan: 1 to create, 9 to adopted"),
    line(""),
    ...A.flatMap(singletons, adoptedClean),
    colored("MonthlyBudget", "create"),
    line("  properties:"),
    line("    budgetName: beep-account-monthly-cost"),
    line("    notifications: []"),
  ],
  "\n"
);

const live = LiveSettings.make({
  costAllocationTags: A.map(["App", "beep-ci", "DataClass", "ghr:environment", "ManagedBy", "Project"], (TagKey) => ({
    TagKey,
    Status: "Active",
  })),
  computeOptimizer: { status: "Active", memberAccountsEnrolled: false },
  costOptimizationHub: { includeMemberAccounts: false, items: [{ status: "Active" }] },
  anomalyMonitors: [{ MonitorName: "beep-account-services", MonitorType: "DIMENSIONAL", MonitorDimension: "SERVICE" }],
});

const refusal = (plan: string, settings: LiveSettings = live) =>
  checkPlan(parsePlanLog(plan), settings).pipe(
    Effect.flip,
    Effect.map((failure: PlanCheckFailed) => failure)
  );

describe("parsePlanLog", () => {
  it("reads actions through log prefixes and ANSI colors and keeps property names, not values", () => {
    const { entries } = parsePlanLog(
      A.join(
        [colored("AppTag", "update"), line("  - status: Active"), line("  + status: Inactive"), colored("X", "noop")],
        "\n"
      )
    );
    expect(A.map(entries, (entry) => [entry.fqn, entry.action, entry.changedProperties])).toEqual([
      ["AppTag", "update", ["status"]],
      ["X", "noop", []],
    ]);
  });

  it("reports nested keys by name and a bare scalar as (value), so no address reaches the log", () => {
    const { entries } = parsePlanLog(
      A.join(
        [
          colored("MonthlyBudget", "update"),
          line("  properties:"),
          line("  - notifications: []"),
          line("  + notifications:"),
          line("  +   - address: ops@example.com"),
          line("  +     - billing@example.com"),
        ],
        "\n"
      )
    );
    expect(entries[0]?.changedProperties).toEqual(["notifications", "address", "(value)"]);
    expect(A.join(entries[0]?.changedProperties ?? [], ",")).not.toContain("@");
  });

  it("reports a bare scalar as (value), a URL or an identifier-shaped one included, because only a key colon names a property", () => {
    const { entries } = parsePlanLog(
      A.join(
        [
          colored("ApiKey", "update"),
          line("  + tokens:"),
          line("  +   - token123"),
          line("  +   - https://hooks.example.com/x"),
          line("  + rotation"),
        ],
        "\n"
      )
    );
    expect(entries[0]?.changedProperties).toEqual(["tokens", "(value)"]);
  });

  it("ignores action tasks and the summary line", () => {
    const log = parsePlanLog(A.join([line("Plan: no changes"), line("[Seed] run [action]")], "\n"));
    expect(log.entries).toEqual([]);
    expect(log.unreadable).toEqual([]);
  });
});

describe("checkPlan", () => {
  it.effect("passes a clean first plan: one create, nine adopts, live settings as declared", () =>
    Effect.gen(function* () {
      const entries = yield* checkPlan(parsePlanLog(firstPlan), live);
      expect(entries).toHaveLength(10);
    })
  );

  it.effect("passes a later plan where every singleton is a no-op", () =>
    Effect.gen(function* () {
      const plan = A.join(
        [...A.map(singletons, (fqn) => colored(fqn, "noop")), colored("MonthlyBudget", "noop")],
        "\n"
      );
      yield* checkPlan(parsePlanLog(plan), live);
    })
  );

  it.effect("refuses a singleton update", () =>
    Effect.gen(function* () {
      const plan = replaceIn(firstPlan, colored("AppTag", "adopted"), colored("AppTag", "update"));
      const failure = yield* refusal(plan);
      expect(A.map(failure.violations, (v) => [v.subject, v.reason])).toEqual([
        ["AppTag", "singleton-not-adopt-or-noop"],
      ]);
      expect(failure.escalate).toBe(false);
    })
  );

  it.effect("refuses an adopted singleton whose declared properties change", () =>
    Effect.gen(function* () {
      const plan = replaceIn(
        firstPlan,
        `${colored("ComputeOptimizer", "adopted")}\n${line("  no declared property changes")}`,
        A.join([colored("ComputeOptimizer", "adopted"), line("  - status: Active"), line("  + status: Inactive")], "\n")
      );
      const failure = yield* refusal(plan);
      expect(A.map(failure.violations, (v) => [v.subject, v.reason, v.detail])).toEqual([
        ["ComputeOptimizer", "singleton-property-change", "status"],
      ]);
    })
  );

  it.effect("refuses a delete and a replace anywhere in the plan", () =>
    Effect.gen(function* () {
      const plan = A.join([firstPlan, colored("MonthlyBudget", "delete"), colored("AnomalyAlerts", "replace")], "\n");
      const failure = yield* refusal(plan);
      expect(A.map(failure.violations, (v) => [v.subject, v.reason])).toEqual([
        ["MonthlyBudget", "delete-or-replace"],
        ["AnomalyAlerts", "delete-or-replace"],
      ]);
    })
  );

  it.effect("refuses a missing singleton", () =>
    Effect.gen(function* () {
      const plan = replaceIn(firstPlan, colored("ProjectTag", "adopted"), "");
      const failure = yield* refusal(plan);
      expect(A.map(failure.violations, (v) => [v.subject, v.reason])).toEqual([["ProjectTag", "singleton-missing"]]);
    })
  );

  it.effect("refuses when a live setting differs from the declared one", () =>
    Effect.gen(function* () {
      const drifted = LiveSettings.make({
        ...live,
        costAllocationTags: A.map(live.costAllocationTags, (tag) =>
          tag.TagKey === "beep-ci" ? { ...tag, Status: "Inactive" } : tag
        ),
        computeOptimizer: { status: "Active", memberAccountsEnrolled: true },
      });
      const failure = yield* refusal(firstPlan, drifted);
      expect(A.map(failure.violations, (v) => [v.subject, v.reason])).toEqual([
        ["tag beep-ci", "live-setting-differs"],
        ["ComputeOptimizer", "live-setting-differs"],
      ]);
    })
  );

  it.effect("stops and escalates on any resource outside the stack, such as a launch-throttling one", () =>
    Effect.gen(function* () {
      const failure = yield* refusal(A.join([firstPlan, colored("SpotQuota", "create")], "\n"));
      expect(A.map(failure.violations, (v) => [v.subject, v.reason])).toEqual([["SpotQuota", "unexpected-resource"]]);
      expect(failure.escalate).toBe(true);
    })
  );
});

describe("liveSettingsFromAws", () => {
  it.effect("shapes raw AWS outputs that omit both member-account flags, and the gate passes", () =>
    Effect.gen(function* () {
      const raw = yield* S.decodeUnknownEffect(AwsSettingsOutputs)({
        costAllocationTags: {
          CostAllocationTags: A.map(live.costAllocationTags, (tag) => ({ ...tag, Type: "UserDefined" })),
        },
        computeOptimizer: { status: "Active", lastUpdatedTimestamp: "2026-09-09T12:45:40Z" },
        costOptimizationHub: { items: [{ accountId: "832907639880", status: "Active" }] },
        anomalyMonitors: {
          AnomalyMonitors: [
            {
              MonitorArn: "arn:aws:ce::832907639880:anomalymonitor/x",
              MonitorName: "beep-account-services",
              MonitorType: "DIMENSIONAL",
              MonitorDimension: "SERVICE",
            },
          ],
        },
      });
      const settings = liveSettingsFromAws(raw);
      expect(settings.computeOptimizer).toEqual({ status: "Active" });
      expect(settings.costOptimizationHub).toEqual({ items: [{ status: "Active" }] });
      yield* checkPlan(parsePlanLog(firstPlan), settings);
    })
  );

  it.effect("keeps a reported member-account flag, so an organization-wide enrollment is refused", () =>
    Effect.gen(function* () {
      const raw = yield* S.decodeEffect(AwsSettingsOutputs)({
        costAllocationTags: { CostAllocationTags: live.costAllocationTags },
        computeOptimizer: { status: "Active", memberAccountsEnrolled: true },
        costOptimizationHub: { includeMemberAccounts: false, items: [{ status: "Active" }] },
        anomalyMonitors: { AnomalyMonitors: live.anomalyMonitors },
      });
      const failure = yield* refusal(firstPlan, liveSettingsFromAws(raw));
      expect(A.map(failure.violations, (v) => [v.subject, v.reason])).toEqual([
        ["ComputeOptimizer", "live-setting-differs"],
      ]);
    })
  );
});

describe("checkPlan rollback exception", () => {
  it.effect("lets a plan delete the stack's own AnomalyAlerts subscription (live back to silent)", () =>
    Effect.gen(function* () {
      const plan = A.join(
        [
          ...A.map(singletons, (fqn) => colored(fqn, "noop")),
          colored("MonthlyBudget", "update"),
          colored("AnomalyAlerts", "delete"),
        ],
        "\n"
      );
      yield* checkPlan(parsePlanLog(plan), live);
    })
  );

  it.effect.each([...singletons, "MonthlyBudget"])("still refuses a delete of %s", (fqn) =>
    Effect.gen(function* () {
      const plan = A.join(
        [
          ...A.map(singletons, (id) => colored(id, id === fqn ? "delete" : "noop")),
          colored("MonthlyBudget", fqn === "MonthlyBudget" ? "delete" : "noop"),
        ],
        "\n"
      );
      const failure = yield* refusal(plan);
      expect(A.map(failure.violations, (v) => [v.subject, v.reason])).toContainEqual([fqn, "delete-or-replace"]);
    })
  );

  it.effect.each(["replace", "orphaned"])("still refuses a %s of AnomalyAlerts", (action) =>
    Effect.gen(function* () {
      const failure = yield* refusal(A.join([firstPlan, colored("AnomalyAlerts", action)], "\n"));
      expect(A.map(failure.violations, (v) => [v.subject, v.reason])).toEqual([["AnomalyAlerts", "delete-or-replace"]]);
    })
  );
});

const runLine = (text: string) => `[05:18:13.716] INFO: ${text}`;
const livePlanFromRun = A.join(
  [
    "[05:18:11.204] WARN: alchemy 2.0.0-beta.87 is available (you're on 2.0.0-beta.86).",
    runLine("Plan · prod"),
    runLine("Plan: 1 to create, 1 to update"),
    runLine("[AccountServicesMonitor] noop"),
    runLine("[AnomalyAlerts] create"),
    runLine("  properties:"),
    runLine("    frequency: DAILY"),
    runLine("[AppTag] noop"),
    runLine("[BeepCiTag] noop"),
    runLine("[ComputeOptimizer] noop"),
    runLine("[CostOptimizationHub] noop"),
    runLine("[DataClassTag] noop"),
    runLine("[GhrEnvironmentTag] noop"),
    runLine("[ManagedByTag] noop"),
    runLine("[MonthlyBudget] update"),
    runLine("  properties:"),
    runLine("  - notifications: []"),
    runLine("  + notifications:"),
    runLine("[ProjectTag] noop"),
    "[05:18:15.689] INFO: Done: 2 succeeded (2.0s)",
    "[18:56:21.770] ERROR (#1): @beep/infra-cost-controls/PlanCheck/PlanCheckFailed: ",
  ],
  "\n"
);
const noopPlan = A.join(
  [
    runLine("Plan: no changes"),
    ...A.map([...singletons, "MonthlyBudget", "AnomalyAlerts"], (fqn) => runLine(`[${fqn}] noop`)),
  ],
  "\n"
);

describe("parsePlanLog fails closed on unreadable actions", () => {
  it.effect("reads the live first deploy exactly as logged and passes the gate", () =>
    Effect.gen(function* () {
      const log = parsePlanLog(livePlanFromRun);
      expect(log.unreadable).toEqual([]);
      expect(A.map(log.entries, (entry) => entry.fqn)).toHaveLength(11);
      yield* checkPlan(log, live);
    })
  );

  it.effect("passes the silent first deploy and an all no-op plan unchanged", () =>
    Effect.gen(function* () {
      for (const plan of [firstPlan, noopPlan]) {
        const log = parsePlanLog(plan);
        expect(log.unreadable).toEqual([]);
        yield* checkPlan(log, live);
      }
    })
  );

  it.effect("refuses an unknown action on a singleton", () =>
    Effect.gen(function* () {
      const failure = yield* refusal(Str.replace(runLine("[AppTag] noop"), runLine("[AppTag] migrate"))(noopPlan));
      expect(A.map(failure.violations, (v) => [v.subject, v.reason, v.detail])).toContainEqual([
        "AppTag",
        "unreadable-action",
        "migrate",
      ]);
    })
  );

  it.effect("refuses an unknown action on a resource that is not a singleton, naming only the word", () =>
    Effect.gen(function* () {
      const plan = Str.replace(
        runLine("[MonthlyBudget] noop"),
        runLine("[MonthlyBudget] migrate to ops@example.com")
      )(noopPlan);
      const failure = yield* refusal(plan);
      expect(A.map(failure.violations, (v) => [v.subject, v.reason, v.detail])).toEqual([
        ["MonthlyBudget", "unreadable-action", "migrate"],
      ]);
    })
  );

  it.effect("attributes change lines after an unreadable resource line to no readable entry", () =>
    Effect.gen(function* () {
      const log = parsePlanLog(A.join(["[AppTag] noop", "[MonthlyBudget] migrate", "  + notifications:"], "\n"));
      expect(A.map(log.entries, (entry) => [entry.fqn, entry.changedProperties])).toEqual([["AppTag", []]]);
      expect(A.map(log.unreadable, (line) => [line.fqn, line.action])).toEqual([["MonthlyBudget", "migrate"]]);
      const plan = Str.replace(
        "[MonthlyBudget] noop",
        A.join(["[MonthlyBudget] migrate", "  + notifications:"], "\n")
      )(A.join([...A.map(singletons, (fqn) => `[${fqn}] noop`), "[MonthlyBudget] noop"], "\n"));
      const failure = yield* refusal(plan);
      expect(A.map(failure.violations, (v) => [v.subject, v.reason, v.detail])).toEqual([
        ["MonthlyBudget", "unreadable-action", "migrate"],
      ]);
    })
  );
});
