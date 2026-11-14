// LINT-04 S4 parity gate (goals/heavy-pool-diet): the detector rows over a committed fixture set.
// The pre-#3019 detectors (whole-file identifier walks per binding) produce this same digest; the
// method and the repo-wide findings diff are recorded in
// goals/heavy-pool-diet/history/2026-11-13-lint-04-parity-gates.md.
import { detectEffectVitestFindings, EffectVitestFinding } from "@beep/repo-cli/test/Lint";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { layer } from "@effect/vitest";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Project } from "ts-morph";
import { effectVitestParityFixtures } from "./support/EffectVitestParityFixtures.ts";

const encodeFinding = S.encodeUnknownEffect(S.fromJsonString(EffectVitestFinding));

layer(BunCrypto.layer, { timeout: "30 seconds" })((it) => {
  it.effect("pins the detector rows over the committed parity fixture set", () =>
    Effect.gen(function* () {
      const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
      const findings = yield* Effect.forEach(effectVitestParityFixtures, ([file, text]) =>
        detectEffectVitestFindings(project.createSourceFile(file, text), file, "@beep/example")
      );
      const flat = A.flatten(findings);
      const rows = A.sort(yield* Effect.forEach(flat, (finding) => encodeFinding(finding)), Order.String);
      const crypto = yield* Digest.Digest;
      const digest = yield* crypto.digest(Digest.sha256, new TextEncoder().encode(A.join(rows, "\n")));

      strictEqual(A.length(effectVitestParityFixtures), 39);
      strictEqual(A.length(rows), 30);
      deepStrictEqual(
        R.map(
          A.groupBy(flat, (finding) => finding.ruleId),
          A.length
        ),
        {
          EV001: 1,
          EV002: 1,
          EV003: 2,
          EV004: 1,
          EV005: 1,
          EV006: 1,
          EV008: 2,
          EV010: 18,
          EV013: 1,
          EV014: 2,
        }
      );
      strictEqual(Hex.encode(digest), "f49bcd0aeccf6942f4243af6243a4afb99a79ba232bba9a1b4b72c9fb47317ec");
    })
  );
});
