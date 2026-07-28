/**
 * Golden render fixture: a full-featured deployment intent (gateway auth +
 * Telegram + ollama provider + auth profile + guardrails + logging, modeled
 * on the spike-3 config) together with the EXACT canonical JSON the render
 * adapter must emit for `2026.7.1-2` and its precomputed SHA-256.
 *
 * The expected values are regression pins: they were computed once from the
 * adapter and cross-checked byte-for-byte against `jq -S .` output.
 */
import {
  OpenclawAgentIntent,
  OpenclawAuthProfileIntent,
  OpenclawDeploymentIntent,
  OpenclawGatewayIntent,
  OpenclawLoggingIntent,
  OpenclawModelDeclaration,
  OpenclawModelProviderIntent,
  OpenclawModelProviderParams,
  OpenclawProviderApiKeyPlaceholder,
  OpenclawSecretReference,
  OpenclawSecretsResolverIntent,
  OpenclawTelegramGroupIntent,
  OpenclawTelegramIntent,
} from "@beep/openclaw/OpenclawIntent.models";
import * as O from "effect/Option";

export const goldenDeploymentIntent = OpenclawDeploymentIntent.make({
  agent: OpenclawAgentIntent.make({
    id: "spike3",
    model: "ollama/gemma3:4b",
    name: "Spike 3",
    workspace: "/var/lib/beep/openclaw/workspace",
  }),
  authProfiles: [
    OpenclawAuthProfileIntent.make({
      mode: "api_key",
      profileId: "ollama:manual",
      provider: "ollama",
    }),
  ],
  gateway: OpenclawGatewayIntent.make({
    authTokenRef: OpenclawSecretReference.make("op://beep-p0-spike3/spike3-rotating/password"),
    port: 19031,
  }),
  logging: OpenclawLoggingIntent.make({ filePath: "/var/lib/beep/openclaw/state/log/openclaw.log" }),
  openclawVersion: "2026.7.1-2",
  providers: [
    OpenclawModelProviderIntent.make({
      api: "ollama",
      apiKey: OpenclawProviderApiKeyPlaceholder.make({ _tag: "Placeholder", value: "ollama-local" }),
      baseUrl: "http://127.0.0.1:11434",
      contextTokens: O.some(32768),
      id: "ollama",
      models: [OpenclawModelDeclaration.make({ id: "gemma3:4b", input: ["text"], name: "gemma3:4b" })],
      params: O.some(OpenclawModelProviderParams.make({ numCtx: O.some(32768) })),
    }),
  ],
  secretsResolver: OpenclawSecretsResolverIntent.make({
    commandPath: "/opt/beep/openclaw/op-resolver.sh",
    opBinaryPath: "/opt/beep/openclaw/bin/op",
    trustedDir: "/opt/beep/openclaw",
  }),
  telegram: O.some(
    OpenclawTelegramIntent.make({
      botTokenRef: OpenclawSecretReference.make("op://beep-p0-spike3/spike3-telegram/bot-token"),
      defaultTo: O.some("@p0_spike1_jul25"),
      dmPolicy: "disabled",
      groupPolicy: "open",
      groups: {
        "-1004475923698": OpenclawTelegramGroupIntent.make({
          groupPolicy: O.some("open"),
          requireMention: false,
        }),
      },
    })
  ),
});

export const goldenIntentCanonicalJson = `{
  "agents": {
    "list": [
      {
        "id": "spike3",
        "model": {
          "primary": "ollama/gemma3:4b"
        },
        "name": "Spike 3",
        "workspace": "/var/lib/beep/openclaw/workspace"
      }
    ]
  },
  "auth": {
    "profiles": {
      "ollama:manual": {
        "mode": "api_key",
        "provider": "ollama"
      }
    }
  },
  "channels": {
    "telegram": {
      "botToken": {
        "id": "value",
        "provider": "op_telegram",
        "source": "exec"
      },
      "configWrites": false,
      "defaultTo": "@p0_spike1_jul25",
      "dmPolicy": "disabled",
      "enabled": true,
      "groupPolicy": "open",
      "groups": {
        "-1004475923698": {
          "groupPolicy": "open",
          "requireMention": false
        }
      }
    }
  },
  "gateway": {
    "auth": {
      "mode": "token",
      "token": {
        "id": "value",
        "provider": "op_gateway",
        "source": "exec"
      }
    },
    "bind": "loopback",
    "mode": "local",
    "port": 19031,
    "reload": {
      "mode": "off"
    }
  },
  "logging": {
    "file": "/var/lib/beep/openclaw/state/log/openclaw.log"
  },
  "models": {
    "providers": {
      "ollama": {
        "api": "ollama",
        "apiKey": "ollama-local",
        "baseUrl": "http://127.0.0.1:11434",
        "contextTokens": 32768,
        "models": [
          {
            "id": "gemma3:4b",
            "input": [
              "text"
            ],
            "name": "gemma3:4b"
          }
        ],
        "params": {
          "num_ctx": 32768
        }
      }
    }
  },
  "secrets": {
    "providers": {
      "op_gateway": {
        "args": [
          "/opt/beep/openclaw/bin/op",
          "op://beep-p0-spike3/spike3-rotating/password"
        ],
        "command": "/opt/beep/openclaw/op-resolver.sh",
        "jsonOnly": false,
        "passEnv": [
          "OP_SERVICE_ACCOUNT_TOKEN",
          "PATH"
        ],
        "source": "exec",
        "trustedDirs": [
          "/opt/beep/openclaw"
        ]
      },
      "op_telegram": {
        "args": [
          "/opt/beep/openclaw/bin/op",
          "op://beep-p0-spike3/spike3-telegram/bot-token"
        ],
        "command": "/opt/beep/openclaw/op-resolver.sh",
        "jsonOnly": false,
        "passEnv": [
          "OP_SERVICE_ACCOUNT_TOKEN",
          "PATH"
        ],
        "source": "exec",
        "trustedDirs": [
          "/opt/beep/openclaw"
        ]
      }
    }
  },
  "tools": {
    "deny": [
      "*"
    ]
  }
}
`;

export const goldenIntentContentHash = "ee805da8048665ed6075aaa89be3f07a73420c2970574f60a71c0f77469a8aa9";
