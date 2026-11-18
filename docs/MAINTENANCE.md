# Snapshot and upstream maintenance

0.1.0 is feature-frozen. No scheduled jobs, background agents, synchronization,
automatic cherry-picks or upgrade commitment are created by this project.

UPSTREAM.json records a reviewed extraction from the owner's private Scrinium
checkout. It intentionally includes only named basic modules. It does not copy
the original Git history, deployment data, configuration, account files or Pro
modules. The source commit identifies provenance, not a public repository URL.

When considering an update:

1. Run `npm run upstream:check -- /absolute/path/to/private/scrinium`.
2. Review changed allowlisted files manually, including new imports and schema/backup changes. A changed source file is not automatic authorization to copy it.
3. Bring over only the relevant fix. Recheck removal of accounts, API calls and Pro features; keep the community database and backup format isolated.
4. Run typecheck, unit/repository tests, boundary checks, dependency audit, notices, build, browser workflow and Docker checks.
5. Update source/derived hashes, CHANGELOG, validation and package version. Publish a new tag only if requested; preserve existing downloadable snapshots.

Security/compatibility fixes may be considered without following the hosted
product's feature roadmap. Do not imply unsupported snapshots remain secure
forever. This source-available licensing choice also means some open-source
directories will not accept it as an open-source project.
