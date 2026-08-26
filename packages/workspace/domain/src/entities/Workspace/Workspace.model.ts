/**
 * Workspace entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import { WorkspaceVaultRootPath } from "./Workspace.values.ts";

const $I = $WorkspaceDomainId.create("entities/Workspace/Workspace.model");
const WorkspaceEntity = ProductEntity.make(WorkspaceIdentity.WorkspaceId);

/**
 * User or team work area.
 *
 * **Example** (Log Workspace table name)
 *
 * ```ts
 * import { Workspace } from "@beep/workspace-domain"
 *
 * console.log(Workspace.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Workspace extends WorkspaceEntity.Entity<Workspace>(WorkspaceEntity.tableName)(
  {
    fixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable workspace fixture key used to seed and reference the workspace.",
    }).pipe(WorkspaceEntity.pg.text(), WorkspaceEntity.pg.columnName("fixture_key")),
    name: S.NonEmptyString.annotateKey({
      description: "Human-readable workspace display name.",
    }).pipe(WorkspaceEntity.pg.text()),
    organizationFixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the owning organization.",
    }).pipe(WorkspaceEntity.pg.text(), WorkspaceEntity.pg.columnName("organization_fixture_key")),
    ownerPrincipalFixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the owner principal.",
    }).pipe(WorkspaceEntity.pg.text(), WorkspaceEntity.pg.columnName("owner_principal_fixture_key")),
    vaultRootPath: S.OptionFromNullOr(WorkspaceVaultRootPath)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Configured local filesystem vault root, absent until onboarding completes.",
      })
      .pipe(WorkspaceEntity.pg.text(), WorkspaceEntity.pg.columnName("vault_root_path")),
    ...WorkspaceEntity.identityFields,
  },
  $I.annote("Workspace", {
    description: "User or team work area participating in a runtime scenario.",
  }),
  WorkspaceEntity.entityExtras
) {
  static readonly decodeSync = S.decodeSync(Workspace);
}
