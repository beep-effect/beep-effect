# OBS runner dependency cache review

The OBS test migration adds @beep/test-runner as a development dependency.
Accept only its resulting computation dependency-list changes. No task commands,
cache configuration, global inputs, profile, epoch or qualification scope changes
are requested. Compare the generated projection with the saved prior baseline;
reject unrelated node or configuration changes before accepting this checkpoint.
