# GitHub settings snapshots

Names only for secrets and variables. Before each hosted write, export all scoped settings.

## initial-read-only

```json
{
  "capturedAt": "2026-10-09T15:44:53.896358+00:00",
  "reason": "initial-read-only",
  "ruleset": {
    "id": 10240248,
    "name": "main",
    "target": "branch",
    "source_type": "Repository",
    "source": "beep-effect/beep-effect",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "dismissal_restriction": {
            "enabled": false,
            "allowed_actors": []
          },
          "require_last_push_approval": false,
          "required_review_thread_resolution": false,
          "require_extra_approval_for_unattributed_changes": true,
          "allowed_merge_methods": [
            "merge",
            "squash",
            "rebase"
          ]
        }
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": false,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "Lint"
            },
            {
              "context": "Heavy / Check"
            },
            {
              "context": "Test Unit"
            },
            {
              "context": "Heavy / Test Integration"
            },
            {
              "context": "Heavy / Docgen"
            },
            {
              "context": "Codegen Drift"
            },
            {
              "context": "Repo Sanity"
            },
            {
              "context": "Knip"
            },
            {
              "context": "Commitlint"
            },
            {
              "context": "Secret Scanning"
            },
            {
              "context": "Security"
            },
            {
              "context": "SAST"
            },
            {
              "context": "Nix Shell"
            },
            {
              "context": "Professional Desktop IPC Stdio"
            },
            {
              "context": "Heavy / Doctest"
            },
            {
              "context": "JSDoc Ratchet"
            }
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec49s783zgCcQPg",
    "created_at": "2025-11-20T22:12:15.649-06:00",
    "updated_at": "2026-10-06T12:22:35.190-05:00",
    "bypass_actors": [
      {
        "actor_id": 5,
        "actor_type": "RepositoryRole",
        "bypass_mode": "always"
      }
    ],
    "current_user_can_bypass": "always",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/beep-effect/beep-effect/rulesets/10240248"
      },
      "html": {
        "href": "https://github.com/beep-effect/beep-effect/rules/10240248"
      }
    }
  },
  "environments": {
    "total_count": 19,
    "environments": [
      {
        "id": 8405246522,
        "node_id": "EN_kwDOPbO_N88AAAAB9P3iOg",
        "name": "Preview",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview",
        "created_at": "2025-08-29T08:53:27Z",
        "updated_at": "2025-08-29T08:53:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12362901528,
        "node_id": "EN_kwDOPbO_N88AAAAC4OLoGA",
        "name": "Preview \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:48:14Z",
        "updated_at": "2026-02-23T15:48:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509829194,
        "node_id": "EN_kwDOPbO_N88AAAACcm9ESg",
        "name": "Preview \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T23:17:32Z",
        "updated_at": "2025-12-08T23:17:32Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608667552,
        "node_id": "EN_kwDOPbO_N88AAAADolldoA",
        "name": "Preview \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web",
        "created_at": "2026-05-20T23:04:27Z",
        "updated_at": "2026-05-20T23:04:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608638351,
        "node_id": "EN_kwDOPbO_N88AAAADoljrjw",
        "name": "Preview \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T23:03:18Z",
        "updated_at": "2026-05-20T23:03:18Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747970857,
        "node_id": "EN_kwDOPbO_N88AAAAE1KzpKQ",
        "name": "Preview \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox",
        "created_at": "2026-08-27T23:11:02Z",
        "updated_at": "2026-08-27T23:11:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509838005,
        "node_id": "EN_kwDOPbO_N88AAAACcm9mtQ",
        "name": "Preview \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox-marketing",
        "created_at": "2025-12-08T23:18:08Z",
        "updated_at": "2025-12-08T23:18:08Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 8378951433,
        "node_id": "EN_kwDOPbO_N88AAAAB82ynCQ",
        "name": "Production",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production",
        "created_at": "2025-08-28T05:15:39Z",
        "updated_at": "2025-08-28T05:15:39Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12361471483,
        "node_id": "EN_kwDOPbO_N88AAAAC4M0V-w",
        "name": "Production \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:08:02Z",
        "updated_at": "2026-02-23T15:08:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508873515,
        "node_id": "EN_kwDOPbO_N88AAAACcmCvKw",
        "name": "Production \u2013 beep-effect-infra",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-infra",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-infra",
        "created_at": "2025-12-08T22:23:02Z",
        "updated_at": "2025-12-08T22:23:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508902705,
        "node_id": "EN_kwDOPbO_N88AAAACcmEhMQ",
        "name": "Production \u2013 beep-effect-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing",
        "created_at": "2025-12-08T22:24:37Z",
        "updated_at": "2025-12-08T22:24:37Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509067756,
        "node_id": "EN_kwDOPbO_N88AAAACcmOl7A",
        "name": "Production \u2013 beep-effect-marketing-jbbs",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs",
        "created_at": "2025-12-08T22:34:07Z",
        "updated_at": "2025-12-08T22:34:07Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509080887,
        "node_id": "EN_kwDOPbO_N88AAAACcmPZNw",
        "name": "Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs-1765233294724-vLlH",
        "created_at": "2025-12-08T22:34:56Z",
        "updated_at": "2025-12-08T22:34:56Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509082322,
        "node_id": "EN_kwDOPbO_N88AAAACcmPe0g",
        "name": "Production \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T22:35:00Z",
        "updated_at": "2025-12-08T22:35:00Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593208236,
        "node_id": "EN_kwDOPbO_N88AAAADoW15rA",
        "name": "Production \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web",
        "created_at": "2026-05-20T16:12:22Z",
        "updated_at": "2026-05-20T16:12:22Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593165597,
        "node_id": "EN_kwDOPbO_N88AAAADoWzTHQ",
        "name": "Production \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T16:11:14Z",
        "updated_at": "2026-05-20T16:11:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747728204,
        "node_id": "EN_kwDOPbO_N88AAAAE1Kk1TA",
        "name": "Production \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox",
        "created_at": "2026-08-27T23:05:12Z",
        "updated_at": "2026-08-27T23:05:12Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10543810464,
        "node_id": "EN_kwDOPbO_N88AAAACdHXHoA",
        "name": "Production \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox-marketing",
        "created_at": "2025-12-10T04:51:10Z",
        "updated_at": "2025-12-10T04:51:10Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 19794454685,
        "node_id": "EN_kwDOPbO_N88AAAAEm9donQ",
        "name": "turbo-cache-write",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/turbo-cache-write",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=turbo-cache-write",
        "created_at": "2026-08-13T04:49:23Z",
        "updated_at": "2026-08-13T04:49:23Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 62579093,
            "node_id": "GA_kwDOPbO_N84DuuGV",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [
          "TURBO_TOKEN"
        ],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 57211084,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k1NzIxMTA4NA==",
              "name": "main",
              "type": "branch"
            }
          ]
        }
      }
    ]
  },
  "actionsPermissions": {
    "enabled": true,
    "allowed_actions": "selected",
    "selected_actions_url": "https://api.github.com/repositories/1035190071/actions/permissions/selected-actions",
    "sha_pinning_required": true
  },
  "workflowPermissions": {
    "default_workflow_permissions": "read",
    "can_approve_pull_request_reviews": false
  },
  "allowedActions": {
    "github_owned_allowed": true,
    "patterns_allowed": [
      "oven-sh/setup-bun@*",
      "taiki-e/install-action@*",
      "actions-rust-lang/setup-rust-toolchain@*",
      "cachix/cachix-action@*",
      "cachix/install-nix-action@*",
      "google/osv-scanner-action/*",
      "changesets/action@*",
      "peter-evans/create-pull-request@*",
      "tauri-apps/tauri-action@*",
      "swatinem/rust-cache@*"
    ],
    "verified_allowed": false
  },
  "runnerGroups": {
    "total_count": 2,
    "runner_groups": [
      {
        "id": 1,
        "name": "Default",
        "visibility": "all",
        "allows_public_repositories": false,
        "default": true,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": false,
        "selected_workflows": [],
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/hosted-runners",
        "inherited": false
      },
      {
        "id": 4,
        "name": "beep-ec2-heavy",
        "visibility": "selected",
        "allows_public_repositories": true,
        "default": false,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": true,
        "selected_workflows": [
          "beep-effect/beep-effect/.github/workflows/cache-warm.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main"
        ],
        "selected_repositories_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/repositories",
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/hosted-runners",
        "inherited": false
      }
    ]
  },
  "repoSecretNames": [
    "APP_ENV",
    "APP_LOG_FORMAT",
    "APP_LOG_LEVEL",
    "APP_NAME",
    "NEXT_PUBLIC_ENV",
    "TURBO_READ_TOKEN",
    "TURBO_TEAM",
    "TURBO_TOKEN"
  ],
  "repoVariableNames": [
    "TURBO_API",
    "TURBO_TEAM"
  ],
  "security": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "disabled"
    },
    "dependabot_security_updates": {
      "status": "disabled"
    },
    "secret_scanning_non_provider_patterns": {
      "status": "disabled"
    },
    "secret_scanning_ai_detection": {
      "status": "disabled"
    },
    "secret_scanning_validity_checks": {
      "status": "disabled"
    },
    "secret_scanning_delegated_alert_dismissal": {
      "status": "disabled"
    }
  }
}
```

## before-desktop-environment

```json
{
  "capturedAt": "2026-10-09T15:45:59.073327+00:00",
  "reason": "before-desktop-environment",
  "ruleset": {
    "id": 10240248,
    "name": "main",
    "target": "branch",
    "source_type": "Repository",
    "source": "beep-effect/beep-effect",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "dismissal_restriction": {
            "enabled": false,
            "allowed_actors": []
          },
          "require_last_push_approval": false,
          "required_review_thread_resolution": false,
          "require_extra_approval_for_unattributed_changes": true,
          "allowed_merge_methods": [
            "merge",
            "squash",
            "rebase"
          ]
        }
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": false,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "Lint"
            },
            {
              "context": "Heavy / Check"
            },
            {
              "context": "Test Unit"
            },
            {
              "context": "Heavy / Test Integration"
            },
            {
              "context": "Heavy / Docgen"
            },
            {
              "context": "Codegen Drift"
            },
            {
              "context": "Repo Sanity"
            },
            {
              "context": "Knip"
            },
            {
              "context": "Commitlint"
            },
            {
              "context": "Secret Scanning"
            },
            {
              "context": "Security"
            },
            {
              "context": "SAST"
            },
            {
              "context": "Nix Shell"
            },
            {
              "context": "Professional Desktop IPC Stdio"
            },
            {
              "context": "Heavy / Doctest"
            },
            {
              "context": "JSDoc Ratchet"
            }
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec49s783zgCcQPg",
    "created_at": "2025-11-20T22:12:15.649-06:00",
    "updated_at": "2026-10-06T12:22:35.190-05:00",
    "bypass_actors": [
      {
        "actor_id": 5,
        "actor_type": "RepositoryRole",
        "bypass_mode": "always"
      }
    ],
    "current_user_can_bypass": "always",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/beep-effect/beep-effect/rulesets/10240248"
      },
      "html": {
        "href": "https://github.com/beep-effect/beep-effect/rules/10240248"
      }
    }
  },
  "environments": {
    "total_count": 19,
    "environments": [
      {
        "id": 8405246522,
        "node_id": "EN_kwDOPbO_N88AAAAB9P3iOg",
        "name": "Preview",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview",
        "created_at": "2025-08-29T08:53:27Z",
        "updated_at": "2025-08-29T08:53:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12362901528,
        "node_id": "EN_kwDOPbO_N88AAAAC4OLoGA",
        "name": "Preview \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:48:14Z",
        "updated_at": "2026-02-23T15:48:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509829194,
        "node_id": "EN_kwDOPbO_N88AAAACcm9ESg",
        "name": "Preview \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T23:17:32Z",
        "updated_at": "2025-12-08T23:17:32Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608667552,
        "node_id": "EN_kwDOPbO_N88AAAADolldoA",
        "name": "Preview \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web",
        "created_at": "2026-05-20T23:04:27Z",
        "updated_at": "2026-05-20T23:04:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608638351,
        "node_id": "EN_kwDOPbO_N88AAAADoljrjw",
        "name": "Preview \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T23:03:18Z",
        "updated_at": "2026-05-20T23:03:18Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747970857,
        "node_id": "EN_kwDOPbO_N88AAAAE1KzpKQ",
        "name": "Preview \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox",
        "created_at": "2026-08-27T23:11:02Z",
        "updated_at": "2026-08-27T23:11:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509838005,
        "node_id": "EN_kwDOPbO_N88AAAACcm9mtQ",
        "name": "Preview \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox-marketing",
        "created_at": "2025-12-08T23:18:08Z",
        "updated_at": "2025-12-08T23:18:08Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 8378951433,
        "node_id": "EN_kwDOPbO_N88AAAAB82ynCQ",
        "name": "Production",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production",
        "created_at": "2025-08-28T05:15:39Z",
        "updated_at": "2025-08-28T05:15:39Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12361471483,
        "node_id": "EN_kwDOPbO_N88AAAAC4M0V-w",
        "name": "Production \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:08:02Z",
        "updated_at": "2026-02-23T15:08:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508873515,
        "node_id": "EN_kwDOPbO_N88AAAACcmCvKw",
        "name": "Production \u2013 beep-effect-infra",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-infra",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-infra",
        "created_at": "2025-12-08T22:23:02Z",
        "updated_at": "2025-12-08T22:23:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508902705,
        "node_id": "EN_kwDOPbO_N88AAAACcmEhMQ",
        "name": "Production \u2013 beep-effect-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing",
        "created_at": "2025-12-08T22:24:37Z",
        "updated_at": "2025-12-08T22:24:37Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509067756,
        "node_id": "EN_kwDOPbO_N88AAAACcmOl7A",
        "name": "Production \u2013 beep-effect-marketing-jbbs",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs",
        "created_at": "2025-12-08T22:34:07Z",
        "updated_at": "2025-12-08T22:34:07Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509080887,
        "node_id": "EN_kwDOPbO_N88AAAACcmPZNw",
        "name": "Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs-1765233294724-vLlH",
        "created_at": "2025-12-08T22:34:56Z",
        "updated_at": "2025-12-08T22:34:56Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509082322,
        "node_id": "EN_kwDOPbO_N88AAAACcmPe0g",
        "name": "Production \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T22:35:00Z",
        "updated_at": "2025-12-08T22:35:00Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593208236,
        "node_id": "EN_kwDOPbO_N88AAAADoW15rA",
        "name": "Production \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web",
        "created_at": "2026-05-20T16:12:22Z",
        "updated_at": "2026-05-20T16:12:22Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593165597,
        "node_id": "EN_kwDOPbO_N88AAAADoWzTHQ",
        "name": "Production \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T16:11:14Z",
        "updated_at": "2026-05-20T16:11:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747728204,
        "node_id": "EN_kwDOPbO_N88AAAAE1Kk1TA",
        "name": "Production \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox",
        "created_at": "2026-08-27T23:05:12Z",
        "updated_at": "2026-08-27T23:05:12Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10543810464,
        "node_id": "EN_kwDOPbO_N88AAAACdHXHoA",
        "name": "Production \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox-marketing",
        "created_at": "2025-12-10T04:51:10Z",
        "updated_at": "2025-12-10T04:51:10Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 19794454685,
        "node_id": "EN_kwDOPbO_N88AAAAEm9donQ",
        "name": "turbo-cache-write",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/turbo-cache-write",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=turbo-cache-write",
        "created_at": "2026-08-13T04:49:23Z",
        "updated_at": "2026-08-13T04:49:23Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 62579093,
            "node_id": "GA_kwDOPbO_N84DuuGV",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [
          "TURBO_TOKEN"
        ],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 57211084,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k1NzIxMTA4NA==",
              "name": "main",
              "type": "branch"
            }
          ]
        }
      }
    ]
  },
  "actionsPermissions": {
    "enabled": true,
    "allowed_actions": "selected",
    "selected_actions_url": "https://api.github.com/repositories/1035190071/actions/permissions/selected-actions",
    "sha_pinning_required": true
  },
  "workflowPermissions": {
    "default_workflow_permissions": "read",
    "can_approve_pull_request_reviews": false
  },
  "allowedActions": {
    "github_owned_allowed": true,
    "patterns_allowed": [
      "oven-sh/setup-bun@*",
      "taiki-e/install-action@*",
      "actions-rust-lang/setup-rust-toolchain@*",
      "cachix/cachix-action@*",
      "cachix/install-nix-action@*",
      "google/osv-scanner-action/*",
      "changesets/action@*",
      "peter-evans/create-pull-request@*",
      "tauri-apps/tauri-action@*",
      "swatinem/rust-cache@*"
    ],
    "verified_allowed": false
  },
  "runnerGroups": {
    "total_count": 2,
    "runner_groups": [
      {
        "id": 1,
        "name": "Default",
        "visibility": "all",
        "allows_public_repositories": false,
        "default": true,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": false,
        "selected_workflows": [],
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/hosted-runners",
        "inherited": false
      },
      {
        "id": 4,
        "name": "beep-ec2-heavy",
        "visibility": "selected",
        "allows_public_repositories": true,
        "default": false,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": true,
        "selected_workflows": [
          "beep-effect/beep-effect/.github/workflows/cache-warm.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main"
        ],
        "selected_repositories_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/repositories",
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/hosted-runners",
        "inherited": false
      }
    ]
  },
  "repoSecretNames": [
    "APP_ENV",
    "APP_LOG_FORMAT",
    "APP_LOG_LEVEL",
    "APP_NAME",
    "NEXT_PUBLIC_ENV",
    "TURBO_READ_TOKEN",
    "TURBO_TEAM",
    "TURBO_TOKEN"
  ],
  "repoVariableNames": [
    "TURBO_API",
    "TURBO_TEAM"
  ],
  "security": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "disabled"
    },
    "dependabot_security_updates": {
      "status": "disabled"
    },
    "secret_scanning_non_provider_patterns": {
      "status": "disabled"
    },
    "secret_scanning_ai_detection": {
      "status": "disabled"
    },
    "secret_scanning_validity_checks": {
      "status": "disabled"
    },
    "secret_scanning_delegated_alert_dismissal": {
      "status": "disabled"
    }
  }
}
```

## before-desktop-tag-policy

```json
{
  "capturedAt": "2026-10-09T15:47:14.378518+00:00",
  "reason": "before-desktop-tag-policy",
  "ruleset": {
    "id": 10240248,
    "name": "main",
    "target": "branch",
    "source_type": "Repository",
    "source": "beep-effect/beep-effect",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "dismissal_restriction": {
            "enabled": false,
            "allowed_actors": []
          },
          "require_last_push_approval": false,
          "required_review_thread_resolution": false,
          "require_extra_approval_for_unattributed_changes": true,
          "allowed_merge_methods": [
            "merge",
            "squash",
            "rebase"
          ]
        }
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": false,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "Lint"
            },
            {
              "context": "Heavy / Check"
            },
            {
              "context": "Test Unit"
            },
            {
              "context": "Heavy / Test Integration"
            },
            {
              "context": "Heavy / Docgen"
            },
            {
              "context": "Codegen Drift"
            },
            {
              "context": "Repo Sanity"
            },
            {
              "context": "Knip"
            },
            {
              "context": "Commitlint"
            },
            {
              "context": "Secret Scanning"
            },
            {
              "context": "Security"
            },
            {
              "context": "SAST"
            },
            {
              "context": "Nix Shell"
            },
            {
              "context": "Professional Desktop IPC Stdio"
            },
            {
              "context": "Heavy / Doctest"
            },
            {
              "context": "JSDoc Ratchet"
            }
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec49s783zgCcQPg",
    "created_at": "2025-11-20T22:12:15.649-06:00",
    "updated_at": "2026-10-06T12:22:35.190-05:00",
    "bypass_actors": [
      {
        "actor_id": 5,
        "actor_type": "RepositoryRole",
        "bypass_mode": "always"
      }
    ],
    "current_user_can_bypass": "always",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/beep-effect/beep-effect/rulesets/10240248"
      },
      "html": {
        "href": "https://github.com/beep-effect/beep-effect/rules/10240248"
      }
    }
  },
  "environments": {
    "total_count": 20,
    "environments": [
      {
        "id": 8405246522,
        "node_id": "EN_kwDOPbO_N88AAAAB9P3iOg",
        "name": "Preview",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview",
        "created_at": "2025-08-29T08:53:27Z",
        "updated_at": "2025-08-29T08:53:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12362901528,
        "node_id": "EN_kwDOPbO_N88AAAAC4OLoGA",
        "name": "Preview \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:48:14Z",
        "updated_at": "2026-02-23T15:48:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509829194,
        "node_id": "EN_kwDOPbO_N88AAAACcm9ESg",
        "name": "Preview \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T23:17:32Z",
        "updated_at": "2025-12-08T23:17:32Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608667552,
        "node_id": "EN_kwDOPbO_N88AAAADolldoA",
        "name": "Preview \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web",
        "created_at": "2026-05-20T23:04:27Z",
        "updated_at": "2026-05-20T23:04:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608638351,
        "node_id": "EN_kwDOPbO_N88AAAADoljrjw",
        "name": "Preview \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T23:03:18Z",
        "updated_at": "2026-05-20T23:03:18Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747970857,
        "node_id": "EN_kwDOPbO_N88AAAAE1KzpKQ",
        "name": "Preview \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox",
        "created_at": "2026-08-27T23:11:02Z",
        "updated_at": "2026-08-27T23:11:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509838005,
        "node_id": "EN_kwDOPbO_N88AAAACcm9mtQ",
        "name": "Preview \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox-marketing",
        "created_at": "2025-12-08T23:18:08Z",
        "updated_at": "2025-12-08T23:18:08Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 8378951433,
        "node_id": "EN_kwDOPbO_N88AAAAB82ynCQ",
        "name": "Production",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production",
        "created_at": "2025-08-28T05:15:39Z",
        "updated_at": "2025-08-28T05:15:39Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12361471483,
        "node_id": "EN_kwDOPbO_N88AAAAC4M0V-w",
        "name": "Production \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:08:02Z",
        "updated_at": "2026-02-23T15:08:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508873515,
        "node_id": "EN_kwDOPbO_N88AAAACcmCvKw",
        "name": "Production \u2013 beep-effect-infra",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-infra",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-infra",
        "created_at": "2025-12-08T22:23:02Z",
        "updated_at": "2025-12-08T22:23:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508902705,
        "node_id": "EN_kwDOPbO_N88AAAACcmEhMQ",
        "name": "Production \u2013 beep-effect-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing",
        "created_at": "2025-12-08T22:24:37Z",
        "updated_at": "2025-12-08T22:24:37Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509067756,
        "node_id": "EN_kwDOPbO_N88AAAACcmOl7A",
        "name": "Production \u2013 beep-effect-marketing-jbbs",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs",
        "created_at": "2025-12-08T22:34:07Z",
        "updated_at": "2025-12-08T22:34:07Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509080887,
        "node_id": "EN_kwDOPbO_N88AAAACcmPZNw",
        "name": "Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs-1765233294724-vLlH",
        "created_at": "2025-12-08T22:34:56Z",
        "updated_at": "2025-12-08T22:34:56Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509082322,
        "node_id": "EN_kwDOPbO_N88AAAACcmPe0g",
        "name": "Production \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T22:35:00Z",
        "updated_at": "2025-12-08T22:35:00Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593208236,
        "node_id": "EN_kwDOPbO_N88AAAADoW15rA",
        "name": "Production \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web",
        "created_at": "2026-05-20T16:12:22Z",
        "updated_at": "2026-05-20T16:12:22Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593165597,
        "node_id": "EN_kwDOPbO_N88AAAADoWzTHQ",
        "name": "Production \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T16:11:14Z",
        "updated_at": "2026-05-20T16:11:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747728204,
        "node_id": "EN_kwDOPbO_N88AAAAE1Kk1TA",
        "name": "Production \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox",
        "created_at": "2026-08-27T23:05:12Z",
        "updated_at": "2026-08-27T23:05:12Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10543810464,
        "node_id": "EN_kwDOPbO_N88AAAACdHXHoA",
        "name": "Production \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox-marketing",
        "created_at": "2025-12-10T04:51:10Z",
        "updated_at": "2025-12-10T04:51:10Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 23892170137,
        "node_id": "EN_kwDOPbO_N88AAAAFkBWVmQ",
        "name": "professional-desktop-release",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/professional-desktop-release",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=professional-desktop-release",
        "created_at": "2026-10-09T15:46:21Z",
        "updated_at": "2026-10-09T15:46:21Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 68262106,
            "node_id": "GA_kwDOPbO_N84EEZja",
            "type": "required_reviewers",
            "prevent_self_review": false,
            "reviewers": [
              {
                "type": "User",
                "reviewer": {
                  "login": "kriegcloud",
                  "id": 106790222,
                  "node_id": "U_kgDOBl19Tg",
                  "avatar_url": "https://avatars.githubusercontent.com/u/106790222?v=4",
                  "gravatar_id": "",
                  "url": "https://api.github.com/users/kriegcloud",
                  "html_url": "https://github.com/kriegcloud",
                  "followers_url": "https://api.github.com/users/kriegcloud/followers",
                  "following_url": "https://api.github.com/users/kriegcloud/following{/other_user}",
                  "gists_url": "https://api.github.com/users/kriegcloud/gists{/gist_id}",
                  "starred_url": "https://api.github.com/users/kriegcloud/starred{/owner}{/repo}",
                  "subscriptions_url": "https://api.github.com/users/kriegcloud/subscriptions",
                  "organizations_url": "https://api.github.com/users/kriegcloud/orgs",
                  "repos_url": "https://api.github.com/users/kriegcloud/repos",
                  "events_url": "https://api.github.com/users/kriegcloud/events{/privacy}",
                  "received_events_url": "https://api.github.com/users/kriegcloud/received_events",
                  "type": "User",
                  "user_view_type": "public",
                  "site_admin": false
                }
              }
            ]
          },
          {
            "id": 68262107,
            "node_id": "GA_kwDOPbO_N84EEZjb",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 0,
          "branch_policies": []
        }
      },
      {
        "id": 19794454685,
        "node_id": "EN_kwDOPbO_N88AAAAEm9donQ",
        "name": "turbo-cache-write",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/turbo-cache-write",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=turbo-cache-write",
        "created_at": "2026-08-13T04:49:23Z",
        "updated_at": "2026-08-13T04:49:23Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 62579093,
            "node_id": "GA_kwDOPbO_N84DuuGV",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [
          "TURBO_TOKEN"
        ],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 57211084,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k1NzIxMTA4NA==",
              "name": "main",
              "type": "branch"
            }
          ]
        }
      }
    ]
  },
  "actionsPermissions": {
    "enabled": true,
    "allowed_actions": "selected",
    "selected_actions_url": "https://api.github.com/repositories/1035190071/actions/permissions/selected-actions",
    "sha_pinning_required": true
  },
  "workflowPermissions": {
    "default_workflow_permissions": "read",
    "can_approve_pull_request_reviews": false
  },
  "allowedActions": {
    "github_owned_allowed": true,
    "patterns_allowed": [
      "oven-sh/setup-bun@*",
      "taiki-e/install-action@*",
      "actions-rust-lang/setup-rust-toolchain@*",
      "cachix/cachix-action@*",
      "cachix/install-nix-action@*",
      "google/osv-scanner-action/*",
      "changesets/action@*",
      "peter-evans/create-pull-request@*",
      "tauri-apps/tauri-action@*",
      "swatinem/rust-cache@*"
    ],
    "verified_allowed": false
  },
  "runnerGroups": {
    "total_count": 2,
    "runner_groups": [
      {
        "id": 1,
        "name": "Default",
        "visibility": "all",
        "allows_public_repositories": false,
        "default": true,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": false,
        "selected_workflows": [],
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/hosted-runners",
        "inherited": false
      },
      {
        "id": 4,
        "name": "beep-ec2-heavy",
        "visibility": "selected",
        "allows_public_repositories": true,
        "default": false,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": true,
        "selected_workflows": [
          "beep-effect/beep-effect/.github/workflows/cache-warm.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main"
        ],
        "selected_repositories_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/repositories",
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/hosted-runners",
        "inherited": false
      }
    ]
  },
  "repoSecretNames": [
    "APP_ENV",
    "APP_LOG_FORMAT",
    "APP_LOG_LEVEL",
    "APP_NAME",
    "NEXT_PUBLIC_ENV",
    "TURBO_READ_TOKEN",
    "TURBO_TEAM",
    "TURBO_TOKEN"
  ],
  "repoVariableNames": [
    "TURBO_API",
    "TURBO_TEAM"
  ],
  "security": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "disabled"
    },
    "dependabot_security_updates": {
      "status": "disabled"
    },
    "secret_scanning_non_provider_patterns": {
      "status": "disabled"
    },
    "secret_scanning_ai_detection": {
      "status": "disabled"
    },
    "secret_scanning_validity_checks": {
      "status": "disabled"
    },
    "secret_scanning_delegated_alert_dismissal": {
      "status": "disabled"
    }
  }
}
```

## before-disable-data-sync

```json
{
  "capturedAt": "2026-10-09T15:47:47.019364+00:00",
  "reason": "before-disable-data-sync",
  "ruleset": {
    "id": 10240248,
    "name": "main",
    "target": "branch",
    "source_type": "Repository",
    "source": "beep-effect/beep-effect",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "dismissal_restriction": {
            "enabled": false,
            "allowed_actors": []
          },
          "require_last_push_approval": false,
          "required_review_thread_resolution": false,
          "require_extra_approval_for_unattributed_changes": true,
          "allowed_merge_methods": [
            "merge",
            "squash",
            "rebase"
          ]
        }
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": false,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "Lint"
            },
            {
              "context": "Heavy / Check"
            },
            {
              "context": "Test Unit"
            },
            {
              "context": "Heavy / Test Integration"
            },
            {
              "context": "Heavy / Docgen"
            },
            {
              "context": "Codegen Drift"
            },
            {
              "context": "Repo Sanity"
            },
            {
              "context": "Knip"
            },
            {
              "context": "Commitlint"
            },
            {
              "context": "Secret Scanning"
            },
            {
              "context": "Security"
            },
            {
              "context": "SAST"
            },
            {
              "context": "Nix Shell"
            },
            {
              "context": "Professional Desktop IPC Stdio"
            },
            {
              "context": "Heavy / Doctest"
            },
            {
              "context": "JSDoc Ratchet"
            }
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec49s783zgCcQPg",
    "created_at": "2025-11-20T22:12:15.649-06:00",
    "updated_at": "2026-10-06T12:22:35.190-05:00",
    "bypass_actors": [
      {
        "actor_id": 5,
        "actor_type": "RepositoryRole",
        "bypass_mode": "always"
      }
    ],
    "current_user_can_bypass": "always",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/beep-effect/beep-effect/rulesets/10240248"
      },
      "html": {
        "href": "https://github.com/beep-effect/beep-effect/rules/10240248"
      }
    }
  },
  "environments": {
    "total_count": 20,
    "environments": [
      {
        "id": 8405246522,
        "node_id": "EN_kwDOPbO_N88AAAAB9P3iOg",
        "name": "Preview",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview",
        "created_at": "2025-08-29T08:53:27Z",
        "updated_at": "2025-08-29T08:53:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12362901528,
        "node_id": "EN_kwDOPbO_N88AAAAC4OLoGA",
        "name": "Preview \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:48:14Z",
        "updated_at": "2026-02-23T15:48:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509829194,
        "node_id": "EN_kwDOPbO_N88AAAACcm9ESg",
        "name": "Preview \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T23:17:32Z",
        "updated_at": "2025-12-08T23:17:32Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608667552,
        "node_id": "EN_kwDOPbO_N88AAAADolldoA",
        "name": "Preview \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web",
        "created_at": "2026-05-20T23:04:27Z",
        "updated_at": "2026-05-20T23:04:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608638351,
        "node_id": "EN_kwDOPbO_N88AAAADoljrjw",
        "name": "Preview \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T23:03:18Z",
        "updated_at": "2026-05-20T23:03:18Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747970857,
        "node_id": "EN_kwDOPbO_N88AAAAE1KzpKQ",
        "name": "Preview \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox",
        "created_at": "2026-08-27T23:11:02Z",
        "updated_at": "2026-08-27T23:11:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509838005,
        "node_id": "EN_kwDOPbO_N88AAAACcm9mtQ",
        "name": "Preview \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox-marketing",
        "created_at": "2025-12-08T23:18:08Z",
        "updated_at": "2025-12-08T23:18:08Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 8378951433,
        "node_id": "EN_kwDOPbO_N88AAAAB82ynCQ",
        "name": "Production",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production",
        "created_at": "2025-08-28T05:15:39Z",
        "updated_at": "2025-08-28T05:15:39Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12361471483,
        "node_id": "EN_kwDOPbO_N88AAAAC4M0V-w",
        "name": "Production \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:08:02Z",
        "updated_at": "2026-02-23T15:08:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508873515,
        "node_id": "EN_kwDOPbO_N88AAAACcmCvKw",
        "name": "Production \u2013 beep-effect-infra",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-infra",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-infra",
        "created_at": "2025-12-08T22:23:02Z",
        "updated_at": "2025-12-08T22:23:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508902705,
        "node_id": "EN_kwDOPbO_N88AAAACcmEhMQ",
        "name": "Production \u2013 beep-effect-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing",
        "created_at": "2025-12-08T22:24:37Z",
        "updated_at": "2025-12-08T22:24:37Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509067756,
        "node_id": "EN_kwDOPbO_N88AAAACcmOl7A",
        "name": "Production \u2013 beep-effect-marketing-jbbs",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs",
        "created_at": "2025-12-08T22:34:07Z",
        "updated_at": "2025-12-08T22:34:07Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509080887,
        "node_id": "EN_kwDOPbO_N88AAAACcmPZNw",
        "name": "Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs-1765233294724-vLlH",
        "created_at": "2025-12-08T22:34:56Z",
        "updated_at": "2025-12-08T22:34:56Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509082322,
        "node_id": "EN_kwDOPbO_N88AAAACcmPe0g",
        "name": "Production \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T22:35:00Z",
        "updated_at": "2025-12-08T22:35:00Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593208236,
        "node_id": "EN_kwDOPbO_N88AAAADoW15rA",
        "name": "Production \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web",
        "created_at": "2026-05-20T16:12:22Z",
        "updated_at": "2026-05-20T16:12:22Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593165597,
        "node_id": "EN_kwDOPbO_N88AAAADoWzTHQ",
        "name": "Production \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T16:11:14Z",
        "updated_at": "2026-05-20T16:11:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747728204,
        "node_id": "EN_kwDOPbO_N88AAAAE1Kk1TA",
        "name": "Production \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox",
        "created_at": "2026-08-27T23:05:12Z",
        "updated_at": "2026-08-27T23:05:12Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10543810464,
        "node_id": "EN_kwDOPbO_N88AAAACdHXHoA",
        "name": "Production \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox-marketing",
        "created_at": "2025-12-10T04:51:10Z",
        "updated_at": "2025-12-10T04:51:10Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 23892170137,
        "node_id": "EN_kwDOPbO_N88AAAAFkBWVmQ",
        "name": "professional-desktop-release",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/professional-desktop-release",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=professional-desktop-release",
        "created_at": "2026-10-09T15:46:21Z",
        "updated_at": "2026-10-09T15:46:21Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 68262106,
            "node_id": "GA_kwDOPbO_N84EEZja",
            "type": "required_reviewers",
            "prevent_self_review": false,
            "reviewers": [
              {
                "type": "User",
                "reviewer": {
                  "login": "kriegcloud",
                  "id": 106790222,
                  "node_id": "U_kgDOBl19Tg",
                  "avatar_url": "https://avatars.githubusercontent.com/u/106790222?v=4",
                  "gravatar_id": "",
                  "url": "https://api.github.com/users/kriegcloud",
                  "html_url": "https://github.com/kriegcloud",
                  "followers_url": "https://api.github.com/users/kriegcloud/followers",
                  "following_url": "https://api.github.com/users/kriegcloud/following{/other_user}",
                  "gists_url": "https://api.github.com/users/kriegcloud/gists{/gist_id}",
                  "starred_url": "https://api.github.com/users/kriegcloud/starred{/owner}{/repo}",
                  "subscriptions_url": "https://api.github.com/users/kriegcloud/subscriptions",
                  "organizations_url": "https://api.github.com/users/kriegcloud/orgs",
                  "repos_url": "https://api.github.com/users/kriegcloud/repos",
                  "events_url": "https://api.github.com/users/kriegcloud/events{/privacy}",
                  "received_events_url": "https://api.github.com/users/kriegcloud/received_events",
                  "type": "User",
                  "user_view_type": "public",
                  "site_admin": false
                }
              }
            ]
          },
          {
            "id": 68262107,
            "node_id": "GA_kwDOPbO_N84EEZjb",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 62506788,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k2MjUwNjc4OA==",
              "name": "professional-desktop-v*",
              "type": "tag"
            }
          ]
        }
      },
      {
        "id": 19794454685,
        "node_id": "EN_kwDOPbO_N88AAAAEm9donQ",
        "name": "turbo-cache-write",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/turbo-cache-write",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=turbo-cache-write",
        "created_at": "2026-08-13T04:49:23Z",
        "updated_at": "2026-08-13T04:49:23Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 62579093,
            "node_id": "GA_kwDOPbO_N84DuuGV",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [
          "TURBO_TOKEN"
        ],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 57211084,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k1NzIxMTA4NA==",
              "name": "main",
              "type": "branch"
            }
          ]
        }
      }
    ]
  },
  "actionsPermissions": {
    "enabled": true,
    "allowed_actions": "selected",
    "selected_actions_url": "https://api.github.com/repositories/1035190071/actions/permissions/selected-actions",
    "sha_pinning_required": true
  },
  "workflowPermissions": {
    "default_workflow_permissions": "read",
    "can_approve_pull_request_reviews": false
  },
  "allowedActions": {
    "github_owned_allowed": true,
    "patterns_allowed": [
      "oven-sh/setup-bun@*",
      "taiki-e/install-action@*",
      "actions-rust-lang/setup-rust-toolchain@*",
      "cachix/cachix-action@*",
      "cachix/install-nix-action@*",
      "google/osv-scanner-action/*",
      "changesets/action@*",
      "peter-evans/create-pull-request@*",
      "tauri-apps/tauri-action@*",
      "swatinem/rust-cache@*"
    ],
    "verified_allowed": false
  },
  "runnerGroups": {
    "total_count": 2,
    "runner_groups": [
      {
        "id": 1,
        "name": "Default",
        "visibility": "all",
        "allows_public_repositories": false,
        "default": true,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": false,
        "selected_workflows": [],
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/hosted-runners",
        "inherited": false
      },
      {
        "id": 4,
        "name": "beep-ec2-heavy",
        "visibility": "selected",
        "allows_public_repositories": true,
        "default": false,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": true,
        "selected_workflows": [
          "beep-effect/beep-effect/.github/workflows/cache-warm.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main"
        ],
        "selected_repositories_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/repositories",
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/hosted-runners",
        "inherited": false
      }
    ]
  },
  "repoSecretNames": [
    "APP_ENV",
    "APP_LOG_FORMAT",
    "APP_LOG_LEVEL",
    "APP_NAME",
    "NEXT_PUBLIC_ENV",
    "TURBO_READ_TOKEN",
    "TURBO_TEAM",
    "TURBO_TOKEN"
  ],
  "repoVariableNames": [
    "TURBO_API",
    "TURBO_TEAM"
  ],
  "security": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "disabled"
    },
    "dependabot_security_updates": {
      "status": "disabled"
    },
    "secret_scanning_non_provider_patterns": {
      "status": "disabled"
    },
    "secret_scanning_ai_detection": {
      "status": "disabled"
    },
    "secret_scanning_validity_checks": {
      "status": "disabled"
    },
    "secret_scanning_delegated_alert_dismissal": {
      "status": "disabled"
    }
  }
}
```

## before-disable-repo-law

```json
{
  "capturedAt": "2026-10-09T15:48:30.294391+00:00",
  "reason": "before-disable-repo-law",
  "ruleset": {
    "id": 10240248,
    "name": "main",
    "target": "branch",
    "source_type": "Repository",
    "source": "beep-effect/beep-effect",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "dismissal_restriction": {
            "enabled": false,
            "allowed_actors": []
          },
          "require_last_push_approval": false,
          "required_review_thread_resolution": false,
          "require_extra_approval_for_unattributed_changes": true,
          "allowed_merge_methods": [
            "merge",
            "squash",
            "rebase"
          ]
        }
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": false,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "Lint"
            },
            {
              "context": "Heavy / Check"
            },
            {
              "context": "Test Unit"
            },
            {
              "context": "Heavy / Test Integration"
            },
            {
              "context": "Heavy / Docgen"
            },
            {
              "context": "Codegen Drift"
            },
            {
              "context": "Repo Sanity"
            },
            {
              "context": "Knip"
            },
            {
              "context": "Commitlint"
            },
            {
              "context": "Secret Scanning"
            },
            {
              "context": "Security"
            },
            {
              "context": "SAST"
            },
            {
              "context": "Nix Shell"
            },
            {
              "context": "Professional Desktop IPC Stdio"
            },
            {
              "context": "Heavy / Doctest"
            },
            {
              "context": "JSDoc Ratchet"
            }
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec49s783zgCcQPg",
    "created_at": "2025-11-20T22:12:15.649-06:00",
    "updated_at": "2026-10-06T12:22:35.190-05:00",
    "bypass_actors": [
      {
        "actor_id": 5,
        "actor_type": "RepositoryRole",
        "bypass_mode": "always"
      }
    ],
    "current_user_can_bypass": "always",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/beep-effect/beep-effect/rulesets/10240248"
      },
      "html": {
        "href": "https://github.com/beep-effect/beep-effect/rules/10240248"
      }
    }
  },
  "environments": {
    "total_count": 20,
    "environments": [
      {
        "id": 8405246522,
        "node_id": "EN_kwDOPbO_N88AAAAB9P3iOg",
        "name": "Preview",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview",
        "created_at": "2025-08-29T08:53:27Z",
        "updated_at": "2025-08-29T08:53:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12362901528,
        "node_id": "EN_kwDOPbO_N88AAAAC4OLoGA",
        "name": "Preview \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:48:14Z",
        "updated_at": "2026-02-23T15:48:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509829194,
        "node_id": "EN_kwDOPbO_N88AAAACcm9ESg",
        "name": "Preview \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T23:17:32Z",
        "updated_at": "2025-12-08T23:17:32Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608667552,
        "node_id": "EN_kwDOPbO_N88AAAADolldoA",
        "name": "Preview \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web",
        "created_at": "2026-05-20T23:04:27Z",
        "updated_at": "2026-05-20T23:04:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608638351,
        "node_id": "EN_kwDOPbO_N88AAAADoljrjw",
        "name": "Preview \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T23:03:18Z",
        "updated_at": "2026-05-20T23:03:18Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747970857,
        "node_id": "EN_kwDOPbO_N88AAAAE1KzpKQ",
        "name": "Preview \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox",
        "created_at": "2026-08-27T23:11:02Z",
        "updated_at": "2026-08-27T23:11:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509838005,
        "node_id": "EN_kwDOPbO_N88AAAACcm9mtQ",
        "name": "Preview \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox-marketing",
        "created_at": "2025-12-08T23:18:08Z",
        "updated_at": "2025-12-08T23:18:08Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 8378951433,
        "node_id": "EN_kwDOPbO_N88AAAAB82ynCQ",
        "name": "Production",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production",
        "created_at": "2025-08-28T05:15:39Z",
        "updated_at": "2025-08-28T05:15:39Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12361471483,
        "node_id": "EN_kwDOPbO_N88AAAAC4M0V-w",
        "name": "Production \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:08:02Z",
        "updated_at": "2026-02-23T15:08:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508873515,
        "node_id": "EN_kwDOPbO_N88AAAACcmCvKw",
        "name": "Production \u2013 beep-effect-infra",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-infra",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-infra",
        "created_at": "2025-12-08T22:23:02Z",
        "updated_at": "2025-12-08T22:23:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508902705,
        "node_id": "EN_kwDOPbO_N88AAAACcmEhMQ",
        "name": "Production \u2013 beep-effect-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing",
        "created_at": "2025-12-08T22:24:37Z",
        "updated_at": "2025-12-08T22:24:37Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509067756,
        "node_id": "EN_kwDOPbO_N88AAAACcmOl7A",
        "name": "Production \u2013 beep-effect-marketing-jbbs",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs",
        "created_at": "2025-12-08T22:34:07Z",
        "updated_at": "2025-12-08T22:34:07Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509080887,
        "node_id": "EN_kwDOPbO_N88AAAACcmPZNw",
        "name": "Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs-1765233294724-vLlH",
        "created_at": "2025-12-08T22:34:56Z",
        "updated_at": "2025-12-08T22:34:56Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509082322,
        "node_id": "EN_kwDOPbO_N88AAAACcmPe0g",
        "name": "Production \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T22:35:00Z",
        "updated_at": "2025-12-08T22:35:00Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593208236,
        "node_id": "EN_kwDOPbO_N88AAAADoW15rA",
        "name": "Production \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web",
        "created_at": "2026-05-20T16:12:22Z",
        "updated_at": "2026-05-20T16:12:22Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593165597,
        "node_id": "EN_kwDOPbO_N88AAAADoWzTHQ",
        "name": "Production \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T16:11:14Z",
        "updated_at": "2026-05-20T16:11:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747728204,
        "node_id": "EN_kwDOPbO_N88AAAAE1Kk1TA",
        "name": "Production \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox",
        "created_at": "2026-08-27T23:05:12Z",
        "updated_at": "2026-08-27T23:05:12Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10543810464,
        "node_id": "EN_kwDOPbO_N88AAAACdHXHoA",
        "name": "Production \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox-marketing",
        "created_at": "2025-12-10T04:51:10Z",
        "updated_at": "2025-12-10T04:51:10Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 23892170137,
        "node_id": "EN_kwDOPbO_N88AAAAFkBWVmQ",
        "name": "professional-desktop-release",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/professional-desktop-release",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=professional-desktop-release",
        "created_at": "2026-10-09T15:46:21Z",
        "updated_at": "2026-10-09T15:46:21Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 68262106,
            "node_id": "GA_kwDOPbO_N84EEZja",
            "type": "required_reviewers",
            "prevent_self_review": false,
            "reviewers": [
              {
                "type": "User",
                "reviewer": {
                  "login": "kriegcloud",
                  "id": 106790222,
                  "node_id": "U_kgDOBl19Tg",
                  "avatar_url": "https://avatars.githubusercontent.com/u/106790222?v=4",
                  "gravatar_id": "",
                  "url": "https://api.github.com/users/kriegcloud",
                  "html_url": "https://github.com/kriegcloud",
                  "followers_url": "https://api.github.com/users/kriegcloud/followers",
                  "following_url": "https://api.github.com/users/kriegcloud/following{/other_user}",
                  "gists_url": "https://api.github.com/users/kriegcloud/gists{/gist_id}",
                  "starred_url": "https://api.github.com/users/kriegcloud/starred{/owner}{/repo}",
                  "subscriptions_url": "https://api.github.com/users/kriegcloud/subscriptions",
                  "organizations_url": "https://api.github.com/users/kriegcloud/orgs",
                  "repos_url": "https://api.github.com/users/kriegcloud/repos",
                  "events_url": "https://api.github.com/users/kriegcloud/events{/privacy}",
                  "received_events_url": "https://api.github.com/users/kriegcloud/received_events",
                  "type": "User",
                  "user_view_type": "public",
                  "site_admin": false
                }
              }
            ]
          },
          {
            "id": 68262107,
            "node_id": "GA_kwDOPbO_N84EEZjb",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 62506788,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k2MjUwNjc4OA==",
              "name": "professional-desktop-v*",
              "type": "tag"
            }
          ]
        }
      },
      {
        "id": 19794454685,
        "node_id": "EN_kwDOPbO_N88AAAAEm9donQ",
        "name": "turbo-cache-write",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/turbo-cache-write",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=turbo-cache-write",
        "created_at": "2026-08-13T04:49:23Z",
        "updated_at": "2026-08-13T04:49:23Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 62579093,
            "node_id": "GA_kwDOPbO_N84DuuGV",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [
          "TURBO_TOKEN"
        ],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 57211084,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k1NzIxMTA4NA==",
              "name": "main",
              "type": "branch"
            }
          ]
        }
      }
    ]
  },
  "actionsPermissions": {
    "enabled": true,
    "allowed_actions": "selected",
    "selected_actions_url": "https://api.github.com/repositories/1035190071/actions/permissions/selected-actions",
    "sha_pinning_required": true
  },
  "workflowPermissions": {
    "default_workflow_permissions": "read",
    "can_approve_pull_request_reviews": false
  },
  "allowedActions": {
    "github_owned_allowed": true,
    "patterns_allowed": [
      "oven-sh/setup-bun@*",
      "taiki-e/install-action@*",
      "actions-rust-lang/setup-rust-toolchain@*",
      "cachix/cachix-action@*",
      "cachix/install-nix-action@*",
      "google/osv-scanner-action/*",
      "changesets/action@*",
      "peter-evans/create-pull-request@*",
      "tauri-apps/tauri-action@*",
      "swatinem/rust-cache@*"
    ],
    "verified_allowed": false
  },
  "runnerGroups": {
    "total_count": 2,
    "runner_groups": [
      {
        "id": 1,
        "name": "Default",
        "visibility": "all",
        "allows_public_repositories": false,
        "default": true,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": false,
        "selected_workflows": [],
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/hosted-runners",
        "inherited": false
      },
      {
        "id": 4,
        "name": "beep-ec2-heavy",
        "visibility": "selected",
        "allows_public_repositories": true,
        "default": false,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": true,
        "selected_workflows": [
          "beep-effect/beep-effect/.github/workflows/cache-warm.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main"
        ],
        "selected_repositories_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/repositories",
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/hosted-runners",
        "inherited": false
      }
    ]
  },
  "repoSecretNames": [
    "APP_ENV",
    "APP_LOG_FORMAT",
    "APP_LOG_LEVEL",
    "APP_NAME",
    "NEXT_PUBLIC_ENV",
    "TURBO_READ_TOKEN",
    "TURBO_TEAM",
    "TURBO_TOKEN"
  ],
  "repoVariableNames": [
    "TURBO_API",
    "TURBO_TEAM"
  ],
  "security": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "disabled"
    },
    "dependabot_security_updates": {
      "status": "disabled"
    },
    "secret_scanning_non_provider_patterns": {
      "status": "disabled"
    },
    "secret_scanning_ai_detection": {
      "status": "disabled"
    },
    "secret_scanning_validity_checks": {
      "status": "disabled"
    },
    "secret_scanning_delegated_alert_dismissal": {
      "status": "disabled"
    }
  }
}
```

## before-push-protection

```json
{
  "capturedAt": "2026-10-09T15:49:19.947868+00:00",
  "reason": "before-push-protection",
  "ruleset": {
    "id": 10240248,
    "name": "main",
    "target": "branch",
    "source_type": "Repository",
    "source": "beep-effect/beep-effect",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "dismissal_restriction": {
            "enabled": false,
            "allowed_actors": []
          },
          "require_last_push_approval": false,
          "required_review_thread_resolution": false,
          "require_extra_approval_for_unattributed_changes": true,
          "allowed_merge_methods": [
            "merge",
            "squash",
            "rebase"
          ]
        }
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": false,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "Lint"
            },
            {
              "context": "Heavy / Check"
            },
            {
              "context": "Test Unit"
            },
            {
              "context": "Heavy / Test Integration"
            },
            {
              "context": "Heavy / Docgen"
            },
            {
              "context": "Codegen Drift"
            },
            {
              "context": "Repo Sanity"
            },
            {
              "context": "Knip"
            },
            {
              "context": "Commitlint"
            },
            {
              "context": "Secret Scanning"
            },
            {
              "context": "Security"
            },
            {
              "context": "SAST"
            },
            {
              "context": "Nix Shell"
            },
            {
              "context": "Professional Desktop IPC Stdio"
            },
            {
              "context": "Heavy / Doctest"
            },
            {
              "context": "JSDoc Ratchet"
            }
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec49s783zgCcQPg",
    "created_at": "2025-11-20T22:12:15.649-06:00",
    "updated_at": "2026-10-06T12:22:35.190-05:00",
    "bypass_actors": [
      {
        "actor_id": 5,
        "actor_type": "RepositoryRole",
        "bypass_mode": "always"
      }
    ],
    "current_user_can_bypass": "always",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/beep-effect/beep-effect/rulesets/10240248"
      },
      "html": {
        "href": "https://github.com/beep-effect/beep-effect/rules/10240248"
      }
    }
  },
  "environments": {
    "total_count": 20,
    "environments": [
      {
        "id": 8405246522,
        "node_id": "EN_kwDOPbO_N88AAAAB9P3iOg",
        "name": "Preview",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview",
        "created_at": "2025-08-29T08:53:27Z",
        "updated_at": "2025-08-29T08:53:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12362901528,
        "node_id": "EN_kwDOPbO_N88AAAAC4OLoGA",
        "name": "Preview \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:48:14Z",
        "updated_at": "2026-02-23T15:48:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509829194,
        "node_id": "EN_kwDOPbO_N88AAAACcm9ESg",
        "name": "Preview \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T23:17:32Z",
        "updated_at": "2025-12-08T23:17:32Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608667552,
        "node_id": "EN_kwDOPbO_N88AAAADolldoA",
        "name": "Preview \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web",
        "created_at": "2026-05-20T23:04:27Z",
        "updated_at": "2026-05-20T23:04:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608638351,
        "node_id": "EN_kwDOPbO_N88AAAADoljrjw",
        "name": "Preview \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T23:03:18Z",
        "updated_at": "2026-05-20T23:03:18Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747970857,
        "node_id": "EN_kwDOPbO_N88AAAAE1KzpKQ",
        "name": "Preview \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox",
        "created_at": "2026-08-27T23:11:02Z",
        "updated_at": "2026-08-27T23:11:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509838005,
        "node_id": "EN_kwDOPbO_N88AAAACcm9mtQ",
        "name": "Preview \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox-marketing",
        "created_at": "2025-12-08T23:18:08Z",
        "updated_at": "2025-12-08T23:18:08Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 8378951433,
        "node_id": "EN_kwDOPbO_N88AAAAB82ynCQ",
        "name": "Production",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production",
        "created_at": "2025-08-28T05:15:39Z",
        "updated_at": "2025-08-28T05:15:39Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12361471483,
        "node_id": "EN_kwDOPbO_N88AAAAC4M0V-w",
        "name": "Production \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:08:02Z",
        "updated_at": "2026-02-23T15:08:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508873515,
        "node_id": "EN_kwDOPbO_N88AAAACcmCvKw",
        "name": "Production \u2013 beep-effect-infra",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-infra",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-infra",
        "created_at": "2025-12-08T22:23:02Z",
        "updated_at": "2025-12-08T22:23:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508902705,
        "node_id": "EN_kwDOPbO_N88AAAACcmEhMQ",
        "name": "Production \u2013 beep-effect-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing",
        "created_at": "2025-12-08T22:24:37Z",
        "updated_at": "2025-12-08T22:24:37Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509067756,
        "node_id": "EN_kwDOPbO_N88AAAACcmOl7A",
        "name": "Production \u2013 beep-effect-marketing-jbbs",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs",
        "created_at": "2025-12-08T22:34:07Z",
        "updated_at": "2025-12-08T22:34:07Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509080887,
        "node_id": "EN_kwDOPbO_N88AAAACcmPZNw",
        "name": "Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs-1765233294724-vLlH",
        "created_at": "2025-12-08T22:34:56Z",
        "updated_at": "2025-12-08T22:34:56Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509082322,
        "node_id": "EN_kwDOPbO_N88AAAACcmPe0g",
        "name": "Production \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T22:35:00Z",
        "updated_at": "2025-12-08T22:35:00Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593208236,
        "node_id": "EN_kwDOPbO_N88AAAADoW15rA",
        "name": "Production \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web",
        "created_at": "2026-05-20T16:12:22Z",
        "updated_at": "2026-05-20T16:12:22Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593165597,
        "node_id": "EN_kwDOPbO_N88AAAADoWzTHQ",
        "name": "Production \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T16:11:14Z",
        "updated_at": "2026-05-20T16:11:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747728204,
        "node_id": "EN_kwDOPbO_N88AAAAE1Kk1TA",
        "name": "Production \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox",
        "created_at": "2026-08-27T23:05:12Z",
        "updated_at": "2026-08-27T23:05:12Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10543810464,
        "node_id": "EN_kwDOPbO_N88AAAACdHXHoA",
        "name": "Production \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox-marketing",
        "created_at": "2025-12-10T04:51:10Z",
        "updated_at": "2025-12-10T04:51:10Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 23892170137,
        "node_id": "EN_kwDOPbO_N88AAAAFkBWVmQ",
        "name": "professional-desktop-release",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/professional-desktop-release",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=professional-desktop-release",
        "created_at": "2026-10-09T15:46:21Z",
        "updated_at": "2026-10-09T15:46:21Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 68262106,
            "node_id": "GA_kwDOPbO_N84EEZja",
            "type": "required_reviewers",
            "prevent_self_review": false,
            "reviewers": [
              {
                "type": "User",
                "reviewer": {
                  "login": "kriegcloud",
                  "id": 106790222,
                  "node_id": "U_kgDOBl19Tg",
                  "avatar_url": "https://avatars.githubusercontent.com/u/106790222?v=4",
                  "gravatar_id": "",
                  "url": "https://api.github.com/users/kriegcloud",
                  "html_url": "https://github.com/kriegcloud",
                  "followers_url": "https://api.github.com/users/kriegcloud/followers",
                  "following_url": "https://api.github.com/users/kriegcloud/following{/other_user}",
                  "gists_url": "https://api.github.com/users/kriegcloud/gists{/gist_id}",
                  "starred_url": "https://api.github.com/users/kriegcloud/starred{/owner}{/repo}",
                  "subscriptions_url": "https://api.github.com/users/kriegcloud/subscriptions",
                  "organizations_url": "https://api.github.com/users/kriegcloud/orgs",
                  "repos_url": "https://api.github.com/users/kriegcloud/repos",
                  "events_url": "https://api.github.com/users/kriegcloud/events{/privacy}",
                  "received_events_url": "https://api.github.com/users/kriegcloud/received_events",
                  "type": "User",
                  "user_view_type": "public",
                  "site_admin": false
                }
              }
            ]
          },
          {
            "id": 68262107,
            "node_id": "GA_kwDOPbO_N84EEZjb",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 62506788,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k2MjUwNjc4OA==",
              "name": "professional-desktop-v*",
              "type": "tag"
            }
          ]
        }
      },
      {
        "id": 19794454685,
        "node_id": "EN_kwDOPbO_N88AAAAEm9donQ",
        "name": "turbo-cache-write",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/turbo-cache-write",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=turbo-cache-write",
        "created_at": "2026-08-13T04:49:23Z",
        "updated_at": "2026-08-13T04:49:23Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 62579093,
            "node_id": "GA_kwDOPbO_N84DuuGV",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [
          "TURBO_TOKEN"
        ],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 57211084,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k1NzIxMTA4NA==",
              "name": "main",
              "type": "branch"
            }
          ]
        }
      }
    ]
  },
  "actionsPermissions": {
    "enabled": true,
    "allowed_actions": "selected",
    "selected_actions_url": "https://api.github.com/repositories/1035190071/actions/permissions/selected-actions",
    "sha_pinning_required": true
  },
  "workflowPermissions": {
    "default_workflow_permissions": "read",
    "can_approve_pull_request_reviews": false
  },
  "allowedActions": {
    "github_owned_allowed": true,
    "patterns_allowed": [
      "oven-sh/setup-bun@*",
      "taiki-e/install-action@*",
      "actions-rust-lang/setup-rust-toolchain@*",
      "cachix/cachix-action@*",
      "cachix/install-nix-action@*",
      "google/osv-scanner-action/*",
      "changesets/action@*",
      "peter-evans/create-pull-request@*",
      "tauri-apps/tauri-action@*",
      "swatinem/rust-cache@*"
    ],
    "verified_allowed": false
  },
  "runnerGroups": {
    "total_count": 2,
    "runner_groups": [
      {
        "id": 1,
        "name": "Default",
        "visibility": "all",
        "allows_public_repositories": false,
        "default": true,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": false,
        "selected_workflows": [],
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/hosted-runners",
        "inherited": false
      },
      {
        "id": 4,
        "name": "beep-ec2-heavy",
        "visibility": "selected",
        "allows_public_repositories": true,
        "default": false,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": true,
        "selected_workflows": [
          "beep-effect/beep-effect/.github/workflows/cache-warm.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main"
        ],
        "selected_repositories_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/repositories",
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/hosted-runners",
        "inherited": false
      }
    ]
  },
  "repoSecretNames": [
    "APP_ENV",
    "APP_LOG_FORMAT",
    "APP_LOG_LEVEL",
    "APP_NAME",
    "NEXT_PUBLIC_ENV",
    "TURBO_READ_TOKEN",
    "TURBO_TEAM",
    "TURBO_TOKEN"
  ],
  "repoVariableNames": [
    "TURBO_API",
    "TURBO_TEAM"
  ],
  "security": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "disabled"
    },
    "dependabot_security_updates": {
      "status": "disabled"
    },
    "secret_scanning_non_provider_patterns": {
      "status": "disabled"
    },
    "secret_scanning_ai_detection": {
      "status": "disabled"
    },
    "secret_scanning_validity_checks": {
      "status": "disabled"
    },
    "secret_scanning_delegated_alert_dismissal": {
      "status": "disabled"
    }
  }
}
```

## before-ruleset-hardening

```json
{
  "capturedAt": "2026-10-09T15:56:04.809398+00:00",
  "reason": "before-ruleset-hardening",
  "ruleset": {
    "id": 10240248,
    "name": "main",
    "target": "branch",
    "source_type": "Repository",
    "source": "beep-effect/beep-effect",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "dismissal_restriction": {
            "enabled": false,
            "allowed_actors": []
          },
          "require_last_push_approval": false,
          "required_review_thread_resolution": false,
          "require_extra_approval_for_unattributed_changes": true,
          "allowed_merge_methods": [
            "merge",
            "squash",
            "rebase"
          ]
        }
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": false,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "Lint"
            },
            {
              "context": "Heavy / Check"
            },
            {
              "context": "Test Unit"
            },
            {
              "context": "Heavy / Test Integration"
            },
            {
              "context": "Heavy / Docgen"
            },
            {
              "context": "Codegen Drift"
            },
            {
              "context": "Repo Sanity"
            },
            {
              "context": "Knip"
            },
            {
              "context": "Commitlint"
            },
            {
              "context": "Secret Scanning"
            },
            {
              "context": "Security"
            },
            {
              "context": "SAST"
            },
            {
              "context": "Nix Shell"
            },
            {
              "context": "Professional Desktop IPC Stdio"
            },
            {
              "context": "Heavy / Doctest"
            },
            {
              "context": "JSDoc Ratchet"
            }
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec49s783zgCcQPg",
    "created_at": "2025-11-20T22:12:15.649-06:00",
    "updated_at": "2026-10-06T12:22:35.190-05:00",
    "bypass_actors": [
      {
        "actor_id": 5,
        "actor_type": "RepositoryRole",
        "bypass_mode": "always"
      }
    ],
    "current_user_can_bypass": "always",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/beep-effect/beep-effect/rulesets/10240248"
      },
      "html": {
        "href": "https://github.com/beep-effect/beep-effect/rules/10240248"
      }
    }
  },
  "environments": {
    "total_count": 20,
    "environments": [
      {
        "id": 8405246522,
        "node_id": "EN_kwDOPbO_N88AAAAB9P3iOg",
        "name": "Preview",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview",
        "created_at": "2025-08-29T08:53:27Z",
        "updated_at": "2025-08-29T08:53:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12362901528,
        "node_id": "EN_kwDOPbO_N88AAAAC4OLoGA",
        "name": "Preview \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:48:14Z",
        "updated_at": "2026-02-23T15:48:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509829194,
        "node_id": "EN_kwDOPbO_N88AAAACcm9ESg",
        "name": "Preview \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T23:17:32Z",
        "updated_at": "2025-12-08T23:17:32Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608667552,
        "node_id": "EN_kwDOPbO_N88AAAADolldoA",
        "name": "Preview \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web",
        "created_at": "2026-05-20T23:04:27Z",
        "updated_at": "2026-05-20T23:04:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608638351,
        "node_id": "EN_kwDOPbO_N88AAAADoljrjw",
        "name": "Preview \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T23:03:18Z",
        "updated_at": "2026-05-20T23:03:18Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747970857,
        "node_id": "EN_kwDOPbO_N88AAAAE1KzpKQ",
        "name": "Preview \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox",
        "created_at": "2026-08-27T23:11:02Z",
        "updated_at": "2026-08-27T23:11:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509838005,
        "node_id": "EN_kwDOPbO_N88AAAACcm9mtQ",
        "name": "Preview \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox-marketing",
        "created_at": "2025-12-08T23:18:08Z",
        "updated_at": "2025-12-08T23:18:08Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 8378951433,
        "node_id": "EN_kwDOPbO_N88AAAAB82ynCQ",
        "name": "Production",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production",
        "created_at": "2025-08-28T05:15:39Z",
        "updated_at": "2025-08-28T05:15:39Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12361471483,
        "node_id": "EN_kwDOPbO_N88AAAAC4M0V-w",
        "name": "Production \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:08:02Z",
        "updated_at": "2026-02-23T15:08:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508873515,
        "node_id": "EN_kwDOPbO_N88AAAACcmCvKw",
        "name": "Production \u2013 beep-effect-infra",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-infra",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-infra",
        "created_at": "2025-12-08T22:23:02Z",
        "updated_at": "2025-12-08T22:23:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508902705,
        "node_id": "EN_kwDOPbO_N88AAAACcmEhMQ",
        "name": "Production \u2013 beep-effect-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing",
        "created_at": "2025-12-08T22:24:37Z",
        "updated_at": "2025-12-08T22:24:37Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509067756,
        "node_id": "EN_kwDOPbO_N88AAAACcmOl7A",
        "name": "Production \u2013 beep-effect-marketing-jbbs",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs",
        "created_at": "2025-12-08T22:34:07Z",
        "updated_at": "2025-12-08T22:34:07Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509080887,
        "node_id": "EN_kwDOPbO_N88AAAACcmPZNw",
        "name": "Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs-1765233294724-vLlH",
        "created_at": "2025-12-08T22:34:56Z",
        "updated_at": "2025-12-08T22:34:56Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509082322,
        "node_id": "EN_kwDOPbO_N88AAAACcmPe0g",
        "name": "Production \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T22:35:00Z",
        "updated_at": "2025-12-08T22:35:00Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593208236,
        "node_id": "EN_kwDOPbO_N88AAAADoW15rA",
        "name": "Production \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web",
        "created_at": "2026-05-20T16:12:22Z",
        "updated_at": "2026-05-20T16:12:22Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593165597,
        "node_id": "EN_kwDOPbO_N88AAAADoWzTHQ",
        "name": "Production \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T16:11:14Z",
        "updated_at": "2026-05-20T16:11:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747728204,
        "node_id": "EN_kwDOPbO_N88AAAAE1Kk1TA",
        "name": "Production \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox",
        "created_at": "2026-08-27T23:05:12Z",
        "updated_at": "2026-08-27T23:05:12Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10543810464,
        "node_id": "EN_kwDOPbO_N88AAAACdHXHoA",
        "name": "Production \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox-marketing",
        "created_at": "2025-12-10T04:51:10Z",
        "updated_at": "2025-12-10T04:51:10Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 23892170137,
        "node_id": "EN_kwDOPbO_N88AAAAFkBWVmQ",
        "name": "professional-desktop-release",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/professional-desktop-release",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=professional-desktop-release",
        "created_at": "2026-10-09T15:46:21Z",
        "updated_at": "2026-10-09T15:46:21Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 68262106,
            "node_id": "GA_kwDOPbO_N84EEZja",
            "type": "required_reviewers",
            "prevent_self_review": false,
            "reviewers": [
              {
                "type": "User",
                "reviewer": {
                  "login": "kriegcloud",
                  "id": 106790222,
                  "node_id": "U_kgDOBl19Tg",
                  "avatar_url": "https://avatars.githubusercontent.com/u/106790222?v=4",
                  "gravatar_id": "",
                  "url": "https://api.github.com/users/kriegcloud",
                  "html_url": "https://github.com/kriegcloud",
                  "followers_url": "https://api.github.com/users/kriegcloud/followers",
                  "following_url": "https://api.github.com/users/kriegcloud/following{/other_user}",
                  "gists_url": "https://api.github.com/users/kriegcloud/gists{/gist_id}",
                  "starred_url": "https://api.github.com/users/kriegcloud/starred{/owner}{/repo}",
                  "subscriptions_url": "https://api.github.com/users/kriegcloud/subscriptions",
                  "organizations_url": "https://api.github.com/users/kriegcloud/orgs",
                  "repos_url": "https://api.github.com/users/kriegcloud/repos",
                  "events_url": "https://api.github.com/users/kriegcloud/events{/privacy}",
                  "received_events_url": "https://api.github.com/users/kriegcloud/received_events",
                  "type": "User",
                  "user_view_type": "public",
                  "site_admin": false
                }
              }
            ]
          },
          {
            "id": 68262107,
            "node_id": "GA_kwDOPbO_N84EEZjb",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 62506788,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k2MjUwNjc4OA==",
              "name": "professional-desktop-v*",
              "type": "tag"
            }
          ]
        }
      },
      {
        "id": 19794454685,
        "node_id": "EN_kwDOPbO_N88AAAAEm9donQ",
        "name": "turbo-cache-write",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/turbo-cache-write",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=turbo-cache-write",
        "created_at": "2026-08-13T04:49:23Z",
        "updated_at": "2026-08-13T04:49:23Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 62579093,
            "node_id": "GA_kwDOPbO_N84DuuGV",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [
          "TURBO_TOKEN"
        ],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 57211084,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k1NzIxMTA4NA==",
              "name": "main",
              "type": "branch"
            }
          ]
        }
      }
    ]
  },
  "actionsPermissions": {
    "enabled": true,
    "allowed_actions": "selected",
    "selected_actions_url": "https://api.github.com/repositories/1035190071/actions/permissions/selected-actions",
    "sha_pinning_required": true
  },
  "workflowPermissions": {
    "default_workflow_permissions": "read",
    "can_approve_pull_request_reviews": false
  },
  "allowedActions": {
    "github_owned_allowed": true,
    "patterns_allowed": [
      "oven-sh/setup-bun@*",
      "taiki-e/install-action@*",
      "actions-rust-lang/setup-rust-toolchain@*",
      "cachix/cachix-action@*",
      "cachix/install-nix-action@*",
      "google/osv-scanner-action/*",
      "changesets/action@*",
      "peter-evans/create-pull-request@*",
      "tauri-apps/tauri-action@*",
      "swatinem/rust-cache@*"
    ],
    "verified_allowed": false
  },
  "runnerGroups": {
    "total_count": 2,
    "runner_groups": [
      {
        "id": 1,
        "name": "Default",
        "visibility": "all",
        "allows_public_repositories": false,
        "default": true,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": false,
        "selected_workflows": [],
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/hosted-runners",
        "inherited": false
      },
      {
        "id": 4,
        "name": "beep-ec2-heavy",
        "visibility": "selected",
        "allows_public_repositories": true,
        "default": false,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": true,
        "selected_workflows": [
          "beep-effect/beep-effect/.github/workflows/cache-warm.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main"
        ],
        "selected_repositories_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/repositories",
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/hosted-runners",
        "inherited": false
      }
    ]
  },
  "repoSecretNames": [
    "APP_ENV",
    "APP_LOG_FORMAT",
    "APP_LOG_LEVEL",
    "APP_NAME",
    "NEXT_PUBLIC_ENV",
    "TURBO_READ_TOKEN",
    "TURBO_TEAM",
    "TURBO_TOKEN"
  ],
  "repoVariableNames": [
    "TURBO_API",
    "TURBO_TEAM"
  ],
  "security": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "enabled"
    },
    "dependabot_security_updates": {
      "status": "disabled"
    },
    "secret_scanning_non_provider_patterns": {
      "status": "disabled"
    },
    "secret_scanning_ai_detection": {
      "status": "disabled"
    },
    "secret_scanning_validity_checks": {
      "status": "disabled"
    },
    "secret_scanning_delegated_alert_dismissal": {
      "status": "disabled"
    },
    "secret_scanning_delegated_bypass": {
      "status": "disabled"
    }
  }
}
```

## Ruleset recovery command

The writable prior payload is committed at `stage-3-ruleset-prior.json`. Restore the pre-hardening state with:

```sh
gh api -X PUT repos/beep-effect/beep-effect/rulesets/10240248 \
  --input goals/repository-simplification-confidence/history/receipts/stage-3-ruleset-prior.json
```

Before S3 removes Knip, capture again and derive the payload from the current ruleset, preserving any intervening settings edits. The lane's private `.beep/rsc-e/knip-ruleset-at-gate.json` is a prepared example, not an authorization to write a stale payload. Reversal of that gate restores the immediately preceding writable snapshot, reverts the Knip workflow/descriptor PR, then re-captures the context snapshot.

## before-runner-group-narrowing

```json
{
  "capturedAt": "2026-10-09T19:22:28.314759+00:00",
  "reason": "before-runner-group-narrowing",
  "ruleset": {
    "id": 10240248,
    "name": "main",
    "target": "branch",
    "source_type": "Repository",
    "source": "beep-effect/beep-effect",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "dismissal_restriction": {
            "enabled": false,
            "allowed_actors": []
          },
          "require_last_push_approval": false,
          "required_review_thread_resolution": true,
          "require_extra_approval_for_unattributed_changes": true,
          "allowed_merge_methods": [
            "merge",
            "squash",
            "rebase"
          ]
        }
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": false,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "Lint",
              "integration_id": 15368
            },
            {
              "context": "Heavy / Check",
              "integration_id": 15368
            },
            {
              "context": "Test Unit",
              "integration_id": 15368
            },
            {
              "context": "Heavy / Test Integration",
              "integration_id": 15368
            },
            {
              "context": "Heavy / Docgen",
              "integration_id": 15368
            },
            {
              "context": "Codegen Drift",
              "integration_id": 15368
            },
            {
              "context": "Repo Sanity",
              "integration_id": 15368
            },
            {
              "context": "Knip",
              "integration_id": 15368
            },
            {
              "context": "Commitlint",
              "integration_id": 15368
            },
            {
              "context": "Secret Scanning",
              "integration_id": 15368
            },
            {
              "context": "Security",
              "integration_id": 15368
            },
            {
              "context": "SAST",
              "integration_id": 15368
            },
            {
              "context": "Nix Shell",
              "integration_id": 15368
            },
            {
              "context": "Professional Desktop IPC Stdio",
              "integration_id": 15368
            },
            {
              "context": "Heavy / Doctest",
              "integration_id": 15368
            },
            {
              "context": "JSDoc Ratchet",
              "integration_id": 15368
            }
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec49s783zgCcQPg",
    "created_at": "2025-11-20T22:12:15.649-06:00",
    "updated_at": "2026-10-09T10:56:30.797-05:00",
    "bypass_actors": [
      {
        "actor_id": 5,
        "actor_type": "RepositoryRole",
        "bypass_mode": "always"
      }
    ],
    "current_user_can_bypass": "always",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/beep-effect/beep-effect/rulesets/10240248"
      },
      "html": {
        "href": "https://github.com/beep-effect/beep-effect/rules/10240248"
      }
    }
  },
  "environments": {
    "total_count": 20,
    "environments": [
      {
        "id": 8405246522,
        "node_id": "EN_kwDOPbO_N88AAAAB9P3iOg",
        "name": "Preview",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview",
        "created_at": "2025-08-29T08:53:27Z",
        "updated_at": "2025-08-29T08:53:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12362901528,
        "node_id": "EN_kwDOPbO_N88AAAAC4OLoGA",
        "name": "Preview \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:48:14Z",
        "updated_at": "2026-02-23T15:48:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509829194,
        "node_id": "EN_kwDOPbO_N88AAAACcm9ESg",
        "name": "Preview \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T23:17:32Z",
        "updated_at": "2025-12-08T23:17:32Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608667552,
        "node_id": "EN_kwDOPbO_N88AAAADolldoA",
        "name": "Preview \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web",
        "created_at": "2026-05-20T23:04:27Z",
        "updated_at": "2026-05-20T23:04:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608638351,
        "node_id": "EN_kwDOPbO_N88AAAADoljrjw",
        "name": "Preview \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T23:03:18Z",
        "updated_at": "2026-05-20T23:03:18Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747970857,
        "node_id": "EN_kwDOPbO_N88AAAAE1KzpKQ",
        "name": "Preview \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox",
        "created_at": "2026-08-27T23:11:02Z",
        "updated_at": "2026-08-27T23:11:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509838005,
        "node_id": "EN_kwDOPbO_N88AAAACcm9mtQ",
        "name": "Preview \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox-marketing",
        "created_at": "2025-12-08T23:18:08Z",
        "updated_at": "2025-12-08T23:18:08Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 8378951433,
        "node_id": "EN_kwDOPbO_N88AAAAB82ynCQ",
        "name": "Production",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production",
        "created_at": "2025-08-28T05:15:39Z",
        "updated_at": "2025-08-28T05:15:39Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12361471483,
        "node_id": "EN_kwDOPbO_N88AAAAC4M0V-w",
        "name": "Production \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:08:02Z",
        "updated_at": "2026-02-23T15:08:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508873515,
        "node_id": "EN_kwDOPbO_N88AAAACcmCvKw",
        "name": "Production \u2013 beep-effect-infra",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-infra",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-infra",
        "created_at": "2025-12-08T22:23:02Z",
        "updated_at": "2025-12-08T22:23:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508902705,
        "node_id": "EN_kwDOPbO_N88AAAACcmEhMQ",
        "name": "Production \u2013 beep-effect-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing",
        "created_at": "2025-12-08T22:24:37Z",
        "updated_at": "2025-12-08T22:24:37Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509067756,
        "node_id": "EN_kwDOPbO_N88AAAACcmOl7A",
        "name": "Production \u2013 beep-effect-marketing-jbbs",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs",
        "created_at": "2025-12-08T22:34:07Z",
        "updated_at": "2025-12-08T22:34:07Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509080887,
        "node_id": "EN_kwDOPbO_N88AAAACcmPZNw",
        "name": "Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs-1765233294724-vLlH",
        "created_at": "2025-12-08T22:34:56Z",
        "updated_at": "2025-12-08T22:34:56Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509082322,
        "node_id": "EN_kwDOPbO_N88AAAACcmPe0g",
        "name": "Production \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T22:35:00Z",
        "updated_at": "2025-12-08T22:35:00Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593208236,
        "node_id": "EN_kwDOPbO_N88AAAADoW15rA",
        "name": "Production \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web",
        "created_at": "2026-05-20T16:12:22Z",
        "updated_at": "2026-05-20T16:12:22Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593165597,
        "node_id": "EN_kwDOPbO_N88AAAADoWzTHQ",
        "name": "Production \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T16:11:14Z",
        "updated_at": "2026-05-20T16:11:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747728204,
        "node_id": "EN_kwDOPbO_N88AAAAE1Kk1TA",
        "name": "Production \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox",
        "created_at": "2026-08-27T23:05:12Z",
        "updated_at": "2026-08-27T23:05:12Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10543810464,
        "node_id": "EN_kwDOPbO_N88AAAACdHXHoA",
        "name": "Production \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox-marketing",
        "created_at": "2025-12-10T04:51:10Z",
        "updated_at": "2025-12-10T04:51:10Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 23892170137,
        "node_id": "EN_kwDOPbO_N88AAAAFkBWVmQ",
        "name": "professional-desktop-release",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/professional-desktop-release",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=professional-desktop-release",
        "created_at": "2026-10-09T15:46:21Z",
        "updated_at": "2026-10-09T15:46:21Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 68262106,
            "node_id": "GA_kwDOPbO_N84EEZja",
            "type": "required_reviewers",
            "prevent_self_review": false,
            "reviewers": [
              {
                "type": "User",
                "reviewer": {
                  "login": "kriegcloud",
                  "id": 106790222,
                  "node_id": "U_kgDOBl19Tg",
                  "avatar_url": "https://avatars.githubusercontent.com/u/106790222?v=4",
                  "gravatar_id": "",
                  "url": "https://api.github.com/users/kriegcloud",
                  "html_url": "https://github.com/kriegcloud",
                  "followers_url": "https://api.github.com/users/kriegcloud/followers",
                  "following_url": "https://api.github.com/users/kriegcloud/following{/other_user}",
                  "gists_url": "https://api.github.com/users/kriegcloud/gists{/gist_id}",
                  "starred_url": "https://api.github.com/users/kriegcloud/starred{/owner}{/repo}",
                  "subscriptions_url": "https://api.github.com/users/kriegcloud/subscriptions",
                  "organizations_url": "https://api.github.com/users/kriegcloud/orgs",
                  "repos_url": "https://api.github.com/users/kriegcloud/repos",
                  "events_url": "https://api.github.com/users/kriegcloud/events{/privacy}",
                  "received_events_url": "https://api.github.com/users/kriegcloud/received_events",
                  "type": "User",
                  "user_view_type": "public",
                  "site_admin": false
                }
              }
            ]
          },
          {
            "id": 68262107,
            "node_id": "GA_kwDOPbO_N84EEZjb",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 62506788,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k2MjUwNjc4OA==",
              "name": "professional-desktop-v*",
              "type": "tag"
            }
          ]
        }
      },
      {
        "id": 19794454685,
        "node_id": "EN_kwDOPbO_N88AAAAEm9donQ",
        "name": "turbo-cache-write",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/turbo-cache-write",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=turbo-cache-write",
        "created_at": "2026-08-13T04:49:23Z",
        "updated_at": "2026-08-13T04:49:23Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 62579093,
            "node_id": "GA_kwDOPbO_N84DuuGV",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [
          "TURBO_TOKEN"
        ],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 57211084,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k1NzIxMTA4NA==",
              "name": "main",
              "type": "branch"
            }
          ]
        }
      }
    ]
  },
  "actionsPermissions": {
    "enabled": true,
    "allowed_actions": "selected",
    "selected_actions_url": "https://api.github.com/repositories/1035190071/actions/permissions/selected-actions",
    "sha_pinning_required": true
  },
  "workflowPermissions": {
    "default_workflow_permissions": "read",
    "can_approve_pull_request_reviews": false
  },
  "allowedActions": {
    "github_owned_allowed": true,
    "patterns_allowed": [
      "oven-sh/setup-bun@*",
      "taiki-e/install-action@*",
      "actions-rust-lang/setup-rust-toolchain@*",
      "cachix/cachix-action@*",
      "cachix/install-nix-action@*",
      "google/osv-scanner-action/*",
      "changesets/action@*",
      "peter-evans/create-pull-request@*",
      "tauri-apps/tauri-action@*",
      "swatinem/rust-cache@*"
    ],
    "verified_allowed": false
  },
  "runnerGroups": {
    "total_count": 2,
    "runner_groups": [
      {
        "id": 1,
        "name": "Default",
        "visibility": "all",
        "allows_public_repositories": false,
        "default": true,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": false,
        "selected_workflows": [],
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/hosted-runners",
        "inherited": false
      },
      {
        "id": 4,
        "name": "beep-ec2-heavy",
        "visibility": "selected",
        "allows_public_repositories": true,
        "default": false,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": true,
        "selected_workflows": [
          "beep-effect/beep-effect/.github/workflows/cache-warm.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main"
        ],
        "selected_repositories_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/repositories",
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/hosted-runners",
        "inherited": false
      }
    ]
  },
  "repoSecretNames": [
    "APP_ENV",
    "APP_LOG_FORMAT",
    "APP_LOG_LEVEL",
    "APP_NAME",
    "NEXT_PUBLIC_ENV",
    "TURBO_READ_TOKEN",
    "TURBO_TEAM",
    "TURBO_TOKEN"
  ],
  "repoVariableNames": [
    "TURBO_API",
    "TURBO_TEAM"
  ],
  "security": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "enabled"
    },
    "dependabot_security_updates": {
      "status": "disabled"
    },
    "secret_scanning_non_provider_patterns": {
      "status": "disabled"
    },
    "secret_scanning_ai_detection": {
      "status": "disabled"
    },
    "secret_scanning_validity_checks": {
      "status": "disabled"
    },
    "secret_scanning_delegated_alert_dismissal": {
      "status": "disabled"
    },
    "secret_scanning_delegated_bypass": {
      "status": "disabled"
    }
  }
}
```

Readback: runner group 4 remains restricted, with Cache Warm, fleet lane probe, fleet shadow check and reusable Heavy at main. Only the unused Check caller was removed. All seven Heavy jobs in [program PR probe run 37974783576](https://github.com/beep-effect/beep-effect/actions/runs/37974783576) were assigned to group 4 under the unlisted Heavy Admit caller. No runner or repository membership changed.

## before-changesets-action-allowlist

```json
{
  "capturedAt": "2026-10-09T19:25:04.571892+00:00",
  "reason": "before-changesets-action-allowlist",
  "ruleset": {
    "id": 10240248,
    "name": "main",
    "target": "branch",
    "source_type": "Repository",
    "source": "beep-effect/beep-effect",
    "enforcement": "active",
    "conditions": {
      "ref_name": {
        "exclude": [],
        "include": [
          "~DEFAULT_BRANCH"
        ]
      }
    },
    "rules": [
      {
        "type": "deletion"
      },
      {
        "type": "non_fast_forward"
      },
      {
        "type": "pull_request",
        "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "required_reviewers": [],
          "require_code_owner_review": false,
          "dismissal_restriction": {
            "enabled": false,
            "allowed_actors": []
          },
          "require_last_push_approval": false,
          "required_review_thread_resolution": true,
          "require_extra_approval_for_unattributed_changes": true,
          "allowed_merge_methods": [
            "merge",
            "squash",
            "rebase"
          ]
        }
      },
      {
        "type": "required_status_checks",
        "parameters": {
          "strict_required_status_checks_policy": false,
          "do_not_enforce_on_create": false,
          "required_status_checks": [
            {
              "context": "Lint",
              "integration_id": 15368
            },
            {
              "context": "Heavy / Check",
              "integration_id": 15368
            },
            {
              "context": "Test Unit",
              "integration_id": 15368
            },
            {
              "context": "Heavy / Test Integration",
              "integration_id": 15368
            },
            {
              "context": "Heavy / Docgen",
              "integration_id": 15368
            },
            {
              "context": "Codegen Drift",
              "integration_id": 15368
            },
            {
              "context": "Repo Sanity",
              "integration_id": 15368
            },
            {
              "context": "Knip",
              "integration_id": 15368
            },
            {
              "context": "Commitlint",
              "integration_id": 15368
            },
            {
              "context": "Secret Scanning",
              "integration_id": 15368
            },
            {
              "context": "Security",
              "integration_id": 15368
            },
            {
              "context": "SAST",
              "integration_id": 15368
            },
            {
              "context": "Nix Shell",
              "integration_id": 15368
            },
            {
              "context": "Professional Desktop IPC Stdio",
              "integration_id": 15368
            },
            {
              "context": "Heavy / Doctest",
              "integration_id": 15368
            },
            {
              "context": "JSDoc Ratchet",
              "integration_id": 15368
            }
          ]
        }
      }
    ],
    "node_id": "RRS_lACqUmVwb3NpdG9yec49s783zgCcQPg",
    "created_at": "2025-11-20T22:12:15.649-06:00",
    "updated_at": "2026-10-09T10:56:30.797-05:00",
    "bypass_actors": [
      {
        "actor_id": 5,
        "actor_type": "RepositoryRole",
        "bypass_mode": "always"
      }
    ],
    "current_user_can_bypass": "always",
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/beep-effect/beep-effect/rulesets/10240248"
      },
      "html": {
        "href": "https://github.com/beep-effect/beep-effect/rules/10240248"
      }
    }
  },
  "environments": {
    "total_count": 20,
    "environments": [
      {
        "id": 8405246522,
        "node_id": "EN_kwDOPbO_N88AAAAB9P3iOg",
        "name": "Preview",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview",
        "created_at": "2025-08-29T08:53:27Z",
        "updated_at": "2025-08-29T08:53:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12362901528,
        "node_id": "EN_kwDOPbO_N88AAAAC4OLoGA",
        "name": "Preview \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:48:14Z",
        "updated_at": "2026-02-23T15:48:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509829194,
        "node_id": "EN_kwDOPbO_N88AAAACcm9ESg",
        "name": "Preview \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T23:17:32Z",
        "updated_at": "2025-12-08T23:17:32Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608667552,
        "node_id": "EN_kwDOPbO_N88AAAADolldoA",
        "name": "Preview \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web",
        "created_at": "2026-05-20T23:04:27Z",
        "updated_at": "2026-05-20T23:04:27Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15608638351,
        "node_id": "EN_kwDOPbO_N88AAAADoljrjw",
        "name": "Preview \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T23:03:18Z",
        "updated_at": "2026-05-20T23:03:18Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747970857,
        "node_id": "EN_kwDOPbO_N88AAAAE1KzpKQ",
        "name": "Preview \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox",
        "created_at": "2026-08-27T23:11:02Z",
        "updated_at": "2026-08-27T23:11:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509838005,
        "node_id": "EN_kwDOPbO_N88AAAACcm9mtQ",
        "name": "Preview \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Preview \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Preview+%E2%80%93+todox-marketing",
        "created_at": "2025-12-08T23:18:08Z",
        "updated_at": "2025-12-08T23:18:08Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 8378951433,
        "node_id": "EN_kwDOPbO_N88AAAAB82ynCQ",
        "name": "Production",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production",
        "created_at": "2025-08-28T05:15:39Z",
        "updated_at": "2025-08-28T05:15:39Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 12361471483,
        "node_id": "EN_kwDOPbO_N88AAAAC4M0V-w",
        "name": "Production \u2013 beep-dev",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-dev",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-dev",
        "created_at": "2026-02-23T15:08:02Z",
        "updated_at": "2026-02-23T15:08:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508873515,
        "node_id": "EN_kwDOPbO_N88AAAACcmCvKw",
        "name": "Production \u2013 beep-effect-infra",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-infra",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-infra",
        "created_at": "2025-12-08T22:23:02Z",
        "updated_at": "2025-12-08T22:23:02Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10508902705,
        "node_id": "EN_kwDOPbO_N88AAAACcmEhMQ",
        "name": "Production \u2013 beep-effect-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing",
        "created_at": "2025-12-08T22:24:37Z",
        "updated_at": "2025-12-08T22:24:37Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509067756,
        "node_id": "EN_kwDOPbO_N88AAAACcmOl7A",
        "name": "Production \u2013 beep-effect-marketing-jbbs",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs",
        "created_at": "2025-12-08T22:34:07Z",
        "updated_at": "2025-12-08T22:34:07Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509080887,
        "node_id": "EN_kwDOPbO_N88AAAACcmPZNw",
        "name": "Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-marketing-jbbs-1765233294724-vLlH",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-marketing-jbbs-1765233294724-vLlH",
        "created_at": "2025-12-08T22:34:56Z",
        "updated_at": "2025-12-08T22:34:56Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10509082322,
        "node_id": "EN_kwDOPbO_N88AAAACcmPe0g",
        "name": "Production \u2013 beep-effect-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 beep-effect-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+beep-effect-web",
        "created_at": "2025-12-08T22:35:00Z",
        "updated_at": "2025-12-08T22:35:00Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593208236,
        "node_id": "EN_kwDOPbO_N88AAAADoW15rA",
        "name": "Production \u2013 oip-web",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web",
        "created_at": "2026-05-20T16:12:22Z",
        "updated_at": "2026-05-20T16:12:22Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 15593165597,
        "node_id": "EN_kwDOPbO_N88AAAADoWzTHQ",
        "name": "Production \u2013 oip-web-staging",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 oip-web-staging",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+oip-web-staging",
        "created_at": "2026-05-20T16:11:14Z",
        "updated_at": "2026-05-20T16:11:14Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 20747728204,
        "node_id": "EN_kwDOPbO_N88AAAAE1Kk1TA",
        "name": "Production \u2013 todox",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox",
        "created_at": "2026-08-27T23:05:12Z",
        "updated_at": "2026-08-27T23:05:12Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 10543810464,
        "node_id": "EN_kwDOPbO_N88AAAACdHXHoA",
        "name": "Production \u2013 todox-marketing",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/Production \u2013 todox-marketing",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=Production+%E2%80%93+todox-marketing",
        "created_at": "2025-12-10T04:51:10Z",
        "updated_at": "2025-12-10T04:51:10Z",
        "can_admins_bypass": true,
        "protection_rules": [],
        "deployment_branch_policy": null,
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "unknown": "gh: Not Found (HTTP 404)",
          "exit": 1
        }
      },
      {
        "id": 23892170137,
        "node_id": "EN_kwDOPbO_N88AAAAFkBWVmQ",
        "name": "professional-desktop-release",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/professional-desktop-release",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=professional-desktop-release",
        "created_at": "2026-10-09T15:46:21Z",
        "updated_at": "2026-10-09T15:46:21Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 68262106,
            "node_id": "GA_kwDOPbO_N84EEZja",
            "type": "required_reviewers",
            "prevent_self_review": false,
            "reviewers": [
              {
                "type": "User",
                "reviewer": {
                  "login": "kriegcloud",
                  "id": 106790222,
                  "node_id": "U_kgDOBl19Tg",
                  "avatar_url": "https://avatars.githubusercontent.com/u/106790222?v=4",
                  "gravatar_id": "",
                  "url": "https://api.github.com/users/kriegcloud",
                  "html_url": "https://github.com/kriegcloud",
                  "followers_url": "https://api.github.com/users/kriegcloud/followers",
                  "following_url": "https://api.github.com/users/kriegcloud/following{/other_user}",
                  "gists_url": "https://api.github.com/users/kriegcloud/gists{/gist_id}",
                  "starred_url": "https://api.github.com/users/kriegcloud/starred{/owner}{/repo}",
                  "subscriptions_url": "https://api.github.com/users/kriegcloud/subscriptions",
                  "organizations_url": "https://api.github.com/users/kriegcloud/orgs",
                  "repos_url": "https://api.github.com/users/kriegcloud/repos",
                  "events_url": "https://api.github.com/users/kriegcloud/events{/privacy}",
                  "received_events_url": "https://api.github.com/users/kriegcloud/received_events",
                  "type": "User",
                  "user_view_type": "public",
                  "site_admin": false
                }
              }
            ]
          },
          {
            "id": 68262107,
            "node_id": "GA_kwDOPbO_N84EEZjb",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 62506788,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k2MjUwNjc4OA==",
              "name": "professional-desktop-v*",
              "type": "tag"
            }
          ]
        }
      },
      {
        "id": 19794454685,
        "node_id": "EN_kwDOPbO_N88AAAAEm9donQ",
        "name": "turbo-cache-write",
        "url": "https://api.github.com/repos/beep-effect/beep-effect/environments/turbo-cache-write",
        "html_url": "https://github.com/beep-effect/beep-effect/deployments/activity_log?environments_filter=turbo-cache-write",
        "created_at": "2026-08-13T04:49:23Z",
        "updated_at": "2026-08-13T04:49:23Z",
        "can_admins_bypass": true,
        "protection_rules": [
          {
            "id": 62579093,
            "node_id": "GA_kwDOPbO_N84DuuGV",
            "type": "branch_policy"
          }
        ],
        "deployment_branch_policy": {
          "protected_branches": false,
          "custom_branch_policies": true
        },
        "secretNames": [
          "TURBO_TOKEN"
        ],
        "variableNames": [],
        "branchPolicies": {
          "total_count": 1,
          "branch_policies": [
            {
              "id": 57211084,
              "node_id": "MDE2OkdhdGVCcmFuY2hQb2xpY3k1NzIxMTA4NA==",
              "name": "main",
              "type": "branch"
            }
          ]
        }
      }
    ]
  },
  "actionsPermissions": {
    "enabled": true,
    "allowed_actions": "selected",
    "selected_actions_url": "https://api.github.com/repositories/1035190071/actions/permissions/selected-actions",
    "sha_pinning_required": true
  },
  "workflowPermissions": {
    "default_workflow_permissions": "read",
    "can_approve_pull_request_reviews": false
  },
  "allowedActions": {
    "github_owned_allowed": true,
    "patterns_allowed": [
      "oven-sh/setup-bun@*",
      "taiki-e/install-action@*",
      "actions-rust-lang/setup-rust-toolchain@*",
      "cachix/cachix-action@*",
      "cachix/install-nix-action@*",
      "google/osv-scanner-action/*",
      "changesets/action@*",
      "peter-evans/create-pull-request@*",
      "tauri-apps/tauri-action@*",
      "swatinem/rust-cache@*"
    ],
    "verified_allowed": false
  },
  "runnerGroups": {
    "total_count": 2,
    "runner_groups": [
      {
        "id": 1,
        "name": "Default",
        "visibility": "all",
        "allows_public_repositories": false,
        "default": true,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": false,
        "selected_workflows": [],
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/1/hosted-runners",
        "inherited": false
      },
      {
        "id": 4,
        "name": "beep-ec2-heavy",
        "visibility": "selected",
        "allows_public_repositories": true,
        "default": false,
        "workflow_restrictions_read_only": false,
        "restricted_to_workflows": true,
        "selected_workflows": [
          "beep-effect/beep-effect/.github/workflows/cache-warm.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-lane-probe.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/fleet-shadow-check.yml@refs/heads/main",
          "beep-effect/beep-effect/.github/workflows/heavy.yml@refs/heads/main"
        ],
        "selected_repositories_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/repositories",
        "runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/runners",
        "hosted_runners_url": "https://api.github.com/orgs/beep-effect/actions/runner-groups/4/hosted-runners",
        "inherited": false
      }
    ]
  },
  "repoSecretNames": [
    "APP_ENV",
    "APP_LOG_FORMAT",
    "APP_LOG_LEVEL",
    "APP_NAME",
    "NEXT_PUBLIC_ENV",
    "TURBO_READ_TOKEN",
    "TURBO_TEAM",
    "TURBO_TOKEN"
  ],
  "repoVariableNames": [
    "TURBO_API",
    "TURBO_TEAM"
  ],
  "security": {
    "secret_scanning": {
      "status": "enabled"
    },
    "secret_scanning_push_protection": {
      "status": "enabled"
    },
    "dependabot_security_updates": {
      "status": "disabled"
    },
    "secret_scanning_non_provider_patterns": {
      "status": "disabled"
    },
    "secret_scanning_ai_detection": {
      "status": "disabled"
    },
    "secret_scanning_validity_checks": {
      "status": "disabled"
    },
    "secret_scanning_delegated_alert_dismissal": {
      "status": "disabled"
    },
    "secret_scanning_delegated_bypass": {
      "status": "disabled"
    }
  }
}
```

Readback: `changesets/action@*` is absent; all other patterns and the GitHub-owned/verified action flags match the prior snapshot. Current workflows contain no `changesets/action` reference. D release policy PR #1566 landed before this write. Reversal is PUT of the three prior allowed-action fields; no workflow or action version was changed by the hosted write.
