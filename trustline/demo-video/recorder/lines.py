import os
# With ANTHROPIC_API_KEY set, the officer's explanation is written by Claude; otherwise by the labelled rule-based fallback.
CLAUDE = bool(os.environ.get("ANTHROPIC_API_KEY"))

# id: (caption shown on screen, or None for a title card; voiceover)
L = {
 "title":    (None, "This is Trustline: credit decisions for freelancers, based on verified income."),
 "persona":  (None, "Meet Nino, a fictional freelance designer with no payslip. This demo covers designers, our first beta group. The same pipeline works for any freelancer."),
 "signup":   ("Nino is applying for credit at City Bank. First, she creates a Trustline account.", "She's applying for credit at City Bank. First, she signs up."),
 "input":    (None, "Everything here is synthetic. Every outside service is a local stand-in, and the inbox hides one forged payment email."),
 "banner":   ("The amber banner marks DEMO MODE. Verification, scoring and review are the real pipeline.", "The data is fake, but the verification, scoring and review are the real pipeline."),
 "proofs":   ("Three proofs: work, income and identity. Every API call shows on the right.", "Nino proves three things: her work, her income, and who she is. Every API call shows on the right."),
 "figma":    ("Figma: Nino approves read-only access. No password reaches Trustline.", "She gives Figma read-only access. Her password never reaches us."),
 "files":    ("She picks two client files to count.", "Then she picks two client files."),
 "figdata":  ("What we read from Figma: saved versions, who made them, over how many days, and comments from other people.", "From Figma we read the version history: how many versions she saved, over how many days, and comments from her clients."),
 "gmail":    ("Gmail: read-only, payment senders only. Each email's DKIM signature is checked; AI reads amount, client and date.", "Gmail is read-only, and limited to payment senders. Each email's signature is checked, and AI extracts the amount, client and date."),
 "wise":     ("Wise: a read-only token. Euro payments from a client in Germany.", "Wise adds euro payments from a client in Germany."),
 "statement":("TBC Bank: open banking only confirms identity, so Nino uploads her statement once a month.", "Open banking is used only to confirm identity, so Nino uploads her TBC statement once a month. Payouts we already counted aren't counted twice."),
 "bankid":   ("Identity: TBC open banking confirms the account owner's name matches Nino. No balances, no transactions.", "TBC open banking confirms the account owner's name matches Nino. Name only, no balances."),
 "forged":   ("Error handling: the forged $9,000 email failed the signature check and was thrown away.", "Behind the scenes, the forged email failed its signature check, so it was thrown away."),
 "score":    ("How the score works: it starts at 500, and each factor adds or removes points, with a reason.", "The score starts at five hundred. Each factor adds or removes points, and each one comes with a reason."),
 "factors":  ("We measure: verified income · months with income · stability · client spread · track record · design work · work matching income · identity.", "We measure verified income, how many months she was paid, how steady it is, how many clients pay her, real design work, and whether that work lines up with the money."),
 "flags":    ("Work we found: every client file, how many versions she saved, and who else worked on it.", "Below the score, the officer sees every client file we found, how many versions she saved, and who else worked on it."),
 "chart":    ("Money vs. work: income should line up with real design hours, month by month.", "And income should line up with real design hours, month by month."),
 "share":    ("Nino shares her report with City Bank. She can revoke it at any time.", "Nino shares her report with City Bank. She can revoke it at any time."),
 "evidence": (None, "The system suggests. A person decides."),
 "ana":      ("Ana, a loan officer at City Bank (fictional), opens the report. Build time is measured, not estimated.", "Ana, a fictional loan officer at City Bank, opens the report. It's built on request, in milliseconds."),
 "reason":   ("Reasoning trace: a written explanation, the suggested action, and why.", "She gets a written explanation, a suggested action, and the reasons behind it."),
 "fallback": ("Written by Claude, from verified facts only. If Claude is unavailable, a labelled rule-based fallback takes over.", "Claude wrote this explanation, using only verified facts. If Claude is ever unavailable, a labelled rule-based fallback takes over.") if CLAUDE else
             ("Fallback: no Claude key in this recording, so the rule-based memo is used and labelled.", "There's no Claude key in this recording, so a labelled, rule-based fallback wrote it."),
 "decide":   ("Human approval: Ana chooses, sets the amount and writes a note.", "The decision is Ana's. She approves, sets the monthly amount, and adds a note."),
 "audit":    ("Audit trail: who opened the report, what the system suggested, what the person decided. Nino sees the same list.", "The audit trail records who opened the report, what the system suggested, and what Ana decided. Nino sees the same list."),
 "impact":   (None, "In this run, every payment was checked where it came from, one forged email was blocked, and no screenshots were needed. Trustline does the checking. The officer decides."),
 "close":    (None, "Designers today, every freelancer next. Let's make freelancers bankable."),
}
