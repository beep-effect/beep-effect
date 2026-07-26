/**
 * Chat composer: a feature-flagged rich-text surface that sends or
 * edit-regenerates an assistant turn.
 *
 * Wraps `@beep/editor`'s {@link ChatComposer} (toolbar, `/` slash, `@` mentions,
 * attachment capture, plain-Enter-to-send, character count, send/stop) and
 * injects the product meaning: the formatting/insert slash items, a workspace
 * mention source, and the send/attachment wiring. The foundation owns the
 * mechanism; this file owns the meaning.
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
import { ChatComposer, defaultChatSlashItems } from "@beep/editor";
import { Button } from "@beep/ui/components/button";
import { A, O, Str } from "@beep/utils";
import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import {
  composerAttachmentHandlerAtom,
  composerCancelEditHandlerAtom,
  composerDraftSeedAtoms,
  composerSendHandlerAtoms,
  composerSerializedChangeHandlerAtoms,
  composerStopHandlerAtom,
} from "./Composer.atoms.ts";
import { documentEditorStateAtom } from "./editor-state.atoms.ts";
import type { EditTarget } from "@beep/agents-client/Chat.atoms";
import type { MentionOption, MentionSource } from "@beep/editor";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type * as Md from "@beep/md/Md.model";
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
  { id: "assistant", label: "assistant", hint: "the workspace agent" },
  { id: "workspace", label: "workspace", hint: "the active workspace" },
  { id: "thread", label: "thread", hint: "this conversation" },
];

const mentionSource: MentionSource = (query) => {
  const q = query.toLowerCase();
  return A.filter(MENTION_CANDIDATES, (candidate) => Str.includes(q)(candidate.label.toLowerCase()));
};

/**
 * The thread composer. Persists drafts, loads edit targets, and dispatches
 * send/edit turns.
 *
 * @example
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
  const onAttach = useAtomValue(composerAttachmentHandlerAtom);
  const cancelEdit = useAtomValue(composerCancelEditHandlerAtom);
  const submit = useAtomValue(composerSendHandlerAtoms(threadId));
  const onSerializedChange = useAtomValue(composerSerializedChangeHandlerAtoms(threadId));
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
    onSerializedChange,
    onSend: submit,
    onStop: stop,
    streaming,
    sendLabel: isEditing ? "Rewrite" : "Send",
    onAttach,
  };

  return (
    <div className="border-t bg-background/80 p-3 backdrop-blur" data-testid="composer">
      {isEditing ? (
        <div className="mb-2 flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
          <span>Editing message — sending will rewrite the thread from this point.</span>
          <Button variant="ghost" size="sm" onClick={cancelEdit}>
            Cancel
          </Button>
        </div>
      ) : null}
      {O.match(contentToLoad, {
        onNone: () => <ThreadComposer key={composerKey} {...composerProps} />,
        onSome: (content) => <ThreadComposer key={composerKey} content={content} {...composerProps} />,
      })}
    </div>
  );
}

interface ThreadComposerProps {
  readonly content?: Md.Document;
  readonly onAttach: (files: ReadonlyArray<File>) => void;
  readonly onSend: (state: SerializedEditorState) => boolean;
  readonly onSerializedChange: (state: SerializedEditorState) => void;
  readonly onStop: () => void;
  readonly sendLabel: string;
  readonly streaming: boolean;
}

// Resolves the optional seed document to a serialized editor state through the
// shared documentEditorStateAtom family (no runSyncExit). documentToEditorState is
// a pure codec, so the runtime atom resolves to Success synchronously on first
// read — the editor mounts WITH the seed (no empty frame); a codec failure
// degrades to an empty editor. The send handler receives the editor's live state
// at send time, so there is no latest-state mirror to seed here.
function ThreadComposer({
  content,
  onAttach,
  onSend,
  onSerializedChange,
  onStop,
  sendLabel,
  streaming,
}: ThreadComposerProps): JSX.Element {
  const initialState = useAtomValue(content === undefined ? emptyEditorStateAtom : documentEditorStateAtom(content));
  const seedState = content === undefined ? O.none<SerializedEditorState>() : AsyncResult.value(initialState);

  return (
    <ChatComposer
      {...O.getSomesStruct({ initialState: seedState })}
      placeholder="Message… (Enter to send, Shift+Enter for a newline)"
      onSerializedChange={onSerializedChange}
      onSend={onSend}
      onStop={onStop}
      streaming={streaming}
      sendLabel={sendLabel}
      slashItems={defaultChatSlashItems}
      mentionSource={mentionSource}
      onAttach={onAttach}
    />
  );
}

// A stable initial AsyncResult for the no-seed branch, so the hook in
// ThreadComposer stays unconditional.
const emptyEditorStateAtom = Atom.make(AsyncResult.initial<SerializedEditorState>());
