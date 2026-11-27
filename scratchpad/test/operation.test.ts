import { Account } from "@beep/scratchpad/int/content";
import * as Operation from "@beep/scratchpad/int/rpcs/Operation";
import { Connections, Items, Posts, Profile } from "@beep/scratchpad/int/rpcs/index";
import * as Served from "@beep/scratchpad/int/rpcs/server";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as R from "effect/Record";

describe("operation modules", () => {
  it("lists each contract under the name its module is filed under", () => {
    const tags = A.map(Operation.contracts({ Items, Posts, Profile, Connections }), ({ _tag }) => _tag);
    expect(tags).toEqual(["Items", "Posts", "Profile", "Connections"]);
  });

  it("keys each handler by its operation", () => {
    expect(R.keys(Operation.handlers(Served))).toEqual([
      "Connections",
      "Download",
      "InventoryList",
      "Items",
      "MapRun",
      "MapStop",
      "MapWatch",
      "Posts",
      "Profile",
      "SessionList",
      "SessionOpen",
    ]);
  });

  it("refuses a module filed under a name that is not its contract's tag", () => {
    // @ts-expect-error the key `Feed` is not the tag `Posts`
    expect(Operation.contracts({ Feed: Posts })).toHaveLength(1);
  });

  it("refuses a slot that is not the schema its contract was made from", () => {
    // @ts-expect-error `Success` is `Account` while the contract streams `Post`
    expect(Operation.contracts({ Posts: { ...Posts, Success: Account } })).toHaveLength(1);
  });

  it("refuses to serve a module that has no handler", () => {
    // @ts-expect-error the contract-only module has no `Handler`
    expect(R.keys(Operation.handlers({ Posts }))).toEqual(["Posts"]);
  });
});
