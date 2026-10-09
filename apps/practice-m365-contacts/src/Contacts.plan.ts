/** Pure planning; existing mailbox contacts are never patched.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual, flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { markerOf } from "./Contacts.mailbox.ts";
import { ContactPlanRow, ContactReport, seedCategory } from "./Contacts.schemas.ts";
import type { Contact } from "@beep/law-practice-use-cases/DocumentIdentification";
import type { MailboxInventory } from "./Contacts.mailbox.ts";
import type { RunJournal } from "./Contacts.schemas.ts";

const clean = flow(
  Str.normalize("NFKD"),
  Str.replace(/[\u0300-\u036f]/gu, ""),
  Str.trim,
  Str.toLowerCase,
  Str.replace(/\s+/gu, " ")
);
const emailKey = flow(Str.trim, Str.toLowerCase);
const namedKey = (name: string, company: string) => `${clean(name)}|${clean(company)}`;
const sourceEmails = (contact: Contact) =>
  A.map(
    A.filter(contact.emails, (email) => !email.role),
    (email) => emailKey(email.address)
  );

/** Plan creates and explained skips against every mailbox folder.
 * **Example** (Plan an empty source)
 * ```ts
 * import { planContacts } from "@/Contacts.plan"
 * import { MailboxInventory } from "@/Contacts.mailbox"
 * console.log(planContacts([], 0, MailboxInventory.make({ folders: [], contacts: [] }), []).rows.length) // 0
 * ```
 * @category workflows
 * @since 0.0.0
 */
export const planContacts: {
  (
    unidentifiable: number,
    inventory: MailboxInventory,
    journals: ReadonlyArray<RunJournal>
  ): (contacts: ReadonlyArray<Contact>) => { rows: ReadonlyArray<ContactPlanRow>; untrackedTagged: number };
  (
    contacts: ReadonlyArray<Contact>,
    unidentifiable: number,
    inventory: MailboxInventory,
    journals: ReadonlyArray<RunJournal>
  ): { rows: ReadonlyArray<ContactPlanRow>; untrackedTagged: number };
} = dual(
  4,
  (
    contacts: ReadonlyArray<Contact>,
    unidentifiable: number,
    inventory: MailboxInventory,
    journals: ReadonlyArray<RunJournal>
  ) => {
    const knownRuns = HashSet.fromIterable(A.map(journals, (journal) => journal.runId));
    const tagged = (row: (typeof inventory.contacts)[number]) =>
      O.exists(row.contact.categories, A.contains(seedCategory));
    const untrackedTagged = A.length(
      A.filter(
        inventory.contacts,
        (row) => tagged(row) && !O.exists(markerOf(row.contact), (run) => HashSet.has(knownRuns, run))
      )
    );
    const rows = A.map(contacts, (contact): ContactPlanRow => {
      const owned = A.some(journals, (journal) =>
        A.some(
          journal.contacts,
          (receipt) =>
            receipt.sourceKey === contact.contactId &&
            A.some(
              inventory.contacts,
              (row) =>
                row.contact.id === receipt.contactId && tagged(row) && O.contains(journal.runId)(markerOf(row.contact))
            )
        )
      );
      if (owned) return ContactPlanRow.cases.SkipAlreadySeeded.make({ contact });
      const emails = HashSet.fromIterable(sourceEmails(contact));
      const key = namedKey(
        contact.displayName,
        O.getOrElse(contact.organization, () => "")
      );
      if (HashSet.size(emails) === 0 && Str.isEmpty(clean(contact.displayName)))
        return ContactPlanRow.cases.SkipUnidentifiable.make({ count: 1 });
      const matching = A.filter(inventory.contacts, (row) => {
        const addresses = O.getOrElse(row.contact.emailAddresses, () => []);
        const emailMatch = A.some(addresses, (address) =>
          O.exists(address.address, (value) => HashSet.has(emails, emailKey(value)))
        );
        const nameMatch =
          namedKey(
            O.getOrElse(row.contact.displayName, () => ""),
            O.getOrElse(row.contact.companyName, () => "")
          ) === key;
        return emailMatch || (HashSet.size(emails) === 0 && nameMatch);
      });
      if (A.some(matching, tagged)) return ContactPlanRow.cases.SkipAlreadySeeded.make({ contact });
      if (A.isReadonlyArrayNonEmpty(matching)) return ContactPlanRow.cases.SkipExistsInMailbox.make({ contact });
      const conflict =
        Str.isNonEmpty(clean(contact.displayName)) &&
        A.some(
          inventory.contacts,
          (row) =>
            namedKey(
              O.getOrElse(row.contact.displayName, () => ""),
              O.getOrElse(row.contact.companyName, () => "")
            ) === key
        );
      if (conflict) return ContactPlanRow.cases.Conflict.make({ contact });
      return ContactPlanRow.cases.Create.make({ contact });
    });
    return {
      rows:
        unidentifiable > 0
          ? A.append(rows, ContactPlanRow.cases.SkipUnidentifiable.make({ count: unidentifiable }))
          : rows,
      untrackedTagged,
    };
  }
);

/** Reduce a plan to public counts, excluding all contact fields.
 * **Example** (Report an empty plan)
 * ```ts
 * import { reportPlan } from "@/Contacts.plan"
 * console.log(reportPlan("fixture-run", [], 0).Create) // 0
 * ```
 * @category projections
 * @since 0.0.0
 */
export const reportPlan: {
  (rows: ReadonlyArray<ContactPlanRow>, untrackedTagged: number): (runId: string) => ContactReport;
  (runId: string, rows: ReadonlyArray<ContactPlanRow>, untrackedTagged: number): ContactReport;
} = dual(
  3,
  (runId: string, rows: ReadonlyArray<ContactPlanRow>, untrackedTagged: number): ContactReport =>
    ContactReport.make({
      runId,
      Create: A.length(A.filter(rows, ContactPlanRow.guards.Create)),
      SkipExistsInMailbox: A.length(A.filter(rows, ContactPlanRow.guards.SkipExistsInMailbox)),
      SkipAlreadySeeded: A.length(A.filter(rows, ContactPlanRow.guards.SkipAlreadySeeded)),
      Conflict: A.length(A.filter(rows, ContactPlanRow.guards.Conflict)),
      SkipUnidentifiable: A.reduce(
        A.filter(rows, ContactPlanRow.guards.SkipUnidentifiable),
        0,
        (n, row) => n + row.count
      ),
      untrackedTagged,
      created: 0,
      failed: 0,
      edited: 0,
      deleted: 0,
    })
);
