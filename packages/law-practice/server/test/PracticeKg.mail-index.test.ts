import {
  attributePracticeKgMailIndexRows,
  matchPracticeKgMatterReferences,
  PracticeKgMailIndexCounts,
  PracticeKgMailIndexInput,
  PracticeKgMailIndexInternetHeaders,
  PracticeKgMailIndexOutlookHeaders,
  PracticeKgMailIndexRecipient,
  PracticeKgMailIndexRow,
  PracticeKgMatterDocketRow,
  PracticeKgMatterRow,
  PracticeKgMatterTables,
  PracticeKgProjectionError,
  readPracticeKgMailIndex,
} from "@beep/law-practice-server";
import { extractPracticeKgReferences } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const matter = (familyKey: string, family: string, client: string | null) =>
  PracticeKgMatterRow.make({
    attributionSource: "text-reference",
    client,
    clientName: null,
    docketCount: 1,
    documentCount: 1,
    epistemicStatus: "derived-from-official-records",
    family,
    familyKey,
  });

const docket = (
  docketKey: string,
  code: string,
  familyKey: string,
  applicationNumbers: ReadonlyArray<string> = [],
  patentNumbers: ReadonlyArray<string> = []
) =>
  PracticeKgMatterDocketRow.make({
    applicationNumbers,
    docket: code,
    docketKey,
    documentCount: 1,
    epistemicStatus: "derived-from-official-records",
    familyKey,
    patentNumbers,
  });

// Two clients share the bare docket code 23456US; 34567 is a matter without a client.
const tables = PracticeKgMatterTables.make({
  dockets: [
    docket("11111.12345EP", "12345EP", "11111.12345"),
    docket("11111.12345US", "12345US", "11111.12345", ["16000001"], ["10000001"]),
    docket("11111.23456US", "23456US", "11111.23456"),
    docket("22222.23456US", "23456US", "22222.23456"),
    docket("34567US", "34567US", "34567"),
  ],
  matters: [
    matter("11111.12345", "12345", "11111"),
    matter("11111.23456", "23456", "11111"),
    matter("22222.23456", "23456", "22222"),
    matter("34567", "34567", null),
  ],
});

type Internet = ConstructorParameters<typeof PracticeKgMailIndexInternetHeaders>[0];
type Outlook = ConstructorParameters<typeof PracticeKgMailIndexOutlookHeaders>[0];
type Recipient = ConstructorParameters<typeof PracticeKgMailIndexRecipient>[0];

const row = (
  tree: string,
  messagePath: string,
  internet: Internet | undefined,
  outlook: Outlook = {},
  recipients: ReadonlyArray<Recipient> = []
) =>
  PracticeKgMailIndexRow.make({
    ...(internet === undefined ? {} : { internet: PracticeKgMailIndexInternetHeaders.make(internet) }),
    messagePath,
    outlook: PracticeKgMailIndexOutlookHeaders.make(outlook),
    recipients: A.map(recipients, (recipient) => PracticeKgMailIndexRecipient.make(recipient)),
    tree,
  });

const exchangeAddress = "/O=EXCHANGE/OU=FIRST ADMINISTRATIVE GROUP/CN=RECIPIENTS/CN=COUNSEL";
const exchangeLower = "/o=exchange/ou=first administrative group/cn=recipients/cn=counsel";

// The identity of an item without a Message-ID: MAPI time, sender, subject, sorted recipients.
const mapiKey = (...parts: ReadonlyArray<string>) => `mail:mapi:${A.join(parts, "\u0000")}`;
const sentItemKey = mapiKey(
  "Jan 02, 2026 03:04:05.000000000 UTC",
  exchangeLower,
  "11111.23456US",
  exchangeLower,
  "client@example.com"
);

const rows = [
  row("extract", "artifact:aaaa.export/Top of Outlook data file/Inbox/Message00001", {
    cc: ["sam@other.test"],
    date: "Tue, 6 Oct 2026 10:00:00 +0000",
    from: "Pat <Pat@Example.com>",
    messageId: "<1@example.com>",
    subject: "RE: 11111.12345US office action",
    to: ["counsel@practice.test", "'pat@example.com'"],
  }),
  // The same message exported again in the newer tree: one message, the first row wins.
  row("extract-2026-07-refresh", "artifact:bbbb.export/Top of Outlook data file/Inbox/Message00009", {
    cc: [],
    from: "pat@example.com",
    messageId: "<1@example.com>",
    subject: "RE: 11111.12345US office action",
    to: ["counsel@practice.test"],
  }),
  // A bare docket code two clients share: ambiguous, left out.
  row("extract", "artifact:aaaa.export/Top of Outlook data file/Inbox/Message00002", undefined, {
    subject: "23456US status",
  }),
  // No RFC 5322 headers: the conversation topic places it; Exchange addresses are dropped.
  row(
    "extract",
    "artifact:aaaa.export/Top of Outlook data file/Sent Items/Message00003",
    undefined,
    {
      clientSubmitTime: "Jan 02, 2026 03:04:05.000000000 UTC",
      conversationTopic: "11111.23456US",
      senderEmailAddress: exchangeAddress,
    },
    [{ emailAddress: "client@example.com", kind: "to" }, { emailAddress: exchangeAddress, kind: "cc" }, { kind: "bcc" }]
  ),
  row("extract", "artifact:aaaa.export/Top of Outlook data file/Inbox/Message00004", {
    cc: [],
    from: "x@y.test",
    subject: "lunch",
    to: [],
  }),
  // Placed, but no address anywhere.
  row("extract", "artifact:aaaa.export/Top of Outlook data file/Inbox/Message00005", {
    cc: [],
    subject: "12345US",
    to: [],
  }),
  // A matter without a client.
  row(
    "extract",
    "artifact:aaaa.export/Top of Outlook data file/Inbox/Message00006",
    undefined,
    { senderEmailAddress: "Sam@Other.test", subject: "34567US drawings" },
    [{ emailAddress: "counsel@practice.test", kind: "unknown" }]
  ),
];

describe("practice KG mail index", () => {
  it("resolves subject references the way the lookup does, minus client and bare family", () => {
    const match = matchPracticeKgMatterReferences(tables);
    const hits = (text: string) =>
      A.map(match(extractPracticeKgReferences(text)), (hit) => [hit.familyKey, hit.matchedOn]);
    expect(hits("RE: 11111.12345US office action")).toStrictEqual([["11111.12345", "docket-key"]]);
    expect(hits("11111.12345EP2 filed")).toStrictEqual([["11111.12345", "family-key"]]);
    expect(hits("12345US")).toStrictEqual([["11111.12345", "docket"]]);
    expect(hits("23456US")).toStrictEqual([
      ["11111.23456", "docket"],
      ["22222.23456", "docket"],
    ]);
    expect(hits("application 16/000,001")).toStrictEqual([["11111.12345", "application"]]);
    expect(hits("US 10,000,001 B2")).toStrictEqual([["11111.12345", "patent"]]);
    expect(hits("34567US")).toStrictEqual([["34567", "docket"]]);
    expect(hits("client 11111 and family 12345")).toStrictEqual([]);
    // Text that is not a reference at all resolves to nothing.
    expect(match(["not a reference", ""])).toStrictEqual([]);
    expect(hits("12345US and 11111.12345US")).toStrictEqual([
      ["11111.12345", "docket"],
      ["11111.12345", "docket-key"],
    ]);
  });

  it("places distinct messages by subject, reads participants from either header set, and counts the rest", () => {
    const result = attributePracticeKgMailIndexRows(tables)(rows);
    expect(result.counts).toStrictEqual(
      PracticeKgMailIndexCounts.make({
        ambiguousMessages: 1,
        attributedMessages: 4,
        attributedWithoutAddress: 1,
        distinctMessages: 6,
        exchangeAddressesDropped: 2,
        rows: 7,
        unreferencedMessages: 1,
      })
    );
    expect(A.map(result.messages, (message) => message.digest)).toStrictEqual([
      "mail:1@example.com",
      "mail:extract/artifact:aaaa.export/Top of Outlook data file/Inbox/Message00005",
      "mail:extract/artifact:aaaa.export/Top of Outlook data file/Inbox/Message00006",
      sentItemKey,
    ]);
    expect(A.map(result.messages, (message) => message.messageId)).toStrictEqual([
      "1@example.com",
      undefined,
      undefined,
      undefined,
    ]);
    expect(
      A.map(result.messages, (message) => [
        message.createdAt,
        A.map(message.participants, (participant) => `${participant.role}:${participant.address}`),
      ])
    ).toStrictEqual([
      [
        "2026-10-06T10:00:00.000Z",
        ["from:pat@example.com", "to:counsel@practice.test", "to:pat@example.com", "cc:sam@other.test"],
      ],
      [null, []],
      [null, ["from:sam@other.test", "to:counsel@practice.test"]],
      ["2026-01-02T03:04:05.000Z", ["to:client@example.com"]],
    ]);
    expect(
      A.map(result.attributions, (attribution) => [
        attribution.digest,
        attribution.familyKey,
        attribution.client,
        attribution.family,
        attribution.attributionSource,
        attribution.recycled,
      ])
    ).toStrictEqual([
      ["mail:1@example.com", "11111.12345", "11111", "12345", "subject-reference", false],
      [
        "mail:extract/artifact:aaaa.export/Top of Outlook data file/Inbox/Message00005",
        "11111.12345",
        "11111",
        "12345",
        "subject-reference",
        false,
      ],
      [
        "mail:extract/artifact:aaaa.export/Top of Outlook data file/Inbox/Message00006",
        "34567",
        null,
        "34567",
        "subject-reference",
        false,
      ],
      [sentItemKey, "11111.23456", "11111", "23456", "subject-reference", false],
    ]);
  });

  it("counts an item without a Message-ID once across export trees, and reads the rarer header shapes", () => {
    const filingReceipt = (tree: string, messagePath: string) =>
      row(
        tree,
        messagePath,
        undefined,
        {
          deliveryTime: "Jan 03, 2026 04:05:06.000000000 UTC",
          sentRepresentingEmailAddress: "Rep@Example.com",
          subject: "12345US filing receipt",
        },
        [{ emailAddress: "Blind@Example.com", kind: "bcc" }]
      );
    const result = attributePracticeKgMailIndexRows(tables)([
      filingReceipt("extract", "artifact:aaaa.export/Top of Outlook data file/Inbox/Message00010"),
      // The same item in the later export: another tree, another artifact, another path.
      filingReceipt("extract-2026-07-refresh", "artifact:bbbb.export/Inbox/Message00077"),
      // No subject anywhere: nothing to resolve.
      row("extract", "artifact:aaaa.export/Top of Outlook data file/Inbox/Message00011", {
        cc: [],
        from: "a@b.test",
        to: [],
      }),
      // A time but no sender, and RFC 5322 recipients without a From header.
      row(
        "extract",
        "artifact:aaaa.export/Top of Outlook data file/Inbox/Message00012",
        { cc: [], subject: "11111.23456US", to: ["Client@Example.com"] },
        { clientSubmitTime: "Jan 04, 2026 05:06:07.000000000 UTC" }
      ),
    ]);
    expect(result.counts).toStrictEqual(
      PracticeKgMailIndexCounts.make({
        ambiguousMessages: 0,
        attributedMessages: 2,
        attributedWithoutAddress: 0,
        distinctMessages: 3,
        exchangeAddressesDropped: 0,
        rows: 4,
        unreferencedMessages: 1,
      })
    );
    expect(
      A.map(result.messages, (message) => [
        message.digest,
        message.createdAt,
        A.map(message.participants, (participant) => `${participant.role}:${participant.address}`),
      ])
    ).toStrictEqual([
      [
        mapiKey(
          "Jan 03, 2026 04:05:06.000000000 UTC",
          "rep@example.com",
          "12345US filing receipt",
          "blind@example.com"
        ),
        "2026-01-03T04:05:06.000Z",
        ["from:rep@example.com", "cc:blind@example.com"],
      ],
      [
        mapiKey("Jan 04, 2026 05:06:07.000000000 UTC", "", "11111.23456US"),
        "2026-01-04T05:06:07.000Z",
        ["to:client@example.com"],
      ],
    ]);
  });

  it.layer(Layer.fresh(NodeServices.layer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "reads index files in order, ignores the fields it does not need, and names a bad line",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-mail-index-" });
        const first = path.join(directory, "messages-extract.jsonl");
        const second = path.join(directory, "messages-extract-refresh.jsonl");
        // Full index rows carry attachments, body, and folder fields the build never reads.
        const fullRow = {
          attachments: [
            { fileName: "Attachment00001.pdf", kind: "file", ordinal: 1, relativePath: "x", sizeBytes: 12 },
          ],
          bodyFileName: "Message.txt",
          bodySizeBytes: 100,
          embeddedDepth: 0,
          folderPath: "Top of Outlook data file/Inbox",
          internet: {
            cc: [],
            contentType: "text/plain",
            date: "Tue, 6 Oct 2026 10:00:00 +0000",
            from: "pat@example.com",
            inReplyTo: "<0@example.com>",
            messageId: "<1@example.com>",
            references: ["<0@example.com>"],
            subject: "RE: 11111.12345US office action",
            to: ["counsel@practice.test"],
          },
          messagePath: "artifact:aaaa.export/Top of Outlook data file/Inbox/Message00001",
          outlook: { flags: "0x1", sizeBytes: 2048, subject: "RE: 11111.12345US office action" },
          recipients: [
            { addressType: "SMTP", displayName: "Counsel", emailAddress: "counsel@practice.test", kind: "to" },
          ],
          sourceArtifactId: "artifact:aaaa",
          tree: "extract",
        };
        const fullLine = yield* encodeJson(fullRow);
        yield* fs.writeFileString(first, `${fullLine}\n\n`);
        const refreshLine = yield* encodeJson({
          ...fullRow,
          messagePath: "artifact:bbbb.export/Inbox/Message00007",
          tree: "extract-2026-07-refresh",
        });
        yield* fs.writeFileString(second, `${refreshLine}\n`);
        const result = yield* readPracticeKgMailIndex(
          PracticeKgMailIndexInput.make({ paths: [first, second], tables })
        );
        expect([result.counts.rows, result.counts.distinctMessages, result.counts.attributedMessages]).toStrictEqual([
          2, 1, 1,
        ]);
        expect(A.map(result.messages, (message) => message.digest)).toStrictEqual(["mail:1@example.com"]);

        yield* fs.writeFileString(first, `${fullLine}\n{"tree":"extract"}\n`);
        const bad = yield* Effect.flip(
          readPracticeKgMailIndex(PracticeKgMailIndexInput.make({ paths: [first], tables }))
        );
        assertInstanceOf(bad, PracticeKgProjectionError);
        expect(bad.message).toBe(`Mail index "${first}" line 2 is not a message row.`);

        const missing = path.join(directory, "missing.jsonl");
        const unreadable = yield* Effect.flip(
          readPracticeKgMailIndex(PracticeKgMailIndexInput.make({ paths: [missing], tables }))
        );
        expect(unreadable.message).toBe(`Failed reading mail index "${missing}".`);

        const none = yield* readPracticeKgMailIndex(PracticeKgMailIndexInput.make({ paths: [], tables }));
        expect(none.counts.rows).toBe(0);
      })
    );
  });
});
