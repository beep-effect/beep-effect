#!/usr/bin/env bun

/**
 * Cross-platform MCPB packaging entrypoint for the practice gateway.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PracticeKgToolkit } from "@beep/law-practice-server";
import { M365Toolkit } from "@beep/m365-mcp/M365Tools";
import {
  McpbManifestFields,
  McpbPackageSpec,
  McpbPrompt,
  McpbTool,
  McpbUserConfigField,
  mcpbPackageProgram,
  runMcpbEntrypoint,
} from "@beep/mcpb-kit";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { BoxDriveToolkit } from "./BoxDriveTools.ts";
import { ONBOARD_PRACTICE_PROMPT, ONBOARDING_GUIDE, ONBOARDING_GUIDE_DESCRIPTION } from "./OnboardingGuide.ts";
import { SetupToolkit } from "./SetupTools.ts";
import { PRACTICE_GATEWAY_VERSION } from "./Version.ts";

/*
 * The manifest's tool list derives from the toolkits the gateway serves, so it
 * cannot drift from them. Setup tools are always mounted; practice-kg, Box
 * Drive and Microsoft 365 tools mount when the saved profile selects them.
 */
const manifestTools = A.map(
  [
    ...R.values(SetupToolkit.tools),
    ...R.values(PracticeKgToolkit.tools),
    ...R.values(BoxDriveToolkit.tools),
    ...R.values(M365Toolkit.tools),
  ],
  (tool) =>
    McpbTool.make({
      name: tool.name,
      description: O.getOrElse(O.fromUndefinedOr(tool.description), () => tool.name),
    })
);

const program = mcpbPackageProgram(
  McpbPackageSpec.make({
    appName: "practice-gateway",
    commandName: "practice-gateway-package",
    repoRoot: Bun.fileURLToPath(new URL("../../..", import.meta.url)),
    forbiddenArchiveFragments: ["package.ts", "src/", "practice-profile.json", ".dpapi"],
    manifest: McpbManifestFields.make({
      name: "beep-practice-gateway",
      displayName: "Beep Practice Gateway",
      version: PRACTICE_GATEWAY_VERSION,
      description:
        "Sets up this computer for the practice (checks, approved repairs, the lawyer's steps) and serves the practice tools the saved profile selects.",
      env: {
        BUNDLE_DIR: "${user_config.bundle_dir}",
        PRACTICE_KG_CORPUS_ROOT: "${user_config.corpus_root}",
        M365_CLIENT_ID: "${user_config.m365_client_id}",
      },
      userConfig: {
        bundle_dir: McpbUserConfigField.make({
          type: "directory",
          title: "Practice knowledge-graph bundle",
          description: "Optional. Directory containing bundle.manifest.json, kg.pglite, and practice.duckdb.",
          required: false,
        }),
        corpus_root: McpbUserConfigField.make({
          type: "directory",
          title: "Practice corpus root",
          description: "Optional corpus root used for click-through to source files and email bodies.",
          required: false,
        }),
        m365_client_id: McpbUserConfigField.make({
          type: "string",
          title: "Microsoft 365 app ID",
          description:
            "Optional. The application (client) ID of the practice gateway's Microsoft 365 app registration; Microsoft 365 stays off without it.",
          required: false,
        }),
      },
      tools: manifestTools,
      prompts: [
        McpbPrompt.make({
          name: ONBOARD_PRACTICE_PROMPT,
          description: ONBOARDING_GUIDE_DESCRIPTION,
          text: ONBOARDING_GUIDE,
        }),
      ],
    }),
  })
);
runMcpbEntrypoint({ isMain: import.meta.main, program });
