/**
 * XDG env matrix for the repo-cli sites 4-X-A moves onto `@beep/xdg`
 * `XdgBase`: the beep cache root, the Fleet scanner cache, the HarnessLedger
 * hook-pulse directory, the ai-metrics command data root and the person-match
 * cache. `before` is the hand-written resolution, `after` the adopted one;
 * `null` means nothing resolves (none, or a failure).
 *
 * Divergent rows assert `after`; `before` stays as the record of the old answer
 * (committed and green against the hand-written body first).
 */

import { AiMetricsDeployTarget } from "@beep/repo-ai-metrics";
import { resolveDataRoot } from "@beep/repo-cli/commands/AIMetrics/internal/Programs";
import { selectPersonMatchCacheRoot } from "@beep/repo-cli/test/Files";
import { resolveHookPulseDir } from "@beep/repo-cli/test/HarnessLedger";
import { resolveBeepCacheRoot } from "@beep/repo-cli/test/RepoRun";
import { fleetScannerCacheRoot, selectFleetScannerDir } from "@beep/repo-cli/test/Worktree";
import { afterEach, assert, it, vi } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";

type Env = Readonly<Record<string, string>>;
type Row = readonly [name: string, env: Env, expected: string | null];
type DivergentRow = readonly [name: string, env: Env, before: string | null, after: string | null];
type Resolved = string | O.Option<string>;

const inEnv =
  (env: Env) =>
  <E>(self: Effect.Effect<Resolved, E, Path.Path>): Effect.Effect<string | null, never, Path.Path> =>
    self.pipe(
      Effect.map((value) => (O.isOption(value) ? O.getOrNull(value) : value)),
      Effect.orElseSucceed((): string | null => null),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env))
    );

/** An expected value resolved against the working directory, as `path.resolve` does. */
const fromCwd = (relative: string) => `cwd:${relative}`;

const expectedIn = (expected: string | null) =>
  Effect.map(Path.Path, (path) =>
    pipe(
      O.fromNullishOr(expected),
      O.filter(Str.startsWith("cwd:")),
      O.match({ onNone: () => expected, onSome: (relative) => path.resolve(Str.slice(4)(relative)) })
    )
  );

const matrix = (
  title: string,
  resolve: (env: Env) => Effect.Effect<string | null, never, Path.Path>,
  rows: ReadonlyArray<Row>,
  divergent: ReadonlyArray<DivergentRow>
) =>
  it.layer(Path.layer, { timeout: "10 seconds" })(title, (it) => {
    for (const [name, env, expected] of rows) {
      it.effect(name, () =>
        Effect.gen(function* () {
          assert.strictEqual(yield* resolve(env), yield* expectedIn(expected));
        })
      );
    }
    for (const [name, env, , after] of divergent) {
      it.effect(`${name} (diverges on purpose: XDG absolute-only)`, () =>
        Effect.gen(function* () {
          assert.strictEqual(yield* resolve(env), yield* expectedIn(after));
        })
      );
    }
  });

const noFlag = O.none<string>();

matrix(
  "resolveBeepCacheRoot",
  (env) => resolveBeepCacheRoot().pipe(inEnv(env)),
  [
    ["XDG_CACHE_HOME", { XDG_CACHE_HOME: "/x", HOME: "/h" }, "/x"],
    ["a trailing slash on XDG_CACHE_HOME", { XDG_CACHE_HOME: "/x/" }, "/x"],
    ["the HOME default", { HOME: "/h" }, "/h/.cache"],
    ["an empty XDG_CACHE_HOME", { XDG_CACHE_HOME: "", HOME: "/h" }, "/h/.cache"],
    ["a trailing slash on HOME", { HOME: "/h/" }, "/h/.cache"],
    ["the TMPDIR rung", { TMPDIR: "/t" }, "/t"],
    ["the /tmp default", {}, "/tmp"],
    ["an empty HOME", { HOME: "", TMPDIR: "/t" }, "/t"],
  ],
  [
    ["a relative XDG_CACHE_HOME", { XDG_CACHE_HOME: "relative", HOME: "/h" }, fromCwd("relative"), "/h/.cache"],
    ["a padded XDG_CACHE_HOME", { XDG_CACHE_HOME: " /x", HOME: "/h" }, fromCwd(" /x"), "/h/.cache"],
    ["a relative HOME", { HOME: "relative", TMPDIR: "/t" }, fromCwd("relative/.cache"), "/t"],
  ]
);

// `XdgBase` is POSIX-only, so a drive or UNC root (`@beep/xdg/Absolute` `isAbsoluteWin32`) keeps
// its rung beside it instead of falling through to TMPDIR. Under the POSIX `Path` layer these rows
// pin the selected rung; on Windows the same values were what the hand-written resolver used.
matrix(
  "resolveBeepCacheRoot Windows roots",
  (env) => resolveBeepCacheRoot().pipe(inEnv(env)),
  [
    ["a Windows drive XDG_CACHE_HOME", { XDG_CACHE_HOME: "C:\\cache", HOME: "/h" }, "C:\\cache"],
    ["a UNC XDG_CACHE_HOME", { XDG_CACHE_HOME: "\\\\srv\\cache", HOME: "/h" }, "\\\\srv\\cache"],
    ["a Windows drive HOME", { HOME: "C:\\Users\\dev", TMPDIR: "/t" }, "C:\\Users\\dev/.cache"],
    ["a UNC HOME", { HOME: "\\\\srv\\home", TMPDIR: "/t" }, "\\\\srv\\home/.cache"],
    [
      "a relative XDG_CACHE_HOME beside a Windows drive HOME",
      { XDG_CACHE_HOME: "relative", HOME: "C:\\Users\\dev" },
      "C:\\Users\\dev/.cache",
    ],
    ["a POSIX XDG_CACHE_HOME beats a Windows drive HOME", { XDG_CACHE_HOME: "/x", HOME: "C:\\Users\\dev" }, "/x"],
    ["a drive-relative HOME is not a root", { HOME: "C:relative", TMPDIR: "/t" }, "/t"],
    ["a single-backslash XDG_CACHE_HOME is not a root", { XDG_CACHE_HOME: "\\single", HOME: "/h" }, "/h/.cache"],
  ],
  []
);

const fleetOf = (env: Env) =>
  Effect.succeed(
    fleetScannerCacheRoot({
      xdgCacheHome: O.fromUndefinedOr(env.XDG_CACHE_HOME),
      homeDir: O.fromUndefinedOr(env.HOME),
    }).pipe(O.getOrNull)
  );

matrix(
  "fleetScannerCacheRoot",
  fleetOf,
  [
    ["the HOME default", { HOME: "/h" }, "/h/.cache"],
    ["XDG_CACHE_HOME wins", { XDG_CACHE_HOME: "/x", HOME: "/h" }, "/x"],
    ["XDG_CACHE_HOME without HOME", { XDG_CACHE_HOME: "/x" }, "/x"],
    ["nothing set", {}, null],
  ],
  [
    ["an empty XDG_CACHE_HOME", { XDG_CACHE_HOME: "", HOME: "/h" }, "", "/h/.cache"],
    ["a relative XDG_CACHE_HOME", { XDG_CACHE_HOME: "relative", HOME: "/h" }, "relative", "/h/.cache"],
    ["a relative HOME", { HOME: "relative" }, "relative/.cache", null],
    ["a trailing slash on HOME", { HOME: "/h/" }, "/h//.cache", "/h/.cache"],
    ["an empty HOME", { HOME: "" }, "/.cache", null],
  ]
);

// The production read path: `fleet` reads XDG_CACHE_HOME from the live environment at call time
// (`configStringOptionSync`), so these rows stub the process environment instead of a ConfigProvider.
const fleetScannerRows: ReadonlyArray<
  readonly [name: string, xdgCacheHome: string | undefined, homeDir: string | undefined, expected: string]
> = [
  ["the HOME default", undefined, "/h", "/h/.cache/beep/fleet-scanner"],
  ["XDG_CACHE_HOME wins", "/x", "/h", "/x/beep/fleet-scanner"],
  ["nothing resolves: the fleet-root fallback", undefined, undefined, "/f/.beep-fleet-scanner"],
  [
    "a relative XDG_CACHE_HOME (diverges on purpose; before: relative/beep/fleet-scanner)",
    "relative",
    "/h",
    "/h/.cache/beep/fleet-scanner",
  ],
  [
    "a relative HOME (diverges on purpose; before: relative/.cache/beep/fleet-scanner)",
    undefined,
    "relative",
    "/f/.beep-fleet-scanner",
  ],
];

it.layer(Path.layer, { timeout: "10 seconds" })("selectFleetScannerDir (live environment)", (it) => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  for (const [name, xdgCacheHome, homeDir, expected] of fleetScannerRows) {
    it.effect(name, () =>
      Effect.gen(function* () {
        vi.stubEnv("XDG_CACHE_HOME", xdgCacheHome);
        const selected = yield* selectFleetScannerDir({
          scannerDir: O.none(),
          homeDir: O.fromUndefinedOr(homeDir),
          fleetRoot: "/f",
        });
        assert.strictEqual(selected, expected);
      })
    );
  }

  it.effect("an explicit scanner directory wins", () =>
    Effect.gen(function* () {
      vi.stubEnv("XDG_CACHE_HOME", "/x");
      const selected = yield* selectFleetScannerDir({
        scannerDir: O.some("/s"),
        homeDir: O.some("/h"),
        fleetRoot: "/f",
      });
      assert.strictEqual(selected, "/s");
    })
  );
});

const hooks = "beep/agent-evidence/hook-events";

matrix(
  "resolveHookPulseDir",
  (env) => resolveHookPulseDir.pipe(inEnv(env)),
  [
    ["the override wins", { BEEP_AGENT_EVIDENCE_ROOT: "/e", HOME: "/h" }, "/e/hook-events"],
    ["the HOME default", { HOME: "/h" }, `/h/.local/state/${hooks}`],
    ["XDG_STATE_HOME", { XDG_STATE_HOME: "/x", HOME: "/h" }, `/x/${hooks}`],
    ["XDG_STATE_HOME without HOME", { XDG_STATE_HOME: "/x" }, `/x/${hooks}`],
    ["a blank override falls through", { BEEP_AGENT_EVIDENCE_ROOT: "  ", HOME: "/h" }, `/h/.local/state/${hooks}`],
    ["a trailing slash on XDG_STATE_HOME", { XDG_STATE_HOME: "/x/", HOME: "/h" }, `/x/${hooks}`],
    ["a padded XDG_STATE_HOME is trimmed", { XDG_STATE_HOME: " /x", HOME: "/h" }, `/x/${hooks}`],
    ["nothing set", {}, null],
    ["a Windows drive HOME", { HOME: "C:\\Users\\dev" }, `C:\\Users\\dev/.local/state/${hooks}`],
    ["a UNC XDG_STATE_HOME", { XDG_STATE_HOME: "\\\\srv\\state", HOME: "/h" }, `\\\\srv\\state/${hooks}`],
  ],
  [
    [
      "a relative XDG_STATE_HOME",
      { XDG_STATE_HOME: "relative", HOME: "/h" },
      `relative/${hooks}`,
      `/h/.local/state/${hooks}`,
    ],
    ["a relative HOME", { HOME: "relative" }, `relative/.local/state/${hooks}`, null],
  ]
);

it.effect("resolveHookPulseDir: an unreadable environment fails with HarnessLedgerInputError", () =>
  Effect.gen(function* () {
    const unreadable = ConfigProvider.make(() => Effect.fail(new ConfigProvider.SourceError({ message: "no env" })));
    const error = yield* Effect.flip(
      resolveHookPulseDir.pipe(Effect.provideService(ConfigProvider.ConfigProvider, unreadable))
    );
    assert.strictEqual(error._tag, "HarnessLedgerInputError");
    assert.strictEqual(error.message, "Failed to read the state-home environment.");
  })
);

matrix(
  "resolveDataRoot (local target)",
  (env) => resolveDataRoot(noFlag, AiMetricsDeployTarget.Enum.local).pipe(inEnv(env)),
  [
    ["the HOME default", { HOME: "/h" }, "/h/.local/state/beep/ai-metrics"],
    ["XDG_STATE_HOME without HOME", { XDG_STATE_HOME: "/x" }, "/x/beep/ai-metrics"],
    ["the environment root wins", { BEEP_AI_METRICS_DATA_ROOT: "/d", HOME: "/h" }, "/d"],
    ["nothing set", {}, null],
    ["a relative HOME", { HOME: "relative" }, null],
    ["a Windows drive HOME", { HOME: "C:\\Users\\dev" }, "C:\\Users\\dev/.local/state/beep/ai-metrics"],
    ["a Windows drive XDG_STATE_HOME", { XDG_STATE_HOME: "D:\\state", HOME: "/h" }, "D:\\state/beep/ai-metrics"],
  ],
  [["a relative XDG_STATE_HOME", { XDG_STATE_HOME: "relative", HOME: "/h" }, null, "/h/.local/state/beep/ai-metrics"]]
);

const photoFace = "beep/photo-face";

matrix(
  "selectPersonMatchCacheRoot",
  (env) => selectPersonMatchCacheRoot(noFlag).pipe(inEnv(env)),
  [
    ["XDG_CACHE_HOME", { XDG_CACHE_HOME: "/x", HOME: "/h" }, `/x/${photoFace}`],
    ["the HOME default", { HOME: "/h" }, `/h/.cache/${photoFace}`],
    ["a trailing slash on HOME", { HOME: "/h/" }, `/h/.cache/${photoFace}`],
    ["a blank XDG_CACHE_HOME", { XDG_CACHE_HOME: "  ", HOME: "/h" }, `/h/.cache/${photoFace}`],
    ["a padded XDG_CACHE_HOME is trimmed", { XDG_CACHE_HOME: " /x ", HOME: "/h" }, `/x/${photoFace}`],
    ["the USERPROFILE branch", { USERPROFILE: "C:\\Users\\ada" }, `C:\\Users\\ada/.cache/${photoFace}`],
    ["nothing set", {}, null],
    [
      "a Windows drive XDG_CACHE_HOME beside USERPROFILE",
      { XDG_CACHE_HOME: "C:\\cache", USERPROFILE: "C:\\Users\\ada" },
      `C:\\cache/${photoFace}`,
    ],
    ["a UNC XDG_CACHE_HOME", { XDG_CACHE_HOME: "\\\\srv\\cache", HOME: "/h" }, `\\\\srv\\cache/${photoFace}`],
    [
      "a Windows drive HOME before USERPROFILE",
      { HOME: "C:\\Users\\git", USERPROFILE: "C:\\Users\\ada" },
      `C:\\Users\\git/.cache/${photoFace}`,
    ],
  ],
  [
    [
      "a relative XDG_CACHE_HOME",
      { XDG_CACHE_HOME: "relative", HOME: "/h" },
      `relative/${photoFace}`,
      `/h/.cache/${photoFace}`,
    ],
    ["a relative HOME", { HOME: "relative" }, `relative/.cache/${photoFace}`, null],
    [
      "a relative HOME beside USERPROFILE",
      { HOME: "relative", USERPROFILE: "C:\\Users\\ada" },
      `relative/.cache/${photoFace}`,
      `C:\\Users\\ada/.cache/${photoFace}`,
    ],
  ]
);

// Windows roots are what `@beep/xdg/Absolute` `isAbsoluteWin32` accepts: a drive root, or any two
// leading separators (`\\`, `//` or a mix). The two backslash-slash (`\/`) rows changed at the 4-X-A
// review fix, when the local predicate (drive root or `\\` only) gave way to xdg's; `//` and `/\` were
// already absolute to `XdgBase`, and `path.join` collapses `//` either way.
matrix(
  "selectPersonMatchCacheRoot Windows roots",
  (env) => selectPersonMatchCacheRoot(noFlag).pipe(inEnv(env)),
  [
    ["a backslash UNC XDG_CACHE_HOME", { XDG_CACHE_HOME: "\\\\server\\share" }, `\\\\server\\share/${photoFace}`],
    ["a slash UNC XDG_CACHE_HOME", { XDG_CACHE_HOME: "//server/share" }, `/server/share/${photoFace}`],
    ["a backslash-slash UNC XDG_CACHE_HOME", { XDG_CACHE_HOME: "\\/server" }, `\\/server/${photoFace}`],
    ["a slash-backslash UNC XDG_CACHE_HOME", { XDG_CACHE_HOME: "/\\server" }, `/\\server/${photoFace}`],
    [
      "a backslash UNC HOME before USERPROFILE",
      { HOME: "\\\\server\\share", USERPROFILE: "C:\\Users\\ada" },
      `\\\\server\\share/.cache/${photoFace}`,
    ],
    [
      "a backslash-slash UNC HOME before USERPROFILE",
      { HOME: "\\/server", USERPROFILE: "C:\\Users\\ada" },
      `\\/server/.cache/${photoFace}`,
    ],
    [
      "a drive-relative XDG_CACHE_HOME is not a root",
      { XDG_CACHE_HOME: "C:relative", HOME: "/h" },
      `/h/.cache/${photoFace}`,
    ],
    [
      "a single-backslash XDG_CACHE_HOME is not a root",
      { XDG_CACHE_HOME: "\\single", HOME: "/h" },
      `/h/.cache/${photoFace}`,
    ],
    [
      "a drive-relative HOME falls through to USERPROFILE",
      { HOME: "C:relative", USERPROFILE: "C:\\Users\\ada" },
      `C:\\Users\\ada/.cache/${photoFace}`,
    ],
    [
      "a single-backslash HOME falls through to USERPROFILE",
      { HOME: "\\single", USERPROFILE: "C:\\Users\\ada" },
      `C:\\Users\\ada/.cache/${photoFace}`,
    ],
  ],
  []
);

const explicitCacheDir = O.some("/c");

it.layer(Path.layer, { timeout: "10 seconds" })("selectPersonMatchCacheRoot --cache-dir", (it) => {
  it.effect("an explicit --cache-dir wins over the environment", () =>
    Effect.gen(function* () {
      const selected = yield* selectPersonMatchCacheRoot(explicitCacheDir).pipe(
        inEnv({ XDG_CACHE_HOME: "/x", HOME: "/h" })
      );
      assert.strictEqual(selected, "/c");
    })
  );
});
