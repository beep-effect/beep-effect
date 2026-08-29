/**
 * Schema-validated lab manifest (`lab.manifest.json`) — the D9/D12 lifecycle
 * truth for one lab app.
 *
 * The manifest is decoded, never hand-parsed: create-package emits it,
 * `beep labs list` renders it, and delete-package's data phase reads its
 * optional Postgres schema declaration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import * as S from "effect/Schema";
import type { Effect } from "effect";

const $I = $RepoCliId.create("internal/cli/Labs/LabManifest");

/**
 * File name of the manifest at every lab workspace root.
 *
 * @category configuration
 * @since 0.0.0
 */
export const LAB_MANIFEST_FILENAME = "lab.manifest.json";

/**
 * Closed lab lifecycle disposition (D9): `active` is a live proving ground,
 * `promote` has earned a durable non-lab home, `expired` should be deleted.
 *
 * @category schemas
 * @since 0.0.0
 */
export const LabDisposition = LiteralKit(["active", "promote", "expired"]).pipe(
  $I.annoteSchema("LabDisposition", {
    description: "Closed lab lifecycle disposition (D9): active, promote, or expired.",
  })
);

/**
 * Decoded {@link LabDisposition} type.
 *
 * @category models
 * @since 0.0.0
 */
export type LabDisposition = typeof LabDisposition.Type;

/**
 * Lab-namespaced Postgres schema name (D12), mechanically derived from the
 * lab slug as `lab_<snake_case_slug>`.
 *
 * @category schemas
 * @since 0.0.0
 */
export const LabPostgresSchemaName = S.String.check(S.isPattern(/^lab_[a-z][a-z0-9_]*$/)).pipe(
  S.brand("LabPostgresSchemaName"),
  $I.annoteSchema("LabPostgresSchemaName", {
    description: "Lab-namespaced Postgres schema name derived from the lab slug (D12).",
  })
);

/**
 * Decoded {@link LabPostgresSchemaName} type.
 *
 * @category models
 * @since 0.0.0
 */
export type LabPostgresSchemaName = typeof LabPostgresSchemaName.Type;

/**
 * Guard for lab-namespaced Postgres schema names.
 *
 * @category guards
 * @since 0.0.0
 */
export const isLabPostgresSchemaName = S.is(LabPostgresSchemaName);

/**
 * The lab manifest model: purpose, creation date, disposition, and the
 * optional manifest-owned Postgres schema declaration.
 *
 * @category schemas
 * @since 0.0.0
 */
export class LabManifest extends S.Class<LabManifest>($I`LabManifest`)(
  {
    schemaVersion: S.Literal("lab-manifest/v1"),
    purpose: S.NonEmptyString,
    created: LocalDateFromString,
    disposition: LabDisposition,
    postgresSchema: S.OptionFromOptionalKey(LabPostgresSchemaName),
  },
  $I.annote("LabManifest", {
    description: "Schema-validated lab lifecycle manifest (D9/D12); decoded, never hand-parsed.",
  })
) {}

/**
 * JSON-string codec for `lab.manifest.json` bodies (pretty-printed on encode
 * so the manifest stays hand-editable).
 *
 * @category schemas
 * @since 0.0.0
 */
export const LabManifestFromJsonString = S.fromJsonString(LabManifest, { space: 2 });

/**
 * Decode a `lab.manifest.json` file body into a {@link LabManifest}.
 *
 * Narrowed to unary: a data-last dual over `(input, options?)` is undecidable,
 * so the pipeable-signature rule is satisfied by arity.
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeLabManifestJson: (input: string) => Effect.Effect<LabManifest, S.SchemaError> =
  S.decodeEffect(LabManifestFromJsonString);

/**
 * Encode a {@link LabManifest} into its `lab.manifest.json` file body.
 *
 * Narrowed to unary: a data-last dual over `(input, options?)` is undecidable,
 * so the pipeable-signature rule is satisfied by arity.
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeLabManifestJson: (input: LabManifest) => Effect.Effect<string, S.SchemaError> =
  S.encodeEffect(LabManifestFromJsonString);
