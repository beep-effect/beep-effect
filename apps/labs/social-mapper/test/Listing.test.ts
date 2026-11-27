import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { Listing, reason, status } from "@/client/Listing";
import { Entry, Inventory, SavedFile, Standing } from "@/core/inventory";
import {
  AuthRequired,
  CollectionLocator,
  Locator,
  MappedItem,
  MapperFailed,
  OnlyFansTarget,
  PostLocator,
  RateLimited,
  Unavailable,
} from "@/core/locator";

const source = CollectionLocator.make(
  Locator.cases.onlyfans.make({ target: OnlyFansTarget.cases.collection.make({ user: "example" }) })
);

const post = (id: string) =>
  PostLocator.make(Locator.cases.onlyfans.make({ target: OnlyFansTarget.cases.post.make({ id, user: "example" }) }));

const finishedAt = DateTime.makeUnsafe(0);

describe("a listing as the window shows it", () => {
  it.effect("carries the addresses a user can open and counts files saved and owed", () =>
    Effect.gen(function* () {
      const saved = SavedFile.make({ ordinal: 0, path: "/files/302_0.jpg", bytes: 17, savedAt: finishedAt });
      const inventory = Inventory.make({
        source,
        entries: [
          Entry.make({ item: MappedItem.make({ source: post("302"), images: 2 }), files: [saved] }),
          Entry.make({ item: MappedItem.make({ source: post("301"), images: 1, locked: 1 }) }),
        ],
      });
      const listing = yield* Listing.of(inventory);
      expect(listing.address).toBe("https://onlyfans.com/example");
      expect(A.map(listing.rows, ({ address }) => address)).toEqual([
        "https://onlyfans.com/302/example",
        "https://onlyfans.com/301/example",
      ]);
      expect(Listing.saved(listing)).toBe(1);
      expect(Listing.owed(listing)).toBe(1);
    })
  );

  it("words every standing", () => {
    expect(status(Standing.cases.unmapped.make({})).label).toBe("Not mapped");
    expect(status(Standing.cases.mapping.make({ startedAt: finishedAt, resumed: false, placed: 4 })).label).toBe(
      "Mapping, 4 new"
    );
    expect(status(Standing.cases.complete.make({ finishedAt })).tone).toBe("secondary");
    expect(status(Standing.cases.partial.make({ finishedAt, halt: "idle" })).label).toBe("Partial (idle)");
    expect(
      status(Standing.cases.failed.make({ finishedAt, failure: AuthRequired.make({ platform: "onlyfans" }) }))
    ).toEqual({ label: "Sign in to onlyfans, then map again", tone: "destructive" });
  });

  it("words every failure", () => {
    expect(reason(RateLimited.make({ platform: "onlyfans" }))).toBe("onlyfans asked for a pause");
    expect(reason(Unavailable.make({ platform: "onlyfans", reason: "private" }))).toBe("The listing is private");
    expect(reason(MapperFailed.make({ platform: "onlyfans", detail: "the window closed" }))).toBe("the window closed");
  });
});
