# Security boundaries

The cryptographic primitives come from libsodium. The basic Scrinium vault/key
hierarchy and encryption functions were extracted, not replaced by a new cipher.
Tests verify behavior; this edition has not received an independent security audit.

- Passwords, recovery keys and decrypted notes remain in browser memory while unlocked. IndexedDB contains encrypted content/metadata, wrapped keys, random IDs and minimal sizes/timestamps/deletion flags.
- Lock waits for writes, clears the visible plaintext and search index, and overwrites the retained raw key arrays on a best-effort basis. JavaScript/GC/browser memory is not guaranteed to be securely erased.
- Same-origin XSS, malicious extensions, compromised browser/OS, weak passwords and an altered served application can defeat local encryption. Do not load this build from an untrusted host.
- HTTPS or localhost is required. The production no-connect CSP and lack of owned network code reduce accidental exfiltration; they are not a complete security proof.
- Docker serves app files only. There is no API, user directory, session service, email recovery or server database. Stopping a container does not delete browser notes, and backing up a container does not back up browser notes.
- A browser profile and origin (scheme, hostname, port) define the storage boundary. Clearing that browser data loses this vault unless an external backup exists. Recovery keys recover access to a vault/backup, not data that no longer exists.
- Ordinary password changes do not revoke an existing recovery key; the separate regeneration action does. Recovery unlock requires setting a new password before returning to the editor.
- Encrypted encrypted backups restore only into an empty database after decryption validation. Plain JSON exports deliberately contain plaintext. Notes moved to trash remain recoverable ciphertext; deleting the vault is irreversible and requires its password plus typed confirmation.
- Basic metadata and declared cipher parameters are checked, but no claim of audited resistance to every malicious import is made. The backup picker limits input size to 50 MB.

No real credentials, private vaults or production accounts are needed for tests.
Report suspected issues privately to the existing product contact rather than
posting note contents, passwords, keys or personal backups in a public issue.
