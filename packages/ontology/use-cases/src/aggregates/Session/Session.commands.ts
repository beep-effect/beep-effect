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
import { OntologyFilePath } from "./Session.ports.js";

const { $OntologyUseCasesId } = makeIdentity("ontology-use-cases");
const $I = $OntologyUseCasesId.create("aggregates/Session/Session.commands");

/**
 * Command to open a Turtle document into a session.
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
 * @since 0.0.0
 * @category commands
 */
export class OpenOntologyFileResult extends S.Class<OpenOntologyFileResult>($I`OpenOntologyFileResult`)(
  {
    session: Session,
    path: OntologyFilePath,
  },
  $I.annote("OpenOntologyFileResult", {
    description: "Result of opening a Turtle document into an ontology session.",
  })
) {}

/**
 * Command to serialize a session's asserted graph to a Turtle document.
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
 * @since 0.0.0
 * @category commands
 */
export class SaveOntologyFileResult extends S.Class<SaveOntologyFileResult>($I`SaveOntologyFileResult`)(
  {
    path: OntologyFilePath,
  },
  $I.annote("SaveOntologyFileResult", {
    description: "Result of saving a session's asserted graph to Turtle.",
  })
) {}
