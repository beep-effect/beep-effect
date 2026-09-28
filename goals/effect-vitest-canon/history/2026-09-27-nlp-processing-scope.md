# NLP Processing cache scope

Nine resource-bearing cases use separate named it.layer fixtures. Each asserts
an empty initial ResultStore, preserving independent cache instances and every
original size, hit/miss, result and error assertion. Pure schema cases acquire
no cache layer. Full package audit and docgen pass; no production code changed.
