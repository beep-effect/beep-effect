import { $SemanticaId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Console, Effect, FileSystem, Order, Path, Result, Struct, Tuple } from "effect";
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
import { ModelIdentity } from "@/schema/Model";
import { Canonicalizer } from "@/services/Canonicalizer";
import { DocumentSelection, DocumentSource } from "@/services/DocumentSource";
import { ActiveModelIdentity } from "@/services/LanguageModel";
import { Parser } from "@/services/Parser";
import type { Crypto } from "effect";
import type { CorpusManifest } from "@/corpus/Manifest";
import type { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import type { F1Catalog } from "@/fixtures/F1";
import type { GoldFile as GoldFileValue } from "@/schema/Gold";

const $I = $SemanticaId.create("canary/Gold");

/**
 * Gold subsets accepted by `canary gold propose --subset`.
 *
 * **Example** (Inspect the first subset)
 *
 * ```ts
 * import { GOLD_SUBSETS } from "@/canary/Gold"
 * import * as A from "effect/Array"
 *
 * console.log(A.head(GOLD_SUBSETS)) // { _tag: "Some", value: "structure" }
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GOLD_SUBSETS = ["structure", "entity", "relation"] as const satisfies ReadonlyArray<
  GoldFileValue["subset"]
>;

const StructureProposalLabel = S.Struct(Struct.omit(GoldStructureLabel.fields, ["verified"]));
const EntityProposalLabel = S.Struct(Struct.omit(GoldEntityLabel.fields, ["verified"]));
const RelationProposalLabel = S.Struct(Struct.omit(GoldRelationLabel.fields, ["verified"]));

const StructureProposalJson = S.fromJsonString(
  S.Struct({
    labels: S.Array(StructureProposalLabel),
  })
);
const EntityProposalJson = S.fromJsonString(
  S.Struct({
    labels: S.Array(EntityProposalLabel),
  })
);
const RelationProposalJson = S.fromJsonString(
  S.Struct({
    labels: S.Array(RelationProposalLabel),
  })
);

type ProposedLabel =
  | (typeof StructureProposalJson.Type)["labels"][number]
  | (typeof EntityProposalJson.Type)["labels"][number]
  | (typeof RelationProposalJson.Type)["labels"][number];

const GoldJobSubset = LiteralKit(GOLD_SUBSETS).annotate(
  $I.annote("GoldJobSubset", {
    description: "Gold label subset selected by one proposal job.",
  })
);

class GoldJob extends S.Class<GoldJob>($I`GoldJob`)(
  { paperId: CorpusPaperId, subset: GoldJobSubset },
  $I.annote("GoldJob", {
    description: "Expected paper and subset identity for one frozen gold output file.",
  })
) {}

class GoldReferenceWritten extends S.Class<GoldReferenceWritten>($I`GoldReferenceWritten`)(
  { status: S.tag("written"), reference: GoldRef },
  $I.annote("GoldReferenceWritten", {
    description: "Successful gold reference write backed by all eighteen coherent label files.",
  })
) {}

class GoldReferenceNotWritten extends S.Class<GoldReferenceNotWritten>($I`GoldReferenceNotWritten`)(
  { status: S.tag("not-written"), missingJobs: S.Array(GoldJob) },
  $I.annote("GoldReferenceNotWritten", {
    description: "Typed partial-run outcome listing any frozen gold jobs still missing on disk.",
  })
) {}

const GoldReferenceOutcome = S.Union([GoldReferenceWritten, GoldReferenceNotWritten]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("GoldReferenceOutcome", {
    description: "Whether a complete invocation wrote gold.json or a partial invocation left it invalidated.",
  })
);

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
class GoldProposalResult extends S.Class<GoldProposalResult>($I`GoldProposalResult`)(
  {
    accepted: NonNegativeInt,
    files: S.Array(GoldFile),
    fraction: UnitInterval,
    reference: GoldReferenceOutcome,
    total: NonNegativeInt,
  },
  $I.annote("GoldProposalResult", {
    description: "Gold proposal counts, files written in this invocation, and reference-write disposition.",
  })
) {}

const unavailable = (reason: GoldUnavailable["reason"], message: string): GoldUnavailable =>
  GoldUnavailable.make({ message, reason });

const frozenSubsets = (manifest: CorpusManifest): GoldSubset => {
  const structure = A.map(A.take(manifest.rows, 10), (row) => row.id);
  const entity = A.take(structure, 5);
  const relation = A.take(entity, 3);
  return GoldSubset.make({ entity, relation, structure });
};

const jobsForSubset = (subsets: GoldSubset, subset: GoldFileValue["subset"]): ReadonlyArray<GoldJob> =>
  A.map(subsets[subset], (paperId) => GoldJob.make({ paperId, subset }));

const allJobs = (subsets: GoldSubset): ReadonlyArray<GoldJob> =>
  A.flatMap(GOLD_SUBSETS, (subset) => jobsForSubset(subsets, subset));

const selectJobs = Effect.fn("Gold.selectJobs")(function* (subsets: GoldSubset, options: GoldProposalOptions) {
  if (O.isSome(options.paper) && O.isSome(options.subset)) {
    return yield* unavailable("invalid-selection", "Choose either --paper or --subset, not both.");
  }
  if (O.isSome(options.subset)) {
    return jobsForSubset(subsets, options.subset.value);
  }
  if (O.isSome(options.paper)) {
    const paperId = yield* S.decodeEffect(CorpusPaperId)(options.paper.value).pipe(
      Effect.mapError(() => unavailable("invalid-selection", "The requested paper id is not a valid W1 corpus id."))
    );
    const selected = A.getSomes(
      A.map(GOLD_SUBSETS, (subset) =>
        A.contains(subsets[subset], paperId) ? O.some(GoldJob.make({ paperId, subset })) : O.none()
      )
    );
    if (A.length(selected) === 0) {
      return yield* unavailable(
        "invalid-selection",
        "The requested paper is outside the frozen gold structure subset."
      );
    }
    return selected;
  }
  return allJobs(subsets);
});

const decodeProposal = Effect.fn("Gold.decodeProposal")(function* (
  subset: GoldFileValue["subset"],
  response: string
): Effect.fn.Return<ReadonlyArray<ProposedLabel>, GoldUnavailable> {
  const decodeError = () =>
    unavailable("model-output-invalid", `The gold proposer response did not match the ${subset} JSON label contract.`);
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
    .pipe(Effect.mapError(() => unavailable("write-failed", "The gold output directory could not be created.")));
  yield* Effect.scoped(
    Effect.gen(function* () {
      const temporary = yield* fs.makeTempFileScoped({
        directory,
        prefix: `.${path.basename(target)}.`,
        suffix: ".tmp",
      });
      yield* fs.writeFileString(temporary, `${json}\n`);
      yield* fs.rename(temporary, target);
    }).pipe(Effect.mapError(() => unavailable("write-failed", "A gold output file could not be written atomically.")))
  );
});

const GoldFileJson = S.fromJsonString(GoldFile, { space: 2 });
const GoldRefJson = S.fromJsonString(GoldRef, { space: 2 });
const goldFileOrder = Order.mapInput(Order.String, (file: GoldFileValue) => `${file.paperId}:${file.subset}`);
const modelIdentityEquivalence = S.toEquivalence(ModelIdentity);
const isGoldUnavailable = S.is(GoldUnavailable);
const isRelationProposalLabel = S.is(RelationProposalLabel);
const nfc = Str.normalize("NFC");

const goldFilePath = (path: Path.Path, directory: string, job: GoldJob): string =>
  path.join(directory, `${job.paperId}.${job.subset}.json`);

const readWrittenGold = Effect.fn("Gold.readWrittenGold")(function* (directory: string, jobs: ReadonlyArray<GoldJob>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* Effect.forEach(jobs, (job) => {
    const filePath = goldFilePath(path, directory, job);
    return fs.exists(filePath).pipe(
      Effect.flatMap((exists) =>
        exists
          ? fs.readFileString(filePath).pipe(
              Effect.flatMap(S.decodeEffect(GoldFileJson)),
              Effect.flatMap((file) =>
                Str.Equivalence(file.paperId, job.paperId) && Str.Equivalence(file.subset, job.subset)
                  ? Effect.succeed(Tuple.make(job, O.some(file)))
                  : Effect.fail(
                      unavailable(
                        "job-mismatch",
                        `Gold file ${filePath} does not match its expected paper and subset identity.`
                      )
                    )
              )
            )
          : Effect.succeed(Tuple.make(job, O.none<GoldFileValue>()))
      ),
      Effect.mapError((error) =>
        isGoldUnavailable(error)
          ? error
          : unavailable("read-failed", "An existing gold-v1 file could not be read or decoded.")
      )
    );
  });
  return {
    files: A.sort(A.getSomes(A.map(entries, (entry) => entry[1])), goldFileOrder),
    missingJobs: A.getSomes(A.map(entries, ([job, file]) => (O.isNone(file) ? O.some(job) : O.none()))),
  };
});

const entityQuotesFor = Effect.fn("Gold.entityQuotesFor")(function* (directory: string, paperId: CorpusPaperId) {
  const inventory = yield* readWrittenGold(directory, [GoldJob.make({ paperId, subset: "entity" })]);
  return A.flatMap(inventory.files, (file) =>
    file.subset === "entity" ? A.map(file.labels, (label) => nfc(label.quote)) : []
  );
});

const relationEndpointsExist = (label: ProposedLabel, entityQuotes: ReadonlyArray<string>): boolean =>
  isRelationProposalLabel(label) &&
  A.some(entityQuotes, (quote) => Str.Equivalence(quote, nfc(label.subject))) &&
  A.some(entityQuotes, (quote) => Str.Equivalence(quote, nfc(label.object)));

// Models copy quotes verbatim but miscount offsets, so the anchor start is
// re-derived from the exact quote occurrence nearest the claimed offset.
const nearestQuoteStart = (text: string, quote: string, claimedStart: number): O.Option<number> => {
  let cursor = text.indexOf(quote);
  let best = O.none<number>();
  let bestDistance = Number.POSITIVE_INFINITY;
  while (cursor !== -1) {
    const distance = Math.abs(cursor - claimedStart);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = O.some(cursor);
    }
    cursor = text.indexOf(quote, cursor + 1);
  }
  return best;
};

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
    .pipe(
      Effect.mapError(() => unavailable("source-unavailable", "DocumentSource could not list the selected gold paper."))
    );
  const document = yield* A.findFirst(
    documents,
    (candidate) => candidate.origin.kind === "W1Paper" && Str.Equivalence(candidate.origin.paperId, job.paperId)
  ).pipe(
    Effect.fromOption,
    Effect.mapError(() =>
      unavailable("source-unavailable", "The selected gold paper was not listed by DocumentSource.")
    )
  );
  const bytes = yield* source
    .read(document)
    .pipe(
      Effect.mapError(() => unavailable("source-unavailable", "DocumentSource could not read the selected gold paper."))
    );
  const outcome = yield* parser.parse(document, bytes);
  if (outcome.outcome === "Degraded") {
    return yield* unavailable(
      "parse-degraded",
      `Gold paper ${job.paperId} degraded during parse with kind ${outcome.kind}.`
    );
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
    .pipe(Effect.mapError(() => unavailable("provider-failed", "The gold proposer could not generate a response.")));
  const proposed = yield* decodeProposal(job.subset, response.text);
  const entityQuotes = Str.Equivalence(job.subset, "relation")
    ? yield* entityQuotesFor(outputDirectory, job.paperId)
    : [];
  const verified = yield* Effect.forEach(
    proposed,
    Effect.fnUntraced(function* (label) {
      const anchorStart = nearestQuoteStart(canonical.text, label.quote, label.startChar);
      if (
        O.isNone(anchorStart) ||
        (Str.Equivalence(job.subset, "relation") && !relationEndpointsExist(label, entityQuotes))
      ) {
        return O.none();
      }
      const anchor = yield* S.decodeEffect(TextAnchor)({
        endChar: anchorStart.value + Str.length(label.quote),
        quote: label.quote,
        startChar: anchorStart.value,
      }).pipe(Effect.result);
      if (Result.isFailure(anchor)) {
        return O.none();
      }
      const verification = yield* canonicalizer.verify(canonical, anchor.success).pipe(Effect.result);
      return Result.isSuccess(verification)
        ? O.some({ ...label, endChar: anchor.success.endChar, startChar: anchor.success.startChar, verified: false })
        : O.none();
    })
  );
  const labels = A.getSomes(verified);
  const file = yield* S.decodeUnknownEffect(GoldFile)({
    labels,
    paperId: job.paperId,
    proposer,
    subset: job.subset,
    version: "gold/v1",
  }).pipe(
    Effect.mapError(() =>
      unavailable("model-output-invalid", "Verified labels did not produce a schema-valid GoldFile.")
    )
  );
  const json = yield* S.encodeEffect(GoldFileJson)(file).pipe(
    Effect.mapError(() => unavailable("encoding-failed", "A GoldFile could not be encoded."))
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
 * **Example** (Build a proposal effect)
 *
 * ```ts
 * import { proposeGold } from "@/canary/Gold"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const proposal = proposeGold({
 *   manifestPath: "fixtures/w1.manifest.json",
 *   outputDirectory: "fixtures/gold/v1",
 *   paper: O.none(),
 *   subset: O.none()
 * })
 * console.log(Effect.isEffect(proposal)) // true
 * ```
 *
 * @category cli-commands
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
  const selection = yield* loadDocumentSelection(options.manifestPath, O.none(), true).pipe(
    Effect.mapError(() => unavailable("manifest-invalid", "The selected manifest or F1 catalog failed validation."))
  );
  const subsets = frozenSubsets(selection.manifest);
  const jobs = yield* selectJobs(subsets, options);
  const expectedJobs = allJobs(subsets);
  const completeRun = O.isNone(options.paper) && O.isNone(options.subset);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .remove(path.join(options.outputDirectory, "gold.json"), { force: true })
    .pipe(
      Effect.mapError(() =>
        unavailable("write-failed", "The existing gold reference could not be invalidated before label writes.")
      )
    );
  const proposed = yield* Effect.forEach(jobs, (job) => proposeJob(selection, job, options.outputDirectory), {
    concurrency: 1,
  });
  const accepted = A.reduce(proposed, 0, (count, item) => count + item.accepted);
  const total = A.reduce(proposed, 0, (count, item) => count + item.total);
  const proposer = yield* ActiveModelIdentity;
  const inventory = yield* readWrittenGold(options.outputDirectory, expectedJobs);
  if (A.some(inventory.files, (file) => !modelIdentityEquivalence(file.proposer, proposer))) {
    return yield* unavailable(
      "mixed-proposer",
      "The complete gold-v1 file set must use the current run's proposer identity."
    );
  }
  const fraction = total === 0 ? 0 : accepted / total;
  yield* Console.log(`gold anchors accepted: ${accepted}/${total} (${fraction})`);
  if (!completeRun) {
    yield* Console.log("gold.json not written; this invocation selected only part of the frozen gold set");
    return GoldProposalResult.make({
      accepted: NonNegativeInt.make(accepted),
      files: A.map(proposed, (item) => item.file),
      fraction: UnitInterval.make(fraction),
      reference: GoldReferenceNotWritten.make({ missingJobs: inventory.missingJobs }),
      total: NonNegativeInt.make(total),
    });
  }
  return yield* A.match(inventory.missingJobs, {
    onEmpty: Effect.fn("Gold.writeReference")(function* () {
      const digest = yield* contentDigest(S.Array(GoldFile))(inventory.files).pipe(
        Effect.mapError(() => unavailable("digest-failed", "The gold-v1 file set could not be hashed."))
      );
      const reference = GoldRef.make({
        digest,
        proposer,
        spotCheckedFraction: UnitInterval.make(0),
        subsets,
        version: "gold/v1",
      });
      const referenceJson = yield* S.encodeEffect(GoldRefJson)(reference).pipe(
        Effect.mapError(() => unavailable("encoding-failed", "The GoldRef could not be encoded."))
      );
      yield* writeJsonAtomic(path.join(options.outputDirectory, "gold.json"), referenceJson);
      return GoldProposalResult.make({
        accepted: NonNegativeInt.make(accepted),
        files: A.map(proposed, (item) => item.file),
        fraction: UnitInterval.make(fraction),
        reference: GoldReferenceWritten.make({ reference }),
        total: NonNegativeInt.make(total),
      });
    }),
    onNonEmpty: (missingJobs) =>
      Console.log(
        `gold.json not written; missing jobs: ${A.join(
          A.map(missingJobs, (job) => `${job.paperId}:${job.subset}`),
          ", "
        )}`
      ).pipe(
        Effect.as(
          GoldProposalResult.make({
            accepted: NonNegativeInt.make(accepted),
            files: A.map(proposed, (item) => item.file),
            fraction: UnitInterval.make(fraction),
            reference: GoldReferenceNotWritten.make({ missingJobs }),
            total: NonNegativeInt.make(total),
          })
        )
      ),
  });
});
