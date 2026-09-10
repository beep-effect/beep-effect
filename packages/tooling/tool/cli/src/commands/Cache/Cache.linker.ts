/**
 * Bounded glibc startup linkage discovery for qualification runtime identity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Duration, Effect, FileSystem, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { hashFileSha256 } from "../../internal/cli/FsGuards.ts";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import {
  CacheCommandError,
  CacheLinkedFile,
  CacheLinkerResolution,
  CacheRuntimeExecutable,
  CacheRuntimeLinkerSnapshot,
} from "./Cache.schemas.ts";

const detector = "/usr/bin/ldd";
const loader = "/lib64/ld-linux-x86-64.so.2";
const vdsoLine = S.String.check(S.isPattern(/^linux-vdso\.so\.1 \(0x[0-9a-f]+\)$/));
const libraryLine = /^(?:[^\s]+ => )?(\/[^\0\r\n]+) \(0x[0-9a-f]+\)$/;
const hash = (file: string) =>
  hashFileSha256(file, (cause) => CacheCommandError.new("Cannot hash runtime linkage evidence.", cause));
const decodeLinkedFileParts = S.decodeUnknownEffect(S.Tuple([S.String, CacheLinkedFile.fields.path]));

/**
 * Parse a successful bounded glibc ldd listing, rejecting unresolved or unknown lines.
 *
 * **Details**
 *
 * Empty output is invalid. Only the exact static-linkage diagnostic produces
 * an empty list. Kernel-provided vDSO addresses are excluded from file identity.
 *
 * **Example** (Decode explicit static linkage)
 *
 * ```ts
 * import { parseCacheLinkerOutput } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const inspection = parseCacheLinkerOutput("\tstatically linked\n")
 * console.assert(Effect.isEffect(inspection))
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseCacheLinkerOutput = Effect.fn("CacheLinker.parse")(function* (output: string) {
  const text = Str.trim(output);
  if (text === "statically linked") return [];
  const paths = yield* Effect.forEach(
    Str.split(text, "\n"),
    Effect.fn("CacheLinker.line")(function* (line) {
      const normalized = Str.trim(line);
      if (S.is(vdsoLine)(normalized)) return O.none<string>();
      const match = yield* Str.match(libraryLine)(normalized).pipe(
        Effect.fromOption(() => CacheCommandError.new("Unsupported or unresolved glibc library listing."))
      );
      const [, file] = yield* decodeLinkedFileParts(match);
      return O.some(file);
    })
  ).pipe(Effect.map(A.getSomes));
  if (paths.length === 0 || paths.length > 256 || A.dedupe(paths).length !== paths.length)
    return yield* CacheCommandError.new("Library listing is empty, duplicated or exceeds its file bound.");
  return A.sort(paths, Order.String);
}, CacheCommandError.mapError("Cannot parse startup library resolution."));

/**
 * Bind a runtime file alias to a bounded physical file and its content digest.
 *
 * **Example** (Inspect a loader alias)
 *
 * ```ts
 * import { inspectCacheLinkedFile } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(inspectCacheLinkedFile("/lib64/ld-linux-x86-64.so.2")))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const inspectCacheLinkedFile = Effect.fn("CacheLinker.file")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const target = yield* fs.realPath(file);
  const info = yield* fs.stat(target);
  if (info.type !== "File" || info.size > BigInt(128 * 1024 * 1024))
    return yield* CacheCommandError.new("Runtime library must be a regular file within the 128 MiB bound.");
  const sha256 = yield* hash(target);
  if ((yield* fs.realPath(file)) !== target)
    return yield* CacheCommandError.new("Runtime library alias changed during inspection.");
  return CacheLinkedFile.make({ path: file, target, sha256 });
}, CacheCommandError.mapError("Cannot inspect a runtime library file."));

/**
 * Discover and hash one installed executable's clean-environment startup libraries.
 *
 * **Example** (Plan shell linkage discovery)
 *
 * ```ts
 * import { inspectCacheLinkerResolution } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(inspectCacheLinkerResolution("/repo", "/usr/bin/bash")))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const inspectCacheLinkerResolution = Effect.fn("CacheLinker.inspect")(function* (
  root: string,
  executable: string
) {
  const before = yield* hash(executable);
  const result = yield* runCapturedStreams({
    command: detector,
    args: ["--", executable],
    cwd: root,
    extendEnv: false,
    env: { PATH: "/usr/bin", LANG: "C", LC_ALL: "C" },
    bound: OutputBound.make({ maxChars: 16384, truncatedNotice: "[library listing exceeds limit]" }),
  }).pipe(Effect.timeout(Duration.seconds(10)));
  if (result.exitCode !== 0 || result.truncated || Str.trim(result.stderr) !== "")
    return yield* CacheCommandError.new("Startup library discovery failed or exceeded its capture bound.");
  const paths = yield* parseCacheLinkerOutput(result.stdout);
  const files = yield* Effect.forEach(paths, inspectCacheLinkedFile, { concurrency: 1 });
  if ((yield* hash(executable)) !== before)
    return yield* CacheCommandError.new("Executable changed during library discovery.");
  return A.match(files, {
    onEmpty: () => CacheLinkerResolution.cases.Static.make({}),
    onNonEmpty: (files) => CacheLinkerResolution.cases.Dynamic.make({ files }),
  });
}, CacheCommandError.mapError("Cannot discover executable startup libraries."));
const decodeLinkerExecutables = S.decodeUnknownEffect(CacheRuntimeLinkerSnapshot.fields.executables);

/**
 * Collect all supported executable linkages with stable detector and loader pins.
 *
 * **Example** (Plan a complete runtime observation)
 *
 * ```ts
 * import { collectCacheRuntimeLinker } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const inspect = collectCacheRuntimeLinker("/repo", {
 *   bun: "/tools/bun", node: "/tools/node", turbo: "/tools/turbo",
 *   biome: "/tools/biome", bash: "/usr/bin/bash", sh: "/usr/bin/sh",
 * })
 * console.assert(Effect.isEffect(inspect))
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const collectCacheRuntimeLinker = Effect.fn("CacheLinker.collect")(function* (
  root: string,
  executables: Readonly<Record<CacheRuntimeExecutable, string>>
) {
  const detectorBefore = yield* inspectCacheLinkedFile(detector);
  const loaderBefore = yield* inspectCacheLinkedFile(loader);
  const resolutions = R.fromEntries(
    yield* Effect.forEach(
      CacheRuntimeExecutable.Options,
      Effect.fn("CacheLinker.role")(function* (role) {
        return Tuple.make(role, yield* inspectCacheLinkerResolution(root, executables[role]));
      }),
      { concurrency: 1 }
    )
  );
  if (
    !S.toEquivalence(CacheLinkedFile)(detectorBefore, yield* inspectCacheLinkedFile(detector)) ||
    !S.toEquivalence(CacheLinkedFile)(loaderBefore, yield* inspectCacheLinkedFile(loader))
  )
    return yield* CacheCommandError.new("Library discovery helper or loader changed during inspection.");
  return CacheRuntimeLinkerSnapshot.make({
    format: "glibc-ldd/v1",
    detector: detectorBefore,
    loader: loaderBefore,
    executables: yield* decodeLinkerExecutables(resolutions),
  });
}, CacheCommandError.mapError("Cannot fingerprint runtime startup linkage."));
