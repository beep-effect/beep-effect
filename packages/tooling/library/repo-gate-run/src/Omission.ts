/**
 * What a gate run could not persist or read, and the one console line that
 * says so. Rendering never waits on persistence or history: a failure there
 * becomes an omission, never a missing console.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoGateRunId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoGateRunId.create("Omission");

/**
 * The part of a run that was left out: the raw log, the record, or the
 * history read.
 *
 * **Example** (Match an omitted part)
 *
 * ```ts
 * import { OmittedPart } from "@beep/repo-gate-run/Omission";
 *
 * console.log(OmittedPart.is.history("history")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OmittedPart = LiteralKit(["log", "record", "history"]).pipe(
  $I.annoteSchema("OmittedPart", {
    description: "The part of a gate run that was left out: the raw log, the record, or the history read.",
  })
);

/**
 * Type of {@link OmittedPart}.
 *
 * @category models
 * @since 0.0.0
 */
export type OmittedPart = typeof OmittedPart.Type;

/**
 * One part of a run that was not written or read, and why.
 *
 * **Example** (Build an omission)
 *
 * ```ts
 * import { Omission } from "@beep/repo-gate-run/Omission";
 *
 * console.log(Omission.make({ part: "record", reason: "disk full" }).part); // record
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Omission extends S.Opaque<Omission, { readonly brand: unique symbol }>()(
  S.Struct({
    part: OmittedPart,
    reason: S.String,
  }).pipe(
    $I.annoteSchema("Omission", {
      description: "One part of a gate run that was not written or read, and why.",
    })
  )
) {}

const reasonOf = (omissions: ReadonlyArray<Omission>, part: OmittedPart): O.Option<string> =>
  O.map(
    A.findFirst(omissions, (omission) => omission.part === part),
    (omission) => omission.reason
  );

const writtenLine = (omissions: ReadonlyArray<Omission>): O.Option<string> => {
  const record = reasonOf(omissions, "record");
  const log = reasonOf(omissions, "log");
  return pipe(
    O.map(O.all([record, log]), ([reason]) => `record and raw log not written: ${reason}`),
    O.orElse(() => O.map(record, (reason) => `record not written: ${reason}`)),
    O.orElse(() => O.map(log, (reason) => `raw log not written: ${reason}`))
  );
};

/**
 * The console lines naming what was left out: at most one for the record
 * and raw log together, and one for the history read.
 *
 * **Example** (Name a failed write)
 *
 * ```ts
 * import { Omission, omissionLines } from "@beep/repo-gate-run/Omission";
 *
 * console.log(omissionLines([
 *   Omission.make({ part: "record", reason: "disk full" }),
 *   Omission.make({ part: "log", reason: "disk full" }),
 * ]));
 * // ["record and raw log not written: disk full"]
 * ```
 *
 * @param omissions - What a gate run could not write or read.
 * @returns At most two lines: what was not written, and history not read.
 * @category projections
 * @since 0.0.0
 */
export const omissionLines = (omissions: ReadonlyArray<Omission>): ReadonlyArray<string> => [
  ...A.fromOption(writtenLine(omissions)),
  ...A.fromOption(O.map(reasonOf(omissions, "history"), (reason) => `history not read: ${reason}`)),
];
