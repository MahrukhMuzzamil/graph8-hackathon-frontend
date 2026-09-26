# 5-minute demo script

Have open before you start: http://localhost:3000 (backend running, badge says **LIVE · SENDS HELD**), and graph8 in a second tab on CRM → Deals.

| Time | Say | Do |
|---|---|---|
| 0:00–0:30 | "Every Monday, marketing sends sales a spreadsheet of everyone who clicked the newsletter. Nobody uses it. Real buyers get ignored." | Show the empty dashboard. |
| 0:30–1:00 | "Here's this weekend's clicks. Our graph8 org is brand new, so the clicks are demo data. Everything after them is real graph8." | Click **Run weekend**. Point at the funnel and the "demo clicks · real graph8 data" tag. |
| 1:00–3:00 | "Personal emails and students are dropped before any paid lookup. Each company is enriched and scored, with the reasons shown. For good fits it finds the decision-makers, saves them in the CRM, and graph8's AI writes an email that mentions what their team read." | Watch steps turn green. Click **Review** on a company. Show *Company · why this score* and *Buying committee*. |
| 3:00–4:00 | "Nothing goes out without a human. I can edit the email, then approve." | Edit one line of a draft, click **Approve**. Show the outbox (held on the live system), the reply handling, and the **deal + next step**. Switch to the graph8 tab: the deal is really there. |
| 4:00–4:30 | "Because this is real data, prospects are never contacted: sends are held. On a warmed-up mailbox they'd go out through the graph8 sequence." | Point at the **LIVE · SENDS HELD** badge. |
| 4:30–5:00 | "What took a sales team two days now takes two minutes, and the human only clicks approve." | Show the funnel once more. |

**If live breaks:** add `USE_MOCKS=true` as the last line of `backend/.env`, restart the backend, and run the same script in mock mode.
