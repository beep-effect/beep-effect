/**
 * Read-only service for computing immutable skill provenance reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { SkillsCommandError } from "./Skills.errors.ts";
import {
  decodeSkillLockV2Entry,
  SkillLicense,
  SkillPatch,
  SkillProvenanceReport,
  SkillProvenanceResolution,
  SkillSnapshotFile,
  SkillTreeMode,
  SkillUpstreamContent,
  SkillUpstreamContentFile,
} from "./Skills.schemas.ts";
import type { Crypto } from "effect";

const $I = $RepoCliId.create("commands/Skills/Skills.service");

const CLAUDE_SKILLS_DIR = ".claude/skills";
const PATCH_PATH = "patches/0001-local-drift.patch";
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const textEncoder = new TextEncoder();
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeProvenanceResolution = S.decodeUnknownEffect(SkillProvenanceResolution);
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

const shadcnResolutionInput = {
  name: "shadcn",
  sourceType: "github",
  upstream: {
    repository: "shadcn-ui/ui",
    repositoryUrl: "https://github.com/shadcn-ui/ui",
    treePath: "skills/shadcn",
    entryPath: "skills/shadcn/SKILL.md",
    trackingRef: "main",
    sourceRevision: "91f21dfe1328585670275781b4525fff2507f917",
    observedHeadRevision: "cb2bcd88d93b2f9bddb030e9136f1f8773e7eac4",
    observedPathRevision: "6cd3f4c65c361ab6554e06a77e6a0af9cf8b6e37",
  },
  license: {
    spdxId: "MIT",
    path: "LICENSE.md",
    sha256: "1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f",
  },
  provenanceStatus: "exact",
  provenanceConfidence: "high",
  provenanceEvidence: ["exact-tree", "path-history"],
};

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

const asArrayBufferView = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => Uint8Array.from(bytes);

const concatBytes = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  let size = 0;
  for (const chunk of chunks) {
    size += chunk.byteLength;
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
};

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

  const walk = Effect.fn("SkillsProvenance.readLocalSkillFiles.walk")(function* (
    currentDir: string
  ): Effect.fn.Return<ReadonlyArray<SkillUpstreamContentFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
    const entries = yield* fs
      .readDirectory(currentDir)
      .pipe(SkillsCommandError.mapError(`Failed to read installed skill directory ${currentDir}.`, currentDir, skill));
    let files = A.empty<SkillUpstreamContentFile>();

    for (const entry of A.sort(entries, Str.Order)) {
      const absoluteEntry = path.join(currentDir, entry);
      const stat = yield* fs
        .stat(absoluteEntry)
        .pipe(
          SkillsCommandError.mapError(`Failed to stat installed skill path ${absoluteEntry}.`, absoluteEntry, skill)
        );
      if (Str.Equivalence(stat.type, "Directory")) {
        files = A.appendAll(files, yield* walk(absoluteEntry));
        continue;
      }
      if (!Str.Equivalence(stat.type, "File")) {
        continue;
      }

      const relativePath = yield* validateRelativePath(path.relative(absoluteSkillDir, absoluteEntry), skill);
      const bytes = yield* fs
        .readFile(absoluteEntry)
        .pipe(
          SkillsCommandError.mapError(`Failed to read installed skill file ${absoluteEntry}.`, absoluteEntry, skill)
        );
      files = A.append(
        files,
        SkillUpstreamContentFile.make({
          path: relativePath,
          mode: (stat.mode & 0o111) === 0 ? "100644" : "100755",
          bytes,
        })
      );
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

const renderFilePatch = Effect.fn("SkillsProvenance.renderFilePatch")(function* (
  skill: string,
  filePath: string,
  upstream: O.Option<HashedSkillFile>,
  local: O.Option<HashedSkillFile>
): Effect.fn.Return<string, SkillsCommandError> {
  const header = [`diff --git a/${filePath} b/${filePath}`];

  if (O.isNone(upstream) && O.isSome(local)) {
    const after = yield* decodeTextFile(local.value, skill);
    return A.join(
      [
        ...header,
        `new file mode ${local.value.mode}`,
        `index 000000000000..${Str.slice(0, 12)(local.value.sha256)}`,
        "--- /dev/null",
        `+++ b/${filePath}`,
        `@@ -0,0 +${hunkRange(contentLines(after).length)} @@`,
        ...prefixedLines("+", after),
        "",
      ],
      "\n"
    );
  }

  if (O.isSome(upstream) && O.isNone(local)) {
    const before = yield* decodeTextFile(upstream.value, skill);
    return A.join(
      [
        ...header,
        `deleted file mode ${upstream.value.mode}`,
        `index ${Str.slice(0, 12)(upstream.value.sha256)}..000000000000`,
        `--- a/${filePath}`,
        "+++ /dev/null",
        `@@ -${hunkRange(contentLines(before).length)} +0,0 @@`,
        ...prefixedLines("-", before),
        "",
      ],
      "\n"
    );
  }

  if (O.isSome(upstream) && O.isSome(local)) {
    const modeLines = Str.Equivalence(upstream.value.mode, local.value.mode)
      ? A.empty<string>()
      : [`old mode ${upstream.value.mode}`, `new mode ${local.value.mode}`];
    if (Str.Equivalence(upstream.value.sha256, local.value.sha256)) {
      return A.join([...header, ...modeLines, ""], "\n");
    }
    const before = yield* decodeTextFile(upstream.value, skill);
    const after = yield* decodeTextFile(local.value, skill);
    const indexMode = Str.Equivalence(upstream.value.mode, local.value.mode) ? ` ${local.value.mode}` : "";
    return A.join(
      [
        ...header,
        ...modeLines,
        `index ${Str.slice(0, 12)(upstream.value.sha256)}..${Str.slice(0, 12)(local.value.sha256)}${indexMode}`,
        `--- a/${filePath}`,
        `+++ b/${filePath}`,
        `@@ -${hunkRange(contentLines(before).length)} +${hunkRange(contentLines(after).length)} @@`,
        ...prefixedLines("-", before),
        ...prefixedLines("+", after),
        "",
      ],
      "\n"
    );
  }

  return "";
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

const fetchResponseBytes = Effect.fn("SkillUpstreamContentSource.fetchResponseBytes")(function* (
  url: string,
  skill: string
): Effect.fn.Return<Uint8Array, SkillsCommandError, HttpClient.HttpClient> {
  const response = yield* HttpClient.get(url).pipe(
    SkillsCommandError.mapError(`Failed to fetch pinned upstream content from ${url}.`, url, skill),
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    SkillsCommandError.mapError(`Pinned upstream content returned a non-2xx response from ${url}.`, url, skill)
  );
  const buffer = yield* response.arrayBuffer.pipe(
    SkillsCommandError.mapError(`Failed to read pinned upstream response from ${url}.`, url, skill)
  );
  return new Uint8Array(buffer);
});

const loadGitHubContent = Effect.fn("SkillUpstreamContentSource.loadGitHubContent")(function* (
  resolution: SkillProvenanceResolution
): Effect.fn.Return<SkillUpstreamContent, SkillsCommandError, HttpClient.HttpClient> {
  const upstream = resolution.upstream;
  const treeUrl = `https://api.github.com/repos/${upstream.repository}/git/trees/${upstream.sourceRevision}?recursive=1`;
  const treeBytes = yield* fetchResponseBytes(treeUrl, resolution.name);
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
    return yield* SkillsCommandError.make({
      message: `No files found at ${upstream.repository}:${upstream.treePath}@${upstream.sourceRevision}.`,
      skill: resolution.name,
    });
  }

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
      const url = `https://raw.githubusercontent.com/${upstream.repository}/${upstream.sourceRevision}/${entry.path}`;
      return SkillUpstreamContentFile.make({
        path: relativePath,
        mode,
        bytes: yield* fetchResponseBytes(url, resolution.name),
      });
    }),
    { concurrency: 6 }
  );
  const licenseUrl = `https://raw.githubusercontent.com/${upstream.repository}/${upstream.sourceRevision}/${resolution.license.path}`;
  const licenseBytes = yield* fetchResponseBytes(licenseUrl, resolution.name);
  return SkillUpstreamContent.make({ files, licenseBytes });
});

/**
 * Binary-safe source contract for immutable upstream skill and license bytes.
 *
 * **Details**
 *
 * Implementations must resolve content strictly from
 * `resolution.upstream.sourceRevision`; consulting a floating ref would make
 * the resulting hashes unreproducible. Bytes are returned rather than text so
 * hashing sees exactly what upstream stores.
 *
 * @see {@link SkillUpstreamContentSource} for the injectable service built on this contract.
 * @category services
 * @since 0.0.0
 */
export interface SkillUpstreamContentSourceShape {
  /** Load a complete pinned tree and license without consulting a floating ref. */
  readonly load: (resolution: SkillProvenanceResolution) => Effect.Effect<SkillUpstreamContent, SkillsCommandError>;
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
 * import { SkillProvenanceResolution, SkillUpstreamContent } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { SkillUpstreamContentSource } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import { Effect, Layer } from "effect"
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

const makeSkillUpstreamContentSource = Effect.gen(function* () {
  const httpContext = yield* Effect.context<HttpClient.HttpClient>();
  return SkillUpstreamContentSource.of({
    load: Effect.fn("SkillUpstreamContentSource.load")((resolution) =>
      loadGitHubContent(resolution).pipe(Effect.provide(httpContext))
    ),
  });
}).pipe(Effect.withSpan("SkillUpstreamContentSource.make"));

/**
 * Live GitHub implementation of the immutable upstream-content source.
 *
 * **Details**
 *
 * The layer stays open on `HttpClient.HttpClient` so the caller decides how
 * requests are made. Every fetch targets the pinned `sourceRevision`, and a
 * truncated GitHub tree response is rejected rather than hashed, because a
 * partial tree would silently produce a wrong snapshot digest.
 *
 * **Example** (Close the layer over a fetch-based HTTP client)
 *
 * ```ts
 * import { SkillUpstreamContentSourceLive } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import { Layer } from "effect"
 * import { FetchHttpClient } from "effect/unstable/http"
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
  if (!Str.Equivalence(skill, "shadcn")) {
    return yield* SkillsCommandError.make({
      message: `Unsupported provenance pilot skill "${skill}". The P1 pilot supports: shadcn.`,
      skill,
    });
  }
  return yield* decodeProvenanceResolution(shadcnResolutionInput).pipe(
    SkillsCommandError.mapError(`Invalid ratified provenance resolution for ${skill}.`, undefined, skill)
  );
});

/**
 * Computes the would-be `skills-lock/v2` entry for one installed pilot skill.
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
 * import { SkillsCommandError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 * import type { SkillProvenanceReport } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { resolveSkillProvenance, SkillUpstreamContentSource } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import { Crypto, Effect, FileSystem, Path } from "effect"
 *
 * const resolved: Effect.Effect<
 *   SkillProvenanceReport,
 *   SkillsCommandError,
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
  SkillsCommandError,
  SkillUpstreamContentSource | FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  const path = yield* Path.Path;
  const source = yield* SkillUpstreamContentSource;
  const resolution = yield* resolveResolution(skill);
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
  const localFiles = yield* readLocalSkillFiles(path.join(repoRoot, CLAUDE_SKILLS_DIR, skill), skill);
  const localTree = yield* computeSkillTree(localFiles, `${skill}:installed`);
  const agentsTarget = `.agents/skills/${skill}`;
  const claudeTarget = `${CLAUDE_SKILLS_DIR}/${skill}`;
  const agentsFiles = yield* readLocalSkillFiles(path.join(repoRoot, agentsTarget), skill);
  const agentsTree = yield* computeSkillTree(agentsFiles, `${skill}:agents-installed`);
  if (!Str.Equivalence(localTree.treeHash, agentsTree.treeHash)) {
    return yield* SkillsCommandError.make({
      message: `Installed skill targets disagree for ${skill}; refusing to report cross-target provenance.`,
      skill,
    });
  }
  let installedHashChunks = appendFramedText(A.empty<Uint8Array>(), claudeTarget);
  installedHashChunks = appendFramedText(installedHashChunks, localTree.treeHash);
  installedHashChunks = appendFramedText(installedHashChunks, agentsTarget);
  installedHashChunks = appendFramedText(installedHashChunks, agentsTree.treeHash);
  const installedTreeHash = yield* hashBytes(concatBytes(installedHashChunks), `${skill}:installed-targets`);
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
      installedTargets: [claudeTarget, agentsTarget],
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
  /** Compute the would-be lock entry for one installed pilot skill. */
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
 * import { Effect, Exit, Layer } from "effect"
 *
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
      resolveSkillProvenance(skill, repoRoot).pipe(Effect.provide(runtimeContext))
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
 * import { SkillUpstreamContent } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import { SkillProvenanceServiceLayer, SkillUpstreamContentSource } from "@beep/repo-cli/commands/Skills/Skills.service"
 * import { Effect, Layer } from "effect"
 *
 * const offline = Layer.succeed(
 *   SkillUpstreamContentSource,
 *   SkillUpstreamContentSource.of({
 *     load: () =>
 *       Effect.succeed(SkillUpstreamContent.make({ files: [], licenseBytes: new Uint8Array() })),
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
 * import { Layer } from "effect"
 * import { FetchHttpClient } from "effect/unstable/http"
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
 * import { Effect, Exit, Layer } from "effect"
 *
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
