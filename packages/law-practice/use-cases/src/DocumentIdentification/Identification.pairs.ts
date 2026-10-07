/**
 * Client index and provenance-aware pair building.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as M from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { extractPracticeKgPathEvidence, extractPracticeKgReferences } from "../PracticeKg.matter-lookup.ts";
import {
  ClientDocketPair,
  ClientIndexEntry,
  ClientName,
  ClientNumber,
  Contact,
  ContactLink,
  ContactLinkSource,
  DocketId,
  SourceCount,
} from "./Identification.schemas.ts";
import type { IndexEvidence } from "./Identification.schemas.ts";

const attributions = (row: IndexEvidence) => {
  const refs = A.flatMap(row.references, extractPracticeKgReferences);
  const paths = A.map(row.folders, (folder) => extractPracticeKgPathEvidence(`${folder}/document`));
  const explicit = A.getSomes(
    A.map(refs, (ref) => {
      const [client, docket] = Str.split(ref, ".");
      return S.is(ClientNumber)(client) && S.is(DocketId)(docket) ? O.some({ clientNumber: client, docket }) : O.none();
    })
  );
  const contextual = A.flatMap(paths, (path) => {
    const client = O.orElse(row.clientNumber, () =>
      S.is(ClientNumber)(path.clientNumber) ? O.some(path.clientNumber) : O.none()
    );
    return O.match(client, {
      onNone: () => [],
      onSome: (clientNumber) => A.map(A.filter(path.dockets, S.is(DocketId)), (docket) => ({ clientNumber, docket })),
    });
  });
  const bare = O.match(row.clientNumber, {
    onNone: () => [],
    onSome: (clientNumber) => A.map(A.filter(refs, S.is(DocketId)), (docket) => ({ clientNumber, docket })),
  });
  return A.dedupeWith(
    [...explicit, ...contextual, ...bare],
    (a, b) => a.clientNumber === b.clientNumber && a.docket === b.docket
  );
};

/**
 * Aggregates source counts by the full client and docket pair using the KG parsers.
 * **Example** (Build an empty register)
 *
 * ```ts
 * import { buildClientDocketPairs } from "@beep/law-practice-use-cases/DocumentIdentification"
 * console.log(buildClientDocketPairs([])) // []
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const buildClientDocketPairs = (rows: ReadonlyArray<IndexEvidence>): ReadonlyArray<ClientDocketPair> => {
  const pairs = M.empty<string, ClientDocketPair>();
  A.forEach(rows, (row) =>
    A.forEach(attributions(row), ({ clientNumber, docket }) => {
      const key = `${clientNumber}|${docket}`;
      const previous = O.getOrElse(M.get(pairs, key), () =>
        ClientDocketPair.make({ clientNumber, docket, sources: [] })
      );
      const count =
        O.getOrElse(
          A.findFirst(previous.sources, (s) => s.source === row.source),
          () => SourceCount.make({ source: row.source, count: 0 })
        ).count + 1;
      M.set(
        pairs,
        key,
        ClientDocketPair.make({
          ...previous,
          sources: A.sort(
            [
              ...A.filter(previous.sources, (s) => s.source !== row.source),
              SourceCount.make({ source: row.source, count }),
            ],
            Order.mapInput(Order.String, (s: SourceCount) => s.source)
          ),
        })
      );
    })
  );
  return A.map(
    A.sort(
      A.fromIterable(pairs),
      Order.mapInput(Order.String, ([key]: readonly [string, ClientDocketPair]) => key)
    ),
    ([, p]) => p
  );
};

/**
 * Builds a numbered client index from explicit assertions and parsed client-folder paths.
 * **Example** (Build no clients)
 *
 * ```ts
 * import { buildClientIndex } from "@beep/law-practice-use-cases/DocumentIdentification"
 * console.log(buildClientIndex([]).length) // 0
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const buildClientIndex = (rows: ReadonlyArray<IndexEvidence>): ReadonlyArray<ClientIndexEntry> => {
  const clients = M.empty<ClientNumber, ClientIndexEntry>();
  A.forEach(rows, (row) => {
    const ids = A.dedupe([...O.toArray(row.clientNumber), ...A.map(attributions(row), (a) => a.clientNumber)]);
    A.forEach(ids, (clientNumber) => {
      const old = O.getOrElse(M.get(clients, clientNumber), () =>
        ClientIndexEntry.make({ clientNumber, names: [], folders: [] })
      );
      M.set(
        clients,
        clientNumber,
        ClientIndexEntry.make({
          clientNumber,
          names: A.dedupeWith(
            [
              ...old.names,
              ...A.map(A.filter(row.names, Str.isNonEmpty), (name) => ClientName.make({ name, source: row.source })),
            ],
            (a, b) => a.name === b.name && a.source === b.source
          ),
          folders: A.sort(A.dedupe([...old.folders, ...row.folders]), Order.String),
        })
      );
    });
  });
  return A.sort(
    A.map(A.fromIterable(clients), ([, c]) => c),
    Order.mapInput(Order.String, (c: ClientIndexEntry) => c.clientNumber)
  );
};

/**
 * Links contacts by explicit ids or non-role emails and by exact organisation names.
 * Role mailboxes do not establish person attribution; every inferred link retains provenance.
 * **Example** (Link no contacts)
 *
 * ```ts
 * import { linkContacts } from "@beep/law-practice-use-cases/DocumentIdentification"
 * console.log(linkContacts([], [], []).length) // 0
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const linkContacts: {
  (
    rows: ReadonlyArray<IndexEvidence>,
    clients: ReadonlyArray<ClientIndexEntry>
  ): (contacts: ReadonlyArray<Contact>) => ReadonlyArray<Contact>;
  (
    contacts: ReadonlyArray<Contact>,
    rows: ReadonlyArray<IndexEvidence>,
    clients: ReadonlyArray<ClientIndexEntry>
  ): ReadonlyArray<Contact>;
} = dual(
  3,
  (
    contacts: ReadonlyArray<Contact>,
    rows: ReadonlyArray<IndexEvidence>,
    clients: ReadonlyArray<ClientIndexEntry>
  ): ReadonlyArray<Contact> =>
    A.map(contacts, (contact) => {
      const links: Array<ContactLink> = [...contact.links];
      A.forEach(rows, (row) => {
        const matched =
          A.contains(row.contactIds, contact.contactId) ||
          A.some(
            contact.emails,
            (e) => !e.role && A.some(row.emails, (address) => Str.toLowerCase(Str.trim(address)) === e.address)
          );
        if (!matched || !S.is(ContactLinkSource)(row.source)) return;
        const source = row.source;
        const attrs = attributions(row);
        A.forEach(
          A.dedupe([...O.toArray(row.clientNumber), ...A.map(attrs, (a) => a.clientNumber)]),
          (clientNumber) => {
            const families = A.dedupe(
              A.map(
                A.filter(attrs, (a) => a.clientNumber === clientNumber),
                (a) => `${clientNumber}.${Str.replace(/[A-Z].*$/u, "")(a.docket)}`
              )
            );
            A.forEach(families.length > 0 ? A.map(families, O.some) : [O.none()], (familyKey) =>
              links.push(ContactLink.make({ clientNumber, familyKey, source, evidence: "input assertion" }))
            );
          }
        );
      });
      const norm = (s: string) => Str.toLowerCase(Str.trim(s));
      A.forEach(clients, (client) => {
        if (
          O.isSome(contact.organization) &&
          A.some(client.names, (n) => norm(n.name) === norm(O.getOrElse(contact.organization, () => "")))
        )
          links.push(
            ContactLink.make({
              clientNumber: client.clientNumber,
              familyKey: O.none(),
              source: "org-name-match",
              evidence: "organisation index match",
            })
          );
      });
      return Contact.make({ ...contact, links: A.dedupeWith(links, S.toEquivalence(ContactLink)) });
    })
);
