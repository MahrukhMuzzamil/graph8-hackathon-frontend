# Autopilot Revenue Desk · Frontend

The mission-control dashboard for Autopilot Revenue Desk. Press **Run** and watch each step turn green: engagement found, company scored (with the reasons), decision-makers found, personal emails drafted. Then **Approve** and see the sandbox sends, the reply handling, and the deal with its next step.

Backend (orchestrator): https://github.com/AyeshaHaroon394/graph8-hackathon-backend

## Run it

Start the backend first (it listens on port 4000 by default), then:

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev                  # http://localhost:3000
```

The badge in the header shows the backend's mode: `MOCK MODE`, `SANDBOX`, or `BACKEND OFFLINE`.

## What's on screen

- **Summary strip:** signals → qualified company → decision-makers → messages → sent → deal
- **Pipeline:** the 10 steps with live status and why a step was skipped
- **Company · why this score:** score, each reason behind it, and what the team engaged with
- **Buying committee:** people found, tagged economic buyer / champion / influencer / user
- **AI-drafted messages:** each draft, marked as graph8 AI or template, with the Approve / Reject gate
- **Sandbox outbox, Reply + call, Deal + next step,** and a raw event log
- **Reset demo:** restores the sandbox snapshot so a live demo never gets stuck

Built with Next.js 16, React 19 and Tailwind 4. Live updates arrive by Server-Sent Events from `GET /api/events`.
