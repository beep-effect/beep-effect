import * as B from "@beep/box";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const boxToken = pipe(
  Bun.env.CLOUD_BOX_TOKEN,
  O.fromUndefinedOr,
  // Skip the live call when the token is absent, blank, or an unresolved
  // 1Password `op://` reference (present when secrets are not resolved, e.g. no
  // local `op` session). Mirrors the repo's isUnresolvedSecretReference guard so
  // the suite runs the real API only when a resolved token is available (CI).
  O.filter((value) => {
    const trimmed = Str.trim(value);
    return trimmed.length > 0 && !Str.startsWith("op://")(trimmed);
  })
);

pipe(
  boxToken,
  O.match({
    onNone: () =>
      describe("@beep/box live integration (CLOUD_BOX_TOKEN)", () => {
        it("skips live API calls when CLOUD_BOX_TOKEN is absent", () => {
          assertNone(boxToken);
        });
      }),
    onSome: () =>
      describe.concurrent("@beep/box live integration", () => {
        it.layer(B.Box.layer, { timeout: "30 seconds" })((it) => {
          it.effect(
            "reads the authenticated user through the live Box API",
            Effect.fnUntraced(function* () {
              const box = yield* B.Box;
              const response = yield* box.users.getUserMe(B.UsersGetUserMePayload.make({}));

              expect(response).toBeInstanceOf(B.UserFull);
              expect(response.id.length).toBeGreaterThan(0);
            })
          );
        });
      }),
  })
);
