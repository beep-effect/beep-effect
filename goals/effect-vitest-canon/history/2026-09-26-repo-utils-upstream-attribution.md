# Repository utilities upstream runtime attribution

Thirteen historical property runtime wrappers were removed before this wave by
commit `b1aa7e320cde926e7e80a98073ba8b0d517d7c8c` in PR #1200. The frozen-to-main
history contains only that matching runtime-removal commit for the five affected
files. Parent/commit source comparisons and saved diffs establish the counts:
five JSDoc laws, three TSMorph model laws, one TSMorph service law, three
PackageJson codec laws and one TSConfig compiler-options law.

Those laws currently yield manual arbitrary checks from effect tests. Their
remaining property-registration work belongs to this wave, but the historical
runtime-wrapper removals must retain the upstream fix SHA. The PackageJson-name
runtime wrapper and TSConfig prototype-key parsing wrapper remain current work.

The attribution receipt lists each original finding ID. The frozen detector's
177 rows and main's 180 rows have 299 distinct historical IDs, largely because
anchors moved. This union is provenance, not a count of distinct executable
problems. Final reconciliation must map each original subject to current source
and avoid duplicate fixed credit for retained predicate exceptions.
