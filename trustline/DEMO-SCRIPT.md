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
6. The sample statement is in the project: `trustline/public/samples/tbc-test-transactions.csv`. Copy it to your Desktop and rename it `tbc-statement-2026-10.csv`.
7. Browser zoom 100%, window about 1440×900, light theme. Close other tabs and turn on Do Not Disturb.
8. Recorder: on a Mac, press `Shift + Cmd + 5` → "Record Selected Portion". On Windows, use `Win + G` or OBS. Record the browser window only.

Tip: do one dry run, delete `data/demo.db` again, recreate Ana, then record.

---

## 0:00–0:20 · Set the scene

| Do | Say |
|---|---|
| Start on the login page. | "This is Trustline: credit decisions for freelancers, based on verified income." |
| Point at the banner. | "Meet Nino, a fictional freelance designer with no payslip. This demo covers designers, our first beta group. The same pipeline works for any freelancer." |
| **Create account → Freelancer**: `Nino Beridze`, `nino@demo.ge`, `password123`. | "She's applying for credit at City Bank. First, she signs up." |

## 0:20–0:45 · The input (say it's synthetic)

| Do | Say |
|---|---|
| Point at the amber banner. | "Everything here is synthetic. Every outside service is a local stand-in, and the inbox hides one forged payment email. The data is fake, but the verification, scoring and review are the real pipeline." |
| Scroll: Proof of work → Proof of income → Proof of identity, then back up. | "Nino proves three things: her work, her income, and who she is. Every API call shows on the right." |

## 0:45–1:40 · The system at work (one take, no cuts)

| Do | Say |
|---|---|
| **Sign in with Figma** → consent page → **Allow**. | "She gives Figma read-only access. Her password never reaches us." |
| Paste two links (one per line), then **Save and read files**:<br>`https://www.figma.com/design/BloomApp123456/Bloom`<br>`https://www.figma.com/design/KaveaFlow98765/Kavea` | "Then she picks two client files." |
| In **Behind the scenes**, hover *"…210 saved versions, 190 by you, across 136 days"*, then *"9 comments, 9 from other people"*. | "From Figma we read the version history: how many versions she saved, over how many days, and comments from her clients." |
| **Connect Gmail** → **Allow**. | "Gmail is read-only, and limited to payment senders. Each email's signature is checked, and AI extracts the amount, client and date." |
| **Connect with a read-only token** (Wise): type `demo-wise-read-only-token-123456`, submit. | "Wise adds euro payments from a client in Germany." |
| **Upload statement** → choose `tbc-statement-2026-10.csv`. Hover *"next statement due …"*. | "Open banking is used only to confirm identity, so Nino uploads her TBC statement once a month. Payouts we already counted aren't counted twice." |
| **Confirm with TBC Bank** → Allow. Hover *BERIDZE NINO · Matches*. | "TBC open banking confirms the account owner's name matches Nino. Name only, no balances." |
| In **Behind the scenes**, hover *"1 email failed the signature check and was thrown away"*. | "Behind the scenes, the forged email failed its signature check, so it was thrown away." |

## 1:40–2:10 · How the score works

| Do | Say |
|---|---|
| Scroll to **Why this score**. | "The score starts at five hundred. Each factor adds or removes points, and each one comes with a reason." |
| Hover each row, top to bottom. | "We measure verified income, how many months she was paid, how steady it is, how many clients pay her, real design work, and whether that work lines up with the money." |
| Scroll to **Work we found**, hover the Figma file. | "Below the score, the officer sees every client file we found, how many versions she saved, and who else worked on it." |
| Hover **Money vs. work**. | "And income should line up with real design hours, month by month." |
| **Apply for credit** → **City Bank** → **Share my report**, then **Log out**. | "Nino shares her report with City Bank. She can revoke it at any time." |

## 2:10–2:45 · AI evidence (show it on screen)

| Do | Say |
|---|---|
| **Log in** as `ana@citybank.demo` → click **Nino Beridze**. Hover **Report built in X ms**. | "The system suggests. A person decides. Ana, a fictional loan officer at City Bank, opens the report. It's built on request, in milliseconds." |
| Hover the explanation and the suggestion box. | "She gets a written explanation, a suggested action, and the reasons behind it." |
| Hover the badge (**Claude** or **Rule-based summary**). | With a key: "Claude wrote this explanation, using only verified facts." Without: "There's no Claude key in this recording, so a labelled, rule-based fallback wrote it." |
| **Approve** → keep the amount → note `Steady verified income; identity confirmed by TBC.` → **Record decision**. | "The decision is Ana's. She approves, sets the monthly amount, and adds a note." |
| Scroll to **Audit trail**, hover *Human decision: Approved…*. | "The audit trail records who opened the report, what the system suggested, and what Ana decided. Nino sees the same list." |

## 2:45–3:00 · Output and impact

| Do | Say |
|---|---|
| Stay on the review header (or scroll back up). | "In this run, [N] payments were verified where they came from, [M] more came from her monthly statement, and one forged email was blocked. No screenshots. Trustline does the checking; the officer decides." |
| End. | "Designers today, every freelancer next. Let's make freelancers bankable." |

Read **N** from *N payments verified at source* and **M** from *M from bank statement* in the review header.

---

## Rules for the voiceover

- Say "synthetic" or "fictional" at least once in the first 45 seconds.
- Say this demo covers designers, and that the pipeline works for any freelancer.
- Statement payments are "from her statement", not "verified at source": the customer uploads them.
- Only compare with manual review time if you have a source (e.g. a lender you interviewed). Otherwise say "instead of collecting screenshots and checking them by hand".
- Keep the 0:45–1:40 part as one take. You may cut between segments.
