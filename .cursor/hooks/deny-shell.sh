#!/usr/bin/env bash
# beforeShellExecution guard (goals/agent-pool-doctrine, D21). `.cursor/cli.json`'s
# `Shell(git)` deny matches only the FIRST token of a command line, so `/usr/bin/git`,
# `env git`, and `bash -lc "git ..."` slip past it. This hook denies when ANY token's
# basename is git, sudo, or pkexec, after splitting on whitespace, quotes, and shell
# operators. Registered with `failClosed: true`: a crash or timeout blocks the command
# rather than letting it through. Exit 0 with a decision on stdout in every path.
set -u
input="$(cat)"
command_line="$(printf '%s' "${input}" | jq -r '.command // empty' 2>/dev/null || true)"
deny=""
# shellcheck disable=SC2086
for token in $(printf '%s' "${command_line}" | tr '"'"'"'`;&|(){}<>\n\t' '                 '); do
  case "${token##*/}" in
    git|sudo|pkexec) deny="${token##*/}"; break ;;
  esac
done
if [ -n "${deny}" ]; then
  jq -cn --arg d "${deny}" '{permission:"deny",
    user_message:("Blocked: `"+$d+"` is denied in Cursor lanes (D21); the orchestrator stages by name."),
    agent_message:("`"+$d+"` is denied in this repository for Cursor lanes (any token, any path). Do not retry with a wrapper; report what you needed instead.")}'
else
  printf '{"permission":"allow"}\n'
fi
exit 0
