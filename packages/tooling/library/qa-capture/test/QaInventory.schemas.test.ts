import {
  decodeQaInventory,
  encodeQaInventory,
  isRequiredSeverity,
  QaInventory,
  QaJudgeRef,
  requiredFindingCount,
} from "@beep/qa-capture/QaInventory.schemas";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

const finding = (id: string, severity: "P0" | "P1" | "P2", path: string, eventIds: ReadonlyArray<number>) => ({
  evidence: [{ eventIds, kind: "strip", path }],
  fix: "fix it",
  id,
  lens: "selection-smear",
  repro: "drag the sash",
  severity,
  title: `finding ${id}`,
});

const inventoryInput = (findings: ReadonlyArray<unknown>, requiredCount: number) => ({
  findings,
  judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
  requiredCount,
  round: 4,
  schemaVersion: "qa-inventory/v1",
  sessionRef: "session.json",
});

describe("QaInventory.schemas", () => {
  it.effect("accepts an inventory whose requiredCount matches its P0 and P1 findings", () =>
    Effect.gen(function* () {
      const inventory = yield* decodeQaInventory(
        inventoryInput(
          [
            finding("R4-01", "P0", "frames/a.png", [2]),
            finding("R4-02", "P1", "frames/b.png", [3]),
            finding("R4-03", "P2", "frames/c.png", []),
          ],
          2
        )
      );
      expect(inventory.requiredCount).toBe(2);
      expect(A.length(inventory.findings)).toBe(3);
    })
  );

  it.effect("rejects an inventory whose verdict disagrees with its findings", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeQaInventory(inventoryInput([finding("R4-01", "P0", "frames/a.png", [2])], 0))
      );
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("rejects a finding id that is not R<round>-<nn>", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeQaInventory(inventoryInput([finding("R4-1", "P0", "frames/a.png", [2])], 1))
      );
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it("counts only P0 and P1 findings as required", () => {
    expect(requiredFindingCount([{ severity: "P0" }, { severity: "P1" }, { severity: "P2" }])).toBe(2);
  });

  it("classifies only P0 and P1 as required severities", () => {
    expect(isRequiredSeverity("P0")).toBe(true);
    expect(isRequiredSeverity("P1")).toBe(true);
    expect(isRequiredSeverity("P2")).toBe(false);
  });

  it.effect("round-trips an inventory through its encoded shape", () =>
    Effect.gen(function* () {
      const inventory = QaInventory.make({
        findings: [],
        judge: QaJudgeRef.make({ effort: "inherited", model: "claude-opus-5-5" }),
        requiredCount: 0,
        round: 1,
        schemaVersion: "qa-inventory/v1",
        sessionRef: "session.json",
      });
      const encoded = yield* encodeQaInventory(inventory);
      const decoded = yield* decodeQaInventory(encoded);
      expect(decoded.round).toBe(1);
      expect(A.length(decoded.findings)).toBe(0);
    })
  );
});
