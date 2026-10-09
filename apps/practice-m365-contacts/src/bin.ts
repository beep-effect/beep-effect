#!/usr/bin/env bun
/** Contact seeding executable.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Command } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Path from "effect/Path";
import { makeContactsCommand } from "./Contacts.command.ts";

const program = Effect.gen(function* () {
  const path = yield* Path.Path;
  const checkoutRoot = yield* path.fromFileUrl(new URL("../../../", import.meta.url));
  return yield* Command.run(makeContactsCommand(checkoutRoot), { version: "0.0.0" });
}).pipe(Effect.provideService(Logger.LogToStderr, true));
/** Run the contact CLI through the Bun process boundary.
 * **Example** (Inspect the entrypoint)
 * ```ts
 * import { runContacts } from "@/bin"
 * import * as P from "effect/Predicate"
 * console.log(P.isFunction(runContacts)) // true
 * ```
 * @category processes
 * @since 0.0.0
 */
export const runContacts = () =>
  BunServices.layer.pipe(
    Layer.build,
    Effect.flatMap((context) => program.pipe(Effect.provideContext(context))),
    Effect.scoped,
    BunRuntime.runMain
  );
if (import.meta.main) runContacts();
