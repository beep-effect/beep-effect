// A lone surrogate makes `encodeURIComponent` throw, so it becomes U+FFFD first.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * A Windows drive path (`C:\x`, `C:/x`): absolute whatever the `Path` flavour, so never resolved against a directory.
 *
 * The one false positive is a relative POSIX path whose first directory is a single letter followed by a colon, such
 * as `a:/b.txt`, which reads as drive `a`. Such a filename is vanishingly rare, and recognising a drive is what makes
 * `C:\x` work on a POSIX `Path`, where it is otherwise a relative filename. A colon anywhere else (`/a/C:b`,
 * `./C:x`, `src/C:/x.ts`) is data and stays encoded.
 *
 * @internal
 */
export const DRIVE = /^[A-Za-z]:[\\/]/;

/**
 * A UNC path (`\\server\share\a.ts`, `//server/share/a.ts`): neither a drive nor a path on this machine, so it has no
 * link target. Left to a POSIX `Path` it would be read as a relative filename and linked to a file that does not exist.
 *
 * @internal
 */
export const UNC = /^(?:\\\\|\/\/)/;

/**
 * RFC 3986: everything but the unreserved characters is percent-encoded, in each segment, and `/` is kept.
 *
 * @internal
 */
export const encodePath = (path: string): string =>
	path
		.replace(LONE_SURROGATE, "�")
		.split("/")
		.map((segment) =>
			encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
		)
		.join("/");

/**
 * The encoded path part of a `file:` URL for an absolute path (the part after `file://`), or `undefined` for a UNC
 * path. One builder, so `CliLinks` and `Render.markdown` link a file the same way.
 *
 * @remarks
 * A drive path keeps its drive and becomes `/C:/x/y.ts`: the colon is part of the URL's path, not data to encode.
 *
 * @internal
 */
export const fileUrlPath = (absolute: string): string | undefined => {
	if (UNC.test(absolute)) return undefined;
	if (DRIVE.test(absolute)) return `/${absolute.slice(0, 2)}${encodePath(absolute.slice(2).replace(/\\/g, "/"))}`;
	return encodePath(absolute.startsWith("/") ? absolute : `/${absolute.replace(/\\/g, "/")}`);
};

/**
 * A URL for an OSC 8 sequence: every character outside printable ASCII (32 to 126) is percent-encoded as its UTF-8
 * bytes, as the OSC 8 convention asks, and nothing already encoded is touched, so `%C3%A9` is not encoded twice.
 *
 * @internal
 */
export const encodeForOsc8 = (url: string): string =>
	url.replace(LONE_SURROGATE, "�").replace(/[^\x20-\x7e]/gu, (char) => encodeURIComponent(char));
