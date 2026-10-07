/**
 * Contact normalisation and stable deduplication.
 * @packageDocumentation
 * @since 0.0.0
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as M from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { Contact, ContactEmail, ContactProjection, ContentHash, PhoneNumber } from "./Identification.schemas.ts";
import type { RawContactCard } from "./Identification.schemas.ts";

const roleWords = HashSet.fromIterable(
  Str.split(
    "info docketing docket admin office support contact mail legal ip patents patent billing accounts noreply no-reply donotreply reception hello team sales service inquiries orders accounting hr webmaster help",
    " "
  )
);
const clean = (s: string) => Str.toLowerCase(Str.trim(s));
const nameKey = (s: string) => clean(Str.replace(/[\u0300-\u036f]/gu, "")(s.normalize("NFKD"))).replace(/\s+/gu, " ");
const distinct = (xs: ReadonlyArray<string>) =>
  A.sort(A.dedupe(A.filter(A.map(xs, Str.trim), Str.isNonEmpty)), Order.String);
const email = (s: string): O.Option<ContactEmail> => {
  const address = clean(Str.replace(/>$/u, "")(Str.replace(/^</u, "")(s)));
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(address)
    ? O.some(ContactEmail.make({ address, role: HashSet.has(roleWords, Str.split(address, "@")[0] ?? "") }))
    : O.none();
};
const phone = (s: string): O.Option<PhoneNumber> => {
  const digits = Str.replace(/\D/gu, "")(s);
  const national = digits.length === 11 && Str.startsWith("1")(digits) ? Str.slice(1)(digits) : digits;
  if (/^[2-9][0-9]{2}[2-9][0-9]{6}$/u.test(national))
    return O.some(PhoneNumber.make({ e164: `+1${national}`, areaCode: O.some(Str.slice(0, 3)(national)) }));
  return Str.startsWith("+")(Str.trim(s)) && /^[1-9][0-9]{10,14}$/u.test(digits)
    ? O.some(PhoneNumber.make({ e164: `+${digits}`, areaCode: O.none() }))
    : O.none();
};

/**
 * Deduplicates cards transitively by non-role email, then normalised name and organisation.
 * Stable ids hash the sorted non-role emails, then the normalised name and organisation, then the role
 * emails themselves for a nameless card, whatever its organisation.
 *
 * **Example** (Normalise no cards)
 *
 * ```ts
 * import { normaliseContacts } from "@beep/law-practice-use-cases/DocumentIdentification"
 * console.log(normaliseContacts([]).length) // 0
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const normaliseContacts = (cards: ReadonlyArray<RawContactCard>): ReadonlyArray<Contact> => {
  const parent = A.map(cards, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : find(parent[i] ?? i));
  const seen = M.empty<string, number>();
  A.forEach(cards, (card, i) => {
    const keys = A.map(
      A.filter(A.getSomes(A.map(card.emails, email)), (e) => !e.role),
      (e) => `email:${e.address}`
    );
    if (Str.isNonEmpty(Str.trim(card.displayName)))
      keys.push(`name:${nameKey(card.displayName)}|${nameKey(O.getOrElse(card.organization, () => ""))}`);
    A.forEach(keys, (key) => {
      const previous = M.get(seen, key);
      if (O.isSome(previous)) parent[find(i)] = find(previous.value);
      else M.set(seen, key, i);
    });
  });
  const groups = M.empty<number, Array<RawContactCard>>();
  A.forEach(cards, (card, i) => M.set(groups, find(i), [...O.getOrElse(M.get(groups, find(i)), () => []), card]));
  return A.sort(
    A.map(A.fromIterable(groups), ([, group]) => {
      const names = distinct(A.map(group, (c) => c.displayName));
      const orgs = distinct(A.getSomes(A.map(group, (c) => c.organization)));
      const displayName = A.reduce(names, "", (best, name) => (name.length > best.length ? name : best));
      const organization = A.head(orgs);
      const emails = A.getSomes(
        A.map(
          distinct(A.flatMap(group, (c) => A.getSomes(A.map(c.emails, (e) => O.map(email(e), (x) => x.address))))),
          email
        )
      );
      // Role mailboxes are shared, so they never carry identity while a person or company is known:
      // two people who share only info@ keep distinct ids. A nameless, role-only card falls back to
      // its own mailboxes so that two such cards never collide on an empty key.
      const personal = A.filter(emails, (e) => !e.role);
      const named = `${nameKey(displayName)}|${nameKey(O.getOrElse(organization, () => ""))}`;
      const addresses = (xs: ReadonlyArray<{ readonly address: string }>) =>
        A.join(
          A.map(xs, (e) => e.address),
          "|"
        );
      const nameless = Str.isEmpty(nameKey(displayName)) && emails.length > 0;
      const identity = personal.length > 0 ? addresses(personal) : nameless ? addresses(emails) : named;
      const phones = A.dedupeWith(
        A.getSomes(A.flatMap(group, (c) => A.map(c.phones, phone))),
        (a, b) => a.e164 === b.e164
      );
      return Contact.make({
        contactId: ContentHash.make(bytesToHex(sha256(utf8ToBytes(identity)))),
        displayName,
        organization,
        titles: distinct(A.flatMap(group, (c) => c.titles)),
        emails,
        domains: distinct(A.map(emails, (e) => Str.split(e.address, "@")[1] ?? "")),
        phones: A.sort(
          phones,
          Order.mapInput(Order.String, (p: PhoneNumber) => p.e164)
        ),
        addresses: distinct(A.flatMap(group, (c) => c.addresses)),
        sources: A.sort(A.dedupe(A.map(group, (c) => c.source)), Order.String),
        links: [],
      });
    }),
    Order.mapInput(
      Order.String,
      (c: Contact) => `${c.contactId}|${c.displayName}|${O.getOrElse(c.organization, () => "")}`
    )
  );
};

/**
 * Removes phones, postal addresses and titles for downstream consumers.
 * **Example** (Project no contacts)
 *
 * ```ts
 * import { projectContacts } from "@beep/law-practice-use-cases/DocumentIdentification"
 * console.log(projectContacts([])) // []
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const projectContacts = (contacts: ReadonlyArray<Contact>): ReadonlyArray<ContactProjection> =>
  A.map(contacts, (c) => ContactProjection.make(c));
