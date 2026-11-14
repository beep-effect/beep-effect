/**
 * Why a Yeet run forces Turbo, and a shadow of the narrowed force TURB-05
 * proposes.
 *
 * **Details**
 *
 * Yeet sets `TURBO_FORCE=true` on its dependency-sensitive steps when an
 * install input changed between the merge base and `HEAD`
 * ({@link decideTurboForce}): `bun.lock`, a file under `patches/` or the root
 * `patchedDependencies`, or the root `overrides` or `resolutions`. Turbo
 * hashes no patch content, so without the path triggers a patch-only commit
 * could replay a cached green. {@link turboForceReceiptFor} records the
 * decision on the attempt-started journal row as named
 * {@link TurboForceReason}s, beside a shadow of the narrowed decision: no
 * force for a lockfile-only change, and an installed-tree digest per package
 * so a later slice can force only the packages whose installed tree changed.
 * The R2 cache pause (ruling D14) keeps the narrowed decision a shadow:
 * nothing reads it to decide anything.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { $RepoCliId } from "@beep/identity/packages";
import { Lockfile } from "@beep/lockfiles/Lockfile";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { constFalse, dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as MutableList from "effect/MutableList";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YeetCommandError } from "../Yeet.errors.ts";
import { resolveYeetMergeBase, yeetGitKitError } from "./GitExec.ts";
import { YeetRunMode } from "./Planner.schemas.ts";
import type { ResolvedPackage } from "@beep/lockfiles/ResolvedPackage";
import type * as Digest from "effect/crypto/Digest";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/TurboForce");

const LOCKFILE_PATH = "bun.lock";
const ROOT_MANIFEST_PATH = "package.json";
const PATCHES_PREFIX = "patches/";
const INSTALL_INPUT_PATHSPEC = [LOCKFILE_PATH, "patches", ROOT_MANIFEST_PATH];
const textEncoder = new TextEncoder();
const digestTreeText = (text: string) =>
  S.decodeEffect(Sha256HexFromBytes)(textEncoder.encode(text)).pipe(
    Effect.mapError(YeetCommandError.new("Failed to digest an installed tree."))
  );

/**
 * Package name that stands for the workspace root in installed-tree digests,
 * as Turbo names the root package.
 *
 * **Example** (Name the root package)
 *
 * ```ts
 * import { ROOT_INSTALLED_TREE_PACKAGE } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ROOT_INSTALLED_TREE_PACKAGE) // "//"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ROOT_INSTALLED_TREE_PACKAGE = "//";

/**
 * Why a run forced Turbo, or why the narrowed decision would.
 *
 * **Details**
 *
 * - `lockfile-changed`: `bun.lock` differs between the merge base and `HEAD`.
 * - `patches-changed`: a file under `patches/` changed, or the root
 *   `patchedDependencies` did. `bun.lock` records patch paths and no patch
 *   content, so a patch-only commit (#2873 was one) leaves it unchanged and
 *   only the path diff sees it.
 * - `overrides-changed`: the root `overrides` or `resolutions` changed.
 *
 * Each one forces every dependency-sensitive step. The narrowed shadow keeps
 * `patches-changed` and `overrides-changed` and drops `lockfile-changed`.
 *
 * **Example** (Name the lockfile reason)
 *
 * ```ts
 * import { TurboForceReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(TurboForceReason.Enum["lockfile-changed"]) // "lockfile-changed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboForceReason = LiteralKit(["lockfile-changed", "patches-changed", "overrides-changed"]).pipe(
  $I.annoteSchema("TurboForceReason", {
    description: "One reason a Yeet run forced Turbo, or a reason the narrowed TURB-05 decision would force it.",
  })
);

/**
 * Type of {@link TurboForceReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type TurboForceReason = typeof TurboForceReason.Type;

const TurboForceDecidingMode = YeetRunMode.pick(["repair", "verify", "publish"]).pipe(
  $I.annoteSchema("TurboForceDecidingMode", {
    description: "The Yeet modes that decide whether to force Turbo; the other modes never force.",
  })
);

const isTurboForceDecidingMode = S.is(TurboForceDecidingMode);

/**
 * One package whose installed-tree digest differs between the merge base and `HEAD`.
 *
 * **Details**
 *
 * A digest is absent on the side where the package does not exist: `base` for
 * a package the branch adds, `head` for one it removes.
 *
 * **Example** (A package the branch adds)
 *
 * ```ts
 * import { PackageInstalledTreeChange } from "@beep/repo-cli/test/Yeet"
 * import { Sha256Hex } from "@beep/schema"
 * import * as O from "effect/Option"
 * import * as Str from "effect/String"
 *
 * const change = PackageInstalledTreeChange.make({
 *   name: "@beep/new",
 *   head: O.some(Sha256Hex.make(Str.repeat(64)("a"))),
 * })
 * console.log(O.isNone(change.base)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageInstalledTreeChange extends S.Opaque<
  PackageInstalledTreeChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    name: S.NonEmptyString,
    base: Sha256Hex.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    head: Sha256Hex.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("PackageInstalledTreeChange", {
      description: "A package whose installed-tree digest differs between the merge base and HEAD.",
    })
  )
) {}

/**
 * `bun.lock` is unchanged, so every package's installed tree equals the base's.
 *
 * **Example** (An unchanged lockfile)
 *
 * ```ts
 * import { InstalledTreesLockfileUnchanged } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(InstalledTreesLockfileUnchanged.make({ kind: "lockfile-unchanged" }).kind) // "lockfile-unchanged"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InstalledTreesLockfileUnchanged extends S.Opaque<
  InstalledTreesLockfileUnchanged,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("lockfile-unchanged"),
  }).pipe(
    $I.annoteSchema("InstalledTreesLockfileUnchanged", {
      description: "bun.lock is unchanged, so no package's installed tree differs from the base's.",
    })
  )
) {}

/**
 * The installed-tree digests of the merge base and `HEAD`, compared package by package.
 *
 * **Details**
 *
 * `packages` counts every package on either side, the root
 * ({@link ROOT_INSTALLED_TREE_PACKAGE}) included; `changed` lists the ones
 * whose digest differs, in name order, and is what a per-package narrowed
 * force would force.
 *
 * **Example** (One changed package of three)
 *
 * ```ts
 * import { InstalledTreesCompared, PackageInstalledTreeChange } from "@beep/repo-cli/test/Yeet"
 * import { Sha256Hex } from "@beep/schema"
 * import * as O from "effect/Option"
 * import * as Str from "effect/String"
 *
 * const compared = InstalledTreesCompared.make({
 *   kind: "compared",
 *   packages: 3,
 *   changed: [
 *     PackageInstalledTreeChange.make({
 *       name: "@beep/a",
 *       base: O.some(Sha256Hex.make(Str.repeat(64)("a"))),
 *       head: O.some(Sha256Hex.make(Str.repeat(64)("b"))),
 *     }),
 *   ],
 * })
 * console.log(compared.changed.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InstalledTreesCompared extends S.Opaque<InstalledTreesCompared, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("compared"),
    packages: S.Natural,
    changed: S.Array(PackageInstalledTreeChange),
  }).pipe(
    $I.annoteSchema("InstalledTreesCompared", {
      description: "Per-package installed-tree digests of the merge base and HEAD, with the packages that changed.",
    })
  )
) {}

/**
 * What the shadow knows about each package's installed tree.
 *
 * **Example** (Match on the comparison)
 *
 * ```ts
 * import { InstalledTreeComparison, InstalledTreesLockfileUnchanged } from "@beep/repo-cli/test/Yeet"
 *
 * const line = InstalledTreeComparison.match(InstalledTreesLockfileUnchanged.make({ kind: "lockfile-unchanged" }), {
 *   "lockfile-unchanged": () => "unchanged",
 *   compared: (compared) => `${compared.changed.length} changed`,
 * })
 * console.log(line) // "unchanged"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InstalledTreeComparison = S.Union([InstalledTreesLockfileUnchanged, InstalledTreesCompared]).pipe(
  $I.annoteSchema("InstalledTreeComparison", {
    description: "Whether bun.lock changed and, when it did, which packages' installed trees changed.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * {@inheritDoc InstalledTreeComparison}
 *
 * @category type-level
 * @since 0.0.0
 */
export type InstalledTreeComparison = typeof InstalledTreeComparison.Type;

/**
 * The narrowed force decision, computed in shadow.
 *
 * **Details**
 *
 * `reasons` is the narrowed decision: the actual reasons without
 * `lockfile-changed`, so it never forces a lockfile-only change. For such a
 * change the per-package comparison names what a per-package force would
 * force instead.
 *
 * **Example** (A patch-only commit)
 *
 * ```ts
 * import { InstalledTreesLockfileUnchanged, TurboForceShadowComputed } from "@beep/repo-cli/test/Yeet"
 *
 * const shadow = TurboForceShadowComputed.make({
 *   kind: "computed",
 *   reasons: ["patches-changed"],
 *   installedTrees: InstalledTreesLockfileUnchanged.make({ kind: "lockfile-unchanged" }),
 * })
 * console.log(shadow.reasons) // ["patches-changed"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboForceShadowComputed extends S.Opaque<TurboForceShadowComputed, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("computed"),
    reasons: S.Array(TurboForceReason),
    installedTrees: InstalledTreeComparison,
  }).pipe(
    $I.annoteSchema("TurboForceShadowComputed", {
      description: "The narrowed TURB-05 force decision and the per-package installed-tree comparison.",
    })
  )
) {}

/**
 * The shadow could not be computed; the actual decision is recorded regardless.
 *
 * **Example** (A failed git read)
 *
 * ```ts
 * import { TurboForceShadowUnavailable } from "@beep/repo-cli/test/Yeet"
 *
 * const shadow = TurboForceShadowUnavailable.make({ kind: "unavailable", detail: "git diff failed" })
 * console.log(shadow.detail) // "git diff failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboForceShadowUnavailable extends S.Opaque<
  TurboForceShadowUnavailable,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    kind: S.tag("unavailable"),
    detail: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("TurboForceShadowUnavailable", {
      description: "Why the narrowed TURB-05 force decision could not be computed.",
    })
  )
) {}

/**
 * The narrowed force decision, or why it could not be computed.
 *
 * **Example** (Match on the shadow)
 *
 * ```ts
 * import { TurboForceShadow, TurboForceShadowUnavailable } from "@beep/repo-cli/test/Yeet"
 *
 * const line = TurboForceShadow.match(TurboForceShadowUnavailable.make({ kind: "unavailable", detail: "no git" }), {
 *   computed: (shadow) => `${shadow.reasons.length} reason(s)`,
 *   unavailable: (shadow) => shadow.detail,
 * })
 * console.log(line) // "no git"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurboForceShadow = S.Union([TurboForceShadowComputed, TurboForceShadowUnavailable]).pipe(
  $I.annoteSchema("TurboForceShadow", {
    description: "The narrowed TURB-05 force decision computed in shadow, or why it could not be computed.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * {@inheritDoc TurboForceShadow}
 *
 * @category type-level
 * @since 0.0.0
 */
export type TurboForceShadow = typeof TurboForceShadow.Type;

/**
 * The force receipt one repair, verify or publish attempt carries on its
 * attempt-started journal row.
 *
 * **Details**
 *
 * `reasons` is the actual decision: the attempt forced Turbo exactly when it
 * is non-empty. `shadow` is the narrowed decision, recorded and never read
 * to decide anything while the R2 pause holds (ruling D14).
 *
 * **Example** (A lockfile attempt the narrowed decision would not force)
 *
 * ```ts
 * import {
 *   InstalledTreesCompared,
 *   TurboForceReceipt,
 *   TurboForceShadowComputed,
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const receipt = TurboForceReceipt.make({
 *   reasons: ["lockfile-changed"],
 *   shadow: TurboForceShadowComputed.make({
 *     kind: "computed",
 *     reasons: [],
 *     installedTrees: InstalledTreesCompared.make({ kind: "compared", packages: 2, changed: [] }),
 *   }),
 * })
 * console.log(receipt.reasons) // ["lockfile-changed"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboForceReceipt extends S.Opaque<TurboForceReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    reasons: S.Array(TurboForceReason),
    shadow: TurboForceShadow,
  }).pipe(
    $I.annoteSchema("TurboForceReceipt", {
      description: "Why an attempt forced Turbo, and the narrowed TURB-05 decision computed beside it in shadow.",
    })
  )
) {}

/**
 * The actual force decision for one run, read once from its install inputs.
 *
 * **Details**
 *
 * The run forces Turbo exactly when `reasons` is non-empty. `mergeBase` is
 * resolved only when `bun.lock` or the root `package.json` changed, and the
 * shadow reuses it. `unreadable` names a read that failed: a failed diff
 * forces nothing, as the lockfile check always read it, and an unreadable
 * merge base or root manifest leaves only the path triggers standing. The
 * shadow is then unavailable.
 *
 * **Example** (A patch-only commit)
 *
 * ```ts
 * import { TurboForceDecision } from "@beep/repo-cli/test/Yeet"
 *
 * const decision = TurboForceDecision.make({ reasons: ["patches-changed"] })
 * console.log(decision.reasons.length > 0) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboForceDecision extends S.Opaque<TurboForceDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    reasons: S.Array(TurboForceReason),
    mergeBase: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    unreadable: S.NonEmptyString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("TurboForceDecision", {
      description: "Why a run forces Turbo, the merge base its install inputs were read at, and any read that failed.",
    })
  )
) {}

const noTurboForce = TurboForceDecision.make({ reasons: [] });

const RootInstallPolicy = S.Struct({
  overrides: S.optionalKey(S.Unknown),
  resolutions: S.optionalKey(S.Unknown),
  patchedDependencies: S.optionalKey(S.Unknown),
}).pipe(
  $I.annoteSchema("RootInstallPolicy", {
    description: "The root package.json fields that change what bun installs without naming a dependency.",
  })
);

const decodeRootInstallPolicy = S.decodeUnknownEffect(S.fromJsonString(RootInstallPolicy));

const noRootInstallPolicy: typeof RootInstallPolicy.Type = {};

const instanceLine = (pkg: ResolvedPackage): string =>
  `${pkg.instanceId}\0${pkg.name}@${pkg.version}\0${pkg.integrity ?? ""}`;

const resolvedTargets = (lockfile: Lockfile, instanceId: string): ReadonlyArray<string> =>
  pipe(
    lockfile.packageByInstanceId(instanceId),
    O.map((pkg) => R.values(pkg.resolved)),
    O.getOrElse(A.empty<string>)
  );

// Every instance reachable from `seeds`, on top of `reached` (copied, never changed). The walk is
// breadth first over a queue, so a long dependency chain cannot exhaust the stack.
const reachableInstances = (
  lockfile: Lockfile,
  reached: Iterable<string>,
  seeds: ReadonlyArray<string>
): MutableHashSet.MutableHashSet<string> => {
  const seen = MutableHashSet.fromIterable(reached);
  const queue = MutableList.make<string>();
  MutableList.appendAll(queue, seeds);
  for (let next = MutableList.take(queue); next !== MutableList.Empty; next = MutableList.take(queue)) {
    if (!MutableHashSet.has(seen, next)) {
      MutableHashSet.add(seen, next);
      MutableList.appendAll(queue, resolvedTargets(lockfile, next));
    }
  }
  return seen;
};

const rootSeeds = (lockfile: Lockfile): ReadonlyArray<string> =>
  pipe(
    lockfile.importer("."),
    O.map((root) => A.map(root.dependencies, (dependency) => dependency.name)),
    O.getOrElse(A.empty<string>)
  );

const treeText = (lockfile: Lockfile, instances: MutableHashSet.MutableHashSet<string>): string =>
  pipe(
    A.fromIterable(instances),
    A.flatMap((instanceId) => A.fromOption(O.map(lockfile.packageByInstanceId(instanceId), instanceLine))),
    A.sort(Order.String),
    A.join("\n")
  );

/**
 * Digest the locked installed tree of every package in a `bun.lock`.
 *
 * **Details**
 *
 * A package's installed tree is every instance its declared dependencies
 * reach through the lockfile's resolved edges, plus everything the root
 * reaches, because the hoisted linker lets every package load the root's
 * tools. Each instance contributes its `bun.lock` key (its install position
 * under the hoisted linker), name, version and integrity; the digest is the
 * SHA-256 of those lines sorted. The root itself is
 * {@link ROOT_INSTALLED_TREE_PACKAGE}. Patch content is not in the digest
 * (`patches-changed` is detected from the path diff), and neither is drift
 * between `node_modules` and the lockfile, which the frozen head-install
 * preflight checks.
 *
 * **Example** (Digest a one-package lockfile)
 *
 * ```ts
 * import { packageInstalledTreeDigests } from "@beep/repo-cli/test/Yeet"
 * import { Lockfile } from "@beep/lockfiles/Lockfile"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import * as HashMap from "effect/HashMap"
 *
 * const program = Lockfile.parse(
 *   '{"lockfileVersion":1,"workspaces":{"":{"name":"root"}},"packages":{}}',
 *   { format: "bun" }
 * ).pipe(
 *   Effect.flatMap(packageInstalledTreeDigests),
 *   Effect.map(HashMap.size),
 *   Effect.provide(Digest.layerWebCrypto)
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param lockfile - A parsed bun lockfile.
 * @returns Package name to its installed-tree digest, the root included.
 * @category digests
 * @since 0.0.0
 */
export const packageInstalledTreeDigests = Effect.fn("Yeet.packageInstalledTreeDigests")(function* (
  lockfile: Lockfile
): Effect.fn.Return<HashMap.HashMap<string, Sha256Hex>, YeetCommandError, Digest.Digest> {
  const root = reachableInstances(lockfile, A.empty<string>(), rootSeeds(lockfile));
  const trees = A.prepend(
    A.map(
      lockfile.workspacePackages,
      (pkg) => [pkg.name, reachableInstances(lockfile, root, R.values(pkg.resolved))] as const
    ),
    [ROOT_INSTALLED_TREE_PACKAGE, root] as const
  );
  const digests = yield* Effect.forEach(trees, ([name, instances]) =>
    Effect.map(digestTreeText(treeText(lockfile, instances)), (hex) => [name, hex] as const)
  );
  return HashMap.fromIterable(digests);
});

/**
 * Compare the installed-tree digests of the merge base and `HEAD`.
 *
 * **Example** (One package changed)
 *
 * ```ts
 * import { compareInstalledTrees } from "@beep/repo-cli/test/Yeet"
 * import { Sha256Hex } from "@beep/schema"
 * import * as HashMap from "effect/HashMap"
 * import * as Str from "effect/String"
 *
 * const digest = (char: string) => Sha256Hex.make(Str.repeat(64)(char))
 * const compared = compareInstalledTrees(
 *   HashMap.make(["@beep/a", digest("a")], ["@beep/b", digest("b")]),
 *   HashMap.make(["@beep/a", digest("c")], ["@beep/b", digest("b")])
 * )
 * console.log(compared.changed.map((change) => change.name)) // ["@beep/a"]
 * ```
 *
 * @param base - Package digests at the merge base.
 * @param head - Package digests at `HEAD`.
 * @returns Every package counted, and the ones whose digest differs.
 * @category digests
 * @since 0.0.0
 */
export const compareInstalledTrees: {
  (head: HashMap.HashMap<string, Sha256Hex>): (base: HashMap.HashMap<string, Sha256Hex>) => InstalledTreesCompared;
  (base: HashMap.HashMap<string, Sha256Hex>, head: HashMap.HashMap<string, Sha256Hex>): InstalledTreesCompared;
} = dual(
  2,
  (base: HashMap.HashMap<string, Sha256Hex>, head: HashMap.HashMap<string, Sha256Hex>): InstalledTreesCompared => {
    const names = A.sort(A.dedupe([...HashMap.keys(base), ...HashMap.keys(head)]), Order.String);
    return InstalledTreesCompared.make({
      kind: "compared",
      packages: A.length(names),
      changed: pipe(
        names,
        A.map((name) =>
          PackageInstalledTreeChange.make({ name, base: HashMap.get(base, name), head: HashMap.get(head, name) })
        ),
        A.filter((change) => !Equal.equals(change.base, change.head))
      ),
    });
  }
);

const changedInstallInputPaths = Effect.fn("Yeet.TurboForce.changedInstallInputPaths")(function* (
  context: RepoRunContext
) {
  const git = yield* Git;
  return yield* git
    .changedFiles(context.repoRoot, { base: context.base, head: context.head, pathspec: INSTALL_INPUT_PATHSPEC })
    .pipe(
      Effect.mapError(
        yeetGitKitError(
          GitCommand.changedFiles(context.base, context.head, false, { pathspec: INSTALL_INPUT_PATHSPEC })
        )
      )
    );
});

const showAt = Effect.fn("Yeet.TurboForce.showAt")(function* (repoRoot: string, ref: string, path: string) {
  const git = yield* Git;
  return yield* git.show(repoRoot, ref, path).pipe(Effect.mapError(yeetGitKitError(GitCommand.show(ref, path))));
});

const rootInstallPolicyAt = Effect.fn("Yeet.TurboForce.rootInstallPolicyAt")(function* (repoRoot: string, ref: string) {
  const text = yield* showAt(repoRoot, ref, ROOT_MANIFEST_PATH);
  return yield* O.match(text, {
    onNone: () => Effect.succeed(noRootInstallPolicy),
    onSome: (json) =>
      decodeRootInstallPolicy(json).pipe(
        Effect.mapError(YeetCommandError.new(`Failed to read the root package.json at ${ref}.`))
      ),
  });
});

const rootPolicyReasons = Effect.fn("Yeet.TurboForce.rootPolicyReasons")(function* (
  context: RepoRunContext,
  mergeBase: string
) {
  const base = yield* rootInstallPolicyAt(context.repoRoot, mergeBase);
  const head = yield* rootInstallPolicyAt(context.repoRoot, context.head);
  return A.getSomes([
    O.liftPredicate(
      TurboForceReason.Enum["patches-changed"],
      () => !Equal.equals(base.patchedDependencies, head.patchedDependencies)
    ),
    O.liftPredicate(
      TurboForceReason.Enum["overrides-changed"],
      () => !Equal.equals(base.overrides, head.overrides) || !Equal.equals(base.resolutions, head.resolutions)
    ),
  ]);
});

const installedTreeDigestsAt = Effect.fn("Yeet.TurboForce.installedTreeDigestsAt")(function* (
  repoRoot: string,
  ref: string
) {
  const text = yield* showAt(repoRoot, ref, LOCKFILE_PATH);
  const content = yield* Effect.fromOption(text).pipe(
    Effect.mapError(() => YeetCommandError.make({ message: `bun.lock is absent at ${ref}.` }))
  );
  const lockfile = yield* Lockfile.parse(content, { format: "bun" }).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to parse bun.lock at ${ref}.`))
  );
  return yield* packageInstalledTreeDigests(lockfile);
});

const compareLockedTrees = Effect.fn("Yeet.TurboForce.compareLockedTrees")(function* (
  context: RepoRunContext,
  mergeBase: string
) {
  const base = yield* installedTreeDigestsAt(context.repoRoot, mergeBase);
  const head = yield* installedTreeDigestsAt(context.repoRoot, context.head);
  return compareInstalledTrees(base, head);
});

const pathReasons = (paths: ReadonlyArray<string>): ReadonlyArray<TurboForceReason> =>
  A.getSomes([
    O.liftPredicate(TurboForceReason.Enum["lockfile-changed"], () => A.contains(paths, LOCKFILE_PATH)),
    O.liftPredicate(TurboForceReason.Enum["patches-changed"], () => A.some(paths, Str.startsWith(PATCHES_PREFIX))),
  ]);

// The merge base and the root install policy are read only when `bun.lock` or the root
// `package.json` is in the diff; a failed read leaves the path triggers standing.
const decisionFromPaths = Effect.fn("Yeet.TurboForce.decisionFromPaths")(function* (
  context: RepoRunContext,
  paths: ReadonlyArray<string>
) {
  const fromPaths = pathReasons(paths);
  const manifestChanged = A.contains(paths, ROOT_MANIFEST_PATH);
  if (!manifestChanged && !A.contains(paths, LOCKFILE_PATH)) {
    return TurboForceDecision.make({ reasons: fromPaths });
  }
  return yield* resolveYeetMergeBase(context.repoRoot, context.base, context.head).pipe(
    Effect.flatMap((mergeBase) =>
      Effect.map(
        manifestChanged ? rootPolicyReasons(context, mergeBase) : Effect.succeed(A.empty<TurboForceReason>()),
        (policy) =>
          TurboForceDecision.make({ reasons: A.dedupe([...fromPaths, ...policy]), mergeBase: O.some(mergeBase) })
      )
    ),
    Effect.catch((error) =>
      Effect.succeed(TurboForceDecision.make({ reasons: fromPaths, unreadable: O.some(error.message) }))
    )
  );
});

const readTurboForceDecision = (context: RepoRunContext) =>
  changedInstallInputPaths(context).pipe(
    Effect.flatMap((paths) => decisionFromPaths(context, paths)),
    Effect.catch((error) => Effect.succeed(TurboForceDecision.make({ reasons: [], unreadable: O.some(error.message) })))
  );

// A lockfile force keeps the line it always printed; the other triggers name themselves.
const forceLines = (base: string, reasons: ReadonlyArray<TurboForceReason>): ReadonlyArray<string> =>
  A.match(reasons, {
    onEmpty: A.empty<string>,
    onNonEmpty: (named) => [
      A.contains(named, TurboForceReason.Enum["lockfile-changed"])
        ? `[yeet] bun.lock changed since ${base}; forcing dependency-sensitive lanes (TURBO_FORCE=true)`
        : `[yeet] install inputs changed since ${base} (${A.join(named, ", ")}); forcing dependency-sensitive lanes (TURBO_FORCE=true)`,
    ],
  });

/**
 * Decide whether a Yeet run forces Turbo on its dependency-sensitive steps.
 *
 * **Details**
 *
 * Repair, verify and publish force when an install input changed between the
 * merge base and `HEAD`: `bun.lock`, a file under `patches/` or the root
 * `patchedDependencies`, or the root `overrides` or `resolutions`. Every
 * other mode never forces. One three-dot `git diff --name-only` over
 * `bun.lock`, `patches` and `package.json` finds the triggers. The root
 * `package.json` is read at the merge base and `HEAD` only when it is in
 * that diff. A failed diff
 * forces nothing, as the lockfile check always read it. A lockfile force logs
 * the line it always has; a patch or override force names its reasons.
 *
 * **Example** (Decide for a verify run)
 *
 * ```ts
 * import { decideTurboForce, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
 * })
 * console.log(Effect.isEffect(decideTurboForce(context, "verify"))) // true
 * ```
 *
 * @param context - Run whose base and head are diffed.
 * @param mode - The Yeet mode being run.
 * @returns The decision; the run forces exactly when its reasons are non-empty.
 * @category execution
 * @since 0.0.0
 */
export const decideTurboForce = Effect.fn("Yeet.decideTurboForce")(function* (
  context: RepoRunContext,
  mode: YeetRunMode
): Effect.fn.Return<TurboForceDecision, never, Git> {
  if (!isTurboForceDecidingMode(mode)) {
    return noTurboForce;
  }
  const decision = yield* readTurboForceDecision(context);
  yield* Effect.forEach(forceLines(context.base, decision.reasons), (line) => Console.log(line), { discard: true });
  return decision;
});

const lockfileUnchanged = InstalledTreesLockfileUnchanged.make({ kind: "lockfile-unchanged" });

const narrowedReasons = (reasons: ReadonlyArray<TurboForceReason>): ReadonlyArray<TurboForceReason> =>
  A.filter(reasons, P.not(TurboForceReason.is["lockfile-changed"]));

const installedTreesFor = Effect.fn("Yeet.TurboForce.installedTreesFor")(function* (
  context: RepoRunContext,
  decision: TurboForceDecision
): Effect.fn.Return<InstalledTreeComparison, YeetCommandError, Git | Digest.Digest> {
  const lockfileBase = pipe(
    decision.mergeBase,
    O.filter(() => A.contains(decision.reasons, TurboForceReason.Enum["lockfile-changed"]))
  );
  return yield* O.match(lockfileBase, {
    onNone: () => Effect.succeed(lockfileUnchanged),
    onSome: (mergeBase) => compareLockedTrees(context, mergeBase),
  });
});

/**
 * Compute the narrowed force decision and the installed-tree comparison in shadow.
 *
 * **Details**
 *
 * It reuses the decision's reads. The narrowed reasons are the actual ones
 * without `lockfile-changed`. Only when `bun.lock` changed are both lockfiles
 * read at the decision's merge base and `HEAD`, parsed and digested
 * ({@link packageInstalledTreeDigests}). It never fails: a read the decision
 * could not make, or an unreadable lockfile, yields
 * {@link TurboForceShadowUnavailable} with the reason.
 *
 * **Example** (Build the shadow reader)
 *
 * ```ts
 * import { collectTurboForceShadow, RepoRunContext, TurboForceDecision } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
 * })
 * const decision = TurboForceDecision.make({ reasons: ["patches-changed"] })
 * console.log(Effect.isEffect(collectTurboForceShadow(context, decision))) // true
 * ```
 *
 * @param context - Run whose base and head are compared.
 * @param decision - The actual decision from {@link decideTurboForce}.
 * @returns The narrowed decision, or why it could not be computed.
 * @category execution
 * @since 0.0.0
 */
export const collectTurboForceShadow = Effect.fn("Yeet.collectTurboForceShadow")(function* (
  context: RepoRunContext,
  decision: TurboForceDecision
): Effect.fn.Return<TurboForceShadow, never, Git | Digest.Digest> {
  return yield* O.match(decision.unreadable, {
    onSome: (detail) => Effect.succeed(TurboForceShadowUnavailable.make({ kind: "unavailable", detail })),
    onNone: () =>
      installedTreesFor(context, decision).pipe(
        Effect.map((installedTrees) =>
          TurboForceShadowComputed.make({
            kind: "computed",
            reasons: narrowedReasons(decision.reasons),
            installedTrees,
          })
        ),
        Effect.catch((error) =>
          Effect.succeed(TurboForceShadowUnavailable.make({ kind: "unavailable", detail: error.message }))
        )
      ),
  });
});

const reasonsText = (reasons: ReadonlyArray<TurboForceReason>): string =>
  A.match(reasons, {
    onEmpty: () => "not forced",
    onNonEmpty: (named) => `forced (${A.join(named, ", ")})`,
  });

/**
 * Render the one-line note a run logs for its force receipt.
 *
 * **Example** (A lockfile attempt)
 *
 * ```ts
 * import {
 *   InstalledTreesCompared,
 *   renderTurboForceReceipt,
 *   TurboForceReceipt,
 *   TurboForceShadowComputed,
 * } from "@beep/repo-cli/test/Yeet"
 *
 * const receipt = TurboForceReceipt.make({
 *   reasons: ["lockfile-changed"],
 *   shadow: TurboForceShadowComputed.make({
 *     kind: "computed",
 *     reasons: [],
 *     installedTrees: InstalledTreesCompared.make({ kind: "compared", packages: 4, changed: [] }),
 *   }),
 * })
 * console.log(renderTurboForceReceipt(receipt))
 * // "turbo force shadow: actual forced (lockfile-changed); narrowed not forced; installed tree changed in 0 of 4 package(s)"
 * ```
 *
 * @param receipt - The attempt's force receipt.
 * @returns The note, without the `[yeet]` prefix.
 * @category rendering
 * @since 0.0.0
 */
export const renderTurboForceReceipt = (receipt: TurboForceReceipt): string =>
  TurboForceShadow.match(receipt.shadow, {
    computed: (shadow) =>
      `turbo force shadow: actual ${reasonsText(receipt.reasons)}; narrowed ${reasonsText(shadow.reasons)}; ${InstalledTreeComparison.match(
        shadow.installedTrees,
        {
          "lockfile-unchanged": () => "lockfile unchanged",
          compared: (compared) =>
            `installed tree changed in ${A.length(compared.changed)} of ${compared.packages} package(s)`,
        }
      )}`,
    unavailable: (shadow) =>
      `turbo force shadow: actual ${reasonsText(receipt.reasons)}; narrowed unavailable (${shadow.detail})`,
  });

// Nothing forced and nothing would be: the receipt is recorded without a log line.
const isQuietReceipt = (receipt: TurboForceReceipt): boolean =>
  A.isReadonlyArrayEmpty(receipt.reasons) &&
  TurboForceShadow.match(receipt.shadow, {
    computed: (shadow) => A.isReadonlyArrayEmpty(shadow.reasons),
    unavailable: constFalse,
  });

/**
 * Build the force receipt a repair, verify or publish attempt records.
 *
 * **Details**
 *
 * Other modes never decide a force and record none. The receipt carries the
 * decision's reasons and {@link collectTurboForceShadow}. It is logged when the
 * run forces or the shadow is unavailable. Nothing reads it to plan or decide:
 * the caller has already planned with the decision.
 *
 * **Example** (Record a forced verify run)
 *
 * ```ts
 * import { RepoRunContext, TurboForceDecision, turboForceReceiptFor } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
 * })
 * const decision = TurboForceDecision.make({ reasons: ["lockfile-changed"] })
 * console.log(Effect.isEffect(turboForceReceiptFor(context, "verify", decision))) // true
 * ```
 *
 * @param context - Run whose base and head are compared.
 * @param mode - The Yeet mode being run.
 * @param decision - The actual decision from {@link decideTurboForce}.
 * @returns The receipt, or none for a mode that never forces.
 * @category execution
 * @since 0.0.0
 */
export const turboForceReceiptFor = Effect.fn("Yeet.turboForceReceiptFor")(function* (
  context: RepoRunContext,
  mode: YeetRunMode,
  decision: TurboForceDecision
): Effect.fn.Return<O.Option<TurboForceReceipt>, never, Git | Digest.Digest> {
  if (!isTurboForceDecidingMode(mode)) {
    return O.none();
  }
  const shadow = yield* collectTurboForceShadow(context, decision);
  const receipt = TurboForceReceipt.make({ reasons: decision.reasons, shadow });
  if (!isQuietReceipt(receipt)) {
    yield* Console.log(`[yeet] ${renderTurboForceReceipt(receipt)}`);
  }
  return O.some(receipt);
});
