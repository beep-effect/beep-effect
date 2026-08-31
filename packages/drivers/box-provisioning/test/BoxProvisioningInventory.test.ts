import * as B from "@beep/box";
import { BoxProvisioningInventory } from "@beep/box-provisioning";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { desiredFixture } from "./fixtures.ts";

describe("@beep/box-provisioning inventory", () => {
  it.effect(
    "requests both provider identity guard fields",
    Effect.fnUntraced(function* () {
      let receivedQuery: unknown;
      const client = {
        users: {
          getUserMe: (queryParams: unknown): Promise<unknown> => {
            receivedQuery = queryParams;
            return Promise.reject({ statusCode: 503 });
          },
        },
      };
      const InventoryTestLayer = BoxProvisioningInventory.layer.pipe(Layer.provide(B.Box.makeLayerFromClient(client)));

      const exit = yield* BoxProvisioningInventory.pipe(
        Effect.flatMap((inventory) => inventory.observe(desiredFixture)),
        Effect.exit,
        provideScopedLayer(InventoryTestLayer)
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(receivedQuery).toEqual({ fields: ["id", "enterprise"] });
    })
  );
});
