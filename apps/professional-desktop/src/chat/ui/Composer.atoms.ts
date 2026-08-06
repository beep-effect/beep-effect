/**
 * Runtime-owned application behavior for the desktop chat composer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  draftAtoms,
  draftRevisionAtoms,
  EditTurnRequest,
  editTargetAtom,
  reportDecodeFailureAtom,
  runTurnAtom,
  SendTurnRequest,
  turnActiveAtom,
} from "@beep/agents-client/Chat.atoms";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import * as Md from "@beep/md/Md.model";
import { renderPlainTextUnsafe } from "@beep/md/Md.render";
import { documentSafetyIssues, refineSafeDocument, SafeDocument } from "@beep/md/Md.safe";
import { toast } from "@beep/ui/components/sonner";
import { A, O, Str, thunkUndefined } from "@beep/utils";
import { Effect, Match, Result } from "effect";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import {
  ComposerNotice,
  ComposerSendDecision,
  composerDocumentFromEditorState,
  composerPolicy,
  documentViolationFlags,
  unsafeDocumentMessage,
} from "./ComposerPolicy.ts";
import type { EditTarget } from "@beep/agents-client/Chat.atoms";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { ComposerSafetyRefusal } from "./ComposerPolicy.ts";

const $I = $ProfessionalDesktopId.create("chat/ui/Composer.atoms");

const normalizeLegacyInline: (inline: Md.Inline) => Md.Inline = Match.type<Md.Inline>().pipe(
  Match.withReturnType<Md.Inline>(),
  Match.tags({
    rawMarkdown: ({ value }) => Md.Text.make({ value }),
    rawHtml: ({ value }) => Md.Text.make({ value }),
    strong: ({ children }) => Md.Strong.make({ children: A.map(children, normalizeLegacyInline) }),
    em: ({ children }) => Md.Em.make({ children: A.map(children, normalizeLegacyInline) }),
    del: ({ children }) => Md.Del.make({ children: A.map(children, normalizeLegacyInline) }),
    a: ({ children, href, title }) =>
      Md.A.make({
        children: A.map(children, normalizeLegacyInline),
        href,
        title,
      }),
  }),
  Match.orElse((node) => node)
);

const normalizeLegacyListChild = (child: Md.ListItemChild): Md.ListItemChild =>
  Md.Inline.is(child) ? normalizeLegacyInline(child) : normalizeLegacyBlock(child);

const normalizeLegacyListItems = (items: ReadonlyArray<Md.Li>): ReadonlyArray<Md.Li> =>
  A.map(items, ({ children }) => Md.Li.make({ children: A.map(children, normalizeLegacyListChild) }));

const normalizeLegacyTaskItems = (items: ReadonlyArray<Md.TaskItem>): ReadonlyArray<Md.TaskItem> =>
  A.map(items, ({ checked, children }) =>
    Md.TaskItem.make({
      checked,
      children: A.map(children, normalizeLegacyListChild),
    })
  );

const normalizeLegacyBlock: (block: Md.Block) => Md.Block = Match.type<Md.Block>().pipe(
  Match.withReturnType<Md.Block>(),
  Match.tags({
    heading: ({ children, level }) =>
      Md.Heading.make({
        children: A.map(children, normalizeLegacyInline),
        level,
      }),
    p: ({ children }) => Md.P.make({ children: A.map(children, normalizeLegacyInline) }),
    blockquote: ({ children }) => Md.BlockQuote.make({ children: A.map(children, normalizeLegacyBlock) }),
    ul: ({ children }) => Md.Ul.make({ children: normalizeLegacyListItems(children) }),
    ol: ({ children, start }) =>
      Md.Ol.make({
        children: normalizeLegacyListItems(children),
        start,
      }),
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
    footnoteDefinition: ({ children, identifier }) =>
      Md.FootnoteDefinition.make({
        children: A.map(children, normalizeLegacyBlock),
        identifier,
      }),
    admonition: ({ children, kind, title }) =>
      Md.Admonition.make({
        children: A.map(children, normalizeLegacyBlock),
        kind,
        title,
      }),
  }),
  Match.orElse((node) => node)
);

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
    rawNormalizationPending: S.Boolean,
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
 *   rawNormalizationPending: false,
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
 *   rawNormalizationPending: false,
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

const rawNormalizationGate = (safeDocument: SafeDocument, issueCount: number): ComposerRawNormalizationGate =>
  ComposerRawNormalizationGate.make({
    issueCount,
    message: rawNormalizationMessage,
    normalized: safeDocument,
    preview: Str.takeLeft(renderPlainTextUnsafe(safeDocument), 2_000),
  });

const preparePendingRawNormalizationGate = (
  document: Md.Document,
  issueCount: number
): O.Option<ComposerDocumentSafetyGate> =>
  Result.match(refineSafeDocument(normalizeLegacyRawDocument(document)), {
    onFailure: (remainingIssues) =>
      O.some(
        ComposerUnsafeDocumentGate.make({
          issueCount,
          message: unsafeDocumentMessage(remainingIssues),
          rawNormalizationPending: true,
        })
      ),
    onSuccess: (normalized) => O.some(rawNormalizationGate(normalized, issueCount)),
  });

/**
 * Classifies a persisted general document before it is projected into Lexical.
 * Raw-only legacy content gets a confirmable escaped copy. A co-occurring
 * non-convertible violation keeps the refusal while retaining the pending raw
 * provenance for confirmation after that violation is corrected.
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
          rawNormalizationPending: documentViolationFlags(issues).raw,
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
              RawNormalization: () => preparePendingRawNormalizationGate(document, gate.issueCount),
              UnsafeDocument: ({ issueCount, rawNormalizationPending }) =>
                rawNormalizationPending
                  ? preparePendingRawNormalizationGate(document, issueCount)
                  : prepareComposerDocumentSafetyGate(document),
            }),
        });

        ctx.set(composerSafetyRefusalAtoms(threadId), O.none());
        ctx.set(gateAtom, nextGate);

        // A pending raw conversion preserves the original general document in
        // draft storage, including while another violation blocks conversion.
        // Only a corrected refusal with no raw provenance resumes normal
        // persistence; corrected raw content remains gated for confirmation.
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
          onSome: (target) =>
            EditTurnRequest.make({
              threadId,
              turnId: target.turnId,
              content,
            }),
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
      onNone: thunkUndefined,
      onSome: (target) => {
        ctx.set(composerConfirmedNormalizationAtoms(target.threadId)(target.content), O.none());
      },
    });
    ctx.set(editTargetAtom, O.none());
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
        const decision = composerPolicy.decideSend({
          confirmed: get.once(confirmedAtom),
          gateOpen: O.isSome(get.once(gateAtom)),
          seed,
          state,
          turnActive: get.once(turnActiveAtom),
        });
        return ComposerSendDecision.match(decision, {
          gated: () => false,
          refuse: ({ notice }) => {
            get.set(confirmedAtom, O.none());
            get.set(composerNoticeAtom, notice);
            return false;
          },
          unsafe: ({ refusal }) => {
            get.set(confirmedAtom, O.none());
            get.set(composerSafetyRefusalAtoms(threadId), O.some(refusal));
            return false;
          },
          send: ({ content }) => {
            get.set(confirmedAtom, O.none());
            get.set(gateAtom, O.none());
            get.set(composerSafetyRefusalAtoms(threadId), O.none());
            get.set(submit, content);
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
        const decision = composerPolicy.decideConfirmNormalization({
          normalized: O.flatMap(
            get.once(gateAtom),
            ComposerDocumentSafetyGate.match({
              UnsafeDocument: () => O.none<SafeDocument>(),
              RawNormalization: ({ normalized }) => O.some(normalized),
            })
          ),
          turnActive: get.once(turnActiveAtom),
        });
        return ComposerSendDecision.match(decision, {
          gated: () => false,
          refuse: ({ notice }) => {
            get.set(composerNoticeAtom, notice);
            return false;
          },
          unsafe: () => false,
          send: ({ content }) => {
            get.set(confirmedAtom, O.some(content));
            get.set(composerSafetyRefusalAtoms(threadId), O.none());
            return true;
          },
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

// Derives the content to seed the editor with. Editing wins over the draft;
// the draft seeds only on thread / edit-target switches.
const contentToLoadFor = (editTarget: O.Option<EditTarget>, draft: O.Option<Md.Document>): O.Option<Md.Document> =>
  O.match(editTarget, {
    onNone: () => draft,
    onSome: (target) => O.some(target.content),
  });

interface ComposerShellView {
  readonly cancelEdit: () => void;
  readonly composerKey: string;
  readonly contentToLoad: O.Option<Md.Document>;
  readonly isEditing: boolean;
  readonly safetyRefusal: O.Option<ComposerSafetyRefusal>;
  readonly stop: () => void;
  readonly streaming: boolean;
}

/**
 * One read for the composer shell: edit state, streaming flag, seeded content,
 * remount key, refusal banner, and the stable stop/cancel handlers.
 *
 * @example
 * ```ts
 * import { composerShellAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerShellAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerShellAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.make((get): ComposerShellView => {
    // Edit state is global while the composer is per-thread: an edit target from
    // another thread would otherwise seed this composer and submit that thread's
    // turn id against this one.
    const editTarget = O.filter(get(editTargetAtom), (target) => target.threadId === threadId);
    const draftRevision = get(draftRevisionAtoms(threadId));
    const draft = get(composerDraftSeedAtoms(threadId)(draftRevision));
    return {
      cancelEdit: get(composerCancelEditHandlerAtom),
      composerKey: O.match(editTarget, {
        onNone: () => `thread:${threadId}:${draftRevision}`,
        onSome: (target) => `edit:${target.turnId}`,
      }),
      contentToLoad: contentToLoadFor(editTarget, draft),
      isEditing: O.isSome(editTarget),
      safetyRefusal: get(composerSafetyRefusalAtoms(threadId)),
      stop: get(composerStopHandlerAtom),
      streaming: get(turnActiveAtom),
    };
  })
);

interface ComposerSurfaceView {
  readonly confirmNormalization: () => boolean;
  readonly onSend: (state: SerializedEditorState) => boolean;
  readonly onSerializedChange: (state: SerializedEditorState) => void;
  readonly safetyGate: O.Option<ComposerDocumentSafetyGate>;
}

/**
 * One read for the mounted editor surface: the safety gate plus the three
 * stable handlers, all keyed by the same `(threadId, seed)` pair so the
 * component never re-derives the double family application.
 *
 * @example
 * ```ts
 * import { composerSurfaceAtoms } from "@/chat/ui/Composer.atoms"
 *
 * console.log(typeof composerSurfaceAtoms === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const composerSurfaceAtoms = Atom.family((threadId: WorkspaceIdentity.ThreadId) =>
  Atom.family((seed: Md.Document) =>
    Atom.make(
      (get): ComposerSurfaceView => ({
        confirmNormalization: get(composerConfirmNormalizationHandlerAtoms(threadId)(seed)),
        onSend: get(composerSendHandlerAtoms(threadId)(seed)),
        onSerializedChange: get(composerSerializedChangeHandlerAtoms(threadId)(seed)),
        safetyGate: get(composerDocumentSafetyGateAtoms(threadId)(seed)),
      })
    )
  )
);
