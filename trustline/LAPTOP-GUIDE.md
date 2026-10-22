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

Open **http://localhost:3000/beta**. This part uses no demo data: everything is read live from Figma and the blockchain.

1. **Create an account** (name, email, password).
2. **Figma.** Click *Use a personal access token*:
   Figma → your avatar → **Settings → Security → Personal access tokens → Generate**.
   Give it *read* access to File content, File versions and Comments. Paste it, then paste the links of 1–3 Figma files with real client work and click **Save and read files**.
   Watch **Behind the scenes** on the right: every call to Figma appears as it happens.
3. **Wallets.** Click **Add wallet**, pick the network, then **Connect & sign** with MetaMask, Phantom or TronLink.
   Signing is free and moves no money. You can add as many wallets as you like.
   No browser extension? Use **Sign manually** with any wallet app that can "sign a message".
4. Your score appears once there is both proof of work and proof of income.
5. The **daily robot** re-reads every connection once a day while the app is running. **Refresh** does it now.

**"Sign in with Figma" button (optional).** Create a Figma app at https://www.figma.com/developers/apps
with callback URL `http://localhost:3000/api/beta/figma/callback`. Copy `.env.example` to `.env.local`,
fill in `FIGMA_CLIENT_ID` and `FIGMA_CLIENT_SECRET`, and restart `npm run dev`.

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

This runs 72 tests covering scoring, fraud checks, the API, file imports and connectors. All should pass.
