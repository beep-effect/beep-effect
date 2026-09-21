#!/usr/bin/env bash
# beforeShellExecution guard (goals/agent-pool-doctrine, D21). `.cursor/cli.json`'s
# `Shell(git)` deny matches only the FIRST token of a command line, so `/usr/bin/git`,
# `env git`, and `bash -lc "git ..."` slip past it. This hook denies in two cases.
#
# 1. Any token's basename is git, sudo, or pkexec. Before splitting it deletes backslashes
#    and quotes, so `\git`, `g"i"t`, and `git\ status` rejoin into the real word, then
#    treats shell operators, backticks, `$`, and `=` as separators. Arguments count too:
#    `echo git` is denied on purpose.
# 2. The command uses shell expansion: `$name`, `${...}`, `$(...)`, `$'...'`, `$"..."`,
#    positional or special parameters, or backticks. A static scan cannot know what an
#    expansion produces (`a=su; ${a}do`), so it refuses to guess. Lanes pass literal values.
#
# Interpreter-level construction (a Python or Node string that assembles a command name)
# stays out of reach; the post-lane git state diff in docs/runbooks/agent-pools.md is the
# backstop. Registered with `failClosed: true`: a crash or timeout blocks the command.
# Exit 0 with a decision on stdout in every path.
set -u
set -f
input="$(cat)"
# An unreadable payload, or one without a string `command`, is denied like a crash:
# a renamed key must not silently turn this guard into an allow-all.
if ! command_line="$(printf '%s' "${input}" | jq -er 'if (.command | type) == "string" then .command else error("no command") end' 2>/dev/null)"; then
  printf '%s\n' '{"permission":"deny","user_message":"Blocked: the shell guard could not read the hook payload (D21).","agent_message":"The shell guard could not read this command, so it was denied. Report what you needed instead of retrying."}'
  exit 0
fi
normalized="$(printf '%s' "${command_line}" | tr -d '\\"'"'" | tr ';&|(){}<>$=`\n\t' ' ')"
deny=""
# shellcheck disable=SC2086
for token in ${normalized}; do
  case "${token##*/}" in
    git|sudo|pkexec) deny="${token##*/}"; break ;;
  esac
done
expansion_pattern='[$][A-Za-z0-9_{(@*#?!$'"'"'"-]|`'
if [ -n "${deny}" ]; then
  jq -cn --arg d "${deny}" '{permission:"deny",
    user_message:("Blocked: `"+$d+"` is denied in Cursor lanes (D21); the orchestrator stages by name."),
    agent_message:("`"+$d+"` is denied in this repository for Cursor lanes (any token, any path). Do not retry with a wrapper; report what you needed instead.")}'
elif [[ "${command_line}" =~ ${expansion_pattern} ]]; then
  jq -cn '{permission:"deny",
    user_message:"Blocked: shell expansion is denied in Cursor lanes (D21) because the guard cannot see what it produces.",
    agent_message:"Shell expansion ($name, ${...}, $(...), $'"'"'...'"'"', backticks) is denied in this repository for Cursor lanes. Rewrite the command with literal values; do not retry with another indirection."}'
else
  printf '{"permission":"allow"}\n'
fi
exit 0
