import { ArtifactLocator, SourceArtifact } from "@beep/file-processing/Artifact";
import { ExtractFileOperation } from "@beep/file-processing/Operation";
import { decodeTestOperationIdentifiers } from "@beep/file-processing/test";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { O } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import type { FileFormatFamily } from "@beep/file-processing/Strategy";

const textEncoder = new TextEncoder();

const fixtureExtensions = {
  doc: "doc",
  docm: "docm",
  docx: "docx",
  html: "html",
  "image-metadata": "png",
  markdown: "md",
  "pdf-text-layer": "pdf",
  "plain-text": "txt",
  rtf: "rtf",
  xhtml: "xhtml",
  xls: "xls",
  xlsx: "xlsx",
} satisfies Partial<Record<FileFormatFamily, string>>;

/**
 * Format families covered by the generated Tika driver fixtures.
 */
export type TikaFixtureFormat = keyof typeof fixtureExtensions;

const fixtureContentTypes = {
  doc: "application/msword",
  docm: "application/vnd.ms-word.document.macroenabled.12",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  html: "text/html",
  "image-metadata": "image/png",
  markdown: "text/markdown",
  "pdf-text-layer": "application/pdf",
  "plain-text": "text/plain",
  rtf: "application/rtf",
  xhtml: "application/xhtml+xml",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} satisfies Record<TikaFixtureFormat, string>;

const fixtureContent = {
  doc: "\n\n  legacy word corpus text\n\n",
  docm: "\n\n  macro-enabled word corpus text\n\n",
  docx: "\n\n  open xml word corpus text\n\n",
  html: "\n\n  hypertext corpus text\n\n",
  "image-metadata": "",
  markdown: "\n\n  markdown corpus text\n\n",
  "pdf-text-layer": "\n\n  pdf text-layer corpus text\n\n",
  "plain-text": "\n\n  plain corpus text\n\n",
  rtf: "\n\n  rich text corpus text\n\n",
  xhtml: "\n\n  xhtml corpus text\n\n",
  xls: "\n\n  legacy spreadsheet corpus text\n\n",
  xlsx: "\n\n  open xml spreadsheet corpus text\n\n",
} satisfies Record<TikaFixtureFormat, string>;

/**
 * Plain-text version payload returned by a stubbed `GET /version` probe.
 */
export const tikaVersionResponse = "Apache Tika 3.3.1";

/**
 * Trimmed text a stubbed `/rmeta/text` payload yields for a fixture format.
 */
export const fixtureText = (format: TikaFixtureFormat): string => fixtureContent[format].trim();

/**
 * Build the canned `PUT /rmeta/text` JSON payload for a fixture format.
 *
 * The payload mirrors the real Apache Tika wire shape: a JSON array holding a
 * single metadata record whose extracted text lives under `X-TIKA:content`.
 * The `image-metadata` payload carries metadata keys only.
 */
export const tikaRmetaResponse = (format: TikaFixtureFormat, content = fixtureContent[format]): string =>
  JSON.stringify([
    {
      "Content-Type": fixtureContentTypes[format],
      "dc:title": `${format} fixture`,
      "X-TIKA:Parsed-By": ["org.apache.tika.parser.CompositeParser", "org.apache.tika.parser.DefaultParser"],
      ...(format === "image-metadata" ? {} : { "X-TIKA:content": content }),
    },
  ]);

type ExtractOperationOverrides = {
  readonly bytes?: Uint8Array | undefined;
  readonly maxMaterializedBytes?: number | undefined;
  readonly omitSourceContent?: boolean | undefined;
};

/**
 * Build an `ExtractFileOperation` fixture for a format family.
 *
 * The source carries inline bytes by default so engines never need a file on
 * disk; `omitSourceContent` drops them to exercise the unreadable-source path.
 */
export const makeExtractOperationFixture = Effect.fn("TikaFixtures.makeExtractOperationFixture")(function* (
  format: TikaFixtureFormat,
  overrides: ExtractOperationOverrides = {}
) {
  const { artifactId, digest, operationId } = yield* decodeTestOperationIdentifiers();
  const extension = fixtureExtensions[format];
  const name = `fixture.${extension}`;
  const relativePath = yield* S.decodeUnknownEffect(PosixPath)(name);
  const bytes = overrides.bytes ?? textEncoder.encode(`${format} fixture bytes`);

  return ExtractFileOperation.make({
    format,
    operationId,
    operationKind: "extract",
    preference: { engine: "tika" },
    source: SourceArtifact.make({
      digest,
      extension,
      id: artifactId,
      locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
      name,
      relativePath,
      sizeBytes: NonNegativeInt.make(bytes.length),
      ...(overrides.omitSourceContent === true ? {} : { bytes }),
    }),
    ...O.getSomesStruct({ maxMaterializedBytes: O.fromUndefinedOr(overrides.maxMaterializedBytes) }),
  });
});
