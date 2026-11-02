/**
 * Reading a vendored entry's patch series, verified against the lock, shared
 * by the materializer and the update train.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { SkillMaterializeRefusal, SkillsCommandError } from "../Skills.errors.ts";
import { PATCH_ROOT } from "./PatchStaging.ts";
import { hashBytes, patchSetHashOf, validateRelativePath } from "./SkillTree.ts";
import type * as Digest from "effect/crypto/Digest";
import type { VendoredSkillLockEntry } from "../SkillsLock.schemas.ts";

const $I = $RepoCliId.create("commands/Skills/internal/PatchSeries");
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/**
 * One patch file of a series: its repo-relative path and exact bytes.
 *
 * **Example** (Describe a patch file)
 *
 * ```ts
 * import { PatchSeriesFile } from "@beep/repo-cli/commands/Skills/internal/PatchSeries"
 *
 * const patch = PatchSeriesFile.make({ path: "patches/001.patch", bytes: new Uint8Array() })
 * console.log(patch.path)
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class PatchSeriesFile extends S.Opaque<PatchSeriesFile, { readonly brand: unique symbol }>()(
  S.Struct({ path: S.String, bytes: S.Uint8Array }).pipe(
    $I.annoteSchema("PatchSeriesFile", {
      description: "A verified patch file's repository-relative path and exact bytes.",
    })
  )
) {}

const refuseDigest = (skill: string, message: string) =>
  Effect.fail(SkillMaterializeRefusal.make({ skill, reason: "patch-digest-mismatch", message }));

const readPatch = Effect.fn("SkillsMaterialize.readPatch")(function* (
  repoRoot: string,
  skill: string,
  patch: VendoredSkillLockEntry["patches"]["series"][number]
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const relative = yield* validateRelativePath(patch.path, skill);
  if (!Str.startsWith(`${PATCH_ROOT}/${skill}/`)(relative)) {
    return yield* refuseDigest(skill, `Patch ${patch.path} is not under ${PATCH_ROOT}/${skill}/.`);
  }
  const absolute = path.join(repoRoot, relative);
  const bytes = yield* fs
    .readFile(absolute)
    .pipe(SkillsCommandError.mapError(`Failed to read the patch ${patch.path}.`, absolute, skill));
  const sha256 = yield* hashBytes(bytes, patch.path);
  if (!Str.Equivalence(sha256, patch.sha256)) {
    return yield* refuseDigest(skill, `Patch ${patch.path} hashes to ${sha256}, but the lock records ${patch.sha256}.`);
  }
  return PatchSeriesFile.make({ path: patch.path, bytes });
});

/**
 * Reads every patch of a vendored entry's series, in order, refusing unless
 * each file matches its recorded digest and the series matches
 * `patches.patchSetHash`.
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const readVerifiedPatchSeries = Effect.fn("SkillsMaterialize.readVerifiedPatchSeries")(function* (
  repoRoot: string,
  skill: string,
  entry: VendoredSkillLockEntry
): Effect.fn.Return<
  ReadonlyArray<PatchSeriesFile>,
  SkillsCommandError | SkillMaterializeRefusal,
  FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  const patches = yield* Effect.forEach(entry.patches.series, (patch) => readPatch(repoRoot, skill, patch));
  const patchSetHash = yield* patchSetHashOf(patches, skill);
  if (!Str.Equivalence(patchSetHash, entry.patches.patchSetHash)) {
    return yield* refuseDigest(
      skill,
      `The ${skill} patch series hashes to ${patchSetHash}, but the lock records ${entry.patches.patchSetHash}.`
    );
  }
  return patches;
});

/**
 * Decodes a patch file as strict UTF-8 text.
 *
 * @internal
 * @param skill - The skill the patch belongs to, named in a decode failure.
 * @param patch - The patch path and bytes read from the series.
 * @returns The patch text; bytes that are not UTF-8 fail typed.
 * @category parsing
 * @since 0.0.0
 */
export const decodePatchText = Effect.fn("SkillsMaterialize.decodePatchText")(function* (
  skill: string,
  patch: PatchSeriesFile
): Effect.fn.Return<string, SkillsCommandError> {
  return yield* Effect.try({
    try: () => textDecoder.decode(patch.bytes),
    catch: (cause) => SkillsCommandError.new(cause, `Patch ${patch.path} is not UTF-8 text.`, patch.path, skill),
  });
});
