---
"@quartz-community/crawl-links": patch
---

Fix prettyLinks truncating explicit wikilink aliases that contain a slash. Previously `path.basename()` was applied to all link text, turning an alias like `Part 1/Part 2` into just `Part 2`. prettyLinks now skips links that have an explicit alias.
