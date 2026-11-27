import * as B from "@beep/box";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";

const isResolvedNonBlankToken = (value: string): boolean => {
  const trimmed = Str.trim(value);
  return trimmed.length > 0 && !Str.startsWith("op://")(trimmed);
};

const boxToken = pipe(Bun.env.CLOUD_BOX_TOKEN, O.fromUndefinedOr, O.filter(isResolvedNonBlankToken));

pipe(
  boxToken,
  O.match({
    onNone: () =>
      describe("@beep/box live integration (CLOUD_BOX_TOKEN)", () => {
        it("skips live API calls when CLOUD_BOX_TOKEN is absent, blank or an unresolved 1Password op:// reference", () => {
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
