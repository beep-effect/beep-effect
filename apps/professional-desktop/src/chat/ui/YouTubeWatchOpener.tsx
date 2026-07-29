/**
 * Native YouTube watch-link opener for the Tauri desktop shell.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { YOUTUBE_WATCH_EVENT, YouTubeWatchRequest } from "@beep/editor/youtube-embed";
import { O } from "@beep/utils";
import { useAtomMount } from "@effect/atom-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";

const hasTauriRuntime = (): boolean => "__TAURI_INTERNALS__" in globalThis;

const openYouTubeWatchAtom = professionalBrowserRuntime.fn<YouTubeWatchRequest>()((request) =>
  Effect.tryPromise(() => openUrl(request.url)).pipe(
    Effect.tapError((cause) => Effect.logError("Unable to open YouTube watch URL with the Tauri opener", cause)),
    Effect.ignore
  )
);

const decodeWatchRequest = S.decodeUnknownOption(YouTubeWatchRequest);

// The package-level embed emits a cancelable event before following its normal
// browser anchor. Only a real Tauri runtime claims the event; ordinary browser
// and Storybook mounts retain the anchor fallback unchanged.
const youtubeWatchOpenerBindingAtom = Atom.make((get) => {
  get.mount(openYouTubeWatchAtom);
  const onWatch = (event: Event): void => {
    if (!hasTauriRuntime() || !(event instanceof CustomEvent)) return;
    O.match(decodeWatchRequest(event.detail), {
      onNone: () => undefined,
      onSome: (request) => {
        event.preventDefault();
        get.set(openYouTubeWatchAtom, request);
      },
    });
  };

  window.addEventListener(YOUTUBE_WATCH_EVENT, onWatch);
  get.addFinalizer(() => window.removeEventListener(YOUTUBE_WATCH_EVENT, onWatch));
  return undefined;
});

/**
 * Mounts the scoped native opener bridge for every YouTube embed in the chat
 * surface. The binding is Atom-owned and tears its global listener down on
 * unmount.
 *
 * @example
 * ```tsx
 * import { YouTubeWatchOpener } from "@/chat/ui/YouTubeWatchOpener"
 *
 * function NativeLinks() {
 *   return <YouTubeWatchOpener />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function YouTubeWatchOpener(): null {
  useAtomMount(youtubeWatchOpenerBindingAtom);
  return null;
}
