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

export function createPlanner(config, store) {
  const { appConfig, weeklyStructure, lawSchedule } = config;

  function getPhase(dateString) {
    return (
      appConfig.phaseTimeline.find((phase) => dateInRange(dateString, phase.start, phase.end)) ??
      appConfig.phaseTimeline[0] ??
      { name: "Current Phase", label: "Default", intensity: "medium" }
    );
  }

  function getBusyProfile(dateString) {
    return appConfig.busyDays[String(getDayIndex(dateString))] ?? null;
  }

  function getLawSlot(dateString) {
    const activeStage =
      lawSchedule.stages.find((stage) => dateInRange(dateString, stage.start, stage.end)) ??
      null;
    return {
      subjects: activeStage?.subjects?.length ? activeStage.subjects : ["No law subject configured"],
      stage: activeStage?.stage ?? "No active law stage"
    };
  }

  function makeTaskId(prefix, index) {
    return `${prefix}-${index}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getRecentReviews(endDate, days) {
    const reviews = [];
    for (let offset = 1; offset <= days; offset += 1) {
      const date = addDays(endDate, -offset);
      const review = store.getReview(date);
      if (Object.keys(review).length > 0) {
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
      if (Object.keys(tracking).length > 0) {
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

    const lastTracking = recentTracking[0]?.tracking;
    if (lastTracking) {
      if (Number(lastTracking.listeningAccuracy) < thresholds.ieltsAccuracyFloor) {
        adjustments.push({
          domain: "IELTS",
          reason: "Listening accuracy below 80%",
          type: "task",
          task: {
            type: "listening",
            title: "Extra Section 1 reset",
            detail: "Add one short Section 1 accuracy drill before the main listening block.",
            source: "adaptive"
          }
        });
      }
      if (Number(lastTracking.readingAccuracy) < thresholds.ieltsAccuracyFloor) {
        adjustments.push({
          domain: "IELTS",
          reason: "Reading accuracy below 80%",
          type: "task",
          task: {
            type: "reading",
            title: "Extra 5 reading questions",
            detail: "Add 5 focused questions on the same question type you missed yesterday.",
            source: "adaptive"
          }
        });
      }
      if (String(lastTracking.writingCompleted).toLowerCase() === "no") {
        adjustments.push({
          domain: "IELTS",
          reason: "Missed writing yesterday",
          type: "task",
          task: {
            type: "writing",
            title: "Carry-in Task 2",
            detail: "Add one Task 2 draft to recover the missed writing session.",
            source: "adaptive"
          }
        });
      }
      if (Number(lastTracking.lawAccuracy) < appConfig.adaptiveThresholds.lawAccuracyFloor) {
        adjustments.push({
          domain: "Law",
          reason: "Law accuracy below 70%",
          type: "note",
          note: "Increase law practice volume slightly today: add one extra MCQ block or 30 minutes of mistakes review."
        });
      }
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

    if (listeningErrors.length >= repeatCutoff) {
      adjustments.push({
        domain: "IELTS",
        reason: "Repeated listening errors in evening review",
        type: "task",
        task: {
          type: "listening",
          title: "Extra Section 1 listening repair",
          detail: "Add one more short Section 1 drill focused on repeat error patterns.",
          source: "adaptive"
        }
      });
    }

    if (readingErrors.length >= repeatCutoff) {
      adjustments.push({
        domain: "IELTS",
        reason: "Repeated reading errors in evening review",
        type: "task",
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
    const previousDate = addDays(dateString, -1);
    const previousPlan = store.getPlan(previousDate);
    if (!previousPlan) {
      return [];
    }

    return previousPlan.ieltsTasks
      .filter((task) => !task.completed)
      .slice(0, 2)
      .map((task) => ({
        ...task,
        id: makeTaskId("carry", task.title.length),
        source: "carry-over",
        carriedFrom: previousDate
      }));
  }

  function buildIeltsTasks(dateString, phase) {
    const tasks = (weeklyStructure[String(getDayIndex(dateString))] ?? []).map((task, index) => ({
      ...task,
      id: makeTaskId("core", index),
      completed: false,
      source: "core",
      phaseNote:
        task.phaseDetails?.[phase.intensity] ??
        task.phaseDetails?.[phase.name] ??
        task.phaseDetails?.default ??
        ""
    }));

    const busyProfile = getBusyProfile(dateString);
    if (busyProfile?.ieltsModifier === "light" && tasks.length > 2) {
      tasks[tasks.length - 1].detail += " Keep it short because classes are heavy today.";
    }

    return tasks;
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

  function buildPlan(dateString) {
    const phase = getPhase(dateString);
    const adaptive = buildAdaptiveAdjustments(dateString);
    const carryOver = collectCarryOver(dateString);
    const coreTasks = buildIeltsTasks(dateString, phase);
    const adaptiveTasks = adaptive.extraTasks.map((item, index) => ({
      ...item.task,
      id: makeTaskId("adaptive", index),
      completed: false,
      phaseNote: "Adaptive add-on"
    }));

    const allTasks = [...carryOver, ...coreTasks, ...adaptiveTasks];
    const law = getLawSlot(dateString);
    const busyProfile = getBusyProfile(dateString);
    const lawHours = busyProfile?.lawHours ?? appConfig.defaultLawHours;

    return {
      date: dateString,
      label: formatDateLabel(dateString),
      phase,
      busyProfile,
      progress: summarizeProgress(dateString, allTasks, phase),
      law: {
        ...law,
        subject: law.subjects.join(" + "),
        subjectLabel: law.subjects.join(" / "),
        hours: lawHours
      },
      adjustments: adaptive.notes,
      rawAdjustments: adaptive.raw,
      carryOver,
      ieltsTasks: allTasks
    };
  }

  function ensureDay(dateString, options = {}) {
    const existing = store.getPlan(dateString);
    if (existing && !options.forceRefresh) {
      return existing;
    }

    const nextPlan = buildPlan(dateString);
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
    plan.progress = summarizeProgress(dateString, plan.ieltsTasks, plan.phase);
    store.savePlan(dateString, plan);
  }

  return {
    ensureDay,
    toggleTask,
    getPhase
  };
}
