/**
 * XDG env matrix for the contacts state directory (4-X-A parity). `before` is
 * the hand-written resolution, `after` is `@beep/xdg` `XdgBase`; `null` means
 * the configuration fails.
 *
 * Divergent rows assert `after`; `before` stays as the record of the old answer
 * (committed and green against the hand-written body first).
 */
import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { contactsStateDirectory } from "@/Contacts.state";

type Env = Readonly<Record<string, string>>;

const directoryIn = (env: Env) =>
  contactsStateDirectory.pipe(
    Effect.map((directory): string | null => directory),
    Effect.orElseSucceed((): string | null => null),
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env))
  );

const suffix = "beep/practice-m365-contacts";

const rows: ReadonlyArray<readonly [string, Env, string | null]> = [
  ["the HOME default", { HOME: "/h" }, `/h/.local/state/${suffix}`],
  ["XDG_STATE_HOME", { XDG_STATE_HOME: "/x", HOME: "/h" }, `/x/${suffix}`],
  ["a trailing slash on XDG_STATE_HOME", { XDG_STATE_HOME: "/x/", HOME: "/h" }, `/x/${suffix}`],
  ["a trailing slash on HOME", { HOME: "/h/" }, `/h/.local/state/${suffix}`],
  ["an empty XDG_STATE_HOME", { XDG_STATE_HOME: "", HOME: "/h" }, `/h/.local/state/${suffix}`],
  ["nothing set", {}, null],
  ["an empty HOME", { HOME: "" }, null],
];

const divergent: ReadonlyArray<readonly [string, Env, string | null, string | null]> = [
  ["XDG_STATE_HOME without HOME", { XDG_STATE_HOME: "/x" }, null, `/x/${suffix}`],
  [
    "a relative XDG_STATE_HOME",
    { XDG_STATE_HOME: "relative", HOME: "/h" },
    `relative/${suffix}`,
    `/h/.local/state/${suffix}`,
  ],
  ["a relative HOME", { HOME: "relative" }, `relative/.local/state/${suffix}`, null],
];

it.layer(Path.layer, { timeout: "10 seconds" })("@beep/practice-m365-contacts state directory env matrix", (it) => {
  for (const [name, env, expected] of rows) {
    it.effect(name, () =>
      Effect.gen(function* () {
        assert.strictEqual(yield* directoryIn(env), expected);
      })
    );
  }
  for (const [name, env, , after] of divergent) {
    it.effect(`${name} (diverges on purpose: XDG absolute-only)`, () =>
      Effect.gen(function* () {
        assert.strictEqual(yield* directoryIn(env), after);
      })
    );
  }
});
