# Teacher Google sign-in

Teachers can choose **Sign in with Google** or the existing emailed code. The Google option appears in the homepage’s Teacher tab and the My lists sign-in screen. Student sign-in, class invitations, games and practice are unchanged.

## Configuration

Uses the existing **GOOGLE_CLIENT_ID** already used for student Google sign-in. No second OAuth client, client secret, redirect URL or Resend key is needed for the Google button. The emailed-code fallback still uses the existing Resend settings.

If student Google sign-in is already working, no Google configuration change is required. The email selected in the Google account chooser must exactly match an address in the existing **TEACHER_EMAILS** Worker runtime setting. The same normalized email opens the same saved lists, classes and reports. Different email addresses are different workspaces; do not add another email expecting automatic account merging.

If Google has not been configured:
1. In Google Cloud / Google Auth Platform, use an OAuth client of type **Web application**.
2. Add `https://quizdock.iwesterbeck.workers.dev` under **Authorized JavaScript origins**, without a path. Add any actual custom-domain origin separately.
3. Set the client ID (ending in `.apps.googleusercontent.com`) as **GOOGLE_CLIENT_ID** in Cloudflare Worker runtime Variables and Secrets, then deploy. Do not place a client secret in the frontend.
4. Ensure the approved teacher’s Google email is in **TEACHER_EMAILS**. Google consent-screen audience/testing restrictions and any school administrator restrictions still apply.

This implementation uses Google Identity Services’ official rendered button and JavaScript callback. It does not request Gmail, Drive or Calendar access.

## Account and security behavior

- Google RS256 signature, issuer, client audience, expiration, verified email and nonce are checked on the server.
- Teacher challenges have a separate cookie and storage namespace from student challenges. Both the HttpOnly browser cookie and signed nonce must match. Client-supplied names, roles and `browserNonce` values cannot confer teacher access.
- The teacher allowlist is checked at sign-in and on subsequent protected requests. Signing in through Google does not grant access to unapproved users.
- Google subject IDs are bound to the existing teacher account. A reassigned email or subject change cannot silently open the old workspace.
- Teacher Google matching accepts Gmail and Google Workspace addresses for which Google is authoritative. A Google account registered with another provider’s email must use the existing email-code sign-in. Google’s `email_verified` alone does not prove ongoing control of a third-party mailbox.
- Login challenges expire after ten minutes and are single-use. Attempt limits are separate from Resend’s email-send limits. Sessions use the existing Secure/HttpOnly/SameSite cookie and include a recent sign-in timestamp for data-management confirmations.
- No Google password, ID token or access token is stored. Existing teacher display names, points and saved learning records are retained.

## Validation

New unit checks cover signature/claims, teacher allowlisting, Gmail/Workspace authority, preserved account data, disabled users, replay/expiry, browser binding, subject mismatch and independent rate limits. API tests exercise the real Worker gateway and account service, including concurrent replay, code fallback and cleanup. Browser tests use a mocked Google SDK and fake API responses; they do not certify Google consent, actual account selection or school policy.

## References

https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
https://developers.google.com/identity/gsi/web/reference/js-reference
