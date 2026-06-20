# Setup: Google sign-in, Outlook calendar, and iOS / HealthKit

The app code for all three is complete. What remains is account/dashboard
configuration (and, for iOS, a Mac with Xcode) — none of which lives in this
repo. This is the exact checklist.

Project facts (from the code):
- Supabase project ref: `zsmnhphdagevtdooqpqp`
- Supabase auth callback: `https://zsmnhphdagevtdooqpqp.supabase.co/auth/v1/callback`
- App origins to allowlist everywhere below:
  - `https://fc19f7ce-11c0-4888-8d81-6e737170c07a.lovableproject.com` (Lovable)
  - your custom domain, if any
  - `http://localhost:8080` (local dev — Vite port)
- Capacitor appId / iOS bundle id: `app.lovable.fc19f7ce11c048888d816e737170c07a`

---

## A3a — Google sign-in (Supabase OAuth)

Code: `src/pages/Auth.tsx` → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: \`${origin}/\` } })`. Nothing to change in code.

1. **Google Cloud Console** → APIs & Services → Credentials → *Create OAuth client ID* → **Web application**.
   - Authorized redirect URIs: `https://zsmnhphdagevtdooqpqp.supabase.co/auth/v1/callback`
   - Authorized JavaScript origins: each app origin above.
   - Copy the **Client ID** and **Client secret**.
2. **Supabase dashboard** (project `zsmnhphdagevtdooqpqp`) → Authentication → Providers → **Google** → enable, paste Client ID + secret, Save.
3. **Supabase** → Authentication → URL Configuration:
   - Site URL: your primary app URL.
   - Additional Redirect URLs: add every app origin above (so `redirectTo: ${origin}/` is allowed). Missing this is the #1 cause of "redirect not allowed".
4. Test: open the app → **Continue with Google**.

> Note: this is independent of `VITE_GOOGLE_CLIENT_ID` (already set), which is for
> the in-app Google **Calendar** connect flow, not sign-in.

---

## A3b — Outlook / Microsoft 365 calendar (MSAL + Graph)

Code: `src/lib/outlookCalendar.ts` uses authority `https://login.microsoftonline.com/common`, scopes `User.Read` + `Calendars.ReadWrite`, `redirectUri: window.location.origin`. Nothing to change in code.

**Gap to close first:** `VITE_MS_CLIENT_ID` is **not set**. Until it is, the UI shows
"Outlook · not configured" and the feature is disabled.

1. **Azure Portal** → App registrations → *New registration* (or open the existing app).
   - **Supported account types:** "Accounts in any org directory **and** personal Microsoft accounts" — i.e. manifest `signInAudience` = **`AzureADandPersonalMicrosoftAccount`**. This MUST match the `/common` authority in the code, or personal @outlook.com accounts fail.
   - **Authentication** → Add platform → **Single-page application (SPA)** → Redirect URIs = each app origin above.
2. **API permissions** → Microsoft Graph → Delegated → add `User.Read` and `Calendars.ReadWrite` → *Grant admin consent* (or consent on first connect).
3. Copy the app's **Application (client) ID** and set it as `VITE_MS_CLIENT_ID`:
   - locally in `.env`, and
   - in Lovable's project environment variables (so the deployed build gets it),
   then redeploy.
4. Test: Agenda/Schedule → **Connect Outlook**.

---

## A4 — iOS native build + HealthKit

Code: `src/hooks/useHealth.ts` wraps `capacitor-health` (already a dependency),
gated by `Capacitor.isNativePlatform()`, with a browser mock fallback. The
"Connect HealthKit" button in `src/pages/Health.tsx` shows on device. Nothing to
change in app code.

This must be done on a **Mac with full Xcode 16.2** (this repo was set up where
only Command Line Tools exist, so `cap add ios` can't run here). HealthKit needs
a **real device** and a **paid Apple Developer account**.

1. Prereqs: full Xcode, then CocoaPods (`sudo gem install cocoapods` or `brew install cocoapods`).
2. From the project root:
   ```bash
   bun install
   bun run build            # produce dist/
   bunx cap add ios         # generates the ios/ project
   bunx cap sync ios
   ```
3. **Production webview (important):** `capacitor.config.ts` currently has a
   `server.url` pointing at the Lovable preview with `cleartext: true`. That's for
   Lovable's hot preview — for a real/App Store build, remove the `server` block so
   the app loads the bundled `dist` (`webDir`), then `bunx cap sync ios` again.
   (Apple rejects apps that are just a remote web view.)
4. **HealthKit capability** — open `ios/App/App.xcworkspace` in Xcode:
   - Target **App** → Signing & Capabilities → **+ Capability → HealthKit**.
   - Select your **Team** (Apple Developer) for signing.
5. **Info.plist usage strings** (Xcode → App target → Info, or edit `ios/App/App/Info.plist`):
   ```xml
   <key>NSHealthShareUsageDescription</key>
   <string>Alfred reads your steps, workouts, heart rate, and sleep to show your daily health summary.</string>
   <!-- only if you later write data back to Health: -->
   <key>NSHealthUpdateUsageDescription</key>
   <string>Alfred can record workouts you log to the Health app.</string>
   ```
6. Plug in an iPhone, select it as the run target, **Run**. In the app: Health →
   **Connect HealthKit** → grant permissions → **Sync**.

The data types requested are already declared in `useHealth.ts` (`READ_STEPS`,
`READ_DISTANCE`, `READ_ACTIVE_CALORIES`, `READ_HEART_RATE`,
`READ_RESTING_HEART_RATE`, `READ_HEART_RATE_VARIABILITY`, `READ_SLEEP`,
`READ_WORKOUTS`).

> Tip: re-run `bunx cap sync ios` after any web build or dependency change.
> HealthKit returns no data on the Simulator — test on a physical device.
