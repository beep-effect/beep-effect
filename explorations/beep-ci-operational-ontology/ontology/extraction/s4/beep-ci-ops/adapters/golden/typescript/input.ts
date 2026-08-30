/** Golden fixture for adapter-typescript — exercises every emitted shape. */
import * as S from "effect/Schema";
import { LiteralKit } from "@beep/schema";

export const GoldenPriority = LiteralKit("publish", "verify");

export const GoldenModes = LiteralKit(["local", "remote"]);

const internalLimit = 42;

export type GoldenTier = "quick" | "standard" | GoldenAlias;

export type GoldenAlias = string;

export interface GoldenShape extends BaseShape {
  readonly tier: string;
  readonly weight: number;
}

interface BaseShape {
  readonly id: string;
}

export class GoldenTicket extends S.Class<GoldenTicket>("GoldenTicket")({
  tier: S.String,
}) {
  static readonly fromWire = (w: string): GoldenTicket => new GoldenTicket({ tier: w });
  describe(): string {
    // a comment mentioning phantomMember must not become a fact
    return this.tier;
  }
}

export enum GoldenState {
  Queued = "queued",
  Granted = "granted",
}

export function goldenAdmit(ticket: GoldenTicket, capacity: number): boolean {
  return capacity > internalLimit && ticket.tier.length > 0;
}

export declare namespace GoldenTicket {
  export type Encoded = { readonly tier: string };
}
