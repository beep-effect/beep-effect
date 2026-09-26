# Effect Drizzle test dependency review

Accept only nine task dependency updates caused by the development-only
@beep/fc-runs and @beep/test-runner additions, including both integration tasks.
Preserve every command, task configuration, cache flag, profile, epoch, scope
and unrelated node from main. No runtime dependency or cache eligibility is
added. The generated cache census was compared field-by-field before accepting
these dependency edges.
