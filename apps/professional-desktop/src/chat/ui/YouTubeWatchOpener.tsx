/**
 * Native YouTube watch-link opener for the Tauri desktop shell.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { YOUTUBE_WATCH_EVENT, YouTubeWatchRequest } from "@beep/editor/youtube-embed";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { Defect } from "@beep/schema/Opaque";
import * as O from "@beep/utils/Option";
import { thunkNull, thunkUndefined } from "@beep/utils/thunk";
import { useAtom, useAtomMount } from "@effect/atom-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import type { JSX } from "react";

const $I = $ProfessionalDesktopId.create("chat/ui/YouTubeWatchOpener");

const hasTauriRuntime = (): boolean => "__TAURI_INTERNALS__" in globalThis;

/**
 * Failure raised when the Tauri native opener rejects a validated YouTube watch request.
 *
 * **Example** (Create a retryable opener failure)
 *
 * ```ts
 * import { YouTubeWatchRequest } from "@beep/editor/youtube-embed"
 * import { YouTubeWatchOpenFailed } from "@/chat/ui/YouTubeWatchOpener"
 *
 * const error = YouTubeWatchOpenFailed.make({
 *   request: YouTubeWatchRequest.make({ url: "https://www.youtube.com/watch?v=M7lc1UVf-VE" }),
 *   cause: new Error("native opener unavailable")
 * })
 * console.log(error.request.url)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class YouTubeWatchOpenFailed extends S.TaggedError<YouTubeWatchOpenFailed>($I`YouTubeWatchOpenFailed`)(
  "YouTubeWatchOpenFailed",
  {
    request: YouTubeWatchRequest.annotateKey({
      description: "Validated canonical YouTube watch request that can be retried.",
    }),
    cause: Defect({ includeStack: true }).annotateKey({
      description: "Native opener defect retained for structured diagnostics only.",
    }),
  },
  $I.annoteError<YouTubeWatchOpenFailed>("YouTubeWatchOpenFailed", {
    description: "The Tauri native opener rejected a validated YouTube watch request.",
  })
) {}

const openYouTubeWatchAtom = professionalBrowserRuntime.fn<YouTubeWatchRequest>()((request) =>
  Effect.tryPromise({
    try: () => openUrl(request.url),
    catch: (cause) => YouTubeWatchOpenFailed.make({ request, cause }),
  }).pipe(
    Effect.tapError((failure) =>
      Effect.logError("Unable to open YouTube watch URL with the Tauri opener", failure.cause)
    )
  )
);

const decodeWatchRequest = S.decodeUnknownOption(YouTubeWatchRequest);

// The package-level embed emits a cancelable typed request. Only a real Tauri
// runtime claims it; an unclaimed request is opened explicitly by the browser.
const youtubeWatchOpenerBindingAtom = Atom.make((get) => {
  get.mount(openYouTubeWatchAtom);
  const onWatch = (event: Event): void => {
    if (!hasTauriRuntime() || !(event instanceof CustomEvent)) return;
    O.match(decodeWatchRequest(event.detail), {
      onNone: thunkUndefined,
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

const renderOpenFailure = (
  cause: Cause.Cause<YouTubeWatchOpenFailed>,
  retry: (request: YouTubeWatchRequest) => void
): JSX.Element =>
  O.match(Cause.findErrorOption(cause), {
    onNone: () => (
      <div
        className="absolute right-3 top-3 z-50 rounded border border-destructive/40 bg-background p-3 text-sm shadow"
        role="alert"
      >
        YouTube could not be opened.
      </div>
    ),
    onSome: (failure) => (
      <div
        className="absolute right-3 top-3 z-50 rounded border border-destructive/40 bg-background p-3 text-sm shadow"
        role="alert"
      >
        <p>YouTube could not be opened.</p>
        <div className="mt-2 flex gap-3">
          <button className="underline underline-offset-2" type="button" onClick={() => retry(failure.request)}>
            Retry
          </button>
        </div>
        <p className="mt-2">Copy this link:</p>
        <input
          aria-label="YouTube watch URL"
          className="mt-1 block w-full rounded border border-border bg-transparent px-2 py-1 font-mono text-xs"
          data-testid="youtube-watch-copy-url"
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          type="url"
          value={failure.request.url}
        />
      </div>
    ),
  });

/**
 * Mounts the scoped native opener bridge for every YouTube embed in the chat
 * surface. The binding is Atom-owned and tears its global listener down on
 * unmount.
 *
 * **Example** (Render opener component)
 *
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
export function YouTubeWatchOpener(): JSX.Element | null {
  useAtomMount(youtubeWatchOpenerBindingAtom);
  const [openResult, retry] = useAtom(openYouTubeWatchAtom);

  return AsyncResult.match(openResult, {
    onInitial: thunkNull,
    onSuccess: thunkNull,
    onFailure: ({ cause }) => renderOpenFailure(cause, retry),
  });
}
