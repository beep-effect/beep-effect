/**
 * Declared local root probes that produce privacy-safe inventory evidence.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AiMetricsGitRootEvidence, observeAiMetricsGitRoot } from "./git-root-evidence.ts";
import { AiMetricsCanonicalRootInput } from "./identity-registry.ts";
import { readBoundedMetadata } from "./internal/bounded-metadata.ts";
import {
  ObservationCapability,
  ObservationHarness,
  ObservationHeartbeat,
  ObservationHost,
  ObservationIdentity,
  ObservationInventory,
  ObservationInventoryError,
  ObservationPolicy,
  ObservationPopulation,
  ObservationRoot,
  ObservationRootBinding,
  ObservationRoute,
} from "./observation-inventory.ts";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("observation-root-probe");
const PrivateLabel = S.NonEmptyString.check(S.isMaxLength(4096)).pipe(
  $I.annoteSchema("PrivateLabel", { description: "Bounded local label or path; never emitted in probe results." })
);

/**
 * Explicit local scope for a metadata-only root probe.
 *
 * **Example**
 * ```ts
 * import { ObservationRootDeclaration } from "@beep/repo-ai-metrics/observation-root-probe"
 * import * as S from "effect/Schema"
 * console.log(S.is(ObservationRootDeclaration)({})) // false
 * ```
 * **Details** The host key must remain stable and differ between hosts. Retirement is operator evidence; retired paths are never accessed. This private declaration must not be published.
 * @category models
 * @since 0.0.0
 */
export class ObservationRootDeclaration extends S.Opaque<
  ObservationRootDeclaration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("agent-observation-root-declaration/v1"),
    hostKey: PrivateLabel,
    populationWindowStart: S.DateTimeUtcFromString,
    populationWindowEnd: S.DateTimeUtcFromString,
    roots: S.Array(S.Struct({ path: PrivateLabel, state: S.Literals(["inspect", "retired"]) })).check(
      S.isMaxLength(32)
    ),
  })
    .check(
      S.makeFilter(
        (value) =>
          Str.trim(value.hostKey).length > 0 &&
          DateTime.toEpochMillis(value.populationWindowStart) < DateTime.toEpochMillis(value.populationWindowEnd),
        {
          identifier: "RootDeclarationWindow",
          title: "Root declaration window",
          description: "The private host key must be nonblank and the declared population window nonempty.",
          message: "Invalid root declaration boundary",
        }
      )
    )
    .pipe(
      $I.annoteSchema("ObservationRootDeclaration", {
        description: "At most 32 explicit roots on one declared local host.",
      })
    )
) {}

const ReceiptBody = S.Struct({
  version: S.tag("agent-observation-root-receipt/v1"),
  host: ObservationHost,
  rootId: ObservationRoot.fields.rootId,
  declaredState: S.Literals(["inspect", "retired"]),
  availability: ObservationRoot.fields.availability,
  observedAt: S.DateTimeUtcFromString,
  git: AiMetricsGitRootEvidence,
}).pipe(
  $I.annoteSchema("RootReceiptBody", { description: "Path-free root observation and declared retirement evidence." })
);

/**
 * Content-addressed, path-free evidence for one root observation.
 *
 * **Example**
 * ```ts
 * import { ObservationRootReceipt } from "@beep/repo-ai-metrics/observation-root-probe"
 * import * as S from "effect/Schema"
 * console.log(S.is(ObservationRootReceipt)({})) // false
 * ```
 * **Details** Retained alongside the inventory so verified identities have inspectable evidence, not only unexplained hashes.
 * @category models
 * @since 0.0.0
 */
export class ObservationRootReceipt extends S.Opaque<ObservationRootReceipt, { readonly brand: unique symbol }>()(
  S.Struct({ evidenceId: Sha256Hex, observation: ReceiptBody }).pipe(
    $I.annoteSchema("ObservationRootReceipt", { description: "Digest and full safe body of one root observation." })
  )
) {}

/**
 * Inventory and its root evidence from one bounded local probe.
 *
 * **Example**
 * ```ts
 * import { ObservationRootProbeResult } from "@beep/repo-ai-metrics/observation-root-probe"
 * import * as S from "effect/Schema"
 * console.log(S.is(ObservationRootProbeResult)({})) // false
 * ```
 * **Details** Harness routes and populations remain unknown; Git identity does not qualify an AI collection route.
 * @category models
 * @since 0.0.0
 */
export class ObservationRootProbeResult extends S.Opaque<
  ObservationRootProbeResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    inventory: ObservationInventory,
    rootReceipts: S.Array(ObservationRootReceipt).check(S.isMaxLength(32)),
  }).pipe(
    $I.annoteSchema("ObservationRootProbeResult", {
      description: "Metadata-only inventory and retained observation receipts.",
    })
  )
) {}

const failure = (message: string) => ObservationInventoryError.make({ message });

/**
 * Read a private root declaration with strict UTF-8 and field validation.
 *
 * **Example**
 * ```ts
 * import { readObservationRootDeclaration } from "@beep/repo-ai-metrics/observation-root-probe"
 * console.log(readObservationRootDeclaration("/tmp/synthetic-declaration.json"))
 * ```
 * **Details** A 64 KiB byte ceiling applies before parsing. Input-bearing schema errors and paths never escape.
 * @category services
 * @since 0.0.0
 */
export const readObservationRootDeclaration = Effect.fn("AiMetrics.readRootDeclaration")(function* (path: string) {
  const text = yield* readBoundedMetadata(path, 65_536, {
    readFailed: failure("Unable to read root declaration."),
    oversize: failure("Root declaration exceeds its byte limit."),
    encodingFailed: failure("Invalid root declaration encoding."),
  });
  return yield* S.decodeEffect(S.fromJsonString(ObservationRootDeclaration), { onExcessProperty: "error" })(text).pipe(
    Effect.mapError(() => failure("Invalid root declaration."))
  );
});

/**
 * Observe only explicitly declared checkout roots and build a safe host inventory.
 *
 * **Example**
 * ```ts
 * import { probeObservationRoots } from "@beep/repo-ai-metrics/observation-root-probe"
 * console.log(typeof probeObservationRoots) // function
 * ```
 * **Details** Requires a nonblank operator salt, uses up to four concurrent five-second Git probes, and caps the whole probe at fifty seconds. Does not read transcripts or mutate repositories, services, enrollment or historical identity records. Legacy root IDs remain host-scoped checkout-path hashes; clone/worktree fields use versioned Git evidence.
 * @category services
 * @since 0.0.0
 */
export const probeObservationRoots = Effect.fn("AiMetrics.probeObservationRoots")(function* (
  declaration: ObservationRootDeclaration,
  hashSalt: Redacted.Redacted<string>
) {
  const salt = Redacted.value(hashSalt);
  if (Str.trim(salt).length === 0) return yield* failure("Root probes require a nonblank identity hash salt.");
  const probe = Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const startedAt = yield* DateTime.now;
    if (DateTime.toEpochMillis(declaration.populationWindowEnd) > DateTime.toEpochMillis(startedAt))
      return yield* failure("Root declaration window cannot end in the future.");
    const paths = A.map(declaration.roots, (root) => path.normalize(root.path));
    if (A.some(declaration.roots, (root) => !path.isAbsolute(root.path)) || A.dedupe(paths).length !== paths.length)
      return yield* failure("Root declaration requires distinct absolute paths.");
    const privateHash = (value: string) => hashPrivateIdentifier(value, O.some(salt));
    const host = ObservationHost.make({
      hostId: yield* privateHash(`observation-host/v1:${declaration.hostKey}`),
      identityNamespaceId: yield* privateHash("ai-metrics-hash-salt-namespace/v1"),
    });
    const rootReceipts = yield* Effect.forEach(
      declaration.roots,
      (root) =>
        Effect.gen(function* () {
          const rootPath = path.resolve(root.path);
          const rootId = `root-${yield* privateHash(rootPath)}`;
          const present =
            root.state === "inspect" &&
            (yield* fs.stat(rootPath).pipe(
              Effect.map((info) => info.type === "Directory"),
              Effect.orElseSucceed(() => false)
            ));
          const git = present
            ? yield* observeAiMetricsGitRoot(AiMetricsCanonicalRootInput.make({ rootPath, hashSalt: salt }))
            : AiMetricsGitRootEvidence.cases.Unknown.make({ reason: "not-observed" });
          const observation = ReceiptBody.make({
            host,
            rootId,
            declaredState: root.state,
            availability: root.state === "retired" ? "retired" : present ? "present" : "unreachable",
            observedAt: yield* DateTime.now,
            git,
          });
          const encoded = yield* S.encodeEffect(S.fromJsonString(ReceiptBody))(observation);
          return ObservationRootReceipt.make({ evidenceId: yield* hashPublicTextSha256(encoded), observation });
        }),
      { concurrency: 4 }
    );
    const roots = A.map(rootReceipts, ({ evidenceId, observation }) => {
      const identity = (component: "repositoryIdHash" | "owningCloneIdHash" | "worktreeIdHash") =>
        AiMetricsGitRootEvidence.match(observation.git, {
          Unknown: (): typeof ObservationIdentity.Type => ObservationIdentity.cases.Unknown.make({}),
          Observed: (git): typeof ObservationIdentity.Type =>
            ObservationIdentity.cases.Verified.make({ id: git[component], evidenceId }),
        });
      return ObservationRoot.make({
        rootId: observation.rootId,
        hostId: host.hostId,
        repositoryId: identity("repositoryIdHash"),
        cloneId: identity("owningCloneIdHash"),
        worktreeId: identity("worktreeIdHash"),
        availability: observation.availability,
        evidenceId,
      });
    });
    const routes = yield* Effect.forEach(ObservationHarness.literals, (harness) =>
      Effect.gen(function* () {
        return ObservationRoute.make({
          routeId: yield* privateHash(`observation-unqualified-route/v1:${host.hostId}:${harness}`),
          hostId: host.hostId,
          harness,
          surface: "unknown",
          transport: "unknown",
          root: ObservationRootBinding.cases.Unknown.make({}),
          capability: ObservationCapability.cases.Unknown.make({}),
          policy: ObservationPolicy.cases.Included.make({}),
          heartbeat: ObservationHeartbeat.cases.Unknown.make({}),
          knownLaunches: ObservationPopulation.cases.Unknown.make({}),
          expectedEvents: ObservationPopulation.cases.Unknown.make({}),
        });
      })
    );
    const observedAt = yield* DateTime.now;
    const boundaryEvidenceId = yield* hashPublicTextSha256(
      yield* S.encodeEffect(
        S.fromJsonString(
          S.Struct({
            version: S.Literal("declared-root-probe/v1"),
            host: ObservationHost,
            populationWindowStart: S.DateTimeUtcFromString,
            populationWindowEnd: S.DateTimeUtcFromString,
            rootReceiptIds: S.Array(Sha256Hex),
            requestedHarnesses: S.Array(ObservationHarness),
          })
        )
      )({
        version: "declared-root-probe/v1",
        host,
        populationWindowStart: declaration.populationWindowStart,
        populationWindowEnd: declaration.populationWindowEnd,
        rootReceiptIds: A.map(rootReceipts, (receipt) => receipt.evidenceId),
        requestedHarnesses: ObservationHarness.literals,
      })
    );
    return ObservationRootProbeResult.make({
      inventory: ObservationInventory.make({
        observedAt,
        populationWindowStart: declaration.populationWindowStart,
        populationWindowEnd: declaration.populationWindowEnd,
        boundaryEvidenceId,
        hosts: [host],
        roots,
        routes,
      }),
      rootReceipts,
    });
  });
  return yield* probe.pipe(
    Effect.timeoutOption("50 seconds"),
    Effect.flatMap(
      O.match({
        onNone: () => Effect.fail(failure("Root probe exceeded its time limit.")),
        onSome: Effect.succeed,
      })
    ),
    Effect.mapError(() =>
      failure("Unable to complete declared root probe; check its window, paths and identity configuration.")
    )
  );
});
