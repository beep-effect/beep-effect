/**
 * Pure send/confirm decision policy for the desktop chat composer.
 *
 * The composer's editor contract demands synchronous boolean answers, so the
 * policy is a synchronous pure service: handlers gather registry inputs, ask
 * for one {@link ComposerSendDecision}, and apply it with a single match. The
 * duplicated refusal branches that previously drifted between the send and
 * confirm closures exist here exactly once.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { editorStateToDocument } from "@beep/lexical-schema";
import * as Md from "@beep/md/Md.model";
import { renderPlainTextUnsafe } from "@beep/md/Md.render";
import { refineSafeDocument, SafeDocument } from "@beep/md/Md.safe";
import { LiteralKit } from "@beep/schema";
import { A, flow, O, Str } from "@beep/utils";
import { Context, Layer, Match, Result, Tuple } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type { DocumentSafetyViolation } from "@beep/md/Md.safe";

const $I = $ProfessionalDesktopId.create("chat/ui/ComposerPolicy");

/**
 * Maximum characters one sent message may carry.
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_MESSAGE_CHARACTERS = 16_000;

class ComposerDecodeErrorNotice extends S.Class<ComposerDecodeErrorNotice>($I`ComposerDecodeErrorNotice`)(
  {
    kind: S.tag("decode-error"),
    message: S.NonEmptyString,
  },
  $I.annote("ComposerDecodeErrorNotice", {
    description: "A composer schema projection failure that must also update decode-failure telemetry.",
  })
) {}

class ComposerErrorNotice extends S.Class<ComposerErrorNotice>($I`ComposerErrorNotice`)(
  {
    kind: S.tag("error"),
    message: S.NonEmptyString,
  },
  $I.annote("ComposerErrorNotice", {
    description: "An operator-safe composer refusal rendered as an error toast.",
  })
) {}

class ComposerInfoNotice extends S.Class<ComposerInfoNotice>($I`ComposerInfoNotice`)(
  {
    kind: S.tag("info"),
    message: S.NonEmptyString,
  },
  $I.annote("ComposerInfoNotice", {
    description: "A non-failing composer notice rendered as an informational toast.",
  })
) {}

const ComposerNoticeKind = LiteralKit(["decode-error", "error", "info"]).pipe(
  $I.annoteSchema("ComposerNoticeKind", {
    description: "Exhaustive composer notification variants.",
  })
);

/**
 * Typed notification commands emitted by the composer state machine.
 *
 * @example
 * ```ts
 * import { ComposerNotice } from "@/chat/ui/ComposerPolicy"
 *
 * const notice = ComposerNotice.cases.info.make({ message: "Saved." })
 * console.log(notice.kind) // "info"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ComposerNotice = ComposerNoticeKind.mapMembers(
  Tuple.evolve([() => ComposerDecodeErrorNotice, () => ComposerErrorNotice, () => ComposerInfoNotice])
)
  .annotate(
    $I.annote("ComposerNotice", {
      description: "Typed notification commands emitted by the composer state machine.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Runtime type for {@link ComposerNotice}.
 *
 * @category models
 * @since 0.0.0
 */
export type ComposerNotice = typeof ComposerNotice.Type;

/**
 * Inline refusal emitted when a draft contains trusted raw nodes or a URL that
 * is outside the user-content allow list. The general draft remains untouched.
 *
 * @example
 * ```ts
 * import { ComposerSafetyRefusal } from "@/chat/ui/ComposerPolicy"
 *
 * const refusal = ComposerSafetyRefusal.make({ issueCount: 1, message: "Unsafe URL." })
 * console.log(refusal.issueCount) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ComposerSafetyRefusal extends S.Class<ComposerSafetyRefusal>($I`ComposerSafetyRefusal`)(
  {
    issueCount: S.Int.check(S.isGreaterThan(0)),
    message: S.NonEmptyString,
  },
  $I.annote("ComposerSafetyRefusal", {
    description: "An inline refusal for a draft that fails the Markdown user-content safety boundary.",
  })
) {}

/**
 * Per-category presence flags for a set of document safety violations.
 *
 * @example
 * ```ts
 * import { DocumentViolationFlags } from "@/chat/ui/ComposerPolicy"
 *
 * console.log(DocumentViolationFlags.empty.raw) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentViolationFlags extends S.Class<DocumentViolationFlags>($I`DocumentViolationFlags`)(
  {
    footnote: S.Boolean,
    raw: S.Boolean,
    scalar: S.Boolean,
    url: S.Boolean,
  },
  $I.annote("DocumentViolationFlags", {
    description: "Per-category presence flags for a set of document safety violations.",
  })
) {
  static readonly empty = DocumentViolationFlags.make({
    footnote: false,
    raw: false,
    scalar: false,
    url: false,
  });
}

/**
 * Folds violation instances into {@link DocumentViolationFlags}.
 *
 * @category validation
 * @since 0.0.0
 */
export const documentViolationFlags = (issues: ReadonlyArray<DocumentSafetyViolation>): DocumentViolationFlags =>
  A.reduce(issues, DocumentViolationFlags.empty, (flags, issue) =>
    Match.value(issue).pipe(
      Match.tagsExhaustive({
        DuplicateFootnoteDefinition: () => ({ ...flags, footnote: true }),
        RawNode: () => ({ ...flags, raw: true }),
        InvalidScalar: () => ({ ...flags, scalar: true }),
        UnsafeUrl: () => ({ ...flags, url: true }),
      })
    )
  );

const documentViolationReason = flow(
  documentViolationFlags,
  Match.type<DocumentViolationFlags>().pipe(
    Match.when(
      { footnote: true, scalar: true, url: true },
      () =>
        "duplicate footnote definitions, an unsafe link or embedded URL, and unsupported text encoding (a NUL character or lone UTF-16 surrogate)"
    ),
    Match.when(
      { footnote: true, scalar: true },
      () => "duplicate footnote definitions and unsupported text encoding (a NUL character or lone UTF-16 surrogate)"
    ),
    Match.when(
      { footnote: true, url: true },
      () => "duplicate footnote definitions and a link or embedded URL outside the safe destination policy"
    ),
    Match.when({ footnote: true }, () => "duplicate footnote definitions"),
    Match.when(
      { scalar: true, url: true },
      () => "an unsafe link or embedded URL and unsupported text encoding (a NUL character or lone UTF-16 surrogate)"
    ),
    Match.when({ scalar: true }, () => "unsupported text encoding (a NUL character or lone UTF-16 surrogate)"),
    Match.when({ url: true }, () => "a link or embedded URL outside the safe destination policy"),
    Match.orElse(() => "trusted raw Markdown or HTML")
  )
);

/**
 * The refusal copy shown when a still-unsafe document blocks the editor.
 *
 * @category validation
 * @since 0.0.0
 */
export const unsafeDocumentMessage = (issues: ReadonlyArray<DocumentSafetyViolation>): string =>
  `This draft contains ${documentViolationReason(issues)}. Edit or replace that content before sending.`;

const keptDraftSafetyMessage = (issues: ReadonlyArray<DocumentSafetyViolation>): string =>
  `This draft contains ${documentViolationReason(issues)}. It cannot be sent safely, and your draft has been kept.`;

/**
 * Rebuilds editable children while retaining persistence-owned frontmatter,
 * which is intentionally outside the Lexical wire vocabulary.
 *
 * @example
 * ```ts
 * import { composerDocumentFromEditorState } from "@/chat/ui/ComposerPolicy"
 * import { documentToEditorState } from "@beep/lexical-schema"
 * import * as Md from "@beep/md/Md.model"
 * import * as A from "effect/Array"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const seed = Md.Document.make({ children: [] })
 *   const state = yield* documentToEditorState(seed)
 *   console.log(A.length(composerDocumentFromEditorState(seed, state).children)) // 1
 * })
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const composerDocumentFromEditorState: {
  (state: SerializedEditorState): (seed: Md.Document) => Md.Document;
  (seed: Md.Document, state: SerializedEditorState): Md.Document;
} = dual(2, (seed: Md.Document, state: SerializedEditorState): Md.Document => {
  const projected = editorStateToDocument(state);
  return Md.Document.make({
    children: projected.children,
    frontmatter: seed.frontmatter,
  });
});

/**
 * Selects the document submitted by the composer. A confirmed normalized
 * payload wins over Lexical's projection so lossy nodes such as images retain
 * the exact semantics shown in the confirmation preview. Ordinary projection
 * preserves the seed's persistence-owned frontmatter.
 *
 * @example
 * ```ts
 * import { composerDocumentForSend } from "@/chat/ui/ComposerPolicy"
 * import { documentToEditorState } from "@beep/lexical-schema"
 * import * as Md from "@beep/md/Md.model"
 * import { refineSafeDocument } from "@beep/md/Md.safe"
 * import { Effect, Result } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = Effect.gen(function* () {
 *   const seed = Md.Document.make({ children: [] })
 *   const state = yield* documentToEditorState(seed)
 *   const confirmed = Result.getOrThrow(refineSafeDocument(seed))
 *   console.log(composerDocumentForSend(seed, state, O.some(confirmed)) === confirmed) // true
 * })
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const composerDocumentForSend: {
  (state: SerializedEditorState, confirmed: O.Option<SafeDocument>): (seed: Md.Document) => Md.Document;
  (seed: Md.Document, state: SerializedEditorState, confirmed: O.Option<SafeDocument>): Md.Document;
} = dual(
  3,
  (seed: Md.Document, state: SerializedEditorState, confirmed: O.Option<SafeDocument>): Md.Document =>
    O.getOrElse(confirmed, () => composerDocumentFromEditorState(seed, state))
);

/**
 * The composer's send/confirm decision as data: silently gated, refused with a
 * notice, refused with an inline safety refusal, or accepted with the safe
 * content to dispatch. The handler that asked decides what acceptance means —
 * submit for the send path, stash-and-confirm for the normalization path.
 *
 * @example
 * ```ts
 * import { ComposerSendDecision } from "@/chat/ui/ComposerPolicy"
 *
 * const decision = ComposerSendDecision.cases.gated.make({})
 * console.log(decision.kind) // "gated"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ComposerSendDecision = LiteralKit(["gated", "refuse", "send", "unsafe"])
  .toTaggedUnion("kind")({
    gated: {},
    refuse: { notice: ComposerNotice },
    send: { content: SafeDocument },
    unsafe: { refusal: ComposerSafetyRefusal },
  })
  .pipe(
    $I.annoteSchema("ComposerSendDecision", {
      description: "Outcome of one composer send or confirm-normalization policy decision.",
    })
  );

/**
 * Runtime type for {@link ComposerSendDecision}.
 *
 * @category models
 * @since 0.0.0
 */
export type ComposerSendDecision = typeof ComposerSendDecision.Type;

/**
 * Inputs to the send decision, gathered from the registry by the handler.
 *
 * @category models
 * @since 0.0.0
 */
export interface ComposerSendInput {
  readonly confirmed: O.Option<SafeDocument>;
  readonly gateOpen: boolean;
  readonly seed: Md.Document;
  readonly state: SerializedEditorState;
  readonly turnActive: boolean;
}

/**
 * Inputs to the confirm-normalization decision. `normalized` carries the
 * escaped copy retained by a raw-normalization gate, `None` when no gate is
 * open or the gate is a non-confirmable unsafe-document refusal.
 *
 * @category models
 * @since 0.0.0
 */
export interface ComposerConfirmInput {
  readonly normalized: O.Option<SafeDocument>;
  readonly turnActive: boolean;
}

/**
 * Service shape for the composer decision policy.
 *
 * @category services
 * @since 0.0.0
 */
export type ComposerPolicyShape = {
  readonly decideSend: (input: ComposerSendInput) => ComposerSendDecision;
  readonly decideConfirmNormalization: (input: ComposerConfirmInput) => ComposerSendDecision;
};

/**
 * The composer decision policy as a `Context.Service`, provided to the
 * professional Atom runtime through `ComposerPolicyLive`.
 *
 * @example
 * ```ts
 * import { ComposerPolicy } from "@/chat/ui/ComposerPolicy"
 *
 * console.log(typeof ComposerPolicy) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ComposerPolicy extends Context.Service<ComposerPolicy, ComposerPolicyShape>()($I`ComposerPolicy`) {}

const refuseWith = (notice: ComposerNotice): ComposerSendDecision => ComposerSendDecision.cases.refuse.make({ notice });

const streamingRefusal = refuseWith(
  ComposerNotice.cases.info.make({
    message: "A reply is still streaming — wait for it to finish, or press Stop.",
  })
);

const emptyProjectionRefusal = refuseWith(
  ComposerNotice.cases["decode-error"].make({
    message: "This message could not be prepared for sending. Your draft has been kept.",
  })
);

const emptyEscapedCopyRefusal = refuseWith(
  ComposerNotice.cases.error.make({
    message: "The escaped copy contains no visible text. Edit the draft before sending.",
  })
);

const characterLimitRefusal = (length: number): ComposerSendDecision =>
  refuseWith(
    ComposerNotice.cases.error.make({
      message: `Message is ${length.toLocaleString()} characters — the limit is ${MAX_MESSAGE_CHARACTERS.toLocaleString()}.`,
    })
  );

const acceptWithinLimit = (content: SafeDocument, plainText: string): ComposerSendDecision => {
  const length = Str.length(plainText);
  return length > MAX_MESSAGE_CHARACTERS
    ? characterLimitRefusal(length)
    : ComposerSendDecision.cases.send.make({ content });
};

/**
 * The live, pure composer decision policy.
 *
 * @example
 * ```ts
 * import { composerPolicy } from "@/chat/ui/ComposerPolicy"
 * import * as O from "effect/Option"
 *
 * const decision = composerPolicy.decideConfirmNormalization({ normalized: O.none(), turnActive: false })
 * console.log(decision.kind) // "gated"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const composerPolicy: ComposerPolicyShape = ComposerPolicy.of({
  decideSend: ({ confirmed, gateOpen, seed, state, turnActive }) => {
    if (O.isNone(confirmed) && gateOpen) return ComposerSendDecision.cases.gated.make({});
    if (turnActive) return streamingRefusal;
    const content = composerDocumentForSend(seed, state, confirmed);
    if (A.isReadonlyArrayEmpty(content.children)) return emptyProjectionRefusal;
    const safeContent = O.match(confirmed, {
      onNone: () => refineSafeDocument(content),
      onSome: Result.succeed,
    });
    return Result.match(safeContent, {
      onFailure: (issues) =>
        ComposerSendDecision.cases.unsafe.make({
          refusal: ComposerSafetyRefusal.make({
            issueCount: A.length(issues),
            message: keptDraftSafetyMessage(issues),
          }),
        }),
      onSuccess: (safe) => acceptWithinLimit(safe, renderPlainTextUnsafe(safe)),
    });
  },
  decideConfirmNormalization: ({ normalized, turnActive }) => {
    if (turnActive) return streamingRefusal;
    return O.match(normalized, {
      onNone: () => ComposerSendDecision.cases.gated.make({}),
      onSome: (content) => {
        const plainText = renderPlainTextUnsafe(content);
        return Str.isEmpty(Str.trim(plainText)) ? emptyEscapedCopyRefusal : acceptWithinLimit(content, plainText);
      },
    });
  },
});

/**
 * Layer providing {@link ComposerPolicy} to the professional Atom runtime.
 *
 * @example
 * ```ts
 * import { ComposerPolicyLive } from "@/chat/ui/ComposerPolicy"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ComposerPolicyLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ComposerPolicyLive = Layer.succeed(ComposerPolicy, composerPolicy);
