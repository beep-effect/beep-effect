import { fcRuns } from "@beep/fc-runs";
import {
  MEMBER_REFRESH_DETAIL_MAX_CHARS,
  MemberRefreshOutcome,
  MemberRefreshReport,
  ReferenceMember,
  ReferenceWorkspaceManifest,
} from "@beep/repo-cli/commands/Refs";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, Path } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { testPlatform } from "./refs-test-utils.ts";

const ReportJson = S.fromJsonString(MemberRefreshReport);
const encodeReport = S.encodeEffect(ReportJson);
const decodeReport = S.decodeEffect(ReportJson);
const decodeReportUnknown = S.decodeUnknownEffect(MemberRefreshReport);
const reportEquivalent = S.toEquivalence(MemberRefreshReport);

describe("reference manifest schemas", () => {
  it.effect(
    "decodes the real S1 manifest",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const file = yield* path.fromFileUrl(new URL("../../../../../scripts/references.json", import.meta.url));
      const manifest = yield* ReferenceWorkspaceManifest.decodeJson(yield* fs.readFileString(file));
      expect(manifest.rootDefault).toBe("$HOME/YeeBois/references/effect");
      expect(manifest.members.map((member) => [member.name, member.tier])).toEqual([
        ["effect", "deep"],
        ["effect-tsgo", "deep"],
      ]);
      assertNone(manifest.members[0]?.onlyDir ?? O.none());
    }, testPlatform)
  );
  const invalidMembers: ReadonlyArray<readonly [label: string, extra: Record<string, unknown>]> = [
    ["branch", { branch: "main" }],
    ["tier", { tier: "unknown" }],
    ["name", { name: "../escape" }],
    ["onlyDir", { onlyDir: ["../escape"] }],
  ];
  for (const [label, extra] of invalidMembers) {
    it.effect(
      `rejects invalid member ${label}`,
      Effect.fnUntraced(function* () {
        const input: unknown = { name: "effect", url: "upstream", tier: "deep", ...extra };
        const result = yield* ReferenceMember.decode(input).pipe(Effect.result);
        expect(result._tag).toBe("Failure");
      })
    );
  }

  it("recognizes the cooldown outcome", () => {
    expect(MemberRefreshOutcome.is["skipped-cooldown"]("skipped-cooldown")).toBe(true);
  });

  it.effect(
    "round-trips failure detail and omits the key when absent",
    Effect.fnUntraced(function* () {
      const detail = "model claude-opus-5 cooling down at http://127.0.0.1:8317/v1; retry-after 55516s";
      const cooled = MemberRefreshReport.make({
        name: "effect",
        outcome: "skipped-cooldown",
        coverage: O.none(),
        detail: O.some(detail),
      });
      const decoded = yield* decodeReport(yield* encodeReport(cooled));
      assertSome(decoded.detail, detail);
      const clean = yield* encodeReport(
        MemberRefreshReport.make({ name: "effect", outcome: "unchanged", coverage: O.none(), detail: O.none() })
      );
      expect(clean).not.toContain("detail");
      // Receipts written before the field existed still decode.
      assertNone((yield* decodeReport('{"name":"effect","outcome":"build-failed"}')).detail);
    })
  );

  it.effect(
    "rejects detail beyond the bound",
    Effect.fnUntraced(function* () {
      const input = {
        name: "effect",
        outcome: "build-failed",
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
