/**
 * Pure send decision policy for the desktop chat composer.
 *
 * **Details**
 *
 * The composer's editor contract demands synchronous boolean answers, so the
 * policy is a plain synchronous module value rather than an Effect service:
 * handlers gather registry inputs, ask for one {@link ComposerSendDecision},
 * and apply it with a single match.
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
import { A, flow, Str } from "@beep/utils";
import { Match, Result, Tuple } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type { DocumentSafetyViolation } from "@beep/md/Md.safe";

const $I = $ProfessionalDesktopId.create("chat/ui/ComposerPolicy");

/**
 * Maximum characters one sent message may carry.
 *
 * **Example** (Read the composer character ceiling)
 *
 * ```ts
 * import { MAX_MESSAGE_CHARACTERS } from "@/chat/ui/ComposerPolicy"
 *
 * console.log(MAX_MESSAGE_CHARACTERS) // 16000
 * ```
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
 * **Example** (Build an informational notice)
 *
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
 * **Example** (Build an inline safety refusal)
 *
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
 * Presence flags for the document safety violation categories that earn their
 * own refusal phrasing; a raw node needs no flag because it is the fallback.
 *
 * @category models
 * @since 0.0.0
 */
class DocumentViolationFlags extends S.Class<DocumentViolationFlags>($I`DocumentViolationFlags`)(
  {
    footnote: S.Boolean,
    htmlProjection: S.Boolean,
    scalar: S.Boolean,
    url: S.Boolean,
  },
  $I.annote("DocumentViolationFlags", {
    description: "Per-category presence flags for a set of document safety violations.",
  })
) {
  static readonly empty = DocumentViolationFlags.make({
    footnote: false,
    htmlProjection: false,
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
const documentViolationFlags = (issues: ReadonlyArray<DocumentSafetyViolation>): DocumentViolationFlags =>
  A.reduce(issues, DocumentViolationFlags.empty, (flags, issue) =>
    Match.value(issue).pipe(
      Match.tagsExhaustive({
        DocumentComplexity: () => flags,
        DuplicateFootnoteDefinition: () => ({ ...flags, footnote: true }),
        HtmlProjection: () => ({ ...flags, htmlProjection: true }),
        RawNode: () => flags,
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
    Match.when({ htmlProjection: true }, () => "a document structure that cannot be rendered as conformant HTML"),
    Match.orElse(() => "trusted raw Markdown or HTML")
  )
);

/**
 * The refusal copy shown when a still-unsafe document blocks the editor.
 *
 * **Gotchas**
 *
 * Trusted raw nodes carry no presence flag of their own, so an issue list that
 * names no footnote, scalar, URL, or HTML-projection violation renders the
 * raw-node phrasing. When multiple specialized categories are present, the
 * more actionable URL, scalar, and footnote explanations take precedence over
 * the structural HTML-projection explanation. Callers pass a non-empty
 * violation list; an empty one would read as a raw-node refusal.
 *
 * **Example** (Explain a trusted raw node refusal)
 *
 * ```ts
 * import { RawNodeSafetyViolation } from "@beep/md/Md.safe"
 * import { unsafeDocumentMessage } from "@/chat/ui/ComposerPolicy"
 *
 * const issue = RawNodeSafetyViolation.make({ path: ["children", 0], nodeTag: "rawHtml" })
 *
 * console.log(unsafeDocumentMessage([issue]))
 * // "This draft contains trusted raw Markdown or HTML. Edit or replace that content before sending."
 * ```
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
 * **Example** (Rebuild a document from editor state)
 *
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
 * The composer's send decision as data: silently gated, refused with a notice,
 * refused with an inline safety refusal, or accepted with the safe content to
 * dispatch.
 *
 * **Example** (Build a gated decision)
 *
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
      description: "Outcome of one composer send policy decision.",
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
interface ComposerSendInput {
  readonly gateOpen: boolean;
  readonly seed: Md.Document;
  readonly state: SerializedEditorState;
  readonly turnActive: boolean;
}

/**
 * Call shape of the composer decision policy.
 *
 * @category policies
 * @since 0.0.0
 */
export type ComposerPolicyShape = {
  readonly decideSend: (input: ComposerSendInput) => ComposerSendDecision;
};

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

const characterLimitRefusal = (length: number): ComposerSendDecision =>
  refuseWith(
    ComposerNotice.cases.error.make({
      message: `Message is ${length.toLocaleString()} characters — the limit is ${MAX_MESSAGE_CHARACTERS.toLocaleString()}.`,
    })
  );

const acceptWithinLimit: {
  (content: SafeDocument, plainText: string): ComposerSendDecision;
  (plainText: string): (content: SafeDocument) => ComposerSendDecision;
} = dual(2, (content: SafeDocument, plainText: string): ComposerSendDecision => {
  const length = Str.length(plainText);
  return length > MAX_MESSAGE_CHARACTERS
    ? characterLimitRefusal(length)
    : ComposerSendDecision.cases.send.make({ content });
});

/**
 * The pure composer decision policy every composer handler calls directly.
 *
 * **Details**
 *
 * Handlers import this value rather than resolving a service, because the
 * editor's send hook is a synchronous closure with no Effect context to yield
 * from.
 *
 * **Example** (Inspect the policy entry point)
 *
 * ```ts
 * import { composerPolicy } from "@/chat/ui/ComposerPolicy"
 *
 * console.log(typeof composerPolicy.decideSend) // "function"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const composerPolicy: ComposerPolicyShape = {
  decideSend: ({ gateOpen, seed, state, turnActive }) => {
    if (gateOpen) return ComposerSendDecision.cases.gated.make({});
    if (turnActive) return streamingRefusal;
    const content = composerDocumentFromEditorState(seed, state);
    if (A.isReadonlyArrayEmpty(content.children)) return emptyProjectionRefusal;
    return Result.match(refineSafeDocument(content), {
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
};
