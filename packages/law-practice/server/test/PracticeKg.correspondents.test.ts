import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import {
  buildPracticeKgCorrespondentTables,
  isPracticeKgPracticeAddress,
  normalizePracticeKgMessageId,
  PracticeKgContact,
  PracticeKgContactsError,
  PracticeKgCorrespondentTablesInput,
  PracticeKgDocumentAttribution,
  PracticeKgEmailMessage,
  PracticeKgEmailMessagesInput,
  PracticeKgEmailParticipant,
  parsePracticeKgCorrespondentAddress,
  readPracticeKgContacts,
  readPracticeKgEmailMessages,
  withDuckDb,
} from "@beep/law-practice-server";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const attribution = (digest: string, familyKey: string | null, recycled = false) =>
  PracticeKgDocumentAttribution.make({
    attributionSource: "folder-path",
    client: familyKey === null ? null : "11111",
    digest,
    docket: null,
    docketKey: null,
    family: familyKey === null ? null : "20001",
    familyKey,
    recycled,
  });

const participant = (address: string, role: PracticeKgEmailParticipant["role"], name: string | null = null) =>
  PracticeKgEmailParticipant.make({ address, name, role });

const contact = (contactId: string, address: string, role: boolean) =>
  PracticeKgContact.make({
    contactId,
    displayName: `Contact ${contactId}`,
    emails: [{ address, role }],
    links: [],
    organization: null,
    sources: ["vcf"],
  });

const contactLine = (source: string): Effect.Effect<string> =>
  Effect.orDie(
    encodeJson({
      contactId: "c_aaaaaaaaaaaa",
      displayName: "Pat Example",
      emails: [{ address: "pat@example.com", role: false }],
      links: [{ clientNumber: "11111", evidence: "12 message(s)", familyKey: "11111.20001", source }],
      organization: null,
      sources: ["csv"],
    })
  );

describe("practice KG correspondents", () => {
  it("recognises the practice's own domains and their subdomains only", () => {
    const isPractice = isPracticeKgPracticeAddress(["@Example-Law.test"]);
    expect(
      A.map(["ann@example-law.test", "ann@mail.example-law.test", "pat@notexample-law.test"], isPractice)
    ).toStrictEqual([true, true, false]);
  });

  it("counts each message once per matter and address, skips stubs and unattributed mail, and leaves shared addresses unowned", () => {
    const tables = buildPracticeKgCorrespondentTables(
      PracticeKgCorrespondentTablesInput.make({
        attributions: [
          attribution("m2", "11111.20001"),
          attribution("m1", "11111.20001"),
          attribution("stub", "11111.20001", true),
          attribution("loose", null),
        ],
        contacts: [
          contact("c_bbbbbbbbbbbb", "Shared@Example.com", false),
          contact("c_aaaaaaaaaaaa", "shared@example.com", true),
        ],
        messages: [
          PracticeKgEmailMessage.make({
            createdAt: null,
            digest: "m2",
            participants: [
              participant("shared@example.com", "cc", "Later Name"),
              participant("late@example.com", "from"),
            ],
          }),
          PracticeKgEmailMessage.make({
            createdAt: "2026-01-01T00:00:00Z",
            digest: "m1",
            participants: [
              participant("shared@example.com", "to", "First Name"),
              participant("shared@example.com", "cc"),
            ],
          }),
          PracticeKgEmailMessage.make({
            createdAt: null,
            digest: "stub",
            participants: [participant("x@example.com", "to")],
          }),
          PracticeKgEmailMessage.make({
            createdAt: null,
            digest: "loose",
            participants: [participant("y@example.com", "to")],
          }),
          PracticeKgEmailMessage.make({
            createdAt: null,
            digest: "unknown",
            participants: [participant("z@example.com", "to")],
          }),
        ],
        practiceDomains: [],
      })
    );
    expect(
      A.map(tables.correspondents, (row) => [
        row.address,
        row.contactId,
        row.displayName,
        row.roleAddress,
        row.messageCount,
        row.toCount,
        row.ccCount,
        row.firstAt,
      ])
    ).toStrictEqual([
      ["late@example.com", null, null, false, 1, 0, 0, null],
      ["shared@example.com", null, "First Name", false, 2, 1, 2, "2026-01-01T00:00:00Z"],
    ]);
    expect(A.map(tables.addresses, (row) => [row.address, row.contactId, row.roleAddress])).toStrictEqual([
      ["shared@example.com", "c_aaaaaaaaaaaa", true],
      ["shared@example.com", "c_bbbbbbbbbbbb", false],
    ]);
  });

  it("counts a filed message and its archive copy once, by Message-ID", () => {
    const filed = PracticeKgEmailMessage.make({
      createdAt: "2026-02-01T10:00:00Z",
      digest: "sha256:f1",
      messageId: "1@example.com",
      participants: [participant("pat@example.com", "from"), participant("sam@other.test", "to")],
    });
    // The archive copy of the same message, and one more message that has no Message-ID.
    const archived = PracticeKgEmailMessage.make({
      createdAt: "2026-02-01T10:00:00.000Z",
      digest: "mail:1@example.com",
      messageId: " <1@example.com> ",
      participants: [participant("pat@example.com", "from"), participant("sam@other.test", "to")],
    });
    const other = PracticeKgEmailMessage.make({
      createdAt: null,
      digest: "sha256:f2",
      participants: [participant("pat@example.com", "to")],
    });
    const tables = buildPracticeKgCorrespondentTables(
      PracticeKgCorrespondentTablesInput.make({
        attributions: [
          attribution("sha256:f1", "11111.20001"),
          attribution("mail:1@example.com", "11111.20001"),
          attribution("sha256:f2", "11111.20001"),
        ],
        contacts: [],
        messages: [filed, archived, other],
        practiceDomains: [],
      })
    );
    expect(
      A.map(tables.correspondents, (row) => [row.address, row.messageCount, row.fromCount, row.toCount])
    ).toStrictEqual([
      ["pat@example.com", 2, 1, 1],
      ["sam@other.test", 1, 0, 1],
    ]);
    expect(O.getOrNull(normalizePracticeKgMessageId(" <1@example.com> "))).toBe("1@example.com");
    assertNone(normalizePracticeKgMessageId(" <> "));
  });

  it("treats one contact listing an address twice as one owner, a role mailbox if either listing says so", () => {
    const tables = buildPracticeKgCorrespondentTables(
      PracticeKgCorrespondentTablesInput.make({
        attributions: [attribution("m1", "11111.20001")],
        contacts: [
          PracticeKgContact.make({
            contactId: "c_aaaaaaaaaaaa",
            displayName: "Example Docketing",
            emails: [
              { address: "Docketing@Example.com", role: false },
              { address: "docketing@example.com", role: true },
            ],
            links: [],
            organization: null,
            sources: ["csv"],
          }),
          PracticeKgContact.make({
            contactId: "c_bbbbbbbbbbbb",
            displayName: "Example Info",
            emails: [
              { address: "info@example.com", role: true },
              { address: "INFO@example.com", role: false },
            ],
            links: [],
            organization: null,
            sources: ["vcf"],
          }),
        ],
        messages: [
          PracticeKgEmailMessage.make({
            createdAt: null,
            digest: "m1",
            participants: [participant("docketing@example.com", "to"), participant("info@example.com", "cc")],
          }),
        ],
        practiceDomains: [],
      })
    );
    const owners = [
      ["docketing@example.com", "c_aaaaaaaaaaaa", true],
      ["info@example.com", "c_bbbbbbbbbbbb", true],
    ];
    expect(A.map(tables.correspondents, (row) => [row.address, row.contactId, row.roleAddress])).toStrictEqual(owners);
    expect(A.map(tables.addresses, (row) => [row.address, row.contactId, row.roleAddress])).toStrictEqual(owners);
  });

  it.effect(
    "reads one address from a bare address or one header entry, and refuses none or several",
    Effect.fnUntraced(function* () {
      expect(yield* parsePracticeKgCorrespondentAddress(" Pat@Example.com ")).toBe("pat@example.com");
      // An apostrophe is legal in a local part; it must not cut the address short.
      expect(yield* parsePracticeKgCorrespondentAddress("O'Brien@Example.com")).toBe("o'brien@example.com");
      expect(yield* parsePracticeKgCorrespondentAddress("Pat O'Brien <o'brien@example.com>")).toBe(
        "o'brien@example.com"
      );
      expect(yield* parsePracticeKgCorrespondentAddress('"Example, Pat" <Pat@Example.com>')).toBe("pat@example.com");
      // A bare address wrapped in single quotes loses the quotes, in a lookup input and inside a header.
      expect(yield* parsePracticeKgCorrespondentAddress("'pat@example.com'")).toBe("pat@example.com");
      expect(yield* parsePracticeKgCorrespondentAddress("'pat@example.com', Pat <PAT@example.com>")).toBe(
        "pat@example.com"
      );
      expect(yield* parsePracticeKgCorrespondentAddress("pat@example.com, Pat <PAT@example.com>")).toBe(
        "pat@example.com"
      );
      const several = yield* Effect.flip(parsePracticeKgCorrespondentAddress("pat@example.com, sam@other.test"));
      const none = yield* Effect.flip(parsePracticeKgCorrespondentAddress("Pat Example"));
      expect([several.addressCount, none.addressCount, none.message]).toStrictEqual([
        2,
        0,
        "Expected one email address; the input holds 0.",
      ]);
    })
  );

  it("compares PracticeKgContactsError by its diagnostic fields, not its cause", () => {
    const same = S.toEquivalence(PracticeKgContactsError);
    const make = (lineNumber: number, diagnostic: string) =>
      PracticeKgContactsError.make({
        cause: { diagnostic },
        lineNumber,
        message: "Contact line is invalid.",
        path: "/c.jsonl",
      });
    pipe(same(make(2, "first"), make(2, "second")), assertTrue);
    pipe(same(make(2, "first"), make(3, "first")), assertFalse);
  });

  it.layer(Layer.fresh(NodeServices.layer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "reads contacts, and names the line and the value of an unknown link source",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-contacts-" });
        const contactsPath = path.join(directory, "contacts.jsonl");

        yield* fs.writeFileString(
          contactsPath,
          `${yield* contactLine("email-subject-ref")}\n\n${yield* contactLine("attorney-answer")}\n`
        );
        const contacts = yield* readPracticeKgContacts(contactsPath);
        expect(A.map(contacts, (row) => row.links[0]?.source)).toStrictEqual(["email-subject-ref", "attorney-answer"]);

        yield* fs.writeFileString(
          contactsPath,
          `${yield* contactLine("attorney-answer")}\n${yield* contactLine("phone-book")}\n`
        );
        const unknown = yield* Effect.flip(readPracticeKgContacts(contactsPath));
        expect([unknown.lineNumber, unknown.unknownSource, unknown.message]).toStrictEqual([
          2,
          "phone-book",
          `Contacts "${contactsPath}" line 2 has unknown link source "phone-book".`,
        ]);

        yield* fs.writeFileString(contactsPath, '{"contactId":"c_bad"}\n');
        const invalid = yield* Effect.flip(readPracticeKgContacts(contactsPath));
        expect([invalid.lineNumber, invalid.unknownSource, invalid.message]).toStrictEqual([
          1,
          undefined,
          `Contacts "${contactsPath}" line 1 is not a valid contact row.`,
        ]);

        const missing = yield* Effect.flip(readPracticeKgContacts(path.join(directory, "missing.jsonl")));
        expect(missing.lineNumber).toBeUndefined();
      })
    );

    it.effect(
      "reads the Message-ID of a filed email whatever case its header name is written in",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-mail-headers-" });
        const databasePath = path.join(directory, "practice.duckdb");
        const extractRoot = path.join(directory, "extract");
        yield* fs.makeDirectory(path.join(extractRoot, "metadata"), { recursive: true });
        // Five filed emails: three spellings of the header name, one unusable value, one message without the header.
        const metadata: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
          ["a", { "Message-From": "pat@example.com", "Message:Raw-Header:Message-Id": "<a@example.com>" }],
          ["b", { "MESSAGE:RAW-HEADER:MESSAGE-ID": [" <b@example.com> "], "Message-From": "pat@example.com" }],
          ["c", { "Message-From": "pat@example.com", "Message:Raw-Header:Message-ID": "<c@example.com>" }],
          ["d", { "Message-From": "pat@example.com", "Message:Raw-Header:Message-ID": 7 }],
          ["e", { "Message-From": "pat@example.com" }],
        ];
        yield* Effect.forEach(metadata, ([name, fields]) =>
          Effect.flatMap(encodeJson(fields), (json) =>
            fs.writeFileString(path.join(extractRoot, "metadata", `operation:op-${name}.json`), json)
          )
        );
        const sourceLines = yield* Effect.forEach(metadata, ([name]) =>
          encodeJson({ digest: `sha256:${name}`, operationId: `operation:op-${name}` })
        );
        const sourcesPath = path.join(extractRoot, "sources.jsonl");
        yield* fs.writeFileString(sourcesPath, `${A.join(sourceLines, "\n")}\n`);
        yield* Effect.gen(function* () {
          const db = yield* DuckDb;
          yield* db.run("CREATE TABLE documents (digest VARCHAR PRIMARY KEY, effective_name VARCHAR NOT NULL)");
          yield* Effect.forEach(metadata, ([name]) =>
            db.run("INSERT INTO documents VALUES ($1, $2)", [`sha256:${name}`, `${name}.eml`])
          );
        }).pipe(withDuckDb(DuckDbConnectionOptions.make({ databasePath })));

        const messages = yield* readPracticeKgEmailMessages(
          PracticeKgEmailMessagesInput.make({
            databasePath,
            sourceSpecs: [{ sourcesPath, textGlob: path.join(extractRoot, "text", "*.txt") }],
          })
        );
        expect(A.map(messages, (message) => [message.digest, message.messageId])).toStrictEqual([
          ["sha256:a", "a@example.com"],
          ["sha256:b", "b@example.com"],
          ["sha256:c", "c@example.com"],
          ["sha256:d", undefined],
          ["sha256:e", undefined],
        ]);
      })
    );

    it.effect(
      "reads no email headers when there is no extraction source",
      Effect.fnUntraced(function* () {
        const messages = yield* readPracticeKgEmailMessages(
          PracticeKgEmailMessagesInput.make({ databasePath: "/nowhere/practice.duckdb", sourceSpecs: [] })
        );
        expect(messages).toStrictEqual([]);
      })
    );
  });
});
