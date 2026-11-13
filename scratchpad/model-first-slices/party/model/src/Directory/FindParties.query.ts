import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { PartyDirectory } from "./PartyDirectory.projection.ts";
import { DirectoryRow } from "./PartyDirectory.store.ts";

/**
 * Search the caller's org for parties by name, a page at a time.
 *
 * @category queries
 * @since 0.0.0
 */
export class FindParties extends Domain.Query(
  "FindParties",
  {
    input: { text: S.String },
    success: DirectoryRow,
    paged: true,
    waitsFor: [PartyDirectory],
    middleware: [Session],
  },
  { description: "Search the caller's organization for parties by name.", audience: "reviewer" },
) {}
