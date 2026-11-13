import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { OrgId } from "@proto/kernel/Ids";
import { NotAMember } from "@proto/kernel/NotAMember.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { Party } from "./Party.aggregate.ts";
import { PartyId } from "./Party.id.ts";

/**
 * A party as it is now: its name and every party merged into it. Readable
 * only inside the party's org.
 *
 * @category views
 * @since 0.0.0
 */
export class EffectiveParty extends Domain.View(
  "EffectiveParty",
  {
    from: [Party],
    key: Party,
    middleware: [Session],
    rejects: [NotAMember],
    state: S.Struct({ org: S.NullOr(OrgId), name: S.NullOr(S.String), absorbed: S.Array(PartyId) }),
    initial: { org: null, name: null, absorbed: [] },
    evolve: {
      PartyRegistered: (view, event) => ({ ...view, org: event.by.org, name: event.name }),
      PartiesMerged: (view, event) => ({ ...view, absorbed: A.append(view.absorbed, event.absorbed) }),
    },
  },
  { description: "A party as it is now, with every duplicate merged into it.", audience: "reviewer" },
) {}
