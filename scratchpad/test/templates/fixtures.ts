import { assert } from "@effect/vitest";
import type { MemoryFileSystemSeed, MemoryFileSystemVolume } from "../../effected/memfs/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import type { FileSystem, Layer } from "effect";
import { Effect, PlatformError, Result } from "effect";
import type { SectionParseError } from "../../effected/templates/index.ts";
import { CommentStyle, SectionDialect, SectionDocument, SectionId } from "../../effected/templates/index.ts";

/** A writable in-memory filesystem, built fresh per test. */
export interface MemoryFs {
	/** The volume's inspection surface — `text`, `bytes`, `has`, `paths`, `snapshot`. */
	readonly volume: MemoryFileSystemVolume;
	/** The UTF-8 contents at `path`, or `undefined` when absent. `""` is an empty file. */
	readonly text: (path: string) => string | undefined;
	/** How many times `writeFileString` actually ran. */
	readonly writes: () => number;
	readonly layer: Layer.Layer<FileSystem.FileSystem>;
}

const systemError = (tag: "NotFound" | "PermissionDenied", method: string, path: string) =>
	new PlatformError.PlatformError(
		new PlatformError.SystemError({ _tag: tag, module: "FileSystem", method, pathOrDescriptor: path }),
	);

/**
 * A real in-memory volume (`@effected/memfs`) paired with its inspection
 * surface, plus a write counter and the two permission knobs.
 *
 * @remarks
 * The volume is built EAGERLY with `makeSync`, and its pinned `handle.layer`
 * is what the test provides — deliberately, not a `layerWith`. A memfs layer
 * re-seeds a fresh volume on every `Effect.provide`, which is the right
 * default and the wrong thing for this fixture: each test builds its own
 * double, provides it once, and then inspects what the run left behind. The
 * handle's layer is fixed to one volume, so the volume the assertions read is
 * the volume the code under test wrote to. The permission knobs and the write
 * counter are `options.faults`, which fault the handle's `FileSystem` while
 * `handle.volume` inspects the raw volume beneath them.
 *
 * The permission knobs and the write counter are fault handlers rather than
 * stub bodies. The counter returns `undefined` to decline, so the write is
 * counted AND really happens — a stub that swallowed it would leave every
 * later read reporting the pre-write contents.
 */
export const memoryFs = (
	initial: MemoryFileSystemSeed = {},
	options: { readonly unreadable?: string; readonly unwritable?: string } = {},
): MemoryFs => {
	let writeCount = 0;
	const handle = MemoryFileSystem.makeSync(initial, {
		faults: {
			readFile: (path) =>
				options.unreadable === String(path)
					? Effect.fail(systemError("PermissionDenied", "readFile", String(path)))
					: undefined,
			writeFileString: (path) => {
				if (options.unwritable === String(path)) {
					return Effect.fail(systemError("PermissionDenied", "writeFileString", String(path)));
				}
				writeCount += 1;
				return undefined; // decline: the volume performs the real write
			},
		},
	});

	return {
		volume: handle.volume,
		text: handle.volume.text,
		writes: () => writeCount,
		layer: handle.layer,
	};
};

/** A section identity in the default `#` style. */
export const id = (key: string) => SectionId.make({ key, commentStyle: CommentStyle.hash });

/** A section in the default `#` style. */
export const section = (key: string, content: string) => id(key).section(content);

export const begin = (key: string) => `# --- BEGIN ${key} MANAGED SECTION ---`;
export const end = (key: string) => `# --- END ${key} MANAGED SECTION ---`;

/** A rendered block as it appears in a document. */
export const block = (key: string, content: string) => [begin(key), content, end(key)].join("\n");

/** Join lines with LF; the trailing newline is explicit at each call site. */
export const lines = (...parts: ReadonlyArray<string>) => parts.join("\n");

/** Rewrite an LF fixture as CRLF. */
export const crlf = (text: string) => text.replace(/\n/g, "\r\n");

export const parse = (text: string, dialect: SectionDialect = SectionDialect.default): SectionDocument => {
	const result = SectionDocument.parseResult(text, dialect);
	if (!Result.isSuccess(result)) {
		assert.fail(`expected a parseable document, got ${result.failure.reason} at line ${result.failure.line}`);
	}
	return result.success;
};

export const parseFailure = (text: string, dialect: SectionDialect = SectionDialect.default): SectionParseError => {
	const result = SectionDocument.parseResult(text, dialect);
	if (!Result.isFailure(result)) {
		assert.fail("expected the document to be rejected");
	}
	return result.failure;
};
