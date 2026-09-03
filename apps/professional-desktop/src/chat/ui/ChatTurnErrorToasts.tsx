/**
 * UI-layer chat turn error toasts.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */

"use client";

import { turnErrorAtom } from "@beep/agents-client/Chat.atoms";
import { toast } from "@beep/ui/components/sonner";
import * as O from "@beep/utils/Option";
import { useAtomMount, useAtomValue } from "@effect/atom-react";
import * as Effect from "effect/Effect";
import { Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type { ChatActionError } from "@beep/agents-use-cases/public";
import type { JSX } from "react";

const presentChatTurnErrorAtoms = Atom.family((failure: ChatActionError) =>
  professionalBrowserRuntime.atom((get) =>
    Effect.sync(() => {
      toast.error(failure.message);
      get.set(turnErrorAtom, O.none());
    })
  )
);

function PresentChatTurnError({ failure }: { readonly failure: ChatActionError }): null {
  failure.pipe(presentChatTurnErrorAtoms, useAtomMount);

  return null;
}

/**
 * Subscribes to failed assistant turns and surfaces them through the app's
 * existing toast system. The agents client only exposes atom state; the UI
 * package stays at this app boundary.
 *
 * **Example** (Import and log name)
 *
 * ```tsx
 * import { ChatTurnErrorToasts } from "@/chat/ui/ChatTurnErrorToasts"
 *
 * console.log(ChatTurnErrorToasts.name) // "ChatTurnErrorToasts"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ChatTurnErrorToasts(): JSX.Element | null {
  return useAtomValue(turnErrorAtom).pipe(
    O.map((failure) => <PresentChatTurnError failure={failure} />),
    O.getOrNull
  );
}
