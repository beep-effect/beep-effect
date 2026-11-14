/**
 * Request scoping shared by the Vercel providers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as O from "@beep/utils/Option";

/**
 * The `teamId` query parameter for a request, omitted for a personal account.
 *
 * @since 0.0.0
 * @internal
 */
export const teamScope = (teamId: string | undefined): { readonly teamId?: string } =>
  O.getSomesStruct({ teamId: O.fromUndefinedOr(teamId) });
