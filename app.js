import { createPlanner } from "./lib/planner.js";
import { createStore } from "./lib/store.js";
import { buildProgressOverview, buildWeeklySummary } from "./lib/analytics.js";
import { renderProgressOverview, renderReviewForm, renderTodayDashboard, renderTrackingForm, showDateChip } from "./lib/ui.js";
import {
  normalizeAppConfig,
  normalizeLawSchedule,
  normalizeReviewChecklist,
  normalizeWeeklyStructure
} from "./lib/config-adapters.js";

async function loadJson(path, fallback) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[study-system] Failed to parse config: ${path}`, error);
    return fallback;
  }
}

async function loadConfig() {
  const [rawAppConfig, rawWeeklyStructure, rawLawSchedule, rawReviewChecklist] = await Promise.all([
    loadJson("./data/app-config.json", {}),
    loadJson("./data/ielts-weekly-structure.json", {}),
    loadJson("./data/law-schedule.json", { stages: [] }),
    loadJson("./data/review-checklist.json", { ielts: [], law: [] })
  ]);

  return {
    appConfig: normalizeAppConfig(rawAppConfig),
    weeklyStructure: normalizeWeeklyStructure(rawWeeklyStructure),
    lawSchedule: normalizeLawSchedule(rawLawSchedule),
    reviewChecklist: normalizeReviewChecklist(rawReviewChecklist)
  };
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function bootstrap() {
  const config = await loadConfig();
  const store = createStore();
  const planner = createPlanner(config, store);
  const currentDate = todayKey();

  const refresh = () => {
    const plan = planner.ensureDay(currentDate);
    const summary = buildWeeklySummary({
      store,
      config,
      planner,
      currentDate
    });
    const overview = buildProgressOverview({
      store,
      config,
      plan,
      currentDate
    });

    showDateChip(document.getElementById("date-chip"), plan);
    renderProgressOverview({
      container: document.getElementById("progress-overview"),
      overview
    });
    renderTodayDashboard({
      container: document.getElementById("today-dashboard"),
      plan,
      onToggleTask: (taskId, completed) => {
        planner.toggleTask(currentDate, taskId, completed);
        refresh();
      }
    });

    renderTrackingForm({
      container: document.getElementById("tracking-form"),
      tracking: store.getTracking(currentDate),
      lawSubjects: plan.law?.subjects ?? [],
      onSubmit: (payload) => {
        store.saveTracking(currentDate, payload);
        planner.ensureDay(currentDate, { forceRefresh: true });
        refresh();
      }
    });

    renderReviewForm({
      container: document.getElementById("review-form"),
      review: store.getReview(currentDate),
      checklist: config.reviewChecklist,
      onSubmit: (payload) => {
        store.saveReview(currentDate, payload);
        planner.ensureDay(currentDate, { forceRefresh: true, includeNextDay: true });
        refresh();
      }
    });

    document.getElementById("weekly-summary").innerHTML = summary;
  };

  document.getElementById("reset-today").addEventListener("click", () => {
    planner.ensureDay(currentDate, { forceRefresh: true });
    refresh();
  });

  refresh();
}

bootstrap().catch((error) => {
  document.body.innerHTML = `<main class="app-shell"><section class="panel"><h2>App failed to load</h2><p class="muted">${error.message}</p></section></main>`;
});
