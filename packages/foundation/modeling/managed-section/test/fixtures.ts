import { CommentStyle, SectionDialect, SectionDocument, SectionId } from "@beep/managed-section";
import { MemoryFileSystem } from "@beep/memfs";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import type { Section, SectionParseError } from "@beep/managed-section";
import type { MemoryFileSystemSeed, MemoryFileSystemVolume } from "@beep/memfs";
import type * as FileSystem from "effect/FileSystem";
import type * as Layer from "effect/Layer";

/** A writable in-memory filesystem, built fresh per test. */
export interface MemoryFs {
  readonly layer: Layer.Layer<FileSystem.FileSystem>;
  /** The UTF-8 contents at `path`, or `undefined` when absent. `""` is an empty file. */
  readonly text: (path: string) => string | undefined;
  /** The volume's inspection surface — `text`, `bytes`, `has`, `paths`, `snapshot`. */
  readonly volume: MemoryFileSystemVolume;
  /** How many times `writeFileString` actually ran. */
  readonly writes: () => number;
}

const systemError = (tag: "NotFound" | "PermissionDenied", method: string, path: string) =>
  new PlatformError.PlatformError(
    new PlatformError.SystemError({ _tag: tag, module: "FileSystem", method, pathOrDescriptor: path })
  );

/**
 * A real in-memory volume (`@beep/memfs`) paired with its inspection
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
export const memoryFsWith = (
  options: { readonly seed?: MemoryFileSystemSeed; readonly unreadable?: string; readonly unwritable?: string } = {}
): MemoryFs => {
  let writeCount = 0;
  const handle = MemoryFileSystem.makeSync(options.seed ?? {}, {
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
        const declineSoTheVolumePerformsTheRealWrite = undefined;
        return declineSoTheVolumePerformsTheRealWrite;
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

/** A fault-free {@link memoryFsWith} volume seeded with `initial`. */
export const memoryFs = (initial: MemoryFileSystemSeed = {}): MemoryFs => memoryFsWith({ seed: initial });

/** A section identity in the default `#` style. */
export const id = (key: string) => SectionId.make({ key, commentStyle: CommentStyle.hash });

/** A section in the default `#` style. */
export const section: {
  (key: string, content: string): Section;
  (content: string): (key: string) => Section;
} = dual(2, (key: string, content: string) => id(key).section(content));

export const begin = (key: string) => `# --- BEGIN ${key} MANAGED SECTION ---`;
export const end = (key: string) => `# --- END ${key} MANAGED SECTION ---`;

/** A rendered block as it appears in a document. */
export const block: {
  (key: string, content: string): string;
  (content: string): (key: string) => string;
} = dual(2, (key: string, content: string) => A.join([begin(key), content, end(key)], "\n"));

/** Join lines with LF; the trailing newline is explicit at each call site. */
export const lines = (...parts: ReadonlyArray<string>) => A.join(parts, "\n");

/** Rewrite an LF fixture as CRLF. */
export const crlf = (text: string) => Str.replace(/\n/g, "\r\n")(text);

export const parse: {
  (text: string, dialect?: SectionDialect): SectionDocument;
  (dialect?: SectionDialect): (text: string) => SectionDocument;
} = dual(
  (args) => P.isString(args[0]),
  (text: string, dialect: SectionDialect = SectionDialect.default): SectionDocument => {
    const result = SectionDocument.parseResult(text, dialect);
    if (!Result.isSuccess(result)) {
      assert.fail(`expected a parseable document, got ${result.failure.reason} at line ${result.failure.line}`);
    }
    return result.success;
  }
);

export const parseFailure: {
  (text: string, dialect?: SectionDialect): SectionParseError;
  (dialect?: SectionDialect): (text: string) => SectionParseError;
} = dual(
  (args) => P.isString(args[0]),
  (text: string, dialect: SectionDialect = SectionDialect.default): SectionParseError => {
    const result = SectionDocument.parseResult(text, dialect);
    if (!Result.isFailure(result)) {
      assert.fail("expected the document to be rejected");
    }
    return result.failure;
  }
);
