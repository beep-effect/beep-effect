/**
 * Email artifact entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import { ArrayOfNonEmptyStrings, UnknownRecord } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Workspace from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/EmailArtifact/EmailArtifact.model");
const pg = ProductEntity.pg;
const UtcIsoTimestamp = S.NonEmptyString.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u, {
    identifier: $I`UtcIsoTimestampPatternCheck`,
    title: "UTC ISO timestamp",
    description: "Checks that imported email timestamps use a UTC ISO 8601 shape.",
    message: "Expected a UTC ISO timestamp such as 2024-01-01T00:00:00Z.",
  })
).pipe(
  $I.annoteSchema("UtcIsoTimestamp", {
    description: "UTC ISO 8601 timestamp string for imported email artifacts.",
  })
);

/**
 * Normalized email artifact imported into a workspace thread.
 *
 * **Example** (Log resource name)
 *
 * ```ts
 * import { EmailArtifact } from "@beep/workspace-domain"
 *
 * console.log(EmailArtifact.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmailArtifact extends ProductEntity.Entity<EmailArtifact>()(Workspace.EmailArtifactId)(
  {
    artifactFixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the imported email artifact.",
    }).pipe(pg.text(), pg.columnName("artifact_fixture_key")),
    body: S.String.annotateKey({
      description: "Literal email body content preserved from the import source.",
    }).pipe(pg.text()),
    from: UnknownRecord.annotateKey({
      description: "Provider-specific sender contact payload.",
    }).pipe(pg.jsonb(), pg.columnName("from_contact")),
    receivedAt: UtcIsoTimestamp.annotateKey({
      description: "ISO timestamp when the email artifact was received.",
    }).pipe(pg.text(), pg.columnName("received_at")),
    sourceSpans: ArrayOfNonEmptyStrings.annotateKey({
      description: "Source span identifiers covered by this email artifact.",
    }).pipe(pg.jsonb(), pg.columnName("source_spans")),
    subject: S.String.annotateKey({
      description: "Literal email subject preserved from the import source.",
    }).pipe(pg.text()),
    threadFixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the workspace thread containing the artifact.",
    }).pipe(pg.text(), pg.columnName("thread_fixture_key")),
    to: S.Array(UnknownRecord)
      .annotateKey({
        description: "Provider-specific recipient contact payloads.",
      })
      .pipe(pg.jsonb(), pg.columnName("to_contacts")),
  },
  $I.annote("EmailArtifact", {
    description: "Normalized email artifact imported into a workspace thread.",
  })
) {
  static readonly decodeUnknownSync = S.decodeUnknownSync(EmailArtifact);
  static readonly encodeUnknownSync = S.encodeUnknownSync(EmailArtifact);
  static readonly encodeSync = S.encodeSync(EmailArtifact);
  static readonly decodeSync = S.decodeSync(EmailArtifact);
}
