import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { canonicalize, uriEncode } from "../../../effected/github-actions/internal/sigv4.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect.prop("URI encoding is faithful and canonical re-encoding is stable", [Arbitrary.schema(S.String).pipe(Arbitrary.filter((value) => value.isWellFormed()))], ([value]) => Effect.sync(() => {
  const encoded = uriEncode(value);
  const parsed = decodeURIComponent(encoded);
  assert.strictEqual(parsed, value);
  assert.strictEqual(uriEncode(parsed), encoded);
  assert.strictEqual(decodeURIComponent(uriEncode(parsed)), parsed);
}), runs);
it.effect.prop("SigV4 header canonicalization is idempotent and preserves raw paths", [Arbitrary.schema(S.String).pipe(Arbitrary.filter((value) => value.isWellFormed()))], ([value]) => Effect.sync(() => {
  const credentials = { accessKeyId: "AK", secretAccessKey: "SK", region: "us-east-1", service: "s3" };
  const request = { method: "GET", host: "example.test", path: value, headers: { "X-Test": " a  b " }, body: new Uint8Array(), now: DateTime.toDateUtc(DateTime.makeUnsafe("2024-01-01T00:00:00Z")) };
  const first = canonicalize(request, credentials);
  assert.strictEqual(canonicalize({ ...request, headers: first.headers }, credentials).canonicalRequest, first.canonicalRequest);
  const path = first.canonicalRequest.split("\n")[1];
  assert.strictEqual(decodeURIComponent(path ?? ""), value.startsWith("/") ? value : `/${value}`);
}), runs);
