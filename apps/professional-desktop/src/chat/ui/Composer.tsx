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
 * This file reads two view models and renders; it holds no send logic of its own.
 * {@link composerShellAtoms} supplies the per-thread shell — edit-target state and
 * its cancel handler, streaming and stop, the seed document to load, the remount
 * `key` that reloads it, and the seed-time {@link ComposerSafetyRefusal} banner.
 * {@link composerSurfaceAtoms} supplies the per-seed surface — the safety gate
 * that drives `sendDisabled`, plus the two stable handlers the foundation calls
 * (`onSerializedChange` on every keystroke, `onSend` on submit).
 *
 * Behind those views, `ComposerPolicy` decides send-versus-rewrite-versus-refuse
 * and projects the editor state to a `@beep/md` document, and `Composer.atoms.ts`
 * mirrors the persisted draft and dispatches the decided turn through
 * {@link runTurnAtom}. Plain Enter sends (the foundation `SendPlugin`); Stop
 * interrupts the turn fiber. A draft that fails the safety policy is refused, not
 * confirmable: Send stays disabled and the banner is message-only, so refused
 * content is never echoed back into the editor.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */
"use client";

import { reportDecodeFailureAtom, runTurnAtom } from "@beep/agents-client/Chat.atoms";
import { attachmentsAtom } from "@beep/editor/chat/atoms";
import { ChatComposer } from "@beep/editor/chat/chat-composer";
import { MentionOption } from "@beep/editor/chat/config";
import { defaultChatSlashItems } from "@beep/editor/chat/slash-items";
import * as Md from "@beep/md/Md.model";
import { Button } from "@beep/ui/components/button";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { thunkNull } from "@beep/utils/thunk";
import { useAtomMount, useAtomValue } from "@effect/atom-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { composerShellAtoms, composerSurfaceAtoms } from "./Composer.atoms.ts";
import { documentEditorStateAtom } from "./editor-state.atoms.ts";
import type { ChatComposerMountConfig } from "@beep/editor/chat/chat-composer";
import type { MentionSource } from "@beep/editor/chat/config";
import type { SerializedEditorState } from "@beep/lexical-schema/Lexical.model";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { JSX } from "react";
import type { ComposerSafetyRefusal } from "./ComposerPolicy.ts";

type ThreadId = WorkspaceIdentity.ThreadId;

const STATIC_MENTION_CANDIDATES: ReadonlyArray<MentionOption> = [
  MentionOption.make({ id: "assistant", label: "assistant", hint: "the workspace agent" }),
  MentionOption.make({ id: "workspace", label: "workspace", hint: "the active workspace" }),
  MentionOption.make({ id: "thread", label: "thread", hint: "this conversation" }),
];

const mentionSource: MentionSource = (query) => {
  const q = Str.toLowerCase(query);
  return A.filter(STATIC_MENTION_CANDIDATES, (candidate) => Str.includes(q)(Str.toLowerCase(candidate.label)));
};

const emptyDocument = Md.Document.make({ children: [] });

function ComposerSafetyWarning({ message }: { readonly message: string }): JSX.Element {
  return (
    <div
      className="mb-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
      role="alert"
    >
      <p>{message}</p>
    </div>
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
// decision: workbench-shell-owns-viewport-and-theme
export function Composer({ threadId }: { readonly threadId: ThreadId }): JSX.Element {
  const shell = useAtomValue(composerShellAtoms(threadId));

  useAtomMount(reportDecodeFailureAtom);
  useAtomMount(runTurnAtom);

  const composerProps: ThreadComposerProps = {
    content: shell.contentToLoad,
    threadId,
    onStop: shell.stop,
    streaming: shell.streaming,
    sendLabel: shell.isEditing ? "Rewrite" : "Send",
  };

  return (
    <div
      className="flex max-h-1/2 shrink-0 flex-col border-t bg-background/80 p-3 backdrop-blur"
      data-testid="composer"
    >
      {shell.isEditing ? (
        <div className="mb-2 flex items-center justify-between rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          <span>Editing message — sending will rewrite the thread from this point.</span>
          <Button variant="ghost" size="sm" onClick={shell.cancelEdit}>
            Cancel
          </Button>
        </div>
      ) : null}
      {O.match(shell.safetyRefusal, {
        onNone: thunkNull,
        onSome: (refusal) => <ComposerSafetyWarning message={refusal.message} />,
      })}
      <ThreadComposer key={shell.composerKey} {...composerProps} />
    </div>
  );
}

interface ThreadComposerProps {
  readonly content: O.Option<Md.Document>;
  readonly onStop: () => void;
  readonly sendLabel: string;
  readonly streaming: boolean;
  readonly threadId: ThreadId;
}

function ComposerSafetyGateNotice({ gate }: { readonly gate: O.Option<ComposerSafetyRefusal> }): JSX.Element | null {
  return O.match(gate, {
    onNone: thunkNull,
    onSome: (refusal) => <ComposerSafetyWarning message={refusal.message} />,
  });
}

function AttachmentTransportNotice(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const attachments = useAtomValue(attachmentsAtom(editor));

  return A.match(attachments, {
    onEmpty: thunkNull,
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

function ThreadComposer({ content, onStop, sendLabel, streaming, threadId }: ThreadComposerProps): JSX.Element {
  const safetySeed = content.pipe(O.getOrElse(() => emptyDocument));
  const surface = useAtomValue(composerSurfaceAtoms(threadId)(safetySeed));
  const initialState = useAtomValue(
    content.pipe(
      O.match({
        onNone: () => emptyEditorStateAtom,
        onSome: documentEditorStateAtom,
      })
    )
  );
  const seedState = content.pipe(O.flatMap(() => AsyncResult.value(initialState)));
  const mountConfig: ChatComposerMountConfig = { onSend: surface.onSend };

  return (
    <ChatComposer
      {...O.getSomesStruct({ initialState: seedState })}
      placeholder="Message… (Enter to send, Shift+Enter for a newline)"
      onSerializedChange={surface.onSerializedChange}
      mountConfig={mountConfig}
      onStop={onStop}
      streaming={streaming}
      sendDisabled={O.isSome(surface.safetyGate)}
      sendLabel={sendLabel}
      slashItems={defaultChatSlashItems}
      mentionSource={mentionSource}
    >
      <AttachmentTransportNotice />
      <ComposerSafetyGateNotice gate={surface.safetyGate} />
    </ChatComposer>
  );
}

const emptyEditorStateAtom = Atom.make(AsyncResult.initial<SerializedEditorState>());
