import { accountsCommand } from "@beep/repo-cli";
import {
  AccountRef,
  AccountsUsage,
  AccountUsage,
  AccountUsageOutcome,
  ClaudeUsageBodyJson,
  CodexUsageBodyJson,
  claudeUsageOutcome,
  claudeUsageWindows,
  codexUsageOutcome,
  codexUsageWindows,
  layerAccountsUsageLive,
  pollAccounts,
  rankAccounts,
  renderAccountsStatus,
  renderHours,
  UsageWindow,
} from "@beep/repo-cli/test/Accounts";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { ConfigProvider, DateTime, Effect, FileSystem, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as O from "effect/Option";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";

const now = DateTime.makeUnsafe("2026-01-05T00:00:00.000Z");
const inHours = (hours: number) => O.some(DateTime.makeUnsafe(DateTime.toEpochMillis(now) + hours * 3_600_000));

const account = (label: string, provider: "claude" | "codex" = "claude") =>
  AccountRef.make({ provider, label, source: `/auth/${provider}-${label}.json` });

const weekly = (usedPercent: number, resetsAt: O.Option<DateTime.Utc>) =>
  UsageWindow.make({ kind: "weekly", scope: O.none(), usedPercent, resetsAt });
const session = (usedPercent: number) =>
  UsageWindow.make({ kind: "session", scope: O.none(), usedPercent, resetsAt: inHours(2) });

const ok = (label: string, windows: ReadonlyArray<UsageWindow>) =>
  AccountUsage.make({
    account: account(label),
    outcome: AccountUsageOutcome.cases.Ok.make({ identity: O.some(label), plan: O.none(), windows }),
  });

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
});

describe("account report rendering", () => {
  it("renders spans in their two largest units", () => {
    expect(A.map([136.5, 3.25, 0, 24], renderHours)).toEqual(["5d 16h", "3h 15m", "0h 0m", "1d 0h"]);
  });

  it("names the account to use first and lists every account", () => {
    const rows = rankAccounts(
      [
        ok("me@example.com", [
          session(42),
          weekly(86, inHours(136.5)),
          UsageWindow.make({ kind: "weekly-scoped", scope: O.some("Fable"), usedPercent: 98, resetsAt: O.none() }),
        ]),
        AccountUsage.make({
          account: account("work", "codex"),
          outcome: AccountUsageOutcome.cases.Failed.make({ detail: "offline" }),
        }),
      ],
      now
    );
    expect(renderAccountsStatus(rows)).toBe(
      A.join(
        [
          "[accounts] use first: claude me@example.com",
          "  1. claude me@example.com: ready · weekly 14% left, resets in 5d 16h · session 42% · Fable 98%",
          "  2. codex work: unreadable (offline)",
        ],
        "\n"
      )
    );
  });

  it("says so when nothing is ready or nothing is registered", () => {
    expect(renderAccountsStatus([])).toBe("[accounts] the proxy holds no Claude or Codex login");
    assertSome(
      A.head(renderAccountsStatus(rankAccounts([ok("spent", [weekly(100, inHours(1))])], now)).split("\n")),
      "[accounts] no account is ready right now"
    );
  });
});

const respond = (request: HttpClientRequest.HttpClientRequest, body: string, status = 200) =>
  HttpClientResponse.fromWeb(request, new Response(body, { status }));

const runLive = <A, E>(
  files: Readonly<Record<string, string>>,
  client: HttpClient.HttpClient,
  program: Effect.Effect<A, E, AccountsUsage>
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "accounts-usage-test-" });
    yield* Effect.forEach(
      Object.entries(files),
      ([name, content]) => fs.writeFileString(path.join(root, name), content),
      {
        discard: true,
      }
    );
    return yield* program.pipe(
      Effect.provide(layerAccountsUsageLive),
      Effect.provideService(HttpClient.HttpClient, client),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({ env: { BEEP_ACCOUNTS_AUTH_DIR: root, HOME: root } })
      )
    );
  }).pipe(Effect.provide(NodeServices.layer));

const authFiles = {
  "claude-me.json": `{"type":"claude","email":"me@example.com","access_token":"claude-token","disabled":false}`,
  "codex-work.json": `{"type":"codex","email":"work@example.com","access_token":"codex-token","account_id":"acct-1"}`,
  "claude-off.json": `{"type":"claude","email":"off@example.com","access_token":"off-token","disabled":true}`,
  "xai-me.json": `{"type":"xai","email":"me@example.com","access_token":"xai-token"}`,
  "config.yaml": "port: 8317",
  "broken.json": "{",
};

describe("live account poller", () => {
  it.effect("lists enabled Claude and Codex logins and polls each with its own token", () =>
    Effect.gen(function* () {
      const seen = yield* Ref.make(A.empty<ReadonlyArray<string | undefined>>());
      const client = HttpClient.make((request) =>
        Ref.update(
          seen,
          A.append([
            request.url,
            request.headers.authorization,
            request.headers["anthropic-beta"],
            request.headers["chatgpt-account-id"],
          ])
        ).pipe(Effect.as(respond(request, request.url.includes("anthropic") ? claudeBody : codexBody)))
      );
      const usages = yield* runLive(authFiles, client, pollAccounts);
      expect(A.map(usages, (usage) => [usage.account.provider, usage.account.label, usage.outcome._tag])).toEqual([
        ["claude", "me@example.com", "Ok"],
        ["codex", "work@example.com", "Ok"],
      ]);
      expect(A.sort(yield* Ref.get(seen), (left, right) => (String(left[0]) < String(right[0]) ? -1 : 1))).toEqual([
        ["https://api.anthropic.com/api/oauth/usage", "Bearer claude-token", "oauth-2025-04-20", undefined],
        ["https://chatgpt.com/backend-api/wham/usage", "Bearer codex-token", undefined, "acct-1"],
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

describe("accounts command", () => {
  it("registers the status subcommand", () => {
    expect(accountsCommand.name).toBe("accounts");
    expect(A.flatMap(accountsCommand.subcommands, (group) => A.map(group.commands, (command) => command.name))).toEqual(
      ["status"]
    );
  });
});
