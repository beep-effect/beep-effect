/**
 * A synthetic service configuration for the app's proofs.
 */
import { DateTime, Redacted } from "effect";
import * as O from "effect/Option";
import { DocketIntakeAppConfig } from "@/Config";
import { MAILBOX } from "./Pipeline.ts";

export const STATE_DIRECTORY = "/fixture/state/docket-intake";

export const fixtureEnv = {
  DOCKET_INTAKE_CERT_PRIVATE_KEY: "fixture-private-key",
  DOCKET_INTAKE_CERT_THUMBPRINT_SHA256: "AB12",
  DOCKET_INTAKE_CLIENT_ID: "client-id",
  DOCKET_INTAKE_MAILBOX: MAILBOX,
  DOCKET_INTAKE_START_AT: "2030-01-01T06:00:00Z",
  DOCKET_INTAKE_STATE_DIR: STATE_DIRECTORY,
  DOCKET_INTAKE_TENANT_ID: "tenant-id",
  DOCKET_INTAKE_TIME_ZONE: "America/Chicago",
};

export const fixtureConfig = DocketIntakeAppConfig.make({
  certPrivateKey: Redacted.make("fixture-private-key"),
  certThumbprintSha256: "AB12",
  clientId: "client-id",
  mailbox: MAILBOX,
  reviewNegatives: true,
  startAt: O.none(),
  stateDirectory: STATE_DIRECTORY,
  tenantId: "tenant-id",
  timeZone: DateTime.zoneMakeNamedUnsafe("America/Chicago"),
});
