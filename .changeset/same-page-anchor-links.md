---
"@quartz-community/crawl-links": patch
---

A same-page link written as a heading's text, such as `[x](<#My Heading>)` or `[x](#监听%20127.0.0.1（推荐）)`, now points at the heading's id instead of an anchor that matches nothing, and `#^block` links point at the block. Anchors are slugged with the shared `slugHeading` from `@quartz-community/utils`, the same function heading ids are made with. An anchor that already names an id on the page is left unchanged.
