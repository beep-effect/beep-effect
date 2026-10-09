import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { field, stringField } from "../../../effected/github-actions/internal/twirp.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect.prop("Twirp field extraction is faithful under JSON re-encoding and canonical field rendering", [Arbitrary.schema(S.Json)], ([value]) => Effect.gen(function* () {
  const codec = S.fromJsonString(S.Unknown);
  const body = { signed_upload_url: value };
  const decoded = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(body));
  const extracted = field(decoded, "signedUploadUrl");
  assert.strictEqual(S.toEquivalence(S.Json)(S.decodeUnknownResult(S.Json)(extracted).pipe(Result.getOrThrow), value), true);
  const canonical = { signedUploadUrl: extracted ?? undefined };
  assert.deepStrictEqual({ signedUploadUrl: field(canonical, "signedUploadUrl") }, canonical);
}), runs);
it.effect.prop("Twirp string fields preserve nonempty strings through canonical reformatting", [Arbitrary.schema(S.String)], ([value]) => Effect.sync(() => {
  const parsed = stringField({ signed_upload_url: value }, "signedUploadUrl");
  assert.strictEqual(parsed, value === "" ? undefined : value);
  assert.strictEqual(stringField({ signedUploadUrl: parsed }, "signedUploadUrl"), parsed);
}), runs);
