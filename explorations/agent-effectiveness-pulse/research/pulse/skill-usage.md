# Fleet skill-usage pulse

Snapshot: **2026-07-14T05:21:18Z**.

## Executive read

- Claude Code: all 23 matching `~/.claude/projects/*beep*/` directories, all
  3,430 recursive JSONL files (1.07 GB), with 194 direct `Skill` tool calls.
- Codex: all 2,099 June/July rollout files were checked by their first
  `session_meta` record; all 1,588 whose `cwd` contained `beep-effect` were
  then streamed in full. This is exhaustive within the selected two-month
  scope, not an every-Nth-file sample.
- Codex produced 4,173 function-call references to concrete
  `.claude/skills/<name>/SKILL.md` paths. This is a **read/reference proxy**,
  not a native skill-invocation event and is not directly comparable with the
  Claude column.
- The current denominator is 35: 30 repo-local skill directories plus five
  observed plugin-namespaced Claude skills. Other observed, unnamespaced
  external skills are reported but are not added to that denominator.
- Four of the 30 repo-local skills have no signal in either source:
  `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, and `ponytail-help`.

## Coverage

| Source | Files checked | Files selected | Date range (UTC) | Primary signal |
|---|---:|---:|---|---|
| Claude Code | 3,430 | 3,430 | 2026-06-14T05:58:02.094Z to 2026-07-14T05:17:52.255Z | direct `Skill` tool calls |
| Codex June | 744 | 491 | 2026-06-01 onward | skill-file reference proxy |
| Codex July | 1,355 | 1,097 | through 2026-07-14T05:19:23.305Z | skill-file reference proxy |
| Codex total | 2,099 | 1,588 | 2026-06-01T22:21:24.473Z to 2026-07-14T05:19:23.305Z | skill-file reference proxy |

Claude dates are the minimum and maximum top-level record timestamps. Codex
dates are the minimum and maximum selected `session_meta` timestamps. Logs are
append-only, so rerunning after the snapshot will legitimately change counts.

## Fleet-wide skill table

Sorted descending by the arithmetic sum of the two columns, used only as a
stable sort key. The two signals have different semantics and should not be
treated as a combined invocation total.

| Skill | Claude direct | Codex proxy |
|---|---:|---:|
| `effect-first-development` | 7 | 936 |
| `yeet` | 30 | 606 |
| `schema-first-development` | 9 | 610 |
| `jsdoc-annotation-specialist` | 9 | 498 |
| `quality-review-fix-loop` | 2 | 349 |
| `crispen` | 5 | 237 |
| `grill-with-docs` | 46 | 140 |
| `repo-symbol-discovery` | 0 | 154 |
| `mcp-graphiti-memory` | 0 | 129 |
| `turborepo` | 0 | 127 |
| `effect-v4-imports` | 0 | 79 |
| `graphify` | 0 | 74 |
| `explore` | 5 | 63 |
| `effect-services` | 1 | 39 |
| `atom-reactivity-specialist` | 2 | 34 |
| `onepassword-secret-refs` | 1 | 32 |
| `reflect` | 15 | 18 |
| `deep-research` | 17 | 0 |
| `codex:codex-cli-runtime` | 15 | 0 |
| `grill-me` | 3 | 9 |
| `schema-model-specialist` | 0 | 12 |
| `ponytail` | 0 | 9 |
| `cognee-memory:cognee-remember` | 7 | 0 |
| `claude-in-chrome` | 5 | 0 |
| `oracle` | 0 | 5 |
| `codex:codex-result-handling` | 4 | 0 |
| `codex:rescue` | 3 | 0 |
| `codex:setup` | 3 | 0 |
| `mcp-jetbrains` | 0 | 3 |
| `firecrawl-scrape` | 1 | 1 |
| `portless` | 0 | 2 |
| `teach` | 0 | 2 |
| `artifact-design` | 1 | 0 |
| `claude-api` | 1 | 0 |
| `claude-frontend-lane` | 0 | 1 |
| `dataviz` | 1 | 0 |
| `effect-v4` | 0 | 1 |
| `eventlog-graph-specialist` | 0 | 1 |
| `ponytail-review` | 0 | 1 |
| `schedule` | 1 | 0 |
| `shadcn` | 0 | 1 |

The five observed plugin-namespaced additions to the 30-skill denominator are
`codex:codex-cli-runtime`, `codex:codex-result-handling`, `codex:rescue`,
`codex:setup`, and `cognee-memory:cognee-remember`.

## Never-used inventory and H5

Against the current 30 directories under `.claude/skills/`, the union of
Claude direct calls and Codex proxy references leaves exactly four with zero
signal:

- `ponytail-audit`
- `ponytail-debt`
- `ponytail-gain`
- `ponytail-help`

The pre-audit says “16 skills” but actually enumerates only **15 unique
names**: six individually named skills, six `ponytail*` skills, and three
trailing skills. The table below checks every name it enumerates; there is no
sixteenth named candidate to infer safely.

| H5 candidate | Claude direct | Codex proxy | Any signal? |
|---|---:|---:|---|
| `claude-frontend-lane` | 0 | 1 | yes, proxy only |
| `effect-services` | 1 | 39 | yes |
| `grill-me` | 3 | 9 | yes |
| `jsdoc-annotation-specialist` | 9 | 498 | yes |
| `mcp-jetbrains` | 0 | 3 | yes, proxy only |
| `onepassword-secret-refs` | 1 | 32 | yes |
| `ponytail` | 0 | 9 | yes, proxy only |
| `ponytail-audit` | 0 | 0 | **no** |
| `ponytail-debt` | 0 | 0 | **no** |
| `ponytail-gain` | 0 | 0 | **no** |
| `ponytail-help` | 0 | 0 | **no** |
| `ponytail-review` | 0 | 1 | yes, proxy only |
| `quality-review-fix-loop` | 2 | 349 | yes |
| `schema-model-specialist` | 0 | 12 | yes, proxy only |
| `turborepo` | 0 | 127 | yes, proxy only |

H5 is **supported by the direct Claude signal**: 10 of the 15 named candidates
have no direct Claude invocation, exceeding both half of the named list and
the pre-audit's implied threshold of 8 for 16. It is **not supported by the
two-signal union**: only 4 of 15 have neither a direct call nor a Codex proxy
reference. Because the Codex measure cannot prove invocation, the fair fleet
conclusion is “four strongly dead; six additional candidates have proxy-only
evidence.”

## Where usage concentrates

### Claude project directories

All 23 matching project directories are shown. Labels remove the fixed home
path prefix. Command-tag records are included because they are a separate,
best-effort signal described below.

| Project-directory label | JSONL files | Skill calls | Command-tag records |
|---|---:|---:|---:|
| `beep-effect` | 1,162 | 51 | 268 |
| `beep-effect2` | 658 | 38 | 135 |
| `beep-effect3` | 417 | 35 | 78 |
| `beep-effect6` | 80 | 16 | 63 |
| `beep-effect7` | 668 | 15 | 70 |
| `beep-effect5` | 274 | 12 | 83 |
| `beep-effect9` | 130 | 9 | 73 |
| `beep-effect8` | 19 | 7 | 80 |
| `beep-effect2--claude-worktrees-gracious-blackwell-fb29b6` | 2 | 3 | 0 |
| `beep-effect2--claude-worktrees-confident-maxwell-980b76` | 2 | 2 | 0 |
| `beep-effect2--claude-worktrees-distracted-proskuriakova-d92d13` | 2 | 2 | 0 |
| `beep-effect--claude-worktrees-epic-mahavira-6a2edc` | 5 | 1 | 8 |
| `beep-effect3-scratchpad-cognee-models` | 9 | 1 | 2 |
| `beep-effect2--claude-worktrees-eloquent-saha-99d9af` | 1 | 1 | 0 |
| `beep-effect2--claude-worktrees-intelligent-wright-0fb9a0` | 1 | 1 | 0 |
| `beep-effect-packages-common-schema-test-integrations-files-fixtures` | 0 | 0 | 0 |
| `beep-effect-tmp` | 0 | 0 | 0 |
| `beep-effect2-packages-foundation-ui-system-ui` | 0 | 0 | 0 |
| `beep-effect2-packages-law-practice-domain` | 0 | 0 | 0 |
| `beep-effect3-explorations-atlas-synthesis` | 0 | 0 | 0 |
| `beep-effect3-outputs-agent-reliability-worktrees-tooling-cli-01--minimal--claude--1--1772032493938-601856` | 0 | 0 | 0 |
| `beep-effect5-packages-foundation-ui-system-form` | 0 | 0 | 0 |
| `beep-effect7-node-modules-effect-dist` | 0 | 0 | 0 |

The eight main repo directories account for 183 of 194 direct calls (94.3%).

### Codex project-root buckets

Nested `cwd` values are bucketed by their first path segment beginning with
`beep-effect`; this avoids exposing home paths and keeps generated training
worktrees from producing an 86-row path table.

| Project-root bucket | Selected rollouts | Codex proxy calls |
|---|---:|---:|
| `beep-effect2` | 540 | 1,520 |
| `beep-effect` | 436 | 1,166 |
| `beep-effect3` | 85 | 501 |
| `beep-effect6` | 273 | 469 |
| `beep-effect5` | 57 | 256 |
| `beep-effect7` | 80 | 139 |
| `beep-effect8` | 46 | 55 |
| `beep-effect9` | 35 | 41 |
| `beep-effect-worktrees` | 32 | 22 |
| `beep-effect2-p3` | 1 | 3 |
| `beep-effect8-p1docs` | 1 | 1 |
| `beep-effect2-worktrees` | 2 | 0 |

The eight numbered/main repo buckets account for 4,147 of 4,173 proxy calls
(99.4%).

## Slash-command tag signal

This scan counts each distinct `<command-name>` value at most once per JSON
record. It is deliberately labelled “command-tag records,” not invocations:
Claude may inject command/plugin metadata into records, and repeated tags can
occur without a user typing a slash command.

| Command name | Records |
|---|---:|
| `codex-cli-runtime` | 215 |
| `gpt-5-4-prompting` | 215 |
| `/effort` | 127 |
| `/model` | 46 |
| `/compact` | 45 |
| `/plan` | 41 |
| `/goal` | 37 |
| `/rename` | 34 |
| `/resume` | 27 |
| `/usage` | 21 |
| `/clear` | 8 |
| `/grill-with-docs` | 6 |
| `/login` | 6 |
| `/workflows` | 6 |
| `/branch` | 5 |
| `/doctor` | 3 |
| `/rate-limit-options` | 3 |
| `/deep-research` | 2 |
| `/fast` | 2 |
| `/remote-control` | 2 |
| `/status` | 2 |
| `/exit` | 1 |
| `/explore` | 1 |
| `/mcp` | 1 |
| `/permissions` | 1 |
| `/portless` | 1 |
| `/reload-plugins` | 1 |
| `/statusline` | 1 |
| **Total** | **860** |

## Reproduction

These commands emit only structural fields, names, counts, directory labels,
and dates. They do not emit transcript text, tool arguments, or model output.
All JSONL processing is line-oriented.

### Inventory and Claude extraction

```sh
find .claude/skills -mindepth 1 -maxdepth 1 -type d -printf '%f\n' |
  LC_ALL=C sort > /tmp/skill-inventory.txt
wc -l /tmp/skill-inventory.txt

date -u '+%Y-%m-%dT%H:%M:%SZ'
find ~/.claude/projects -mindepth 1 -maxdepth 1 -type d -name '*beep*' |
  wc -l
find ~/.claude/projects -mindepth 2 -type f -name '*.jsonl' -path '*beep*' \
  -printf '%s\n' | awk '{files++; bytes+=$1}
    END {printf "files=%d bytes=%d gb=%.2f\n",files,bytes,bytes/1e9}'

: > /tmp/claude-beep-events.tsv
find ~/.claude/projects -mindepth 1 -maxdepth 1 -type d -name '*beep*' -print0 |
while IFS= read -r -d '' project; do
  label=${project##*/}
  find "$project" -type f -name '*.jsonl' -print0 |
    xargs -0 -r jq -r --arg project "$label" '
      (.timestamp? | select(type == "string")
        | ["date", $project, .] | @tsv),
      (select(.message?.content? | type == "array")
        | .message.content[]
        | select(.type == "tool_use" and .name == "Skill")
        | ["skill", $project, (.input.skill // "(missing)")] | @tsv),
      ([.. | strings | scan("<command-name>([^<]+)</command-name>")[0]]
        | unique[]
        | ["command", $project, .] | @tsv)
    ' >> /tmp/claude-beep-events.tsv
done

awk -F '\t' '$1=="skill" {by_skill[$3]++; by_project[$2]++; total++}
  END {
    for (k in by_skill) print by_skill[k], k;
    print "TOTAL", total > "/dev/stderr"
  }' /tmp/claude-beep-events.tsv | sort -nr

awk -F '\t' '$1=="skill" && $3 ~ /^[^:]+:[^:]+$/ {seen[$3]=1}
  END {for(k in seen) print k; print "plugin_namespaced_count=" length(seen)}' \
  /tmp/claude-beep-events.tsv | sort

awk -F '\t' '$1=="command" {n[$3]++; total++}
  END {for (k in n) print n[k], k; print "TOTAL", total > "/dev/stderr"}' \
  /tmp/claude-beep-events.tsv | sort -nr

awk -F '\t' '$1=="date" {
    if (min=="" || $3<min) min=$3; if (max=="" || $3>max) max=$3
  } END {print min, max}' /tmp/claude-beep-events.tsv
```

### Codex selection and proxy extraction

The first-record rule is reproducible because Codex rollouts place
`session_meta` first. `fromjson?` lets a concurrently appended partial line be
skipped without buffering or failing the rest of a file.

```sh
: > /tmp/codex-jun-jul-meta.tsv
find ~/.codex/sessions/2026/06 ~/.codex/sessions/2026/07 \
  -type f -name 'rollout-*.jsonl' -print0 |
while IFS= read -r -d '' file; do
  IFS= read -r first < "$file" || true
  printf '%s\n' "$first" | jq -r --arg file "$file" '
    select(.type=="session_meta")
    | [$file, (.payload.cwd // ""),
       (.payload.timestamp // .timestamp // "")] | @tsv
  ' >> /tmp/codex-jun-jul-meta.tsv
done

awk -F '\t' 'index($2,"beep-effect") {print}' \
  /tmp/codex-jun-jul-meta.tsv > /tmp/codex-beep-selected.tsv

: > /tmp/codex-beep-skill-events.tsv
while IFS=$'\t' read -r file cwd timestamp; do
  jq -Rr --arg project "$cwd" '
    fromjson?
    | select(.type=="response_item" and .payload.type=="function_call")
    | (.payload.arguments // "") as $arguments
    | ([$arguments
        | scan("\\.claude/skills/([A-Za-z0-9][A-Za-z0-9_-]*)/SKILL\\.md")[0]]
       | unique[])
    | [$project, .] | @tsv
  ' "$file" >> /tmp/codex-beep-skill-events.tsv
done < /tmp/codex-beep-selected.tsv

awk -F '\t' '{n[$2]++; total++}
  END {for (k in n) print n[k], k; print "TOTAL", total > "/dev/stderr"}' \
  /tmp/codex-beep-skill-events.tsv | sort -nr

awk -F '\t' '{m=substr($3,1,7); n[m]++}
  END {for (m in n) print m, n[m]}' /tmp/codex-jun-jul-meta.tsv | sort
awk -F '\t' '{m=substr($3,1,7); n[m]++}
  END {for (m in n) print m, n[m]}' /tmp/codex-beep-selected.tsv | sort
awk -F '\t' '{if(min==""||$3<min)min=$3;if(max==""||$3>max)max=$3}
  END {print min,max}' /tmp/codex-beep-selected.tsv
```

### Project concentration, union, never-used list, and H5

```sh
# Claude directory/file totals; skill and command counts come from the event TSV.
awk -F '\t' '$1=="skill"{s[$2]++}$1=="command"{c[$2]++}
  END{for(k in s)print k,s[k],c[k]+0}' /tmp/claude-beep-events.tsv
find ~/.claude/projects -mindepth 1 -maxdepth 1 -type d -name '*beep*' -print0 |
while IFS= read -r -d '' d; do
  printf '%s\t' "${d##*/}"
  find "$d" -type f -name '*.jsonl' -printf . | wc -c
done

# Main-repo concentration percentages used above.
awk -F '\t' '$1=="skill"{n++; if($2 ~ /projects-beep-effect[0-9]*$/) main++}
  END{printf "main=%d total=%d pct=%.1f%%\n",main,n,100*main/n}' \
  /tmp/claude-beep-events.tsv

# Codex project-root buckets and selected-session counts.
awk -F '\t' '
  function bucket(path,a,n,i){n=split(path,a,"/");for(i=1;i<=n;i++)
    if(a[i]~/^beep-effect/)return a[i];return "other-beep-cwd"}
  ARGIND==1{sessions[bucket($2)]++}
  ARGIND==2{proxy[bucket($1)]++}
  END{for(p in sessions)print p,sessions[p],proxy[p]+0}
' /tmp/codex-beep-selected.tsv /tmp/codex-beep-skill-events.tsv | sort

awk -F '\t' '
  function bucket(path,a,n,i){n=split(path,a,"/");for(i=1;i<=n;i++)
    if(a[i]~/^beep-effect/)return a[i];return "other-beep-cwd"}
  {total++; b=bucket($1); if(b ~ /^beep-effect[0-9]*$/) main++}
  END{printf "main=%d total=%d pct=%.1f%%\n",main,total,100*main/total}
' /tmp/codex-beep-skill-events.tsv

# Build name/count files from the two event TSVs, then join the two signals.
awk -F '\t' '$1=="skill"{n[$3]++}END{for(k in n)print k"\t"n[k]}' \
  /tmp/claude-beep-events.tsv | sort > /tmp/claude-by-skill.tsv
awk -F '\t' '{n[$2]++}END{for(k in n)print k"\t"n[k]}' \
  /tmp/codex-beep-skill-events.tsv | sort > /tmp/codex-by-skill.tsv
join -a1 -a2 -e0 -o 0,1.2,2.2 /tmp/claude-by-skill.tsv \
  /tmp/codex-by-skill.tsv

# Zero-signal members of the 30-skill local inventory.
awk 'ARGIND==1{c[$1]=$2}ARGIND==2{x[$1]=$2}
  ARGIND==3 && c[$1]+x[$1]==0{print $1}' \
  /tmp/claude-by-skill.tsv /tmp/codex-by-skill.tsv /tmp/skill-inventory.txt

# H5 uses all 15 unique names actually enumerated by pre-audit section C,
# which labels the set as 16 but does not name a sixteenth skill.
printf '%s\n' claude-frontend-lane effect-services grill-me \
  jsdoc-annotation-specialist mcp-jetbrains onepassword-secret-refs \
  ponytail ponytail-audit ponytail-debt ponytail-gain ponytail-help \
  ponytail-review quality-review-fix-loop schema-model-specialist turborepo |
while read -r skill; do
  c=$(awk -F '\t' -v s="$skill" '$1==s{print $2}' /tmp/claude-by-skill.tsv)
  x=$(awk -F '\t' -v s="$skill" '$1==s{print $2}' /tmp/codex-by-skill.tsv)
  printf '%s\t%s\t%s\n' "$skill" "${c:-0}" "${x:-0}"
done
```

## Limitations

- Claude `Skill` calls are direct events, but they measure selection, not
  whether the instructions were followed or useful.
- Codex has no equivalent native event in these rollouts. A function-call
  argument may reference a skill file for discovery, auditing, documentation,
  or bulk inspection, so the proxy can materially overcount actual use.
- The Codex proxy counts at most one reference to a skill per function call.
  Multiple separate reads in one session remain multiple proxy calls.
- Codex coverage is limited to June and July 2026. Claude coverage is whatever
  remained in the 23 matching local project directories at snapshot time;
  deleted, moved, or rotated logs are invisible.
- The Codex selection assumes the first JSONL record is `session_meta`, as in
  the tested rollout format. Files that violate that convention would not be
  selected.
- `fromjson?` skips malformed or concurrently partial Codex JSONL lines. This
  protects streaming extraction but can undercount a call on such a line.
- Slash-command tags are metadata-bearing record counts, not reliable user
  invocation counts. The two 215-record unprefixed names especially look like
  injected plugin command metadata.
- Project-root bucketing merges nested Codex `cwd` values under the first
  `beep-effect*` path segment. This is intentional for concentration analysis;
  it is not a count of unique physical worktrees.
- The current 30-skill inventory is a snapshot. Historical skills removed or
  renamed before this run can still appear in the usage table, while a newly
  added skill has a shorter exposure window.
- No prompts, responses, reasoning, transcript excerpts, tool outputs, raw
  arguments, or transcript shell commands were exported into this report.
