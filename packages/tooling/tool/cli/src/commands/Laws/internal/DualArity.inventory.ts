/**
 * Inventory persistence and bookkeeping for the public API dual-arity law.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import { isExcludedTypeScriptSourcePath, toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { A, Str } from "@beep/utils";
import { Effect, FileSystem, Inspectable, MutableHashSet, Path } from "effect";
import * as O from "effect/Option";
import { readArtifact, writeArtifact } from "../../../internal/artifacts/index.js";
import { DualArityInventoryReadError } from "../Laws.errors.js";
import {
  DualArityInventoryDocument,
  DualArityInventoryPath,
  encodeDualArityInventoryDocument,
} from "../Laws.schemas.js";
import type { DualArityInventoryEntry } from "../Laws.schemas.js";

const readDocument = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), DualArityInventoryPath);

  if (!(yield* fs.exists(absolutePath))) {
    return O.none<DualArityInventoryDocument>();
  }

  const document = yield* readArtifact({
    path: absolutePath,
    schema: DualArityInventoryDocument,
    onReadError: (cause) =>
      DualArityInventoryReadError.new(
        `Unable to read ${DualArityInventoryPath}: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
    onDecodeError: (cause) =>
      DualArityInventoryReadError.new(
        `Unable to parse ${DualArityInventoryPath}: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
  });

  return O.some(document);
});

const writeDocument = Effect.fn("DualArity.writeInventoryDocument")(function* (document: DualArityInventoryDocument) {
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), DualArityInventoryPath);
  const encodedDocument = yield* encodeDualArityInventoryDocument(document);
  const serialized = yield* renderBiomeJson(absolutePath, encodedDocument);
  yield* writeArtifact({
    path: absolutePath,
    body: serialized,
    onError: (cause) =>
      DualArityInventoryReadError.new(
        `Unable to write ${DualArityInventoryPath}: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
  });
});

const isExcludedFile = (input: {
  readonly excludePaths: MutableHashSet.MutableHashSet<string>;
  readonly filePath: string;
}): boolean => {
  const normalized = toPosixPath(input.filePath);
  return MutableHashSet.has(input.excludePaths, normalized) || isExcludedTypeScriptSourcePath(normalized);
};

const isEnforcedFile = (input: { readonly document: DualArityInventoryDocument; readonly filePath: string }): boolean =>
  A.some(input.document.enforcedRoots, (root) => input.filePath === root || Str.startsWith(`${root}/`)(input.filePath));

const getInvalidExceptions = (document: DualArityInventoryDocument): ReadonlyArray<DualArityInventoryEntry> =>
  A.filter(
    document.entries,
    (entry) =>
      entry.status === "exception" && (Str.isEmpty(Str.trim(entry.owner)) || Str.isEmpty(Str.trim(entry.reason)))
  );

/**
 * Internal inventory adapter for the dual-arity law.
 *
 * @example
 * ```ts
 * console.log("DualArityInventory")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const DualArityInventory = {
  getInvalidExceptions,
  isEnforcedFile,
  isExcludedFile,
  readDocument,
  writeDocument,
} as const;
