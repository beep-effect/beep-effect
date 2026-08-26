import { TextAnchor } from "@beep/provenance";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Console, Effect, FileSystem, Order, Path, Result, Struct } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { CorpusPaperId } from "@/corpus/Manifest";
import { makeGoldPrompt } from "@/gold/Prompts";
import { loadDocumentSelection } from "@/layers/DocumentSourceLive";
import { contentDigest } from "@/schema/Digest";
import { GoldUnavailable } from "@/schema/Errors";
import { GoldEntityLabel, GoldFile, GoldRef, GoldRelationLabel, GoldStructureLabel, GoldSubset } from "@/schema/Gold";
import { Canonicalizer } from "@/services/Canonicalizer";
import { DocumentSelection, DocumentSource } from "@/services/DocumentSource";
import { ActiveModelIdentity } from "@/services/LanguageModel";
import { Parser } from "@/services/Parser";
import type { Crypto } from "effect";
import type { CorpusManifest } from "@/corpus/Manifest";
import type { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import type { F1Catalog } from "@/fixtures/F1";
import type { GoldFile as GoldFileValue } from "@/schema/Gold";

/**
 * Gold subsets accepted by `canary gold propose --subset`.
 *
 * @category constants
 * @since 0.0.0
 */
export const GOLD_SUBSETS = ["structure", "entity", "relation"] as const satisfies ReadonlyArray<
  GoldFileValue["subset"]
>;

const StructureProposalJson = S.fromJsonString(
  S.Struct({
    labels: S.Array(S.Struct(Struct.omit(GoldStructureLabel.fields, ["verified"]))),
  })
);
const EntityProposalJson = S.fromJsonString(
  S.Struct({
    labels: S.Array(S.Struct(Struct.omit(GoldEntityLabel.fields, ["verified"]))),
  })
);
const RelationProposalJson = S.fromJsonString(
  S.Struct({
    labels: S.Array(S.Struct(Struct.omit(GoldRelationLabel.fields, ["verified"]))),
  })
);

type ProposedLabel =
  | (typeof StructureProposalJson.Type)["labels"][number]
  | (typeof EntityProposalJson.Type)["labels"][number]
  | (typeof RelationProposalJson.Type)["labels"][number];

interface GoldJob {
  readonly paperId: CorpusPaperId;
  readonly subset: GoldFileValue["subset"];
}

/**
 * Options used by the gold-proposal workflow.
 *
 * @category models
 * @since 0.0.0
 */
interface GoldProposalOptions {
  readonly manifestPath: string;
  readonly outputDirectory: string;
  readonly paper: O.Option<string>;
  readonly subset: O.Option<GoldFileValue["subset"]>;
}

/**
 * Proposal counts and files written by one command invocation.
 *
 * @category models
 * @since 0.0.0
 */
interface GoldProposalResult {
  readonly accepted: number;
  readonly files: ReadonlyArray<GoldFileValue>;
  readonly fraction: number;
  readonly reference: GoldRef;
  readonly total: number;
}

const unavailable = (message: string): GoldUnavailable => GoldUnavailable.make({ message });

const frozenSubsets = (manifest: CorpusManifest): GoldSubset => {
  const structure = A.map(A.take(manifest.rows, 10), (row) => row.id);
  const entity = A.take(structure, 5);
  const relation = A.take(entity, 3);
  return GoldSubset.make({ entity, relation, structure });
};

const jobsForSubset = (subsets: GoldSubset, subset: GoldFileValue["subset"]): ReadonlyArray<GoldJob> =>
  A.map(subsets[subset], (paperId) => ({ paperId, subset }));

const allJobs = (subsets: GoldSubset): ReadonlyArray<GoldJob> =>
  A.flatMap(GOLD_SUBSETS, (subset) => jobsForSubset(subsets, subset));

const selectJobs = Effect.fn("Gold.selectJobs")(function* (subsets: GoldSubset, options: GoldProposalOptions) {
  if (O.isSome(options.paper) && O.isSome(options.subset)) {
    return yield* unavailable("Choose either --paper or --subset, not both.");
  }
  if (O.isSome(options.subset)) {
    return jobsForSubset(subsets, options.subset.value);
  }
  if (O.isSome(options.paper)) {
    const paperId = yield* S.decodeEffect(CorpusPaperId)(options.paper.value).pipe(
      Effect.mapError(() => unavailable("The requested paper id is not a valid W1 corpus id."))
    );
    const selected = A.getSomes(
      A.map(GOLD_SUBSETS, (subset) => (A.contains(subsets[subset], paperId) ? O.some({ paperId, subset }) : O.none()))
    );
    if (A.length(selected) === 0) {
      return yield* unavailable("The requested paper is outside the frozen gold structure subset.");
    }
    return selected;
  }
  return allJobs(subsets);
});

const decodeProposal = Effect.fn("Gold.decodeProposal")(function* (
  subset: GoldFileValue["subset"],
  response: string
): Effect.fn.Return<ReadonlyArray<ProposedLabel>, GoldUnavailable> {
  const decodeError = () => unavailable(`The gold proposer response did not match the ${subset} JSON label contract.`);
  if (subset === "entity") {
    const decoded = yield* S.decodeEffect(EntityProposalJson)(response).pipe(Effect.mapError(decodeError));
    return decoded.labels;
  }
  if (subset === "relation") {
    const decoded = yield* S.decodeEffect(RelationProposalJson)(response).pipe(Effect.mapError(decodeError));
    return decoded.labels;
  }
  const decoded = yield* S.decodeEffect(StructureProposalJson)(response).pipe(Effect.mapError(decodeError));
  return decoded.labels;
});

const writeJsonAtomic = Effect.fn("Gold.writeJsonAtomic")(function* (target: string, json: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.dirname(target);
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(Effect.mapError(() => unavailable("The gold output directory could not be created.")));
  yield* Effect.scoped(
    Effect.gen(function* () {
      const temporary = yield* fs.makeTempFileScoped({
        directory,
        prefix: `.${path.basename(target)}.`,
        suffix: ".tmp",
      });
      yield* fs.writeFileString(temporary, `${json}\n`);
      yield* fs.rename(temporary, target);
    }).pipe(Effect.mapError(() => unavailable("A gold output file could not be written atomically.")))
  );
});

const GoldFileJson = S.fromJsonString(GoldFile, { space: 2 });
const GoldRefJson = S.fromJsonString(GoldRef, { space: 2 });
const goldFileOrder = Order.mapInput(Order.String, (file: GoldFileValue) => `${file.paperId}:${file.subset}`);

const goldFilePath = (path: Path.Path, directory: string, job: GoldJob): string =>
  path.join(directory, `${job.paperId}.${job.subset}.json`);

const readWrittenGold = Effect.fn("Gold.readWrittenGold")(function* (directory: string, jobs: ReadonlyArray<GoldJob>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* Effect.forEach(jobs, (job) => {
    const filePath = goldFilePath(path, directory, job);
    return fs.exists(filePath).pipe(
      Effect.flatMap((exists) =>
        exists
          ? fs.readFileString(filePath).pipe(Effect.flatMap(S.decodeEffect(GoldFileJson)), Effect.map(O.some))
          : Effect.succeed(O.none<GoldFileValue>())
      ),
      Effect.mapError(() => unavailable("An existing gold-v1 file could not be read or decoded."))
    );
  });
  return A.sort(A.getSomes(files), goldFileOrder);
});

const proposeJob = Effect.fn("Gold.proposeJob")(function* (
  selection: DocumentSelection,
  job: GoldJob,
  outputDirectory: string
) {
  const source = yield* DocumentSource;
  const parser = yield* Parser;
  const canonicalizer = yield* Canonicalizer;
  const languageModel = yield* LanguageModel.LanguageModel;
  const proposer = yield* ActiveModelIdentity;
  const path = yield* Path.Path;

  const documents = yield* source
    .list(DocumentSelection.make({ ...selection, paper: O.some(job.paperId) }))
    .pipe(Effect.mapError(() => unavailable("DocumentSource could not list the selected gold paper.")));
  const document = yield* A.findFirst(
    documents,
    (candidate) => candidate.origin.kind === "W1Paper" && Str.Equivalence(candidate.origin.paperId, job.paperId)
  ).pipe(
    Effect.fromOption,
    Effect.mapError(() => unavailable("The selected gold paper was not listed by DocumentSource."))
  );
  const bytes = yield* source
    .read(document)
    .pipe(Effect.mapError(() => unavailable("DocumentSource could not read the selected gold paper.")));
  const outcome = yield* parser.parse(document, bytes);
  if (outcome.outcome === "Degraded") {
    return yield* unavailable(`Gold paper ${job.paperId} degraded during parse with kind ${outcome.kind}.`);
  }
  const canonical = yield* canonicalizer.identify(document, outcome);
  const response = yield* languageModel
    .generateText({
      prompt: makeGoldPrompt({
        paperId: job.paperId,
        subset: job.subset,
        text: canonical.text,
      }),
    })
    .pipe(Effect.mapError(() => unavailable("The gold proposer could not generate a response.")));
  const proposed = yield* decodeProposal(job.subset, response.text);
  const verified = yield* Effect.forEach(
    proposed,
    Effect.fnUntraced(function* (label) {
      const anchor = yield* S.decodeEffect(TextAnchor)({
        endChar: label.endChar,
        quote: label.quote,
        startChar: label.startChar,
      }).pipe(Effect.result);
      if (Result.isFailure(anchor)) {
        return O.none();
      }
      const verification = yield* canonicalizer.verify(canonical, anchor.success).pipe(Effect.result);
      return Result.isSuccess(verification) ? O.some({ ...label, verified: false }) : O.none();
    })
  );
  const labels = A.getSomes(verified);
  const file = yield* S.decodeUnknownEffect(GoldFile)({
    labels,
    paperId: job.paperId,
    proposer,
    subset: job.subset,
    version: "gold/v1",
  }).pipe(Effect.mapError(() => unavailable("Verified labels did not produce a schema-valid GoldFile.")));
  const json = yield* S.encodeEffect(GoldFileJson)(file).pipe(
    Effect.mapError(() => unavailable("A GoldFile could not be encoded."))
  );
  yield* writeJsonAtomic(goldFilePath(path, outputDirectory, job), json);
  return { accepted: A.length(labels), file, total: A.length(proposed) };
});

/**
 * Proposes schema-valid, source-anchored gold labels for the frozen W1 subsets.
 *
 * **Details**
 *
 * Invalid anchors are dropped and counted. Written labels always begin with
 * `verified: false`; Benjamin's later spot check is the only workflow allowed
 * to change that marker or `spotCheckedFraction`.
 *
 * @category workflows
 * @since 0.0.0
 */
export const proposeGold = Effect.fn("Gold.propose")(function* (
  options: GoldProposalOptions
): Effect.fn.Return<
  GoldProposalResult,
  GoldUnavailable,
  | ActiveModelIdentity
  | Canonicalizer
  | Crypto.Crypto
  | CorpusManifestBuilder
  | DocumentSource
  | F1Catalog
  | FileSystem.FileSystem
  | LanguageModel.LanguageModel
  | Parser
  | Path.Path
> {
  const selection = yield* loadDocumentSelection(options.manifestPath, O.none()).pipe(
    Effect.mapError(() => unavailable("The selected manifest or F1 catalog failed validation."))
  );
  const subsets = frozenSubsets(selection.manifest);
  const jobs = yield* selectJobs(subsets, options);
  const proposed = yield* Effect.forEach(jobs, (job) => proposeJob(selection, job, options.outputDirectory), {
    concurrency: 1,
  });
  const accepted = A.reduce(proposed, 0, (count, item) => count + item.accepted);
  const total = A.reduce(proposed, 0, (count, item) => count + item.total);
  const path = yield* Path.Path;
  const files = yield* readWrittenGold(options.outputDirectory, allJobs(subsets));
  const digest = yield* contentDigest(S.Array(GoldFile))(files).pipe(
    Effect.mapError(() => unavailable("The gold-v1 file set could not be hashed."))
  );
  const proposer = yield* ActiveModelIdentity;
  const reference = GoldRef.make({
    digest,
    proposer,
    spotCheckedFraction: UnitInterval.make(0),
    subsets,
    version: "gold/v1",
  });
  const referenceJson = yield* S.encodeEffect(GoldRefJson)(reference).pipe(
    Effect.mapError(() => unavailable("The GoldRef could not be encoded."))
  );
  yield* writeJsonAtomic(path.join(options.outputDirectory, "gold.json"), referenceJson);
  const fraction = total === 0 ? 0 : accepted / total;
  yield* Console.log(`gold anchors accepted: ${accepted}/${total} (${fraction})`);
  return { accepted, files: A.map(proposed, (item) => item.file), fraction, reference, total };
});
