/**
 * File-backed append-only attempt store with an exclusive writer lock.
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocStructureRuleFamily } from "@beep/law-practice-domain";
import {
  OfficeActionStructureAttempt,
  OfficeActionStructureStorageError,
  OfficeActionStructureStore,
} from "@beep/law-practice-use-cases/OfficeActionStructure";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const storageError = (message: string) => OfficeActionStructureStorageError.make({ message });
const JsonAttempt = S.fromJsonString(OfficeActionStructureAttempt);
const DocumentKey = S.fromJsonString(S.Struct({ scope: S.String, document: S.String }));
const documentKey = (row: OfficeActionStructureAttempt) =>
  S.encodeSync(DocumentKey)({ scope: row.source.scopeRef, document: row.document.documentId });
const validateHistory = Effect.fn("OfficeActionStructureStore.validateHistory")(function* (
  rows: ReadonlyArray<OfficeActionStructureAttempt>
) {
  let ids = HashSet.empty<string>();
  let latest = HashMap.empty<string, string>();
  for (const row of rows) {
    if (HashSet.has(ids, row.attemptId)) return yield* storageError("Attempt ids are immutable and unique.");
    const key = documentKey(row);
    if (!O.makeEquivalence(Str.Equivalence)(HashMap.get(latest, key), row.previousAttemptId))
      return yield* storageError("Broken attempt predecessor chain.");
    ids = HashSet.add(ids, row.attemptId);
    latest = HashMap.set(latest, key, row.attemptId);
  }
  return rows;
});
/**
 * Builds a file-backed store that serializes appends under an exclusive lock.
 *
 * **Example** (Inspect officeActionStructureFileStore)
 *
 * ```ts
 * import { officeActionStructureFileStore } from "@beep/law-practice-server/OfficeActionStructure"
 * import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { DocStructureRuleFamily } from "@beep/law-practice-domain";
import * as Layer from "effect/Layer"
 * const layer = officeActionStructureFileStore("history/oa-attempts.jsonl")
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const officeActionStructureFileStore = (filename: string) =>
  Layer.effect(
    OfficeActionStructureStore,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs
        .makeDirectory(path.dirname(filename), { recursive: true })
        .pipe(Effect.mapError(() => storageError("Cannot initialize attempt directory.")));
      const lockfile = `${filename}.lock`;
      const withLock = <A, E>(effect: Effect.Effect<A, E>) =>
        Effect.acquireUseRelease(
          fs
            .writeFileString(lockfile, "office-action writer\n", { flag: "wx" })
            .pipe(Effect.mapError(() => storageError("Attempt writer lock unavailable."))),
          () => effect,
          () => fs.remove(lockfile).pipe(Effect.orDie)
        );
      const read = Effect.gen(function* () {
        const exists = yield* fs.exists(filename);
        if (!exists) return A.empty<OfficeActionStructureAttempt>();
        const text = yield* fs.readFileString(filename);
        if (text === "") return A.empty<OfficeActionStructureAttempt>();
        if (!Str.endsWith("\n")(text)) return yield* storageError("Incomplete attempt log.");
        const rows = yield* Effect.forEach(
          Str.split(Str.slice(0, -1)(text), "\n"),
          (line) => S.decodeEffect(JsonAttempt)(line),
          {
            concurrency: 1,
          }
        );
        return yield* validateHistory(rows);
      }).pipe(Effect.mapError(() => storageError("Cannot decode complete attempt history.")));
      const append = Effect.fn("OfficeActionStructureStore.append")(function* (attempt: OfficeActionStructureAttempt) {
        const rows = yield* read;
        if (A.some(rows, (row) => row.attemptId === attempt.attemptId))
          return yield* storageError("Attempt ids are immutable and unique.");
        const preceding = A.last(
          A.filter(
            rows,
            (row) =>
              row.document.documentId === attempt.document.documentId && row.source.scopeRef === attempt.source.scopeRef
          )
        );
        const expected = O.map(preceding, (row) => row.attemptId);
        if (!O.makeEquivalence(Str.Equivalence)(expected, attempt.previousAttemptId))
          return yield* storageError("Attempt predecessor must name the latest document attempt.");
        const encoded = yield* S.encodeEffect(JsonAttempt)(attempt).pipe(
          Effect.mapError(() => storageError("Cannot encode attempt receipt."))
        );
        yield* fs
          .writeFileString(filename, `${encoded}\n`, { flag: "a" })
          .pipe(Effect.mapError(() => storageError("Cannot append attempt receipt.")));
      });
      return OfficeActionStructureStore.of({
        read: withLock(read),
        find: (source, rule) =>
          withLock(
            Effect.map(
              read,
              A.filter(
                (row: OfficeActionStructureAttempt) =>
                  S.toEquivalence(SourceTextIdentity)(row.source, source) &&
                  S.toEquivalence(DocStructureRuleFamily)(row.rule, rule)
              )
            )
          ),
        append: (attempt) => withLock(append(attempt)),
      });
    })
  );
