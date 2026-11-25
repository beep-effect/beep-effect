/**
 * Tagged outcomes of syncing and checking a managed section.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ManagedSectionId } from "@beep/identity/packages";
import * as Data from "effect/Data";
import * as S from "effect/Schema";
import { Section, SectionId } from "./Section.ts";

const $I = $ManagedSectionId.create("SectionOutcome");

const syncVariants = S.TaggedUnion({
  Created: {
    section: S.suspend(() => Section).pipe(
      $I.annoteKey("SyncOutcome.Created.section", { description: "The section added to the document." })
    ),
  },
  Updated: {
    before: S.suspend(() => Section).pipe(
      $I.annoteKey("SyncOutcome.Updated.before", { description: "The previous section." })
    ),
    after: S.suspend(() => Section).pipe(
      $I.annoteKey("SyncOutcome.Updated.after", { description: "The declared replacement." })
    ),
  },
  Unchanged: {
    section: S.suspend(() => Section).pipe(
      $I.annoteKey("SyncOutcome.Unchanged.section", { description: "The section already matching the declaration." })
    ),
  },
}).pipe($I.annoteSchema("SyncOutcome", { description: "What a sync did to one declared section." }));

/**
 * What a sync did to one declared section.
 *
 * **Details**
 * `Updated` carries both sides rather than a diff. Callers can compare
 * `before.content` and `after.content` with their preferred diff library.
 *
 * @category models
 * @since 0.0.0
 */
export type SyncOutcome = typeof syncVariants.Type;
const syncConstructors = Data.taggedEnum<SyncOutcome>();

const syncCodecWidenedPastUnionConstructor: S.Codec<SyncOutcome, typeof syncVariants.Encoded> =
  S.Opaque<SyncOutcome>()(syncVariants);

class SyncOutcomeStatics extends syncCodecWidenedPastUnionConstructor {
  static readonly Created = syncConstructors.Created;
  static readonly Updated = syncConstructors.Updated;
  static readonly Unchanged = syncConstructors.Unchanged;
  static readonly $is = syncConstructors.$is;
  static readonly $match = syncConstructors.$match;
}
/**
 * Schema authority with the original Data variant constructors and matchers.
 *
 * **Example** (Guarding an updated outcome)
 * ```ts
 * import { SyncOutcome } from "@beep/managed-section/SectionOutcome";
 * const isUpdated = SyncOutcome.$is("Updated");
 * console.log(isUpdated(undefined));
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SyncOutcome = SyncOutcomeStatics;

const checkVariants = S.TaggedUnion({
  Absent: {
    id: S.suspend(() => SectionId).pipe(
      $I.annoteKey("CheckOutcome.Absent.id", { description: "The absent section identity." })
    ),
  },
  UpToDate: {
    section: S.suspend(() => Section).pipe(
      $I.annoteKey("CheckOutcome.UpToDate.section", { description: "The section already matching the declaration." })
    ),
  },
  Drifted: {
    onDisk: S.suspend(() => Section).pipe(
      $I.annoteKey("CheckOutcome.Drifted.onDisk", { description: "The current section in the document." })
    ),
    expected: S.suspend(() => Section).pipe(
      $I.annoteKey("CheckOutcome.Drifted.expected", { description: "The expected declaration." })
    ),
  },
}).pipe($I.annoteSchema("CheckOutcome", { description: "What a check found without changing the document." }));

/**
 * What a check found without changing the document.
 *
 * **Details**
 * Three flat variants (`Absent`, `UpToDate`, `Drifted`) let callers branch
 * once on the tag rather than through nested checks.
 *
 * @category models
 * @since 0.0.0
 */
export type CheckOutcome = typeof checkVariants.Type;
const checkConstructors = Data.taggedEnum<CheckOutcome>();

const checkCodecWidenedPastUnionConstructor: S.Codec<CheckOutcome, typeof checkVariants.Encoded> =
  S.Opaque<CheckOutcome>()(checkVariants);

class CheckOutcomeStatics extends checkCodecWidenedPastUnionConstructor {
  static readonly Absent = checkConstructors.Absent;
  static readonly UpToDate = checkConstructors.UpToDate;
  static readonly Drifted = checkConstructors.Drifted;
  static readonly $is = checkConstructors.$is;
  static readonly $match = checkConstructors.$match;
}
/**
 * Schema authority with the original Data variant constructors and matchers.
 *
 * **Example** (Guarding a drifted outcome)
 * ```ts
 * import { CheckOutcome } from "@beep/managed-section/SectionOutcome";
 * const isDrifted = CheckOutcome.$is("Drifted");
 * console.log(isDrifted(undefined));
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CheckOutcome = CheckOutcomeStatics;
