# Demo video script (AI in Finance track, 3:00)

A shot-by-shot script for recording the Trustline demo on your laptop: what to click, and what to say.
Everything runs in **demo mode**: synthetic accounts, real verification, scoring and review.

---

## Before you record (5 minutes)

1. Stop the app if it's running (`Ctrl + C`).
2. Start fresh: delete `trustline/data/demo.db` (if it exists).
3. Optional, but better for the AI section: put your Anthropic key in `trustline/.env.local` as `ANTHROPIC_API_KEY=...`.
   With the key, the officer's explanation is written by Claude (badge: **Claude**). Without it, the rule-based fallback is used and labelled as such. Both are fine; just say which one is on screen.
4. Run `npm run demo` and open http://localhost:3000/beta. You should see the amber **DEMO MODE** banner.
5. Create the bank's account first, so it exists when Nino shares:
   **Create account → Lender** · Name `Ana Kvaratskhelia` · Bank or company `City Bank` · Email `ana@citybank.demo` · Password `password123`. Then **Log out**.
6. The TBC test file is in the project: `trustline/public/samples/tbc-test-transactions.csv`. Copy it to your Desktop so it is easy to pick.
7. Browser zoom 100%, window about 1440×900, light theme. Close other tabs and turn on Do Not Disturb.
8. Recorder: on a Mac, press `Shift + Cmd + 5` → "Record Selected Portion". On Windows, use `Win + G` or OBS. Record the browser window only.

Tip: do one dry run, delete `data/demo.db` again, recreate Ana, then record.

---

## 0:00–0:20 · Set the scene

| Do | Say |
|---|---|
| Start on the login page. | "This is Trustline. We help lenders give credit to freelancers, based on income we verify at the source." |
| Point at the banner. | "Our persona is Nino Beridze, a freelance product designer. She's fictional. She's paid through Upwork, PayPal, Wise and direct clients, and she has no payslip." |
| **Create account → Freelancer**: `Nino Beridze`, `nino@demo.ge`, `password123`. | "She's applying for credit at City Bank. Today the loan officer would collect screenshots and check them by hand." |

## 0:20–0:50 · The input (say it's synthetic)

| Do | Say |
|---|---|
| Point at the amber banner. | "Everything you see is synthetic. Demo mode replaces Gmail, Figma, Wise, Canva, Webflow and TBC open banking with local stand-ins. The verification, scoring and review are the real pipeline." |
| Scroll slowly: Proof of work → Proof of income → Proof of identity. | "The inbox has 15 fake payment emails: 10 from Upwork, 2 from PayPal, 2 direct transfers, and one forged $9,000 email. The TBC file is test data in TBC's statement format." |
| Scroll back up. Point at **Hide technical** (technical view is on). | "Technical view is on, so every API call is shown on the right." |

## 0:50–1:50 · The system at work (one take, no cuts)

| Do | Say |
|---|---|
| **Sign in with Figma** → consent page → **Allow**. | "Nino approves read-only access. Her password never reaches us." |
| Paste two file links (one per line), then **Save and read files**:<br>`https://www.figma.com/design/BloomApp123456/Bloom`<br>`https://www.figma.com/design/KaveaFlow98765/Kavea` | "We read version history and client comments. That's proof of real work." |
| **Connect Gmail** → **Allow**. | "Gmail is read-only, and only emails from Upwork, PayPal, Payoneer and Fiverr. Each email's DKIM signature is checked, and AI reads the amount, client and date." |
| **Connect Canva** → Allow. **Connect Webflow** → Allow. | "More proof of work, the same way." |
| **Connect with a read-only token** (Wise): type anything 20+ characters, e.g. `demo-wise-read-only-token-123456`, then submit. | "Wise: euro payments from a German client." |
| **Upload test transactions** → choose `tbc-test-transactions.csv`. | "TBC test statement. Payouts we already counted from Upwork aren't counted twice." |
| **Confirm with TBC Bank** → Allow. | "Open banking confirms the account owner's name matches Nino. Name only: no balances, no transactions." |
| Scroll the **Behind the scenes** panel down to the line *"1 email failed the signature check and was thrown away"*. Hover it. | "Here's error handling: the forged $9,000 email failed the signature check, so it doesn't count." |
| Scroll to the top: score and **Why this score**. | "The result: a score where every point has a reason." |
| **Apply for credit** → choose **City Bank** → **Share my report**. | "Nino shares her report with City Bank. She can revoke it any time." |
| **Log out**. | |

## 1:50–2:30 · AI evidence (show it on screen)

| Do | Say |
|---|---|
| **Log in** as `ana@citybank.demo` / `password123` → click **Nino Beridze**. | "Ana is a loan officer at City Bank. She's fictional too." |
| Hover **Report built in X ms**. | "The report is built when she opens it, and the time is measured." |
| Hover **Explanation for the officer** and its badge. | With a key: "The explanation is written by Claude, using only verified facts." Without: "No Claude key here, so the system falls back to a rule-based explanation and labels it." |
| Hover the suggestion box (*Suggest approve · up to $X/month* and its reasons). | "The reasoning trace: the suggested action and the factors behind it. It's only a suggestion." |
| **Approve** → keep the amount → note: `Steady verified income over 12 months; identity confirmed by TBC.` → **Record decision**. | "The decision is made by a person. Decline and Request info need a written reason." |
| Scroll to **Audit trail**. Hover *Human decision: Approved…*. | "The audit trail shows who opened the report, what the system suggested, and what the person decided, and whether they agreed with it." |
| **Log out**. | |

## 2:30–3:00 · Output and impact

| Do | Say |
|---|---|
| **Log in** as `nino@demo.ge` → scroll to **Apply for credit** → open **Who accessed my data**. | "Nino sees the decision and every access to her data." |
| Scroll back to the top (score + verified income). | "In this run: [N] payments verified at the source, one forged email blocked, seven sources checked automatically, and the report built in [X] milliseconds. Zero screenshots." |
| End on the score. | "The officer reviews and decides; Trustline does the collecting and checking. Let's make freelancers bankable." |

Read **N** from the review header (*N payments verified at source*) and **X** from *Report built in X ms*.

---

## Rules for the voiceover

- Say "synthetic" or "fictional" at least once in the first 50 seconds.
- Don't claim live bank integrations: TBC is **test data**, open banking is a **stand-in** in demo mode.
- Only compare with manual review time if you have a source (e.g. a lender you interviewed: "officer X told us a manual check takes about N minutes"). Otherwise say "instead of collecting screenshots and checking them by hand".
- Keep the 0:50–1:50 part as one take. You may cut between segments.
