# Validation — November 3, 2026

## Upload-ready 2.0.1 verification

- **19 automated tests passed**, including blank-database initialization from the first API request, automatic upgrade from a legacy database, retained existing login/session/ownership/record IDs, simultaneous initialization, and retry after an interrupted upgrade.
- `Redmont-Archives-Cloudflare-Upload.zip` was extracted to a fresh folder and its ZIP integrity and root layout were checked. It contains 12 root files including the server Worker, browser bundle and deployment launcher.
- The extracted Worker and assets ran under Cloudflare's local runtime with a legacy D1 database. The application, rather than a manually applied upgrade script, created the feature schema on first access. Existing password data, ownership and public record 22 were retained.
- That exact runtime then passed registration, organization/page creation, publishing, a subsequent formatted public edit and recovery-code reset.
- Future release requirements are stored in `AGENTS.md`, and `npm run package` produces both the ready upload and secondary source archives.

The earlier 2.0 editor/browser checks below still describe the unchanged editor behavior. This update changes deployment packaging and startup database handling. No production deployment was performed.

## Completed checks

| Check | Result |
| --- | --- |
| Production server and browser bundle | `npm run build` passed; complete `dist/_worker.js`, `dist/app.js` and static assets generated |
| Automated API, data-integrity, deployment and content tests | `npm test`: **19 passed, 0 failed** |
| Browser workflow | Passed in headless Chromium with desktop 1440×1000 and mobile 390×844 layouts |
| Cloudflare local runtime | Built Worker ran in Wrangler 4.157.0 with a local D1 binding; health, schema, registration, PBKDF2, sessions, organization creation, rich page publishing/reading and recovery passed |
| Dependency audit | `npm audit --audit-level=low`: **0 vulnerabilities reported** at validation time |
| Visual inspection | Home, editor and mobile published-record screenshots inspected; no horizontal overflow in the checked mobile views |

## API and integrity coverage

1. Rich content formatting survives sanitization, while scripts, event handlers, unsafe URLs and unsafe styles are removed.
2. Old plain text, Markdown fences and singly escaped editor HTML render readably.
3. Both legacy page-creation aliases require the appropriate organization owner/editor role.
4. Edit, publish, restore, trash, revision history and stale-version rejection retain the expected content.
5. Simultaneous edits yield one winner; the rejected edit cannot overwrite that winner.
6. Drafts and archived organization content stay out of public APIs, search and assistant retrieval.
7. Registration, case-aware login, recovery-code reset, code replacement and prior-session invalidation work.
8. Owners control team roles and audit access; editors cannot grant themselves ownership.
9. Cross-origin writes, malformed bodies and repeated login attempts are rejected.
10. The SQL upgrade can run twice on a legacy fixture while preserving users, password hashes, organization ownership, record IDs, content and an unrelated legacy table.
11. Signup aliases resolve to `/register`, root HTML starts with a doctype, and debug APIs are unavailable.
12. Owned-content exports include revisions without password, recovery or session hashes.
13. The first edit of an old record preserves its original text as revision 1.
14. The model request contains only public excerpts; invalid citations fall back to archive passages.
15. Expired sessions and passwords changed during sign-in cannot authorize new sessions.

## Browser coverage

The browser workflow logs in, applies bold and a pixel font size, inserts a table, checklist, link, HTTPS image, header and footer, changes a checkbox, previews and publishes. It checks that formatting and checkbox state appear in the public view, then edits again and verifies the new text appears publicly. It also checks registration, show-password behavior, a real recovery-code reset, login with the changed password, organization creation, draft saving and organization-page publishing. No uncaught page errors occurred.

Desktop and mobile page overflow checks passed. Test records, test recovery codes and screenshots are internal local fixtures and are excluded from the downloadable package.

## Scope

These are local and simulated-data checks, not a claim that every possible bug is absent. The live production database was not accessed or modified, and the public domain lookup was unavailable. The migration was validated against the schema implied by the inspected current repository and a legacy fixture; make the included private backup before upgrading your real database.

The real external AI service was not called with a production credential; provider requests and invalid-citation handling were mocked for the relevant test. The local excerpt fallback was exercised. The Windows batch files are provided for the user's Windows setup and were reviewed here; this validation environment ran Linux rather than Windows.
