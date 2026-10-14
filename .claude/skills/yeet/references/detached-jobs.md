# Detached durable jobs

Read when you submit a `--detach` job or wait on one with `bun run beep yeet job wait`. Part of the yeet skill.

Use `--detach` for a proof expected to outlive the current repair loop. It runs
as a transient systemd user service and reports completion or death through the
checkout inbox. An unavailable user manager is an error.

```bash
bun run beep yeet verify --tier cheap-gates --detach
bun run beep yeet publish --message "feat: describe change" --detach
bun run beep yeet monitor --until-ready --detach
bun run beep yeet job wait <jobId> --timeout "1 hour"
bun run beep yeet job status <jobId> --ack
bun run beep yeet job logs <jobId> --tail 100
bun run beep yeet job cancel <jobId>
```

`repair`, `closeout`, and `monitor` also accept `--detach`. Use
`--job-max-runtime "2 hours"` to set a systemd runtime ceiling; give one to a
detached `monitor --until-ready` that may be abandoned, because a red does not
end it. `--plan` and recursive detachment inside a job are rejected.
`job wait` returns:

| Exit | Outcome | Meaning |
| --- | --- | --- |
| 0 | `success` | The job settled green (a monitor ended `ready` or `merged`). |
| 1 | `failure` | The job settled red: a proof failed, or a monitor ended `closed`, `settle-timeout`, or `poll-error-budget`. |
| 2 | `wave` | A new wave landed on the monitor job's pull request: new P0 rows, new P1 `review-thread` or `pr-comment` rows, or a required red that came back red on a rerun of the same head. Optional reds never count. The job keeps running and the rows stay live (see Inbox). |
| 3 | `terminated` | The job ended without a verdict (for example `cancelled`, `oom-killed`, `signal`, or `timeout`); re-submit it. |

A `--timeout` expiry also exits 1 but leaves the job running. `job wait`
acknowledges the job's own informational inbox row when the job settles and
never acknowledges wave rows.
Use `yeet inbox ack <id> --observed` to acknowledge a job result manually.
The finalizer records abnormal deaths in the attempt journal; job records and
logs remain under `.beep/yeet/jobs/`, with the newest 50 terminal jobs retained.
