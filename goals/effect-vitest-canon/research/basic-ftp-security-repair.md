# Inherited FTP dependency security repair

PR 1390 Security failed on basic-ftp 5.3.1 with GHSA-c475-qrg2-pj4r. The
migration did not introduce the dependency: the branch and its base had the
same lockfile. The dependency path is box-node-sdk -> proxy-agent ->
pac-proxy-agent -> get-uri -> basic-ftp.

The operator authorized identified production repairs without another approval,
provided they are recorded in this goal. This narrow repair adds the existing
root override mechanism for basic-ftp 6.2.1 and regenerates the lockfile. Only
the override entry and basic-ftp package resolution change; the vulnerability
is not waived or added to scanner exclusions.

The upstream advisory identifies versions through 6.2.0 as affected and 6.2.1
as patched. The v6 major change disables separate transfer hosts by default;
this prevents FTP bounce behavior and is intentionally retained. No opt-out
is introduced. See [the advisory](https://github.com/advisories/GHSA-c475-qrg2-pj4r)
and [v6 release notes](https://github.com/patrickjuchli/basic-ftp/releases/tag/v6.0.0).

A private local FTP fixture verifies get-uri 6.0.5 against the override:
exact PAC-file download content, modification timestamp, ENOTFOUND for a missing
file, and ENOTMODIFIED for a cached file. A malformed directory listing with
65,536 repeated owner/group tokens followed by a normal row parses in under
one millisecond and retains the normal row. Resolution checks confirm get-uri
loads 6.2.1. The isolated fixture closes all test sockets and passive servers.
Frozen-lockfile installation passes. The same OSV scanner image and arguments
used by hosted Security pass against copies of the updated lockfile and
unchanged scanner configuration: 3,334 packages scanned, no issues found,
exit 0. Checkout dependency tracing confirms basic-ftp resolves to 6.2.1.
