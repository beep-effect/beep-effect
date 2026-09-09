#!/usr/bin/env bash
# Measure the host around one lane without changing the lane's exit status.
# MemTotal - MemAvailable includes the host and overlapping processes; it is a
# sampled capacity signal, not an exact process peak or a billing measurement.
set -uo pipefail

lane="${1:-}"
if [[ ! "$lane" =~ ^[a-z][a-z0-9-]{0,63}$ ]] || (( $# < 2 )); then
  echo 'usage: ci-runner-resources.sh <lane> <command> [args...]' >&2
  exit 64
fi
shift

metrics_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/beep-runner-resources"
if ! mkdir -p "$metrics_dir"; then
  echo '::warning::Runner resource measurement unavailable; executing lane.' >&2
  exec "$@"
fi
samples="$metrics_dir/$lane.tsv"
summary="$metrics_dir/$lane.md"
started="$(date +%s)"
cpu_before="$(awk '/^cpu / {for(i=2;i<=9;i++) total+=$i; print total, $5+$6}' /proc/stat)"
swap_before="$(awk '/^pswpin / {input=$2} /^pswpout / {output=$2} END {print input+0, output+0}' /proc/vmstat)"
printf 'epoch\ttotal_kib\tavailable_kib\tused_kib\n' > "$samples"

sample() {
  awk -v epoch="$(date +%s)" '
    /^MemTotal:/ {total=$2}
    /^MemAvailable:/ {available=$2}
    END {if (total > 0) printf "%d\t%d\t%d\t%d\n", epoch, total, available, total-available}
  ' /proc/meminfo >> "$samples"
}
sample
(
  while sleep 5; do sample; done
) &
sampler_pid=$!

finish() {
  local status=$?
  trap - EXIT
  kill "$sampler_pid" 2>/dev/null || true
  wait "$sampler_pid" 2>/dev/null || true
  sample
  local ended cpu_after swap_after
  ended="$(date +%s)"
  cpu_after="$(awk '/^cpu / {for(i=2;i<=9;i++) total+=$i; print total, $5+$6}' /proc/stat)"
  swap_after="$(awk '/^pswpin / {input=$2} /^pswpout / {output=$2} END {print input+0, output+0}' /proc/vmstat)"
  awk -v lane="$lane" -v status="$status" -v seconds="$((ended-started))" \
    -v before="$cpu_before" -v after="$cpu_after" \
    -v swap_before="$swap_before" -v swap_after="$swap_after" '
    NR > 1 {count++; total=$2; if ($4 > peak) peak=$4; if (count==1 || $3 < available) available=$3}
    END {
      split(before,b," "); split(after,a," "); delta=a[1]-b[1]
      split(swap_before,sb," "); split(swap_after,sa," ")
      print "### Runner resources: " lane
      print ""
      print "| Measurement | Value |"
      print "| --- | --- |"
      printf "| Lane exit status | %d |\n| Elapsed seconds | %d |\n", status, seconds
      printf "| Memory samples (5-second interval) | %d |\n", count
      printf "| Host memory GiB | %.2f |\n| Sampled used-memory peak GiB | %.2f |\n", total/1048576, peak/1048576
      printf "| Minimum available memory GiB | %.2f |\n", available/1048576
      if (delta > 0) printf "| Host CPU busy percent (excluding I/O wait) | %.1f |\n", 100*(delta-(a[2]-b[2]))/delta
      printf "| Swap-in / swap-out pages | %d / %d |\n", sa[1]-sb[1], sa[2]-sb[2]
      print ""
      print "Host-wide samples include the OS and other processes. Peaks between samples may be missed."
      print "Elapsed time excludes checkout/setup and is not billed instance lifetime."
    }
  ' "$samples" > "$summary"
  cat "$summary"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    cat "$summary" >> "$GITHUB_STEP_SUMMARY" || true
  fi
  exit "$status"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"$@"
exit "$?"
