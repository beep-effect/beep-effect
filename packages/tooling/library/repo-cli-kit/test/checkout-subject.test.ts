// The checkout-subject helper (goals/prunable-product-leaves, seam 1): a check that reads a real
// repository file names the packet or workspace it depends on, and skips only when the checkout
// pruned that subject, a declared product leaf whose directory is gone. These pin the subject
// derivation, the presence and pruning lookups, the inventory read over a scratch checkout with one
// leaf pruned and one name missing, and the product-leaf declaration against the live checkout.

import {
  CheckoutInventory,
  checkoutWorkspaceOf,
  isCheckoutSubjectPresent,
  isCheckoutSubjectPruned,
  loadCheckoutInventory,
  PacketRoot,
  PrunableLeaves,
  PrunableWorkspace,
  packetRootOf,
  packetRootsOf,
  packetSubjectOf,
  prunedCheckoutSubjects,
  prunedCheckoutSubjectsNote,
  workspaceSubject,
} from "@beep/repo-cli-kit/CheckoutSubject";
import { productLeaves } from "@beep/repo-cli-kit/ProductLeaves";
import { workspaceDirectories } from "@beep/repo-cli-kit/RepoWorkspaces";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const UnknownJson = S.fromJsonString(S.Unknown);

const json = (value: unknown): string =>
  `${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(value), identity)}\n`;

const repository = Effect.fnUntraced(function* (files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "beep-checkout-subject-" });
  const root = yield* fs.realPath(temporary);
  for (const [relative, content] of R.toEntries(files)) {
    const file = path.join(root, relative);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, content);
  }
  return root;
});

const inventory = CheckoutInventory.make({
  packets: packetRootsOf(["goals/kept/README.md", "explorations/kept/assets/manifest.jsonl"]),
  workspaces: HashMap.make(["@beep/kept", "packages/kept"], ["@beep/nested", "packages/kept/nested"]),
  prunedPackets: packetRootsOf(["goals/leaf/README.md"]),
  prunedWorkspaces: HashMap.make(["@beep/leaf", "packages/leaf"]),
});

const leaves = PrunableLeaves.make({
  workspaces: [
    PrunableWorkspace.make({ packageName: "@beep/leaf-server", directory: "packages/leaf/server" }),
    PrunableWorkspace.make({ packageName: "@beep/renamed", directory: "packages/renamed" }),
    PrunableWorkspace.make({ packageName: "@beep/kept", directory: "packages/kept" }),
  ],
  packets: [PacketRoot.make("goals/leaf"), PacketRoot.make("goals/kept")],
});

describe("checkout subjects", () => {
  it("derives a packet root only from a path inside goals/ or explorations/", () => {
    assertSome(packetRootOf("goals/demo-loop/ops/burst/README.md"), PacketRoot.make("goals/demo-loop"));
    assertSome(
      packetRootOf("explorations/demo-landscape/assets/manifest.jsonl"),
      PacketRoot.make("explorations/demo-landscape")
    );
    assertSome(packetRootOf("goals/demo-loop"), PacketRoot.make("goals/demo-loop"));
    assertNone(packetRootOf("goals"));
    assertNone(packetRootOf("goals/"));
    assertNone(packetRootOf("goals/*/demo/**/*.ts"));
    assertNone(packetRootOf("goalsx/demo/README.md"));
    assertNone(packetRootOf("packages/demo/server/test/X.test.ts"));
    strictEqual(O.isSome(packetSubjectOf("docs/README.md")), false);
  });

  it("tells a present subject, a pruned leaf and a missing name apart", () => {
    const kept = O.getOrThrow(packetSubjectOf("goals/kept/PLAN.md"));
    const leaf = O.getOrThrow(packetSubjectOf("goals/leaf/PLAN.md"));
    const missing = O.getOrThrow(packetSubjectOf("goals/typo/PLAN.md"));
    strictEqual(isCheckoutSubjectPresent(inventory, kept), true);
    strictEqual(isCheckoutSubjectPruned(inventory, kept), false);
    strictEqual(isCheckoutSubjectPruned(inventory, leaf), true);
    // Absent but never declared prunable: not pruned, so its check runs and fails.
    strictEqual(isCheckoutSubjectPresent(inventory, missing), false);
    strictEqual(isCheckoutSubjectPruned(inventory, missing), false);
    strictEqual(isCheckoutSubjectPresent(inventory, workspaceSubject("@beep/kept")), true);
    strictEqual(isCheckoutSubjectPresent(inventory, workspaceSubject("@beep/leaf")), false);
    strictEqual(isCheckoutSubjectPruned(inventory, workspaceSubject("@beep/leaf")), true);
    strictEqual(isCheckoutSubjectPruned(inventory, workspaceSubject("@beep/typo")), false);
    deepStrictEqual(prunedCheckoutSubjects(inventory, [kept, leaf, missing, workspaceSubject("@beep/leaf")]), [
      leaf,
      workspaceSubject("@beep/leaf"),
    ]);
    strictEqual(
      prunedCheckoutSubjectsNote([leaf, workspaceSubject("@beep/leaf")]),
      "pruned from this checkout: packet goals/leaf, workspace @beep/leaf"
    );
  });

  it("finds the deepest present workspace that contains a path, and none for a pruned one", () => {
    assertSome(checkoutWorkspaceOf(inventory, "packages/kept/test/Kept.test.ts"), "@beep/kept");
    assertSome(checkoutWorkspaceOf(inventory, "packages/kept/nested/src/index.ts"), "@beep/nested");
    assertNone(checkoutWorkspaceOf(inventory, "packages/keptx/test/X.test.ts"));
    assertNone(checkoutWorkspaceOf(inventory, "packages/leaf/test/Leaf.test.ts"));
  });
});

it.layer(NodeServices.layer)("checkout inventory", (it) => {
  it.effect("counts a leaf as pruned only when its name and directory are both gone", () =>
    Effect.gen(function* () {
      const root = yield* repository({
        "package.json": json({
          name: "@beep/root",
          private: true,
          workspaces: ["packages/*", "packages/leaf/server", "packages/renamed"],
        }),
        "packages/kept/package.json": json({ name: "@beep/kept" }),
        // @beep/renamed was renamed in place: its directory remains under a new name.
        "packages/renamed/package.json": json({ name: "@beep/renamed-again" }),
        "goals/kept/README.md": "# kept\n",
        "goals/INDEX.md": "# index\n",
        "explorations/kept/README.md": "# kept\n",
      });
      const read = yield* loadCheckoutInventory(root, leaves);
      deepStrictEqual(A.sort(A.fromIterable(read.packets), Order.String), ["explorations/kept", "goals/kept"]);
      const names = read.workspaces.pipe(HashMap.keys, A.fromIterable);
      deepStrictEqual(A.sort(names, Order.String), ["@beep/kept", "@beep/renamed-again"]);
      deepStrictEqual(HashMap.toEntries(read.prunedWorkspaces), [["@beep/leaf-server", "packages/leaf/server"]]);
      deepStrictEqual(A.fromIterable(read.prunedPackets), ["goals/leaf"]);
      strictEqual(isCheckoutSubjectPruned(read, workspaceSubject("@beep/renamed")), false);
    })
  );

  it.effect("holds no packets when the checkout has no goals/ or explorations/ directory", () =>
    Effect.gen(function* () {
      const root = yield* repository({
        "package.json": json({ name: "@beep/root", private: true, workspaces: ["packages/*"] }),
        "packages/kept/package.json": json({ name: "@beep/kept" }),
      });
      const read = yield* loadCheckoutInventory(root, leaves);
      strictEqual(HashSet.size(read.packets), 0);
      strictEqual(HashMap.size(read.workspaces), 1);
      strictEqual(HashSet.size(read.prunedPackets), 2);
    })
  );

  // The declaration stays honest in any checkout that holds a leaf: a present leaf lives at its
  // declared directory, and a declared name never disappears while its directory remains.
  it.effect("places every present product leaf at its declared directory, and none half removed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const found = yield* findRepoRoot();
      const root = yield* fs.realPath(found);
      const directories = yield* workspaceDirectories(root);
      for (const leaf of productLeaves.workspaces) {
        const located = HashMap.get(directories, leaf.packageName);
        if (O.isSome(located)) {
          strictEqual(path.relative(root, located.value), leaf.directory, leaf.packageName);
        } else {
          const remains = yield* fs.exists(path.join(root, leaf.directory));
          strictEqual(remains, false, `${leaf.packageName} is gone but ${leaf.directory} remains`);
        }
      }
      strictEqual(
        A.length(A.dedupe(A.map(productLeaves.workspaces, (leaf) => leaf.packageName))),
        A.length(productLeaves.workspaces)
      );
    })
  );
});
