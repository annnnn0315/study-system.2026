import { createPlanner } from "./lib/planner.js";
import { createStore } from "./lib/store.js";
import { buildPriorityOverview, buildProgressOverview, buildWeeklySummary } from "./lib/analytics.js";
import {
  renderProgressOverview,
  renderReviewForm,
  renderTodayDashboard,
  renderTrackingForm,
  showDateChip
} from "./lib/ui.js";
import {
  normalizeAppConfig,
  normalizeLawSchedule,
  normalizeReviewChecklist,
  normalizeWeeklyStructure
} from "./lib/config-adapters.js";

const NOTIFICATION_PREF_KEY = "study-system-notifications-requested-v1";
const REMINDERS = [
  { hour: 9, minute: 0, title: "IELTS session", body: "Time for your IELTS session." },
  { hour: 13, minute: 0, title: "Law study", body: "Time for your law study block." },
  { hour: 23, minute: 59, title: "Evening review", body: "Wrap up the day with your evening review." }
];

let reminderTimeouts = [];
let reminderRolloverTimeout = null;

function setReminderBanner(message = "") {
  const element = document.getElementById("reminder-banner");
  if (!element) {
    return;
  }
  if (!message) {
    element.hidden = true;
    element.textContent = "";
    return;
  }
  element.hidden = false;
  element.textContent = message;
}

function clearReminderTimers() {
  reminderTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  reminderTimeouts = [];
  if (reminderRolloverTimeout) {
    window.clearTimeout(reminderRolloverTimeout);
    reminderRolloverTimeout = null;
  }
}

function nextDelay(hour, minute) {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  const delay = target.getTime() - now.getTime();
  return delay > 0 ? delay : null;
}

function delayUntilTomorrow() {
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 5, 0);
  return tomorrow.getTime() - now.getTime();
}

function sendReminderNotification(title, body) {
  try {
    new Notification(title, { body });
  } catch (error) {
    console.error("[study-system] Failed to send notification", error);
    setReminderBanner("Browser notifications could not be delivered. Keep the dashboard open and use the page reminders instead.");
  }
}

function scheduleReminderTimers() {
  clearReminderTimers();
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  REMINDERS.forEach((reminder) => {
    const delay = nextDelay(reminder.hour, reminder.minute);
    if (delay === null) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      sendReminderNotification(reminder.title, reminder.body);
    }, delay);
    reminderTimeouts.push(timeoutId);
  });

  reminderRolloverTimeout = window.setTimeout(() => {
    scheduleReminderTimers();
  }, delayUntilTomorrow());
}

async function initializeNotifications() {
  if (!("Notification" in window)) {
    setReminderBanner("Browser notifications are not supported here. Morning, afternoon, and evening reminders will need to be checked inside the page.");
    return;
  }

  if (Notification.permission === "granted") {
    setReminderBanner("");
    scheduleReminderTimers();
    return;
  }

  if (Notification.permission === "denied") {
    setReminderBanner("Notifications are blocked in this browser. Keep the dashboard open and use the in-page reminders instead.");
    return;
  }

  const requestedBefore = window.localStorage.getItem(NOTIFICATION_PREF_KEY) === "true";
  if (!requestedBefore) {
    window.localStorage.setItem(NOTIFICATION_PREF_KEY, "true");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setReminderBanner("");
        scheduleReminderTimers();
        return;
      }
    } catch (error) {
      console.error("[study-system] Notification permission request failed", error);
    }
  }

  setReminderBanner("Enable browser notifications to get reminders for IELTS, law study, and evening review. If blocked, keep this page open as a reminder hub.");
}

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

function formatTimeLabel(isoString) {
  if (!isoString) {
    return null;
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(isoString));
}

async function bootstrap() {
  const config = await loadConfig();
  const store = createStore();
  const planner = createPlanner(config, store);
  const currentDate = todayKey();
  const feedbackState = {
    tracking: null,
    review: null
  };

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
    const priority = buildPriorityOverview({
      store,
      plan,
      currentDate,
      overview
    });

    showDateChip(document.getElementById("date-chip"), plan);
    renderProgressOverview({
      container: document.getElementById("progress-overview"),
      overview,
      priority
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
      lastUpdatedAt: formatTimeLabel(store.getTrackingMeta(currentDate)?.updatedAt),
      saveFeedback: feedbackState.tracking,
      lawSubjects: plan.law?.subjects ?? [],
      onSubmit: (payload) => {
        const result = store.saveTracking(currentDate, payload);
        feedbackState.tracking = result.changed ? "Updated today's daily tracking" : "No changes to save";
        planner.ensureDay(currentDate, { forceRefresh: true });
        refresh();
      }
    });

    renderReviewForm({
      container: document.getElementById("review-form"),
      review: store.getReview(currentDate),
      lastUpdatedAt: formatTimeLabel(store.getReviewMeta(currentDate)?.updatedAt),
      saveFeedback: feedbackState.review,
      checklist: config.reviewChecklist,
      onSubmit: (payload) => {
        const result = store.saveReview(currentDate, payload);
        feedbackState.review = result.changed ? "Updated today's evening review" : "No changes to save";
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
  initializeNotifications();
}

bootstrap().catch((error) => {
  document.body.innerHTML = `<main class="app-shell"><section class="panel"><h2>App failed to load</h2><p class="muted">${error.message}</p></section></main>`;
});
