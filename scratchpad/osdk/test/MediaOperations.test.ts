import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { MediaType } from "../src/Attachment/Attachment.model.ts";
import {
  AnnotateGeometry,
  AnnotateImageOperation,
  Annotation,
  ArchiveEncoding,
  ArchiveEncodingKind,
  AudioChannelLayout,
  AudioChannelOperation,
  AudioChunkOperation,
  AudioEncoding,
  AudioEncodingKind,
  AudioOperation,
  AudioToTextOperation,
  AudioToTextTransformation,
  AudioTransformation,
  BoundingBoxGeometry,
  ChatLlmSpec,
  CipherLicenseRid,
  Color,
  ContrastBinarize,
  ContrastEqualize,
  ContrastImageOperation,
  ContrastRayleigh,
  ContrastType,
  ConvertAudioOperation,
  ConvertDocumentOperation,
  ConvertSheetToJsonOperation,
  CreatePdfOperation,
  CropConfig,
  CropImageOperation,
  DecryptImageOperation,
  DicomToImageOperation,
  DicomToImageTransformation,
  DocumentEncoding,
  DocumentEncodingKind,
  DocumentExtractLayoutAwareContentOperation,
  DocumentTextExtractionConfig,
  DocumentToDocumentOperation,
  DocumentToDocumentTransformation,
  DocumentToImageOperation,
  DocumentToImageTransformation,
  DocumentToTextOperation,
  DocumentToTextTransformation,
  EmailBodyFormat,
  EmailToAttachmentOperation,
  EmailToAttachmentTransformation,
  EmailToTextOperation,
  EmailToTextTransformation,
  EmbeddingModelId,
  EncryptImageOperation,
  ExtractAllTextOperation,
  ExtractAudioOperation,
  ExtractDocumentLayoutAwareTextOperation,
  ExtractDocumentTextOperation,
  ExtractFirstFrameOperation,
  ExtractFormFieldsOperation,
  ExtractFramesAtTimestampsOperation,
  ExtractImageLayoutAwareTextOperation,
  ExtractImageTextOperation,
  ExtractSceneFramesOperation,
  ExtractTableOfContentsOperation,
  ExtractTextFromPagesToArrayOperation,
  ExtractTextPreprocessing,
  ExtractUnstructuredTextFromPageOperation,
  ExtractVlmTextOperation,
  GenerateEmbeddingOperation,
  GetEmailAttachmentOperation,
  GetEmailBodyOperation,
  GetPdfPageDimensionsOperation,
  GetTimestampsForSceneFramesOperation,
  GrayscaleImageOperation,
  ImageExtractLayoutAwareContentOperation,
  ImageOcrOperation,
  ImageOperation,
  ImagePixelCoordinate,
  ImageRegionPolygon,
  ImageryEncoding,
  ImageryEncodingKind,
  ImageSpec,
  ImageToDocumentOperation,
  ImageToDocumentTransformation,
  ImageToEmbeddingOperation,
  ImageToEmbeddingTransformation,
  ImageToTextOperation,
  ImageToTextTransformation,
  ImageTransformation,
  LanguageModelApiName,
  LanguageModelLocator,
  LayoutAwareExtractionParameters,
  LayoutAwarePreprocessing,
  LlmSpec,
  MediaTransformation,
  MediaTransformationKind,
  ModelByApiName,
  ModelByRegisteredRid,
  Mp3Encoding,
  NumberOfChannels,
  OcrLanguage,
  OcrLanguageHint,
  OcrLanguageOrScript,
  OcrMode,
  OcrOnPageOperation,
  OcrOnPagesOperation,
  OcrOutputFormat,
  OcrOutputFormatKind,
  OcrParameters,
  OcrScript,
  OcrScriptHint,
  PageRange,
  PerformanceMode,
  PlainTextNoSegmentData,
  Pttml,
  RegisteredModelRid,
  RenderImageLayerOperation,
  RenderPageOperation,
  RenderPageToFitBoundingBoxOperation,
  ResizeImageOperation,
  ResizeToFitBoundingBoxOperation,
  ResizingMode,
  RotateImageOperation,
  SceneScore,
  SlicePdfRangeOperation,
  SpreadsheetToTextOperation,
  SpreadsheetToTextTransformation,
  TextOutputFormat,
  TileImageOperation,
  TranscodeOperation,
  TranscribeJson,
  TranscribeOperation,
  TranscribeOutputFormat,
  TranscriptionLanguage,
  TransformationJob,
  TransformationJobId,
  TransformationJobStatus,
  TransformMediaItemRequest,
  TsAudioEncoding,
  VideoChunkOperation,
  VideoEncoding,
  VideoEncodingKind,
  VideoOperation,
  VideoToArchiveOperation,
  VideoToArchiveTransformation,
  VideoToAudioOperation,
  VideoToAudioTransformation,
  VideoToImageOperation,
  VideoToImageTransformation,
  VideoToTextOperation,
  VideoToTextTransformation,
  VideoTransformation,
  VlmOutputFormat,
  VlmPreprocessingConfig,
  WavEncoding,
  WaveformOperation,
} from "../src/Media/index.ts";
import * as TransformationModel from "../src/Media/MediaTransformation.model.ts";
import * as TransformationValues from "../src/Media/MediaTransformation.values.ts";

// -----------------------------------------------------------------------------
// Law and fixture helpers
// -----------------------------------------------------------------------------

/** One row of a schema table: the schema itself, and the laws it must obey once it is given its name. */
interface Covered {
  readonly schema: unknown;
  readonly laws: (name: string) => void;
}

/** Binds a schema to its laws: generated values are valid, and the wire form loses nothing. */
const covered = <T, I>(schema: S.Codec<T, I>): Covered => ({
  schema,
  laws: (name) => {
    const arbitrary = Arbitrary.schema(schema);
    const isValid = S.is(schema);
    const isEquivalent = S.toEquivalence(schema);
    const encode = S.encodeEffect(schema);
    const decode = S.decodeEffect(schema);
    describe(`${name} laws`, () => {
      it.prop("generated values satisfy the guard", [arbitrary], ([value]) => isValid(value), {
        arbitrary: fcRuns(25),
      });
      it.effect.prop(
        "encoding then decoding gives an equivalent value",
        [arbitrary],
        Effect.fnUntraced(function* ([value]) {
          const encoded = yield* encode(value);
          const decoded = yield* decode(encoded);
          assertTrue(isEquivalent(decoded, value));
        }),
        { arbitrary: fcRuns(25) }
      );
    });
  },
});

/** The names a table and a module disagree on: exported but not listed, listed but not exported, or misfiled. */
const disagreements = <Row>(
  exported: { readonly [name: string]: unknown },
  table: { readonly [name: string]: Row },
  schemaOf: (row: Row) => unknown
) => ({
  unlisted: A.difference(R.keys(exported), R.keys(table)),
  unexported: A.difference(R.keys(table), R.keys(exported)),
  misfiled: R.keys(
    R.filter(table, (row, name) => !O.exists(R.get(exported, name), (value) => value === schemaOf(row)))
  ),
});

const noDisagreements = { unlisted: [], unexported: [], misfiled: [] };

/**
 * Registers the laws of every row, after checking the table against the module it describes: a schema the module
 * exports without a row, a row without an export, or a row filed under another schema's name fails the suite.
 */
const schemaTable = (
  moduleName: string,
  exports: { readonly [name: string]: unknown },
  count: number,
  table: { readonly [name: string]: Covered }
) =>
  describe(`${moduleName} schemas`, () => {
    it(`the table lists each of the ${count} schemas the module exports, under its own name`, () => {
      const exported = R.filter(exports, (value) => S.isSchema(value));
      deepStrictEqual(
        disagreements(exported, table, (row) => row.schema),
        noDisagreements
      );
      strictEqual(R.size(table), count);
    });
    A.forEach(R.toEntries(table), ([name, row]) => row.laws(name));
  });

/** One row of a union table: the union itself, its tags, and the fixtures it registers once it is given its name. */
interface Fixtured {
  readonly union: unknown;
  readonly tags: ReadonlyArray<string>;
  readonly fixtures: (name: string) => void;
}

/**
 * Binds a tagged union to one exact wire fixture per case. Every domain value is built through the union's own
 * `cases`; every wire value is decoded, compared with it, checked against the member schema `cases` holds for its
 * tag, passed through every guard and an exhaustive `match`, and encoded back. The fixture record is checked against
 * the union's tags twice: by the compiler and when the suite runs. Generated values go through the same `match`.
 */
const fixturesOf = <T extends { readonly type: string }, I extends { readonly type: string }>(
  union: S.Codec<T, I> & {
    readonly cases: { readonly [Tag in T["type"]]: S.Top };
    readonly guards: { readonly [Tag in T["type"]]: (value: unknown) => boolean };
    readonly match: <Handlers extends { readonly [Tag in T["type"]]: (value: T) => string }>(
      value: T,
      handlers: Handlers
    ) => unknown;
  },
  fixtures: { readonly [Tag in T["type"]]: readonly [wire: NoInfer<I>, domain: NoInfer<T>] }
): Fixtured => ({
  union,
  tags: R.keys(union.cases),
  fixtures: (name) =>
    describe(`${name} wire fixtures`, () => {
      it("there is exactly one fixture per case, in declaration order", () => {
        deepStrictEqual(R.keys(fixtures), R.keys(union.cases));
        deepStrictEqual(R.keys(fixtures), R.keys(union.guards));
      });
      A.forEach(R.toEntries(fixtures), ([tag, [wire, domain]]) =>
        it.effect(
          `${tag} decodes from its exact wire form, matches as itself and encodes back`,
          Effect.fnUntraced(function* () {
            strictEqual(wire.type, tag);
            strictEqual(domain.type, tag);
            const decoded = yield* S.decodeEffect(union)(wire);
            deepStrictEqual(decoded, domain);
            assertTrue(S.toEquivalence(union)(decoded, domain));
            assertTrue(O.exists(R.get(union.cases, tag), (member) => S.is(member)(decoded) && S.is(member)(domain)));
            assertTrue(R.every(union.guards, (guard, guardTag) => guard(decoded) === (guardTag === tag)));
            const matched = union.match(
              decoded,
              R.map(union.cases, (_, caseTag) => () => caseTag)
            );
            strictEqual(matched, tag);
            const encoded = yield* S.encodeEffect(union)(decoded);
            deepStrictEqual(encoded, wire);
          })
        )
      );
      it.prop(
        "an exhaustive match sends every generated value to the handler of its own tag",
        [Arbitrary.schema(union)],
        ([value]) =>
          union.match(
            value,
            R.map(union.cases, (_, caseTag) => () => caseTag)
          ) === value.type,
        { arbitrary: fcRuns(25) }
      );
    }),
});

/**
 * Registers the fixtures of every row, after checking the table against the module it describes: a tagged union
 * the module exports without fixtures, or fixtures filed under another union's name, fail the suite.
 */
const unionTable = (
  moduleName: string,
  exports: { readonly [name: string]: unknown },
  count: { readonly unions: number; readonly cases: number },
  table: { readonly [name: string]: Fixtured }
) =>
  describe(`${moduleName} tagged unions`, () => {
    it(`the table holds fixtures for the ${count.cases} cases of the ${count.unions} unions the module exports`, () => {
      const exported = R.filter(exports, (value) => S.isSchema(value) && P.hasProperty(value, "cases"));
      deepStrictEqual(
        disagreements(exported, table, (row) => row.union),
        noDisagreements
      );
      strictEqual(R.size(table), count.unions);
      strictEqual(N.sumAll(A.map(R.values(table), (row) => A.length(row.tags))), count.cases);
    });
    A.forEach(R.toEntries(table), ([name, row]) => row.fixtures(name));
  });

/** Registers one exact wire fixture per literal of an encoding: the wire's `{ type }` record and the bare name. */
const encodingFixtures =
  <T extends string>(
    name: string,
    schema: S.Codec<T, { readonly type: T }>,
    literals: ReadonlyArray<T>,
    count: number
  ) =>
  () =>
    describe(`${name} wire fixtures`, () => {
      it(`there are ${count} literals`, () => {
        strictEqual(A.length(literals), count);
      });
      A.forEach(literals, (literal) =>
        it.effect(
          `${literal} decodes from its tag record and encodes back`,
          Effect.fnUntraced(function* () {
            const decoded = yield* S.decodeEffect(schema)({ type: literal });
            strictEqual(decoded, literal);
            const encoded = yield* S.encodeEffect(schema)(decoded);
            deepStrictEqual(encoded, { type: literal });
          })
        )
      );
    });

const register = (registrations: ReadonlyArray<() => void>) => A.forEach(registrations, (run) => run());

// -----------------------------------------------------------------------------
// Laws over every named schema
// -----------------------------------------------------------------------------

schemaTable("MediaTransformation.model", TransformationModel, 133, {
  TransformationJobId: covered(TransformationJobId),
  CipherLicenseRid: covered(CipherLicenseRid),
  LanguageModelApiName: covered(LanguageModelApiName),
  RegisteredModelRid: covered(RegisteredModelRid),
  ImageryEncoding: covered(ImageryEncoding),
  VideoEncoding: covered(VideoEncoding),
  ArchiveEncoding: covered(ArchiveEncoding),
  DocumentEncoding: covered(DocumentEncoding),
  NumberOfChannels: covered(NumberOfChannels),
  AudioChannelLayout: covered(AudioChannelLayout),
  Mp3Encoding: covered(Mp3Encoding),
  WavEncoding: covered(WavEncoding),
  TsAudioEncoding: covered(TsAudioEncoding),
  AudioEncoding: covered(AudioEncoding),
  PageRange: covered(PageRange),
  OcrOutputFormat: covered(OcrOutputFormat),
  OcrLanguageHint: covered(OcrLanguageHint),
  OcrScriptHint: covered(OcrScriptHint),
  OcrLanguageOrScript: covered(OcrLanguageOrScript),
  OcrParameters: covered(OcrParameters),
  LayoutAwareExtractionParameters: covered(LayoutAwareExtractionParameters),
  DocumentTextExtractionConfig: covered(DocumentTextExtractionConfig),
  PlainTextNoSegmentData: covered(PlainTextNoSegmentData),
  TranscribeJson: covered(TranscribeJson),
  Pttml: covered(Pttml),
  TranscribeOutputFormat: covered(TranscribeOutputFormat),
  ModelByApiName: covered(ModelByApiName),
  ModelByRegisteredRid: covered(ModelByRegisteredRid),
  LanguageModelLocator: covered(LanguageModelLocator),
  ChatLlmSpec: covered(ChatLlmSpec),
  LlmSpec: covered(LlmSpec),
  CropConfig: covered(CropConfig),
  LayoutAwarePreprocessing: covered(LayoutAwarePreprocessing),
  ExtractTextPreprocessing: covered(ExtractTextPreprocessing),
  VlmPreprocessingConfig: covered(VlmPreprocessingConfig),
  ImageSpec: covered(ImageSpec),
  Color: covered(Color),
  BoundingBoxGeometry: covered(BoundingBoxGeometry),
  AnnotateGeometry: covered(AnnotateGeometry),
  Annotation: covered(Annotation),
  ContrastEqualize: covered(ContrastEqualize),
  ContrastRayleigh: covered(ContrastRayleigh),
  ContrastBinarize: covered(ContrastBinarize),
  ContrastType: covered(ContrastType),
  ImagePixelCoordinate: covered(ImagePixelCoordinate),
  ImageRegionPolygon: covered(ImageRegionPolygon),
  ResizeImageOperation: covered(ResizeImageOperation),
  ResizeToFitBoundingBoxOperation: covered(ResizeToFitBoundingBoxOperation),
  RotateImageOperation: covered(RotateImageOperation),
  CropImageOperation: covered(CropImageOperation),
  GrayscaleImageOperation: covered(GrayscaleImageOperation),
  TileImageOperation: covered(TileImageOperation),
  AnnotateImageOperation: covered(AnnotateImageOperation),
  ContrastImageOperation: covered(ContrastImageOperation),
  EncryptImageOperation: covered(EncryptImageOperation),
  DecryptImageOperation: covered(DecryptImageOperation),
  ImageOperation: covered(ImageOperation),
  TranscodeOperation: covered(TranscodeOperation),
  VideoChunkOperation: covered(VideoChunkOperation),
  VideoOperation: covered(VideoOperation),
  AudioChannelOperation: covered(AudioChannelOperation),
  AudioChunkOperation: covered(AudioChunkOperation),
  ConvertAudioOperation: covered(ConvertAudioOperation),
  AudioOperation: covered(AudioOperation),
  ExtractAudioOperation: covered(ExtractAudioOperation),
  VideoToAudioOperation: covered(VideoToAudioOperation),
  TranscribeOperation: covered(TranscribeOperation),
  WaveformOperation: covered(WaveformOperation),
  AudioToTextOperation: covered(AudioToTextOperation),
  ExtractSceneFramesOperation: covered(ExtractSceneFramesOperation),
  VideoToArchiveOperation: covered(VideoToArchiveOperation),
  GetTimestampsForSceneFramesOperation: covered(GetTimestampsForSceneFramesOperation),
  VideoToTextOperation: covered(VideoToTextOperation),
  ExtractFirstFrameOperation: covered(ExtractFirstFrameOperation),
  ExtractFramesAtTimestampsOperation: covered(ExtractFramesAtTimestampsOperation),
  VideoToImageOperation: covered(VideoToImageOperation),
  GetEmailBodyOperation: covered(GetEmailBodyOperation),
  EmailToTextOperation: covered(EmailToTextOperation),
  GetEmailAttachmentOperation: covered(GetEmailAttachmentOperation),
  EmailToAttachmentOperation: covered(EmailToAttachmentOperation),
  ConvertSheetToJsonOperation: covered(ConvertSheetToJsonOperation),
  SpreadsheetToTextOperation: covered(SpreadsheetToTextOperation),
  ImageExtractLayoutAwareContentOperation: covered(ImageExtractLayoutAwareContentOperation),
  ImageOcrOperation: covered(ImageOcrOperation),
  ExtractImageLayoutAwareTextOperation: covered(ExtractImageLayoutAwareTextOperation),
  ExtractImageTextOperation: covered(ExtractImageTextOperation),
  ImageToTextOperation: covered(ImageToTextOperation),
  CreatePdfOperation: covered(CreatePdfOperation),
  ImageToDocumentOperation: covered(ImageToDocumentOperation),
  GenerateEmbeddingOperation: covered(GenerateEmbeddingOperation),
  ImageToEmbeddingOperation: covered(ImageToEmbeddingOperation),
  RenderImageLayerOperation: covered(RenderImageLayerOperation),
  DicomToImageOperation: covered(DicomToImageOperation),
  SlicePdfRangeOperation: covered(SlicePdfRangeOperation),
  ConvertDocumentOperation: covered(ConvertDocumentOperation),
  DocumentToDocumentOperation: covered(DocumentToDocumentOperation),
  RenderPageOperation: covered(RenderPageOperation),
  RenderPageToFitBoundingBoxOperation: covered(RenderPageToFitBoundingBoxOperation),
  DocumentToImageOperation: covered(DocumentToImageOperation),
  ExtractAllTextOperation: covered(ExtractAllTextOperation),
  ExtractTableOfContentsOperation: covered(ExtractTableOfContentsOperation),
  GetPdfPageDimensionsOperation: covered(GetPdfPageDimensionsOperation),
  ExtractFormFieldsOperation: covered(ExtractFormFieldsOperation),
  ExtractUnstructuredTextFromPageOperation: covered(ExtractUnstructuredTextFromPageOperation),
  ExtractTextFromPagesToArrayOperation: covered(ExtractTextFromPagesToArrayOperation),
  OcrOnPageOperation: covered(OcrOnPageOperation),
  OcrOnPagesOperation: covered(OcrOnPagesOperation),
  DocumentExtractLayoutAwareContentOperation: covered(DocumentExtractLayoutAwareContentOperation),
  ExtractDocumentLayoutAwareTextOperation: covered(ExtractDocumentLayoutAwareTextOperation),
  ExtractDocumentTextOperation: covered(ExtractDocumentTextOperation),
  ExtractVlmTextOperation: covered(ExtractVlmTextOperation),
  DocumentToTextOperation: covered(DocumentToTextOperation),
  ImageTransformation: covered(ImageTransformation),
  VideoTransformation: covered(VideoTransformation),
  AudioTransformation: covered(AudioTransformation),
  EmailToTextTransformation: covered(EmailToTextTransformation),
  SpreadsheetToTextTransformation: covered(SpreadsheetToTextTransformation),
  VideoToAudioTransformation: covered(VideoToAudioTransformation),
  AudioToTextTransformation: covered(AudioToTextTransformation),
  EmailToAttachmentTransformation: covered(EmailToAttachmentTransformation),
  VideoToArchiveTransformation: covered(VideoToArchiveTransformation),
  VideoToTextTransformation: covered(VideoToTextTransformation),
  ImageToTextTransformation: covered(ImageToTextTransformation),
  VideoToImageTransformation: covered(VideoToImageTransformation),
  ImageToDocumentTransformation: covered(ImageToDocumentTransformation),
  DicomToImageTransformation: covered(DicomToImageTransformation),
  DocumentToDocumentTransformation: covered(DocumentToDocumentTransformation),
  DocumentToImageTransformation: covered(DocumentToImageTransformation),
  ImageToEmbeddingTransformation: covered(ImageToEmbeddingTransformation),
  DocumentToTextTransformation: covered(DocumentToTextTransformation),
  MediaTransformation: covered(MediaTransformation),
  TransformMediaItemRequest: covered(TransformMediaItemRequest),
  TransformationJob: covered(TransformationJob),
});

schemaTable("MediaTransformation.values", TransformationValues, 19, {
  MediaTransformationKind: covered(MediaTransformationKind),
  ImageryEncodingKind: covered(ImageryEncodingKind),
  VideoEncodingKind: covered(VideoEncodingKind),
  AudioEncodingKind: covered(AudioEncodingKind),
  ArchiveEncodingKind: covered(ArchiveEncodingKind),
  DocumentEncodingKind: covered(DocumentEncodingKind),
  OcrOutputFormatKind: covered(OcrOutputFormatKind),
  PerformanceMode: covered(PerformanceMode),
  SceneScore: covered(SceneScore),
  EmailBodyFormat: covered(EmailBodyFormat),
  TextOutputFormat: covered(TextOutputFormat),
  OcrMode: covered(OcrMode),
  ResizingMode: covered(ResizingMode),
  VlmOutputFormat: covered(VlmOutputFormat),
  EmbeddingModelId: covered(EmbeddingModelId),
  TransformationJobStatus: covered(TransformationJobStatus),
  OcrLanguage: covered(OcrLanguage),
  OcrScript: covered(OcrScript),
  TranscriptionLanguage: covered(TranscriptionLanguage),
});

// -----------------------------------------------------------------------------
// Shared fixture values
// -----------------------------------------------------------------------------

const english = OcrLanguageOrScript.cases.language.make({ language: "ENG" });
const license = CipherLicenseRid.make("ri.cipher.main.license.a1");
const triangle = [
  ImagePixelCoordinate.make({ x: 1, y: 2 }),
  ImagePixelCoordinate.make({ x: 30, y: 2 }),
  ImagePixelCoordinate.make({ x: 30, y: 40 }),
];
const square = [
  ImagePixelCoordinate.make({ x: 0, y: 0 }),
  ImagePixelCoordinate.make({ x: 8, y: 0 }),
  ImagePixelCoordinate.make({ x: 8, y: 8 }),
  ImagePixelCoordinate.make({ x: 0, y: 8 }),
];

// -----------------------------------------------------------------------------
// Wire fixtures: one per case of every tagged union
// -----------------------------------------------------------------------------

unionTable("MediaTransformation.model", TransformationModel, { unions: 28, cases: 84 }, {
  MediaTransformation: fixturesOf(MediaTransformation, {
    image: [
      {
        type: "image",
        encoding: { type: "jpg" },
        operations: [{ type: "crop", xOffset: 16, yOffset: 32, width: 640, height: 480 }, { type: "grayscale" }],
      },
      MediaTransformation.cases.image.make({
        encoding: "jpg",
        operations: [
          ImageOperation.cases.crop.make({ xOffset: 16, yOffset: 32, width: 640, height: 480 }),
          ImageOperation.cases.grayscale.make({}),
        ],
      }),
    ],
    video: [
      { type: "video", encoding: { type: "mp4" }, operation: { type: "transcode" } },
      MediaTransformation.cases.video.make({ encoding: "mp4", operation: VideoOperation.cases.transcode.make({}) }),
    ],
    audio: [
      { type: "audio", operation: { type: "convert", encodeFormat: { type: "ts" } } },
      MediaTransformation.cases.audio.make({
        operation: AudioOperation.cases.convert.make({ encodeFormat: AudioEncoding.cases.ts.make({}) }),
      }),
    ],
    emailToText: [
      { type: "emailToText", operation: { type: "getEmailBody", outputFormat: "HTML" } },
      MediaTransformation.cases.emailToText.make({
        operation: EmailToTextOperation.cases.getEmailBody.make({ outputFormat: "html" }),
      }),
    ],
    spreadsheetToText: [
      { type: "spreadsheetToText", operation: { type: "convertSheetToJson", sheetName: "Q3 actuals" } },
      MediaTransformation.cases.spreadsheetToText.make({
        operation: SpreadsheetToTextOperation.cases.convertSheetToJson.make({ sheetName: "Q3 actuals" }),
      }),
    ],
    videoToAudio: [
      { type: "videoToAudio", encoding: { type: "mp3" }, operation: { type: "extractAudio" } },
      MediaTransformation.cases.videoToAudio.make({
        encoding: AudioEncoding.cases.mp3.make({}),
        operation: VideoToAudioOperation.cases.extractAudio.make({}),
      }),
    ],
    audioToText: [
      { type: "audioToText", operation: { type: "waveform", peaksPerSecond: 20 } },
      MediaTransformation.cases.audioToText.make({
        operation: AudioToTextOperation.cases.waveform.make({ peaksPerSecond: 20 }),
      }),
    ],
    emailToAttachment: [
      {
        type: "emailToAttachment",
        operation: { type: "getEmailAttachment", mimeType: "image/png", attachmentIndex: 2 },
      },
      MediaTransformation.cases.emailToAttachment.make({
        operation: EmailToAttachmentOperation.cases.getEmailAttachment.make({
          mimeType: MediaType.make("image/png"),
          attachmentIndex: 2,
        }),
      }),
    ],
    videoToArchive: [
      {
        type: "videoToArchive",
        encoding: { type: "tar" },
        operation: { type: "extractSceneFrames", encoding: { type: "png" } },
      },
      MediaTransformation.cases.videoToArchive.make({
        encoding: "tar",
        operation: VideoToArchiveOperation.cases.extractSceneFrames.make({ encoding: "png" }),
      }),
    ],
    videoToText: [
      { type: "videoToText", operation: { type: "getTimestampsForSceneFrames", sceneScore: "STANDARD" } },
      MediaTransformation.cases.videoToText.make({
        operation: VideoToTextOperation.cases.getTimestampsForSceneFrames.make({ sceneScore: O.some("standard") }),
      }),
    ],
    imageToText: [
      {
        type: "imageToText",
        operation: {
          type: "ocr",
          parameters: { outputFormat: { type: "text" }, languages: [{ type: "language", language: "DEU" }] },
        },
      },
      MediaTransformation.cases.imageToText.make({
        operation: ImageToTextOperation.cases.ocr.make({
          parameters: OcrParameters.make({
            outputFormat: "text",
            languages: [OcrLanguageOrScript.cases.language.make({ language: "DEU" })],
          }),
        }),
      }),
    ],
    videoToImage: [
      {
        type: "videoToImage",
        encoding: { type: "jpg" },
        operation: { type: "extractFramesAtTimestamps", width: 1280, timestamp: 12.5 },
      },
      MediaTransformation.cases.videoToImage.make({
        encoding: "jpg",
        operation: VideoToImageOperation.cases.extractFramesAtTimestamps.make({
          width: O.some(1280),
          timestamp: 12.5,
        }),
      }),
    ],
    imageToDocument: [
      { type: "imageToDocument", operation: { type: "createPdf" } },
      MediaTransformation.cases.imageToDocument.make({ operation: ImageToDocumentOperation.cases.createPdf.make({}) }),
    ],
    dicomToImage: [
      {
        type: "dicomToImage",
        encoding: { type: "png" },
        operation: { type: "renderImageLayer", layerNumber: 7, height: 512 },
      },
      MediaTransformation.cases.dicomToImage.make({
        encoding: "png",
        operation: DicomToImageOperation.cases.renderImageLayer.make({
          layerNumber: O.some(7),
          height: O.some(512),
        }),
      }),
    ],
    documentToDocument: [
      { type: "documentToDocument", encoding: { type: "pdf" }, operation: { type: "convertDocument" } },
      MediaTransformation.cases.documentToDocument.make({
        encoding: "pdf",
        operation: DocumentToDocumentOperation.cases.convertDocument.make({}),
      }),
    ],
    documentToImage: [
      {
        type: "documentToImage",
        encoding: { type: "tiff" },
        operation: { type: "renderPage", pageNumber: 0, width: 1024 },
      },
      MediaTransformation.cases.documentToImage.make({
        encoding: "tiff",
        operation: DocumentToImageOperation.cases.renderPage.make({ pageNumber: O.some(0), width: O.some(1024) }),
      }),
    ],
    imageToEmbedding: [
      { type: "imageToEmbedding", operation: { type: "generateEmbedding", modelId: "GOOGLE_SIGLIP_2" } },
      MediaTransformation.cases.imageToEmbedding.make({
        operation: ImageToEmbeddingOperation.cases.generateEmbedding.make({ modelId: "googleSiglip2" }),
      }),
    ],
    documentToText: [
      { type: "documentToText", operation: { type: "extractAllText" } },
      MediaTransformation.cases.documentToText.make({
        operation: DocumentToTextOperation.cases.extractAllText.make({}),
      }),
    ],
  }),
  ImageOperation: fixturesOf(ImageOperation, {
    resize: [
      { type: "resize", height: 600, autoOrient: false },
      ImageOperation.cases.resize.make({ height: O.some(600), autoOrient: O.some(false) }),
    ],
    resizeToFitBoundingBox: [
      { type: "resizeToFitBoundingBox", width: 1920, height: 1080 },
      ImageOperation.cases.resizeToFitBoundingBox.make({ width: 1920, height: 1080 }),
    ],
    rotate: [{ type: "rotate", angle: "DEGREE_180" }, ImageOperation.cases.rotate.make({ angle: "degree180" })],
    crop: [
      { type: "crop", xOffset: 0, yOffset: 120, width: 800, height: 600 },
      ImageOperation.cases.crop.make({ xOffset: 0, yOffset: 120, width: 800, height: 600 }),
    ],
    grayscale: [{ type: "grayscale" }, ImageOperation.cases.grayscale.make({})],
    tile: [
      { type: "tile", zoom: 12, x: 2048, y: 1361 },
      ImageOperation.cases.tile.make({ zoom: 12, x: 2048, y: 1361 }),
    ],
    annotate: [
      {
        type: "annotate",
        annotations: [
          { geometry: { type: "boundingBox", boundingBox: { left: 5, top: 6, width: 70, height: 80 } }, fontSize: 14 },
        ],
      },
      ImageOperation.cases.annotate.make({
        annotations: [
          Annotation.make({
            geometry: AnnotateGeometry.cases.boundingBox.make({ left: 5, top: 6, width: 70, height: 80 }),
            fontSize: O.some(14),
          }),
        ],
      }),
    ],
    contrast: [
      { type: "contrast", contrastType: { type: "binarize", threshold: 128 } },
      ImageOperation.cases.contrast.make({
        contrastType: ContrastType.cases.binarize.make({ threshold: O.some(128) }),
      }),
    ],
    encrypt: [
      {
        type: "encrypt",
        polygons: [
          [
            { x: 1, y: 2 },
            { x: 30, y: 2 },
            { x: 30, y: 40 },
          ],
        ],
        cipherLicenseRid: "ri.cipher.main.license.a1",
      },
      ImageOperation.cases.encrypt.make({ polygons: [triangle], cipherLicenseRid: license }),
    ],
    decrypt: [
      {
        type: "decrypt",
        polygons: [
          [
            { x: 0, y: 0 },
            { x: 8, y: 0 },
            { x: 8, y: 8 },
            { x: 0, y: 8 },
          ],
          [
            { x: 1, y: 2 },
            { x: 30, y: 2 },
            { x: 30, y: 40 },
          ],
        ],
        cipherLicenseRid: "ri.cipher.main.license.a1",
      },
      ImageOperation.cases.decrypt.make({ polygons: [square, triangle], cipherLicenseRid: license }),
    ],
  }),
  VideoOperation: fixturesOf(VideoOperation, {
    transcode: [{ type: "transcode" }, VideoOperation.cases.transcode.make({})],
    chunk: [
      { type: "chunk", chunkDurationMilliseconds: 10000, chunkIndex: 2 },
      VideoOperation.cases.chunk.make({ chunkDurationMilliseconds: 10000, chunkIndex: 2 }),
    ],
  }),
  AudioOperation: fixturesOf(AudioOperation, {
    channel: [
      { type: "channel", encodeFormat: { type: "wav", sampleRate: 44100 }, channel: 1 },
      AudioOperation.cases.channel.make({
        encodeFormat: AudioEncoding.cases.wav.make({ sampleRate: O.some(44100) }),
        channel: 1,
      }),
    ],
    chunk: [
      { type: "chunk", chunkDurationMilliseconds: 60000, encodeFormat: { type: "ts" }, chunkIndex: 0 },
      AudioOperation.cases.chunk.make({
        chunkDurationMilliseconds: 60000,
        encodeFormat: AudioEncoding.cases.ts.make({}),
        chunkIndex: 0,
      }),
    ],
    convert: [
      { type: "convert", encodeFormat: { type: "mp3" } },
      AudioOperation.cases.convert.make({ encodeFormat: AudioEncoding.cases.mp3.make({}) }),
    ],
  }),
  VideoToAudioOperation: fixturesOf(VideoToAudioOperation, {
    extractAudio: [{ type: "extractAudio" }, VideoToAudioOperation.cases.extractAudio.make({})],
  }),
  AudioToTextOperation: fixturesOf(AudioToTextOperation, {
    transcribe: [
      { type: "transcribe", language: "GERMAN", outputFormat: { type: "pttml" }, performanceMode: "MORE_PERFORMANT" },
      AudioToTextOperation.cases.transcribe.make({
        language: O.some("GERMAN"),
        outputFormat: O.some(TranscribeOutputFormat.cases.pttml.make({})),
        performanceMode: O.some("morePerformant"),
      }),
    ],
    waveform: [
      { type: "waveform", peaksPerSecond: 100 },
      AudioToTextOperation.cases.waveform.make({ peaksPerSecond: 100 }),
    ],
  }),
  VideoToArchiveOperation: fixturesOf(VideoToArchiveOperation, {
    extractSceneFrames: [
      { type: "extractSceneFrames", encoding: { type: "webp" }, sceneScore: "LESS_SENSITIVE" },
      VideoToArchiveOperation.cases.extractSceneFrames.make({ encoding: "webp", sceneScore: O.some("lessSensitive") }),
    ],
  }),
  VideoToTextOperation: fixturesOf(VideoToTextOperation, {
    getTimestampsForSceneFrames: [
      { type: "getTimestampsForSceneFrames" },
      VideoToTextOperation.cases.getTimestampsForSceneFrames.make({}),
    ],
  }),
  VideoToImageOperation: fixturesOf(VideoToImageOperation, {
    extractFirstFrame: [
      { type: "extractFirstFrame", height: 720 },
      VideoToImageOperation.cases.extractFirstFrame.make({ height: O.some(720) }),
    ],
    extractFramesAtTimestamps: [
      { type: "extractFramesAtTimestamps", height: 360, width: 640, timestamp: 3.25 },
      VideoToImageOperation.cases.extractFramesAtTimestamps.make({
        height: O.some(360),
        width: O.some(640),
        timestamp: 3.25,
      }),
    ],
  }),
  EmailToTextOperation: fixturesOf(EmailToTextOperation, {
    getEmailBody: [
      { type: "getEmailBody", outputFormat: "TEXT" },
      EmailToTextOperation.cases.getEmailBody.make({ outputFormat: "text" }),
    ],
  }),
  EmailToAttachmentOperation: fixturesOf(EmailToAttachmentOperation, {
    getEmailAttachment: [
      { type: "getEmailAttachment", mimeType: "text/csv", attachmentIndex: 1 },
      EmailToAttachmentOperation.cases.getEmailAttachment.make({
        mimeType: MediaType.make("text/csv"),
        attachmentIndex: 1,
      }),
    ],
  }),
  SpreadsheetToTextOperation: fixturesOf(SpreadsheetToTextOperation, {
    convertSheetToJson: [
      { type: "convertSheetToJson", sheetName: "Sheet1" },
      SpreadsheetToTextOperation.cases.convertSheetToJson.make({ sheetName: "Sheet1" }),
    ],
  }),
  ImageToTextOperation: fixturesOf(ImageToTextOperation, {
    extractLayoutAwareContent: [
      { type: "extractLayoutAwareContent", parameters: { languages: ["ENG", "FRA"] } },
      ImageToTextOperation.cases.extractLayoutAwareContent.make({
        parameters: LayoutAwareExtractionParameters.make({ languages: ["ENG", "FRA"] }),
      }),
    ],
    ocr: [
      {
        type: "ocr",
        parameters: { outputFormat: { type: "hocr" }, languages: [{ type: "script", script: "CYRILLIC" }] },
      },
      ImageToTextOperation.cases.ocr.make({
        parameters: OcrParameters.make({
          outputFormat: "hocr",
          languages: [OcrLanguageOrScript.cases.script.make({ script: "CYRILLIC" })],
        }),
      }),
    ],
    extractLayoutAwareTextV2: [
      { type: "extractLayoutAwareTextV2", format: "MARKDOWN", languages: [] },
      ImageToTextOperation.cases.extractLayoutAwareTextV2.make({ format: O.some("markdown"), languages: [] }),
    ],
    extractTextV2: [
      { type: "extractTextV2", languages: [{ type: "language", language: "JPN_VERT" }] },
      ImageToTextOperation.cases.extractTextV2.make({
        languages: [OcrLanguageOrScript.cases.language.make({ language: "JPN_VERT" })],
      }),
    ],
  }),
  ImageToDocumentOperation: fixturesOf(ImageToDocumentOperation, {
    createPdf: [{ type: "createPdf" }, ImageToDocumentOperation.cases.createPdf.make({})],
  }),
  ImageToEmbeddingOperation: fixturesOf(ImageToEmbeddingOperation, {
    generateEmbedding: [
      { type: "generateEmbedding", modelId: "GOOGLE_SIGLIP_2" },
      ImageToEmbeddingOperation.cases.generateEmbedding.make({ modelId: "googleSiglip2" }),
    ],
  }),
  DicomToImageOperation: fixturesOf(DicomToImageOperation, {
    renderImageLayer: [
      { type: "renderImageLayer", layerNumber: 3, height: 512, width: 512 },
      DicomToImageOperation.cases.renderImageLayer.make({
        layerNumber: O.some(3),
        height: O.some(512),
        width: O.some(512),
      }),
    ],
  }),
  DocumentToDocumentOperation: fixturesOf(DocumentToDocumentOperation, {
    slicePdfRange: [
      { type: "slicePdfRange", startPageInclusive: 2, endPageExclusive: 4 },
      DocumentToDocumentOperation.cases.slicePdfRange.make({ startPageInclusive: 2, endPageExclusive: 4 }),
    ],
    convertDocument: [{ type: "convertDocument" }, DocumentToDocumentOperation.cases.convertDocument.make({})],
  }),
  DocumentToImageOperation: fixturesOf(DocumentToImageOperation, {
    renderPage: [
      { type: "renderPage", pageNumber: 1, height: 792 },
      DocumentToImageOperation.cases.renderPage.make({ pageNumber: O.some(1), height: O.some(792) }),
    ],
    renderPageToFitBoundingBox: [
      { type: "renderPageToFitBoundingBox", width: 300, height: 400 },
      DocumentToImageOperation.cases.renderPageToFitBoundingBox.make({ width: 300, height: 400 }),
    ],
  }),
  DocumentToTextOperation: fixturesOf(DocumentToTextOperation, {
    extractAllText: [{ type: "extractAllText" }, DocumentToTextOperation.cases.extractAllText.make({})],
    extractTableOfContents: [
      { type: "extractTableOfContents" },
      DocumentToTextOperation.cases.extractTableOfContents.make({}),
    ],
    getPdfPageDimensions: [
      { type: "getPdfPageDimensions" },
      DocumentToTextOperation.cases.getPdfPageDimensions.make({}),
    ],
    extractFormFields: [{ type: "extractFormFields" }, DocumentToTextOperation.cases.extractFormFields.make({})],
    extractUnstructuredTextFromPage: [
      { type: "extractUnstructuredTextFromPage", pageNumber: 4 },
      DocumentToTextOperation.cases.extractUnstructuredTextFromPage.make({ pageNumber: 4 }),
    ],
    extractTextFromPagesToArray: [
      { type: "extractTextFromPagesToArray", startPage: 0, endPage: 9 },
      DocumentToTextOperation.cases.extractTextFromPagesToArray.make({ startPage: O.some(0), endPage: O.some(9) }),
    ],
    ocrOnPage: [
      { type: "ocrOnPage", pageNumber: 0, parameters: { outputFormat: { type: "text" }, languages: [] } },
      DocumentToTextOperation.cases.ocrOnPage.make({
        pageNumber: 0,
        parameters: OcrParameters.make({ outputFormat: "text", languages: [] }),
      }),
    ],
    ocrOnPages: [
      {
        type: "ocrOnPages",
        parameters: { outputFormat: { type: "hocr" }, languages: [{ type: "script", script: "HANGUL" }] },
        pageNumber: 5,
      },
      DocumentToTextOperation.cases.ocrOnPages.make({
        parameters: OcrParameters.make({
          outputFormat: "hocr",
          languages: [OcrLanguageOrScript.cases.script.make({ script: "HANGUL" })],
        }),
        pageNumber: 5,
      }),
    ],
    extractLayoutAwareContent: [
      { type: "extractLayoutAwareContent", parameters: { languages: ["SPA"] } },
      DocumentToTextOperation.cases.extractLayoutAwareContent.make({
        parameters: LayoutAwareExtractionParameters.make({ languages: ["SPA"] }),
      }),
    ],
    extractLayoutAwareTextV2: [
      {
        type: "extractLayoutAwareTextV2",
        pageRange: { startPageInclusive: 1 },
        config: { format: "HTML", mode: "ELECTRONIC", languages: [{ type: "language", language: "ENG" }] },
      },
      DocumentToTextOperation.cases.extractLayoutAwareTextV2.make({
        pageRange: O.some(PageRange.make({ startPageInclusive: O.some(1) })),
        config: DocumentTextExtractionConfig.make({
          format: O.some("html"),
          mode: O.some("electronic"),
          languages: [english],
        }),
      }),
    ],
    extractTextV2: [
      { type: "extractTextV2", config: { mode: "SCAN", languages: [] } },
      DocumentToTextOperation.cases.extractTextV2.make({
        config: DocumentTextExtractionConfig.make({ mode: O.some("scan"), languages: [] }),
      }),
    ],
    extractVlmText: [
      {
        type: "extractVlmText",
        llmSpec: {
          type: "chat",
          chat: {
            modelLocator: {
              type: "registeredModelRid",
              registeredModelRid: "ri.language-model-service..language-model.ocr",
            },
            systemPrompt: "Read the page.",
            userPrompt: "Return its text.",
          },
        },
        imageSpec: { resizingMode: "RESIZING", width: 2048, mimeType: "JP2K" },
        outputFormat: "MARKDOWN",
      },
      DocumentToTextOperation.cases.extractVlmText.make({
        llmSpec: LlmSpec.cases.chat.make({
          modelLocator: LanguageModelLocator.cases.registeredModelRid.make({
            registeredModelRid: RegisteredModelRid.make("ri.language-model-service..language-model.ocr"),
          }),
          systemPrompt: "Read the page.",
          userPrompt: "Return its text.",
        }),
        imageSpec: O.some(ImageSpec.make({ resizingMode: "resizing", width: O.some(2048), mimeType: "jp2k" })),
        outputFormat: "markdown",
      }),
    ],
  }),
  AudioChannelLayout: fixturesOf(AudioChannelLayout, {
    numberOfChannels: [
      { type: "numberOfChannels", numberOfChannels: 2 },
      AudioChannelLayout.cases.numberOfChannels.make({ numberOfChannels: 2 }),
    ],
  }),
  AudioEncoding: fixturesOf(AudioEncoding, {
    mp3: [{ type: "mp3" }, AudioEncoding.cases.mp3.make({})],
    wav: [
      { type: "wav", sampleRate: 48000, audioChannelLayout: { type: "numberOfChannels", numberOfChannels: 2 } },
      AudioEncoding.cases.wav.make({
        sampleRate: O.some(48000),
        audioChannelLayout: O.some(AudioChannelLayout.cases.numberOfChannels.make({ numberOfChannels: 2 })),
      }),
    ],
    ts: [{ type: "ts" }, AudioEncoding.cases.ts.make({})],
  }),
  OcrLanguageOrScript: fixturesOf(OcrLanguageOrScript, {
    language: [
      { type: "language", language: "KOR_VERT" },
      OcrLanguageOrScript.cases.language.make({ language: "KOR_VERT" }),
    ],
    script: [
      { type: "script", script: "HAN_TRADITIONAL" },
      OcrLanguageOrScript.cases.script.make({ script: "HAN_TRADITIONAL" }),
    ],
  }),
  TranscribeOutputFormat: fixturesOf(TranscribeOutputFormat, {
    plainTextNoSegmentData: [
      { type: "plainTextNoSegmentData", addTimestamps: false },
      TranscribeOutputFormat.cases.plainTextNoSegmentData.make({ addTimestamps: false }),
    ],
    json: [{ type: "json" }, TranscribeOutputFormat.cases.json.make({})],
    pttml: [{ type: "pttml" }, TranscribeOutputFormat.cases.pttml.make({})],
  }),
  LanguageModelLocator: fixturesOf(LanguageModelLocator, {
    apiName: [
      { type: "apiName", apiName: "vision-small" },
      LanguageModelLocator.cases.apiName.make({ apiName: LanguageModelApiName.make("vision-small") }),
    ],
    registeredModelRid: [
      { type: "registeredModelRid", registeredModelRid: "ri.language-model-service..language-model.custom" },
      LanguageModelLocator.cases.registeredModelRid.make({
        registeredModelRid: RegisteredModelRid.make("ri.language-model-service..language-model.custom"),
      }),
    ],
  }),
  LlmSpec: fixturesOf(LlmSpec, {
    chat: [
      {
        type: "chat",
        chat: {
          modelLocator: { type: "apiName", apiName: "vision-small" },
          systemPrompt: "You read invoices.",
          userPrompt: "List the line items.",
          maxTokens: 2048,
        },
      },
      LlmSpec.cases.chat.make({
        modelLocator: LanguageModelLocator.cases.apiName.make({ apiName: LanguageModelApiName.make("vision-small") }),
        systemPrompt: "You read invoices.",
        userPrompt: "List the line items.",
        maxTokens: O.some(2048),
      }),
    ],
  }),
  VlmPreprocessingConfig: fixturesOf(VlmPreprocessingConfig, {
    layoutAware: [
      {
        type: "layoutAware",
        layoutAware: { transformationConfig: { languages: [] }, cropConfig: { tablePrompt: "Read this table." } },
      },
      VlmPreprocessingConfig.cases.layoutAware.make({
        transformationConfig: DocumentTextExtractionConfig.make({ languages: [] }),
        cropConfig: O.some(CropConfig.make({ tablePrompt: "Read this table." })),
      }),
    ],
    extractText: [
      { type: "extractText", extractText: { format: "TEXT", languages: [{ type: "script", script: "GREEK" }] } },
      VlmPreprocessingConfig.cases.extractText.make({
        format: O.some("text"),
        languages: [OcrLanguageOrScript.cases.script.make({ script: "GREEK" })],
      }),
    ],
  }),
  AnnotateGeometry: fixturesOf(AnnotateGeometry, {
    boundingBox: [
      { type: "boundingBox", boundingBox: { left: 0.5, top: 1.5, width: 99, height: 42 } },
      AnnotateGeometry.cases.boundingBox.make({ left: 0.5, top: 1.5, width: 99, height: 42 }),
    ],
  }),
  ContrastType: fixturesOf(ContrastType, {
    equalize: [{ type: "equalize" }, ContrastType.cases.equalize.make({})],
    rayleigh: [{ type: "rayleigh", sigma: 0.25 }, ContrastType.cases.rayleigh.make({ sigma: 0.25 })],
    binarize: [{ type: "binarize" }, ContrastType.cases.binarize.make({})],
  }),
});

// -----------------------------------------------------------------------------
// Wire fixtures: one per literal of every encoding the wire writes as a tag record
// -----------------------------------------------------------------------------

describe("encodings", () => {
  register([
    encodingFixtures("ImageryEncoding", ImageryEncoding, ImageryEncodingKind.literals, 4),
    encodingFixtures("VideoEncoding", VideoEncoding, VideoEncodingKind.literals, 4),
    encodingFixtures("ArchiveEncoding", ArchiveEncoding, ArchiveEncodingKind.literals, 1),
    encodingFixtures("DocumentEncoding", DocumentEncoding, DocumentEncodingKind.literals, 1),
    encodingFixtures("OcrOutputFormat", OcrOutputFormat, OcrOutputFormatKind.literals, 2),
  ]);
});
