import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { MediaType, SizeBytes } from "../src/Attachment/Attachment.model.ts";
import {
  AffineTransform,
  AnnotateGeometry,
  Annotation,
  ArchiveEncodingKind,
  AudioChannelLayout,
  AudioDecodeFormat,
  AudioEncoding,
  AudioEncodingKind,
  AudioOperation,
  AudioToTextOperation,
  BandDataType,
  BandInfo,
  CadDecodeFormat,
  CadMetadata,
  CadUnits,
  CipherLicenseRid,
  Color,
  ColorInterpretation,
  CommonDicomDataElements,
  ContrastType,
  CoordinateReferenceSystem,
  CropConfig,
  DefaultPollInterval,
  DefaultPollTimeout,
  DicomMediaType,
  DicomMetadata,
  DicomMetaInformation,
  DicomToImageOperation,
  Dimensions,
  DocumentDecodeFormat,
  DocumentEncodingKind,
  DocumentTextExtractionConfig,
  DocumentToDocumentOperation,
  DocumentToImageOperation,
  DocumentToTextOperation,
  EmailAttachment,
  EmailBodyFormat,
  EmailDecodeFormat,
  EmailMetadata,
  EmailRecipient,
  EmailToAttachmentOperation,
  EmailToTextOperation,
  EmbeddingModelId,
  FlipAxis,
  GeoMetadata,
  GpsMetadata,
  GroundControlPoint,
  GroundControlPoints,
  ImageOperation,
  ImagePixelCoordinate,
  ImageryDecodeFormat,
  ImageryEncoding,
  ImageryEncodingKind,
  ImageryMetadata,
  ImageSpec,
  ImageToDocumentOperation,
  ImageToEmbeddingOperation,
  ImageToTextOperation,
  LanguageModelApiName,
  LanguageModelLocator,
  LlmSpec,
  Mailbox,
  MediaItemMetadata,
  MediaItemMetadataKind,
  MediaTransformation,
  MediaTransformationKind,
  MinimumPollInterval,
  MinimumPollTimeout,
  Modality,
  Model3dDecodeFormat,
  Model3dType,
  OcrLanguage,
  OcrLanguageOrScript,
  OcrMode,
  OcrOutputFormatKind,
  OcrParameters,
  OcrScript,
  Orientation,
  PageRange,
  PaletteInterpretation,
  PerformanceMode,
  RegisteredModelRid,
  ResizeImageOperation,
  ResizingMode,
  RotationAngle,
  SceneScore,
  SpreadsheetDecodeFormat,
  SpreadsheetToTextOperation,
  TextOutputFormat,
  TranscribeOperation,
  TranscribeOutputFormat,
  TranscriptionLanguage,
  TransformationJob,
  TransformationJobId,
  TransformationJobStatus,
  TransformMediaItemRequest,
  UnitInterpretation,
  UntypedMetadata,
  VideoDecodeFormat,
  VideoEncodingKind,
  VideoOperation,
  VideoToArchiveOperation,
  VideoToAudioOperation,
  VideoToImageOperation,
  VideoToTextOperation,
  VlmOutputFormat,
  VlmPreprocessingConfig,
} from "../src/Media/index.ts";
import * as MediaModel from "../src/Media/Media.model.ts";
import * as MetadataModel from "../src/Media/MediaMetadata.model.ts";
import * as TransformationModel from "../src/Media/MediaTransformation.model.ts";
import * as TransformationValues from "../src/Media/MediaTransformation.values.ts";

// -----------------------------------------------------------------------------
// Law and fixture helpers
// -----------------------------------------------------------------------------

// The generation and round-trip laws of every named schema are registered from the schema tables in
// `MediaOperations.test.ts` (transformations, operations and their literal domains) and `MediaMetadata.test.ts`
// (metadata): each table is compared with its module's exports when the suite runs, so no schema is skipped.

/** Registers the case laws of a tagged union: its tags are exactly the wire's, and each value passes one guard. */
const casesOf =
  <T extends { readonly type: string }, I>(
    name: string,
    union: S.Codec<T, I> & {
      readonly cases: { readonly [tag: string]: unknown };
      readonly guards: { readonly [tag: string]: (value: unknown) => boolean };
    },
    tags: ReadonlyArray<string>
  ) =>
  () =>
    describe(`${name} cases`, () => {
      it("are exactly the wire's tags, in declaration order", () => {
        deepStrictEqual(R.keys(union.cases), A.fromIterable(tags));
        deepStrictEqual(R.keys(union.guards), A.fromIterable(tags));
      });
      it.prop(
        "every generated value passes the guard of its own tag and no other",
        [Arbitrary.schema(union)],
        ([value]) =>
          A.every(tags, (tag) =>
            pipe(
              R.get(union.guards, tag),
              O.exists((guard) => guard(value) === (tag === value.type))
            )
          ),
        { arbitrary: fcRuns(25) }
      );
    });

/** Decodes an exact wire value to the expected domain value and encodes it back to the same wire value. */
const wireFixture = <T, I>(name: string, schema: S.Codec<T, I>, wire: NoInfer<I>, expected: NoInfer<T>) =>
  it.effect(
    name,
    Effect.fnUntraced(function* () {
      const decoded = yield* S.decodeEffect(schema)(wire);
      deepStrictEqual(decoded, expected);
      assertTrue(S.toEquivalence(schema)(decoded, expected));
      const encoded = yield* S.encodeEffect(schema)(decoded);
      deepStrictEqual(encoded, wire);
    })
  );

/** One row of the literal-domain table: the kit itself, and the law it registers once it is given its name. */
interface Counted {
  readonly kit: unknown;
  readonly law: (name: string) => void;
}

/** The literals of a domain as the maps print them: upper-case or lower-case words separated by spaces. */
const words = (...lines: ReadonlyArray<string>): ReadonlyArray<string> => A.flatMap(lines, Str.split(" "));

/**
 * Binds a mapped literal domain to its table law: its wire literals are exactly the expected ones, in order, and
 * every wire literal decodes to a lower-camel domain literal and back.
 */
const mappedDomain = <T extends string, I extends string>(
  kit: S.Codec<T, I> & { readonly Pairs: ReadonlyArray<readonly [I, T]> },
  expected: ReadonlyArray<string>
): Counted => ({
  kit,
  law: (name) =>
    it.effect(
      `${name} maps each of its ${A.length(expected)} upper-case wire literals to a lower-camel literal and back`,
      Effect.fnUntraced(function* () {
        const wireLiterals = A.map(kit.Pairs, ([wire]) => wire);
        const domainLiterals = A.map(kit.Pairs, ([, domain]) => domain);
        deepStrictEqual<ReadonlyArray<string>>(wireLiterals, expected);
        strictEqual(A.length(A.dedupe(domainLiterals)), A.length(expected));
        assertTrue(A.every(wireLiterals, isUpperSnake));
        assertTrue(A.every(domainLiterals, isLowerCamel));
        const decoded = yield* Effect.forEach(wireLiterals, (wire) => S.decodeEffect(kit)(wire));
        deepStrictEqual(decoded, domainLiterals);
        const encoded = yield* Effect.forEach(domainLiterals, (domain) => S.encodeEffect(kit)(domain));
        deepStrictEqual(encoded, wireLiterals);
      })
    ),
});

/** Binds a plain literal domain to its list law: exactly the expected literals, in order, none repeated. */
const plainDomain = (kit: { readonly literals: ReadonlyArray<string> }, expected: ReadonlyArray<string>): Counted => ({
  kit,
  law: (name) =>
    it(`${name} holds exactly its ${A.length(expected)} distinct literals`, () => {
      deepStrictEqual(kit.literals, expected);
      strictEqual(A.length(A.dedupe(kit.literals)), A.length(expected));
    }),
});

const isUpperSnake = S.is(S.String.check(S.isPattern(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/)));
const isLowerCamel = S.is(S.String.check(S.isPattern(/^[a-z][A-Za-z0-9]*$/)));

const rejects = <T, I>(schema: S.Codec<T, I>, input: unknown) =>
  assertTrue(pipe(S.decodeUnknownResult(schema)(input), Result.isFailure));

const register = (registrations: ReadonlyArray<() => void>) => A.forEach(registrations, (run) => run());

// -----------------------------------------------------------------------------
// Union cases
// -----------------------------------------------------------------------------

const transformationTags = [
  "image",
  "video",
  "audio",
  "emailToText",
  "spreadsheetToText",
  "videoToAudio",
  "audioToText",
  "emailToAttachment",
  "videoToArchive",
  "videoToText",
  "imageToText",
  "videoToImage",
  "imageToDocument",
  "dicomToImage",
  "documentToDocument",
  "documentToImage",
  "imageToEmbedding",
  "documentToText",
];

const imageOperationTags = [
  "resize",
  "resizeToFitBoundingBox",
  "rotate",
  "crop",
  "grayscale",
  "tile",
  "annotate",
  "contrast",
  "encrypt",
  "decrypt",
];

const documentToTextOperationTags = [
  "extractAllText",
  "extractTableOfContents",
  "getPdfPageDimensions",
  "extractFormFields",
  "extractUnstructuredTextFromPage",
  "extractTextFromPagesToArray",
  "ocrOnPage",
  "ocrOnPages",
  "extractLayoutAwareContent",
  "extractLayoutAwareTextV2",
  "extractTextV2",
  "extractVlmText",
];

const metadataTags = [
  "document",
  "imagery",
  "audio",
  "video",
  "dicom",
  "email",
  "model3d",
  "spreadsheet",
  "untyped",
  "cad",
];

describe("tagged unions", () => {
  register([
    casesOf("MediaTransformation", MediaTransformation, transformationTags),
    casesOf("ImageOperation", ImageOperation, imageOperationTags),
    casesOf("VideoOperation", VideoOperation, ["transcode", "chunk"]),
    casesOf("AudioOperation", AudioOperation, ["channel", "chunk", "convert"]),
    casesOf("VideoToAudioOperation", VideoToAudioOperation, ["extractAudio"]),
    casesOf("AudioToTextOperation", AudioToTextOperation, ["transcribe", "waveform"]),
    casesOf("EmailToTextOperation", EmailToTextOperation, ["getEmailBody"]),
    casesOf("EmailToAttachmentOperation", EmailToAttachmentOperation, ["getEmailAttachment"]),
    casesOf("SpreadsheetToTextOperation", SpreadsheetToTextOperation, ["convertSheetToJson"]),
    casesOf("VideoToArchiveOperation", VideoToArchiveOperation, ["extractSceneFrames"]),
    casesOf("VideoToTextOperation", VideoToTextOperation, ["getTimestampsForSceneFrames"]),
    casesOf("ImageToTextOperation", ImageToTextOperation, [
      "extractLayoutAwareContent",
      "ocr",
      "extractLayoutAwareTextV2",
      "extractTextV2",
    ]),
    casesOf("VideoToImageOperation", VideoToImageOperation, ["extractFirstFrame", "extractFramesAtTimestamps"]),
    casesOf("ImageToDocumentOperation", ImageToDocumentOperation, ["createPdf"]),
    casesOf("DicomToImageOperation", DicomToImageOperation, ["renderImageLayer"]),
    casesOf("DocumentToDocumentOperation", DocumentToDocumentOperation, ["slicePdfRange", "convertDocument"]),
    casesOf("DocumentToImageOperation", DocumentToImageOperation, ["renderPage", "renderPageToFitBoundingBox"]),
    casesOf("ImageToEmbeddingOperation", ImageToEmbeddingOperation, ["generateEmbedding"]),
    casesOf("DocumentToTextOperation", DocumentToTextOperation, documentToTextOperationTags),
    casesOf("AudioEncoding", AudioEncoding, ["mp3", "wav", "ts"]),
    casesOf("AudioChannelLayout", AudioChannelLayout, ["numberOfChannels"]),
    casesOf("OcrLanguageOrScript", OcrLanguageOrScript, ["language", "script"]),
    casesOf("TranscribeOutputFormat", TranscribeOutputFormat, ["plainTextNoSegmentData", "json", "pttml"]),
    casesOf("LanguageModelLocator", LanguageModelLocator, ["apiName", "registeredModelRid"]),
    casesOf("LlmSpec", LlmSpec, ["chat"]),
    casesOf("VlmPreprocessingConfig", VlmPreprocessingConfig, ["layoutAware", "extractText"]),
    casesOf("AnnotateGeometry", AnnotateGeometry, ["boundingBox"]),
    casesOf("ContrastType", ContrastType, ["equalize", "rayleigh", "binarize"]),
    casesOf("MediaItemMetadata", MediaItemMetadata, metadataTags),
    casesOf("DicomMetaInformation", DicomMetaInformation, ["v1"]),
    casesOf("EmailRecipient", EmailRecipient, ["mailbox", "group"]),
  ]);

  it("the kits that anchor the two top-level unions list the same tags as the unions", () => {
    deepStrictEqual(A.fromIterable(MediaTransformationKind.literals), transformationTags);
    deepStrictEqual(A.fromIterable(MediaItemMetadataKind.literals), metadataTags);
  });

  it("the eighteen operation unions hold 48 operations between them", () => {
    const operationUnions: ReadonlyArray<{ readonly [tag: string]: unknown }> = [
      ImageOperation.cases,
      VideoOperation.cases,
      AudioOperation.cases,
      VideoToAudioOperation.cases,
      AudioToTextOperation.cases,
      EmailToTextOperation.cases,
      EmailToAttachmentOperation.cases,
      SpreadsheetToTextOperation.cases,
      VideoToArchiveOperation.cases,
      VideoToTextOperation.cases,
      ImageToTextOperation.cases,
      VideoToImageOperation.cases,
      ImageToDocumentOperation.cases,
      DicomToImageOperation.cases,
      DocumentToDocumentOperation.cases,
      DocumentToImageOperation.cases,
      ImageToEmbeddingOperation.cases,
      DocumentToTextOperation.cases,
    ];
    strictEqual(A.length(operationUnions), 18);
    strictEqual(N.sumAll(A.map(operationUnions, (cases) => A.length(R.keys(cases)))), 48);
  });

  it.prop(
    "an exhaustive match tells the transformations that write media from the rest",
    [Arbitrary.schema(MediaTransformation)],
    ([transformation]) => {
      const writtenFormat = MediaTransformation.match(transformation, {
        image: ({ encoding }) => O.some<string>(encoding),
        video: ({ encoding }) => O.some<string>(encoding),
        audio: () => O.none<string>(),
        emailToText: () => O.none<string>(),
        spreadsheetToText: () => O.none<string>(),
        videoToAudio: ({ encoding }) => O.some<string>(encoding.type),
        audioToText: () => O.none<string>(),
        emailToAttachment: () => O.none<string>(),
        videoToArchive: ({ encoding }) => O.some<string>(encoding),
        videoToText: () => O.none<string>(),
        imageToText: () => O.none<string>(),
        videoToImage: ({ encoding }) => O.some<string>(encoding),
        imageToDocument: () => O.none<string>(),
        dicomToImage: ({ encoding }) => O.some<string>(encoding),
        documentToDocument: ({ encoding }) => O.some<string>(encoding),
        documentToImage: ({ encoding }) => O.some<string>(encoding),
        imageToEmbedding: () => O.none<string>(),
        documentToText: () => O.none<string>(),
      });
      const carriesEncoding = MediaTransformation.isAnyOf([
        "image",
        "video",
        "videoToAudio",
        "videoToArchive",
        "videoToImage",
        "dicomToImage",
        "documentToDocument",
        "documentToImage",
      ]);
      return O.isSome(writtenFormat) === carriesEncoding(transformation);
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "an exhaustive match reads the exact size of every kind of media item",
    [Arbitrary.schema(MediaItemMetadata)],
    ([metadata]) =>
      MediaItemMetadata.match(metadata, {
        document: ({ sizeBytesLong }) => sizeBytesLong,
        imagery: ({ sizeBytesLong }) => sizeBytesLong,
        audio: ({ sizeBytesLong }) => sizeBytesLong,
        video: ({ sizeBytesLong }) => sizeBytesLong,
        dicom: ({ sizeBytesLong }) => sizeBytesLong,
        email: ({ sizeBytesLong }) => sizeBytesLong,
        model3d: ({ sizeBytesLong }) => sizeBytesLong,
        spreadsheet: ({ sizeBytesLong }) => sizeBytesLong,
        untyped: ({ sizeBytesLong }) => sizeBytesLong,
        cad: ({ sizeBytesLong }) => sizeBytesLong,
      }) === metadata.sizeBytesLong,
    { arbitrary: fcRuns(50) }
  );
});

// -----------------------------------------------------------------------------
// Literal domains
// -----------------------------------------------------------------------------

const ocrLanguages = words(
  "AFR AMH ARA ASM AZE AZE_CYRL BEL BEN BOD BOS BRE BUL CAT CEB CES CHI_SIM CHI_SIM_VERT CHI_TRA CHI_TRA_VERT",
  "CHR COS CYM DAN DEU DIV DZO ELL ENG ENM EPO EST EUS FAO FAS FIL FIN FRA FRM FRY GLA GLE GLG GRC GUJ HAT HEB",
  "HIN HRV HUN HYE IKU IND ISL ITA ITA_OLD JAV JPN JPN_VERT KAN KAT KAT_OLD KAZ KHM KIR KMR KOR KOR_VERT LAO",
  "LAT LAV LIT LTZ MAL MAR MKD MLT MON MRI MSA MYA NEP NLD NOR OCI ORI OSD PAN POL POR PUS QUE RON RUS SAN SIN",
  "SLK SLV SND SPA SPA_OLD SQI SRP SRP_LATN SUN SWA SWE SYR TAM TAT TEL TGK THA TIR TON TUR UIG UKR URD UZB",
  "UZB_CYRL VIE YID YOR"
);

const ocrScripts = words(
  "ARABIC ARMENIAN BENGALI CANADIAN_ABORIGINAL CHEROKEE CYRILLIC DEVANAGARI ETHIOPIC FRAKTUR GEORGIAN GREEK",
  "GUJARATI GURMUKHI HAN_SIMPLIFIED HAN_SIMPLIFIED_VERT HAN_TRADITIONAL HAN_TRADITIONAL_VERT HANGUL HANGUL_VERT",
  "HEBREW JAPANESE JAPANESE_VERT KANNADA KHMER LAO LATIN MALAYALAM MYANMAR ORIYA SINHALA SYRIAC TAMIL TELUGU",
  "THAANA THAI TIBETAN VIETNAMESE"
);

const transcriptionCodes = words(
  "AF AM AR AS AZ BA BE BG BN BO BR BS CA CS CY DA DE EL EN ES ET EU FA FI FO FR GL GU HA HAW HE HI HR HT HU HY",
  "ID IS IT JA JW KA KK KM KN KO LA LB LN LO LT LV MG MI MK ML MN MR MS MT MY NE NL NN NO OC PA PL PS PT RO RU",
  "SA SD SI SK SL SN SO SQ SR SU SV SW TA TE TG TH TK TL TR TT UK UR UZ VI YI YO YUE ZH"
);

const transcriptionNames = words(
  "AFRIKAANS ALBANIAN AMHARIC ARABIC ARMENIAN ASSAMESE AZERBAIJANI BASHKIR BASQUE BELARUSIAN BENGALI BOSNIAN",
  "BRETON BULGARIAN BURMESE CANTONESE CASTILIAN CATALAN CHINESE CROATIAN CZECH DANISH DUTCH ENGLISH ESTONIAN",
  "FAROESE FINNISH FLEMISH FRENCH GALICIAN GEORGIAN GERMAN GREEK GUJARATI HAITIAN HAITIAN_CREOLE HAUSA HAWAIIAN",
  "HEBREW HINDI HUNGARIAN ICELANDIC INDONESIAN ITALIAN JAPANESE JAVANESE KANNADA KAZAKH KHMER KOREAN LAO LATIN",
  "LATVIAN LETZEBURGESCH LINGALA LITHUANIAN LUXEMBOURGISH MACEDONIAN MALAGASY MALAY MALAYALAM MALTESE MANDARIN",
  "MAORI MARATHI MOLDAVIAN MOLDOVAN MONGOLIAN MYANMAR NEPALI NORWEGIAN NYNORSK OCCITAN PANJABI PASHTO PERSIAN",
  "POLISH PORTUGUESE PUNJABI PUSHTO ROMANIAN RUSSIAN SANSKRIT SERBIAN SHONA SINDHI SINHALA SINHALESE SLOVAK",
  "SLOVENIAN SOMALI SPANISH SUNDANESE SWAHILI SWEDISH TAGALOG TAJIK TAMIL TATAR TELUGU THAI TIBETAN TURKISH",
  "TURKMEN UKRAINIAN URDU UZBEK VALENCIAN VIETNAMESE WELSH YIDDISH YORUBA"
);

const modalities = words(
  "AR ASMT AU BDUS BI BMD CR CT CTPROTOCOL DG DOC DX ECG EPS ES FID GM HC HD IO IOL IVOCT IVUS KER KO LEN LS MG",
  "MR M3D NM OAM OCT OP OPM OPT OPTBSV OPTENF OPV OSS OT PLAN PR PT PX REG RESP RF RG RTDOSE RTIMAGE RTINTENT",
  "RTPLAN RTRAD RTRECORD RTSEGANN RTSTRUCT RWV SEG SM SMR SR SRF STAIN TEXTUREMAP TG US VA XA XC AS CD CF CP CS",
  "DD DF DM DS EC FA FS LP MA MS OPR ST VF"
);
// Every literal domain of the media modules, with the literals the maps list for it. Where the wire (2.87.0) and
// the generated client's copy disagree the wire wins: it reads WEBM video and CSV spreadsheets, knows CAD files and
// an unknown rotation, and narrows the vision-model output format and the embedding model to one literal each.
const literalDomains: { readonly [name: string]: Counted } = {
  MediaTransformationKind: plainDomain(MediaTransformationKind, transformationTags),
  ImageryEncodingKind: plainDomain(ImageryEncodingKind, words("jpg png tiff webp")),
  VideoEncodingKind: plainDomain(VideoEncodingKind, words("mp4 mov mkv ts")),
  AudioEncodingKind: plainDomain(AudioEncodingKind, words("mp3 wav ts")),
  ArchiveEncodingKind: plainDomain(ArchiveEncodingKind, words("tar")),
  DocumentEncodingKind: plainDomain(DocumentEncodingKind, words("pdf")),
  OcrOutputFormatKind: plainDomain(OcrOutputFormatKind, words("hocr text")),
  OcrLanguage: plainDomain(OcrLanguage, ocrLanguages),
  OcrScript: plainDomain(OcrScript, ocrScripts),
  TranscriptionLanguage: plainDomain(TranscriptionLanguage, A.appendAll(transcriptionCodes, transcriptionNames)),
  MediaItemMetadataKind: plainDomain(MediaItemMetadataKind, metadataTags),
  Modality: plainDomain(Modality, modalities),
  PerformanceMode: mappedDomain(PerformanceMode, words("MORE_ECONOMICAL MORE_PERFORMANT")),
  SceneScore: mappedDomain(SceneScore, words("MORE_SENSITIVE STANDARD LESS_SENSITIVE")),
  EmailBodyFormat: mappedDomain(EmailBodyFormat, words("TEXT HTML")),
  TextOutputFormat: mappedDomain(TextOutputFormat, words("TEXT MARKDOWN HTML")),
  OcrMode: mappedDomain(OcrMode, words("AUTO ELECTRONIC SCAN")),
  ResizingMode: mappedDomain(ResizingMode, words("RESIZING FIT_INTO_BOUNDING_BOX")),
  VlmOutputFormat: mappedDomain(VlmOutputFormat, words("MARKDOWN")),
  EmbeddingModelId: mappedDomain(EmbeddingModelId, words("GOOGLE_SIGLIP_2")),
  TransformationJobStatus: mappedDomain(TransformationJobStatus, words("PENDING FAILED SUCCESSFUL")),
  AudioDecodeFormat: mappedDomain(AudioDecodeFormat, words("FLAC MP2 MP3 MP4 NIST_SPHERE OGG WAV WEBM")),
  VideoDecodeFormat: mappedDomain(VideoDecodeFormat, words("MP4 MKV MOV TS WEBM")),
  DocumentDecodeFormat: mappedDomain(DocumentDecodeFormat, words("PDF DOC DOCX TXT PPTX RTF")),
  SpreadsheetDecodeFormat: mappedDomain(SpreadsheetDecodeFormat, words("CSV XLSX")),
  ImageryDecodeFormat: mappedDomain(ImageryDecodeFormat, words("BMP TIFF NITF JP2K JPG PNG WEBP")),
  EmailDecodeFormat: mappedDomain(EmailDecodeFormat, words("EML")),
  CadDecodeFormat: mappedDomain(CadDecodeFormat, words("STEP")),
  DicomMediaType: mappedDomain(DicomMediaType, words("IMAGE MULTI_FRAME_IMAGE VIDEO STRUCTURED_REPORT")),
  Model3dDecodeFormat: mappedDomain(Model3dDecodeFormat, words("LAS PLY OBJ")),
  Model3dType: mappedDomain(Model3dType, words("POINT_CLOUD MESH")),
  BandDataType: mappedDomain(
    BandDataType,
    words(
      "UNDEFINED BYTE UINT16 INT16 UINT32 INT32 FLOAT32 FLOAT64",
      "COMPLEX_INT16 COMPLEX_INT32 COMPLEX_FLOAT32 COMPLEX_FLOAT64 UINT64 INT64 INT8"
    )
  ),
  ColorInterpretation: mappedDomain(
    ColorInterpretation,
    words(
      "UNDEFINED GRAY PALETTE_INDEX RED GREEN BLUE ALPHA HUE SATURATION LIGHTNESS CYAN MAGENTA YELLOW BLACK",
      "Y_CB_CR_SPACE_Y Y_CB_CR_SPACE_CB Y_CB_CR_SPACE_CR"
    )
  ),
  PaletteInterpretation: mappedDomain(PaletteInterpretation, words("GRAY RGB RGBA CMYK HLS")),
  RotationAngle: mappedDomain(RotationAngle, words("DEGREE_90 DEGREE_180 DEGREE_270 UNKNOWN")),
  FlipAxis: mappedDomain(FlipAxis, words("HORIZONTAL VERTICAL UNKNOWN")),
};

const isLiteralDomain = (value: unknown): boolean =>
  S.isSchema(value) && (P.hasProperty(value, "literals") || P.hasProperty(value, "Pairs"));

describe("literal domains", () => {
  it("the table lists each of the 36 literal domains the media modules export, under its own name", () => {
    const exported = R.filter(
      { ...MediaModel, ...MetadataModel, ...TransformationModel, ...TransformationValues },
      isLiteralDomain
    );
    deepStrictEqual(A.difference(R.keys(exported), R.keys(literalDomains)), []);
    deepStrictEqual(A.difference(R.keys(literalDomains), R.keys(exported)), []);
    deepStrictEqual(
      R.keys(R.filter(literalDomains, ({ kit }, name) => !O.exists(R.get(exported, name), (value) => value === kit))),
      []
    );
    strictEqual(R.size(literalDomains), 36);
  });

  A.forEach(R.toEntries(literalDomains), ([name, row]) => row.law(name));

  it("every language, script and modality literal is an upper-case code", () => {
    assertTrue(A.every(OcrLanguage.literals, isUpperSnake));
    assertTrue(A.every(OcrScript.literals, isUpperSnake));
    assertTrue(A.every(TranscriptionLanguage.literals, isUpperSnake));
    assertTrue(A.every(Modality.literals, isUpperSnake));
  });

  it("the transcription languages are 100 codes followed by 112 names", () => {
    const [codes, names] = A.splitAt(TranscriptionLanguage.literals, 100);
    strictEqual(A.length(names), 112);
    assertSome(A.head(codes), "AF");
    assertSome(A.last(codes), "ZH");
    assertSome(A.head(names), "AFRIKAANS");
    assertSome(A.last(names), "YORUBA");
  });

  it("the language domains start and end where the wire's do", () => {
    assertSome(A.head(OcrLanguage.literals), "AFR");
    assertSome(A.last(OcrLanguage.literals), "YOR");
    assertSome(A.head(OcrScript.literals), "ARABIC");
    assertSome(A.last(OcrScript.literals), "VIETNAMESE");
    assertSome(A.head(Modality.literals), "AR");
    assertSome(A.last(Modality.literals), "VF");
  });

  it("a script name shared with the transcription languages belongs to both domains", () => {
    assertTrue(OcrScript.is.ARABIC("ARABIC"));
    assertTrue(TranscriptionLanguage.is.ARABIC("ARABIC"));
    assertFalse(S.is(OcrLanguage)("ARABIC"));
  });

  it("the image formats a transformation writes are a subset of the formats the platform reads", () => {
    const readable = A.map(ImageryDecodeFormat.Pairs, ([, domain]): string => domain);
    assertTrue(A.every(ImageryEncodingKind.literals, (format) => A.contains(readable, format)));
    assertFalse(A.contains(A.fromIterable<string>(ImageryEncodingKind.literals), "bmp"));
  });
});

// -----------------------------------------------------------------------------
// Wire fixtures: transformations
// -----------------------------------------------------------------------------

const english = OcrLanguageOrScript.cases.language.make({ language: "ENG" });
const latin = OcrLanguageOrScript.cases.script.make({ script: "LATIN" });

describe("transformation wire fixtures", () => {
  wireFixture(
    "an image transformation applies its steps in order",
    MediaTransformation,
    {
      type: "image",
      encoding: { type: "png" },
      operations: [
        { type: "resize", width: 800, autoOrient: true },
        { type: "rotate", angle: "DEGREE_90" },
        {
          type: "annotate",
          annotations: [
            {
              geometry: { type: "boundingBox", boundingBox: { left: 10, top: 20, width: 300, height: 120 } },
              label: "invoice total",
              color: { r: 255, g: 0, b: 0, a: 0.5 },
              thickness: 2,
            },
          ],
        },
        { type: "contrast", contrastType: { type: "rayleigh", sigma: 0.4 } },
        {
          type: "encrypt",
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 40, y: 0 },
              { x: 0, y: 30 },
            ],
          ],
          cipherLicenseRid: "ri.cipher.main.license.6c1c9d2e",
        },
        { type: "grayscale" },
      ],
    },
    MediaTransformation.cases.image.make({
      encoding: "png",
      operations: [
        ImageOperation.cases.resize.make({ width: O.some(800), autoOrient: O.some(true) }),
        ImageOperation.cases.rotate.make({ angle: "degree90" }),
        ImageOperation.cases.annotate.make({
          annotations: [
            Annotation.make({
              geometry: AnnotateGeometry.cases.boundingBox.make({ left: 10, top: 20, width: 300, height: 120 }),
              label: O.some("invoice total"),
              color: O.some(Color.make({ r: 255, g: 0, b: 0, a: O.some(0.5) })),
              thickness: O.some(2),
            }),
          ],
        }),
        ImageOperation.cases.contrast.make({ contrastType: ContrastType.cases.rayleigh.make({ sigma: 0.4 }) }),
        ImageOperation.cases.encrypt.make({
          polygons: [
            [
              ImagePixelCoordinate.make({ x: 0, y: 0 }),
              ImagePixelCoordinate.make({ x: 40, y: 0 }),
              ImagePixelCoordinate.make({ x: 0, y: 30 }),
            ],
          ],
          cipherLicenseRid: CipherLicenseRid.make("ri.cipher.main.license.6c1c9d2e"),
        }),
        ImageOperation.cases.grayscale.make({}),
      ],
    })
  );

  wireFixture(
    "a video-to-audio transformation writes WAV with its settings beside the tag",
    MediaTransformation,
    {
      type: "videoToAudio",
      encoding: {
        type: "wav",
        sampleRate: 16000,
        audioChannelLayout: { type: "numberOfChannels", numberOfChannels: 1 },
      },
      operation: { type: "extractAudio" },
    },
    MediaTransformation.cases.videoToAudio.make({
      encoding: AudioEncoding.cases.wav.make({
        sampleRate: O.some(16000),
        audioChannelLayout: O.some(AudioChannelLayout.cases.numberOfChannels.make({ numberOfChannels: 1 })),
      }),
      operation: VideoToAudioOperation.cases.extractAudio.make({}),
    })
  );

  wireFixture(
    "an audio-to-text transformation transcribes with every setting given",
    MediaTransformation,
    {
      type: "audioToText",
      operation: {
        type: "transcribe",
        language: "FR",
        diarize: true,
        outputFormat: { type: "plainTextNoSegmentData", addTimestamps: true },
        performanceMode: "MORE_ECONOMICAL",
      },
    },
    MediaTransformation.cases.audioToText.make({
      operation: AudioToTextOperation.cases.transcribe.make({
        language: O.some("FR"),
        diarize: O.some(true),
        outputFormat: O.some(TranscribeOutputFormat.cases.plainTextNoSegmentData.make({ addTimestamps: true })),
        performanceMode: O.some("moreEconomical"),
      }),
    })
  );

  wireFixture(
    "a video-to-archive transformation names the archive format and the format of each frame",
    MediaTransformation,
    {
      type: "videoToArchive",
      encoding: { type: "tar" },
      operation: { type: "extractSceneFrames", encoding: { type: "jpg" }, sceneScore: "MORE_SENSITIVE" },
    },
    MediaTransformation.cases.videoToArchive.make({
      encoding: "tar",
      operation: VideoToArchiveOperation.cases.extractSceneFrames.make({
        encoding: "jpg",
        sceneScore: O.some("moreSensitive"),
      }),
    })
  );

  wireFixture(
    "a vision-model extraction flattens the chat and preprocessing wrappers",
    MediaTransformation,
    {
      type: "documentToText",
      operation: {
        type: "extractVlmText",
        llmSpec: {
          type: "chat",
          chat: {
            modelLocator: { type: "apiName", apiName: "vision-large" },
            systemPrompt: "You transcribe scanned pages.",
            userPrompt: "Transcribe this page.",
            maxTokens: 4096,
          },
        },
        preprocessingConfiguration: {
          type: "layoutAware",
          layoutAware: {
            transformationConfig: {
              format: "MARKDOWN",
              mode: "AUTO",
              languages: [
                { type: "language", language: "ENG" },
                { type: "script", script: "LATIN" },
              ],
            },
            cropConfig: { tablePrompt: "Transcribe this table." },
          },
        },
        imageSpec: { resizingMode: "FIT_INTO_BOUNDING_BOX", height: 1024, width: 1024, mimeType: "PNG" },
        outputFormat: "MARKDOWN",
        pageRange: { startPageInclusive: 0, endPageExclusive: 5 },
      },
    },
    MediaTransformation.cases.documentToText.make({
      operation: DocumentToTextOperation.cases.extractVlmText.make({
        llmSpec: LlmSpec.cases.chat.make({
          modelLocator: LanguageModelLocator.cases.apiName.make({
            apiName: LanguageModelApiName.make("vision-large"),
          }),
          systemPrompt: "You transcribe scanned pages.",
          userPrompt: "Transcribe this page.",
          maxTokens: O.some(4096),
        }),
        preprocessingConfiguration: O.some(
          VlmPreprocessingConfig.cases.layoutAware.make({
            transformationConfig: DocumentTextExtractionConfig.make({
              format: O.some("markdown"),
              mode: O.some("auto"),
              languages: [english, latin],
            }),
            cropConfig: O.some(CropConfig.make({ tablePrompt: "Transcribe this table." })),
          })
        ),
        imageSpec: O.some(
          ImageSpec.make({
            resizingMode: "fitIntoBoundingBox",
            height: O.some(1024),
            width: O.some(1024),
            mimeType: "png",
          })
        ),
        outputFormat: "markdown",
        pageRange: O.some(PageRange.make({ startPageInclusive: O.some(0), endPageExclusive: O.some(5) })),
      }),
    })
  );

  wireFixture(
    "a text-extraction preprocessing step flattens its settings beside the tag",
    VlmPreprocessingConfig,
    { type: "extractText", extractText: { mode: "SCAN", languages: [{ type: "language", language: "ENG" }] } },
    VlmPreprocessingConfig.cases.extractText.make({ mode: O.some("scan"), languages: [english] })
  );

  wireFixture(
    "a registered model is located by its resource identifier",
    LanguageModelLocator,
    { type: "registeredModelRid", registeredModelRid: "ri.language-model-service..language-model.custom" },
    LanguageModelLocator.cases.registeredModelRid.make({
      registeredModelRid: RegisteredModelRid.make("ri.language-model-service..language-model.custom"),
    })
  );

  wireFixture(
    "recognising one page of a document decodes the output format record to its name",
    MediaTransformation,
    {
      type: "documentToText",
      operation: {
        type: "ocrOnPage",
        pageNumber: 3,
        parameters: { outputFormat: { type: "hocr" }, languages: [{ type: "language", language: "CHI_SIM_VERT" }] },
      },
    },
    MediaTransformation.cases.documentToText.make({
      operation: DocumentToTextOperation.cases.ocrOnPage.make({
        pageNumber: 3,
        parameters: OcrParameters.make({
          outputFormat: "hocr",
          languages: [OcrLanguageOrScript.cases.language.make({ language: "CHI_SIM_VERT" })],
        }),
      }),
    })
  );

  wireFixture(
    "an image-to-text operation the wire has and OSDK lacks decodes",
    MediaTransformation,
    {
      type: "imageToText",
      operation: { type: "extractLayoutAwareTextV2", format: "HTML", languages: [{ type: "script", script: "LATIN" }] },
    },
    MediaTransformation.cases.imageToText.make({
      operation: ImageToTextOperation.cases.extractLayoutAwareTextV2.make({
        format: O.some("html"),
        languages: [latin],
      }),
    })
  );

  wireFixture(
    "a document-to-image transformation renders a page into a box",
    MediaTransformation,
    {
      type: "documentToImage",
      encoding: { type: "webp" },
      operation: { type: "renderPageToFitBoundingBox", pageNumber: 2, width: 256, height: 256 },
    },
    MediaTransformation.cases.documentToImage.make({
      encoding: "webp",
      operation: DocumentToImageOperation.cases.renderPageToFitBoundingBox.make({
        pageNumber: O.some(2),
        width: 256,
        height: 256,
      }),
    })
  );

  wireFixture(
    "an audio transformation carries its output format on the operation",
    MediaTransformation,
    {
      type: "audio",
      operation: { type: "chunk", chunkDurationMilliseconds: 30000, encodeFormat: { type: "mp3" }, chunkIndex: 4 },
    },
    MediaTransformation.cases.audio.make({
      operation: AudioOperation.cases.chunk.make({
        chunkDurationMilliseconds: 30000,
        encodeFormat: AudioEncoding.cases.mp3.make({}),
        chunkIndex: 4,
      }),
    })
  );

  wireFixture(
    "an email-to-attachment transformation names the attachment by position",
    MediaTransformation,
    {
      type: "emailToAttachment",
      operation: { type: "getEmailAttachment", mimeType: "application/pdf", attachmentIndex: 0 },
    },
    MediaTransformation.cases.emailToAttachment.make({
      operation: EmailToAttachmentOperation.cases.getEmailAttachment.make({
        mimeType: MediaType.make("application/pdf"),
        attachmentIndex: 0,
      }),
    })
  );

  wireFixture(
    "an image-to-embedding transformation names its model",
    MediaTransformation,
    { type: "imageToEmbedding", operation: { type: "generateEmbedding", modelId: "GOOGLE_SIGLIP_2" } },
    MediaTransformation.cases.imageToEmbedding.make({
      operation: ImageToEmbeddingOperation.cases.generateEmbedding.make({ modelId: "googleSiglip2" }),
    })
  );

  wireFixture(
    "a transformation request wraps the transformation",
    TransformMediaItemRequest,
    {
      transformation: {
        type: "documentToDocument",
        encoding: { type: "pdf" },
        operation: { type: "slicePdfRange", startPageInclusive: 0, endPageExclusive: 10, strictlyEnforceEndPage: true },
      },
    },
    TransformMediaItemRequest.make({
      transformation: MediaTransformation.cases.documentToDocument.make({
        encoding: "pdf",
        operation: DocumentToDocumentOperation.cases.slicePdfRange.make({
          startPageInclusive: 0,
          endPageExclusive: 10,
          strictlyEnforceEndPage: O.some(true),
        }),
      }),
    })
  );

  wireFixture(
    "a transformation job reports its status and identifier",
    TransformationJob,
    { status: "SUCCESSFUL", jobId: "ri.mio.main.transformation-job.7f3a" },
    TransformationJob.make({
      status: "successful",
      jobId: TransformationJobId.make("ri.mio.main.transformation-job.7f3a"),
    })
  );
});

// -----------------------------------------------------------------------------
// Wire fixtures: metadata
// -----------------------------------------------------------------------------

describe("metadata wire fixtures", () => {
  wireFixture(
    "imagery metadata carries bands, attributes, geo-referencing and orientation",
    MediaItemMetadata,
    {
      type: "imagery",
      format: "TIFF",
      dimensions: { width: 4096, height: 2160 },
      bands: [
        { dataType: "UINT16", colorInterpretation: "GRAY", unitInterpretation: { unit: "m", scale: 0.1, offset: 0 } },
        { colorInterpretation: "Y_CB_CR_SPACE_CB", paletteInterpretation: "RGBA" },
      ],
      attributes: { EXIF: { Make: "Canon" } },
      geo: {
        crs: { wkt: "EPSG:4326" },
        geotransform: { xTranslate: 10, xScale: 0.5, xShear: 0, yTranslate: 50, yShear: 0, yScale: -0.5 },
        gcpInfo: { gcps: [{ pixX: 0, pixY: 0, projX: 10, projY: 50 }] },
        gpsData: { latitude: 48.85, longitude: 2.35 },
      },
      pages: 1,
      orientation: { rotationAngle: "DEGREE_270", flipAxis: "HORIZONTAL" },
      sizeBytes: 393469,
      sizeBytesLong: "393469",
    },
    ImageryMetadata.make({
      format: "tiff",
      dimensions: O.some(Dimensions.make({ width: 4096, height: 2160 })),
      bands: [
        BandInfo.make({
          dataType: O.some("uint16"),
          colorInterpretation: O.some("gray"),
          unitInterpretation: O.some(
            UnitInterpretation.make({ unit: O.some("m"), scale: O.some(0.1), offset: O.some(0) })
          ),
        }),
        BandInfo.make({ colorInterpretation: O.some("yCbCrSpaceCb"), paletteInterpretation: O.some("rgba") }),
      ],
      attributes: { EXIF: { Make: "Canon" } },
      geo: O.some(
        GeoMetadata.make({
          crs: O.some(CoordinateReferenceSystem.make({ wkt: O.some("EPSG:4326") })),
          geotransform: O.some(
            AffineTransform.make({
              xTranslate: O.some(10),
              xScale: O.some(0.5),
              xShear: O.some(0),
              yTranslate: O.some(50),
              yShear: O.some(0),
              yScale: O.some(-0.5),
            })
          ),
          gcpInfo: O.some(
            GroundControlPoints.make({
              gcps: [
                GroundControlPoint.make({
                  pixX: O.some(0),
                  pixY: O.some(0),
                  projX: O.some(10),
                  projY: O.some(50),
                }),
              ],
            })
          ),
          gpsData: O.some(GpsMetadata.make({ latitude: O.some(48.85), longitude: O.some(2.35) })),
        })
      ),
      pages: O.some(1),
      orientation: O.some(Orientation.make({ rotationAngle: O.some("degree270"), flipAxis: O.some("horizontal") })),
      sizeBytes: 393469,
      sizeBytesLong: SizeBytes.make(BigInt(393469)),
    })
  );

  wireFixture(
    "email metadata flattens the mailbox and group wrappers of its recipients",
    MediaItemMetadata,
    {
      type: "email",
      format: "EML",
      sizeBytes: 2048,
      sizeBytesLong: "2048",
      sender: [{ displayName: "Ada", emailAddress: "ada@example.com" }],
      date: "2024-05-01T12:00:00Z",
      attachmentCount: 1,
      to: [{ type: "mailbox", mailbox: { emailAddress: "bob@example.com" } }],
      cc: [{ type: "group", group: { groupName: "reviewers", mailboxes: [{ emailAddress: "cy@example.com" }] } }],
      subject: "Q3 numbers",
      attachments: [{ attachmentIndex: 0, fileName: "q3.xlsx", mimeType: "application/vnd.ms-excel" }],
    },
    EmailMetadata.make({
      format: "eml",
      sizeBytes: 2048,
      sizeBytesLong: SizeBytes.make(BigInt(2048)),
      sender: [Mailbox.make({ displayName: O.some("Ada"), emailAddress: "ada@example.com" })],
      date: "2024-05-01T12:00:00Z",
      attachmentCount: 1,
      to: [EmailRecipient.cases.mailbox.make({ emailAddress: "bob@example.com" })],
      cc: [
        EmailRecipient.cases.group.make({
          groupName: "reviewers",
          mailboxes: [Mailbox.make({ emailAddress: "cy@example.com" })],
        }),
      ],
      subject: O.some("Q3 numbers"),
      attachments: [
        EmailAttachment.make({
          attachmentIndex: 0,
          fileName: O.some("q3.xlsx"),
          mimeType: MediaType.make("application/vnd.ms-excel"),
        }),
      ],
    })
  );

  wireFixture(
    "DICOM metadata keeps its other data elements as JSON",
    MediaItemMetadata,
    {
      type: "dicom",
      metaInformation: {
        type: "v1",
        mediaStorageSop: "1.2.840.10008.5.1.4.1.1.2",
        mediaStorageSopInstance: "1.3.6.1.4.1.14519.5.2.1.99.1",
        transferSyntax: "1.2.840.10008.1.2.1",
      },
      mediaType: "MULTI_FRAME_IMAGE",
      commonDataElements: { numberFrames: 24, modality: "CT", patientId: "P-1" },
      otherDataElements: { "00080060": { vr: "CS", Value: ["CT"] } },
      sizeBytes: 1048576,
      sizeBytesLong: "1048576",
    },
    DicomMetadata.make({
      metaInformation: DicomMetaInformation.cases.v1.make({
        mediaStorageSop: "1.2.840.10008.5.1.4.1.1.2",
        mediaStorageSopInstance: "1.3.6.1.4.1.14519.5.2.1.99.1",
        transferSyntax: "1.2.840.10008.1.2.1",
      }),
      mediaType: "multiFrameImage",
      commonDataElements: CommonDicomDataElements.make({
        numberFrames: O.some(24),
        modality: O.some("CT"),
        patientId: O.some("P-1"),
      }),
      otherDataElements: { "00080060": { vr: "CS", Value: ["CT"] } },
      sizeBytes: 1048576,
      sizeBytesLong: SizeBytes.make(BigInt(1048576)),
    })
  );

  wireFixture(
    "CAD metadata, which OSDK routes to its unknown wrapper, is a case of its own",
    MediaItemMetadata,
    { type: "cad", format: "STEP", sizeBytes: 10, sizeBytesLong: "10", units: { lengthUnit: "millimetre" } },
    CadMetadata.make({
      format: "step",
      sizeBytes: 10,
      sizeBytesLong: SizeBytes.make(BigInt(10)),
      units: O.some(CadUnits.make({ lengthUnit: O.some("millimetre") })),
    })
  );

  wireFixture(
    "the exact size survives where a JSON number cannot hold it",
    MediaItemMetadata,
    { type: "untyped", sizeBytes: 9007199254740992, sizeBytesLong: "9007199254740993" },
    UntypedMetadata.make({
      sizeBytes: 9007199254740992,
      sizeBytesLong: SizeBytes.make(BigInt("9007199254740993")),
    })
  );
});

// -----------------------------------------------------------------------------
// Defaults and rejections
// -----------------------------------------------------------------------------

describe("constructor defaults", () => {
  it.effect(
    "an operation built with no settings has every optional setting absent and encodes to its tag alone",
    Effect.fnUntraced(function* () {
      const resize = ResizeImageOperation.make({});
      assertNone(resize.height);
      assertNone(resize.width);
      assertNone(resize.autoOrient);
      const resizeWire = yield* S.encodeEffect(ResizeImageOperation)(resize);
      deepStrictEqual(resizeWire, { type: "resize" });
      const transcribe = TranscribeOperation.make({});
      assertNone(transcribe.language);
      const transcribeWire = yield* S.encodeEffect(TranscribeOperation)(transcribe);
      deepStrictEqual(transcribeWire, { type: "transcribe" });
    })
  );

  it.effect(
    "an absent wire key decodes to none, and a present one to some",
    Effect.fnUntraced(function* () {
      const range = yield* S.decodeEffect(PageRange)({ endPageExclusive: 5 });
      assertNone(range.startPageInclusive);
      assertSome(range.endPageExclusive, 5);
    })
  );

  it("the poll defaults are three seconds between requests and thirty seconds in all", () => {
    strictEqual(Duration.toMillis(DefaultPollInterval), 3000);
    strictEqual(Duration.toMillis(DefaultPollTimeout), 30000);
    strictEqual(Duration.toMillis(MinimumPollInterval), 100);
    strictEqual(Duration.toMillis(MinimumPollTimeout), 1000);
    assertTrue(Duration.isLessThan(MinimumPollInterval, DefaultPollInterval));
    assertTrue(Duration.isLessThan(MinimumPollTimeout, DefaultPollTimeout));
  });
});

describe("rejections", () => {
  it("a transformation rejects OSDK's single-key spelling and bare-string encodings", () => {
    rejects(MediaTransformation, { $image: { $encoding: "png", $operations: [] } });
    rejects(MediaTransformation, { type: "image", encoding: "png", operations: [] });
    rejects(ImageryEncoding, "png");
    rejects(ImageryEncoding, { type: "bmp" });
    rejects(AudioEncoding, "mp3");
  });

  it("a transformation rejects an unknown tag, a missing operation and a misplaced encoding value", () => {
    rejects(MediaTransformation, { type: "imageToVideo", operation: { type: "animate" } });
    rejects(MediaTransformation, { type: "imageToDocument" });
    rejects(MediaTransformation, { type: "video", encoding: { type: "png" }, operation: { type: "transcode" } });
    rejects(MediaTransformation, { type: "audio", operation: { type: "transcode" } });
  });

  it("an operation rejects a literal outside its domain", () => {
    rejects(ImageOperation, { type: "rotate", angle: "DEGREE_45" });
    rejects(AudioToTextOperation, { type: "transcribe", language: "fr" });
    rejects(AudioToTextOperation, { type: "transcribe", performanceMode: "moreEconomical" });
    rejects(ImageToEmbeddingOperation, { type: "generateEmbedding", modelId: "OTHER_MODEL" });
    rejects(OcrLanguageOrScript, { type: "language", language: "LATIN" });
    rejects(OcrLanguageOrScript, { type: "script", script: "ENG" });
    rejects(VlmOutputFormat, "HTML");
    rejects(EmailToTextOperation, { type: "getEmailBody", outputFormat: "MARKDOWN" });
  });

  it("an operation rejects a missing required field and a non-finite number", () => {
    rejects(ImageOperation, { type: "crop", xOffset: 0, yOffset: 0, width: 10 });
    rejects(ImageOperation, { type: "resize", width: Number.POSITIVE_INFINITY });
    rejects(ImageOperation, { type: "encrypt", polygons: [], cipherLicenseRid: "" });
    rejects(LlmSpec, {
      type: "chat",
      modelLocator: { type: "apiName", apiName: "vision-large" },
      systemPrompt: "s",
      userPrompt: "u",
    });
    rejects(AnnotateGeometry, { type: "boundingBox", left: 0, top: 0, width: 1, height: 1 });
  });

  it("a transformation job rejects an empty identifier and a status the wire does not have", () => {
    rejects(TransformationJob, { status: "PENDING", jobId: "" });
    rejects(TransformationJob, { status: "RUNNING", jobId: "job-1" });
    rejects(TransformationJobStatus, "pending");
  });

  it("metadata rejects OSDK's unknown wrapper, an unknown kind, an unknown format and a domain-side literal", () => {
    rejects(MediaItemMetadata, { type: "unknown", raw: { type: "streamingVideo" } });
    rejects(MediaItemMetadata, { type: "streamingVideo", sizeBytes: 1, sizeBytesLong: "1" });
    rejects(MediaItemMetadata, { type: "document", format: "ODT", sizeBytes: 1, sizeBytesLong: "1" });
    rejects(MediaItemMetadata, {
      type: "video",
      format: "mp4",
      specification: { bitRate: 1, durationSeconds: 1 },
      sizeBytes: 1,
      sizeBytesLong: "1",
    });
  });

  it("metadata rejects a missing, negative or non-decimal exact size", () => {
    rejects(MediaItemMetadata, { type: "untyped", sizeBytes: 1 });
    rejects(MediaItemMetadata, { type: "untyped", sizeBytes: 1, sizeBytesLong: "-1" });
    rejects(MediaItemMetadata, { type: "untyped", sizeBytes: 1, sizeBytesLong: "1e3" });
    rejects(MediaItemMetadata, { type: "untyped", sizeBytes: 1, sizeBytesLong: 1 });
  });

  it("a wrapped union rejects the flattened shape on the wire side, and DICOM an unknown layout version", () => {
    rejects(EmailRecipient, { type: "mailbox", emailAddress: "bob@example.com" });
    rejects(EmailRecipient, { type: "group", group: { groupName: "reviewers" } });
    rejects(DicomMetaInformation, {
      type: "v2",
      mediaStorageSop: "1.2.840.10008.5.1.4.1.1.2",
      mediaStorageSopInstance: "1.3.6.1.4.1.14519.5.2.1.99.1",
      transferSyntax: "1.2.840.10008.1.2.1",
    });
  });
});
