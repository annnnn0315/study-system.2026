import { addDays, dateInRange, diffDays, formatDateLabel } from "./date.js";

function getDayIndex(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).getDay();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeList(text) {
  return (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function countRepeats(items) {
  const counts = new Map();
  items.forEach((item) => {
    const key = item.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function normalizeIntensity(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (key === "light") {
    return "light";
  }
  if (key === "normal" || key === "medium") {
    return "normal";
  }
  if (key === "heavy" || key === "high") {
    return "heavy";
  }
  return null;
}

const PLAN_SCHEMA_VERSION = 6;
const PHASE_ONE_WEEKLY_PLAN = {
  1: [
    {
      type: "listening",
      title: "Listening 1 section",
      detail: "Complete 1 listening section and review wrong answers.",
      baseMinutes: 20,
      phaseDetails: {
        light: "Keep it to one clean section with short error review.",
        normal: "Standard section with short review notes.",
        heavy: "Add a brief replay of missed items."
      }
    },
    {
      type: "speaking",
      title: "Speaking",
      detail: "Do a short speaking practice block with one retry.",
      baseMinutes: 20,
      phaseDetails: {
        light: "Keep it short and fluent.",
        normal: "Standard speaking block.",
        heavy: "Add one longer timed answer."
      }
    }
  ],
  2: [
    {
      type: "writing",
      title: "Writing Task 2",
      detail: "Write one Task 2 essay and do a short revision pass.",
      baseMinutes: 40,
      phaseDetails: {
        light: "Complete Task 2 and keep revision brief.",
        normal: "Standard Task 2 practice.",
        heavy: "Add deeper revision on thesis and topic sentences."
      }
    },
    {
      type: "reading",
      title: "Reading",
      detail: "Complete one reading block and review answer locations.",
      baseMinutes: 20,
      phaseDetails: {
        light: "Use a shorter reading block.",
        normal: "Standard reading practice.",
        heavy: "Add a few extra questions after review."
      }
    }
  ],
  3: [
    {
      type: "reading",
      title: "Reading",
      detail: "Complete one reading block and review wrong answers.",
      baseMinutes: 20,
      phaseDetails: {
        light: "Keep the reading set short.",
        normal: "Standard reading practice.",
        heavy: "Add a few extra questions after review."
      }
    },
    {
      type: "speaking",
      title: "Speaking",
      detail: "Practice speaking with one retry on the weakest response.",
      baseMinutes: 20,
      phaseDetails: {
        light: "Short fluency practice.",
        normal: "Standard speaking block.",
        heavy: "Add one timed answer."
      }
    }
  ],
  4: [
    {
      type: "writing",
      title: "Writing Task 1",
      detail: "Write one Task 1 response and check overview quality.",
      baseMinutes: 30,
      phaseDetails: {
        light: "Keep revision short, but complete the Task 1 draft.",
        normal: "Standard Task 1 practice.",
        heavy: "Add a sentence variety check."
      }
    },
    {
      type: "listening",
      title: "Listening 1 section",
      detail: "Complete 1 listening section and review wrong answers.",
      baseMinutes: 20,
      phaseDetails: {
        light: "One section with short review.",
        normal: "Standard listening section.",
        heavy: "Add a replay of missed items."
      }
    }
  ],
  5: [
    {
      type: "writing",
      title: "Writing Task 2",
      detail: "Write one Task 2 essay and revise the weakest paragraph.",
      baseMinutes: 40,
      phaseDetails: {
        light: "Complete Task 2 and keep revision concise.",
        normal: "Standard Task 2 practice.",
        heavy: "Add more detailed revision."
      }
    },
    {
      type: "mixed_practice",
      title: "Listening/Reading 1 section",
      detail: "Complete one listening or reading section, then review errors.",
      baseMinutes: 20,
      phaseDetails: {
        light: "One short section only.",
        normal: "Standard one-section practice.",
        heavy: "Add a brief error log."
      }
    }
  ],
  6: [
    {
      type: "speaking",
      title: "Speaking mock",
      detail: "Run a speaking mock and identify the weakest answer.",
      baseMinutes: 20,
      phaseDetails: {
        light: "One clean mock run.",
        normal: "Run and retry the weakest part.",
        heavy: "Run, retry, and self-note errors."
      }
    },
    {
      type: "writing_review",
      title: "Writing review",
      detail: "Review recent writing and extract useful phrases or corrections.",
      baseMinutes: 25,
      phaseDetails: {
        light: "Short writing review only.",
        normal: "Standard writing review.",
        heavy: "Add one rewrite of weak sentences."
      }
    },
    {
      type: "reading",
      title: "Reading",
      detail: "Complete one reading block and review answer locations.",
      baseMinutes: 20,
      phaseDetails: {
        light: "Keep the reading set short.",
        normal: "Standard reading practice.",
        heavy: "Add a few extra questions after review."
      }
    }
  ],
  0: [
    {
      type: "listening",
      title: "Listening 1 section",
      detail: "Complete 1 listening section and review wrong answers.",
      baseMinutes: 20,
      phaseDetails: {
        light: "Keep it to one clean section with short error review.",
        normal: "Standard section with review notes.",
        heavy: "Add a replay of missed items."
      }
    },
    {
      type: "speaking",
      title: "Speaking",
      detail: "Do a short speaking practice block with one retry.",
      baseMinutes: 20,
      phaseDetails: {
        light: "Short fluency practice.",
        normal: "Standard speaking block.",
        heavy: "Add one timed answer."
      }
    },
    {
      type: "review",
      title: "Weekly review",
      detail: "List weekly weaknesses and write simple fix strategies.",
      baseMinutes: 20,
      phaseDetails: {
        light: "Keep the review concise.",
        normal: "Add next-week priority notes.",
        heavy: "Add one focused repair action."
      }
    }
  ]
};

export function createPlanner(config, store) {
  const { appConfig, weeklyStructure, lawSchedule } = config;

  function slugify(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildCarryKey(domain, originalDate, task, index = 0) {
    const type = slugify(task?.type ?? domain);
    const title = slugify(task?.title ?? task?.subject ?? `${domain}-${index}`);
    const detail = slugify(task?.detail ?? "");
    return [domain, originalDate, type, title, detail || String(index)].join(":");
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
    const allCompleted = rawValue === true || text === "yes" || text === "true";
    return safeSubjects.reduce((result, subject) => {
      result[subject] = allCompleted;
      return result;
    }, {});
  }

  function synchronizeTaskGroups(plan) {
    if (!plan) {
      return plan;
    }

    const ieltsTasks = Array.isArray(plan.ieltsTasks) ? plan.ieltsTasks : [];
    const lawTasks = Array.isArray(plan.lawTasks) ? plan.lawTasks : [];

    const plannedIeltsTasks = ieltsTasks.filter(
      (task) => task.source === "planned" || task.source === "core"
    );
    const ieltsCarryOverTasks = ieltsTasks.filter((task) => task.source === "carry-over" && task.completed === false);
    const lawCarryOverTasks = lawTasks.filter((task) => task.source === "carry-over" && task.completed === false);
    const carryOverTasks = [...ieltsCarryOverTasks, ...lawCarryOverTasks];
    const extraPracticeTasks = ieltsTasks.filter((task) => task.source === "adaptive");
    const plannedLawTasks = lawTasks.filter((task) => task.source === "planned");
    const outstandingTasks = [...carryOverTasks];

    return {
      ...plan,
      lawTasks,
      plannedLawTasks,
      ieltsCarryOverTasks,
      lawCarryOverTasks,
      plannedIeltsTasks,
      carryOver: carryOverTasks,
      carryOverTasks,
      outstandingTasks,
      extraPracticeTasks,
      progress: summarizeProgress(plan.date, ieltsTasks, plan.phase)
    };
  }

  function getPhase(dateString) {
    const phase =
      appConfig.phaseTimeline.find((phase) => dateInRange(dateString, phase.start, phase.end)) ??
      appConfig.phaseTimeline[0] ??
      { name: "Current Phase", label: "Default", intensity: "normal" };

    return {
      ...phase,
      intensity: normalizeIntensity(phase.intensity) ?? "normal"
    };
  }

  function getBusyProfile(dateString) {
    return appConfig.busyDays[String(getDayIndex(dateString))] ?? null;
  }

  function getLawSlot(dateString) {
    const activeStage =
      lawSchedule.stages.find((stage) => dateInRange(dateString, stage.start, stage.end)) ??
      null;
    const objectiveExamDate = appConfig.lawObjectiveExamDate ?? "2026-09-12";
    const objectiveExamDays = diffDays(dateString, objectiveExamDate);
    return {
      subjects: activeStage?.subjects?.length ? activeStage.subjects : ["No law subject configured"],
      stage: activeStage?.stage ?? "No active law stage",
      objectiveExamDate,
      objectiveExamDays,
      objectiveExamLabel:
        objectiveExamDays <= 0 ? "Objective exam today" : `${objectiveExamDays} days to objective exam`
    };
  }

  function hasMeaningfulTrackingData(tracking) {
    if (!tracking || typeof tracking !== "object") {
      return false;
    }

    const scalarKeys = [
      "listeningAccuracy",
      "readingAccuracy",
      "writingCompleted",
      "manualWritingBand",
      "writingBand",
      "estimatedWritingBand",
      "speakingBand",
      "lawAccuracy",
      "lawTopicsCompleted",
      "lawMistakeCount",
      "lawWeakAreas"
    ];

    const hasScalarValue = scalarKeys.some((key) => {
      const value = tracking[key];
      return value !== "" && value !== null && value !== undefined;
    });

    const lawCompletedToday = tracking.lawCompletedToday;
    const hasLawCompletion =
      lawCompletedToday &&
      typeof lawCompletedToday === "object" &&
      !Array.isArray(lawCompletedToday) &&
      Object.values(lawCompletedToday).some((value) => value === true || value === false);

    return hasScalarValue || hasLawCompletion;
  }

  function hasMeaningfulReviewData(review) {
    if (!review || typeof review !== "object") {
      return false;
    }
    return Object.values(review).some((value) => normalizeList(value).length > 0);
  }

  function makeTaskId(prefix, index) {
    return `${prefix}-${index}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createFallbackTask(type) {
    const fallbacks = {
      listening: {
        type: "listening",
        title: "Listening Section 1",
        detail: "Do Section 1 and review 2 to 3 wrong sentences.",
        baseMinutes: 15,
        phaseDetails: {
          light: "Short accuracy reset only.",
          normal: "Standard listening block.",
          heavy: "Add brief replay on missed items."
        }
      },
      speaking: {
        type: "speaking",
        title: "Speaking practice",
        detail: "Do a short speaking practice block with one retry.",
        baseMinutes: 20,
        phaseDetails: {
          light: "Keep it short and fluent.",
          normal: "Use standard speaking practice.",
          heavy: "Add one extra timed answer."
        }
      },
      reading: {
        type: "reading",
        title: "Reading passage",
        detail: "Complete one reading passage and review answer locations.",
        baseMinutes: 20,
        phaseDetails: {
          light: "Use only if explicitly required.",
          normal: "Standard passage block.",
          heavy: "Full passage with review."
        }
      },
      writing: {
        type: "writing",
        title: "Task 2 writing",
        detail: "Write one Task 2 essay with quick revision.",
        baseMinutes: 40,
        phaseDetails: {
          light: "Not used on light days.",
          normal: "Standard Task 2 block.",
          heavy: "Core heavy-day writing block."
        }
      }
    };
    return fallbacks[type];
  }

  function attachTaskMetadata(task, index, source, intensity) {
    const normalizedTask = task ?? createFallbackTask("listening");
    return {
      ...normalizedTask,
      id: makeTaskId(source, index),
      completed: false,
      source,
      phaseNote:
        normalizedTask.phaseDetails?.[intensity] ??
        normalizedTask.phaseDetails?.default ??
        ""
    };
  }

  function attachPlannedTaskMetadata(task, dateString, index, source, intensity) {
    const withMetadata = attachTaskMetadata(task, index, source, intensity);
    return {
      ...withMetadata,
      domain: "ielts",
      originalDate: dateString,
      carryKey: buildCarryKey("ielts", dateString, withMetadata, index)
    };
  }

  function createLawTasksForDate(dateString, lawSubjects, source = "planned", carriedFrom = null) {
    const tracking = store.getTracking(dateString);
    const completionMap = normalizeLawCompletionMap(tracking.lawCompletedToday, lawSubjects);
    return (lawSubjects ?? []).map((subject, index) => {
      const originalDate = carriedFrom ?? dateString;
      return {
        id: makeTaskId(source === "carry-over" ? "law-carry" : "law", index),
        domain: "law",
        type: "law_subject",
        title: subject,
        detail:
          source === "carry-over"
            ? "Carry this unfinished law subject forward and complete it before new law material."
            : "Complete the current law subject block for today.",
        completed: Boolean(completionMap[subject]),
        source,
        phaseNote: source === "carry-over" ? `Carried from ${originalDate}` : "Today's law subject",
        carriedFrom: source === "carry-over" ? originalDate : undefined,
        originalDate,
        carryKey: buildCarryKey(
          "law",
          originalDate,
          {
            type: "law_subject",
            title: subject,
            detail:
              source === "carry-over"
                ? "Carry this unfinished law subject forward and complete it before new law material."
                : "Complete the current law subject block for today."
          },
          index
        )
      };
    });
  }

  function normalizeHistoricalLawTasks(planDate, plan) {
    if (Array.isArray(plan?.lawTasks) && plan.lawTasks.length) {
      return plan.lawTasks.map((task, index) => ({
        ...task,
        domain: "law",
        originalDate: task.originalDate ?? task.carriedFrom ?? planDate,
        carryKey:
          task.carryKey ??
          buildCarryKey("law", task.originalDate ?? task.carriedFrom ?? planDate, task, index)
      }));
    }

    const subjects = Array.isArray(plan?.law?.subjects) ? plan.law.subjects : [];
    return createLawTasksForDate(planDate, subjects, "planned");
  }

  function normalizeHistoricalIeltsTasks(planDate, plan) {
    const tasks = Array.isArray(plan?.ieltsTasks) ? plan.ieltsTasks : [];
    return tasks
      .filter((task) => task.source !== "adaptive")
      .map((task, index) => {
        const originalDate = task.originalDate ?? task.carriedFrom ?? planDate;
        return {
          ...task,
          domain: "ielts",
          originalDate,
          carryKey:
            task.carryKey ??
            buildCarryKey("ielts", originalDate, task, index)
        };
      });
  }

  function applyExistingCompletion(tasks, existingTasks) {
    const completionMap = new Map(
      (existingTasks ?? []).map((task) => [task.carryKey, Boolean(task.completed)])
    );
    return tasks.map((task) =>
      completionMap.has(task.carryKey)
        ? {
            ...task,
            completed: completionMap.get(task.carryKey)
          }
        : task
    );
  }

  function preferTask(tasks, matcher) {
    return tasks.find(matcher) ?? null;
  }

  function buildLightTasks(baseTasks) {
    const listeningTask = preferTask(baseTasks, (task) => task.type === "listening") ?? createFallbackTask("listening");
    const speakingTask = preferTask(baseTasks, (task) => task.type === "speaking") ?? createFallbackTask("speaking");
    return [listeningTask, speakingTask].slice(0, 2);
  }

  function buildHeavyTasks(baseTasks) {
    const selected = [];
    const pushUnique = (task) => {
      if (task && !selected.some((entry) => entry.type === task.type && entry.title === task.title)) {
        selected.push(task);
      }
    };

    pushUnique(preferTask(baseTasks, (task) => task.type === "writing" && task.title.toLowerCase().includes("task 2")) ?? createFallbackTask("writing"));
    pushUnique(preferTask(baseTasks, (task) => task.type === "reading") ?? createFallbackTask("reading"));
    pushUnique(preferTask(baseTasks, (task) => task.type === "listening"));

    baseTasks.forEach((task) => {
      if (selected.length < 3 && task.type !== "light_practice") {
        pushUnique(task);
      }
    });

    return selected;
  }

  function getRecentReviews(endDate, days) {
    const reviews = [];
    for (let offset = 1; offset <= days; offset += 1) {
      const date = addDays(endDate, -offset);
      const review = store.getReview(date);
      if (hasMeaningfulReviewData(review)) {
        reviews.push({ date, review });
      }
    }
    return reviews;
  }

  function getRecentTracking(endDate, days) {
    const entries = [];
    for (let offset = 1; offset <= days; offset += 1) {
      const date = addDays(endDate, -offset);
      const tracking = store.getTracking(date);
      if (hasMeaningfulTrackingData(tracking)) {
        entries.push({ date, tracking });
      }
    }
    return entries;
  }

  function buildAdaptiveAdjustments(dateString) {
    const thresholds = appConfig.adaptiveThresholds;
    const recentTracking = getRecentTracking(dateString, thresholds.weakAreaWindowDays);
    const recentReviews = getRecentReviews(dateString, thresholds.repeatIssueDays + 1);
    const adjustments = [];
    const validAccuracyValues = (key) =>
      recentTracking
        .map(({ tracking }) => Number(tracking[key]))
        .filter((value) => !Number.isNaN(value));
    const lowAccuracyCount = (key, cutoff) => validAccuracyValues(key).filter((value) => value < cutoff).length;
    const latestTracking = recentTracking[0]?.tracking;
    if (latestTracking && Number(latestTracking.lawAccuracy) < appConfig.adaptiveThresholds.lawAccuracyFloor) {
      adjustments.push({
        domain: "Law",
        reason: "Law accuracy below 70%",
        type: "note",
        note: "Increase law practice volume slightly today: add one extra MCQ block or 30 minutes of mistakes review."
      });
    }

    const speakingIssues = [];
    const writingIssues = [];
    const listeningErrors = [];
    const readingErrors = [];
    const lawMistakes = [];
    const lawFocuses = [];

    recentReviews.forEach(({ review }) => {
      normalizeList(review.speakingIssues).forEach((item) => speakingIssues.push(item));
      normalizeList(review.errors).forEach((item) => {
        if (item.toLowerCase().includes("listen")) {
          listeningErrors.push(item);
        }
        if (item.toLowerCase().includes("read")) {
          readingErrors.push(item);
        }
      });
      normalizeList(review.rewrittenSentences).forEach((item) => writingIssues.push(item));
      normalizeList(review.lawMistakes).forEach((item) => lawMistakes.push(item));
      normalizeList(review.tomorrowFocus).forEach((item) => lawFocuses.push(item));
    });

    const repeatCutoff = thresholds.repeatIssueDays;
    countRepeats(speakingIssues).forEach((count, key) => {
      if (count >= repeatCutoff) {
        adjustments.push({
          domain: "IELTS",
          reason: `Repeated speaking issue: ${key}`,
          type: "task",
          task: {
            type: "speaking",
            title: "Extra speaking repair session",
            detail: "Add one 10-minute speaking retry focused on the repeated issue.",
            source: "adaptive"
          }
        });
      }
    });

    if (writingIssues.length >= repeatCutoff * 2) {
      adjustments.push({
        domain: "IELTS",
        reason: "Repeated writing revision issues",
        type: "note",
        note: "Increase writing revision depth today: spend 10 extra minutes rewriting weak sentences after the main writing task."
      });
    }

    const repeatedListeningIssues = listeningErrors.length >= repeatCutoff;
    const repeatedReadingIssues = readingErrors.length >= repeatCutoff;
    const consistentlyLowListening = validAccuracyValues("listeningAccuracy").length >= 2 && lowAccuracyCount("listeningAccuracy", 75) >= 2;
    const consistentlyLowReading = validAccuracyValues("readingAccuracy").length >= 2 && lowAccuracyCount("readingAccuracy", 75) >= 2;

    if (repeatedListeningIssues || consistentlyLowListening) {
      adjustments.push({
        domain: "IELTS",
        reason: repeatedListeningIssues
          ? "Repeated listening errors in evening review"
          : "Listening accuracy below 75% across at least 2 recent entries",
        type: "task",
        evidence: repeatedListeningIssues ? "strong_review" : "strong_accuracy",
        task: {
          type: "listening",
          title: "Extra Section 1 listening repair",
          detail: "Add one more short Section 1 drill focused on repeat error patterns.",
          source: "adaptive"
        }
      });
    }

    if (repeatedReadingIssues || consistentlyLowReading) {
      adjustments.push({
        domain: "IELTS",
        reason: repeatedReadingIssues
          ? "Repeated reading errors in evening review"
          : "Reading accuracy below 75% across at least 2 recent entries",
        type: "task",
        evidence: repeatedReadingIssues ? "strong_review" : "strong_accuracy",
        task: {
          type: "reading",
          title: "Extra 5-10 reading questions",
          detail: "Add 5 to 10 targeted questions on the repeated reading problem.",
          source: "adaptive"
        }
      });
    }

    countRepeats(lawMistakes).forEach((count, key) => {
      if (count >= repeatCutoff) {
        adjustments.push({
          domain: "Law",
          reason: `Repeated law mistake topic: ${key}`,
          type: "note",
          note: `Prioritize ${key} during the afternoon law block before new material.`
        });
      }
    });

    countRepeats(lawFocuses).forEach((count, key) => {
      if (count >= 1) {
        adjustments.push({
          domain: "Law",
          reason: `Carry forward focus: ${key}`,
          type: "note",
          note: `Start the law block with ${key} before moving into the planned subject work.`
        });
      }
    });

    const weakAreas = recentTracking
      .map(({ tracking }) => tracking.lawWeakAreas || "")
      .join("\n")
      .toLowerCase();

    if (weakAreas) {
      const matches = weakAreas
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      const counts = countRepeats(matches);
      counts.forEach((count, key) => {
        if (count >= repeatCutoff) {
          adjustments.push({
            domain: "Law",
            reason: `Weak law area persisted: ${key}`,
            type: "note",
            note: `Shift slightly more time to ${key} today while keeping the same subject order.`
          });
        }
      });
    }

    const baseCount = (weeklyStructure[String(getDayIndex(dateString))] ?? []).length;
    const maxExtras = Math.max(1, Math.floor(baseCount * appConfig.dailyExtraLoadCap));
    const extraTasks = adjustments.filter((item) => item.task).slice(0, maxExtras);
    const notes = adjustments.filter((item) => item.note);

    return { extraTasks, notes, raw: adjustments };
  }

  function collectCarryOver(dateString) {
    const allPlans = store.getState().plans ?? {};
    const previousDates = Object.keys(allPlans)
      .filter((date) => date < dateString)
      .sort();

    if (!previousDates.length) {
      return { ielts: [], law: [], all: [] };
    }

    const latestByCarryKey = new Map();

    previousDates.forEach((planDate) => {
      const plan = allPlans[planDate];
      const historicalTasks = [
        ...normalizeHistoricalIeltsTasks(planDate, plan),
        ...normalizeHistoricalLawTasks(planDate, plan)
      ];

      historicalTasks.forEach((task) => {
        latestByCarryKey.set(task.carryKey, task);
      });
    });

    const outstanding = Array.from(latestByCarryKey.values())
      .filter((task) => task.completed === false)
      .map((task, index) => ({
        ...task,
        id: makeTaskId(task.domain === "law" ? "law-carry" : "carry", index),
        source: "carry-over",
        carriedFrom: task.originalDate ?? task.carriedFrom ?? task.date ?? dateString,
        phaseNote: `Carried from ${task.originalDate ?? task.carriedFrom ?? task.date ?? dateString}`
      }));

    const ielts = outstanding.filter((task) => task.domain === "ielts");
    const law = outstanding.filter((task) => task.domain === "law");

    return {
      ielts,
      law,
      all: [...ielts, ...law]
    };
  }

  function buildIeltsTasks(dateString, phase) {
    const dayIndex = getDayIndex(dateString);
    const isPhaseOne = phase.name === "Phase 1" || phase.label === "Foundation";
    const sourceTasks = isPhaseOne
      ? PHASE_ONE_WEEKLY_PLAN[dayIndex] ?? []
      : weeklyStructure[String(dayIndex)] ?? [];
    const baseTasks = sourceTasks.map((task, index) =>
      attachPlannedTaskMetadata(
        { ...task },
        dateString,
        index,
        "planned",
        normalizeIntensity(phase.intensity) ?? "normal"
      )
    );

    const busyProfile = getBusyProfile(dateString);
    if (busyProfile?.ieltsModifier === "light" && baseTasks.length > 1) {
      baseTasks[baseTasks.length - 1].detail += " Keep it short because classes are heavy today.";
    }

    return baseTasks;
  }

  function summarizeProgress(dateString, tasks, phase) {
    const completedCount = tasks.filter((task) => task.completed).length;
    const completion = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);
    const examCountdown = clamp(diffDays(dateString, appConfig.examDate), 0, 999);

    return {
      completion,
      completedCount,
      totalCount: tasks.length,
      phase: `${phase.name} · ${phase.label}`,
      examCountdown
    };
  }

  function buildPlan(dateString, existingPlan = null) {
    const phase = getPhase(dateString);
    const adaptive = buildAdaptiveAdjustments(dateString);
    const carryOver = collectCarryOver(dateString);
    const plannedIeltsTasks = buildIeltsTasks(dateString, phase);
    const law = getLawSlot(dateString);
    const plannedLawTasks = createLawTasksForDate(dateString, law.subjects, "planned");
    const currentLawCompletionMap = normalizeLawCompletionMap(store.getTracking(dateString).lawCompletedToday, law.subjects);
    const activeLawCarryOverTasks = carryOver.law.filter((task) => !currentLawCompletionMap[task.title]);
    const carryOverTasks = [...carryOver.ielts, ...activeLawCarryOverTasks];
    const plannedTypes = new Set(plannedIeltsTasks.map((task) => task.type));
    const extraPracticeTasks = adaptive.extraTasks
      .filter((item) => {
        if (!item?.task) {
          return false;
        }
        if (!plannedTypes.has(item.task.type)) {
          return true;
        }
        return item.evidence === "strong_review";
      })
      .map((item, index) => ({
      ...item.task,
      id: makeTaskId("adaptive", index),
      completed: false,
      domain: "ielts",
      originalDate: dateString,
      carryKey: buildCarryKey("adaptive", dateString, item.task, index),
      phaseNote: "Adaptive add-on"
      }));

    const existingIeltsTasks = Array.isArray(existingPlan?.ieltsTasks) ? existingPlan.ieltsTasks : [];
    const existingLawTasks = Array.isArray(existingPlan?.lawTasks) ? existingPlan.lawTasks : [];
    const allIeltsTasks = applyExistingCompletion(
      [...carryOver.ielts, ...plannedIeltsTasks, ...extraPracticeTasks],
      existingIeltsTasks
    );
    const allLawTasks = applyExistingCompletion(
      [...activeLawCarryOverTasks, ...plannedLawTasks],
      existingLawTasks
    );
    const busyProfile = getBusyProfile(dateString);
    const lawHours = busyProfile?.lawHours ?? appConfig.defaultLawHours;
    const unresolvedIeltsCarryOverTasks = allIeltsTasks.filter(
      (task) => task.source === "carry-over" && task.completed === false
    );
    const unresolvedLawCarryOverTasks = allLawTasks.filter(
      (task) => task.source === "carry-over" && task.completed === false
    );
    const outstandingTasks = [...unresolvedIeltsCarryOverTasks, ...unresolvedLawCarryOverTasks];

    return {
      planVersion: PLAN_SCHEMA_VERSION,
      date: dateString,
      label: formatDateLabel(dateString),
      phase,
      busyProfile,
      progress: summarizeProgress(dateString, allIeltsTasks, phase),
      law: {
        ...law,
        subject: law.subjects.join(" + "),
        subjectLabel: law.subjects.join(" / "),
        hours: lawHours
      },
      adjustments: adaptive.notes,
      rawAdjustments: adaptive.raw,
      carryOver: outstandingTasks,
      carryOverTasks: outstandingTasks,
      outstandingTasks,
      ieltsCarryOverTasks: unresolvedIeltsCarryOverTasks,
      lawCarryOverTasks: unresolvedLawCarryOverTasks,
      plannedIeltsTasks,
      plannedLawTasks,
      extraPracticeTasks,
      ieltsTasks: allIeltsTasks,
      lawTasks: allLawTasks
    };
  }

  function ensureDay(dateString, options = {}) {
    const existing = store.getPlan(dateString);
    if (existing && !options.forceRefresh) {
      if (existing.planVersion !== PLAN_SCHEMA_VERSION) {
        const rebuiltPlan = buildPlan(dateString, existing);
        store.savePlan(dateString, rebuiltPlan);
        return rebuiltPlan;
      }
      const synchronized = synchronizeTaskGroups(existing);
      if (JSON.stringify(synchronized) !== JSON.stringify(existing)) {
        store.savePlan(dateString, synchronized);
      }
      return synchronized;
    }

    const nextPlan = buildPlan(dateString, existing);
    store.savePlan(dateString, nextPlan);

    if (options.includeNextDay) {
      const tomorrow = addDays(dateString, 1);
      const tomorrowPlan = buildPlan(tomorrow);
      store.savePlan(tomorrow, tomorrowPlan);
    }

    return nextPlan;
  }

  function toggleTask(dateString, taskId, completed) {
    const plan = store.getPlan(dateString);
    if (!plan) {
      return;
    }
    plan.ieltsTasks = plan.ieltsTasks.map((task) =>
      task.id === taskId ? { ...task, completed } : task
    );
    plan.lawTasks = (plan.lawTasks ?? []).map((task) =>
      task.id === taskId ? { ...task, completed } : task
    );
    const nextPlan = synchronizeTaskGroups(plan);
    store.savePlan(dateString, nextPlan);
  }

  function resetDay(dateString) {
    const existingPlan = store.getPlan(dateString);
    if (existingPlan) {
      const lawTaskTitles = (existingPlan.lawTasks ?? []).map((task) => task.title);
      if (lawTaskTitles.length) {
        const existingTracking = store.getTracking(dateString);
        const previousMap =
          existingTracking.lawCompletedToday &&
          typeof existingTracking.lawCompletedToday === "object" &&
          !Array.isArray(existingTracking.lawCompletedToday)
            ? existingTracking.lawCompletedToday
            : {};
        const resetMap = { ...previousMap };
        lawTaskTitles.forEach((title) => {
          resetMap[title] = false;
        });
        store.saveTracking(dateString, {
          lawCompletedToday: resetMap
        });
      }
    }

    store.deletePlan(dateString);
    const rebuiltPlan = buildPlan(dateString, null);
    store.savePlan(dateString, rebuiltPlan);
    return rebuiltPlan;
  }

  return {
    ensureDay,
    toggleTask,
    resetDay,
    getPhase
  };
}
