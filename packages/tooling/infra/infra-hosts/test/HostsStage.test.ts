import { HostsStageKind, stageKind, WorkstationOnly } from "@beep/infra-hosts/HostsStage";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

const guardIn = (env: Record<string, string>) => Effect.exit(WorkstationOnly.parse(ConfigProvider.fromUnknown(env)));

describe("HostsStage", () => {
  it("classifies only the prod stage as prod", () => {
    expect(stageKind("prod")).toBe(HostsStageKind.Enum.prod);
    expect(A.map(["dev_operator", "live_operator", "production", "Prod"], stageKind)).toEqual([
      "rehearsal",
      "rehearsal",
      "rehearsal",
      "rehearsal",
    ]);
  });

  it.effect("the workstation guard refuses a true CI flag in every spelling", () =>
    Effect.gen(function* () {
      const refused = yield* Effect.forEach(["true", "1", "yes", "on"], (CI) => guardIn({ CI }));
      assertTrue(A.every(refused, Exit.isFailure));
    })
  );

  it.effect("the workstation guard admits an unset or false CI flag", () =>
    Effect.gen(function* () {
      const admitted = yield* Effect.forEach([{}, { CI: "false" }, { CI: "0" }], guardIn);
      assertTrue(A.every(admitted, Exit.isSuccess));
    })
  );

  it.effect("the workstation guard rejects a malformed CI flag", () =>
    Effect.gen(function* () {
      const malformed = yield* guardIn({ CI: "maybe" });
      const rejected = Exit.isFailure(malformed);
      assertTrue(rejected);
    })
  );
});
