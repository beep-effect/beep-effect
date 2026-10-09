/**
 * Single-writer qualification state and read-only cache policy audit operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import {
  auditCachePolicy,
  CacheActivationProjection,
  CacheEvidenceReference,
  CachePolicyAuditRequest,
  CachePolicyBaseline,
  CachePolicyBaselineRecordRequest,
  CachePolicyBaselineReview,
  CachePolicyNode,
  CachePolicyProjection,
  CacheQualificationEvent,
  CacheQualificationKey,
  CacheQualificationStatus,
  CacheQualificationStore,
  CacheTaskConfiguration,
  CacheTaskContract,
  cacheLedgerFailures,
  cachePolicyBaselineFailures,
  isCacheTransitionAllowed,
  recordCachePolicyBaseline,
} from "@beep/repo-configs/cache";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Rec from "effect/Record";
import * as R from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readContainedFileBytesNoFollow, writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { TurboCacheEnvName } from "../../internal/cli/TurboCache.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { PosInt } from "../../internal/schema/PosInt.ts";
import { CacheProducerAcceptanceReference } from "./Cache.acceptance.schemas.ts";
import { loadCacheProducerStoreConfiguration, readCacheProducerAcceptance } from "./Cache.acceptance.store.ts";
import { collectCacheCensus } from "./Cache.census.ts";
import { readCacheEvidenceBytes } from "./Cache.evidence.ts";
import {
  collectCacheToolchain,
  fingerprintCacheComputation,
  projectCacheActivation,
  projectCacheSignedActivation,
} from "./Cache.fingerprint.ts";
import { CacheActivationPreview, CacheCommandError, CacheRemoteReadsRequest } from "./Cache.schemas.ts";
import type { CachePolicyAuditReport, CachePolicyBaselineRecord } from "@beep/repo-configs/cache";
import type {
  CacheActivationRequest,
  CacheBaselineRequest,
  CacheCensusReport,
  CacheLiveIdentity,
  CacheToolchainSnapshot,
  CacheTransitionRequest,
} from "./Cache.schemas.ts";

const CacheAcceptedReferenceJson = S.fromJsonString(CacheProducerAcceptanceReference);

const $I = $RepoCliId.create("commands/Cache/Cache.service");
const baselinePath = "standards/cache-qualification-baseline.json";
const storePath = "standards/cache-qualification.json";
const BaselineJson = JsonStringCodec(CachePolicyBaseline);
const StoreJson = JsonStringCodec(CacheQualificationStore);
const sameKey = S.toEquivalence(CacheQualificationKey);
const sameContract = S.toEquivalence(CacheTaskContract);
const sameOptionalDigest = S.toEquivalence(S.Option(CacheEvidenceReference.fields.sha256));
const sameReference = S.toEquivalence(CacheEvidenceReference);
const encodePrettyBaseline = S.encodeEffect(S.fromJsonString(CachePolicyBaseline, { space: 2 }));

/**
 * Encode a reviewed baseline as the pretty-printed JSON text the repository commits.
 *
 * **Details**
 *
 * The file is indented so each node, review and source occupies its own
 * lines. Git merges line regions, so two re-records that stamp different
 * subjects change disjoint regions and merge without conflict; a single
 * minified line conflicts on every concurrent edit.
 *
 * **Example** (Encode a root-only baseline)
 *
 * ```ts
 * import { encodeCachePolicyBaselineText } from "@beep/repo-cli/commands/Cache"
 * import * as Cache from "@beep/repo-configs/cache"
 * import { Sha256Hex } from "@beep/schema"
 * import * as Effect from "effect/Effect"
 * const digest = Sha256Hex.make("0000000000000000000000000000000000000000000000000000000000000000")
 * const review = Cache.CacheReviewDecision.make({ reviewer: "fixture", reason: "empty", basis: Cache.CacheEvidenceReference.make({ path: "review.md", sha256: digest }) })
 * const baseline = Cache.CachePolicyBaseline.make({
 *   profile: "fixture", epoch: "v1", scope: ["fixture#lint"], reviews: { "//": review },
 *   projection: Cache.CachePolicyProjection.make({ globalConfiguration: {}, nodes: [], sources: [] }),
 * })
 * console.assert(Effect.runSync(encodeCachePolicyBaselineText(baseline)).includes("\n  \"reviews\": {\n"))
 * ```
 *
 * @param baseline - The reviewed baseline to serialise.
 * @returns Indented JSON text ending in a newline.
 * @category encoding
 * @since 0.0.0
 */
export const encodeCachePolicyBaselineText = Effect.fn("CacheQualification.encodeBaselineText")(function* (
  baseline: CachePolicyBaseline
) {
  const encoded = yield* encodePrettyBaseline(baseline);
  return `${encoded}\n`;
});
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

const hashText = (text: string) => hashBytes(new TextEncoder().encode(text));

const decodeUtf8 = (bytes: Uint8Array) =>
  Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    catch: (cause) => CacheCommandError.new("Qualification text is not valid UTF-8.", cause),
  });
const readOptionalBytes = (root: string, target: string) =>
  readContainedFileBytesNoFollow(root, target, S.Natural.make(8 * 1024 * 1024)).pipe(
    Effect.map((read) => read.contents),
    CacheCommandError.mapError("Cannot read bounded qualification file.")
  );
const readOptional = Effect.fn("CacheQualification.readOptional")(function* (root: string, target: string) {
  const contents = yield* readOptionalBytes(root, target);
  return yield* O.match(contents, {
    onNone: () => Effect.succeedNone,
    onSome: (bytes) => decodeUtf8(bytes).pipe(Effect.asSome),
  });
}, CacheCommandError.mapError("Cannot read contained qualification file."));

const readRequired = Effect.fn("CacheQualification.readRequired")(function* (root: string, target: string) {
  return yield* readOptional(root, target).pipe(
    Effect.flatMap(Effect.fromOption(() => CacheCommandError.new(`Required qualification file is missing: ${target}`)))
  );
});

const verifyReference = Effect.fn("CacheQualification.verifyReference")(function* (
  root: string,
  reference: CacheEvidenceReference
) {
  const bytes = yield* readCacheEvidenceBytes(root, reference);
  return yield* decodeUtf8(bytes);
}, CacheCommandError.mapError("Cannot verify qualification evidence bytes."));

const readStore = Effect.fn("CacheQualification.readStore")(function* (root: string) {
  const store = yield* readRequired(root, storePath).pipe(Effect.flatMap(StoreJson.decode));
  const failures = cacheLedgerFailures(store);
  if (A.isReadonlyArrayNonEmpty(failures))
    return yield* CacheCommandError.new(`Qualification history is invalid: ${A.join(failures, ", ")}.`);
  return store;
}, CacheCommandError.mapError("Cannot load qualification ledger."));

const verifyReviewBases = Effect.fn("CacheQualification.verifyReviewBases")(function* (
  root: string,
  baseline: CachePolicyBaseline
) {
  const bases = A.dedupeWith(
    A.map(Rec.values(baseline.reviews), (review) => review.basis),
    sameReference
  );
  yield* Effect.forEach(bases, (basis) => verifyReference(root, basis), { discard: true });
});

const readBaseline = Effect.fn("CacheQualification.readBaseline")(function* (root: string) {
  const baseline = yield* readRequired(root, baselinePath).pipe(Effect.flatMap(BaselineJson.decode));
  const failures = cachePolicyBaselineFailures(baseline);
  if (A.isReadonlyArrayNonEmpty(failures))
    return yield* CacheCommandError.new(`Reviewed baseline is incomplete: ${A.join(failures, ", ")}.`);
  yield* verifyReviewBases(root, baseline);
  return baseline;
}, CacheCommandError.mapError("Cannot load reviewed cache baseline."));

const projectCensus = (census: CacheCensusReport): CachePolicyProjection =>
  CachePolicyProjection.make({
    globalConfiguration: census.globalConfiguration,
    nodes: A.getSomes(
      A.map(census.nodes, (node) =>
        O.map(node.command, (command) =>
          CachePolicyNode.make({
            computation: node.id,
            command,
            commandDigest: node.commandDigest,
            dependencies: node.dependencies,
            configuration: node.configuration,
          })
        )
      )
    ),
    sources: A.filter(census.sources, (source) => /(?:^|\/)turbo\.jsonc?$/.test(source.path)),
  });

const verifyHistoryEntry = Effect.fn("CacheQualification.verifyHistoryEntry")(function* (
  root: string,
  entry: CacheQualificationStore["entries"][number]
) {
  if (entry.status.state === "unassessed") return;
  yield* verifyReference(root, entry.status.review.basis);
  if (entry.status.state === "shadow" || entry.status.state === "qualified") {
    yield* Effect.forEach(entry.status.receipts, (reference) => verifyReference(root, reference), { discard: true });
  }
});

const verifyQualifiedEvidence = Effect.fn("CacheQualification.verifyQualifiedEvidence")(function* (
  root: string,
  entry: CacheQualificationStore["entries"][number]
) {
  const { status } = entry;
  if (status.state !== "qualified") return;
  yield* validateContractEligibility(entry.key, status.contract);
  if (status.receipts.length !== 1)
    return yield* CacheCommandError.new("Qualified entries require exactly one immutable acceptance reference.");
  const reference = yield* verifyReference(root, status.receipts[0]).pipe(
    Effect.flatMap(S.decodeUnknownEffect(CacheAcceptedReferenceJson))
  );
  const configuration = yield* loadCacheProducerStoreConfiguration();
  const accepted = yield* readCacheProducerAcceptance(configuration.directory, reference, configuration.trust);
  if (!sameContract(accepted.contract, status.contract) || !sameKey(accepted.contract.key, entry.key))
    return yield* CacheCommandError.new(
      "Qualified ledger contract differs from its independently authenticated acceptance."
    );
}, CacheCommandError.mapError("Cannot verify qualified acceptance against independently configured trust."));

const audit = Effect.fn("CacheQualification.audit")(function* (root: string) {
  const baseline = yield* readBaseline(root);
  const store = yield* readStore(root);
  yield* Effect.forEach(store.history, ({ entry }) => verifyHistoryEntry(root, entry), { discard: true });
  yield* Effect.forEach(store.entries, (entry) => verifyQualifiedEvidence(root, entry), { discard: true });
  yield* Effect.forEach(
    A.filter(store.entries, (entry) => entry.status.state === "qualified"),
    (entry) => validateTransitionScope(entry.key, baseline),
    { discard: true }
  );
  const census = yield* collectCacheCensus(root);
  if (
    A.some(store.entries, (entry) =>
      CacheQualificationStatus.isAnyOf(["candidate", "shadow", "qualified"])(entry.status)
    )
  ) {
    const toolchain = yield* collectCacheToolchain(root);
    yield* Effect.forEach(
      store.entries,
      Effect.fn("CacheQualification.validateActiveEntry")(function* (entry) {
        if (!CacheQualificationStatus.isAnyOf(["candidate", "shadow", "qualified"])(entry.status)) return;
        yield* validateLiveContract(
          entry.status.contract,
          yield* contractIdentity(root, entry.status.contract, census, toolchain)
        );
      }),
      { discard: true }
    );
  }
  return auditCachePolicy(
    CachePolicyAuditRequest.make({
      baseline,
      store,
      current: projectCensus(census),
      profile: baseline.profile,
      epoch: baseline.epoch,
    })
  );
});

const validateLiveContract = Effect.fn("CacheQualification.validateLiveContract")(function* (
  contract: CacheTaskContract,
  identity: CacheLiveIdentity
) {
  if (contract.pins.configuration !== identity.configurationDigest)
    return yield* CacheCommandError.new("Reviewed computation configuration digest has drifted.");
  if (contract.pins.toolchain !== identity.toolchainDigest)
    return yield* CacheCommandError.new("Reviewed runtime/toolchain digest has drifted.");
  const node = yield* A.findFirst(identity.configuration.nodes, (entry) => entry.id === contract.key.computation).pipe(
    Effect.fromOption(() => CacheCommandError.new("Reviewed contract computation is absent from the observed graph."))
  );
  if (
    !S.toEquivalence(CacheTaskConfiguration)(contract.configuration, node.configuration) ||
    !S.toEquivalence(S.Array(S.String))(A.sort(contract.dependencies, Order.String), node.dependencies) ||
    contract.commandDigest !== node.commandDigest ||
    !O.contains(contract.commands[0])(node.command)
  )
    return yield* CacheCommandError.new(
      "Reviewed command, dependencies or task configuration differ from the observed computation."
    );
  if (
    contract.clients.stable.version !== identity.toolchain.turbo.version ||
    contract.clients.stable.sha256 !== identity.toolchain.turbo.sha256
  )
    return yield* CacheCommandError.new("The observed stable Turbo binary differs from the reviewed client pin.");
});

const contractIdentity = Effect.fn("CacheQualification.contractIdentity")(function* (
  root: string,
  contract: CacheTaskContract,
  census: CacheCensusReport,
  toolchain: CacheToolchainSnapshot
) {
  if (O.isNone(contract.activation)) {
    if (O.isSome(contract.signedExecution))
      return yield* CacheCommandError.new("Signed execution requires a reviewed activation projection.");
    return yield* fingerprintCacheComputation(contract.key, census, toolchain);
  }
  const activation = contract.activation.value;
  const before = yield* verifyReference(root, activation.before);
  const after = yield* verifyReference(root, activation.after);
  yield* verifyReference(
    root,
    CacheEvidenceReference.make({ path: activation.path, sha256: activation.before.sha256 })
  );
  if (O.isNone(contract.signedExecution))
    return yield* projectCacheActivation(contract.key, census, toolchain, activation, before, after);
  const execution = contract.signedExecution.value;
  const verifySignedActivation = Effect.fn("CacheQualification.verifySignedActivation")(function* () {
    const expectedKey = CacheQualificationKey.make({
      ...execution.sourceKey,
      profile: `${execution.sourceKey.profile}-private-loopback-signed-v1`,
    });
    if (!sameKey(contract.key, expectedKey))
      return yield* CacheCommandError.new("Signed execution tuple differs from its reviewed source tuple.");
    const source = yield* fingerprintCacheComputation(execution.sourceKey, census, toolchain);
    if (
      source.configurationDigest !== execution.sourceConfiguration ||
      source.toolchainDigest !== execution.sourceToolchain ||
      source.toolchainDigest !== execution.runtimeKeys.stable
    )
      return yield* CacheCommandError.new("Signed execution source or stable runtime identity has drifted.");
    const target = yield* projectCacheActivation(execution.sourceKey, census, toolchain, activation, before, after);
    if (target.configurationDigest !== execution.activatedConfiguration)
      return yield* CacheCommandError.new("Signed execution activation identity has drifted.");
    const preview = yield* verifyReference(root, execution.activationRequest).pipe(
      Effect.flatMap(JsonStringCodec(CacheActivationPreview).decode),
      CacheCommandError.mapError("Cannot decode the reviewed signed activation preview.")
    );
    if (!S.toEquivalence(CacheActivationPreview)(preview, CacheActivationPreview.make({ activation, source, target })))
      return yield* CacheCommandError.new("Signed execution preview differs from the live source and activation.");
  });
  yield* verifySignedActivation();
  return yield* projectCacheSignedActivation(
    execution.sourceKey,
    census,
    toolchain,
    activation,
    before,
    after,
    yield* readRequired(root, "turbo.json"),
    yield* verifyReference(root, execution.signedRootConfiguration)
  );
});

const previewActivation = Effect.fn("CacheQualification.previewActivation")(function* (
  root: string,
  request: CacheActivationRequest
) {
  const baseline = yield* readBaseline(root);
  if (!A.contains(baseline.scope, request.computation))
    return yield* CacheCommandError.new("Activation preview is outside the reviewed qualification scope.");
  const key = CacheQualificationKey.make({
    computation: request.computation,
    layer: "turbo-task-result",
    profile: baseline.profile,
    epoch: baseline.epoch,
  });
  const before = yield* verifyReference(root, request.before);
  const after = yield* verifyReference(root, request.after);
  yield* verifyReference(root, CacheEvidenceReference.make({ path: request.path, sha256: request.before.sha256 }));
  const census = yield* collectCacheCensus(root);
  const toolchain = yield* collectCacheToolchain(root);
  const source = yield* fingerprintCacheComputation(key, census, toolchain);
  const activation = CacheActivationProjection.make({
    path: request.path,
    before: request.before,
    after: request.after,
    sourceConfiguration: source.configurationDigest,
  });
  const target = yield* projectCacheActivation(key, census, toolchain, activation, before, after);
  return CacheActivationPreview.make({ activation, source, target });
});

const fingerprint = Effect.fn("CacheQualification.fingerprint")(function* (root: string, computation: string) {
  const baseline = yield* readBaseline(root);
  if (!A.contains(baseline.scope, computation))
    return yield* CacheCommandError.new("Computation is outside the reviewed qualification scope.");
  const key = CacheQualificationKey.make({
    computation,
    layer: "turbo-task-result",
    profile: baseline.profile,
    epoch: baseline.epoch,
  });
  return yield* fingerprintCacheComputation(key, yield* collectCacheCensus(root), yield* collectCacheToolchain(root));
});

// The directory is a cross-process mutex. Never steal a stale or live lock;
// interrupted writes leave the prior atomic ledger intact and require inspection.
const withWriter = Effect.fn("CacheQualification.withWriter")(function* <A, E, R>(
  root: string,
  body: Effect.Effect<A, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* writeContainedFileString(root, ".beep/cache/qualification-parent", "cache-qualification/v1\n");
  const lock = path.join(root, ".beep/cache/qualification.writer");
  return yield* Effect.acquireUseRelease(
    fs
      .makeDirectory(lock)
      .pipe(CacheCommandError.mapError("Qualification writer is locked; inspect the existing owner before retrying.")),
    () => body,
    () => fs.remove(lock, { recursive: true }).pipe(Effect.orDie)
  );
});

const writeBaseline = Effect.fn("CacheQualification.writeBaseline")(function* (
  root: string,
  request: CacheBaselineRequest
) {
  return yield* withWriter(
    root,
    Effect.gen(function* () {
      const prior = yield* readOptional(root, baselinePath);
      const expected = yield* O.match(prior, {
        onNone: () => Effect.succeedNone,
        onSome: (text) => hashText(text).pipe(Effect.asSome),
      });
      if (!sameOptionalDigest(expected, request.previous)) {
        return yield* CacheCommandError.new("Reviewed baseline changed; refresh its digest before replacing it.");
      }
      const previous = yield* O.match(prior, {
        onNone: () => Effect.succeedNone,
        onSome: (text) =>
          BaselineJson.decode(text).pipe(
            Effect.asSome,
            CacheCommandError.mapError(
              "The committed baseline does not decode; remove it and re-record without a previous digest."
            )
          ),
      });
      yield* verifyReference(root, request.review.basis);
      const census = yield* collectCacheCensus(root);
      const projection = projectCensus(census);
      for (const computation of request.scope) {
        if (!A.some(projection.nodes, (node) => node.computation === computation)) {
          return yield* CacheCommandError.new("Baseline scope contains a missing or graph-only computation.");
        }
      }
      const record = yield* R.match(
        recordCachePolicyBaseline(
          CachePolicyBaselineRecordRequest.make({
            prior: previous,
            projection,
            review: CachePolicyBaselineReview.make({
              review: request.review,
              scope: request.scope,
              profile: request.profile,
              epoch: request.epoch,
              subjects: request.subjects,
            }),
          })
        ),
        {
          onFailure: (rejection) =>
            CacheCommandError.new(
              `Baseline review does not cover the changed subjects. Unreviewed: ${A.join(rejection.unreviewed, ", ")}. Unknown: ${A.join(rejection.unknown, ", ")}.`
            ),
          onSuccess: Effect.succeed,
        }
      );
      const existingStore = yield* readOptional(root, storePath);
      if (O.isNone(existingStore)) {
        if (O.isSome(prior))
          return yield* CacheCommandError.new(
            "The qualification ledger is missing; baseline review cannot reset qualification state."
          );
        const initial = yield* StoreJson.encode(
          CacheQualificationStore.make({ revision: S.Natural.make(0), entries: [], history: [] })
        );
        yield* writeContainedFileString(root, storePath, `${initial}\n`);
      } else {
        yield* readStore(root);
      }
      const encoded = yield* encodeCachePolicyBaselineText(record.baseline);
      yield* writeContainedFileString(root, baselinePath, encoded);
      return record;
    })
  );
}, CacheCommandError.mapError("Cannot write reviewed cache baseline."));

const validateContractEligibility = Effect.fn("CacheQualification.validateContractEligibility")(function* (
  key: CacheQualificationKey,
  contract: CacheTaskContract
) {
  if (!sameKey(key, contract.key)) return yield* CacheCommandError.new("Transition contract uses a different tuple.");
  if (
    Str.endsWith("-private-loopback-signed-v1")(key.profile) &&
    (O.isNone(contract.signedExecution) || O.isNone(contract.activation))
  )
    return yield* CacheCommandError.new("Signed qualification requires a reviewed execution profile and activation.");
  if (contract.configuration.persistent || contract.configuration.interactive) {
    return yield* CacheCommandError.new("Persistent or interactive commands cannot be qualified.");
  }
  if (contract.clients.stable.namespace === contract.clients.canary.namespace) {
    return yield* CacheCommandError.new("Stable and canary namespaces must be isolated.");
  }
});

const validatePriorContract = Effect.fn("CacheQualification.validatePriorContract")(function* (
  contract: CacheTaskContract,
  prior: O.Option<CacheQualificationStore["entries"][number]>
) {
  if (O.isSome(prior) && CacheQualificationStatus.isAnyOf(["candidate", "shadow", "qualified"])(prior.value.status)) {
    if (!sameContract(contract, prior.value.status.contract))
      return yield* CacheCommandError.new("Contract changes require a new candidate review.");
  }
});

const validateTransitionContract = Effect.fn("CacheQualification.validateTransitionContract")(function* (
  root: string,
  request: CacheTransitionRequest,
  prior: O.Option<CacheQualificationStore["entries"][number]>
) {
  const { key, status } = request.entry;
  if (!CacheQualificationStatus.isAnyOf(["candidate", "shadow", "qualified", "suspended"])(status)) return;
  yield* validateContractEligibility(key, status.contract);
  if (status.state === "candidate" && status.review.basis.sha256 !== status.contract.pins.contract) {
    return yield* CacheCommandError.new("Candidate review must identify the contract worksheet bytes.");
  }
  if (status.state !== "candidate") yield* validatePriorContract(status.contract, prior);
  if (status.state === "shadow") {
    // Shadow preserves fresh execution authority. Bytes are retained as observations;
    // they are not interpreted as passing qualification evidence here.
    yield* Effect.forEach(status.receipts, (reference) => verifyReference(root, reference), { discard: true });
  }
  if (status.state === "qualified") yield* verifyQualifiedEvidence(root, request.entry);
});

const validateTransitionScope = Effect.fn("CacheQualification.validateTransitionScope")(function* (
  key: CacheQualificationKey,
  baseline: CachePolicyBaseline
) {
  if (key.layer !== "turbo-task-result")
    return yield* CacheCommandError.new("This reuse layer belongs to another proof owner.");
  if (
    key.profile !== baseline.profile ||
    key.epoch !== baseline.epoch ||
    !A.contains(baseline.scope, key.computation)
  ) {
    return yield* CacheCommandError.new("Transition is outside the reviewed pilot scope, profile or epoch.");
  }
});

const validateAdoption = Effect.fn("CacheQualification.validateAdoption")(function* (
  root: string,
  request: CacheTransitionRequest,
  baseline: CachePolicyBaseline,
  next: CacheQualificationStore
) {
  const { key, status } = request.entry;
  if (CacheQualificationStatus.isAnyOf(["candidate", "shadow", "qualified"])(status)) {
    const census = yield* collectCacheCensus(root);
    yield* validateLiveContract(
      status.contract,
      yield* contractIdentity(root, status.contract, census, yield* collectCacheToolchain(root))
    );
    const current = projectCensus(census);
    if (!A.some(current.nodes, (node) => node.computation === key.computation))
      return yield* CacheCommandError.new("A missing script cannot enter qualification.");
    const report = auditCachePolicy(
      CachePolicyAuditRequest.make({ baseline, current, store: next, profile: key.profile, epoch: key.epoch })
    );
    if (A.some(report.findings, (finding) => finding.blocking))
      return yield* CacheCommandError.new("Current configuration fails the reviewed cache policy audit.");
  }
});

const transition = Effect.fn("CacheQualification.transition")(function* (
  root: string,
  request: CacheTransitionRequest
) {
  return yield* withWriter(
    root,
    Effect.gen(function* () {
      const baseline = yield* readBaseline(root);
      const store = yield* readStore(root);
      if (store.revision !== request.expectedRevision)
        return yield* CacheCommandError.new("Qualification revision conflict.");
      const { key, status } = request.entry;
      yield* validateTransitionScope(key, baseline);
      const prior = A.findFirst(store.entries, (entry) => sameKey(entry.key, key));
      const previousState = O.match(prior, {
        onNone: () => "unassessed" as const,
        onSome: (entry) => entry.status.state,
      });
      if (!isCacheTransitionAllowed(previousState, status.state))
        return yield* CacheCommandError.new("Illegal qualification lifecycle transition.");
      if (status.state === "unassessed")
        return yield* CacheCommandError.new("Unassessed is an initial state, not a reviewed transition.");
      yield* verifyReference(root, status.review.basis);
      yield* validateTransitionContract(root, request, prior);
      const next = CacheQualificationStore.make({
        revision: S.Natural.make(store.revision + 1),
        history: A.append(
          store.history,
          CacheQualificationEvent.make({ revision: PosInt.make(store.revision + 1), entry: request.entry })
        ),
        entries: A.append(
          A.filter(store.entries, (entry) => !sameKey(entry.key, key)),
          request.entry
        ),
      });
      // Suspension/exclusion must remain available even while the live graph is
      // broken. Candidate/shadow/qualified adoption must match the current executable graph.
      yield* validateAdoption(root, request, baseline, next);
      const encoded = yield* StoreJson.encode(next);
      yield* verifyQualifiedEvidence(root, request.entry);
      yield* writeContainedFileString(root, storePath, `${encoded}\n`);
      return next;
    })
  );
}, CacheCommandError.mapError("Cannot apply qualification transition."));

/**
 * Cache-owned operations; consumers cannot write the qualification ledger directly.
 *
 * @category services
 * @since 0.0.0
 */
export interface CacheQualificationServiceShape {
  /** Preview a reviewed single-task cache activation without changing files or ledger state. */
  readonly activation: (
    root: string,
    request: CacheActivationRequest
  ) => Effect.Effect<CacheActivationPreview, CacheCommandError>;
  /** Read-only effective configuration audit. */
  readonly audit: (root: string) => Effect.Effect<CachePolicyAuditReport, CacheCommandError>;
  /** Re-record the reviewed baseline after its digest precondition matches, stamping the review on changed subjects. */
  readonly baseline: (
    root: string,
    request: CacheBaselineRequest
  ) => Effect.Effect<CachePolicyBaselineRecord, CacheCommandError>;
  /** Observe current configuration, dependency closure and supported runtime pins. */
  readonly fingerprint: (root: string, computation: string) => Effect.Effect<CacheLiveIdentity, CacheCommandError>;
  /** Read the current validated tuple ledger. */
  readonly inspect: (root: string) => Effect.Effect<CacheQualificationStore, CacheCommandError>;
  readonly remoteReads: (
    root: string,
    request: CacheRemoteReadsRequest
  ) => Effect.Effect<ReadonlyArray<string>, CacheCommandError>;
  /** Apply one legal reviewed transition with a revision compare-and-swap. */
  readonly transition: (
    root: string,
    request: CacheTransitionRequest
  ) => Effect.Effect<CacheQualificationStore, CacheCommandError>;
}

/**
 * Explicit operational authority for qualification state and audits.
 *
 * **Example** (Obtain the service in a program)
 *
 * ```ts
 * import { CacheQualificationService } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * const program = Effect.gen(function* () {
 *   const cache = yield* CacheQualificationService
 *   return yield* cache.inspect("/repo")
 * })
 * console.assert(Effect.isEffect(program))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CacheQualificationService extends Context.Service<
  CacheQualificationService,
  CacheQualificationServiceShape
>()($I`CacheQualificationService`) {}

const makeService = Effect.fn("CacheQualificationService.make")(function* () {
  const context = yield* Effect.context<Effect.Services<ReturnType<typeof collectCacheCensus>>>();
  return CacheQualificationService.of({
    remoteReads: Effect.fn("Cache.remoteReads")(
      function* (root, request) {
        const path = yield* Path.Path;
        const fs = yield* FileSystem.FileSystem;
        // Decode before creating even a missing .env; diagnostics never contain input values.
        const input = yield* S.decodeEffect(CacheRemoteReadsRequest)(request).pipe(
          Effect.mapError(() =>
            CacheCommandError.new(
              "Expected https TURBO_API, a single-line TURBO_TEAM, and an op://vault/item/[section/]field reference."
            )
          )
        );
        if (!(yield* fs.exists(path.join(root, "turbo.json"))))
          return yield* CacheCommandError.new("Not a beep checkout: turbo.json is missing.");
        const envFile = path.join(root, ".env");
        const original = O.getOrElse(yield* readOptional(root, envFile), () => "");
        let lines = Str.split(original, "\n");
        let reports: ReadonlyArray<string> = A.empty();
        const values: Readonly<Record<TurboCacheEnvName, string>> = {
          TURBO_API: input.api,
          TURBO_TOKEN: input.tokenRef,
          TURBO_TEAM: input.team,
          TURBO_CACHE: "local:rw,remote:r",
        };
        // Inspect every owned key before any write. Accept normal dotenv whitespace/export syntax.
        yield* Effect.forEach(
          TurboCacheEnvName.literals,
          Effect.fnUntraced(function* (name) {
            const pattern = new RegExp(`^[ \t]*(?:export[ \t]+)?${name}[ \t]*=[ \t]*(.*)$`, "u");
            if (A.length(A.filter(lines, (line) => Str.match(pattern)(line).pipe(O.isSome))) > 1)
              return yield* CacheCommandError.new(`duplicate ${name} assignments in .env; refusing to modify it`);
          })
        );
        yield* Effect.forEach(TurboCacheEnvName.literals, (name) =>
          Effect.sync(() => {
            const pattern = new RegExp(`^[ \t]*(?:export[ \t]+)?${name}[ \t]*=[ \t]*(.*)$`, "u");
            const index = A.findFirstIndex(lines, (line) => Str.match(pattern)(line).pipe(O.isSome));
            const current = O.flatMap(index, (i) => A.get(lines, i)).pipe(
              O.flatMap(Str.match(pattern)),
              O.flatMap((match) => A.get(match, 1)),
              O.map(Str.trim),
              O.map(Str.replace(/^(["'])(.*)\1$/u, "$2")),
              O.map(Str.trim),
              O.getOrElse(() => "")
            );
            const replace = name === "TURBO_TOKEN" && input.replaceToken && current !== input.tokenRef;
            if (Str.isNonEmpty(current) && !replace) {
              reports = A.append(reports, `${name} already present in .env — leaving it unchanged`);
              return;
            }
            const assignment = `${name}=${values[name]}`;
            lines = O.match(index, {
              onNone: () => [...lines, assignment],
              onSome: (i) => A.map(lines, (line, at) => (at === i ? assignment : line)),
            });
            reports = A.append(
              reports,
              `${replace ? "replaced" : O.isSome(index) ? "repaired blank" : "wrote"} ${name}${name === "TURBO_TEAM" ? `=${input.team}` : ""}`
            );
          })
        );
        const next = `${Str.replace(/\n*$/u, "")(A.join(lines, "\n"))}\n`;
        if (next !== original) {
          if (yield* fs.exists(envFile)) {
            const backup = yield* fs.makeTempFile({ directory: root, prefix: ".env.backup-" });
            yield* fs.chmod(backup, 0o600);
            yield* fs.writeFileString(backup, original);
            reports = A.append(reports, `backup: ${path.relative(root, backup)}`);
          }
          // The guarded writer refuses symlinks and paths outside this checkout.
          yield* writeContainedFileString(root, envFile, next);
          yield* fs.chmod(envFile, 0o600);
        }
        return [...reports, "Verify: bun run check --filter=@beep/types --dry=json"];
      },
      Effect.mapError((cause) =>
        S.is(CacheCommandError)(cause)
          ? cause
          : CacheCommandError.new("Cannot configure remote reads; no secret values are rendered.")
      ),
      Effect.provide(context)
    ),
    activation: Effect.fn("CacheQualificationService.activation")((root, request) =>
      previewActivation(root, request).pipe(Effect.provide(context))
    ),
    audit: Effect.fn("CacheQualificationService.audit")((root) => audit(root).pipe(Effect.provide(context))),
    inspect: Effect.fn("CacheQualificationService.inspect")((root) => readStore(root).pipe(Effect.provide(context))),
    fingerprint: Effect.fn("CacheQualificationService.fingerprint")((root, computation) =>
      fingerprint(root, computation).pipe(Effect.provide(context))
    ),
    baseline: Effect.fn("CacheQualificationService.baseline")((root, request) =>
      writeBaseline(root, request).pipe(Effect.provide(context))
    ),
    transition: Effect.fn("CacheQualificationService.transition")((root, request) =>
      transition(root, request).pipe(Effect.provide(context))
    ),
  });
});

/**
 * Live filesystem, crypto and subprocess implementation of Cache qualification operations.
 *
 * **Example** (Provide Cache operations)
 *
 * ```ts
 * import { CacheQualificationLive, CacheQualificationService } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * const program = CacheQualificationService.pipe(Effect.provide(CacheQualificationLive))
 * console.assert(Effect.isEffect(program))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CacheQualificationLive = Layer.effect(CacheQualificationService, makeService());
