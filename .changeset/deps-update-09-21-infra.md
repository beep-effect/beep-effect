---
"@beep/infra": patch
---

Drop the explicit `logging` argument from the Pulumi `command.local.Command` and `command.remote.Command` resources: `@pulumi/command` 4.x removed the option and its `enums.Logging` namespace, and the value the stack passed (`StdoutAndStderr`) was already the provider default.
