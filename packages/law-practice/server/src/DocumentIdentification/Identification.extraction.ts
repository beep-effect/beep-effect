/**
 * Strict file reader for independently reviewed extraction batches.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  ConfirmedExtraction,
  CriticRecord,
  DocumentExtractionSource,
  DocumentExtractionSourceShape,
  ExtractionRecord,
  IdentificationError,
} from "@beep/law-practice-use-cases/DocumentIdentification";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as M from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("DocumentIdentification/Identification.extraction");
const invalid = () => IdentificationError.make({ operation: "extraction-read", reason: "invalid-input" });

/**
 * Explicit extractor batch directories; each holds extract.jsonl and critic.jsonl.
 * **Example** (Configure one batch)
 *
 * ```ts
 * import { ExtractionBatchesConfig } from "@beep/law-practice-server/DocumentIdentification"
 * console.log(ExtractionBatchesConfig.make({ directories: ["batch"] }).directories.length) // 1
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ExtractionBatchesConfig extends S.Class<ExtractionBatchesConfig>($I`ExtractionBatchesConfig`)(
  { directories: S.Array(S.NonEmptyString) },
  $I.annote("ExtractionBatchesConfig", { description: "Private extraction batch directories." })
) {}
/**
 * Extraction batch configuration tag.
 * **Example** (Supply no batches)
 *
 * ```ts
 * import { ExtractionBatchesLocation, ExtractionBatchesConfig } from "@beep/law-practice-server/DocumentIdentification"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(Layer.succeed(ExtractionBatchesLocation, ExtractionBatchesConfig.make({ directories: [] })))) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ExtractionBatchesLocation extends Context.Service<ExtractionBatchesLocation, ExtractionBatchesConfig>()(
  $I`ExtractionBatchesLocation`
) {}
const makeDocumentExtractionSourceFile = Effect.fn("DocumentIdentification.Identification.extraction.make")(
  function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const config = yield* ExtractionBatchesLocation;
    const extractions = M.empty<string, ExtractionRecord>();
    const critics = M.empty<string, CriticRecord>();
    const load = Effect.fnUntraced(function* <T extends S.Top & { readonly Type: { readonly id: string } }>(
      file: string,
      schema: T,
      target: M.MutableHashMap<string, T["Type"]>
    ) {
      const text = yield* fs
        .readFileString(file)
        .pipe(Effect.mapError(() => IdentificationError.make({ operation: "extraction-read", reason: "unavailable" })));
      for (const line of A.filter(Str.split(text, /\r?\n/u), (l) => Str.isNonEmpty(Str.trim(l)))) {
        const record = yield* S.decodeEffect(S.fromJsonString(schema))(line).pipe(Effect.mapError(invalid));
        const old = M.get(target, record.id);
        if (O.isSome(old) && !S.toEquivalence(schema)(old.value, record))
          return yield* IdentificationError.make({ operation: "extraction-read", reason: "conflicting-records" });
        M.set(target, record.id, record);
      }
    });
    for (const directory of config.directories) {
      yield* load(path.join(directory, "extract.jsonl"), ExtractionRecord, extractions);
      yield* load(path.join(directory, "critic.jsonl"), CriticRecord, critics);
    }
    const pairs = M.empty<string, ConfirmedExtraction>();
    for (const [id, record] of extractions) {
      const critic = M.get(critics, id);
      if (O.isNone(critic)) continue;
      if (
        A.some(critic.value.verdict.keepParties, (i) => i >= record.extraction.parties.length) ||
        A.some(critic.value.verdict.keepDockets, (i) => i >= record.extraction.dockets.length)
      )
        return yield* invalid();
      M.set(pairs, id, ConfirmedExtraction.make({ extraction: record.extraction, verdict: critic.value.verdict }));
    }
    return DocumentExtractionSourceShape.make({ extraction: (id) => Effect.succeed(M.get(pairs, id)) });
  }
);

/**
 * Loads matched extraction and critic records, rejecting malformed lines, bad indexes and conflicting ids.
 * Missing critic or extractor records yield None; no unreviewed facts are returned.
 * **Example** (Inspect the extraction layer)
 *
 * ```ts
 * import { DocumentExtractionSourceFile } from "@beep/law-practice-server/DocumentIdentification"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(DocumentExtractionSourceFile)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentExtractionSourceFile = Layer.effect(DocumentExtractionSource, makeDocumentExtractionSourceFile());
