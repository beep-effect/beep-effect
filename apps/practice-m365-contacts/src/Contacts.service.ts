/** Seeding workflow: read-only planning, durable creates, export and guarded undo.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeM365ContactsId } from "@beep/identity/packages";
import { GraphContactProperty, M365_CONTACT_SEED_PROPERTY_ID, M365ContactDraft } from "@beep/m365";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ContactsMailbox, MailboxInventory, markerOf } from "./Contacts.mailbox.ts";
import { planContacts, reportPlan } from "./Contacts.plan.ts";
import {
  ContactPlanRow,
  ContactReport,
  ContactsError,
  CreatedContact,
  RunJournal,
  seedCategory,
  seedFolderName,
} from "./Contacts.schemas.ts";
import { checksum, loadContacts } from "./Contacts.source.ts";
import { ContactsState } from "./Contacts.state.ts";
import type { Contact } from "@beep/law-practice-use-cases/DocumentIdentification";
import type { M365Error } from "@beep/m365";
import type { PlatformError } from "effect/PlatformError";
import type { ContactCensus, ContactInputs } from "./Contacts.schemas.ts";

const $I = $PracticeM365ContactsId.create("Contacts.service");

type JobError = ContactsError | M365Error | PlatformError | S.SchemaError;
const emptyInventory = MailboxInventory.make({ folders: [], contacts: [] });
const hasTag = (contact: (typeof emptyInventory.contacts)[number]) =>
  O.exists(contact.contact.categories, A.contains(seedCategory));
const draftFor = (contact: Contact, runId: string) =>
  M365ContactDraft.make({
    displayName: Str.isNonEmpty(contact.displayName)
      ? contact.displayName
      : O.getOrElse(A.head(contact.emails), () => ({ address: "Unnamed contact", role: false })).address,
    companyName: contact.organization,
    emailAddresses: A.map(contact.emails, (email) => ({ address: email.address, name: contact.displayName })),
    businessPhones: A.map(contact.phones, (phone) => phone.e164),
    categories: [seedCategory],
    singleValueExtendedProperties: [GraphContactProperty.make({ id: M365_CONTACT_SEED_PROPERTY_ID, value: runId })],
  });

const validateUndo = Effect.fn("ContactSeeding.validateUndo")(function* (
  run: O.Option<string>,
  byCategory: boolean,
  dryRun: boolean,
  yes: boolean
) {
  if (byCategory === O.isSome(run)) return yield* ContactsError.make({ reason: "input" });
  if (!dryRun && !yes) return yield* ContactsError.make({ reason: "confirmation" });
});

/** Seeding service; offline commands require no mailbox capability.
 * **Example** (Inspect the service key)
 * ```ts
 * import { ContactSeeding } from "@/Contacts.service"
 * console.log(ContactSeeding.key)
 * ```
 * @category services
 * @since 0.0.0
 */
export class ContactSeeding extends Context.Service<
  ContactSeeding,
  {
    readonly dryRun: (
      inputs: ContactInputs,
      offline: boolean,
      census: boolean
    ) => Effect.Effect<ContactReport | ContactCensus, JobError>;
    readonly apply: (inputs: ContactInputs, yes: boolean) => Effect.Effect<ContactReport, JobError>;
    readonly undo: (
      runId: O.Option<string>,
      byCategory: boolean,
      dryRun: boolean,
      yes: boolean
    ) => Effect.Effect<ContactReport, JobError>;
    readonly export: (out: string) => Effect.Effect<{ readonly count: number; readonly sha256: string }, JobError>;
  }
>()($I`ContactSeeding`) {}

/** Bind workflow dependencies to a checkout boundary used for export refusal.
 * **Example** (Inspect a workflow layer)
 * ```ts
 * import { contactSeedingLayer } from "@/Contacts.service"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(contactSeedingLayer("fixture-checkout"))) // true
 * ```
 * @category layers
 * @since 0.0.0
 */
export const contactSeedingLayer = (checkoutRoot: string) =>
  Layer.effect(
    ContactSeeding,
    Effect.gen(function* () {
      const state = yield* ContactsState;
      const mailbox = yield* Effect.serviceOption(ContactsMailbox);
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const crypto = yield* Crypto.Crypto;
      const runId = () => crypto.randomUUIDv4.pipe(Effect.map((uuid) => `seed-${uuid}`));
      const online = () =>
        Effect.fromOption(mailbox).pipe(Effect.mapError(() => ContactsError.make({ reason: "input" })));
      const plan = Effect.fn("ContactSeeding.plan")(function* (
        inputs: ContactInputs,
        offline: boolean,
        census: boolean
      ) {
        if (census && !offline) return yield* ContactsError.make({ reason: "input" });
        const source = yield* loadContacts(inputs, census).pipe(
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.provideService(Crypto.Crypto, crypto)
        );
        const inventory = offline ? emptyInventory : yield* (yield* online()).inventory;
        const journals = offline ? [] : yield* state.journals;
        const result = planContacts(source.contacts, source.unidentifiable, inventory, journals);
        const report = reportPlan(yield* runId(), result.rows, result.untrackedTagged);
        return { ...result, report, inventory, journals, census: source.census };
      });
      const failUntracked = (count: number) =>
        count === 0 ? Effect.void : Effect.fail(ContactsError.make({ reason: "untracked-tagged" }));

      const removeEmptyOwnedFolders = Effect.fn("ContactSeeding.removeEmptyOwnedFolders")(function* (
        journals: ReadonlyArray<RunJournal>,
        selectedRuns: ReadonlyArray<RunJournal>
      ) {
        const port = yield* online();
        const remaining = yield* port.inventory;
        const ownedFolders = A.dedupe(
          A.getSomes(
            A.map(
              A.filter(journals, (journal) => journal.folderCreated),
              (journal) => journal.folderId
            )
          )
        );
        const relevantFolders = HashSet.fromIterable(A.getSomes(A.map(selectedRuns, (journal) => journal.folderId)));
        yield* Effect.forEach(
          A.filter(
            ownedFolders,
            (id) =>
              HashSet.has(relevantFolders, id) &&
              A.some(remaining.folders, (folder) => folder.id === id) &&
              !A.some(
                remaining.contacts,
                (row) => O.contains(id)(row.folderId) || O.contains(id)(row.contact.parentFolderId)
              ) &&
              !A.some(remaining.folders, (folder) => O.contains(id)(folder.parentFolderId))
          ),
          port.deleteFolder,
          { concurrency: 1 }
        );
      });

      return ContactSeeding.of({
        dryRun: Effect.fn("ContactSeeding.dryRun")(function* (inputs, offline, census) {
          const planned = yield* plan(inputs, offline, census);
          yield* failUntracked(planned.untrackedTagged);
          return O.match(planned.census, {
            onSome: (counts): ContactReport | ContactCensus => counts,
            onNone: (): ContactReport | ContactCensus => planned.report,
          });
        }),
        apply: Effect.fn("ContactSeeding.apply")((inputs, yes) =>
          Effect.scoped(
            Effect.gen(function* () {
              if (!yes) return yield* ContactsError.make({ reason: "confirmation" });
              yield* state.lock;
              const port = yield* online();
              const planned = yield* plan(inputs, false, false);
              yield* failUntracked(planned.untrackedTagged);
              const creates = A.filter(planned.rows, ContactPlanRow.guards.Create);
              if (A.isReadonlyArrayEmpty(creates)) return planned.report;
              let journal = RunJournal.make({ runId: planned.report.runId, folderCreated: false, contacts: [] });
              yield* state.save(journal);
              const savedIds = HashSet.fromIterable(A.getSomes(A.map(planned.journals, (run) => run.folderId)));
              const recorded = A.filter(planned.inventory.folders, (folder) => HashSet.has(savedIds, folder.id));
              const named = A.filter(planned.inventory.folders, (folder) =>
                O.exists(folder.displayName, (name) => name === seedFolderName)
              );
              const choices = A.isReadonlyArrayNonEmpty(recorded) ? recorded : named;
              if (A.length(choices) > 1) return yield* ContactsError.make({ reason: "folder-ambiguous" });
              const folder = O.isSome(A.head(choices)) ? O.getOrThrow(A.head(choices)) : yield* port.createFolder;
              journal = RunJournal.make({
                ...journal,
                folderId: O.some(folder.id),
                folderCreated: A.isReadonlyArrayEmpty(choices),
              });
              yield* state.save(journal);
              let created = 0;
              for (const row of creates) {
                journal = RunJournal.make({ ...journal, pendingSourceKey: O.some(row.contact.contactId) });
                yield* state.save(journal);
                const updated = yield* Effect.uninterruptible(
                  Effect.gen(function* () {
                    const contact = yield* port.create(folder.id, draftFor(row.contact, journal.runId)).pipe(
                      Effect.catchIf(
                        (error) => error.reason === "ambiguous write",
                        Effect.fnUntraced(function* () {
                          // Reconcile only; never create again. Persist any uniquely attributable result.
                          const snapshot = yield* port.inventory;
                          const candidates = A.filter(
                            snapshot.contacts,
                            (item) =>
                              O.exists(markerOf(item.contact), (marker) => marker === journal.runId) &&
                              !A.some(journal.contacts, (entry) => entry.contactId === item.contact.id)
                          );
                          if (A.length(candidates) === 1) {
                            const found = O.getOrThrow(A.head(candidates)).contact;
                            if (O.isSome(found.changeKey))
                              yield* state.save(
                                RunJournal.make({
                                  ...journal,
                                  pendingSourceKey: O.none(),
                                  contacts: A.append(
                                    journal.contacts,
                                    CreatedContact.make({
                                      sourceKey: row.contact.contactId,
                                      contactId: found.id,
                                      changeKey: found.changeKey.value,
                                    })
                                  ),
                                })
                              );
                          }
                          yield* Effect.logError("Contact seeding stopped after ambiguous create", {
                            reconciled: A.length(candidates),
                          });
                          return yield* ContactsError.make({ reason: "ambiguous-write" });
                        })
                      )
                    );
                    if (O.isNone(contact.changeKey)) return yield* ContactsError.make({ reason: "missing-version" });
                    const next = RunJournal.make({
                      ...journal,
                      pendingSourceKey: O.none(),
                      contacts: A.append(
                        journal.contacts,
                        CreatedContact.make({
                          sourceKey: row.contact.contactId,
                          contactId: contact.id,
                          changeKey: contact.changeKey.value,
                        })
                      ),
                    });
                    yield* state.save(next);
                    return next;
                  })
                ).pipe(Effect.onError(() => Effect.logError("Contact seeding create failed", { created, failed: 1 })));
                journal = updated;
                created++;
              }
              return ContactReport.make({ ...planned.report, created });
            })
          )
        ),
        undo: Effect.fn("ContactSeeding.undo")((run, byCategory, dryRun, yes) =>
          Effect.scoped(
            Effect.gen(function* () {
              yield* validateUndo(run, byCategory, dryRun, yes);
              if (!dryRun) yield* state.lock;
              const port = yield* online();
              const inventory = yield* port.inventory;
              const journals = yield* state.journals;
              const selectedRuns = byCategory
                ? journals
                : A.filter(journals, (journal) => O.contains(journal.runId)(run));
              if (!byCategory && A.isReadonlyArrayEmpty(selectedRuns))
                return yield* ContactsError.make({ reason: "state" });
              const receipts = A.flatMap(selectedRuns, (journal) => journal.contacts);
              const receiptOf = (row: (typeof inventory.contacts)[number]) =>
                A.findFirst(receipts, (entry) => entry.contactId === row.contact.id);
              const unchanged = (row: (typeof inventory.contacts)[number]) =>
                O.exists(receiptOf(row), (receipt) => O.contains(receipt.changeKey)(row.contact.changeKey));
              const owned = byCategory
                ? A.filter(inventory.contacts, hasTag)
                : A.filter(
                    inventory.contacts,
                    (row) =>
                      O.isSome(receiptOf(row)) && O.exists(markerOf(row.contact), (value) => O.contains(value)(run))
                  );
              const unverifiable = A.length(
                A.filter(owned, (row) => O.isNone(receiptOf(row)) || O.isNone(row.contact.changeKey))
              );
              const edited = A.length(
                A.filter(owned, (row) =>
                  O.exists(receiptOf(row), (receipt) =>
                    O.exists(row.contact.changeKey, (changeKey) => changeKey !== receipt.changeKey)
                  )
                )
              );
              const selected = byCategory ? owned : A.filter(owned, unchanged);
              if (!dryRun) {
                yield* Effect.forEach(
                  selected,
                  (row) => port.delete(row, byCategory ? O.none() : row.contact.changeKey),
                  { concurrency: 1 }
                );
                yield* removeEmptyOwnedFolders(journals, selectedRuns);
              }
              return ContactReport.make({
                ...reportPlan(
                  O.getOrElse(run, () => "by-category"),
                  [],
                  0
                ),
                deleted: A.length(selected),
                edited,
                unverifiable,
              });
            })
          )
        ),
        export: Effect.fn("ContactSeeding.export")(function* (out) {
          const target = path.resolve(out);
          const checkout = yield* fs.realPath(checkoutRoot);
          const inside = (candidate: string) => {
            const relative = path.relative(checkout, candidate);
            return (
              relative === "" ||
              (!Str.startsWith(`..${path.sep}`)(relative) && relative !== ".." && !path.isAbsolute(relative))
            );
          };
          if (inside(target) || (yield* fs.exists(target)))
            return yield* ContactsError.make({ reason: "unsafe-export" });
          let ancestor = path.dirname(target);
          while (!(yield* fs.exists(ancestor))) ancestor = path.dirname(ancestor);
          if (inside(yield* fs.realPath(ancestor))) return yield* ContactsError.make({ reason: "unsafe-export" });
          const contacts = (yield* (yield* online()).inventory).contacts;
          const lines = yield* Effect.forEach(
            contacts,
            (row) =>
              S.encodeEffect(S.fromJsonString(S.Record(S.String, S.Unknown)))({
                ...O.getOrThrow(row.contact.rawJson),
                exportFolderId: O.getOrElse(row.folderId, () =>
                  O.getOrElse(row.contact.parentFolderId, () => "default")
                ),
              }),
            { concurrency: 1 }
          );
          const text = A.isReadonlyArrayEmpty(lines) ? "" : `${A.join(lines, "\n")}\n`;
          yield* fs.makeDirectory(path.dirname(target), { recursive: true, mode: 0o700 });
          yield* fs.chmod(path.dirname(target), 0o700);
          yield* fs.writeFileString(target, text, { flag: "wx", mode: 0o600 });
          return {
            count: A.length(contacts),
            sha256: yield* checksum(yield* fs.readFile(target)).pipe(Effect.provideService(Crypto.Crypto, crypto)),
          };
        }),
      });
    })
  );
