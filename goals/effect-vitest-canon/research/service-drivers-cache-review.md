# Service-driver runner dependency review

The Firecrawl, Runpod and Sanity test-runner devDependencies add30 direct
task edges to the executable graph:10 Firecrawl,11 Runpod and9 Sanity.
Each changed list gains exactly one test-runner audit, build, codegen or
transit edge matching its task contract. No dependency is removed, and all
existing duplicate edges retain their multiplicity. Only these30 dependency
lists and this review basis change in the qualification baseline. Commands,
configuration, source digests and qualification scope remain unchanged.
This is graph maintenance, not a cache-safety promotion.
