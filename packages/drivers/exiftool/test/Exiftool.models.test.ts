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
import { Equal, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertRoundTrip = <Schema extends S.Codec<unknown, unknown>>(schema: Schema): void => {
  const encode = S.encodeSync(schema);
  const decode = S.decodeUnknownSync(schema);

  fc.assert(
    fc.property(S.toArbitrary(schema), (value) => {
      expect(Equal.equals(decode(encode(value)), value)).toBe(true);
    }),
    fcRuns(25)
  );
};

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
  it("round-trips schema-modeled public payloads", () => {
    assertRoundTrip(PositiveMilliseconds);
    assertRoundTrip(EpochMilliseconds);
    assertRoundTrip(TagCount);
    assertRoundTrip(SafeTagName);
    assertRoundTrip(ProcessExitCode);
    assertRoundTrip(ExiftoolWritableExtension);
    assertRoundTrip(BeepQaTagName);
    assertRoundTrip(ReadTagsRequest);
    assertRoundTrip(TagAssignment);
    assertRoundTrip(WriteTagsRequest);
    assertRoundTrip(BeepQaProvenance);
    assertRoundTrip(WriteXmpPacketRequest);
    assertRoundTrip(ExiftoolErrorContext);

    const encodeErrorOptions = S.encodeSync(ExiftoolErrorFromUnknownOptions);
    const decodeErrorOptions = S.decodeUnknownSync(ExiftoolErrorFromUnknownOptions);
    fc.assert(
      fc.property(
        S.toArbitrary(ExiftoolErrorFromUnknownOptions).filter((options) => O.isNone(options.cause)),
        (options) => {
          expect(Equal.equals(decodeErrorOptions(encodeErrorOptions(options)), options)).toBe(true);
        }
      ),
      fcRuns(25)
    );
  });

  it("keeps Option-modeled optional metadata encoded as omitted keys", () => {
    expect(
      S.encodeSync(BeepQaProvenance)(
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

    expect(S.encodeSync(BeepQaProvenance)(fullProvenance)).toEqual({
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
      S.encodeSync(ExifMetadata)(
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
  });

  it("rejects tag names that could smuggle extra arguments", () => {
    const decodeTagName = S.decodeUnknownOption(SafeTagName);
    expect(O.isSome(decodeTagName("XMP-beepQA:sessionId"))).toBe(true);
    expect(O.isNone(decodeTagName(""))).toBe(true);
    expect(O.isNone(decodeTagName("tag name"))).toBe(true);
    expect(O.isNone(decodeTagName("tag=value"))).toBe(true);
    expect(O.isNone(decodeTagName("tag<file"))).toBe(true);
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

  it("decodes provenance back out of ucfirst-capitalized -j -G1 keys", () => {
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

    expect(O.isSome(decoded)).toBe(true);
    expect(
      pipe(
        decoded,
        O.map((provenance) => S.encodeSync(BeepQaProvenance)(provenance)),
        O.getOrElse(() => ({}))
      )
    ).toEqual(S.encodeSync(BeepQaProvenance)(fullProvenance));

    expect(
      O.isNone(
        provenanceFromRawTags({
          "XMP-beepQA:ActionId": "act-9",
          "XMP-beepQA:CapturedAtEpochMs": 1753900000000,
          "XMP-beepQA:ScenarioName": "sash-drag",
        })
      )
    ).toBe(true);
  });
});
