import {
  AccountHeadroomSource,
  GithubHeadroomSource,
  HostPressureSource,
  LaneRedsSource,
  ParcelItem,
  SinceLastCheckSource,
  SourceFailed,
} from "@beep/palantiri";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { AccountHeadroom, ParcelEnvelope, ParcelId } from "@beep/palantiri";

const offline = (parcel: ParcelId) => Effect.fail(SourceFailed.make({ parcel, detail: "not wired in this test" }));

/**
 * Every source port, failing with `SourceFailed`, so a test overrides only
 * the port it exercises.
 */
export const failingSources = Layer.mergeAll(
  Layer.succeed(AccountHeadroomSource, { snapshot: offline("account-headroom") }),
  Layer.succeed(LaneRedsSource, { snapshot: offline("lane-reds") }),
  Layer.succeed(HostPressureSource, { snapshot: offline("host-pressure") }),
  Layer.succeed(SinceLastCheckSource, {
    read: Effect.fn("SinceLastCheckSource.stub.read")(() => offline("since-last-check")),
    advance: Effect.fn("SinceLastCheckSource.stub.advance")(() => offline("since-last-check")),
  }),
  Layer.succeed(GithubHeadroomSource, { snapshot: offline("github-headroom") })
);

/** The account-headroom items of an envelope. */
export const accountItems = (parcel: ParcelEnvelope): ReadonlyArray<AccountHeadroom> =>
  A.filter(parcel.items, ParcelItem.guards.AccountHeadroom);
