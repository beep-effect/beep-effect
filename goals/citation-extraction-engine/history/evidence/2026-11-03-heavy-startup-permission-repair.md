# Restore hosted Check startup after shared Heavy changes

Check run 41602842326 on head 559eedb77f completed with startup_failure and zero
jobs. The REST run/check-suite APIs exposed no annotations or logs. GitHub's
run page provided the validation error: the check.yml caller at line 142 could
not call heavy.yml@main because its nested producer-execute job requests
Actions read access while the caller's ceiling allows none.

The same startup failure is present on main runs 41601545481 (41c9e36157) and
41601685028 (7cffc29535). Commit 41c9e36157 introduced the protected producer
execution job with contents/actions read permissions. The old quality and
inspection/preparation callers retained only contents read. GitHub validates
nested permission requests before the excluded operational job's condition.
No citation tests executed in the failed run.

Set the caller-job permission ceiling to contents read and actions read in
check.yml, heavy-admit.yml, cache-producer-inspect.yml and
cache-producer-prepare.yml. The dedicated cache-producer.yml caller already has
that ceiling and needs no change. These are job-local maximums for calling the
shared workflow. The called workflow's ordinary verify job still explicitly
selects contents-only permissions; inspection/preparation retain the shared
contents-only default. The protected producer retains its closed manual main
workflow-ref guard, existing secret selection and approval conditions. This
repair does not select or execute the producer, publish cache artifacts, grant
write access or change a quality check's pass criteria.

A regression test reads the nested producer's requested ceiling and compares
all five callers against it. It fails against the old check.yml permissions,
then passes after the four caller repairs. It also verifies the ordinary
verify job's contents-only policy, absence of producer selection in Check, the
protected workflow-ref guard and workflowPolicyDiagnostics for all five callers.
The existing inspection, preparation and protected execution policy tests also
pass: four focused tests total. Repo-cli test compilation, scoped lint and the
zero-finding new-only Fallow audit pass. Hosted startup is only repaired once a
new run actually creates jobs; all later exact-head checks remain required.

The source-wide regex witness Integration receipt on 369c98b458 remains valid
historical proof. The new regex modes still require exact-head hosted checks.
Coverage retirement attribution, server floors and full family/engine proof
remain open. No goal completion row advances with this infrastructure repair.
