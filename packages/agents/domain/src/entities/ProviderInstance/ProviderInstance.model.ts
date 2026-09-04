/**
 * Persisted LLM provider CLI instance entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AgentsDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Agents from "@beep/shared-domain/identity/Agents";
import * as S from "effect/Schema";
import { AuthSnapshot, BinaryPath, EnvVars, HomePath, InstanceLabel, ProviderKind } from "./ProviderInstance.values.ts";

const $I = $AgentsDomainId.create("entities/ProviderInstance/ProviderInstance.model");
const pg = ProductEntity.pg;

/**
 * Persisted provider CLI instance: a labeled binary + HOME/env configuration
 * for one vendor CLI, plus the latest auth-probe snapshot.
 *
 * **Details**
 *
 * Invariant: no token-bearing fields. The vendor CLI owns login, token
 * storage, and refresh; beep persists only instance metadata and the tagged
 * {@link AuthSnapshot} — never access tokens, refresh tokens, OAuth codes, or
 * raw CLI output.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import { ProviderInstance } from "@beep/agents-domain"
 *
 * console.log(ProviderInstance.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ProviderInstance extends ProductEntity.Entity<ProviderInstance>()(Agents.ProviderInstanceId)(
  {
    binaryPath: BinaryPath.annotateKey({
      description: "Filesystem path to the provider CLI binary.",
    }).pipe(pg.text(), pg.columnName("binary_path")),
    envVars: EnvVars.pipe(SchemaUtils.withConstantDefault<EnvVars>({}))
      .annotateKey({
        description: "Extra token-safe child-process environment; defaults to empty at construction.",
      })
      .pipe(pg.jsonb(), pg.columnName("env_vars")),
    homePath: S.OptionFromNullOr(HomePath)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Optional isolated HOME directory; encodes absence as SQL/wire null.",
      })
      .pipe(pg.text(), pg.columnName("home_path")),
    kind: ProviderKind.annotateKey({
      description: "Provider CLI kind this instance delegates to.",
    }).pipe(pg.text()),
    label: InstanceLabel.annotateKey({
      description: "Display label for the instance.",
    }).pipe(pg.text()),
    lastProbe: S.OptionFromNullOr(AuthSnapshot)
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Latest auth-probe snapshot; encodes absence as SQL/wire null.",
      })
      .pipe(pg.jsonb(), pg.columnName("last_probe")),
  },
  $I.annote("ProviderInstance", {
    description:
      "Persisted provider CLI instance holding binary, HOME, and env configuration plus the latest auth-probe snapshot; never provider tokens.",
  })
) {
  static readonly decodeUnknownSync = S.decodeUnknownSync(ProviderInstance);
}
