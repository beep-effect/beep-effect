/**
 * MIME type definitions for `audio/*` content types.
 *
 * Contains entries sourced from IANA, Apache, and Nginx registries mapping
 * audio MIME types to their file extensions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Record of `audio/*` MIME type definitions, each containing a source
 * registry and an array of associated file extensions.
 *
 * **Example** (Lookup audio/mpeg entry)
 *
 * ```ts import.meta.vitest name="Lookup audio/mpeg entry"
 * import { audio } from "@beep/data/MimeTypes"
 *
 * audio["audio/mpeg"].extensions.includes("mp3") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const audio = {
  "audio/3gpp": {
    source: "iana",
    extensions: ["3gpp"],
  },
  "audio/adpcm": {
    source: "apache",
    extensions: ["adp"],
  },
  "audio/amr": {
    source: "iana",
    extensions: ["amr"],
  },
  "audio/basic": {
    source: "iana",
    extensions: ["au", "snd"],
  },
  "audio/midi": {
    source: "apache",
    extensions: ["mid", "midi", "kar", "rmi"],
  },
  "audio/mobile-xmf": {
    source: "iana",
    extensions: ["mxmf"],
  },
  "audio/mp4": {
    source: "iana",
    extensions: ["m4a", "mp4a"],
  },
  "audio/mpeg": {
    source: "iana",
    extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"],
  },
  "audio/ogg": {
    source: "iana",
    extensions: ["oga", "ogg", "spx", "opus"],
  },
  "audio/s3m": {
    source: "apache",
    extensions: ["s3m"],
  },
  "audio/silk": {
    source: "apache",
    extensions: ["sil"],
  },
  "audio/vnd.dece.audio": {
    source: "iana",
    extensions: ["uva", "uvva"],
  },
  "audio/vnd.digital-winds": {
    source: "iana",
    extensions: ["eol"],
  },
  "audio/vnd.dra": {
    source: "iana",
    extensions: ["dra"],
  },
  "audio/vnd.dts": {
    source: "iana",
    extensions: ["dts"],
  },
  "audio/vnd.dts.hd": {
    source: "iana",
    extensions: ["dtshd"],
  },
  "audio/vnd.lucent.voice": {
    source: "iana",
    extensions: ["lvp"],
  },
  "audio/vnd.ms-playready.media.pya": {
    source: "iana",
    extensions: ["pya"],
  },
  "audio/vnd.nuera.ecelp4800": {
    source: "iana",
    extensions: ["ecelp4800"],
  },
  "audio/vnd.nuera.ecelp7470": {
    source: "iana",
    extensions: ["ecelp7470"],
  },
  "audio/vnd.nuera.ecelp9600": {
    source: "iana",
    extensions: ["ecelp9600"],
  },
  "audio/vnd.rip": {
    source: "iana",
    extensions: ["rip"],
  },
  "audio/wav": {
    source: "nginx",
    extensions: ["wav"],
  },
  "audio/webm": {
    source: "apache",
    extensions: ["weba"],
  },
  "audio/x-aac": {
    source: "apache",
    extensions: ["aac"],
  },
  "audio/x-aiff": {
    source: "apache",
    extensions: ["aif", "aiff", "aifc"],
  },
  "audio/x-caf": {
    source: "apache",
    extensions: ["caf"],
  },
  "audio/x-flac": {
    source: "apache",
    extensions: ["flac"],
  },
  "audio/x-m4a": {
    source: "nginx",
    extensions: ["m4a"],
  },
  "audio/x-matroska": {
    source: "apache",
    extensions: ["mka"],
  },
  "audio/x-mpegurl": {
    source: "apache",
    extensions: ["m3u"],
  },
  "audio/x-ms-wax": {
    source: "apache",
    extensions: ["wax"],
  },
  "audio/x-ms-wma": {
    source: "apache",
    extensions: ["wma"],
  },
  "audio/x-pn-realaudio": {
    source: "apache",
    extensions: ["ram", "ra"],
  },
  "audio/x-pn-realaudio-plugin": {
    source: "apache",
    extensions: ["rmp"],
  },
  "audio/x-realaudio": {
    source: "nginx",
    extensions: ["ra"],
  },
  "audio/x-wav": {
    source: "apache",
    extensions: ["wav"],
  },
  "audio/x-gsm": {
    source: "apache",
    extensions: ["gsm"],
  },
  "audio/xm": {
    source: "apache",
    extensions: ["xm"],
  },
} as const;
