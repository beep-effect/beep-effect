import { FileDiff } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as S from "effect/Schema";

const decodeInfo = S.decodeUnknownEffect(FileDiff.Info);
const encodeInfo = S.encodeEffect(FileDiff.Info);

describe("FileDiff.Info", () => {
  it.effect(
    "decodes added file summaries",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeInfo({
        status: "added",
        file: "src/new-file.ts",
        additions: 12,
        deletions: 0,
      });

      expect(decoded).toBeInstanceOf(FileDiff.Added);
      expect(decoded.status).toBe("added");
      expect(decoded.file).toBe("src/new-file.ts");
      expect(decoded.patch).toBeUndefined();
    })
  );

  it.effect(
    "encodes undefined optional fields by omitting the keys",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeInfo({
        status: "modified",
        file: "src/schema.ts",
        additions: 2,
        deletions: 1,
      });

      expect(yield* encodeInfo(decoded)).toEqual({
        status: "modified",
        file: "src/schema.ts",
        additions: 2,
        deletions: 1,
      });
    })
  );

  it.effect(
    "rejects unknown statuses",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.exit(
        decodeInfo({
          status: "renamed",
          file: "src/schema.ts",
          additions: 2,
          deletions: 1,
        })
      );

      expect(Exit.isFailure(decoded)).toBe(true);
    })
  );

  it.effect(
    "rejects negative and decimal line counts",
    Effect.fnUntraced(function* () {
      const negative = yield* Effect.exit(
        decodeInfo({
          status: "deleted",
          file: "src/old-file.ts",
          additions: 0,
          deletions: -1,
        })
      );
      const decimal = yield* Effect.exit(
        decodeInfo({
          status: "added",
          file: "src/new-file.ts",
          additions: 1.5,
          deletions: 0,
        })
      );

      expect(Exit.isFailure(negative)).toBe(true);
      expect(Exit.isFailure(decimal)).toBe(true);
    })
  );
});
