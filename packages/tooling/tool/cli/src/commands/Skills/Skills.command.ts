/**
 * Repo-local agent skill synchronization command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Crypto from "effect/Crypto";
import { Argument, Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { asArrayBufferView, concatBytes } from "../../internal/cli/Bytes.ts";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { formatJsonValue } from "../../internal/cli/Json.ts";
import { decodeTomlTextWith } from "../../internal/schema/TextCodec.ts";
import { checkInstalledSkills } from "./internal/SkillFrontmatterCheck.ts";
import {
  SkillFrontmatterError,
  SkillsCommandError,
  SkillsDriftError,
  SkillVendoredRefetchError,
} from "./Skills.errors.ts";
import { SkillPatchOwnerSourceLive } from "./Skills.patches.ts";
import {
  renderSkillMaterializeSummary,
  renderSkillProvenanceJson,
  renderSkillProvenanceSummary,
  renderSkillsLockMigrationPlanJson,
  renderSkillsLockMigrationPlanSummary,
  renderSkillsLockWriteReceiptJson,
} from "./Skills.render.ts";
import {
  computeLocalSkillLockEntry,
  listInstalledSkillNames,
  planSkillsLockMigration,
  runSkillProvenance,
  SkillProvenanceServiceLive,
  SkillUpstreamContentSourceLive,
} from "./Skills.service.ts";
import { decodeSkillsLockDocumentJson, SkillsLockDocument } from "./SkillsLock.schemas.ts";
import { renderSkillsLockDocumentText, writeSkillsLockMigration } from "./SkillsLock.write.ts";
import { SkillMaterializer, SkillMaterializerLive } from "./SkillsMaterialize.service.ts";
import type { SkillFrontmatterReport } from "./SkillFrontmatter.schemas.ts";
import type { SkillProvenanceService } from "./Skills.service.ts";
import type { SkillsLockEntry, VendoredSkillLockEntry } from "./SkillsLock.schemas.ts";

// cspell:ignore mattpocock Gebert

const $I = $RepoCliId.create("commands/Skills/Skills.command");

const CLAUDE_SKILLS_DIR = ".claude/skills";
const AGENTS_SKILLS_DIR = ".agents/skills";
const CODEX_CONFIG_PATH = ".codex/config.toml";
const SKILLS_LOCK_PATH = "skills-lock.json";

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
const encodeUnknownJsonResult = S.encodeUnknownResult(S.fromJsonString(S.Unknown));

type SkillsRunMode = "write" | "check" | "dry-run";

type SkillFile = {
  readonly path: string;
  readonly bytes: Uint8Array;
};

type SkillSnapshot = {
  readonly files: ReadonlyArray<SkillFile>;
  readonly hash: string;
};

type SkillDrift =
  | {
      readonly _tag: "RemoteSkillDrift";
      readonly name: string;
    }
  | {
      readonly _tag: "LockDrift";
    }
  | {
      readonly _tag: "CodexConfigDrift";
    }
  | {
      readonly _tag: "AgentsMirrorDrift";
    }
  | {
      readonly _tag: "HandEditedVendoredOutput";
      readonly name: string;
    };

type SkillDriftByTag<Tag extends SkillDrift["_tag"]> = Extract<SkillDrift, { readonly _tag: Tag }>;
type SkillDriftLineFormatter<Tag extends SkillDrift["_tag"]> = (drift: SkillDriftByTag<Tag>) => string;

/**
 * GitHub-backed skill source tracked by this checkout.
 *
 * **Example** (Describe one mirrored skill folder)
 *
 * ```ts
 * import { RemoteSkillSource } from "@beep/repo-cli/commands/Skills"
 *
 * const source = RemoteSkillSource.make({
 *   name: "grill-me",
 *   source: "UditAkhourii/grill-me",
 *   sourceType: "github",
 *   ref: "main",
 *   skillPath: "skills/grill-me",
 * })
 *
 * console.log(source.name) // "grill-me"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RemoteSkillSource extends S.Class<RemoteSkillSource>($I`RemoteSkillSource`)(
  {
    name: S.String,
    source: S.String,
    sourceType: S.Literal("github"),
    ref: S.String,
    skillPath: S.String,
  },
  $I.annote("RemoteSkillSource", {
    title: "Remote Skill Source",
    description: "A repo-local skill folder mirrored from a GitHub repository path.",
  })
) {}

/**
 * One deterministic entry in skills-lock.json.
 *
 * **Example** (Validate a skill lock entry)
 *
 * ```ts
 * import { SkillLockEntry } from "@beep/repo-cli/commands/Skills"
 * import * as S from "effect/Schema"
 *
 * const candidate = { name: "jsdoc-annotation-specialist", source: "repo", version: "0.2.0" }
 * console.log(S.is(SkillLockEntry)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLockEntry extends S.Class<SkillLockEntry>($I`SkillLockEntry`)(
  {
    source: S.String,
    sourceType: LiteralKit(["github", "local"]),
    computedHash: S.String,
    ref: S.optionalKey(S.String),
    skillPath: S.optionalKey(S.String),
  },
  $I.annote("SkillLockEntry", {
    title: "Skill Lock Entry",
    description: "Resolved source metadata and content hash for one repo-local skill.",
  })
) {}

/**
 * Deterministic project skill lockfile.
 *
 * **Example** (Validate an empty skill lockfile)
 *
 * ```ts
 * import { SkillLockFile } from "@beep/repo-cli/commands/Skills"
 * import * as S from "effect/Schema"
 *
 * const candidate = { skills: [] }
 * console.log(S.is(SkillLockFile)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillLockFile extends S.Class<SkillLockFile>($I`SkillLockFile`)(
  {
    version: S.Literal(1),
    skills: S.Record(S.String, SkillLockEntry),
  },
  $I.annote("SkillLockFile", {
    title: "Skill Lock File",
    description: "Repo-local skill lockfile written by bun run skills:update.",
  })
) {}

const SuspendSkillLockFile = S.suspend(() => SkillLockFile);

class GitHubTreeEntry extends S.Class<GitHubTreeEntry>($I`GitHubTreeEntry`)(
  {
    path: S.String,
    type: LiteralKit(["blob", "tree", "commit"]),
    sha: S.String,
    size: S.optionalKey(S.Finite),
    url: S.optionalKey(S.String),
  },
  $I.annote("GitHubTreeEntry", {
    title: "GitHub Tree Entry",
    description: "One entry from the GitHub git tree API.",
  })
) {}

class GitHubTree extends S.Class<GitHubTree>($I`GitHubTree`)(
  {
    tree: S.Array(GitHubTreeEntry),
    truncated: S.Boolean,
  },
  $I.annote("GitHubTree", {
    title: "GitHub Tree",
    description: "GitHub recursive tree API response.",
  })
) {}

const SuspendGitHubTree = S.suspend(() => GitHubTree);

class CodexSkillEntry extends S.Class<CodexSkillEntry>($I`CodexSkillEntry`)(
  {
    name: S.String,
    enabled: S.Boolean,
  },
  $I.annote("CodexSkillEntry", {
    title: "Codex Skill Entry",
    description: "Minimal Codex skill entry used by the skills updater.",
  })
) {}

class CodexSkillsSection extends S.Class<CodexSkillsSection>($I`CodexSkillsSection`)(
  {
    include_instructions: S.Boolean,
    config: S.Array(CodexSkillEntry),
  },
  $I.annote("CodexSkillsSection", {
    title: "Codex Skills Section",
    description: "The .codex/config.toml skills table managed by the skills updater.",
  })
) {}

class CodexSkillsConfig extends S.Class<CodexSkillsConfig>($I`CodexSkillsConfig`)(
  {
    skills: CodexSkillsSection,
  },
  $I.annote("CodexSkillsConfig", {
    title: "Codex Skills Config",
    description: "Minimal .codex/config.toml shape required by the skills updater.",
  })
) {}

const SuspendCodexSkillsConfig = S.suspend(() => CodexSkillsConfig);

const decodeLockText = S.decodeUnknownEffect(S.fromJsonString(SuspendSkillLockFile));
const decodeGitHubTree = S.decodeUnknownEffect(S.fromJsonString(SuspendGitHubTree));
const decodeCodexSkillsConfig = decodeTomlTextWith(S.decodeUnknownEffect(SuspendCodexSkillsConfig));

const skillSource = (source: {
  readonly name: string;
  readonly source: string;
  readonly ref: string;
  readonly skillPath: string;
}): RemoteSkillSource =>
  RemoteSkillSource.make({
    ...source,
    sourceType: "github",
  });

/**
 * GitHub-backed skills that this repo can update automatically.
 *
 * **Example** (Find a configured remote skill)
 *
 * ```ts
 * import { remoteSkillSources } from "@beep/repo-cli/commands/Skills"
 *
 * console.log(remoteSkillSources.some((source) => source.name === "grill-me")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const remoteSkillSources: ReadonlyArray<RemoteSkillSource> = [
  skillSource({
    name: "adhd",
    source: "UditAkhourii/adhd",
    ref: "main",
    skillPath: "skills/adhd/SKILL.md",
  }),
  skillSource({
    name: "grill-me",
    source: "mattpocock/skills",
    ref: "main",
    skillPath: "skills/productivity/grill-me/SKILL.md",
  }),
  skillSource({
    name: "teach",
    source: "mattpocock/skills",
    ref: "main",
    skillPath: "skills/productivity/teach/SKILL.md",
  }),
  skillSource({
    name: "portless",
    source: "vercel-labs/portless",
    ref: "main",
    skillPath: "skills/portless/SKILL.md",
  }),
  skillSource({
    name: "shadcn",
    source: "shadcn-ui/ui",
    ref: "main",
    skillPath: "skills/shadcn/SKILL.md",
  }),
  skillSource({
    name: "turborepo",
    source: "vercel/turborepo",
    ref: "main",
    skillPath: "skills/turborepo/SKILL.md",
  }),
];

const remoteSkillSourcesByName: Readonly<Record<string, RemoteSkillSource>> = pipe(
  remoteSkillSources,
  A.map((source) => [source.name, source] as const),
  R.fromEntries
);

const checkFlag = Flag.Boolean("check").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Report skill drift without writing files and exit non-zero when changes are needed")
);
const dryRunFlag = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Preview skill updates without writing files or failing on drift")
);
const skillFlag = Flag.String("skill").pipe(
  Flag.withDescription("Update or check one known GitHub-backed skill"),
  Flag.optional
);
const provenanceSkillArgument = Argument.String("skill").pipe(
  Argument.withDescription(
    "Installed skill to resolve: a vendored skills-lock.json entry, or one with a ratified resolution seed"
  )
);
const provenanceJsonFlag = Flag.Boolean("json").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the would-be skills-lock/v2 entry as JSON")
);

const normalizeSlashes = (value: string): string => Str.replaceAll("\\", "/")(value);

const isSafeRelativeSkillFilePath = (filePath: string): boolean => {
  const normalized = normalizeSlashes(filePath);
  return (
    Str.isNonEmpty(normalized) &&
    !normalized.includes("\0") &&
    !normalized.startsWith("/") &&
    normalized !== "." &&
    normalized !== ".." &&
    !normalized.startsWith("../") &&
    !normalized.includes("/../")
  );
};

const validateSkillFilePath = Effect.fn("Skills.validateSkillFilePath")(function* (
  filePath: string,
  skill: string
): Effect.fn.Return<string, SkillsCommandError> {
  const normalized = normalizeSlashes(filePath);
  if (!isSafeRelativeSkillFilePath(normalized)) {
    return yield* SkillsCommandError.make({
      message: `Remote skill "${skill}" contains an unsafe file path: ${filePath}`,
      file: filePath,
      skill,
    });
  }
  return normalized;
});

const toSortedRecord = <A>(entries: ReadonlyArray<readonly [string, A]>): Record<string, A> => {
  const sortedEntries = A.sortWith(entries, ([key]) => key, Order.String);
  const record: Record<string, A> = {};
  for (const [key, value] of sortedEntries) {
    record[key] = value;
  }
  return record;
};

const sha256Hex = Effect.fn("Skills.sha256Hex")(function* (
  bytes: Uint8Array,
  file: string
): Effect.fn.Return<string, SkillsCommandError, Crypto.Crypto> {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest("SHA-256", asArrayBufferView(bytes))
    .pipe(SkillsCommandError.mapError(`Failed to compute SHA-256 digest for ${file}.`, file));
  return Hex.encode(digest);
});

const hashSkillFiles = Effect.fn("Skills.hashSkillFiles")(function* (
  files: ReadonlyArray<SkillFile>,
  label: string
): Effect.fn.Return<string, SkillsCommandError, Crypto.Crypto> {
  const sortedFiles = A.sortWith(files, (file) => file.path, Order.String);
  const chunks: Array<Uint8Array> = [];

  for (const file of sortedFiles) {
    chunks.push(textEncoder.encode(file.path));
    chunks.push(textEncoder.encode("\0"));
    chunks.push(textEncoder.encode(String(file.bytes.byteLength)));
    chunks.push(textEncoder.encode("\0"));
    chunks.push(file.bytes);
    chunks.push(textEncoder.encode("\0"));
  }

  return yield* sha256Hex(concatBytes(chunks), label);
});

const readExistingFile = Effect.fn("Skills.readExistingFile")(function* (
  absolutePath: string
): Effect.fn.Return<O.Option<string>, SkillsCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(absolutePath)
    .pipe(SkillsCommandError.mapError(`Failed to check whether ${absolutePath} exists.`, absolutePath));

  if (!exists) {
    return O.none();
  }

  return yield* fs
    .readFileString(absolutePath)
    .pipe(Effect.asSome, SkillsCommandError.mapError(`Failed to read ${absolutePath}.`, absolutePath));
});

const makeParentDirectory = Effect.fn("Skills.makeParentDirectory")(function* (
  absolutePath: string
): Effect.fn.Return<void, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(absolutePath), { recursive: true })
    .pipe(SkillsCommandError.mapError(`Failed to create parent directory for ${absolutePath}.`, absolutePath));
});

const writeStringFile = Effect.fn("Skills.writeStringFile")(function* (
  absolutePath: string,
  content: string
): Effect.fn.Return<void, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  yield* makeParentDirectory(absolutePath);
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .writeFileString(absolutePath, content)
    .pipe(SkillsCommandError.mapError(`Failed to write ${absolutePath}.`, absolutePath));
});

const writeByteFile = Effect.fn("Skills.writeByteFile")(function* (
  absolutePath: string,
  bytes: Uint8Array
): Effect.fn.Return<void, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  yield* makeParentDirectory(absolutePath);
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .writeFile(absolutePath, asArrayBufferView(bytes))
    .pipe(SkillsCommandError.mapError(`Failed to write ${absolutePath}.`, absolutePath));
});

const readSkillFiles = Effect.fn("Skills.readSkillFiles")(function* (
  absoluteSkillDir: string
): Effect.fn.Return<ReadonlyArray<SkillFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs
    .exists(absoluteSkillDir)
    .pipe(SkillsCommandError.mapError(`Failed to check whether ${absoluteSkillDir} exists.`, absoluteSkillDir));

  if (!exists) {
    return A.empty<SkillFile>();
  }

  const walk = Effect.fn("Skills.readSkillFiles.walk")(function* (
    currentDir: string
  ): Effect.fn.Return<ReadonlyArray<SkillFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
    const entries = yield* fs
      .readDirectory(currentDir)
      .pipe(SkillsCommandError.mapError(`Failed to read directory ${currentDir}.`, currentDir));
    let files = A.empty<SkillFile>();

    for (const entry of A.sort(entries, Order.String)) {
      const absoluteEntry = path.join(currentDir, entry);
      const stat = yield* fs
        .stat(absoluteEntry)
        .pipe(SkillsCommandError.mapError(`Failed to stat ${absoluteEntry}.`, absoluteEntry));

      if (stat.type === "Directory") {
        files = A.appendAll(files, yield* walk(absoluteEntry));
        continue;
      }

      if (stat.type !== "File") {
        continue;
      }

      const bytes = yield* fs
        .readFile(absoluteEntry)
        .pipe(SkillsCommandError.mapError(`Failed to read ${absoluteEntry}.`, absoluteEntry));
      files = A.append(files, {
        path: normalizeSlashes(path.relative(absoluteSkillDir, absoluteEntry)),
        bytes,
      });
    }

    return files;
  });

  return yield* walk(absoluteSkillDir);
});

const hashSkillDirectory = Effect.fn("Skills.hashSkillDirectory")(function* (
  absoluteSkillDir: string,
  name: string
): Effect.fn.Return<O.Option<string>, SkillsCommandError, FileSystem.FileSystem | Path.Path | Crypto.Crypto> {
  const files = yield* readSkillFiles(absoluteSkillDir);
  if (files.length === 0) {
    return O.none();
  }
  return O.some(yield* hashSkillFiles(files, name));
});

const fetchResponseBytes = Effect.fn("Skills.fetchResponseBytes")(function* (
  url: string
): Effect.fn.Return<Uint8Array, SkillsCommandError, HttpClient.HttpClient> {
  const response = yield* HttpClient.get(url).pipe(
    SkillsCommandError.mapError(`Failed to fetch ${url}.`, url),
    Effect.flatMap((response) => HttpClientResponse.filterStatusOk(response)),
    SkillsCommandError.mapError(`Received a non-2xx response from ${url}.`, url)
  );
  const buffer = yield* response.arrayBuffer.pipe(
    SkillsCommandError.mapError(`Failed to read response body from ${url}.`, url)
  );
  return new Uint8Array(buffer);
});

const fetchGitHubTree = Effect.fn("Skills.fetchGitHubTree")(function* (
  source: RemoteSkillSource
): Effect.fn.Return<GitHubTree, SkillsCommandError, HttpClient.HttpClient> {
  const url = `https://api.github.com/repos/${source.source}/git/trees/${source.ref}?recursive=1`;
  const bytes = yield* fetchResponseBytes(url);
  return yield* decodeGitHubTree(textDecoder.decode(bytes)).pipe(
    SkillsCommandError.mapError(`Failed to parse GitHub tree response for ${source.name}.`, url, source.name)
  );
});

const fetchRemoteSkillSnapshot = Effect.fn("Skills.fetchRemoteSkillSnapshot")(function* (
  source: RemoteSkillSource
): Effect.fn.Return<
  readonly [RemoteSkillSource, SkillSnapshot],
  SkillsCommandError,
  HttpClient.HttpClient | Crypto.Crypto
> {
  const tree = yield* fetchGitHubTree(source);
  if (tree.truncated) {
    return yield* SkillsCommandError.make({
      message: `GitHub tree response for ${source.source}@${source.ref} was truncated.`,
      skill: source.name,
    });
  }

  const skillRoot = source.skillPath.slice(0, source.skillPath.length - "/SKILL.md".length);
  const blobEntries = pipe(
    tree.tree,
    A.filter(
      (entry) => entry.type === "blob" && (entry.path === skillRoot || Str.startsWith(`${skillRoot}/`)(entry.path))
    ),
    A.sortWith((entry) => entry.path, Order.String)
  );

  if (blobEntries.length === 0) {
    return yield* SkillsCommandError.make({
      message: `No files found for ${source.name} at ${source.source}:${skillRoot}.`,
      skill: source.name,
    });
  }

  const files = yield* Effect.forEach(
    blobEntries,
    Effect.fnUntraced(function* (entry): Effect.fn.Return<SkillFile, SkillsCommandError, HttpClient.HttpClient> {
      const url = `https://raw.githubusercontent.com/${source.source}/${source.ref}/${entry.path}`;
      const bytes = yield* fetchResponseBytes(url);
      const relativePath = yield* validateSkillFilePath(entry.path.slice(skillRoot.length + 1), source.name);
      return {
        path: relativePath,
        bytes,
      };
    }),
    { concurrency: 6 }
  );

  return [source, { files, hash: yield* hashSkillFiles(files, source.name) }] as const;
});

const resolveSourcesToFetch = (
  selectedSkill: O.Option<string>
): Effect.Effect<ReadonlyArray<RemoteSkillSource>, SkillsCommandError> => {
  if (O.isNone(selectedSkill)) {
    return Effect.succeed(remoteSkillSources);
  }

  const source = remoteSkillSourcesByName[selectedSkill.value];
  if (source === undefined) {
    return Effect.fail(
      SkillsCommandError.make({
        message: `Unknown remote-backed skill "${selectedSkill.value}". Known remote skills: ${A.join(
          A.map(remoteSkillSources, (candidate) => candidate.name),
          ", "
        )}`,
        skill: selectedSkill.value,
      })
    );
  }

  return Effect.succeed([source]);
};

const writeRemoteSkill = Effect.fn("Skills.writeRemoteSkill")(function* (
  repoRoot: string,
  source: RemoteSkillSource,
  snapshot: SkillSnapshot
): Effect.fn.Return<void, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const skillDir = path.resolve(repoRoot, CLAUDE_SKILLS_DIR, source.name);
  yield* fs
    .remove(skillDir, { recursive: true, force: true })
    .pipe(SkillsCommandError.mapError(`Failed to remove stale skill directory ${skillDir}.`, skillDir, source.name));

  for (const file of snapshot.files) {
    const relativePath = yield* validateSkillFilePath(file.path, source.name);
    const writePath = path.resolve(skillDir, relativePath);
    const containmentPath = normalizeSlashes(path.relative(skillDir, writePath));
    if (!isSafeRelativeSkillFilePath(containmentPath)) {
      return yield* SkillsCommandError.make({
        message: `Refusing to write remote skill "${source.name}" outside ${skillDir}: ${file.path}`,
        file: file.path,
        skill: source.name,
      });
    }
    yield* writeByteFile(writePath, file.bytes);
  }
});

const readLockFile = Effect.fn("Skills.readLockFile")(function* (
  repoRoot: string
): Effect.fn.Return<O.Option<SkillLockFile>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const lockPath = path.join(repoRoot, SKILLS_LOCK_PATH);
  const content = yield* readExistingFile(lockPath);
  if (O.isNone(content)) {
    return O.none();
  }
  return yield* decodeLockText(content.value).pipe(
    Effect.asSome,
    SkillsCommandError.mapError(`Failed to parse ${SKILLS_LOCK_PATH}.`, lockPath)
  );
});

const makeLockEntry = (computedHash: string, source: O.Option<RemoteSkillSource>): SkillLockEntry => {
  if (O.isSome(source)) {
    return SkillLockEntry.make({
      source: source.value.source,
      sourceType: "github",
      ref: source.value.ref,
      skillPath: source.value.skillPath,
      computedHash,
    });
  }

  return SkillLockEntry.make({
    source: "repo-local",
    sourceType: "local",
    computedHash,
  });
};

const buildDesiredLock = Effect.fn("Skills.buildDesiredLock")(function* (
  repoRoot: string,
  snapshotsByName: Readonly<Record<string, SkillSnapshot>>
): Effect.fn.Return<SkillLockFile, SkillsCommandError, FileSystem.FileSystem | Path.Path | Crypto.Crypto> {
  const path = yield* Path.Path;
  const names = yield* listInstalledSkillNames(repoRoot);
  const entries: Array<readonly [string, SkillLockEntry]> = [];

  for (const name of names) {
    const source = O.fromUndefinedOr(remoteSkillSourcesByName[name]);
    const hash = snapshotsByName[name]?.hash;
    const computedHash =
      hash ??
      (yield* hashSkillDirectory(path.join(repoRoot, CLAUDE_SKILLS_DIR, name), name).pipe(
        Effect.flatMap(
          O.match({
            onNone: () =>
              Effect.fail(
                SkillsCommandError.make({
                  message: `Installed skill "${name}" does not contain hashable files.`,
                  skill: name,
                })
              ),
            onSome: Effect.succeed,
          })
        )
      ));
    entries.push([name, makeLockEntry(computedHash, source)]);
  }

  return SkillLockFile.make({
    version: 1,
    skills: toSortedRecord(entries),
  });
});

const renderLockFile = (lock: SkillLockFile): string => formatJsonValue(lock);

const tomlString = (value: string): string => Result.getOrThrow(encodeUnknownJsonResult(value));

const renderSkillsBlock = (names: ReadonlyArray<string>): string =>
  A.join(
    [
      "[skills]",
      "  include_instructions = true",
      ...A.flatMap(names, (name) => ["  [[skills.config]]", `    name = ${tomlString(name)}`, "    enabled = true"]),
      "",
    ],
    "\n"
  );

/**
 * Render `.codex/config.toml` with skills sourced from `.claude/skills`.
 *
 * **Example** (Render managed Codex skills configuration)
 *
 * ```ts
 * import { renderCodexConfigWithSkills } from "@beep/repo-cli/commands/Skills"
 *
 * const rendered = renderCodexConfigWithSkills("", ["grill-me"])
 * console.log(rendered.includes("[skills]")) // true
 * ```
 *
 * @param configText - Existing Codex config text.
 * @param names - Skill names to render into the managed skills table.
 * @returns Codex config text with the managed skills table replaced or appended.
 * @category commands
 * @since 0.0.0
 */
export const renderCodexConfigWithSkills: {
  (configText: string, names: ReadonlyArray<string>): string;
  (names: ReadonlyArray<string>): (configText: string) => string;
} = dual(2, (configText: string, names: ReadonlyArray<string>): string => {
  const lines = Str.split(configText, "\n");
  const start = A.findFirstIndex(lines, (line) => /^\s*\[skills\]\s*$/.test(line));
  const skillsBlock = renderSkillsBlock(names);

  if (O.isNone(start)) {
    const trimmed = Str.trimEnd(configText);
    return `${trimmed}\n\n${skillsBlock}`;
  }

  const nextTableRelative = A.findFirstIndex(
    A.drop(lines, start.value + 1),
    (line) => /^\s*\[/.test(line) && !/^\s*\[\[skills\.config\]\]\s*$/.test(line)
  );
  const end = O.match(nextTableRelative, {
    onNone: () => lines.length,
    onSome: (index) => start.value + 1 + index,
  });

  return A.join([...A.take(lines, start.value), skillsBlock, ...A.drop(lines, end)], "\n");
});

const renderDesiredCodexConfig = Effect.fn("Skills.renderDesiredCodexConfig")(function* (
  repoRoot: string
): Effect.fn.Return<string, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const configPath = path.join(repoRoot, CODEX_CONFIG_PATH);
  const existing = yield* readExistingFile(configPath).pipe(
    Effect.flatMap(
      O.match({
        onNone: () =>
          Effect.fail(
            SkillsCommandError.make({
              message: `Missing ${CODEX_CONFIG_PATH}.`,
              file: configPath,
            })
          ),
        onSome: Effect.succeed,
      })
    )
  );
  const names = yield* listInstalledSkillNames(repoRoot);
  const rendered = renderCodexConfigWithSkills(existing, names);
  yield* decodeCodexSkillsConfig(rendered).pipe(
    SkillsCommandError.mapError(`Rendered ${CODEX_CONFIG_PATH} is invalid TOML.`, configPath)
  );
  return rendered;
});

const agentsMirrorIsCurrent = Effect.fn("Skills.agentsMirrorIsCurrent")(function* (
  repoRoot: string
): Effect.fn.Return<boolean, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const agentsSkillsDir = path.join(repoRoot, AGENTS_SKILLS_DIR);
  const claudeSkillsDir = path.join(repoRoot, CLAUDE_SKILLS_DIR);
  const exists = yield* fs
    .exists(agentsSkillsDir)
    .pipe(SkillsCommandError.mapError(`Failed to check whether ${agentsSkillsDir} exists.`, agentsSkillsDir));

  if (!exists) {
    return false;
  }

  const agentsRealPath = yield* fs.realPath(agentsSkillsDir).pipe(
    SkillsCommandError.mapError(`Failed to resolve ${agentsSkillsDir}.`, agentsSkillsDir),
    Effect.orElseSucceed(() => "")
  );
  const claudeRealPath = yield* fs
    .realPath(claudeSkillsDir)
    .pipe(SkillsCommandError.mapError(`Failed to resolve ${claudeSkillsDir}.`, claudeSkillsDir));
  return agentsRealPath === claudeRealPath;
});

const writeAgentsMirror = Effect.fn("Skills.writeAgentsMirror")(function* (
  repoRoot: string
): Effect.fn.Return<void, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const agentsSkillsDir = path.join(repoRoot, AGENTS_SKILLS_DIR);
  yield* fs
    .makeDirectory(path.dirname(agentsSkillsDir), { recursive: true })
    .pipe(SkillsCommandError.mapError(`Failed to create ${path.dirname(agentsSkillsDir)}.`, agentsSkillsDir));
  yield* fs
    .remove(agentsSkillsDir, { recursive: true, force: true })
    .pipe(SkillsCommandError.mapError(`Failed to remove ${agentsSkillsDir}.`, agentsSkillsDir));
  yield* fs
    .symlink("../.claude/skills", agentsSkillsDir)
    .pipe(SkillsCommandError.mapError(`Failed to link ${agentsSkillsDir} to .claude/skills.`, agentsSkillsDir));
});

const driftLineFormatters = {
  RemoteSkillDrift: (drift): string => `- remote skill ${drift.name}`,
  LockDrift: (): string => `- ${SKILLS_LOCK_PATH}`,
  CodexConfigDrift: (): string => `- ${CODEX_CONFIG_PATH}`,
  AgentsMirrorDrift: (): string => `- ${AGENTS_SKILLS_DIR}`,
  HandEditedVendoredOutput: (drift): string =>
    `- hand-edited-vendored-output: ${drift.name} no longer matches its effective tree; revert it with beep skills materialize --skill ${drift.name}, or keep it as a patch under .agents/skill-patches/${drift.name} and re-record the lock with beep skills lock-plan (beep skills patch add is not available yet)`,
} satisfies { readonly [Tag in SkillDrift["_tag"]]: SkillDriftLineFormatter<Tag> };

const driftLine = (drift: SkillDrift): string => {
  const formatter = driftLineFormatters[drift._tag] as (value: SkillDrift) => string;
  return formatter(drift);
};

const printDriftReport = Effect.fn("Skills.printDriftReport")(function* (
  mode: SkillsRunMode,
  drift: ReadonlyArray<SkillDrift>
) {
  if (drift.length === 0) {
    yield* Console.log("skills:update: current");
    return;
  }

  const label = mode === "dry-run" ? "would update" : "drift";
  yield* Console.log(`skills:update: ${label} (${drift.length})`);
  for (const line of A.map(drift, driftLine)) {
    yield* Console.log(line);
  }
});

const frontmatterIssueLine = (skill: string, message: string): string =>
  `- ${skill}: ${Str.replace(/\n\s*/g, " ")(message)}`;

const printFrontmatterReport = Effect.fn("Skills.printFrontmatterReport")(function* (report: SkillFrontmatterReport) {
  for (const advisory of report.advisories) {
    yield* Console.log(
      `skills:update: advisory ${advisory.skill}/SKILL.md has ${advisory.lines} lines; the Agent Skills format recommends at most ${advisory.limit}. Move detail into references/.`
    );
  }
  for (const issue of report.upstreamIssues) {
    yield* Console.log(
      `skills:update: advisory upstream skill ${frontmatterIssueLine(issue.skill, issue.message).slice(2)}; fix it upstream or patch it through skills-lock, never by editing the mirror.`
    );
  }
  if (report.issues.length === 0) {
    return;
  }
  yield* Console.log(`skills:update: frontmatter issues (${report.issues.length})`);
  for (const issue of report.issues) {
    yield* Console.log(frontmatterIssueLine(issue.skill, issue.message));
  }
  yield* Console.log(
    "Agent Skills frontmatter allows name, description, license, compatibility, metadata, and allowed-tools, plus Claude Code's native keys; put repo extras such as version and status under metadata."
  );
});

const resolveMode = (check: boolean, dryRun: boolean): Effect.Effect<SkillsRunMode, SkillsCommandError> => {
  if (check && dryRun) {
    return Effect.fail(
      SkillsCommandError.make({
        message: "The --check and --dry-run flags are mutually exclusive.",
      })
    );
  }

  return Effect.succeed(check ? "check" : dryRun ? "dry-run" : "write");
};

const evaluateRemoteSkillDrift = Effect.fnUntraced(function* (
  repoRoot: string,
  fetchedSnapshots: ReadonlyArray<readonly [RemoteSkillSource, SkillSnapshot]>,
  mode: SkillsRunMode
) {
  const path = yield* Path.Path;
  const drift: Array<SkillDrift> = [];
  for (const [source, snapshot] of fetchedSnapshots) {
    const localHash = yield* hashSkillDirectory(path.join(repoRoot, CLAUDE_SKILLS_DIR, source.name), source.name);
    if (O.isNone(localHash) || localHash.value !== snapshot.hash) {
      drift.push({ _tag: "RemoteSkillDrift", name: source.name });
      if (mode === "write") {
        yield* writeRemoteSkill(repoRoot, source, snapshot);
      }
    }
  }
  return drift;
});

const evaluateLockDrift = Effect.fnUntraced(function* (
  repoRoot: string,
  snapshotsByName: Readonly<Record<string, SkillSnapshot>>,
  mode: SkillsRunMode
) {
  const path = yield* Path.Path;
  const desiredLock = yield* buildDesiredLock(repoRoot, snapshotsByName);
  const desiredLockText = renderLockFile(desiredLock);
  const lockPath = path.join(repoRoot, SKILLS_LOCK_PATH);
  yield* readLockFile(repoRoot).pipe(Effect.ignore);
  const currentLockText = yield* readExistingFile(lockPath);
  if (O.isSome(currentLockText) && currentLockText.value === desiredLockText) {
    return O.none<SkillDrift>();
  }
  if (mode === "write") {
    yield* writeStringFile(lockPath, desiredLockText);
  }
  return O.some<SkillDrift>({ _tag: "LockDrift" });
});

const evaluateCodexConfigDrift = Effect.fnUntraced(function* (repoRoot: string, mode: SkillsRunMode) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const desiredCodexConfig = yield* renderDesiredCodexConfig(repoRoot);
  const configPath = path.join(repoRoot, CODEX_CONFIG_PATH);
  const currentCodexConfig = yield* fs
    .readFileString(configPath)
    .pipe(SkillsCommandError.mapError(`Failed to read ${CODEX_CONFIG_PATH}.`, configPath));
  if (currentCodexConfig === desiredCodexConfig) {
    return O.none<SkillDrift>();
  }
  if (mode === "write") {
    yield* writeStringFile(configPath, desiredCodexConfig);
  }
  return O.some<SkillDrift>({ _tag: "CodexConfigDrift" });
});

const evaluateAgentsMirrorDrift = Effect.fnUntraced(function* (repoRoot: string, mode: SkillsRunMode) {
  if (yield* agentsMirrorIsCurrent(repoRoot)) {
    return O.none<SkillDrift>();
  }
  if (mode === "write") {
    yield* writeAgentsMirror(repoRoot);
  }
  return O.some<SkillDrift>({ _tag: "AgentsMirrorDrift" });
});

const readLockV2 = Effect.fn("Skills.readLockV2")(function* (
  repoRoot: string
): Effect.fn.Return<O.Option<SkillsLockDocument>, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const content = yield* readExistingFile(path.join(repoRoot, SKILLS_LOCK_PATH));
  if (O.isNone(content)) {
    return O.none();
  }
  // Fail closed: only a lock that declares version 1 is read as "no v2 lock"; any
  // other decode failure is an error, so refuseVendoredRefetch cannot be bypassed.
  return yield* decodeSkillsLockDocumentJson(content.value).pipe(
    Effect.asSome,
    Effect.catchTag("SchemaError", (error) =>
      decodeLegacyLockVersion(content.value).pipe(
        Effect.as(O.none<SkillsLockDocument>()),
        Effect.catchTag("SchemaError", () =>
          SkillsCommandError.make({
            message: `${SKILLS_LOCK_PATH} is neither a valid v2 lock nor a v1 lock: ${error.message}`,
            file: SKILLS_LOCK_PATH,
          })
        )
      )
    )
  );
});

// The legacy lock is recognized by its declared version alone.
const decodeLegacyLockVersion = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ version: S.Literal(1) })));

const vendoredEntryOf = (lock: O.Option<SkillsLockDocument>, name: string): O.Option<VendoredSkillLockEntry> =>
  O.flatMap(lock, (document) =>
    O.filter(R.get(document.skills, name), (entry): entry is VendoredSkillLockEntry => entry._tag === "vendored")
  );

// Contract 7: a vendored entry moves only through a pinned bump, never a floating refetch.
const refuseVendoredRefetch = (
  lock: O.Option<SkillsLockDocument>,
  selectedSkill: O.Option<string>
): Effect.Effect<void, SkillVendoredRefetchError> =>
  O.match(
    O.flatMap(selectedSkill, (name) => O.map(vendoredEntryOf(lock, name), (entry) => [name, entry] as const)),
    {
      onNone: () => Effect.void,
      onSome: ([name, entry]) =>
        Effect.fail(
          SkillVendoredRefetchError.make({
            skill: name,
            sourceRevision: entry.upstream.sourceRevision,
            message: `${name} is vendored at ${entry.upstream.sourceRevision}; skills update never refetches it at its floating ref ${entry.upstream.trackingRef}. Move it through a pinned bump: change upstream.sourceRevision (Renovate, B3), replay its .agents/skill-patches/${name} series, then run beep skills lock-plan --json and --write --expect <planDigest>.`,
          })
        ),
    }
  );

const floatingSources = Effect.fn("Skills.floatingSources")(function* (
  lock: O.Option<SkillsLockDocument>,
  sources: ReadonlyArray<RemoteSkillSource>
) {
  const isVendored = (source: RemoteSkillSource): boolean => O.isSome(vendoredEntryOf(lock, source.name));
  for (const source of A.filter(sources, isVendored)) {
    yield* Console.log(`skills:update: ${source.name} is vendored; skipping its floating refetch`);
  }
  return A.filter(sources, (source) => !isVendored(source));
});

const desiredLockEntry = Effect.fn("Skills.desiredLockEntry")(function* (
  repoRoot: string,
  current: SkillsLockDocument,
  name: string
): Effect.fn.Return<
  readonly [string, SkillsLockEntry],
  SkillsCommandError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto
> {
  const vendored = vendoredEntryOf(O.some(current), name);
  if (O.isSome(vendored)) {
    return [name, vendored.value] as const;
  }
  return [name, yield* computeLocalSkillLockEntry(repoRoot, name)] as const;
});

const skillsLockDocumentEquivalence = S.toEquivalence(SkillsLockDocument);

// Over a v2 lock, vendored entries are kept verbatim and local entries are recomputed from the
// installed trees with the same mode-aware hashing rule the plan uses. Drift is judged on the
// decoded document, so a lock whose bytes were only reformatted (key order, wrapping) is not
// drift and write mode leaves it alone.
const evaluateLockDriftV2 = Effect.fnUntraced(function* (
  repoRoot: string,
  current: SkillsLockDocument,
  mode: SkillsRunMode
) {
  const path = yield* Path.Path;
  const names = yield* listInstalledSkillNames(repoRoot);
  const entries = yield* Effect.forEach(names, (name) => desiredLockEntry(repoRoot, current, name));
  const desired = SkillsLockDocument.make({ version: 2, skills: toSortedRecord(entries) });
  if (skillsLockDocumentEquivalence(current, desired)) {
    return O.none<SkillDrift>();
  }
  if (mode === "write") {
    yield* writeStringFile(path.join(repoRoot, SKILLS_LOCK_PATH), yield* renderSkillsLockDocumentText(desired));
  }
  return O.some<SkillDrift>({ _tag: "LockDrift" });
});

// A vendored skill whose installed tree moved away from its effective tree was hand-edited
// (contract 3). It is reported in every mode and never rewritten here: the remedies are a
// patch that records the edit, or `skills materialize`, which rebuilds the verified tree.
const evaluateVendoredTreeDrift = Effect.fnUntraced(function* (repoRoot: string, current: SkillsLockDocument) {
  const vendored = A.flatMap(R.toEntries(current.skills), ([name, entry]) =>
    entry._tag === "vendored" ? [[name, entry] as const] : []
  );
  const drift = yield* Effect.forEach(
    vendored,
    Effect.fnUntraced(function* ([name, entry]) {
      const installed = yield* computeLocalSkillLockEntry(repoRoot, name);
      return installed.installedTreeHash === entry.effective.installedTreeHash
        ? A.empty<SkillDrift>()
        : A.of<SkillDrift>({ _tag: "HandEditedVendoredOutput", name });
    })
  );
  return A.flatten(drift);
});

const evaluateLockState = Effect.fnUntraced(function* (
  repoRoot: string,
  lock: O.Option<SkillsLockDocument>,
  snapshotsByName: Readonly<Record<string, SkillSnapshot>>,
  mode: SkillsRunMode
) {
  if (O.isNone(lock)) {
    return A.getSomes([yield* evaluateLockDrift(repoRoot, snapshotsByName, mode)]);
  }
  const vendoredDrift = yield* evaluateVendoredTreeDrift(repoRoot, lock.value);
  const lockDrift = yield* evaluateLockDriftV2(repoRoot, lock.value, mode);
  return A.appendAll(vendoredDrift, A.getSomes([lockDrift]));
});

/**
 * Run the skills update workflow.
 *
 * **Details**
 *
 * Over a v1 lock (or none) every known remote skill is refetched at its
 * floating ref and the v1 lock is rewritten. Over a `skills-lock/v2` lock the
 * vendored entries are pinned: naming one with `skill` refuses with
 * {@link SkillVendoredRefetchError}, a bulk run skips them, their entries are
 * kept verbatim, and an installed tree that moved away from its effective
 * tree is reported as `hand-edited-vendored-output`, naming both remedies: a
 * patch that keeps the edit, or `skills materialize`, which reverts it. Local
 * entries are recomputed from the installed trees.
 *
 * **Example** (Create the skills update workflow)
 *
 * ```ts
 * import { runSkillsUpdate } from "@beep/repo-cli/commands/Skills"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const program = runSkillsUpdate({ mode: "check", skill: O.none() })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runSkillsUpdate = Effect.fn("Skills.runSkillsUpdate")(function* (options: {
  readonly mode: SkillsRunMode;
  readonly skill: O.Option<string>;
}): Effect.fn.Return<
  ReadonlyArray<SkillDrift>,
  SkillsCommandError | SkillsDriftError | SkillFrontmatterError | SkillVendoredRefetchError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | HttpClient.HttpClient
> {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(SkillsCommandError.mapError("Failed to locate repository root."));
  const lock = yield* readLockV2(repoRoot);
  yield* refuseVendoredRefetch(lock, options.skill);
  const sources = yield* floatingSources(lock, yield* resolveSourcesToFetch(options.skill));
  const fetchedSnapshots = yield* Effect.forEach(sources, fetchRemoteSkillSnapshot, {
    concurrency: 3,
  });
  const snapshotsByName: Readonly<Record<string, SkillSnapshot>> = pipe(
    fetchedSnapshots,
    A.map(([source, snapshot]) => [source.name, snapshot] as const),
    R.fromEntries
  );
  const remoteDrift = yield* evaluateRemoteSkillDrift(repoRoot, fetchedSnapshots, options.mode);
  const frontmatterReport = yield* checkInstalledSkills(
    path.join(repoRoot, CLAUDE_SKILLS_DIR),
    yield* listInstalledSkillNames(repoRoot),
    HashSet.fromIterable(A.map(remoteSkillSources, (source) => source.name))
  );
  const lockDrift = yield* evaluateLockState(repoRoot, lock, snapshotsByName, options.mode);
  const configDrift = yield* evaluateCodexConfigDrift(repoRoot, options.mode);
  const mirrorDrift = yield* evaluateAgentsMirrorDrift(repoRoot, options.mode);
  const drift = A.appendAll(A.appendAll(remoteDrift, lockDrift), A.getSomes([configDrift, mirrorDrift]));

  yield* printDriftReport(options.mode, drift);
  yield* printFrontmatterReport(frontmatterReport);

  if (frontmatterReport.issues.length > 0) {
    return yield* SkillFrontmatterError.new(frontmatterReport.issues);
  }

  if (options.mode === "check" && drift.length > 0) {
    return yield* SkillsDriftError.new(drift.length, "Repo-local skills are stale.");
  }

  return drift;
});

const skillsUpdateCommand = Command.make(
  "update",
  {
    check: checkFlag,
    dryRun: dryRunFlag,
    skill: skillFlag,
  },
  Effect.fn(function* ({ check, dryRun, skill }) {
    const mode = yield* resolveMode(check, dryRun);
    yield* runSkillsUpdate({ mode, skill }).pipe(
      Effect.catchTags({
        SkillFrontmatterError: Effect.fn(function* (error) {
          yield* Console.error(`skills:update: ${error.message}`);
          return yield* failWithReportedExit(`skills:update: ${error.message}`);
        }),
        SkillsDriftError: Effect.fn(function* (error) {
          yield* Console.error(`skills:update: ${error.message}`);
          return yield* failWithReportedExit(`skills:update: ${error.message}`);
        }),
        SkillVendoredRefetchError: Effect.fn(function* (error) {
          yield* Console.error(`skills:update: ${error.message}`);
          return yield* failWithReportedExit(`skills:update: ${error.message}`);
        }),
        SkillsCommandError: Effect.fn(function* (error) {
          yield* Console.error(`skills:update: ${error.message}`);
          return yield* failWithReportedExit(`skills:update: ${error.message}`);
        }),
      })
    );
  })
).pipe(Command.withDescription("Update repo-local Claude/Codex skill mirrors from known upstream sources"));

const runSkillsProvenanceCommand = Effect.fn("Skills.runSkillsProvenanceCommand")(function* (options: {
  readonly json: boolean;
  readonly skill: string;
}): Effect.fn.Return<void, SkillsCommandError, FileSystem.FileSystem | Path.Path | SkillProvenanceService> {
  const repoRoot = yield* findRepoRoot().pipe(
    SkillsCommandError.mapError("Failed to locate repository root for skill provenance.")
  );
  const report = yield* runSkillProvenance(options.skill, repoRoot);
  yield* Console.log(
    options.json ? Str.trimEnd(renderSkillProvenanceJson(report)) : renderSkillProvenanceSummary(report)
  );
});

const skillsProvenanceCommand = Command.make(
  "provenance",
  {
    skill: provenanceSkillArgument,
    json: provenanceJsonFlag,
  },
  Effect.fn("Skills.provenanceCommand")(function* (options) {
    yield* runSkillsProvenanceCommand(options).pipe(
      Effect.catchTag(
        "SkillsCommandError",
        Effect.fn("Skills.provenanceCommand.reportError")(function* (error) {
          const message = `skills:provenance: ${error.message}`;
          yield* Console.error(message);
          return yield* failWithReportedExit(message);
        })
      )
    );
  })
).pipe(
  Command.withDescription("Report a would-be skills-lock/v2 entry without writing repository state"),
  Command.provide(SkillProvenanceServiceLive)
);

const runSkillsLockPlanCommand = Effect.fn("Skills.runSkillsLockPlanCommand")(function* (options: {
  readonly json: boolean;
  readonly write: boolean;
  readonly expect: O.Option<string>;
}) {
  const repoRoot = yield* findRepoRoot().pipe(
    SkillsCommandError.mapError("Failed to locate repository root for the skills lock plan.")
  );
  if (options.write) {
    const receipt = yield* writeSkillsLockMigration(repoRoot, options.expect);
    return yield* Console.log(Str.trimEnd(renderSkillsLockWriteReceiptJson(receipt)));
  }
  if (O.isSome(options.expect)) {
    return yield* SkillsCommandError.make({ message: "--expect only applies with --write." });
  }
  const plan = yield* planSkillsLockMigration(repoRoot);
  yield* Console.log(
    options.json ? Str.trimEnd(renderSkillsLockMigrationPlanJson(plan)) : renderSkillsLockMigrationPlanSummary(plan)
  );
});

const reportLockPlanError = Effect.fn("Skills.lockPlanCommand.reportError")(function* (error: {
  readonly message: string;
}) {
  const message = `skills:lock-plan: ${error.message}`;
  yield* Console.error(message);
  return yield* failWithReportedExit(message);
});

const skillsLockPlanCommand = Command.make(
  "lock-plan",
  {
    json: Flag.Boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print the skills-lock-migration-plan/v3 report as JSON")
    ),
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Write the reviewed plan named by --expect: skills-lock.json as v2 plus .agents/skill-patches, atomically"
      )
    ),
    expect: Flag.String("expect").pipe(
      Flag.optional,
      Flag.withDescription("The reviewed planDigest (from --json) that --write must match")
    ),
  },
  Effect.fn("Skills.lockPlanCommand")(function* (options) {
    yield* runSkillsLockPlanCommand(options).pipe(
      Effect.catchTags({ SkillsCommandError: reportLockPlanError, SkillsLockWriteRefusal: reportLockPlanError })
    );
  })
).pipe(
  Command.withDescription(
    "Plan the skills-lock v2 migration read-only, or write a reviewed plan with --write --expect <planDigest>"
  ),
  Command.provide(Layer.mergeAll(SkillUpstreamContentSourceLive, SkillPatchOwnerSourceLive))
);

const runSkillsMaterializeCommand = Effect.fn("Skills.runSkillsMaterializeCommand")(function* (options: {
  readonly check: boolean;
  readonly skill: O.Option<string>;
}) {
  const repoRoot = yield* findRepoRoot().pipe(
    SkillsCommandError.mapError("Failed to locate repository root for skills materialize.")
  );
  const materializer = yield* SkillMaterializer;
  const report = yield* materializer.materialize(repoRoot, options.check ? "check" : "write", options.skill);
  yield* Console.log(renderSkillMaterializeSummary(report));
  // --check fails on any difference; a write run fails only on what it cannot repair (local drift).
  const failing = A.filter(report.rows, (row) =>
    options.check ? row.status !== "current" : row.status === "local-drift"
  );
  if (A.isReadonlyArrayNonEmpty(failing)) {
    return yield* SkillsDriftError.new(
      A.length(failing),
      `${A.length(failing)} skill(s) differ from skills-lock.json: ${A.join(
        A.map(failing, (row) => `${row.skill} (${row.status})`),
        ", "
      )}. Vendored: run beep skills materialize. Local: run beep skills update.`
    );
  }
});

const reportMaterializeError = Effect.fn("Skills.materializeCommand.reportError")(function* (error: {
  readonly message: string;
}) {
  const message = `skills:materialize: ${error.message}`;
  yield* Console.error(message);
  return yield* failWithReportedExit(message);
});

const skillsMaterializeCommand = Command.make(
  "materialize",
  {
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Verify every installed tree against the lock without writing; fail on any difference")
    ),
    skill: Flag.String("skill").pipe(Flag.withDescription("Materialize or check one lock entry"), Flag.optional),
  },
  Effect.fn("Skills.materializeCommand")(function* (options) {
    yield* runSkillsMaterializeCommand(options).pipe(
      Effect.catchTags({
        SkillsCommandError: reportMaterializeError,
        SkillsDriftError: reportMaterializeError,
        SkillMaterializeRefusal: reportMaterializeError,
        SkillPatchApplyError: reportMaterializeError,
        SkillUpstreamContentError: reportMaterializeError,
      })
    );
  })
).pipe(
  Command.withDescription(
    "Rebuild vendored skill trees from their pinned upstream plus patch series, verified before written; --check verifies only"
  ),
  Command.provide(SkillMaterializerLive)
);

/**
 * Skills command group.
 *
 * **Example** (Create the skills command runner)
 *
 * ```ts
 * import { skillsCommand } from "@beep/repo-cli/commands/Skills"
 * import { Command } from "effect/cli"
 * import * as Effect from "effect/Effect";
 * const run = Command.run(skillsCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const skillsCommand = Command.make("skills", {}, () =>
  Console.log(
    "Skills commands:\n- bun run beep skills update\n- bun run beep skills update --check\n- bun run beep skills provenance <skill>\n- bun run beep skills lock-plan [--json]\n- bun run beep skills lock-plan --write --expect <planDigest>\n- bun run beep skills materialize [--check] [--skill <name>]"
  )
).pipe(
  Command.withDescription("Manage repo-local Claude and Codex skill mirrors"),
  Command.withSubcommands([
    skillsUpdateCommand,
    skillsProvenanceCommand,
    skillsLockPlanCommand,
    skillsMaterializeCommand,
  ])
);
