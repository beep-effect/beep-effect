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
 * prunable (see `ProductLeaves.ts`, or the checkout's own declaration in
 * `CheckoutPrune.ts`) and its directory is gone. Every other check runs
 * exactly as before. A present subject keeps its stale-row and missing-fixture
 * failures, and so does an absent subject nobody declared prunable, so a typo
 * or a renamed package still fails instead of reading as a pruned one.
 *
 * A packet is present when its directory exists. A workspace is present when
 * workspace discovery finds a member with that package name.
 *
 * The checkout's declaration adds three rules. A workspace is declared by an
 * entry whose `packageName` names it, with its last-known directory as `path`;
 * a packet by an entry whose `path` matches its root; and a repository path
 * outside every packet and workspace becomes a `RepositoryPathSubject` of its
 * own when a prune or owned entry matches it. An owned subject skips although
 * it exists, because the checkout replaced what upstream checks assert: the
 * one exception to present-strict. A keep entry protects a subject on every
 * route, a product leaf included, so a kept subject that is missing fails.
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
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  CheckoutPruneDeclaration,
  CheckoutPruneFindingsError,
  checkoutPruneFindings,
  emptyCheckoutPruneDeclaration,
  isCheckoutPathDeclaredPruned,
  isCheckoutPathKept,
  isCheckoutPathOwned,
  isCheckoutPathPruneDeclared,
  liveCheckoutPruneFiles,
  loadCheckoutPruneDeclaration,
} from "./CheckoutPrune.ts";
import { workspaceMembers } from "./RepoWorkspaces.ts";
import type { GitCommandError, UnknownRefError } from "@beep/git/Git";
import type { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
import type { GlobExpansionError } from "@beep/walker/Expand";
import type * as PlatformError from "effect/PlatformError";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { CheckoutPruneDeclarationError } from "./CheckoutPrune.ts";
import type { RepoWorkspacesError } from "./RepoWorkspaces.ts";

const $I = $RepoCliKitId.create("CheckoutSubject");

/**
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
 * @category models
 * @since 0.0.0
 */
export type PacketParent = typeof PacketParent.Type;

/**
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
 * `RepositoryPathSubject` names a repository path outside every packet and
 * workspace, which is a subject of its own only when the checkout's
 * declaration prunes or owns it; any other such path belongs to the
 * repository, which is always present.
 *
 * **Example** (Name a packet, a workspace and a repository path)
 *
 * ```ts
 * import { CheckoutSubject } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as S from "effect/Schema"
 *
 * const subjects = S.decodeUnknownSync(S.Array(CheckoutSubject))([
 *   { _tag: "PacketSubject", root: "goals/speed-loop" },
 *   { _tag: "WorkspaceSubject", packageName: "@beep/repo-cli" },
 *   { _tag: "RepositoryPathSubject", path: "renovate.json" },
 * ])
 * console.log(subjects.length) // 3
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CheckoutSubject = S.TaggedUnion({
  PacketSubject: { root: PacketRoot },
  WorkspaceSubject: { packageName: S.NonEmptyString },
  RepositoryPathSubject: { path: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("CheckoutSubject", {
    description:
      "A goal or exploration packet, a workspace package by name, or a declared repository path that a repository check reads.",
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
 * **Details**
 *
 * `workspaces` maps each present package name to its repository-relative
 * directory. `prunedPackets` and `prunedWorkspaces` hold the declared
 * prunable subjects whose directories are gone and that no keep entry
 * covers; `prunedWorkspaces` maps each to the directory it was declared at.
 * `declaration` is the checkout's own prune declaration (empty when it ships
 * none), which also answers for packets and repository paths its globs
 * match and for the subjects it owns.
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
 *   prunedWorkspaces: HashMap.make(["@beep/leaf", "packages/leaf"]),
 * })
 * console.log(HashMap.size(inventory.prunedWorkspaces)) // 1
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
    prunedWorkspaces: S.HashMap(S.NonEmptyString, S.String),
    declaration: CheckoutPruneDeclaration.pipe(
      S.withConstructorDefault(Effect.succeed(emptyCheckoutPruneDeclaration)),
      S.withDecodingDefaultKey(Effect.succeed(emptyCheckoutPruneDeclaration))
    ),
  }).pipe(
    $I.annoteSchema("CheckoutInventory", {
      description:
        "The packet roots and workspace packages one checkout holds, the declared prunable subjects it removed, and its own prune declaration.",
    })
  )
) {}

/**
 * The facts one checkout's inventory is resolved from.
 *
 * **Details**
 *
 * `packets` and `workspaces` are what the checkout holds. `directories` holds
 * at least every declared workspace directory that exists, and `files` at
 * least every file a prune entry matches: `loadCheckoutInventory` reads just
 * those from the working tree, while a reader of a whole Git tree can pass
 * all of its directories and files. `declaration` is the checkout's prune
 * declaration.
 *
 * **Example** (State the facts of a small checkout)
 *
 * ```ts
 * import { CheckoutFacts, packetRootsOf } from "@beep/repo-cli-kit/CheckoutSubject"
 * import { emptyCheckoutPruneDeclaration } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const facts = CheckoutFacts.make({
 *   packets: packetRootsOf(["goals/kept/README.md"]),
 *   workspaces: HashMap.make(["@beep/kept", "packages/kept"]),
 *   directories: HashSet.make("packages/kept"),
 *   files: HashSet.make("packages/kept/package.json"),
 *   declaration: emptyCheckoutPruneDeclaration,
 * })
 * console.log(HashSet.size(facts.packets)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckoutFacts extends S.Opaque<CheckoutFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    packets: S.HashSet(PacketRoot),
    workspaces: S.HashMap(S.NonEmptyString, S.String),
    directories: S.HashSet(S.String),
    files: S.HashSet(S.String),
    declaration: CheckoutPruneDeclaration,
  }).pipe(
    $I.annoteSchema("CheckoutFacts", {
      description:
        "What one checkout holds (packets, workspaces, existing directories and files) and its prune declaration.",
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
 * The subject naming one repository path outside every packet and workspace.
 *
 * **Details**
 *
 * Use it for a root file or another path no packet or workspace owns; for a
 * path that may live in one, {@link checkoutSubjectOfPath} finds its subject.
 *
 * **Example** (Name a root file)
 *
 * ```ts
 * import { repositoryPathSubject } from "@beep/repo-cli-kit/CheckoutSubject"
 *
 * console.log(repositoryPathSubject("renovate.json")._tag) // "RepositoryPathSubject"
 * ```
 *
 * @param path - A repository-relative POSIX path.
 * @returns A `RepositoryPathSubject` for the path.
 * @category constructors
 * @since 0.0.0
 */
export const repositoryPathSubject = (path: string): CheckoutSubject =>
  CheckoutSubject.cases.RepositoryPathSubject.make({ path });

const keepCoversWorkspace = (declaration: CheckoutPruneDeclaration, packageName: string, directory: string): boolean =>
  A.some(declaration.keep, (entry) => entry.packageName === packageName || entry.matches(directory));

const ownedWorkspaces = (declaration: CheckoutPruneDeclaration): ReadonlyArray<readonly [string, string]> =>
  A.filterMap(declaration.owned, (entry) =>
    entry.packageName !== undefined && !keepCoversWorkspace(declaration, entry.packageName, entry.path)
      ? Result.succeed([entry.packageName, entry.path] as const)
      : Result.failVoid
  );

/**
 * Whether a checkout holds a subject.
 *
 * **Details**
 *
 * A repository path is present unless a prune entry of the checkout's
 * declaration removes it: `loadCheckoutInventory` refuses a declaration whose
 * prune entries match a live file.
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
 *   prunedWorkspaces: HashMap.empty(),
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
    RepositoryPathSubject: ({ path }) => !isCheckoutPathPruneDeclared(inventory.declaration, path),
  })
);

/**
 * Whether a checkout pruned a subject: declared prunable, and its directory is
 * gone; or declared owned.
 *
 * **Details**
 *
 * A packet is pruned when it is a product-leaf packet or a prune entry
 * matches its root, no keep entry covers it, and its directory is gone. A
 * workspace is pruned when it is a product leaf or a prune entry names it by
 * `packageName`, no keep entry covers it, its name is not discovered and its
 * declared directory is gone. A repository path is pruned when a prune entry
 * matches it and no keep entry does; `loadCheckoutInventory` refuses a prune
 * entry that matches a live file, so that file is gone.
 *
 * An owned subject (an owned entry matches the packet root or the path, or
 * names the workspace by `packageName`, and no keep entry covers it) counts as
 * pruned whether or not it exists: the checkout replaced what upstream checks
 * assert. An absent subject that was never declared is not pruned. Its check
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
 *   prunedWorkspaces: HashMap.make(["@beep/leaf", "packages/leaf"]),
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
    PacketSubject: ({ root }) =>
      HashSet.has(inventory.prunedPackets, root) ||
      (!HashSet.has(inventory.packets, root) && isCheckoutPathPruneDeclared(inventory.declaration, root)) ||
      isCheckoutPathOwned(inventory.declaration, root),
    WorkspaceSubject: ({ packageName }) =>
      HashMap.has(inventory.prunedWorkspaces, packageName) ||
      A.some(ownedWorkspaces(inventory.declaration), ([name]) => name === packageName),
    RepositoryPathSubject: ({ path }) => isCheckoutPathDeclaredPruned(inventory.declaration, path),
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
 *   prunedWorkspaces: HashMap.make(["@beep/leaf", "packages/leaf"]),
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
 *   prunedWorkspaces: HashMap.empty(),
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

const declaredWorkspaceOf = (inventory: CheckoutInventory, repoPath: string): O.Option<string> =>
  pipe(
    A.sort(
      [...HashMap.toEntries(inventory.prunedWorkspaces), ...ownedWorkspaces(inventory.declaration)],
      byDirectoryLengthDescending
    ),
    A.findFirst(([, directory]) => repoPath === directory || Str.startsWith(`${directory}/`)(repoPath)),
    O.map(([name]) => name)
  );

/**
 * The subject a repository path belongs to, if any.
 *
 * **Details**
 *
 * In order: the packet the path lives in; the present workspace whose
 * directory contains it; a pruned or owned workspace whose declared directory
 * contains it; and, for a path outside all of these that the checkout's
 * declaration prunes or owns, a `RepositoryPathSubject` of its own. Any other
 * path belongs to the repository, which is always present: `None`.
 *
 * **Example** (Find the subject of three paths)
 *
 * ```ts
 * import { CheckoutInventory, checkoutSubjectOfPath, describeCheckoutSubject } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const inventory = CheckoutInventory.make({
 *   packets: HashSet.empty(),
 *   workspaces: HashMap.make(["@beep/kept", "packages/kept"]),
 *   prunedPackets: HashSet.empty(),
 *   prunedWorkspaces: HashMap.make(["@beep/leaf", "packages/leaf"]),
 * })
 * const describe = (path: string) => O.map(checkoutSubjectOfPath(inventory, path), describeCheckoutSubject)
 * console.log(describe("goals/demo/PLAN.md")) // Some("packet goals/demo")
 * console.log(describe("packages/leaf/src/index.ts")) // Some("workspace @beep/leaf")
 * console.log(describe("docs/README.md")) // None
 * ```
 *
 * @param inventory - The checkout's packets, workspaces and declaration.
 * @param repoPath - A repository-relative POSIX path.
 * @returns The packet, workspace or declared repository path the path belongs to.
 * @category utilities
 * @since 0.0.0
 */
export const checkoutSubjectOfPath: {
  (repoPath: string): (inventory: CheckoutInventory) => O.Option<CheckoutSubject>;
  (inventory: CheckoutInventory, repoPath: string): O.Option<CheckoutSubject>;
} = dual(
  2,
  (inventory: CheckoutInventory, repoPath: string): O.Option<CheckoutSubject> =>
    pipe(
      packetSubjectOf(repoPath),
      O.orElse(() =>
        O.map(
          O.orElse(checkoutWorkspaceOf(inventory, repoPath), () => declaredWorkspaceOf(inventory, repoPath)),
          workspaceSubject
        )
      ),
      O.orElse(() =>
        isCheckoutPathDeclaredPruned(inventory.declaration, repoPath)
          ? O.some(repositoryPathSubject(repoPath))
          : O.none()
      )
    )
);

/**
 * Whether a check of one repository path skips: no keep entry covers the
 * path, and the subject it belongs to is pruned or owned.
 *
 * **Details**
 *
 * The path-level form of {@link isCheckoutSubjectPruned} for a check that
 * names a path, such as a link target: a missing link into a pruned packet or
 * workspace, or to a declared repository path, skips; a missing link to a
 * kept path, or into a present subject, still fails.
 *
 * **Example** (Skip a link into a pruned workspace only)
 *
 * ```ts
 * import { CheckoutInventory, isCheckoutPathPruned } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 *
 * const inventory = CheckoutInventory.make({
 *   packets: HashSet.empty(),
 *   workspaces: HashMap.make(["@beep/kept", "packages/kept"]),
 *   prunedPackets: HashSet.empty(),
 *   prunedWorkspaces: HashMap.make(["@beep/leaf", "packages/leaf"]),
 * })
 * console.log(isCheckoutPathPruned(inventory, "packages/leaf/README.md")) // true
 * console.log(isCheckoutPathPruned(inventory, "packages/kept/README.md")) // false
 * console.log(isCheckoutPathPruned(inventory, "docs/gone.md")) // false
 * ```
 *
 * @param inventory - The checkout's packets, workspaces and declaration.
 * @param repoPath - A repository-relative POSIX path.
 * @returns `true` when the checkout pruned or owns the path's subject and keeps no part of the path.
 * @category predicates
 * @since 0.0.0
 */
export const isCheckoutPathPruned: {
  (repoPath: string): (inventory: CheckoutInventory) => boolean;
  (inventory: CheckoutInventory, repoPath: string): boolean;
} = dual(
  2,
  (inventory: CheckoutInventory, repoPath: string): boolean =>
    !isCheckoutPathKept(inventory.declaration, repoPath) &&
    O.exists(checkoutSubjectOfPath(inventory, repoPath), (subject) => isCheckoutSubjectPruned(inventory, subject))
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
 * @returns `packet <root>`, `workspace <package name>` or `path <path>`.
 * @category utilities
 * @since 0.0.0
 */
export const describeCheckoutSubject = (subject: CheckoutSubject): string =>
  CheckoutSubject.match(subject, {
    PacketSubject: ({ root }) => `packet ${root}`,
    WorkspaceSubject: ({ packageName }) => `workspace ${packageName}`,
    RepositoryPathSubject: ({ path }) => `path ${path}`,
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

const declaredWorkspaces = (
  leaves: PrunableLeaves,
  declaration: CheckoutPruneDeclaration
): ReadonlyArray<PrunableWorkspace> => [
  ...leaves.workspaces,
  ...A.filterMap(declaration.prune, (entry) =>
    entry.packageName === undefined
      ? Result.failVoid
      : Result.succeed(PrunableWorkspace.make({ packageName: entry.packageName, directory: entry.path }))
  ),
];

/**
 * Resolve a checkout's inventory from its facts and the subjects it may
 * remove.
 *
 * **Details**
 *
 * A declared workspace (a product leaf, or a prune entry's `packageName`)
 * counts as pruned when no keep entry covers it, its name is not discovered
 * and its directory is not among `facts.directories`; a product-leaf packet,
 * when no keep entry covers it and its directory is gone. A prune entry that
 * matches a live path (a file, a packet root or a workspace directory) outside
 * every keep entry, or that names a discovered workspace, fails the
 * resolution with every such finding, so a declaration cannot claim what the
 * checkout still holds.
 *
 * **Example** (Resolve a checkout that pruned one leaf)
 *
 * ```ts
 * import {
 *   CheckoutFacts,
 *   checkoutInventoryOf,
 *   PrunableLeaves,
 *   PrunableWorkspace,
 * } from "@beep/repo-cli-kit/CheckoutSubject"
 * import { emptyCheckoutPruneDeclaration } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 * import * as Result from "effect/Result"
 *
 * const facts = CheckoutFacts.make({
 *   packets: HashSet.empty(),
 *   workspaces: HashMap.empty(),
 *   directories: HashSet.empty(),
 *   files: HashSet.empty(),
 *   declaration: emptyCheckoutPruneDeclaration,
 * })
 * const leaves = PrunableLeaves.make({
 *   workspaces: [PrunableWorkspace.make({ packageName: "@beep/leaf", directory: "packages/leaf" })],
 *   packets: [],
 * })
 * const inventory = Result.getOrThrow(checkoutInventoryOf(facts, leaves))
 * console.log(HashMap.has(inventory.prunedWorkspaces, "@beep/leaf")) // true
 * ```
 *
 * @param facts - What the checkout holds, and its declaration.
 * @param leaves - The product leaves the checkout may remove.
 * @returns The inventory, or the findings of a declaration that names live paths.
 * @category utilities
 * @since 0.0.0
 */
export const checkoutInventoryOf: {
  (leaves: PrunableLeaves): (facts: CheckoutFacts) => Result.Result<CheckoutInventory, CheckoutPruneFindingsError>;
  (facts: CheckoutFacts, leaves: PrunableLeaves): Result.Result<CheckoutInventory, CheckoutPruneFindingsError>;
} = dual(
  2,
  (facts: CheckoutFacts, leaves: PrunableLeaves): Result.Result<CheckoutInventory, CheckoutPruneFindingsError> => {
    const { declaration } = facts;
    const findings = checkoutPruneFindings(
      declaration,
      [...facts.files, ...facts.packets, ...HashMap.values(facts.workspaces)],
      facts.workspaces.pipe(HashMap.keys, HashSet.fromIterable)
    );
    if (A.isReadonlyArrayNonEmpty(findings)) {
      return Result.fail(CheckoutPruneFindingsError.make({ findings }));
    }
    const prunedWorkspaces = A.filter(
      declaredWorkspaces(leaves, declaration),
      (leaf) =>
        !keepCoversWorkspace(declaration, leaf.packageName, leaf.directory) &&
        !HashMap.has(facts.workspaces, leaf.packageName) &&
        !HashSet.has(facts.directories, leaf.directory)
    );
    const prunedPackets = A.filter(
      leaves.packets,
      (root) => !isCheckoutPathKept(declaration, root) && !HashSet.has(facts.packets, root)
    );
    return Result.succeed(
      CheckoutInventory.make({
        packets: facts.packets,
        workspaces: facts.workspaces,
        prunedPackets: HashSet.fromIterable(prunedPackets),
        prunedWorkspaces: HashMap.fromIterable(
          A.map(prunedWorkspaces, (leaf) => [leaf.packageName, leaf.directory] as const)
        ),
        declaration,
      })
    );
  }
);

/**
 * Read the packets and workspace packages a checkout holds, its prune
 * declaration, and which declared subjects it removed.
 *
 * **Details**
 *
 * Packets are the directories under `goals/` and `explorations/`; a parent
 * the checkout lacks holds none. Workspaces come from workspace discovery, so
 * a pruned member whose root pattern names a missing directory is simply not
 * listed, and a checkout without a root `package.json` has none. The
 * declaration is `standards/checkout-prune.jsonc` when the
 * checkout ships one; an invalid file fails, as does a prune entry that
 * matches a live path (see {@link checkoutInventoryOf}). A declared workspace
 * counts as pruned only when its name is not discovered and its directory
 * does not exist.
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
 * @returns The checkout's packet roots, workspace packages, declaration and pruned subjects.
 * @category utilities
 * @since 0.0.0
 */
export const loadCheckoutInventory = Effect.fn("CheckoutSubject.loadCheckoutInventory")(function* (
  repoRoot: string,
  leaves: PrunableLeaves
): Effect.fn.Return<
  CheckoutInventory,
  | RepoWorkspacesError
  | PlatformError.PlatformError
  | CheckoutPruneDeclarationError
  | CheckoutPruneFindingsError
  | GlobExpansionError
  | GitCommandError
  | UnknownRefError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const members = (yield* fs.exists(path.join(repoRoot, "package.json")))
    ? yield* workspaceMembers(repoRoot)
    : A.empty<WorkspacePackage>();
  return yield* loadCheckoutInventoryWith(
    repoRoot,
    leaves,
    HashMap.fromIterable(A.map(members, (member) => [member.name, member.relativePath] as const))
  );
});

/**
 * Read a checkout's inventory for a caller that already discovered its
 * workspace packages.
 *
 * **Details**
 *
 * {@link loadCheckoutInventory} with the workspace discovery step replaced by
 * `workspaces` (package name to repository-relative directory, root package
 * excluded), for a surface that reads the workspace manifests itself. Packets,
 * the declaration and the declared directories are read exactly as there.
 *
 * **Example** (Compose the read with a known workspace map)
 *
 * ```ts
 * import { loadCheckoutInventoryWith, PrunableLeaves } from "@beep/repo-cli-kit/CheckoutSubject"
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 *
 * const read = loadCheckoutInventoryWith(
 *   "/repo",
 *   PrunableLeaves.make({ workspaces: [], packets: [] }),
 *   HashMap.make(["@beep/demo", "packages/demo"])
 * )
 * console.log(Effect.isEffect(read)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param leaves - The subjects the checkout may remove.
 * @param workspaces - The checkout's workspace packages by name, with their directories.
 * @returns The checkout's packet roots, workspace packages, declaration and pruned subjects.
 * @category utilities
 * @since 0.0.0
 */
export const loadCheckoutInventoryWith = Effect.fn("CheckoutSubject.loadCheckoutInventoryWith")(function* (
  repoRoot: string,
  leaves: PrunableLeaves,
  workspaces: HashMap.HashMap<string, string>
): Effect.fn.Return<
  CheckoutInventory,
  | PlatformError.PlatformError
  | CheckoutPruneDeclarationError
  | CheckoutPruneFindingsError
  | GlobExpansionError
  | GitCommandError
  | UnknownRefError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const declaration = yield* loadCheckoutPruneDeclaration(repoRoot);
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
  const directories = yield* Effect.filter(
    A.dedupe(
      A.map(
        A.filter(declaredWorkspaces(leaves, declaration), (leaf) => !HashMap.has(workspaces, leaf.packageName)),
        (leaf) => leaf.directory
      )
    ),
    (directory) => fs.exists(path.join(repoRoot, directory)),
    { concurrency: 1 }
  );
  const files = yield* liveCheckoutPruneFiles(repoRoot, declaration);
  return yield* Effect.fromResult(
    checkoutInventoryOf(
      CheckoutFacts.make({
        packets,
        workspaces,
        directories: HashSet.fromIterable(directories),
        files: HashSet.fromIterable(files),
        declaration,
      }),
      leaves
    )
  );
});
