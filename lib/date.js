function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(dateString) {
  const date = parseLocalDate(dateString);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function addDays(dateString, offset) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + offset);
  return toLocalDateKey(date);
}

export function dateInRange(dateString, start, end) {
  return dateString >= start && dateString <= end;
}

export function diffDays(start, end) {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  const ms = endDate - startDate;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
