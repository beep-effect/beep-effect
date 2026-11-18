// Generated from the Party contract by scripts/bindings.ts. Do not edit:
// `bun run bindings` rewrites it, and `bun run bindings --check` fails on drift.
import { AcceptClaim } from "@proto/party-contract/Claim/AcceptClaim.command";
import { AddEvidence } from "@proto/party-contract/Claim/AddEvidence.command";
import { ApproveProposal } from "@proto/party-contract/Claim/ApproveProposal.command";
import { AssertClaim } from "@proto/party-contract/Claim/AssertClaim.command";
import { IntakeContract } from "@proto/party-contract/IntakeApi.contract";
import { MergeParties } from "@proto/party-contract/Party/MergeParties.command";
import { RegisterParty } from "@proto/party-contract/Party/RegisterParty.command";
import { RequestReview } from "@proto/party-contract/Claim/RequestReview.command";
import { RetractClaim } from "@proto/party-contract/Claim/RetractClaim.command";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import * as Bindings from "./Bindings.ts";
import { commandAtom, viewAtom } from "./Party.runtime.ts";

/** Bindings for `ReviewerContract`: each command, view and query it serves. */
export const Reviewer = {
  AcceptClaim: Bindings.command(ReviewerContract, AcceptClaim, (client) => client.AcceptClaim),
  ApproveProposal: Bindings.command(ReviewerContract, ApproveProposal, (client) => client.ApproveProposal),
  ClaimReview: Bindings.view(ReviewerContract, (client) => client.ClaimReview),
  EffectiveParty: Bindings.view(ReviewerContract, (client) => client.EffectiveParty),
  FindParties: Bindings.query(ReviewerContract, (client) => client.FindParties),
  MergeParties: Bindings.command(ReviewerContract, MergeParties, (client) => client.MergeParties),
  RequestReview: Bindings.command(ReviewerContract, RequestReview, (client) => client.RequestReview),
  RetractClaim: Bindings.command(ReviewerContract, RetractClaim, (client) => client.RetractClaim),
} as const;

/** Atoms over `Reviewer`: a subscription per view key, a command atom per command. */
export const ReviewerAtoms = {
  AcceptClaim: commandAtom(Reviewer.AcceptClaim),
  ApproveProposal: commandAtom(Reviewer.ApproveProposal),
  ClaimReview: viewAtom(Reviewer.ClaimReview),
  EffectiveParty: viewAtom(Reviewer.EffectiveParty),
  MergeParties: commandAtom(Reviewer.MergeParties),
  RequestReview: commandAtom(Reviewer.RequestReview),
  RetractClaim: commandAtom(Reviewer.RetractClaim),
} as const;

/** Bindings for `IntakeContract`: each command, view and query it serves. */
export const Intake = {
  AddEvidence: Bindings.command(IntakeContract, AddEvidence, (client) => client.AddEvidence),
  AssertClaim: Bindings.command(IntakeContract, AssertClaim, (client) => client.AssertClaim),
  RegisterParty: Bindings.command(IntakeContract, RegisterParty, (client) => client.RegisterParty),
} as const;

/** Atoms over `Intake`: a subscription per view key, a command atom per command. */
export const IntakeAtoms = {
  AddEvidence: commandAtom(Intake.AddEvidence),
  AssertClaim: commandAtom(Intake.AssertClaim),
  RegisterParty: commandAtom(Intake.RegisterParty),
} as const;

/** Every generated binding, by contract: the file's designated primary export. */
export const PartyBindings = { Reviewer, Intake } as const;
