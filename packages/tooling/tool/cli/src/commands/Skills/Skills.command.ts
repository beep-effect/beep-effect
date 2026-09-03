/**
 * Repo-local agent skill synchronization command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { decodeTomlTextAs } from "@beep/schema/Toml";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, O, Str } from "@beep/utils";
import { Console, Crypto, Effect, Encoding, FileSystem, Order, Path, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { asArrayBufferView, concatBytes } from "../../internal/cli/Bytes.ts";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { formatJsonValue } from "../../internal/cli/Json.ts";
import { SkillsCommandError, SkillsDriftError } from "./Skills.errors.ts";
import { renderSkillProvenanceJson, renderSkillProvenanceSummary } from "./Skills.render.ts";
import { runSkillProvenance, SkillProvenanceServiceLive } from "./Skills.service.ts";
import type { SkillProvenanceService } from "./Skills.service.ts";

// cspell:ignore mattpocock Gebert

const $I = $RepoCliId.create("commands/Skills/Skills.command");

const CLAUDE_SKILLS_DIR = ".claude/skills";
const AGENTS_SKILLS_DIR = ".agents/skills";
const CODEX_CONFIG_PATH = ".codex/config.toml";
const SKILLS_LOCK_PATH = "skills-lock.json";

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
const encodeUnknownJsonResult = UnknownFromJsonString.encodeUnknownResult;

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
const decodeCodexSkillsConfig = decodeTomlTextAs(SuspendCodexSkillsConfig);

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

const checkFlag = Flag.boolean("check").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Report skill drift without writing files and exit non-zero when changes are needed")
);
const dryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Preview skill updates without writing files or failing on drift")
);
const skillFlag = Flag.string("skill").pipe(
  Flag.withDescription("Update or check one known GitHub-backed skill"),
  Flag.optional
);
const provenanceSkillArgument = Argument.string("skill").pipe(
  Argument.withDescription("Installed skill to resolve; the P1 pilot supports shadcn")
);
const provenanceJsonFlag = Flag.boolean("json").pipe(
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
  return Encoding.encodeHex(digest);
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

const readInstalledSkillNames = Effect.fn("Skills.readInstalledSkillNames")(function* (
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
  const names: Array<string> = [];

  for (const entry of A.sort(entries, Order.String)) {
    const skillDir = path.join(skillsDir, entry);
    const skillFile = path.join(skillDir, "SKILL.md");
    const stat = yield* fs.stat(skillDir).pipe(Effect.orElseSucceed(() => undefined));
    const hasSkillFile = yield* fs.exists(skillFile).pipe(Effect.orElseSucceed(() => false));
    if (stat?.type === "Directory" && hasSkillFile) {
      names.push(entry);
    }
  }

  return names;
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
  const names = yield* readInstalledSkillNames(repoRoot);
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
  const names = yield* readInstalledSkillNames(repoRoot);
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

/**
 * Run the skills update workflow.
 *
 * **Example** (Create the skills update workflow)
 *
 * ```ts
 * import { runSkillsUpdate } from "@beep/repo-cli/commands/Skills"
 * import { Effect } from "effect"
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
  SkillsCommandError | SkillsDriftError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | HttpClient.HttpClient
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(SkillsCommandError.mapError("Failed to locate repository root."));
  const sources = yield* resolveSourcesToFetch(options.skill);
  const fetchedSnapshots = yield* Effect.forEach(sources, fetchRemoteSkillSnapshot, {
    concurrency: 3,
  });
  const snapshotsByName: Readonly<Record<string, SkillSnapshot>> = pipe(
    fetchedSnapshots,
    A.map(([source, snapshot]) => [source.name, snapshot] as const),
    R.fromEntries
  );
  const drift: Array<SkillDrift> = [];

  for (const [source, snapshot] of fetchedSnapshots) {
    const localHash = yield* hashSkillDirectory(path.join(repoRoot, CLAUDE_SKILLS_DIR, source.name), source.name);
    if (O.isNone(localHash) || localHash.value !== snapshot.hash) {
      drift.push({ _tag: "RemoteSkillDrift", name: source.name });
      if (options.mode === "write") {
        yield* writeRemoteSkill(repoRoot, source, snapshot);
      }
    }
  }

  const desiredLock = yield* buildDesiredLock(repoRoot, snapshotsByName);
  const desiredLockText = renderLockFile(desiredLock);
  const lockPath = path.join(repoRoot, SKILLS_LOCK_PATH);
  yield* readLockFile(repoRoot).pipe(Effect.ignore);
  const currentLockText = yield* readExistingFile(lockPath);
  if (O.isNone(currentLockText) || currentLockText.value !== desiredLockText) {
    drift.push({ _tag: "LockDrift" });
    if (options.mode === "write") {
      yield* writeStringFile(lockPath, desiredLockText);
    }
  }

  const desiredCodexConfig = yield* renderDesiredCodexConfig(repoRoot);
  const configPath = path.join(repoRoot, CODEX_CONFIG_PATH);
  const currentCodexConfig = yield* fs
    .readFileString(configPath)
    .pipe(SkillsCommandError.mapError(`Failed to read ${CODEX_CONFIG_PATH}.`, configPath));
  if (currentCodexConfig !== desiredCodexConfig) {
    drift.push({ _tag: "CodexConfigDrift" });
    if (options.mode === "write") {
      yield* writeStringFile(configPath, desiredCodexConfig);
    }
  }

  const mirrorCurrent = yield* agentsMirrorIsCurrent(repoRoot);
  if (!mirrorCurrent) {
    drift.push({ _tag: "AgentsMirrorDrift" });
    if (options.mode === "write") {
      yield* writeAgentsMirror(repoRoot);
    }
  }

  yield* printDriftReport(options.mode, drift);

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
        SkillsDriftError: Effect.fn(function* (error) {
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

/**
 * Skills command group.
 *
 * **Example** (Create the skills command runner)
 *
 * ```ts
 * import { skillsCommand } from "@beep/repo-cli/commands/Skills"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(skillsCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const skillsCommand = Command.make("skills", {}, () =>
  Console.log(
    "Skills commands:\n- bun run beep skills update\n- bun run beep skills update --check\n- bun run beep skills provenance shadcn"
  )
).pipe(
  Command.withDescription("Manage repo-local Claude and Codex skill mirrors"),
  Command.withSubcommands([skillsUpdateCommand, skillsProvenanceCommand])
);
