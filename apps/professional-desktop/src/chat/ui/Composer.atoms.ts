/**
 * Runtime-owned application behavior for the desktop chat composer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  draftAtoms,
  EditTurnRequest,
  editTargetAtom,
  reportDecodeFailureAtom,
  runTurnAtom,
  SendTurnRequest,
  turnActiveAtom,
} from "@beep/agents-client/Chat.atoms";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { editorStateToDocument } from "@beep/lexical-schema";
import * as Md from "@beep/md/Md.model";
import { renderPlainTextUnsafe } from "@beep/md/Md.render";
import { documentSafetyIssues, refineSafeDocument, SafeDocument } from "@beep/md/Md.safe";
import { LiteralKit } from "@beep/schema";
import { toast } from "@beep/ui/components/sonner";
import { A, O, Str } from "@beep/utils";
import { Effect, Match, Result, Tuple } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type { DocumentSafetyViolation } from "@beep/md/Md.safe";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const MAX_MESSAGE_CHARACTERS = 16_000;

const $I = $ProfessionalDesktopId.create("chat/ui/Composer.atoms");

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

const ComposerNotice = ComposerNoticeKind.mapMembers(
  Tuple.evolve([() => ComposerDecodeErrorNotice, () => ComposerErrorNotice, () => ComposerInfoNotice])
)
  .annotate(
    $I.annote("ComposerNotice", {
      description: "Typed notification commands emitted by the composer state machine.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

type ComposerNotice = typeof ComposerNotice.Type;

/**
 * Inline refusal emitted when a draft contains trusted raw nodes or a URL that
 * is outside the user-content allow list. The general draft remains untouched.
 *
 * @example
 * ```ts
 * import { ComposerSafetyRefusal } from "@/chat/ui/Composer.atoms"
 *
 * const refusal = ComposerSafetyRefusal.make({
 *   issueCount: 1,
 *   message: "This draft contains content that cannot be sent safely.",
 * })
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

const normalizeLegacyInline = (inline: Md.Inline): Md.Inline =>
  Match.value(inline).pipe(
    Match.tagsExhaustive({
      text: (node) => node,
      rawMarkdown: ({ value }) => Md.Text.make({ value }),
      rawHtml: ({ value }) => Md.Text.make({ value }),
      strong: ({ children }) => Md.Strong.make({ children: A.map(children, normalizeLegacyInline) }),
      em: ({ children }) => Md.Em.make({ children: A.map(children, normalizeLegacyInline) }),
      del: ({ children }) => Md.Del.make({ children: A.map(children, normalizeLegacyInline) }),
      code: (node) => node,
      a: ({ children, href, title }) => Md.A.make({ children: A.map(children, normalizeLegacyInline), href, title }),
      img: (node) => node,
      br: (node) => node,
      inlineMath: (node) => node,
      footnoteReference: (node) => node,
    })
  );

const normalizeLegacyListChild = (child: Md.ListItemChild): Md.ListItemChild =>
  Md.Inline.is(child) ? normalizeLegacyInline(child) : normalizeLegacyBlock(child);

const normalizeLegacyListItems = (items: ReadonlyArray<Md.Li>): ReadonlyArray<Md.Li> =>
  A.map(items, ({ children }) => Md.Li.make({ children: A.map(children, normalizeLegacyListChild) }));

const normalizeLegacyTaskItems = (items: ReadonlyArray<Md.TaskItem>): ReadonlyArray<Md.TaskItem> =>
  A.map(items, ({ checked, children }) =>
    Md.TaskItem.make({ checked, children: A.map(children, normalizeLegacyListChild) })
  );

function normalizeLegacyBlock(block: Md.Block): Md.Block {
  return Match.value(block).pipe(
    Match.tagsExhaustive({
      heading: ({ children, level }) => Md.Heading.make({ children: A.map(children, normalizeLegacyInline), level }),
      p: ({ children }) => Md.P.make({ children: A.map(children, normalizeLegacyInline) }),
      blockquote: ({ children }) => Md.BlockQuote.make({ children: A.map(children, normalizeLegacyBlock) }),
      pre: (node) => node,
      ul: ({ children }) => Md.Ul.make({ children: normalizeLegacyListItems(children) }),
      ol: ({ children, start }) => Md.Ol.make({ children: normalizeLegacyListItems(children), start }),
      taskList: ({ children }) => Md.TaskList.make({ children: normalizeLegacyTaskItems(children) }),
      table: ({ align, children, headerRow }) =>
        Md.Table.make({
          align,
          headerRow,
          children: A.map(children, ({ children: cells }) =>
            Md.TableRow.make({
              children: A.map(cells, ({ children: inlines }) =>
                Md.TableCell.make({ children: A.map(inlines, normalizeLegacyInline) })
              ),
            })
          ),
        }),
      youtube: (node) => node,
      mathBlock: (node) => node,
      footnoteDefinition: ({ children, identifier }) =>
        Md.FootnoteDefinition.make({ children: A.map(children, normalizeLegacyBlock), identifier }),
      admonition: ({ children, kind, title }) =>
        Md.Admonition.make({ children: A.map(children, normalizeLegacyBlock), kind, title }),
      embed: (node) => node,
      hr: (node) => node,
    })
  );
}

/**
 * Converts legacy trusted raw Markdown/HTML nodes to ordinary text nodes.
 *
 * The original general {@link Md.Document} is never mutated. URL-bearing nodes
 * are deliberately left unchanged so this helper cannot turn an unsafe URL
 * refusal into an approval. React/Lexical render the replacement text as an
 * escaped literal.
 *
 * @example
 * ```ts
 * import * as Md from "@beep/md/Md.model"
 * import { normalizeLegacyRawDocument } from "@/chat/ui/Composer.atoms"
 *
 * const legacy = Md.Document.make({
 *   children: [Md.P.make({ children: [Md.RawHtml.make({ value: "<b>literal</b>" })] })],
 * })
 * const normalized = normalizeLegacyRawDocument(legacy)
 * console.log(normalized.children[0]?._tag) // "p"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const normalizeLegacyRawDocument = (document: Md.Document): Md.Document =>
  Md.Document.make({
    children: A.map(document.children, normalizeLegacyBlock),
    frontmatter: document.frontmatter,
  });

/**
 * Pending confirmation for a legacy raw document converted to escaped text.
 *
 * @category models
 * @since 0.0.0
 */
class ComposerRawNormalizationGate extends S.TaggedClass<ComposerRawNormalizationGate>(
  $I`ComposerRawNormalizationGate`
)(
  "RawNormalization",
  {
    issueCount: S.Int.check(S.isGreaterThan(0)),
    message: S.NonEmptyString,
    normalized: SafeDocument,
    preview: S.String,
  },
  $I.annote("ComposerRawNormalizationGate", {
    description: "A safe escaped-literal copy awaiting explicit user confirmation before submission.",
  })
) {}

/**
 * Non-convertible safety refusal, such as an unsafe URL destination.
 *
 * @category models
 * @since 0.0.0
 */
class ComposerUnsafeDocumentGate extends S.TaggedClass<ComposerUnsafeDocumentGate>($I`ComposerUnsafeDocumentGate`)(
  "UnsafeDocument",
  {
    issueCount: S.Int.check(S.isGreaterThan(0)),
    message: S.NonEmptyString,
  },
  $I.annote("ComposerUnsafeDocumentGate", {
    description: "A document refusal that must be corrected by editing rather than normalization.",
  })
) {}

/**
 * Tagged safety gate raised before an unsafe or legacy document can be sent.
 *
 * @example
 * ```ts
 * import { ComposerDocumentSafetyGate } from "@/chat/ui/Composer.atoms"
 * import * as S from "effect/Schema"
 *
 * const gate = ComposerDocumentSafetyGate.cases.UnsafeDocument.make({
 *   issueCount: 1,
 *   message: "Replace the unsafe link before sending.",
 * })
 * console.log(S.is(ComposerDocumentSafetyGate)(gate)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ComposerDocumentSafetyGate = S.Union([ComposerRawNormalizationGate, ComposerUnsafeDocumentGate]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ComposerDocumentSafetyGate", {
    description: "Pending legacy normalization confirmation or a non-convertible document refusal.",
  })
);

/**
 * Runtime value represented by {@link ComposerDocumentSafetyGate}.
 *
 * @example
 * ```ts
 * import { ComposerDocumentSafetyGate } from "@/chat/ui/Composer.atoms"
 *
 * const gate: ComposerDocumentSafetyGate = ComposerDocumentSafetyGate.cases.UnsafeDocument.make({
 *   issueCount: 1,
 *   message: "Replace the unsafe link before sending.",
 * })
 * console.log(gate._tag) // "UnsafeDocument"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ComposerDocumentSafetyGate = typeof ComposerDocumentSafetyGate.Type;

const rawNormalizationMessage =
  "This legacy draft contains trusted raw Markdown or HTML. Review the escaped literal copy before sending.";

interface DocumentViolationFlags {
  readonly raw: boolean;
  readonly scalar: boolean;
  readonly url: boolean;
}

const emptyDocumentViolationFlags: DocumentViolationFlags = {
  raw: false,
  scalar: false,
  url: false,
};

const documentViolationFlags = (issues: ReadonlyArray<DocumentSafetyViolation>): DocumentViolationFlags =>
  A.reduce(issues, emptyDocumentViolationFlags, (flags, issue) =>
    Match.value(issue).pipe(
      Match.tagsExhaustive({
        RawNode: () => ({ ...flags, raw: true }),
        InvalidScalar: () => ({ ...flags, scalar: true }),
        UnsafeUrl: () => ({ ...flags, url: true }),
      })
    )
  );

const documentViolationReason = (issues: ReadonlyArray<DocumentSafetyViolation>): string => {
  const flags = documentViolationFlags(issues);
  return Match.value(flags).pipe(
    Match.when(
      { scalar: true, url: true },
      () => "an unsafe link or embedded URL and unsupported text encoding (a NUL character or lone UTF-16 surrogate)"
    ),
    Match.when({ scalar: true }, () => "unsupported text encoding (a NUL character or lone UTF-16 surrogate)"),
    Match.when({ url: true }, () => "a link or embedded URL outside the safe destination policy"),
    Match.orElse(() => "trusted raw Markdown or HTML")
  );
};

const unsafeDocumentMessage = (issues: ReadonlyArray<DocumentSafetyViolation>): string =>
  `This draft contains ${documentViolationReason(issues)}. Edit or replace that content before sending.`;

const keptDraftSafetyMessage = (issues: ReadonlyArray<DocumentSafetyViolation>): string =>
  `This draft contains ${documentViolationReason(issues)}. It cannot be sent safely, and your draft has been kept.`;

const rawNormalizationGate = (safeDocument: SafeDocument, issueCount: number): ComposerRawNormalizationGate =>
  ComposerRawNormalizationGate.make({
    issueCount,
    message: rawNormalizationMessage,
    normalized: safeDocument,
    preview: Str.takeLeft(renderPlainTextUnsafe(safeDocument), 2_000),
  });

/**
 * Classifies a persisted general document before it is projected into Lexical.
 * Raw-only legacy content gets a confirmable escaped copy; any unsafe URL keeps
 * a non-convertible refusal.
 *
 * @example
 * ```ts
 * import { prepareComposerDocumentSafetyGate } from "@/chat/ui/Composer.atoms"
 * import * as Md from "@beep/md/Md.model"
 * import * as O from "effect/Option"
 *
 * const legacy = Md.Document.make({
 *   children: [Md.P.make({ children: [Md.RawHtml.make({ value: "<b>literal</b>" })] })],
 * })
 * console.log(O.getOrThrow(prepareComposerDocumentSafetyGate(legacy))._tag) // "RawNormalization"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const prepareComposerDocumentSafetyGate = (document: Md.Document): O.Option<ComposerDocumentSafetyGate> => {
  const issues = documentSafetyIssues(document);
  if (!A.isReadonlyArrayNonEmpty(issues)) return O.none();
  return Result.match(refineSafeDocument(normalizeLegacyRawDocument(document)), {
    onFailure: (remainingIssues) =>
      O.some(
        ComposerUnsafeDocumentGate.make({
          issueCount: A.length(issues),
          message: unsafeDocumentMessage(remainingIssues),
        })
      ),
    onSuccess: (normalized) => O.some(rawNormalizationGate(normalized, A.length(issues))),
  });
};

/**
 * Per-thread, per-seed safety gate. Its initial state is derived from the
 * original persisted `Document`, before Lexical can lossily project trusted raw
 * nodes to plain text.
 *
 * @example
 * ```ts
 * import { composerDocumentSafetyGateAtoms } from "@/chat/ui/Composer.atoms"
 * import * as Md from "@beep/md/Md.model"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const seed = Md.Document.make({ children: [] })
 * const registry = AtomRegistry.make()
 * const gate = registry.get(composerDocumentSafetyGateAtoms(WorkspaceIdentity.ThreadId.make(1))(seed))
 * console.log(gate._tag) // "None"
 * registry.dispose()
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerDocumentSafetyGateAtoms = Atom.family((_threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    Atom.make<O.Option<ComposerDocumentSafetyGate>>(prepareComposerDocumentSafetyGate(seed))
  )
);

/**
 * One-shot safe payload approved by a legacy normalization confirmation. The
 * next ordinary send consumes this exact document instead of rebuilding it
 * from Lexical's intentionally lossy projection.
 *
 * @example
 * ```ts
 * import { composerConfirmedNormalizationAtoms } from "@/chat/ui/Composer.atoms"
 * import * as Md from "@beep/md/Md.model"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const seed = Md.Document.make({ children: [] })
 * const registry = AtomRegistry.make()
 * const confirmed = registry.get(composerConfirmedNormalizationAtoms(WorkspaceIdentity.ThreadId.make(1))(seed))
 * console.log(confirmed._tag) // "None"
 * registry.dispose()
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerConfirmedNormalizationAtoms = Atom.family((_threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((_seed: Md.Document) => Atom.make<O.Option<SafeDocument>>(O.none()))
);

/**
 * Per-thread safety refusal shown beside the composer. A successful subsequent
 * refinement clears it; rejected drafts stay persisted as general documents.
 *
 * @example
 * ```ts
 * import { composerSafetyRefusalAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerSafetyRefusalAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerSafetyRefusalAtoms = Atom.family((_threadId: WorkspaceIdentity.ThreadId) =>
  Atom.make<O.Option<ComposerSafetyRefusal>>(O.none())
);

const composerNoticeAtom = professionalBrowserRuntime.fn<ComposerNotice>()(
  Effect.fnUntraced(function* (notice, ctx) {
    yield* ComposerNotice.match(notice, {
      "decode-error": (notice) =>
        Effect.sync(() => {
          ctx.set(reportDecodeFailureAtom, void 0);
          toast.error(notice.message);
        }),
      error: (notice) => Effect.sync(() => toast.error(notice.message)),
      info: (notice) => Effect.sync(() => toast.info(notice.message)),
    });
  })
);

/**
 * Untracked draft seed, keyed by thread and failure-driven draft revision.
 *
 * @example
 * ```ts
 * import { composerDraftSeedAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerDraftSeedAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerDraftSeedAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((_revision: number) => Atom.make((get) => get.once(draftAtoms(threadId))))
);

const updateComposerDraftAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    professionalBrowserRuntime.fn<SerializedEditorState>()(
      Effect.fnUntraced(function* (serializedState, ctx) {
        const gateAtom = composerDocumentSafetyGateAtoms(threadId)(seed);
        ctx.set(composerConfirmedNormalizationAtoms(threadId)(seed), O.none());
        const currentGate = ctx(gateAtom);
        const document = composerDocumentFromEditorState(seed, serializedState);
        const nextGate = O.match(currentGate, {
          onNone: O.none<ComposerDocumentSafetyGate>,
          onSome: (gate) =>
            ComposerDocumentSafetyGate.match(gate, {
              RawNormalization: () =>
                Result.match(refineSafeDocument(document), {
                  onFailure: () => prepareComposerDocumentSafetyGate(document),
                  onSuccess: (safeDocument) => O.some(rawNormalizationGate(safeDocument, gate.issueCount)),
                }),
              UnsafeDocument: () => prepareComposerDocumentSafetyGate(document),
            }),
        });

        ctx.set(composerSafetyRefusalAtoms(threadId), O.none());
        ctx.set(gateAtom, nextGate);

        // A pending raw conversion preserves the original general document in
        // draft storage. Once a user edits a non-convertible refusal into a
        // safe document, normal persistence resumes.
        if (O.isSome(nextGate)) return;
        const editingThisThread = O.filter(ctx(editTargetAtom), (target) => target.threadId === threadId);
        if (O.isSome(editingThisThread)) return;
        ctx.set(draftAtoms(threadId), A.isReadonlyArrayEmpty(document.children) ? O.none() : O.some(document));
      })
    )
  )
);

const submitComposerAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  professionalBrowserRuntime.fn<SafeDocument>()(
    Effect.fnUntraced(function* (content, ctx) {
      const request = O.match(
        O.filter(ctx(editTargetAtom), (target) => target.threadId === threadId),
        {
          onNone: () => SendTurnRequest.make({ threadId, content }),
          onSome: (target) => EditTurnRequest.make({ threadId, turnId: target.turnId, content }),
        }
      );
      ctx.set(runTurnAtom, request);
      ctx.set(draftAtoms(threadId), O.none());
      ctx.set(editTargetAtom, O.none());
    })
  )
);

const stopComposerAtom = professionalBrowserRuntime.fn<void>()(
  Effect.fnUntraced(function* (_, ctx) {
    ctx.set(runTurnAtom, Atom.Interrupt);
  })
);

const cancelComposerEditAtom = professionalBrowserRuntime.fn<void>()(
  Effect.fnUntraced(function* (_, ctx) {
    O.match(ctx(editTargetAtom), {
      onNone: () => undefined,
      onSome: (target) => {
        ctx.set(composerConfirmedNormalizationAtoms(target.threadId)(target.content), O.none());
      },
    });
    ctx.set(editTargetAtom, O.none());
  })
);

const reportAttachmentsAtom = professionalBrowserRuntime.fn<ReadonlyArray<File>>()(
  Effect.fnUntraced(function* (files) {
    const count = A.length(files);
    yield* Effect.sync(() =>
      toast.info(
        `Captured ${count} attachment${count === 1 ? "" : "s"} — sending attachments to the model isn't wired yet.`,
        { position: "top-center" }
      )
    );
  })
);

/**
 * Stable editor-change handler that delegates draft projection and state writes
 * to the professional atom runtime.
 *
 * @example
 * ```ts
 * import { composerSerializedChangeHandlerAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerSerializedChangeHandlerAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerSerializedChangeHandlerAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    Atom.make((get) => {
      const updateDraft = updateComposerDraftAtoms(threadId)(seed);
      get.mount(updateDraft);
      return (state: SerializedEditorState): void => get.set(updateDraft, state);
    })
  )
);

/**
 * Rebuilds editable children while retaining persistence-owned frontmatter,
 * which is intentionally outside the Lexical wire vocabulary.
 *
 * @example
 * ```ts
 * import { composerDocumentFromEditorState } from "@/chat/ui/Composer.atoms"
 * import { documentToEditorState } from "@beep/lexical-schema"
 * import * as Md from "@beep/md/Md.model"
 * import * as A from "effect/Array"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const seed = Md.Document.make({ children: [] })
 *   const state = yield* documentToEditorState(seed)
 *   console.log(A.length(composerDocumentFromEditorState(seed, state).children)) // 0
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
  return Md.Document.make({ children: projected.children, frontmatter: seed.frontmatter });
});

/**
 * Selects the document submitted by the composer. A confirmed normalized
 * payload wins over Lexical's projection so lossy nodes such as images retain
 * the exact semantics shown in the confirmation preview. Ordinary projection
 * preserves the seed's persistence-owned frontmatter.
 *
 * @example
 * ```ts
 * import { composerDocumentForSend } from "@/chat/ui/Composer.atoms"
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
 * Stable send handler. Synchronous refusal decisions satisfy the editor
 * contract; notices and accepted state transitions execute through runtime
 * atoms.
 *
 * @example
 * ```ts
 * import { composerSendHandlerAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerSendHandlerAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerSendHandlerAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    Atom.make((get) => {
      const submit = submitComposerAtoms(threadId);
      const confirmedAtom = composerConfirmedNormalizationAtoms(threadId)(seed);
      const gateAtom = composerDocumentSafetyGateAtoms(threadId)(seed);
      get.mount(composerNoticeAtom);
      get.mount(submit);
      get.mount(confirmedAtom);
      return (state: SerializedEditorState): boolean => {
        const confirmed = get.once(confirmedAtom);
        if (O.isNone(confirmed) && O.isSome(get.once(gateAtom))) return false;
        if (get.once(turnActiveAtom)) {
          get.set(confirmedAtom, O.none());
          get.set(
            composerNoticeAtom,
            ComposerNotice.cases.info.make({
              message: "A reply is still streaming — wait for it to finish, or press Stop.",
            })
          );
          return false;
        }
        const content = composerDocumentForSend(seed, state, confirmed);
        if (A.isReadonlyArrayEmpty(content.children)) {
          get.set(confirmedAtom, O.none());
          get.set(
            composerNoticeAtom,
            ComposerNotice.cases["decode-error"].make({
              message: "This message could not be prepared for sending. Your draft has been kept.",
            })
          );
          return false;
        }
        const safeContent = O.match(confirmed, {
          onNone: () => refineSafeDocument(content),
          onSome: Result.succeed,
        });
        return Result.match(safeContent, {
          onFailure: (issues) => {
            get.set(confirmedAtom, O.none());
            get.set(
              composerSafetyRefusalAtoms(threadId),
              O.some(
                ComposerSafetyRefusal.make({
                  issueCount: A.length(issues),
                  message: keptDraftSafetyMessage(issues),
                })
              )
            );
            return false;
          },
          onSuccess: (safeContent) => {
            const length = Str.length(renderPlainTextUnsafe(safeContent));
            if (length > MAX_MESSAGE_CHARACTERS) {
              get.set(confirmedAtom, O.none());
              get.set(
                composerNoticeAtom,
                ComposerNotice.cases.error.make({
                  message: `Message is ${length.toLocaleString()} characters — the limit is ${MAX_MESSAGE_CHARACTERS.toLocaleString()}.`,
                })
              );
              return false;
            }
            get.set(confirmedAtom, O.none());
            get.set(gateAtom, O.none());
            get.set(composerSafetyRefusalAtoms(threadId), O.none());
            get.set(submit, safeContent);
            return true;
          },
        });
      };
    })
  )
);

/**
 * Confirms the latest escaped-literal copy retained by a raw-normalization
 * gate. The caller then dispatches the ordinary editor send command so content,
 * attachments, focus, and selection share the exact successful-send reset.
 *
 * @example
 * ```ts
 * import { composerConfirmNormalizationHandlerAtoms } from "@/chat/ui/Composer.atoms"
 * import * as Md from "@beep/md/Md.model"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const seed = Md.Document.make({ children: [] })
 * const registry = AtomRegistry.make()
 * const confirm = registry.get(
 *   composerConfirmNormalizationHandlerAtoms(WorkspaceIdentity.ThreadId.make(1))(seed),
 * )
 * console.log(confirm()) // false
 * registry.dispose()
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerConfirmNormalizationHandlerAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    Atom.make((get) => {
      const gateAtom = composerDocumentSafetyGateAtoms(threadId)(seed);
      const confirmedAtom = composerConfirmedNormalizationAtoms(threadId)(seed);
      get.mount(composerNoticeAtom);
      get.mount(confirmedAtom);
      return (): boolean => {
        if (get.once(turnActiveAtom)) {
          get.set(
            composerNoticeAtom,
            ComposerNotice.cases.info.make({
              message: "A reply is still streaming — wait for it to finish, or press Stop.",
            })
          );
          return false;
        }
        return O.match(get.once(gateAtom), {
          onNone: () => false,
          onSome: (gate) =>
            ComposerDocumentSafetyGate.match(gate, {
              UnsafeDocument: () => false,
              RawNormalization: ({ normalized }) => {
                const plainText = renderPlainTextUnsafe(normalized);
                const length = Str.length(plainText);
                if (Str.isEmpty(Str.trim(plainText))) {
                  get.set(
                    composerNoticeAtom,
                    ComposerNotice.cases.error.make({
                      message: "The escaped copy contains no visible text. Edit the draft before sending.",
                    })
                  );
                  return false;
                }
                if (length > MAX_MESSAGE_CHARACTERS) {
                  get.set(
                    composerNoticeAtom,
                    ComposerNotice.cases.error.make({
                      message: `Message is ${length.toLocaleString()} characters — the limit is ${MAX_MESSAGE_CHARACTERS.toLocaleString()}.`,
                    })
                  );
                  return false;
                }
                get.set(confirmedAtom, O.some(normalized));
                get.set(composerSafetyRefusalAtoms(threadId), O.none());
                return true;
              },
            }),
        });
      };
    })
  )
);

/**
 * Stable stop handler backed by a runtime action.
 *
 * @example
 * ```ts
 * import { composerStopHandlerAtom } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerStopHandlerAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerStopHandlerAtom = Atom.make((get) => {
  get.mount(stopComposerAtom);
  return (): void => get.set(stopComposerAtom, void 0);
});

/**
 * Stable edit-cancellation handler backed by a runtime action.
 *
 * @example
 * ```ts
 * import { composerCancelEditHandlerAtom } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerCancelEditHandlerAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerCancelEditHandlerAtom = Atom.make((get) => {
  get.mount(cancelComposerEditAtom);
  return (): void => get.set(cancelComposerEditAtom, void 0);
});

/**
 * Stable attachment handler backed by a runtime notification effect.
 *
 * @example
 * ```ts
 * import { composerAttachmentHandlerAtom } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerAttachmentHandlerAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerAttachmentHandlerAtom = Atom.make((get) => {
  get.mount(reportAttachmentsAtom);
  return (files: ReadonlyArray<File>): void => get.set(reportAttachmentsAtom, files);
});
