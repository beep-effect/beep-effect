/**
 * Schema-validated lab manifest (`lab.manifest.json`) — the D9/D12 lifecycle
 * truth for one lab app.
 *
 * **Details**
 *
 * The manifest is decoded, never hand-parsed: create-package emits it,
 * `beep labs list` renders it, and delete-package's data phase reads its
 * optional Postgres schema declaration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliKitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";

const $I = $RepoCliKitId.create("cli/Labs/LabManifest");

/**
 * File name of the manifest at every lab workspace root.
 *
 * **Example** (Locate a lab manifest)
 *
 * ```ts
 * import { LAB_MANIFEST_FILENAME } from "@beep/repo-cli-kit/cli/Labs/LabManifest"
 *
 * console.log(LAB_MANIFEST_FILENAME) // lab.manifest.json
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const LAB_MANIFEST_FILENAME = "lab.manifest.json";

/**
 * Closed lab lifecycle disposition (D9): `active` is a live proving ground,
 * `promote` has earned a durable non-lab home, `expired` should be deleted.
 *
 * **Example** (Validate a lab value)
 *
 * ```ts
 * import { LabDisposition } from "@beep/repo-cli-kit/cli/Labs/LabManifest"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LabDisposition)("active")) // true
 * ```
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
 * **Example** (Validate a lab value)
 *
 * ```ts
 * import { LabPostgresSchemaName } from "@beep/repo-cli-kit/cli/Labs/LabManifest"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LabPostgresSchemaName)("lab_example")) // true
 * ```
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
 * **Example** (Check schema names)
 *
 * ```ts
 * import { isLabPostgresSchemaName } from "@beep/repo-cli-kit/cli/Labs/LabManifest"
 *
 * console.log(isLabPostgresSchemaName("lab_example")) // true
 * console.log(isLabPostgresSchemaName("public")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isLabPostgresSchemaName = S.is(LabPostgresSchemaName);

/**
 * The lab manifest model: purpose, creation date, disposition, and the
 * optional manifest-owned Postgres schema declaration.
 *
 * **Example** (Reject an incomplete manifest)
 *
 * ```ts
 * import { LabManifest } from "@beep/repo-cli-kit/cli/Labs/LabManifest"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LabManifest)({ purpose: "Try a feature" })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LabManifest extends S.Opaque<LabManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("lab-manifest/v1"),
    purpose: S.NonEmptyString,
    created: LocalDateFromString,
    disposition: LabDisposition,
    postgresSchema: S.OptionFromOptionalKey(LabPostgresSchemaName),
  }).pipe(
    $I.annoteSchema("LabManifest", {
      description: "Schema-validated lab lifecycle manifest (D9/D12); decoded, never hand-parsed.",
    })
  )
) {}

/**
 * JSON-string codec for `lab.manifest.json` bodies (pretty-printed on encode
 * so the manifest stays hand-editable).
 *
 * **Example** (Decode a lab manifest body)
 *
 * ```ts
 * import { LabManifestFromJsonString } from "@beep/repo-cli-kit/cli/Labs/LabManifest"
 * import * as S from "effect/Schema"
 *
 * const manifest = S.decodeUnknownSync(LabManifestFromJsonString)('{"schemaVersion":"lab-manifest/v1","purpose":"Try a feature","created":"2026-11-03","disposition":"active"}')
 * console.log(manifest.disposition) // active
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LabManifestFromJsonString = S.fromJsonString(LabManifest, { space: 2 });

/**
 * Decode a `lab.manifest.json` file body into a {@link LabManifest}.
 *
 * **Details**
 *
 * Narrowed to unary: a data-last dual over `(input, options?)` is undecidable,
 * so the pipeable-signature rule is satisfied by arity.
 *
 * **Example** (Read a manifest from JSON)
 *
 * ```ts
 * import { decodeLabManifestJson } from "@beep/repo-cli-kit/cli/Labs/LabManifest"
 * import * as Effect from "effect/Effect"
 *
 * const manifest = Effect.runSync(decodeLabManifestJson('{"schemaVersion":"lab-manifest/v1","purpose":"Try a feature","created":"2026-11-03","disposition":"active"}'))
 * console.log(manifest.disposition) // active
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeLabManifestJson: (input: string) => Effect.Effect<LabManifest, S.SchemaError> =
  S.decodeEffect(LabManifestFromJsonString);

/**
 * Encode a {@link LabManifest} into its `lab.manifest.json` file body.
 *
 * **Details**
 *
 * Narrowed to unary: a data-last dual over `(input, options?)` is undecidable,
 * so the pipeable-signature rule is satisfied by arity.
 *
 * **Example** (Round-trip a manifest body)
 *
 * ```ts
 * import { decodeLabManifestJson, encodeLabManifestJson } from "@beep/repo-cli-kit/cli/Labs/LabManifest"
 * import * as Effect from "effect/Effect"
 *
 * const manifest = Effect.runSync(decodeLabManifestJson('{"schemaVersion":"lab-manifest/v1","purpose":"Try a feature","created":"2026-11-03","disposition":"active"}'))
 * const encoded = Effect.runSync(encodeLabManifestJson(manifest))
 * console.log(encoded.includes('"disposition": "active"')) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeLabManifestJson: (input: LabManifest) => Effect.Effect<string, S.SchemaError> =
  S.encodeEffect(LabManifestFromJsonString);
