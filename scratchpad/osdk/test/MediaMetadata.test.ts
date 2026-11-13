import { fcRuns } from "@beep/test-utils";
import { describe, it } from "@effect/vitest";
import { assertNone, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { MediaType, SizeBytes } from "../src/Attachment/Attachment.model.ts";
import {
  AffineTransform,
  AudioDecodeFormat,
  AudioMetadata,
  AudioSpecification,
  BandDataType,
  BandInfo,
  CadDecodeFormat,
  CadMetadata,
  CadUnits,
  ColorInterpretation,
  CommonDicomDataElements,
  CoordinateReferenceSystem,
  DicomFileMetaInformation,
  DicomMediaType,
  DicomMetadata,
  DicomMetaInformation,
  Dimensions,
  DocumentDecodeFormat,
  DocumentMetadata,
  EmailAttachment,
  EmailDecodeFormat,
  EmailMetadata,
  EmailRecipient,
  FlipAxis,
  GeoMetadata,
  GpsMetadata,
  GroundControlPoint,
  GroundControlPoints,
  GroupRecipient,
  ImageryDecodeFormat,
  ImageryMetadata,
  Mailbox,
  MailboxRecipient,
  MediaItemMetadata,
  MediaItemMetadataKind,
  Modality,
  Model3dDecodeFormat,
  Model3dMetadata,
  Model3dType,
  Orientation,
  PaletteInterpretation,
  RotationAngle,
  SpreadsheetDecodeFormat,
  SpreadsheetMetadata,
  UnitInterpretation,
  UntypedMetadata,
  VideoDecodeFormat,
  VideoMetadata,
  VideoSpecification,
} from "../src/Media/index.ts";
import * as MetadataModel from "../src/Media/MediaMetadata.model.ts";

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

/** Registers the law of a record whose every field is optional: the empty wire record is the record of absences. */
const emptyRecord =
  <T extends { readonly [field: string]: O.Option<unknown> }>(name: string, schema: S.Codec<T, {}>, fields: number) =>
  () =>
    it.effect(
      `${name} decodes the empty record to ${fields} absent fields and encodes back to the empty record`,
      Effect.fnUntraced(function* () {
        const decoded = yield* S.decodeEffect(schema)({});
        strictEqual(R.size(decoded), fields);
        A.forEach(R.values(decoded), (field) => assertNone(field));
        const encoded = yield* S.encodeEffect(schema)(decoded);
        deepStrictEqual(encoded, {});
      })
    );

const register = (registrations: ReadonlyArray<() => void>) => A.forEach(registrations, (run) => run());

// -----------------------------------------------------------------------------
// Laws over every named schema
// -----------------------------------------------------------------------------

schemaTable("MediaMetadata.model", MetadataModel, 49, {
  MediaItemMetadataKind: covered(MediaItemMetadataKind),
  AudioDecodeFormat: covered(AudioDecodeFormat),
  VideoDecodeFormat: covered(VideoDecodeFormat),
  DocumentDecodeFormat: covered(DocumentDecodeFormat),
  SpreadsheetDecodeFormat: covered(SpreadsheetDecodeFormat),
  ImageryDecodeFormat: covered(ImageryDecodeFormat),
  EmailDecodeFormat: covered(EmailDecodeFormat),
  CadDecodeFormat: covered(CadDecodeFormat),
  DicomMediaType: covered(DicomMediaType),
  Model3dDecodeFormat: covered(Model3dDecodeFormat),
  Model3dType: covered(Model3dType),
  BandDataType: covered(BandDataType),
  ColorInterpretation: covered(ColorInterpretation),
  PaletteInterpretation: covered(PaletteInterpretation),
  RotationAngle: covered(RotationAngle),
  FlipAxis: covered(FlipAxis),
  Modality: covered(Modality),
  AudioSpecification: covered(AudioSpecification),
  VideoSpecification: covered(VideoSpecification),
  Dimensions: covered(Dimensions),
  UnitInterpretation: covered(UnitInterpretation),
  BandInfo: covered(BandInfo),
  CoordinateReferenceSystem: covered(CoordinateReferenceSystem),
  AffineTransform: covered(AffineTransform),
  GroundControlPoint: covered(GroundControlPoint),
  GroundControlPoints: covered(GroundControlPoints),
  GpsMetadata: covered(GpsMetadata),
  GeoMetadata: covered(GeoMetadata),
  Orientation: covered(Orientation),
  DicomFileMetaInformation: covered(DicomFileMetaInformation),
  DicomMetaInformation: covered(DicomMetaInformation),
  CommonDicomDataElements: covered(CommonDicomDataElements),
  Mailbox: covered(Mailbox),
  MailboxRecipient: covered(MailboxRecipient),
  GroupRecipient: covered(GroupRecipient),
  EmailRecipient: covered(EmailRecipient),
  EmailAttachment: covered(EmailAttachment),
  CadUnits: covered(CadUnits),
  DocumentMetadata: covered(DocumentMetadata),
  ImageryMetadata: covered(ImageryMetadata),
  AudioMetadata: covered(AudioMetadata),
  VideoMetadata: covered(VideoMetadata),
  DicomMetadata: covered(DicomMetadata),
  EmailMetadata: covered(EmailMetadata),
  Model3dMetadata: covered(Model3dMetadata),
  SpreadsheetMetadata: covered(SpreadsheetMetadata),
  UntypedMetadata: covered(UntypedMetadata),
  CadMetadata: covered(CadMetadata),
  MediaItemMetadata: covered(MediaItemMetadata),
});

// -----------------------------------------------------------------------------
// Wire fixtures: one per case of every tagged union
// -----------------------------------------------------------------------------

unionTable("MediaMetadata.model", MetadataModel, { unions: 3, cases: 13 }, {
  MediaItemMetadata: fixturesOf(MediaItemMetadata, {
    document: [
      {
        type: "document",
        format: "DOCX",
        pages: 12,
        sizeBytes: 48211,
        sizeBytesLong: "48211",
        title: "Quarterly review",
        author: "A. Lovelace",
      },
      MediaItemMetadata.cases.document.make({
        format: "docx",
        pages: O.some(12),
        sizeBytes: 48211,
        sizeBytesLong: SizeBytes.make(BigInt(48211)),
        title: O.some("Quarterly review"),
        author: O.some("A. Lovelace"),
      }),
    ],
    imagery: [
      {
        type: "imagery",
        format: "JPG",
        dimensions: { width: 1920, height: 1080 },
        bands: [
          { dataType: "BYTE", colorInterpretation: "RED" },
          { dataType: "BYTE", colorInterpretation: "GREEN" },
          { dataType: "BYTE", colorInterpretation: "BLUE" },
        ],
        attributes: { EXIF: { Model: "X100V", FNumber: "2.0" } },
        iccProfile: "sRGB IEC61966-2.1",
        geo: {
          gcpInfo: { gcps: [{ pixX: 12, pixY: 34, projX: 500000, projY: 4649776, projZ: 87.5 }] },
          gpsData: { latitude: 41.99, longitude: -87.9, altitude: 204 },
        },
        orientation: { flipAxis: "VERTICAL" },
        sizeBytes: 204800,
        sizeBytesLong: "204800",
      },
      MediaItemMetadata.cases.imagery.make({
        format: "jpg",
        dimensions: O.some(Dimensions.make({ width: 1920, height: 1080 })),
        bands: [
          BandInfo.make({ dataType: O.some("byte"), colorInterpretation: O.some("red") }),
          BandInfo.make({ dataType: O.some("byte"), colorInterpretation: O.some("green") }),
          BandInfo.make({ dataType: O.some("byte"), colorInterpretation: O.some("blue") }),
        ],
        attributes: { EXIF: { Model: "X100V", FNumber: "2.0" } },
        iccProfile: O.some("sRGB IEC61966-2.1"),
        geo: O.some(
          GeoMetadata.make({
            gcpInfo: O.some(
              GroundControlPoints.make({
                gcps: [
                  GroundControlPoint.make({
                    pixX: O.some(12),
                    pixY: O.some(34),
                    projX: O.some(500000),
                    projY: O.some(4649776),
                    projZ: O.some(87.5),
                  }),
                ],
              })
            ),
            gpsData: O.some(
              GpsMetadata.make({ latitude: O.some(41.99), longitude: O.some(-87.9), altitude: O.some(204) })
            ),
          })
        ),
        orientation: O.some(Orientation.make({ flipAxis: O.some("vertical") })),
        sizeBytes: 204800,
        sizeBytesLong: SizeBytes.make(BigInt(204800)),
      }),
    ],
    audio: [
      {
        type: "audio",
        format: "NIST_SPHERE",
        specification: { bitRate: 256000, durationSeconds: 61.5, numberOfChannels: 2 },
        sizeBytes: 1968000,
        sizeBytesLong: "1968000",
      },
      MediaItemMetadata.cases.audio.make({
        format: "nistSphere",
        specification: AudioSpecification.make({
          bitRate: 256000,
          durationSeconds: 61.5,
          numberOfChannels: O.some(2),
        }),
        sizeBytes: 1968000,
        sizeBytesLong: SizeBytes.make(BigInt(1968000)),
      }),
    ],
    video: [
      {
        type: "video",
        format: "WEBM",
        specification: { bitRate: 4000000, durationSeconds: 30 },
        sizeBytes: 15000000,
        sizeBytesLong: "15000000",
      },
      MediaItemMetadata.cases.video.make({
        format: "webm",
        specification: VideoSpecification.make({ bitRate: 4000000, durationSeconds: 30 }),
        sizeBytes: 15000000,
        sizeBytesLong: SizeBytes.make(BigInt(15000000)),
      }),
    ],
    dicom: [
      {
        type: "dicom",
        metaInformation: {
          type: "v1",
          mediaStorageSop: "1.2.840.10008.5.1.4.1.1.88.11",
          mediaStorageSopInstance: "1.3.6.1.4.1.5962.1.1.0.0.0.1196533885.18148.0.133",
          transferSyntax: "1.2.840.10008.1.2",
        },
        mediaType: "STRUCTURED_REPORT",
        commonDataElements: {
          studyId: "S-7",
          studyUid: "1.2.3",
          seriesUid: "1.2.3.4",
          studyTime: "101500",
          seriesTime: "101730",
        },
        otherDataElements: { "00100010": { vr: "PN", Value: [{ Alphabetic: "Doe^Jane" }] } },
        sizeBytes: 4096,
        sizeBytesLong: "4096",
      },
      MediaItemMetadata.cases.dicom.make({
        metaInformation: DicomMetaInformation.cases.v1.make({
          mediaStorageSop: "1.2.840.10008.5.1.4.1.1.88.11",
          mediaStorageSopInstance: "1.3.6.1.4.1.5962.1.1.0.0.0.1196533885.18148.0.133",
          transferSyntax: "1.2.840.10008.1.2",
        }),
        mediaType: "structuredReport",
        commonDataElements: CommonDicomDataElements.make({
          studyId: O.some("S-7"),
          studyUid: O.some("1.2.3"),
          seriesUid: O.some("1.2.3.4"),
          studyTime: O.some("101500"),
          seriesTime: O.some("101730"),
        }),
        otherDataElements: { "00100010": { vr: "PN", Value: [{ Alphabetic: "Doe^Jane" }] } },
        sizeBytes: 4096,
        sizeBytesLong: SizeBytes.make(BigInt(4096)),
      }),
    ],
    email: [
      {
        type: "email",
        format: "EML",
        sizeBytes: 512,
        sizeBytesLong: "512",
        sender: [{ emailAddress: "noreply@example.com" }],
        date: "Wed, 15 Jan 2025 08:30:00 +0000",
        attachmentCount: 1,
        to: [{ type: "group", group: { groupName: "undisclosed-recipients", mailboxes: [] } }],
        cc: [],
        attachments: [{ attachmentIndex: 0, mimeType: "application/octet-stream" }],
      },
      MediaItemMetadata.cases.email.make({
        format: "eml",
        sizeBytes: 512,
        sizeBytesLong: SizeBytes.make(BigInt(512)),
        sender: [Mailbox.make({ emailAddress: "noreply@example.com" })],
        date: "Wed, 15 Jan 2025 08:30:00 +0000",
        attachmentCount: 1,
        to: [EmailRecipient.cases.group.make({ groupName: "undisclosed-recipients", mailboxes: [] })],
        cc: [],
        attachments: [
          EmailAttachment.make({ attachmentIndex: 0, mimeType: MediaType.make("application/octet-stream") }),
        ],
      }),
    ],
    model3d: [
      { type: "model3d", format: "PLY", modelType: "POINT_CLOUD", sizeBytes: 7340032, sizeBytesLong: "7340032" },
      MediaItemMetadata.cases.model3d.make({
        format: "ply",
        modelType: "pointCloud",
        sizeBytes: 7340032,
        sizeBytesLong: SizeBytes.make(BigInt(7340032)),
      }),
    ],
    spreadsheet: [
      {
        type: "spreadsheet",
        format: "CSV",
        sheetNames: ["Sheet1"],
        sizeBytes: 9216,
        sizeBytesLong: "9216",
        title: "Budget",
        author: "Finance",
      },
      MediaItemMetadata.cases.spreadsheet.make({
        format: "csv",
        sheetNames: ["Sheet1"],
        sizeBytes: 9216,
        sizeBytesLong: SizeBytes.make(BigInt(9216)),
        title: O.some("Budget"),
        author: O.some("Finance"),
      }),
    ],
    untyped: [
      { type: "untyped", sizeBytes: 42, sizeBytesLong: "42" },
      MediaItemMetadata.cases.untyped.make({ sizeBytes: 42, sizeBytesLong: SizeBytes.make(BigInt(42)) }),
    ],
    cad: [
      { type: "cad", format: "STEP", sizeBytes: 123456, sizeBytesLong: "123456" },
      MediaItemMetadata.cases.cad.make({
        format: "step",
        sizeBytes: 123456,
        sizeBytesLong: SizeBytes.make(BigInt(123456)),
      }),
    ],
  }),
  DicomMetaInformation: fixturesOf(DicomMetaInformation, {
    v1: [
      {
        type: "v1",
        mediaStorageSop: "1.2.840.10008.5.1.4.1.1.4",
        mediaStorageSopInstance: "1.3.12.2.1107.5.2.32.35162.2013120811432219576804283",
        transferSyntax: "1.2.840.10008.1.2.4.70",
      },
      DicomMetaInformation.cases.v1.make({
        mediaStorageSop: "1.2.840.10008.5.1.4.1.1.4",
        mediaStorageSopInstance: "1.3.12.2.1107.5.2.32.35162.2013120811432219576804283",
        transferSyntax: "1.2.840.10008.1.2.4.70",
      }),
    ],
  }),
  EmailRecipient: fixturesOf(EmailRecipient, {
    mailbox: [
      { type: "mailbox", mailbox: { displayName: "Grace Hopper", emailAddress: "grace@example.com" } },
      EmailRecipient.cases.mailbox.make({ displayName: O.some("Grace Hopper"), emailAddress: "grace@example.com" }),
    ],
    group: [
      {
        type: "group",
        group: {
          groupName: "compilers",
          mailboxes: [{ emailAddress: "jean@example.com" }, { displayName: "Fran", emailAddress: "fran@example.com" }],
        },
      },
      EmailRecipient.cases.group.make({
        groupName: "compilers",
        mailboxes: [
          Mailbox.make({ emailAddress: "jean@example.com" }),
          Mailbox.make({ displayName: O.some("Fran"), emailAddress: "fran@example.com" }),
        ],
      }),
    ],
  }),
});

// -----------------------------------------------------------------------------
// Records whose every field is optional
// -----------------------------------------------------------------------------

describe("all-optional records", () => {
  register([
    emptyRecord("UnitInterpretation", UnitInterpretation, 3),
    emptyRecord("BandInfo", BandInfo, 4),
    emptyRecord("CoordinateReferenceSystem", CoordinateReferenceSystem, 1),
    emptyRecord("AffineTransform", AffineTransform, 6),
    emptyRecord("GroundControlPoint", GroundControlPoint, 5),
    emptyRecord("GpsMetadata", GpsMetadata, 3),
    emptyRecord("GeoMetadata", GeoMetadata, 4),
    emptyRecord("Orientation", Orientation, 2),
    emptyRecord("CommonDicomDataElements", CommonDicomDataElements, 8),
    emptyRecord("CadUnits", CadUnits, 1),
  ]);
});

// -----------------------------------------------------------------------------
// What the wire reads that the generated client's copy of these domains lacks
// -----------------------------------------------------------------------------

describe("formats the platform reads", () => {
  it("video and spreadsheet metadata carry one format more than the generated client lists", () => {
    const wireOf = <I, T>(pairs: ReadonlyArray<readonly [I, T]>) => A.map(pairs, ([wire]) => wire);
    deepStrictEqual(wireOf(VideoDecodeFormat.Pairs), ["MP4", "MKV", "MOV", "TS", "WEBM"]);
    deepStrictEqual(wireOf(SpreadsheetDecodeFormat.Pairs), ["CSV", "XLSX"]);
  });

  it("the ten kinds of metadata each name the format domain of their kind, and untyped names none", () => {
    const formatOf = MediaItemMetadata.match({
      document: ({ format }) => O.some<string>(format),
      imagery: ({ format }) => O.some<string>(format),
      audio: ({ format }) => O.some<string>(format),
      video: ({ format }) => O.some<string>(format),
      dicom: ({ mediaType }) => O.some<string>(mediaType),
      email: ({ format }) => O.some<string>(format),
      model3d: ({ format }) => O.some<string>(format),
      spreadsheet: ({ format }) => O.some<string>(format),
      untyped: () => O.none<string>(),
      cad: ({ format }) => O.some<string>(format),
    });
    const untyped = MediaItemMetadata.cases.untyped.make({ sizeBytes: 1, sizeBytesLong: SizeBytes.make(BigInt(1)) });
    const cad = MediaItemMetadata.cases.cad.make({
      format: "step",
      sizeBytes: 1,
      sizeBytesLong: SizeBytes.make(BigInt(1)),
    });
    assertNone(formatOf(untyped));
    deepStrictEqual(formatOf(cad), O.some("step"));
    strictEqual(A.length(MediaItemMetadataKind.literals), 10);
  });
});
