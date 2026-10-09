import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { AudienceKind } from "../../../effected/env/Audience.ts";
import { scanAudience, tallyAudience } from "../../../effected/cli/internal/scanAudience.ts";
it.effect.prop("audience scanner: canonical argv is idempotent and parse/stringify preserves tally and conflicts", [AudienceKind.pipe(S.Array, Arbitrary.schema), S.Boolean.pipe(S.Array, Arbitrary.schema)], ([audience, enabled]) => Effect.sync(() => {
  const values = { audience, human: enabled, agent: [], ci: [] };
  const argv = [...A.map(audience, (kind) => `--audience=${kind}`), ...A.map(enabled, (value) => `--human=${value}`)];
  const parsed = scanAudience(argv);
  assert.deepStrictEqual(parsed, tallyAudience(values));
  const canonical = A.map(parsed.given, (kind) => `--audience=${kind}`);
  assert.deepStrictEqual(scanAudience(canonical), parsed);
  assert.deepStrictEqual(scanAudience([...canonical, "--", "--ci"]), parsed);
}), runs);
