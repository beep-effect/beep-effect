/**
 * Accepted architecture proof manifest.
 *
 * @packageDocumentation
 * @category constants
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ArchitecturePlanStage, ArchitectureSliceRole, ArchitectureWriterKind } from "../Architecture.schemas.ts";

const $I = $RepoCliId.create("commands/Architecture/internal/AcceptedProofManifest");

/**
 * Static descriptor for an accepted architecture proof file.
 *
 * @example
 * ```ts
 * import { AcceptedProofFile } from "@beep/repo-cli/commands/Architecture/internal/AcceptedProofManifest"
 *
 * const file = AcceptedProofFile.make({
 *   path: "packages/architecture-lab/domain/src/index.ts",
 *   role: "domain",
 *   stage: "core",
 *   writer: "ts-morph",
 * })
 * console.log(file.writer) // "ts-morph"
 * ```
 * @category models
 * @since 0.0.0
 */
export class AcceptedProofFile extends S.Class<AcceptedProofFile>($I`AcceptedProofFile`)(
  {
    role: ArchitectureSliceRole,
    stage: ArchitecturePlanStage,
    path: S.String,
    writer: ArchitectureWriterKind,
  },
  $I.annote("AcceptedProofFile", {
    description: "Internal descriptor for a canonical proof file used to generate architecture operation plans.",
  })
) {}

const roleBasePath = (role: ArchitectureSliceRole): O.Option<string> => {
  if (role === "proof-app") return O.some("apps/architecture-lab-proof");
  if (role === "db-admin") return O.some("packages/_internal/db-admin");
  return O.some(`packages/architecture-lab/${role}`);
};

const rolePackageFiles = (
  role: ArchitectureSliceRole,
  stage: ArchitecturePlanStage
): ReadonlyArray<AcceptedProofFile> =>
  pipe(
    roleBasePath(role),
    O.map((basePath) => [
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/AGENTS.md`,
        writer: "template",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/LICENSE`,
        writer: "template",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/README.md`,
        writer: "template",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/docgen.json`,
        writer: "json",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/package.json`,
        writer: "package-json",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/tsconfig.json`,
        writer: "jsonc",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/vitest.config.ts`,
        writer: "template",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/dtslint/.gitkeep`,
        writer: "template",
      }),
      AcceptedProofFile.make({
        role,
        stage,
        path: `${basePath}/test/.gitkeep`,
        writer: "template",
      }),
    ]),
    O.getOrElse(A.empty<AcceptedProofFile>)
  );

/**
 * Ordered accepted proof-file manifest used to build architecture plans.
 *
 * @example
 * ```ts
 * import { acceptedProofFiles } from "@beep/repo-cli/commands/Architecture/internal/AcceptedProofManifest"
 *
 * const firstDomainFile = acceptedProofFiles.find((file) => file.role === "domain")
 * console.log(firstDomainFile?.stage) // "core"
 * ```
 * @category constants
 * @since 0.0.0
 */
export const acceptedProofFiles: ReadonlyArray<AcceptedProofFile> = [
  ...rolePackageFiles("domain", "core"),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/aggregates/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.errors.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.model.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/aggregates/WorkItem/WorkItem.values.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/test/WorkItem.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/dtslint/WorkItem.tst.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/identity/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/identity/ArchitectureLab.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/entities/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/entities/Worker/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/entities/Worker/Worker.model.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/test/Worker.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/dtslint/Worker.tst.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/values/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/values/WorkPriority/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/values/WorkPriority/WorkPriority.model.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/src/values/WorkPriority/WorkPriority.behavior.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/test/WorkPriority.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "domain",
    stage: "core",
    path: "packages/architecture-lab/domain/dtslint/WorkPriority.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("use-cases", "core"),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/public.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/server.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/server.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.commands.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.errors.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.repository.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.use-cases.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.service.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/test/WorkItem.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/test/SchemaParity.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/dtslint/WorkItem.tst.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/server.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/Worker.commands.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/Worker.errors.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/Worker.repository.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/Worker.use-cases.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/src/entities/Worker/Worker.service.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/test/Worker.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "use-cases",
    stage: "core",
    path: "packages/architecture-lab/use-cases/dtslint/Worker.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("server", "core"),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/Layer.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.layer.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.repo.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/test/WorkItemServer.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/dtslint/WorkItemServer.tst.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "persistence",
    path: "packages/architecture-lab/server/test/integration/WorkItemDrizzleRepository.pglite.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "protocol",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.http.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "protocol",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.rpc.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "protocol",
    path: "packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.tools.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/entities/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/entities/Worker/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/entities/Worker/Worker.layer.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/src/entities/Worker/Worker.repo.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/test/WorkerServer.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "server",
    stage: "core",
    path: "packages/architecture-lab/server/dtslint/WorkerServer.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("config", "persistence"),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/public.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/server.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/secrets.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/layer.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/test.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/aggregates/WorkItem/WorkItem.config.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/src/aggregates/WorkItem/WorkItem.layer.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/test/WorkItemConfig.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "config",
    stage: "persistence",
    path: "packages/architecture-lab/config/dtslint/WorkItemConfig.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("tables", "persistence"),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/tables.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/aggregates/WorkItem/WorkItem.table.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/test/WorkItemTable.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/dtslint/WorkItemTable.tst.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/entities/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/entities/Worker/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/src/entities/Worker/Worker.table.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/test/WorkerTable.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "tables",
    stage: "persistence",
    path: "packages/architecture-lab/tables/dtslint/WorkerTable.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("client", "client"),
  AcceptedProofFile.make({
    role: "client",
    stage: "client",
    path: "packages/architecture-lab/client/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "client",
    stage: "client",
    path: "packages/architecture-lab/client/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "client",
    stage: "client",
    path: "packages/architecture-lab/client/src/aggregates/WorkItem/WorkItem.client.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "client",
    stage: "client",
    path: "packages/architecture-lab/client/test/WorkItemClient.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "client",
    stage: "client",
    path: "packages/architecture-lab/client/dtslint/WorkItemClient.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("ui", "client"),
  AcceptedProofFile.make({
    role: "ui",
    stage: "client",
    path: "packages/architecture-lab/ui/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "ui",
    stage: "client",
    path: "packages/architecture-lab/ui/src/aggregates/WorkItem/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "ui",
    stage: "client",
    path: "packages/architecture-lab/ui/src/aggregates/WorkItem/WorkItem.view-model.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "ui",
    stage: "client",
    path: "packages/architecture-lab/ui/test/WorkItemViewModel.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "ui",
    stage: "client",
    path: "packages/architecture-lab/ui/dtslint/WorkItemViewModel.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("proof-app", "client"),
  AcceptedProofFile.make({
    role: "proof-app",
    stage: "client",
    path: "apps/architecture-lab-proof/src/index.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "proof-app",
    stage: "client",
    path: "apps/architecture-lab-proof/test/ArchitectureLabProof.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "proof-app",
    stage: "client",
    path: "apps/architecture-lab-proof/dtslint/ArchitectureLabProof.tst.ts",
    writer: "template",
  }),

  ...rolePackageFiles("db-admin", "persistence"),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle.config.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/tsconfig.drizzle.json",
    writer: "jsonc",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/index.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrate.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/schema.ts",
    writer: "ts-morph",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/targets.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/ArchitectureLab.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/WorkspaceThread.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/EpistemicUsage.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/EpistemicEdge.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/EpistemicExecutionLedger.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/EpistemicContradictionTriage.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/DocumentsSync.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260512000000_architecture_lab_work_item/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260512001000_architecture_lab_worker_archetype/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260613000000_workspace_thread_domain/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260613000010_epistemic_usage_record/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260708000000_workspace_vault_config/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260711000000_documents_sync_state/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260726000000_epistemic_bitemporal_edge/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260726210000_epistemic_execution_ledger/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260730042420_epistemic_contradiction_triage/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260730042420_epistemic_contradiction_triage/snapshot.json",
    writer: "json",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260730043536_epistemic_evidence_verification/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260730043536_epistemic_evidence_verification/snapshot.json",
    writer: "json",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260801021411_usage_record_optional_activity/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260801021411_usage_record_optional_activity/snapshot.json",
    writer: "json",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260725222615_baseline/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260725222615_baseline/snapshot.json",
    writer: "json",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260801021411_usage_record_optional_activity/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260801021411_usage_record_optional_activity/snapshot.json",
    writer: "json",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/ArchitectureLabMigrationTarget.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/index.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/integration/ArchitectureLabMigration.pglite.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/integration/DocumentsSyncMigration.pglite.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/integration/EpistemicContradictionMigration.pglite.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/integration/EpistemicEdgeMigration.pglite.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/integration/EpistemicExecutionLedgerMigration.pglite.test.ts",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/dtslint/ArchitectureLabMigrationTarget.tst.ts",
    writer: "template",
  }),
];

/**
 * Legacy architecture proof fixture paths removed by canonical plans.
 *
 * @example
 * ```ts
 * import { legacyFixturePaths } from "@beep/repo-cli/commands/Architecture/internal/AcceptedProofManifest"
 *
 * console.log(legacyFixturePaths.includes("packages/fixture-lab/specimen")) // true
 * ```
 * @category constants
 * @since 0.0.0
 */
export const legacyFixturePaths = [
  "packages/fixture-lab/specimen",
  "packages/tooling/tool/cli/test/fixtures/repo-architecture-automation",
  "packages/tooling/tool/cli/test/repo-architecture-automation-fixture.test.ts",
] as const;
