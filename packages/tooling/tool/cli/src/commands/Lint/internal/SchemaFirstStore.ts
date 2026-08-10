/**
 * JSONC persistence for the schema-first inventory and policy documents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, FileSystem, Inspectable, Path } from "effect";
import * as O from "effect/Option";
import { formatJsonc, readArtifact, writeArtifact } from "../../../internal/artifacts/index.ts";
import { SchemaFirstInventoryReadError } from "../Lint.errors.ts";
import {
  encodeSchemaFirstInventoryDocument,
  SchemaCrispeningPolicyDocument,
  SchemaCrispeningPolicyPath,
  SchemaFirstInventoryDocument,
  SchemaFirstInventoryPath,
} from "../Lint.schemas.ts";

/**
 * Read and decode the tracked schema-first inventory document, failing with
 * `SchemaFirstInventoryReadError` when the file exists but cannot be decoded.
 *
 * **Gotchas**
 *
 * A missing inventory file yields `Option.none` (fresh repo); a malformed one
 * fails loudly — the sanctioned replacement for the former silent
 * parse-swallow.
 *
 * @category utilities
 * @since 0.0.0
 */
export const readSchemaFirstInventoryDocument = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), SchemaFirstInventoryPath);

  if (!(yield* fs.exists(absolutePath))) {
    return O.none<SchemaFirstInventoryDocument>();
  }

  const document = yield* readArtifact({
    path: absolutePath,
    schema: SchemaFirstInventoryDocument,
    onReadError: (cause) =>
      SchemaFirstInventoryReadError.new(
        `Unable to read ${SchemaFirstInventoryPath}: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
    onDecodeError: (cause) =>
      SchemaFirstInventoryReadError.new(
        `Unable to parse ${SchemaFirstInventoryPath}: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
  });

  return O.some(document);
});

/**
 * Read the optional crispening policy document, yielding `Option.none` when
 * the file is absent or unreadable (policy participation is opt-in).
 *
 * @category utilities
 * @since 0.0.0
 */
export const readCrispeningPolicyDocument = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), SchemaCrispeningPolicyPath);

  if (!(yield* fs.exists(absolutePath))) {
    return O.none<SchemaCrispeningPolicyDocument>();
  }

  return yield* readArtifact({
    path: absolutePath,
    schema: SchemaCrispeningPolicyDocument,
    onReadError: (cause) =>
      SchemaFirstInventoryReadError.new(
        `Unable to read ${SchemaCrispeningPolicyPath}: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
    onDecodeError: (cause) =>
      SchemaFirstInventoryReadError.new(
        `Unable to parse ${SchemaCrispeningPolicyPath}: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
  }).pipe(Effect.option);
});

/**
 * Serialize and write the schema-first inventory document to its tracked
 * standards path, preserving the JSONC header and trailing-newline format.
 *
 * @category utilities
 * @since 0.0.0
 */
export const writeSchemaFirstInventoryDocument = Effect.fn("writeInventoryDocument")(function* (
  document: SchemaFirstInventoryDocument
) {
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), SchemaFirstInventoryPath);
  const encodedDocument = yield* encodeSchemaFirstInventoryDocument(document);
  const serialized = yield* formatJsonc(encodedDocument);
  yield* writeArtifact({
    path: absolutePath,
    body: serialized,
    onError: (cause) =>
      SchemaFirstInventoryReadError.new(
        `Unable to write ${SchemaFirstInventoryPath}: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
  });
});
