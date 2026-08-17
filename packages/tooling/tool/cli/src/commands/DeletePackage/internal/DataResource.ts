/**
 * Print-only data-resource helpers for the delete-package labs data phase.
 *
 * P2 of goals/lab-apps-lifecycle deliberately ships consent, ownership, and
 * locality **policy** plus manual-step printing only (P2-D16): the live
 * `DROP SCHEMA` executor is deferred until the repo-cli → `@beep/postgres`
 * fallow-boundary legality is proven, so this module never opens a database
 * connection and `@beep/repo-cli` gains no driver dependency.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str, thunkFalse } from "@beep/utils";
import { HashSet } from "effect";
import * as O from "effect/Option";

// D12 locality doctrine: only loopback hosts and `.localhost` names count as
// local. An unparseable DATABASE_URL is not provably local, so it classifies
// as non-local and requires --allow-non-local-data.
const LOCAL_DATABASE_HOSTS = HashSet.fromIterable(["localhost", "127.0.0.1", "::1"]);

const parseUrl = O.liftThrowable((value: string) => new URL(value));

// WHATWG hostnames wrap IPv6 literals in brackets; strip them so `[::1]`
// matches the loopback set.
const canonicalHost = (hostname: string): string =>
  Str.startsWith("[")(hostname) && Str.endsWith("]")(hostname)
    ? Str.slice(1, Str.length(hostname) - 1)(hostname)
    : hostname;

const expectedLabSchemaName = (slug: string): string => `lab_${Str.snakeCase(slug)}`;

const isLocalDatabaseUrl = (databaseUrl: string): boolean =>
  O.match(
    O.map(parseUrl(databaseUrl), (url) => canonicalHost(url.hostname)),
    {
      onNone: thunkFalse,
      onSome: (host) => HashSet.has(LOCAL_DATABASE_HOSTS, host) || Str.endsWith(".localhost")(host),
    }
  );

const labSchemaOwnershipProven = (slug: string, resourceName: string): boolean =>
  Str.equivalence(resourceName, expectedLabSchemaName(slug));

const renderManualDropStep = (resourceName: string): string => `DROP SCHEMA IF EXISTS "${resourceName}" CASCADE;`;

/**
 * Data-phase policy helpers for labs deletion: exact schema-name derivation
 * (`lab_<snake(slug)>`), `DATABASE_URL` locality classification, ownership
 * proof, and the manual `DROP SCHEMA` step rendering.
 *
 * **Example** (Derive and verify a lab schema name)
 *
 * ```ts
 * import { DeletePackageDataResource } from "@beep/repo-cli/commands/DeletePackage/internal/DataResource"
 *
 * const name = DeletePackageDataResource.expectedLabSchemaName("trustgraph-workbench")
 * console.log(name) // "lab_trustgraph_workbench"
 * console.log(DeletePackageDataResource.labSchemaOwnershipProven("trustgraph-workbench", name)) // true
 * console.log(DeletePackageDataResource.renderManualDropStep(name))
 * // DROP SCHEMA IF EXISTS "lab_trustgraph_workbench" CASCADE;
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const DeletePackageDataResource = {
  expectedLabSchemaName,
  isLocalDatabaseUrl,
  labSchemaOwnershipProven,
  renderManualDropStep,
} as const;
