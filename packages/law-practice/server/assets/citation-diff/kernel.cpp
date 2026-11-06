/* Authored private ABI around the unchanged Apache-2.0 DMP header shipped in
 * fast-diff-match-patch 2.0.1. See sources/ and licenses/.
 * Runs only in a parent-owned stoppable process, never on the parent thread.
 * The source fixes Diff_Timeout=0, checklines=false and cleanup="No".
 * Parent Effect Clock owns cancellation/deadlines; clock() cannot expire the
 * source's numeric_limits<clock_t>::max() deadline and reads no host clock.
 * Input points are four-byte Python Unicode points, including surrogates.
 * An allocation/exception trap publishes no result. A step refusal leaves an
 * empty output; callers must check the status before reading the output.
 */
#include <cstdint>
#include <vector>
#include "diff_match_patch.h"
static_assert(sizeof(wchar_t) == 4, "The pinned Python oracle uses four-byte wchar_t");
static std::vector<uint32_t> steps;
extern "C" {
clock_t clock() { return 0; }
uint32_t citation_diff_version() { return 20001; }
uint32_t citation_diff_run(const wchar_t* before, uint32_t before_length,
                           const wchar_t* after, uint32_t after_length, uint32_t ceiling) {
  steps.clear();
  if (uint64_t(before_length) + after_length > 4000000 || ceiling > 2000000) return 2;
  diff_match_patch<std::wstring> dmp;
  dmp.Diff_Timeout = 0;
  const auto diffs = dmp.diff_main(std::wstring(before, before_length), std::wstring(after, after_length), false);
  if (diffs.size() > ceiling) return 1;
  steps.reserve(diffs.size() * 2);
  for (const auto& diff : diffs) {
    steps.push_back(static_cast<uint32_t>(diff.operation));
    steps.push_back(static_cast<uint32_t>(diff.text.length()));
  }
  return 0;
}
const uint32_t* citation_diff_output() { return steps.data(); }
uint32_t citation_diff_steps() { return steps.size() / 2; }
void citation_diff_release() { std::vector<uint32_t>().swap(steps); }
}
