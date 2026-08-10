/**
 * Chat composer: a feature-flagged rich-text surface that sends or
 * edit-regenerates an assistant turn.
 *
 * Wraps `@beep/editor`'s {@link ChatComposer} (toolbar, `/` slash, `@` mentions,
 * attachment capture, plain-Enter-to-send, character count, send/stop) and
 * injects the product meaning: the formatting/insert slash items, a workspace
 * mention source, send wiring, and attachment-transport status. The foundation
 * owns the mechanism; this file owns the meaning.
 *
 * The composer surfaces content via `onSerializedChange`; the latest serialized
 * state is held in a per-thread atom and the persisted draft is mirrored into
 * {@link draftAtoms} on every change. Loading a draft or an {@link editTargetAtom}
 * content is done by recomputing `initialState` and remounting via a changing
 * `key`. On submit the state is projected to a `@beep/md` document via
 * {@link editorStateToDocument} and dispatched through {@link runTurnAtom} as a
 * {@link SendTurnRequest} (new message) or {@link EditTurnRequest} (edit target).
 * Plain Enter sends (the foundation `SendPlugin`); Stop interrupts the turn fiber.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */
"use client";

import {
  draftRevisionAtoms,
  editTargetAtom,
  reportDecodeFailureAtom,
  runTurnAtom,
  turnActiveAtom,
} from "@beep/agents-client/Chat.atoms";
import { attachmentsAtom } from "@beep/editor/chat/atoms";
import { ChatComposer } from "@beep/editor/chat/chat-composer";
import { SEND_MESSAGE_COMMAND } from "@beep/editor/chat/commands";
import { MentionOption } from "@beep/editor/chat/config";
import { defaultChatSlashItems } from "@beep/editor/chat/slash-items";
import * as Md from "@beep/md/Md.model";
import { Button } from "@beep/ui/components/button";
import { A, O, Str } from "@beep/utils";
import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import {
  ComposerDocumentSafetyGate,
  composerCancelEditHandlerAtom,
  composerConfirmNormalizationHandlerAtoms,
  composerDocumentSafetyGateAtoms,
  composerDraftSeedAtoms,
  composerSafetyRefusalAtoms,
  composerSendHandlerAtoms,
  composerSerializedChangeHandlerAtoms,
  composerStopHandlerAtom,
} from "./Composer.atoms.ts";
import { documentEditorStateAtom } from "./editor-state.atoms.ts";
import type { EditTarget } from "@beep/agents-client/Chat.atoms";
import type { ChatComposerMountConfig } from "@beep/editor/chat/chat-composer";
import type { MentionSource } from "@beep/editor/chat/config";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { JSX } from "react";

type ThreadId = WorkspaceIdentity.ThreadId;

// Derives the content to seed the editor with, hoisted out of a useMemo. Editing
// wins over the draft; the draft seeds only on thread / edit-target switches.
const contentToLoadFor = (editTarget: O.Option<EditTarget>, draft: O.Option<Md.Document>): O.Option<Md.Document> =>
  O.match(editTarget, {
    onNone: () => draft,
    onSome: (t) => O.some(t.content),
  });

// v1 mention source — a small app-injected set demonstrating ephemeral `@`
// mentions. Real entity / prior-art / persona sources land with the knowledge
// graph; mentions serialize to plain text, so swapping the source is additive.
const MENTION_CANDIDATES: ReadonlyArray<MentionOption> = [
  MentionOption.make({ id: "assistant", label: "assistant", hint: "the workspace agent" }),
  MentionOption.make({ id: "workspace", label: "workspace", hint: "the active workspace" }),
  MentionOption.make({ id: "thread", label: "thread", hint: "this conversation" }),
];

const mentionSource: MentionSource = (query) => {
  const q = Str.toLowerCase(query);
  return A.filter(MENTION_CANDIDATES, (candidate) => Str.includes(q)(Str.toLowerCase(candidate.label)));
};

const emptyDocument = Md.Document.make({ children: [] });

/**
 * Visible safety gate shared by send-time refusals and legacy raw-document
 * normalization. Preview content is rendered as React text in a `<pre>`, never
 * as HTML.
 *
 * **Example** (Safety warning with preview)
 *
 * ```tsx
 * import { ComposerSafetyWarning } from "@/chat/ui/Composer"
 *
 * function LegacyDraftWarning() {
 *   return (
 *     <ComposerSafetyWarning
 *       message="Review the escaped literal copy before sending."
 *       preview="<strong>literal text</strong>"
 *       onConfirm={() => console.log("confirmed")}
 *     />
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ComposerSafetyWarning({
  message,
  onConfirm,
  preview,
}: {
  readonly message: string;
  readonly onConfirm?: (() => void) | undefined;
  readonly preview?: string | undefined;
}): JSX.Element {
  return (
    <div
      className="mb-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      role="alert"
    >
      <p>{message}</p>
      {preview === undefined ? null : (
        <>
          <p className="mt-2 font-medium">Escaped literal preview</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded border bg-background p-2 text-foreground">
            {preview}
          </pre>
          <Button className="mt-2" size="sm" type="button" onClick={onConfirm}>
            Send escaped literal copy
          </Button>
        </>
      )}
    </div>
  );
}

function ComposerRawNormalizationWarning({
  message,
  onConfirm,
  preview,
}: {
  readonly message: string;
  readonly onConfirm: () => boolean;
  readonly preview: string;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  return (
    <ComposerSafetyWarning
      message={message}
      preview={preview}
      onConfirm={() => {
        if (onConfirm()) editor.dispatchCommand(SEND_MESSAGE_COMMAND, undefined);
      }}
    />
  );
}

/**
 * The thread composer. Persists drafts, loads edit targets, and dispatches
 * send/edit turns.
 *
 * **Example** (Log Composer component name)
 *
 * ```tsx
 * import { Composer } from "@/chat/ui/Composer"
 *
 * console.log(Composer.name) // "Composer"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Composer({ threadId }: { readonly threadId: ThreadId }): JSX.Element {
  // Edit state is global while the composer is per-thread: an edit target from
  // another thread would otherwise seed this composer and submit that thread's
  // turn id against this one.
  const editTarget = O.filter(useAtomValue(editTargetAtom), (target) => target.threadId === threadId);
  const streaming = useAtomValue(turnActiveAtom);
  const draftRevision = useAtomValue(draftRevisionAtoms(threadId));
  const draft = useAtomValue(composerDraftSeedAtoms(threadId)(draftRevision));
  const safetyRefusal = useAtomValue(composerSafetyRefusalAtoms(threadId));
  const cancelEdit = useAtomValue(composerCancelEditHandlerAtom);
  const stop = useAtomValue(composerStopHandlerAtom);

  // keep the report + turn fibers subscribed — unobserved fn atoms get
  // interrupted by the registry (POC lesson, ported verbatim). ChatComposer
  // already drops out-of-schema states internally, so onSerializedChange only
  // ever sees valid content; the decode-failure fiber stays mounted as the
  // contracted observability sink for that path.
  useAtomMount(reportDecodeFailureAtom);
  useAtomMount(runTurnAtom);

  const isEditing = O.isSome(editTarget);

  // initial content + a remount `key` so switching thread / edit-target remounts
  // the composer with the right state loaded. Editing wins over the draft (derived
  // by the module-level contentToLoadFor, not a useMemo).
  const contentToLoad = contentToLoadFor(editTarget, draft);

  const composerKey = O.match(editTarget, {
    onNone: () => `thread:${threadId}:${draftRevision}`,
    onSome: (t) => `edit:${t.turnId}`,
  });

  const composerProps: ThreadComposerProps = {
    threadId,
    onStop: stop,
    streaming,
    sendLabel: isEditing ? "Rewrite" : "Send",
  };

  return (
    <div className="shrink-0 border-t bg-background/80 p-3 backdrop-blur" data-testid="composer">
      {isEditing ? (
        <div className="mb-2 flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <span>Editing message — sending will rewrite the thread from this point.</span>
          <Button variant="ghost" size="sm" onClick={cancelEdit}>
            Cancel
          </Button>
        </div>
      ) : null}
      {O.match(safetyRefusal, {
        onNone: () => null,
        onSome: (refusal) => <ComposerSafetyWarning message={refusal.message} />,
      })}
      {O.match(contentToLoad, {
        onNone: () => <ThreadComposer key={composerKey} {...composerProps} />,
        onSome: (content) => <ThreadComposer key={composerKey} content={content} {...composerProps} />,
      })}
    </div>
  );
}

interface ThreadComposerProps {
  readonly content?: Md.Document;
  readonly onStop: () => void;
  readonly sendLabel: string;
  readonly streaming: boolean;
  readonly threadId: ThreadId;
}

function ComposerSafetyGateNotice({
  gate,
  onConfirm,
}: {
  readonly gate: O.Option<ComposerDocumentSafetyGate>;
  readonly onConfirm: () => boolean;
}): JSX.Element | null {
  return O.match(gate, {
    onNone: () => null,
    onSome: ComposerDocumentSafetyGate.match({
      UnsafeDocument: ({ message }) => <ComposerSafetyWarning message={message} />,
      RawNormalization: ({ message, preview }) => (
        <ComposerRawNormalizationWarning message={message} preview={preview} onConfirm={onConfirm} />
      ),
    }),
  });
}

function AttachmentTransportNotice(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const attachments = useAtomValue(attachmentsAtom(editor));

  return A.match(attachments, {
    onEmpty: () => null,
    onNonEmpty: (attachments) => {
      const count = A.length(attachments);
      return (
        <p
          className="mx-3 mt-2 rounded border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground"
          role="status"
        >
          Captured {count} attachment{count === 1 ? "" : "s"} — attachments are previewed locally and aren't sent to the
          model yet.
        </p>
      );
    },
  });
}

const editorStateAtomFor = (
  content: Md.Document | undefined
): Atom.Atom<AsyncResult.AsyncResult<SerializedEditorState, unknown>> =>
  content === undefined ? emptyEditorStateAtom : documentEditorStateAtom(content);

// Resolves the optional seed document to a serialized editor state through the
// shared documentEditorStateAtom family (no runSyncExit). documentToEditorState is
// a pure codec, so the runtime atom resolves to Success synchronously on first
// read — the editor mounts WITH the seed (no empty frame); a codec failure
// degrades to an empty editor. The send handler receives the editor's live state
// at send time, so there is no latest-state mirror to seed here.
function ThreadComposer({ content, onStop, sendLabel, streaming, threadId }: ThreadComposerProps): JSX.Element {
  const safetySeed = content ?? emptyDocument;
  const safetyGate = useAtomValue(composerDocumentSafetyGateAtoms(threadId)(safetySeed));
  const confirmNormalization = useAtomValue(composerConfirmNormalizationHandlerAtoms(threadId)(safetySeed));
  const onSend = useAtomValue(composerSendHandlerAtoms(threadId)(safetySeed));
  const onSerializedChange = useAtomValue(composerSerializedChangeHandlerAtoms(threadId)(safetySeed));
  const initialState = useAtomValue(editorStateAtomFor(content));
  const seedState = O.flatMap(O.fromUndefinedOr(content), () => AsyncResult.value(initialState));
  const mountConfig: ChatComposerMountConfig = { onSend };

  return (
    <ChatComposer
      {...O.getSomesStruct({ initialState: seedState })}
      placeholder="Message… (Enter to send, Shift+Enter for a newline)"
      onSerializedChange={onSerializedChange}
      mountConfig={mountConfig}
      onStop={onStop}
      streaming={streaming}
      sendDisabled={O.isSome(safetyGate)}
      sendLabel={sendLabel}
      slashItems={defaultChatSlashItems}
      mentionSource={mentionSource}
    >
      <AttachmentTransportNotice />
      <ComposerSafetyGateNotice gate={safetyGate} onConfirm={confirmNormalization} />
    </ChatComposer>
  );
}

// A stable initial AsyncResult for the no-seed branch, so the hook in
// ThreadComposer stays unconditional.
const emptyEditorStateAtom = Atom.make(AsyncResult.initial<SerializedEditorState>());
