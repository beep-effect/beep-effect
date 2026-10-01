# Spot pool spread — launches and job outcomes, 2026-10-01 12:05–12:45 UTC

Dated record for the "Deployment evidence — 2026-10-01 (Spot pool spread)" entry in
[ci-runner-reliability.md](../ci-runner-reliability.md). EC2 keeps terminated-instance
records for a limited time, so the launch-to-job join is preserved here. Instance ids are
shortened to their last six characters; workflow run ids are public on GitHub.

Source queries (run at 12:50 UTC): `aws ec2 describe-instances` filtered on the
`ghr:Application` tag and `LaunchTime` within the window; the Actions jobs API for every
`Check` run created after 10:30 UTC, joined on `runner_name`; `aws cloudtrail lookup-events`
with `AttributeKey=EventName,AttributeValue=BidEvictedEvent` for the same window.

| Launch (UTC) | Type | Zone | Heavy job | Outcome at 12:50 UTC | Run | Instance |
|---|---|---|---|---|---|---|
| 12:07:01 | `m6a.4xlarge` | `us-east-1a` | Docgen | success | 36856678457 | …f57ac0 |
| 12:07:03 | `m7i.4xlarge` | `us-east-1d` | Doctest | success | 36856678457 | …d53867 |
| 12:07:16 | `m6a.4xlarge` | `us-east-1a` | Coverage Regression | failure | 36856678457 | …dd8352 |
| 12:07:52 | `m6a.4xlarge` | `us-east-1a` | Lint Policy | success | 36856678457 | …53c2c3 |
| 12:09:21 | `m6a.4xlarge` | `us-east-1a` | Test Integration | success | 36856561977 | …868877 |
| 12:12:26 | `m6a.4xlarge` | `us-east-1a` | Docgen | success | 36856561977 | …0547c9 |
| 12:12:32 | `m7i.4xlarge` | `us-east-1d` | Doctest | success | 36856561977 | …bd078c |
| 12:13:02 | `m7i.4xlarge` | `us-east-1d` | Check | success | 36856561977 | …9ddc43 |
| 12:14:27 | `m7i.4xlarge` | `us-east-1d` | Lint Policy | success | 36856561977 | …e23b03 |
| 12:14:40 | `m7i.4xlarge` | `us-east-1d` | Build | success | 36856561977 | …28699a |
| 12:17:57 | `r6a.2xlarge` | `us-east-1a` | Coverage Regression | failure (Spot eviction 12:23:02 UTC) | 36856561977 | …226dba |
| 12:18:17 | `m7i.4xlarge` | `us-east-1d` | Check | success | 36858959880 | …3685e6 |
| 12:18:56 | `m7i.4xlarge` | `us-east-1c` | Build | success | 36858959880 | …7f8eb9 |
| 12:20:56 | `m7i.4xlarge` | `us-east-1c` | Doctest | success | 36858959880 | …fff315 |
| 12:21:59 | `m7i.4xlarge` | `us-east-1c` | Docgen | success | 36858959880 | …a2563f |
| 12:22:12 | `m7i.4xlarge` | `us-east-1c` | Test Integration | success | 36858959880 | …ed1b9d |
| 12:23:04 | `m7i.4xlarge` | `us-east-1c` | Coverage Regression | success | 36858959880 | …b73d12 |
| 12:23:44 | `m7i.4xlarge` | `us-east-1c` | Lint Policy | cancelled | 36858959880 | …fdb314 |
| 12:24:06 | `m7i.4xlarge` | `us-east-1c` | Check | success | 36853948319 | …91d040 |
| 12:25:12 | `m7i.4xlarge` | `us-east-1c` | Coverage Regression | cancelled | 36853948319 | …0d80a9 |
| 12:26:03 | `r6a.2xlarge` | `us-east-1a` | Docgen | cancelled | 36853948319 | …50f05b |
| 12:26:13 | `r6a.2xlarge` | `us-east-1a` | Build | success | 36860910363 | …7fa17b |
| 12:29:05 | `r6a.2xlarge` | `us-east-1a` | Coverage Regression | in_progress | 36860910363 | …327ecb |
| 12:29:49 | `r6a.2xlarge` | `us-east-1a` | Docgen | success | 36860910363 | …45d6d8 |
| 12:29:53 | `r6a.2xlarge` | `us-east-1a` | Lint Policy | in_progress | 36860910363 | …c78526 |
| 12:30:14 | `r7a.2xlarge` | `us-east-1b` | Check | success | 36860910363 | …75c91c |
| 12:31:40 | `r6a.2xlarge` | `us-east-1b` | Doctest | success | 36860910363 | …10837f |
| 12:33:34 | `r6a.2xlarge` | `us-east-1b` | Test Integration | success | 36860910363 | …320a11 |
| 12:34:00 | `r6a.2xlarge` | `us-east-1b` | Lint Policy | in_progress | 36856816907 | …58e02d |
| 12:34:06 | `r6a.2xlarge` | `us-east-1b` | Check | success | 36862034113 | …35e12d |
| 12:35:28 | `r6a.2xlarge` | `us-east-1b` | Docgen | success | 36862034113 | …185081 |
| 12:35:41 | `r6a.2xlarge` | `us-east-1b` | Test Integration | success | 36862034113 | …7cd223 |
| 12:35:47 | `r6a.2xlarge` | `us-east-1b` | Doctest | success | 36862034113 | …ed155e |
| 12:37:09 | `r6a.2xlarge` | `us-east-1b` | Lint Policy | in_progress | 36862034113 | …d7e9bb |
| 12:38:00 | `r6a.2xlarge` | `us-east-1b` | Coverage Regression | success | 36862034113 | …456681 |
| 12:38:57 | `r6a.2xlarge` | `us-east-1b` | Build | success | 36862034113 | …97764f |
| 12:39:17 | `m7i.4xlarge` | `us-east-1f` | Docgen | success | 36861577932 | …0cc9fa |
| 12:41:43 | `r6a.2xlarge` | `us-east-1b` | Test Integration | success | 36861577932 | …8e8876 |
| 12:42:00 | `r6a.2xlarge` | `us-east-1b` | Lint Policy | in_progress | 36861577932 | …77dc37 |
| 12:42:54 | `r6a.2xlarge` | `us-east-1b` | Coverage Regression | in_progress | 36861577932 | …840e70 |

Totals: 40 launches; 3 cancelled, 2 failure, 6 in_progress, 29 success.
CloudTrail `BidEvictedEvent` in the window: 3 — one on …226dba above, two on workers launched
before the apply (…32a956, …7be2cd).
