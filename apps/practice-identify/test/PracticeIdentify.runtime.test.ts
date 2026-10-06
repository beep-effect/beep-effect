import * as I from "@beep/law-practice-use-cases/DocumentIdentification";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ContactsInput,
  EvaluateInput,
  IdentificationStages,
  IndexInput,
  ResolveInput,
  UsptoInput,
} from "@/PracticeIdentify.config";
import { makeIdentificationStages } from "@/runtime/Layer";

const decodeReport = S.decodeEffect(S.fromJsonString(I.EvaluationReport));
const decodeIndex = S.decodeEffect(S.fromJsonString(I.IdentificationIndex));

const lookup = Layer.succeed(
  I.UsptoRecordLookup,
  I.UsptoRecordLookupShape.make({
    byApplication: () =>
      Effect.succeedSome(
        I.UsptoRecordFacts.make({
          docketNumber: O.some("90001.10001US01"),
          firstApplicant: O.some("Acme Widgets LLC"),
        })
      ),
    byPatent: () => Effect.succeedNone,
  })
);
const fixture = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "synthetic-identify-" });
  return { fs, file: (name: string) => path.join(dir, name) };
});
const encode = <T extends S.Top>(schema: T, value: T["Type"]) => S.encodeEffect(S.fromJsonString(schema))(value);
const context = I.ResolverContext.make({
  clients: [],
  contacts: [],
  pairs: [],
  aliases: [],
  pseudoClients: [],
  excludedDomains: [],
});
it.layer(makeIdentificationStages(lookup).pipe(Layer.provideMerge(NodeServices.layer)))(
  "private stage runtime",
  (it) => {
    it.effect("writes contacts and projections as exclusive 0600 files and refuses repository outputs", () =>
      Effect.gen(function* () {
        const { fs, file } = yield* fixture();
        yield* fs.writeFileString(
          file("cards.csv"),
          "First Name,Last Name,E-mail Address\nAlex,Example,alex@acme.example\n"
        );
        yield* fs.writeFileString(
          file("cards.vcf"),
          "BEGIN:VCARD\nVERSION:4.0\nFN:Alex Example\nEMAIL:alex@acme.example\nEND:VCARD"
        );
        const input = ContactsInput.make({
          csv: file("cards.csv"),
          vcard: file("cards.vcf"),
          output: file("contacts.jsonl"),
          projection: file("projection.jsonl"),
        });
        const count = yield* IdentificationStages.use((s) => s.contacts(input));
        expect(count).toBe(1);
        expect((yield* fs.stat(input.output)).mode & 0o777).toBe(0o600);
        expect((yield* fs.stat(input.projection)).mode & 0o777).toBe(0o600);
        expect(yield* fs.readFileString(input.projection)).not.toContain('"phones"');
        const before = yield* fs.readFileString(input.output);
        yield* Effect.flip(IdentificationStages.use((s) => s.contacts(input)));
        expect(yield* fs.readFileString(input.output)).toBe(before);
        const bad = ContactsInput.make({ ...input, output: new URL("../refused.jsonl", import.meta.url).pathname });
        const error = yield* Effect.flip(IdentificationStages.use((s) => s.contacts(bad)));
        expect(error.reason).toBe("unsafe-output");
        expect(yield* fs.exists(bad.output)).toBe(false);
      })
    );
    it.effect("appends only query shapes and counts, and stores results in a separate 0600 output", () =>
      Effect.gen(function* () {
        const { fs, file } = yield* fixture();
        const queries = [
          I.UsptoQuery.make({ kind: "application", number: "18900001" }),
          I.UsptoQuery.make({ kind: "patent", number: "99000001" }),
        ];
        const text = (yield* Effect.forEach(queries, (q) => encode(I.UsptoQuery, q))).join("\n");
        yield* fs.writeFileString(file("queries.jsonl"), text);
        const input = UsptoInput.make({
          input: file("queries.jsonl"),
          output: file("results.jsonl"),
          ledger: file("ledger.jsonl"),
        });
        expect(yield* IdentificationStages.use((s) => s.uspto(input))).toBe(2);
        expect((yield* fs.stat(input.output)).mode & 0o777).toBe(0o600);
        yield* fs.chmod(input.ledger, 0o644);
        yield* IdentificationStages.use((s) =>
          s.uspto(UsptoInput.make({ ...input, output: file("results-next.jsonl") }))
        );
        const ledger = yield* fs.readFileString(input.ledger);
        expect(ledger.trim().split("\n")).toHaveLength(4);
        expect(ledger).not.toContain("18900001");
        expect(ledger).not.toContain("Acme");
        expect(ledger).not.toContain("docket");
        expect((yield* fs.stat(input.ledger)).mode & 0o777).toBe(0o600);
      })
    );
    it.effect("runs index, resolution and honest evaluation through their codecs", () =>
      Effect.gen(function* () {
        const { fs, file } = yield* fixture();
        yield* fs.writeFileString(file("contacts.jsonl"), "");
        const assertion = I.IndexEvidence.make({
          clientNumber: O.some(I.ClientNumber.make("90001")),
          names: ["Acme Widgets LLC"],
          folders: [],
          references: ["90001.10001US01"],
          emails: [],
          contactIds: [],
          source: "attorney-answer",
        });
        yield* fs.writeFileString(file("assertions.jsonl"), yield* encode(I.IndexEvidence, assertion));
        yield* IdentificationStages.use((s) =>
          s.index(
            IndexInput.make({
              input: file("assertions.jsonl"),
              contacts: file("contacts.jsonl"),
              output: file("index.json"),
            })
          )
        );
        const index = yield* decodeIndex(yield* fs.readFileString(file("index.json")));
        expect(index.pairs).toHaveLength(1);
        yield* fs.writeFileString(
          file("context.json"),
          yield* encode(
            I.ResolverContext,
            I.ResolverContext.make({ ...context, clients: index.clients, pairs: index.pairs })
          )
        );
        const doc = I.IdentificationDocument.make({
          documentId: "synthetic-1",
          contentHash: I.ContentHash.make("0".repeat(64)),
          text: "Private synthetic text, docket 90001.10001US01",
          sourcePath: "",
          copies: [],
          uspto: [],
          extraction: O.none(),
        });
        const truth = I.TrainingDocument.make({
          document: doc,
          clientNumber: I.ClientNumber.make("90001"),
          docket: O.some(I.DocketId.make("10001US01")),
        });
        yield* fs.writeFileString(file("documents.jsonl"), yield* encode(I.IdentificationDocument, doc));
        yield* fs.writeFileString(file("truth.jsonl"), yield* encode(I.TrainingDocument, truth));
        yield* fs.writeFileString(file("training.jsonl"), "");
        yield* fs.writeFileString(file("uspto.jsonl"), "");
        yield* fs.writeFileString(file("batches.json"), "[]");
        yield* IdentificationStages.use((s) =>
          s.resolve(
            ResolveInput.make({
              input: file("documents.jsonl"),
              context: file("context.json"),
              training: file("training.jsonl"),
              batches: file("batches.json"),
              uspto: file("uspto.jsonl"),
              output: file("resolutions.jsonl"),
            })
          )
        );
        const output = yield* fs.readFileString(file("resolutions.jsonl"));
        expect(output).not.toContain("Private synthetic text");
        expect(output).toContain('"identified"');
        yield* IdentificationStages.use((s) =>
          s.evaluate(
            EvaluateInput.make({
              input: file("truth.jsonl"),
              context: file("context.json"),
              output: file("report.json"),
              // This salt holds the all-zero fixture hash out for scoring.
              splitSalt: "fixture-6",
            })
          )
        );
        const report = yield* decodeReport(yield* fs.readFileString(file("report.json")));
        expect(report.testSize).toBe(1);
        expect(report.tiers.find((t) => t.tier === "identified")?.precision).toEqual(O.some(1));
      })
    );
  }
);
