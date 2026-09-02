# Report card

A FIFA-style skill radar for Advanced Higher Maths, Physics, and Chemistry, plus a per-subject study timer. Pure static site — no backend, no build step.

## What's in here

- `index.html` — the page: three subject cards, each with a radar chart, editable topic sliders, and a timer.
- `css/style.css` — styling.
- `js/app.js` — chart rendering, slider handling, timers, and the export/import sync flow.
- `data/data.json` — the source of truth: your topic scores and total study minutes per subject.
- `.github/workflows/deploy.yml` — auto-deploys to GitHub Pages on every push to `main`.

## First-time setup

1. Create a new GitHub repo and push this folder to it.
2. In the repo settings, go to **Pages** and set the source to **GitHub Actions** (the workflow here handles the rest).
3. After the first push, your site will be live at `https://<your-username>.github.io/<repo-name>/`.

```bash
cd study-tracker
git init
git add .
git commit -m "Initial report card"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## Editing your scores

Drag any topic slider on the live site to update that topic's score — the radar chart updates instantly. Scores save automatically to that browser's local storage as you go.

## Using the timer

Each subject card has a Start/Pause timer. When you stop studying, hit **Log** to add the elapsed time to that subject's running total — or type a number into the "Add ... min" box and hit **Log** to backfill time by hand.

## Syncing between two computers

This is a static site with no server, so syncing happens through git:

1. On the computer you've been using, click **Export data.json** — it downloads your current scores and study time.
2. Replace `data/data.json` in the repo with the downloaded file.
3. Commit and push:
   ```bash
   git add data/data.json
   git commit -m "Update progress"
   git push
   ```
4. On the other computer, `git pull`, then open the live site and click **Clear local changes** (this reloads straight from `data.json`) — or click **Import data.json** and select the file directly if you're not working from a clone.

Whichever computer has the most recent export wins — there's no automatic merge, so export and push before you switch machines.

## Customizing topics

Edit the `topics` array for any subject in `data/data.json` — add, remove, or rename entries — the chart and sliders pick up whatever is there.

## Progress over time

Every time you move a slider, today's overall score for that subject is snapshotted into `history` (one entry per day — moving a slider again the same day just updates today's value rather than adding a duplicate). The line chart under each radar shows this trend.

## Past paper tracker

Each subject has its own past paper log. Add a paper's name, date, marks, and total to get a running list, an average percentage, and a trend chart of performance over time. Entries are stored in `pastPapers` in `data.json`, so they sync the same way as everything else — export/import or the GitHub push below.

## Optional: push straight to GitHub

Instead of manually exporting and replacing `data/data.json`, click **Push to GitHub…** in the top bar and fill in:

- your GitHub username and repo name
- the branch (defaults to `main`)
- the file path (defaults to `data/data.json`)
- a **fine-grained personal access token**, scoped to *only this repo* with **read and write access to Contents**

Click **Push now** and it commits your current progress directly via the GitHub API — GitHub Pages redeploys automatically a few seconds later. The token is stored only in that browser's local storage; it's never sent anywhere except `api.github.com`. If you'd rather not store a token in the browser at all, stick with the Export/Import flow instead — it's slower but keeps nothing but your progress data in the browser.
