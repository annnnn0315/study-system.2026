const DAY_NAME_TO_INDEX = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6
};

function normalizeKey(key) {
  return String(key ?? "")
    .trim()
    .toLowerCase();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function defaultPhaseTimeline() {
  return [
    {
      name: "Current Phase",
      label: "Default",
      start: "2026-01-01",
      end: "2026-12-31",
      intensity: "medium"
    }
  ];
}

function getPhaseDetails(task) {
  return (
    task?.detailsByPhase ??
    task?.phaseIntensity ??
    task?.phaseDetails ??
    task?.intensityByPhase ??
    {}
  );
}

function mapReviewField(sectionKey, label, index) {
  const text = `${sectionKey} ${label}`.toLowerCase();
  if (text.includes("rewritten")) {
    return "rewrittenSentences";
  }
  if (text.includes("speaking")) {
    return "speakingIssues";
  }
  if (text.includes("error")) {
    return "errors";
  }
  if (text.includes("key point")) {
    return "lawKeyPoints";
  }
  if (text.includes("mistake")) {
    return "lawMistakes";
  }
  if (text.includes("tomorrow focus") || text.includes("focus")) {
    return "tomorrowFocus";
  }
  const safe = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `${sectionKey}_${safe || `item_${index + 1}`}`;
}

export function normalizeAppConfig(config = {}) {
  return {
    examDate: config.examDate ?? "2026-12-31",
    lawObjectiveExamDate: config.lawObjectiveExamDate ?? "2026-09-12",
    ieltsStartDate: config.ieltsStartDate ?? config.phaseTimeline?.[0]?.start ?? "2026-01-01",
    phaseTimeline: toArray(config.phaseTimeline).length ? config.phaseTimeline : defaultPhaseTimeline(),
    busyDays: config.busyDays ?? {},
    defaultLawHours: config.defaultLawHours ?? 5,
    dailyExtraLoadCap: config.dailyExtraLoadCap ?? 0.3,
    adaptiveThresholds: {
      ieltsAccuracyFloor: config.adaptiveThresholds?.ieltsAccuracyFloor ?? 80,
      lawAccuracyFloor: config.adaptiveThresholds?.lawAccuracyFloor ?? 70,
      repeatIssueDays: config.adaptiveThresholds?.repeatIssueDays ?? 2,
      weakAreaWindowDays: config.adaptiveThresholds?.weakAreaWindowDays ?? 7
    }
  };
}

export function normalizeWeeklyStructure(structure = {}) {
  const normalized = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  Object.entries(structure ?? {}).forEach(([rawKey, tasks]) => {
    const key = normalizeKey(rawKey);
    const index =
      key in DAY_NAME_TO_INDEX ? DAY_NAME_TO_INDEX[key] : Number.isInteger(Number(key)) ? Number(key) : null;
    if (index === null || index < 0 || index > 6) {
      return;
    }
    normalized[index] = toArray(tasks).map((task, taskIndex) => {
      const phaseDetails = getPhaseDetails(task);
      return {
        ...task,
        type: task?.type ?? "practice",
        title: task?.title ?? task?.name ?? `IELTS Task ${taskIndex + 1}`,
        detail: task?.detail ?? task?.description ?? "Complete the planned IELTS task.",
        baseMinutes: task?.baseMinutes ?? task?.minutes ?? 20,
        phaseDetails
      };
    });
  });
  return normalized;
}

export function normalizeLawSchedule(schedule = {}) {
  const stages = toArray(schedule?.stages).map((stage, index) => ({
    start: stage?.start ?? "2026-01-01",
    end: stage?.end ?? "2026-12-31",
    stage: stage?.stage ?? `Stage ${index + 1}`,
    subjects: toArray(stage?.subjects).filter(Boolean)
  }));
  return {
    stages
  };
}

export function normalizeReviewChecklist(checklist = {}) {
  const sections = [
    {
      key: "ielts",
      title: "IELTS",
      items: toArray(checklist?.ielts).map((label, index) => ({
        label,
        field: mapReviewField("ielts", String(label), index)
      }))
    },
    {
      key: "law",
      title: "Law",
      items: toArray(checklist?.law).map((label, index) => ({
        label,
        field: mapReviewField("law", String(label), index)
      }))
    }
  ];

  return {
    ielts: toArray(checklist?.ielts),
    law: toArray(checklist?.law),
    sections
  };
}
