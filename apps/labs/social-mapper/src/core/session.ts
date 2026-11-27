/**
 * Sign-ins that outlive the program: one browser profile for each account
 * a user keeps on a platform.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import { Browser, BrowserFailed } from "./browser.ts";
import { Platform } from "./locator.ts";
import type * as Scope from "effect/Scope";
import type { Tab } from "./browser.ts";

const $I = $SocialMapperId.create("core/session");

/**
 * **Details**
 *
 * `name` tells apart several accounts on one platform. A user with one
 * account never names it and gets `default`.
 *
 * **Example** (Name a second account)
 *
 * ```ts import.meta.vitest name="Name a second account"
 * import { Session } from "@/core/session"
 *
 * Session.make({ platform: "onlyfans" }).name // => "default"
 * Session.make({ platform: "onlyfans", name: "work" }).name // => "work"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Session extends S.Opaque<Session, { readonly brand: unique symbol }>()(
  S.Struct({
    platform: Platform,
    name: S.String.check(S.isPattern(/^[a-z0-9][a-z0-9-]{0,31}$/)).pipe(
      S.annotateKey({ description: "Which of the user's accounts on the platform this is." }),
      S.withDecodingDefaultTypeKey(Effect.succeed("default")),
      S.withConstructorDefault(Effect.succeed("default"))
    ),
  }).pipe($I.annoteSchema("Session", { description: "One kept sign-in on one platform." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Session {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly name?: string;
    readonly platform: Platform.Encoded;
  }
}

const unreadable = ({ message }: { readonly message: string }) => BrowserFailed.make({ detail: message });

/**
 * Hands out browser windows that carry a kept sign-in.
 *
 * **Details**
 *
 * `signIn` opens a visible window at the address given and returns once the
 * user closes it; whatever they signed in to stays in the profile. `tab`
 * opens the same profile without a window, for a mapper. A profile serves
 * one window at a time, so a second `tab` of one session waits for the
 * first scope to close.
 *
 * **Example** (Sign in once, then map without a window)
 *
 * ```ts import.meta.vitest name="Sign in once, then map without a window"
 * import { Session, Sessions } from "@/core/session"
 * import * as Effect from "effect/Effect"
 *
 * const session = Session.make({ platform: "onlyfans" })
 * const program = Effect.gen(function* () {
 *   const sessions = yield* Sessions
 *   yield* sessions.signIn(session, new URL("https://onlyfans.com"))
 *   return yield* Effect.scoped(sessions.tab(session))
 * })
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Sessions extends Context.Service<
  Sessions,
  {
    readonly list: Effect.Effect<ReadonlyArray<Session>, BrowserFailed>;
    readonly signIn: (session: Session, entry: URL) => Effect.Effect<void, BrowserFailed>;
    readonly tab: (session: Session) => Effect.Effect<Tab, BrowserFailed, Scope.Scope>;
    readonly forget: (session: Session) => Effect.Effect<void, BrowserFailed>;
  }
>()($I`Sessions`) {
  static readonly layer = (root: string): Layer.Layer<Sessions, never, Browser | FileSystem.FileSystem | Path.Path> =>
    Layer.effect(
      Sessions,
      Effect.gen(function* () {
        const browser = yield* Browser;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const locks = MutableHashMap.empty<Session, Semaphore.Semaphore>();

        const lock = (session: Session) =>
          O.getOrElse(MutableHashMap.get(locks, session), () => {
            const made = Semaphore.makeUnsafe(1);
            MutableHashMap.set(locks, session, made);
            return made;
          });

        const open = Effect.fn("Sessions.open")(function* (session: Session, visible: boolean) {
          const held = lock(session);
          yield* Effect.acquireRelease(Semaphore.take(held, 1), () => Semaphore.release(held, 1));
          const directory = path.join(root, session.platform, session.name);
          yield* Effect.mapError(fs.makeDirectory(directory, { recursive: true }), unreadable);
          return yield* browser.open({ directory, visible });
        });

        const named = (platform: Platform) =>
          fs
            .readDirectory(path.join(root, platform))
            .pipe(Effect.map(A.map((name) => Session.makeOption({ platform, name }))), Effect.map(A.getSomes));

        return {
          list: fs.exists(root).pipe(
            Effect.flatMap((present) => (present ? fs.readDirectory(root) : Effect.succeed(A.empty<string>()))),
            Effect.map(A.filter(S.is(Platform))),
            Effect.flatMap(Effect.forEach(named, { concurrency: 1 })),
            Effect.mapBoth({ onSuccess: A.flatten, onFailure: unreadable }),
            Effect.withSpan("Sessions.list")
          ),
          signIn: Effect.fn("Sessions.signIn")(function* (session: Session, entry: URL) {
            const tab = yield* open(session, true);
            yield* tab.visit(entry).pipe(Stream.runDrain, Effect.forkScoped);
            yield* tab.closed;
          }, Effect.scoped),
          tab: Effect.fn("Sessions.tab")((session: Session) => open(session, false)),
          forget: Effect.fn("Sessions.forget")(function* (session: Session) {
            yield* fs
              .remove(path.join(root, session.platform, session.name), { recursive: true, force: true })
              .pipe(Semaphore.withPermit(lock(session)));
          }, Effect.mapError(unreadable)),
        };
      })
    );
}
