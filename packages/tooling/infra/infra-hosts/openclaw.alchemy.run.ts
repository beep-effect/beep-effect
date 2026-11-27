import * as AWS from "@alchemy.run/aws";
import { openClawStackName, openClawStackProgram } from "@beep/infra-hosts/OpenClawStack";
import * as Alchemy from "alchemy";
import * as Command from "alchemy/Command";

// decision: shared-alchemy-state-store
const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * The OpenClaw generation applicator for the operator workstation. `prod`
 * runs from that workstation only, refuses CI (D21), and needs an armed sudo
 * ticket for its privileged steps. Configuration: the JSON file named by
 * `BEEP_OPENCLAW_HOST_CONFIG`. Deploy with
 * `bunx alchemy deploy openclaw.alchemy.run.ts --stage prod`.
 * Runbook: docs/runbooks/alchemy-infra.md.
 */
export default Alchemy.Stack(
  openClawStackName,
  {
    providers: Command.providers(),
    state,
  },
  openClawStackProgram
);
