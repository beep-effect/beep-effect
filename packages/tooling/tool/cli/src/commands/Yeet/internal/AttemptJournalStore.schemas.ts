/**
 * Schemas of the workstation attempt-journal store (PERIL-11): what one export
 * of a removed checkout's attempt journals did, and how it fails.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Yeet/internal/AttemptJournalStore.schemas");

/**
 * A checkout's attempt journals filed in the workstation store.
 *
 * **Details**
 *
 * `journals` counts the readable run journals the checkout held. Each of their
 * rows is either appended to the store (`appendedRows`) or was already there
 * byte for byte (`retainedRows`), so exporting the same journals twice appends
 * nothing the second time.
 *
 * **Example** (Describe a first export)
 *
 * ```ts
 * import { AttemptJournalExported } from "@beep/repo-cli/test/Yeet"
 *
 * const exported = AttemptJournalExported.make({
 *   runsDirectory: "/state/beep/yeet/attempts/github.com__beep-effect__beep-effect/runs",
 *   journals: 2,
 *   appendedRows: 7,
 *   retainedRows: 0,
 * })
 * console.log(exported._tag) // "exported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttemptJournalExported extends S.Opaque<AttemptJournalExported, { readonly brand: unique symbol }>()(
  S.TaggedStruct("exported", {
    runsDirectory: S.String,
    journals: S.Natural,
    appendedRows: S.Natural,
    retainedRows: S.Natural,
  }).pipe(
    $I.annoteSchema("AttemptJournalExported", {
      description:
        "A checkout's attempt journals filed in the workstation store, with the rows appended and the rows it already held.",
    })
  )
) {}

/**
 * A checkout whose journals have no store partition.
 *
 * **Details**
 *
 * The store is partitioned by the GitHub repository the owning clone's
 * `origin` names, the key `yeet economics --fleet` reads it by. A clone with no
 * such origin has no partition and no fleet reader, so its journals stay in
 * the checkout and are removed with it.
 *
 * **Example** (Describe journals left behind)
 *
 * ```ts
 * import { AttemptJournalExportUnpartitioned } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(AttemptJournalExportUnpartitioned.make({ journals: 1 })._tag) // "unpartitioned"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttemptJournalExportUnpartitioned extends S.Opaque<
  AttemptJournalExportUnpartitioned,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("unpartitioned", {
    journals: S.Natural,
  }).pipe(
    $I.annoteSchema("AttemptJournalExportUnpartitioned", {
      description: "Attempt journals left in a checkout whose clone's origin names no GitHub repository.",
    })
  )
) {}

/**
 * What exporting a checkout's attempt journals did before its removal.
 *
 * **Example** (Match an export)
 *
 * ```ts
 * import { AttemptJournalExport, AttemptJournalExportUnpartitioned } from "@beep/repo-cli/test/Yeet"
 *
 * const count = AttemptJournalExport.match({
 *   exported: (exported) => exported.appendedRows,
 *   unpartitioned: () => 0,
 * })
 * console.log(count(AttemptJournalExportUnpartitioned.make({ journals: 3 }))) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AttemptJournalExport = S.Union([AttemptJournalExported, AttemptJournalExportUnpartitioned]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AttemptJournalExport", {
    description: "What exporting a checkout's attempt journals to the workstation store did before its removal.",
  })
);

/**
 * Decoded type of {@link AttemptJournalExport}.
 *
 * @category models
 * @since 0.0.0
 */
export type AttemptJournalExport = typeof AttemptJournalExport.Type;

/**
 * A journal the store could not read or write.
 *
 * **Details**
 *
 * Raised for an unreadable runs directory or journal in the checkout, an
 * unresolvable state root (no `path`), or a store directory or file that
 * cannot be created, read or appended. The removal that asked for the export
 * maps it to a preservation failure and deletes nothing.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { AttemptJournalStoreError } from "@beep/repo-cli/test/Yeet"
 *
 * const error = AttemptJournalStoreError.make({ message: "Could not append.", path: "/state/runs/r/attempts.ndjson" })
 * console.log(error._tag) // "AttemptJournalStoreError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AttemptJournalStoreError extends S.TaggedError<
  AttemptJournalStoreError,
  { readonly brand: unique symbol }
>($I`AttemptJournalStoreError`)(
  "AttemptJournalStoreError",
  {
    message: S.String,
    path: S.optionalKey(S.String),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annoteError<AttemptJournalStoreError>("AttemptJournalStoreError", {
    description: "An attempt journal the workstation store could not read from a checkout or write to its partition.",
  })
) {}
