import {
  CensusRuleVersion,
  currentCensusRuleVersion,
  FilteredCommandPattern,
  FilterHabitPipePatterns,
  ShellClassRules,
} from "@beep/repo-ai-metrics/census-rules";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const shellClassOf = (command: string): string =>
  O.match(
    A.findFirst(ShellClassRules, (rule) => rule.pattern.test(command)),
    { onNone: () => "other-shell", onSome: (rule) => rule.shellClass }
  );

const failuresRun = "cd lane && nice -n 19 bun run beep ci failures --run 45083821617 | tail -40";

describe("census rules", () => {
  it("counts `beep ci failures` as a CI-log read under the 2026-11-23 rules", () => {
    expect(currentCensusRuleVersion).toBe("census-rules/2026-11-23");
    expect(
      A.map(["bun run beep ci failures --pr 3500", failuresRun, "bun beep.ts ci failures --run 1"], shellClassOf)
    ).toEqual(["ci-logs", "ci-logs", "ci-logs"]);
  });

  it("keeps other ci subcommands out of the CI-log class", () => {
    expect(
      A.map(
        ["bun run beep ci task-outcomes --job-name x", "bun run beep ci append-gate-reports --artifact a"],
        shellClassOf
      )
    ).toEqual(["beep-other", "beep-other"]);
  });

  it("detects the tail, head and grep pipes on a `beep ci failures` call", () => {
    expect([
      FilterHabitPipePatterns.tail.test(failuresRun),
      FilterHabitPipePatterns.head.test("bun run beep ci failures --pr 1 | head -80"),
      FilterHabitPipePatterns.grep.test("bun run beep ci failures --pr 1 | rg error"),
      FilteredCommandPattern.test(failuresRun),
      FilteredCommandPattern.test("bun run beep ci failures --pr 1"),
    ]).toEqual([true, true, true, true, false]);
  });

  it("still decodes reports written under the 2026-11-18 rules", () => {
    expect(A.map(["census-rules/2026-11-18", "census-rules/2026-11-23"], S.is(CensusRuleVersion))).toEqual([
      true,
      true,
    ]);
  });
});
