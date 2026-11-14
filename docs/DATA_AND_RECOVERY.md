# Data, privacy and recovery

## Access boundaries

Teacher access comes from the runtime allowlist plus emailed one-time verification. Students verify email and link to a class through a roster or allowed invitation code. API routes check the verified identity and class ownership; the browser does not choose its own role or award points. Sessions are Secure/HttpOnly/SameSite cookies. Codes are hashed and expire; attempt limits remain active.

Teacher lists and reports are private to their owner. A teacher’s class-erasure action does not delete another teacher’s classes or the student’s global account. Student self-deletion revokes all account sessions. These controls are application safeguards, not a compliance certification.

## Backup and restore

In **Data & privacy**, download a signed JSON workspace backup, optionally scoped to one class. Treat it as confidential: it contains roster addresses and learning records. Login sessions, provider secrets and active practice leases are excluded. Account wallets, live game-room state and external email-provider records are not part of a workspace backup.

Restoring requires the same teacher account and the signing key in the existing deployment. Preview first, then type `RESTORE MISSING RECORDS`. No existing changed record is overwritten. Deleted students, deleted round reports, archived assignment progress and retention-expired personal data are not resurrected. Restoration does not issue reward currency. Keep backups outside the public repository.

This is an application-level recovery tool, not a substitute for provider-level disaster recovery after complete namespace loss. Before a destructive maintenance operation, export the affected data. Administrators should separately verify the Cloudflare SQLite storage recovery options available to their account and their recovery procedure:
https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/

## Erasure

A recent sign-in (within 10 minutes) and exact email confirmation are required. Teachers can erase one student’s records from one owned class; students can delete their own account. Teacher account/workspace closure is administrator-managed rather than exposed as a destructive one-click action.

Class erasure removes relevant practice and solo progress and identifying entries in outcome/raffle snapshots. The global account and another teacher’s records remain intact. Self-deletion removes profile/wallet and memberships across classes and revokes sessions. Aggregate card statistics can remain without names. A minimal inactive class marker prevents an erased membership from silently rejoining by code until the teacher restores access.

Known live rooms receive a private purge request. It rotates the old player credential, disconnects the old session and redacts the player identity. Cleanup retries via alarms and can be checked with a private deletion receipt. A later room using the same PIN is protected by the original room-creation timestamp.

Small pseudonymous deletion and settled-payout markers remain to prevent restoration or duplicate rewards. Downloaded backups, browser copies, external email-provider logs and school-exported spreadsheets are outside this purge. Their owners must handle deletion separately. An older downloaded backup cannot recreate erased records through the supported restore action.

## Retention

Off by default. Teachers can preview and enable 30, 90, 180, 365 or 730-day learning-record retention. Cleanup runs daily through a Durable Object alarm. It removes expired finished rounds and their raffle/reward audit snapshots, old assignment progress, and old solo progress. Assignments are archived with their prompt snapshot retained. Already earned balances are not reversed. Student accounts/rosters require explicit deletion rather than automatic retention.

School record-retention requirements and permission to collect student data must be reviewed before using real records. The application does not decide the school’s legal obligations.

## Diagnostics and deployment recovery

`/api/health` returns only readiness and the release identifier. The Data page can check account-storage read/write access without sending email. Unexpected account-service errors log sanitized component/error categories, not submitted answers, email bodies, OTPs or API keys.

GitHub’s health workflow makes only GET requests to public assets and the health endpoint. It does not authenticate, modify grades or send student information to another monitoring provider. Review failed runs in Actions; notifications depend on account settings.

A code rollback does not undo stored-data migrations. Preserve Durable Object class names and namespace bindings. When rollback is needed, prefer a reviewed forward-fix or deploy the previous compatible code against the same namespaces; verify lists and a test round before using a real class. Never delete namespaces as a login or deployment troubleshooting step.
