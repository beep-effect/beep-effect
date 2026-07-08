/**
 * Hero visual media for the OIP home page.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";
import { $OipWebId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Atom } from "effect/unstable/reactivity";
import Image from "next/image";

const $I = $OipWebId.create("components/HeroVideo");

/**
 * Optional Network Information API surface used to skip the video on
 * data-saver or very slow connections.
 */
type SaveDataNavigator = Navigator & {
  readonly connection?: {
    readonly saveData?: boolean;
    readonly effectiveType?: string;
  };
};

const HTMLVideoElementCtor = globalThis.HTMLVideoElement;
const isHTMLVideoElement = (value: unknown): value is HTMLVideoElement =>
  P.isFunction(HTMLVideoElementCtor) && value instanceof HTMLVideoElementCtor;

const DOMHtmlVideoElement = S.declare(isHTMLVideoElement).pipe(
  $I.annoteSchema("DOMHtmlVideoElement", {
    description: "A browser HTML video element.",
  })
);

/**
 * A single rotating hero background clip: an optimized poster plus its background
 * video sources.
 */
class HeroClipMedia extends S.Class<HeroClipMedia>($I`HeroClipMedia`)(
  {
    poster: S.String,
    mp4: S.String,
    webm: S.optionalKey(S.String),
  },
  $I.annote("HeroClipMedia", {
    description: "A single rotating hero background clip: an optimized poster plus its background video sources.",
  })
) {}

class HeroVideoState extends S.Class<HeroVideoState>($I`HeroVideoState`)(
  {
    element: S.NullOr(DOMHtmlVideoElement).pipe(SchemaUtils.withKeyDefaults(null)),
    playing: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("HeroVideoState", {
    description: "The state of a single rotating hero background clip.",
  })
) {
  static readonly empty = HeroVideoState.make();
}

const heroClipKey = (poster: string, mp4: string, webm: string | undefined): string =>
  `${poster}::${mp4}::${webm ?? ""}`;

const heroVideoStateAtom = Atom.family((_key: string) => Atom.make<HeroVideoState>(HeroVideoState.empty));

const heroVideoElementAtom = Atom.family((key: string) =>
  Atom.writable(
    (get) => get(heroVideoStateAtom(key)).element,
    (ctx, element: HTMLVideoElement | null) => {
      const state = ctx.get(heroVideoStateAtom(key));
      ctx.set(heroVideoStateAtom(key), {
        element,
        playing: element === null ? false : state.playing,
      });
    }
  )
);

const heroVideoPlayingAtom = Atom.family((key: string) =>
  Atom.writable(
    (get) => get(heroVideoStateAtom(key)).playing,
    (ctx, playing: boolean) => {
      const state = ctx.get(heroVideoStateAtom(key));
      ctx.set(heroVideoStateAtom(key), {
        ...state,
        playing,
      });
    }
  )
);

const shouldSkipHeroVideo = (): boolean => {
  if (typeof window === "undefined") {
    return true;
  }

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return true;
  }

  const connection = (window.navigator as SaveDataNavigator).connection;

  return (
    connection?.saveData === true ||
    (P.isString(connection?.effectiveType) && Str.includes("2g")(connection.effectiveType))
  );
};

const scheduleHeroVideoStart = (video: HTMLVideoElement): (() => void) => {
  const start = () => {
    video.load();
    void video.play().catch(() => undefined);
  };

  if (P.isFunction(window.requestIdleCallback)) {
    const idleHandle = window.requestIdleCallback(start, { timeout: 2000 });
    return () => window.cancelIdleCallback?.(idleHandle);
  }

  const timer = window.setTimeout(start, 200);
  return () => window.clearTimeout(timer);
};

const heroVideoAutoplayAtom = Atom.family((key: string) =>
  Atom.make((get) => {
    let cancelScheduledStart: (() => void) | undefined;

    const scheduleStart = (video: HTMLVideoElement | null) => {
      cancelScheduledStart?.();
      cancelScheduledStart = undefined;

      if (video === null || shouldSkipHeroVideo()) {
        return;
      }

      cancelScheduledStart = scheduleHeroVideoStart(video);
    };

    get.subscribe(heroVideoElementAtom(key), scheduleStart, { immediate: true });
    get.addFinalizer(() => cancelScheduledStart?.());
  })
);

/**
 * Interval, in milliseconds, between hero background clips when more than one clip
 * is supplied. A single clip never rotates.
 *
 * @example
 * ```ts
 * import { HERO_ROTATE_MS } from "@beep/oip-web/components/HeroVideo"
 *
 * console.log(HERO_ROTATE_MS)
 * // 7000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HERO_ROTATE_MS = 7000;

const rotationSetKey = (clips: ReadonlyArray<HeroClipMedia>): string =>
  `${clips.length}::${clips.map((clip) => heroClipKey(clip.poster, clip.mp4, clip.webm)).join("||")}`;

const heroRotationIndexAtom = Atom.family((_key: string) => Atom.make(0));

/**
 * Mount-effect atom that advances the active clip on a fixed interval when more
 * than one clip is present and motion is allowed. It is a no-op for a single clip
 * or when {@link shouldSkipHeroVideo} holds (reduced motion / save-data / 2g).
 */
const heroRotationDriverAtom = Atom.family((key: string) =>
  Atom.make((get) => {
    if (typeof window === "undefined" || shouldSkipHeroVideo()) {
      return;
    }

    const count = Number.parseInt(key.split("::")[0] ?? "", 10);
    if (!Number.isInteger(count) || count <= 1) {
      return;
    }

    const indexAtom = heroRotationIndexAtom(key);
    const timer = window.setInterval(() => {
      get.registry.update(indexAtom, (current) => (current + 1) % count);
    }, HERO_ROTATE_MS);

    get.addFinalizer(() => window.clearInterval(timer));
  })
);

/**
 * A single hero clip layer. When `active`, the muted, looping background video is
 * mounted and its idle autoplay is scheduled; otherwise only the poster renders so
 * the crossfade between clips has something to fade. Poster/video opacity mirrors
 * the original single-clip behavior for the active clip.
 */
function HeroClipLayer({
  active,
  index,
  layered,
  mp4,
  poster,
  webm,
}: {
  readonly active: boolean;
  readonly index: number;
  readonly layered: boolean;
  readonly mp4: string;
  readonly poster: string;
  readonly webm?: string | undefined;
}) {
  const key = heroClipKey(poster, mp4, webm);
  const playing = useAtomValue(heroVideoPlayingAtom(key));
  const setPlaying = useAtomSet(heroVideoPlayingAtom(key));
  const setVideoElement = useAtomSet(heroVideoElementAtom(key));
  useAtomMount(heroVideoAutoplayAtom(key));

  const posterHidden = active && playing;

  const media = (
    <>
      <Image
        src={poster}
        alt=""
        fill
        quality={50}
        sizes="(min-width: 1024px) 46vw, 100vw"
        className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${
          posterHidden ? "opacity-0" : "opacity-70"
        }`}
        aria-hidden="true"
      />
      {active ? (
        <video
          ref={setVideoElement}
          muted
          loop
          playsInline
          preload="none"
          tabIndex={-1}
          aria-hidden="true"
          onPlaying={() => setPlaying(true)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${
            playing ? "opacity-70" : "opacity-0"
          }`}
        >
          {webm === undefined ? null : <source src={webm} type="video/webm" />}
          <source src={mp4} type="video/mp4" />
        </video>
      ) : null}
    </>
  );

  if (!layered) {
    return media;
  }

  return (
    <div
      data-hero-clip={index}
      className={`absolute inset-0 transition-opacity duration-700 ${active ? "opacity-100" : "opacity-0"}`}
    >
      {media}
    </div>
  );
}

/**
 * Decorative hero media. An optimized poster paints immediately for LCP, then a
 * muted, looping background video is fetched after first paint and crossfades in.
 * The fetch is deferred (`preload="none"` until idle) and skipped entirely for
 * users who prefer reduced motion or are on data-saver / 2g connections. When more
 * than one clip is supplied the clips crossfade on a fixed interval
 * ({@link HERO_ROTATE_MS}); a single clip renders exactly as before and never rotates.
 *
 * @example
 * ```tsx
 * import { HeroVideo } from "@beep/oip-web/components/HeroVideo"
 *
 * const hero = (
 *   <HeroVideo
 *     clips={[
 *       { poster: "/oip/hero-vid-poster.jpg", mp4: "/oip/hero-vid.mp4", webm: "/oip/hero-vid.webm" }
 *     ]}
 *   />
 * )
 * console.log(hero.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function HeroVideo({ clips }: { readonly clips: ReadonlyArray<HeroClipMedia> }) {
  const rotationKey = rotationSetKey(clips);
  const rotationIndex = useAtomValue(heroRotationIndexAtom(rotationKey));
  useAtomMount(heroRotationDriverAtom(rotationKey));

  if (clips.length === 0) {
    return null;
  }

  const activeIndex = rotationIndex % clips.length;
  const layered = clips.length > 1;

  return (
    <>
      {clips.map((clip, index) => (
        <HeroClipLayer
          key={heroClipKey(clip.poster, clip.mp4, clip.webm)}
          active={index === activeIndex}
          index={index}
          layered={layered}
          mp4={clip.mp4}
          poster={clip.poster}
          webm={clip.webm}
        />
      ))}
    </>
  );
}
