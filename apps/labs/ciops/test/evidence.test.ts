import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import * as Str from "effect/String";
import { decodeEvidenceMode, EvidenceMode, EvidencePaths, generateReplayEvidence } from "@/projection/Evidence";

const aboxPath = "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl";
const journalPath =
  "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson";
const mismatchFixturePath = "test/fixtures/admission-journal-v1-mismatch.ndjson";
const frozenRecord = "# frozen dated record — must survive every check run\n";

const PlatformLive = Layer.merge(BunFileSystem.layer, BunCrypto.layer);

// Each case gets a scratch copy of the evidence file so the committed record
// under explorations/ is never the subject of a write.
const scratchPaths = Effect.fn("EvidenceTest.scratchPaths")(function* (journal: string) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "ciops-evidence-" });
  const evidence = `${directory}/s7-replay-evidence.md`;
  yield* fs.writeFileString(evidence, frozenRecord);
  return EvidencePaths.make({ abox: aboxPath, journal, evidence });
});

const readEvidence = Effect.fn("EvidenceTest.readEvidence")(function* (paths: EvidencePaths) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(paths.evidence);
});

describe("@beep/ciops replay evidence", () => {
  it.effect("decodes a bare argv as the read-only check mode", () =>
    Effect.gen(function* () {
      expect(yield* decodeEvidenceMode(["bun", "scripts/generate-replay-evidence.ts"])).toBe(EvidenceMode.Enum.check);
      expect(yield* decodeEvidenceMode(["bun", "scripts/generate-replay-evidence.ts", "--check"])).toBe(
        EvidenceMode.Enum.check
      );
    })
  );

  it.effect("decodes --write as the opt-in write mode", () =>
    Effect.gen(function* () {
      expect(yield* decodeEvidenceMode(["bun", "scripts/generate-replay-evidence.ts", "--write"])).toBe(
        EvidenceMode.Enum.write
      );
    })
  );

  it.effect("refuses --check together with --write", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(decodeEvidenceMode(["bun", "script.ts", "--check", "--write"]));

      expect(failure._tag).toBe("PolicyDecodeError");
      expect(failure.message).toContain("evidence:s7:write");
    })
  );

  it.layer(PlatformLive, { timeout: "10 seconds" })((it) => {
    it.effect("check mode validates the frozen replay without touching the evidence file", () =>
      Effect.gen(function* () {
        const paths = yield* scratchPaths(journalPath);
        const run = yield* generateReplayEvidence(EvidenceMode.Enum.check, paths);

        expect(EvidenceMode.is.check(run.mode)).toBe(true);
        expect(Str.includes("PASS")(run.rendered)).toBe(true);
        expect(yield* readEvidence(paths)).toBe(frozenRecord);
      })
    );

    it.effect("write mode regenerates the evidence file after the replay matched", () =>
      Effect.gen(function* () {
        const paths = yield* scratchPaths(journalPath);
        const run = yield* generateReplayEvidence(EvidenceMode.Enum.write, paths);

        expect(EvidenceMode.is.write(run.mode)).toBe(true);
        expect(yield* readEvidence(paths)).toBe(run.rendered);
      })
    );

    it.effect("write mode leaves the evidence file untouched when the replay diverges", () =>
      Effect.gen(function* () {
        const paths = yield* scratchPaths(mismatchFixturePath);
        const failure = yield* Effect.flip(generateReplayEvidence(EvidenceMode.Enum.write, paths));

        expect(failure._tag).toBe("ReplayMismatchError");
        expect(yield* readEvidence(paths)).toBe(frozenRecord);
      })
    );
  });
});
