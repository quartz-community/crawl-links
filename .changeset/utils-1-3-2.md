---
"@quartz-community/crawl-links": patch
---

Bundles `@quartz-community/utils` 1.3.2: links to blocks are `#^id` (they were `#id`, which a heading of the same name could take), matching the block ids rehype-obsidian 1.6 writes. This plugin is deprecated (link handling is built into Quartz 5.1+).
