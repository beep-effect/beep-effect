# Lay out the BEEP_SECRETS item: one section per label prefix, A-Z sections,
# A-Z fields within each. Labels, field ids, types and values are never changed,
# so every op://BEEP_SECRETS/BEEP_SECRETS/<LABEL> reference keeps resolving.
# Rule and rename debt: docs/runbooks/onepassword-beep-secrets-layout.md

def prefixes: ["AI","CLOUD","CRM","CRYPTO","DEV","DMS","DNS","LEGAL","PAYMENTS","RESEARCH","SOCIAL"];

# Fields with no category prefix yet, placed where their future prefix puts them.
def unprefixed: {
  "CODERABBIT_API_KEY":"AI", "COGNEE_CLOUD_API_KEY":"AI", "FISH_AUDIO_API_KEY":"AI",
  "MCP_GATEWAY_AUTH_TOKEN":"AI", "NOTION_PAT":"AI", "OMI_API_KEY":"AI", "OMI_MCP_KEY":"AI",
  "SUPPIXEL_API_KEY":"AI", "TYPESAFE_AI_API_KEY":"AI",
  "PULUMI_ENCRYPTION_PASSPHRASE":"CLOUD", "TAILSCALE_API_ACCESS_TOKEN":"CLOUD", "TAILSCALE_AUTH_KEY":"CLOUD",
  "BEEP_CI_RUNNER_APP_ID":"DEV", "BEEP_CI_RUNNER_CLIENT_ID":"DEV", "BEEP_TEST_DATABASE_URL":"DEV",
  "BETTER_AUTH_API_KEY":"DEV", "BUZZ_IDENTITY_KEY":"DEV", "GITHUB_TOKEN":"DEV",
  "OBS_SERVER_IP":"DEV", "OBS_SERVER_PASSWORD":"DEV", "OMOIDE_CURATION_CREDENTIAL_TOKEN":"DEV",
  "OP_SERVICE_ACCOUNT_TOKEN":"DEV", "SOURCEGRAPH_ACCESS_TOKEN":"DEV",
  "EPO_CONSUMER_KEY":"LEGAL", "EPO_CONSUMER_SECRET_KEY":"LEGAL", "PATENT_DEV_ACCESS_CODE":"LEGAL", "USPTO_API_KEY":"LEGAL",
  "DATA_GOV_API_KEY":"RESEARCH",
  "BEEP_IP_BOT_TOKEN":"SOCIAL", "SPOTIFY_CLIENT_ID":"SOCIAL", "SPOTIFY_CLIENT_SECRET":"SOCIAL", "X_API_BEARER_TOKEN":"SOCIAL"
};

def byPrefix: . as $label | first(prefixes[] | . as $p | select($label | startswith($p + "_"))) // null;
def sectionOf: (unprefixed[.] // byPrefix) // error("no section for label \(.): add a prefix or map it in unprefixed");
def isNote: (.purpose == "NOTES") or (.id == "notesPlain");

(prefixes | map({id: ascii_downcase, label: .})) as $secs
| ($secs | map({(.label): .}) | add) as $byLabel
| (.fields | map(select(isNote))) as $notes
| (.fields | map(select(isNote | not))
    | map(. + {section: $byLabel[(.label | sectionOf)]})
    | sort_by([.section.label, .label])) as $rest
| .sections = ($secs | map(select(.id as $id | $rest | any(.section.id == $id))))
| .fields   = ($notes + $rest)
