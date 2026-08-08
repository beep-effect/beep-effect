---
{}
---

No release: move the four memory-heavy CI lanes (Check, Test Integration,
Coverage Regression, Docgen) and the push-only Build job onto the owned
`beep-ec2-heavy` EC2 spot runners; duplicate the image-size advisory triage so
this branch's proof is self-sufficient.
