import * as I from "@beep/law-practice-use-cases/DocumentIdentification";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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
it.layer(makeIdentificationStages(lookup).pipe(Layer.provideMerge(NodeServices.layer)), { timeout: "30 seconds" })(
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
        const readFileString1 = yield* fs.readFileString(input.projection);
        expect(readFileString1).not.toContain('"phones"');
        const before = yield* fs.readFileString(input.output);
        yield* Effect.flip(IdentificationStages.use((s) => s.contacts(input)));
        const readFileString2 = yield* fs.readFileString(input.output);
        expect(readFileString2).toBe(before);
        const bad = ContactsInput.make({ ...input, output: `${process.cwd()}/refused.jsonl` });
        const error = yield* Effect.flip(IdentificationStages.use((s) => s.contacts(bad)));
        expect(error.reason).toBe("unsafe-output");
        const exists3 = yield* fs.exists(bad.output);
        expect(exists3).toBe(false);
      })
    );
    it.effect("appends only query shapes and counts, and stores results in a separate 0600 output", () =>
      Effect.gen(function* () {
        const { fs, file } = yield* fixture();
        const queries = [
          I.UsptoQuery.make({ kind: "application", number: "18900001" }),
          I.UsptoQuery.make({ kind: "patent", number: "99000001" }),
        ];
        const forEach4 = yield* Effect.forEach(queries, (q) => encode(I.UsptoQuery, q));
        const text = A.join(forEach4, "\n");
        yield* fs.writeFileString(file("queries.jsonl"), text);
        const input = UsptoInput.make({
          input: file("queries.jsonl"),
          output: file("results.jsonl"),
          ledger: file("ledger.jsonl"),
        });
        const use5 = yield* IdentificationStages.use((s) => s.uspto(input));
        expect(use5).toBe(2);
        expect((yield* fs.stat(input.output)).mode & 0o777).toBe(0o600);
        yield* fs.chmod(input.ledger, 0o644);
        yield* IdentificationStages.use((s) =>
          s.uspto(UsptoInput.make({ ...input, output: file("results-next.jsonl") }))
        );
        const ledger = yield* fs.readFileString(input.ledger);
        expect(Str.split("\n")(Str.trim(ledger))).toHaveLength(4);
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
        const argument = file("assertions.jsonl");
        const encoded = yield* encode(I.IndexEvidence, assertion);
        yield* fs.writeFileString(argument, encoded);
        yield* IdentificationStages.use((s) =>
          s.index(
            IndexInput.make({
              input: file("assertions.jsonl"),
              contacts: file("contacts.jsonl"),
              output: file("index.json"),
            })
          )
        );
        const readFileString6 = yield* fs.readFileString(file("index.json"));
        const index = yield* decodeIndex(readFileString6);
        expect(index.pairs).toHaveLength(1);
        const argument1 = file("context.json");
        const encoded1 = yield* encode(
          I.ResolverContext,
          I.ResolverContext.make({ ...context, clients: index.clients, pairs: index.pairs })
        );
        yield* fs.writeFileString(argument1, encoded1);
        const doc = I.IdentificationDocument.make({
          documentId: "synthetic-1",
          contentHash: I.ContentHash.make(Str.repeat(64)("0")),
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
        const argument2 = file("documents.jsonl");
        const encoded2 = yield* encode(I.IdentificationDocument, doc);
        yield* fs.writeFileString(argument2, encoded2);
        const argument3 = file("truth.jsonl");
        const encoded3 = yield* encode(I.TrainingDocument, truth);
        yield* fs.writeFileString(argument3, encoded3);
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
        const readFileString7 = yield* fs.readFileString(file("report.json"));
        const report = yield* decodeReport(readFileString7);
        expect(report.testSize).toBe(1);
        assertSome(A.findFirst(report.tiers, (t) => t.tier === "identified").pipe(O.flatMap((t) => t.precision)), 1);
      })
    );
  }
);

const startupFailureStages = makeIdentificationStages(
  Layer.effect(I.UsptoRecordLookup, Effect.fail("synthetic private provider startup detail"))
).pipe(Layer.provideMerge(NodeServices.layer));

it.layer(startupFailureStages, { timeout: "30 seconds" })("provider startup failures", (it) => {
  it.effect("sanitises a failed lookup-layer startup without creating outputs or a query ledger", () =>
    Effect.gen(function* () {
      const { fs, file } = yield* fixture();
      yield* fs.writeFileString(file("queries.jsonl"), '{"kind":"application","number":"18900001"}');
      const error = yield* Effect.flip(
        IdentificationStages.use((service) =>
          service.uspto(
            UsptoInput.make({
              input: file("queries.jsonl"),
              output: file("results.jsonl"),
              ledger: file("ledger.jsonl"),
            })
          )
        )
      );
      expect(error).toMatchObject({ operation: "uspto-config", reason: "unavailable" });
      expect(error.message).not.toContain("private provider");
      const exists8 = yield* fs.exists(file("results.jsonl"));
      expect(exists8).toBe(false);
      const exists9 = yield* fs.exists(file("ledger.jsonl"));
      expect(exists9).toBe(false);
    })
  );
});

const unavailable = I.IdentificationError.make({ operation: "lookup-application", reason: "unavailable" });
const failedLookupStages = makeIdentificationStages(
  Layer.succeed(
    I.UsptoRecordLookup,
    I.UsptoRecordLookupShape.make({
      byApplication: () => Effect.fail(unavailable),
      byPatent: () => Effect.succeedNone,
    })
  )
).pipe(Layer.provideMerge(NodeServices.layer));

it.layer(failedLookupStages, { timeout: "30 seconds" })("provider query failures", (it) => {
  it.effect("preserves a typed lookup failure after startup and records only the attempted query shape", () =>
    Effect.gen(function* () {
      const { fs, file } = yield* fixture();
      yield* fs.writeFileString(file("queries.jsonl"), '{"kind":"application","number":"18900001"}');
      const error = yield* Effect.flip(
        IdentificationStages.use((service) =>
          service.uspto(
            UsptoInput.make({
              input: file("queries.jsonl"),
              output: file("results.jsonl"),
              ledger: file("ledger.jsonl"),
            })
          )
        )
      );
      expect(error).toBe(unavailable);
      const exists10 = yield* fs.exists(file("results.jsonl"));
      expect(exists10).toBe(false);
      const ledger = yield* fs.readFileString(file("ledger.jsonl"));
      expect(ledger).toContain('"application-number"');
      expect(ledger).not.toContain("18900001");
    })
  );
});
