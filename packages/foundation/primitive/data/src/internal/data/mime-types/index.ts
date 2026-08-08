/**
 * Edge-compatible MIME type lookup utilities.
 *
 * Vendored from `mime-types`, ported to TypeScript, and adapted to avoid
 * Node-only APIs like `path.extname` so the module runs in edge runtimes
 * (Cloudflare Workers, Deno Deploy, Vercel Edge, etc.).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O } from "@beep/utils";
import { thunkEmptyStr } from "@beep/utils/thunk";
import { Function as Fn, Match, pipe, Struct } from "effect";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { application as _application } from "./application.ts";
import { audio as _audio } from "./audio.ts";
import { image as _image } from "./image.ts";
import { misc as _misc } from "./misc.ts";
import { text as _text } from "./text.ts";
import { video as _video } from "./video.ts";

/**
 * Record of `application/*` MIME type definitions sourced from IANA, Apache,
 * and Nginx registries.
 *
 * @since 0.0.0
 * @category models
 */
export const application = _application;

/**
 * Record of `audio/*` MIME type definitions sourced from IANA, Apache,
 * and Nginx registries.
 *
 * @since 0.0.0
 * @category models
 */
export const audio = _audio;

/**
 * Record of `image/*` MIME type definitions sourced from IANA, Apache,
 * and Nginx registries.
 *
 * @since 0.0.0
 * @category models
 */
export const image = _image;

/**
 * Record of miscellaneous MIME type definitions covering chemical, font,
 * message, model, and x-conference types.
 *
 * @since 0.0.0
 * @category models
 */
export const misc = _misc;

/**
 * Record of `text/*` MIME type definitions sourced from IANA, Apache,
 * and Nginx registries.
 *
 * @since 0.0.0
 * @category models
 */
export const text = _text;

/**
 * Record of `video/*` MIME type definitions sourced from IANA, Apache,
 * and Nginx registries.
 *
 * @since 0.0.0
 * @category models
 */
export const video = _video;

/**
 * Combined record of all MIME type definitions across every category
 * (application, audio, image, text, video, and miscellaneous).
 *
 * **Details**
 *
 * This is the raw merged data object that backs the `mimeTypes` typed record.
 *
 * **Example** (Access CSS MIME definition)
 *
 * ```typescript
 * import { mimes } from "@beep/data"
 *
 * mimes["text/css"]
 * // { source: "iana", charset: "UTF-8", extensions: ["css"] }
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const mimes = {
  ...application,
  ...audio,
  ...image,
  ...text,
  ...video,
  ...misc,
};

/**
 * Union of all known MIME type strings derived from the vendored mime-db data.
 *
 * **Details**
 *
 * Each member is a full MIME type string such as `"application/json"` or `"image/png"`.
 *
 * **Example** (Assign JSON content type)
 *
 * ```typescript
 * import type { MimeType } from "@beep/data"
 *
 * const contentType: MimeType = "application/json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MimeType = keyof typeof mimes;

/**
 * Union of all known file extension strings (without leading dot) derived
 * from the vendored mime-db data.
 *
 * **Details**
 *
 * Each member is a bare extension like `"json"`, `"html"`, or `"png"`.
 *
 * **Example** (Assign JSON file extension)
 *
 * ```typescript
 * import type { FileExtension } from "@beep/data"
 *
 * const ext: FileExtension = "json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FileExtension = (typeof mimes)[MimeType]["extensions"][number];

/**
 * Record mapping each known MIME type to its source registry and associated
 * file extensions. The source indicates where the MIME type definition
 * originated (`"iana"`, `"apache"`, or `"nginx"`).
 *
 * **Example** (Read JSON MIME definition)
 *
 * ```typescript
 * import { mimeTypes } from "@beep/data"
 *
 * const json = mimeTypes["application/json"]
 * // { source: "iana", extensions: ["json", "map"] }
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
type MimeTypeDefinition = {
  source: MimeTypeSource;
  extensions: A.NonEmptyArray<FileExtension>;
};

type MimeTypeSource = (typeof mimes)[MimeType]["source"];

const mimeTypeDefinitions = R.empty<MimeType, MimeTypeDefinition>();

for (const type of Struct.keys(mimes)) {
  const mime = mimes[type];
  const extensions = A.fromIterable(mime.extensions);
  A.assertNonEmptyArray(extensions);

  mimeTypeDefinitions[type] = {
    source: mime.source,
    extensions,
  };
}

export const mimeTypes: Record<MimeType, MimeTypeDefinition> = mimeTypeDefinitions;

function extname(path: string) {
  return Str.lastIndexOf(".")(path).pipe(
    O.map((index) => Str.substring(index)(path)),
    O.getOrElse(thunkEmptyStr)
  );
}

const extensions = R.empty<MimeType, FileExtension[]>();
const types = R.empty<FileExtension, MimeType>();

const normalizeLookupExtension = Fn.flow((input: string) => extname(`x.${input}`), Str.toLowerCase, Str.substring(1));
const returnFalse = (): false => false;
const lookupPath: (path: string) => false | MimeType = Fn.flow(
  O.liftPredicate(Str.isNonEmpty),
  O.map(normalizeLookupExtension),
  O.map(lookupNormalizedExtension),
  O.getOrElse(returnFalse)
);

function hasTypeForExtension(extension: string, types: Record<FileExtension, MimeType>): extension is FileExtension {
  return extension in types;
}

function lookupNormalizedExtension(extension: string): false | MimeType {
  const typesByExtension = getTypes();

  return pipe(
    extension,
    O.liftPredicate(
      (value: string): value is FileExtension => !Str.isEmpty(value) && hasTypeForExtension(value, typesByExtension)
    ),
    O.map((lookupExtension) => typesByExtension[lookupExtension]),
    O.getOrElse(returnFalse)
  );
}

/**
 * Returns a record mapping each file extension (without leading dot) to its
 * preferred MIME type string. Preference is determined by source priority:
 * IANA, then unspecified, then Apache, then Nginx.
 *
 * **Details**
 *
 * Lazily populates the internal lookup tables on first call; subsequent
 * calls return the same cached object.
 *
 * **Example** (Map extensions to MIME types)
 *
 * ```typescript
 * import { getTypes } from "@beep/data"
 *
 * const types = getTypes()
 * types["json"] // "application/json"
 * types["html"] // "text/html"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function getTypes(): Record<FileExtension, MimeType> {
  populateMaps(extensions, types);
  return types;
}

/**
 * Returns a record mapping each known MIME type to an array of its associated
 * file extensions (without leading dots).
 *
 * **Details**
 *
 * Lazily populates the internal lookup tables on first call; subsequent
 * calls return the same cached object.
 *
 * **Example** (Map MIME types to extensions)
 *
 * ```typescript
 * import { getExtensions } from "@beep/data"
 *
 * const extensions = getExtensions()
 * extensions["application/json"] // ["json", "map"]
 * extensions["text/html"]        // ["html", "htm", "shtml"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function getExtensions(): Record<MimeType, FileExtension[]> {
  populateMaps(extensions, types);
  return extensions;
}

/**
 * Look up the MIME type for a file path or extension.
 *
 * **Details**
 *
 * Accepts a bare extension (`"json"`), a dotted extension (`".json"`), or a
 * full file path (`"path/to/file.json"`). The lookup is case-insensitive.
 * Returns the matching MIME type string, or `false` if no match is found.
 *
 * **Example** (Look up MIME from path)
 *
 * ```typescript
 * import { lookup } from "@beep/data"
 *
 * lookup("json")            // "application/json"
 * lookup(".html")           // "text/html"
 * lookup("photo.png")       // "image/png"
 * lookup("unknown.zzzzz")   // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function lookup(path: string): false | MimeType {
  return lookupPath(path);
}

let inittedMaps = false;

// source preference (least -> most)
const preference: ReadonlyArray<string | undefined> = ["nginx", "apache", undefined, "iana"];

function preferenceOf(source: string): number {
  return pipe(
    preference,
    A.findFirstIndex((p) => p === source),
    O.getOrElse(() => -1)
  );
}

function shouldKeepByPreference(currentType: MimeType, mimeSource: string): boolean {
  const from = preferenceOf(mimeTypes[currentType].source);
  const to = preferenceOf(mimeSource);

  return (
    currentType !== "application/octet-stream" &&
    (from > to || (from === to && Str.startsWith("application/")(currentType)))
  );
}

function shouldKeepCurrentMapping(
  extension: FileExtension,
  mimeSource: string,
  types: Record<FileExtension, MimeType>
): boolean {
  return Match.value(extension in types).pipe(
    Match.when(false, () => false),
    Match.orElse(() => shouldKeepByPreference(types[extension], mimeSource))
  );
}

function setTypeMapping(
  type: MimeType,
  extension: FileExtension,
  mimeSource: string,
  types: Record<FileExtension, MimeType>
) {
  return Match.value(shouldKeepCurrentMapping(extension, mimeSource, types)).pipe(
    Match.when(true, () => undefined),
    Match.orElse(() => {
      types[extension] = type;
    })
  );
}

function populateTypeMappings(
  type: MimeType,
  exts: A.NonEmptyReadonlyArray<FileExtension>,
  mimeSource: string,
  extensions: Record<MimeType, FileExtension[]>,
  types: Record<FileExtension, MimeType>
) {
  extensions[type] = A.fromIterable(exts);

  for (const extension of exts) {
    setTypeMapping(type, extension, mimeSource, types);
  }
}

/**
 * Populate the extensions and types maps.
 * @private
 */
function populateMaps(extensions: Record<MimeType, FileExtension[]>, types: Record<FileExtension, MimeType>) {
  return Match.value(inittedMaps).pipe(
    Match.when(true, () => undefined),
    Match.orElse(() => {
      inittedMaps = true;

      for (const type of Struct.keys(mimeTypes)) {
        const mime = mimeTypes[type];
        A.match(mime.extensions, {
          onEmpty: () => undefined,
          onNonEmpty: (nonEmptyExts) => populateTypeMappings(type, nonEmptyExts, mime.source, extensions, types),
        });
      }
    })
  );
}
