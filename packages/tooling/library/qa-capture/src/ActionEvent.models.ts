/**
 * Schema-first witness action-event models for QA capture sessions.
 *
 * Events originate inside the instrumented page (the witness script) and are
 * decoded per NDJSON line at the collector boundary. Key-down events carry
 * non-printable key identities only — printable keystrokes are never modeled,
 * so keystroke logging is impossible by construction.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $QaCaptureId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $QaCaptureId.create("ActionEvent.models");

/**
 * Monotonically increasing witness event sequence number.
 *
 * @example
 * ```ts
 * import { SequenceNumber } from "@beep/qa-capture"
 * const seq = SequenceNumber.make(1)
 * console.log(seq)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const SequenceNumber = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`SequenceNumberMinimumCheck`,
    title: "Sequence Number Minimum",
    description: "Witness event sequence numbers are non-negative integers.",
    message: "Expected a non-negative sequence number",
  })
).pipe(
  $I.annoteSchema("SequenceNumber", {
    description: "Monotonically increasing witness event sequence number.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Monotonically increasing witness event sequence number.
 *
 * @example
 * ```ts
 * import { SequenceNumber } from "@beep/qa-capture"
 * import type { SequenceNumber as SequenceNumberValue } from "@beep/qa-capture"
 * const seq: SequenceNumberValue = SequenceNumber.make(1)
 * console.log(seq)
 * ```
 * @category models
 * @since 0.0.0
 */
export type SequenceNumber = typeof SequenceNumber.Type;

/**
 * Non-negative wall-clock timestamp in epoch milliseconds.
 *
 * Witness timestamps are `performance.timeOrigin + performance.now()`, so
 * fractional milliseconds are expected.
 *
 * @example
 * ```ts
 * import { EpochMilliseconds } from "@beep/qa-capture"
 * const t = EpochMilliseconds.make(1753838000000.25)
 * console.log(t)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const EpochMilliseconds = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`EpochMillisecondsMinimumCheck`,
    title: "Epoch Milliseconds Minimum",
    description: "Epoch timestamps are zero or greater.",
    message: "Expected non-negative epoch milliseconds",
  })
).pipe(
  $I.annoteSchema("EpochMilliseconds", {
    description: "Non-negative wall-clock timestamp in epoch milliseconds.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative wall-clock timestamp in epoch milliseconds.
 *
 * @example
 * ```ts
 * import { EpochMilliseconds } from "@beep/qa-capture"
 * import type { EpochMilliseconds as EpochMillisecondsValue } from "@beep/qa-capture"
 * const t: EpochMillisecondsValue = EpochMilliseconds.make(1753838000000)
 * console.log(t)
 * ```
 * @category models
 * @since 0.0.0
 */
export type EpochMilliseconds = typeof EpochMilliseconds.Type;

/**
 * Finite CSS-pixel coordinate inside the viewport coordinate space.
 *
 * @example
 * ```ts
 * import { PixelPosition } from "@beep/qa-capture"
 * const x = PixelPosition.make(120.5)
 * console.log(x)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const PixelPosition = S.Finite.pipe(
  $I.annoteSchema("PixelPosition", {
    description: "Finite CSS-pixel coordinate inside the viewport coordinate space.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Finite CSS-pixel coordinate inside the viewport coordinate space.
 *
 * @example
 * ```ts
 * import { PixelPosition } from "@beep/qa-capture"
 * import type { PixelPosition as PixelPositionValue } from "@beep/qa-capture"
 * const x: PixelPositionValue = PixelPosition.make(120.5)
 * console.log(x)
 * ```
 * @category models
 * @since 0.0.0
 */
export type PixelPosition = typeof PixelPosition.Type;

/**
 * Non-negative finite duration in milliseconds.
 *
 * @example
 * ```ts
 * import { DurationMilliseconds } from "@beep/qa-capture"
 * const duration = DurationMilliseconds.make(150)
 * console.log(duration)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const DurationMilliseconds = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`DurationMillisecondsMinimumCheck`,
    title: "Duration Milliseconds Minimum",
    description: "Durations are zero or greater.",
    message: "Expected non-negative duration milliseconds",
  })
).pipe(
  $I.annoteSchema("DurationMilliseconds", {
    description: "Non-negative finite duration in milliseconds.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative finite duration in milliseconds.
 *
 * @example
 * ```ts
 * import { DurationMilliseconds } from "@beep/qa-capture"
 * import type { DurationMilliseconds as DurationMillisecondsValue } from "@beep/qa-capture"
 * const duration: DurationMillisecondsValue = DurationMilliseconds.make(150)
 * console.log(duration)
 * ```
 * @category models
 * @since 0.0.0
 */
export type DurationMilliseconds = typeof DurationMilliseconds.Type;

/**
 * Non-negative finite CSS-pixel extent (widths and heights).
 *
 * @example
 * ```ts
 * import { NonNegativePixels } from "@beep/qa-capture"
 * const width = NonNegativePixels.make(240)
 * console.log(width)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NonNegativePixels = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`NonNegativePixelsMinimumCheck`,
    title: "Non Negative Pixels Minimum",
    description: "Pixel extents are zero or greater.",
    message: "Expected non-negative pixels",
  })
).pipe(
  $I.annoteSchema("NonNegativePixels", {
    description: "Non-negative finite CSS-pixel extent.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative finite CSS-pixel extent (widths and heights).
 *
 * @example
 * ```ts
 * import { NonNegativePixels } from "@beep/qa-capture"
 * import type { NonNegativePixels as NonNegativePixelsValue } from "@beep/qa-capture"
 * const width: NonNegativePixelsValue = NonNegativePixels.make(240)
 * console.log(width)
 * ```
 * @category models
 * @since 0.0.0
 */
export type NonNegativePixels = typeof NonNegativePixels.Type;

/**
 * Deterministic selector path produced by the witness selector builder.
 *
 * @example
 * ```ts
 * import { SelectorPath } from "@beep/qa-capture"
 * const selector = SelectorPath.make("[data-qa=\"dock-sash\"]")
 * console.log(selector)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const SelectorPath = S.String.check(
  S.isMinLength(1, {
    identifier: $I`SelectorPathNonEmptyCheck`,
    title: "Selector Path Non Empty",
    description: "Selector paths must not be empty.",
    message: "Expected a non-empty selector path",
  })
).pipe(
  $I.annoteSchema("SelectorPath", {
    description: "Deterministic selector path produced by the witness selector builder.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Deterministic selector path produced by the witness selector builder.
 *
 * @example
 * ```ts
 * import { SelectorPath } from "@beep/qa-capture"
 * import type { SelectorPath as SelectorPathValue } from "@beep/qa-capture"
 * const selector: SelectorPathValue = SelectorPath.make("#root")
 * console.log(selector)
 * ```
 * @category models
 * @since 0.0.0
 */
export type SelectorPath = typeof SelectorPath.Type;

/**
 * Non-printable key identity (`event.key` with length greater than one).
 *
 * The witness records only these, so printable keystrokes never enter the
 * event stream.
 *
 * @example
 * ```ts
 * import { NonPrintableKey } from "@beep/qa-capture"
 * const key = NonPrintableKey.make("Escape")
 * console.log(key)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NonPrintableKey = S.String.check(
  S.isMinLength(2, {
    identifier: $I`NonPrintableKeyMinimumLengthCheck`,
    title: "Non Printable Key Minimum Length",
    description: "Non-printable key identities are at least two characters long.",
    message: "Expected a non-printable key identity of at least two characters",
  })
).pipe(
  $I.annoteSchema("NonPrintableKey", {
    description: "Non-printable key identity with at least two characters.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-printable key identity (`event.key` with length greater than one).
 *
 * @example
 * ```ts
 * import { NonPrintableKey } from "@beep/qa-capture"
 * import type { NonPrintableKey as NonPrintableKeyValue } from "@beep/qa-capture"
 * const key: NonPrintableKeyValue = NonPrintableKey.make("Escape")
 * console.log(key)
 * ```
 * @category models
 * @since 0.0.0
 */
export type NonPrintableKey = typeof NonPrintableKey.Type;

/**
 * Witness action-event kind identifiers.
 *
 * @example
 * ```ts
 * import { ActionEventKind } from "@beep/qa-capture"
 * console.log(ActionEventKind.Enum["pointer-down"])
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ActionEventKind = LiteralKit([
  "animation",
  "beacon",
  "focus-in",
  "focus-out",
  "key-down",
  "marker",
  "pointer-cancel",
  "pointer-down",
  "pointer-enter",
  "pointer-leave",
  "pointer-move",
  "pointer-up",
  "scroll",
  "transition",
]).pipe(
  $I.annoteSchema("ActionEventKind", {
    description: "Witness action-event kind identifiers.",
  })
);

/**
 * Witness action-event kind identifiers.
 *
 * @example
 * ```ts
 * import { ActionEventKind } from "@beep/qa-capture"
 * import type { ActionEventKind as ActionEventKindValue } from "@beep/qa-capture"
 * const kind: ActionEventKindValue = ActionEventKind.Enum.marker
 * console.log(kind)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ActionEventKind = typeof ActionEventKind.Type;

/**
 * CSS transition/animation lifecycle phases observed by the witness.
 *
 * @example
 * ```ts
 * import { TransitionPhase } from "@beep/qa-capture"
 * console.log(TransitionPhase.Enum.start)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const TransitionPhase = LiteralKit(["cancel", "end", "start"]).pipe(
  $I.annoteSchema("TransitionPhase", {
    description: "CSS transition/animation lifecycle phases observed by the witness.",
  })
);

/**
 * CSS transition/animation lifecycle phases observed by the witness.
 *
 * @example
 * ```ts
 * import { TransitionPhase } from "@beep/qa-capture"
 * import type { TransitionPhase as TransitionPhaseValue } from "@beep/qa-capture"
 * const phase: TransitionPhaseValue = TransitionPhase.Enum.end
 * console.log(phase)
 * ```
 * @category models
 * @since 0.0.0
 */
export type TransitionPhase = typeof TransitionPhase.Type;

/**
 * Bounding rectangle of the event target in viewport CSS pixels.
 *
 * @example
 * ```ts
 * import { DomRect } from "@beep/qa-capture"
 * const rect = DomRect.make({ height: 32, width: 240, x: 8, y: 64 })
 * console.log(rect)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DomRect extends S.Class<DomRect>($I`DomRect`)(
  {
    height: NonNegativePixels.pipe(
      $I.annoteKey("DomRect.height", {
        description: "Rectangle height in CSS pixels.",
      })
    ),
    width: NonNegativePixels.pipe(
      $I.annoteKey("DomRect.width", {
        description: "Rectangle width in CSS pixels.",
      })
    ),
    x: PixelPosition.pipe(
      $I.annoteKey("DomRect.x", {
        description: "Rectangle left edge in viewport CSS pixels.",
      })
    ),
    y: PixelPosition.pipe(
      $I.annoteKey("DomRect.y", {
        description: "Rectangle top edge in viewport CSS pixels.",
      })
    ),
  },
  $I.annote("DomRect", {
    description: "Bounding rectangle of the event target in viewport CSS pixels.",
  })
) {}

/**
 * Pointer pressed on an element.
 *
 * @example
 * ```ts
 * import { PointerDownEvent } from "@beep/qa-capture"
 * const event = PointerDownEvent.make({
 *   button: 0,
 *   kind: "pointer-down",
 *   pointerId: 1,
 *   selectorPath: "[data-qa=\"dock-sash\"]",
 *   seq: 4,
 *   tEpochMs: 1753838000000,
 *   x: 120,
 *   y: 240
 * })
 * console.log(event.kind)
 * ```
 * @category events
 * @since 0.0.0
 */
export class PointerDownEvent extends S.Class<PointerDownEvent>($I`PointerDownEvent`)(
  {
    button: S.Int.pipe(
      $I.annoteKey("PointerDownEvent.button", {
        description: "Pressed pointer button index.",
      })
    ),
    kind: S.tag("pointer-down").pipe(
      $I.annoteKey("PointerDownEvent.kind", {
        description: "Discriminator for pointer-down events.",
      })
    ),
    pointerId: S.Int.pipe(
      $I.annoteKey("PointerDownEvent.pointerId", {
        description: "Browser pointer identity, stable across one gesture.",
      })
    ),
    rect: S.OptionFromOptionalKey(DomRect).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PointerDownEvent.rect", {
        description: "Bounding rectangle of the pressed element, when resolvable.",
      })
    ),
    selectorPath: SelectorPath.pipe(
      $I.annoteKey("PointerDownEvent.selectorPath", {
        description: "Deterministic selector of the pressed element.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("PointerDownEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("PointerDownEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
    x: PixelPosition.pipe(
      $I.annoteKey("PointerDownEvent.x", {
        description: "Pointer x position in viewport CSS pixels.",
      })
    ),
    y: PixelPosition.pipe(
      $I.annoteKey("PointerDownEvent.y", {
        description: "Pointer y position in viewport CSS pixels.",
      })
    ),
  },
  $I.annote("PointerDownEvent", {
    description: "Pointer pressed on an element.",
  })
) {}

/**
 * Pointer released after a press.
 *
 * @example
 * ```ts
 * import { PointerUpEvent } from "@beep/qa-capture"
 * const event = PointerUpEvent.make({
 *   button: 0,
 *   kind: "pointer-up",
 *   pointerId: 1,
 *   selectorPath: "[data-qa=\"dock-sash\"]",
 *   seq: 9,
 *   tEpochMs: 1753838000900,
 *   x: 180,
 *   y: 240
 * })
 * console.log(event.kind)
 * ```
 * @category events
 * @since 0.0.0
 */
export class PointerUpEvent extends S.Class<PointerUpEvent>($I`PointerUpEvent`)(
  {
    button: S.Int.pipe(
      $I.annoteKey("PointerUpEvent.button", {
        description: "Released pointer button index.",
      })
    ),
    kind: S.tag("pointer-up").pipe(
      $I.annoteKey("PointerUpEvent.kind", {
        description: "Discriminator for pointer-up events.",
      })
    ),
    pointerId: S.Int.pipe(
      $I.annoteKey("PointerUpEvent.pointerId", {
        description: "Browser pointer identity, stable across one gesture.",
      })
    ),
    rect: S.OptionFromOptionalKey(DomRect).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PointerUpEvent.rect", {
        description: "Bounding rectangle of the release target, when resolvable.",
      })
    ),
    selectorPath: SelectorPath.pipe(
      $I.annoteKey("PointerUpEvent.selectorPath", {
        description: "Deterministic selector of the release target.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("PointerUpEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("PointerUpEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
    x: PixelPosition.pipe(
      $I.annoteKey("PointerUpEvent.x", {
        description: "Pointer x position in viewport CSS pixels.",
      })
    ),
    y: PixelPosition.pipe(
      $I.annoteKey("PointerUpEvent.y", {
        description: "Pointer y position in viewport CSS pixels.",
      })
    ),
  },
  $I.annote("PointerUpEvent", {
    description: "Pointer released after a press.",
  })
) {}

/**
 * Pointer gesture cancelled before release (touch cancel, OS drag
 * interception, or a harness-dispatched `pointercancel`).
 *
 * @example
 * ```ts
 * import { PointerCancelEvent } from "@beep/qa-capture"
 * const event = PointerCancelEvent.make({
 *   kind: "pointer-cancel",
 *   pointerId: 1,
 *   selectorPath: "[data-qa=\"dock-sash\"]",
 *   seq: 8,
 *   tEpochMs: 1753838000800,
 *   x: 160,
 *   y: 240
 * })
 * console.log(event.kind)
 * ```
 * @category events
 * @since 0.0.0
 */
export class PointerCancelEvent extends S.Class<PointerCancelEvent>($I`PointerCancelEvent`)(
  {
    kind: S.tag("pointer-cancel").pipe(
      $I.annoteKey("PointerCancelEvent.kind", {
        description: "Discriminator for pointer-cancel events.",
      })
    ),
    pointerId: S.Int.pipe(
      $I.annoteKey("PointerCancelEvent.pointerId", {
        description: "Browser pointer identity, stable across one gesture.",
      })
    ),
    rect: S.OptionFromOptionalKey(DomRect).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PointerCancelEvent.rect", {
        description: "Bounding rectangle of the cancellation target, when resolvable.",
      })
    ),
    selectorPath: SelectorPath.pipe(
      $I.annoteKey("PointerCancelEvent.selectorPath", {
        description: "Deterministic selector of the cancellation target.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("PointerCancelEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("PointerCancelEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
    x: PixelPosition.pipe(
      $I.annoteKey("PointerCancelEvent.x", {
        description: "Pointer x position in viewport CSS pixels.",
      })
    ),
    y: PixelPosition.pipe(
      $I.annoteKey("PointerCancelEvent.y", {
        description: "Pointer y position in viewport CSS pixels.",
      })
    ),
  },
  $I.annote("PointerCancelEvent", {
    description: "Pointer gesture cancelled before release.",
  })
) {}

/**
 * Throttled pointer movement sample (~30 Hz plus last-before-up).
 *
 * @example
 * ```ts
 * import { PointerMoveEvent } from "@beep/qa-capture"
 * const event = PointerMoveEvent.make({
 *   kind: "pointer-move",
 *   pointerId: 1,
 *   seq: 5,
 *   tEpochMs: 1753838000033,
 *   x: 130,
 *   y: 240
 * })
 * console.log(event.kind)
 * ```
 * @category events
 * @since 0.0.0
 */
export class PointerMoveEvent extends S.Class<PointerMoveEvent>($I`PointerMoveEvent`)(
  {
    kind: S.tag("pointer-move").pipe(
      $I.annoteKey("PointerMoveEvent.kind", {
        description: "Discriminator for pointer-move events.",
      })
    ),
    pointerId: S.Int.pipe(
      $I.annoteKey("PointerMoveEvent.pointerId", {
        description: "Browser pointer identity, stable across one gesture.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("PointerMoveEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("PointerMoveEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
    x: PixelPosition.pipe(
      $I.annoteKey("PointerMoveEvent.x", {
        description: "Pointer x position in viewport CSS pixels.",
      })
    ),
    y: PixelPosition.pipe(
      $I.annoteKey("PointerMoveEvent.y", {
        description: "Pointer y position in viewport CSS pixels.",
      })
    ),
  },
  $I.annote("PointerMoveEvent", {
    description: "Throttled pointer movement sample.",
  })
) {}

/**
 * Pointer entered an interactive element.
 *
 * @example
 * ```ts
 * import { PointerEnterEvent } from "@beep/qa-capture"
 * const event = PointerEnterEvent.make({
 *   kind: "pointer-enter",
 *   selectorPath: "button",
 *   seq: 2,
 *   tEpochMs: 1753838000000
 * })
 * console.log(event.kind)
 * ```
 * @category events
 * @since 0.0.0
 */
export class PointerEnterEvent extends S.Class<PointerEnterEvent>($I`PointerEnterEvent`)(
  {
    kind: S.tag("pointer-enter").pipe(
      $I.annoteKey("PointerEnterEvent.kind", {
        description: "Discriminator for pointer-enter events.",
      })
    ),
    rect: S.OptionFromOptionalKey(DomRect).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PointerEnterEvent.rect", {
        description: "Bounding rectangle of the entered element, when resolvable.",
      })
    ),
    selectorPath: SelectorPath.pipe(
      $I.annoteKey("PointerEnterEvent.selectorPath", {
        description: "Deterministic selector of the entered interactive element.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("PointerEnterEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("PointerEnterEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("PointerEnterEvent", {
    description: "Pointer entered an interactive element.",
  })
) {}

/**
 * Pointer left an interactive element.
 *
 * @example
 * ```ts
 * import { PointerLeaveEvent } from "@beep/qa-capture"
 * const event = PointerLeaveEvent.make({
 *   kind: "pointer-leave",
 *   selectorPath: "button",
 *   seq: 3,
 *   tEpochMs: 1753838000200
 * })
 * console.log(event.kind)
 * ```
 * @category events
 * @since 0.0.0
 */
export class PointerLeaveEvent extends S.Class<PointerLeaveEvent>($I`PointerLeaveEvent`)(
  {
    kind: S.tag("pointer-leave").pipe(
      $I.annoteKey("PointerLeaveEvent.kind", {
        description: "Discriminator for pointer-leave events.",
      })
    ),
    selectorPath: SelectorPath.pipe(
      $I.annoteKey("PointerLeaveEvent.selectorPath", {
        description: "Deterministic selector of the left interactive element.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("PointerLeaveEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("PointerLeaveEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("PointerLeaveEvent", {
    description: "Pointer left an interactive element.",
  })
) {}

/**
 * Focus entered an element.
 *
 * @example
 * ```ts
 * import { FocusInEvent } from "@beep/qa-capture"
 * const event = FocusInEvent.make({
 *   kind: "focus-in",
 *   selectorPath: "input",
 *   seq: 6,
 *   tEpochMs: 1753838000400
 * })
 * console.log(event.kind)
 * ```
 * @category events
 * @since 0.0.0
 */
export class FocusInEvent extends S.Class<FocusInEvent>($I`FocusInEvent`)(
  {
    kind: S.tag("focus-in").pipe(
      $I.annoteKey("FocusInEvent.kind", {
        description: "Discriminator for focus-in events.",
      })
    ),
    selectorPath: SelectorPath.pipe(
      $I.annoteKey("FocusInEvent.selectorPath", {
        description: "Deterministic selector of the focused element.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("FocusInEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("FocusInEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("FocusInEvent", {
    description: "Focus entered an element.",
  })
) {}

/**
 * Focus left an element.
 *
 * @example
 * ```ts
 * import { FocusOutEvent } from "@beep/qa-capture"
 * const event = FocusOutEvent.make({
 *   kind: "focus-out",
 *   selectorPath: "input",
 *   seq: 7,
 *   tEpochMs: 1753838000600
 * })
 * console.log(event.kind)
 * ```
 * @category events
 * @since 0.0.0
 */
export class FocusOutEvent extends S.Class<FocusOutEvent>($I`FocusOutEvent`)(
  {
    kind: S.tag("focus-out").pipe(
      $I.annoteKey("FocusOutEvent.kind", {
        description: "Discriminator for focus-out events.",
      })
    ),
    selectorPath: SelectorPath.pipe(
      $I.annoteKey("FocusOutEvent.selectorPath", {
        description: "Deterministic selector of the blurred element.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("FocusOutEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("FocusOutEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("FocusOutEvent", {
    description: "Focus left an element.",
  })
) {}

/**
 * Non-printable key pressed (Escape, Tab, arrows, and similar).
 *
 * @example
 * ```ts
 * import { KeyDownEvent } from "@beep/qa-capture"
 * const event = KeyDownEvent.make({
 *   key: "Escape",
 *   kind: "key-down",
 *   modifiers: [],
 *   seq: 8,
 *   tEpochMs: 1753838000700
 * })
 * console.log(event.key)
 * ```
 * @category events
 * @since 0.0.0
 */
export class KeyDownEvent extends S.Class<KeyDownEvent>($I`KeyDownEvent`)(
  {
    key: NonPrintableKey.pipe(
      $I.annoteKey("KeyDownEvent.key", {
        description: "Non-printable key identity; printable keys are never recorded.",
      })
    ),
    kind: S.tag("key-down").pipe(
      $I.annoteKey("KeyDownEvent.kind", {
        description: "Discriminator for key-down events.",
      })
    ),
    modifiers: S.Array(S.String).pipe(
      $I.annoteKey("KeyDownEvent.modifiers", {
        description: "Active modifier names (Alt, Control, Meta, Shift).",
      })
    ),
    selectorPath: S.OptionFromOptionalKey(SelectorPath).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("KeyDownEvent.selectorPath", {
        description: "Deterministic selector of the key target, when resolvable.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("KeyDownEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("KeyDownEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("KeyDownEvent", {
    description: "Non-printable key pressed.",
  })
) {}

/**
 * CSS transition lifecycle observation with its computed duration.
 *
 * @example
 * ```ts
 * import { CssTransitionEvent } from "@beep/qa-capture"
 * const event = CssTransitionEvent.make({
 *   durationMs: 200,
 *   kind: "transition",
 *   phase: "start",
 *   property: "transform",
 *   selectorPath: "[data-qa=\"drop-preview\"]",
 *   seq: 10,
 *   tEpochMs: 1753838001000
 * })
 * console.log(event.phase)
 * ```
 * @category events
 * @since 0.0.0
 */
export class CssTransitionEvent extends S.Class<CssTransitionEvent>($I`CssTransitionEvent`)(
  {
    durationMs: DurationMilliseconds.pipe(
      $I.annoteKey("CssTransitionEvent.durationMs", {
        description: "Computed transition duration in milliseconds.",
      })
    ),
    kind: S.tag("transition").pipe(
      $I.annoteKey("CssTransitionEvent.kind", {
        description: "Discriminator for CSS transition events.",
      })
    ),
    phase: TransitionPhase.pipe(
      $I.annoteKey("CssTransitionEvent.phase", {
        description: "Transition lifecycle phase.",
      })
    ),
    property: S.String.pipe(
      $I.annoteKey("CssTransitionEvent.property", {
        description: "CSS property name reported by the transition event.",
      })
    ),
    selectorPath: SelectorPath.pipe(
      $I.annoteKey("CssTransitionEvent.selectorPath", {
        description: "Deterministic selector of the transitioning element.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("CssTransitionEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("CssTransitionEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("CssTransitionEvent", {
    description: "CSS transition lifecycle observation with its computed duration.",
  })
) {}

/**
 * CSS animation lifecycle observation with its computed duration.
 *
 * @example
 * ```ts
 * import { CssAnimationEvent } from "@beep/qa-capture"
 * const event = CssAnimationEvent.make({
 *   animationName: "pulse",
 *   durationMs: 400,
 *   kind: "animation",
 *   phase: "start",
 *   selectorPath: "[data-qa=\"drop-preview\"]",
 *   seq: 11,
 *   tEpochMs: 1753838001200
 * })
 * console.log(event.animationName)
 * ```
 * @category events
 * @since 0.0.0
 */
export class CssAnimationEvent extends S.Class<CssAnimationEvent>($I`CssAnimationEvent`)(
  {
    animationName: S.String.pipe(
      $I.annoteKey("CssAnimationEvent.animationName", {
        description: "CSS animation name reported by the animation event.",
      })
    ),
    durationMs: DurationMilliseconds.pipe(
      $I.annoteKey("CssAnimationEvent.durationMs", {
        description: "Computed animation duration in milliseconds.",
      })
    ),
    kind: S.tag("animation").pipe(
      $I.annoteKey("CssAnimationEvent.kind", {
        description: "Discriminator for CSS animation events.",
      })
    ),
    phase: TransitionPhase.pipe(
      $I.annoteKey("CssAnimationEvent.phase", {
        description: "Animation lifecycle phase.",
      })
    ),
    selectorPath: SelectorPath.pipe(
      $I.annoteKey("CssAnimationEvent.selectorPath", {
        description: "Deterministic selector of the animating element.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("CssAnimationEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("CssAnimationEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("CssAnimationEvent", {
    description: "CSS animation lifecycle observation with its computed duration.",
  })
) {}

/**
 * Throttled scroll position sample.
 *
 * @example
 * ```ts
 * import { ScrollEvent } from "@beep/qa-capture"
 * import * as O from "effect/Option"
 * const event = ScrollEvent.make({
 *   kind: "scroll",
 *   scrollLeft: 0,
 *   scrollTop: 128,
 *   selectorPath: O.none(),
 *   seq: 12,
 *   tEpochMs: 1753838001400
 * })
 * console.log(event.scrollTop)
 * ```
 * @category events
 * @since 0.0.0
 */
export class ScrollEvent extends S.Class<ScrollEvent>($I`ScrollEvent`)(
  {
    kind: S.tag("scroll").pipe(
      $I.annoteKey("ScrollEvent.kind", {
        description: "Discriminator for scroll events.",
      })
    ),
    scrollLeft: PixelPosition.pipe(
      $I.annoteKey("ScrollEvent.scrollLeft", {
        description: "Horizontal scroll offset in CSS pixels.",
      })
    ),
    scrollTop: PixelPosition.pipe(
      $I.annoteKey("ScrollEvent.scrollTop", {
        description: "Vertical scroll offset in CSS pixels.",
      })
    ),
    selectorPath: S.OptionFromOptionalKey(SelectorPath).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("ScrollEvent.selectorPath", {
        description: "Deterministic selector of the scrolled element; absent for the window scroller.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("ScrollEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("ScrollEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("ScrollEvent", {
    description: "Throttled scroll position sample.",
  })
) {}

/**
 * Semantic marker injected by the harness or `beep qa mark`.
 *
 * @example
 * ```ts
 * import { MarkerEvent } from "@beep/qa-capture"
 * const event = MarkerEvent.make({
 *   kind: "marker",
 *   label: "scenario:sash-drag/start",
 *   seq: 1,
 *   tEpochMs: 1753838000000
 * })
 * console.log(event.label)
 * ```
 * @category events
 * @since 0.0.0
 */
export class MarkerEvent extends S.Class<MarkerEvent>($I`MarkerEvent`)(
  {
    kind: S.tag("marker").pipe(
      $I.annoteKey("MarkerEvent.kind", {
        description: "Discriminator for marker events.",
      })
    ),
    label: S.String.check(
      S.isMinLength(1, {
        identifier: $I`MarkerEventLabelNonEmptyCheck`,
        title: "Marker Label Non Empty",
        description: "Marker labels must not be empty.",
        message: "Expected a non-empty marker label",
      })
    ).pipe(
      $I.annoteKey("MarkerEvent.label", {
        description: "Semantic marker label.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("MarkerEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("MarkerEvent.tEpochMs", {
        description: "Event wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("MarkerEvent", {
    description: "Semantic marker injected by the harness or `beep qa mark`.",
  })
) {}

/**
 * One flip of the visual clock-sync beacon overlay.
 *
 * `tPaintEpochMs` is sampled inside the flip's `requestAnimationFrame`
 * callback, so it is the closest wall-clock proxy for the painted frame.
 *
 * @example
 * ```ts
 * import { BeaconEvent } from "@beep/qa-capture"
 * const event = BeaconEvent.make({
 *   flipIndex: 0,
 *   isWhite: true,
 *   kind: "beacon",
 *   seq: 2,
 *   tEpochMs: 1753838000050,
 *   tPaintEpochMs: 1753838000058
 * })
 * console.log(event.flipIndex)
 * ```
 * @category events
 * @since 0.0.0
 */
export class BeaconEvent extends S.Class<BeaconEvent>($I`BeaconEvent`)(
  {
    flipIndex: S.Int.check(
      S.isGreaterThanOrEqualTo(0, {
        identifier: $I`BeaconEventFlipIndexMinimumCheck`,
        title: "Beacon Flip Index Minimum",
        description: "Beacon flip indexes are zero-based non-negative integers.",
        message: "Expected a non-negative beacon flip index",
      })
    ).pipe(
      $I.annoteKey("BeaconEvent.flipIndex", {
        description: "Zero-based index of the beacon flip.",
      })
    ),
    isWhite: S.Boolean.pipe(
      $I.annoteKey("BeaconEvent.isWhite", {
        description: "Whether the beacon overlay flipped to white.",
      })
    ),
    kind: S.tag("beacon").pipe(
      $I.annoteKey("BeaconEvent.kind", {
        description: "Discriminator for beacon events.",
      })
    ),
    seq: SequenceNumber.pipe(
      $I.annoteKey("BeaconEvent.seq", {
        description: "Witness sequence number.",
      })
    ),
    tEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("BeaconEvent.tEpochMs", {
        description: "Flip request wall-clock timestamp in epoch milliseconds.",
      })
    ),
    tPaintEpochMs: EpochMilliseconds.pipe(
      $I.annoteKey("BeaconEvent.tPaintEpochMs", {
        description: "rAF-adjacent paint wall-clock timestamp in epoch milliseconds.",
      })
    ),
  },
  $I.annote("BeaconEvent", {
    description: "One flip of the visual clock-sync beacon overlay.",
  })
) {}

/**
 * Union of all witness action events, discriminated by `kind`.
 *
 * @example
 * ```ts
 * import { ActionEvent } from "@beep/qa-capture"
 * import type { ActionEvent as ActionEventValue } from "@beep/qa-capture"
 * const kindOf = (event: ActionEventValue) => event.kind
 * console.log(kindOf)
 * console.log(ActionEvent)
 * ```
 * @category events
 * @since 0.0.0
 */
export const ActionEvent = S.Union([
  CssAnimationEvent,
  BeaconEvent,
  FocusInEvent,
  FocusOutEvent,
  KeyDownEvent,
  MarkerEvent,
  PointerCancelEvent,
  PointerDownEvent,
  PointerEnterEvent,
  PointerLeaveEvent,
  PointerMoveEvent,
  PointerUpEvent,
  ScrollEvent,
  CssTransitionEvent,
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ActionEvent", {
    description: "Union of all witness action events, discriminated by kind.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Union of all witness action events, discriminated by `kind`.
 *
 * @example
 * ```ts
 * import type { ActionEvent } from "@beep/qa-capture"
 * const seqOf = (event: ActionEvent) => event.seq
 * console.log(seqOf)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ActionEvent = typeof ActionEvent.Type;

/**
 * Decode one JSON-encoded NDJSON line into an {@link ActionEvent}.
 *
 * @example
 * ```ts
 * import { decodeActionEventJson } from "@beep/qa-capture"
 * const effect = decodeActionEventJson(
 *   "{\"kind\":\"marker\",\"label\":\"scenario:start\",\"seq\":1,\"tEpochMs\":1753838000000}"
 * )
 * console.log(effect)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeActionEventJson = S.decodeUnknownEffect(S.fromJsonString(ActionEvent));

/**
 * Encode an {@link ActionEvent} into its JSON NDJSON-line representation.
 *
 * @example
 * ```ts
 * import { encodeActionEventJson, MarkerEvent } from "@beep/qa-capture"
 * const effect = encodeActionEventJson(
 *   MarkerEvent.make({ kind: "marker", label: "scenario:start", seq: 1, tEpochMs: 1753838000000 })
 * )
 * console.log(effect)
 * ```
 * @category encoding
 * @since 0.0.0
 */
export const encodeActionEventJson = S.encodeEffect(S.fromJsonString(ActionEvent));
