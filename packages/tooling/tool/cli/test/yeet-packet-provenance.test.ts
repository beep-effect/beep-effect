import {
  branchNamesPacket,
  decodePrSessionRegistry,
  detectActivePackets,
  isActivePacketManifest,
  mergePrProvenancePackets,
  PrProvenancePacket,
  PrSessionRecord,
  packetFromPath,
  packetsNamedByMessage,
  renderPrProvenance,
  toPublicPrProvenance,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { makeRecord, PlatformLayer } from "./yeet-pr-fixtures.ts";

const packet = (root: "goals" | "explorations", slug: string, sources: ReadonlyArray<"branch" | "commit" | "diff">) =>
  PrProvenancePacket.make({ root, slug, sources: [...sources] });
const withPackets = (record: PrSessionRecord, packets: ReadonlyArray<PrProvenancePacket>) =>
  PrSessionRecord.make({ ...record, packets: [...packets] });
const encodeRecordJson = flow(S.encodeUnknownResult(S.fromJsonString(PrSessionRecord)), Result.getOrThrow);
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

describe("packet path parsing", () => {
  it("names the packet a nested path lies inside", () => {
    assertSome(packetFromPath("goals/hold-ledger/PLAN.md"), { root: "goals", slug: "hold-ledger" });
    assertSome(packetFromPath("explorations/beep-mode/ops/manifest.json"), { root: "explorations", slug: "beep-mode" });
  });

  it("rejects root-level files, placeholders and foreign roots", () => {
    assertNone(packetFromPath("goals/INDEX.md"));
    assertNone(packetFromPath("goals/knowledge-doctor.baseline.jsonc"));
    assertNone(packetFromPath("goals/<slug>/README.md"));
    assertNone(packetFromPath("docs/goals/hold-ledger/README.md"));
    assertNone(packetFromPath("goals"));
  });
});

describe("branchNamesPacket", () => {
  it("matches a whole segment or a hyphen-bounded run of a multi-word slug", () => {
    expect(branchNamesPacket("goals/agent-memory-store", "agent-memory-store")).toBe(true);
    expect(branchNamesPacket("goals/agent-memory-store-p0", "agent-memory-store")).toBe(true);
    expect(branchNamesPacket("fix/ep9-hold-ledger-drift", "hold-ledger")).toBe(true);
    expect(branchNamesPacket("explore/ten-minute-certainty-packet", "ten-minute-certainty")).toBe(true);
    expect(branchNamesPacket("hold-ledger")("feat/hold-ledger")).toBe(true);
  });

  it("never matches a partial word or a one-word slug inside a segment", () => {
    expect(branchNamesPacket("fix/threshold-ledger", "hold-ledger")).toBe(false);
    expect(branchNamesPacket("fix/hold-ledgers", "hold-ledger")).toBe(false);
    expect(branchNamesPacket("fix/ledger-copy", "ledger")).toBe(false);
    expect(branchNamesPacket("goals/ledger", "ledger")).toBe(true);
  });
});

describe("packetsNamedByMessage", () => {
  it("reads standalone packet mentions and trailers once each", () => {
    const message = A.join(
      [
        "feat(memory): land P1",
        "",
        "Advances `goals/agent-memory-store` per goals/agent-memory-store/PLAN.md.",
        "Packet: explorations/beep-mode",
      ],
      "\n"
    );
    expect(packetsNamedByMessage(message)).toEqual([
      { root: "goals", slug: "agent-memory-store" },
      { root: "explorations", slug: "beep-mode" },
    ]);
  });

  it("ignores embedded paths, placeholders and bare roots", () => {
    expect(packetsNamedByMessage("see docs/goals/hold-ledger and goals/<slug> and goals/")).toEqual([]);
    expect(packetsNamedByMessage("rewrite goals/Upper-case")).toEqual([]);
  });
});

describe("isActivePacketManifest", () => {
  it("reads goal lifecycle and exploration status", () => {
    expect(isActivePacketManifest("goals", encodeJson({ lifecycle: "active" }))).toBe(true);
    expect(isActivePacketManifest("goals", encodeJson({ lifecycle: "completed-retained" }))).toBe(false);
    expect(isActivePacketManifest("explorations", encodeJson({ exploration: { status: "active" } }))).toBe(true);
    expect(isActivePacketManifest("explorations", encodeJson({ exploration: { status: "graduated" } }))).toBe(false);
    expect(isActivePacketManifest("explorations", encodeJson({ lifecycle: "active" }))).toBe(false);
    expect(isActivePacketManifest("goals", "not json")).toBe(false);
  });
});

describe("mergePrProvenancePackets", () => {
  it("unions evidence per directory and ranks branch, then commit, then diff", () => {
    const merged = mergePrProvenancePackets([
      packet("goals", "zeta-diff", ["diff"]),
      packet("explorations", "beta-commit", ["commit"]),
      packet("goals", "alpha-diff", ["diff"]),
      packet("goals", "zeta-diff", ["branch"]),
    ]);
    expect(A.map(merged, (entry) => [`${entry.root}/${entry.slug}`, entry.sources])).toEqual([
      ["goals/zeta-diff", ["branch", "diff"]],
      ["explorations/beta-commit", ["commit"]],
      ["goals/alpha-diff", ["diff"]],
    ]);
  });
});

describe("public packet projection", () => {
  it("unions packets across every session row and renders them after the branch", () => {
    const creator = withPackets(makeRecord({ sessionId: "creator", recordedAt: "2026-11-09T10:00:00Z" }), [
      packet("goals", "agent-memory-store", ["branch", "diff"]),
    ]);
    const monitor = withPackets(
      makeRecord({ sessionId: "monitor", role: "monitored", recordedAt: "2026-11-09T11:00:00Z" }),
      [packet("explorations", "beep-mode", ["diff"]), packet("goals", "agent-memory-store", ["commit"])]
    );
    const projected = toPublicPrProvenance([monitor, creator], O.some(42), false);
    expect(A.map(projected.packets ?? [], (entry) => [entry.slug, entry.sources])).toEqual([
      ["agent-memory-store", ["branch", "commit", "diff"]],
      ["beep-mode", ["diff"]],
    ]);
    expect(projected.otherPacketCount).toBeUndefined();
    const footer = renderPrProvenance(projected);
    expect(footer).toContain(
      "- Branch: <code>feat/yeet-pr-resume-footer</code>\n- Active packets: <code>goals/agent-memory-store</code> (branch, commit, diff), <code>explorations/beep-mode</code> (diff)\n- Agents (newest first):"
    );
    expect(footer).toContain('"packets": [');
  });

  it("lists only the packets recorded at the newest head", () => {
    const older = withPackets(
      makeRecord({ sessionId: "older", headSha: "aaa111", recordedAt: "2026-11-01T10:00:00Z" }),
      [packet("goals", "other-lane", ["diff"])]
    );
    const newer = makeRecord({ sessionId: "newer", headSha: "bbb222", recordedAt: "2026-11-09T10:00:00Z" });
    const sameHead = withPackets(
      makeRecord({ sessionId: "same-head", headSha: "bbb222", recordedAt: "2026-11-09T09:00:00Z" }),
      [packet("goals", "hold-ledger", ["branch"])]
    );
    const projected = toPublicPrProvenance([older, newer, sameHead], O.some(42), false);
    expect(A.map(projected.packets ?? [], (entry) => entry.slug)).toEqual(["hold-ledger"]);
    expect(toPublicPrProvenance([older, newer], O.some(42), false).packets).toBeUndefined();
  });

  it("names at most six packets and counts the rest", () => {
    const many = A.map(A.range(1, 9), (index) => packet("goals", `packet-${index}`, ["diff"]));
    const projected = toPublicPrProvenance([withPackets(makeRecord(), many)], O.some(7), false);
    expect(A.length(projected.packets ?? [])).toBe(6);
    expect(projected.otherPacketCount).toBe(3);
    expect(renderPrProvenance(projected)).toContain("<code>goals/packet-6</code> (diff) and 3 more\n");
  });

  it("leaves a footer without packets unchanged", () => {
    const footer = renderPrProvenance(toPublicPrProvenance([makeRecord()], O.some(42), false));
    expect(footer).not.toContain("Active packets");
    expect(footer).not.toContain('"packets"');
    expect(footer).toContain("- Branch: <code>feat/yeet-pr-resume-footer</code>\n- Agents (newest first):");
  });
});

describe("registry rows written before packets existed", () => {
  it("decode with an empty packet list", () => {
    const current = encodeRecordJson(makeRecord());
    const legacy = Str.replace(',"packets":[]', "")(current);
    expect(legacy).not.toBe(current);
    const read = decodePrSessionRegistry(`${legacy}\n`);
    expect(read.corruptLineCount).toBe(0);
    expect(A.map(read.records, (record) => record.packets)).toEqual([[]]);
  });
});

const git = Effect.fn("PacketProvenanceTest.git")(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], { cwd, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
  const exitCode = yield* handle.exitCode;
  expect(exitCode, `git ${A.join(args, " ")}`).toBe(0);
  return Str.trim(output);
});

const writeManifest = Effect.fn("PacketProvenanceTest.writeManifest")(function* (
  root: string,
  packetDir: string,
  manifest: unknown
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(root, packetDir, "ops"), { recursive: true });
  yield* fs.writeFileString(path.join(root, packetDir, "ops", "manifest.json"), `${encodeJson(manifest)}\n`);
});

it.layer(PlatformLayer, { timeout: "30 seconds" })("detectActivePackets", (it) => {
  it.effect("links a branch to the active packets its name, commits and diff point at", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-packet-provenance-" });
      yield* git(root, ["init", "--quiet", "--initial-branch=main"]);
      yield* git(root, ["config", "user.email", "fixture@example.invalid"]);
      yield* git(root, ["config", "user.name", "Fixture"]);
      yield* git(root, ["config", "commit.gpgsign", "false"]);
      yield* writeManifest(root, "goals/hold-ledger", { lifecycle: "active" });
      yield* writeManifest(root, "goals/closing-goal", { lifecycle: "active" });
      yield* writeManifest(root, "goals/done-goal", { lifecycle: "completed-retained" });
      yield* writeManifest(root, "goals/untouched-goal", { lifecycle: "active" });
      yield* writeManifest(root, "explorations/beep-mode", { exploration: { status: "active" } });
      yield* writeManifest(root, "explorations/parked-idea", { exploration: { status: "parked" } });
      yield* fs.writeFileString(path.join(root, "goals", "INDEX.md"), "index\n");
      yield* git(root, ["add", "."]);
      yield* git(root, ["commit", "--quiet", "-m", "base"]);

      yield* git(root, ["checkout", "--quiet", "-b", "feat/hold-ledger-p1"]);
      yield* fs.writeFileString(path.join(root, "explorations", "beep-mode", "NOTES.md"), "touch\n");
      yield* fs.writeFileString(path.join(root, "explorations", "parked-idea", "NOTES.md"), "touch\n");
      yield* fs.writeFileString(path.join(root, "goals", "INDEX.md"), "index two\n");
      yield* writeManifest(root, "goals/closing-goal", { lifecycle: "completed-retained" });
      yield* writeManifest(root, "goals/new-goal", { lifecycle: "active" });
      yield* git(root, ["add", "."]);
      yield* git(root, [
        "commit",
        "--quiet",
        "-m",
        "feat: work",
        "-m",
        "Packet: goals/done-goal\nRefs explorations/beep-mode and goals/missing-goal",
      ]);

      const packets = yield* detectActivePackets(root, "main", "feat/hold-ledger-p1");
      expect(A.map(packets, (entry) => [`${entry.root}/${entry.slug}`, entry.sources])).toEqual([
        ["goals/hold-ledger", ["branch"]],
        ["explorations/beep-mode", ["commit", "diff"]],
        ["goals/closing-goal", ["diff"]],
        ["goals/new-goal", ["diff"]],
      ]);
    })
  );

  it.effect("credits nothing a merge of a newer base brought in when the base ref is stale", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-packet-provenance-" });
      yield* git(root, ["init", "--quiet", "--initial-branch=main"]);
      yield* git(root, ["config", "user.email", "fixture@example.invalid"]);
      yield* git(root, ["config", "user.name", "Fixture"]);
      yield* git(root, ["config", "commit.gpgsign", "false"]);
      yield* writeManifest(root, "goals/mine", { lifecycle: "active" });
      yield* writeManifest(root, "goals/other-lane", { lifecycle: "active" });
      yield* git(root, ["add", "."]);
      yield* git(root, ["commit", "--quiet", "-m", "base"]);
      yield* git(root, ["branch", "stale-main"]);

      yield* git(root, ["checkout", "--quiet", "-b", "feat/mine-p1"]);
      yield* fs.writeFileString(path.join(root, "goals", "mine", "PLAN.md"), "mine\n");
      yield* git(root, ["add", "."]);
      yield* git(root, ["commit", "--quiet", "-m", "feat: mine"]);

      yield* git(root, ["checkout", "--quiet", "main"]);
      yield* fs.writeFileString(path.join(root, "goals", "other-lane", "PLAN.md"), "other\n");
      yield* git(root, ["add", "."]);
      yield* git(root, ["commit", "--quiet", "-m", "feat(other): advance goals/other-lane (#99)"]);

      yield* git(root, ["checkout", "--quiet", "feat/mine-p1"]);
      yield* git(root, ["merge", "--quiet", "--no-edit", "main"]);

      const stale = yield* detectActivePackets(root, "stale-main", "feat/mine-p1");
      const fresh = yield* detectActivePackets(root, "main", "feat/mine-p1");
      expect(A.map(stale, (entry) => [`${entry.root}/${entry.slug}`, entry.sources])).toEqual([
        ["goals/mine", ["diff"]],
      ]);
      expect(fresh).toEqual(stale);
    })
  );

  it.effect("yields no packets when the base ref cannot be resolved and the branch names none", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-packet-provenance-" });
      yield* git(root, ["init", "--quiet", "--initial-branch=main"]);
      yield* git(root, ["config", "user.email", "fixture@example.invalid"]);
      yield* git(root, ["config", "user.name", "Fixture"]);
      yield* git(root, ["config", "commit.gpgsign", "false"]);
      yield* writeManifest(root, "goals/hold-ledger", { lifecycle: "active" });
      yield* git(root, ["add", "."]);
      yield* git(root, ["commit", "--quiet", "-m", "base"]);
      const unrelated = yield* detectActivePackets(root, "origin/missing", "fix/unrelated");
      const named = yield* detectActivePackets(root, "origin/missing", "fix/hold-ledger");
      expect(unrelated).toEqual([]);
      expect(A.map(named, (entry) => entry.slug)).toEqual(["hold-ledger"]);
    })
  );
});
