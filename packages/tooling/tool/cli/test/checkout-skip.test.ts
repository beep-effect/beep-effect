// The shared skip step of every tolerant fixture surface (goals/prunable-product-leaves, seam 1):
// it skips, naming each absent subject, only when the checkout lacks one, and is a no-op when the
// checkout holds them all. A recording context stands in for Vitest's, so both paths are observed.

import {
  CheckoutInventory,
  packetRootsOf,
  packetSubjectOf,
  workspaceSubject,
} from "@beep/repo-cli-kit/CheckoutSubject";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import { skipUnlessCheckoutHolds, skipWhenAbsent } from "./support/CheckoutSkip.ts";

const inventory = CheckoutInventory.make({
  packets: packetRootsOf(["goals/kept/README.md"]),
  workspaces: HashMap.make(["@beep/kept", "packages/kept"]),
});

// Records each skip note instead of throwing, as Vitest's skip would.
const recordingContext = () => {
  const notes: Array<string> = [];
  const skip = (note?: string): void => {
    notes.push(note ?? "");
  };
  return { notes, skip };
};

describe("checkout skip", () => {
  it("does not skip when the checkout holds every subject", () => {
    const ctx = recordingContext();
    skipUnlessCheckoutHolds(ctx, inventory, [
      workspaceSubject("@beep/kept"),
      ...A.fromOption(packetSubjectOf("goals/kept/research/x.json")),
    ]);
    skipWhenAbsent(ctx, []);
    expect(ctx.notes).toEqual([]);
  });

  it("skips once, naming every absent packet and workspace", () => {
    const ctx = recordingContext();
    skipUnlessCheckoutHolds(ctx, inventory, [
      workspaceSubject("@beep/kept"),
      workspaceSubject("@beep/pruned"),
      ...A.fromOption(packetSubjectOf("goals/pruned/research/x.json")),
    ]);
    expect(ctx.notes).toEqual(["absent from this checkout: workspace @beep/pruned, packet goals/pruned"]);
  });

  it("takes the context last in a pipeline", () => {
    const ctx = recordingContext();
    skipUnlessCheckoutHolds(inventory, [workspaceSubject("@beep/pruned")])(ctx);
    expect(ctx.notes).toEqual(["absent from this checkout: workspace @beep/pruned"]);
  });
});
