/** Caption-first YouTube acquisition.
 * @internal
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  decodeLibraryJson,
  encodeLibraryJson,
  LibraryAdapterResult,
  runLibraryCommand,
  saveLibraryText,
} from "./Library.adapter.ts";
import { LibraryError } from "./Library.errors.ts";
import type { LibrarySource } from "./Library.schemas.ts";

const CaptionTrack = S.Struct({ url: S.String, ext: S.String });
const CaptionCatalog = S.Record(S.String, S.Array(CaptionTrack));
const VideoMetadata = S.Struct({
  id: S.String,
  webpage_url: S.String,
  title: S.String,
  subtitles: S.optionalKey(CaptionCatalog),
  automatic_captions: S.optionalKey(CaptionCatalog),
  requested_subtitles: S.optionalKey(S.Record(S.String, S.Struct({ url: S.String, ext: S.String }))),
});
const $I = $RepoCliId.create("commands/Research/Library/Library.youtube");
class CaptionProvenance extends S.Class<CaptionProvenance>($I`CaptionProvenance`)(
  {
    language: S.String,
    url: S.String,
    format: S.Literal("vtt"),
    origin: S.Literals(["creator", "automatic"]),
    downloadedFilename: S.String,
  },
  $I.annote("CaptionProvenance", {
    description: "Downloaded caption filename bound to the exact language/format in original extractor metadata.",
  })
) {}

/**
 * Derive caption provenance even when the saved extractor metadata omits requested_subtitles.
 *
 * **Example** (Binding a downloaded automatic track)
 * ```ts
 * import { libraryCaptionProvenance } from "@beep/repo-cli/test/ResearchLibrary"
 * const tracks = libraryCaptionProvenance({ id: "video", title: "Talk", webpage_url: "https://youtube.com/watch?v=video", automatic_captions: { en: [{ ext: "vtt", url: "https://example.com/captions" }] } }, ["source.en.vtt"])
 * console.log(tracks.length) // 1
 * ```
 *
 * @internal
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export const libraryCaptionProvenance: {
  (metadata: typeof VideoMetadata.Type, filenames: ReadonlyArray<string>): Array<CaptionProvenance>;
  (filenames: ReadonlyArray<string>): (metadata: typeof VideoMetadata.Type) => Array<CaptionProvenance>;
} = dual(2, (metadata: typeof VideoMetadata.Type, filenames: ReadonlyArray<string>) =>
  A.getSomes(
    A.map(filenames, (filename) => {
      const language = Str.replace(/\.vtt$/, "")(Str.replace(/^source\./, "")(filename));
      const manual = O.fromUndefinedOr(metadata.subtitles?.[language]).pipe(
        O.flatMap((tracks) => A.findFirst(tracks, (track) => track.ext === "vtt"))
      );
      const automatic = O.fromUndefinedOr(metadata.automatic_captions?.[language]).pipe(
        O.flatMap((tracks) => A.findFirst(tracks, (track) => track.ext === "vtt"))
      );
      const selected = O.orElse(manual, () => automatic);
      return O.map(selected, (track) =>
        CaptionProvenance.make({
          language,
          url: track.url,
          format: "vtt",
          origin: O.isSome(manual) ? "creator" : "automatic",
          downloadedFilename: filename,
        })
      );
    })
  )
);

/** Capture captions and context without downloading video or audio.
 * **Example** (Prepare source-bound verification)
 * ```ts
 * import { acquireLibraryYoutube } from "@beep/repo-cli/test/ResearchLibrary"
 * import { classifyLibraryReference } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 * const capture = classifyLibraryReference("https://youtube.com/watch?v=example", "report").pipe(Effect.flatMap((source) => acquireLibraryYoutube("/library", source, "captures/example")))
 * console.log(Effect.isEffect(capture))
 * ```
 *
 * @internal
 *
 * @category use-cases
 *
 * @since 0.0.0 */
export const acquireLibraryYoutube = Effect.fn("Library.acquireYoutube")(function* (
  root: string,
  source: LibrarySource,
  prefix: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stage = path.join(root, `${prefix}/download`);
  yield* fs.makeDirectory(stage, { recursive: true });
  yield* runLibraryCommand(
    root,
    "yt-dlp",
    [
      "--ignore-config",
      "--skip-download",
      "--no-playlist",
      "--write-info-json",
      "--write-subs",
      "--write-auto-subs",
      "--sub-langs",
      "en.*",
      "--sub-format",
      "vtt",
      "--retries",
      "2",
      "--extractor-retries",
      "2",
      "--socket-timeout",
      "30",
      "--output",
      path.join(stage, "source.%(ext)s"),
      "--",
      source.canonicalUrl,
    ],
    20_000
  );
  const names = yield* fs.readDirectory(stage);
  const infoName = A.findFirst(names, Str.endsWith(".info.json"));
  if (infoName._tag === "None")
    return yield* LibraryError.make({ message: "YouTube extractor omitted metadata.", cause: "identity" });
  const raw = yield* fs.readFileString(path.join(stage, infoName.value));
  const metadata = yield* decodeLibraryJson(VideoMetadata)(raw);
  if (source.identity !== `youtube:${metadata.id}`)
    return yield* LibraryError.make({ message: "YouTube metadata identity mismatch.", cause: "identity" });
  const artifacts = [
    yield* saveLibraryText(root, `${prefix}/metadata.json`, raw, "application/json", "target-metadata"),
  ];
  const captions = A.filter(names, Str.endsWith(".vtt"));
  const provenance = libraryCaptionProvenance(metadata, captions);
  artifacts.push(
    yield* saveLibraryText(
      root,
      `${prefix}/caption-provenance.json`,
      yield* encodeLibraryJson(provenance),
      "application/json",
      "transcript-provenance"
    )
  );
  let usable = 0;
  const retainCaptionTrack = Effect.fn("Library.youtube.retainCaptionTrack")(function* (name: string) {
    const text = yield* fs.readFileString(path.join(stage, name));
    if (!Str.includes("WEBVTT")(text) || !Str.includes("-->")(text)) return;
    artifacts.push(yield* saveLibraryText(root, `${prefix}/${name}`, text, "text/vtt", "transcript-full-text"));
    const transcript = A.join(
      A.filter(
        Str.split(text, "\n"),
        (line) =>
          Str.includes("-->")(line) ||
          (Str.isNonEmpty(Str.trim(line)) && !/^(?:WEBVTT|Kind:|Language:|NOTE|\d+$)/.test(line))
      ),
      "\n"
    );
    const spoken = A.some(
      Str.split(transcript, "\n"),
      (line) => !Str.includes("-->")(line) && Str.isNonEmpty(Str.trim(Str.replaceAll(/<[^>]+>/g, "")(line)))
    );
    if (!spoken) return;
    artifacts.push(
      yield* saveLibraryText(root, `${prefix}/${name}.txt`, transcript, "text/plain", "transcript-full-text")
    );
    usable++;
  });
  for (const name of captions) yield* retainCaptionTrack(name);
  const complete =
    usable > 0 && A.every(captions, (filename) => A.some(provenance, (track) => track.downloadedFilename === filename));
  return LibraryAdapterResult.make({
    artifacts,
    revision: metadata.id,
    complete,
    status: complete ? "readable" : "blocked",
    reason: complete
      ? "Video identity validated; captions and metadata captured without video files."
      : "No usable English caption text with bound provenance; explicit transcription fallback is required before reading admission.",
  });
});
