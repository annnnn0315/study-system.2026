{\rtf1\ansi\ansicpg1252\cocoartf2761
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # AGENTS.md\
\
## Project purpose\
This repo is a personal study dashboard for:\
1. IELTS preparation\
2. Chinese National Legal Exam (\uc0\u27861 \u32771 )\
\
The system should minimize decision fatigue and show exactly what to do today.\
\
## Product priorities\
1. Today-first dashboard\
2. Low cognitive load\
3. Config-driven schedules\
4. Small adaptive adjustments\
5. Minimal UI changes unless explicitly requested\
\
## Core rules\
- Keep the existing dashboard structure.\
- Do not redesign the app unless explicitly asked.\
- Prefer small compatibility patches over large refactors.\
- Preserve current UI and styling whenever possible.\
- Keep the app usable even with partial or imperfect data.\
\
## IELTS rules\
- IELTS tasks are driven by the weekly structure config.\
- Do not randomize IELTS tasks.\
- Respect phase-based intensity, but do not change weekday task type.\
- IELTS progress target is overall band 8.0.\
- Writing estimate should prefer `manualWritingBand`.\
- If no manual writing band exists, use fallback estimation.\
- If data is insufficient, show a clear fallback message.\
\
## Law rules\
- Law schedule is date-based from `law-schedule.json`.\
- Today page should show only the current law stage/subject(s).\
- Do not generate detailed law subtasks.\
- Law task tracking is binary only:\
  - `lawCompletedToday = true/false`\
- Weekly law completion rate should be based on `lawCompletedToday`.\
\
## Review rules\
- Evening review fields should stay compatible with:\
  - IELTS: errors, rewritten sentences, speaking issues\
  - Law: key points, mistakes, tomorrow focus\
- Preserve existing review flow and storage.\
\
## Data/config rules\
- Prefer adapting code to configs, not forcing configs to match old assumptions.\
- Keep support for current config files:\
  - data/app-config.json\
  - data/ielts-weekly-structure.json\
  - data/law-schedule.json\
  - data/review-checklist.json\
- Use local date, not UTC date, for \'93today\'94.\
\
## Engineering rules\
- Prefer patching existing files over creating new architecture.\
- Add helper/adaptor functions when needed.\
- Add safe fallbacks if config fields are missing.\
- Do not silently break existing functionality.\
\
## Validation\
Before finishing any task:\
- verify Today page still renders\
- verify IELTS tasks render by weekday\
- verify law stage renders by date\
- verify review form still works\
- verify progress cards still render\
- verify no empty dashboard panels without fallback text\
\
## When uncertain\
Make the smallest reasonable change and explain assumptions clearly.}