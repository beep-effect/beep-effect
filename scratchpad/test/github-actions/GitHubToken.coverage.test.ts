import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { GitHubTokenError } from "../../effected/github-actions/GitHubToken.ts";
it.effect("expired token explains its expiry and why later phases cannot mint a replacement", () => Effect.sync(() => {
  const error = GitHubTokenError.make({ reason: "expired", expiresAt: "2026-10-09T00:00:00Z" });
  assert.strictEqual(error.message, "The installation token persisted by an earlier phase expired at 2026-10-09T00:00:00Z. An installation token lives about an hour and no later phase can re-mint one, so a long-running phase must provision its own.");
}));
