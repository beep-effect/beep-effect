/**
 * The term snapshot of a base ref, read from git: the one reader behind the
 * identity registry lint and every command that regenerates the snapshot.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import { TermSnapshot } from "@beep/identity/Term";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  BaseSnapshot,
  DEFAULT_BASE_REF,
  decodeBaseSnapshot,
  IdentityRegistryGeneratorError,
  RegistryLayout,
} from "./Registry.ts";

const $I = $RepoCliId.create("commands/Identity/RegistryBase");

const IDENTITY_PACKAGE_NAME = "@beep/identity";

class IdentityManifest extends S.Opaque<IdentityManifest, { readonly brand: unique symbol }>()(
  S.Struct({ name: S.tag(IDENTITY_PACKAGE_NAME) }).pipe(
    $I.annoteSchema("IdentityManifest", { description: "A package.json that names the @beep/identity package." })
  )
) {}
const decodeIdentityManifest = S.decodeUnknownOption(S.fromJsonString(IdentityManifest));

// Where the tree at `ref` has the term snapshot of its @beep/identity package. The head's own path says nothing
// about the base: a change may move the package. A tree with more than one such package is read at the head's path.
const locateBaseSnapshot = Effect.fn("IdentityRegistryBase.locate")(function* (
  repoRoot: string,
  ref: string,
  headPath: string
) {
  const git = yield* Git;
  const path = yield* Path.Path;
  const entries = yield* git.lsTree(repoRoot, ref, { fullTree: true });
  const files = HashSet.fromIterable(A.map(entries, (entry) => entry.path));
  const directories = A.filterMap(entries, (entry) => {
    const directory = path.dirname(entry.path);
    return path.basename(entry.path) === "package.json" && HashSet.has(files, RegistryLayout.of(directory).snapshot)
      ? Result.succeed(directory)
      : Result.failVoid;
  });
  const owners = yield* Effect.filter(
    directories,
    (directory) =>
      Effect.map(
        git.show(repoRoot, ref, `${directory}/package.json`),
        flow(O.flatMap(decodeIdentityManifest), O.isSome)
      ),
    { concurrency: 1 }
  );
  const paths = A.map(owners, (directory) => RegistryLayout.of(directory).snapshot);
  if (A.contains(paths, headPath)) {
    return O.some(headPath);
  }
  return A.length(paths) > 1
    ? yield* IdentityRegistryGeneratorError.make({
        message: `The base ${ref} has more than one ${IDENTITY_PACKAGE_NAME} term snapshot (${A.join(paths, ", ")}) and none at ${headPath}, so the published term set is unknown.`,
      })
    : A.head(paths);
});

/**
 * The `--base <ref>` flag of every command that reads a base snapshot.
 *
 * **Example** (Offer the flag on a command)
 *
 * ```ts
 * import { baseFlag } from "@beep/repo-cli/commands/Identity/RegistryBase"
 * import * as Command from "effect/cli/Command"
 * import * as Console from "effect/Console"
 *
 * const probe = Command.make("probe", { base: baseFlag }, ({ base }) => Console.log(base))
 * console.log(probe.name) // "probe"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const baseFlag = Flag.String("base").pipe(
  Flag.withDescription(
    `Git ref whose term snapshot the change is released and compared against (default: the merge base of HEAD with ${DEFAULT_BASE_REF})`
  ),
  Flag.optional
);

/**
 * The base ref's term snapshot: `--base <ref>`, or the merge base of `HEAD` with `origin/main`.
 *
 * **Details**
 *
 * Only the documented absences give the empty snapshot, which publishes no
 * term, and each says so on the log under `label`: no default base (not a git
 * work tree, no `origin/main` ref, disjoint history) and a base whose tree has
 * no identity term snapshot. Every other git failure fails, and a base snapshot
 * that does not decode is a finding.
 *
 * **Example** (Read the default base)
 *
 * ```ts
 * import { RegistryLayout } from "@beep/repo-cli/commands/Identity/Registry"
 * import { readBaseSnapshot } from "@beep/repo-cli/commands/Identity/RegistryBase"
 * import * as O from "effect/Option"
 *
 * console.log(readBaseSnapshot("identity:registry", "/repo", RegistryLayout.of("packages/identity"), O.none()))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const readBaseSnapshot = Effect.fn("IdentityRegistryBase.read")(function* (
  label: string,
  repoRoot: string,
  layout: RegistryLayout,
  ref: O.Option<string>
) {
  const git = yield* Git;
  const none = Result.succeed(BaseSnapshot.make({ snapshot: TermSnapshot.empty, ref }));
  const commit = yield* O.match(ref, {
    onNone: () =>
      git.mergeBaseOption(repoRoot, "HEAD", DEFAULT_BASE_REF).pipe(
        Effect.catchTags({
          NotARepositoryError: () => Effect.succeedNone,
          UnknownRefError: () => Effect.succeedNone,
        })
      ),
    onSome: Effect.succeedSome,
  });
  if (O.isNone(commit)) {
    yield* Console.log(
      `[${label}] no merge base with ${DEFAULT_BASE_REF}; the term-stability base is the empty snapshot.`
    );
    return none;
  }
  const located = yield* locateBaseSnapshot(repoRoot, commit.value, layout.snapshot);
  if (O.isNone(located)) {
    yield* Console.log(
      `[${label}] the base ${commit.value} has no ${IDENTITY_PACKAGE_NAME} term snapshot; the term-stability base is the empty snapshot.`
    );
    return none;
  }
  if (located.value !== layout.snapshot) {
    yield* Console.log(
      `[${label}] the base ${commit.value} has its term snapshot at ${located.value}; this checkout has it at ${layout.snapshot}.`
    );
  }
  const text = yield* git.show(repoRoot, commit.value, located.value);
  return Result.map(decodeBaseSnapshot(located.value, text), (snapshot) => BaseSnapshot.make({ snapshot, ref }));
});
