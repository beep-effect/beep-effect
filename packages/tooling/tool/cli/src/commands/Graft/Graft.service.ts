/**
 * Filesystem-only copying of the paid-for Graft meaning tier between clones.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { isResolvedPathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { Effect, Match } from "effect";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Eq from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GraftCacheIoError, GraftCacheSourceError, GraftCacheTargetError } from "./Graft.errors.ts";
import {
  GraftCacheArtifact,
  GraftCacheSyncAction,
  GraftCacheSyncPlan,
  GraftCacheSyncPlanEntry,
  GraftCacheSyncReport,
  GraftCacheSyncTarget,
} from "./Graft.schemas.ts";

const $I = $RepoCliId.create("commands/Graft/Graft.service");

/**
 * Plans, applies, and discovers destinations without invoking Git or Graft.
 *
 * **Details**
 *
 * Platform dependencies are captured by the layer. Refused targets become plan
 * entries; invalid sources fail planning. Apply rejects a changed plan before writing.
 *
 * @category services
 * @since 0.0.0
 */
export interface GraftCacheSyncShape {
  readonly apply: (
    plan: GraftCacheSyncPlan
  ) => Effect.Effect<GraftCacheSyncReport, GraftCacheSourceError | GraftCacheTargetError | GraftCacheIoError>;
  readonly discoverSiblings: (
    source: string
  ) => Effect.Effect<ReadonlyArray<string>, GraftCacheSourceError | GraftCacheIoError>;
  readonly plan: (
    source: string,
    targets: ReadonlyArray<string>
  ) => Effect.Effect<GraftCacheSyncPlan, GraftCacheSourceError | GraftCacheIoError>;
}

/**
 * Service that seeds Graft meaning artifacts into independent local clones.
 *
 * **Details**
 *
 * Planning is read-only. Application atomically replaces only the selected
 * artifact files, removes root concept nodes the source no longer has, and
 * writes nothing at all when the plan contains a refused destination.
 *
 * **Example** (Prepare a read-only plan)
 *
 * ```ts import.meta.vitest name="Prepare a read-only plan"
 * import { GraftCacheSync } from "@beep/repo-cli/commands/Graft"
 * import * as Effect from "effect/Effect"
 * const program = GraftCacheSync.use((sync) => sync.plan("/clones/a", ["/clones/b"]))
 * Effect.isEffect(program) // => true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GraftCacheSync extends Context.Service<GraftCacheSync, GraftCacheSyncShape>()($I`GraftCacheSync`) {}

const equivalentPlan = S.toEquivalence(GraftCacheSyncPlan);

const makeGraftCacheSync = Effect.fn("GraftCacheSync.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const ioError = (file: string) => (cause: unknown) =>
    GraftCacheIoError.make({ path: file, message: `Graft cache operation failed at ${file}.`, cause });

  const cloneRoot = Effect.fn("GraftCacheSync.cloneRoot")(function* (input: string) {
    const root = yield* fs.realPath(path.resolve(input)).pipe(Effect.mapError(ioError(input)));
    const git = path.join(root, ".git");
    const info = yield* fs.stat(git).pipe(Effect.mapError(ioError(git)));
    if (!Eq.equals(info.type, "Directory") && !Eq.equals(info.type, "File")) {
      return yield* GraftCacheTargetError.make({ path: root, message: "Clone must contain a .git file or directory." });
    }
    return root;
  });

  // Read each parent before resolving the child: exists() alone misses dangling symlinks.
  // Reject all redirected components, including links back into the same clone's tracked tree.
  // One path component: it must be a real directory entry (no symlink, no
  // redirection) of the expected type, or the whole artifact path is refused.
  const verifySegment = Effect.fn("GraftCacheSync.verifySegment")(function* (current: string, expectedType: string) {
    const canonical = yield* fs.realPath(current).pipe(Effect.mapError(ioError(current)));
    const info = yield* fs.stat(current).pipe(Effect.mapError(ioError(current)));
    if (!Eq.equals(canonical, current) || !Eq.equals(info.type, expectedType)) {
      return yield* GraftCacheTargetError.make({
        path: current,
        message: `Refusing redirected or non-${expectedType} artifact path: ${current}.`,
      });
    }
  });

  const safePath = Effect.fn("GraftCacheSync.safePath")(function* (root: string, relative: string, directory: boolean) {
    const segments = Str.split(path.sep)(relative);
    const last = A.length(segments) - 1;
    let current = root;
    for (const { segment, index } of A.map(segments, (segment, index) => ({ segment, index }))) {
      const names = yield* fs.readDirectory(current).pipe(Effect.mapError(ioError(current)));
      if (!A.contains(names, segment)) return false;
      current = path.join(current, segment);
      yield* verifySegment(current, directory || index < last ? "Directory" : "File");
    }
    return true;
  });

  const sourceRoot = Effect.fn("GraftCacheSync.sourceRoot")(function* (input: string) {
    const sourceError = (cause: GraftCacheTargetError | GraftCacheIoError) =>
      GraftCacheSourceError.make({ path: cause.path, message: cause.message, cause });
    const root = yield* cloneRoot(input).pipe(Effect.mapError(sourceError));
    const summaries = path.join("graft", ".cache", "summaries.json");
    const exists = yield* safePath(root, summaries, false).pipe(Effect.mapError(sourceError));
    if (!exists) {
      return yield* GraftCacheSourceError.make({
        path: path.join(root, summaries),
        message: "Source has no meaning tier: graft/.cache/summaries.json is missing.",
      });
    }
    return root;
  });

  const targetRoot = Effect.fn("GraftCacheSync.targetRoot")(function* (source: string, target: string) {
    const root = yield* cloneRoot(target);
    if (
      isResolvedPathWithinRoot(path, { root: source, candidate: root }) ||
      isResolvedPathWithinRoot(path, { root, candidate: source })
    ) {
      return yield* GraftCacheTargetError.make({
        path: root,
        message: "Source and target must be distinct, non-overlapping clone roots.",
      });
    }
    return root;
  });

  const targetOnlyConcepts = Effect.fn("GraftCacheSync.targetOnlyConcepts")(function* (
    source: string,
    target: GraftCacheSyncTarget,
    sourceNames: ReadonlyArray<string>
  ) {
    const listed = yield* Effect.result(fs.readDirectory(target.graftDir));
    const names = Result.isSuccess(listed) ? listed.success : [];
    return A.map(
      A.sort(
        A.filter(names, (name) => Str.endsWith(".md")(name) && !A.contains(sourceNames, name)),
        Order.String
      ),
      (name) =>
        GraftCacheSyncPlanEntry.make({
          target,
          artifact: "concepts",
          action: "remove",
          reason: "Concept node is no longer in the source.",
          sourcePath: path.join(source, "graft", name),
          targetPath: path.join(target.graftDir, name),
        })
    );
  });

  const plan: GraftCacheSyncShape["plan"] = Effect.fn("GraftCacheSync.plan")(function* (input, targets) {
    const source = yield* sourceRoot(input);
    const graft = path.join(source, "graft");
    const names = yield* fs.readDirectory(graft).pipe(Effect.mapError(ioError(graft)));
    const conceptNames = A.sort(
      A.filter(names, (name) => Str.endsWith(".md")(name) && !Eq.equals(name, "INDEX.md")),
      Order.String
    );
    const artifacts = yield* Effect.forEach(
      GraftCacheArtifact.Options,
      Effect.fn("GraftCacheSync.artifacts")(function* (artifact) {
        const relativePaths = Match.value(artifact).pipe(
          Match.when("summaries", () => [path.join("graft", ".cache", "summaries.json")]),
          Match.when("concepts", () => A.map(["INDEX.md", ...conceptNames], (name) => path.join("graft", name))),
          Match.when("wiring", () => [path.join("graft", ".graph", "wiring.json")]),
          Match.exhaustive
        );
        return yield* Effect.forEach(
          relativePaths,
          Effect.fn("GraftCacheSync.sourceArtifact")(function* (relative) {
            const exists = yield* safePath(source, relative, false).pipe(
              Effect.mapError((cause) =>
                GraftCacheSourceError.make({ path: cause.path, message: cause.message, cause })
              )
            );
            return GraftCacheSyncPlanEntry.make({
              target: GraftCacheSyncTarget.make({ root: source, graftDir: graft }),
              artifact,
              action: exists ? "copy" : "skip-missing-source",
              ...(exists ? {} : { reason: "Source artifact is missing." }),
              sourcePath: path.join(source, relative),
              targetPath: path.join(source, relative),
            });
          })
        );
      })
    );
    const entries = yield* Effect.forEach(
      A.dedupe(A.map(targets, (target) => path.resolve(target))),
      Effect.fn("GraftCacheSync.targetPlan")(function* (inputTarget) {
        const resolved = yield* Effect.result(targetRoot(source, inputTarget));
        const root = Result.isSuccess(resolved) ? resolved.success : path.resolve(inputTarget);
        const target = GraftCacheSyncTarget.make({ root, graftDir: path.join(root, "graft") });
        const copies = yield* Effect.forEach(
          A.flatten(artifacts),
          Effect.fn("GraftCacheSync.targetArtifact")(function* (artifact) {
            const relative = path.relative(source, artifact.sourcePath);
            const safety = Result.isFailure(resolved)
              ? Result.fail(resolved.failure)
              : yield* Effect.result(safePath(root, relative, false));
            return GraftCacheSyncPlanEntry.make({
              ...artifact,
              target,
              targetPath: path.join(root, relative),
              ...(Result.isFailure(safety) ? { action: "refuse", reason: safety.failure.message } : {}),
            });
          })
        );
        // A concept node the target still has and the source no longer does would
        // leave the target with a mixed meaning tier; plan its removal so the
        // target's root nodes match the source exactly. Cards under subdirectories
        // are never touched.
        const removals = Result.isFailure(resolved)
          ? []
          : yield* targetOnlyConcepts(source, target, A.append(conceptNames, "INDEX.md"));
        return A.appendAll(copies, removals);
      })
    );
    return GraftCacheSyncPlan.make({
      source,
      entries: A.dedupeWith(A.flatten(entries), S.toEquivalence(GraftCacheSyncPlanEntry)),
    });
  });

  const discoverSiblings: GraftCacheSyncShape["discoverSiblings"] = Effect.fn("GraftCacheSync.discoverSiblings")(
    function* (input) {
      const source = yield* sourceRoot(input);
      const parent = path.dirname(source);
      const prefix = Str.replace(/\d+$/u, "")(path.basename(source));
      const names = yield* fs.readDirectory(parent).pipe(Effect.mapError(ioError(parent)));
      const candidates = A.map(A.sort(A.filter(names, Str.startsWith(prefix)), Order.String), (name) =>
        path.join(parent, name)
      );
      return yield* Effect.filter(
        candidates,
        // A dangling link or an entry that vanished after the listing is not a
        // clone; it is skipped rather than aborting discovery for the real ones.
        Effect.fn("GraftCacheSync.siblingCandidate")(function* (candidate) {
          const probe = yield* Effect.result(
            Effect.all([fs.stat(candidate), fs.realPath(candidate), fs.exists(path.join(candidate, ".git"))])
          );
          if (Result.isFailure(probe)) return false;
          const [info, canonical, hasGit] = probe.success;
          return Eq.equals(info.type, "Directory") && !Eq.equals(canonical, source) && hasGit;
        })
      );
    }
  );

  const copy = Effect.fn("GraftCacheSync.copy")(function* (source: string, entry: GraftCacheSyncPlanEntry) {
    yield* targetRoot(source, entry.target.root);
    const relative = path.relative(entry.target.root, entry.targetPath);
    yield* safePath(entry.target.root, relative, false);
    const parent = path.dirname(entry.targetPath);
    yield* fs.makeDirectory(parent, { recursive: true }).pipe(Effect.mapError(ioError(parent)));
    yield* safePath(entry.target.root, path.relative(entry.target.root, parent), true);
    yield* safePath(source, path.relative(source, entry.sourcePath), false);
    const bytes = yield* fs.readFile(entry.sourcePath).pipe(Effect.mapError(ioError(entry.sourcePath)));
    const nonce = yield* Random.nextInt;
    const nonce2 = yield* Random.nextInt;
    const temporary = path.join(parent, `.graft-cache-sync-${nonce}-${nonce2}.tmp`);
    yield* Effect.acquireUseRelease(
      fs.writeFile(temporary, new Uint8Array(0), { flag: "wx" }).pipe(Effect.mapError(ioError(temporary))),
      Effect.fn("GraftCacheSync.replace")(function* () {
        yield* fs.writeFile(temporary, bytes).pipe(Effect.mapError(ioError(temporary)));
        yield* safePath(entry.target.root, relative, false);
        yield* fs.rename(temporary, entry.targetPath).pipe(Effect.mapError(ioError(entry.targetPath)));
      }),
      () => fs.remove(temporary, { force: true }).pipe(Effect.mapError(ioError(temporary)))
    );
    return bytes.byteLength;
  });

  // Remove a target-only root concept node; a node that is already gone counts as
  // nothing to do rather than a failure.
  const remove = Effect.fn("GraftCacheSync.remove")(function* (entry: GraftCacheSyncPlanEntry) {
    const relative = path.relative(entry.target.root, entry.targetPath);
    const present = yield* safePath(entry.target.root, relative, false);
    if (!present) return 0;
    yield* fs.remove(entry.targetPath).pipe(Effect.mapError(ioError(entry.targetPath)));
    return 1;
  });

  const apply: GraftCacheSyncShape["apply"] = Effect.fn("GraftCacheSync.apply")(function* (requested) {
    const fresh = yield* plan(requested.source, A.dedupe(A.map(requested.entries, (entry) => entry.target.root)));
    if (!equivalentPlan(requested, fresh)) {
      return yield* GraftCacheTargetError.make({
        path: requested.source,
        message: "Sync plan changed or contains unapproved paths; create a fresh plan before applying.",
      });
    }
    // Fail closed: a plan with any refused destination writes nothing, so a
    // mixed run can never mutate the good clones and then exit non-zero.
    const refused = A.filter(fresh.entries, (entry) => GraftCacheSyncAction.is.refuse(entry.action));
    if (A.isReadonlyArrayNonEmpty(refused)) {
      return yield* GraftCacheTargetError.make({
        path: refused[0].targetPath,
        message: `Refusing to apply: ${A.length(refused)} destination(s) failed the safety checks; nothing was written.`,
      });
    }
    let bytes = 0;
    let copied = 0;
    let removed = 0;
    for (const entry of fresh.entries) {
      if (GraftCacheSyncAction.is.copy(entry.action)) {
        bytes += yield* copy(fresh.source, entry);
        copied += 1;
      } else if (GraftCacheSyncAction.is.remove(entry.action)) {
        removed += yield* remove(entry);
      }
    }
    return GraftCacheSyncReport.make({
      plan: fresh,
      copied: NonNegativeInt.make(copied),
      removed: NonNegativeInt.make(removed),
      skipped: NonNegativeInt.make(
        A.length(A.filter(fresh.entries, (entry) => GraftCacheSyncAction.is["skip-missing-source"](entry.action)))
      ),
      refused: NonNegativeInt.make(0),
      bytes: NonNegativeInt.make(bytes),
    });
  });

  return GraftCacheSync.of({ plan, apply, discoverSiblings });
});

/**
 * Supplies cache synchronization using the runtime's filesystem and path services.
 *
 * **Details**
 *
 * Building the layer performs no filesystem operations. Methods run sequentially per artifact.
 *
 * **Example** (Provide the cache sync implementation)
 *
 * ```ts import.meta.vitest name="Provide the cache sync implementation"
 * import { GraftCacheSync, GraftCacheSyncLive } from "@beep/repo-cli/commands/Graft"
 * import * as Effect from "effect/Effect"
 * const program = GraftCacheSync.use((sync) => sync.plan("/clones/a", []))
 *   .pipe(Effect.provide(GraftCacheSyncLive))
 * Effect.isEffect(program) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GraftCacheSyncLive: Layer.Layer<GraftCacheSync, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
  GraftCacheSync,
  makeGraftCacheSync()
);
