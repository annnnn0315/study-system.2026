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
const NOTIFICATION_STATE_KEY = "study-system-notification-state-v1";
const THEME_MODE_KEY = "study-system-theme-mode-v1";
const AUTH_KEY = "study-system-authenticated-v3";
const REMINDERS = [
  { key: "law", hour: 9, minute: 0, title: "Law session", body: "Start your law study block" },
  { key: "ielts", hour: 14, minute: 0, title: "IELTS session", body: "Start your IELTS tasks for today" },
  { key: "review", hour: 23, minute: 50, title: "Evening review", body: "Complete your daily review" }
];

let reminderIntervalId = null;
let activeReminderBannerTimeout = null;
let themeIntervalId = null;
let activeThemeCoords = null;
let appStarted = false;
const appRuntime = {
  planner: null,
  currentDate: null,
  refresh: null,
  isRegeneratingToday: false
};

function setRegenerateButtonState(disabled) {
  const button = document.getElementById("reset-today");
  if (!button) {
    return;
  }
  button.disabled = disabled;
  button.setAttribute("aria-disabled", String(disabled));
}

function handleRegenerateTodayClick(event) {
  console.debug("[study-system] Regenerate Today handler entered", {
    eventType: event?.type ?? null,
    date: appRuntime.currentDate,
    isRegeneratingToday: appRuntime.isRegeneratingToday,
    hasPlanner: Boolean(appRuntime.planner),
    hasRefresh: Boolean(appRuntime.refresh)
  });

  if (event) {
    event.preventDefault();
  }

  if (!appRuntime.planner || !appRuntime.currentDate || !appRuntime.refresh) {
    console.warn("[study-system] Regenerate Today aborted: runtime not ready", {
      date: appRuntime.currentDate,
      hasPlanner: Boolean(appRuntime.planner),
      hasRefresh: Boolean(appRuntime.refresh)
    });
    return;
  }

  if (appRuntime.isRegeneratingToday) {
    console.warn("[study-system] Regenerate Today aborted: already regenerating");
    return;
  }

  appRuntime.isRegeneratingToday = true;
  setRegenerateButtonState(true);

  try {
    const regeneratedPlan = appRuntime.planner.resetDay(appRuntime.currentDate);
    console.debug("[study-system] Regenerate Today rebuilt plan", {
      date: appRuntime.currentDate,
      ieltsTasks: regeneratedPlan.ieltsTasks?.length ?? 0,
      lawTasks: regeneratedPlan.lawTasks?.length ?? 0,
      carryOverTasks: regeneratedPlan.carryOverTasks?.length ?? 0
    });
    appRuntime.refresh();
  } catch (error) {
    console.error("[study-system] Regenerate Today failed", error);
  } finally {
    appRuntime.isRegeneratingToday = false;
    setRegenerateButtonState(false);
    console.debug("[study-system] Regenerate Today finished", {
      date: appRuntime.currentDate,
      isRegeneratingToday: appRuntime.isRegeneratingToday,
      buttonDisabled: document.getElementById("reset-today")?.disabled ?? null
    });
  }
}

function bindResetTodayButton() {
  const button = document.getElementById("reset-today");
  if (!button) {
    console.warn("[study-system] Regenerate Today button not found during bind");
    return;
  }

  if (button.dataset.regenerateBound === "true") {
    return;
  }

  button.dataset.regenerateBound = "true";
  button.addEventListener("click", handleRegenerateTodayClick);
  console.debug("[study-system] Regenerate Today button bound");
}

function isAuthenticated() {
  return window.sessionStorage.getItem(AUTH_KEY) === "true";
}

function readThemeMode() {
  const stored = window.localStorage.getItem(THEME_MODE_KEY);
  if (stored === "light" || stored === "dark" || stored === "auto") {
    return stored;
  }
  return "auto";
}

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

function calculateSunset(date, latitude, longitude) {
  const dayOfYear = getDayOfYear(date);
  const lngHour = longitude / 15;
  const approxTime = dayOfYear + ((18 - lngHour) / 24);
  const meanAnomaly = (0.9856 * approxTime) - 3.289;
  const trueLongitude =
    (meanAnomaly +
      (1.916 * Math.sin((meanAnomaly * Math.PI) / 180)) +
      (0.02 * Math.sin((2 * meanAnomaly * Math.PI) / 180)) +
      282.634 +
      360) %
    360;
  const rightAscensionRaw = (Math.atan(0.91764 * Math.tan((trueLongitude * Math.PI) / 180)) * 180) / Math.PI;
  const rightAscension =
    ((rightAscensionRaw + 360) % 360 +
      (Math.floor(trueLongitude / 90) * 90 - Math.floor(((rightAscensionRaw + 360) % 360) / 90) * 90)) /
    15;
  const sinDeclination = 0.39782 * Math.sin((trueLongitude * Math.PI) / 180);
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosHourAngle =
    (Math.cos((90.833 * Math.PI) / 180) -
      sinDeclination * Math.sin((latitude * Math.PI) / 180)) /
    (cosDeclination * Math.cos((latitude * Math.PI) / 180));

  if (cosHourAngle < -1 || cosHourAngle > 1) {
    return null;
  }

  const hourAngle = (Math.acos(cosHourAngle) * 180) / Math.PI / 15;
  const localMeanTime = hourAngle + rightAscension - (0.06571 * approxTime) - 6.622;
  const universalTime = (localMeanTime - lngHour + 24) % 24;
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  return new Date(utcMidnight + universalTime * 60 * 60 * 1000);
}

function getFallbackDarkMode(now) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 18 * 60 + 30 || minutes < 6 * 60 + 30;
}

function applyTheme(mode, isDark) {
  document.body.classList.toggle("theme-dark", isDark);
  document.body.dataset.themeMode = mode;
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  const select = document.getElementById("theme-mode");
  if (select && select.value !== mode) {
    select.value = mode;
  }
}

function evaluateAutoTheme(coords) {
  const now = new Date();
  if (coords) {
    const sunset = calculateSunset(now, coords.latitude, coords.longitude);
    if (sunset) {
      return now >= sunset;
    }
  }
  return getFallbackDarkMode(now);
}

function updateTheme(coords) {
  activeThemeCoords = coords ?? activeThemeCoords ?? getStoredCoords();
  const mode = readThemeMode();
  const isDark = mode === "dark" ? true : mode === "light" ? false : evaluateAutoTheme(activeThemeCoords);
  applyTheme(mode, isDark);
}

function startThemeWatcher(coords) {
  if (themeIntervalId) {
    window.clearInterval(themeIntervalId);
  }
  activeThemeCoords = coords ?? activeThemeCoords ?? getStoredCoords();
  updateTheme(activeThemeCoords);
  themeIntervalId = window.setInterval(() => updateTheme(activeThemeCoords), 5 * 60 * 1000);
}

function getStoredCoords() {
  try {
    const raw = window.localStorage.getItem("study-system-geo-v1");
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function storeCoords(coords) {
  window.localStorage.setItem("study-system-geo-v1", JSON.stringify(coords));
}

function initializeThemeControl() {
  const select = document.getElementById("theme-mode");
  if (!select) {
    return;
  }
  select.value = readThemeMode();
  select.addEventListener("change", () => {
    window.localStorage.setItem(THEME_MODE_KEY, select.value);
    updateTheme(activeThemeCoords ?? getStoredCoords());
  });
}

function initializeTheme() {
  const storedCoords = getStoredCoords();
  startThemeWatcher(storedCoords);

  if (!("geolocation" in navigator) || !navigator.permissions) {
    return;
  }

  navigator.permissions
    .query({ name: "geolocation" })
    .then((result) => {
      if (result.state !== "granted") {
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          storeCoords(coords);
          activeThemeCoords = coords;
          startThemeWatcher(coords);
        },
        () => {
          startThemeWatcher(storedCoords);
        },
        { maximumAge: 6 * 60 * 60 * 1000, timeout: 5000 }
      );
    })
    .catch(() => {
      startThemeWatcher(storedCoords);
    });
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function truncateReminderText(text, maxLength = 90) {
  const value = String(text ?? "").trim();
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function showTriggeredReminderBanner(title, body) {
  const suffix = body ? ` — ${body}` : "";
  setReminderBanner(`Now: ${title}${suffix}`);
  if (activeReminderBannerTimeout) {
    window.clearTimeout(activeReminderBannerTimeout);
  }
  activeReminderBannerTimeout = window.setTimeout(() => {
    if (Notification.permission === "denied") {
      setReminderBanner("Notifications are blocked in this browser. Keep the dashboard open and use the in-page reminders instead.");
    } else if (!("Notification" in window)) {
      setReminderBanner("Browser notifications are not supported here. Morning, afternoon, and evening reminders will need to be checked inside the page.");
    } else {
      setReminderBanner("");
    }
  }, 5 * 60 * 1000);
}

function readNotificationState() {
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
}

function writeNotificationState(state) {
  window.localStorage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify(state));
}

function sendReminderNotification(title, body) {
  try {
    new Notification(title, { body });
  } catch (error) {
    console.error("[study-system] Failed to send notification", error);
    setReminderBanner("Browser notifications could not be delivered. Keep the dashboard open and use the page reminders instead.");
  }
}

function buildReminderContent(planner, dateString) {
  const plan = planner.ensureDay(dateString);
  const plannedIeltsTasks = plan.plannedIeltsTasks ?? [];
  const ieltsTaskText = plannedIeltsTasks.length
    ? truncateReminderText(plannedIeltsTasks.map((task) => task.title).join(" + "))
    : "Open dashboard to view today's IELTS tasks";
  const lawSubjectText = plan.law?.subjects?.length
    ? truncateReminderText(plan.law.subjects.join(" + "))
    : "Open dashboard to view today's law tasks";

  return {
    law: {
      title: "Law session",
      body: plan.law?.subjects?.length
        ? `Today's law focus: ${lawSubjectText}`
        : "Open dashboard to view today's law tasks"
    },
    ielts: {
      title: "IELTS session",
      body: plannedIeltsTasks.length
        ? `Today's IELTS: ${ieltsTaskText}`
        : "Open dashboard to view today's IELTS tasks"
    },
    review: {
      title: "Evening review",
      body: "Complete your daily tracking and evening review"
    }
  };
}

function clearReminderChecker() {
  if (reminderIntervalId) {
    window.clearInterval(reminderIntervalId);
    reminderIntervalId = null;
  }
}

function getDailyReminderState() {
  const state = readNotificationState();
  const today = localDateKey();
  if (!state[today]) {
    state[today] = {};
    writeNotificationState(state);
  }
  return { state, today, todayState: state[today] };
}

function checkReminderSchedule(planner) {
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const today = localDateKey(now);
  const { state, todayState } = getDailyReminderState();
  const reminderContent = buildReminderContent(planner, today);

  REMINDERS.forEach((reminder) => {
    if (todayState[reminder.key]) {
      return;
    }
    if (currentHours === reminder.hour && currentMinutes === reminder.minute) {
      const content = reminderContent[reminder.key] ?? reminder;
      todayState[reminder.key] = true;
      state[today] = todayState;
      writeNotificationState(state);
      showTriggeredReminderBanner(content.title, content.body);
      if ("Notification" in window && Notification.permission === "granted") {
        sendReminderNotification(content.title, content.body);
      }
    }
  });
}

function startReminderChecker(planner) {
  clearReminderChecker();
  checkReminderSchedule(planner);
  reminderIntervalId = window.setInterval(() => checkReminderSchedule(planner), 30 * 1000);
}

async function initializeNotifications(planner) {
  if (!("Notification" in window)) {
    setReminderBanner("Browser notifications are not supported here. Morning, afternoon, and evening reminders will need to be checked inside the page.");
    startReminderChecker(planner);
    return;
  }

  if (Notification.permission === "granted") {
    setReminderBanner("");
    startReminderChecker(planner);
    return;
  }

  if (Notification.permission === "denied") {
    setReminderBanner("Notifications are blocked in this browser. Keep the dashboard open and use the in-page reminders instead.");
    startReminderChecker(planner);
    return;
  }

  const requestedBefore = window.localStorage.getItem(NOTIFICATION_PREF_KEY) === "true";
  if (!requestedBefore) {
    window.localStorage.setItem(NOTIFICATION_PREF_KEY, "true");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setReminderBanner("");
        startReminderChecker(planner);
        return;
      }
    } catch (error) {
      console.error("[study-system] Notification permission request failed", error);
    }
  }

  setReminderBanner("Enable browser notifications to get reminders for IELTS, law study, and evening review. If blocked, keep this page open as a reminder hub.");
  startReminderChecker(planner);
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
  if (appStarted) {
    return;
  }
  appStarted = true;
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
        const lawTask = (plan.lawTasks ?? []).find((task) => task.id === taskId);
        if (lawTask) {
          const existingTracking = store.getTracking(currentDate);
          const previousMap =
            existingTracking.lawCompletedToday &&
            typeof existingTracking.lawCompletedToday === "object" &&
            !Array.isArray(existingTracking.lawCompletedToday)
              ? existingTracking.lawCompletedToday
              : {};
          store.saveTracking(currentDate, {
            lawCompletedToday: {
              ...previousMap,
              [lawTask.title]: completed
            }
          });
        }
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
    bindResetTodayButton();
  };

  appRuntime.planner = planner;
  appRuntime.currentDate = currentDate;
  appRuntime.refresh = refresh;

  refresh();
  initializeThemeControl();
  initializeTheme();
  initializeNotifications(planner);
}

function handleBootstrapError(error) {
  document.body.innerHTML = `<main class="app-shell"><section class="panel"><h2>App failed to load</h2><p class="muted">${error.message}</p></section></main>`;
}

function initializeAppGate() {
  if (isAuthenticated()) {
    bootstrap().catch(handleBootstrapError);
    return;
  }

  window.addEventListener(
    "study-system:authenticated",
    () => {
      bootstrap().catch(handleBootstrapError);
    },
    { once: true }
  );
}

initializeAppGate();
