// The checkout-subject helper (goals/prunable-product-leaves, seam 1): a check that reads a real
// repository file names the packet or workspace it depends on, and skips only when the checkout
// does not hold that subject. These pin the subject derivation, the presence lookups, and the
// inventory read over a scratch checkout with one packet and one workspace pruned.

import {
  absentCheckoutSubjects,
  absentCheckoutSubjectsNote,
  CheckoutInventory,
  checkoutWorkspaceOf,
  isCheckoutSubjectPresent,
  loadCheckoutInventory,
  PacketRoot,
  packetRootOf,
  packetRootsOf,
  packetSubjectOf,
  workspaceSubject,
} from "@beep/repo-cli-kit/CheckoutSubject";
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

  it("reports a packet or a workspace present only when the checkout holds it", () => {
    const kept = O.getOrThrow(packetSubjectOf("goals/kept/PLAN.md"));
    const pruned = O.getOrThrow(packetSubjectOf("goals/pruned/PLAN.md"));
    strictEqual(isCheckoutSubjectPresent(inventory, kept), true);
    strictEqual(isCheckoutSubjectPresent(inventory, pruned), false);
    strictEqual(isCheckoutSubjectPresent(inventory, workspaceSubject("@beep/kept")), true);
    strictEqual(isCheckoutSubjectPresent(inventory, workspaceSubject("@beep/pruned")), false);
    deepStrictEqual(absentCheckoutSubjects(inventory, [kept, pruned, workspaceSubject("@beep/pruned")]), [
      pruned,
      workspaceSubject("@beep/pruned"),
    ]);
    strictEqual(
      absentCheckoutSubjectsNote([pruned, workspaceSubject("@beep/pruned")]),
      "absent from this checkout: packet goals/pruned, workspace @beep/pruned"
    );
  });

  it("finds the deepest present workspace that contains a path, and none for a pruned one", () => {
    assertSome(checkoutWorkspaceOf(inventory, "packages/kept/test/Kept.test.ts"), "@beep/kept");
    assertSome(checkoutWorkspaceOf(inventory, "packages/kept/nested/src/index.ts"), "@beep/nested");
    assertNone(checkoutWorkspaceOf(inventory, "packages/keptx/test/X.test.ts"));
    assertNone(checkoutWorkspaceOf(inventory, "packages/pruned/test/Pruned.test.ts"));
  });
});

it.layer(NodeServices.layer)("checkout inventory", (it) => {
  it.effect("reads the packets and workspaces a pruned checkout still holds", () =>
    Effect.gen(function* () {
      const root = yield* repository({
        "package.json": json({
          name: "@beep/root",
          private: true,
          workspaces: ["packages/*", "packages/pruned/server", "apps/labs/*"],
        }),
        "packages/kept/package.json": json({ name: "@beep/kept" }),
        "goals/kept/README.md": "# kept\n",
        "goals/INDEX.md": "# index\n",
        "explorations/kept/README.md": "# kept\n",
      });
      const read = yield* loadCheckoutInventory(root);
      deepStrictEqual(A.sort(A.fromIterable(read.packets), Order.String), ["explorations/kept", "goals/kept"]);
      deepStrictEqual(HashMap.toEntries(read.workspaces), [["@beep/kept", "packages/kept"]]);
      strictEqual(isCheckoutSubjectPresent(read, workspaceSubject("@beep/pruned-server")), false);
    })
  );

  it.effect("holds no packets when the checkout has no goals/ or explorations/ directory", () =>
    Effect.gen(function* () {
      const root = yield* repository({
        "package.json": json({ name: "@beep/root", private: true, workspaces: ["packages/*"] }),
        "packages/kept/package.json": json({ name: "@beep/kept" }),
      });
      const read = yield* loadCheckoutInventory(root);
      strictEqual(HashSet.size(read.packets), 0);
      strictEqual(HashMap.size(read.workspaces), 1);
    })
  );
});
