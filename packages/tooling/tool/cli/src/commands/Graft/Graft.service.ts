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
 * Planning is read-only. Application atomically replaces only the selected artifact files.
 *
 * **Example** (Prepare a read-only plan)
 *
 * ```ts import.meta.vitest name="Prepare a read-only plan"
 * import { GraftCacheSync } from "@beep/repo-cli/commands/Graft"
 * import { Effect } from "effect"
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
  const safePath = Effect.fn("GraftCacheSync.safePath")(function* (root: string, relative: string, directory: boolean) {
    const segments = Str.split(path.sep)(relative);
    let current = root;
    for (const { segment, index } of A.map(segments, (segment, index) => ({ segment, index }))) {
      const names = yield* fs.readDirectory(current).pipe(Effect.mapError(ioError(current)));
      if (!A.contains(names, segment)) return false;
      current = path.join(current, segment);
      const canonical = yield* fs.realPath(current).pipe(Effect.mapError(ioError(current)));
      const info = yield* fs.stat(current).pipe(Effect.mapError(ioError(current)));
      const expectedType = directory || index < A.length(segments) - 1 ? "Directory" : "File";
      if (!Eq.equals(canonical, current) || !Eq.equals(info.type, expectedType)) {
        return yield* GraftCacheTargetError.make({
          path: current,
          message: `Refusing redirected or non-${expectedType} artifact path: ${current}.`,
        });
      }
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
        return yield* Effect.forEach(
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
        Effect.fn("GraftCacheSync.siblingCandidate")(function* (candidate) {
          const info = yield* fs.stat(candidate).pipe(Effect.mapError(ioError(candidate)));
          if (!Eq.equals(info.type, "Directory")) return false;
          const canonical = yield* fs.realPath(candidate).pipe(Effect.mapError(ioError(candidate)));
          return (
            !Eq.equals(canonical, source) &&
            (yield* fs.exists(path.join(candidate, ".git")).pipe(Effect.mapError(ioError(candidate))))
          );
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

  const apply: GraftCacheSyncShape["apply"] = Effect.fn("GraftCacheSync.apply")(function* (requested) {
    const fresh = yield* plan(requested.source, A.dedupe(A.map(requested.entries, (entry) => entry.target.root)));
    if (!equivalentPlan(requested, fresh)) {
      return yield* GraftCacheTargetError.make({
        path: requested.source,
        message: "Sync plan changed or contains unapproved paths; create a fresh plan before applying.",
      });
    }
    let bytes = 0;
    let copied = 0;
    for (const entry of fresh.entries) {
      if (GraftCacheSyncAction.is.copy(entry.action)) {
        bytes += yield* copy(fresh.source, entry);
        copied += 1;
      }
    }
    return GraftCacheSyncReport.make({
      plan: fresh,
      copied: NonNegativeInt.make(copied),
      skipped: NonNegativeInt.make(
        A.length(A.filter(fresh.entries, (entry) => GraftCacheSyncAction.is["skip-missing-source"](entry.action)))
      ),
      refused: NonNegativeInt.make(
        A.length(A.filter(fresh.entries, (entry) => GraftCacheSyncAction.is.refuse(entry.action)))
      ),
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
 * import { Effect } from "effect"
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
