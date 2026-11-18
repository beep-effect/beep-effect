/**
 * What a repository fixture, census row or law exemption depends on, and
 * whether the current checkout pruned it.
 *
 * **Details**
 *
 * A checkout may drop the product leaves (a downstream fork, a trimmed cloud
 * lane). A check that reads a real repository file then names its subject: the
 * goal or exploration packet the file lives in, or the workspace package that
 * owns it, by package name. The check is skipped, with a note naming the
 * subject, only when the checkout pruned that subject: the subject is declared
 * prunable (see `ProductLeaves.ts`) and its directory is gone. Every other
 * check runs exactly as before. A present subject keeps its stale-row and
 * missing-fixture failures, and so does an absent subject nobody declared
 * prunable, so a typo or a renamed package still fails instead of reading as a
 * pruned one.
 *
 * A packet is present when its directory exists. A workspace is present when
 * workspace discovery finds a member with that package name.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliKitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { workspaceMembers } from "./RepoWorkspaces.ts";
import type * as PlatformError from "effect/PlatformError";
import type { RepoWorkspacesError } from "./RepoWorkspaces.ts";

const $I = $RepoCliKitId.create("CheckoutSubject");

/**
 * The repository directories that hold goal and exploration packets.
 *
 * **Example** (List the packet parents)
 *
 * ```ts
 * import { PacketParent } from "@beep/repo-cli-kit/CheckoutSubject"
 *
 * console.log(PacketParent.literals) // ["goals", "explorations"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PacketParent = LiteralKit(["goals", "explorations"]).pipe(
  $I.annoteSchema("PacketParent", {
    description: "A repository directory whose child directories are goal or exploration packets.",
  })
);

/**
 * A repository directory whose child directories are packets.
 *
 * @category models
 * @since 0.0.0
 */
export type PacketParent = typeof PacketParent.Type;

/**
 * A packet root: `goals/<slug>` or `explorations/<slug>`.
 *
 * **Example** (Recognize a packet root)
 *
 * ```ts
 * import { PacketRoot } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PacketRoot)("goals/speed-loop")) // true
 * console.log(S.is(PacketRoot)("goals/*")) // false: a glob names no packet
 * console.log(S.is(PacketRoot)("goals/speed-loop/ops")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PacketRoot = S.String.check(S.isPattern(/^(?:goals|explorations)\/[A-Za-z0-9_][A-Za-z0-9._-]*$/u)).pipe(
  S.brand("PacketRoot"),
  $I.annoteSchema("PacketRoot", {
    description: "A goal or exploration packet directory, repository-relative: goals/<slug> or explorations/<slug>.",
  })
);

/**
 * A packet root: `goals/<slug>` or `explorations/<slug>`.
 *
 * @category models
 * @since 0.0.0
 */
export type PacketRoot = typeof PacketRoot.Type;

/**
 * What a check that reads repository files depends on.
 *
 * **Details**
 *
 * `PacketSubject` names a packet by its root; `WorkspaceSubject` names a
 * workspace package by its package name, never by its directory.
 *
 * **Example** (Name a packet and a workspace)
 *
 * ```ts
 * import { CheckoutSubject } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as S from "effect/Schema"
 *
 * const subjects = S.decodeUnknownSync(S.Array(CheckoutSubject))([
 *   { _tag: "PacketSubject", root: "goals/speed-loop" },
 *   { _tag: "WorkspaceSubject", packageName: "@beep/repo-cli" },
 * ])
 * console.log(subjects.length) // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CheckoutSubject = S.TaggedUnion({
  PacketSubject: { root: PacketRoot },
  WorkspaceSubject: { packageName: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("CheckoutSubject", {
    description: "A goal or exploration packet, or a workspace package by name, that a repository check reads.",
  })
);

/**
 * What a check that reads repository files depends on.
 *
 * @category models
 * @since 0.0.0
 */
export type CheckoutSubject = typeof CheckoutSubject.Type;

/**
 * A workspace package a checkout may remove, with the directory it lives in.
 *
 * **Details**
 *
 * The directory is what tells pruning from renaming: a package whose name is
 * gone while its directory remains was renamed, not pruned.
 *
 * **Example** (Declare a prunable driver)
 *
 * ```ts
 * import { PrunableWorkspace } from "@beep/repo-cli-kit/CheckoutSubject"
 *
 * const box = PrunableWorkspace.make({ packageName: "@beep/box", directory: "packages/drivers/box" })
 * console.log(box.directory) // "packages/drivers/box"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrunableWorkspace extends S.Opaque<PrunableWorkspace, { readonly brand: unique symbol }>()(
  S.Struct({
    packageName: S.NonEmptyString,
    directory: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("PrunableWorkspace", {
      description: "A workspace package a checkout may remove, by package name and repository-relative directory.",
    })
  )
) {}

/**
 * The subjects a checkout may remove: the product leaves and their packets.
 *
 * **Example** (Declare one leaf and its packet)
 *
 * ```ts
 * import { PacketRoot, PrunableLeaves, PrunableWorkspace } from "@beep/repo-cli-kit/CheckoutSubject"
 *
 * const leaves = PrunableLeaves.make({
 *   workspaces: [PrunableWorkspace.make({ packageName: "@beep/demo", directory: "packages/demo" })],
 *   packets: [PacketRoot.make("goals/demo")],
 * })
 * console.log(leaves.packets.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrunableLeaves extends S.Opaque<PrunableLeaves, { readonly brand: unique symbol }>()(
  S.Struct({
    workspaces: S.Array(PrunableWorkspace),
    packets: S.Array(PacketRoot),
  }).pipe(
    $I.annoteSchema("PrunableLeaves", {
      description: "The workspace packages and packets a checkout may remove without editing kept packages.",
    })
  )
) {}

/**
 * The packets and workspace packages one checkout holds, and the declared
 * prunable subjects it removed.
 *
 * **Details**
 *
 * `workspaces` maps each present package name to its repository-relative
 * directory. `prunedPackets` and `prunedWorkspaces` hold the declared
 * prunable subjects whose directories are gone.
 *
 * **Example** (Describe a small pruned checkout)
 *
 * ```ts
 * import { CheckoutInventory, packetRootsOf } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const inventory = CheckoutInventory.make({
 *   packets: packetRootsOf(["goals/kept/README.md"]),
 *   workspaces: HashMap.make(["@beep/kept", "packages/kept"]),
 *   prunedPackets: packetRootsOf(["goals/leaf/README.md"]),
 *   prunedWorkspaces: HashSet.make("@beep/leaf"),
 * })
 * console.log(HashSet.size(inventory.prunedWorkspaces)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckoutInventory extends S.Opaque<CheckoutInventory, { readonly brand: unique symbol }>()(
  S.Struct({
    packets: S.HashSet(PacketRoot),
    workspaces: S.HashMap(S.NonEmptyString, S.String),
    prunedPackets: S.HashSet(PacketRoot),
    prunedWorkspaces: S.HashSet(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("CheckoutInventory", {
      description:
        "The packet roots and workspace packages one checkout holds, and the declared prunable subjects it removed.",
    })
  )
) {}

const decodePacketRoot = S.decodeUnknownOption(PacketRoot);

/**
 * The packet a repository path lives in, if it lives in one.
 *
 * **Example** (Find a path's packet)
 *
 * ```ts
 * import { packetRootOf } from "@beep/repo-cli-kit/CheckoutSubject"
 *
 * console.log(packetRootOf("goals/speed-loop/ops/runner-burst/README.md")) // Some("goals/speed-loop")
 * console.log(packetRootOf("packages/tooling/tool/cli/turbo.json")) // None
 * ```
 *
 * @param repoPath - A repository-relative POSIX path.
 * @returns The `goals/<slug>` or `explorations/<slug>` root that contains the path.
 * @category utilities
 * @since 0.0.0
 */
export const packetRootOf = (repoPath: string): O.Option<PacketRoot> =>
  decodePacketRoot(A.join(A.take(Str.split(repoPath, "/"), 2), "/"));

/**
 * The packet roots a set of repository paths reaches.
 *
 * **Example** (Collect packet roots from tracked paths)
 *
 * ```ts
 * import { packetRootsOf } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as HashSet from "effect/HashSet"
 *
 * const roots = packetRootsOf(["goals/a/README.md", "goals/a/PLAN.md", "explorations/b/x.md", "docs/c.md"])
 * console.log(HashSet.size(roots)) // 2
 * ```
 *
 * @param repoPaths - Repository-relative POSIX paths, such as a checkout's tracked files.
 * @returns Every packet root one of the paths lives in.
 * @category utilities
 * @since 0.0.0
 */
export const packetRootsOf = (repoPaths: Iterable<string>): HashSet.HashSet<PacketRoot> =>
  HashSet.fromIterable(A.getSomes(A.map(A.fromIterable(repoPaths), packetRootOf)));

/**
 * The packet subject of a repository path, if the path lives in a packet.
 *
 * **Example** (Name the subject of a packet fixture)
 *
 * ```ts
 * import { packetSubjectOf } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(packetSubjectOf("explorations/demo/assets/manifest.jsonl"))) // true
 * ```
 *
 * @param repoPath - A repository-relative POSIX path.
 * @returns A `PacketSubject` for the packet that contains the path.
 * @category utilities
 * @since 0.0.0
 */
export const packetSubjectOf = (repoPath: string): O.Option<CheckoutSubject> =>
  O.map(packetRootOf(repoPath), (root) => CheckoutSubject.cases.PacketSubject.make({ root }));

/**
 * The subject naming one workspace package.
 *
 * **Example** (Name a workspace subject)
 *
 * ```ts
 * import { workspaceSubject } from "@beep/repo-cli-kit/CheckoutSubject"
 *
 * console.log(workspaceSubject("@beep/repo-cli")._tag) // "WorkspaceSubject"
 * ```
 *
 * @param packageName - The `@beep/<name>` a check depends on, as its manifest declares it.
 * @returns A `WorkspaceSubject` for the package.
 * @category constructors
 * @since 0.0.0
 */
export const workspaceSubject = (packageName: string): CheckoutSubject =>
  CheckoutSubject.cases.WorkspaceSubject.make({ packageName });

/**
 * Whether a checkout holds a subject.
 *
 * **Example** (Check a packet and a workspace)
 *
 * ```ts
 * import {
 *   CheckoutInventory,
 *   isCheckoutSubjectPresent,
 *   packetRootsOf,
 *   workspaceSubject,
 * } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const inventory = CheckoutInventory.make({
 *   packets: packetRootsOf(["goals/demo/README.md"]),
 *   workspaces: HashMap.make(["@beep/demo", "packages/demo"]),
 *   prunedPackets: HashSet.empty(),
 *   prunedWorkspaces: HashSet.empty(),
 * })
 * console.log(isCheckoutSubjectPresent(inventory, workspaceSubject("@beep/demo"))) // true
 * console.log(isCheckoutSubjectPresent(inventory, workspaceSubject("@beep/gone"))) // false
 * ```
 *
 * @param inventory - The checkout's packets and workspaces.
 * @param subject - The subject to look up.
 * @returns `true` when the checkout holds the subject.
 * @category predicates
 * @since 0.0.0
 */
export const isCheckoutSubjectPresent: {
  (subject: CheckoutSubject): (inventory: CheckoutInventory) => boolean;
  (inventory: CheckoutInventory, subject: CheckoutSubject): boolean;
} = dual(2, (inventory: CheckoutInventory, subject: CheckoutSubject): boolean =>
  CheckoutSubject.match(subject, {
    PacketSubject: ({ root }) => HashSet.has(inventory.packets, root),
    WorkspaceSubject: ({ packageName }) => HashMap.has(inventory.workspaces, packageName),
  })
);

/**
 * Whether a checkout pruned a subject: declared prunable, and its directory is
 * gone.
 *
 * **Details**
 *
 * An absent subject that was never declared prunable is not pruned. Its check
 * runs and fails, as a typo or a renamed package should.
 *
 * **Example** (Tell a pruned leaf from a missing name)
 *
 * ```ts
 * import { CheckoutInventory, isCheckoutSubjectPruned, workspaceSubject } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const inventory = CheckoutInventory.make({
 *   packets: HashSet.empty(),
 *   workspaces: HashMap.empty(),
 *   prunedPackets: HashSet.empty(),
 *   prunedWorkspaces: HashSet.make("@beep/leaf"),
 * })
 * console.log(isCheckoutSubjectPruned(inventory, workspaceSubject("@beep/leaf"))) // true
 * console.log(isCheckoutSubjectPruned(inventory, workspaceSubject("@beep/typo"))) // false
 * ```
 *
 * @param inventory - The checkout's packets, workspaces and pruned subjects.
 * @param subject - The subject to look up.
 * @returns `true` when the checkout removed the subject as a declared product leaf.
 * @category predicates
 * @since 0.0.0
 */
export const isCheckoutSubjectPruned: {
  (subject: CheckoutSubject): (inventory: CheckoutInventory) => boolean;
  (inventory: CheckoutInventory, subject: CheckoutSubject): boolean;
} = dual(2, (inventory: CheckoutInventory, subject: CheckoutSubject): boolean =>
  CheckoutSubject.match(subject, {
    PacketSubject: ({ root }) => HashSet.has(inventory.prunedPackets, root),
    WorkspaceSubject: ({ packageName }) => HashSet.has(inventory.prunedWorkspaces, packageName),
  })
);

/**
 * The subjects a checkout pruned, in their given order.
 *
 * **Example** (List the pruned subjects of one check)
 *
 * ```ts
 * import { CheckoutInventory, prunedCheckoutSubjects, workspaceSubject } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const inventory = CheckoutInventory.make({
 *   packets: HashSet.empty(),
 *   workspaces: HashMap.make(["@beep/kept", "packages/kept"]),
 *   prunedPackets: HashSet.empty(),
 *   prunedWorkspaces: HashSet.make("@beep/leaf"),
 * })
 * const pruned = prunedCheckoutSubjects(inventory, [workspaceSubject("@beep/kept"), workspaceSubject("@beep/leaf")])
 * console.log(pruned.length) // 1
 * ```
 *
 * @param inventory - The checkout's packets, workspaces and pruned subjects.
 * @param subjects - The subjects one check depends on.
 * @returns The subjects the checkout removed as declared product leaves.
 * @category utilities
 * @since 0.0.0
 */
export const prunedCheckoutSubjects: {
  (subjects: ReadonlyArray<CheckoutSubject>): (inventory: CheckoutInventory) => ReadonlyArray<CheckoutSubject>;
  (inventory: CheckoutInventory, subjects: ReadonlyArray<CheckoutSubject>): ReadonlyArray<CheckoutSubject>;
} = dual(
  2,
  (inventory: CheckoutInventory, subjects: ReadonlyArray<CheckoutSubject>): ReadonlyArray<CheckoutSubject> =>
    A.filter(subjects, (subject) => isCheckoutSubjectPruned(inventory, subject))
);

const byDirectoryLengthDescending: Order.Order<readonly [string, string]> = Order.mapInput(
  Order.Number,
  ([, directory]: readonly [string, string]) => -directory.length
);

/**
 * The package name of the present workspace whose directory contains a path.
 *
 * **Details**
 *
 * The deepest containing workspace wins, so a package nested under another
 * owns its own files. A path no present workspace contains returns `None`.
 *
 * **Example** (Find the owner of a test file)
 *
 * ```ts
 * import { checkoutWorkspaceOf, CheckoutInventory } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const inventory = CheckoutInventory.make({
 *   packets: HashSet.empty(),
 *   workspaces: HashMap.make(["@beep/demo", "packages/demo"]),
 *   prunedPackets: HashSet.empty(),
 *   prunedWorkspaces: HashSet.empty(),
 * })
 * console.log(checkoutWorkspaceOf(inventory, "packages/demo/test/Demo.test.ts")) // Some("@beep/demo")
 * console.log(checkoutWorkspaceOf(inventory, "packages/gone/test/Gone.test.ts")) // None
 * ```
 *
 * @param inventory - The checkout's packets and workspaces.
 * @param repoPath - A repository-relative POSIX path.
 * @returns The owning workspace package name.
 * @category utilities
 * @since 0.0.0
 */
export const checkoutWorkspaceOf: {
  (repoPath: string): (inventory: CheckoutInventory) => O.Option<string>;
  (inventory: CheckoutInventory, repoPath: string): O.Option<string>;
} = dual(
  2,
  (inventory: CheckoutInventory, repoPath: string): O.Option<string> =>
    pipe(
      A.sort(HashMap.toEntries(inventory.workspaces), byDirectoryLengthDescending),
      A.findFirst(([, directory]) => Str.startsWith(`${directory}/`)(repoPath)),
      O.map(([name]) => name)
    )
);

/**
 * Render a subject for a skip note or a report line.
 *
 * **Example** (Describe a subject)
 *
 * ```ts
 * import { describeCheckoutSubject, workspaceSubject } from "@beep/repo-cli-kit/CheckoutSubject"
 *
 * console.log(describeCheckoutSubject(workspaceSubject("@beep/demo"))) // "workspace @beep/demo"
 * ```
 *
 * @param subject - The subject to render.
 * @returns `packet <root>` or `workspace <package name>`.
 * @category utilities
 * @since 0.0.0
 */
export const describeCheckoutSubject = (subject: CheckoutSubject): string =>
  CheckoutSubject.match(subject, {
    PacketSubject: ({ root }) => `packet ${root}`,
    WorkspaceSubject: ({ packageName }) => `workspace ${packageName}`,
  });

/**
 * The note a skipped check reports for the subjects the checkout pruned.
 *
 * **Example** (Explain a skip)
 *
 * ```ts
 * import { prunedCheckoutSubjectsNote, workspaceSubject } from "@beep/repo-cli-kit/CheckoutSubject"
 *
 * console.log(prunedCheckoutSubjectsNote([workspaceSubject("@beep/leaf")]))
 * // "pruned from this checkout: workspace @beep/leaf"
 * ```
 *
 * @param subjects - What the checkout removed, in the order the check declared it.
 * @returns One line naming each pruned subject.
 * @category utilities
 * @since 0.0.0
 */
export const prunedCheckoutSubjectsNote = (subjects: ReadonlyArray<CheckoutSubject>): string =>
  `pruned from this checkout: ${A.join(A.map(subjects, describeCheckoutSubject), ", ")}`;

/**
 * Read the packets and workspace packages a checkout holds, and which of the
 * declared prunable subjects it removed.
 *
 * **Details**
 *
 * Packets are the directories under `goals/` and `explorations/`; a parent
 * the checkout lacks holds none. Workspaces come from workspace discovery, so
 * a pruned member whose root pattern names a missing directory is simply not
 * listed. A declared prunable workspace counts as pruned only when its name is
 * not discovered and its directory does not exist.
 *
 * **Example** (Compose the inventory read)
 *
 * ```ts
 * import { loadCheckoutInventory, PrunableLeaves } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as Effect from "effect/Effect"
 *
 * const read = loadCheckoutInventory("/repo", PrunableLeaves.make({ workspaces: [], packets: [] }))
 * console.log(Effect.isEffect(read)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param leaves - The subjects the checkout may remove.
 * @returns The checkout's packet roots, workspace packages and pruned subjects.
 * @category utilities
 * @since 0.0.0
 */
export const loadCheckoutInventory = Effect.fn("CheckoutSubject.loadCheckoutInventory")(function* (
  repoRoot: string,
  leaves: PrunableLeaves
): Effect.fn.Return<
  CheckoutInventory,
  RepoWorkspacesError | PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const members = yield* workspaceMembers(repoRoot);
  const packetDirectories = yield* Effect.forEach(
    PacketParent.literals,
    Effect.fnUntraced(function* (parent) {
      const parentDirectory = path.join(repoRoot, parent);
      if (!(yield* fs.exists(parentDirectory))) {
        return A.empty<string>();
      }
      const names = yield* fs.readDirectory(parentDirectory);
      const directories = yield* Effect.filter(names, (name) =>
        Effect.map(fs.stat(path.join(parentDirectory, name)), (info) => info.type === "Directory")
      );
      return A.map(directories, (name) => `${parent}/${name}`);
    }),
    { concurrency: 1 }
  );
  const packets = packetRootsOf(A.flatten(packetDirectories));
  const workspaces = HashMap.fromIterable(A.map(members, (member) => [member.name, member.relativePath] as const));
  const prunedWorkspaces = yield* Effect.filter(
    leaves.workspaces,
    (leaf) =>
      HashMap.has(workspaces, leaf.packageName)
        ? Effect.succeed(false)
        : Effect.map(fs.exists(path.join(repoRoot, leaf.directory)), (exists) => !exists),
    { concurrency: 1 }
  );
  return CheckoutInventory.make({
    packets,
    workspaces,
    prunedPackets: HashSet.fromIterable(A.filter(leaves.packets, (root) => !HashSet.has(packets, root))),
    prunedWorkspaces: HashSet.fromIterable(A.map(prunedWorkspaces, (leaf) => leaf.packageName)),
  });
});
