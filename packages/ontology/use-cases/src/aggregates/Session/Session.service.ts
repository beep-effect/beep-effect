/**
 * Ontology session use-case service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import {
  CreateSessionInput,
  createSession,
  deriveSessionGraphPartitions,
} from "@beep/ontology-domain/aggregates/Session";
import { makeDataset } from "@beep/rdf/Rdf";
import { A } from "@beep/utils";
import { Context, Effect, Layer, pipe } from "effect";
import {
  OpenOntologyFileResult,
  SaveOntologyFileResult,
  SerializeOntologySessionCommand,
  SerializeOntologySessionResult,
} from "./Session.commands.js";
import {
  OntologyFileStore,
  ParseTurtleRequest,
  ReadOntologyFileRequest,
  SerializeTurtleRequest,
  TurtleCodec,
  WriteOntologyFileRequest,
} from "./Session.ports.js";
import type { OpenOntologyFileCommand, SaveOntologyFileCommand } from "./Session.commands.js";
import type { OntologyFileStoreError, TurtleCodecError } from "./Session.ports.js";

const { $OntologyUseCasesId } = makeIdentity("ontology-use-cases");
const $I = $OntologyUseCasesId.create("aggregates/Session/Session.service");

const serializableSessionDataset = (session: SerializeOntologySessionCommand["session"]) => {
  const partitions = deriveSessionGraphPartitions(session);
  return makeDataset(
    pipe(partitions.asserted.quads, A.appendAll(partitions.ontologies.quads), A.appendAll(partitions.shapes.quads))
  );
};

/**
 * Ontology session use-case service shape.
 *
 * @since 0.0.0
 * @category services
 */
interface SessionUseCasesShape {
  readonly openFile: (
    command: OpenOntologyFileCommand
  ) => Effect.Effect<OpenOntologyFileResult, OntologyFileStoreError | TurtleCodecError>;
  readonly saveFile: (
    command: SaveOntologyFileCommand
  ) => Effect.Effect<SaveOntologyFileResult, OntologyFileStoreError | TurtleCodecError>;
  readonly serialize: (
    command: SerializeOntologySessionCommand
  ) => Effect.Effect<SerializeOntologySessionResult, TurtleCodecError>;
}

/**
 * Build the ontology session use-case implementation from ports.
 *
 * @example
 * ```ts
 * import { makeSessionUseCases } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const useCases = makeSessionUseCases()
 *
 * console.log(useCases)
 * ```
 *
 * @since 0.0.0
 * @category services
 */
export const makeSessionUseCases = Effect.fn("Ontology.SessionUseCases.make")(function* () {
  const fileStore = yield* OntologyFileStore;
  const turtle = yield* TurtleCodec;
  const serializeSession = Effect.fn("Ontology.SessionUseCases.serialize")(function* (
    command: SerializeOntologySessionCommand
  ) {
    const serialized = yield* turtle.serialize(
      SerializeTurtleRequest.make({
        dataset: serializableSessionDataset(command.session),
        prefixes: command.session.prefixes,
      })
    );

    return SerializeOntologySessionResult.make({
      source: serialized.source,
    });
  });

  return {
    openFile: Effect.fn("Ontology.SessionUseCases.openFile")(function* (command: OpenOntologyFileCommand) {
      const file = yield* fileStore.read(ReadOntologyFileRequest.make({ path: command.path }));
      const parsed = yield* turtle.parse(ParseTurtleRequest.make({ source: file.source, baseIri: command.baseIri }));
      const session = createSession(
        CreateSessionInput.make({
          id: command.sessionId,
          baseDataset: parsed.dataset,
          prefixes: parsed.prefixes,
        })
      );

      return OpenOntologyFileResult.make({
        session,
        path: file.path,
        source: file.source,
      });
    }),
    serialize: serializeSession,
    saveFile: Effect.fn("Ontology.SessionUseCases.saveFile")(function* (command: SaveOntologyFileCommand) {
      const serialized = yield* serializeSession(SerializeOntologySessionCommand.make({ session: command.session }));
      yield* fileStore.write(WriteOntologyFileRequest.make({ path: command.path, source: serialized.source }));

      return SaveOntologyFileResult.make({
        path: command.path,
        source: serialized.source,
      });
    }),
  } satisfies SessionUseCasesShape;
});

/**
 * Ontology session use-case service tag.
 *
 * @example
 * ```ts
 * import { SessionUseCases } from "@beep/ontology-use-cases/aggregates/Session"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const useCases = yield* SessionUseCases
 *   return useCases
 * })
 *
 * console.log(program)
 * ```
 *
 * @since 0.0.0
 * @category services
 */
export class SessionUseCases extends Context.Service<SessionUseCases, SessionUseCasesShape>()($I`SessionUseCases`) {}

/**
 * Layer for ontology session use cases.
 *
 * @example
 * ```ts
 * import { SessionUseCasesLayer } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(SessionUseCasesLayer)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const SessionUseCasesLayer = Layer.effect(SessionUseCases, makeSessionUseCases());
