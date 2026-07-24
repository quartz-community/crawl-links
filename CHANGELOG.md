# Changelog

## 0.1.1

### Patch Changes

- c8a04da: Fix prettyLinks truncating explicit wikilink aliases that contain a slash. Previously `path.basename()` was applied to all link text, turning an alias like `Part 1/Part 2` into just `Part 2`. prettyLinks now skips links that have an explicit alias.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Quartz community plugin template.
- `disableBrokenWikilinks` option: when enabled, internal links whose resolved slug is not present in `ctx.allSlugs` gain a `broken` CSS class alongside `internal` so broken links can be styled distinctly. The check lives here (rather than in `ObsidianFlavoredMarkdown`) because this plugin owns link resolution and already computes the canonical slug.

### Changed

- **BREAKING (inherited from `@quartz-community/utils`)**: internal link resolution is now case-insensitive. Links resolve to lowercased slugs regardless of how they're typed (`[[MyNote]]`, `[[mynote]]`, `[[MYNOTE]]` all produce href `my-note`). Matches Obsidian's link-matching behavior.
