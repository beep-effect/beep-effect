/** Contact-only mailbox port and complete recursive inventory.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeM365ContactsId } from "@beep/identity/packages";
import {
  GraphContact,
  GraphContactFolder,
  M365,
  M365_CONTACT_SEED_PROPERTY_ID,
  M365CreateContactFolderRequest,
  M365CreateContactRequest,
  M365DeleteContactFolderRequest,
  M365DeleteContactRequest,
  M365ListContactFoldersRequest,
  M365ListContactsRequest,
} from "@beep/m365";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ContactsError, seedFolderName } from "./Contacts.schemas.ts";
import type { M365ContactDraft, M365Error } from "@beep/m365";

const $I = $PracticeM365ContactsId.create("Contacts.mailbox");

/** One contact and its inventory folder, including the default folder.
 * **Example** (Construct an inventory row)
 * ```ts
 * import { MailboxContact } from "@/Contacts.mailbox"
 * import { GraphContact } from "@beep/m365"
 * import * as O from "effect/Option"
 * console.log(MailboxContact.make({ contact: GraphContact.make({ id: "fixture-contact" }), folderId: O.none() }).contact.id)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class MailboxContact extends S.Class<MailboxContact>($I`MailboxContact`)(
  { contact: GraphContact, folderId: S.Option(S.NonEmptyString) },
  $I.annote("MailboxContact", { description: "A contact paired with its precise folder route." })
) {}

/** Complete read-only contact inventory.
 * **Example** (Construct an empty inventory)
 * ```ts
 * import { MailboxInventory } from "@/Contacts.mailbox"
 * console.log(MailboxInventory.make({ folders: [], contacts: [] }).contacts.length) // 0
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class MailboxInventory extends S.Class<MailboxInventory>($I`MailboxInventory`)(
  { folders: S.Array(GraphContactFolder), contacts: S.Array(MailboxContact) },
  $I.annote("MailboxInventory", { description: "Every root and child contact folder and all contact pages." })
) {}

/** Contact capabilities only; the job has no mail or calendar methods.
 * **Example** (Compose a read-only inventory)
 * ```ts
 * import { ContactsMailbox } from "@/Contacts.mailbox"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(ContactsMailbox.use((mailbox) => mailbox.inventory))) // true
 * ```
 * @category services
 * @since 0.0.0
 */
export class ContactsMailbox extends Context.Service<
  ContactsMailbox,
  {
    readonly inventory: Effect.Effect<MailboxInventory, M365Error | ContactsError>;
    readonly createFolder: Effect.Effect<GraphContactFolder, M365Error>;
    readonly create: (folderId: string, contact: M365ContactDraft) => Effect.Effect<GraphContact, M365Error>;
    readonly delete: (contact: MailboxContact, changeKey: O.Option<string>) => Effect.Effect<void, M365Error>;
    readonly deleteFolder: (folderId: string) => Effect.Effect<void, M365Error>;
  }
>()($I`ContactsMailbox`) {}

/** Read a contact's seed marker without logging its private fields.
 * **Example** (Read an absent marker)
 * ```ts
 * import { markerOf } from "@/Contacts.mailbox"
 * import { GraphContact } from "@beep/m365"
 * import * as O from "effect/Option"
 * console.log(O.isNone(markerOf(GraphContact.make({ id: "fixture-id" })))) // true
 * ```
 * @category getters
 * @since 0.0.0
 */
export const markerOf = (contact: GraphContact): O.Option<string> =>
  O.flatMap(contact.singleValueExtendedProperties, (properties) =>
    O.map(
      A.findFirst(properties, (property) => property.id === M365_CONTACT_SEED_PROPERTY_ID),
      (property) => property.value
    )
  );

/** Bind the contact-only port to the single configured attorney mailbox.
 * **Example** (Inspect the layer)
 * ```ts
 * import { contactsMailboxLayer } from "@/Contacts.mailbox"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(contactsMailboxLayer("fixture-mailbox"))) // true
 * ```
 * @category layers
 * @since 0.0.0
 */
export const contactsMailboxLayer = (mailbox: string) =>
  Layer.effect(
    ContactsMailbox,
    Effect.gen(function* () {
      const m365 = yield* M365;
      const userId = O.some(mailbox);
      const foldersUnder = Effect.fn("ContactsMailbox.folders")(function* (parentFolderId: O.Option<string>) {
        let nextLink: O.Option<string> = O.none();
        let seen = HashSet.empty<string>();
        let folders: ReadonlyArray<GraphContactFolder> = [];
        do {
          const page = yield* m365.listContactFolders(
            M365ListContactFoldersRequest.make({ userId, parentFolderId, nextLink })
          );
          folders = A.appendAll(
            folders,
            A.map(page.value, (folder) =>
              GraphContactFolder.make({
                ...folder,
                parentFolderId: O.isSome(parentFolderId) ? parentFolderId : folder.parentFolderId,
              })
            )
          );
          nextLink = page["@odata.nextLink"];
          if (O.isSome(nextLink)) {
            if (HashSet.has(seen, nextLink.value)) return yield* ContactsError.make({ reason: "input" });
            seen = HashSet.add(seen, nextLink.value);
          }
        } while (O.isSome(nextLink));
        return folders;
      });
      const contactsIn = Effect.fn("ContactsMailbox.contacts")(function* (folderId: O.Option<string>) {
        let nextLink: O.Option<string> = O.none();
        let seen = HashSet.empty<string>();
        let contacts: ReadonlyArray<MailboxContact> = [];
        do {
          const page = yield* m365.listContacts(
            M365ListContactsRequest.make({ userId, folderId, nextLink, expandMarker: true })
          );
          contacts = A.appendAll(
            contacts,
            A.map(page.value, (contact) => MailboxContact.make({ contact, folderId }))
          );
          nextLink = page["@odata.nextLink"];
          if (O.isSome(nextLink)) {
            if (HashSet.has(seen, nextLink.value)) return yield* ContactsError.make({ reason: "input" });
            seen = HashSet.add(seen, nextLink.value);
          }
        } while (O.isSome(nextLink));
        return contacts;
      });
      const inventory = Effect.fn("ContactsMailbox.inventory")(function* () {
        let folders = yield* foldersUnder(O.none());
        let seen = HashSet.empty<string>();
        const contacts = yield* contactsIn(O.none());
        let rows = contacts;
        for (let index = 0; index < A.length(folders); index++) {
          const item = A.get(folders, index);
          if (O.isNone(item)) continue;
          const folder = item.value;
          if (HashSet.has(seen, folder.id)) continue;
          seen = HashSet.add(seen, folder.id);
          rows = A.appendAll(rows, yield* contactsIn(O.some(folder.id)));
          folders = A.appendAll(folders, yield* foldersUnder(O.some(folder.id)));
        }
        return MailboxInventory.make({
          folders: A.dedupeWith(folders, (a, b) => a.id === b.id),
          contacts: A.dedupeWith(rows, (a, b) => a.contact.id === b.contact.id),
        });
      });
      return ContactsMailbox.of({
        inventory: inventory(),
        createFolder: m365.createContactFolder(
          M365CreateContactFolderRequest.make({ userId, displayName: seedFolderName })
        ),
        create: Effect.fn("ContactsMailbox.create")((folderId, contact) =>
          m365.createContact(M365CreateContactRequest.make({ userId, folderId: O.some(folderId), contact }))
        ),
        delete: Effect.fn("ContactsMailbox.delete")((row, changeKey) =>
          m365.deleteContact(
            M365DeleteContactRequest.make({ userId, folderId: row.folderId, contactId: row.contact.id, changeKey })
          )
        ),
        deleteFolder: Effect.fn("ContactsMailbox.deleteFolder")((folderId) =>
          m365.deleteContactFolder(M365DeleteContactFolderRequest.make({ userId, folderId }))
        ),
      });
    })
  );
