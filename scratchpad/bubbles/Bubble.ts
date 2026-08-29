/**
 * Schema-first chat-bubble shrinkwrap proof.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { type FontMetrics, lineStats } from "@beep/pretext";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("bubbles/Bubble");

const NonNegativeFinite = S.Finite.check(S.isGreaterThanOrEqualTo(0));

/** Author of one chat message. */
export const BubbleAuthor = LiteralKit(["user", "agent"]).annotate(
  $I.annote("BubbleAuthor", { description: "Author role for a shrinkwrapped chat message." })
);
export type BubbleAuthor = typeof BubbleAuthor.Type;

/** One schema-validated chat message. */
export class ChatMessage extends S.Class<ChatMessage>($I`ChatMessage`)(
  {
    id: S.NonEmptyString,
    author: BubbleAuthor,
    text: S.String,
  },
  $I.annote("ChatMessage", { description: "A chat message whose text can be measured into a bubble." })
) {}

/** Width and padding constraints for bubble geometry. */
export class BubbleConstraints extends S.Class<BubbleConstraints>($I`BubbleConstraints`)(
  {
    maxWidth: NonNegativeFinite,
    padding: NonNegativeFinite.pipe(SchemaUtils.withConstantDefault<number>(0)),
  },
  $I.annote("BubbleConstraints", { description: "Maximum content width and surrounding bubble padding." })
) {}

/** Pure measured outer dimensions of one chat bubble. */
export class BubbleBox extends S.Class<BubbleBox>($I`BubbleBox`)(
  {
    width: NonNegativeFinite,
    height: NonNegativeFinite,
  },
  $I.annote("BubbleBox", { description: "Measured outer width and height of one chat bubble." })
) {}

/** Measure a chat bubble from a font snapshot, propagating unmeasured text as `None`. */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const bubbleBox = (
  metrics: FontMetrics,
  message: ChatMessage,
  constraints: BubbleConstraints
): O.Option<BubbleBox> =>
  O.map(lineStats(metrics, { text: message.text, maxWidth: constraints.maxWidth }), (stats) =>
    BubbleBox.make({
      width: N.min(constraints.maxWidth, stats.maxLineWidth) + 2 * constraints.padding,
      height: stats.lineCount * metrics.lineHeight + 2 * constraints.padding,
    })
  );
