/**
 * Persisted LLM provider CLI instance entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AgentsDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Agents from "@beep/shared-domain/identity/Agents";
import * as S from "effect/Schema";
import { AuthSnapshot, BinaryPath, EnvVars, HomePath, InstanceLabel, ProviderKind } from "./ProviderInstance.values.ts";

const $I = $AgentsDomainId.create("entities/ProviderInstance/ProviderInstance.model");

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
 * console.log(ProviderInstance.definition.entityId.entityType)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class ProviderInstance extends BaseEntity.Class<ProviderInstance>($I`ProviderInstance`)(
  Agents.ProviderInstanceId,
  {
    fields: {
      binaryPath: BinaryPath.annotateKey({
        description: "Filesystem path to the provider CLI binary.",
      }),
      envVars: EnvVars.pipe(SchemaUtils.withConstantDefault<EnvVars>({})).annotateKey({
        description: "Extra token-safe child-process environment; defaults to empty at construction.",
      }),
      homePath: S.OptionFromNullOr(HomePath).pipe(SchemaUtils.withNoneDefault).annotateKey({
        description: "Optional isolated HOME directory; encodes absence as SQL/wire null.",
      }),
      kind: ProviderKind.annotateKey({
        description: "Provider CLI kind this instance delegates to.",
      }),
      label: InstanceLabel.annotateKey({
        description: "Display label for the instance.",
      }),
      lastProbe: S.OptionFromNullOr(AuthSnapshot).pipe(SchemaUtils.withNoneDefault).annotateKey({
        description: "Latest auth-probe snapshot; encodes absence as SQL/wire null.",
      }),
    },
    persisted: {
      binaryPath: EntitySchema.persist.text({
        columnName: "binary_path",
      }),
      envVars: EntitySchema.persist.jsonb({
        columnName: "env_vars",
      }),
      homePath: EntitySchema.persist.text({
        columnName: "home_path",
      }),
      kind: EntitySchema.persist.literal({
        columnName: "kind",
      }),
      label: EntitySchema.persist.text({
        columnName: "label",
      }),
      lastProbe: EntitySchema.persist.jsonb({
        columnName: "last_probe",
      }),
    },
  },
  $I.annote("ProviderInstance", {
    description:
      "Persisted provider CLI instance holding binary, HOME, and env configuration plus the latest auth-probe snapshot; never provider tokens.",
  })
) {}
