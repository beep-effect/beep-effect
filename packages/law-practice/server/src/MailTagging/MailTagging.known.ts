/**
 * The known-documents port over the private JSONL index of files the
 * document system already holds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { KnownDocuments, KnownDocumentsShape } from "@beep/law-practice-use-cases/MailTagging";
import { Context, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decodeLines, makeStateFileAt } from "../internal/MailTaggingStateFile.ts";
import type { KnownDocumentRequest, MailTaggingStateError } from "@beep/law-practice-use-cases/MailTagging";
import type { FileSystem, Path } from "effect";

const $I = $LawPracticeServerId.create("MailTagging/MailTagging.known");

/**
 * One line of the known-documents index: content the document system holds
 * for a matter.
 *
 * **Details**
 *
 * The index also records the file's id and path; the adapter reads only the
 * hash and the family key and ignores every other key. The hash is accepted
 * in either letter case and compared in lowercase.
 *
 * **Example** (Describe one known document)
 *
 * ```ts
 * import { KnownDocument } from "@beep/law-practice-server/MailTagging"
 *
 * const known = KnownDocument.make({
 *   sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   familyKey: "1234.10001"
 * })
 * console.log(known.familyKey) // "1234.10001"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnownDocument extends S.Class<KnownDocument>($I`KnownDocument`)(
  {
    sha256: S.String.check(
      S.isPattern(/^[0-9a-fA-F]{64}$/u, {
        identifier: $I`KnownDocumentSha256PatternCheck`,
        title: "Known Document SHA-256",
        description: "A SHA-256 digest as 64 hexadecimal characters in either case.",
        message: "Known-document hash must be 64 hexadecimal characters.",
      })
    ).annotateKey({
      description: "SHA-256 of the file's content.",
    }),
    familyKey: S.NonEmptyString.annotateKey({
      description: "Practice-KG family key of the matter the file is filed under.",
    }),
  },
  $I.annote("KnownDocument", {
    description: "Content hash and matter of one file the document system already holds.",
  })
) {}

/**
 * JSON codec of one known-documents index line.
 *
 * **Example** (Guard a decoded line)
 *
 * ```ts
 * import { KnownDocumentJsonLine } from "@beep/law-practice-server/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(KnownDocumentJsonLine)({ sha256: "abc", familyKey: "1234.10001" })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KnownDocumentJsonLine = S.fromJsonString(KnownDocument).pipe(
  $I.annoteSchema("KnownDocumentJsonLine", {
    description: "One JSON line of the known-documents index.",
  })
);

/**
 * Runtime type for {@link KnownDocumentJsonLine}.
 *
 * @category models
 * @since 0.0.0
 */
export type KnownDocumentJsonLine = typeof KnownDocumentJsonLine.Type;

/**
 * Where the private known-documents index lives.
 *
 * **Example** (Name the index file)
 *
 * ```ts
 * import { KnownDocumentsConfig } from "@beep/law-practice-server/MailTagging"
 *
 * const config = KnownDocumentsConfig.make({ path: "state/box-onboarding/box-files.jsonl" })
 * console.log(config.path) // "state/box-onboarding/box-files.jsonl"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class KnownDocumentsConfig extends S.Class<KnownDocumentsConfig>($I`KnownDocumentsConfig`)(
  {
    path: S.NonEmptyString.annotateKey({
      description: "Full path of the known-documents JSONL index.",
    }),
  },
  $I.annote("KnownDocumentsConfig", {
    description: "Location of the private known-documents index.",
  })
) {}

/**
 * Service tag carrying the known-documents index's location.
 *
 * **Example** (Provide the index location)
 *
 * ```ts
 * import { KnownDocumentsConfig, KnownDocumentsLocation } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Location = Layer.succeed(
 *   KnownDocumentsLocation,
 *   KnownDocumentsConfig.make({ path: "state/box-onboarding/box-files.jsonl" })
 * )
 * console.log(Layer.isLayer(Location)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class KnownDocumentsLocation extends Context.Service<KnownDocumentsLocation, KnownDocumentsConfig>()(
  $I`KnownDocumentsLocation`
) {}

const decodeKnownDocument = S.decodeUnknownEffect(KnownDocumentJsonLine);

// A hash is 64 hexadecimal characters, so a space cannot collide with either half.
const knownKey = (sha256: string, familyKey: string): string => `${Str.toLowerCase(sha256)} ${familyKey}`;

const makeKnownDocuments = Effect.gen(function* () {
  const location = yield* KnownDocumentsLocation;
  const file = yield* makeStateFileAt("known-documents", location.path);
  const text = yield* file.readRequired;
  const documents = yield* decodeLines({ decode: decodeKnownDocument, corrupt: file.corrupt })(text);
  const known = HashSet.fromIterable(A.map(documents, (document) => knownKey(document.sha256, document.familyKey)));

  return KnownDocumentsShape.make({
    has: (request: KnownDocumentRequest) =>
      Effect.succeed(HashSet.has(known, knownKey(request.contentSha256, request.matterKey))),
  });
});

/**
 * Layer providing the known-documents port from the private JSONL index.
 *
 * **Details**
 *
 * Every non-empty line is one {@link KnownDocument}; the index is read and
 * decoded once when the layer is built. `has` answers whether a line carries
 * the same hash under the same family key. An index that is missing, or a
 * line that does not decode, fails the layer with a `MailTaggingStateError`
 * naming the file and the 1-based line number, never the line's content:
 * a run that could not read the index would upload files the document system
 * already has.
 *
 * **Gotchas**
 *
 * Build the layer once per run. The index is regenerated between runs, and an
 * instance kept alive across runs would not see the files added since.
 *
 * **Example** (Wire the port over an index file)
 *
 * ```ts
 * import {
 *   KnownDocumentsConfig,
 *   KnownDocumentsFile,
 *   KnownDocumentsLocation
 * } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Known = KnownDocumentsFile.pipe(
 *   Layer.provide(
 *     Layer.succeed(
 *       KnownDocumentsLocation,
 *       KnownDocumentsConfig.make({ path: "state/box-onboarding/box-files.jsonl" })
 *     )
 *   )
 * )
 * console.log(Layer.isLayer(Known)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const KnownDocumentsFile: Layer.Layer<
  KnownDocuments,
  MailTaggingStateError,
  KnownDocumentsLocation | FileSystem.FileSystem | Path.Path
> = Layer.effect(KnownDocuments, makeKnownDocuments);
