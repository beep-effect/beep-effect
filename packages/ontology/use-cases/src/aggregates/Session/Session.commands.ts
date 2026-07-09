/**
 * Ontology session use-case commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import { Session, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { OntologyFilePath, TurtleDocumentText } from "./Session.ports.js";

const { $OntologyUseCasesId } = makeIdentity("ontology-use-cases");
const $I = $OntologyUseCasesId.create("aggregates/Session/Session.commands");

/**
 * Command to open a Turtle document into a session.
 *
 * @example
 * ```ts
 * import { SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { OntologyFilePath, OpenOntologyFileCommand } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const command = OpenOntologyFileCommand.make({
 *   sessionId: S.decodeUnknownSync(SessionId)("session-1"),
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl")
 * })
 *
 * console.log(command.path)
 * ```
 *
 * @since 0.0.0
 * @category commands
 */
export class OpenOntologyFileCommand extends S.Class<OpenOntologyFileCommand>($I`OpenOntologyFileCommand`)(
  {
    sessionId: SessionId,
    path: OntologyFilePath,
    baseIri: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("OpenOntologyFileCommand", {
    description: "Command to open a Turtle document into an ontology session.",
  })
) {}

/**
 * Result of opening a Turtle document into a session.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { OntologyFilePath, OpenOntologyFileResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const result = OpenOntologyFileResult.make({
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   ),
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl"),
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(result.session.id)
 * ```
 *
 * @since 0.0.0
 * @category commands
 */
export class OpenOntologyFileResult extends S.Class<OpenOntologyFileResult>($I`OpenOntologyFileResult`)(
  {
    session: Session,
    path: OntologyFilePath,
    source: TurtleDocumentText,
  },
  $I.annote("OpenOntologyFileResult", {
    description: "Result of opening a Turtle document into an ontology session.",
  })
) {}

/**
 * Command to serialize a session's asserted graph without writing it.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { SerializeOntologySessionCommand } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const command = SerializeOntologySessionCommand.make({
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   )
 * })
 *
 * console.log(command.session.id)
 * ```
 *
 * @since 0.0.0
 * @category commands
 */
export class SerializeOntologySessionCommand extends S.Class<SerializeOntologySessionCommand>(
  $I`SerializeOntologySessionCommand`
)(
  {
    session: Session,
  },
  $I.annote("SerializeOntologySessionCommand", {
    description: "Command to serialize an ontology session's asserted graph without writing it.",
  })
) {}

/**
 * Result of serializing a session's asserted graph.
 *
 * @example
 * ```ts
 * import { SerializeOntologySessionResult } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const result = SerializeOntologySessionResult.make({
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(result.source)
 * ```
 *
 * @since 0.0.0
 * @category commands
 */
export class SerializeOntologySessionResult extends S.Class<SerializeOntologySessionResult>(
  $I`SerializeOntologySessionResult`
)(
  {
    source: TurtleDocumentText,
  },
  $I.annote("SerializeOntologySessionResult", {
    description: "Result of serializing an ontology session's asserted graph.",
  })
) {}

/**
 * Command to serialize a session's asserted graph to a Turtle document.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { OntologyFilePath, SaveOntologyFileCommand } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const command = SaveOntologyFileCommand.make({
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl"),
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   )
 * })
 *
 * console.log(command.session.changeLog.length)
 * ```
 *
 * @since 0.0.0
 * @category commands
 */
export class SaveOntologyFileCommand extends S.Class<SaveOntologyFileCommand>($I`SaveOntologyFileCommand`)(
  {
    path: OntologyFilePath,
    session: Session,
  },
  $I.annote("SaveOntologyFileCommand", {
    description: "Command to serialize an ontology session's asserted graph to Turtle.",
  })
) {}

/**
 * Result of saving a session's asserted graph.
 *
 * @example
 * ```ts
 * import { OntologyFilePath, SaveOntologyFileResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const result = SaveOntologyFileResult.make({
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl"),
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(result.path)
 * ```
 *
 * @since 0.0.0
 * @category commands
 */
export class SaveOntologyFileResult extends S.Class<SaveOntologyFileResult>($I`SaveOntologyFileResult`)(
  {
    path: OntologyFilePath,
    source: TurtleDocumentText,
  },
  $I.annote("SaveOntologyFileResult", {
    description: "Result of saving a session's asserted graph to Turtle.",
  })
) {}
