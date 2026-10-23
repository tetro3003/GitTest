# Run Trustline on your laptop

This guide is for non-programmers. It takes about 10 minutes the first time.
You'll run the full product on your own computer: website, server and database.

---

## 1. Install two free programs (one time only)

| Program | Why | Where |
|---|---|---|
| **Node.js** (the "LTS" version) | Runs the app | https://nodejs.org → click the big **LTS** button and install it like any program. On Windows, if the installer offers "Tools for native modules", tick it. |
| **Git** *(optional)* | Downloads the code | https://git-scm.com/downloads. You can skip it and download a ZIP instead (step 2). |

To check that Node.js installed, open a **terminal**:
- **Mac:** press `Cmd + Space`, type `Terminal`, press Enter.
- **Windows:** press the Windows key, type `PowerShell`, press Enter.

Then type this and press Enter:

```
node -v
```

You should see a number like `v22.x.x` or `v24.x.x`. Anything from 20 up works.

---

## 2. Get the code

**Option A — ZIP (easiest)**
1. Open https://github.com/tetro3003/GitTest/tree/trustline-frontend
2. Click the green **Code** button → **Download ZIP**.
3. Unzip it. You get a folder like `GitTest-trustline-frontend`.

**Option B — Git**
```
git clone -b trustline-frontend https://github.com/tetro3003/GitTest.git
```

---

## 3. Start the app

In the terminal, go into the `trustline` folder inside what you downloaded.
The easiest way is to type `cd ` (with a space), drag the `trustline` folder onto the terminal window, then press Enter.

Then run these two commands, one at a time:

```
npm install
npm run dev
```

- `npm install` downloads everything the app needs. It takes 1–3 minutes, and you only do it once.
- `npm run dev` starts the app. Leave this window open; closing it stops the app.

When you see `Ready`, open your browser at:

### 👉 http://localhost:3000

The first page can take ~20 seconds to appear. After that it's fast.

The app now runs with its **real backend**. Everything you do is saved in a database file at `trustline/data/trustline.db`, so it survives closing the app.

---

## 4. What to test

Open the **Demo** button (bottom right) at any time to switch between people, and between borrower and lender.

### A. Upload a real-looking export (any app)
1. Demo → pick **Giorgi** → go to the **Work** tab.
2. On **Bolt Driver**, click **Update data** → **Upload export** → **Try a sample file**.
   You'll see it found the dates, durations and fares by itself.
3. Now try a **faked** file: click **Upload export file** and choose
   `trustline/public/samples/bolt-earnings-FAKED.csv`.
   The earnings in that file are 3.5× what reached the bank, so the Work Checker says
   **"Doesn't match income, −50"** and the bank sees a fraud warning.
4. More sample files for the other professions are in `trustline/public/samples/`
   (Wolt, Booksy, Zoom, Toggl/Figma, Jira).

### B. Add *any* app
On the **Work** tab, scroll to **Use another app?**, type a name (e.g. *Canva*, *AutoCAD*) and click **Add**.
You can then upload its export, connect it by webhook, or use the desktop tracker.

### C. Desktop tracker (counts minutes in apps on your computer)
1. On an app's **Add work data** window, open the **Desktop tracker** tab and copy the command.
2. Open a **second** terminal window, go into the `trustline` folder again, paste the command, press Enter.
3. Use the app (e.g. Photoshop). Every 5 minutes the tracker sends your work time; refresh the Work page to see it.
   - Check it can see the app in front: add ` --once` to the end of the command.
   - **Mac:** the first time, allow Terminal under *System Settings → Privacy & Security → Accessibility*.
   - Stop it with `Ctrl + C`.

### D. Webhook (Zapier, Make, sensors, scripts)
Open the **Live webhook** tab. It shows your private address and a test command.
Paste the test command into a terminal: one work event arrives instantly.
To connect a real app with no code, follow the Zapier steps shown there.

### E. Real GitHub data
Demo → pick **Nino** → **Work** → **GitHub** → **Update data** → **Sign in (API)** → type any public GitHub username → **Connect**.
It reads that person's real commit history from the last 6 months.
*(Figma works the same way with a Figma personal access token and file links.)*

### F. The bank side and consent
1. Demo → **Lender**. You're City Bank. Open any applicant.
2. Switch back to **Borrower** → **My data** → **Revoke** City Bank.
3. Go back to the lender view: the bank has lost access immediately.
4. **My data → Access log** shows everything that happened to your data.

### G. Call the API like a bank would
Lender → **API** page → **Use Giorgi's code** → **POST /reports**. You'll see the real server's answer.
From a terminal:
```
curl -H "Authorization: Bearer tl_demo_citybank_key" http://localhost:3000/api/v1/lender/applicants
```

---

## 5. Designer beta (real data, real accounts)

Open **http://localhost:3000/beta** and create an account. Nothing here is demo data: everything is read live from the source, and every step appears in **Behind the scenes** on the right.

### What works without any setup
| Source | How |
|---|---|
| **Figma** | *Use a personal access token*: Figma → your avatar → **Settings → Security → Personal access tokens → Generate** (read: File content, File versions, Comments). Paste it, then paste 1–3 file links with client work. |
| **Crypto wallets** | **Add wallet** → pick the network → **Connect & sign** with MetaMask, Phantom or TronLink (free, moves no money). Add as many as you like. No extension? **Sign manually**. |
| **Wise** | Wise → **Settings → Developer tools → API tokens → Add new token → Read only**. Paste it into the Wise card. |
| **Webflow** | *Use a site token*: Site settings → **Apps & integrations → API access → Generate API token** (read-only Sites + Pages). |
| **TBC Bank (test mode)** | **Upload test transactions**: a CSV with `date, amount, currency, counterparty` columns, or the bank's open-banking JSON. Example: `trustline/public/samples/tbc-test-transactions.csv`. |
| **Confirm with your bank** | TBC or Bank of Georgia confirms the account holder's name through open banking (no balances, no transactions). Needs the bank's sandbox details in `.env.local` (`TBC_OB_BASE_URL` etc., see `.env.example`), e.g. the hackathon's TBC mock API. |
| **ID check** | **Start** → choose **ID card** or **Passport** → photograph the code lines (`<<<`), the photo, then take a live selfie (blink, turn your head). Needs a camera; photos never leave your laptop. First use downloads ~15 MB of models. |

### "Connect" buttons (one free developer app per company)
Copy `.env.example` to `.env.local`, fill in the keys you create, and restart `npm run dev`.
In every app, set the **redirect / callback URL** exactly as shown.

| Company | Where | Redirect URL | Notes |
|---|---|---|---|
| **Google (Gmail)** | console.cloud.google.com → new project → search **Gmail API → Enable** → **Google Auth Platform → Get started** (Audience: External) → **Audience → Test users**: add your Gmail → **Clients → + Create client → Web application** | `http://localhost:3000/api/beta/oauth/google/callback` | Fill `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. While the app is in "Testing", only the test users you add can connect. |
| **Canva** | canva.com/developers → **Your integrations → Create** → scopes **design:meta:read**, **profile:read** | `http://127.0.0.1:3000/api/beta/oauth/canva/callback` | Canva doesn't accept `localhost`: open the app at **http://127.0.0.1:3000/beta** (log in again there) when connecting Canva. |
| **Webflow** | Workspace settings → **Apps & Integrations → Develop → Create an App** → scopes Sites read, Pages read, Authorized user read | `http://localhost:3000/api/beta/oauth/webflow/callback` | Or just use a site token (above). |
| **Miro** | miro.com/app/settings → **Your apps → Create new app** → permission **boards:read** | `http://localhost:3000/api/beta/oauth/miro/callback` | |
| **Dribbble** | dribbble.com/account/applications/new | `http://localhost:3000/api/beta/oauth/dribbble/callback` | Scope `public`. |
| **Figma** | figma.com/developers/apps → new app (private) | `http://localhost:3000/api/beta/figma/callback` | Optional: tokens work too. |

**AI reading of emails (optional):** put an Anthropic API key in `ANTHROPIC_API_KEY`. Claude then reads each signature-verified payment email (amount, client, date). Without it, built-in rules for Upwork, Fiverr, PayPal and Payoneer are used.

### How the beta decides what counts
- **Emails** count only if the company's digital signature (DKIM) checks out, or Google stamped it as valid on arrival. Edited or forged emails are thrown away.
- The **same payment seen twice** (e.g. Upwork email + bank deposit) counts once.
- **Payouts** (Upwork → bank, PayPal → bank, exchange → wallet) are your own money moving; they count where the client paid.
- Transfers **between your own wallets**, top-ups and tiny spam transfers never count.
- The **daily robot** re-reads every connection once a day while the app is running. **Refresh** does it now.

For the demo video, follow `DEMO-SCRIPT.md` (shot by shot, with voiceover lines).

### The lender side (human decision)
1. Sign up a second account and pick **Lender** (enter a bank name, e.g. "City Bank").
2. As the freelancer, open **Apply for credit**, choose the bank, click **Share my report**.
3. As the lender, open the applicant: score, verified payments, the written explanation, the system's suggestion, and the audit trail.
4. A person decides: **Approve** (with a monthly amount), **Request info** or **Decline** (both need a note). The decision is logged, and the freelancer sees it under **Who accessed my data**.

The written explanation comes from Claude when `ANTHROPIC_API_KEY` is set in `.env.local`. Without it (or if Claude is unavailable) a rule-based explanation is used and labelled as such.

### Demo mode (synthetic data, for videos and pitches)
```
npm run demo
```
Opens the same app on http://localhost:3000 with an amber **DEMO MODE** banner. Every outside service (Gmail, Figma, Wise, Canva, Webflow, Miro, Dribbble, TBC/BOG open banking) is replaced by synthetic stand-ins, and sign-in screens are mock consent pages. The persona is *Nino Beridze*, a fictional designer. The demo has its own database (`data/demo.db`), so your real data is untouched. Delete that file to start the demo over.

Access keys are encrypted before they are saved. The encryption key is in `trustline/data/vault.key`: never share it.

---

## 6. Start over

- In the app: **Demo → Reset demo**.
- Or stop the app (`Ctrl + C`), run `npm run reset-db`, then `npm run dev` again.

## 7. If something goes wrong

| Problem | Fix |
|---|---|
| `npm: command not found` / `'npm' is not recognized` | Node.js isn't installed, or the terminal was open during the install. Close the terminal, open a new one, try again. |
| `npm install` fails mentioning **better-sqlite3** or **node-gyp** | Install the current **LTS** Node.js (not an older or "Current" one) and run `npm install` again. On Windows, re-run the Node installer and tick *Tools for native modules*. |
| `Port 3000 is already in use` | Another copy is running. Close the other terminal window, or run `npm run dev -- -p 3001` and open http://localhost:3001 |
| The page is blank or shows an error | Look at the terminal window for a red message. Try **Demo → Reset demo**, or `npm run reset-db`. |
| Tracker says it can't read the app | Mac: allow Terminal in *Accessibility* (see 4C). Linux: install `xdotool`. |
| GitHub says it's rate-limiting | Wait a minute. GitHub allows a few lookups per minute without a token. |

## 8. Run the automated checks (optional)

```
npm test
```

This runs 87 tests covering scoring, fraud checks, the API, file imports and connectors. All should pass.
