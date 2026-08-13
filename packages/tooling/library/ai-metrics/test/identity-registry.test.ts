import {
  AiMetricsCanonicalRootInput,
  AiMetricsIdentityRegistry,
  AiMetricsIdentityRegistryError,
  AiMetricsIdentityRegistryUpsertInput,
  AiMetricsRootKind,
  AiMetricsTranscriptSource,
  hashPrivateIdentifier,
  identityRegistryToJson,
  isNestedGitRoot,
  makeAiMetricsCanonicalRoot,
  readAiMetricsIdentityRegistry,
  upsertAiMetricsIdentityRegistry,
} from "@beep/repo-ai-metrics";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Order, Path, pipe, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const hashSalt = "identity-registry-test-salt";
const mainSha = "1111111111111111111111111111111111111111";
const packedSha = "2222222222222222222222222222222222222222";
const detachedSha = "3333333333333333333333333333333333333333";
const originUrl = "git@github.com:beep-effect/beep-effect.git";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const withTempDirectory = <A2, E, R>(use: (tmpDir: string) => Effect.Effect<A2, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (tmpDir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(tmpDir, { recursive: true, force: true }))
  );

const writeText = Effect.fn("identityRegistryTest.writeText")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  yield* fs.makeDirectory(pathApi.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

const makeClone = Effect.fn("identityRegistryTest.makeClone")(function* (
  clonePath: string,
  options?: { readonly originUrl?: string }
) {
  const pathApi = yield* Path.Path;
  const gitDir = pathApi.join(clonePath, ".git");
  yield* writeText(pathApi.join(gitDir, "HEAD"), "ref: refs/heads/main\n");
  yield* writeText(pathApi.join(gitDir, "refs/heads/main"), `${mainSha}\n`);
  yield* writeText(
    pathApi.join(gitDir, "config"),
    `[core]\n\tbare = false\n[remote "origin"]\n\turl = ${options?.originUrl ?? originUrl}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`
  );
  return gitDir;
});

const makeLinkedWorktree = Effect.fn("identityRegistryTest.makeLinkedWorktree")(function* (
  clonePath: string,
  worktreePath: string,
  worktreeName: string
) {
  const pathApi = yield* Path.Path;
  const worktreeGitDir = pathApi.join(clonePath, ".git/worktrees", worktreeName);
  yield* writeText(pathApi.join(worktreePath, ".git"), `gitdir: ${worktreeGitDir}\n`);
  yield* writeText(pathApi.join(worktreeGitDir, "HEAD"), `${detachedSha}\n`);
  return worktreeGitDir;
});

// Records every `writeFileString` target so a test can assert on the temporary
// file names the upsert chooses, which are otherwise renamed away before it ends.
const recordingFileSystem = (writesRef: Ref.Ref<ReadonlyArray<string>>) =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.map(FileSystem.FileSystem, (fs) => ({
      ...fs,
      writeFileString: (path: string, data: string, options?: { readonly flag?: FileSystem.OpenFlag | undefined }) =>
        Ref.update(writesRef, (paths) => A.append(paths, path)).pipe(
          Effect.andThen(fs.writeFileString(path, data, options))
        ),
    }))
  ).pipe(Layer.provide(NodeServices.layer));

const upsertRoot = (dataRoot: string, rootPath: string, homeDir: string) =>
  upsertAiMetricsIdentityRegistry(
    AiMetricsIdentityRegistryUpsertInput.make({
      dataRoot,
      hashSalt,
      homeDir,
      rootPath,
      sourceKinds: [AiMetricsTranscriptSource.Enum.codex],
    })
  );

describe("@beep/repo-ai-metrics identity registry", () => {
  it.effect("derives a primary clone as its own canonical root", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        yield* makeClone(clonePath);

        const root = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: clonePath })
        );

        expect(root.kind).toBe(AiMetricsRootKind.Enum["primary-clone"]);
        expect(root.parentRootId).toBeUndefined();
        expect(root.excludedFromParentSnapshot).toBe(false);
        expect(root.revision).toBe(mainSha);
        expect(root.rootId).toBe(`root-${root.cloneIdHash}`);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("derives a linked worktree as an independent root excluded from its parent", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const worktreePath = pathApi.join(clonePath, ".claude/worktrees/wt1");
        yield* makeClone(clonePath);
        yield* makeLinkedWorktree(clonePath, worktreePath, "wt1");

        const clone = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: clonePath })
        );
        const worktree = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: worktreePath })
        );

        expect(worktree.kind).toBe(AiMetricsRootKind.Enum["linked-worktree"]);
        expect(worktree.excludedFromParentSnapshot).toBe(true);
        expect(worktree.parentRootId).toBe(clone.rootId);
        expect(worktree.revision).toBe(detachedSha);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("shares repository identity across a clone and its worktree while separating clone and worktree ids", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const worktreePath = pathApi.join(clonePath, ".claude/worktrees/wt1");
        yield* makeClone(clonePath);
        yield* makeLinkedWorktree(clonePath, worktreePath, "wt1");

        const clone = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: clonePath })
        );
        const worktree = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: worktreePath })
        );

        expect(worktree.repositoryIdHash).toBe(clone.repositoryIdHash);
        expect(worktree.cloneIdHash).not.toBe(clone.cloneIdHash);
        expect(worktree.worktreeIdHash).not.toBe(clone.worktreeIdHash);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("keys repository identity on the normalized origin url", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const first = pathApi.join(tmpDir, "first");
        const second = pathApi.join(tmpDir, "second");
        const other = pathApi.join(tmpDir, "other");
        yield* makeClone(first);
        yield* makeClone(second, { originUrl: "https://GitHub.com/beep-effect/beep-effect" });
        yield* makeClone(other, { originUrl: "git@github.com:beep-effect/other.git" });

        const firstRoot = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: first })
        );
        const secondRoot = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: second })
        );
        const otherRoot = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: other })
        );

        expect(secondRoot.repositoryIdHash).toBe(firstRoot.repositoryIdHash);
        expect(otherRoot.repositoryIdHash).not.toBe(firstRoot.repositoryIdHash);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("resolves the revision through loose refs, packed refs, and detached heads", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const gitDir = yield* makeClone(clonePath);

        const loose = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: clonePath })
        );
        expect(loose.revision).toBe(mainSha);

        yield* fs.remove(pathApi.join(gitDir, "refs/heads/main"));
        yield* writeText(
          pathApi.join(gitDir, "packed-refs"),
          `# pack-refs with: peeled fully-peeled sorted\n${packedSha} refs/heads/main\n`
        );
        const packed = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: clonePath })
        );
        expect(packed.revision).toBe(packedSha);

        yield* writeText(pathApi.join(gitDir, "HEAD"), `${detachedSha}\n`);
        const detached = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: clonePath })
        );
        expect(detached.revision).toBe(detachedSha);

        yield* fs.remove(pathApi.join(gitDir, "packed-refs"));
        yield* writeText(pathApi.join(gitDir, "HEAD"), "ref: refs/heads/missing\n");
        const unresolvable = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: clonePath })
        );
        expect(unresolvable.revision).toBeUndefined();
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("keeps cloneIdHash join-compatible with the forwarder's repoRootHash", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        yield* makeClone(clonePath);

        const root = yield* makeAiMetricsCanonicalRoot(
          AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: clonePath })
        );
        const repoRootHash = yield* hashPrivateIdentifier(pathApi.resolve(clonePath), hashSalt);

        expect(root.cloneIdHash).toBe(repoRootHash);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("preserves firstSeen across idempotent upserts and refreshes lastSeen", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const dataRoot = pathApi.join(tmpDir, "store");
        yield* makeClone(clonePath);

        const upsert = () =>
          upsertAiMetricsIdentityRegistry(
            AiMetricsIdentityRegistryUpsertInput.make({
              dataRoot,
              hashSalt,
              homeDir: pathApi.join(tmpDir, "home"),
              rootPath: clonePath,
              sourceKinds: [AiMetricsTranscriptSource.Enum.codex, AiMetricsTranscriptSource.Enum.claude],
            })
          );

        const first = yield* upsert();
        const second = yield* upsert();

        expect(A.length(second.roots)).toBe(1);
        expect(A.length(second.sourceInstances)).toBe(2);
        expect(second.roots[0]?.rootId).toBe(first.roots[0]?.rootId);
        expect(second.roots[0]?.firstSeenAtEpochMillis).toBe(first.roots[0]?.firstSeenAtEpochMillis);
        expect(second.roots[0]?.lastSeenAtEpochMillis).toBeGreaterThanOrEqual(
          first.roots[0]?.lastSeenAtEpochMillis ?? 0
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("migrates a populated legacy registry when stable identity proves namespace continuity", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const dataRoot = pathApi.join(tmpDir, "store");
        const homeDir = pathApi.join(tmpDir, "home");
        const registryPath = pathApi.join(dataRoot, "identity/registry.json");
        yield* makeClone(clonePath);

        const current = yield* upsertRoot(dataRoot, clonePath, homeDir);
        const legacy = AiMetricsIdentityRegistry.make({
          generatedAtEpochMillis: current.generatedAtEpochMillis,
          hashSaltStatus: current.hashSaltStatus,
          registryVersion: current.registryVersion,
          roots: current.roots,
          sourceInstances: current.sourceInstances,
        });
        yield* writeText(registryPath, yield* identityRegistryToJson(legacy));

        const migrated = yield* upsertRoot(dataRoot, clonePath, homeDir);

        expect(O.isSome(migrated.hashSaltNamespaceId)).toBe(true);
        expect(A.map(migrated.roots, (root) => root.rootId)).toEqual(A.map(current.roots, (root) => root.rootId));
        expect(A.map(migrated.sourceInstances, (instance) => instance.instanceIdHash)).toEqual(
          A.map(current.sourceInstances, (instance) => instance.instanceIdHash)
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("refuses a legacy registry when no stable identity proves namespace continuity", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const firstClonePath = pathApi.join(tmpDir, "first-clone");
        const secondClonePath = pathApi.join(tmpDir, "second-clone");
        const dataRoot = pathApi.join(tmpDir, "store");
        const registryPath = pathApi.join(dataRoot, "identity/registry.json");
        yield* makeClone(firstClonePath);
        yield* makeClone(secondClonePath, { originUrl: "git@github.com:beep-effect/other.git" });

        const current = yield* upsertRoot(dataRoot, firstClonePath, pathApi.join(tmpDir, "first-home"));
        const legacy = AiMetricsIdentityRegistry.make({
          generatedAtEpochMillis: current.generatedAtEpochMillis,
          hashSaltStatus: current.hashSaltStatus,
          registryVersion: current.registryVersion,
          roots: current.roots,
          sourceInstances: current.sourceInstances,
        });
        yield* writeText(registryPath, yield* identityRegistryToJson(legacy));

        const failure = yield* upsertRoot(dataRoot, secondClonePath, pathApi.join(tmpDir, "second-home")).pipe(
          Effect.flip
        );

        expect(failure._tag).toBe("AiMetricsIdentityRegistryError");
        expect(failure.message).toContain("hash-salt namespaces");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("refuses to merge a populated registry across hash-salt namespaces", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const dataRoot = pathApi.join(tmpDir, "store");
        yield* makeClone(clonePath);

        yield* upsertAiMetricsIdentityRegistry(
          AiMetricsIdentityRegistryUpsertInput.make({
            dataRoot,
            homeDir: pathApi.join(tmpDir, "home"),
            rootPath: clonePath,
            sourceKinds: [AiMetricsTranscriptSource.Enum.codex],
          })
        );
        const failure = yield* Effect.flip(
          upsertAiMetricsIdentityRegistry(
            AiMetricsIdentityRegistryUpsertInput.make({
              dataRoot,
              hashSalt,
              homeDir: pathApi.join(tmpDir, "home"),
              rootPath: clonePath,
              sourceKinds: [AiMetricsTranscriptSource.Enum.codex],
            })
          )
        );

        expect(failure._tag).toBe("AiMetricsIdentityRegistryError");
        expect(failure.message).toContain("hash-salt namespaces");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("refuses rotation between two provided hash salts", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const dataRoot = pathApi.join(tmpDir, "store");
        const homeDir = pathApi.join(tmpDir, "home");
        yield* makeClone(clonePath);

        const upsertWithSalt = (salt: string) =>
          upsertAiMetricsIdentityRegistry(
            AiMetricsIdentityRegistryUpsertInput.make({
              dataRoot,
              hashSalt: salt,
              homeDir,
              rootPath: clonePath,
              sourceKinds: [AiMetricsTranscriptSource.Enum.codex],
            })
          );

        yield* upsertWithSalt("provided-salt-a");
        const failure = yield* Effect.flip(upsertWithSalt("provided-salt-b"));

        expect(failure._tag).toBe("AiMetricsIdentityRegistryError");
        expect(failure.message).toContain("hash-salt namespaces");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("appends a second root without disturbing the first and keeps the arrays sorted", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const worktreePath = pathApi.join(clonePath, ".claude/worktrees/wt1");
        const dataRoot = pathApi.join(tmpDir, "store");
        yield* makeClone(clonePath);
        yield* makeLinkedWorktree(clonePath, worktreePath, "wt1");

        const first = yield* upsertAiMetricsIdentityRegistry(
          AiMetricsIdentityRegistryUpsertInput.make({
            dataRoot,
            hashSalt,
            homeDir: pathApi.join(tmpDir, "home"),
            rootPath: clonePath,
            sourceKinds: [AiMetricsTranscriptSource.Enum.codex],
          })
        );
        const second = yield* upsertAiMetricsIdentityRegistry(
          AiMetricsIdentityRegistryUpsertInput.make({
            dataRoot,
            hashSalt,
            homeDir: pathApi.join(tmpDir, "home"),
            rootPath: worktreePath,
            sourceKinds: [AiMetricsTranscriptSource.Enum.claude],
          })
        );

        expect(A.length(second.roots)).toBe(2);
        expect(A.map(second.roots, (root) => root.rootId)).toContain(first.roots[0]?.rootId);
        expect(A.map(second.roots, (root) => root.rootId)).toEqual(
          A.sort(
            A.map(second.roots, (root) => root.rootId),
            Order.String
          )
        );
        expect(A.map(second.sourceInstances, (instance) => instance.instanceIdHash)).toEqual(
          A.sort(
            A.map(second.sourceInstances, (instance) => instance.instanceIdHash),
            Order.String
          )
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("persists a round-trippable registry at identity/registry.json with no temporary file left behind", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const dataRoot = pathApi.join(tmpDir, "store");
        const homeDir = pathApi.join(tmpDir, "home");
        yield* makeClone(clonePath);

        const registry = yield* upsertAiMetricsIdentityRegistry(
          AiMetricsIdentityRegistryUpsertInput.make({
            dataRoot,
            hashSalt,
            homeDir,
            rootPath: clonePath,
            sourceKinds: [AiMetricsTranscriptSource.Enum.codex],
          })
        );

        const registryPath = pathApi.join(dataRoot, "identity/registry.json");
        expect(yield* fs.exists(registryPath)).toBe(true);
        expect(yield* fs.exists(`${registryPath}.tmp`)).toBe(false);

        const json = yield* identityRegistryToJson(registry);
        const decoded = yield* S.decodeEffect(S.fromJsonString(AiMetricsIdentityRegistry))(json);
        expect(decoded.registryVersion).toBe("ai-metrics-identity-registry/v1");
        expect(A.length(decoded.roots)).toBe(1);

        const reread = yield* readAiMetricsIdentityRegistry(dataRoot);
        expect(reread.roots[0]?.rootId).toBe(registry.roots[0]?.rootId);

        expect(json).not.toContain(tmpDir);
        expect(json).not.toContain(homeDir);
        expect(json).not.toContain("wt1");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("returns an empty registry when none has been persisted yet", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const registry = yield* readAiMetricsIdentityRegistry(pathApi.join(tmpDir, "store"));

        expect(A.length(registry.roots)).toBe(0);
        expect(A.length(registry.sourceInstances)).toBe(0);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // `makeAiMetricsSourceDiscoveryResult` resolves the home directory before hashing it, and the
  // two digests are joined across a discovery result and this registry. If only one side
  // normalized, an operator whose `HOME` carries a trailing slash would produce two different
  // digests for one home directory and the join would silently match nothing.
  it.effect("hashes the home directory as its resolved path so a trailing slash cannot fork the digest", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const homeDir = pathApi.join(tmpDir, "home");
        yield* makeClone(clonePath);

        // Separate data roots, so each registry holds exactly one instance and the comparison is
        // between the two digests rather than between two rows of one merged, hash-ordered array.
        const upsert = (store: string, home: string) =>
          upsertAiMetricsIdentityRegistry(
            AiMetricsIdentityRegistryUpsertInput.make({
              dataRoot: pathApi.join(tmpDir, store),
              hashSalt,
              homeDir: home,
              rootPath: clonePath,
              sourceKinds: [AiMetricsTranscriptSource.Enum.codex],
            })
          );

        const normalized = yield* upsert("store-normalized", homeDir);
        const trailingSlash = yield* upsert("store-trailing-slash", `${homeDir}/`);

        expect(A.length(normalized.sourceInstances)).toBe(1);
        expect(A.length(trailingSlash.sourceInstances)).toBe(1);
        expect(normalized.sourceInstances[0]?.homeDirHash).toBe(yield* hashPrivateIdentifier(homeDir, hashSalt));
        expect(trailingSlash.sourceInstances[0]?.homeDirHash).toBe(normalized.sourceInstances[0]?.homeDirHash);
        expect(trailingSlash.sourceInstances[0]?.instanceIdHash).toBe(normalized.sourceInstances[0]?.instanceIdHash);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // Only absence may read as "no registry". A registry that exists but cannot be read has to fail
  // the upsert, because succeeding with an empty registry would overwrite the real file and
  // discard every other canonical root together with its `firstSeen` history.
  it.effect("fails the upsert when an existing registry cannot be read instead of overwriting it", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const dataRoot = pathApi.join(tmpDir, "store");
        yield* makeClone(clonePath);

        // A directory where `registry.json` belongs: present, but unreadable as a file.
        yield* fs.makeDirectory(pathApi.join(dataRoot, "identity/registry.json"), { recursive: true });

        const failure = yield* Effect.flip(
          upsertAiMetricsIdentityRegistry(
            AiMetricsIdentityRegistryUpsertInput.make({
              dataRoot,
              hashSalt,
              homeDir: pathApi.join(tmpDir, "home"),
              rootPath: clonePath,
              sourceKinds: [AiMetricsTranscriptSource.Enum.codex],
            })
          )
        );

        expect(failure).toBeInstanceOf(AiMetricsIdentityRegistryError);
        expect(failure.message).toContain("Failed to read");
        // The unreadable entry is still there: nothing was clobbered on the way out.
        expect((yield* fs.stat(pathApi.join(dataRoot, "identity/registry.json"))).type).toBe("Directory");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // Greptile P1 on PR #614: two runs against one data root each read the pre-merge snapshot,
  // merge independently, and the later rename discards the earlier writer's roots entirely.
  // Several clones, or a forwarder timer firing while an operator runs the command by hand,
  // produce exactly this.
  it.live("keeps every concurrent writer's root instead of letting the last rename win", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const dataRoot = pathApi.join(tmpDir, "store");
        const homeDir = pathApi.join(tmpDir, "home");
        const clonePaths = A.map(A.range(1, 5), (index) => pathApi.join(tmpDir, `clone-${index}`));
        yield* Effect.forEach(clonePaths, (clonePath) => makeClone(clonePath), { discard: true });

        // Seed the first clone alone so it has a firstSeen predating the burst.
        const seeded = yield* upsertRoot(dataRoot, clonePaths[0] ?? "", homeDir);
        const seededRootId = seeded.roots[0]?.rootId;
        const seededFirstSeen = seeded.roots[0]?.firstSeenAtEpochMillis;

        yield* Effect.forEach(clonePaths, (clonePath) => upsertRoot(dataRoot, clonePath, homeDir), {
          concurrency: "unbounded",
        });

        const finalRegistry = yield* readAiMetricsIdentityRegistry(dataRoot);

        expect(A.length(finalRegistry.roots)).toBe(A.length(clonePaths));
        expect(A.length(finalRegistry.sourceInstances)).toBe(A.length(clonePaths));
        // firstSeen survives the concurrent merges rather than being reset by a racing writer.
        expect(
          pipe(
            finalRegistry.roots,
            A.findFirst((root) => root.rootId === seededRootId),
            O.map((root) => root.firstSeenAtEpochMillis),
            O.getOrElse(() => -1)
          )
        ).toBe(seededFirstSeen);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // A single fixed `registry.json.tmp` lets one writer promote another's half-written bytes or
  // lose the rename. The lock narrows the window but does not close it: an operator clearing a
  // stale lock by hand can leave two writers briefly overlapping.
  it.effect("writes through a temporary file unique to each writer", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const dataRoot = pathApi.join(tmpDir, "store");
        const homeDir = pathApi.join(tmpDir, "home");
        const writesRef = yield* Ref.make<ReadonlyArray<string>>(A.empty());
        const clonePaths = A.map(A.range(1, 3), (index) => pathApi.join(tmpDir, `clone-${index}`));
        yield* Effect.forEach(clonePaths, (clonePath) => makeClone(clonePath), { discard: true });

        yield* Effect.forEach(clonePaths, (clonePath) => upsertRoot(dataRoot, clonePath, homeDir), {
          discard: true,
        }).pipe(provideScopedLayer(recordingFileSystem(writesRef)));

        const tmpWrites = pipe(yield* Ref.get(writesRef), A.filter(Str.endsWith(".tmp")));

        expect(A.length(tmpWrites)).toBe(A.length(clonePaths));
        expect(A.length(A.dedupe(tmpWrites))).toBe(A.length(tmpWrites));
        expect(A.some(tmpWrites, (path) => Str.endsWith(path, "registry.json.tmp"))).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // A holder that died without releasing must not hang every later run. The wait is bounded and
  // then fails loudly: silently skipping the upsert would leave a store whose recorded
  // provenance does not match its data, which is the whole failure this registry exists to rule out.
  it.live("fails loudly rather than hanging when a stale lock is never released", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const pathApi = yield* Path.Path;
        const dataRoot = pathApi.join(tmpDir, "store");
        const clonePath = pathApi.join(tmpDir, "clone");
        yield* makeClone(clonePath);

        // A lock left behind by a holder that died mid-upsert.
        yield* writeText(pathApi.join(dataRoot, "identity/registry.lock"), "dead-holder\n");

        const failure = yield* Effect.flip(upsertRoot(dataRoot, clonePath, pathApi.join(tmpDir, "home")));

        expect(failure).toBeInstanceOf(AiMetricsIdentityRegistryError);
        expect(failure.message).toContain("Timed out waiting");
        // The upsert failed instead of quietly doing nothing, and wrote no registry.
        expect(yield* fs.exists(pathApi.join(dataRoot, "identity/registry.json"))).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("refuses a root that is not a git root", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const plainDir = pathApi.join(tmpDir, "plain");
        yield* writeText(pathApi.join(plainDir, "README.md"), "not a clone\n");

        const failure = yield* Effect.flip(
          makeAiMetricsCanonicalRoot(AiMetricsCanonicalRootInput.make({ hashSalt, rootPath: plainDir }))
        );

        expect(failure).toBeInstanceOf(AiMetricsIdentityRegistryError);
        expect(failure.message).toContain("not a git root");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("treats the scan root as its own root and every nested git root as somebody else's", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const worktreePath = pathApi.join(clonePath, ".claude/worktrees/wt1");
        const vendorPath = pathApi.join(clonePath, "vendor/sub");
        const plainPath = pathApi.join(clonePath, "packages/plain");
        yield* makeClone(clonePath);
        yield* makeLinkedWorktree(clonePath, worktreePath, "wt1");
        yield* makeClone(vendorPath);
        yield* writeText(pathApi.join(plainPath, "AGENTS.md"), "guidance\n");

        expect(yield* isNestedGitRoot({ dirPath: clonePath, scanRoot: clonePath })).toBe(false);
        expect(yield* isNestedGitRoot({ dirPath: worktreePath, scanRoot: clonePath })).toBe(true);
        expect(yield* isNestedGitRoot({ dirPath: vendorPath, scanRoot: clonePath })).toBe(true);
        expect(yield* isNestedGitRoot({ dirPath: plainPath, scanRoot: clonePath })).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("records one source instance per requested agent brand", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const clonePath = pathApi.join(tmpDir, "clone");
        const dataRoot = pathApi.join(tmpDir, "store");
        yield* makeClone(clonePath);

        const registry = yield* upsertAiMetricsIdentityRegistry(
          AiMetricsIdentityRegistryUpsertInput.make({
            dataRoot,
            hashSalt,
            homeDir: pathApi.join(tmpDir, "home"),
            rootPath: clonePath,
            sourceKinds: [AiMetricsTranscriptSource.Enum.codex, AiMetricsTranscriptSource.Enum.claude],
          })
        );

        const rootId = registry.roots[0]?.rootId;
        expect(O.isSome(A.findFirst(registry.sourceInstances, (instance) => instance.sourceKind === "codex"))).toBe(
          true
        );
        expect(O.isSome(A.findFirst(registry.sourceInstances, (instance) => instance.sourceKind === "claude"))).toBe(
          true
        );
        expect(A.every(registry.sourceInstances, (instance) => instance.rootId === rootId)).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
