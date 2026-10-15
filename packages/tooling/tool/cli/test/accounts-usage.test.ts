import { accountsCommand } from "@beep/repo-cli";
import {
  AccountRef,
  AccountsBoardLayout,
  AccountsError,
  AccountsStatusReport,
  AccountsUsage,
  AccountUsage,
  AccountUsageOutcome,
  accountSection,
  ClaudeUsageBodyJson,
  CodexCliAuth,
  CodexUsageBodyJson,
  CreditBalance,
  claudeCreditBalances,
  claudeUsageOutcome,
  claudeUsageWindows,
  codexCreditBalances,
  codexLimitResets,
  codexSignedInEmail,
  codexUsageOutcome,
  codexUsageWindows,
  dedupeAccountUsages,
  grokUsageOutcome,
  grokUsageWindows,
  groupAccounts,
  JunieAccessOptionsBody,
  JunieAuthTestBody,
  JunieAuthTestBodyJson,
  JunieExchangeBody,
  JunieQuotaBody,
  JunieQuotaBodyJson,
  JunieRefillBody,
  JunieRefreshBody,
  JunieRefreshBodyJson,
  JunieStoredCredential,
  JunieStoredCredentialJson,
  junieRefreshOutcome,
  junieUsageOutcome,
  layerAccountsUsageLive,
  loadAccountsReport,
  MuseKeyBodyJson,
  museUsageOutcome,
  museUsageWindows,
  pollAccounts,
  rankAccount,
  rankAccounts,
  renderAccountsBoard,
  renderHours,
  retainLastGood,
  SignedInLogin,
  UsageWindow,
  watchAccounts,
} from "@beep/repo-cli/test/Accounts";
import { fcRuns } from "@beep/test-utils";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Queue from "effect/Queue";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import * as TestClock from "effect/testing/TestClock";
import type * as Cause from "effect/Cause";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";

const now = DateTime.makeUnsafe("2026-01-05T00:00:00.000Z");
const inHours = (hours: number) => O.some(DateTime.makeUnsafe(DateTime.toEpochMillis(now) + hours * 3_600_000));

const account = (label: string, provider = "claude") =>
  AccountRef.make({ provider, label, source: `/auth/${provider}-${label}.json` });

const weekly = (usedPercent: number, resetsAt: O.Option<DateTime.Utc>) =>
  UsageWindow.make({ kind: "weekly", scope: O.none(), usedPercent, resetsAt });
const session = (usedPercent: number) =>
  UsageWindow.make({ kind: "session", scope: O.none(), usedPercent, resetsAt: inHours(2) });

const ok = (
  label: string,
  windows: ReadonlyArray<UsageWindow>,
  provider = "claude",
  asOf: O.Option<DateTime.Utc> = O.none()
) =>
  AccountUsage.make({
    account: account(label, provider),
    outcome: AccountUsageOutcome.cases.Ok.make({
      identity: O.some(label),
      plan: O.none(),
      windows,
      credits: [],
      limitResets: O.none(),
      asOf,
    }),
  });

const failed = (label: string, provider = "claude") =>
  AccountUsage.make({
    account: account(label, provider),
    outcome: AccountUsageOutcome.cases.Failed.make({ detail: "offline" }),
  });

const plainBoard = (report: AccountsStatusReport, width = 100) =>
  renderAccountsBoard(report, AccountsBoardLayout.make({ width, color: false, status: "updated now" }));

const reportOf = (usages: ReadonlyArray<AccountUsage>, signedIn: ReadonlyArray<SignedInLogin> = []) =>
  AccountsStatusReport.make({
    schemaVersion: "accounts-status/v2",
    generatedAt: now,
    groups: groupAccounts(rankAccounts(usages, now), signedIn),
  });

const linesOf = (text: string) => text.split("\n");

const claudeBody = `{
  "five_hour": {"utilization": 1, "resets_at": null},
  "limits": [
    {"kind":"session","group":"session","percent":40,"resets_at":"2026-01-05T05:00:00.150710+00:00","scope":null},
    {"kind":"weekly_all","group":"weekly","percent":86,"resets_at":"2026-01-08T03:00:00+00:00","scope":null},
    {"kind":"weekly_scoped","group":"weekly","percent":98,"resets_at":"2026-01-08T03:00:00+00:00","scope":{"model":{"id":null,"display_name":"Fable"},"surface":null}},
    {"kind":"something_new","group":"other","percent":5,"resets_at":null,"scope":null}
  ]
}`;

const codexBody = `{"plan_type":"pro","email":"work@example.com","rate_limit":{"primary_window":{"used_percent":38,"limit_window_seconds":604800,"reset_after_seconds":10,"reset_at":1767916800},"secondary_window":null}}`;

describe("account usage wire mapping", () => {
  it.effect("reads Claude's normalized limits and skips kinds it does not know", () =>
    Effect.gen(function* () {
      const windows = claudeUsageWindows(yield* ClaudeUsageBodyJson.decode(claudeBody));
      expect(A.map(windows, (window) => [window.kind, window.usedPercent, O.getOrNull(window.scope)])).toEqual([
        ["session", 40, null],
        ["weekly", 86, null],
        ["weekly-scoped", 98, "Fable"],
      ]);
    })
  );

  it.effect("falls back to Claude's older window fields when the list is absent", () =>
    Effect.gen(function* () {
      const body = yield* ClaudeUsageBodyJson.decode(
        `{"five_hour":{"utilization":12,"resets_at":null},"seven_day":{"utilization":50,"resets_at":"2026-01-08T03:00:00+00:00"}}`
      );
      expect(A.map(claudeUsageWindows(body), (window) => [window.kind, window.usedPercent])).toEqual([
        ["session", 12],
        ["weekly", 50],
      ]);
    })
  );

  it.effect("classifies a Codex window by its duration, not its slot", () =>
    Effect.gen(function* () {
      const windows = codexUsageWindows(yield* CodexUsageBodyJson.decode(codexBody));
      expect(A.map(windows, (window) => [window.kind, window.usedPercent])).toEqual([["weekly", 38]]);
      assertSome(
        O.map(
          O.flatMap(A.head(windows), (window) => window.resetsAt),
          DateTime.formatIso
        ),
        "2026-01-09T00:00:00.000Z"
      );
    })
  );

  it("turns a rejected or expired login into a re-login outcome", () => {
    const identity = O.some("me@example.com");
    const expired = `{"error":{"type":"authentication_error","message":"OAuth access token has expired."}}`;
    expect(claudeUsageOutcome({ identity, status: 200, body: expired })._tag).toBe("NeedsLogin");
    expect(claudeUsageOutcome({ identity, status: 401, body: "" })._tag).toBe("NeedsLogin");
    expect(codexUsageOutcome({ identity, status: 401, body: "" })._tag).toBe("NeedsLogin");
  });

  it("reports other errors and unreadable bodies as failures", () => {
    const identity = O.none<string>();
    expect(
      claudeUsageOutcome({ identity, status: 200, body: `{"error":{"type":"rate_limit_error","message":"slow down"}}` })
    ).toEqual(AccountUsageOutcome.cases.Failed.make({ detail: "slow down" }));
    expect(claudeUsageOutcome({ identity, status: 502, body: "<html>" })._tag).toBe("Failed");
    expect(codexUsageOutcome({ identity, status: 500, body: "{}" })._tag).toBe("Failed");
    expect(codexUsageOutcome({ identity, status: 200, body: "not json" })._tag).toBe("Failed");
  });

  it("carries the plan and windows of a good Codex response", () => {
    const outcome = codexUsageOutcome({ identity: O.some("work@example.com"), status: 200, body: codexBody });
    expect(outcome._tag === "Ok" ? [O.getOrNull(outcome.plan), A.length(outcome.windows)] : []).toEqual(["pro", 1]);
  });
});

// A gRPC-web frame holding a credits config: 8% used (float32) and a billing
// period that ends at Unix second 1791630240.
const grokReply = new Uint8Array([
  0x00, 0x00, 0x00, 0x00, 0x0f, 0x0a, 0x0d, 0x0d, 0x00, 0x00, 0x00, 0x41, 0x2a, 0x06, 0x08, 0xa0, 0xb7, 0xa8, 0xd6,
  0x06,
]);

describe("credits, resets, and the Muse and Grok providers", () => {
  it("reads every Claude dollar pool and labels the known one", () => {
    const pools = claudeCreditBalances(
      `{"seven_day":null,"iguana_necktie":{"utilization":1.4,"resets_at":"2026-11-05T07:59:00+00:00","limit_dollars":250,"used_dollars":3.5,"remaining_dollars":246.5},"harbor_lantern":{"resets_at":null,"limit_dollars":100,"remaining_dollars":98.4}}`
    );
    expect(A.map(pools, (pool) => [pool.label, pool.unit, pool.remaining, O.getOrNull(pool.limit)])).toEqual([
      ["cloud session credits", "usd", 246.5, 250],
      ["harbor_lantern", "usd", 98.4, 100],
    ]);
    expect(claudeCreditBalances("not json")).toEqual([]);
  });

  it.effect("reads a Codex credit balance and its unused limit resets", () =>
    Effect.gen(function* () {
      const body = yield* CodexUsageBodyJson.decode(
        `{"credits":{"has_credits":true,"balance":"62286.98"},"rate_limit_reset_credits":{"available_count":1,"applicable_available_count":0}}`
      );
      expect(A.map(codexCreditBalances(body), (credit) => [credit.unit, credit.remaining])).toEqual([
        ["credits", 62286.98],
      ]);
      assertSome(codexLimitResets(body), 1);
      const none = yield* CodexUsageBodyJson.decode(`{"credits":{"has_credits":false,"balance":"0"}}`);
      expect(codexCreditBalances(none)).toEqual([]);
    })
  );

  it.effect("reads Muse windows when Meta reports them and none while idle", () =>
    Effect.gen(function* () {
      const active = yield* MuseKeyBodyJson.decode(
        `{"subs_tier_name":"Muse Code Everyday Usage","subs_usage":{"window":{"used_percent":6,"window_duration_mins":300,"resets_at":1767916800},"weekly":{"used_percent":17,"resets_at":1767916800}}}`
      );
      expect(A.map(museUsageWindows(active), (window) => [window.kind, window.usedPercent])).toEqual([
        ["session", 6],
        ["weekly", 17],
      ]);
      const idle = museUsageOutcome({ identity: O.none(), status: 200, body: `{"subs_tier_name":"Tier"}` });
      expect(idle._tag === "Ok" ? [O.getOrNull(idle.plan), A.length(idle.windows)] : []).toEqual(["Tier", 0]);
      expect(museUsageOutcome({ identity: O.none(), status: 401, body: "" })._tag).toBe("NeedsLogin");
      expect(museUsageOutcome({ identity: O.none(), status: 200, body: "<html>" })._tag).toBe("Failed");
    })
  );

  it("decodes the Grok weekly pool from a gRPC-web protobuf reply", () => {
    const windows = O.getOrElse(grokUsageWindows(grokReply), () => A.empty<UsageWindow>());
    expect(
      A.map(windows, (window) => [
        window.kind,
        window.usedPercent,
        O.getOrNull(O.map(window.resetsAt, DateTime.toEpochMillis)),
      ])
    ).toEqual([["weekly", 8, 1_791_630_240_000]]);
    expect(grokUsageOutcome({ identity: O.none(), status: 200, body: grokReply })._tag).toBe("Ok");
    expect(grokUsageOutcome({ identity: O.none(), status: 200, body: new Uint8Array([1, 2, 3]) })._tag).toBe("Failed");
    expect(grokUsageOutcome({ identity: O.none(), status: 403, body: new Uint8Array(0) })._tag).toBe("NeedsLogin");
  });

  it("treats a missing used-percent field as an untouched pool", () => {
    const untouched = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x02, 0x0a, 0x00]);
    const windows = O.getOrElse(grokUsageWindows(untouched), () => A.empty<UsageWindow>());
    expect(A.map(windows, (window) => [window.usedPercent, O.isNone(window.resetsAt)])).toEqual([[0, true]]);
  });

  it("hides an unreadable duplicate login behind a readable one", () => {
    const dead = AccountUsage.make({
      account: account("twin"),
      outcome: AccountUsageOutcome.cases.NeedsLogin.make({ detail: "rejected" }),
    });
    const live = ok("twin", [weekly(10, inHours(5))]);
    const alone = AccountUsage.make({
      account: account("solo"),
      outcome: AccountUsageOutcome.cases.Failed.make({ detail: "offline" }),
    });
    expect(
      A.map(dedupeAccountUsages([dead, live, alone, live]), (usage) => [usage.account.label, usage.outcome._tag])
    ).toEqual([
      ["twin", "Ok"],
      ["solo", "Failed"],
    ]);
    expect(A.length(dedupeAccountUsages([dead, dead]))).toBe(1);
  });
});

describe("account ranking", () => {
  it("puts the quota most at risk of expiring unused first", () => {
    const rows = rankAccounts(
      [
        ok("plenty-of-time", [weekly(50, inHours(100))]),
        ok("expiring-soon", [weekly(50, inHours(10))]),
        ok("nearly-spent", [weekly(99, inHours(10))]),
      ],
      now
    );
    expect(A.map(rows, (row) => row.usage.account.label)).toEqual(["expiring-soon", "plenty-of-time", "nearly-spent"]);
    expect(A.map(rows, (row) => O.getOrNull(row.burnRate))).toEqual([5, 0.5, 0.1]);
  });

  it("orders ready, session-capped, exhausted, then unreadable accounts", () => {
    const needsLogin = AccountUsage.make({
      account: account("signed-out"),
      outcome: AccountUsageOutcome.cases.NeedsLogin.make({ detail: "no stored login" }),
    });
    const rows = rankAccounts(
      [
        needsLogin,
        ok("exhausted", [weekly(100, inHours(1))]),
        ok("capped", [session(100), weekly(10, inHours(1))]),
        ok("ready", [session(99), weekly(90, inHours(100))]),
      ],
      now
    );
    expect(A.map(rows, (row) => [row.usage.account.label, row.availability])).toEqual([
      ["ready", "ready"],
      ["capped", "session-capped"],
      ["exhausted", "weekly-exhausted"],
      ["signed-out", "unavailable"],
    ]);
  });

  it("gives a week that has not started the full seven days", () => {
    const rows = rankAccounts([ok("fresh", [weekly(0, O.none())])], now);
    expect(A.map(rows, (row) => O.getOrNull(row.hoursUntilWeeklyReset))).toEqual([168]);
  });

  it("supports the data-last form", () => {
    expect(rankAccounts(now)([])).toEqual([]);
  });

  it("spends a week that is running down before an untouched one", () => {
    const rows = rankAccounts(
      [ok("untouched", [weekly(0, inHours(168))]), ok("running", [weekly(9, inHours(160))])],
      now
    );
    expect(A.map(rows, (row) => row.usage.account.label)).toEqual(["running", "untouched"]);
  });

  it("restarts the windows of an older reading that reset since it was taken", () => {
    const row = rankAccount(ok("bot", [weekly(44, inHours(-1)), session(100)], "grok-bot", inHours(-72)), now);
    expect([row.estimated, row.availability, O.getOrNull(row.weeklyRemainingPercent)]).toEqual([
      true,
      "session-capped",
      100,
    ]);
    expect(O.getOrNull(row.dataAgeHours)).toBe(72);
    const fresh = rankAccount(ok("live", [weekly(44, inHours(-1))]), now);
    expect(fresh.estimated).toBe(false);
  });
});

describe("provider panels", () => {
  it("places each provider in its panel", () => {
    expect(A.map(["claude", "codex", "grok", "cursor", "grok-bot", "muse", "kimi"], accountSection)).toEqual([
      "claude",
      "codex",
      "supergrok",
      "supergrok",
      "supergrok",
      "muse",
      "other",
    ]);
  });

  it("groups ranked rows by panel in a fixed order and marks the signed-in account", () => {
    const groups = groupAccounts(
      rankAccounts(
        [
          ok("cursor@example.com", [weekly(10, inHours(5))], "cursor"),
          ok("b@example.com", [weekly(10, inHours(5))], "codex"),
          ok("a@example.com", [weekly(10, inHours(50))]),
          ok("z@example.com", [weekly(10, inHours(5))]),
        ],
        now
      ),
      [SignedInLogin.make({ provider: "claude", label: "a@example.com" })]
    );
    expect(
      A.map(groups, (group) => [group.section, A.map(group.rows, (row) => [row.usage.account.label, row.signedIn])])
    ).toEqual([
      [
        "claude",
        [
          ["z@example.com", false],
          ["a@example.com", true],
        ],
      ],
      ["codex", [["b@example.com", false]]],
      ["supergrok", [["cursor@example.com", false]]],
    ]);
    expect(groupAccounts([])([])).toEqual([]);
  });
});

describe("last good reading", () => {
  const previousAt = DateTime.makeUnsafe("2026-01-04T23:00:00.000Z");

  it("keeps an account's last good reading when its newest poll fails, stamped with its age", () => {
    const kept = retainLastGood([failed("me"), ok("other", [])], [ok("me", [weekly(20, inHours(5))])], previousAt);
    const readings = A.map(kept, (usage): readonly [DateTime.Utc | null, number] =>
      AccountUsageOutcome.match(usage.outcome, {
        Ok: ({ asOf, windows }) => [O.getOrNull(asOf), A.length(windows)],
        NeedsLogin: () => [null, 0],
        Failed: () => [null, -1],
      })
    );
    expect(readings).toEqual([
      [previousAt, 1],
      [null, 0],
    ]);
    expect(A.map(kept, (usage) => usage.account.label)).toEqual(["me", "other"]);
  });

  it("shows a rejected login at once instead of an older ready reading", () => {
    const rejected = AccountUsage.make({
      account: account("me"),
      outcome: AccountUsageOutcome.cases.NeedsLogin.make({ detail: "the provider rejected the stored login" }),
    });
    const kept = retainLastGood([rejected], [ok("me", [weekly(20, inHours(5))])], previousAt);
    expect(A.map(kept, (usage) => usage.outcome._tag)).toEqual(["NeedsLogin"]);
  });

  it("keeps an older stamp, and leaves a failure with no earlier reading as it is", () => {
    const older = DateTime.makeUnsafe("2026-01-04T20:00:00.000Z");
    const kept = retainLastGood([ok("x", [])], previousAt)([failed("me"), failed("new")]);
    expect(A.map(kept, (usage) => usage.outcome._tag)).toEqual(["Failed", "Failed"]);
    const stamped = retainLastGood([failed("me")], [ok("me", [], "claude", O.some(older))], previousAt);
    expect(
      A.map(stamped, (usage) =>
        AccountUsageOutcome.match(usage.outcome, {
          Ok: ({ asOf }) => O.getOrNull(asOf),
          NeedsLogin: () => null,
          Failed: () => null,
        })
      )
    ).toEqual([older]);
  });
});

describe("signed-in CLI logins", () => {
  const token = (claims: string) =>
    CodexCliAuth.make({
      tokens: {
        id_token: Redacted.make(`header.${Buffer.from(claims).toString("base64url")}.sig`, { label: "id_token" }),
      },
    });

  it("reads the email claim of the Codex ID token", () => {
    assertSome(codexSignedInEmail(token(`{"email":"me@example.com","sub":"x"}`)), "me@example.com");
    assertNone(codexSignedInEmail(token(`{"sub":"x"}`)));
    assertNone(
      codexSignedInEmail(CodexCliAuth.make({ tokens: { id_token: Redacted.make("not-a-jwt", { label: "id_token" }) } }))
    );
  });
});

describe("accounts board rendering", () => {
  it("renders spans in their two largest units, or minutes under an hour", () => {
    expect(A.map([136.5, 3.25, 0, 24, 0.5], renderHours)).toEqual(["5d 16h", "3h 15m", "0m", "1d 0h", "30m"]);
  });

  it("draws one panel per provider with every percentage as quota left", () => {
    const board = plainBoard(
      reportOf(
        [
          ok("me@example.com", [
            session(42),
            weekly(86, inHours(136.5)),
            UsageWindow.make({ kind: "weekly-scoped", scope: O.some("Fable"), usedPercent: 98, resetsAt: O.none() }),
          ]),
          ok("other@example.com", [session(100), weekly(10, inHours(50))]),
          failed("work", "codex"),
        ],
        [SignedInLogin.make({ provider: "claude", label: "other@example.com" })]
      )
    );
    const lines = linesOf(board);
    expect(lines[0]).toBe(" Accounts  updated now");
    expect(board).toContain("Claude");
    expect(board).toContain("switch to me@example.com");
    expect(board).toMatch(/▶ me@example\.com +ready +█+░+ +14% left +5d 16h/);
    expect(board).toContain("session 58% left · Fable 2% left");
    expect(board).toContain("other@example.com ●");
    expect(board).toContain("session back in 2h 0m");
    expect(board).toContain("Codex");
    expect(board).toContain("unreadable");
    expect(board).toContain("offline");
    expect(A.every(lines, (line) => line.length <= 100)).toBe(true);
  });

  it("says when to stay, and when no account in a panel is ready", () => {
    expect(
      plainBoard(
        reportOf(
          [ok("me@example.com", [weekly(10, inHours(5))])],
          [SignedInLogin.make({ provider: "claude", label: "me@example.com" })]
        )
      )
    ).toContain("stay on me@example.com");
    expect(plainBoard(reportOf([ok("me@example.com", [weekly(10, inHours(5))])]))).toContain("use me@example.com");
    expect(
      plainBoard(
        reportOf([ok("spent", [weekly(100, inHours(1))]), ok("capped", [session(100), weekly(1, inHours(9))])])
      )
    ).toContain("none ready · first back in 1h 0m");
    expect(plainBoard(reportOf([failed("gone")]))).toContain("none ready");
  });

  it("names SuperGrok tools by product and flags old or estimated readings", () => {
    const board = plainBoard(
      reportOf([
        ok("me@example.com", [weekly(55, inHours(20))], "grok"),
        ok("me@example.com", [weekly(44, inHours(-1))], "grok-bot", inHours(-72)),
        ok("me@example.com", [], "muse"),
      ])
    );
    expect(board).toContain("SuperGrok Heavy");
    expect(board).toContain("· Grok Build");
    expect(board).toContain("Grok Bot");
    expect(board).toContain("ready (est.)");
    expect(board).toContain("as of 3d 0h ago · a limit reset since then");
    expect(board).toContain("Muse");
    expect(board).toContain("no usage reported (idle)");
  });

  it("renders credits, unused limit resets, and the plan on the detail line", () => {
    const board = plainBoard(
      AccountsStatusReport.make({
        schemaVersion: "accounts-status/v2",
        generatedAt: now,
        groups: groupAccounts(
          [
            rankAccount(
              AccountUsage.make({
                account: account("me@example.com", "codex"),
                outcome: AccountUsageOutcome.cases.Ok.make({
                  identity: O.some("me@example.com"),
                  plan: O.some("pro"),
                  windows: [weekly(40, inHours(10))],
                  credits: [
                    CreditBalance.make({
                      label: "cloud session credits",
                      unit: "usd",
                      remaining: 246.5,
                      limit: O.some(250),
                      expiresAt: O.some(DateTime.makeUnsafe("2026-11-05T07:59:00.000Z")),
                    }),
                    CreditBalance.make({
                      label: "credits",
                      unit: "credits",
                      remaining: 62286.98,
                      limit: O.none(),
                      expiresAt: O.none(),
                    }),
                  ],
                  limitResets: O.some(2),
                  asOf: O.none(),
                }),
              }),
              now
            ),
          ],
          []
        ),
      }),
      120
    );
    expect(board).toContain(
      "$247 of $250 cloud session credits (expire Nov 5) · 62287 credits · 2 limit resets unused · plan pro"
    );
  });

  it("keeps every line inside the board at the minimum width with a long label", () => {
    const board = plainBoard(
      reportOf(
        [
          ok("abcdefghijklmnopqrstuvwxyz@example.com", [session(10), weekly(30, inHours(20))]),
          ok("short@example.com", [weekly(10, inHours(5))]),
        ],
        [SignedInLogin.make({ provider: "claude", label: "abcdefghijklmnopqrstuvwxyz@example.com" })]
      ),
      64
    );
    const lines = linesOf(board);
    expect(A.every(lines, (line) => line.length <= 64)).toBe(true);
    expect(
      A.every(
        A.filter(lines, (line) => /^[╭│╰]/.test(line)),
        (line) => line.length === 64
      )
    ).toBe(true);
    expect(board).toContain("abcdefghijklmnopqr… ●");
  });

  it("prints a hint when no account is registered, and colors on request", () => {
    expect(plainBoard(reportOf([]))).toContain("no accounts");
    const colored = renderAccountsBoard(
      reportOf([ok("me@example.com", [session(95), weekly(90, inHours(5))])]),
      AccountsBoardLayout.make({ width: 40, color: true, status: "" })
    );
    expect(colored).toContain("━");
    expect(colored).toContain("session 5% left");
  });
});

const respond = (request: HttpClientRequest.HttpClientRequest, body: string, status = 200) =>
  HttpClientResponse.fromWeb(request, new Response(body, { status }));

const testCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    randomBytes: (size) => new Uint8Array(size),
    digest: (_algorithm, data) => Effect.succeed(data),
  })
);
const inheritedPlatform = Layer.mergeAll(NodeServices.layer, testCrypto);

const runLive = Effect.fn("runLive")(function* <A, E>(
  files: Readonly<Record<string, string>>,
  client: HttpClient.HttpClient,
  program: Effect.Effect<A, E, AccountsUsage>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "accounts-usage-test-" });
  yield* fs.makeDirectory(path.join(root, "snapshots"));
  yield* Effect.forEach(
    R.toEntries(files),
    ([name, content]) =>
      fs
        .makeDirectory(path.dirname(path.join(root, name)), { recursive: true })
        .pipe(Effect.andThen(fs.writeFileString(path.join(root, name), content))),
    {
      discard: true,
    }
  );
  return yield* Layer.build(layerAccountsUsageLive).pipe(
    Effect.flatMap((context) => Effect.provideContext(program, context)),
    Effect.provideService(HttpClient.HttpClient, client),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnv({
        env: { BEEP_ACCOUNTS_AUTH_DIR: root, BEEP_ACCOUNTS_SNAPSHOT_DIR: path.join(root, "snapshots"), HOME: root },
      })
    )
  );
});

const authFiles = {
  "claude-me.json": `{"type":"claude","email":"me@example.com","access_token":"claude-token","disabled":false}`,
  "codex-work.json": `{"type":"codex","email":"work@example.com","access_token":"codex-token","account_id":"acct-1"}`,
  "claude-off.json": `{"type":"claude","email":"off@example.com","access_token":"off-token","disabled":true}`,
  "xai-me.json": `{"type":"xai","email":"me@example.com","access_token":"xai-token"}`,
  "meta-me.json": `{"type":"meta","email":"me@example.com","access_token":"muse-key","dca_token":"muse-device"}`,
  "kimi-me.json": `{"type":"kimi","email":"me@example.com","access_token":"kimi-token"}`,
  "config.yaml": "port: 8317",
  "broken.json": "{",
};

it.layer(inheritedPlatform, { timeout: "30 seconds" })("live account poller", (it) => {
  it.effect("lists every supported login and polls each with its own token", () =>
    Effect.gen(function* () {
      const seen = yield* Ref.make(A.empty<ReadonlyArray<string | undefined>>());
      const answer = (request: HttpClientRequest.HttpClientRequest) => {
        if (request.url.includes("anthropic")) return respond(request, claudeBody);
        if (request.url.includes("chatgpt")) return respond(request, codexBody);
        if (request.url.includes("meta.ai")) return respond(request, `{"subs_tier_name":"Tier"}`);
        return HttpClientResponse.fromWeb(request, new Response(grokReply, { status: 200 }));
      };
      const client = HttpClient.make((request) =>
        Ref.update(
          seen,
          A.append([
            request.method,
            request.url,
            request.headers.authorization,
            request.headers["anthropic-beta"] ?? request.headers["chatgpt-account-id"] ?? request.headers["x-grpc-web"],
          ])
        ).pipe(Effect.as(answer(request)))
      );
      const usages = yield* runLive(authFiles, client, pollAccounts);
      expect(A.map(usages, (usage) => [usage.account.provider, usage.account.label, usage.outcome._tag])).toEqual([
        ["claude", "me@example.com", "Ok"],
        ["codex", "work@example.com", "Ok"],
        ["grok", "me@example.com", "Ok"],
        ["muse", "me@example.com", "Ok"],
      ]);
      expect(
        A.sort(
          yield* Ref.get(seen),
          Order.mapInput(Order.String, (entry: ReadonlyArray<string | undefined>) => String(entry[1]))
        )
      ).toEqual([
        ["GET", "https://api.anthropic.com/api/oauth/usage", "Bearer claude-token", "oauth-2025-04-20"],
        ["POST", "https://api.meta.ai/muse-code/key", "Bearer muse-device", undefined],
        ["GET", "https://chatgpt.com/backend-api/wham/usage", "Bearer codex-token", "acct-1"],
        ["POST", "https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig", "Bearer xai-token", "1"],
      ]);
    })
  );

  it.effect("turns a transport failure into that account's outcome", () =>
    Effect.gen(function* () {
      const client = HttpClient.make((request) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.TransportError({ request, description: "offline" }),
          })
        )
      );
      const usages = yield* runLive({ "claude-me.json": authFiles["claude-me.json"] }, client, pollAccounts);
      expect(A.map(usages, (usage) => usage.outcome._tag)).toEqual(["Failed"]);
    })
  );

  it.effect("reads which account each CLI is signed in to, and builds the panel report", () =>
    Effect.gen(function* () {
      const idToken = `h.${Buffer.from(`{"email":"work@example.com"}`).toString("base64url")}.s`;
      const client = HttpClient.make((request) =>
        Effect.succeed(request.url.includes("anthropic") ? respond(request, claudeBody) : respond(request, "{}", 500))
      );
      const [signedIn, report, again] = yield* runLive(
        {
          "claude-me.json": authFiles["claude-me.json"],
          "codex-work.json": authFiles["codex-work.json"],
          ".claude.json": `{"oauthAccount":{"emailAddress":"me@example.com"},"projects":{}}`,
          ".codex/auth.json": `{"tokens":{"id_token":"${idToken}","access_token":"secret"}}`,
        },
        client,
        Effect.gen(function* () {
          const usage = yield* AccountsUsage;
          const first = yield* loadAccountsReport(O.none());
          return [yield* usage.signedIn, first, yield* loadAccountsReport(O.some(first))] as const;
        })
      );
      expect(A.map(signedIn, (login) => [login.provider, login.label])).toEqual([
        ["claude", "me@example.com"],
        ["codex", "work@example.com"],
      ]);
      expect(report.schemaVersion).toBe("accounts-status/v2");
      expect(
        A.map(report.groups, (group) => [
          group.section,
          A.map(group.rows, (row) => [row.usage.outcome._tag, row.signedIn]),
        ])
      ).toEqual([
        ["claude", [["Ok", true]]],
        ["codex", [["Failed", true]]],
      ]);
      expect(A.map(again.groups, (group) => A.map(group.rows, (row) => row.usage.outcome._tag))).toEqual([
        ["Ok"],
        ["Failed"],
      ]);
    })
  );

  it.effect("marks no account when the CLI config files are missing or unreadable", () =>
    Effect.gen(function* () {
      const client = HttpClient.make((request) => Effect.succeed(respond(request, "{}")));
      const signedIn = yield* runLive(
        { ".claude.json": "{", ".codex/auth.json": `{"tokens":{}}` },
        client,
        Effect.gen(function* () {
          return yield* (yield* AccountsUsage).signedIn;
        })
      );
      expect(signedIn).toEqual([]);
    })
  );

  it.effect("treats a missing auth directory as no accounts and a vanished login as a re-login", () =>
    Effect.gen(function* () {
      const client = HttpClient.make((request) => Effect.succeed(respond(request, "{}")));
      const outcome = yield* runLive(
        {},
        client,
        Effect.gen(function* () {
          const usage = yield* AccountsUsage;
          const listed = yield* usage.accounts;
          const polled = yield* usage.poll(account("gone"));
          return [A.length(listed), polled.outcome._tag];
        })
      );
      expect(outcome).toEqual([0, "NeedsLogin"]);
    })
  );
});

it.layer(inheritedPlatform, { timeout: "30 seconds" })("local snapshots", (it) => {
  const snapshot = `{"schemaVersion":"accounts-snapshot/v1","provider":"cursor","label":"me@example.com","capturedAt":"2026-01-04T21:00:00.000Z","plan":"Ultra","windows":[{"kind":"cycle","scope":null,"usedPercent":14,"resetsAt":"2026-01-05T10:00:00.000Z"},{"kind":"cycle-scoped","scope":"Auto","usedPercent":11,"resetsAt":null}]}`;

  it.effect("shows a snapshot file as a row and skips one it cannot read", () =>
    Effect.gen(function* () {
      const client = HttpClient.make((request) => Effect.succeed(respond(request, "{}")));
      const usages = yield* runLive(
        { "snapshots/cursor.json": snapshot, "snapshots/broken.json": "{", "snapshots/notes.txt": "x" },
        client,
        pollAccounts
      );
      expect(A.map(usages, (usage) => [usage.account.provider, usage.account.label, usage.outcome._tag])).toEqual([
        ["cursor", "me@example.com", "Ok"],
      ]);
      const board = plainBoard(reportOf(usages));
      expect(board).toMatch(/· Cursor +ready +█+░+ +86% left +10h 0m/);
      expect(board).toContain("Auto 89% left · plan Ultra · as of 3h 0m ago");
    })
  );

  it.effect("does not poll a provider that only exists as a snapshot", () =>
    Effect.gen(function* () {
      const client = HttpClient.make((request) => Effect.succeed(respond(request, "{}")));
      const outcome = yield* runLive(
        { "claude-me.json": authFiles["claude-me.json"] },
        client,
        Effect.gen(function* () {
          const usage = yield* AccountsUsage;
          const listed = yield* usage.accounts;
          const polled = yield* Effect.forEach(listed, (ref) =>
            usage.poll(AccountRef.make({ provider: "cursor", label: ref.label, source: ref.source }))
          );
          return A.map(polled, (row) => row.outcome._tag);
        })
      );
      expect(outcome).toEqual(["Failed"]);
    })
  );
});

const runAccounts = Command.runWith(accountsCommand, { version: "0.0.0" });

const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output = A.empty<string>();
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(
          output,
          A.map(values, (value) => `${value}`)
        );
      },
    })
  );
  return A.join(output, "\n");
});

describe("accounts status command", () => {
  it.layer(inheritedPlatform, { timeout: "30 seconds" })((it) => {
    it.effect("prints the ranked report as text and as one JSON document", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "accounts-command-test-" });
        const snapshots = path.join(root, "snapshots");
        yield* fs.makeDirectory(snapshots);
        yield* fs.writeFileString(
          path.join(snapshots, "cursor.json"),
          `{"schemaVersion":"accounts-snapshot/v1","provider":"cursor","label":"me@example.com","capturedAt":"2026-01-04T21:00:00.000Z","plan":null,"windows":[{"kind":"cycle","scope":null,"usedPercent":14,"resetsAt":null}]}`
        );
        const run = (args: ReadonlyArray<string>) =>
          captureOutput(runAccounts(args)).pipe(
            Effect.provideService(
              HttpClient.HttpClient,
              HttpClient.make((request) => Effect.succeed(respond(request, "{}")))
            ),
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromEnv({
                env: {
                  BEEP_ACCOUNTS_AUTH_DIR: path.join(root, "auth"),
                  BEEP_ACCOUNTS_SNAPSHOT_DIR: snapshots,
                  HOME: root,
                },
              })
            )
          );
        const text = yield* run(["status"]);
        expect(text).toContain("SuperGrok Heavy");
        expect(text).toContain("· Cursor");
        const json = yield* run(["status", "--json"]);
        expect(json).toContain('"schemaVersion":"accounts-status/v2"');
        expect(json).toContain('"section":"supergrok"');
        expect(json).toContain('"provider":"cursor"');
        // Without a terminal the live screen prints the board once and ends.
        const live = yield* run(["--every", "30"]);
        expect(live).toContain(" Accounts  updated ");
        expect(live).toContain("· Cursor");
      })
    );
  });
});

describe("accounts command", () => {
  it("registers the status subcommand", () => {
    expect(accountsCommand.name).toBe("accounts");
    expect(A.flatMap(accountsCommand.subcommands, (group) => A.map(group.commands, (command) => command.name))).toEqual(
      ["status", "secrets-layout"]
    );
  });
});

const keyPress = (name: string): Terminal.UserInput => ({
  input: O.some(name),
  key: { name, ctrl: false, meta: false, shift: false },
});

const runScreen = Effect.fnUntraced(function* (
  usage: Effect.Effect<ReadonlyArray<AccountUsage>, AccountsError>,
  keys: ReadonlyArray<Terminal.UserInput>
) {
  const shown = yield* Ref.make(A.empty<string>());
  const input = yield* Queue.unbounded<Terminal.UserInput, Cause.Done>();
  const terminal = Terminal.make({
    columns: Effect.succeed(90),
    rows: Effect.succeed(40),
    readInput: Effect.succeed(input),
    readLine: Effect.succeed(""),
    display: (text) => Ref.update(shown, A.append(text)),
  });
  const poller = AccountsUsage.of({
    accounts: Effect.succeed([]),
    poll: Effect.fn("AccountsUsage.poll")(function* (ref: AccountRef) {
      return failed(ref.label);
    }),
    snapshots: usage,
    signedIn: Effect.succeed([]),
  });
  const screen = yield* watchAccounts(Duration.seconds(30)).pipe(
    Effect.provideService(Terminal.Terminal, terminal),
    Effect.provideService(AccountsUsage, poller),
    Effect.forkChild
  );
  // Let a second of screen time pass before each key: the first poll lands,
  // and a poll asked for with `r` starts on the next tick.
  yield* Effect.forEach(keys, (key) => TestClock.adjust("1 second").pipe(Effect.andThen(Queue.offer(input, key))), {
    discard: true,
  });
  yield* Fiber.join(screen);
  return A.join(yield* Ref.get(shown), "");
});

describe("live accounts screen", () => {
  it.effect("draws the board, polls again on r, and restores the screen on q", () =>
    Effect.gen(function* () {
      const output = yield* runScreen(Effect.succeed([ok("me@example.com", [weekly(10, inHours(5))])]), [
        keyPress("x"),
        keyPress("r"),
        keyPress("q"),
      ]);
      expect(output.startsWith("\u001b[?1049h")).toBe(true);
      expect(output.endsWith("\u001b[?25h\u001b[?1049l")).toBe(true);
      expect(output).toContain("polling");
      expect(output).toContain("me@example.com");
      expect(output).toContain("r refresh");
    })
  );

  it.effect("keeps waiting when a poll fails, and quits on Ctrl+C or a closed input", () =>
    Effect.gen(function* () {
      const output = yield* runScreen(Effect.fail(AccountsError.make({ reason: "io", message: "disk gone" })), [
        { input: O.none(), key: { name: "c", ctrl: true, meta: false, shift: false } },
      ]);
      expect(output).toContain("polling every account");
      expect(output).toContain("poll failed: disk gone (showing the last reading)");
      expect(output.endsWith("\u001b[?1049l")).toBe(true);
    })
  );
});

describe("Junie direct balance", () => {
  it.effect.prop(
    "round trips Junie balance and credential wire schemas",
    [Arbitrary.schema(JunieAuthTestBody), Arbitrary.schema(JunieStoredCredential)],
    Effect.fnUntraced(function* ([balance, credential]) {
      assertTrue(
        S.toEquivalence(JunieAuthTestBody)(
          yield* S.decodeEffect(JunieAuthTestBody)(yield* S.encodeEffect(JunieAuthTestBody)(balance)),
          balance
        )
      );
      assertTrue(
        S.toEquivalence(JunieStoredCredential)(
          yield* S.decodeEffect(JunieStoredCredential)(yield* S.encodeEffect(JunieStoredCredential)(credential)),
          credential
        )
      );
    }),
    { arbitrary: fcRuns(24) }
  );
  const body =
    '{"active":true,"authType":"","balanceLeft":880000,"balanceUnit":"CREDITS","licenseType":"AIP","meta":null}';
  it("decodes the live wire shape and keeps balance separate from cycle limits", () => {
    assertSome(
      JunieAuthTestBodyJson.decodeOption(body),
      JunieAuthTestBody.make({
        active: O.some(true),
        authType: O.some(""),
        balanceLeft: O.some(880000),
        balanceUnit: O.some("CREDITS"),
        licenseType: O.some("AIP"),
        meta: O.none(),
      })
    );
    const outcome = junieUsageOutcome({ identity: O.some("synthetic@example.com"), status: 200, body });
    expect(outcome._tag).toBe("Ok");
    if (outcome._tag !== "Ok") return;
    assertSome(outcome.plan, "JetBrains AI Pro");
    expect(outcome.windows).toEqual([]);
    expect(outcome.credits[0]?.remaining).toBe(8.8);
    assertNone(outcome.credits[0]?.limit ?? O.some(0));
    const usage = AccountUsage.make({
      account: AccountRef.make({ provider: "junie", label: "synthetic", source: "synthetic" }),
      outcome,
    });
    expect(rankAccount(usage, DateTime.makeUnsafe(0)).availability).toBe("ready");
    expect(accountSection("junie")).toBe("junie");
  });
  it("retains last-good balances when JetBrains AI activity is absent or null", () => {
    const account = AccountRef.make({ provider: "junie", label: "synthetic", source: "synthetic" });
    const previous = [
      AccountUsage.make({ account, outcome: junieUsageOutcome({ identity: O.none(), status: 200, body }) }),
    ];
    for (const text of ["{}", '{"active":null,"balanceLeft":null}']) {
      const outcome = junieUsageOutcome({ identity: O.none(), status: 200, body: text });
      expect(outcome).toEqual(
        AccountUsageOutcome.cases.Failed.make({ detail: "JetBrains AI activity is unavailable" })
      );
      const retained = retainLastGood([AccountUsage.make({ account, outcome })], previous, DateTime.makeUnsafe(0))[0]
        ?.outcome;
      expect(retained).toMatchObject({ _tag: "Ok", credits: [{ remaining: 8.8 }] });
      if (retained?._tag === "Ok") assertSome(retained.asOf, DateTime.makeUnsafe(0));
    }
    expect(junieUsageOutcome({ identity: O.none(), status: 200, body: '{"active":false}' })._tag).toBe("NeedsLogin");
  });
  it("treats an HTTP 407 from auth/test as a Junie login rejection", () => {
    expect(junieUsageOutcome({ identity: O.none(), status: 407, body: "" })._tag).toBe("NeedsLogin");
  });
  it("uses Junie-specific instructions for a rejected auth/test", () => {
    expect(junieUsageOutcome({ identity: O.none(), status: 401, body: "" })).toEqual(
      AccountUsageOutcome.cases.NeedsLogin.make({
        detail: "JetBrains rejected the Junie login; run `junie` and sign in again",
      })
    );
  });
  it("retains last-good Junie balances for transient failures and clears inactive accounts", () => {
    const account = AccountRef.make({ provider: "junie", label: "synthetic", source: "synthetic" });
    const previous = [
      AccountUsage.make({ account, outcome: junieUsageOutcome({ identity: O.none(), status: 200, body }) }),
    ];
    for (const detail of ["JetBrains AI poll timed out", "JetBrains AI request is unavailable"]) {
      const next = [AccountUsage.make({ account, outcome: AccountUsageOutcome.cases.Failed.make({ detail }) })];
      const retained = retainLastGood(next, previous, DateTime.makeUnsafe(0))[0]?.outcome;
      expect(retained?._tag).toBe("Ok");
      if (retained?._tag === "Ok") assertSome(retained.asOf, DateTime.makeUnsafe(0));
    }
    const inactive = [
      AccountUsage.make({
        account,
        outcome: junieUsageOutcome({ identity: O.none(), status: 200, body: '{"active":false}' }),
      }),
    ];
    expect(retainLastGood(inactive, previous, DateTime.makeUnsafe(0))).toEqual(inactive);
  });
  it("ranks nonpositive balances unavailable without fabricating a window", () => {
    const outcome = junieUsageOutcome({
      identity: O.none(),
      status: 200,
      body: '{"active":true,"balanceLeft":0,"balanceUnit":"CREDITS","licenseType":"AIP"}',
    });
    expect(outcome._tag).toBe("Ok");
    expect(
      rankAccount(
        AccountUsage.make({
          account: AccountRef.make({ provider: "junie", label: "synthetic", source: "synthetic" }),
          outcome,
        }),
        DateTime.makeUnsafe(0)
      ).availability
    ).toBe("unavailable");
  });
  it("rejects unsupported credential envelopes", () => {
    assertNone(JunieStoredCredentialJson.decodeOption('{"simpleToken":"synthetic"}'));
    assertSome(
      JunieStoredCredentialJson.decodeOption(
        '{"jbAccount":{"access_token":"synthetic-access","refresh_token":"synthetic-refresh","expires_in":3600,"name":"Synthetic Name"}}'
      ),
      JunieStoredCredential.make({
        jbAccount: {
          access_token: Redacted.make("synthetic-access"),
          refresh_token: Redacted.make("synthetic-refresh"),
          expires_in: 3600,
          email: O.none(),
          name: O.some("Synthetic Name"),
          id_token: O.none(),
        },
      })
    );
  });
  it("keeps last-good balances for transient OAuth failures and clears definitive rejections", () => {
    const account = AccountRef.make({ provider: "junie", label: "synthetic", source: "synthetic" });
    const previous = [
      AccountUsage.make({ account, outcome: junieUsageOutcome({ identity: O.none(), status: 200, body }) }),
    ];
    for (const status of [503, 429, 403]) {
      const refresh = junieRefreshOutcome({ stored: Redacted.make("synthetic-stored"), status, body: "" });
      assertFailure(
        refresh,
        AccountUsageOutcome.cases.Failed.make({ detail: `JetBrains OAuth refresh answered HTTP ${status}` })
      );
      const retained = retainLastGood(
        [AccountUsage.make({ account, outcome: refresh.failure })],
        previous,
        DateTime.makeUnsafe(0)
      )[0]?.outcome;
      expect(retained).toMatchObject({ _tag: "Ok", credits: [{ remaining: 8.8 }] });
      if (retained?._tag === "Ok") assertSome(retained.asOf, DateTime.makeUnsafe(0));
    }
    for (const status of [400, 401]) {
      const refresh = junieRefreshOutcome({ stored: Redacted.make("synthetic-stored"), status, body: "" });
      assertFailure(
        refresh,
        AccountUsageOutcome.cases.NeedsLogin.make({
          detail: `JetBrains OAuth refresh answered HTTP ${status}; run \`junie\` and sign in again`,
        })
      );
      const next = [AccountUsage.make({ account, outcome: refresh.failure })];
      expect(retainLastGood(next, previous, DateTime.makeUnsafe(0))).toEqual(next);
    }
  });
  it("rejects rotated refresh tokens and accepts unchanged or omitted ones", () => {
    const stored = Redacted.make("synthetic-stored");
    const rotated = junieRefreshOutcome({
      stored,
      status: 200,
      body: '{"access_token":"synthetic-access","refresh_token":"synthetic-new","expires_in":3600}',
    });
    assertFailure(
      rotated,
      AccountUsageOutcome.cases.NeedsLogin.make({
        detail: "JetBrains rotated the refresh token; run `junie` and sign in again",
      })
    );
    for (const body of [
      '{"access_token":"synthetic-access","refresh_token":"synthetic-stored","expires_in":3600}',
      '{"access_token":"synthetic-access","expires_in":3600}',
    ]) {
      const decoded = JunieRefreshBodyJson.decodeOption(body);
      assertSome(
        decoded,
        JunieRefreshBody.make({
          access_token: Redacted.make("synthetic-access"),
          refresh_token: body.includes("refresh_token") ? O.some(stored) : O.none(),
          expires_in: 3600,
          id_token: O.none(),
        })
      );
      assertSuccess(junieRefreshOutcome({ stored, status: 200, body }), decoded.value);
    }
    assertFailure(
      junieRefreshOutcome({ stored, status: 401, body: "" }),
      AccountUsageOutcome.cases.NeedsLogin.make({
        detail: "JetBrains OAuth refresh answered HTTP 401; run `junie` and sign in again",
      })
    );
  });
});

class JunieRequests extends Context.Service<JunieRequests, Ref.Ref<ReadonlyArray<ReadonlyArray<string | undefined>>>>()(
  "@beep/repo-cli/test/accounts-usage.test/JunieRequests"
) {}

const junieTestLayer = (
  files: Readonly<Record<string, string>>,
  rotated: boolean,
  storedStatus = 401,
  freshStatus = 200,
  oauthStatus = 200,
  detailed = false,
  optionsBody = '{"aiAccessOptions":[{"type":"LICENSE","aiAccessEnabled":true,"code":"WS","licenseId":"synthetic-ws","validThrough":"2099-01-01"},{"type":"license","aiAccessEnabled":true,"code":"AIP","licenseId":"synthetic-aip","validThrough":"2099-01-01"}]}',
  quotaStatus = 200,
  audienceRotated = false,
  delayedDetailed = false,
  overrides: {
    readonly exchangeBody?: string;
    readonly quotaBody?: string;
    readonly status?: Readonly<Record<string, (call: number) => number>>;
    readonly quotaDelay?: Duration.Duration;
  } = {}
) => {
  const root = "/accounts-test";
  const requests = Layer.effect(JunieRequests, Ref.make<ReadonlyArray<ReadonlyArray<string | undefined>>>(A.empty()));
  const client = Layer.effect(
    HttpClient.HttpClient,
    Effect.gen(function* () {
      const seen = yield* JunieRequests;
      const calls = yield* Ref.make(HashMap.empty<string, number>());
      const oauthBody = (request: HttpClientRequest.HttpClientRequest) => {
        const switched =
          request.body._tag === "Uint8Array" &&
          Str.includes("switch_audience")(new TextDecoder().decode(request.body.body));
        if (rotated || (audienceRotated && switched))
          return '{"access_token":"synthetic-fresh","refresh_token":"synthetic-rotated","expires_in":3600}';
        return detailed
          ? '{"access_token":"synthetic-fresh","refresh_token":"synthetic-refresh","id_token":"synthetic-id","expires_in":3600}'
          : '{"access_token":"synthetic-fresh","refresh_token":"synthetic-refresh","expires_in":3600}';
      };
      const detailedBodies = HashMap.make(
        ["https://api.jetbrains.cloud/user-management/api/ai-access-options", optionsBody],
        [
          "https://api.jetbrains.ai/auth/jetbrains-jwt/provide-access/license/v2",
          overrides.exchangeBody ?? '{"token":"synthetic-grazie"}',
        ],
        [
          "https://api.jetbrains.ai/user/v5/quota/get",
          overrides.quotaBody ??
            '{"current":{"current":{"amount":120000},"maximum":{"amount":"1000000"},"tariffQuota":{"current":{"amount":"120000"},"maximum":{"amount":1000000},"available":{"amount":"880000"}},"topUpQuota":{"available":{"amount":"10000"}}}}',
        ],
        [
          "https://api.jetbrains.ai/user/v5/quota/metadata/refill",
          '{"current":{"tariff":{"amount":{"amount":"1000000"},"period":{"millis":2592000000}},"next":1792281600000}}',
        ]
      );
      const responseBody = (request: HttpClientRequest.HttpClientRequest) => {
        if (Str.includes("oauth2")(request.url)) return oauthBody(request);
        const body = detailed ? HashMap.get(detailedBodies, request.url) : O.none<string>();
        return O.getOrElse(body, () => '{"active":true,"balanceLeft":12,"balanceUnit":"CREDITS","licenseType":"AIP"}');
      };
      const responseStatus = (request: HttpClientRequest.HttpClientRequest, call: number) => {
        const overridden = A.findFirst(R.toEntries(overrides.status ?? {}), ([fragment]) =>
          Str.includes(fragment)(request.url)
        );
        if (O.isSome(overridden)) return overridden.value[1](call);
        if (Str.includes("quota/")(request.url)) return quotaStatus;
        if (Str.includes("oauth2")(request.url)) return oauthStatus;
        if (
          Str.includes("provide-access")(request.url) &&
          request.body._tag === "Uint8Array" &&
          !Str.includes("synthetic-aip")(new TextDecoder().decode(request.body.body))
        )
          return 403;
        return request.headers.authorization === "Bearer synthetic-old" ? storedStatus : freshStatus;
      };
      return HttpClient.make((request) => {
        const reply = Effect.gen(function* () {
          yield* Ref.update(
            seen,
            A.append([
              request.method,
              request.url,
              request.headers.authorization,
              request.headers["x-accept-eap-license"],
              request.headers["x-accept-release-license"],
            ])
          );
          const call = yield* Ref.modify(calls, (counts) => {
            const next = O.getOrElse(HashMap.get(counts, request.url), () => 0) + 1;
            return [next, HashMap.set(counts, request.url, next)] as const;
          });
          return respond(request, responseBody(request), responseStatus(request, call));
        });
        if (overrides.quotaDelay !== undefined && Str.includes("quota/")(request.url))
          return reply.pipe(Effect.delay(overrides.quotaDelay));
        const delay = Str.includes("quota/")(request.url)
          ? Duration.seconds(30)
          : request.headers.authorization === "Bearer synthetic-fresh"
            ? Duration.seconds(13)
            : Duration.zero;
        return delayedDetailed ? reply.pipe(Effect.delay(delay)) : reply;
      });
    })
  ).pipe(Layer.provide(requests));
  const filesystem = MemoryFileSystem.layer.pipe(
    Layer.tap((context) =>
      Effect.gen(function* () {
        const fs = Context.get(context, FileSystem.FileSystem);
        const path = yield* Path.Path;
        yield* fs.makeDirectory(`${root}/snapshots`, { recursive: true });
        yield* Effect.forEach(
          R.toEntries(files),
          ([name, content]) =>
            fs
              .makeDirectory(path.dirname(`${root}/${name}`), { recursive: true })
              .pipe(Effect.andThen(fs.writeFileString(`${root}/${name}`, content))),
          { discard: true }
        );
      })
    ),
    Layer.provide(Path.layer)
  );
  const services = Layer.mergeAll(
    filesystem,
    Path.layer,
    client,
    Layer.succeed(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnv({
        env: {
          HOME: root,
          BEEP_ACCOUNTS_AUTH_DIR: root,
          BEEP_ACCOUNTS_SNAPSHOT_DIR: `${root}/snapshots`,
        },
      })
    ),
    Layer.succeed(
      Crypto.Crypto,
      Crypto.make({ randomBytes: (size) => new Uint8Array(size), digest: (_algorithm, data) => Effect.succeed(data) })
    ),
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, {
      ...ChildProcessSpawner.make(() => Effect.die("Unexpected process spawn")),
      string: Effect.fnUntraced(function* () {
        return "";
      }),
    })
  );
  return layerAccountsUsageLive.pipe(Layer.provideMerge(services), Layer.provideMerge(requests));
};

describe("Junie fallback poller", () => {
  const credential = {
    ".junie/secure_credentials.json":
      '{"jb-account-stored":{"jbAccount":{"access_token":"synthetic-old","refresh_token":"synthetic-refresh","expires_in":3600,"name":"Synthetic Name"}}}',
  };
  it.layer(junieTestLayer(credential, false), { timeout: "30 seconds" })("unchanged refresh", (it) => {
    it.effect(
      "refreshes once on stored-token rejection, reuses the cache within expiry, and sends balance headers",
      () =>
        Effect.gen(function* () {
          const seen = yield* JunieRequests;
          const rows = yield* pollAccounts;
          expect(rows[0]?.outcome).toMatchObject({ _tag: "Ok" });
          expect(A.map(rows, (row) => [row.account.provider, row.account.label, row.outcome._tag])).toEqual([
            ["junie", "Synthetic Name", "Ok"],
          ]);
          expect(yield* Ref.get(seen)).toEqual([
            ["GET", "https://ingrazzio-cloud-prod.labs.jb.gg/auth/test", "Bearer synthetic-old", "true", "true"],
            ["POST", "https://oauth.account.jetbrains.com/oauth2/token", undefined, undefined, undefined],
            ["GET", "https://ingrazzio-cloud-prod.labs.jb.gg/auth/test", "Bearer synthetic-fresh", "true", "true"],
          ]);
          yield* Ref.set(seen, []);
          yield* pollAccounts;
          expect(yield* Ref.get(seen)).toEqual([
            ["GET", "https://ingrazzio-cloud-prod.labs.jb.gg/auth/test", "Bearer synthetic-fresh", "true", "true"],
          ]);
        })
    );
  });
  it.layer(junieTestLayer(credential, false), { timeout: "30 seconds" })("removed credentials", (it) => {
    it.effect(
      "reports credentials removed between discovery and polling without making requests",
      Effect.fnUntraced(function* () {
        const usage = yield* AccountsUsage;
        const accounts = yield* usage.accounts;
        const discovered = A.head(accounts).pipe(O.getOrThrow);
        expect(discovered.provider).toBe("junie");
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove("/accounts-test/.junie/secure_credentials.json");

        const row = yield* usage.poll(discovered);
        expect(row.outcome).toEqual(
          AccountUsageOutcome.cases.Failed.make({ detail: "Junie credential storage is unavailable" })
        );
        expect(yield* Ref.get(yield* JunieRequests)).toEqual([]);
      })
    );
  });
  it.layer(junieTestLayer(credential, false), { timeout: "30 seconds" })("expired cached access", (it) => {
    it.effect(
      "refreshes again after the cached access token expires",
      Effect.fnUntraced(function* () {
        const seen = yield* JunieRequests;
        const first = yield* pollAccounts;
        expect(first[0]?.outcome._tag).toBe("Ok");
        yield* Ref.set(seen, []);
        yield* TestClock.adjust("3600 seconds");

        const second = yield* pollAccounts;
        expect(second[0]?.outcome._tag).toBe("Ok");
        expect(yield* Ref.get(seen)).toEqual([
          ["GET", "https://ingrazzio-cloud-prod.labs.jb.gg/auth/test", "Bearer synthetic-old", "true", "true"],
          ["POST", "https://oauth.account.jetbrains.com/oauth2/token", undefined, undefined, undefined],
          ["GET", "https://ingrazzio-cloud-prod.labs.jb.gg/auth/test", "Bearer synthetic-fresh", "true", "true"],
        ]);
      })
    );
  });
  it.layer(junieTestLayer(credential, false), { timeout: "30 seconds" })("changed stored credential", (it) => {
    it.effect("drops the cached access token when the stored refresh credential changes", () =>
      Effect.gen(function* () {
        const seen = yield* JunieRequests;
        const fs = yield* FileSystem.FileSystem;
        const first = yield* pollAccounts;
        expect(first[0]?.outcome._tag).toBe("Ok");
        yield* fs.writeFileString(
          "/accounts-test/.junie/secure_credentials.json",
          '{"jb-account-stored":{"jbAccount":{"access_token":"synthetic-new-login","refresh_token":"synthetic-new-refresh","expires_in":3600,"name":"New Synthetic Name"}}}'
        );
        yield* Ref.set(seen, []);
        const second = yield* pollAccounts;
        expect(second[0]?.account.label).toBe("New Synthetic Name");
        expect(second[0]?.outcome._tag).toBe("Ok");
        expect(yield* Ref.get(seen)).toEqual([
          ["GET", "https://ingrazzio-cloud-prod.labs.jb.gg/auth/test", "Bearer synthetic-new-login", "true", "true"],
        ]);
      })
    );
  });
  it.layer(junieTestLayer(credential, false, 200), { timeout: "30 seconds" })("stored access", (it) => {
    it.effect("uses a valid stored access token without an OAuth request", () =>
      Effect.gen(function* () {
        const seen = yield* JunieRequests;
        const rows = yield* pollAccounts;
        expect(rows[0]?.outcome._tag).toBe("Ok");
        expect(A.map(yield* Ref.get(seen), (request) => request[0])).toEqual(["GET"]);
      })
    );
  });
  it.layer(junieTestLayer(credential, false, 401, 401), { timeout: "30 seconds" })("rejected fresh access", (it) => {
    it.effect("reports a Junie login rejection after exactly one refresh", () =>
      Effect.gen(function* () {
        const seen = yield* JunieRequests;
        const rows = yield* pollAccounts;
        expect(rows[0]?.outcome).toMatchObject({
          _tag: "NeedsLogin",
          detail: "JetBrains rejected the Junie login; run `junie` and sign in again",
        });
        expect(A.map(yield* Ref.get(seen), (request) => request[0])).toEqual(["GET", "POST", "GET"]);
      })
    );
  });
  it.layer(junieTestLayer(credential, false, 407), { timeout: "30 seconds" })("expired stored access", (it) => {
    it.effect("refreshes once when JetBrains answers the stale stored token with HTTP 407", () =>
      Effect.gen(function* () {
        const seen = yield* JunieRequests;
        const rows = yield* pollAccounts;
        expect(rows[0]?.outcome).toMatchObject({ _tag: "Ok" });
        expect(A.map(yield* Ref.get(seen), (request) => request[0])).toEqual(["GET", "POST", "GET"]);
      })
    );
  });
  it.layer(junieTestLayer(credential, false, 401, 200, 400), { timeout: "30 seconds" })("invalid grant", (it) => {
    it.effect("reports an invalid OAuth grant as NeedsLogin before requesting a refreshed balance", () =>
      Effect.gen(function* () {
        const seen = yield* JunieRequests;
        const rows = yield* pollAccounts;
        expect(rows[0]?.outcome).toMatchObject({ _tag: "NeedsLogin", detail: expect.stringContaining("HTTP 400") });
        expect(A.map(yield* Ref.get(seen), (request) => request[0])).toEqual(["GET", "POST"]);
      })
    );
  });
  it.layer(junieTestLayer(credential, true), { timeout: "30 seconds" })("rotated refresh", (it) => {
    it.effect("does not request a balance after refresh token rotation", () =>
      Effect.gen(function* () {
        const requests = yield* JunieRequests;
        const rows = yield* pollAccounts;
        expect(A.map(yield* Ref.get(requests), (request) => request[0])).toEqual(["GET", "POST"]);
        expect(rows[0]?.outcome).toMatchObject({
          _tag: "NeedsLogin",
          detail: expect.stringContaining("rotated the refresh token"),
        });
        const previous = A.map(rows, (row) =>
          AccountUsage.make({
            account: row.account,
            outcome: junieUsageOutcome({
              identity: O.none(),
              status: 200,
              body: '{"active":true,"balanceLeft":12,"balanceUnit":"CREDITS","licenseType":"AIP"}',
            }),
          })
        );
        expect(retainLastGood(rows, previous, DateTime.makeUnsafe(0))).toEqual(rows);
      })
    );
  });
  it.layer(
    junieTestLayer(
      {
        ".junie/secure_credentials.json": '{"jb-account-stored":{"enterpriseAccount":{}}}',
        "claude-me.json": authFiles["claude-me.json"],
      },
      false
    ),
    { timeout: "30 seconds" }
  )("unsupported credentials", (it) => {
    it.effect("shows unsupported credentials without failing other accounts", () =>
      Effect.gen(function* () {
        const rows = yield* pollAccounts;
        expect(A.map(rows, (row) => [row.account.provider, row.outcome._tag])).toEqual([
          ["claude", "Ok"],
          ["junie", "Failed"],
        ]);
      })
    );
  });
});

describe("Junie detailed cycle quota", () => {
  it.effect.prop(
    "round trips detailed Junie wire schemas",
    [
      Arbitrary.schema(JunieAccessOptionsBody),
      Arbitrary.schema(JunieExchangeBody),
      Arbitrary.schema(JunieQuotaBody),
      Arbitrary.schema(JunieRefillBody),
    ],
    Effect.fnUntraced(function* ([options, exchange, quota, refill]) {
      assertTrue(
        S.toEquivalence(JunieAccessOptionsBody)(
          options,
          yield* S.decodeEffect(JunieAccessOptionsBody)(yield* S.encodeEffect(JunieAccessOptionsBody)(options))
        )
      );
      assertTrue(
        S.toEquivalence(JunieExchangeBody)(
          exchange,
          yield* S.decodeEffect(JunieExchangeBody)(yield* S.encodeEffect(JunieExchangeBody)(exchange))
        )
      );
      assertTrue(
        S.toEquivalence(JunieQuotaBody)(
          quota,
          yield* S.decodeEffect(JunieQuotaBody)(yield* S.encodeEffect(JunieQuotaBody)(quota))
        )
      );
      assertTrue(
        S.toEquivalence(JunieRefillBody)(
          refill,
          yield* S.decodeEffect(JunieRefillBody)(yield* S.encodeEffect(JunieRefillBody)(refill))
        )
      );
    }),
    { arbitrary: fcRuns(24) }
  );
  const credential = {
    ".junie/secure_credentials.json":
      '{"jb-account-stored":{"jbAccount":{"access_token":"synthetic-old","refresh_token":"synthetic-refresh","expires_in":3600,"name":"Synthetic Name"}}}',
  };
  it.layer(junieTestLayer(credential, false, 401, 200, 200, true), { timeout: "30 seconds" })(
    "licenseType selection and cache",
    (it) => {
      it.effect(
        "selects AIP among WS+AIP, returns 12% and a reset, and exchanges once across two polls",
        Effect.fnUntraced(function* () {
          const rows = yield* pollAccounts;
          const row = A.head(rows);
          row.pipe(O.isSome, assertTrue);
          if (O.isNone(row)) return;
          const outcome = row.value.outcome;
          assertTrue(outcome._tag === "Ok");
          if (outcome._tag !== "Ok") return;
          assertSome(
            A.head(outcome.windows),
            UsageWindow.make({
              kind: "cycle",
              scope: O.none(),
              usedPercent: 12,
              resetsAt: O.some(DateTime.makeUnsafe("2026-10-18T00:00:00Z")),
            })
          );
          assertTrue(
            Equal.equals(
              A.map(outcome.credits, (credit) => credit.remaining),
              [8.8, 0.1]
            )
          );
          assertSome(
            O.flatMap(A.head(outcome.credits), (credit) => credit.limit),
            10
          );
          const rank = rankAccount(row.value, DateTime.makeUnsafe("2026-10-17T00:00:00Z"));
          assertSome(rank.weeklyRemainingPercent, 88);
          assertSome(rank.hoursUntilWeeklyReset, 24);
          yield* pollAccounts;
          const seen = yield* Ref.get(yield* JunieRequests);
          assertTrue(A.filter(seen, (request) => request[1]?.includes("provide-access") ?? false).length === 1);
          assertTrue(A.filter(seen, (request) => request[1]?.includes("oauth2") ?? false).length === 2);
          assertTrue(A.filter(seen, (request) => request[1]?.includes("quota/get") ?? false).length === 2);
          assertTrue(
            A.some(
              seen,
              (request) => request[1]?.includes("provide-access") === true && request[2] === "Bearer synthetic-id"
            )
          );
        })
      );
    }
  );
  it.layer(
    junieTestLayer(credential, false, 401, 200, 200, true, undefined, 200, false, false, {
      exchangeBody: `{"token":"synthetic.${Base64Url.encode('{"exp":120}')}.signature"}`,
    }),
    { timeout: "30 seconds" }
  )("exchange token expiry", (it) => {
    it.effect(
      "renews the exchange token at its JWT expiry while preserving cycle usage",
      Effect.fnUntraced(function* () {
        yield* TestClock.setTime(0);
        const first = A.head(yield* pollAccounts).pipe(O.getOrThrow);
        expect(first.outcome).toMatchObject({ _tag: "Ok", windows: [{ kind: "cycle", usedPercent: 12 }] });
        const seen = yield* JunieRequests;
        yield* Ref.set(seen, []);
        yield* TestClock.adjust("121 seconds");

        const second = A.head(yield* pollAccounts).pipe(O.getOrThrow);
        expect(second.outcome).toMatchObject({ _tag: "Ok", windows: [{ kind: "cycle", usedPercent: 12 }] });
        expect(
          A.filter(yield* Ref.get(seen), (request) => Str.includes("provide-access")(request[1] ?? ""))
        ).toHaveLength(1);
      })
    );
  });
  it.layer(junieTestLayer(credential, false, 401, 200, 200, true, undefined, 200, false, true), {
    timeout: "30 seconds",
  })("overall timeout", (it) => {
    it.effect(
      "preserves an accepted balance when the poll deadline interrupts cycle enrichment",
      Effect.fnUntraced(function* () {
        yield* TestClock.setTime(0);
        const poll = yield* Effect.forkChild(pollAccounts);
        yield* Duration.seconds(13).pipe(Duration.toMillis, TestClock.setTime);
        yield* Duration.seconds(20).pipe(Duration.toMillis, TestClock.setTime);
        const outcome = (yield* Fiber.join(poll))[0]?.outcome;
        assertTrue(outcome?._tag === "Ok");
        if (outcome?._tag !== "Ok") return;
        assertTrue(outcome.windows.length === 0);
        assertTrue(
          Equal.equals(
            A.map(outcome.credits, (credit) => credit.remaining),
            [0.00012]
          )
        );
      })
    );
  });
  for (const [name, options, status, rotate] of [
    [
      "ambiguous licenses",
      '{"aiAccessOptions":[{"type":"license","aiAccessEnabled":true,"licenseId":"synthetic-a"},{"type":"license","aiAccessEnabled":true,"licenseId":"synthetic-b"}]}',
      200,
      false,
    ],
    ["no licenses", '{"aiAccessOptions":[]}', 200, false],
    ["quota 404", undefined, 404, false],
    ["quota 500", undefined, 500, false],
  ] as const) {
    it.layer(junieTestLayer(credential, false, 401, 200, 200, true, options, status, rotate), {
      timeout: "30 seconds",
    })(name, (it) => {
      it.effect(
        "keeps the balance-only row",
        Effect.fnUntraced(function* () {
          const outcome = (yield* pollAccounts)[0]?.outcome;
          assertTrue(outcome?._tag === "Ok");
          if (outcome?._tag !== "Ok") return;
          assertTrue(outcome.windows.length === 0);
          assertTrue(outcome.credits[0]?.remaining === 0.00012);
        })
      );
    });
  }

  const detailedLayer = (overrides: Parameters<typeof junieTestLayer>[10], audienceRotated = false) =>
    junieTestLayer(credential, false, 401, 200, 200, true, undefined, 200, audienceRotated, false, overrides);
  const countOf = Effect.fnUntraced(function* (fragment: string) {
    const seen = yield* Ref.get(yield* JunieRequests);
    return A.filter(seen, (request) => request[1]?.includes(fragment) ?? false).length;
  });
  const okOutcome = Effect.fnUntraced(function* () {
    const outcome = (yield* pollAccounts)[0]?.outcome;
    assertTrue(outcome?._tag === "Ok");
    return outcome?._tag === "Ok" ? O.some(outcome) : O.none();
  });

  it.layer(detailedLayer({}, true), { timeout: "30 seconds" })("audience rotation", (it) => {
    it.effect(
      "reports a switch_audience rotation as NeedsLogin and never retries the grant for that credential",
      Effect.fnUntraced(function* () {
        const expected = AccountUsageOutcome.cases.NeedsLogin.make({
          detail: "JetBrains rotated the refresh token during cycle lookup; run `junie` and sign in again",
        });
        assertSome(A.head(yield* pollAccounts).pipe(O.map((row) => row.outcome)), expected);
        assertTrue((yield* countOf("oauth2")) === 2);
        assertTrue((yield* countOf("ai-access-options")) === 0);
        assertSome(A.head(yield* pollAccounts).pipe(O.map((row) => row.outcome)), expected);
        assertTrue((yield* countOf("oauth2")) === 2);
        const seen = yield* Ref.get(yield* JunieRequests);
        assertTrue(!A.some(seen, (request) => request[2] === "Bearer synthetic-rotated"));
      })
    );
  });

  it.layer(detailedLayer({}), { timeout: "30 seconds" })("licence cache", (it) => {
    it.effect(
      "re-mints an expired Grazie token through provide-access alone, reusing the cached licence",
      Effect.fnUntraced(function* () {
        yield* TestClock.setTime(0);
        yield* okOutcome();
        yield* Duration.minutes(11).pipe(Duration.toMillis, TestClock.setTime);
        const second = yield* okOutcome();
        assertTrue(O.exists(second, (outcome) => outcome.windows.length === 1));
        assertTrue((yield* countOf("provide-access")) === 2);
        assertTrue((yield* countOf("ai-access-options")) === 1);
        assertTrue((yield* countOf("oauth2")) === 2);
      })
    );
  });

  it.layer(detailedLayer({ status: { "provide-access": (call) => (call === 2 ? 403 : 200) } }), {
    timeout: "30 seconds",
  })("licence cache invalidation", (it) => {
    it.effect(
      "drops the cached licence only after provide-access answers 4xx",
      Effect.fnUntraced(function* () {
        yield* TestClock.setTime(0);
        yield* okOutcome();
        yield* Duration.minutes(11).pipe(Duration.toMillis, TestClock.setTime);
        const rejected = yield* okOutcome();
        assertTrue(O.exists(rejected, (outcome) => outcome.windows.length === 0));
        assertTrue((yield* countOf("ai-access-options")) === 1);
        const recovered = yield* okOutcome();
        assertTrue(O.exists(recovered, (outcome) => outcome.windows.length === 1));
        assertTrue((yield* countOf("ai-access-options")) === 2);
        assertTrue((yield* countOf("provide-access")) === 3);
      })
    );
  });

  it.layer(detailedLayer({ status: { "quota/get": (call) => (call === 1 ? 407 : 200) } }), { timeout: "30 seconds" })(
    "quota token rejection",
    (it) => {
      it.effect(
        "drops a Grazie token that quota/get rejects and re-mints once in the same poll",
        Effect.fnUntraced(function* () {
          const outcome = yield* okOutcome();
          assertTrue(O.exists(outcome, (value) => value.windows[0]?.usedPercent === 12));
          assertTrue((yield* countOf("provide-access")) === 2);
          assertTrue((yield* countOf("quota/get")) === 2);
          assertTrue((yield* countOf("ai-access-options")) === 1);
        })
      );
    }
  );

  it.layer(
    detailedLayer({
      status: { "quota/metadata/refill": () => 500 },
      quotaBody:
        '{"current":{"until":1792195200000,"tariffQuota":{"current":{"amount":"120000"},"maximum":{"amount":1000000},"available":{"amount":"880000"}}}}',
    }),
    { timeout: "30 seconds" }
  )("refill failure with until", (it) => {
    it.effect(
      "keeps the quota reply when refill fails and resets at quota.current.until",
      Effect.fnUntraced(function* () {
        const outcome = yield* okOutcome();
        assertSome(
          O.flatMap(outcome, (value) => A.head(value.windows)),
          UsageWindow.make({
            kind: "cycle",
            scope: O.none(),
            usedPercent: 12,
            resetsAt: O.some(DateTime.makeUnsafe("2026-10-17T00:00:00Z")),
          })
        );
        assertTrue(O.exists(outcome, (value) => value.credits[0]?.remaining === 8.8));
      })
    );
  });

  it.layer(detailedLayer({ status: { "quota/metadata/refill": () => 500 } }), { timeout: "30 seconds" })(
    "refill failure without until",
    (it) => {
      it.effect(
        "keeps the cycle window without a reset when neither refill nor until is available",
        Effect.fnUntraced(function* () {
          const outcome = yield* okOutcome();
          assertSome(
            O.flatMap(outcome, (value) => A.head(value.windows)),
            UsageWindow.make({ kind: "cycle", scope: O.none(), usedPercent: 12, resetsAt: O.none() })
          );
        })
      );
    }
  );

  it.layer(
    detailedLayer({
      quotaBody:
        '{"current":{"tariffQuota":{"current":{"amount":"120000"},"maximum":{"amount":1000000}},"topUpQuota":{"available":{"amount":"10000"}}}}',
    }),
    { timeout: "30 seconds" }
  )("partial tariff", (it) => {
    it.effect(
      "keeps the original balance credit when tariffQuota.available is absent",
      Effect.fnUntraced(function* () {
        const outcome = yield* okOutcome();
        assertSome(
          O.map(outcome, (value) => value.credits),
          [
            CreditBalance.make({
              label: "JetBrains AI balance",
              unit: "credits",
              remaining: 0.00012,
              limit: O.none(),
              expiresAt: O.none(),
            }),
          ]
        );
        assertTrue(O.exists(outcome, (value) => value.windows[0]?.usedPercent === 12));
      })
    );
  });

  it("rejects empty, whitespace, hex, and exponent amount strings but accepts plain decimals", () => {
    const quota = (amount: string) => JunieQuotaBodyJson.decodeOption(`{"current":{"current":{"amount":"${amount}"}}}`);
    for (const amount of ["", "  ", "0x10", "1e5", "12abc"]) assertNone(quota(amount));
    for (const [amount, value] of [
      ["880000.5", 880000.5],
      ["-3", -3],
      ["0", 0],
    ] as const) {
      assertTrue(O.exists(quota(amount), (body) => O.exists(body.current.current, (pool) => pool.amount === value)));
    }
  });

  it.layer(
    detailedLayer({
      exchangeBody: `{"token":"synthetic-header.${Base64Url.encode('{"exp":300}')}.synthetic-signature"}`,
    }),
    { timeout: "30 seconds" }
  )("Grazie token skew", (it) => {
    it.effect(
      "re-mints the Grazie token 60 seconds before its JWT exp",
      Effect.fnUntraced(function* () {
        yield* TestClock.setTime(0);
        yield* okOutcome();
        yield* Duration.seconds(230).pipe(Duration.toMillis, TestClock.setTime);
        yield* okOutcome();
        assertTrue((yield* countOf("provide-access")) === 1);
        yield* Duration.seconds(250).pipe(Duration.toMillis, TestClock.setTime);
        yield* okOutcome();
        assertTrue((yield* countOf("provide-access")) === 2);
      })
    );
  });

  it.layer(detailedLayer({ quotaDelay: Duration.seconds(5) }), { timeout: "30 seconds" })(
    "concurrent quota calls",
    (it) => {
      it.effect(
        "runs quota/get and refill concurrently inside the 8 second detail budget",
        Effect.fnUntraced(function* () {
          yield* TestClock.setTime(0);
          const poll = yield* Effect.forkChild(pollAccounts);
          yield* Duration.seconds(9).pipe(Duration.toMillis, TestClock.setTime);
          const outcome = (yield* Fiber.join(poll))[0]?.outcome;
          assertTrue(outcome?._tag === "Ok");
          if (outcome?._tag !== "Ok") return;
          assertTrue(outcome.windows[0]?.usedPercent === 12);
          assertSome(
            O.flatMap(A.head(outcome.windows), (window) => window.resetsAt),
            DateTime.makeUnsafe("2026-10-18T00:00:00Z")
          );
        })
      );
    }
  );
});
