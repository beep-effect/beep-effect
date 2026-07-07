/**
 * Workspace entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/Workspace/Workspace.model");

/**
 * User or team work area.
 *
 * @example
 * ```ts
 * import { Workspace } from "@beep/workspace-domain"
 *
 * console.log(Workspace.definition.entityId.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Workspace extends BaseEntity.Class<Workspace>($I`Workspace`)(
  WorkspaceIdentity.WorkspaceId,
  {
    fields: {
      fixtureKey: S.NonEmptyString.annotateKey({
        description: "Stable workspace fixture key used to seed and reference the workspace.",
      }),
      name: S.NonEmptyString.annotateKey({
        description: "Human-readable workspace display name.",
      }),
      organizationFixtureKey: S.NonEmptyString.annotateKey({
        description: "Stable fixture key for the owning organization.",
      }),
      ownerPrincipalFixtureKey: S.NonEmptyString.annotateKey({
        description: "Stable fixture key for the owner principal.",
      }),
    },
    persisted: {
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      name: EntitySchema.persist.text({
        columnName: "name",
      }),
      organizationFixtureKey: EntitySchema.persist.text({
        columnName: "organization_fixture_key",
      }),
      ownerPrincipalFixtureKey: EntitySchema.persist.text({
        columnName: "owner_principal_fixture_key",
      }),
    },
  },
  $I.annote("Workspace", {
    description: "User or team work area participating in a runtime scenario.",
  })
) {}
