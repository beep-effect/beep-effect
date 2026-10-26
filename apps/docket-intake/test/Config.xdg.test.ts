/**
 * XDG env matrix for the docket intake state directory (4-X-A parity).
 * `before` is the hand-written resolution, `after` is `@beep/xdg` `XdgBase`;
 * `null` means the configuration fails. Every value is synthetic.
 *
 * Divergent rows assert `after`; `before` stays as the record of the old answer
 * (committed and green against the hand-written body first).
 */
import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { DocketIntakeAppConfigFromEnv } from "@/Config";

type Env = Readonly<Record<string, string>>;

const required = {
  DOCKET_INTAKE_CERT_PRIVATE_KEY: "fixture-private-key",
  DOCKET_INTAKE_CERT_THUMBPRINT_SHA256: "AB12",
  DOCKET_INTAKE_CLIENT_ID: "client-id",
  DOCKET_INTAKE_MAILBOX: "docket@fixture.invalid",
  DOCKET_INTAKE_TENANT_ID: "tenant-id",
  DOCKET_INTAKE_TIME_ZONE: "America/Chicago",
};

const stateDirectoryIn = (env: Env) =>
  DocketIntakeAppConfigFromEnv.parse(ConfigProvider.fromUnknown({ ...required, ...env })).pipe(
    Effect.map((config): string | null => config.stateDirectory),
    Effect.orElseSucceed((): string | null => null)
  );

const suffix = "beep/docket-intake";

const rows: ReadonlyArray<readonly [string, Env, string | null]> = [
  ["the HOME default", { HOME: "/h" }, `/h/.local/state/${suffix}`],
  ["XDG_STATE_HOME", { XDG_STATE_HOME: "/x", HOME: "/h" }, `/x/${suffix}`],
  ["XDG_STATE_HOME without HOME", { XDG_STATE_HOME: "/x" }, `/x/${suffix}`],
  ["the explicit directory wins", { DOCKET_INTAKE_STATE_DIR: "/d", XDG_STATE_HOME: "/x", HOME: "/h" }, "/d"],
  ["an empty XDG_STATE_HOME", { XDG_STATE_HOME: "", HOME: "/h" }, `/h/.local/state/${suffix}`],
  ["nothing set", {}, null],
  ["an empty HOME", { HOME: "" }, null],
];

const divergent: ReadonlyArray<readonly [string, Env, string | null, string | null]> = [
  [
    "a relative XDG_STATE_HOME",
    { XDG_STATE_HOME: "relative", HOME: "/h" },
    `relative/${suffix}`,
    `/h/.local/state/${suffix}`,
  ],
  ["a relative HOME", { HOME: "relative" }, `relative/.local/state/${suffix}`, null],
  ["a trailing slash on HOME", { HOME: "/h/" }, `/h//.local/state/${suffix}`, `/h/.local/state/${suffix}`],
  // Joined without a doubled slash, as the contacts root, the forwarder and BeepCacheRoot already were.
  ["a trailing slash on XDG_STATE_HOME", { XDG_STATE_HOME: "/x/" }, `/x//${suffix}`, `/x/${suffix}`],
  ["a root XDG_STATE_HOME", { XDG_STATE_HOME: "/" }, `//${suffix}`, `/${suffix}`],
];

describe("@beep/docket-intake state directory env matrix", () => {
  for (const [name, env, expected] of rows) {
    it.effect(name, () =>
      Effect.gen(function* () {
        assert.strictEqual(yield* stateDirectoryIn(env), expected);
      })
    );
  }
  for (const [name, env, , after] of divergent) {
    it.effect(`${name} (diverges on purpose: XDG absolute-only)`, () =>
      Effect.gen(function* () {
        assert.strictEqual(yield* stateDirectoryIn(env), after);
      })
    );
  }
});
