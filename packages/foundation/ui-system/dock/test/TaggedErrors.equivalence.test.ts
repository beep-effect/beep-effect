import {
  CommandId,
  DockCommandRejected,
  DockInputError,
  DockInvariantViolation,
  DockPersistenceError,
  DockSnapshotMissing,
} from "@beep/dock";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameDockCommandRejected = S.toEquivalence(DockCommandRejected);
const sameDockInvariantViolation = S.toEquivalence(DockInvariantViolation);
const sameDockInputError = S.toEquivalence(DockInputError);
const sameDockPersistenceError = S.toEquivalence(DockPersistenceError);
const sameDockSnapshotMissing = S.toEquivalence(DockSnapshotMissing);

describe("Dock tagged-error declared equivalence", () => {
  it("compares DockCommandRejected by declared fields", () => {
    const a = DockCommandRejected.make({
      commandId: CommandId.make("command-close"),
      reason: "panel-not-found",
      message: "Panel was not found",
    });
    const b = DockCommandRejected.make({
      commandId: CommandId.make("command-close"),
      reason: "panel-not-found",
      message: "Panel was not found",
    });
    const c = DockCommandRejected.make({
      commandId: CommandId.make("command-close"),
      reason: "group-not-found",
      message: "Panel was not found",
    });

    expect(sameDockCommandRejected(a, b)).toBe(true);
    expect(sameDockCommandRejected(a, c)).toBe(false);
  });

  it("compares DockInvariantViolation by declared fields", () => {
    const a = DockInvariantViolation.make({ reason: "duplicate-panel-id", message: "Duplicate panel" });
    const b = DockInvariantViolation.make({ reason: "duplicate-panel-id", message: "Duplicate panel" });
    const c = DockInvariantViolation.make({ reason: "duplicate-group-id", message: "Duplicate panel" });

    expect(sameDockInvariantViolation(a, b)).toBe(true);
    expect(sameDockInvariantViolation(a, c)).toBe(false);
  });

  it("compares DockInputError by declared fields", () => {
    const a = DockInputError.make({ boundary: "snapshot", message: "Invalid snapshot" });
    const b = DockInputError.make({ boundary: "snapshot", message: "Invalid snapshot" });
    const c = DockInputError.make({ boundary: "command", message: "Invalid snapshot" });

    expect(sameDockInputError(a, b)).toBe(true);
    expect(sameDockInputError(a, c)).toBe(false);
  });

  it("compares DockPersistenceError by declared fields", () => {
    const a = DockPersistenceError.make({ operation: "save", message: "Storage unavailable" });
    const b = DockPersistenceError.make({ operation: "save", message: "Storage unavailable" });
    const c = DockPersistenceError.make({ operation: "load", message: "Storage unavailable" });

    expect(sameDockPersistenceError(a, b)).toBe(true);
    expect(sameDockPersistenceError(a, c)).toBe(false);
  });

  it("compares DockSnapshotMissing by declared fields", () => {
    const a = DockSnapshotMissing.make({ message: "No snapshot exists" });
    const b = DockSnapshotMissing.make({ message: "No snapshot exists" });
    const c = DockSnapshotMissing.make({ message: "Snapshot missing" });

    expect(sameDockSnapshotMissing(a, b)).toBe(true);
    expect(sameDockSnapshotMissing(a, c)).toBe(false);
  });
});
