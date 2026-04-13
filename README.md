# Study System MVP

Minimal local-first study system for:

- IELTS preparation with phase-aware intensity and small adaptive changes
- Chinese National Legal Exam (`法考`) with a date-based subject schedule

The app is intentionally simple: open it and see what to do today, log performance, complete the evening review, and let the next day adjust itself.

## What This MVP Includes

- Today-first dashboard
- Detailed IELTS task list for today
- Law subject and stage for today
- Progress bar and daily completion tracker
- Missed-task carry-over
- Adaptive add-ons based on tracking and evening review
- 7-day summary with weak-area indicators
- Config-driven schedules in JSON

## Files

- [index.html](/Users/annnnnnn/Documents/codex/index.html)
- [styles.css](/Users/annnnnnn/Documents/codex/styles.css)
- [app.js](/Users/annnnnnn/Documents/codex/app.js)
- [lib/planner.js](/Users/annnnnnn/Documents/codex/lib/planner.js)
- [lib/analytics.js](/Users/annnnnnn/Documents/codex/lib/analytics.js)
- [lib/store.js](/Users/annnnnnn/Documents/codex/lib/store.js)
- [data/app-config.json](/Users/annnnnnn/Documents/codex/data/app-config.json)
- [data/ielts-weekly-structure.json](/Users/annnnnnn/Documents/codex/data/ielts-weekly-structure.json)
- [data/law-schedule.json](/Users/annnnnnn/Documents/codex/data/law-schedule.json)
- [data/review-checklist.json](/Users/annnnnnn/Documents/codex/data/review-checklist.json)

## How It Works

### 1. Today logic

When the app opens, it builds a plan for today using:

- the fixed weekly IELTS structure
- the current IELTS phase
- the date-based law subject rotation
- unfinished tasks from yesterday
- recent tracking metrics
- recent evening review patterns

### 2. IELTS phase logic

Phase changes intensity only, not the weekly structure:

- Phase 1: Foundation
- Phase 2: Improvement
- Phase 3: Sprint

The weekly task types stay fixed. The app changes the task note and intensity.

### 3. Adaptive engine

Base adjustments:

- Missed writing yesterday -> add 1 Task 2 task
- Listening below 80% -> add extra Section 1
- Reading below 80% -> add extra 5 questions

Review-based adjustments:

- repeated speaking issues -> add extra speaking repair
- repeated writing revision problems -> add deeper writing revision
- repeated listening problems -> add extra Section 1
- repeated reading problems -> add extra 5 to 10 reading questions
- repeated law topic mistakes -> prioritize that topic next day
- law accuracy below 70% -> slightly increase practice volume
- persistent weak law area -> shift a bit more time to it

Guardrails:

- adjustments are additive only
- weekly structure is preserved
- extra task load is capped at about 30%

## Data Storage

This MVP is local-first and stores state in browser `localStorage` as JSON.

Stored data:

- generated daily plans
- daily performance tracking
- nightly review entries

If you want true file-based JSON persistence later, the store layer in [lib/store.js](/Users/annnnnnn/Documents/codex/lib/store.js) is the place to swap.

## Customization

Edit the JSON config files:

- `data/ielts-weekly-structure.json` for the fixed IELTS weekly pattern
- `data/law-schedule.json` for date ranges and subject rotations
- `data/app-config.json` for phase dates, exam date, busy days, and thresholds
- `data/review-checklist.json` for the nightly checklist labels

## Important Assumption

The prompt refers to a "same as previous version" IELTS weekly structure, law schedule, and daily review checklist, but those prior files were not present in the repo. This MVP includes a clean default structure in config so the logic is complete and easy to replace with your exact earlier version.

## Run It

Because this is a static app, use any simple local server from this folder. Examples:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

If you prefer, you can also use any editor live server extension.
