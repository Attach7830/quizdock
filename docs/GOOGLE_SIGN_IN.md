# Student Google sign-in

Students click **Sign in with Google** and select their Google or school Google Workspace account. Google supplies the verified email and display name; QuizDock does not request a typed name or Google password. Teacher sign-in continues to use the existing teacher allowlist and email codes.

## Required runtime setup before merge/deploy

1. In Google Cloud / Google Auth Platform, configure the app branding and audience, and create an OAuth client of type **Web application**. For students outside one Workspace organization, choose the appropriate external audience. While the Google app is in Testing, add the designated test accounts.
2. Add the exact deployed origin to **Authorized JavaScript origins**: `https://quizdock.iwesterbeck.workers.dev` and each actual custom origin used by QuizDock. No path or trailing page name. Use a separate client and authorized local origin for development. The GIS JavaScript callback flow used here does not require a redirect URI.
3. Set `GOOGLE_CLIENT_ID` on the existing Cloudflare `quizdock` Worker as a runtime variable. Its value is the Web client ID ending in `.apps.googleusercontent.com`. This is a public identifier. No client secret is needed or used. Keep existing `TEACHER_EMAILS`, `EMAIL_FROM`, and `RESEND_API_KEY` values for teachers.
4. Deploy the reviewed branch using the existing `npx wrangler deploy` flow after these settings are ready. No storage namespace or migration change is required.
5. Complete the Google-specific live checks in `LIVE_ACCEPTANCE.md`. A local test issuer does not verify Google's consent configuration, school account policies or popup support.

With no Google client configured, the new student UI shows a setup message. Do not merge into an automatically deployed production branch before configuring Google. Existing sessions and stored records remain valid. Old student email-code API endpoints remain compatible when no Google client is configured; once it is configured, new student sign-ins must use Google.

## Class invitation links

Teachers open **Classes → Copy class join link**, or **Roster & access**. The link is `/?class=CLASSCODE`. A student who is not pre-rostered can open it and sign in with Google; the server enrolls that account after verifying the Google credential. Already signed-in students see an explicit **Join class** button. No manual class code is needed when using the link.

Existing class email-domain restrictions, disabled/removed access and the 200-student limit still apply. Closing enrollment disables the link. Creating a new code invalidates old links, including sign-ins started before rotation. Teachers can still supply a code directly to students without a link.

## Identity and existing data

Account IDs remain the normalized-email hash already used by QuizDock. Linking Google to an existing account preserves assignments, grades, confidence marks, skins and currency. The account display name is refreshed from Google's profile. An existing teacher-assigned roster name takes precedence for that class and is not overwritten. The Google subject is stored with the account to prevent a different Google account from inheriting a previously linked email's data. It is an identifier, not a password or token; normal account deletion removes it with the profile.

The server validates Google's RS256 signature against its fixed HTTPS signing-key endpoint, issuer, audience, authorized presenter, issued/expiry times and verified email. A ten-minute, one-use challenge binds the ID token nonce to an HttpOnly browser cookie and the invitation selected before sign-in. Neither client-supplied profile fields nor decoded-but-unverified claims create sessions. Google key fetching/verification happens outside the storage transaction; enrollment and session creation happen inside it. Credentials are not persisted or logged.
