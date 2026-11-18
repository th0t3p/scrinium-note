# Validation

Community source snapshot: [th0t3p/scrinium-community](https://github.com/th0t3p/scrinium-community).
Not deployed as a public service and not an independently audited security product.

## Public source publication — 2026-11-18

The owner explicitly authorized a new public repository. Both the browser owner
and the SSH authentication greeting identified `th0t3p`. The isolated community
history was pushed over `github.com-th0t3p` to the repository's `main` branch;
GitHub showed Public, the expected source files, README and PolyForm license link.
All commit authors use the active identity. The tracked-file credential/artifact
scan and all 12 extracted-file hashes passed before upload. The repository's
About website points to Scrinium and its topics describe the actual community
features. No production history, real vaults, Pro modules or runtime credentials
were uploaded. No container registry image, hosted application or GitHub Release
was published by this source upload.

Baseline: existing Scrinium dark/purple theme tokens, basic Milkdown editing and
libsodium vault/note encryption. Database: `scrinium-community-v1`; no original
Scrinium database is opened. Package: one static browser app plus optional static
Nginx Docker host. No runtime environment variables, credentials or application API.

## Checks completed on 2026-11-18

- `npm test`: extracted crypto and search suites plus 14 vault behavior checks passed on the host and in the Docker build. Checks cover ciphertext persistence, recovery/password rotation, tampering, duplicate imports, atomic empty-vault restore, queued edits, storage failure/retry, recoverable trash and scoped permanent destruction.
- `npm run build`: TypeScript and minified production bundle passed. Exact dependencies are recorded in package-lock.json. No hot-reload service or runtime environment variables are needed.
- `npm audit --json`: 0 reported vulnerabilities across installed dependencies at check time. This is an advisory-database result, not a security audit.
- `npm run check:boundary`: owned source has no account/API/network/Pro imports; isolated storage and no-connect CSP passed. Runtime cryptography is libsodium, not a custom replacement cipher.
- `npm run upstream:check -- <private-checkout>`: all 12 allowlisted upstream files matched the extraction baseline. This command only reports; it never copies changes.
- 183 installed production dependency records include their distributed license texts. All third-party licenses remain separate from the application's noncommercial license.

## Actual browser verification

Chrome, isolated local origins and synthetic data only:

- Created a vault; rejected password mismatch; acknowledged the recovery key; imported Markdown through the native file chooser.
- Edited title/folder/content, observed saving and persisted text after lock/reload/unlock. Wrong password was rejected. Search, empty search, folder rename, outline and recoverable trash/restore were exercised.
- Recovery-key unlock reached the new-password form; no browser password change was submitted. Password changes, recovery-key regeneration and irreversible destruction were exercised only in isolated test databases. The browser deletion dialog was inspected and cancelled.
- Restored a separately generated encrypted synthetic backup into empty browser storage at two origins, including the Docker-served app; the Markdown note rendered correctly. No private vault or production account was accessed.
- At 375 × 812, sidebar, selected editor and scrollable settings were captured. The editor document width was 375 px, equal to its viewport; no horizontal page overflow. The final Docker browser tab reported no captured console warnings/errors.
- The encrypted-export control was exercised, but automation did not receive a completed download event. Inspecting the internal download page was rejected by browser security policy. No alternate download-manager or filesystem workaround was used. Consequently the GUI file's successful arrival on disk is **unverified**. Export payload and restore validation passed tests; this is distinct from the browser download receipt.

`docs/screen-states.json` lists the one route and its component states. Run
`uv run --with pillow --with resvg-py python tools/screens-map.py <capture-directory>`
to produce `screens-map.svg`, `screens-map@2x.png` and `screens-map.md`. Source
fingerprints force a coverage review after UI/state-model changes. File existence,
dimensions, node bounds and nonoverlapping geometry are checked automatically.
Pending failure/loading captures are highlighted. Synthetic recovery-key images
are private and excluded from preview collages. Captures and maps are local
artifacts, not repository assets.

## Docker build and runtime

`docker build -t scrinium-community:0.1.0 .` passed, including tests and build.
Both base images are pinned to digests in Dockerfile. The local preview was run
with all Linux capabilities dropped and `no-new-privileges`, bound only to
`127.0.0.1:8088`. Its image is:

`sha256:cb601c913d4050a5f179f4d8f35a0434dbe60505b3e6604c253aae3becc6ce40`

The container was healthy and ran as UID 101. Served HTML matched the host's
production build, SHA-256:

`d8e16e727cd1f997df15ce82910fc3eb818b52ab1b499d957e57c6547ade7157`

HTTP responses included no-connect CSP and `X-Frame-Options: DENY`. This verifies
the static host, not a server-side notes service. Browser databases are not Docker
volumes. No image was uploaded to a registry and no public service was deployed.

The local source commit and source archive checksum are supplied with the delivery
receipt outside the repository. This candidate is not a published GitHub release.
