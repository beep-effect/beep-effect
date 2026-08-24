/**
 * Generated from a pinned Free Law Project data archive.
 *
 * Refresh with `bun run beep sync-data-to-ts --target reporters-db`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Result } from "effect";
import { Unknown } from "@beep/schema/Unknown";

const decodeJson = Unknown.decodeUnknownResultFromJsonString;

/**
 * Schema-decoded generated data.
 *
 * @category constants
 * @since 0.0.0
 */
export const StateAbbreviationsData: unknown = Result.getOrThrow(decodeJson("{\n  \"Ala.\": \"Alabama\",\n  \"Alaska\": \"Alaska\",\n  \"Ariz.\": \"Arizona\",\n  \"Ark.\": \"Arkansas\",\n  \"Cal.\": \"California\",\n  \"Colo.\": \"Colorado\",\n  \"Conn.\": \"Connecticut\",\n  \"Del.\": \"Delaware\",\n  \"Fla.\": \"Florida\",\n  \"Ga.\": \"Georgia\",\n  \"Haw.\": \"Hawaii\",\n  \"Idaho\": \"Idaho\",\n  \"Ill.\": \"Illinois\",\n  \"Ind.\": \"Indiana\",\n  \"Iowa\": \"Iowa\",\n  \"Kan.\": \"Kansas\",\n  \"Ky.\": \"Kentucky\",\n  \"La.\": \"Louisiana\",\n  \"Me.\": \"Maine\",\n  \"Md.\": \"Maryland\",\n  \"Mass.\": \"Massachusetts\",\n  \"Mich.\": \"Michigan\",\n  \"Minn.\": \"Minnesota\",\n  \"Miss.\": \"Mississippi\",\n  \"Mo.\": \"Missouri\",\n  \"Mont.\": \"Montana\",\n  \"Neb.\": \"Nebraska\",\n  \"Nev.\": \"Nevada\",\n  \"N.H.\": \"New Hampshire\",\n  \"N.J.\": \"New Jersey\",\n  \"N.M.\": \"New Mexico\",\n  \"N.Y.\": \"New York\",\n  \"N.C.\": \"North Carolina\",\n  \"N.D.\": \"North Dakota\",\n  \"Ohio\": \"Ohio\",\n  \"Okla.\": \"Oklahoma\",\n  \"Or.\": \"Oregon\",\n  \"Pa.\": \"Pennsylvania\",\n  \"R.I.\": \"Rhode Island\",\n  \"S.C.\": \"South Carolina\",\n  \"S.D.\": \"South Dakota\",\n  \"Tenn.\": \"Tennessee\",\n  \"Tex.\": \"Texas\",\n  \"Utah\": \"Utah\",\n  \"Vt.\": \"Vermont\",\n  \"Va.\": \"Virginia\",\n  \"Wash.\": \"Washington\",\n  \"W. Va.\": \"West Virginia\",\n  \"Wis.\": \"Wisconsin\",\n  \"Wyo.\": \"Wyoming\"\n}\n"));
