import { normaliseContacts, RawContactCard } from "@beep/law-practice-use-cases/DocumentIdentification";
import {
  GraphContact,
  GraphContactFolder,
  GraphContactProperty,
  GraphEmailAddress,
  M365_CONTACT_SEED_PROPERTY_ID,
  M365ContactDraft,
  M365Error,
} from "@beep/m365";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { ContactsMailbox, MailboxContact, MailboxInventory } from "@/Contacts.mailbox";
import { planContacts, reportPlan } from "@/Contacts.plan";
import { ContactInputs, CreatedContact, RunJournal, seedCategory, seedFolderName } from "@/Contacts.schemas";
import { ContactSeeding, contactSeedingLayer } from "@/Contacts.service";
import { loadContacts } from "@/Contacts.source";
import { ContactsState, makeContactsState } from "@/Contacts.state";
import type { Contact } from "@beep/law-practice-use-cases/DocumentIdentification";

const JournalJson = S.fromJsonString(RunJournal);
const ExportRowJson = S.fromJsonString(S.Record(S.String, S.Unknown));

const raw = (name: string, emails: ReadonlyArray<string>, company = "Fixture company") =>
  RawContactCard.make({
    displayName: name,
    organization: O.some(company),
    emails,
    phones: [],
    titles: [],
    addresses: [],
    source: "outlook-csv",
  });
const contactOf = (name = "Fixture person", email = "person@example.test"): Contact =>
  O.getOrThrow(A.head(normaliseContacts([raw(name, [email])])));
const inventoryOf = (contacts: ReadonlyArray<GraphContact>) =>
  MailboxInventory.make({
    folders: [],
    contacts: A.map(contacts, (contact) => MailboxContact.make({ contact, folderId: O.none() })),
  });
const stored = (id: string, name: string, address: string, marker: O.Option<string> = O.none()) =>
  GraphContact.make({
    id,
    displayName: O.some(name),
    companyName: O.some("Fixture company"),
    emailAddresses: O.some([GraphEmailAddress.make({ address: O.some(address), name: O.none() })]),
    changeKey: O.some("version-1"),
    categories: O.isSome(marker) ? O.some([seedCategory]) : O.none(),
    singleValueExtendedProperties: O.map(marker, (value) => [
      GraphContactProperty.make({ id: M365_CONTACT_SEED_PROPERTY_ID, value }),
    ]),
  });
const empty = MailboxInventory.make({ folders: [], contacts: [] });
const csv = "First Name,Last Name,Company,E-mail Address\nFixture,Person,Fixture company,person@example.test\n";

const withFiles = Effect.fnUntraced(function* <A, E, R>(program: (root: string) => Effect.Effect<A, E, R>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const base = yield* path.fromFileUrl(new URL("../../../.beep/m365-contacts/tests", import.meta.url));
  yield* fs.makeDirectory(base, { recursive: true, mode: 0o700 });
  const root = yield* fs.makeTempDirectoryScoped({ directory: base, prefix: "contacts-" });
  return yield* program(root);
});

const withWriterLock = Effect.fnUntraced(function* <A, E, R>(
  state: Effect.Success<ReturnType<typeof makeContactsState>>,
  program: Effect.Effect<A, E, R>
) {
  yield* state.lock;
  return yield* program;
}, Effect.scoped);

const overJob = Effect.fn("overJob")(function* <A, E>(
  root: string,
  initial: MailboxInventory,
  program: Effect.Effect<A, E, ContactSeeding>,
  ambiguous = false
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const state = yield* makeContactsState(path.join(root, "state"));
  const inventory = yield* Ref.make(initial);
  const deleted = yield* Ref.make<ReadonlyArray<string>>([]);
  const createdCount = yield* Ref.make(0);
  const fake = ContactsMailbox.of({
    inventory: Ref.get(inventory),
    createFolder: Effect.gen(function* () {
      const folder = GraphContactFolder.make({ id: "seed-folder", displayName: O.some(seedFolderName) });
      yield* Ref.update(inventory, (snapshot) =>
        MailboxInventory.make({ ...snapshot, folders: A.append(snapshot.folders, folder) })
      );
      return folder;
    }),
    create: Effect.fnUntraced(function* (folderId, draft) {
      const number = yield* Ref.updateAndGet(createdCount, (n) => n + 1);
      const wire = {
        ...(yield* S.encodeEffect(M365ContactDraft)(draft).pipe(Effect.orDie)),
        id: `seed-${number}`,
        changeKey: "version-1",
        parentFolderId: folderId,
      };
      const contact = yield* S.decodeEffect(GraphContact)(wire).pipe(
        Effect.map((value) => GraphContact.make({ ...value, rawJson: O.some(wire) })),
        Effect.mapError(() => M365Error.fromReason("response decoding"))
      );
      yield* Ref.update(inventory, (snapshot) =>
        MailboxInventory.make({
          ...snapshot,
          contacts: A.append(snapshot.contacts, MailboxContact.make({ contact, folderId: O.some(folderId) })),
        })
      );
      if (ambiguous) return yield* M365Error.fromReason("ambiguous write");
      return contact;
    }),
    delete: Effect.fnUntraced(function* (row, changeKey) {
      if (O.isSome(changeKey) && !O.contains(changeKey.value)(row.contact.changeKey))
        return yield* M365Error.fromReason("response status", { status: 412 });
      yield* Ref.update(deleted, A.append(row.contact.id));
      yield* Ref.update(inventory, (snapshot) =>
        MailboxInventory.make({
          ...snapshot,
          contacts: A.filter(snapshot.contacts, (item) => item.contact.id !== row.contact.id),
        })
      );
    }),
    deleteFolder: Effect.fnUntraced(function* (id) {
      yield* Ref.update(inventory, (snapshot) =>
        MailboxInventory.make({ ...snapshot, folders: A.filter(snapshot.folders, (folder) => folder.id !== id) })
      );
    }),
  });
  const checkout = path.join(root, "checkout");
  yield* fs.makeDirectory(checkout);
  const context = yield* Layer.build(
    contactSeedingLayer(checkout).pipe(
      Layer.provide(Layer.succeed(ContactsMailbox, fake)),
      Layer.provide(Layer.succeed(ContactsState, state))
    )
  );
  const result = yield* program.pipe(Effect.provideContext(context));
  return {
    result,
    inventory: yield* Ref.get(inventory),
    deleted: yield* Ref.get(deleted),
    created: yield* Ref.get(createdCount),
    journals: yield* state.journals,
  };
}, Effect.scoped);

describe("contact seeding", () => {
  it("plans each skip and preserves unrelated hand-edited contacts", () => {
    const source = [
      contactOf(),
      contactOf("Seeded fixture", "seeded@example.test"),
      contactOf("Conflict fixture", "new@example.test"),
      contactOf("New fixture", "create@example.test"),
    ];
    const journal = RunJournal.make({ runId: "fixture-run", folderCreated: false, contacts: [] });
    const plan = planContacts(
      source,
      2,
      inventoryOf([
        stored("existing", "Different display", "PERSON@EXAMPLE.TEST"),
        stored("seeded", "Seeded fixture", "seeded@example.test", O.some(journal.runId)),
        stored("conflict", "Conflict fixture", "old@example.test"),
      ]),
      [journal]
    );
    expect(reportPlan("fixture-run", plan.rows, plan.untrackedTagged)).toMatchObject({
      Create: 1,
      SkipExistsInMailbox: 1,
      SkipAlreadySeeded: 1,
      Conflict: 1,
      SkipUnidentifiable: 2,
      untrackedTagged: 0,
    });
  });
  it("preserves seeded identity after a hand edit changes the name and email", () => {
    const source = contactOf();
    const journal = RunJournal.make({
      runId: "fixture-run",
      folderCreated: false,
      contacts: [CreatedContact.make({ sourceKey: source.contactId, contactId: "edited", changeKey: "version-1" })],
    });
    const edited = GraphContact.make({
      ...stored("edited", "Edited name", "edited@example.test", O.some(journal.runId)),
      changeKey: O.some("version-2"),
    });
    expect(
      reportPlan("fixture-run", planContacts([source], 0, inventoryOf([edited]), [journal]).rows, 0)
    ).toMatchObject({ Create: 0, SkipAlreadySeeded: 1 });
  });
  it("detects unknown and missing seed markers", () => {
    const marked = stored("untracked", "Fixture", "fixture@example.test", O.some("unknown-run"));
    const missing = GraphContact.make({ id: "unmarked", categories: O.some([seedCategory]) });
    expect(planContacts([], 0, inventoryOf([marked, missing]), []).untrackedTagged).toBe(2);
  });
  it("does not match shared role addresses across people", () => {
    const source = O.getOrThrow(A.head(normaliseContacts([raw("New fixture", ["info@example.test"])])));
    const plan = planContacts([source], 0, inventoryOf([stored("other", "Other fixture", "info@example.test")]), []);
    expect(reportPlan("fixture-run", plan.rows, 0).Create).toBe(1);
  });
  it.layer(BunServices.layer, { timeout: "5 seconds" })((it) => {
    it.effect("deduplicates source bytes and rejects VCF outside census", () =>
      withFiles(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const one = path.join(root, "one.csv");
          const two = path.join(root, "two.csv");
          const vcf = path.join(root, "fixture.vcf");
          yield* fs.writeFileString(one, csv);
          yield* fs.writeFileString(two, csv);
          yield* fs.writeFileString(
            vcf,
            "BEGIN:VCARD\nVERSION:4.0\nFN:Fixture Person\nEMAIL:person@example.test\nEND:VCARD\n"
          );
          const census = yield* loadContacts(ContactInputs.make({ csv: [one, two], vcf: [vcf] }), true);
          expect(census.contacts).toHaveLength(1);
          expect(O.getOrThrow(census.census)).toMatchObject({
            csvNormalized: 1,
            vcfCards: 1,
            vcfOverlap: 1,
            vcfOnly: 0,
          });
          expect(O.getOrThrow(census.census).csvInputs[0]?.inputsSharingHash).toBe(2);
          expect(yield* Effect.flip(loadContacts(ContactInputs.make({ csv: [one], vcf: [vcf] }), false))).toMatchObject(
            {
              reason: "input",
            }
          );
        })
      )
    );
    it.effect("applies once, records marker/version, plans zero creates and supports both undo dry runs", () =>
      withFiles(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const input = path.join(root, "fixture.csv");
          yield* fs.writeFileString(input, csv);
          const inputs = ContactInputs.make({ csv: [input], vcf: [] });
          const run = yield* overJob(
            root,
            empty,
            ContactSeeding.use(
              Effect.fnUntraced(function* (job) {
                const applied = yield* job.apply(inputs, true);
                expect(applied.created).toBe(1);
                expect(yield* job.dryRun(inputs, false, false)).toMatchObject({ Create: 0, SkipAlreadySeeded: 1 });
                const second = yield* job.apply(inputs, true);
                expect(second.created).toBe(0);
                expect(yield* job.undo(O.some(applied.runId), false, true, false)).toMatchObject({
                  deleted: 1,
                  edited: 0,
                });
                expect(yield* job.undo(O.none(), true, true, false)).toMatchObject({ deleted: 1 });
                yield* job.undo(O.some(applied.runId), false, false, true);
                return applied;
              })
            )
          );
          expect(run.created).toBe(1);
          expect(run.deleted).toHaveLength(1);
          expect(run.inventory.contacts).toHaveLength(0);
          expect(run.inventory.folders).toHaveLength(0);
          expect(run.journals[0]?.contacts).toHaveLength(1);
        })
      )
    );
    it.effect("per-run undo preserves a changed contact and category undo reports it", () =>
      withFiles(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const source = contactOf();
          const journal = RunJournal.make({
            runId: "fixture-run",
            folderCreated: false,
            contacts: [
              CreatedContact.make({ sourceKey: source.contactId, contactId: "edited", changeKey: "version-1" }),
            ],
          });
          yield* fs.makeDirectory(path.join(root, "state"));
          yield* fs.writeFileString(
            path.join(root, "state", "fixture-run.json"),
            yield* S.encodeEffect(JournalJson)(journal)
          );
          const edited = GraphContact.make({
            ...stored("edited", "Edited fixture", "edited@example.test", O.some(journal.runId)),
            changeKey: O.some("version-2"),
          });
          const result = yield* overJob(
            root,
            inventoryOf([edited]),
            ContactSeeding.use(
              Effect.fnUntraced(function* (job) {
                expect(yield* job.undo(O.some(journal.runId), false, true, false)).toMatchObject({
                  deleted: 0,
                  edited: 1,
                });
                expect(yield* job.undo(O.none(), true, true, false)).toMatchObject({ deleted: 1, edited: 1 });
                expect(yield* job.undo(O.some(journal.runId), false, false, true)).toMatchObject({
                  deleted: 0,
                  edited: 1,
                });
              })
            )
          );
          expect(result.deleted).toHaveLength(0);
          expect(result.inventory.contacts).toHaveLength(1);
        })
      )
    );
    it.effect("refuses untracked tagged contacts and unconfirmed apply before writes", () =>
      withFiles(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const input = path.join(root, "fixture.csv");
          yield* fs.writeFileString(input, csv);
          const inputs = ContactInputs.make({ csv: [input], vcf: [] });
          const run = yield* overJob(
            root,
            inventoryOf([stored("untracked", "Other fixture", "other@example.test", O.some("unknown-run"))]),
            ContactSeeding.use(
              Effect.fnUntraced(function* (job) {
                expect(yield* Effect.flip(job.apply(inputs, false))).toMatchObject({ reason: "confirmation" });
                expect(yield* Effect.flip(job.apply(inputs, true))).toMatchObject({ reason: "untracked-tagged" });
              })
            )
          );
          expect(run.created).toBe(0);
          expect(run.journals).toHaveLength(0);
        })
      )
    );
    it.effect("reconciles an ambiguous create by marker and stops without replay", () =>
      withFiles(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const input = path.join(root, "fixture.csv");
          yield* fs.writeFileString(input, csv);
          const run = yield* overJob(
            root,
            empty,
            ContactSeeding.use((job) => Effect.flip(job.apply(ContactInputs.make({ csv: [input], vcf: [] }), true))),
            true
          );
          expect(run.result).toMatchObject({ reason: "ambiguous-write" });
          expect(run.created).toBe(1);
          assertNone(O.getOrThrow(A.head(run.journals)).pendingSourceKey);
          expect(run.journals[0]?.contacts).toHaveLength(1);
        })
      )
    );
    it.effect("exports full private Graph JSON once with restrictive permissions and refuses checkout paths", () =>
      withFiles(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const wire = { id: "fixture-id", personalNotes: "Synthetic preserved field" };
          const inventory = inventoryOf([GraphContact.make({ id: "fixture-id", rawJson: O.some(wire) })]);
          const out = path.join(root, "export", "contacts.jsonl");
          const run = yield* overJob(
            root,
            inventory,
            ContactSeeding.use(
              Effect.fnUntraced(function* (job) {
                const receipt = yield* job.export(out);
                expect(receipt.count).toBe(1);
                expect(receipt.sha256).toHaveLength(64);
                const content = yield* S.decodeEffect(ExportRowJson)(yield* fs.readFileString(out));
                expect(content).toMatchObject(wire);
                expect((yield* fs.stat(out)).mode & 0o777).toBe(0o600);
                expect((yield* fs.stat(path.dirname(out))).mode & 0o777).toBe(0o700);
                expect(yield* Effect.flip(job.export(out))).toMatchObject({ reason: "unsafe-export" });
                expect(yield* Effect.flip(job.export(path.join(root, "checkout", "bad.jsonl")))).toMatchObject({
                  reason: "unsafe-export",
                });
                return receipt;
              })
            )
          );
          expect(run.created).toBe(0);
        })
      )
    );
    it.effect("category undo reports a missing edit baseline without claiming a confirmed edit", () =>
      withFiles(
        Effect.fnUntraced(function* (root) {
          const marked = stored("untracked", "Fixture", "fixture@example.test", O.some("missing-journal"));
          const result = yield* overJob(
            root,
            inventoryOf([marked]),
            ContactSeeding.use((job) => job.undo(O.none(), true, true, false))
          );
          expect(result.result).toMatchObject({ deleted: 1, edited: 0, unverifiable: 1 });
          expect(result.deleted).toHaveLength(0);
        })
      )
    );
    it.effect("locks writers exclusively and validates malformed journals", () =>
      withFiles(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const state = yield* makeContactsState(path.join(root, "state"));
          const blocked = yield* withWriterLock(state, state.lock.pipe(Effect.flip));
          expect(blocked).toMatchObject({ reason: "locked" });
          yield* withWriterLock(state, Effect.void);
          yield* fs.writeFileString(path.join(root, "state", "bad.json"), "not-json");
          expect(yield* Effect.flip(state.journals)).toMatchObject({ reason: "state" });
        })
      )
    );
  });
});
