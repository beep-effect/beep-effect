/**
 * Email artifact entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import { ArrayOfNonEmptyStrings, UnknownRecord } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Workspace from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/EmailArtifact/EmailArtifact.model");
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
 * console.log(EmailArtifact.definition.entityId.resource)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmailArtifact extends BaseEntity.Class<EmailArtifact>($I`EmailArtifact`)(
  Workspace.EmailArtifactId,
  {
    fields: {
      artifactFixtureKey: S.NonEmptyString.annotateKey({
        description: "Stable fixture key for the imported email artifact.",
      }),
      body: S.String.annotateKey({
        description: "Literal email body content preserved from the import source.",
      }),
      from: UnknownRecord.annotateKey({
        description: "Provider-specific sender contact payload.",
      }),
      receivedAt: UtcIsoTimestamp.annotateKey({
        description: "ISO timestamp when the email artifact was received.",
      }),
      sourceSpans: ArrayOfNonEmptyStrings.annotateKey({
        description: "Source span identifiers covered by this email artifact.",
      }),
      subject: S.String.annotateKey({
        description: "Literal email subject preserved from the import source.",
      }),
      threadFixtureKey: S.NonEmptyString.annotateKey({
        description: "Stable fixture key for the workspace thread containing the artifact.",
      }),
      to: S.Array(UnknownRecord).annotateKey({
        description: "Provider-specific recipient contact payloads.",
      }),
    },
    persisted: {
      artifactFixtureKey: EntitySchema.persist.text({
        columnName: "artifact_fixture_key",
      }),
      body: EntitySchema.persist.text({
        columnName: "body",
      }),
      from: EntitySchema.persist.jsonb({
        columnName: "from_contact",
      }),
      receivedAt: EntitySchema.persist.text({
        columnName: "received_at",
      }),
      sourceSpans: EntitySchema.persist.jsonb({
        columnName: "source_spans",
      }),
      subject: EntitySchema.persist.text({
        columnName: "subject",
      }),
      threadFixtureKey: EntitySchema.persist.text({
        columnName: "thread_fixture_key",
      }),
      to: EntitySchema.persist.jsonb({
        columnName: "to_contacts",
      }),
    },
  },
  $I.annote("EmailArtifact", {
    description: "Normalized email artifact imported into a workspace thread.",
  })
) {}
