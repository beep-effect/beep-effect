/**
 * Checked-in sync target registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { cldrTerritoriesTarget } from "./CldrTerritories.ts";
import { courtsDbTarget } from "./CourtsDb.ts";
import { ianaMediaTypesTarget } from "./IanaMediaTypes.ts";
import { ianaTimezonesTarget } from "./IanaTimezones.ts";
import { iso3166Target } from "./Iso3166.ts";
import { iso4217Target } from "./Iso4217.ts";
import { reportersDbTarget } from "./ReportersDb.ts";
import { vocabTermsTarget } from "./VocabTerms.ts";

/**
 * All checked-in sync targets supported by sync-data-to-ts.
 *
 * @example
 * ```ts
 * import { syncDataTargets } from "@beep/repo-cli/commands/SyncDataToTs"
 *
 * const result = syncDataTargets.map((target) => target.id)
 * console.log(result) // rendered command output
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
  reportersDbTarget,
  courtsDbTarget,
  vocabTermsTarget,
] as const;
