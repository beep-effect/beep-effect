import { $SemanticaId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Console, Effect, FileSystem, Number as N, Order, Path, Result, Struct, Tuple } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import { CorpusPaperId } from "@/corpus/Manifest";
import { makeGoldPrompt } from "@/gold/Prompts";
import { loadDocumentSelection } from "@/layers/DocumentSourceLive";
import { LabConfig } from "@/runtime/Config";
import { contentDigest } from "@/schema/Digest";
import { GoldUnavailable } from "@/schema/Errors";
import {
  CurrentGoldDocumentText,
  GoldEntityLabel,
  GoldFile,
  GoldFileEncoded,
  GoldRef,
  GoldRelationLabel,
  GoldStructureLabel,
  GoldSubset,
} from "@/schema/Gold";
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
const RelationProposalLabel = S.Struct(
  Struct.omit(GoldRelationLabel.fields, [
    "objectEndChar",
    "objectStartChar",
    "subjectEndChar",
    "subjectStartChar",
    "verified",
  ])
);

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
type GoldProposalResultFields = {
  readonly accepted: typeof NonNegativeInt;
  readonly files: S.$Array<typeof GoldFile>;
  readonly fraction: typeof UnitInterval;
  readonly reference: typeof GoldReferenceOutcome;
  readonly total: typeof NonNegativeInt;
};

const GoldProposalResultBase: S.Class<
  GoldProposalResult,
  S.Struct<GoldProposalResultFields>,
  {}
> = S.Class<GoldProposalResult>($I`GoldProposalResult`)<GoldProposalResultFields>(
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
);

class GoldProposalResult extends GoldProposalResultBase {}

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
const GoldFileEncodedJson = S.fromJsonString(GoldFileEncoded);
const GoldRefJson = S.fromJsonString(GoldRef, { space: 2 });

/**
 * Shared ordering and equivalence semantics for encoded gold artifacts.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const GoldArtifactSemantics = {
  fileOrder: Order.mapInput(Order.String, (file: GoldFileEncoded) => `${file.paperId}:${file.subset}`),
  modelIdentityEquivalence: S.toEquivalence(S.toEncoded(ModelIdentity)),
};
const isGoldUnavailable = S.is(GoldUnavailable);
const isEntityProposalLabel = S.is(EntityProposalLabel);
const isRelationProposalLabel = S.is(RelationProposalLabel);
const isGoldEntityLabel = S.is(GoldEntityLabel);
const isGoldRelationLabel = S.is(GoldRelationLabel);
const isGoldStructureLabel = S.is(GoldStructureLabel);
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
              Effect.flatMap(S.decodeEffect(GoldFileEncodedJson)),
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
          : Effect.succeed(Tuple.make(job, O.none<GoldFileEncoded>()))
      ),
      Effect.mapError((error) =>
        isGoldUnavailable(error)
          ? error
          : unavailable("read-failed", "An existing gold-v1 file could not be read or decoded.")
      )
    );
  });
  return {
    files: A.sort(A.getSomes(A.map(entries, (entry) => entry[1])), GoldArtifactSemantics.fileOrder),
    missingJobs: A.getSomes(A.map(entries, ([job, file]) => (O.isNone(file) ? O.some(job) : O.none()))),
  };
});

const entityLabelsFor = Effect.fn("Gold.entityLabelsFor")(function* (
  directory: string,
  paperId: CorpusPaperId,
  text: string
) {
  const inventory = yield* readWrittenGold(directory, [GoldJob.make({ paperId, subset: "entity" })]);
  const files = yield* Effect.forEach(inventory.files, (file) =>
    S.decodeEffect(GoldFile)(file).pipe(
      Effect.provideService(CurrentGoldDocumentText, text),
      Effect.mapError(() =>
        unavailable("digest-failed", "An entity gold label digest does not match its canonical document slice.")
      )
    )
  );
  return A.flatMap(files, (file) => (file.subset === "entity" ? file.labels : []));
});

type RelationEndpoint = { readonly endChar: number; readonly quote: string; readonly startChar: number };
type RelationEndpoints = { readonly object: RelationEndpoint; readonly subject: RelationEndpoint };

const relationEndpointsFor = (
  label: ProposedLabel,
  entityLabels: ReadonlyArray<GoldEntityLabel>,
  evidence: TextAnchor
): O.Option<RelationEndpoints> =>
  isRelationProposalLabel(label)
    ? O.all({
        object: A.findFirst(entityLabels, (entity) =>
          Str.Equivalence(nfc(foldWhitespace(entity.quote).text), nfc(foldWhitespace(label.object).text))
        ).pipe(
          O.map((entity) => ({ endChar: entity.endChar, quote: entity.quote, startChar: entity.startChar })),
          O.orElse(() =>
            resolveGoldQuoteAnchor(evidence.quote, label.object, 0).pipe(
              O.map(([startChar, endChar, quote]) => ({
                endChar: N.sum(evidence.startChar, endChar),
                quote,
                startChar: N.sum(evidence.startChar, startChar),
              }))
            )
          )
        ),
        subject: A.findFirst(entityLabels, (entity) =>
          Str.Equivalence(nfc(foldWhitespace(entity.quote).text), nfc(foldWhitespace(label.subject).text))
        ).pipe(
          O.map((entity) => ({ endChar: entity.endChar, quote: entity.quote, startChar: entity.startChar })),
          O.orElse(() =>
            resolveGoldQuoteAnchor(evidence.quote, label.subject, 0).pipe(
              O.map(([startChar, endChar, quote]) => ({
                endChar: N.sum(evidence.startChar, endChar),
                quote,
                startChar: N.sum(evidence.startChar, startChar),
              }))
            )
          )
        ),
      })
    : O.none();

const makeVerifiedGoldLabel = Effect.fnUntraced(function* (
  label: ProposedLabel,
  anchor: TextAnchor,
  endpoints: O.Option<RelationEndpoints>
) {
  if (isEntityProposalLabel(label)) {
    return yield* GoldEntityLabel.makeEffect({
      cluster: label.cluster,
      endChar: anchor.endChar,
      entityType: label.entityType,
      label: anchor.quote,
      quote: anchor.quote,
      startChar: anchor.startChar,
      verified: false,
    }).pipe(Effect.result, Effect.map(Result.getSuccess));
  }
  if (isRelationProposalLabel(label)) {
    return yield* O.match(endpoints, {
      onNone: () => Effect.succeedNone,
      onSome: (resolved) =>
        GoldRelationLabel.makeEffect({
          endChar: anchor.endChar,
          object: resolved.object.quote,
          objectEndChar: NonNegativeInt.make(resolved.object.endChar),
          objectStartChar: NonNegativeInt.make(resolved.object.startChar),
          predicate: label.predicate,
          quote: anchor.quote,
          startChar: anchor.startChar,
          subject: resolved.subject.quote,
          subjectEndChar: NonNegativeInt.make(resolved.subject.endChar),
          subjectStartChar: NonNegativeInt.make(resolved.subject.startChar),
          verified: false,
        }).pipe(Effect.result, Effect.map(Result.getSuccess)),
    });
  }
  return yield* GoldStructureLabel.makeEffect({
    depth: label.depth,
    endChar: anchor.endChar,
    quote: anchor.quote,
    role: label.role,
    startChar: anchor.startChar,
    verified: false,
  }).pipe(Effect.result, Effect.map(Result.getSuccess));
});

// A 2,000-character window tolerates roughly a page of PDF extraction drift
// while preventing short evidence strings from re-anchoring across a paper.
const GOLD_ANCHOR_DRIFT_WINDOW = 2_000;

const anchorDistance = (candidate: number, claimed: number): number =>
  N.max(N.subtract(candidate, claimed), N.subtract(claimed, candidate));

const exactOccurrences = (text: string, quote: string): ReadonlyArray<number> =>
  Str.isEmpty(quote)
    ? A.empty()
    : A.unfold(0, (searchStart) =>
        Str.indexOf(quote)(Str.slice(searchStart)(text)).pipe(
          O.map((relativeStart) => {
            const start = N.sum(searchStart, relativeStart);
            return [start, N.sum(start, 1)] as const;
          })
        )
      );

const nearestStartWithinWindow = (occurrences: ReadonlyArray<number>, claimedStart: number): O.Option<number> =>
  A.reduce(occurrences, O.none<{ readonly distance: number; readonly start: number }>(), (best, start) => {
    const distance = anchorDistance(start, claimedStart);
    if (N.isGreaterThan(distance, GOLD_ANCHOR_DRIFT_WINDOW)) {
      return best;
    }
    return O.match(best, {
      onNone: () => O.some({ distance, start }),
      onSome: (current) => (N.isLessThan(distance, current.distance) ? O.some({ distance, start }) : best),
    });
  }).pipe(O.map((best) => best.start));

const foldWhitespace = (text: string) => {
  const runs = A.fromIterable(Str.matchAll(/-[ \t]*\r?\n[ \t]*|\s+|[^\s-]+|-/gu)(text));
  const [, segments] = A.mapAccum(runs, 0, (foldedStart, match) => {
    const source = A.getUnsafe(match, 0);
    const sourceStart = match.index === undefined ? 0 : match.index;
    const discretionaryHyphen = O.isSome(Str.search(/^-[ \t]*\r?\n[ \t]*$/u)(source));
    const whitespace = Str.isEmpty(Str.trim(source));
    const folded = discretionaryHyphen ? "" : whitespace ? " " : source;
    const foldedEnd = N.sum(foldedStart, Str.length(folded));
    return [
      foldedEnd,
      {
        folded,
        foldedEnd,
        foldedStart,
        sourceEnd: N.sum(sourceStart, Str.length(source)),
        sourceStart,
        whitespace,
      },
    ] as const;
  });
  return {
    segments,
    text: A.join(
      A.map(segments, (segment) => segment.folded),
      ""
    ),
  };
};

const sourceStartFor = (foldedIndex: number, folded: ReturnType<typeof foldWhitespace>): O.Option<number> =>
  A.findFirst(
    folded.segments,
    (segment) => N.isLessThanOrEqualTo(segment.foldedStart, foldedIndex) && N.isLessThan(foldedIndex, segment.foldedEnd)
  ).pipe(
    O.map((segment) =>
      segment.whitespace
        ? segment.sourceStart
        : N.sum(segment.sourceStart, N.subtract(foldedIndex, segment.foldedStart))
    )
  );

const sourceEndFor = (foldedIndex: number, folded: ReturnType<typeof foldWhitespace>): O.Option<number> =>
  A.findFirst(
    folded.segments,
    (segment) => N.isLessThan(segment.foldedStart, foldedIndex) && N.isLessThanOrEqualTo(foldedIndex, segment.foldedEnd)
  ).pipe(
    O.map((segment) =>
      segment.whitespace ? segment.sourceEnd : N.sum(segment.sourceStart, N.subtract(foldedIndex, segment.foldedStart))
    )
  );

const nearestWhitespaceFoldedSpan = (
  text: string,
  quote: string,
  claimedStart: number
): O.Option<readonly [startChar: number, endChar: number]> => {
  const foldedText = foldWhitespace(text);
  const foldedQuote = foldWhitespace(quote).text;
  if (Str.isEmpty(foldedQuote)) {
    return O.none();
  }
  const candidates = A.getSomes(
    A.map(exactOccurrences(foldedText.text, foldedQuote), (foldedStart) => {
      const foldedEnd = N.sum(foldedStart, Str.length(foldedQuote));
      return O.all([sourceStartFor(foldedStart, foldedText), sourceEndFor(foldedEnd, foldedText)]);
    })
  );
  return A.reduce(
    candidates,
    O.none<{ readonly distance: number; readonly span: readonly [number, number] }>(),
    (best, span) => {
      const distance = anchorDistance(span[0], claimedStart);
      if (N.isGreaterThan(distance, GOLD_ANCHOR_DRIFT_WINDOW)) {
        return best;
      }
      return O.match(best, {
        onNone: () => O.some({ distance, span }),
        onSome: (current) => (N.isLessThan(distance, current.distance) ? O.some({ distance, span }) : best),
      });
    }
  ).pipe(O.map((best) => best.span));
};

/**
 * Resolves a proposed quote to an exact canonical-text slice within the gold drift window.
 *
 * **Details**
 *
 * An exact match at the claimed offset wins. Nearby exact matches are considered
 * next, followed by whitespace-folded matches. Every result carries the real
 * UTF-16 offsets and exact document slice.
 *
 * **Example** (Recover a line-broken quote)
 *
 * ```ts
 * import { resolveGoldQuoteAnchor } from "@/canary/Gold"
 *
 * console.log(resolveGoldQuoteAnchor("alpha\n beta", "alpha beta", 0))
 * ```
 *
 * @category anchoring
 * @since 0.0.0
 */
type GoldQuoteAnchor = readonly [startChar: number, endChar: number, quote: string];

export const resolveGoldQuoteAnchor: {
  (quote: string, claimedStart: number): (text: string) => O.Option<GoldQuoteAnchor>;
  (text: string, quote: string, claimedStart: number): O.Option<GoldQuoteAnchor>;
} = dual(3, (text: string, quote: string, claimedStart: number) => {
  if (Str.isEmpty(quote)) {
    return O.none();
  }
  const quoteLength = Str.length(quote);
  const claimedEnd = N.sum(claimedStart, quoteLength);
  const exactAtClaim = O.some(claimedStart).pipe(
    O.filter(() => Str.Equivalence(Str.slice(claimedStart, claimedEnd)(text), quote)),
    O.map((startChar) => [startChar, claimedEnd] as const)
  );
  const exactNearby = nearestStartWithinWindow(exactOccurrences(text, quote), claimedStart).pipe(
    O.map((startChar) => [startChar, N.sum(startChar, quoteLength)] as const)
  );
  return exactAtClaim.pipe(
    O.orElse(() => exactNearby),
    O.orElse(() => nearestWhitespaceFoldedSpan(text, quote, claimedStart)),
    O.map(([startChar, endChar]) => [startChar, endChar, Str.slice(startChar, endChar)(text)] as const)
  );
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
  const config = yield* LabConfig;
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
    .pipe(
      Effect.timeout(config.goldGenerationTimeout),
      Effect.mapError(() =>
        unavailable("provider-failed", "The gold proposer failed or exceeded its configured generation timeout.")
      )
    );
  const proposed = yield* decodeProposal(job.subset, response.text);
  const entityLabels = Str.Equivalence(job.subset, "relation")
    ? yield* entityLabelsFor(outputDirectory, job.paperId, canonical.text)
    : [];
  const verified = yield* Effect.forEach(
    proposed,
    Effect.fnUntraced(function* (label) {
      const resolved = resolveGoldQuoteAnchor(canonical.text, label.quote, label.startChar);
      if (O.isNone(resolved)) {
        return O.none();
      }
      const [startChar, endChar, quote] = resolved.value;
      const anchor = yield* S.decodeEffect(TextAnchor)({
        endChar,
        quote,
        startChar,
      }).pipe(Effect.result);
      if (Result.isFailure(anchor)) {
        return O.none();
      }
      const verification = yield* canonicalizer.verify(canonical, anchor.success).pipe(Effect.result);
      if (Result.isFailure(verification)) {
        return O.none();
      }
      const endpoints = relationEndpointsFor(label, entityLabels, anchor.success);
      return yield* makeVerifiedGoldLabel(label, anchor.success, endpoints);
    })
  );
  const labels = A.getSomes(verified);
  const file = yield* (
    job.subset === "structure"
      ? GoldFile.makeEffect({
          labels: A.filter(labels, isGoldStructureLabel),
          paperId: job.paperId,
          proposer,
          subset: "structure",
          version: "gold/v1",
        })
      : job.subset === "entity"
        ? GoldFile.makeEffect({
            labels: A.filter(labels, isGoldEntityLabel),
            paperId: job.paperId,
            proposer,
            subset: "entity",
            version: "gold/v1",
          })
        : GoldFile.makeEffect({
            labels: A.filter(labels, isGoldRelationLabel),
            paperId: job.paperId,
            proposer,
            subset: "relation",
            version: "gold/v1",
          })
  ).pipe(
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
  | LabConfig
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
  const encodedProposer = yield* S.encodeEffect(ModelIdentity)(proposer).pipe(Effect.orDie);
  const inventory = yield* readWrittenGold(options.outputDirectory, expectedJobs);
  if (
    A.some(inventory.files, (file) => !GoldArtifactSemantics.modelIdentityEquivalence(file.proposer, encodedProposer))
  ) {
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
      const digest = yield* contentDigest(S.Array(GoldFileEncoded))(inventory.files).pipe(
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
