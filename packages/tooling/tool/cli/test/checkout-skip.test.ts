// The shared skip step of every tolerant fixture surface (goals/prunable-product-leaves, seam 1):
// it skips, naming each pruned subject, only when the checkout pruned a declared product leaf, and
// is a no-op otherwise, including for a missing name nobody declared prunable. A recording context
// stands in for Vitest's, so every path is observed.

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
import * as HashSet from "effect/HashSet";
import { skipWhenCheckoutPruned, skipWhenPruned } from "./support/CheckoutSkip.ts";

const inventory = CheckoutInventory.make({
  packets: packetRootsOf(["goals/kept/README.md"]),
  workspaces: HashMap.make(["@beep/kept", "packages/kept"]),
  prunedPackets: packetRootsOf(["goals/leaf/README.md"]),
  prunedWorkspaces: HashSet.make("@beep/leaf"),
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
    skipWhenCheckoutPruned(ctx, inventory, [
      workspaceSubject("@beep/kept"),
      ...A.fromOption(packetSubjectOf("goals/kept/research/x.json")),
    ]);
    skipWhenPruned(ctx, []);
    expect(ctx.notes).toEqual([]);
  });

  it("does not skip for a missing subject nobody declared prunable", () => {
    const ctx = recordingContext();
    skipWhenCheckoutPruned(ctx, inventory, [
      workspaceSubject("@beep/typo"),
      ...A.fromOption(packetSubjectOf("goals/typo/research/x.json")),
    ]);
    expect(ctx.notes).toEqual([]);
  });

  it("skips once, naming every pruned packet and workspace", () => {
    const ctx = recordingContext();
    skipWhenCheckoutPruned(ctx, inventory, [
      workspaceSubject("@beep/kept"),
      workspaceSubject("@beep/leaf"),
      workspaceSubject("@beep/typo"),
      ...A.fromOption(packetSubjectOf("goals/leaf/research/x.json")),
    ]);
    expect(ctx.notes).toEqual(["pruned from this checkout: workspace @beep/leaf, packet goals/leaf"]);
  });

  it("takes the context last in a pipeline", () => {
    const ctx = recordingContext();
    skipWhenCheckoutPruned(inventory, [workspaceSubject("@beep/leaf")])(ctx);
    expect(ctx.notes).toEqual(["pruned from this checkout: workspace @beep/leaf"]);
  });
});
