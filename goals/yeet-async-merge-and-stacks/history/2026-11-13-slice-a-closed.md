# Slice A closed: merges observed on the async path, legacy call deleted, 2026-11-13

The last two parts of the slice A acceptance row (`SPEC.md`): ordinary PRs
merging through `merge-async` with the gated head, and the legacy call
deleted after its watch day. The blocked-PR hold is in
[`2026-11-10-slice-a-blocked-hold.md`](./2026-11-10-slice-a-blocked-hold.md).

## Merges observed on the async path

The port (#3099) merged on 2026-11-12 at 19:20:11Z as `ce6291ea03`. From
then on `main`'s CLI sends every Yeet merge to `merge-async` by default.
Four relaxed (S11) merges later that day left the gate's own comment on the
PR, which names the endpoint, the gated head and the bypass it sent:

| PR | Gate comment (first line) | GitHub's record |
| --- | --- | --- |
| #3121 | `merged 57346a21b6 as 3e2e0acaed via merge-async, with a rules bypass requested over the checks below.` | merged 21:56:30Z, head `57346a21b6`, squash `3e2e0acaed` |
| #3125 | `merged 6cc4ba5781 as a1a0e71bb5 via merge-async, with a rules bypass requested over the checks below.` | merged 22:03:28Z, head `6cc4ba5781`, squash `a1a0e71bb5` |
| #3126 | `merged 6257d6146e as 0d749373d0 via merge-async, with a rules bypass requested over the checks below.` | merged 22:18:42Z, head `6257d6146e`, squash `0d749373d0` |
| #3119 | `merged 94a4e71cfa as d1adeb147b via merge-async, with a rules bypass requested over the checks below.` | merged 22:34:34Z, head `94a4e71cfa`, squash `d1adeb147b` |

In each row the head and the squash commit in the comment equal the ones
GitHub reports for the pull request, so the request was pinned to the gated
head and the poll read the real merge commit. Each comment also records the
bypass the relaxed gate sent, which is the "relaxed mode records the one it
sends" part of the row.

## What was not observed

- **A strict merge leaves no trace on GitHub.** A strict gate prints its
  `MERGED ... via merge-async` line to the terminal only, so no strict merge
  is quoted here. Strict mode sending `bypass_rules: false` is covered by the
  async merge suite under the repo CLI's tests, which asserts the request
  body, and by the P0 probes.
- **Whether #3099 itself merged through the new path is not known.** The
  slice row asked for that. Its merge left no gate comment, GitHub does not
  record which endpoint merged a pull request, and the lane's session was
  idle when it merged. A checkout that had not yet merged the port would
  have used the legacy call. The four merges above stand in for it.

## Legacy call deleted

The watch day ended on 2026-11-11 with no merge routed back through the
switch on record. This PR deletes the legacy REST merge call, the
`BEEP_YEET_MERGE_ENDPOINT` switch and, with them, the endpoint field on a
merge settlement: with one endpoint left there is nothing for it to
distinguish. Merge lines still end `via merge-async`.
