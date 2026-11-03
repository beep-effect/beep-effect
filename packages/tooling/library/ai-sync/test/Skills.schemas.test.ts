import { decodeSkillSnapshot, encodeSkillSnapshot, SkillSnapshot } from "@beep/ai-sync/Skills.schemas";
import {
  decodeSkillsLockDocumentJson,
  encodeSkillsLockDocumentJson,
  SkillsLockDocument,
} from "@beep/ai-sync/SkillsLock.schemas";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const snapshotInput = (fileCount: number) => ({
  algorithm: "sha256",
  treeHash: digest,
  fileCount,
  manifestHash: digest,
  manifest: [{ path: "SKILL.md", mode: "100644", sha256: digest }],
});

describe("Skills.schemas", () => {
  it.effect("round-trips a snapshot whose fileCount matches its manifest", () =>
    Effect.gen(function* () {
      const snapshot = yield* decodeSkillSnapshot(snapshotInput(1));
      const encoded = yield* encodeSkillSnapshot(snapshot);
      const decoded = yield* decodeSkillSnapshot(encoded);
      expect(decoded.fileCount).toBe(1);
      expect(S.is(SkillSnapshot)(decoded)).toBe(true);
    })
  );

  it.effect("rejects a snapshot whose fileCount disagrees with its manifest", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(decodeSkillSnapshot(snapshotInput(0)));
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );
});

describe("SkillsLock.schemas", () => {
  it.effect("round-trips an empty skills-lock/v2 document through JSON text", () =>
    Effect.gen(function* () {
      const json = yield* encodeSkillsLockDocumentJson(SkillsLockDocument.make({ version: 2, skills: {} }));
      const decoded = yield* decodeSkillsLockDocumentJson(json);
      expect(decoded.version).toBe(2);
      expect(R.keys(decoded.skills)).toHaveLength(0);
    })
  );

  it.effect("rejects a lock document with the wrong version", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(decodeSkillsLockDocumentJson('{"version": 1, "skills": {}}'));
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );
});
