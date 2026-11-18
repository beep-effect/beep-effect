import { CostAllocationTag } from "@beep/alchemy-aws-extras/CostAllocationTag";
import { describe, expect } from "@effect/vitest";
import { destroy } from "alchemy/RemovalPolicy";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as FakeAws from "./support/FakeAws.ts";

const statusOf = (account: FakeAws.FakeAccount, tagKey: string) =>
  O.getOrUndefined(MutableHashMap.get(account.costAllocationTags, tagKey));

describe("CostAllocationTag", () => {
  const lifecycle = FakeAws.harness({ costAllocationTags: { Project: "Inactive" } });
  lifecycle.provider("creates, updates, reads and retains a tag activation", (stack) =>
    Effect.gen(function* () {
      const { account } = lifecycle;

      const created = yield* stack.deploy(CostAllocationTag("ProjectTag", { tagKey: "Project" }));
      expect(created).toEqual({ tagKey: "Project", status: "Active", type: "UserDefined" });
      expect(statusOf(account, "Project")).toBe("Active");

      account.calls.length = 0;
      const unchanged = yield* stack.deploy(CostAllocationTag("ProjectTag", { tagKey: "Project" }));
      expect(unchanged.status).toBe("Active");
      expect(FakeAws.operations(account)).not.toContain("UpdateCostAllocationTagsStatus");

      const updated = yield* stack.deploy(CostAllocationTag("ProjectTag", { tagKey: "Project", status: "Inactive" }));
      expect(updated.status).toBe("Inactive");
      expect(statusOf(account, "Project")).toBe("Inactive");

      account.calls.length = 0;
      yield* stack.destroy();
      expect(FakeAws.operations(account)).not.toContain("UpdateCostAllocationTagsStatus");
      expect(statusOf(account, "Project")).toBe("Inactive");
    })
  );

  const explicitDestroy = FakeAws.harness({ costAllocationTags: { App: "Inactive" } });
  explicitDestroy.provider("deactivates on delete under an explicit destroy policy", (stack) =>
    Effect.gen(function* () {
      const { account } = explicitDestroy;

      yield* stack.deploy(CostAllocationTag("AppTag", { tagKey: "App" }).pipe(destroy()));
      expect(statusOf(account, "App")).toBe("Active");

      yield* stack.destroy();
      expect(statusOf(account, "App")).toBe("Inactive");
    })
  );

  const adopt = FakeAws.harness({ costAllocationTags: { ManagedBy: "Active" } });
  adopt.provider("adopts a key that is already active without updating it", (stack) =>
    Effect.gen(function* () {
      const adopted = yield* stack.deploy(CostAllocationTag("ManagedByTag", { tagKey: "ManagedBy" }));
      expect(adopted.status).toBe("Active");
      expect(FakeAws.operations(adopt.account)).toContain("ListCostAllocationTags");
      expect(FakeAws.operations(adopt.account)).not.toContain("UpdateCostAllocationTagsStatus");
    })
  );

  const replace = FakeAws.harness({ costAllocationTags: { DataClass: "Inactive", "beep-ci": "Inactive" } });
  replace.provider("replaces when the tag key changes and retains the old key", (stack) =>
    Effect.gen(function* () {
      const { account } = replace;

      yield* stack.deploy(CostAllocationTag("Tag", { tagKey: "DataClass" }));
      const replaced = yield* stack.deploy(CostAllocationTag("Tag", { tagKey: "beep-ci" }));
      expect(replaced.tagKey).toBe("beep-ci");
      expect(statusOf(account, "beep-ci")).toBe("Active");
      expect(statusOf(account, "DataClass")).toBe("Active");
    })
  );

  const unknown = FakeAws.harness();
  unknown.provider("fails with a typed error for a key billing has not seen", (stack) =>
    Effect.gen(function* () {
      const error = yield* FakeAws.deployFailure(stack)(CostAllocationTag("Unknown", { tagKey: "NeverSeen" }));
      expect(FakeAws.failureTags(error)).toContain("CostAllocationTagUpdateFailed");
    })
  );

  const invalid = FakeAws.harness();
  invalid.provider("rejects an empty tag key before calling AWS", (stack) =>
    Effect.gen(function* () {
      const error = yield* FakeAws.deployFailure(stack)(CostAllocationTag("Empty", { tagKey: "" }));
      expect(FakeAws.failureTags(error)).toContain("InvalidResourceProps");
      expect(FakeAws.operations(invalid.account)).not.toContain("UpdateCostAllocationTagsStatus");
    })
  );
});
