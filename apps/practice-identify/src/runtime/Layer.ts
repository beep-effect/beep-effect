/**
 * Private file pipeline runtime.
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  ContactCardSourceFile,
  ContactFilesConfig,
  ContactFilesLocation,
  DocumentExtractionSourceFile,
  ExtractionBatchesConfig,
  ExtractionBatchesLocation,
  UsptoRecordLookupLive,
} from "@beep/law-practice-server/DocumentIdentification";
import {
  buildClientDocketPairs,
  buildClientIndex,
  Contact,
  ContactCardSource,
  ContactProjection,
  DocumentExtractionSource,
  EvaluationReport,
  evaluateHoldOut,
  fitTokenFilter,
  IdentificationDocument,
  IdentificationError,
  IdentificationIndex,
  IndexEvidence,
  linkContacts,
  normaliseContacts,
  projectContacts,
  ResolutionRecord,
  ResolverContext,
  resolve,
  TrainingDocument,
  UsptoLookupResult,
  UsptoQuery,
  UsptoRecordLookup,
} from "@beep/law-practice-use-cases/DocumentIdentification";
import { Uspto } from "@beep/uspto";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { IdentificationStages, IdentificationStagesShape } from "../PracticeIdentify.config.ts";
import type { ContactsInput, EvaluateInput, IndexInput, ResolveInput, UsptoInput } from "../PracticeIdentify.config.ts";

const failure = (operation: string, reason: IdentificationError["reason"]) =>
  IdentificationError.make({ operation, reason });
const QueryLedgerLine = S.Struct({ shape: S.Literals(["application-number", "patent-number"]), count: S.Natural });
const encodeLedgerLine = S.encodeEffect(S.fromJsonString(QueryLedgerLine));

/**
 * Builds stage implementations over FileSystem and Path; provider services are built only for their stage.
 * Outputs are created exclusively with mode 0600 outside git worktrees. Existing ledger paths
 * are canonicalised and restricted to mode 0600 before append; the ledger records shapes and counts.
 * **Example** (Inspect the runtime layer)
 *
 * ```ts
 * import { makeIdentificationStages } from "@/runtime/Layer"
 * import { UsptoRecordLookup, UsptoRecordLookupShape } from "@beep/law-practice-use-cases/DocumentIdentification"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer"
 * const lookups = Layer.succeed(UsptoRecordLookup, UsptoRecordLookupShape.make({ byApplication: () => Effect.succeedNone, byPatent: () => Effect.succeedNone }))
 * console.log(Layer.isLayer(makeIdentificationStages(lookups))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeIdentificationStages = <E>(lookups: Layer.Layer<UsptoRecordLookup, E>) => {
  const makeIdentificationStages = Effect.fn("DocumentIdentification.Layer.make")(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const platform = Layer.succeedContext(yield* Effect.context<FileSystem.FileSystem | Path.Path>());
    const sanitise = <T, E, R>(
      effect: Effect.Effect<T, E, R>,
      operation: string
    ): Effect.Effect<T, IdentificationError, R> =>
      effect.pipe(Effect.mapError(() => failure(operation, "unavailable")));
    const read = Effect.fnUntraced(function* <T extends S.Top>(file: string, schema: T) {
      const text = yield* sanitise(fs.readFileString(file), "read");
      return yield* S.decodeEffect(S.fromJsonString(schema))(text).pipe(
        Effect.mapError(() => failure("decode", "invalid-input"))
      );
    });
    const lines = Effect.fnUntraced(function* <T extends S.Top>(file: string, schema: T) {
      const text = yield* sanitise(fs.readFileString(file), "read-lines");
      return yield* Effect.forEach(
        A.filter(Str.split(text, /\r?\n/u), (l) => Str.isNonEmpty(Str.trim(l))),
        (line) =>
          S.decodeEffect(S.fromJsonString(schema))(line).pipe(
            Effect.mapError(() => failure("decode-line", "invalid-input"))
          )
      );
    });
    const ancestors = (dir: string): ReadonlyArray<string> => {
      const out: Array<string> = [dir];
      let current = dir;
      for (;;) {
        const next = path.dirname(current);
        if (next === current) return out;
        out.push(next);
        current = next;
      }
    };
    // A `.git` directory with a HEAD, or a `.git` file (linked worktree), marks a repository checkout.
    const repositoryMarker = Effect.fnUntraced(function* (dir: string) {
      const marker = path.join(dir, ".git");
      if (!(yield* sanitise(fs.exists(marker), "output-check"))) return false;
      const info = yield* sanitise(fs.stat(marker), "output-check");
      return info.type !== "Directory" || (yield* sanitise(fs.exists(path.join(marker, "HEAD")), "output-check"));
    });
    const privatePath = Effect.fnUntraced(function* (file: string) {
      if (!path.isAbsolute(file)) return yield* failure("output-path", "unsafe-output");
      const parent = yield* sanitise(fs.realPath(path.dirname(file)), "output-parent");
      for (const dir of ancestors(parent)) {
        if (yield* repositoryMarker(dir)) return yield* failure("output-path", "unsafe-output");
      }
      return path.join(parent, path.basename(file));
    });
    const writeText = Effect.fnUntraced(function* (file: string, text: string) {
      const target = yield* privatePath(file);
      yield* sanitise(fs.writeFileString(target, text, { flag: "wx", mode: 0o600 }), "write-output");
    });
    const writeJson = Effect.fnUntraced(function* <T extends S.Top>(file: string, schema: T, value: T["Type"]) {
      const text = yield* S.encodeEffect(S.fromJsonString(schema))(value).pipe(
        Effect.mapError(() => failure("encode", "invalid-input"))
      );
      yield* writeText(file, `${text}\n`);
    });
    const writeLines = Effect.fnUntraced(function* <T extends S.Top>(
      file: string,
      schema: T,
      values: ReadonlyArray<T["Type"]>
    ) {
      const encoded = yield* Effect.forEach(values, (v) =>
        S.encodeEffect(S.fromJsonString(schema))(v).pipe(Effect.mapError(() => failure("encode-line", "invalid-input")))
      );
      yield* writeText(file, encoded.length > 0 ? `${A.join(encoded, "\n")}\n` : "");
    });
    const contacts = Effect.fn("PracticeIdentify.contacts")(function* (input: ContactsInput) {
      const raw = yield* Effect.scoped(
        Effect.gen(function* () {
          const services = yield* Layer.build(
            ContactCardSourceFile.pipe(
              Layer.provide(
                Layer.succeed(
                  ContactFilesLocation,
                  ContactFilesConfig.make({ csvPath: input.csv, vcardPath: input.vcard })
                )
              ),
              Layer.provide(platform)
            )
          );
          return yield* Stream.runCollect(Context.get(services, ContactCardSource).cards);
        })
      );
      const contacts = normaliseContacts(raw);
      yield* writeLines(input.output, Contact, contacts);
      yield* writeLines(input.projection, ContactProjection, projectContacts(contacts));
      return contacts.length;
    });
    const index = Effect.fn("PracticeIdentify.index")(function* (input: IndexInput) {
      const rows = yield* lines(input.input, IndexEvidence);
      const contacts = yield* lines(input.contacts, Contact);
      const clients = buildClientIndex(rows);
      yield* writeJson(
        input.output,
        IdentificationIndex,
        IdentificationIndex.make({
          clients,
          pairs: buildClientDocketPairs(rows),
          contacts: linkContacts(contacts, rows, clients),
        })
      );
      return clients.length;
    });
    const appendQuery = Effect.fnUntraced(function* (file: string, kind: UsptoQuery["kind"]) {
      let target = yield* privatePath(file);
      if (yield* sanitise(fs.exists(target), "ledger-check")) {
        target = yield* sanitise(fs.realPath(target), "ledger-path");
        yield* privatePath(target);
        yield* sanitise(fs.chmod(target, 0o600), "ledger-mode");
      }
      const text = yield* encodeLedgerLine({
        shape: kind === "application" ? "application-number" : "patent-number",
        count: 1,
      }).pipe(Effect.mapError(() => failure("ledger-encode", "invalid-input")));
      yield* sanitise(fs.writeFileString(target, `${text}\n`, { flag: "a", mode: 0o600 }), "ledger-append");
    });
    const uspto = Effect.fn("PracticeIdentify.uspto")(function* (input: UsptoInput) {
      if (
        path.resolve(input.input) === path.resolve(input.ledger) ||
        path.resolve(input.output) === path.resolve(input.ledger)
      )
        return yield* failure("ledger-path", "unsafe-output");
      const inputReal = yield* sanitise(fs.realPath(input.input), "query-input");
      const outputTarget = yield* privatePath(input.output);
      if (yield* sanitise(fs.exists(outputTarget), "query-output"))
        return yield* failure("query-output", "unsafe-output");
      const ledgerTarget = yield* privatePath(input.ledger);
      const ledgerReal = (yield* sanitise(fs.exists(ledgerTarget), "ledger-check"))
        ? yield* sanitise(fs.realPath(ledgerTarget), "ledger-path")
        : ledgerTarget;
      if (ledgerReal === inputReal || ledgerReal === outputTarget)
        return yield* failure("ledger-path", "unsafe-output");
      const queries = A.dedupeWith(yield* lines(input.input, UsptoQuery), S.toEquivalence(UsptoQuery));
      const results = yield* Effect.scoped(
        Effect.gen(function* () {
          const services = yield* Layer.build(lookups);
          const lookup = Context.get(services, UsptoRecordLookup);
          return yield* Effect.forEach(
            queries,
            Effect.fnUntraced(function* (query) {
              yield* appendQuery(input.ledger, query.kind);
              const facts = yield* query.kind === "application"
                ? lookup.byApplication(query.number)
                : lookup.byPatent(query.number);
              return UsptoLookupResult.make({ query, facts });
            })
          );
        })
      ).pipe(
        Effect.mapError((error) => (S.is(IdentificationError)(error) ? error : failure("uspto-config", "unavailable")))
      );
      yield* writeLines(input.output, UsptoLookupResult, results);
      return results.length;
    });
    const resolveStage = Effect.fn("PracticeIdentify.resolve")(function* (input: ResolveInput) {
      const context = yield* read(input.context, ResolverContext);
      const training = yield* lines(input.training, TrainingDocument);
      const filter = fitTokenFilter(training, context);
      const documents = yield* lines(input.input, IdentificationDocument);
      const records = yield* lines(input.uspto, UsptoLookupResult);
      const directories = yield* read(input.batches, S.Array(S.NonEmptyString));
      const results = yield* Effect.scoped(
        Effect.gen(function* () {
          const services = yield* Layer.build(
            DocumentExtractionSourceFile.pipe(
              Layer.provide(Layer.succeed(ExtractionBatchesLocation, ExtractionBatchesConfig.make({ directories }))),
              Layer.provide(platform)
            )
          );
          const source = Context.get(services, DocumentExtractionSource);
          return yield* Effect.forEach(
            documents,
            Effect.fnUntraced(function* (document) {
              const extraction = yield* source.extraction(document.documentId);
              const uspto = A.getSomes(A.map(records, (r) => O.map(r.facts, (facts) => ({ query: r.query, facts }))));
              const bundle = IdentificationDocument.make({
                ...document,
                extraction: O.orElse(extraction, () => document.extraction),
                uspto: [...document.uspto, ...uspto],
              });
              return ResolutionRecord.make({
                documentId: document.documentId,
                contentHash: document.contentHash,
                resolution: resolve(bundle, context, filter),
              });
            })
          );
        })
      );
      yield* writeLines(input.output, ResolutionRecord, results);
      return results.length;
    });
    const evaluate = Effect.fn("PracticeIdentify.evaluate")(function* (input: EvaluateInput) {
      const context = yield* read(input.context, ResolverContext);
      const documents = yield* lines(input.input, TrainingDocument);
      const report = evaluateHoldOut(documents, context, input.splitSalt);
      yield* writeJson(input.output, EvaluationReport, report);
      return report.testSize;
    });
    return IdentificationStagesShape.make({ contacts, index, uspto, resolve: resolveStage, evaluate });
  });
  return Layer.effect(IdentificationStages, makeIdentificationStages());
};

/**
 * CLI runtime with the public USPTO driver; lookups are built only when the USPTO stage runs.
 * **Example** (Inspect the live runtime)
 *
 * ```ts
 * import { IdentificationStagesLive } from "@/runtime/Layer"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(IdentificationStagesLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const IdentificationStagesLive = makeIdentificationStages(
  UsptoRecordLookupLive.pipe(Layer.provide(Uspto.layer))
);
