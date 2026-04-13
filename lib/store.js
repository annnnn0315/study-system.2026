const STORAGE_KEY = "study-system-state-v1";

function defaultState() {
  return {
    plans: {},
    tracking: {},
    reviews: {}
  };
}

function readState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultState();
  } catch (_error) {
    return defaultState();
  }
}

export function createStore() {
  let state = readState();

  const persist = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  return {
    getPlan(date) {
      return state.plans[date] ?? null;
    },
    savePlan(date, plan) {
      state.plans[date] = plan;
      persist();
    },
    getTracking(date) {
      return state.tracking[date] ?? {};
    },
    saveTracking(date, tracking) {
      state.tracking[date] = tracking;
      persist();
    },
    getReview(date) {
      return state.reviews[date] ?? {};
    },
    saveReview(date, review) {
      state.reviews[date] = review;
      persist();
    },
    getState() {
      return state;
    }
  };
}
