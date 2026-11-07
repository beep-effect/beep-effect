import {
  ContactCardSourceFile,
  ContactFilesConfig,
  ContactFilesLocation,
  DocumentExtractionSourceFile,
  DomainRegistrantLookupLive,
  ExtractionBatchesConfig,
  ExtractionBatchesLocation,
  parseOutlookCsv,
  parseVcards,
  registrantFromRdap,
  UsptoRecordLookupLive,
} from "@beep/law-practice-server/DocumentIdentification";
import {
  ContactCardSource,
  DocumentExtractionSource,
  DomainRegistrantLookup,
  normaliseContacts,
  UsptoRecordLookup,
} from "@beep/law-practice-use-cases/DocumentIdentification";
import { Uspto, UsptoConfigInput } from "@beep/uspto";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as M from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const csv =
  'First Name,Last Name,Company,E-mail Address,Business Phone\r\nAlex,Example,"Acme, Widgets LLC",alex@acme.example,(212) 555-0100\r\n';
const vcf =
  "BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Alex Example\r\nORG:Acme\\, Widgets LLC\r\nitem1.EMAIL:alex@acme.\r\n example\r\nTEL;VALUE=uri:tel:+1-212-555-0100\r\nEND:VCARD\r\n";
const withService = <I, T, E, R>(tag: Context.Service<I, T>, layer: Layer.Layer<I, E, R>) =>
  Effect.map(Layer.build(layer), Context.get(tag));
const fakeFs = (files: ReadonlyArray<readonly [string, string]>) => {
  const entries = M.fromIterable(files);
  return Layer.succeed(
    FileSystem.FileSystem,
    FileSystem.makeNoop({
      readFileString: (file) =>
        O.match(M.get(entries, file), {
          onNone: () => Effect.die("unrecorded synthetic file"),
          onSome: Effect.succeed,
        }),
    })
  );
};
const response = (body: unknown, status: number, urls: Array<string>) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.gen(function* () {
        urls.push(request.url);
        const json = yield* encodeJson(body).pipe(Effect.orDie);
        return HttpClientResponse.fromWeb(
          request,
          new Response(json, { status, headers: { "content-type": "application/json" } })
        );
      })
    )
  );
const record = {
  count: 1,
  patentFileWrapperDataBag: [
    {
      applicationNumberText: "18900001",
      applicationMetaData: {
        docketNumber: "90001.10001US01",
        firstApplicantName: "Acme Widgets LLC",
        patentNumber: "99000001",
      },
    },
  ],
};
const usptoLayer = (body: unknown, status: number, urls: Array<string>) =>
  UsptoRecordLookupLive.pipe(
    Layer.provide(
      Uspto.makeLayer(UsptoConfigInput.make({ apiKey: Redacted.make("synthetic-key") })).pipe(
        Layer.provide(response(body, status, urls))
      )
    )
  );

describe("recorded contacts", () => {
  it.effect("reads a CSV/vCard path pair, folds v4 lines and deduplicates the same contact", () =>
    Effect.gen(function* () {
      const source = yield* withService(
        ContactCardSource,
        ContactCardSourceFile.pipe(
          Layer.provide(
            Layer.succeed(
              ContactFilesLocation,
              ContactFilesConfig.make({ csvPath: "/synthetic/cards.csv", vcardPath: "/synthetic/cards.vcf" })
            )
          ),
          Layer.provide(
            fakeFs([
              ["/synthetic/cards.csv", csv],
              ["/synthetic/cards.vcf", vcf],
            ])
          )
        )
      );
      const cards = yield* Stream.runCollect(source.cards);
      const contacts = normaliseContacts(cards);
      expect(contacts).toHaveLength(1);
      expect(contacts[0]?.sources).toEqual(["outlook-csv", "vcard"]);
    })
  );
  it.effect("handles CSV quotes, multiline fields and vCard 3 structured names and addresses", () =>
    Effect.gen(function* () {
      const cards = yield* parseOutlookCsv('First Name,Company\n"Alex\nExample","Acme ""Widgets"" LLC"\n');
      const trailing = yield* parseOutlookCsv("First Name,Last Name,Company\nAlex,Example,");
      expect(trailing).toHaveLength(1);
      assertNone(O.flatMap(A.head(trailing), (c) => c.organization));
      assertSome(
        O.flatMap(A.head(cards), (c) => c.organization),
        'Acme "Widgets" LLC'
      );
      const v3 = yield* parseVcards(
        "BEGIN:VCARD\nVERSION:3.0\nN:Example;Alex;;;\nADR:;;1 Test Street;Example City;NY;10001;US\nEMAIL:info@acme.example\nEND:VCARD"
      );
      expect(v3[0]?.displayName).toBe("Alex Example");
      expect(v3[0]?.addresses[0]).toContain("1 Test Street");
      expect(normaliseContacts(v3)[0]?.emails[0]?.role).toBe(true);
    })
  );
  it.effect("skips inline binary photos and still rejects quoted-printable text", () =>
    Effect.gen(function* () {
      const cards = yield* parseVcards(
        "BEGIN:VCARD\nVERSION:3.0\nFN:Alex Example\nPHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRg\n ABCDEF==\nEMAIL:alex@acme.example\nEND:VCARD"
      );
      expect(cards[0]?.displayName).toBe("Alex Example");
      expect(cards[0]?.emails).toEqual(["alex@acme.example"]);
      const exported = yield* parseVcards("BEGIN:VCARD\r\r\nVERSION:3.0\r\r\nFN:Alex Example\r\r\nEND:VCARD\r\r\n");
      expect(exported[0]?.displayName).toBe("Alex Example");
      const qp = yield* Effect.flip(
        parseVcards("BEGIN:VCARD\nVERSION:3.0\nFN;ENCODING=QUOTED-PRINTABLE:Alex=20Example\nEND:VCARD")
      );
      expect(qp.reason).toBe("invalid-input");
    })
  );
  it.effect("fails closed without quoting the malformed private content", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(parseOutlookCsv('First Name\n"secret-unclosed'));
      expect(error.reason).toBe("invalid-input");
      expect(String(error)).not.toContain("secret-unclosed");
      expect((yield* Effect.flip(parseVcards("BEGIN:VCARD\nVERSION:4.0"))).reason).toBe("invalid-input");
    })
  );
});

describe("recorded public responses", () => {
  it.effect("maps application and patent metadata with numeric-only public queries", () =>
    Effect.gen(function* () {
      const urls: Array<string> = [];
      const s = yield* withService(UsptoRecordLookup, usptoLayer(record, 200, urls));
      const facts = [yield* s.byApplication("18900001"), yield* s.byPatent("99000001")];
      expect(facts[0]).toEqual(facts[1]);
      assertSome(O.getOrThrow(facts[0]!).docketNumber, "90001.10001US01");
      expect(urls[0]).toContain("18900001");
      expect(A.join(urls, " ")).not.toContain("Acme");
    })
  );
  it.effect("treats not-found as None and rejects content-bearing queries before any request", () =>
    Effect.gen(function* () {
      const urls: Array<string> = [];
      const s = yield* withService(UsptoRecordLookup, usptoLayer({}, 404, urls));
      const found = yield* s.byApplication("18900001");
      yield* Effect.flip(s.byPatent('99000001" OR client'));
      assertNone(found);
      expect(urls).toHaveLength(1);
    })
  );
  it.effect("retains throttle failures and rejects conflicting patent records", () =>
    Effect.gen(function* () {
      const throttled = yield* withService(UsptoRecordLookup, usptoLayer({}, 429, []));
      const error = yield* Effect.flip(throttled.byApplication("18900001"));
      expect(error.reason).toBe("unavailable");
      const ambiguous = {
        count: 2,
        patentFileWrapperDataBag: [...record.patentFileWrapperDataBag, ...record.patentFileWrapperDataBag],
      };
      const conflicting = yield* withService(UsptoRecordLookup, usptoLayer(ambiguous, 200, []));
      const conflict = yield* Effect.flip(conflicting.byPatent("99000001"));
      expect(conflict.reason).toBe("conflicting-records");
    })
  );
  it.effect("reads organisation RDAP fields and returns None for redacted or personal registrants", () =>
    Effect.gen(function* () {
      const rdap = {
        entities: [{ roles: ["registrant"], vcardArray: ["vcard", [["org", {}, "text", "Acme Widgets LLC"]]] }],
      };
      const urls: Array<string> = [];
      const source = yield* withService(
        DomainRegistrantLookup,
        DomainRegistrantLookupLive.pipe(Layer.provide(response(rdap, 200, urls)))
      );
      const name = yield* source.registrant("acme.example");
      assertSome(name, "Acme Widgets LLC");
      expect(urls).toEqual(["https://rdap.org/domain/acme.example"]);
      const registrantFromRdap1 = yield* registrantFromRdap({ ...rdap, redacted: [{}] });
      assertNone(registrantFromRdap1);
      const registrantFromRdap2 = yield* registrantFromRdap({
        entities: [{ roles: ["registrant"], vcardArray: ["vcard", [["fn", {}, "text", "Alex Example"]]] }],
      });
      assertNone(registrantFromRdap2);
      const registrantFromRdap3 = yield* registrantFromRdap({
        entities: [{ roles: ["registrant"], vcardArray: ["vcard", [["org", {}, "text", "REDACTED FOR PRIVACY"]]] }],
      });
      assertNone(registrantFromRdap3);
    })
  );
  it.effect("walks nested entities, reads corporate names, ignores non-text values and ambiguous registrants", () =>
    Effect.gen(function* () {
      const nested = {
        entities: [
          {
            roles: ["technical"],
            entities: [
              {
                roles: ["registrant"],
                vcardArray: [
                  "vcard",
                  [
                    ["kind", {}, "text", "org"],
                    ["fn", {}, "text", " Nested Org "],
                    ["org", {}, "text", 42],
                  ],
                ],
              },
            ],
          },
        ],
      };
      const registrantFromRdap4 = yield* registrantFromRdap(nested);
      assertSome(registrantFromRdap4, "Nested Org");
      const registrantFromRdap5 = yield* registrantFromRdap({
        entities: [
          { roles: ["registrant"], vcardArray: ["vcard", [["org", {}, "text", "One Org"]]] },
          { roles: ["registrant"], vcardArray: ["vcard", [["org", {}, "text", "Other Org"]]] },
        ],
      });
      assertNone(registrantFromRdap5);
      const registrantFromRdap6 = yield* registrantFromRdap({});
      assertNone(registrantFromRdap6);
      const bad = yield* Effect.flip(registrantFromRdap({ entities: [{ roles: "registrant" }] }));
      expect(bad.reason).toBe("invalid-input");
    })
  );
  it.effect("rejects malformed domains before any request and maps 404 and other statuses", () =>
    Effect.gen(function* () {
      const probe = Effect.fn("probe")(function* (status: number, domain: string, urls: Array<string>) {
        const source = yield* withService(
          DomainRegistrantLookup,
          DomainRegistrantLookupLive.pipe(Layer.provide(response({}, status, urls)))
        );
        return yield* source.registrant(domain);
      });
      const untouched: Array<string> = [];
      expect((yield* Effect.flip(probe(200, "not a domain", untouched))).reason).toBe("invalid-input");
      expect(untouched).toHaveLength(0);
      const probe7 = yield* probe(404, "missing.example", []);
      assertNone(probe7);
      expect((yield* Effect.flip(probe(503, "down.example", []))).reason).toBe("unavailable");
    })
  );
});
const extraction = {
  docType: "agreement",
  title: null,
  parties: [{ name: "Acme Widgets LLC", kind: "organization", role: "client", quote: "Client Acme Widgets LLC" }],
  dockets: [],
  applicationNumbers: [],
  patentNumbers: [],
  emails: [],
  dates: [],
};
const verdict = { keepParties: [0], keepDockets: [], docType: "agreement", problems: [] };
const batches = (extract: string, critic: string) =>
  DocumentExtractionSourceFile.pipe(
    Layer.provide(Layer.succeed(ExtractionBatchesLocation, ExtractionBatchesConfig.make({ directories: ["/batch"] }))),
    Layer.provide(
      fakeFs([
        ["/batch/extract.jsonl", extract],
        ["/batch/critic.jsonl", critic],
      ])
    ),
    Layer.provide(Path.layer)
  );
describe("extraction batch pairing", () => {
  it.effect("returns only paired ids and None for missing critics", () =>
    Effect.gen(function* () {
      const lines = `${yield* encodeJson({ id: "doc-1", extraction })}\n${yield* encodeJson({ id: "doc-2", extraction })}`;
      const encodedJson = yield* encodeJson({ id: "doc-1", verdict });
      const layer = batches(lines, encodedJson);
      const s = yield* withService(DocumentExtractionSource, layer);
      const first = yield* s.extraction("doc-1");
      const second = yield* s.extraction("doc-2");
      first.pipe(O.isSome, assertTrue);
      assertNone(second);
    })
  );
  it.effect("rejects malformed lines, invalid indexes, and conflicting duplicate ids", () =>
    Effect.gen(function* () {
      for (const [extract, critic] of [
        ["bad-private-line", ""],
        [
          yield* encodeJson({ id: "doc-1", extraction }),
          yield* encodeJson({
            id: "doc-1",
            verdict: { ...verdict, keepParties: [4] },
          }),
        ],
        [
          (yield* encodeJson({ id: "doc-1", extraction })) +
            "\n" +
            (yield* encodeJson({
              id: "doc-1",
              extraction: { ...extraction, title: "Different" },
            })),
          "",
        ],
      ]) {
        const error = yield* batches(extract!, critic!).pipe(Layer.build, Effect.flip);
        expect(["invalid-input", "conflicting-records"]).toContain(error.reason);
        expect(String(error)).not.toContain("bad-private-line");
      }
    })
  );
});

describe("adapter failure boundaries", () => {
  it.effect("redacts either contact file read failure without publishing partial cards", () =>
    Effect.gen(function* () {
      const config = ContactFilesConfig.make({ csvPath: "/synthetic/cards.csv", vcardPath: "/synthetic/cards.vcf" });
      for (const deniedPath of [config.csvPath, config.vcardPath]) {
        const reads: Array<string> = [];
        const denied = PlatformError.systemError({
          module: "FileSystem",
          method: "readFileString",
          _tag: "PermissionDenied",
          cause: "private-contact-source",
        });
        const fs = FileSystem.makeNoop({
          readFileString: Effect.fn("ContactFailureTest.read")(function* (file) {
            reads.push(file);
            if (file === deniedPath) return yield* denied;
            return file === config.csvPath ? csv : vcf;
          }),
        });
        const source = yield* withService(
          ContactCardSource,
          ContactCardSourceFile.pipe(
            Layer.provide(Layer.succeed(ContactFilesLocation, config)),
            Layer.provide(Layer.succeed(FileSystem.FileSystem, fs))
          )
        );
        const failure = yield* Stream.runCollect(source.cards).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "IdentificationError",
          operation: "contact-read",
          reason: "unavailable",
        });
        expect("cause" in failure).toBe(false);
        expect(reads).toEqual(deniedPath === config.csvPath ? [config.csvPath] : [config.csvPath, config.vcardPath]);
      }
    })
  );

  it.effect("rejects malformed CSV and vCard structure through the text boundary", () =>
    Effect.gen(function* () {
      for (const input of ["", "Unrecognised Header\nprivate-contact-source", "First Name,Company\nAlex"]) {
        const failure = yield* parseOutlookCsv(input).pipe(Effect.flip);
        expect(failure).toMatchObject({ operation: "contact-parse", reason: "invalid-input" });
        expect("cause" in failure).toBe(false);
      }
      for (const input of [
        "BEGIN:VCARD\nVERSION:2.1\nFN:private-contact-source\nEND:VCARD",
        "BEGIN:VCARD\nVERSION:4.0\nprivate-contact-source\nEND:VCARD",
        "BEGIN:VCARD\nBEGIN:VCARD\nEND:VCARD",
        "FN:private-contact-source\n",
      ]) {
        const failure = yield* parseVcards(input).pipe(Effect.flip);
        expect(failure).toMatchObject({ operation: "contact-parse", reason: "invalid-input" });
        expect("cause" in failure).toBe(false);
      }
    })
  );

  it.effect("redacts extraction file failures and rejects reviewed docket indexes outside the extraction", () =>
    Effect.gen(function* () {
      const extract = yield* encodeJson({ id: "doc-1", extraction });
      const critic = yield* encodeJson({ id: "doc-1", verdict });
      for (const deniedPath of ["/batch/extract.jsonl", "/batch/critic.jsonl"]) {
        const denied = PlatformError.systemError({
          module: "FileSystem",
          method: "readFileString",
          _tag: "PermissionDenied",
          cause: "private-extraction-source",
        });
        const layer = DocumentExtractionSourceFile.pipe(
          Layer.provide(
            Layer.succeed(ExtractionBatchesLocation, ExtractionBatchesConfig.make({ directories: ["/batch"] }))
          ),
          Layer.provide(
            Layer.succeed(
              FileSystem.FileSystem,
              FileSystem.makeNoop({
                readFileString: Effect.fn("ExtractionFailureTest.read")(function* (file) {
                  if (file === deniedPath) return yield* denied;
                  return file === "/batch/extract.jsonl" ? extract : critic;
                }),
              })
            )
          ),
          Layer.provide(Path.layer)
        );
        const failure = yield* Layer.build(layer).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "IdentificationError",
          operation: "extraction-read",
          reason: "unavailable",
        });
        expect("cause" in failure).toBe(false);
      }
      const badDocket = yield* encodeJson({ id: "doc-1", verdict: { ...verdict, keepDockets: [0] } });
      const invalidIndex = yield* Layer.build(batches(extract, badDocket)).pipe(Effect.flip);
      expect(invalidIndex).toMatchObject({ operation: "extraction-read", reason: "invalid-input" });
    })
  );

  it.effect("redacts RDAP transport failures and treats a missing patent as absent", () =>
    Effect.gen(function* () {
      const source = yield* withService(
        DomainRegistrantLookup,
        DomainRegistrantLookupLive.pipe(
          Layer.provide(
            Layer.succeed(
              HttpClient.HttpClient,
              HttpClient.make((request) =>
                Effect.fail(
                  new HttpClientError.HttpClientError({
                    reason: new HttpClientError.TransportError({ request, cause: "private-network-cause" }),
                  })
                )
              )
            )
          )
        )
      );
      const failure = yield* source.registrant("acme.example").pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "IdentificationError", operation: "rdap-query", reason: "unavailable" });
      expect("cause" in failure).toBe(false);
      const urls: Array<string> = [];
      const patents = yield* withService(UsptoRecordLookup, usptoLayer({}, 404, urls));
      const missing = yield* patents.byPatent("99000001");
      assertNone(missing);
      expect(urls).toHaveLength(1);
      expect(A.getUnsafe(urls, 0)).toContain("99000001");
    })
  );
});
