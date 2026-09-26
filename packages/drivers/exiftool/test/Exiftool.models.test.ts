import {
  BeepQaProvenance,
  BeepQaTagName,
  beepQaRawTagKey,
  buildReadTagsArgs,
  buildWriteTagsArgs,
  EpochMilliseconds,
  ExifMetadata,
  ExiftoolErrorContext,
  ExiftoolErrorFromUnknownOptions,
  ExiftoolWritableExtension,
  exiftoolVersionArgs,
  PositiveMilliseconds,
  ProcessExitCode,
  provenanceFromRawTags,
  provenanceTagAssignments,
  ReadTagsRequest,
  RenderBeepQaConfigOptions,
  renderBeepQaExiftoolConfig,
  SafeTagName,
  TagAssignment,
  TagCount,
  WriteTagsRequest,
  WriteXmpPacketRequest,
} from "@beep/exiftool";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Equal, pipe } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownSafeTagNameOption = S.decodeUnknownOption(SafeTagName);
const decodeUnknownExiftoolErrorFromUnknownOptions = S.decodeUnknownEffect(ExiftoolErrorFromUnknownOptions);
const encodeBeepQaProvenance = S.encodeEffect(BeepQaProvenance);
const encodeExifMetadata = S.encodeEffect(ExifMetadata);
const encodeExiftoolErrorFromUnknownOptions = S.encodeEffect(ExiftoolErrorFromUnknownOptions);

const assertRoundTrip = Effect.fn("assertRoundTrip")(function* <Schema extends S.Codec<unknown, unknown>>(
  schema: Schema,
  value: Schema["Type"]
) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeEffect(schema)(encoded);
  expect(Equal.equals(decoded, value)).toBe(true);
});

const fullProvenance = BeepQaProvenance.make({
  actionId: "act-9",
  capturedAtEpochMs: 1753900000000,
  clockOffsetMs: O.some(12.5),
  commitSha: O.some("abc1234"),
  scenarioName: "sash-drag",
  sessionId: "sess-1",
  sourceVideo: O.some("video/capture.webm"),
  toolVersions: O.some({ exiftool: "13.55" }),
});

describe("@beep/exiftool models", () => {
  it.effect.prop(
    "round-trips PositiveMilliseconds through encoded form",
    [PositiveMilliseconds],
    ([value]) => assertRoundTrip(PositiveMilliseconds, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips EpochMilliseconds through encoded form",
    [EpochMilliseconds],
    ([value]) => assertRoundTrip(EpochMilliseconds, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips TagCount through encoded form",
    [TagCount],
    ([value]) => assertRoundTrip(TagCount, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips SafeTagName through encoded form",
    [SafeTagName],
    ([value]) => assertRoundTrip(SafeTagName, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips ProcessExitCode through encoded form",
    [ProcessExitCode],
    ([value]) => assertRoundTrip(ProcessExitCode, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips ExiftoolWritableExtension through encoded form",
    [ExiftoolWritableExtension],
    ([value]) => assertRoundTrip(ExiftoolWritableExtension, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips BeepQaTagName through encoded form",
    [BeepQaTagName],
    ([value]) => assertRoundTrip(BeepQaTagName, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips ReadTagsRequest through encoded form",
    [ReadTagsRequest],
    ([value]) => assertRoundTrip(ReadTagsRequest, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips TagAssignment through encoded form",
    [TagAssignment],
    ([value]) => assertRoundTrip(TagAssignment, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips WriteTagsRequest through encoded form",
    [WriteTagsRequest],
    ([value]) => assertRoundTrip(WriteTagsRequest, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips BeepQaProvenance through encoded form",
    [BeepQaProvenance],
    ([value]) => assertRoundTrip(BeepQaProvenance, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips WriteXmpPacketRequest through encoded form",
    [WriteXmpPacketRequest],
    ([value]) => assertRoundTrip(WriteXmpPacketRequest, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips ExiftoolErrorContext through encoded form",
    [ExiftoolErrorContext],
    ([value]) => assertRoundTrip(ExiftoolErrorContext, value),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips ExiftoolErrorFromUnknownOptions through encoded form",
    [Arbitrary.schema(ExiftoolErrorFromUnknownOptions).pipe(Arbitrary.filter((options) => O.isNone(options.cause)))],
    ([options]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeExiftoolErrorFromUnknownOptions(options);
        const decoded = yield* decodeUnknownExiftoolErrorFromUnknownOptions(encoded);
        expect(Equal.equals(decoded, options)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect(
    "keeps Option-modeled optional metadata encoded as omitted keys",
    Effect.fnUntraced(function* () {
      expect(
        yield* encodeBeepQaProvenance(
          BeepQaProvenance.make({
            actionId: "act-9",
            capturedAtEpochMs: 1753900000000,
            scenarioName: "sash-drag",
            sessionId: "sess-1",
          })
        )
      ).toEqual({
        actionId: "act-9",
        capturedAtEpochMs: 1753900000000,
        scenarioName: "sash-drag",
        sessionId: "sess-1",
      });

      expect(yield* encodeBeepQaProvenance(fullProvenance)).toEqual({
        actionId: "act-9",
        capturedAtEpochMs: 1753900000000,
        clockOffsetMs: 12.5,
        commitSha: "abc1234",
        scenarioName: "sash-drag",
        sessionId: "sess-1",
        sourceVideo: "video/capture.webm",
        toolVersions: { exiftool: "13.55" },
      });

      expect(
        yield* encodeExifMetadata(
          ExifMetadata.make({
            fileType: O.some("PNG"),
            imageWidth: O.some(8),
            raw: { "File:FileType": "PNG" },
          })
        )
      ).toEqual({
        fileType: "PNG",
        imageWidth: 8,
        raw: { "File:FileType": "PNG" },
      });
    })
  );

  it("rejects tag names that could smuggle extra arguments", () => {
    pipe(decodeUnknownSafeTagNameOption("XMP-beepQA:sessionId"), O.isSome, assertTrue);
    assertNone(decodeUnknownSafeTagNameOption(""));
    assertNone(decodeUnknownSafeTagNameOption("tag name"));
    assertNone(decodeUnknownSafeTagNameOption("tag=value"));
    assertNone(decodeUnknownSafeTagNameOption("tag<file"));
  });

  it("builds read, write, and version arguments with -config first", () => {
    expect(
      buildReadTagsArgs({
        configPath: "/tmp/beepqa.config",
        filePath: "./frame.png",
        numeric: false,
      })
    ).toEqual(["-config", "/tmp/beepqa.config", "-j", "-G1", "./frame.png"]);

    expect(
      buildReadTagsArgs({
        configPath: "/tmp/beepqa.config",
        filePath: "./frame.png",
        numeric: true,
      })
    ).toEqual(["-config", "/tmp/beepqa.config", "-j", "-G1", "-n", "./frame.png"]);

    expect(
      buildWriteTagsArgs({
        assignments: [TagAssignment.make({ tagName: "XMP-beepQA:sessionId", value: "sess-1" })],
        configPath: "/tmp/beepqa.config",
        outputPath: "./frames/.tmp/frame.png",
        sourcePath: "./frames/frame.png",
      })
    ).toEqual([
      "-config",
      "/tmp/beepqa.config",
      "-XMP-beepQA:sessionId=sess-1",
      "-o",
      "./frames/.tmp/frame.png",
      "./frames/frame.png",
    ]);

    expect(exiftoolVersionArgs).toEqual(["-ver"]);
  });

  it("renders the XMP-beepQA exiftool config template", () => {
    const source = renderBeepQaExiftoolConfig(RenderBeepQaConfigOptions.make({}));

    expect(source).toContain("%Image::ExifTool::UserDefined::beepQA = (");
    expect(source).toContain("GROUPS => { 0 => 'XMP', 1 => 'XMP-beepQA', 2 => 'Image' },");
    expect(source).toContain("NAMESPACE => { 'beepQA' => 'https://ns.beep.sh/qa/1.0/' },");
    expect(source).toContain("WRITABLE => 'string',");
    expect(source).toContain("TagTable => 'Image::ExifTool::UserDefined::beepQA',");
    expect(source).toContain("1;  # end");

    for (const tagName of BeepQaTagName.Options) {
      expect(source).toContain(`    ${tagName} => { },`);
    }
  });

  it("encodes provenance into ordered XMP-beepQA tag assignments", () => {
    expect(
      A.map(provenanceTagAssignments(fullProvenance), (assignment) => [assignment.tagName, assignment.value])
    ).toEqual([
      ["XMP-beepQA:sessionId", "sess-1"],
      ["XMP-beepQA:scenarioName", "sash-drag"],
      ["XMP-beepQA:actionId", "act-9"],
      ["XMP-beepQA:capturedAtEpochMs", "1753900000000"],
      ["XMP-beepQA:commitSha", "abc1234"],
      ["XMP-beepQA:sourceVideo", "video/capture.webm"],
      ["XMP-beepQA:clockOffsetMs", "12.5"],
      ["XMP-beepQA:toolVersions", '{"exiftool":"13.55"}'],
    ]);

    expect(
      A.map(
        provenanceTagAssignments(
          BeepQaProvenance.make({
            actionId: "act-9",
            capturedAtEpochMs: 1753900000000,
            scenarioName: "sash-drag",
            sessionId: "sess-1",
          })
        ),
        (assignment) => assignment.tagName
      )
    ).toEqual([
      "XMP-beepQA:sessionId",
      "XMP-beepQA:scenarioName",
      "XMP-beepQA:actionId",
      "XMP-beepQA:capturedAtEpochMs",
    ]);
  });

  it.effect(
    "decodes provenance back out of ucfirst-capitalized -j -G1 keys",
    Effect.fnUntraced(function* () {
      expect(beepQaRawTagKey("sessionId")).toBe("XMP-beepQA:SessionId");
      expect(beepQaRawTagKey("capturedAtEpochMs")).toBe("XMP-beepQA:CapturedAtEpochMs");

      // exiftool 13.55 returns numeric-looking values as JSON numbers.
      const decoded = provenanceFromRawTags({
        "XMP-beepQA:ActionId": "act-9",
        "XMP-beepQA:CapturedAtEpochMs": 1753900000000,
        "XMP-beepQA:ClockOffsetMs": 12.5,
        "XMP-beepQA:CommitSha": "abc1234",
        "XMP-beepQA:ScenarioName": "sash-drag",
        "XMP-beepQA:SessionId": "sess-1",
        "XMP-beepQA:SourceVideo": "video/capture.webm",
        "XMP-beepQA:ToolVersions": '{"exiftool":"13.55"}',
      });

      pipe(decoded, O.isSome, assertTrue);
      expect(
        yield* pipe(
          decoded,
          O.map(encodeBeepQaProvenance),
          O.getOrElse(() => Effect.succeed({}))
        )
      ).toEqual(yield* encodeBeepQaProvenance(fullProvenance));

      assertNone(
        provenanceFromRawTags({
          "XMP-beepQA:ActionId": "act-9",
          "XMP-beepQA:CapturedAtEpochMs": 1753900000000,
          "XMP-beepQA:ScenarioName": "sash-drag",
        })
      );
    })
  );
});
