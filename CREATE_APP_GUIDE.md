# Create the SignalBridge app — step by step

Goal: turn the dashboard into a real website on the internet. About 1–2 hours the first time.
Stack: **Next.js** (the app), **Tailwind** (styling), **Vercel** (free hosting).

You do the account/key steps yourself (I can't create accounts or deploy for you). The code is ready below.

---

## What you'll need first (one-time, ~15 min)
1. **Node.js** — install the LTS version from nodejs.org. This lets you run the project on your computer.
2. **A GitHub account** — github.com. Your code lives here.
3. **A Vercel account** — vercel.com. Sign in with GitHub. This hosts the live site.
4. **A free data API key** — sign up at financialmodelingprep.com and copy your key (for live data later; the app runs in demo mode without it).

---

## Step 1 — Create the project (~5 min)
Open your terminal and run:
```
npx create-next-app@latest signalbridge
```
When prompted, choose: **JavaScript**, **Tailwind CSS = Yes**, **App Router = Yes**. Defaults are fine for the rest. Then:
```
cd signalbridge
```

## Step 2 — Drop in the dashboard
- Copy **CommandCenter.jsx** into the project at `app/CommandCenter.jsx`.
- Replace the contents of `app/page.js` with:
  ```js
  import CommandCenter from "./CommandCenter";
  export default function Home() {
    return <CommandCenter />;
  }
  ```

## Step 3 — Add the backend
- Create the folder/file `app/api/scan/route.js` and paste in **route.js**.
- This is the same engine as before, adapted for Next.js.

## Step 4 — Run it on your computer (~2 min)
```
npm run dev
```
Open http://localhost:3000 — your dashboard is live locally, in demo mode. Type NVDA, HIMS, LUMN to test.

## Step 5 — Put it on the internet
1. Create a new repository on GitHub and push your project to it (GitHub shows the exact commands after you create the repo).
2. In Vercel: **Add New Project → Import** your GitHub repo → **Deploy**. In ~1 minute you get a live URL like `signalbridge.vercel.app`.

## Step 6 — Turn on live data (when ready)
1. In Vercel → your project → **Settings → Environment Variables**, add `FMP_API_KEY` = your key.
2. In `app/CommandCenter.jsx`, set `const DATA_URL = "/api/scan";`
3. Redeploy. It now scores the whole market instead of just the demo tickers.

---

## What this version does and doesn't do
- **Does:** runs as a real site, scores tickers, saves your watchlist and weekly read in the browser (localStorage — per device).
- **Doesn't yet:** have user accounts, logins, or payments. Each visitor's watchlist lives only on their own device.

## When you're ready to charge money (the next stage)
You'll add three things, in this order:
1. **A database + accounts** — Supabase (free tier) is the easiest. Replaces localStorage so data follows the user across devices, and gives you login.
2. **Payments** — Stripe subscriptions.
3. **Alerts** — a scheduled job that runs the scan and emails users on a fresh 8/8.

Get the free version live and in front of real traders first. Don't build accounts and payments until people are actually using it.
