import {
  CHECKOUT_PRUNE_DECLARATION_PATH,
  CheckoutPruneDeclaration,
  emptyCheckoutPruneDeclaration,
} from "@beep/repo-cli-kit/CheckoutPrune";
import {
  CheckoutFacts,
  CheckoutInventory,
  checkoutInventoryOf,
  checkoutSubjectOfPath,
  checkoutWorkspaceOf,
  describeCheckoutSubject,
  isCheckoutPathPruned,
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
  repositoryPathSubject,
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
const decodeDeclarationResult = S.decodeUnknownResult(CheckoutPruneDeclaration);
const decodeDeclaration = (input: unknown): CheckoutPruneDeclaration =>
  Result.getOrThrow(decodeDeclarationResult(input));

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
    strictEqual(isCheckoutSubjectPresent(inventory, missing), false);
    strictEqual(
      isCheckoutSubjectPruned(inventory, missing),
      false,
      "absent but never declared prunable: not pruned, so its check runs"
    );
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

const declaration = decodeDeclaration({
  version: 1,
  prune: [
    { path: "goals/demo-*", why: "the demo packets are not shipped" },
    { path: "packages/drivers/gone", why: "the gone driver is not shipped", packageName: "@beep/gone" },
    { path: "docs/legal", why: "the legal docs are not shipped" },
  ],
  keep: [
    { path: "goals/demo-kept", why: "a kept tool reads it" },
    { path: "docs/legal/README.md", why: "kept docs link to it" },
    { path: "packages/leaf", why: "this checkout keeps the leaf", packageName: "@beep/leaf" },
    { path: "packages/owned-kept", why: "the keep wins over owned" },
  ],
  owned: [
    { path: "renovate.json", why: "this checkout runs its own dependency bot" },
    { path: "goals/owned", why: "this checkout replaced the packet" },
    { path: "packages/owned", why: "this checkout replaced the driver", packageName: "@beep/owned" },
    { path: "packages/owned-gone", why: "replaced and absent", packageName: "@beep/owned-gone" },
    { path: "packages/owned-kept", why: "carved back out", packageName: "@beep/owned-kept" },
    { path: "packages/owned-kept-name", why: "carved back out by name", packageName: "@beep/leaf" },
  ],
});

const declared = CheckoutInventory.make({
  packets: packetRootsOf(["goals/demo-live/README.md", "goals/owned/README.md", "goals/kept/README.md"]),
  workspaces: HashMap.make(["@beep/kept", "packages/kept"], ["@beep/owned", "packages/owned"]),
  prunedPackets: HashSet.empty(),
  prunedWorkspaces: HashMap.make(["@beep/gone", "packages/drivers/gone"]),
  declaration,
});

const packetOf = (root: string) => O.getOrThrow(packetSubjectOf(root));

describe("checkout prune declaration rules", () => {
  it("prunes an absent packet a prune glob matches, unless it is present, undeclared or kept", () => {
    strictEqual(isCheckoutSubjectPruned(declared, packetOf("goals/demo-gone")), true);
    strictEqual(
      isCheckoutSubjectPruned(declared, packetOf("goals/demo-live")),
      false,
      "a live packet the glob matches is present, so it stays strict"
    );
    strictEqual(isCheckoutSubjectPruned(declared, packetOf("goals/typo")), false);
    strictEqual(
      isCheckoutSubjectPruned(declared, packetOf("goals/demo-kept")),
      false,
      "the keep entry carves goals/demo-kept out of the glob"
    );
  });

  it("skips an owned packet, workspace or path although it exists, and a keep entry restores strictness", () => {
    strictEqual(isCheckoutSubjectPruned(declared, packetOf("goals/owned")), true);
    strictEqual(isCheckoutSubjectPresent(declared, packetOf("goals/owned")), true);
    strictEqual(isCheckoutSubjectPruned(declared, workspaceSubject("@beep/owned")), true);
    strictEqual(isCheckoutSubjectPruned(declared, workspaceSubject("@beep/owned-gone")), true);
    strictEqual(isCheckoutSubjectPruned(declared, workspaceSubject("@beep/owned-kept")), false);
    strictEqual(
      isCheckoutSubjectPruned(declared, workspaceSubject("@beep/leaf")),
      false,
      "the keep entry naming @beep/leaf carves its owned entry back out"
    );
    strictEqual(isCheckoutSubjectPruned(declared, repositoryPathSubject("renovate.json")), true);
    strictEqual(isCheckoutSubjectPresent(declared, repositoryPathSubject("renovate.json")), true);
    strictEqual(
      isCheckoutSubjectPruned(declared, repositoryPathSubject("package.json")),
      false,
      "a path without an owned entry is the repository's"
    );
    strictEqual(isCheckoutSubjectPresent(declared, repositoryPathSubject("package.json")), true);
  });

  it("prunes a declared repository path outside every keep entry, and keeps the kept one present", () => {
    strictEqual(isCheckoutSubjectPruned(declared, repositoryPathSubject("docs/legal/guide.md")), true);
    strictEqual(isCheckoutSubjectPresent(declared, repositoryPathSubject("docs/legal/guide.md")), false);
    strictEqual(isCheckoutSubjectPruned(declared, repositoryPathSubject("docs/legal/README.md")), false);
    strictEqual(isCheckoutSubjectPresent(declared, repositoryPathSubject("docs/legal/README.md")), true);
    strictEqual(describeCheckoutSubject(repositoryPathSubject("docs/legal/guide.md")), "path docs/legal/guide.md");
  });

  it("finds the subject of a path: its packet, a present or declared workspace, or a declared path", () => {
    const describeOf = (path: string) => O.map(checkoutSubjectOfPath(declared, path), describeCheckoutSubject);
    assertSome(describeOf("goals/demo-gone/PLAN.md"), "packet goals/demo-gone");
    assertSome(describeOf("packages/owned/src/index.ts"), "workspace @beep/owned");
    assertSome(describeOf("packages/drivers/gone/src/index.ts"), "workspace @beep/gone");
    assertSome(describeOf("packages/drivers/gone"), "workspace @beep/gone");
    assertSome(describeOf("packages/owned-gone/README.md"), "workspace @beep/owned-gone");
    assertSome(describeOf("docs/legal/guide.md"), "path docs/legal/guide.md");
    assertSome(
      checkoutSubjectOfPath("renovate.json")(declared).pipe(O.map(describeCheckoutSubject)),
      "path renovate.json"
    );
    assertNone(describeOf("docs/README.md"));
    assertNone(describeOf("docs/legal/README.md"));
  });

  it("skips a check of a path only when its subject is pruned or owned and no keep entry covers it", () => {
    strictEqual(isCheckoutPathPruned(declared, "packages/drivers/gone/README.md"), true);
    strictEqual(isCheckoutPathPruned(declared, "goals/demo-gone/research/notes.md"), true);
    strictEqual(isCheckoutPathPruned(declared, "goals/owned/PLAN.md"), true);
    strictEqual(isCheckoutPathPruned("docs/legal/guide.md")(declared), true);
    strictEqual(
      isCheckoutPathPruned(declared, "goals/demo-live/PLAN.md"),
      false,
      "a missing file inside a present packet"
    );
    strictEqual(
      isCheckoutPathPruned(declared, "packages/kept/README.md"),
      false,
      "a missing file inside a present workspace"
    );
    strictEqual(
      isCheckoutPathPruned(declared, "goals/demo-kept/PLAN.md"),
      false,
      "a missing file inside a kept packet"
    );
    strictEqual(isCheckoutPathPruned(declared, "docs/legal/README.md"), false, "a missing kept path");
    strictEqual(isCheckoutPathPruned(declared, "docs/README.md"), false, "a missing file of the repository's own");
  });
});

const facts = (
  overrides: Partial<{
    readonly packets: ReadonlyArray<string>;
    readonly workspaces: ReadonlyArray<readonly [string, string]>;
    readonly directories: ReadonlyArray<string>;
    readonly files: ReadonlyArray<string>;
    readonly declaration: CheckoutPruneDeclaration;
  }>
) =>
  CheckoutFacts.make({
    packets: packetRootsOf(overrides.packets ?? []),
    workspaces: HashMap.fromIterable(overrides.workspaces ?? []),
    directories: HashSet.fromIterable(overrides.directories ?? []),
    files: HashSet.fromIterable(overrides.files ?? []),
    declaration: overrides.declaration ?? emptyCheckoutPruneDeclaration,
  });

const productLike = PrunableLeaves.make({
  workspaces: [PrunableWorkspace.make({ packageName: "@beep/leaf", directory: "packages/leaf" })],
  packets: [PacketRoot.make("goals/leaf")],
});

describe("checkout inventory over facts", () => {
  it("keeps the full checkout's rule when nothing is declared", () => {
    const resolved = Result.getOrThrow(checkoutInventoryOf(facts({}), productLike));
    deepStrictEqual(HashMap.toEntries(resolved.prunedWorkspaces), [["@beep/leaf", "packages/leaf"]]);
    deepStrictEqual(A.fromIterable(resolved.prunedPackets), ["goals/leaf"]);
    deepStrictEqual(resolved.declaration, emptyCheckoutPruneDeclaration);
  });

  it("adds the workspaces prune entries name, and never one whose directory remains", () => {
    const named = decodeDeclaration({
      version: 1,
      prune: [
        { path: "packages/gone", why: "gone", packageName: "@beep/gone" },
        { path: "packages/renamed", why: "renamed in place", packageName: "@beep/renamed" },
      ],
    });
    const resolved = Result.getOrThrow(
      checkoutInventoryOf(productLike)(facts({ declaration: named, directories: ["packages/renamed"] }))
    );
    deepStrictEqual(resolved.prunedWorkspaces.pipe(HashMap.keys, A.fromIterable, A.sort(Order.String)), [
      "@beep/gone",
      "@beep/leaf",
    ]);
  });

  it("does not prune a missing product leaf that a keep entry covers, by name, directory or packet root", () => {
    for (const keep of [
      { path: "packages/leaf", why: "kept by name", packageName: "@beep/leaf" },
      { path: "packages/*", why: "kept by directory" },
    ]) {
      const kept = decodeDeclaration({ version: 1, keep: [keep, { path: "goals/leaf", why: "kept packet" }] });
      const resolved = Result.getOrThrow(checkoutInventoryOf(facts({ declaration: kept }), productLike));
      strictEqual(isCheckoutSubjectPruned(resolved, workspaceSubject("@beep/leaf")), false, keep.why);
      strictEqual(isCheckoutSubjectPruned(resolved, packetOf("goals/leaf")), false, keep.why);
    }
  });

  it("refuses a prune entry that matches a live file, packet root or workspace, or names a live workspace", () => {
    const stale = decodeDeclaration({
      version: 1,
      prune: [
        { path: "docs/legal", why: "a live file remains" },
        { path: "goals/kept", why: "the packet remains" },
        { path: "packages/*", why: "a workspace remains" },
        { path: "packages/elsewhere", why: "moved, not gone", packageName: "@beep/kept" },
        { path: "docs/gone", why: "really gone" },
      ],
      keep: [{ path: "docs/legal/README.md", why: "kept" }],
    });
    const failed = Result.flip(
      checkoutInventoryOf(
        facts({
          declaration: stale,
          packets: ["goals/kept/README.md"],
          workspaces: [["@beep/kept", "packages/kept"]],
          files: ["docs/legal/README.md", "docs/legal/guide.md"],
        }),
        productLike
      )
    );
    const error = Result.getOrThrow(failed);
    deepStrictEqual(
      A.map(error.findings, (finding) => `${finding.path} -> ${finding.live}`),
      [
        "docs/legal -> docs/legal/guide.md",
        "goals/kept -> goals/kept",
        "packages/* -> packages/kept",
        "packages/elsewhere -> @beep/kept",
      ]
    );
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
      strictEqual(
        isCheckoutSubjectPruned(read, workspaceSubject("@beep/renamed")),
        false,
        "@beep/renamed was renamed in place: its directory remains"
      );
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

  it.effect("holds no workspaces when the checkout has no root manifest", () =>
    Effect.gen(function* () {
      const root = yield* repository({ "bun.lock": "", "goals/kept/README.md": "# kept\n" });
      const read = yield* loadCheckoutInventory(root, leaves);
      strictEqual(HashMap.size(read.workspaces), 0);
      strictEqual(HashSet.size(read.packets), 1);
      strictEqual(isCheckoutSubjectPruned(read, workspaceSubject("@beep/leaf-server")), true);
    })
  );

  it.effect("reads the checkout's declaration, and fails on an invalid one or one that names live paths", () =>
    Effect.gen(function* () {
      const base = {
        "package.json": json({ name: "@beep/root", private: true, workspaces: ["packages/*"] }),
        "packages/kept/package.json": json({ name: "@beep/kept" }),
        "goals/kept/README.md": "# kept\n",
      };
      const declaredRoot = yield* repository({
        ...base,
        [CHECKOUT_PRUNE_DECLARATION_PATH]: json({
          version: 1,
          prune: [
            { path: "packages/gone", why: "not shipped", packageName: "@beep/gone" },
            { path: "goals/gone-*", why: "not shipped" },
          ],
          owned: [{ path: "renovate.json", why: "own bot" }],
        }),
      });
      const read = yield* loadCheckoutInventory(declaredRoot, leaves);
      strictEqual(isCheckoutSubjectPruned(read, workspaceSubject("@beep/gone")), true);
      strictEqual(isCheckoutSubjectPruned(read, packetOf("goals/gone-packet")), true);
      strictEqual(isCheckoutSubjectPruned(read, packetOf("goals/kept")), false);
      strictEqual(isCheckoutSubjectPruned(read, repositoryPathSubject("renovate.json")), true);
      strictEqual(read.declaration.owned.length, 1);

      const invalidRoot = yield* repository({
        ...base,
        [CHECKOUT_PRUNE_DECLARATION_PATH]: '{ "version": 1, "prune": {} }',
      });
      const invalid = yield* Effect.flip(loadCheckoutInventory(invalidRoot, leaves));
      strictEqual(invalid._tag, "CheckoutPruneDeclarationError");

      const liveRoot = yield* repository({
        ...base,
        [CHECKOUT_PRUNE_DECLARATION_PATH]: json({ version: 1, prune: [{ path: "goals/kept", why: "stale" }] }),
      });
      const live = yield* Effect.flip(loadCheckoutInventory(liveRoot, leaves));
      strictEqual(live._tag, "CheckoutPruneFindingsError");
    })
  );

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
