/**
 * Read-only services for skill provenance reports and the skills-lock migration plan.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { asArrayBufferView } from "../../internal/cli/Bytes.ts";
import { canonicalJsonText } from "../Goals/PacketCore/PacketDigest.ts";
import { readSkillsLockText, SKILLS_LOCK_PATH } from "./internal/LockFile.ts";
import { PATCH_ROOT } from "./internal/PatchStaging.ts";
import {
  computeSkillTree,
  hashBytes,
  installedTargetsHash,
  patchSetHashOf,
  readLocalSkillFiles,
  validateRelativePath,
} from "./internal/SkillTree.ts";
import {
  SkillInstallStateError,
  SkillsCommandError,
  SkillUpstreamContentError,
  SkillUpstreamContentErrorReason,
} from "./Skills.errors.ts";
import { renderUnifiedHunks, SkillPatchOwnerSource, SkillPatchOwnerSourceLive } from "./Skills.patches.ts";
import {
  decodeSkillLockV2Entry,
  SkillGitRevision,
  SkillLicense,
  SkillPatch,
  SkillPathHistory,
  SkillProvenanceReport,
  SkillProvenanceResolution,
  SkillTreeMode,
  SkillUpstream,
  SkillUpstreamContent,
  SkillUpstreamContentFile,
} from "./Skills.schemas.ts";
import { skillResolutionSeeds } from "./Skills.seeds.ts";
import {
  decodeSkillsLockDocumentJson,
  KeepSeedPin,
  LocalMigrationRow,
  LocalSkillLockEntry,
  MatchesNoExaminedRevisionDrift,
  MatchesUpstreamRevisionDrift,
  PristineAtRevisionPin,
  SkillMigrationRow,
  SkillPatchFile,
  SkillPathHistoryWindow,
  SkillsLockMigrationArtifacts,
  SkillsLockMigrationPlan,
  UnresolvedMigrationRow,
  VendoredMigrationRow,
  VendoredSkillLockEntry,
} from "./SkillsLock.schemas.ts";
import type { Sha256Hex } from "@beep/schema";
import type * as Crypto from "effect/Crypto";
import type { ComputedSkillTree, HashedSkillFile } from "./internal/SkillTree.ts";
import type { SkillDriftRow, SkillPinProposal, SkillsLockDocument } from "./SkillsLock.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/Skills.service");

const CLAUDE_SKILLS_DIR = ".claude/skills";
const textDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const textEncoder = new TextEncoder();
const decodeSkillTreeMode = S.decodeUnknownEffect(SkillTreeMode);

const GitHubTreeEntryType = LiteralKit(["blob", "tree", "commit"]);
const GitHubTreeMode = LiteralKit(["100644", "100755", "120000", "040000", "160000"]);

class GitHubTreeEntry extends S.Opaque<GitHubTreeEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    mode: GitHubTreeMode,
    type: GitHubTreeEntryType,
    sha: S.String,
  }).pipe(
    $I.annoteSchema("GitHubTreeEntry", {
      description: "Mode-aware entry returned by the GitHub recursive tree API.",
    })
  )
) {}

class GitHubTree extends S.Opaque<GitHubTree, { readonly brand: unique symbol }>()(
  S.Struct({
    tree: S.Array(GitHubTreeEntry),
    truncated: S.Boolean,
  }).pipe(
    $I.annoteSchema("GitHubTree", {
      description: "GitHub recursive tree response used by the pinned upstream content source.",
    })
  )
) {}

const decodeGitHubTree = S.decodeUnknownEffect(S.fromJsonString(S.suspend(() => GitHubTree)));

const findFile = (files: ReadonlyArray<HashedSkillFile>, filePath: string): O.Option<HashedSkillFile> =>
  A.findFirst(files, (file) => Str.Equivalence(file.path, filePath));

const filesMatch = (upstream: HashedSkillFile, local: HashedSkillFile): boolean =>
  Str.Equivalence(upstream.mode, local.mode) && Str.Equivalence(upstream.sha256, local.sha256);

const decodeTextFile = Effect.fn("SkillsProvenance.decodeTextFile")(function* (
  file: HashedSkillFile,
  skill: string
): Effect.fn.Return<string, SkillsCommandError> {
  return yield* Effect.try({
    try: () => textDecoder.decode(asArrayBufferView(file.bytes)),
    catch: (cause) =>
      SkillsCommandError.new(
        cause,
        `Cannot represent binary local drift as the pilot's plain Git patch: ${file.path}`,
        file.path,
        skill
      ),
  });
});

const patchHeader = (filePath: string): string => `diff --git a/${filePath} b/${filePath}`;

const abbreviatedSha = Str.slice(0, 12);

const MAX_PATCH_LINES = 100_000;

const countPatchLines = (content: string): number => {
  if (Str.isEmpty(content)) {
    return 0;
  }
  let lines = 1;
  for (const character of content) {
    if (character === "\n") {
      lines++;
    }
    if (lines > MAX_PATCH_LINES) {
      break;
    }
  }
  return lines;
};

const ensurePatchLineBudget = (skill: string, filePath: string, before: string, after: string) =>
  countPatchLines(before) + countPatchLines(after) > MAX_PATCH_LINES
    ? Effect.fail(
        SkillsCommandError.make({
          message: `Skill patch exceeds the ${MAX_PATCH_LINES} line review limit`,
          skill,
          file: filePath,
        })
      )
    : Effect.void;

const renderAddedFilePatch = Effect.fn("SkillsProvenance.renderAddedFilePatch")(function* (
  skill: string,
  filePath: string,
  local: HashedSkillFile
): Effect.fn.Return<string, SkillsCommandError> {
  const after = yield* decodeTextFile(local, skill);
  yield* ensurePatchLineBudget(skill, filePath, "", after);
  const headerLines = [
    patchHeader(filePath),
    `new file mode ${local.mode}`,
    `index 000000000000..${abbreviatedSha(local.sha256)}`,
  ];
  // A zero-byte add carries no hunk at all in `git diff`; emitting `@@ -0,0 +0,0 @@`
  // with no lines under it would be a patch no applier accepts.
  const bodyLines = Str.isEmpty(after)
    ? A.empty<string>()
    : ["--- /dev/null", `+++ b/${filePath}`, ...renderUnifiedHunks("", after)];
  return A.join(A.append(A.appendAll(headerLines, bodyLines), ""), "\n");
});

const renderDeletedFilePatch = Effect.fn("SkillsProvenance.renderDeletedFilePatch")(function* (
  skill: string,
  filePath: string,
  upstream: HashedSkillFile
): Effect.fn.Return<string, SkillsCommandError> {
  const before = yield* decodeTextFile(upstream, skill);
  yield* ensurePatchLineBudget(skill, filePath, before, "");
  const headerLines = [
    patchHeader(filePath),
    `deleted file mode ${upstream.mode}`,
    `index ${abbreviatedSha(upstream.sha256)}..000000000000`,
  ];
  // Deleting a zero-byte upstream file is header-only for the same reason an empty add is.
  const bodyLines = Str.isEmpty(before)
    ? A.empty<string>()
    : [`--- a/${filePath}`, "+++ /dev/null", ...renderUnifiedHunks(before, "")];
  return A.join(A.append(A.appendAll(headerLines, bodyLines), ""), "\n");
});

const renderModifiedFilePatch = Effect.fn("SkillsProvenance.renderModifiedFilePatch")(function* (
  skill: string,
  filePath: string,
  upstream: HashedSkillFile,
  local: HashedSkillFile
): Effect.fn.Return<string, SkillsCommandError> {
  const sameMode = Str.Equivalence(upstream.mode, local.mode);
  const modeLines = sameMode ? A.empty<string>() : [`old mode ${upstream.mode}`, `new mode ${local.mode}`];
  if (Str.Equivalence(upstream.sha256, local.sha256)) {
    return A.join([patchHeader(filePath), ...modeLines, ""], "\n");
  }
  const before = yield* decodeTextFile(upstream, skill);
  const after = yield* decodeTextFile(local, skill);
  yield* ensurePatchLineBudget(skill, filePath, before, after);
  return A.join(
    [
      patchHeader(filePath),
      ...modeLines,
      `index ${abbreviatedSha(upstream.sha256)}..${abbreviatedSha(local.sha256)}${sameMode ? ` ${local.mode}` : ""}`,
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      ...renderUnifiedHunks(before, after),
      "",
    ],
    "\n"
  );
});

const renderFilePatch = Effect.fn("SkillsProvenance.renderFilePatch")(function* (
  skill: string,
  filePath: string,
  upstream: O.Option<HashedSkillFile>,
  local: O.Option<HashedSkillFile>
): Effect.fn.Return<string, SkillsCommandError> {
  if (O.isNone(upstream)) {
    return O.isNone(local) ? "" : yield* renderAddedFilePatch(skill, filePath, local.value);
  }
  if (O.isNone(local)) {
    return yield* renderDeletedFilePatch(skill, filePath, upstream.value);
  }
  return yield* renderModifiedFilePatch(skill, filePath, upstream.value, local.value);
});

/**
 * Renders the unified diff that turns one skill tree into another, one Git file section per changed path.
 *
 * **Details**
 *
 * Paths are visited in sorted order; a path whose bytes and mode are equal on
 * both sides is skipped. Each changed path renders exactly as a generated
 * patch would (new file, deleted file, mode change, or modified file with
 * three lines of context), so the update train's upstream-vs-effective diff
 * reads like the patch series it summarizes. Binary content fails typed.
 *
 * **Example** (Diff a one-line change)
 *
 * ```ts
 * import { SkillUpstreamContentFile } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { renderSkillTreeDiff } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import { NodeCrypto } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 *
 * const encoder = new TextEncoder()
 * const file = (text: string) => SkillUpstreamContentFile.make({ path: "SKILL.md", mode: "100644", bytes: encoder.encode(text) })
 * const diff = Effect.runSync(
 *   renderSkillTreeDiff("demo", [file("a\n")], [file("b\n")]).pipe(Effect.provide(NodeCrypto.layer))
 * )
 * console.log(diff.startsWith("diff --git a/SKILL.md b/SKILL.md")) // true
 * ```
 *
 * @param skill - The skill name, used in error messages.
 * @param before - The tree the diff starts from, such as the pristine upstream tree.
 * @param after - The tree the diff ends at, such as the replayed effective tree.
 * @returns The concatenated file sections; empty when the trees are equal.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillTreeDiff = Effect.fn("SkillsProvenance.renderSkillTreeDiff")(function* (
  skill: string,
  before: ReadonlyArray<SkillUpstreamContentFile>,
  after: ReadonlyArray<SkillUpstreamContentFile>
): Effect.fn.Return<string, SkillsCommandError, Crypto.Crypto> {
  const left = yield* computeSkillTree(before, `${skill}:diff-before`);
  const right = yield* computeSkillTree(after, `${skill}:diff-after`);
  const paths = A.dedupe(
    A.sort(
      A.map(A.appendAll(left.files, right.files), (file) => file.path),
      Str.Order
    )
  );
  const changed = A.filter(paths, (filePath) => {
    const leftFile = findFile(left.files, filePath);
    const rightFile = findFile(right.files, filePath);
    return !(O.isSome(leftFile) && O.isSome(rightFile) && filesMatch(leftFile.value, rightFile.value));
  });
  const sections = yield* Effect.forEach(changed, (filePath) =>
    renderFilePatch(skill, filePath, findFile(left.files, filePath), findFile(right.files, filePath))
  );
  return A.join(sections, "");
});

const PATCH_DROP_CONDITION = "Drop when upstream contains an equivalent change.";

const patchSlug = flow(Str.toLowerCase, Str.replace(/[^a-z0-9]+/gu, "-"), Str.replace(/^-+|-+$/gu, ""));

// A lock key becomes a directory name under `.agents/skill-patches/`, so it must be one
// plain path segment; a hand-edited key such as `../outside` is refused, never resolved.
const SAFE_SKILL_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const requireSafeSkillKey = (skill: string): Effect.Effect<string, SkillsCommandError> =>
  SAFE_SKILL_KEY_PATTERN.test(skill)
    ? Effect.succeed(skill)
    : Effect.fail(
        SkillsCommandError.make({
          message: `Skill key "${skill}" is not a single safe path segment; refusing to place its patches.`,
          skill,
        })
      );

// `.agents/skill-patches/<skill>/NNNN-<slug>.patch`, numbered in drift-path order.
const patchFilePath = (skill: string, index: number, filePath: string): string =>
  `${PATCH_ROOT}/${skill}/${Str.padStart(4, "0")(`${index + 1}`)}-${patchSlug(filePath)}.patch`;

type BuiltPatch = { readonly patch: SkillPatch; readonly file: SkillPatchFile };

type PatchSeries = {
  readonly series: ReadonlyArray<SkillPatch>;
  readonly patchSetHash: Sha256Hex;
  readonly files: ReadonlyArray<SkillPatchFile>;
};

// One patch per drifted file, owned by the CODEOWNERS owner of the installed file (B9).
const buildPatch = Effect.fn("SkillsProvenance.buildPatch")(function* (
  skill: string,
  repoRoot: string,
  upstream: ComputedSkillTree,
  local: ComputedSkillTree,
  filePath: string,
  index: number
): Effect.fn.Return<BuiltPatch, SkillsCommandError, SkillPatchOwnerSource | Crypto.Crypto> {
  yield* requireSafeSkillKey(skill);
  const owners = yield* SkillPatchOwnerSource;
  const text = yield* renderFilePatch(
    skill,
    filePath,
    findFile(upstream.files, filePath),
    findFile(local.files, filePath)
  );
  const bytes = textEncoder.encode(text);
  const path = patchFilePath(skill, index, filePath);
  const patch = SkillPatch.make({
    path,
    sha256: yield* hashBytes(bytes, path),
    label: "temporary-drift",
    owner: yield* owners.ownerOf(repoRoot, `${CLAUDE_SKILLS_DIR}/${skill}/${filePath}`),
    dropCondition: PATCH_DROP_CONDITION,
  });
  return { patch, file: SkillPatchFile.make({ path, bytes }) };
});

// The set hash frames every patch as path, byte length, and bytes, in series order; an empty
// series hashes the empty byte string.
const buildPatchSeries = Effect.fn("SkillsProvenance.buildPatchSeries")(function* (
  skill: string,
  repoRoot: string,
  upstream: ComputedSkillTree,
  local: ComputedSkillTree,
  driftPaths: ReadonlyArray<string>
): Effect.fn.Return<PatchSeries, SkillsCommandError, SkillPatchOwnerSource | Crypto.Crypto> {
  const built = yield* Effect.forEach(driftPaths, (filePath, index) =>
    buildPatch(skill, repoRoot, upstream, local, filePath, index)
  );
  const files = A.map(built, ({ file }) => file);
  return {
    series: A.map(built, ({ patch }) => patch),
    patchSetHash: yield* patchSetHashOf(files, skill),
    files,
  };
});

const GITHUB_API_ORIGIN = "https://api.github.com/";

/**
 * The most commits one path-history listing returns (GitHub's REST page maximum).
 */
const MAX_PATH_HISTORY_REVISIONS = 100;

// The bearer token only travels to the REST API; raw content needs none for public repositories.
const githubRequest = (url: string, token: O.Option<Redacted.Redacted<string>>): HttpClientRequest.HttpClientRequest =>
  O.match(
    O.filter(token, () => Str.startsWith(GITHUB_API_ORIGIN)(url)),
    {
      onNone: () => HttpClientRequest.get(url),
      onSome: (value) => HttpClientRequest.get(url).pipe(HttpClientRequest.bearerToken(value)),
    }
  );

const fetchResponse = Effect.fn("SkillUpstreamContentSource.fetchResponse")(function* (
  url: string,
  skill: string,
  token: O.Option<Redacted.Redacted<string>>
): Effect.fn.Return<
  { readonly bytes: Uint8Array; readonly hasNextPage: boolean },
  SkillsCommandError,
  HttpClient.HttpClient
> {
  const response = yield* HttpClient.execute(githubRequest(url, token)).pipe(
    SkillsCommandError.mapError(`Failed to fetch pinned upstream content from ${url}.`, url, skill),
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    SkillsCommandError.mapError(`Pinned upstream content returned a non-2xx response from ${url}.`, url, skill)
  );
  const buffer = yield* response.arrayBuffer.pipe(
    SkillsCommandError.mapError(`Failed to read pinned upstream response from ${url}.`, url, skill)
  );
  const hasNextPage = O.exists(Headers.get(response.headers, "link"), Str.includes('rel="next"'));
  return { bytes: new Uint8Array(buffer), hasNextPage };
});

const fetchResponseBytes = Effect.fn("SkillUpstreamContentSource.fetchResponseBytes")(function* (
  url: string,
  skill: string,
  token: O.Option<Redacted.Redacted<string>>
): Effect.fn.Return<Uint8Array, SkillsCommandError, HttpClient.HttpClient> {
  return (yield* fetchResponse(url, skill, token)).bytes;
});

// Historical trees share most blobs, so blob bytes are fetched once per Git object id.
const fetchBlobBytes = Effect.fn("SkillUpstreamContentSource.fetchBlobBytes")(function* (
  blobCache: MutableHashMap.MutableHashMap<string, Uint8Array>,
  blobSha: string,
  url: string,
  skill: string,
  token: O.Option<Redacted.Redacted<string>>
): Effect.fn.Return<Uint8Array, SkillsCommandError, HttpClient.HttpClient> {
  const cached = MutableHashMap.get(blobCache, blobSha);
  if (O.isSome(cached)) {
    return cached.value;
  }
  const bytes = yield* fetchResponseBytes(url, skill, token);
  MutableHashMap.set(blobCache, blobSha, bytes);
  return bytes;
});

const GitHubCommitListJson = S.Struct({ sha: SkillGitRevision }).pipe(S.Array, S.fromJsonString);

const listGitHubPathHistory = Effect.fn("SkillUpstreamContentSource.listGitHubPathHistory")(function* (
  resolution: SkillProvenanceResolution,
  token: O.Option<Redacted.Redacted<string>>
): Effect.fn.Return<SkillPathHistory, SkillsCommandError | SkillUpstreamContentError, HttpClient.HttpClient> {
  const upstream = resolution.upstream;
  const url = `${GITHUB_API_ORIGIN}repos/${upstream.repository}/commits?sha=${encodeURIComponent(
    upstream.trackingRef
  )}&path=${encodeURIComponent(upstream.treePath)}&per_page=${MAX_PATH_HISTORY_REVISIONS}`;
  const response = yield* fetchResponse(url, resolution.name, token);
  const commits = yield* S.decodeEffect(GitHubCommitListJson)(new TextDecoder().decode(response.bytes)).pipe(
    SkillsCommandError.mapError(
      `Failed to decode the ${upstream.treePath} path history of ${upstream.repository}.`,
      url,
      resolution.name
    )
  );
  const revisions = A.map(A.take(commits, MAX_PATH_HISTORY_REVISIONS), (commit) => commit.sha);
  if (!A.isReadonlyArrayNonEmpty(revisions)) {
    return yield* SkillUpstreamContentError.make({
      skill: resolution.name,
      reason: "path-absent",
      message: `No commit touches ${upstream.repository}:${upstream.treePath} at ${upstream.trackingRef}.`,
    });
  }
  return SkillPathHistory.make({
    revisions,
    truncated: response.hasNextPage || A.length(commits) > MAX_PATH_HISTORY_REVISIONS,
  });
});

const loadGitHubContent = Effect.fn("SkillUpstreamContentSource.loadGitHubContent")(function* (
  resolution: SkillProvenanceResolution,
  blobCache: MutableHashMap.MutableHashMap<string, Uint8Array>,
  token: O.Option<Redacted.Redacted<string>>
): Effect.fn.Return<SkillUpstreamContent, SkillsCommandError | SkillUpstreamContentError, HttpClient.HttpClient> {
  const upstream = resolution.upstream;
  const treeUrl = `${GITHUB_API_ORIGIN}repos/${upstream.repository}/git/trees/${upstream.sourceRevision}?recursive=1`;
  const treeBytes = yield* fetchResponseBytes(treeUrl, resolution.name, token);
  const tree = yield* decodeGitHubTree(new TextDecoder().decode(treeBytes)).pipe(
    SkillsCommandError.mapError(
      `Failed to decode pinned upstream tree for ${resolution.name}.`,
      treeUrl,
      resolution.name
    )
  );
  if (tree.truncated) {
    return yield* SkillsCommandError.make({
      message: `Pinned upstream tree response for ${resolution.name} was truncated.`,
      file: treeUrl,
      skill: resolution.name,
    });
  }

  const prefix = `${upstream.treePath}/`;
  const entries = A.sortWith(
    A.filter(tree.tree, (entry) => Str.Equivalence(entry.type, "blob") && Str.startsWith(prefix)(entry.path)),
    (entry: GitHubTreeEntry) => entry.path,
    Str.Order
  );
  if (A.isReadonlyArrayEmpty(entries)) {
    return yield* SkillUpstreamContentError.make({
      skill: resolution.name,
      reason: "path-absent",
      message: `No files found at ${upstream.repository}:${upstream.treePath}@${upstream.sourceRevision}.`,
    });
  }

  const rawUrl = (filePath: string): string =>
    `https://raw.githubusercontent.com/${upstream.repository}/${upstream.sourceRevision}/${filePath}`;
  const files = yield* Effect.forEach(
    entries,
    Effect.fnUntraced(function* (entry) {
      const relativePath = yield* validateRelativePath(Str.slice(prefix.length)(entry.path), resolution.name);
      const mode = yield* decodeSkillTreeMode(entry.mode).pipe(
        SkillsCommandError.mapError(
          `Unsupported Git mode ${entry.mode} for pinned skill file ${entry.path}.`,
          entry.path,
          resolution.name
        )
      );
      return SkillUpstreamContentFile.make({
        path: relativePath,
        mode,
        bytes: yield* fetchBlobBytes(blobCache, entry.sha, rawUrl(entry.path), resolution.name, token),
      });
    }),
    { concurrency: 6 }
  );
  const licenseBytes = yield* O.match(
    A.findFirst(tree.tree, (entry) => Str.Equivalence(entry.path, resolution.license.path)),
    {
      onNone: () => fetchResponseBytes(rawUrl(resolution.license.path), resolution.name, token),
      onSome: (entry) => fetchBlobBytes(blobCache, entry.sha, rawUrl(entry.path), resolution.name, token),
    }
  );
  return SkillUpstreamContent.make({ files, licenseBytes });
});

/**
 * Binary-safe source contract for immutable upstream skill and license bytes.
 *
 * **Details**
 *
 * `load` must resolve content strictly from
 * `resolution.upstream.sourceRevision`; consulting a floating ref would make
 * the resulting hashes unreproducible. Bytes are returned rather than text so
 * hashing sees exactly what upstream stores. `listPathHistory` is the one
 * floating read: it names the immutable revisions a caller then loads.
 * A `path-absent` error from either method proves the skill path absent; every
 * other failure is `unavailable`.
 *
 * @see {@link SkillUpstreamContentSource} for the injectable service built on this contract.
 * @category services
 * @since 0.0.0
 */
export interface SkillUpstreamContentSourceShape {
  /**
   * List the commits touching `resolution.upstream.treePath` at its tracking ref,
   * newest first, at most one REST page; a longer history is flagged `truncated`.
   */
  readonly listPathHistory: (
    resolution: SkillProvenanceResolution
  ) => Effect.Effect<SkillPathHistory, SkillUpstreamContentError>;
  /** Load a complete tree and license at `resolution.upstream.sourceRevision`, never at a floating ref. */
  readonly load: (
    resolution: SkillProvenanceResolution
  ) => Effect.Effect<SkillUpstreamContent, SkillUpstreamContentError>;
}

/**
 * Injectable upstream-content source used by the provenance resolver.
 *
 * **When to use**
 *
 * Use when a test or offline run must supply pinned bytes without reaching
 * GitHub; this tag is the single network seam of the provenance pilot.
 *
 * **Example** (Resolve against a stubbed offline source)
 *
 * ```ts
 * import { SkillPathHistory, SkillProvenanceResolution, SkillUpstreamContent } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { SkillUpstreamContentSource } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * import * as S from "effect/Schema"
 *
 * const revision = "91f21dfe1328585670275781b4525fff2507f917"
 * const resolution = S.decodeUnknownSync(SkillProvenanceResolution)({
 *   name: "shadcn",
 *   sourceType: "github",
 *   upstream: {
 *     repository: "shadcn-ui/ui",
 *     repositoryUrl: "https://github.com/shadcn-ui/ui",
 *     treePath: "skills/shadcn",
 *     entryPath: "skills/shadcn/SKILL.md",
 *     trackingRef: "main",
 *     sourceRevision: revision,
 *     observedHeadRevision: revision,
 *     observedPathRevision: revision,
 *   },
 *   license: {
 *     spdxId: "MIT",
 *     path: "LICENSE.md",
 *     sha256: "1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f",
 *   },
 *   provenanceStatus: "exact",
 *   provenanceConfidence: "high",
 *   provenanceEvidence: ["exact-tree"],
 * })
 *
 * const offline = Layer.succeed(
 *   SkillUpstreamContentSource,
 *   SkillUpstreamContentSource.of({
 *     load: () =>
 *       Effect.succeed(SkillUpstreamContent.make({ files: [], licenseBytes: new Uint8Array() })),
 *     listPathHistory: () =>
 *       Effect.orDie(S.decodeEffect(SkillPathHistory)({ revisions: [revision], truncated: false })),
 *   })
 * )
 *
 * const fileCount = Effect.gen(function* () {
 *   const source = yield* SkillUpstreamContentSource
 *   const content = yield* source.load(resolution)
 *   return content.files.length
 * })
 *
 * console.log(Effect.runSync(Effect.provide(fileCount, offline))) // 0
 * ```
 *
 * @see {@link SkillUpstreamContentSourceLive} for the pinned GitHub implementation.
 * @category services
 * @since 0.0.0
 */
export class SkillUpstreamContentSource extends Context.Service<
  SkillUpstreamContentSource,
  SkillUpstreamContentSourceShape
>()($I`SkillUpstreamContentSource`) {}

// Every SkillsCommandError behind the live source is upstream unavailability (fetch,
// status, decode, truncated tree), so it is typed as such; a proven-absent path is
// already a `path-absent` SkillUpstreamContentError.
const asUpstreamError =
  (skill: string) =>
  (error: SkillsCommandError): SkillUpstreamContentError =>
    SkillUpstreamContentError.make({ skill, reason: "unavailable", message: error.message, cause: error });

const makeSkillUpstreamContentSource = Effect.gen(function* () {
  const httpContext = yield* Effect.context<HttpClient.HttpClient>();
  const token = yield* Config.Redacted("GITHUB_TOKEN").pipe(
    Config.option,
    Effect.orDie,
    Effect.map(O.filter(flow(Redacted.value, Str.isNonEmpty)))
  );
  const blobCache = MutableHashMap.empty<string, Uint8Array>();
  return SkillUpstreamContentSource.of({
    load: Effect.fn("SkillUpstreamContentSource.load")((resolution) =>
      loadGitHubContent(resolution, blobCache, token).pipe(
        Effect.provide(httpContext),
        Effect.catchTag("SkillsCommandError", flow(asUpstreamError(resolution.name), Effect.fail))
      )
    ),
    listPathHistory: Effect.fn("SkillUpstreamContentSource.listPathHistory")((resolution) =>
      listGitHubPathHistory(resolution, token).pipe(
        Effect.provide(httpContext),
        Effect.catchTag("SkillsCommandError", flow(asUpstreamError(resolution.name), Effect.fail))
      )
    ),
  });
}).pipe(Effect.withSpan("SkillUpstreamContentSource.make"));

/**
 * Live GitHub implementation of the immutable upstream-content source.
 *
 * **Details**
 *
 * The layer stays open on `HttpClient.HttpClient` so the caller decides how
 * requests are made. Every content fetch targets the requested
 * `sourceRevision`, and a truncated GitHub tree response is rejected rather
 * than hashed, because a partial tree would silently produce a wrong snapshot
 * digest. Blob bytes are cached per Git object id for the layer's lifetime,
 * so a path-history walk refetches only the blobs that changed.
 *
 * **Gotchas**
 *
 * A non-empty `GITHUB_TOKEN` is sent as a bearer token to the REST API only.
 * Without one, GitHub allows 60 unauthenticated REST requests an hour, and a
 * path-history walk spends one per examined revision.
 *
 * **Example** (Close the layer over a fetch-based HTTP client)
 *
 * ```ts
 * import { SkillUpstreamContentSourceLive } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Layer from "effect/Layer";
 * import * as FetchHttpClient from "effect/http/FetchHttpClient";
 * const ready = SkillUpstreamContentSourceLive.pipe(Layer.provide(FetchHttpClient.layer))
 *
 * console.log(Layer.isLayer(ready)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillUpstreamContentSourceLive = Layer.effect(SkillUpstreamContentSource, makeSkillUpstreamContentSource);

const V1LockSkills = S.fromJsonString(
  S.Struct({
    version: S.Literal(1),
    skills: S.Record(S.String, S.Struct({ sourceType: S.String })),
  })
);

/** What a plan or a provenance lookup needs from `skills-lock.json`, v1 or v2. */
type SkillsLockReading = {
  readonly sha256: Sha256Hex;
  readonly skills: ReadonlyArray<readonly [string, string]>;
  readonly vendored: HashMap.HashMap<string, SkillProvenanceResolution>;
};

/**
 * The provenance resolution a vendored lock entry records, pinned at its `upstream.sourceRevision`.
 *
 * **Details**
 *
 * After the v2 flip the lock is the ratified resolution record (contract 2):
 * a vendored entry's upstream, license, and provenance blocks are exactly a
 * resolution pinned at its revision, which is what
 * {@link SkillUpstreamContentSource} loads.
 *
 * **Example** (Inspect the pinned revision of a lock entry)
 *
 * ```ts
 * import { decodeSkillsLockDocumentJson } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { skillResolutionOfEntry } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Effect from "effect/Effect"
 * import * as R from "effect/Record"
 *
 * const lock = Effect.runSync(decodeSkillsLockDocumentJson(`{"version": 2, "skills": {}}`))
 * const resolutions = R.collect(lock.skills, (name, entry) =>
 *   entry._tag === "vendored" ? skillResolutionOfEntry(name, entry).upstream.sourceRevision : name
 * )
 * console.log(resolutions.length) // 0
 * ```
 *
 * @param name - The lock key of the entry.
 * @param entry - The vendored lock entry.
 * @returns The resolution pinned at the entry's source revision.
 * @category constructors
 * @since 0.0.0
 */
export const skillResolutionOfEntry: {
  (entry: VendoredSkillLockEntry): (name: string) => SkillProvenanceResolution;
  (name: string, entry: VendoredSkillLockEntry): SkillProvenanceResolution;
} = dual(
  2,
  (name: string, entry: VendoredSkillLockEntry): SkillProvenanceResolution =>
    SkillProvenanceResolution.make({
      name,
      sourceType: entry.sourceType,
      upstream: entry.upstream,
      license: entry.license,
      provenanceStatus: entry.provenance.status,
      provenanceConfidence: entry.provenance.confidence,
      provenanceEvidence: entry.provenance.evidence,
    })
);

const readingOfV2 = (sha256: Sha256Hex, document: SkillsLockDocument): SkillsLockReading => {
  const entries = R.toEntries(document.skills);
  return {
    sha256,
    skills: A.map(entries, ([name, entry]) => [name, entry._tag === "vendored" ? "github" : "local"] as const),
    vendored: HashMap.fromIterable(
      A.flatMap(entries, ([name, entry]) =>
        entry._tag === "vendored" ? [[name, skillResolutionOfEntry(name, entry)] as const] : []
      )
    ),
  };
};

const readSkillsLock = Effect.fn("SkillsLock.readSkillsLock")(function* (
  repoRoot: string
): Effect.fn.Return<SkillsLockReading, SkillsCommandError, FileSystem.FileSystem | Path.Path | Crypto.Crypto> {
  const { lockPath, text } = yield* readSkillsLockText(repoRoot);
  const sha256 = yield* hashBytes(textEncoder.encode(text), SKILLS_LOCK_PATH);
  const v2 = yield* Effect.option(decodeSkillsLockDocumentJson(text));
  if (O.isSome(v2)) {
    return readingOfV2(sha256, v2.value);
  }
  const v1 = yield* S.decodeEffect(V1LockSkills)(text).pipe(
    SkillsCommandError.mapError(
      `${SKILLS_LOCK_PATH} is neither a skills-lock/v1 nor a skills-lock/v2 document.`,
      lockPath
    )
  );
  return {
    sha256,
    skills: A.map(R.toEntries(v1.skills), ([name, entry]) => [name, entry.sourceType] as const),
    vendored: HashMap.empty(),
  };
});

// Ratified seeds cover skills not yet vendored; a vendored lock entry overrides its seed.
const ratifiedResolutions = Effect.fn("SkillsLock.ratifiedResolutions")(function* (
  vendored: HashMap.HashMap<string, SkillProvenanceResolution>
): Effect.fn.Return<HashMap.HashMap<string, SkillProvenanceResolution>, SkillsCommandError> {
  const seeds = yield* skillResolutionSeeds.pipe(
    SkillsCommandError.mapError("Invalid ratified provenance resolution seed table.")
  );
  return A.reduce(seeds, vendored, (resolutions, seed) =>
    HashMap.has(resolutions, seed.name) ? resolutions : HashMap.set(resolutions, seed.name, seed)
  );
});

const lockedResolutions = Effect.fn("SkillsProvenance.lockedResolutions")(function* (
  repoRoot: string
): Effect.fn.Return<
  HashMap.HashMap<string, SkillProvenanceResolution>,
  SkillsCommandError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lockPath = path.join(repoRoot, SKILLS_LOCK_PATH);
  const exists = yield* fs
    .exists(lockPath)
    .pipe(SkillsCommandError.mapError(`Failed to inspect ${SKILLS_LOCK_PATH}.`, lockPath));
  const vendored = exists
    ? (yield* readSkillsLock(repoRoot)).vendored
    : HashMap.empty<string, SkillProvenanceResolution>();
  return yield* ratifiedResolutions(vendored);
});

const resolveResolution = Effect.fn("SkillsProvenance.resolveResolution")(function* (
  skill: string,
  repoRoot: string
): Effect.fn.Return<SkillProvenanceResolution, SkillsCommandError, FileSystem.FileSystem | Path.Path | Crypto.Crypto> {
  const resolutions = yield* lockedResolutions(repoRoot);
  return yield* resolutions.pipe(
    HashMap.get(skill),
    Effect.fromOption,
    Effect.mapError(() =>
      SkillsCommandError.make({
        message: `No ratified provenance resolution for "${skill}". Resolved skills: ${resolutions.pipe(
          HashMap.keys,
          A.fromIterable,
          A.sort(Str.Order),
          A.join(", ")
        )}.`,
        skill,
      })
    )
  );
});

const readInstalledTargets = Effect.fn("SkillsProvenance.readInstalledTargets")(function* (
  repoRoot: string,
  skill: string
): Effect.fn.Return<
  {
    readonly localTree: ComputedSkillTree;
    readonly installedTargets: ReadonlyArray<string>;
    readonly installedTreeHash: Sha256Hex;
  },
  SkillsCommandError | SkillInstallStateError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const claudeTarget = `${CLAUDE_SKILLS_DIR}/${skill}`;
  const agentsTarget = `.agents/skills/${skill}`;
  for (const target of [claudeTarget, agentsTarget]) {
    const exists = yield* fs
      .exists(path.join(repoRoot, target))
      .pipe(SkillsCommandError.mapError(`Failed to inspect installed skill target ${target}.`, target, skill));
    if (!exists) {
      return yield* SkillInstallStateError.make({
        skill,
        reason: "missing-target",
        message: `Installed skill "${skill}" is missing its ${target} target.`,
      });
    }
  }
  const localFiles = yield* readLocalSkillFiles(path.join(repoRoot, claudeTarget), skill);
  const localTree = yield* computeSkillTree(localFiles, `${skill}:installed`);
  const agentsFiles = yield* readLocalSkillFiles(path.join(repoRoot, agentsTarget), skill);
  const agentsTree = yield* computeSkillTree(agentsFiles, `${skill}:agents-installed`);
  if (!Str.Equivalence(localTree.treeHash, agentsTree.treeHash)) {
    return yield* SkillInstallStateError.make({
      skill,
      reason: "divergent-targets",
      message: `Installed skill targets disagree for ${skill}; refusing to report cross-target provenance.`,
    });
  }
  const installedTreeHash = yield* installedTargetsHash(
    [
      [claudeTarget, localTree.treeHash],
      [agentsTarget, agentsTree.treeHash],
    ],
    skill
  );
  return { localTree, installedTargets: [claudeTarget, agentsTarget], installedTreeHash };
});

// For callers that need the install, not a per-skill report: a missing or divergent install fails.
const requireInstalledTargets = (repoRoot: string, skill: string) =>
  readInstalledTargets(repoRoot, skill).pipe(
    Effect.catchTag("SkillInstallStateError", (error) =>
      Effect.fail(SkillsCommandError.make({ message: error.message, skill }))
    )
  );

type ProvenanceRequirements =
  | SkillUpstreamContentSource
  | SkillPatchOwnerSource
  | FileSystem.FileSystem
  | Path.Path
  | Crypto.Crypto;

type ComputedProvenance = {
  readonly report: SkillProvenanceReport;
  readonly patchFiles: ReadonlyArray<SkillPatchFile>;
};

const verifiedLicenseHash = Effect.fn("SkillsProvenance.verifiedLicenseHash")(function* (
  resolution: SkillProvenanceResolution,
  licenseBytes: Uint8Array
): Effect.fn.Return<Sha256Hex, SkillsCommandError, Crypto.Crypto> {
  const skill = resolution.name;
  const actual = yield* hashBytes(licenseBytes, `${skill}:${resolution.license.path}`);
  if (!Str.Equivalence(actual, resolution.license.sha256)) {
    return yield* SkillsCommandError.make({
      message: `Pinned license hash mismatch for ${skill} at ${resolution.upstream.sourceRevision}; refusing to report provenance.`,
      file: resolution.license.path,
      skill,
    });
  }
  return actual;
});

const differsFromUpstream =
  (upstreamTree: ComputedSkillTree, localTree: ComputedSkillTree) =>
  (filePath: string): boolean => {
    const upstream = findFile(upstreamTree.files, filePath);
    const local = findFile(localTree.files, filePath);
    return O.isNone(upstream) || O.isNone(local) || !filesMatch(upstream.value, local.value);
  };

const driftPathsOf = (upstreamTree: ComputedSkillTree, localTree: ComputedSkillTree): ReadonlyArray<string> =>
  A.filter(
    A.sort(
      A.union(
        A.map(upstreamTree.files, (file) => file.path),
        A.map(localTree.files, (file) => file.path)
      ),
      Str.Order
    ),
    differsFromUpstream(upstreamTree, localTree)
  );

/**
 * Generates the patches that turn one tree into another, one per changed
 * file, numbered from `firstIndex` (zero-based) in sorted path order.
 *
 * **Details**
 *
 * Each patch is rendered exactly as the lock migration renders a generated
 * patch (`.agents/skill-patches/<skill>/NNNN-<slug>.patch`), labelled
 * `temporary-drift` until a review classifies it (B8), owned by the
 * CODEOWNERS owner of the installed file (B9), and carrying the default drop
 * condition. `skills patch add` uses it to append patches for a hand edit
 * after the existing series. Binary content fails typed.
 *
 * **Example** (Inspect the requirements before providing them)
 *
 * ```ts
 * import { buildSkillPatchAdditions } from "@beep/repo-cli/commands/Skills/Skills.service"
 *
 * console.log(typeof buildSkillPatchAdditions) // "function"
 * ```
 *
 * @param skill - The skill's lock key; must be one safe path segment.
 * @param repoRoot - Absolute repository root, used to resolve owners.
 * @param before - The tree the patches apply to, such as the recorded effective tree.
 * @param after - The tree the patches produce, such as the hand-edited install.
 * @param firstIndex - Zero-based series index of the first new patch.
 * @returns Each new patch's lock row paired with its bytes, in series order.
 * @category constructors
 * @since 0.0.0
 */
export const buildSkillPatchAdditions = Effect.fn("SkillsProvenance.buildSkillPatchAdditions")(function* (
  skill: string,
  repoRoot: string,
  before: ComputedSkillTree,
  after: ComputedSkillTree,
  firstIndex: number
): Effect.fn.Return<
  ReadonlyArray<readonly [SkillPatch, SkillPatchFile]>,
  SkillsCommandError,
  SkillPatchOwnerSource | Crypto.Crypto
> {
  return yield* Effect.forEach(driftPathsOf(before, after), (filePath, index) =>
    Effect.map(
      buildPatch(skill, repoRoot, before, after, filePath, firstIndex + index),
      ({ patch, file }) => [patch, file] as const
    )
  );
});

// Hashes the tree and license at `resolution.upstream.sourceRevision`, both installed targets,
// and the patch series of every drifted file, and returns the patch bytes beside the report.
const computeProvenance = Effect.fn("SkillsProvenance.computeProvenance")(function* (
  resolution: SkillProvenanceResolution,
  repoRoot: string
): Effect.fn.Return<ComputedProvenance, SkillsCommandError | SkillUpstreamContentError, ProvenanceRequirements> {
  const skill = resolution.name;
  const source = yield* SkillUpstreamContentSource;
  const upstreamContent = yield* source.load(resolution);
  const licenseHash = yield* verifiedLicenseHash(resolution, upstreamContent.licenseBytes);
  const upstreamTree = yield* computeSkillTree(upstreamContent.files, `${skill}:upstream`);
  const { localTree, installedTargets, installedTreeHash } = yield* requireInstalledTargets(repoRoot, skill);
  const driftPaths = driftPathsOf(upstreamTree, localTree);
  const matchedFileCount = A.filter(upstreamTree.files, (upstream) =>
    O.exists(findFile(localTree.files, upstream.path), (local) => filesMatch(upstream, local))
  ).length;
  const patches = yield* buildPatchSeries(skill, repoRoot, upstreamTree, localTree, driftPaths);
  const entry = yield* decodeSkillLockV2Entry({
    sourceType: resolution.sourceType,
    upstream: resolution.upstream,
    snapshot: {
      algorithm: "sha256",
      treeHash: upstreamTree.treeHash,
      fileCount: upstreamTree.files.length,
      manifestHash: upstreamTree.manifestHash,
      manifest: upstreamTree.manifest,
    },
    license: SkillLicense.make({
      spdxId: resolution.license.spdxId,
      path: resolution.license.path,
      sha256: licenseHash,
    }),
    provenance: {
      status: resolution.provenanceStatus,
      confidence: resolution.provenanceConfidence,
      matchedFileCount,
      upstreamFileCount: upstreamTree.files.length,
      evidence: resolution.provenanceEvidence,
    },
    patches: {
      required: A.isReadonlyArrayNonEmpty(patches.series),
      patchSetHash: patches.patchSetHash,
      series: patches.series,
    },
    effective: {
      treeHash: localTree.treeHash,
      installedTargets,
      installedTreeHash,
    },
  }).pipe(
    SkillsCommandError.mapError(`Failed to encode the computed v2 provenance entry for ${skill}.`, undefined, skill)
  );
  return { report: SkillProvenanceReport.make({ skill, entry, driftPaths }), patchFiles: patches.files };
});

/**
 * Computes the would-be `skills-lock/v2` entry for one installed, resolved skill.
 *
 * **Details**
 *
 * The resolution comes from `skills-lock.json` when the skill is a `vendored`
 * entry there (contract 2), and from the ratified seed table otherwise.
 * Nothing is written: the pinned upstream tree, both installed targets, and
 * the patch series (one patch per drifted file, owned through
 * {@link SkillPatchOwnerSource}) are hashed in memory and reported. The run
 * refuses when the refetched license digest disagrees with the recorded one,
 * or when the two installed targets have diverged, because either condition
 * would make the resulting entry a claim nobody checked.
 *
 * **Gotchas**
 *
 * The skill must already be installed under `.claude/skills` and
 * `.agents/skills`; the resolver reads those trees rather than creating them.
 *
 * **Example** (Inspect the requirements before providing them)
 *
 * ```ts
 * import { SkillsCommandError, SkillUpstreamContentError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 * import type { SkillPatchOwnerSource } from "@beep/repo-cli/commands/Skills/Skills.patches"
 * import type { SkillProvenanceReport } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { resolveSkillProvenance, SkillUpstreamContentSource } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Crypto from "effect/Crypto";
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 * import * as Path from "effect/Path";
 * const resolved: Effect.Effect<
 *   SkillProvenanceReport,
 *   SkillsCommandError | SkillUpstreamContentError,
 *   SkillUpstreamContentSource | SkillPatchOwnerSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto
 * > = resolveSkillProvenance("shadcn", "/workspace/beep-effect")
 *
 * console.log(Effect.isEffect(resolved)) // true
 * ```
 *
 * @see {@link runSkillProvenance} for the service-mediated form used by the command.
 * @category services
 * @since 0.0.0
 */
export const resolveSkillProvenance = Effect.fn("SkillsProvenance.resolveSkillProvenance")(function* (
  skill: string,
  repoRoot: string
): Effect.fn.Return<SkillProvenanceReport, SkillsCommandError | SkillUpstreamContentError, ProvenanceRequirements> {
  const resolution = yield* resolveResolution(skill, repoRoot);
  return (yield* computeProvenance(resolution, repoRoot)).report;
});

/**
 * Computes the `local` lock entry of one installed skill.
 *
 * **Details**
 *
 * Both installed targets (`.claude/skills/<skill>` and
 * `.agents/skills/<skill>`) must exist and carry the same mode-aware tree;
 * the entry records the targets and their combined installed-tree hash, the
 * same hashing rule a vendored entry's `effective.installedTreeHash` uses.
 *
 * **Example** (Inspect the requirements before providing them)
 *
 * ```ts
 * import { computeLocalSkillLockEntry } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(computeLocalSkillLockEntry("/workspace/beep-effect", "yeet"))) // true
 * ```
 *
 * @param repoRoot - Absolute repository root holding the installed targets.
 * @param skill - Directory name of the skill under `.claude/skills` and `.agents/skills`.
 * @returns Both installed target paths and the mode-aware tree hash they share.
 * @category queries
 * @since 0.0.0
 */
export const computeLocalSkillLockEntry = Effect.fn("SkillsLock.computeLocalSkillLockEntry")(function* (
  repoRoot: string,
  skill: string
): Effect.fn.Return<LocalSkillLockEntry, SkillsCommandError, FileSystem.FileSystem | Path.Path | Crypto.Crypto> {
  const installed = yield* requireInstalledTargets(repoRoot, skill);
  return LocalSkillLockEntry.make({
    installedTargets: installed.installedTargets,
    installedTreeHash: installed.installedTreeHash,
  });
});

/**
 * Service contract for read-only skill provenance resolution.
 *
 * **Details**
 *
 * `resolve` carries no residual requirements: the implementation closes over
 * the filesystem, path, crypto, and content-source services it needs, so
 * callers of the port never learn how provenance is fetched.
 *
 * @see {@link SkillProvenanceService} for the injectable service built on this contract.
 * @category services
 * @since 0.0.0
 */
export interface SkillProvenanceServiceShape {
  /** Compute the would-be lock entry for one installed, seeded skill. */
  readonly resolve: (skill: string, repoRoot: string) => Effect.Effect<SkillProvenanceReport, SkillsCommandError>;
}

/**
 * Injectable read-only provenance service consumed by the Skills command family.
 *
 * **When to use**
 *
 * Use when a caller needs a provenance report without depending on how it is
 * produced, or when a test needs to substitute the whole resolution step.
 *
 * **Example** (Substitute a resolver that rejects unknown skills)
 *
 * ```ts
 * import { SkillsCommandError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 * import { SkillProvenanceService } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Effect from "effect/Effect";
 * import * as Exit from "effect/Exit";
 * import * as Layer from "effect/Layer";
 * const unavailable = Layer.succeed(
 *   SkillProvenanceService,
 *   SkillProvenanceService.of({
 *     resolve: (skill) =>
 *       Effect.fail(SkillsCommandError.make({ message: `No provenance pilot for ${skill}.`, skill })),
 *   })
 * )
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* SkillProvenanceService
 *   return yield* service.resolve("mystery-skill", "/workspace/beep-effect")
 * })
 *
 * console.log(Exit.isFailure(Effect.runSyncExit(Effect.provide(program, unavailable)))) // true
 * ```
 *
 * @see {@link SkillProvenanceServiceLive} for the pinned GitHub-backed implementation.
 * @category services
 * @since 0.0.0
 */
export class SkillProvenanceService extends Context.Service<SkillProvenanceService, SkillProvenanceServiceShape>()(
  $I`SkillProvenanceService`
) {}

const makeSkillProvenanceService = Effect.gen(function* () {
  const runtimeContext = yield* Effect.context<ProvenanceRequirements>();
  return SkillProvenanceService.of({
    resolve: Effect.fn("SkillProvenanceService.resolve")((skill, repoRoot) =>
      resolveSkillProvenance(skill, repoRoot).pipe(
        Effect.provide(runtimeContext),
        Effect.catchTag("SkillUpstreamContentError", (error) =>
          Effect.fail(SkillsCommandError.make({ message: error.message, skill: error.skill }))
        )
      )
    ),
  });
}).pipe(Effect.withSpan("SkillProvenanceService.make"));

/**
 * Resolver layer that remains parameterized by an upstream-content source.
 *
 * **When to use**
 *
 * Use when the resolver should run against something other than pinned GitHub
 * content, such as a fixture tree in a test; reach for
 * {@link SkillProvenanceServiceLive} when the real upstream is wanted.
 *
 * **Details**
 *
 * The content source and the patch-owner source are left open here.
 * Filesystem, path, and crypto services are still required by the composed
 * layer.
 *
 * **Example** (Build an offline resolver)
 *
 * ```ts
 * import { SkillPatchOwnerSource, skillPatchOwnerSourceFromCodeowners } from "@beep/repo-cli/commands/Skills/Skills.patches"
 * import { SkillPathHistory, SkillUpstreamContent } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { SkillProvenanceServiceLayer, SkillUpstreamContentSource } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * import * as S from "effect/Schema";
 * const offline = Layer.succeed(
 *   SkillUpstreamContentSource,
 *   SkillUpstreamContentSource.of({
 *     load: () =>
 *       Effect.succeed(SkillUpstreamContent.make({ files: [], licenseBytes: new Uint8Array() })),
 *     listPathHistory: () =>
 *       Effect.orDie(
 *         S.decodeEffect(SkillPathHistory)({
 *           revisions: ["0123456789abcdef0123456789abcdef01234567"],
 *           truncated: false,
 *         })
 *       ),
 *   })
 * )
 *
 * const offlineResolver = SkillProvenanceServiceLayer.pipe(
 *   Layer.provide(offline),
 *   Layer.provide(Layer.succeed(SkillPatchOwnerSource, skillPatchOwnerSourceFromCodeowners("* @kriegcloud\n")))
 * )
 *
 * console.log(Layer.isLayer(offlineResolver)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillProvenanceServiceLayer = Layer.effect(SkillProvenanceService, makeSkillProvenanceService);

/**
 * Live read-only provenance resolver backed by pinned GitHub content.
 *
 * **Details**
 *
 * The upstream-content source and the merge-base CODEOWNERS owner source are
 * already supplied, so the remaining requirements are an HTTP client, a
 * child-process spawner, and the platform filesystem, path, and crypto
 * services.
 *
 * **Example** (Supply the HTTP client the live source needs)
 *
 * ```ts
 * import { SkillProvenanceServiceLive } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Layer from "effect/Layer";
 * import * as FetchHttpClient from "effect/http/FetchHttpClient";
 * const withHttp = SkillProvenanceServiceLive.pipe(Layer.provide(FetchHttpClient.layer))
 *
 * console.log(Layer.isLayer(withHttp)) // true
 * ```
 *
 * @see {@link SkillProvenanceServiceLayer} for the form that leaves the content source open.
 * @category layers
 * @since 0.0.0
 */
export const SkillProvenanceServiceLive = SkillProvenanceServiceLayer.pipe(
  Layer.provide(Layer.mergeAll(SkillUpstreamContentSourceLive, SkillPatchOwnerSourceLive))
);

/**
 * Resolves one provenance report through the service contract.
 *
 * **When to use**
 *
 * Use when a command handler should depend on {@link SkillProvenanceService}
 * alone rather than on the filesystem, crypto, and content-source services
 * that {@link resolveSkillProvenance} exposes.
 *
 * **Example** (Run against a substituted resolver)
 *
 * ```ts
 * import { SkillsCommandError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 * import { runSkillProvenance, SkillProvenanceService } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Effect from "effect/Effect";
 * import * as Exit from "effect/Exit";
 * import * as Layer from "effect/Layer";
 * const unavailable = Layer.succeed(
 *   SkillProvenanceService,
 *   SkillProvenanceService.of({
 *     resolve: (skill) =>
 *       Effect.fail(SkillsCommandError.make({ message: `Unsupported pilot skill ${skill}.`, skill })),
 *   })
 * )
 *
 * const exit = Effect.runSyncExit(
 *   Effect.provide(runSkillProvenance("mystery-skill", "/workspace/beep-effect"), unavailable)
 * )
 *
 * console.log(Exit.isFailure(exit)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const runSkillProvenance = Effect.fn("Skills.runSkillProvenance")(function* (
  skill: string,
  repoRoot: string
): Effect.fn.Return<SkillProvenanceReport, SkillsCommandError, SkillProvenanceService> {
  const service = yield* SkillProvenanceService;
  return yield* service.resolve(skill, repoRoot);
});

const atRevision = (resolution: SkillProvenanceResolution, revision: SkillGitRevision): SkillProvenanceResolution =>
  SkillProvenanceResolution.make({
    ...resolution,
    upstream: SkillUpstream.make({ ...resolution.upstream, sourceRevision: revision }),
  });

const sameInstalledFile = (installed: O.Option<HashedSkillFile>, upstream: O.Option<HashedSkillFile>): boolean =>
  O.match(installed, {
    onNone: () => O.isNone(upstream),
    onSome: (file) => O.exists(upstream, (upstreamFile) => filesMatch(upstreamFile, file)),
  });

// A revision where the skill path does not exist is an empty tree, not a failure:
// the path history includes the commit that deleted or moved the path.
const loadTreeAtRevision = Effect.fn("SkillsLock.loadTreeAtRevision")(function* (
  resolution: SkillProvenanceResolution,
  revision: SkillGitRevision
): Effect.fn.Return<
  ComputedSkillTree,
  SkillsCommandError | SkillUpstreamContentError,
  SkillUpstreamContentSource | Crypto.Crypto
> {
  const source = yield* SkillUpstreamContentSource;
  const files = yield* source.load(atRevision(resolution, revision)).pipe(
    Effect.map((content) => content.files),
    Effect.catchTag("SkillUpstreamContentError", (error) =>
      SkillUpstreamContentErrorReason.is["path-absent"](error.reason)
        ? Effect.succeed(A.empty<SkillUpstreamContentFile>())
        : Effect.fail(error)
    )
  );
  return yield* computeSkillTree(files, `${resolution.name}:${revision}`);
});

const driftRows = (
  driftPaths: ReadonlyArray<string>,
  matches: HashMap.HashMap<string, SkillGitRevision>
): ReadonlyArray<SkillDriftRow> =>
  A.map(driftPaths, (path) =>
    O.match(HashMap.get(matches, path), {
      onNone: () => MatchesNoExaminedRevisionDrift.make({ path }),
      onSome: (revision) => MatchesUpstreamRevisionDrift.make({ path, revision }),
    })
  );

// Records `revision` for every drifted path that has no newer match yet and whose
// file at this revision equals the installed one.
const recordRevisionMatches = (
  matches: HashMap.HashMap<string, SkillGitRevision>,
  driftPaths: ReadonlyArray<string>,
  revision: SkillGitRevision,
  matchesInstalled: (filePath: string) => boolean
): HashMap.HashMap<string, SkillGitRevision> =>
  A.reduce(driftPaths, matches, (acc, filePath) =>
    !HashMap.has(acc, filePath) && matchesInstalled(filePath) ? HashMap.set(acc, filePath, revision) : acc
  );

// Walks the path history newest to oldest. The first revision whose whole mode-aware
// tree hash equals the installed tree's is the proposed pin and ends the walk. Until
// then each drifted path remembers the newest revision whose bytes and mode equal the
// installed file. With no drift against the baseline pin, the baseline is already pristine.
const classifyAgainstPathHistory = Effect.fn("SkillsLock.classifyAgainstPathHistory")(function* (
  seed: SkillProvenanceResolution,
  localTree: ComputedSkillTree,
  driftPaths: ReadonlyArray<string>,
  history: SkillPathHistory
): Effect.fn.Return<
  { readonly pin: SkillPinProposal; readonly drift: ReadonlyArray<SkillDriftRow> },
  SkillsCommandError | SkillUpstreamContentError,
  SkillUpstreamContentSource | Crypto.Crypto
> {
  if (A.isReadonlyArrayEmpty(driftPaths)) {
    return { pin: PristineAtRevisionPin.make({ revision: seed.upstream.sourceRevision }), drift: A.empty() };
  }
  let matches = HashMap.empty<string, SkillGitRevision>();
  for (const revision of history.revisions) {
    const tree = yield* loadTreeAtRevision(seed, revision);
    const pristine = Str.Equivalence(tree.treeHash, localTree.treeHash);
    matches = recordRevisionMatches(
      matches,
      driftPaths,
      revision,
      (filePath) => pristine || sameInstalledFile(findFile(localTree.files, filePath), findFile(tree.files, filePath))
    );
    if (pristine) {
      return { pin: PristineAtRevisionPin.make({ revision }), drift: driftRows(driftPaths, matches) };
    }
  }
  return { pin: KeepSeedPin.make({ revision: seed.upstream.sourceRevision }), drift: driftRows(driftPaths, matches) };
});

const installedSkillName = Effect.fn("SkillsLock.installedSkillName")(function* (skillsDir: string, entry: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const skillDir = path.join(skillsDir, entry);
  const stat = yield* Effect.option(fs.stat(skillDir));
  const hasSkillFile = yield* fs.exists(path.join(skillDir, "SKILL.md")).pipe(Effect.orElseSucceed(() => false));
  return O.exists(stat, (info) => info.type === "Directory") && hasSkillFile ? A.of(entry) : A.empty<string>();
});

/**
 * Lists the installed skills: directories under `.claude/skills` holding a `SKILL.md`.
 *
 * **Details**
 *
 * Sorted by name. A missing `.claude/skills` directory lists nothing, and a
 * directory without `SKILL.md` (such as a shared-assets folder) is not a skill.
 *
 * **Example** (Inspect the requirements before providing them)
 *
 * ```ts
 * import { listInstalledSkillNames } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(listInstalledSkillNames("/workspace/beep-effect"))) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @returns The installed skill names, sorted.
 * @category queries
 * @since 0.0.0
 */
export const listInstalledSkillNames = Effect.fn("SkillsLock.listInstalledSkillNames")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const skillsDir = path.join(repoRoot, CLAUDE_SKILLS_DIR);
  const exists = yield* fs
    .exists(skillsDir)
    .pipe(SkillsCommandError.mapError(`Failed to check whether ${skillsDir} exists.`, skillsDir));
  if (!exists) {
    return A.empty<string>();
  }
  const entries = yield* fs
    .readDirectory(skillsDir)
    .pipe(SkillsCommandError.mapError(`Failed to read ${skillsDir}.`, skillsDir));
  const names = yield* Effect.forEach(A.sort(entries, Str.Order), (entry) => installedSkillName(skillsDir, entry));
  return A.flatten(names);
});

// Every lock entry plus every installed skill the lock does not name yet (a repo-authored
// skill added without a lock update); the unlisted ones plan as `local`.
const plannedSkills = Effect.fn("SkillsLock.plannedSkills")(function* (
  repoRoot: string,
  lock: SkillsLockReading
): Effect.fn.Return<ReadonlyArray<readonly [string, string]>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const installed = yield* listInstalledSkillNames(repoRoot);
  const locked = HashSet.fromIterable(A.map(lock.skills, ([name]) => name));
  const unlisted = A.flatMap(installed, (name) =>
    HashSet.has(locked, name) ? A.empty<readonly [string, string]>() : A.of([name, "local"] as const)
  );
  const skills: ReadonlyArray<readonly [string, string]> = A.appendAll(lock.skills, unlisted);
  return A.sortWith(skills, (entry) => entry[0], Str.Order);
});

/** One planned skill: its row and the patch bytes its vendored entry names. */
type PlannedSkill = { readonly row: SkillMigrationRow; readonly patchFiles: ReadonlyArray<SkillPatchFile> };

const plannedRow = (row: SkillMigrationRow): PlannedSkill => ({ row, patchFiles: A.empty() });

const provenanceUnavailable = (skill: string, message: string, entry: LocalSkillLockEntry): PlannedSkill =>
  plannedRow(
    UnresolvedMigrationRow.make({
      skill,
      cause: "provenance-unavailable",
      note: `provenance-unavailable: ${message}`,
      entry,
    })
  );

// A provenance refusal (license digest mismatch, unsafe upstream path, unencodable entry,
// no patch owner) belongs to this skill: it becomes a Result so the plan keeps going.
const attemptProvenance = (resolution: SkillProvenanceResolution, repoRoot: string) =>
  computeProvenance(resolution, repoRoot).pipe(
    Effect.map(Result.succeed),
    Effect.catchTag("SkillsCommandError", flow(Result.fail, Effect.succeed))
  );

// The entry a write puts in the lock is the one at the proposed pin: a pristine pin away from
// the baseline is recomputed there (snapshot, license re-check, provenance, patch series).
const provenanceAtPin = Effect.fn("SkillsLock.provenanceAtPin")(function* (
  baseline: SkillProvenanceResolution,
  pin: SkillPinProposal,
  atBaseline: ComputedProvenance,
  repoRoot: string
): Effect.fn.Return<
  Result.Result<ComputedProvenance, SkillsCommandError>,
  SkillUpstreamContentError,
  ProvenanceRequirements
> {
  if (Str.Equivalence(pin.revision, baseline.upstream.sourceRevision)) {
    return Result.succeed(atBaseline);
  }
  return yield* attemptProvenance(atRevision(baseline, pin.revision), repoRoot);
});

const vendoredRow = Effect.fn("SkillsLock.vendoredRow")(function* (
  repoRoot: string,
  skill: string,
  baseline: SkillProvenanceResolution,
  localTree: ComputedSkillTree,
  localEntry: LocalSkillLockEntry
): Effect.fn.Return<PlannedSkill, SkillsCommandError | SkillUpstreamContentError, ProvenanceRequirements> {
  const atBaseline = yield* attemptProvenance(baseline, repoRoot);
  if (Result.isFailure(atBaseline)) {
    return provenanceUnavailable(skill, atBaseline.failure.message, localEntry);
  }
  const source = yield* SkillUpstreamContentSource;
  const history = yield* source.listPathHistory(baseline);
  const { pin, drift } = yield* classifyAgainstPathHistory(
    baseline,
    localTree,
    atBaseline.success.report.driftPaths,
    history
  );
  const atPin = yield* provenanceAtPin(baseline, pin, atBaseline.success, repoRoot);
  if (Result.isFailure(atPin)) {
    return provenanceUnavailable(skill, `at proposed pin ${pin.revision}: ${atPin.failure.message}`, localEntry);
  }
  const row = VendoredMigrationRow.make({
    skill,
    entry: VendoredSkillLockEntry.make({ ...atPin.success.report.entry }),
    pin,
    drift,
    pathHistory: SkillPathHistoryWindow.make({
      trackingRef: baseline.upstream.trackingRef,
      head: A.headNonEmpty(history.revisions),
      revisionCount: A.length(history.revisions),
      truncated: history.truncated,
    }),
  });
  return { row, patchFiles: atPin.success.patchFiles };
});

const migrateSkill = Effect.fn("SkillsLock.migrateSkill")(function* (
  repoRoot: string,
  skill: string,
  v1SourceType: string,
  resolutions: HashMap.HashMap<string, SkillProvenanceResolution>
): Effect.fn.Return<PlannedSkill, SkillsCommandError, ProvenanceRequirements> {
  // A missing or divergent install is this skill's problem, not the plan's: report it
  // as an unresolved row and keep planning the rest. Other I/O failures stay fatal.
  const installed = yield* readInstalledTargets(repoRoot, skill).pipe(
    Effect.map(Result.succeed),
    Effect.catchTag("SkillInstallStateError", flow(Result.fail, Effect.succeed))
  );
  if (Result.isFailure(installed)) {
    const { reason, message } = installed.failure;
    return plannedRow(UnresolvedMigrationRow.make({ skill, cause: "install-state", note: `${reason}: ${message}` }));
  }
  const entry = LocalSkillLockEntry.make({
    installedTargets: installed.success.installedTargets,
    installedTreeHash: installed.success.installedTreeHash,
  });
  const resolution = HashMap.get(resolutions, skill);
  if (O.isSome(resolution)) {
    // An upstream that cannot be read at the pin or along its path history (moved
    // tree path, truncated tree, network) is likewise reported for this skill only.
    return yield* vendoredRow(repoRoot, skill, resolution.value, installed.success.localTree, entry).pipe(
      Effect.catchTag("SkillUpstreamContentError", (error) =>
        Effect.succeed(
          plannedRow(
            UnresolvedMigrationRow.make({
              skill,
              cause: "upstream-unavailable",
              note: `upstream-unavailable: ${error.message}`,
              entry,
            })
          )
        )
      )
    );
  }
  return plannedRow(
    Str.Equivalence(v1SourceType, "github")
      ? UnresolvedMigrationRow.make({
          skill,
          cause: "no-ratified-seed",
          entry,
          note: "v1 github entry without a ratified resolution seed; stays local until one is ratified",
        })
      : LocalMigrationRow.make({ skill, entry })
  );
});

const PLAN_SCHEMA_VERSION = "skills-lock-migration-plan/v3";
const encodeMigrationRows = S.encodeEffect(S.Array(SkillMigrationRow));

// The digest preimage is the compact canonical JSON of the encoded schema version, the read
// lock's digest, and the rows, so it covers every vendored row's path-history head, its entry
// at the proposed pin, and the lock bytes the plan started from.
const sealSkillsLockMigrationPlan = Effect.fn("SkillsLock.sealSkillsLockMigrationPlan")(function* (
  lockSha256: Sha256Hex,
  rows: ReadonlyArray<SkillMigrationRow>
): Effect.fn.Return<SkillsLockMigrationPlan, SkillsCommandError, Crypto.Crypto> {
  const encodedRows = yield* encodeMigrationRows(rows).pipe(
    SkillsCommandError.mapError("Failed to encode the skills lock migration plan rows.")
  );
  const preimage = canonicalJsonText({ schemaVersion: PLAN_SCHEMA_VERSION, lockSha256, rows: encodedRows });
  const planDigest = yield* hashBytes(textEncoder.encode(preimage), "skills-lock-migration-plan");
  return SkillsLockMigrationPlan.make({ planDigest, lockSha256, rows });
});

/**
 * Computes the sealed migration plan together with the patch bytes it names.
 *
 * **Details**
 *
 * The same computation as {@link planSkillsLockMigration}; the write path uses
 * this form so the pristine snapshots are fetched once and the patch files it
 * publishes are exactly the bytes the plan's SHA-256 values cover.
 *
 * **Example** (Inspect the requirements before providing them)
 *
 * ```ts
 * import { compileSkillsLockMigration } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(compileSkillsLockMigration("/workspace/beep-effect"))) // true
 * ```
 *
 * @param repoRoot - Absolute repository root holding `skills-lock.json` and the installed trees.
 * @returns The plan and its generated patch files, without writing anything.
 * @category queries
 * @since 0.0.0
 */
export const compileSkillsLockMigration = Effect.fn("SkillsLock.compileSkillsLockMigration")(function* (
  repoRoot: string
): Effect.fn.Return<SkillsLockMigrationArtifacts, SkillsCommandError, ProvenanceRequirements> {
  const lock = yield* readSkillsLock(repoRoot);
  const resolutions = yield* ratifiedResolutions(lock.vendored);
  const planned = yield* Effect.forEach(
    yield* plannedSkills(repoRoot, lock),
    ([skill, sourceType]) => migrateSkill(repoRoot, skill, sourceType, resolutions),
    { concurrency: 1 }
  );
  const plan = yield* sealSkillsLockMigrationPlan(
    lock.sha256,
    A.map(planned, (skill) => skill.row)
  );
  return SkillsLockMigrationArtifacts.make({ plan, patchFiles: A.flatMap(planned, (skill) => skill.patchFiles) });
});

/**
 * Computes the read-only `skills-lock.json` to `skills-lock/v2` migration plan.
 *
 * **Details**
 *
 * Every skill in the lock (v1, or v2 after the flip) and every installed
 * skill the lock does not name yet gets one row, sorted by name. A skill with a resolution (its own `vendored` lock entry, otherwise a
 * ratified seed) becomes a `vendored` row, computed by the same resolver as
 * `beep skills provenance`. Its upstream path history is walked newest to
 * oldest: the newest revision whose whole tree equals the installed tree is
 * proposed as the pin, and otherwise each drifted path names the newest
 * revision carrying its bytes, or none. The row's entry is computed at the
 * proposed pin, with one `temporary-drift` patch per file that still drifts.
 * A seeded skill whose provenance or upstream cannot be read, a missing or
 * divergent install, and a v1 `github` skill without a seed are `unresolved`.
 * Every other skill is `local`, identified by its installed tree hash. The
 * rows and the read lock's digest are sealed into `planDigest`. Nothing is
 * written.
 *
 * **Example** (Inspect the requirements before providing them)
 *
 * ```ts
 * import { planSkillsLockMigration } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(planSkillsLockMigration("/workspace/beep-effect"))) // true
 * ```
 *
 * @param repoRoot - Absolute repository root holding `skills-lock.json` and the installed trees.
 * @returns The migration plan, without writing anything.
 * @category queries
 * @since 0.0.0
 */
export const planSkillsLockMigration = Effect.fn("SkillsLock.planSkillsLockMigration")(function* (
  repoRoot: string
): Effect.fn.Return<SkillsLockMigrationPlan, SkillsCommandError, ProvenanceRequirements> {
  return (yield* compileSkillsLockMigration(repoRoot)).plan;
});
