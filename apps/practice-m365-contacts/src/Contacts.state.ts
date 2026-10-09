/** Private journal persistence and an exclusive scoped writer lock.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeM365ContactsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ContactsError, RunJournal } from "./Contacts.schemas.ts";
import type * as Scope from "effect/Scope";

const $I = $PracticeM365ContactsId.create("Contacts.state");
const stateError = () => ContactsError.make({ reason: "state" });
const codec = S.fromJsonString(RunJournal);

/** Private state port; platform handles stay inside its layer.
 * **Example** (Compose journal inspection)
 * ```ts
 * import { ContactsState } from "@/Contacts.state"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(ContactsState.use((state) => state.journals))) // true
 * ```
 * @category services
 * @since 0.0.0
 */
export class ContactsState extends Context.Service<
  ContactsState,
  {
    readonly journals: Effect.Effect<ReadonlyArray<RunJournal>, ContactsError>;
    readonly save: (journal: RunJournal) => Effect.Effect<void, ContactsError>;
    readonly lock: Effect.Effect<void, ContactsError, Scope.Scope>;
  }
>()($I`ContactsState`) {}

/** Build journal storage and fail-closed locking over one private directory.
 * **Example** (Compose private state)
 * ```ts
 * import { makeContactsState } from "@/Contacts.state"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(makeContactsState("fixture-state"))) // true
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makeContactsState = Effect.fn("ContactsState.make")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;
  const secureDirectory = fs
    .makeDirectory(directory, { recursive: true, mode: 0o700 })
    .pipe(Effect.andThen(fs.chmod(directory, 0o700)), Effect.mapError(stateError));
  const read = Effect.fn("ContactsState.read")(function* () {
    if (!(yield* fs.exists(directory).pipe(Effect.mapError(stateError)))) return [];
    const names = yield* fs.readDirectory(directory).pipe(Effect.mapError(stateError));
    return yield* Effect.forEach(
      A.filter(names, Str.endsWith(".json")),
      (name) =>
        fs
          .readFileString(path.join(directory, name))
          .pipe(Effect.flatMap(S.decodeUnknownEffect(codec)), Effect.mapError(stateError)),
      { concurrency: 1 }
    );
  });
  return ContactsState.of({
    journals: read(),
    save: Effect.fn("ContactsState.save")(function* (journal) {
      yield* secureDirectory;
      const text = yield* S.encodeEffect(codec)(journal).pipe(Effect.mapError(stateError));
      const temporary = path.join(
        directory,
        `${journal.runId}.${yield* crypto.randomUUIDv4.pipe(Effect.mapError(stateError))}.tmp`
      );
      const target = path.join(directory, `${journal.runId}.json`);
      yield* fs.writeFileString(temporary, text, { flag: "wx", mode: 0o600 }).pipe(Effect.mapError(stateError));
      yield* fs.rename(temporary, target).pipe(Effect.mapError(stateError));
    }),
    lock: Effect.acquireRelease(
      secureDirectory.pipe(
        Effect.andThen(
          fs.writeFileString(path.join(directory, "writer.lock"), "contact writer\n", { flag: "wx", mode: 0o600 })
        ),
        Effect.mapError(() => ContactsError.make({ reason: "locked" }))
      ),
      () => fs.remove(path.join(directory, "writer.lock")).pipe(Effect.orDie)
    ).pipe(Effect.asVoid),
  });
});

/** Ambient XDG state storage; stale locks require explicit inspection.
 * **Example** (Inspect the state layer)
 * ```ts
 * import { ContactsStateLive } from "@/Contacts.state"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(ContactsStateLive)) // true
 * ```
 * @category layers
 * @since 0.0.0
 */
export const ContactsStateLive = Layer.effect(
  ContactsState,
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const home = yield* Config.String("HOME");
    const root = yield* Config.String("XDG_STATE_HOME").pipe(Config.withDefault(path.join(home, ".local", "state")));
    return yield* makeContactsState(path.join(root, "beep", "practice-m365-contacts"));
  }).pipe(Effect.mapError(stateError))
);
