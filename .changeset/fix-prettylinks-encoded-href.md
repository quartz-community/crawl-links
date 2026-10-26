---
"@quartz-community/crawl-links": patch
---

Fix prettyLinks keeping the folder on an un-aliased link whose path contains a space or a non-ASCII letter. The alias
check now compares the link text against the percent-decoded href as well as the raw one, so
`[[Folder/Name With Space]]` displays as `Name With Space` and no longer gets the `alias` class.
