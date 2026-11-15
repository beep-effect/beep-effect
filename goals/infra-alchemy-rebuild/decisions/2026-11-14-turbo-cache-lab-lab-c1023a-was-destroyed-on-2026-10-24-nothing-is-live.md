---
title: "Turbo-cache lab lab-c1023a was destroyed on 2026-10-24; nothing is live"
date: 2026-11-14
reversal: "n/a (record only)"
---

**What the lab was.** It was the disposable AWS conformance lab of the completed goal
`turborepo-cache-conformance`, epoch `c1023a`, Pulumi stack `beep-turbo-cache-lab/lab-c1023a`.
- Its program, infra/src/internal/turbo-cache-lab-entry.ts (removed in #3341), deployed two
  `CiTurboCache` copies: an incumbent and an "evolved" incumbent.
- Each copy had an S3 bucket, an HTTP API with its authorizer, reader and writer Lambdas, their IAM
  roles and their log groups.
- The lab script's bootstrap added one KMS key and three SSM SecureStrings under
  `/beep-ci/cache-lab/c1023a/`.
- Every resource carried the tags `beep:lab=turbo-cache-conformance` and `beep:lab-epoch=c1023a`.

**Lifetime.** The Pulumi backend keeps four backups of that stack:
- First update 2026-10-24T01:12:05Z, a 100 KB checkpoint.
- Grown at 02:23:46Z to 201 KB, with both incumbents.
- Last full checkpoint at 03:21:10Z, 191 KB.
- At 03:21:59Z, 392 bytes: an empty deployment. That is consistent with the script's destroy (a
  targeted destroy of the bucket policies, emptying the buckets, a full destroy) followed by
  `pulumi stack rm`, which leaves only the `.bak`.

The backend lists no such stack today.

**Live check, 2026-11-14.** Seven read-only AWS calls in `us-east-1`, each made once, all came back
empty:
1. The resource-tag query for `beep:lab-epoch=c1023a`.
2. The same query for `beep:lab=turbo-cache-conformance`, any epoch.
3. SSM parameters under `/beep-ci/cache-lab/`.
4. CloudWatch log groups with the prefix `/aws/lambda/beep-tcl-`.
5. CloudWatch log groups matching the pattern `beep-tcl`.
6. IAM roles whose names start with `beep-tcl`.
7. S3 buckets whose names start with `beep-tcl`.

The KMS key's 7-day deletion window has long passed, and the key no longer appears in the tag query.
Nothing accrues cost.

**What remains.** Five small objects in the Pulumi backend bucket belong to that stack: the `.bak` and
the four backups, about 0.5 MB together. They stay with the bucket, whose fate the operator decides at
closeout.

**Consequence.** Deleting the lab program and its script (#3341) loses no capability and strands no
resource. To reverse it, restore the files from git history; there is nothing to redeploy.

**Who gathered the evidence, and its limits.** The packet's P6 retire-inventory lane gathered it on
2026-11-14. It read the lab program and the lab script, then made the seven read-only calls above
under the operator workstation's AWS profile. The P6 inventory document is committed under the
packet's research directory by a following packet PR. The check covers the lab's tag, name-prefix and
parameter-path conventions as the lab script creates them; a resource created outside those
conventions would not be found by it.
