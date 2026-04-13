import { addDays } from "./date.js";

function average(values) {
  if (!values.length) {
    return null;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizeList(text) {
  return (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function readReviewField(entry, keys) {
  for (const key of keys) {
    if (entry?.[key]) {
      return entry[key];
    }
  }
  return "";
}

function countItems(items) {
  const counts = new Map();
  items.forEach((item) => {
    const key = item.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function averagePrecise(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPercent(value) {
  return `${Math.round(clamp(value, 0, 100))}%`;
}

function inclusiveDaySpan(start, end) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
}

function elapsedInclusive(start, current, end) {
  if (current < start) {
    return 0;
  }
  if (current > end) {
    return inclusiveDaySpan(start, end);
  }
  return inclusiveDaySpan(start, current);
}

function collectTrackingEntries(store, currentDate, days = 7) {
  const entries = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(currentDate, -offset);
    const tracking = store.getTracking(date);
    if (Object.keys(tracking).length > 0) {
      entries.push({ date, tracking });
    }
  }
  return entries;
}

function collectReviewEntries(store, currentDate, days = 7) {
  const entries = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(currentDate, -offset);
    const review = store.getReview(date);
    if (Object.keys(review).length > 0) {
      entries.push({ date, review });
    }
  }
  return entries;
}

function getLatestNumeric(entries, keys) {
  for (const entry of entries) {
    for (const key of keys) {
      const value = Number(entry.tracking?.[key]);
      if (!Number.isNaN(value) && value > 0) {
        return value;
      }
    }
  }
  return null;
}

function getLatestValidWritingBand(entries) {
  const allowed = new Set([5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0]);
  for (const entry of entries) {
    const candidates = [
      entry.tracking?.manualWritingBand,
      entry.tracking?.writingBand,
      entry.tracking?.estimatedWritingBand
    ];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (!Number.isNaN(value) && allowed.has(value)) {
        return value;
      }
    }
  }
  return null;
}

function getCurrentLawStage(lawSchedule, currentDate) {
  return lawSchedule?.stages?.find((stage) => currentDate >= stage.start && currentDate <= stage.end) ?? null;
}

function normalizeLawCompletionMap(rawValue, subjects) {
  const safeSubjects = Array.isArray(subjects) ? subjects : [];
  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
    return safeSubjects.reduce((result, subject) => {
      result[subject] = Boolean(rawValue[subject]);
      return result;
    }, {});
  }

  const text = String(rawValue ?? "").toLowerCase();
  if (rawValue === true || text === "yes" || text === "true") {
    return safeSubjects.reduce((result, subject) => {
      result[subject] = true;
      return result;
    }, {});
  }

  if (rawValue === false || text === "no" || text === "false") {
    return safeSubjects.reduce((result, subject) => {
      result[subject] = false;
      return result;
    }, {});
  }

  return null;
}

function mapAccuracyToIeltsBand(accuracy) {
  if (typeof accuracy !== "number" || Number.isNaN(accuracy)) {
    return null;
  }
  if (accuracy >= 95) {
    return 9.0;
  }
  if (accuracy >= 90) {
    return 8.5;
  }
  if (accuracy >= 85) {
    return 8.0;
  }
  if (accuracy >= 80) {
    return 7.5;
  }
  if (accuracy >= 75) {
    return 7.0;
  }
  if (accuracy >= 70) {
    return 6.5;
  }
  if (accuracy >= 65) {
    return 6.0;
  }
  return 5.5;
}

function mapSpeakingRatingToBand(rating) {
  if (typeof rating !== "number" || Number.isNaN(rating)) {
    return null;
  }
  if (rating >= 4.8) {
    return 8.0;
  }
  if (rating >= 4.3) {
    return 7.5;
  }
  if (rating >= 3.8) {
    return 7.0;
  }
  if (rating >= 3.3) {
    return 6.5;
  }
  if (rating >= 2.8) {
    return 6.0;
  }
  return 5.5;
}

function roundToNearestHalf(value) {
  return Math.round(value * 2) / 2;
}

function countFilled(entries, key) {
  return entries.filter(({ tracking }) => {
    const value = Number(tracking[key]);
    return !Number.isNaN(value);
  }).length;
}

function estimateWritingBand(entries, reviews) {
  const manualBand = getLatestValidWritingBand(entries);
  if (manualBand !== null) {
    return { value: manualBand, state: "manual" };
  }

  const writingCompletionValues = entries
    .map(({ tracking }) => String(tracking.writingCompleted).toLowerCase())
    .filter(Boolean)
    .map((value) => (value === "yes" ? 1 : 0));

  const completionRate = averagePrecise(writingCompletionValues);
  const repeatedIssueCount = reviews.reduce((count, { review }) => {
    const rewritten = normalizeList(readReviewField(review, ["rewrittenSentences", "ielts_rewritten_sentences"]));
    return count + rewritten.length;
  }, 0);

  if (completionRate === null || writingCompletionValues.length < 3) {
    return { value: null, state: "set" };
  }

  if (repeatedIssueCount >= 6) {
    return { value: 6.0, state: "fallback" };
  }
  if (repeatedIssueCount >= 3) {
    return { value: 6.5, state: "fallback" };
  }
  if (completionRate >= 0.8) {
    return { value: 7.0, state: "fallback" };
  }
  if (completionRate >= 0.5) {
    return { value: 6.5, state: "fallback" };
  }
  return { value: null, state: "set" };
}

function buildIeltsProgress(entries, reviews) {
  const targetBand = 8.0;
  const listeningCount = countFilled(entries, "listeningAccuracy");
  const readingCount = countFilled(entries, "readingAccuracy");
  const speakingCount = countFilled(entries, "speakingFluency");

  const averages = {
    listeningAccuracy: averagePrecise(
      entries.map(({ tracking }) => Number(tracking.listeningAccuracy)).filter((value) => !Number.isNaN(value))
    ),
    readingAccuracy: averagePrecise(
      entries.map(({ tracking }) => Number(tracking.readingAccuracy)).filter((value) => !Number.isNaN(value))
    ),
    speakingFluency: averagePrecise(
      entries.map(({ tracking }) => Number(tracking.speakingFluency)).filter((value) => !Number.isNaN(value))
    ),
    writingCompletion: averagePrecise(
      entries
        .map(({ tracking }) => String(tracking.writingCompleted).toLowerCase())
        .filter(Boolean)
        .map((value) => (value === "yes" ? 1 : 0))
    )
  };
  const writing = estimateWritingBand(entries, reviews);

  const subscores = {
    listening: listeningCount >= 2 ? mapAccuracyToIeltsBand(averages.listeningAccuracy) : null,
    reading: readingCount >= 2 ? mapAccuracyToIeltsBand(averages.readingAccuracy) : null,
    writing: writing.value,
    speaking: speakingCount >= 2 ? mapSpeakingRatingToBand(averages.speakingFluency) : null
  };

  const usableBands = Object.values(subscores).filter((value) => typeof value === "number" && !Number.isNaN(value));
  const overallBand =
    usableBands.length >= 3
      ? roundToNearestHalf(usableBands.reduce((sum, value) => sum + value, 0) / usableBands.length)
      : null;

  return {
    targetBand,
    overallBand,
    progressPercent: overallBand === null ? 0 : clamp((overallBand / targetBand) * 100, 0, 100),
    subscores,
    listeningEnough: listeningCount >= 2,
    readingEnough: readingCount >= 2,
    speakingEnough: speakingCount >= 2,
    writingState: writing.state
  };
}

function buildLawProgress(entries, lawSchedule, plan, currentDate) {
  const stages = lawSchedule?.stages ?? [];
  const currentStage = getCurrentLawStage(lawSchedule, currentDate);
  const firstStage = stages[0] ?? null;
  const lastStage = stages[stages.length - 1] ?? null;
  const subjects = currentStage?.subjects?.length ? currentStage.subjects : plan?.law?.subjects ?? [];

  const stageProgress = currentStage
    ? clamp(
        (elapsedInclusive(currentStage.start, currentDate, currentStage.end) /
          inclusiveDaySpan(currentStage.start, currentStage.end)) *
          100,
        0,
        100
      )
    : 0;

  const overallProgress =
    firstStage && lastStage
      ? clamp(
          (elapsedInclusive(firstStage.start, currentDate, lastStage.end) /
            inclusiveDaySpan(firstStage.start, lastStage.end)) *
            100,
          0,
          100
        )
      : 0;

  const todayEntry = entries.find(({ date }) => date === currentDate)?.tracking ?? {};
  const todayMap = normalizeLawCompletionMap(todayEntry.lawCompletedToday, subjects) ?? {};
  const subjectProgress = subjects.map((subject) => {
    let recognizedDays = 0;
    let completedDays = 0;

    entries.forEach(({ tracking }) => {
      const normalized = normalizeLawCompletionMap(tracking.lawCompletedToday, subjects);
      if (!normalized) {
        return;
      }
      recognizedDays += 1;
      if (normalized[subject]) {
        completedDays += 1;
      }
    });

    return {
      name: subject,
      completedToday: Boolean(todayMap[subject]),
      weeklyCompletionRate: recognizedDays ? (completedDays / 7) * 100 : null
    };
  });

  return {
    stageName: currentStage?.stage ?? plan?.law?.stage ?? "No active stage",
    stageProgress,
    overallProgress,
    subjects: subjectProgress
  };
}

export function buildProgressOverview({ store, config, plan, currentDate }) {
  const trackingEntries = collectTrackingEntries(store, currentDate, 7);
  const reviewEntries = collectReviewEntries(store, currentDate, 7);
  return {
    ielts: buildIeltsProgress(trackingEntries, reviewEntries),
    law: buildLawProgress(trackingEntries, config.lawSchedule, plan, currentDate),
    formatPercent
  };
}

function countReviewMatches(reviews, keys, matcher) {
  return reviews.reduce((count, { review }) => {
    const items = keys.flatMap((keyGroup) => normalizeList(readReviewField(review, keyGroup)));
    return count + items.filter((item) => matcher(item.toLowerCase())).length;
  }, 0);
}

function buildIeltsPriority(entries, reviews, overview) {
  const subscores = overview.ielts.subscores;
  const writingCompletions = entries
    .map(({ tracking }) => String(tracking.writingCompleted).toLowerCase())
    .filter(Boolean)
    .map((value) => (value === "yes" ? 1 : 0));
  const writingCompletionRate = averagePrecise(writingCompletions);

  const issueCounts = {
    listening: countReviewMatches(reviews, [["errors", "ielts_errors"]], (item) => item.includes("listen")),
    reading: countReviewMatches(reviews, [["errors", "ielts_errors"]], (item) => item.includes("read")),
    writing: countReviewMatches(
      reviews,
      [["rewrittenSentences", "ielts_rewritten_sentences"], ["errors", "ielts_errors"]],
      (item) => item.includes("write") || item.includes("grammar") || item.includes("cohesion") || item.includes("sentence")
    ),
    speaking: countReviewMatches(reviews, [["speakingIssues", "ielts_speaking_issues"]], () => true)
  };

  const candidates = [
    {
      area: "Listening",
      score: subscores.listening ?? 9.5,
      missing: !overview.ielts.listeningEnough,
      repeated: issueCounts.listening >= 2,
      reason:
        issueCounts.listening >= 2
          ? "Repeated listening errors found in review"
          : overview.ielts.listeningEnough
            ? "Lowest estimated band in the last 7 days"
            : "Not enough listening data yet",
      action: "Do one extra Section 1 reset and review missed items."
    },
    {
      area: "Reading",
      score: subscores.reading ?? 9.5,
      missing: !overview.ielts.readingEnough,
      repeated: issueCounts.reading >= 2,
      reason:
        issueCounts.reading >= 2
          ? "Repeated reading errors found in review"
          : overview.ielts.readingEnough
            ? "Lowest estimated band in the last 7 days"
            : "Not enough reading data yet",
      action: "Add a short targeted reading block and review answer location."
    },
    {
      area: "Writing",
      score:
        overview.ielts.writingState === "set"
          ? 5.0
          : subscores.writing ?? 9.5,
      missing: overview.ielts.writingState === "set",
      repeated: issueCounts.writing >= 2 || (writingCompletionRate !== null && writingCompletionRate < 0.6),
      reason:
        overview.ielts.writingState === "set"
          ? "Writing estimate still missing"
          : issueCounts.writing >= 2
            ? "Repeated writing issues found in review"
            : writingCompletionRate !== null && writingCompletionRate < 0.6
              ? "Low writing completion in the last 7 days"
              : "Lowest estimated band in the last 7 days",
      action:
        overview.ielts.writingState === "set"
          ? "Set writing band and complete one writing task today."
          : "Complete one writing task and revise weak sentences."
    },
    {
      area: "Speaking",
      score: subscores.speaking ?? 9.5,
      missing: !overview.ielts.speakingEnough,
      repeated: issueCounts.speaking >= 2,
      reason:
        issueCounts.speaking >= 2
          ? "Repeated speaking issues found in review"
          : overview.ielts.speakingEnough
            ? "Lowest estimated band in the last 7 days"
            : "Not enough speaking data yet",
      action: "Do one short speaking retry focused on fluency and hesitation."
    }
  ];

  candidates.sort((a, b) => {
    const urgencyA = (a.missing ? -3 : 0) + (a.repeated ? -2 : 0) + a.score;
    const urgencyB = (b.missing ? -3 : 0) + (b.repeated ? -2 : 0) + b.score;
    return urgencyA - urgencyB;
  });

  return candidates[0];
}

function buildLawPriority(overview, plan) {
  const subjects = overview.law.subjects ?? [];
  if (!subjects.length) {
    return {
      name: plan?.law?.subjectLabel ?? plan?.law?.stage ?? "Current law stage",
      reason: "Not enough data yet, use current stage as default priority",
      action: "Prioritize today."
    };
  }

  if (subjects.length === 1) {
    return {
      name: subjects[0].name,
      reason:
        subjects[0].weeklyCompletionRate === null
          ? "Not enough data yet, use current stage as default priority"
          : "Current law focus for this stage",
      action: "Prioritize today."
    };
  }

  const withRates = subjects.filter((subject) => subject.weeklyCompletionRate !== null);
  if (!withRates.length) {
    return {
      name: subjects.map((subject) => subject.name).join(" + "),
      reason: "Not enough data yet, use current stage as default priority",
      action: "Prioritize the first subject you have not completed today."
    };
  }

  const lowest = [...withRates].sort((a, b) => a.weeklyCompletionRate - b.weeklyCompletionRate)[0];
  return {
    name: lowest.name,
    reason: "Lower weekly completion than the other current subject",
    action: "Prioritize today."
  };
}

export function buildPriorityOverview({ store, plan, currentDate, overview }) {
  const trackingEntries = collectTrackingEntries(store, currentDate, 7);
  const reviewEntries = collectReviewEntries(store, currentDate, 7);

  return {
    ielts: buildIeltsPriority(trackingEntries, reviewEntries, overview),
    law: buildLawPriority(overview, plan)
  };
}

export function buildWeeklySummary({ store, currentDate }) {
  const trackingEntries = [];
  const reviewEntries = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(currentDate, -offset);
    const tracking = store.getTracking(date);
    const review = store.getReview(date);
    if (Object.keys(tracking).length > 0) {
      trackingEntries.push(tracking);
    }
    if (Object.keys(review).length > 0) {
      reviewEntries.push(review);
    }
  }

  const listeningAvg = average(
    trackingEntries.map((entry) => Number(entry.listeningAccuracy)).filter((value) => !Number.isNaN(value))
  );
  const readingAvg = average(
    trackingEntries.map((entry) => Number(entry.readingAccuracy)).filter((value) => !Number.isNaN(value))
  );
  const lawAvg = average(
    trackingEntries.map((entry) => Number(entry.lawAccuracy)).filter((value) => !Number.isNaN(value))
  );
  const writingRate = average(
    trackingEntries
      .map((entry) => String(entry.writingCompleted).toLowerCase())
      .filter(Boolean)
      .map((value) => (value === "yes" ? 100 : 0))
  );

  const ieltsWeak = [];
  const lawWeak = [];

  reviewEntries.forEach((entry) => {
    normalizeList(readReviewField(entry, ["errors", "ielts_errors"])).forEach((item) => ieltsWeak.push(item));
    normalizeList(readReviewField(entry, ["speakingIssues", "ielts_speaking_issues"])).forEach((item) =>
      ieltsWeak.push(item)
    );
    normalizeList(readReviewField(entry, ["lawMistakes", "law_5_mistakes"])).forEach((item) => lawWeak.push(item));
  });

  trackingEntries.forEach((entry) => {
    normalizeList(entry.lawWeakAreas).forEach((item) => lawWeak.push(item));
  });

  const topIelts = countItems(ieltsWeak).slice(0, 2);
  const topLaw = countItems(lawWeak).slice(0, 2);

  return `
    <div class="card-grid">
      <div class="summary-card">
        <p class="mini-label">IELTS Trend</p>
        <h3>${listeningAvg ?? "--"}% listening</h3>
        <p class="muted">7-day average</p>
      </div>
      <div class="summary-card">
        <p class="mini-label">IELTS Trend</p>
        <h3>${readingAvg ?? "--"}% reading</h3>
        <p class="muted">7-day average</p>
      </div>
      <div class="summary-card">
        <p class="mini-label">Writing</p>
        <h3>${writingRate ?? "--"}%</h3>
        <p class="muted">Completion rate</p>
      </div>
      <div class="summary-card">
        <p class="mini-label">Law Accuracy</p>
        <h3>${lawAvg ?? "--"}%</h3>
        <p class="muted">7-day average</p>
      </div>
    </div>
    <div class="card-grid" style="margin-top: 12px;">
      <div class="summary-card">
        <p class="mini-label">Top 2 IELTS Weak Areas</p>
        <div class="trend-list">
          ${
            topIelts.length
              ? topIelts.map(([item, count]) => `<div class="pill warning">${item} · ${count}x</div>`).join("")
              : '<p class="empty-state">No weak IELTS patterns yet. Add a few days of review data.</p>'
          }
        </div>
      </div>
      <div class="summary-card">
        <p class="mini-label">Top 2 Law Weak Areas</p>
        <div class="trend-list">
          ${
            topLaw.length
              ? topLaw.map(([item, count]) => `<div class="pill danger">${item} · ${count}x</div>`).join("")
              : '<p class="empty-state">No weak law patterns yet. Add a few days of review data.</p>'
          }
        </div>
      </div>
    </div>
  `;
}
