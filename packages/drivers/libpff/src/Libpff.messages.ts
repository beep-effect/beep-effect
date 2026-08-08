/**
 * JSONL metadata records for pffexport-exported items.
 *
 * The pffexport engine writes one record per exported item directory so the
 * folder → message → body/attachment relationships survive into the
 * file-processing manifest tree as data. P4 consumers read the JSONL through
 * this schema export; an engine-neutral message-record schema is a deliberate
 * P3 non-goal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ArtifactReference } from "@beep/file-processing/Artifact";
import { $LibpffId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";

const $I = $LibpffId.create("Libpff.messages");

type JsonEncodeEffect<Input> = {
  // Data-last first: the `(input, options?)` overload would otherwise absorb a
  // lone parse-options argument and hide the curried form. The trailing
  // optionality must mirror the data-first signature exactly.
  (options?: AST.ParseOptions): (input: Input) => Effect.Effect<string, S.SchemaError>;
  (input: Input, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
};

/**
 * File-name suffix of the per-archive messages JSONL artifact.
 *
 * The pffexport engine writes `<source-artifact-id><suffix>` beside the
 * exported target trees under the configured export root.
 *
 * @example
 * ```ts
 * import { PFFEXPORT_MESSAGES_SUFFIX } from "@beep/libpff"
 *
 * console.log(PFFEXPORT_MESSAGES_SUFFIX) // ".messages.jsonl"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PFFEXPORT_MESSAGES_SUFFIX = ".messages.jsonl";

/**
 * JSONL-safe metadata record for one pffexport-exported item.
 *
 * `folderPath` is the item's folder chain relative to its target tree root,
 * `messagePath` locates the item directory relative to the export root (so it
 * also encodes which target tree the item came from), and `body`, `eml`, and
 * `attachments` reference the same child artifacts reported on the archive
 * export result.
 *
 * @example
 * ```ts
 * import { PffexportMessageRecord } from "@beep/libpff"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(PffexportMessageRecord)({
 *   attachments: [],
 *   folderPath: "Top of Personal Folders/Inbox",
 *   headers: { Subject: "Quarterly report" },
 *   messagePath: "mailbox.export/Top of Personal Folders/Inbox/Message00001"
 * })
 *
 * Effect.runPromise(program).then((record) => console.log(record.folderPath)) // "Top of Personal Folders/Inbox"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PffexportMessageRecord extends S.Class<PffexportMessageRecord>($I`PffexportMessageRecord`)(
  {
    attachments: S.Array(ArtifactReference),
    body: S.optionalKey(ArtifactReference),
    eml: S.optionalKey(ArtifactReference),
    folderPath: PosixPath,
    headers: S.Record(S.String, S.String),
    messagePath: PosixPath,
  },
  $I.annote("PffexportMessageRecord", {
    description:
      "JSONL-safe pffexport item record preserving folder, message, body, EML, and attachment relationships.",
  })
) {
  static readonly encodeJson: JsonEncodeEffect<PffexportMessageRecord> = dual(
    SchemaUtils.isCodecDataFirst,
    S.encodeUnknownEffect(S.fromJsonString(PffexportMessageRecord))
  );
}

/**
 * JSONL encoder for {@link PffexportMessageRecord}.
 *
 * @example
 * ```ts
 * import { encodePffexportMessageRecordJson, PffexportMessageRecord } from "@beep/libpff"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const record = yield* S.decodeUnknownEffect(PffexportMessageRecord)({
 *     attachments: [],
 *     folderPath: "Top of Personal Folders/Inbox",
 *     headers: {},
 *     messagePath: "mailbox.export/Top of Personal Folders/Inbox/Message00001"
 *   })
 *
 *   return yield* encodePffexportMessageRecordJson(record)
 * })
 *
 * Effect.runPromise(program).then((json) => console.log(json.includes("Message00001"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodePffexportMessageRecordJson = PffexportMessageRecord.encodeJson;
