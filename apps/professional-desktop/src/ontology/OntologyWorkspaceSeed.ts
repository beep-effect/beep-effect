/**
 * Boot-time seeding of the ontology workbench's starter document.
 *
 * The workbench ships with `tmp/ontology-workbench/pizza-tutorial.ttl` pre-filled
 * in its path input, but nothing ever wrote that file: every fresh checkout
 * opened the Ontology surface, pressed Open, and got an empty workbench. The
 * tutorial already exists as typed change operations
 * ({@link pizzaTutorialChangeOperations}), so rather than duplicating it as a
 * checked-in fixture that can drift, the sidecar materializes it into the
 * ontology workspace on boot when the file is absent.
 *
 * Seeding never overwrites: once the file exists, the user's edits own it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import {
  applyChangeOperationsWithDelta,
  CreateSessionInput,
  createSession,
  deriveSessionGraphPartitions,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import {
  OntologyFilePath,
  OntologyFileStore,
  pizzaTutorialChangeOperations,
  ReadOntologyFileRequest,
  SerializeTurtleRequest,
  TurtleCodec,
  WriteOntologyFileRequest,
} from "@beep/ontology-use-cases/public";
import { makeDataset } from "@beep/rdf/Rdf";
import * as Eq from "@beep/utils/Equal";
import * as P from "@beep/utils/Predicate";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

/**
 * Workspace-relative path the workbench pre-fills in its file-path input.
 *
 * @category constants
 * @since 0.0.0
 */
const PIZZA_TUTORIAL_PATH = "tmp/ontology-workbench/pizza-tutorial.ttl";

const decodeOntologyFilePath = S.decodeUnknownEffect(OntologyFilePath);

const decodeSessionId = S.decodeUnknownEffect(SessionId);

/**
 * Writes the starter document when — and only when — it is absent.
 *
 * **Details**
 *
 * Exported for the regression test that pins the one behaviour that matters
 * here: a read failure that is *not* absence must never lead to a write.
 *
 * **Example** (Confirming seed Effect)
 *
 * ```ts
 * import { seedPizzaTutorial } from "@/ontology/OntologyWorkspaceSeed"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(seedPizzaTutorial())) // true
 * ```
 *
 * @effects Reads and, when absent, writes the starter ontology document.
 * @category workflows
 * @since 0.0.0
 */
export const seedPizzaTutorial = Effect.fn("OntologyWorkspaceSeed.seedPizzaTutorial")(function* () {
  const fileStore = yield* OntologyFileStore;
  const codec = yield* TurtleCodec;
  const path = yield* decodeOntologyFilePath(PIZZA_TUTORIAL_PATH);

  // An existing document wins: this seeds a starting point, it does not reset the
  // user's workspace on every launch.
  //
  // Only *absence* means "seed it". Treating any read failure as absence — which
  // an unqualified `Effect.option` does — would overwrite a document that exists
  // but could not be read (a permissions error, a transient fault) with the
  // starter fixture, destroying the user's work.
  const absent = yield* fileStore.read(ReadOntologyFileRequest.make({ path })).pipe(
    Effect.as(false),
    Effect.catchIf(P.Struct({ reason: Eq.equals("notFound") }), () => Effect.succeed(true))
  );
  if (!absent) {
    return;
  }

  const id = yield* decodeSessionId("pizza-tutorial-seed");
  const session = createSession(
    CreateSessionInput.make({
      id,
      baseDataset: makeDataset([]),
    })
  );
  const applied = applyChangeOperationsWithDelta(session, pizzaTutorialChangeOperations());
  const partitions = deriveSessionGraphPartitions(applied.session);
  const serialized = yield* codec.serialize(SerializeTurtleRequest.make({ dataset: partitions.asserted }));

  yield* fileStore.write(WriteOntologyFileRequest.make({ path, source: serialized.source }));
  yield* Effect.logInfo("ontology workbench starter document seeded").pipe(
    Effect.annotateLogs({ component: "professional-desktop", path: PIZZA_TUTORIAL_PATH })
  );
});

/**
 * Seeds the starter ontology document on sidecar boot.
 *
 * **Details**
 *
 * A seeding failure must never take the sidecar down — the workbench is still
 * usable with any other document — so the cause is logged and swallowed.
 *
 * **Example** (Confirming seed Layer)
 *
 * ```ts
 * import { OntologyWorkspaceSeedLive } from "@/ontology/OntologyWorkspaceSeed"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(OntologyWorkspaceSeedLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OntologyWorkspaceSeedLive: Layer.Layer<never, never, OntologyFileStore | TurtleCodec> =
  Layer.effectDiscard(
    seedPizzaTutorial().pipe(
      Effect.tapCause((cause) =>
        logRedactedCause(
          cause,
          LogRedactedCauseOptions.make({
            message: "ontology workbench starter document could not be seeded",
            level: "Warn",
            attributes: {
              component: "professional-desktop",
              path: PIZZA_TUTORIAL_PATH,
            },
          })
        )
      ),
      Effect.ignore
    )
  );
