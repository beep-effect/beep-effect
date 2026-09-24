import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { Effect } from "effect";
import * as Crypto from "effect/Crypto";
import { loadOpenClawStackArgs, makeOpenClawGeneration, OpenClawStack } from "../OpenClaw.ts";

const args = loadOpenClawStackArgs();
const openClawGeneration = Effect.runSync(
  makeOpenClawGeneration(args).pipe(Effect.provideService(Crypto.Crypto, NodeCrypto.make))
);
const openclaw = new OpenClawStack("openclaw", args, openClawGeneration);

export const applyStdout = openclaw.applyStdout;
export const backupShipStdout = openclaw.backupShipStdout;
export const configRoot = openclaw.configRoot;
export const driftAuditCommand = openclaw.driftAuditCommand;
export const gatewayPort = openclaw.gatewayPort;
export const generation = openclaw.generation;
export const generationDir = openclaw.generationDir;
export const generationId = openclaw.generationId;
export const nodeVersion = openclaw.nodeVersion;
export const openclawVersion = openclaw.openclawVersion;
export const preflightStdout = openclaw.preflightStdout;
export const probeStdout = openclaw.probeStdout;
export const rollbackCommand = openclaw.rollbackCommand;
export const stageStdout = openclaw.stageStdout;
export const stateDir = openclaw.stateDir;
export const unitName = openclaw.unitName;
