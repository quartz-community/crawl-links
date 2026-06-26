# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Quartz community plugin template.
- `disableBrokenWikilinks` option: when enabled, internal links whose resolved slug is not present in `ctx.allSlugs` gain a `broken` CSS class alongside `internal` so broken links can be styled distinctly. The check lives here (rather than in `ObsidianFlavoredMarkdown`) because this plugin owns link resolution and already computes the canonical slug.

### Changed

- **BREAKING (inherited from `@quartz-community/utils`)**: internal link resolution is now case-insensitive. Links resolve to lowercased slugs regardless of how they're typed (`[[MyNote]]`, `[[mynote]]`, `[[MYNOTE]]` all produce href `my-note`). Matches Obsidian's link-matching behavior.

### Fixed

- `prettyLinks` no longer truncates explicit link aliases. The folder-stripping that turns a bare `[[folder/note]]` into `note` now skips links with an author-supplied alias, so an alias containing a slash (e.g. `[[guide\|Setup/Config]]`) renders in full instead of collapsing to its last segment (`Config`).
