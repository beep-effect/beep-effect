import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GitHubContent } from "@beep/github/GitHubContent";
import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { harness } from "./support/harness.ts";
import type { Reply } from "./support/fixtures.ts";

const runs = { arbitrary: fcRuns(100) };

describe("GitHubContent text fidelity", () => {
  // A one-response script repeats its current response for each generated read.
  const replies: Array<Reply> = [{ status: 200 }];
  const { script, base } = harness(replies);
  it.layer(GitHubContent.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect.prop(
      "base64 reading preserves Unicode text and tolerates whitespace in its wire encoding",
      [Arbitrary.schema(S.String)],
      ([input]) =>
        Effect.gen(function* () {
          const text = input.toWellFormed();
          const encoded = Buffer.from(text, "utf8").toString("base64");
          replies[0] = { status: 200, body: { type: "file", encoding: "base64", content: ` \n${encoded}\t\r\n` } };
          const before = script.calls.length;
          const content = yield* GitHubContent;
          const gotFileOption = yield* content.getFileOption("text.txt");
          assertSome(gotFileOption, text);
          assert.strictEqual(script.calls.length, before + 1);
        }),
      runs
    );
  });
});
