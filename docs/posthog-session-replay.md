# PostHog session replay

Session replay and product analytics via PostHog. It is consent-gated, privacy-masked, and does nothing
until a valid project token is configured.

## Setup

1. In PostHog: **Project settings → Session replay → enable** it. Turn on *Record console logs* and
   *Capture network performance* there as well (the SDK is already configured to use both).
2. Add to `.env` (and your hosting provider's environment):

   ```
   NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...        # public project token (must start with phc_)
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com # or https://eu.i.posthog.com
   ```

   Never use a personal API key (`phx_...`) here. Values starting with anything but `phc_` are ignored.
3. `npm run build` and deploy. These are build-time values, so rebuild after changing them.
4. In PostHog **Project settings → Authorized URLs / Replay**, add your production domain
   (`www.autoapplycv.in`) so recordings are only accepted from it.

## How it is wired

| File | Role |
| --- | --- |
| `src/lib/posthog-config.ts` | Reads/validates the env vars; builds the CSP origins |
| `src/lib/posthog-client.ts` | Lazy-loads `posthog-js`, privacy config, identity, event helpers, `api_request_failed` observer |
| `app/PostHogConsentBridge.tsx` | Starts/stops PostHog from the existing cookie-consent state |
| `app/layout.tsx` | Mounts the bridge |
| `app/CookieConsentBanner.tsx` | Shows the consent banner when PostHog is configured |
| `src/app/context/AuthContext.tsx` | Passes the internal user id to PostHog |
| `middleware.ts` | CSP allows the PostHog host (only when configured) |

`instrumentation-client.ts` was deliberately **not** used: it runs on every page load before any consent
choice and would put `posthog-js` in the initial bundle. Here the SDK is dynamically imported only after
the visitor accepts analytics cookies.

## Consent

PostHog follows the existing cookie banner's **Analytics cookies** choice (`analytics_storage`).

- No choice / "Reject all": `posthog-js` is not even downloaded; nothing is stored or sent.
- "Accept all" or Analytics on: PostHog starts (no reload needed).
- "Cookie settings" or consent withdrawn: recording stops and the SDK opts out immediately.
- Browsers sending Do Not Track are respected (`respect_dnt`).

**You must do manually:** update `/cookie-policy` and `/privacy-policy` to list PostHog (session replay,
analytics cookies/localStorage `ph_*`, data location US/EU, retention period). Pick a replay retention in
PostHog that matches your policy.

## Privacy defaults

- All inputs masked (`maskAllInputs`), passwords explicitly masked, file inputs never recorded.
- **All text masked** on `/dashboard/*`, `/admin/*` and `/remove-my-contact` (names, emails, resumes,
  contacts, billing). Public pages show text. Allow-list a harmless element on a private page with the
  attribute `data-ph-unmask`; never wrap user data in it.
- Support chat panel and the home-page resume chat are blocked entirely (`ph-no-capture`).
- Admins and admin "impersonation" sessions are never recorded or tracked.
- Autocapture never stores element text; URL query strings are redacted except `utm_*`; URL fragments are dropped.
- Network capture keeps method/URL/status/timing only: no headers, no request or response bodies.
- Users are identified by internal id only (no name/email/properties). Anonymous visitors get no person profile.
- Razorpay checkout is a cross-origin iframe and is not recorded.
- Custom event properties are limited to short primitives; keys that look sensitive are dropped.

If you add a new page that shows personal data outside `/dashboard`, add its prefix to
`PRIVATE_PATH_PREFIXES` in `src/lib/posthog-client.ts`.

Microsoft Clarity (existing) also records sessions behind the same consent. Both can run side by side; disable
one if you do not want two recorders.

## Custom events

| Event | Where | Properties |
| --- | --- | --- |
| `form_submission_succeeded` | Login OTP request, Forgot-password (OTP request/reset), home-page resume upload | `form_name` |
| `auth_succeeded` | Every successful sign-in or account creation: email+password login, email OTP login, email signup, Google (login or signup), home-page resume upload that creates an account | `auth_method` (`password` / `otp` / `google` / `resume_upload`), `is_new_user` |
| `form_submission_failed` | Login, OTP login, Signup, OTP requests, Forgot-password, resume upload, when the request fails | `form_name`, `failure_type` (`network` / `rejected`) |
| `user_action_failed` | Billing: plan purchase, subscription, wallet top-up; Google sign-in that returned to `/login` with an error (`action = google_sign_in`, `stage` = the server error code; a cancelled consent screen is not reported) | `action`, `stage`, `failure_type`, `plan` |
| `checkout_abandoned` | Billing: Razorpay dialog closed with no payment submitted (order already created) | `checkout`, `plan` |
| `onboarding_step_viewed` | Each onboarding screen shown (once per screen change) | `step` (1–25), `step_name` (e.g. `skills`, `plan`), `section`, `total_steps`, `direction` (`forward` / `back`) |
| `onboarding_completed` | Onboarding saved (and paid, for a paid plan) | `plan` (`free` / `pro` / `connect` / `coach`), `paid`, `extension_installed` |
| `api_request_failed` | Any same-origin `/api/*` call that errors at network level or returns 5xx | `method`, `path` (ids normalized), `status`, `failure_type`, `duration_ms`, `page_path` |

Google sign-in is a full-page redirect, so the browser cannot see its result. On success the OAuth callback
sets a 2-minute `cp_auth_event` cookie (`google_login` / `google_signup`, no personal data); the next page load
reads it, deletes it, and sends `auth_succeeded` only if analytics consent was given. To see sign-ins by method:
Insights → Trends → `auth_succeeded`, breakdown by `auth_method` (filter `is_new_user = true` for signups).

`api_request_failed` is throttled (one per method/path/status per minute, 25 per session). 4xx responses are
expected outcomes and are not reported there. A failed login on a 5xx will produce both a transport event
(`api_request_failed`) and a journey event (`form_submission_failed`); they answer different questions.
Error messages are never sent. Add new events through the helpers in `posthog-client.ts`.

## Using the dashboard

- **Recordings**: PostHog → *Session replay*. Filters: date range, URL/page (`Current URL`), device type /
  browser / OS, country, user (internal id), events performed, and "has console errors". Use *Rageclicks*
  and *Dead clicks* playlists for stuck users.
- **Sessions with an error**: add the filter *Performed event* = `api_request_failed`,
  `form_submission_failed`, `user_action_failed` or `$exception`. Open an event in *Activity → Events* and
  click **View recording** (or **Session** link) to jump to that moment. Console errors and failed requests
  appear in the player's **Console** / **Network** tabs.
- **Onboarding drop-off**: Insights → Funnels with `onboarding_step_viewed` steps filtered by `step_name` (e.g. `resume_upload` → `job_titles` → `extension` → `plan`) and `onboarding_completed` last; or a Trends chart of `onboarding_step_viewed` broken down by `step_name` to see the last screen people reach. Filter replays by `step_name = plan` to watch people on the plan screen.
- **Funnels**: build funnels such as `$pageview /pricing` → `$pageview /dashboard/billing` →
  `checkout_abandoned`, or signup page → `form_submission_succeeded` (`form_name = signup`).
- **A specific user**: *People* → find by internal user id (from the admin Users page) → *Recordings* tab.

## Verifying locally

1. Set the env vars with a real project token, run `npm run dev`, open the site.
2. Before choosing in the banner: DevTools → Network shows **no** request to `posthog.com` and localStorage has no `ph_*` keys.
3. Accept analytics: `$pageview` requests, then `/s/` snapshot requests, start flowing; navigate between pages and confirm exactly one `$pageview` per route change.
4. Open the replay in PostHog: inputs show as `***`, dashboard text is `****`.
5. Trigger a failed login to see `form_submission_failed`; withdraw consent via *Cookie settings* and confirm requests stop.
