/**
 * Internal helpers for Pulumi config schemas.
 *
 * @since 0.0.0
 */

import { SchemaUtils } from "@beep/schema";
import { Struct } from "@beep/utils";
import * as pulumi from "@pulumi/pulumi";
import * as S from "effect/Schema";

/**
 * Mark every Pulumi config field optional before applying stack defaults.
 *
 * @category utilities
 * @since 0.0.0
 */
export const optionalPulumiConfigFields = Struct.map(S.optionalKey);

/**
 * Attach the standard decode helper used by infra config schemas.
 *
 * @category utilities
 * @since 0.0.0
 */
export const withPulumiConfigDecodeEffect = <Schema extends S.Constraint>(schema: Schema) =>
  SchemaUtils.withStatics(schema, (self: Schema) => ({
    decodeEffect: S.decodeUnknownEffect(self),
  }));

/**
 * Build the shared `Invalid <namespace>:<key>` Pulumi config error mapper.
 *
 * @category utilities
 * @since 0.0.0
 */
export const pulumiConfigSchemaIssueError =
  (namespace: string) =>
  (key: string, value: string) =>
  (cause: S.SchemaError): pulumi.RunError =>
    new pulumi.RunError(`Invalid ${namespace}:${key} Pulumi config value "${value}": ${cause.message}`);
