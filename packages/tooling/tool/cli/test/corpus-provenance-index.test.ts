import {
  AttachmentMagicSnifferLive,
  AttachmentRepairJournal,
  AttachmentRepairJournalLive,
  AttachmentRepairOptions,
  FileMetadataCensusReaderLive,
  MailExportTreeIndexerLive,
  MailMessageIndexRecordJson,
  MetadataCensusOptions,
  MetadataCensusRecordJson,
  ProvenanceMessagesOptions,
} from "@beep/repo-cli/commands/Corpus";
import {
  fallbackMagicExtensions,
  indexMailExportTrees,
  proposeAttachmentRepair,
  repairAttachmentExtensions,
  runMetadataCensus,
} from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex";
import { AttachmentMagicSniffer } from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex.contracts";
import { MagicSniffResult } from "@beep/repo-cli/commands/Corpus/internal/ProvenanceIndex.schemas";
import { it } from "@beep/test-runner";
import { BunServices } from "@effect/platform-bun";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";

const platform = process.versions.bun === undefined ? NodeServices.layer : BunServices.layer;
const Services = Layer.mergeAll(
  MailExportTreeIndexerLive,
  AttachmentRepairJournalLive,
  AttachmentMagicSnifferLive(),
  FileMetadataCensusReaderLive()
).pipe(Layer.provideMerge(platform));
// Deterministic verdicts keyed by the ordinal prefix: the repair workflow test must not depend
// on the host's libmagic build (the hosted runner's file(1) recognised two of the four fixtures).
type StubVerdict = { readonly mimeType: string; readonly extensions: ReadonlyArray<string> };
const unknownVerdict: StubVerdict = { mimeType: "application/octet-stream", extensions: [] };
const stubVerdicts: Record<string, StubVerdict> = {
  "1_": { mimeType: "application/pdf", extensions: ["pdf"] },
  "2_": { mimeType: "image/jpeg", extensions: ["jpeg", "jpg", "jpe", "jfif"] },
  "3_": { mimeType: "text/plain", extensions: [] },
  "4_": unknownVerdict,
  "5_": { mimeType: "application/pdf", extensions: ["pdf"] },
};
const stubVerdict = (file: string): StubVerdict =>
  stubVerdicts[file.slice(file.lastIndexOf("/") + 1, file.lastIndexOf("/") + 3)] ?? unknownVerdict;
const StubSniffer = Layer.succeed(AttachmentMagicSniffer, {
  sniff: Effect.fn("Test.stubSniff")(function* (paths: ReadonlyArray<string>) {
    return A.map(paths, (file) => MagicSniffResult.make({ path: file, ...stubVerdict(file) }));
  }),
});
const RepairServices = Layer.mergeAll(AttachmentRepairJournalLive, StubSniffer).pipe(Layer.provideMerge(platform));
const pdf =
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";
const jpeg = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9,
]);
const fixture = Effect.fn("test.provenance.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmp = path.join(import.meta.dirname, ".tmp");
  yield* fs.makeDirectory(tmp, { recursive: true });
  const root = yield* fs.makeTempDirectoryScoped({ directory: tmp, prefix: "provenance-" });
  const children = path.join(root, "staging", "extract", "children");
  const first = path.join(
    children,
    `artifact:${"a".repeat(64)}.export`,
    "Top of Outlook data file",
    "Inbox",
    "Message00001"
  );
  const second = path.join(children, `artifact:${"b".repeat(64)}.export`, "Search Root", "Message00002");
  const embedded = path.join(first, "Attachments", "Attachment5", "Message00001");
  for (const directory of [first, second, embedded]) {
    yield* fs.makeDirectory(directory, { recursive: true });
    yield* fs.writeFileString(
      path.join(directory, "OutlookHeaders.txt"),
      "Subject:\tSynthetic message\nSender name:\tAda\nSender email address:\tada@example.com\nSize:\t100\n"
    );
    yield* fs.writeFileString(path.join(directory, "Message.txt"), "Synthetic body");
  }
  yield* fs.writeFileString(path.join(first, "Message.rtf"), "{\\rtf1 body}");
  yield* fs.writeFileString(
    path.join(first, "InternetHeaders.txt"),
    'Message-ID: <synthetic@example.com>\r\nTo: "Doe, Ada" <ada@example.com>,\r\n bob@example.com\r\nReferences: <one> <two>\r\n'
  );
  yield* fs.writeFileString(
    path.join(first, "Recipients.txt"),
    "Recipient type:\tTo\nRecipient display name:\tAda\nEmail address:\tada@example.com\n\nRecipient type:\tCc\nDisplay name:\tBob\nEmail address:\tbob@example.com\nAddress type:\tSMTP\n"
  );
  yield* fs.writeFileString(path.join(first, "ConversationIndex.txt"), "Conversation index: abc123\nHeader: x");
  const attachments = path.join(first, "Attachments");
  yield* fs.writeFileString(path.join(attachments, "1_report.p"), pdf);
  yield* fs.writeFile(path.join(attachments, "2_photo.j"), jpeg);
  yield* fs.writeFileString(path.join(attachments, "3_notes."), "Synthetic text notes\n");
  yield* fs.writeFile(path.join(attachments, "4_blob"), Uint8Array.from([0, 1, 254, 233, 0, 129, 145, 0]));
  // pffexport keeps Windows backslashes inside attachment names; the repair must treat them as plain bytes.
  yield* fs.writeFileString(path.join(attachments, "5_memo\\draft.p"), pdf);
  // An in-boundary directory symlink back to an ancestor: every walker must skip it instead of looping.
  yield* fs.symlink(children, path.join(second, "loop"));
  return { root, first, second, embedded, attachments };
});
const lines = (text: string) => A.filter(Str.split(text, /\r?\n/), Str.isNonEmpty);

describe("attachment proposal rule", () => {
  for (const [name, mime, extensions, flag, proposed] of [
    ["1_report.p", "application/pdf", ["pdf"], "exact-completion", "1_report.pdf"],
    ["12_report.p", "application/pdf", ["pdf"], "inexact-completion", "12_report.pdf"],
    ["2_photo.j", "image/jpeg", ["jpeg", "jpg", "jpe", "jfif"], "exact-completion", "2_photo.jpg"],
    ["3_notes.", "text/plain", ["txt"], "extension-fully-eaten", "3_notes.txt"],
    ["3_notes", "text/plain", ["txt"], "extension-fully-eaten", "3_notes.txt"],
    ["1_report.xyz", "application/pdf", ["pdf"], "remnant-mismatch", "1_report.xyz.pdf"],
    ["4_blob", "application/octet-stream", ["bin"], "ambiguous-mime", undefined],
    ["1_report.p", "application/pdf", [], "ambiguous-mime", undefined],
    ["1_report.pdf", "application/pdf", ["PDF"], "already-consistent", undefined],
    ["report.p", "application/pdf", ["pdf"], "no-ordinal-prefix", undefined],
  ] satisfies ReadonlyArray<readonly [string, string, ReadonlyArray<string>, string, string | undefined]>) {
    it(`${flag}: ${name}`, () => {
      const result = proposeAttachmentRepair(name, mime, extensions);
      expect(result.flags).toEqual([flag]);
      expect(result.proposedFileName).toBe(proposed);
      expect(result.decision).toBe(proposed === undefined ? "skip" : "rename");
    });
  }
});

describe("fallback magic extensions", () => {
  for (const [mime, name, expected] of [
    ["audio/mpeg", "1_song.m", ["mp3"]],
    ["application/zip", "12_brief.do", ["docx", "dotx"]],
    ["text/html", "1_page", ["html", "htm"]],
    ["text/plain", "1_notes.s", []],
    ["application/octet-stream", "1_blob", []],
  ] satisfies ReadonlyArray<readonly [string, string, ReadonlyArray<string>]>) {
    it(`${mime}: ${name}`, () => {
      expect(fallbackMagicExtensions(mime, name)).toEqual(expected);
    });
  }
  it("completes an mp3 remnant through the fallback table", () => {
    const result = proposeAttachmentRepair("1_song.m", "audio/mpeg", fallbackMagicExtensions("audio/mpeg", "1_song.m"));
    expect(result.flags).toEqual(["exact-completion"]);
    expect(result.proposedFileName).toBe("1_song.mp3");
  });
});

it.layer(Services, { timeout: "30 seconds" })((it) => {
  it.effect("indexes two artifacts and a nested embedded message with counts and parsed headers", () =>
    Effect.gen(function* () {
      const { root } = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const summaries = yield* indexMailExportTrees(
        ProvenanceMessagesOptions.make({ corpusRoot: root, trees: ["extract"] })
      );
      expect(summaries[0]).toMatchObject({
        sourceArtifactCount: 2,
        messageCount: 3,
        embeddedMessageCount: 1,
        internetHeaderCount: 1,
        messageIdCount: 1,
        recipientCount: 2,
        attachmentCount: 6,
        attachmentBytes: 2 * new TextEncoder().encode(pdf).length + jpeg.length + 21 + 8,
      });
      const rows = yield* Effect.forEach(
        lines(yield* fs.readFileString(path.join(root, "staging/provenance/messages-extract.jsonl"))),
        MailMessageIndexRecordJson.decode
      );
      const parent = rows.find((row) => row.internet !== undefined);
      expect(parent).toMatchObject({
        folderPath: "Inbox",
        embeddedDepth: 0,
        bodyFileName: "Message.rtf",
        conversationIndexHex: "abc123",
        internet: {
          messageId: "<synthetic@example.com>",
          to: ['"Doe, Ada" <ada@example.com>', "bob@example.com"],
          references: ["<one>", "<two>"],
        },
      });
      expect(parent?.recipients.map((r) => r.kind)).toEqual(["to", "cc"]);
      expect(parent?.attachments.find((a) => a.kind === "embedded-message")?.embeddedMessagePath).toContain(
        "Attachments/Attachment5/Message00001"
      );
      expect(rows.find((row) => row.embeddedDepth === 1)?.messagePath).toContain("Attachment5");
      yield* indexMailExportTrees(ProvenanceMessagesOptions.make({ corpusRoot: root, trees: ["extract"] }));
      expect(
        lines(yield* fs.readFileString(path.join(root, "staging/provenance/messages-extract.jsonl")))
      ).toHaveLength(3);
    })
  );

  it.effect("sniffs the PDF fixture by magic bytes through the live file(1) sniffer", () =>
    Effect.gen(function* () {
      const { attachments } = yield* fixture();
      const path = yield* Path.Path;
      const sniffer = yield* AttachmentMagicSniffer;
      const verdicts = yield* sniffer.sniff([path.join(attachments, "1_report.p")]);
      expect(verdicts.map((v) => v.mimeType)).toEqual(["application/pdf"]);
    })
  );

  it.effect("metadata census reads PDF/JPEG bytes and excludes staging sidecars", (ctx) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      if (!(yield* fs.exists("/usr/bin/vendor_perl/exiftool")) && !(yield* fs.exists("/usr/bin/exiftool"))) {
        ctx.skip("exiftool is absent on this host");
        return;
      }
      const { root } = yield* fixture();
      const summary = yield* runMetadataCensus(
        MetadataCensusOptions.make({
          corpusRoot: root,
          roots: ["staging/extract/children"],
          batchSize: 2,
          concurrency: 2,
        })
      );
      expect(summary.fileCount).toBe(5);
      expect(summary.engineVersion).not.toBe("");
      const rows = yield* Effect.forEach(
        lines(yield* fs.readFileString(path.join(root, "staging/provenance/metadata.jsonl"))),
        MetadataCensusRecordJson.decode
      );
      expect(rows.find((row) => row.relativePath.endsWith("1_report.p"))?.fields.fileType).toBe("PDF");
      expect(rows.find((row) => row.relativePath.endsWith("2_photo.j"))?.fields.fileType).toBe("JPEG");
      expect(rows.find((row) => row.relativePath.endsWith("4_blob"))?.status).toBe("error");
      for (const row of rows) expect(Object.keys(row.tags).some((key) => /^(System|File):/.test(key))).toBe(false);
    })
  );
});

it.layer(RepairServices, { timeout: "30 seconds" })((it) => {
  it.effect("plans, applies, journals, skips collisions and undoes actual magic repairs", () =>
    Effect.gen(function* () {
      const { root, attachments } = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const journalPath = path.join(root, "staging/provenance/apply.jsonl");
      const plan = yield* repairAttachmentExtensions(
        AttachmentRepairOptions.make({ corpusRoot: root, trees: ["extract"], mode: "plan" })
      );
      expect(plan.proposedRenames).toBe(4);
      expect(yield* fs.exists(path.join(attachments, "1_report.pdf"))).toBe(false);
      const applied = yield* repairAttachmentExtensions(
        AttachmentRepairOptions.make({ corpusRoot: root, trees: ["extract"], mode: "apply", journalPath })
      );
      expect(applied.byOutcome.renamed).toBe(4);
      expect(yield* fs.exists(path.join(attachments, "1_report.pdf"))).toBe(true);
      expect(yield* fs.exists(path.join(attachments, "2_photo.jpg"))).toBe(true);
      expect(yield* fs.exists(path.join(attachments, "5_memo\\draft.pdf"))).toBe(true);
      // text/plain has no file(1) extension; the fallback table completes the fully eaten name.
      expect(yield* fs.exists(path.join(attachments, "3_notes.txt"))).toBe(true);
      const journal = yield* AttachmentRepairJournal;
      expect((yield* journal.readAll(journalPath)).map((r) => r.outcome)).toEqual(A.makeBy(4, () => "renamed"));
      const undo = yield* repairAttachmentExtensions(
        AttachmentRepairOptions.make({ corpusRoot: root, trees: [], mode: "undo", journalPath })
      );
      expect(undo.byOutcome.reverted).toBe(4);
      expect(yield* fs.exists(path.join(attachments, "1_report.p"))).toBe(true);
      expect(yield* fs.exists(path.join(attachments, "2_photo.j"))).toBe(true);
      expect(yield* fs.exists(path.join(attachments, "5_memo\\draft.p"))).toBe(true);
      yield* fs.writeFileString(path.join(attachments, "1_report.pdf"), "collision content");
      const collision = yield* repairAttachmentExtensions(
        AttachmentRepairOptions.make({
          corpusRoot: root,
          trees: ["extract"],
          mode: "apply",
          journalPath: path.join(root, "staging/provenance/collision.jsonl"),
        })
      );
      expect(collision.byOutcome["skipped-collision"]).toBe(1);
      expect(yield* fs.readFileString(path.join(attachments, "1_report.pdf"))).toBe("collision content");
      yield* fs.writeFile(path.join(attachments, "2_photo.jpg"), Uint8Array.of(1));
      const changed = yield* repairAttachmentExtensions(
        AttachmentRepairOptions.make({
          corpusRoot: root,
          trees: [],
          mode: "undo",
          journalPath: path.join(root, "staging/provenance/collision.jsonl"),
        })
      );
      expect(changed.byOutcome["skipped-size-changed"]).toBe(1);
      yield* fs.remove(path.join(attachments, "2_photo.jpg"));
      const missing = yield* repairAttachmentExtensions(
        AttachmentRepairOptions.make({
          corpusRoot: root,
          trees: [],
          mode: "undo",
          journalPath: path.join(root, "staging/provenance/collision.jsonl"),
        })
      );
      // 2_photo.jpg was removed above; 3_notes.txt and 5_memo\draft.pdf were already reverted by the previous undo.
      expect(missing.byOutcome["skipped-missing"]).toBe(3);
      const malformed = path.join(root, "staging/provenance/malformed.jsonl");
      yield* fs.writeFileString(malformed, '{"fromPath":"incomplete"}\n');
      expect((yield* journal.readAll(malformed).pipe(Effect.result))._tag).toBe("Failure");
    })
  );
});
