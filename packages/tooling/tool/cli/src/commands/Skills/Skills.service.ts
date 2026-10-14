/**
 * Read-only service for computing immutable skill provenance reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import { Headers, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { asArrayBufferView, concatBytes } from "../../internal/cli/Bytes.ts";
import { canonicalJsonText } from "../Goals/PacketCore/PacketDigest.ts";
import {
  SkillInstallStateError,
  SkillsCommandError,
  SkillUpstreamContentError,
  SkillUpstreamContentErrorReason,
} from "./Skills.errors.ts";
import {
  decodeSkillLockV2Entry,
  SkillGitRevision,
  SkillLicense,
  SkillPatch,
  SkillPathHistory,
  SkillProvenanceReport,
  SkillProvenanceResolution,
  SkillSnapshotFile,
  SkillTreeMode,
  SkillUpstream,
  SkillUpstreamContent,
  SkillUpstreamContentFile,
} from "./Skills.schemas.ts";
import { skillResolutionSeeds } from "./Skills.seeds.ts";
import {
  KeepSeedPin,
  LocalMigrationRow,
  LocalSkillLockEntry,
  MatchesNoExaminedRevisionDrift,
  MatchesUpstreamRevisionDrift,
  PristineAtRevisionPin,
  SkillMigrationRow,
  SkillPathHistoryWindow,
  SkillsLockMigrationPlan,
  UnresolvedMigrationRow,
  VendoredMigrationRow,
  VendoredSkillLockEntry,
} from "./SkillsLock.schemas.ts";
import type * as Crypto from "effect/Crypto";
import type { SkillDriftRow, SkillPinProposal } from "./SkillsLock.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/Skills.service");

const CLAUDE_SKILLS_DIR = ".claude/skills";
const PATCH_PATH = "patches/0001-local-drift.patch";
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const textEncoder = new TextEncoder();
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeSkillTreeMode = S.decodeUnknownEffect(SkillTreeMode);

const GitHubTreeEntryType = LiteralKit(["blob", "tree", "commit"]);
const GitHubTreeMode = LiteralKit(["100644", "100755", "120000", "040000", "160000"]);

class GitHubTreeEntry extends S.Class<GitHubTreeEntry>($I`GitHubTreeEntry`)(
  {
    path: S.String,
    mode: GitHubTreeMode,
    type: GitHubTreeEntryType,
    sha: S.String,
  },
  $I.annote("GitHubTreeEntry", {
    description: "Mode-aware entry returned by the GitHub recursive tree API.",
  })
) {}

class GitHubTree extends S.Class<GitHubTree>($I`GitHubTree`)(
  {
    tree: S.Array(GitHubTreeEntry),
    truncated: S.Boolean,
  },
  $I.annote("GitHubTree", {
    description: "GitHub recursive tree response used by the pinned upstream content source.",
  })
) {}

class HashedSkillFile extends S.Class<HashedSkillFile>($I`HashedSkillFile`)(
  {
    path: S.String,
    mode: SkillTreeMode,
    bytes: S.Uint8Array,
    sha256: Sha256Hex,
  },
  $I.annote("HashedSkillFile", {
    description: "Binary-safe skill file paired with its canonical content digest.",
  })
) {}

class ComputedSkillTree extends S.Class<ComputedSkillTree>($I`ComputedSkillTree`)(
  {
    files: S.Array(HashedSkillFile),
    manifest: S.Array(SkillSnapshotFile),
    treeHash: Sha256Hex,
    manifestHash: Sha256Hex,
  },
  $I.annote("ComputedSkillTree", {
    description: "Ordered mode-aware manifest plus pristine or effective aggregate hashes.",
  })
) {}

const decodeGitHubTree = S.decodeUnknownEffect(S.fromJsonString(S.suspend(() => GitHubTree)));

const normalizeSlashes = Str.replaceAll("\\", "/");

const isSafeRelativePath = (filePath: string): boolean =>
  Str.isNonEmpty(filePath) &&
  !Str.includes("\0")(filePath) &&
  !Str.startsWith("/")(filePath) &&
  !Str.Equivalence(filePath, ".") &&
  !Str.Equivalence(filePath, "..") &&
  !Str.startsWith("../")(filePath) &&
  !Str.includes("/../")(filePath);

const validateRelativePath = Effect.fn("SkillsProvenance.validateRelativePath")(function* (
  filePath: string,
  skill: string
): Effect.fn.Return<string, SkillsCommandError> {
  const normalized = normalizeSlashes(filePath);
  if (!isSafeRelativePath(normalized)) {
    return yield* SkillsCommandError.make({
      message: `Upstream skill "${skill}" contains an unsafe file path: ${filePath}`,
      file: filePath,
      skill,
    });
  }
  return normalized;
});

const hashBytes = Effect.fn("SkillsProvenance.hashBytes")(function* (
  bytes: Uint8Array,
  label: string
): Effect.fn.Return<Sha256Hex, SkillsCommandError, Crypto.Crypto> {
  return yield* decodeSha256HexFromBytes(bytes).pipe(
    SkillsCommandError.mapError(`Failed to compute SHA-256 digest for ${label}.`, label)
  );
});

const appendFramedText = (chunks: ReadonlyArray<Uint8Array>, value: string): ReadonlyArray<Uint8Array> =>
  A.append(A.append(chunks, textEncoder.encode(value)), textEncoder.encode("\0"));

const computeSkillTree = Effect.fn("SkillsProvenance.computeSkillTree")(function* (
  files: ReadonlyArray<SkillUpstreamContentFile>,
  label: string
): Effect.fn.Return<ComputedSkillTree, SkillsCommandError, Crypto.Crypto> {
  const sorted = A.sortWith(files, (file) => file.path, Str.Order);
  let treeChunks: ReadonlyArray<Uint8Array> = A.empty<Uint8Array>();
  let manifestChunks: ReadonlyArray<Uint8Array> = A.empty<Uint8Array>();
  let hashedFiles: ReadonlyArray<HashedSkillFile> = A.empty<HashedSkillFile>();
  let manifest: ReadonlyArray<SkillSnapshotFile> = A.empty<SkillSnapshotFile>();

  for (const file of sorted) {
    const sha256 = yield* hashBytes(file.bytes, `${label}:${file.path}`);
    const hashedFile = HashedSkillFile.make({
      path: file.path,
      mode: file.mode,
      bytes: file.bytes,
      sha256,
    });
    hashedFiles = A.append(hashedFiles, hashedFile);
    manifest = A.append(
      manifest,
      SkillSnapshotFile.make({
        path: file.path,
        mode: file.mode,
        sha256,
      })
    );

    treeChunks = appendFramedText(treeChunks, file.path);
    treeChunks = appendFramedText(treeChunks, file.mode);
    treeChunks = appendFramedText(treeChunks, `${file.bytes.byteLength}`);
    treeChunks = A.append(A.append(treeChunks, file.bytes), textEncoder.encode("\0"));

    manifestChunks = appendFramedText(manifestChunks, file.path);
    manifestChunks = appendFramedText(manifestChunks, file.mode);
    manifestChunks = appendFramedText(manifestChunks, sha256);
  }

  return ComputedSkillTree.make({
    files: hashedFiles,
    manifest,
    treeHash: yield* hashBytes(concatBytes(treeChunks), `${label}:tree`),
    manifestHash: yield* hashBytes(concatBytes(manifestChunks), `${label}:manifest`),
  });
});

const readLocalSkillFiles = Effect.fn("SkillsProvenance.readLocalSkillFiles")(function* (
  absoluteSkillDir: string,
  skill: string
): Effect.fn.Return<ReadonlyArray<SkillUpstreamContentFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs
    .exists(absoluteSkillDir)
    .pipe(
      SkillsCommandError.mapError(`Failed to inspect installed skill ${absoluteSkillDir}.`, absoluteSkillDir, skill)
    );
  if (!exists) {
    return yield* SkillsCommandError.make({
      message: `Installed skill "${skill}" does not exist at ${absoluteSkillDir}.`,
      file: absoluteSkillDir,
      skill,
    });
  }

  // `stat` resolves links and the FileSystem service exposes no `lstat`, so a successful
  // `readLink` is the only way to see the link itself. Recording it the way Git does —
  // mode 120000 over the target text — keeps a correct local symlink equal to its upstream
  // entry. A real I/O failure is not swallowed here; it resurfaces from the caller's `stat`.
  const readSymlinkEntry = Effect.fn("SkillsProvenance.readLocalSkillFiles.readSymlinkEntry")(function* (
    absoluteEntry: string
  ): Effect.fn.Return<O.Option<SkillUpstreamContentFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
    const linkTarget = yield* Effect.option(fs.readLink(absoluteEntry));
    if (O.isNone(linkTarget)) {
      return O.none();
    }
    const linkPath = yield* validateRelativePath(path.relative(absoluteSkillDir, absoluteEntry), skill);
    return O.some(
      SkillUpstreamContentFile.make({
        path: linkPath,
        mode: "120000",
        bytes: textEncoder.encode(linkTarget.value),
      })
    );
  });

  const readLeafEntries = Effect.fn("SkillsProvenance.readLocalSkillFiles.readLeafEntries")(function* (
    absoluteEntry: string,
    stat: FileSystem.File.Info
  ): Effect.fn.Return<ReadonlyArray<SkillUpstreamContentFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
    if (!Str.Equivalence(stat.type, "File")) {
      return A.empty<SkillUpstreamContentFile>();
    }
    const relativePath = yield* validateRelativePath(path.relative(absoluteSkillDir, absoluteEntry), skill);
    const bytes = yield* fs
      .readFile(absoluteEntry)
      .pipe(SkillsCommandError.mapError(`Failed to read installed skill file ${absoluteEntry}.`, absoluteEntry, skill));
    return A.of(
      SkillUpstreamContentFile.make({
        path: relativePath,
        mode: (stat.mode & 0o111) === 0 ? "100644" : "100755",
        bytes,
      })
    );
  });

  const walk = Effect.fn("SkillsProvenance.readLocalSkillFiles.walk")(function* (
    currentDir: string
  ): Effect.fn.Return<ReadonlyArray<SkillUpstreamContentFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
    const entries = yield* fs
      .readDirectory(currentDir)
      .pipe(SkillsCommandError.mapError(`Failed to read installed skill directory ${currentDir}.`, currentDir, skill));
    let files = A.empty<SkillUpstreamContentFile>();

    for (const entry of A.sort(entries, Str.Order)) {
      const absoluteEntry = path.join(currentDir, entry);
      const symlink = yield* readSymlinkEntry(absoluteEntry);
      if (O.isSome(symlink)) {
        files = A.append(files, symlink.value);
        continue;
      }

      const stat = yield* fs
        .stat(absoluteEntry)
        .pipe(
          SkillsCommandError.mapError(`Failed to stat installed skill path ${absoluteEntry}.`, absoluteEntry, skill)
        );
      files = Str.Equivalence(stat.type, "Directory")
        ? A.appendAll(files, yield* walk(absoluteEntry))
        : A.appendAll(files, yield* readLeafEntries(absoluteEntry, stat));
    }
    return files;
  });

  return yield* walk(absoluteSkillDir);
});

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

const contentLines = (content: string): ReadonlyArray<string> => {
  if (Str.isEmpty(content)) {
    return A.empty<string>();
  }
  const lines = Str.split(content, "\n");
  return Str.endsWith("\n")(content) ? A.dropRight(lines, 1) : lines;
};

const prefixedLines = (prefix: string, content: string): ReadonlyArray<string> => {
  const rendered = A.map(contentLines(content), (line) => `${prefix}${line}`);
  return Str.isNonEmpty(content) && !Str.endsWith("\n")(content)
    ? A.append(rendered, "\\ No newline at end of file")
    : rendered;
};

const hunkRange = (lineCount: number): string => (lineCount === 0 ? "0,0" : `1,${lineCount}`);

const patchHeader = (filePath: string): string => `diff --git a/${filePath} b/${filePath}`;

const abbreviatedSha = Str.slice(0, 12);

const renderAddedFilePatch = Effect.fn("SkillsProvenance.renderAddedFilePatch")(function* (
  skill: string,
  filePath: string,
  local: HashedSkillFile
): Effect.fn.Return<string, SkillsCommandError> {
  const after = yield* decodeTextFile(local, skill);
  const headerLines = [
    patchHeader(filePath),
    `new file mode ${local.mode}`,
    `index 000000000000..${abbreviatedSha(local.sha256)}`,
  ];
  // A zero-byte add carries no hunk at all in `git diff`; emitting `@@ -0,0 +0,0 @@`
  // with no lines under it would be a patch no applier accepts.
  const bodyLines = Str.isEmpty(after)
    ? A.empty<string>()
    : [
        "--- /dev/null",
        `+++ b/${filePath}`,
        `@@ -0,0 +${hunkRange(contentLines(after).length)} @@`,
        ...prefixedLines("+", after),
      ];
  return A.join(A.append(A.appendAll(headerLines, bodyLines), ""), "\n");
});

const renderDeletedFilePatch = Effect.fn("SkillsProvenance.renderDeletedFilePatch")(function* (
  skill: string,
  filePath: string,
  upstream: HashedSkillFile
): Effect.fn.Return<string, SkillsCommandError> {
  const before = yield* decodeTextFile(upstream, skill);
  const headerLines = [
    patchHeader(filePath),
    `deleted file mode ${upstream.mode}`,
    `index ${abbreviatedSha(upstream.sha256)}..000000000000`,
  ];
  // Deleting a zero-byte upstream file is header-only for the same reason an empty add is.
  const bodyLines = Str.isEmpty(before)
    ? A.empty<string>()
    : [
        `--- a/${filePath}`,
        "+++ /dev/null",
        `@@ -${hunkRange(contentLines(before).length)} +0,0 @@`,
        ...prefixedLines("-", before),
      ];
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
  return A.join(
    [
      patchHeader(filePath),
      ...modeLines,
      `index ${abbreviatedSha(upstream.sha256)}..${abbreviatedSha(local.sha256)}${sameMode ? ` ${local.mode}` : ""}`,
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      `@@ -${hunkRange(contentLines(before).length)} +${hunkRange(contentLines(after).length)} @@`,
      ...prefixedLines("-", before),
      ...prefixedLines("+", after),
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

const buildPatchSeries = Effect.fn("SkillsProvenance.buildPatchSeries")(function* (
  skill: string,
  upstream: ComputedSkillTree,
  local: ComputedSkillTree,
  driftPaths: ReadonlyArray<string>
): Effect.fn.Return<readonly [ReadonlyArray<SkillPatch>, Sha256Hex], SkillsCommandError, Crypto.Crypto> {
  if (A.isReadonlyArrayEmpty(driftPaths)) {
    return [A.empty<SkillPatch>(), yield* hashBytes(new Uint8Array(), `${skill}:empty-patch-set`)];
  }

  let patchSections = A.empty<string>();
  for (const filePath of driftPaths) {
    patchSections = A.append(
      patchSections,
      yield* renderFilePatch(skill, filePath, findFile(upstream.files, filePath), findFile(local.files, filePath))
    );
  }
  const patchBytes = textEncoder.encode(A.join(patchSections, ""));
  const patchSha256 = yield* hashBytes(patchBytes, `${skill}:${PATCH_PATH}`);
  let patchSetChunks = appendFramedText(A.empty<Uint8Array>(), PATCH_PATH);
  patchSetChunks = appendFramedText(patchSetChunks, `${patchBytes.byteLength}`);
  patchSetChunks = A.append(patchSetChunks, patchBytes);
  const patchSetHash = yield* hashBytes(concatBytes(patchSetChunks), `${skill}:patch-set`);

  return [
    [
      SkillPatch.make({
        path: PATCH_PATH,
        sha256: patchSha256,
        label: "temporary-drift",
        owner: "@kriegcloud",
        dropCondition: "Drop when the installed skill tree matches the pinned upstream snapshot.",
      }),
    ],
    patchSetHash,
  ];
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
 * import { FetchHttpClient } from "effect/http"
 *
 * const ready = SkillUpstreamContentSourceLive.pipe(Layer.provide(FetchHttpClient.layer))
 *
 * console.log(Layer.isLayer(ready)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SkillUpstreamContentSourceLive = Layer.effect(SkillUpstreamContentSource, makeSkillUpstreamContentSource);

const resolveResolution = Effect.fn("SkillsProvenance.resolveResolution")(function* (
  skill: string
): Effect.fn.Return<SkillProvenanceResolution, SkillsCommandError> {
  const seeds = yield* skillResolutionSeeds.pipe(
    SkillsCommandError.mapError("Invalid ratified provenance resolution seed table.", undefined, skill)
  );
  return yield* A.findFirst(seeds, (seed) => Str.Equivalence(seed.name, skill)).pipe(
    Effect.fromOption,
    Effect.mapError(() =>
      SkillsCommandError.make({
        message: `No ratified provenance resolution for "${skill}". Resolved skills: ${A.join(
          A.map(seeds, (seed) => seed.name),
          ", "
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
  const installedHashChunks = pipe(
    A.empty<Uint8Array>(),
    (chunks) => appendFramedText(chunks, claudeTarget),
    (chunks) => appendFramedText(chunks, localTree.treeHash),
    (chunks) => appendFramedText(chunks, agentsTarget),
    (chunks) => appendFramedText(chunks, agentsTree.treeHash)
  );
  const installedTreeHash = yield* hashBytes(concatBytes(installedHashChunks), `${skill}:installed-targets`);
  return { localTree, installedTargets: [claudeTarget, agentsTarget], installedTreeHash };
});

/**
 * Computes the would-be `skills-lock/v2` entry for one installed, seeded skill.
 *
 * **Details**
 *
 * Nothing is written: the pinned upstream tree, both installed targets, and the
 * proposed patch series are hashed in memory and reported. The run refuses to
 * report at all when the refetched license digest disagrees with the ratified
 * one, or when the two installed targets have diverged, because either
 * condition would make the resulting entry a claim nobody checked.
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
 * import type { SkillProvenanceReport } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { resolveSkillProvenance, SkillUpstreamContentSource } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Crypto from "effect/Crypto";
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 * import * as Path from "effect/Path";
 * const resolved: Effect.Effect<
 *   SkillProvenanceReport,
 *   SkillsCommandError | SkillUpstreamContentError,
 *   SkillUpstreamContentSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto
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
): Effect.fn.Return<
  SkillProvenanceReport,
  SkillsCommandError | SkillUpstreamContentError,
  SkillUpstreamContentSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  const resolution = yield* resolveResolution(skill);
  const source = yield* SkillUpstreamContentSource;
  const upstreamContent = yield* source.load(resolution);
  const actualLicenseHash = yield* hashBytes(upstreamContent.licenseBytes, `${skill}:${resolution.license.path}`);
  if (!Str.Equivalence(actualLicenseHash, resolution.license.sha256)) {
    return yield* SkillsCommandError.make({
      message: `Pinned license hash mismatch for ${skill}; refusing to report provenance.`,
      file: resolution.license.path,
      skill,
    });
  }

  const upstreamTree = yield* computeSkillTree(upstreamContent.files, `${skill}:upstream`);
  const { localTree, installedTargets, installedTreeHash } = yield* readInstalledTargets(repoRoot, skill).pipe(
    Effect.catchTag("SkillInstallStateError", (error) =>
      Effect.fail(SkillsCommandError.make({ message: error.message, skill }))
    )
  );
  const allPaths = A.sort(
    A.union(
      A.map(upstreamTree.files, (file) => file.path),
      A.map(localTree.files, (file) => file.path)
    ),
    Str.Order
  );
  const driftPaths = A.filter(allPaths, (filePath) => {
    const upstream = findFile(upstreamTree.files, filePath);
    const local = findFile(localTree.files, filePath);
    return O.isNone(upstream) || O.isNone(local) || !filesMatch(upstream.value, local.value);
  });
  const matchedFileCount = A.filter(upstreamTree.files, (upstream) =>
    O.exists(findFile(localTree.files, upstream.path), (local) => filesMatch(upstream, local))
  ).length;
  const [series, patchSetHash] = yield* buildPatchSeries(skill, upstreamTree, localTree, driftPaths);
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
      sha256: actualLicenseHash,
    }),
    provenance: {
      status: resolution.provenanceStatus,
      confidence: resolution.provenanceConfidence,
      matchedFileCount,
      upstreamFileCount: upstreamTree.files.length,
      evidence: resolution.provenanceEvidence,
    },
    patches: {
      required: A.isReadonlyArrayNonEmpty(series),
      patchSetHash,
      series,
    },
    effective: {
      treeHash: localTree.treeHash,
      installedTargets,
      installedTreeHash,
    },
  }).pipe(
    SkillsCommandError.mapError(`Failed to encode the computed v2 provenance entry for ${skill}.`, undefined, skill)
  );

  return SkillProvenanceReport.make({ skill, entry, driftPaths });
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
  const runtimeContext = yield* Effect.context<
    SkillUpstreamContentSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto
  >();
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
 * Only the content source is left open here. Filesystem, path, and crypto
 * services are still required by the composed layer.
 *
 * **Example** (Build an offline resolver)
 *
 * ```ts
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
 * const offlineResolver = SkillProvenanceServiceLayer.pipe(Layer.provide(offline))
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
 * The upstream-content source is already supplied, so the remaining
 * requirements are an HTTP client plus the platform filesystem, path, and
 * crypto services.
 *
 * **Example** (Supply the HTTP client the live source needs)
 *
 * ```ts
 * import { SkillProvenanceServiceLive } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import * as Layer from "effect/Layer";
 * import { FetchHttpClient } from "effect/http"
 *
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
  Layer.provide(SkillUpstreamContentSourceLive)
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

const SKILLS_LOCK_PATH = "skills-lock.json";

const V1LockSkills = S.fromJsonString(
  S.Struct({
    version: S.Literal(1),
    skills: S.Record(S.String, S.Struct({ sourceType: S.String })),
  })
);

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
// installed file. With no drift against the seed pin, the seed pin is already pristine.
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

const vendoredRow = Effect.fn("SkillsLock.vendoredRow")(function* (
  repoRoot: string,
  skill: string,
  seed: SkillProvenanceResolution,
  localTree: ComputedSkillTree,
  localEntry: LocalSkillLockEntry
): Effect.fn.Return<
  VendoredMigrationRow | UnresolvedMigrationRow,
  SkillsCommandError | SkillUpstreamContentError,
  SkillUpstreamContentSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  // A provenance refusal (license digest mismatch, unsafe upstream path, unencodable
  // entry) belongs to this skill: report it and keep planning the rest.
  const report = yield* resolveSkillProvenance(skill, repoRoot).pipe(
    Effect.map(Result.succeed),
    Effect.catchTag("SkillsCommandError", flow(Result.fail, Effect.succeed))
  );
  if (Result.isFailure(report)) {
    return UnresolvedMigrationRow.make({
      skill,
      note: `provenance-unavailable: ${report.failure.message}`,
      entry: localEntry,
    });
  }
  const source = yield* SkillUpstreamContentSource;
  const history = yield* source.listPathHistory(seed);
  const { pin, drift } = yield* classifyAgainstPathHistory(seed, localTree, report.success.driftPaths, history);
  return VendoredMigrationRow.make({
    skill,
    entry: VendoredSkillLockEntry.make({ ...report.success.entry }),
    pin,
    drift,
    pathHistory: SkillPathHistoryWindow.make({
      trackingRef: seed.upstream.trackingRef,
      head: A.headNonEmpty(history.revisions),
      revisionCount: A.length(history.revisions),
      truncated: history.truncated,
    }),
  });
});

const migrateSkill = Effect.fn("SkillsLock.migrateSkill")(function* (
  repoRoot: string,
  skill: string,
  v1SourceType: string,
  seeds: ReadonlyArray<SkillProvenanceResolution>
): Effect.fn.Return<
  SkillMigrationRow,
  SkillsCommandError,
  SkillUpstreamContentSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  // A missing or divergent install is this skill's problem, not the plan's: report it
  // as an unresolved row and keep planning the rest. Other I/O failures stay fatal.
  const installed = yield* readInstalledTargets(repoRoot, skill).pipe(
    Effect.map(Result.succeed),
    Effect.catchTag("SkillInstallStateError", flow(Result.fail, Effect.succeed))
  );
  if (Result.isFailure(installed)) {
    return UnresolvedMigrationRow.make({ skill, note: `${installed.failure.reason}: ${installed.failure.message}` });
  }
  const entry = LocalSkillLockEntry.make({
    installedTargets: installed.success.installedTargets,
    installedTreeHash: installed.success.installedTreeHash,
  });
  const seed = A.findFirst(seeds, (candidate) => Str.Equivalence(candidate.name, skill));
  if (O.isSome(seed)) {
    // An upstream that cannot be read at the pin or along its path history (moved
    // tree path, truncated tree, network) is likewise reported for this skill only.
    return yield* vendoredRow(repoRoot, skill, seed.value, installed.success.localTree, entry).pipe(
      Effect.catchTag("SkillUpstreamContentError", (error) =>
        Effect.succeed(UnresolvedMigrationRow.make({ skill, note: `upstream-unavailable: ${error.message}`, entry }))
      )
    );
  }
  return Str.Equivalence(v1SourceType, "github")
    ? UnresolvedMigrationRow.make({
        skill,
        entry,
        note: "v1 github entry without a ratified resolution seed; stays local until one is ratified",
      })
    : LocalMigrationRow.make({ skill, entry });
});

const PLAN_SCHEMA_VERSION = "skills-lock-migration-plan/v2";
const encodeMigrationRows = S.encodeEffect(S.Array(SkillMigrationRow));

// The digest preimage is the compact canonical JSON of the encoded schema version and
// rows, so it covers every vendored row's path-history head.
const sealSkillsLockMigrationPlan = Effect.fn("SkillsLock.sealSkillsLockMigrationPlan")(function* (
  rows: ReadonlyArray<SkillMigrationRow>
): Effect.fn.Return<SkillsLockMigrationPlan, SkillsCommandError, Crypto.Crypto> {
  const encodedRows = yield* encodeMigrationRows(rows).pipe(
    SkillsCommandError.mapError("Failed to encode the skills lock migration plan rows.")
  );
  const preimage = canonicalJsonText({ schemaVersion: PLAN_SCHEMA_VERSION, rows: encodedRows });
  const planDigest = yield* hashBytes(textEncoder.encode(preimage), "skills-lock-migration-plan");
  return SkillsLockMigrationPlan.make({ planDigest, rows });
});

/**
 * Computes the read-only `skills-lock/v1` to `skills-lock/v2` migration plan.
 *
 * **Details**
 *
 * Every skill in the v1 lock gets one row, sorted by name. A skill with a
 * ratified resolution seed becomes a `vendored` entry, computed by the same
 * resolver as `beep skills provenance`. Its upstream path history is then
 * walked newest to oldest: the newest revision whose whole tree equals the
 * installed tree is proposed as the pin, and otherwise each drifted path names
 * the newest revision carrying its bytes, or none. A seeded skill whose
 * provenance or upstream cannot be read, a missing or divergent install, and a
 * v1 `github` skill without a seed are `unresolved`. Every other skill is
 * `local`, identified by its installed tree hash. The rows are sealed into
 * `planDigest`. Nothing is written.
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
): Effect.fn.Return<
  SkillsLockMigrationPlan,
  SkillsCommandError,
  SkillUpstreamContentSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lockPath = path.join(repoRoot, SKILLS_LOCK_PATH);
  const text = yield* fs
    .readFileString(lockPath)
    .pipe(SkillsCommandError.mapError(`Failed to read ${SKILLS_LOCK_PATH}.`, lockPath));
  const v1 = yield* S.decodeEffect(V1LockSkills)(text).pipe(
    SkillsCommandError.mapError(`${SKILLS_LOCK_PATH} is not a skills-lock/v1 document.`, lockPath)
  );
  const seeds = yield* skillResolutionSeeds.pipe(
    SkillsCommandError.mapError("Invalid ratified provenance resolution seed table.")
  );
  const rows = yield* Effect.forEach(
    A.sort(R.keys(v1.skills), Str.Order),
    (skill) =>
      migrateSkill(
        repoRoot,
        skill,
        O.getOrElse(
          O.map(R.get(v1.skills, skill), (entry) => entry.sourceType),
          () => "local"
        ),
        seeds
      ),
    { concurrency: 1 }
  );
  return yield* sealSkillsLockMigrationPlan(rows);
});
