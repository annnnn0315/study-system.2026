const STORAGE_KEY = "study-system-state-v1";

function defaultState() {
  return {
    plans: {},
    tracking: {},
    reviews: {},
    trackingMeta: {},
    reviewMeta: {}
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

  if (!state.trackingMeta) {
    state.trackingMeta = {};
  }
  if (!state.reviewMeta) {
    state.reviewMeta = {};
  }

  const persist = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const isBlankValue = (value) => {
    return value === "" || value === null || value === undefined;
  };

  const mergeEntries = (existing, incoming) => {
    const base = existing && typeof existing === "object" ? { ...existing } : {};
    let changed = false;

    Object.entries(incoming ?? {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const existingObject =
          base[key] && typeof base[key] === "object" && !Array.isArray(base[key]) ? { ...base[key] } : {};
        let objectChanged = false;

        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          if (existingObject[nestedKey] !== nestedValue) {
            existingObject[nestedKey] = nestedValue;
            objectChanged = true;
          }
        });

        if (objectChanged || !base[key]) {
          base[key] = existingObject;
          changed = true;
        }
        return;
      }

      if (isBlankValue(value)) {
        return;
      }

      if (base[key] !== value) {
        base[key] = value;
        changed = true;
      }
    });

    return { merged: base, changed };
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
    getTrackingMeta(date) {
      return state.trackingMeta[date] ?? null;
    },
    saveTracking(date, tracking) {
      const previous = state.tracking[date] ?? {};
      const { merged, changed } = mergeEntries(previous, tracking);
      state.tracking[date] = merged;
      if (changed) {
        state.trackingMeta[date] = {
          updatedAt: new Date().toISOString()
        };
      }
      persist();
      return {
        changed,
        updatedAt: state.trackingMeta[date]?.updatedAt ?? null
      };
    },
    getReview(date) {
      return state.reviews[date] ?? {};
    },
    getReviewMeta(date) {
      return state.reviewMeta[date] ?? null;
    },
    saveReview(date, review) {
      const previous = state.reviews[date] ?? {};
      const { merged, changed } = mergeEntries(previous, review);
      state.reviews[date] = merged;
      if (changed) {
        state.reviewMeta[date] = {
          updatedAt: new Date().toISOString()
        };
      }
      persist();
      return {
        changed,
        updatedAt: state.reviewMeta[date]?.updatedAt ?? null
      };
    },
    getState() {
      return state;
    }
  };
}
