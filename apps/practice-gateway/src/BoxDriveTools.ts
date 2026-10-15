/**
 * Box Drive provider tools: read-only listing and reading of the local Box
 * Drive folder (`%USERPROFILE%\Box`), confined to that folder.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { ExtractFileOperation } from "@beep/file-processing/Operation";
import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { FileFormatFamily } from "@beep/file-processing/Strategy";
import { $PracticeGatewayId } from "@beep/identity/packages";
import { annotateFourHints, FourHintAnnotations, sanitizedToolkit } from "@beep/mcp-kit";
import { LiteralKit } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import * as A from "effect/Array";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as ByteSize from "effect/ByteSize";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ProfileStore } from "./ProfileStore.ts";
import { profileSelects } from "./Requirements.ts";
import { WindowsHost } from "./WindowsHost.ts";

const $I = $PracticeGatewayId.create("BoxDriveTools");

/**
 * Largest file, in bytes, `box_read` opens. Larger files return metadata only.
 *
 * **Example** (Read the cap)
 *
 * ```ts
 * import { BOX_READ_MAX_BYTES } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BOX_READ_MAX_BYTES) // 20971520
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BOX_READ_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Most characters of text `box_read` returns; longer text is cut and marked
 * truncated.
 *
 * **Example** (Read the cap)
 *
 * ```ts
 * import { BOX_READ_MAX_CHARACTERS } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BOX_READ_MAX_CHARACTERS) // 60000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BOX_READ_MAX_CHARACTERS = 60_000;

/**
 * Most entries `box_list` returns for one folder.
 *
 * **Example** (Read the cap)
 *
 * ```ts
 * import { BOX_LIST_MAX_ENTRIES } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BOX_LIST_MAX_ENTRIES) // 500
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BOX_LIST_MAX_ENTRIES = 500;

const hasNoParentSegment = (path: string): boolean => !A.contains(Str.split(path, /[\\/]/), "..");
const isRelative = (path: string): boolean =>
  O.isNone(Str.match(/^([\\/]|[A-Za-z]:)/)(path)) && !Str.includes("\u0000")(path);

/**
 * A path inside the Box folder, relative to it: `/` or `\` separators, no
 * drive letter, no leading separator and no `..` segment.
 *
 * **Details**
 *
 * The lexical check is the first line of confinement; symlinks are checked
 * again against the real Box folder when the path is opened.
 *
 * **Example** (Check Box paths)
 *
 * ```ts
 * import { BoxRelativePath } from "@beep/practice-gateway/BoxDriveTools"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BoxRelativePath)("Clients/Smith/letter.docx")) // true
 * console.log(S.is(BoxRelativePath)("../Documents")) // false
 * console.log(S.is(BoxRelativePath)("C:\\Windows")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BoxRelativePath = S.String.check(
  S.makeFilter(isRelative, {
    identifier: $I`BoxRelativePathRelative`,
    description: "A relative path: no leading separator and no drive letter.",
    message: "Use a path inside the Box folder, not a full path.",
  }),
  S.makeFilter(hasNoParentSegment, {
    identifier: $I`BoxRelativePathNoParent`,
    description: "A path without `..` segments.",
    message: "Paths may not step out of the Box folder with `..`.",
  })
).pipe(
  $I.annoteSchema("BoxRelativePath", {
    description: "A path inside the Box Drive folder, relative to it.",
  })
);

/**
 * Whether a Box entry is a file or a folder.
 *
 * **Example** (Check an entry kind)
 *
 * ```ts
 * import { BoxEntryKind } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BoxEntryKind.is.folder("folder")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BoxEntryKind = LiteralKit(["file", "folder"]).pipe(
  $I.annoteSchema("BoxEntryKind", {
    description: "Whether a Box entry is a file or a folder.",
  })
);

/**
 * Decoded type of {@link BoxEntryKind}.
 *
 * **Example** (Type an entry kind)
 *
 * ```ts
 * import type { BoxEntryKind } from "@beep/practice-gateway/BoxDriveTools"
 *
 * const kind: BoxEntryKind = "file"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoxEntryKind = typeof BoxEntryKind.Type;

/**
 * One file or folder in a Box listing.
 *
 * **Example** (Describe a file)
 *
 * ```ts
 * import { BoxEntry } from "@beep/practice-gateway/BoxDriveTools"
 * import * as O from "effect/Option"
 *
 * const entry = BoxEntry.make({ name: "letter.docx", path: "Clients/letter.docx", kind: "file", sizeBytes: O.some(1200) })
 * console.log(entry.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxEntry extends S.Opaque<BoxEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.annotateKey({ description: "File or folder name." }),
    path: S.String.annotateKey({ description: "Path inside the Box folder, with `/` separators." }),
    kind: BoxEntryKind.annotateKey({ description: "Whether the entry is a file or a folder." }),
    sizeBytes: S.OptionFromNullOr(S.Natural).annotateKey({ description: "File size in bytes; null for folders." }),
  }).pipe(
    $I.annoteSchema("BoxEntry", {
      description: "One file or folder in a Box listing.",
    })
  )
) {}

/**
 * The entries of one Box folder.
 *
 * **Example** (An empty listing)
 *
 * ```ts
 * import { BoxListing } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BoxListing.make({ path: "", entries: [], truncated: false }).entries.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxListing extends S.Opaque<BoxListing, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String.annotateKey({ description: "The listed folder inside Box; empty for the Box folder itself." }),
    entries: S.Array(BoxEntry).annotateKey({ description: "Folders first, then files, by name." }),
    truncated: S.Boolean.annotateKey({
      description: `True when the folder holds more than ${BOX_LIST_MAX_ENTRIES} entries and the rest were left out.`,
    }),
  }).pipe(
    $I.annoteSchema("BoxListing", {
      description: "The entries of one Box folder.",
    })
  )
) {}

/**
 * Text read from a Box file.
 *
 * **Example** (Text content)
 *
 * ```ts
 * import { BoxTextContent } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BoxTextContent.make({ text: "Dear client", truncated: false }).kind) // "text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxTextContent extends S.Opaque<BoxTextContent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("text"),
    text: S.String.annotateKey({ description: "The file's text." }),
    truncated: S.Boolean.annotateKey({
      description: `True when the text was longer than ${BOX_READ_MAX_CHARACTERS} characters and was cut.`,
    }),
  }).pipe(
    $I.annoteSchema("BoxTextContent", {
      description: "Text read from a Box file.",
    })
  )
) {}

/**
 * A Box file whose text was not read, and why.
 *
 * **Example** (Metadata only)
 *
 * ```ts
 * import { BoxMetadataOnly } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BoxMetadataOnly.make({ reason: "Images have no text to read." }).kind) // "metadata-only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxMetadataOnly extends S.Opaque<BoxMetadataOnly, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("metadata-only"),
    reason: S.NonEmptyString.annotateKey({ description: "Why no text was returned, in plain language." }),
  }).pipe(
    $I.annoteSchema("BoxMetadataOnly", {
      description: "A Box file whose text was not read, and why.",
    })
  )
) {}

/**
 * What `box_read` returns for a file: its text or the reason there is none.
 *
 * **Example** (Match the content)
 *
 * ```ts
 * import { BoxContent, BoxTextContent } from "@beep/practice-gateway/BoxDriveTools"
 *
 * const content: BoxContent = BoxTextContent.make({ text: "Hello", truncated: false })
 * console.log(BoxContent.match(content, { text: (text) => text.text, "metadata-only": (meta) => meta.reason }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BoxContent = S.Union([BoxTextContent, BoxMetadataOnly]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("BoxContent", {
    description: "A Box file's text, or the reason there is none.",
  })
);

/**
 * Decoded type of {@link BoxContent}.
 *
 * **Example** (Type content)
 *
 * ```ts
 * import { BoxMetadataOnly } from "@beep/practice-gateway/BoxDriveTools"
 * import type { BoxContent } from "@beep/practice-gateway/BoxDriveTools"
 *
 * const content: BoxContent = BoxMetadataOnly.make({ reason: "Too large." })
 * console.log(content.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoxContent = typeof BoxContent.Type;

/**
 * A Box file and its content.
 *
 * **Example** (A read text file)
 *
 * ```ts
 * import { BoxDocument, BoxTextContent } from "@beep/practice-gateway/BoxDriveTools"
 *
 * const document = BoxDocument.make({
 *   name: "notes.md",
 *   path: "Clients/notes.md",
 *   sizeBytes: 5,
 *   content: BoxTextContent.make({ text: "Notes", truncated: false }),
 * })
 * console.log(document.content.kind) // "text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxDocument extends S.Opaque<BoxDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.annotateKey({ description: "File name." }),
    path: S.String.annotateKey({ description: "Path inside the Box folder, with `/` separators." }),
    sizeBytes: S.Natural.annotateKey({ description: "File size in bytes." }),
    content: BoxContent.annotateKey({ description: "The file's text, or why there is none." }),
  }).pipe(
    $I.annoteSchema("BoxDocument", {
      description: "A Box file and its content.",
    })
  )
) {}

/**
 * Why a Box tool call failed.
 *
 * **Example** (Check a failure reason)
 *
 * ```ts
 * import { BoxToolFailureReason } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BoxToolFailureReason.is["outside-box-folder"]("outside-box-folder")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BoxToolFailureReason = LiteralKit([
  "box-folder-missing",
  "outside-box-folder",
  "not-found",
  "not-a-folder",
  "not-a-file",
  "read-failed",
]).pipe(
  $I.annoteSchema("BoxToolFailureReason", {
    description: "Why a Box tool call failed.",
  })
);

/**
 * Decoded type of {@link BoxToolFailureReason}.
 *
 * **Example** (Type a failure reason)
 *
 * ```ts
 * import type { BoxToolFailureReason } from "@beep/practice-gateway/BoxDriveTools"
 *
 * const reason: BoxToolFailureReason = "not-found"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoxToolFailureReason = typeof BoxToolFailureReason.Type;

/**
 * Plain-language failure returned by a Box tool.
 *
 * **Example** (A missing file)
 *
 * ```ts
 * import { BoxToolError } from "@beep/practice-gateway/BoxDriveTools"
 *
 * const error = BoxToolError.make({ tool: "box_read", reason: "not-found", message: "There is no file at that path." })
 * console.log(error.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxToolError extends S.Opaque<BoxToolError, { readonly brand: unique symbol }>()(
  S.Struct({
    tool: S.NonEmptyString.annotateKey({ description: "The tool that failed." }),
    reason: BoxToolFailureReason.annotateKey({ description: "Why it failed." }),
    message: S.NonEmptyString.annotateKey({ description: "What happened and what to do next, in plain language." }),
  }).pipe(
    $I.annoteSchema("BoxToolError", {
      description: "Plain-language failure returned by a Box Drive tool.",
    })
  )
) {}

/**
 * Parameters of `box_list`.
 *
 * **Example** (List a client folder)
 *
 * ```ts
 * import { BoxListRequest } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BoxListRequest.make({ path: "Clients" }).path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxListRequest extends S.Opaque<BoxListRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.optionalKey(S.String).annotateKey({
      description: 'Folder inside Box, such as "Clients/Smith"; omit for the Box folder itself.',
    }),
  }).pipe(
    $I.annoteSchema("BoxListRequest", {
      description: "Which Box folder to list.",
    })
  )
) {}

/**
 * Parameters of `box_read`.
 *
 * **Example** (Read a letter)
 *
 * ```ts
 * import { BoxReadRequest } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BoxReadRequest.make({ path: "Clients/Smith/letter.docx" }).path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxReadRequest extends S.Opaque<BoxReadRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String.annotateKey({ description: 'File inside Box, such as "Clients/Smith/letter.docx".' }),
  }).pipe(
    $I.annoteSchema("BoxReadRequest", {
      description: "Which Box file to read.",
    })
  )
) {}

const readHints = FourHintAnnotations.make({ destructive: false, idempotent: true, openWorld: false, readOnly: true });

/**
 * `box_list`: list one folder of the lawyer's Box Drive folder.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { BoxListTool } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BoxListTool.name) // "box_list"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const BoxListTool = annotateFourHints(
  Tool.make("box_list", {
    description:
      "List the files and folders in the lawyer's Box folder on this computer (Box Drive). Paths are relative to the Box folder; omit path for its top level. Read-only.",
    failure: BoxToolError,
    failureMode: "return",
    parameters: BoxListRequest,
    success: BoxListing,
  }),
  readHints
);

/**
 * `box_read`: read one file of the lawyer's Box Drive folder.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { BoxReadTool } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(BoxReadTool.name) // "box_read"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const BoxReadTool = annotateFourHints(
  Tool.make("box_read", {
    description:
      "Read a file from the lawyer's Box folder on this computer (Box Drive). Returns the text of .txt, .md, .pdf (text layer) and .docx files, cut at a size limit; other files return their size and why no text is shown. Read-only.",
    failure: BoxToolError,
    failureMode: "return",
    parameters: BoxReadRequest,
    success: BoxDocument,
  }),
  readHints
);

/**
 * The Box Drive provider toolkit.
 *
 * **Example** (List the tool names)
 *
 * ```ts
 * import { BoxDriveToolkit } from "@beep/practice-gateway/BoxDriveTools"
 *
 * console.log(Object.keys(BoxDriveToolkit.tools)) // ["box_list", "box_read"]
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const BoxDriveToolkit = Toolkit.make(BoxListTool, BoxReadTool);

const failure = (tool: string, reason: BoxToolFailureReason, message: string) =>
  BoxToolError.make({ tool, reason, message });

const segmentsOf = (path: string): ReadonlyArray<string> =>
  A.filter(Str.split(path, /[\\/]+/), (segment) => Str.isNonEmpty(segment) && segment !== ".");

const byFolderThenName = Order.combine(
  Order.mapInput(Order.Boolean, (entry: BoxEntry) => entry.kind === "file"),
  Order.mapInput(Order.String, (entry: BoxEntry) => Str.toLowerCase(entry.name))
);

const truncate = (text: string) =>
  BoxTextContent.make({
    text: Str.slice(0, BOX_READ_MAX_CHARACTERS)(text),
    truncated: Str.length(text) > BOX_READ_MAX_CHARACTERS,
  });

const metadataOnly = (reason: string) => BoxMetadataOnly.make({ reason });

const loadDocText = Effect.tryPromise(() => import("@beep/doc-text"));

const sha256Hex = (bytes: Uint8Array) =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", bytes.slice().buffer)).pipe(
    Effect.map((digest) => Hex.encode(new Uint8Array(digest)))
  );

// PDF and DOCX text comes from the repo's JS-native driver, imported only when
// such a file is read.
const extractDocumentText = Effect.fnUntraced(function* (
  format: "pdf-text-layer" | "docx",
  name: string,
  extension: string,
  bytes: Uint8Array
) {
  const hex = yield* sha256Hex(bytes);
  const relativePath = yield* S.decodeEffect(PosixPath)(`box/${hex}.${extension}`);
  const operation = ExtractFileOperation.make({
    format,
    operationId: yield* S.decodeUnknownEffect(OperationId)(`operation:${hex}`),
    operationKind: "extract",
    preference: { engine: "tika" },
    source: SourceArtifact.make({
      bytes,
      digest: yield* S.decodeUnknownEffect(ContentDigest)(`sha256:${hex}`),
      extension,
      id: yield* S.decodeUnknownEffect(ArtifactId)(`artifact:${hex}`),
      locator: ArtifactLocator.make({ kind: "memory", value: relativePath }),
      name,
      relativePath,
      sizeBytes: S.Natural.make(bytes.byteLength),
    }),
  });
  const docText = yield* loadDocText;
  const result = yield* docText.DocTextFileProcessingEngine.extract(operation);
  return truncate(result.text ?? Str.empty);
});

const noTextReason = (format: FileFormatFamily) =>
  Match.value(format).pipe(
    Match.when("image-metadata", () => "Images have no text to read."),
    Match.orElse(() => "Claude can read the text of .txt, .md, .pdf and .docx files only.")
  );

/**
 * Handlers of {@link BoxDriveToolkit} over the Box folder in the Windows
 * user folder.
 *
 * **Details**
 *
 * Every path is checked twice: lexically ({@link BoxRelativePath}) and
 * against the real Box folder after symlinks are followed. Files above
 * {@link BOX_READ_MAX_BYTES} and formats without a text reader return
 * metadata only; PDF and DOCX text comes from `@beep/doc-text`, loaded on the
 * first such read.
 *
 * **Example** (Compose the handlers)
 *
 * ```ts
 * import { BoxDriveToolkitHandlers } from "@beep/practice-gateway/BoxDriveTools"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(BoxDriveToolkitHandlers))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BoxDriveToolkitHandlers = BoxDriveToolkit.toLayer(
  Effect.gen(function* () {
    const host = yield* WindowsHost;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const platform = yield* Effect.context<FileSystem.FileSystem | Path.Path>();

    const boxRoot = (tool: string) => {
      const missing = failure(
        tool,
        "box-folder-missing",
        "The Box folder is not on this computer yet. Run setup_status to see what Box Drive still needs."
      );
      return host.folder("USERPROFILE").pipe(
        Effect.flatMap(Effect.fromOption),
        Effect.map((home) => path.join(home, "Box")),
        Effect.flatMap((root) =>
          fs.exists(root).pipe(Effect.flatMap((present) => (present ? Effect.succeed(root) : Effect.fail(missing))))
        ),
        Effect.mapError(() => missing)
      );
    };

    // Resolve a relative path to its real location inside the Box folder.
    const resolve = Effect.fnUntraced(function* (tool: string, relative: string) {
      const checked = yield* S.decodeEffect(BoxRelativePath)(relative).pipe(
        Effect.mapError(() =>
          failure(
            tool,
            "outside-box-folder",
            'Use a path inside the Box folder, such as "Clients/Smith", without a drive letter or "..".'
          )
        )
      );
      const segments = segmentsOf(checked);
      const root = yield* boxRoot(tool);
      const target = yield* resolvePathWithinRoot({ root, candidate: path.join(...A.prepend(segments, ".")) }).pipe(
        Effect.provideContext(platform),
        Effect.mapError((error) =>
          error.reason === "escapes-root"
            ? failure(tool, "outside-box-folder", "That path leads outside the Box folder, so it cannot be opened.")
            : failure(tool, "not-found", `Nothing named "${checked}" is in the Box folder.`)
        )
      );
      const info = yield* fs
        .stat(target)
        .pipe(Effect.mapError(() => failure(tool, "not-found", `Nothing named "${checked}" is in the Box folder.`)));
      return { root, target, segments, info, shown: A.join(segments, "/") };
    });

    // Entries are re-checked against the Box folder, so a symlink that leads
    // out of it is not listed.
    const entryOf = (root: string, folder: string, parent: ReadonlyArray<string>) => (name: string) =>
      resolvePathWithinRoot({ root, candidate: path.join(folder, name) }).pipe(
        Effect.provideContext(platform),
        Effect.flatMap(fs.stat),
        Effect.map((info) =>
          info.type === "Directory" || info.type === "File"
            ? O.some(
                BoxEntry.make({
                  name,
                  path: A.join(A.append(parent, name), "/"),
                  kind: info.type === "Directory" ? "folder" : "file",
                  sizeBytes: info.type === "File" ? O.some(ByteSize.toNumberUnsafe(info.size)) : O.none(),
                })
              )
            : O.none()
        ),
        // An entry that escapes, vanished or cannot be read is left out of the listing.
        Effect.orElseSucceed(O.none<BoxEntry>)
      );

    return BoxDriveToolkit.of({
      box_list: Effect.fn("PracticeGateway.box_list")(function* (request) {
        const tool = "box_list";
        const { root, target, segments, info, shown } = yield* resolve(tool, request.path ?? "");
        if (info.type !== "Directory") {
          return yield* Effect.fail(failure(tool, "not-a-folder", `"${shown}" is a file; use box_read to read it.`));
        }
        const names = yield* fs
          .readDirectory(target)
          .pipe(Effect.mapError(() => failure(tool, "read-failed", `The folder "${shown}" could not be listed.`)));
        const entries = yield* Effect.forEach(names, entryOf(root, target, segments), { concurrency: 16 });
        const sorted = A.sort(A.getSomes(entries), byFolderThenName);
        return BoxListing.make({
          path: shown,
          entries: A.take(sorted, BOX_LIST_MAX_ENTRIES),
          truncated: A.length(sorted) > BOX_LIST_MAX_ENTRIES,
        });
      }),
      box_read: Effect.fn("PracticeGateway.box_read")(function* (request) {
        const tool = "box_read";
        const { target, segments, info, shown } = yield* resolve(tool, request.path);
        if (info.type !== "File") {
          return yield* Effect.fail(
            failure(tool, "not-a-file", `"${shown}" is a folder; use box_list to see what is in it.`)
          );
        }
        const name = pipe(
          A.last(segments),
          O.getOrElse(() => shown)
        );
        const sizeBytes = ByteSize.toNumberUnsafe(info.size);
        const extension = Str.toLowerCase(Str.replace(/^\./, "")(path.extname(name)));
        const format = FileFormatFamily.fromExtension(extension);
        const document = (content: BoxContent) => BoxDocument.make({ name, path: shown, sizeBytes, content });
        if (sizeBytes > BOX_READ_MAX_BYTES) {
          return document(metadataOnly("The file is too large to read here. Open it in Box Drive instead."));
        }
        const readBytes = fs
          .readFile(target)
          .pipe(Effect.mapError(() => failure(tool, "read-failed", `The file "${shown}" could not be read.`)));
        return yield* Match.value(format).pipe(
          Match.whenOr("plain-text", "markdown", () =>
            readBytes.pipe(Effect.map((bytes) => document(truncate(new TextDecoder().decode(bytes)))))
          ),
          Match.whenOr("pdf-text-layer", "docx", (documentFormat) =>
            readBytes.pipe(
              Effect.flatMap((bytes) =>
                extractDocumentText(documentFormat, name, extension, bytes).pipe(
                  Effect.catchCause((cause) =>
                    Effect.logDebug("Box document text could not be extracted.", Cause.pretty(cause)).pipe(
                      Effect.as(
                        metadataOnly(
                          "No text could be read from this file. It may be a scanned document or password-protected."
                        )
                      )
                    )
                  )
                )
              ),
              Effect.map(document)
            )
          ),
          Match.orElse((other) => Effect.succeed(document(metadataOnly(noTextReason(other)))))
        );
      }),
    });
  })
);

/**
 * The Box Drive tools, sanitized and with their handlers.
 *
 * **Example** (Compose the tools)
 *
 * ```ts
 * import { BoxDriveToolsLayer } from "@beep/practice-gateway/BoxDriveTools"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(BoxDriveToolsLayer))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BoxDriveToolsLayer = sanitizedToolkit(BoxDriveToolkit).pipe(Layer.provide(BoxDriveToolkitHandlers));

/**
 * The Box Drive tools, mounted when the saved profile selects `box-drive`
 * (directly or as a gap's fallback).
 *
 * **Details**
 *
 * The profile is read once at startup, so a newly saved profile takes effect
 * after Claude restarts the gateway. A failure to read the profile mounts
 * nothing and logs why.
 *
 * **Example** (Compose the provider)
 *
 * ```ts
 * import { BoxDriveProviderLayer } from "@beep/practice-gateway/BoxDriveTools"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(BoxDriveProviderLayer))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BoxDriveProviderLayer = Layer.unwrap(
  ProfileStore.use((store) => store.get).pipe(
    Effect.map((profile) => (O.exists(profile, profileSelects("box-drive")) ? BoxDriveToolsLayer : Layer.empty))
  )
).pipe(
  Layer.catchCause((cause) =>
    Layer.effectDiscard(Effect.logWarning("The Box Drive tools were not mounted.", Cause.pretty(cause)))
  )
);
