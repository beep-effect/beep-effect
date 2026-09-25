# 1Password `BEEP_SECRETS` item layout

The `BEEP_SECRETS` item in the `BEEP_SECRETS` vault is a secure note holding
~107 concealed fields. This runbook fixes its section layout so the item stays
readable and so every `op://BEEP_SECRETS/BEEP_SECRETS/<LABEL>` reference keeps
resolving. Laid out 2026-09-22.

## The rule

- **The label prefix is the section.** A field labelled `AI_…` lives in the
  `AI` section, `CLOUD_…` in `CLOUD`, and so on. One section per prefix, no
  merged sections.
- **Sections:** `AI`, `CLOUD`, `CRM`, `CRYPTO`, `DEV`, `DMS`, `DNS`, `LEGAL`,
  `PAYMENTS`, `RESEARCH`, `SOCIAL`, in that (A-Z) order. Fields sort A-Z inside
  each section. The note body stays at the top, outside any section.
- **New field:** give it one of those prefixes and it routes itself. A label
  with no recognised prefix makes the layout script fail rather than create a
  catch-all section. Either add a prefix or map it in `unprefixed` in the jq
  file, which also records its future prefix (see the rename table).
- **References use the three-part form** `op://BEEP_SECRETS/BEEP_SECRETS/<LABEL>`.
  Never the section-qualified four-part form: sections are layout, not
  identity, and the layout may change.

## Applying the layout

The script only changes section membership and field order. It hashes every
field's id, label, type and value before and after the transform and refuses
to write if they differ.

```sh
scripts/onepassword/beep-secrets-layout.sh            # dry run, prints the layout
OP_BIN=op-human scripts/onepassword/beep-secrets-layout.sh --apply
```

The agent service account is read-only on the vault (even a no-op title edit
returns `Couldn't update the item`), so `--apply` runs through `op-human`, the
desktop-integrated CLI, by the operator. 1Password keeps item history, so a
bad write is restorable from the app.

## Proving references still resolve

Counts only, no values:

```sh
op item get BEEP_SECRETS --vault BEEP_SECRETS --format json \
  | jq -r '.fields[] | select(.id != "notesPlain") | .label' \
  | while read -r l; do op read "op://BEEP_SECRETS/BEEP_SECRETS/$l" >/dev/null 2>&1 && echo ok || echo "FAIL $l"; done \
  | sort | uniq -c
```

## Rename debt (follow-up pass, not done)

Renames break references. Each row is a separate change: grep the old label
across the repo, `$HOME/.config`, `$HOME/.local/bin`, systemd user units and
proxy config, repoint every reference, then rename in 1Password.

### Unprefixed fields, placed today by their future prefix

| Current label | Proposed label |
| --- | --- |
| `CODERABBIT_API_KEY` | `AI_CODERABBIT_API_KEY` |
| `COGNEE_CLOUD_API_KEY` | `AI_COGNEE_CLOUD_API_KEY` |
| `FISH_AUDIO_API_KEY` | `AI_FISH_AUDIO_API_KEY` |
| `MCP_GATEWAY_AUTH_TOKEN` | `AI_MCP_GATEWAY_AUTH_TOKEN` |
| `NOTION_PAT` | `AI_NOTION_PAT` (after the clash below is resolved) |
| `OMI_API_KEY` | `AI_OMI_API_KEY` |
| `OMI_MCP_KEY` | `AI_OMI_MCP_KEY` |
| `SUPPIXEL_API_KEY` | `AI_SUPPIXEL_API_KEY` |
| `TYPESAFE_AI_API_KEY` | `AI_TYPESAFE_API_KEY` |
| `PULUMI_ENCRYPTION_PASSPHRASE` | `CLOUD_PULUMI_ENCRYPTION_PASSPHRASE` |
| `TAILSCALE_API_ACCESS_TOKEN` | `CLOUD_TAILSCALE_…` (after the clash below is resolved) |
| `TAILSCALE_AUTH_KEY` | `CLOUD_TAILSCALE_…` (after the clash below is resolved) |
| `BEEP_CI_RUNNER_APP_ID` | `DEV_BEEP_CI_RUNNER_APP_ID` |
| `BEEP_CI_RUNNER_CLIENT_ID` | `DEV_BEEP_CI_RUNNER_CLIENT_ID` |
| `BEEP_TEST_DATABASE_URL` | `DEV_BEEP_TEST_DATABASE_URL` |
| `BETTER_AUTH_API_KEY` | `DEV_BETTER_AUTH_API_KEY` |
| `BUZZ_IDENTITY_KEY` | `DEV_BUZZ_IDENTITY_KEY` |
| `GITHUB_TOKEN` | `DEV_GITHUB_TOKEN` |
| `OBS_SERVER_IP` | `DEV_OBS_SERVER_IP` |
| `OBS_SERVER_PASSWORD` | `DEV_OBS_SERVER_PASSWORD` |
| `OMOIDE_CURATION_CREDENTIAL_TOKEN` | `DEV_OMOIDE_CURATION_CREDENTIAL_TOKEN` |
| `OP_SERVICE_ACCOUNT_TOKEN` | `DEV_OP_SERVICE_ACCOUNT_TOKEN` |
| `SOURCEGRAPH_ACCESS_TOKEN` | `DEV_SOURCEGRAPH_ACCESS_TOKEN` |
| `EPO_CONSUMER_KEY` | `LEGAL_EPO_CONSUMER_KEY` |
| `EPO_CONSUMER_SECRET_KEY` | `LEGAL_EPO_CONSUMER_SECRET_KEY` |
| `PATENT_DEV_ACCESS_CODE` | `LEGAL_PATENT_DEV_ACCESS_CODE` |
| `USPTO_API_KEY` | `LEGAL_USPTO_API_KEY` |
| `DATA_GOV_API_KEY` | `RESEARCH_DATA_GOV_API_KEY` |
| `BEEP_IP_BOT_TOKEN` | `SOCIAL_BEEP_IP_BOT_TOKEN` |
| `SPOTIFY_CLIENT_ID` | `SOCIAL_SPOTIFY_CLIENT_ID` |
| `SPOTIFY_CLIENT_SECRET` | `SOCIAL_SPOTIFY_CLIENT_SECRET` |
| `X_API_BEARER_TOKEN` | `SOCIAL_X_API_BEARER_TOKEN` |

### Prefix-change candidates (placed by current prefix today)

| Current label | Candidate |
| --- | --- |
| `AI_CLAWHOLE_DISCORD_BOT_TOKEN` | `SOCIAL_CLAWHOLE_DISCORD_BOT_TOKEN` |
| `DEV_DISCORD_BOT_TOKEN` | `SOCIAL_DISCORD_BOT_TOKEN` |
| `DEV_DISCORD_CHANNEL_DISPLAY_NAME` | `SOCIAL_DISCORD_CHANNEL_DISPLAY_NAME` |
| `DEV_DISCORD_GUILD_ID` | `SOCIAL_DISCORD_GUILD_ID` |
| `DEV_DISCORD_SERVER_ID` | `SOCIAL_DISCORD_SERVER_ID` |

### Name clashes: identify, then rename

These pairs hold **different** values, so they are distinct credentials whose
names do not say how they differ. Establish what each one is (scope, owner,
where it is used) before choosing names that state the difference.

| Pair | Files referencing each (2026-09-22 census) |
| --- | --- |
| `CLOUD_VERCEL_TOKEN` / `CLOUD_VERCEL_API_TOKEN` | 69 / 31 |
| `TAILSCALE_AUTH_KEY` / `CLOUD_TAILSCALE_AUTH_KEY` | 76 / 12 |
| `TAILSCALE_API_ACCESS_TOKEN` / `CLOUD_TAILSCALE_ACCESS_TOKEN` | 4 / 10 |
| `AI_NOTION_API_KEY` / `NOTION_PAT` | 79 / 4 |

### True duplicate

`AI_BROWSER_BASE_API_KEY` and `AI_BROWSERBASE_API_KEY` hold the **same** value.
Repoint the 7 files referencing `AI_BROWSER_BASE_API_KEY` to
`AI_BROWSERBASE_API_KEY`, then delete the former.
