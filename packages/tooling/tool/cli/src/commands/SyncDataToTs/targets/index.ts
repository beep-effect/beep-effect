/**
 * Checked-in sync target registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { cldrTerritoriesTarget } from "./CldrTerritories.js";
import { ianaMediaTypesTarget } from "./IanaMediaTypes.js";
import { ianaTimezonesTarget } from "./IanaTimezones.js";
import { iso3166Target } from "./Iso3166.js";
import { iso4217Target } from "./Iso4217.js";

/**
 * All checked-in sync targets supported by sync-data-to-ts.
 *
 * @example
 * ```ts
 * import { syncDataTargets } from "@beep/repo-cli/commands/SyncDataToTs"
 * console.log(syncDataTargets)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const syncDataTargets = [
  iso4217Target,
  iso3166Target,
  ianaMediaTypesTarget,
  ianaTimezonesTarget,
  cldrTerritoriesTarget,
] as const;
