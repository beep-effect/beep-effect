// @vitest-environment node

import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { sealC2EvalReport } from "@/layers/CanaryC2Live";
import { C2EvalReport } from "@/schema/Reasoning";

const decodeC2EvalReportJson = S.decodeEffect(S.fromJsonString(C2EvalReport));

describe("C2 report sealing", () => {
  it.layer(BunCrypto.layer, { timeout: "30 seconds" })((it) => {
    it.effect("seals a committed C2 witness and rejects a placeholder digest", () =>
      Effect.gen(function* () {
        const json = yield* Effect.promise(() => Bun.file("test/fixtures/c2/full-w1.replay.eval-report.json").text());
        const previous = yield* decodeC2EvalReportJson(json);
        const sealed = yield* sealC2EvalReport(previous.base, previous.reasoning);

        expect(sealed.reportDigest).toBe(previous.reportDigest);
        const placeholder = yield* Effect.exit(
          C2EvalReport.makeEffect({ ...sealed, reportDigest: Sha256Hex.make(Str.repeat(64)("0")) })
        );
        pipe(placeholder, Exit.isFailure, assertTrue);
      })
    );
  });
});
