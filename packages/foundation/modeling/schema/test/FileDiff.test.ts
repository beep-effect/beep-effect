import { FileDiff } from "@beep/schema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, pipe } from "effect";
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

      pipe(decoded, Exit.isFailure, assertTrue);
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

      pipe(negative, Exit.isFailure, assertTrue);
      pipe(decimal, Exit.isFailure, assertTrue);
    })
  );
});
