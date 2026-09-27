# 5-minute demo script

Have open before you start: http://localhost:3000 (backend running, badge says **LIVE · SENDS HELD**), and graph8 in a second tab on CRM → Deals.

| Time | Say | Do |
|---|---|---|
| 0:00–0:30 | "Every Monday, marketing sends sales a spreadsheet of everyone who clicked the newsletter. Nobody uses it. Real buyers get ignored." | Show the empty dashboard. |
| 0:30–1:00 | "Here's this weekend's clicks. Our graph8 org is brand new, so the clicks are demo data. Everything after them is real graph8." | Click **Run weekend**. Point at the funnel and the "demo clicks · real graph8 data" tag. |
| 1:00–3:00 | "Personal emails and students are dropped before any paid lookup. Each company is enriched and scored, with the reasons shown. For good fits it finds the decision-makers, saves them in the CRM, and graph8's AI writes an email that mentions what their team read." | Watch steps turn green. Click **Review** on a company. Show *Company · why this score* and *Buying committee*. |
| 2:30–3:00 | "It also checks graph8 Radar: this company uses a competitor, so the email gets a battle-card line." | Point at the orange **Uses competitor** box, if a company shows one. |
| 3:00–4:00 | "Nothing goes out without a human, and the human doesn't even need our app. The brief and the approvals land in graph8 Work." | Show the Work channel `#autopilot-revenue-desk` on your phone: the Monday brief, then reply **approve CODE** to one company. Back on the dashboard it turns green, "via graph8 Work". Approve another one here after editing a line. Show the **deal + next step**, then the graph8 tab: the deal is really there. |
| 4:00–4:15 | "And it learns: every approve, reject and edit changes next weekend's scoring." | Point at **Learning from you**. |
| 4:00–4:30 | "Because this is real data, prospects are never contacted: sends are held. On a warmed-up mailbox they'd go out through the graph8 sequence." | Point at the **LIVE · SENDS HELD** badge. |
| 4:30–5:00 | "What took a sales team two days now takes two minutes, and the human only clicks approve." | Show the funnel once more. |

**Before judges arrive:** press **Tour** once to check the walkthrough, and install the graph8 Work app (or open app.graph8.com on your phone) so you can reply from it.

**If live breaks:** add `USE_MOCKS=true` as the last line of `backend/.env`, restart the backend, and run the same script in mock mode.
