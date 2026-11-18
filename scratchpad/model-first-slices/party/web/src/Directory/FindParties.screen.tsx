import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import type { OrgId } from "@proto/kernel/Ids";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import * as A from "effect/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { Receipt } from "../Bindings.ts";
import { Intake, Reviewer } from "../Party.bindings.ts";
import { partyRuntime } from "../Party.runtime.ts";

/**
 * What the person is searching for.
 *
 * @category atoms
 * @since 0.0.0
 */
export const searchText = Atom.make("");

/**
 * The receipt of the last registration made here: the next search waits
 * until the directory has applied it (read-after-write).
 *
 * @category atoms
 * @since 0.0.0
 */
export const lastRegistration = Atom.make<O.Option<Receipt>>(O.none());

/**
 * One page of the org's parties matching the search text.
 *
 * @category atoms
 * @since 0.0.0
 */
export const searchResults = Atom.family((org: OrgId) =>
  partyRuntime.atom((get) => {
    const atLeast = get(lastRegistration);
    return Reviewer.FindParties(
      { org, text: get(searchText) },
      { take: 20, ...O.match(atLeast, { onNone: () => ({}), onSome: (receipt) => ({ atLeast: receipt }) }) },
    );
  }),
);

/**
 * Register a party under the search text as its name; on commit, record the
 * receipt so the search catches up with it.
 *
 * @category atoms
 * @since 0.0.0
 */
export const registerParty = Atom.family((org: OrgId) =>
  partyRuntime.fn<string>()((name, get) =>
    Effect.gen(function* () {
      const id = yield* (yield* Effect.service(SecureRandom.SecureRandom)).uuidV4();
      const outcome = yield* Intake.RegisterParty.send({ target: PartyId.make(`party_${id}`), input: { org, name } });
      if (P.isTagged(outcome, "Accepted")) get.set(lastRegistration, O.some(outcome.receipt));
      return outcome._tag;
    }),
  ),
);

/**
 * The directory search: one query and one command over the generated
 * bindings, with no machine (D12).
 *
 * **Example** (Rendering the search)
 * ```tsx
 * import { FindPartiesScreen } from "@proto/party-web/Directory/FindParties.screen";
 * import { OrgId } from "@proto/kernel/Ids";
 *
 * const page = <FindPartiesScreen org={OrgId.make("org_acme")} />;
 * ```
 *
 * @category screens
 * @since 0.0.0
 */
export const FindPartiesScreen = ({ org }: { readonly org: OrgId }) => {
  const [text, setText] = useAtom(searchText);
  const results = useAtomValue(searchResults(org));
  const register = useAtomSet(registerParty(org));
  const registered = useAtomValue(registerParty(org));
  return (
    <section aria-label="Party directory">
      <input aria-label="Search parties" value={text} onChange={(event) => setText(event.currentTarget.value)} />
      <button type="button" disabled={text === ""} onClick={() => register(text)}>
        Register
      </button>
      {AsyncResult.isSuccess(registered) ? <p role="status">Registration: {registered.value}</p> : null}
      {AsyncResult.match(results, {
        onInitial: () => <p>Searching</p>,
        onFailure: () => <p role="alert">The directory could not be searched.</p>,
        onSuccess: ({ value }) => (
          <ul>
            {A.map(value.entries, (row) => (
              <li key={row.partyId}>{row.name}</li>
            ))}
          </ul>
        ),
      })}
    </section>
  );
};
