import { fcRuns } from "@beep/fc-runs";
import {
  MEMBER_REFRESH_DETAIL_MAX_CHARS,
  MemberRefreshOutcome,
  MemberRefreshReport,
  ReferenceMember,
  ReferenceWorkspaceManifest,
  RefsRefreshStatus,
} from "@beep/repo-cli/commands/Refs";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { testPlatform } from "./refs-test-utils.ts";

const ReportJson = S.fromJsonString(MemberRefreshReport);
const encodeReport = S.encodeEffect(ReportJson);
const decodeReport = S.decodeEffect(ReportJson);
const decodeReportUnknown = S.decodeUnknownEffect(MemberRefreshReport);
const reportEquivalent = S.toEquivalence(MemberRefreshReport);
const decodeStatusUnknown = S.decodeUnknownEffect(RefsRefreshStatus);

describe("reference manifest schemas", () => {
  it.effect(
    "decodes the canonical reference manifest",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const file = yield* path.fromFileUrl(new URL("../../../../../scripts/references.json", import.meta.url));
      const manifest = yield* ReferenceWorkspaceManifest.decodeJson(yield* fs.readFileString(file));
      expect(manifest.rootDefault).toBe("$HOME/YeeBois/references/effect");
      expect(A.map(manifest.members, (member) => member.name)).toEqual([
        "effect",
        "effect-tsgo",
        "ai-plugin-marketplace-manager",
        "okfit",
        "tsdoctor",
        "effected",
        "pluginfinity",
        "vitest-agent",
        "t3code",
        "opencode",
        "alchemy",
      ]);
      assertSome(
        A.findFirst(manifest.members, (member) => member.name === "opencode").pipe(O.map((member) => member.branch)),
        "v2"
      );
      expect(manifest.members[0]?.branch).toBe("main");
    }, testPlatform)
  );
  it.effect(
    "defaults omitted branches to main and retains explicit branches",
    Effect.fnUntraced(function* () {
      const member = { name: "opencode", url: "upstream" };
      expect((yield* ReferenceMember.decode(member)).branch).toBe("main");
      expect((yield* ReferenceMember.decode({ ...member, branch: "v2" })).branch).toBe("v2");
      expect((yield* ReferenceMember.decode({ ...member, branch: "release/v2" })).branch).toBe("release/v2");
    })
  );
  const invalidMembers: ReadonlyArray<readonly [label: string, extra: Record<string, unknown>]> = [
    ["branch", { branch: "--upload-pack=evil" }],
    ["empty branch", { branch: "" }],
    ["branch traversal", { branch: "../v2" }],
    ["branch control", { branch: "v2\nmain" }],
    ["unknown key", { revision: "v2" }],
    ["retired tier", { tier: "deep" }],
    ["retired onlyDir", { onlyDir: ["src"] }],
    ["name", { name: "../escape" }],
  ];
  for (const [label, extra] of invalidMembers) {
    it.effect(
      `rejects invalid member ${label}`,
      Effect.fnUntraced(function* () {
        const input: unknown = { name: "effect", url: "upstream", ...extra };
        const result = yield* ReferenceMember.decode(input).pipe(Effect.result);
        expect(result._tag).toBe("Failure");
      })
    );
  }

  it("keeps only the pull outcomes", () => {
    expect(MemberRefreshOutcome.literals).toEqual([
      "pulled",
      "unchanged",
      "skipped-dirty",
      "skipped-off-branch",
      "pull-failed",
    ]);
  });

  it.effect(
    "decodes v2 receipts and rejects v1 receipts and retired fields",
    Effect.fnUntraced(function* () {
      const base = {
        schemaVersion: "beep-refs-refresh/v2",
        timestamp: "2026-10-28T08:30:00.000Z",
        root: "/refs",
        members: [{ name: "effect", outcome: "pulled" }],
      };
      const decoded = yield* decodeStatusUnknown(base);
      expect(A.map(decoded.members, (member) => member.outcome)).toEqual(["pulled"]);
      const retired: ReadonlyArray<unknown> = [
        { ...base, schemaVersion: "beep-refs-refresh/v1" },
        { ...base, members: [{ name: "effect", outcome: "build-failed" }] },
        { ...base, members: [{ name: "effect", outcome: "skipped-cooldown" }] },
      ];
      for (const input of retired) expect((yield* decodeStatusUnknown(input).pipe(Effect.result))._tag).toBe("Failure");
      const status = RefsRefreshStatus.make({ ...base, schemaVersion: "beep-refs-refresh/v2", members: [] });
      expect(yield* RefsRefreshStatus.encodeJson(status)).toBe(
        '{"schemaVersion":"beep-refs-refresh/v2","timestamp":"2026-10-28T08:30:00.000Z","root":"/refs","members":[]}'
      );
    })
  );

  it.effect(
    "round-trips failure detail and omits the key when absent",
    Effect.fnUntraced(function* () {
      const detail = "git pull --ff-only origin main exited 1: fatal: not a git repository";
      const failed = MemberRefreshReport.make({ name: "effect", outcome: "pull-failed", detail: O.some(detail) });
      const decoded = yield* decodeReport(yield* encodeReport(failed));
      assertSome(decoded.detail, detail);
      const clean = yield* encodeReport(
        MemberRefreshReport.make({ name: "effect", outcome: "unchanged", detail: O.none() })
      );
      expect(clean).not.toContain("detail");
      assertNone((yield* decodeReport('{"name":"effect","outcome":"skipped-dirty"}')).detail);
    })
  );

  it.effect(
    "rejects detail beyond the bound",
    Effect.fnUntraced(function* () {
      const input = {
        name: "effect",
        outcome: "pull-failed",
        detail: Str.repeat(MEMBER_REFRESH_DETAIL_MAX_CHARS + 1)("x"),
      };
      expect((yield* decodeReportUnknown(input).pipe(Effect.result))._tag).toBe("Failure");
    })
  );

  it.effect.prop(
    "round-trips member reports through the JSON codec",
    [Arbitrary.schema(MemberRefreshReport)],
    Effect.fnUntraced(function* ([report]) {
      const decoded = yield* decodeReport(yield* encodeReport(report));
      expect(reportEquivalent(decoded, report)).toBe(true);
    }),
    { arbitrary: fcRuns(100) }
  );
});
