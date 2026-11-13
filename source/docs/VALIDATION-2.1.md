# Redmont Archives 2.1 verification — November 13, 2026

The release implements the 100 items in the repository's `PRIORITIES-100.md` and machine-readable registry. The site's Help page renders the same registry. These are bounded, concrete changes to the existing application, including both outstanding review findings from PR #1.

## Completed validation

- 28 automated tests pass: existing authorization, publishing, revisions, recovery and migration tests, plus numeric-slug collisions, metadata privacy, summaries, all advanced search filter classes, draft duplication, public-only related records/feeds/stats, correction authorization, session isolation, HEAD, static methods, malformed paths and finite pagination.
- The original browser workflow passes for formatted content, images, tables, checklists, published edits, account creation and reset, and organization draft/publish paths.
- The new browser workflow passes for metadata and private-note exclusion, starter templates/callouts, reading controls, bookmarks/history, saved and advanced searches, appearance persistence, Help's 100-item list, service status, and mobile navigation without horizontal overflow.
- Production browser and Worker bundles build successfully. Root and dist runtime copies are synchronized and verified with SHA-256 manifests. The previous `001-complete.sql` migration is unchanged; additions use `002-workspace.sql`.
- Both ZIP deliverables build, including the previously broken secondary source package. ZIP CRC validation and extraction checks are performed before publication.
- The runtime dependency audit reports zero known vulnerabilities at verification time.

## Deliberate boundaries

Bookmarks, reading history, saved searches and reading preferences are browser-local and described as such in the UI. They do not pretend to synchronize between devices. Summaries/tags/private notes have their own Save details control; they are not part of document-content revision history. Table structure tools handle unmerged cells and explain that restriction when merged cells are selected.

Search ranks at most 100 recent candidates per content type before the new filters; feeds/sitemap bound candidate output to 500 per type. Public statistics count the full published data, exclude drafts/deleted records, and omit archived organization pages. Recovery remains code-based; no email delivery or new paid service is required.

All application errors observed during this implementation were addressed. Passing these checks is not a guarantee that no undiscovered issue can exist, and the production database was not copied into test fixtures. No sample accounts, test records, local databases, screenshots, credentials, or node_modules are included in the Git update.
