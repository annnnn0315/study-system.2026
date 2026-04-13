function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

export function showDateChip(element, plan) {
  element.textContent = `${plan.label} · ${plan.progress.phase}`;
}

export function renderProgressOverview({ container, overview }) {
  const { ielts, law, formatPercent } = overview;
  const subscore = (label, value) => `
    <div class="progress-metric">
      <span class="mini-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
  const listeningText = ielts.listeningEnough && ielts.subscores.listening !== null ? ielts.subscores.listening.toFixed(1) : "Not enough data yet";
  const readingText = ielts.readingEnough && ielts.subscores.reading !== null ? ielts.subscores.reading.toFixed(1) : "Not enough data yet";
  const speakingText = ielts.speakingEnough && ielts.subscores.speaking !== null ? ielts.subscores.speaking.toFixed(1) : "Not enough data yet";
  const writingText =
    ielts.writingState === "set" || ielts.subscores.writing === null ? "Set writing estimate" : ielts.subscores.writing.toFixed(1);
  const lawSubjectsMarkup = law.subjects.length
    ? law.subjects
        .map(
          (subject) => `
            <div class="progress-metric">
              <span class="mini-label">${escapeHtml(subject.name)}</span>
              <strong>${subject.completedToday ? "Completed today" : "Not completed today"}</strong>
              <span class="muted">${subject.weeklyCompletionRate === null ? "Weekly completion: Not enough data yet" : `Weekly completion: ${formatPercent(subject.weeklyCompletionRate)}`}</span>
            </div>
          `
        )
        .join("")
    : '<p class="empty-state">No law subjects configured for the current stage.</p>';
  const currentLawSubjectsLine =
    law.subjects.length
      ? law.subjects.map((subject) => subject.name).join(" + ")
      : law.stageName;

  container.innerHTML = `
    <div class="overview-grid">
      <div class="summary-card">
        <p class="mini-label">Estimated IELTS Progress</p>
        <h3>Estimated overall band: ${ielts.overallBand === null ? "Not enough data yet" : escapeHtml(ielts.overallBand.toFixed(1))}</h3>
        <p class="muted">Target band: ${ielts.targetBand.toFixed(1)} · Trend tracking only, not an official score.</p>
        <div class="progress-track">
          <div class="progress-fill" style="width:${ielts.progressPercent}%"></div>
        </div>
        <div class="progress-score-grid">
          ${subscore("Listening", listeningText)}
          ${subscore("Reading", readingText)}
          ${subscore("Writing", writingText)}
          ${subscore("Speaking", speakingText)}
        </div>
      </div>

      <div class="summary-card">
        <p class="mini-label">Law Exam Progress</p>
        <h3>${escapeHtml(currentLawSubjectsLine)}</h3>
        <p class="muted">${escapeHtml(law.stageName)}</p>
        <div class="progress-block">
          <p class="muted">Current stage progress: ${formatPercent(law.stageProgress)}</p>
          <div class="progress-track">
            <div class="progress-fill" style="width:${law.stageProgress}%"></div>
          </div>
        </div>
        <div class="progress-block">
          <p class="muted">Overall study-plan progress: ${formatPercent(law.overallProgress)}</p>
          <div class="progress-track">
            <div class="progress-fill" style="width:${law.overallProgress}%"></div>
          </div>
        </div>
        <div class="progress-score-grid">
          ${lawSubjectsMarkup}
        </div>
      </div>
    </div>
  `;
}

export function renderTodayDashboard({ container, plan, onToggleTask }) {
  const progress = plan.progress;
  const adjustmentMarkup = plan.adjustments.length
    ? plan.adjustments
        .map(
          (item) => `
            <div class="adjustment-item">
              <div>
                <strong>${escapeHtml(item.reason)}</strong>
                <p class="mini-note">${escapeHtml(item.note)}</p>
              </div>
            </div>
          `
        )
        .join("")
    : '<p class="empty-state">No special adjustment today. Stay on the core structure.</p>';

  const carryMarkup = plan.carryOver.length
    ? plan.carryOver
        .map(
          (task) => `
            <div class="carry-item">
              <div>
                <strong>${escapeHtml(task.title)}</strong>
                <p class="mini-note">${escapeHtml(task.detail)}</p>
                <p class="mini-note warning">From ${escapeHtml(task.carriedFrom)}</p>
              </div>
            </div>
          `
        )
        .join("")
    : '<p class="empty-state">No missed IELTS tasks carried over.</p>';

  container.innerHTML = `
    <div class="today-layout">
      <div class="today-column">
        <div class="progress-box">
          <p class="mini-label">Progress</p>
          <h3>${progress.completedCount}/${progress.totalCount} IELTS tasks complete</h3>
          <div class="progress-track">
            <div class="progress-fill" style="width:${progress.completion}%"></div>
          </div>
          <div class="tag-row">
            <span class="pill success">${progress.completion}% today</span>
            <span class="pill">${progress.examCountdown} days to exam</span>
            ${plan.busyProfile ? `<span class="pill warning">${escapeHtml(plan.busyProfile.label)}</span>` : ""}
          </div>
        </div>

        <div class="metric-card">
          <p class="mini-label">IELTS Morning Block</p>
          <h3 class="section-title">Detailed tasks for today</h3>
          <div class="task-list" id="task-list"></div>
        </div>
      </div>

      <div class="today-column">
        <div class="subject-card">
          <p class="mini-label">Law Afternoon Block</p>
          <h3>${escapeHtml(plan.law.subjectLabel ?? plan.law.subject)}</h3>
          <p class="muted">${escapeHtml(plan.law.stage)} stage · ${plan.law.hours}h target</p>
        </div>

        <div class="metric-card">
          <p class="mini-label">Missed Tasks</p>
          ${carryMarkup}
        </div>

        <div class="metric-card">
          <p class="mini-label">Adaptive Adjustments</p>
          <div class="adjustment-list">${adjustmentMarkup}</div>
        </div>
      </div>
    </div>
  `;

  const taskList = container.querySelector("#task-list");
  const template = document.getElementById("task-item-template");

  plan.ieltsTasks.forEach((task) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const checkbox = node.querySelector(".task-checkbox");
    checkbox.checked = Boolean(task.completed);
    checkbox.addEventListener("change", () => onToggleTask(task.id, checkbox.checked));
    node.querySelector(".task-title").textContent = task.title;
    node.querySelector(".task-detail").textContent = task.detail;
    node.querySelector(".task-meta").textContent =
      task.source === "core" ? task.phaseNote : `${task.source} · ${task.phaseNote ?? "extra"}`;
    taskList.appendChild(node);
  });
}

function createInputGroup({ label, name, type = "text", value = "", placeholder = "" }) {
  if (type === "textarea") {
    return `
      <div class="input-group">
        <label for="${name}">${label}</label>
        <textarea id="${name}" name="${name}" placeholder="${placeholder}">${escapeHtml(value)}</textarea>
      </div>
    `;
  }

  if (type === "select") {
    return `
      <div class="input-group">
        <label for="${name}">${label}</label>
        <select id="${name}" name="${name}">
          <option value="">Select</option>
          <option value="yes" ${value === "yes" ? "selected" : ""}>Yes</option>
          <option value="no" ${value === "no" ? "selected" : ""}>No</option>
        </select>
      </div>
    `;
  }

  if (type === "band-select") {
    const options = ["", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"];
    return `
      <div class="input-group">
        <label for="${name}">${label}</label>
        <select id="${name}" name="${name}">
          ${options
            .map((option) =>
              option === ""
                ? `<option value="">Select</option>`
                : `<option value="${option}" ${String(value) === option ? "selected" : ""}>${option}</option>`
            )
            .join("")}
        </select>
      </div>
    `;
  }

  return `
    <div class="input-group">
      <label for="${name}">${label}</label>
      <input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${placeholder}" />
    </div>
  `;
}

function formToObject(form) {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

export function renderTrackingForm({ container, tracking, lawSubjects = [], onSubmit }) {
  const lawCompletionMap = normalizeLawCompletionMap(tracking.lawCompletedToday, lawSubjects);
  container.innerHTML = `
    <div class="form-grid">
      ${createInputGroup({
        label: "Listening accuracy (%)",
        name: "listeningAccuracy",
        type: "number",
        value: tracking.listeningAccuracy ?? "",
        placeholder: "e.g. 78"
      })}
      ${createInputGroup({
        label: "Reading accuracy (%)",
        name: "readingAccuracy",
        type: "number",
        value: tracking.readingAccuracy ?? "",
        placeholder: "e.g. 82"
      })}
      ${createInputGroup({
        label: "Writing completed",
        name: "writingCompleted",
        type: "select",
        value: tracking.writingCompleted ?? ""
      })}
      ${createInputGroup({
        label: "Manual writing band",
        name: "manualWritingBand",
        type: "band-select",
        value: tracking.manualWritingBand ?? "",
        placeholder: "e.g. 6.5"
      })}
      ${createInputGroup({
        label: "Speaking fluency (1-5)",
        name: "speakingFluency",
        type: "number",
        value: tracking.speakingFluency ?? "",
        placeholder: "e.g. 3"
      })}
      ${createInputGroup({
        label: "Law MCQ accuracy (%)",
        name: "lawAccuracy",
        type: "number",
        value: tracking.lawAccuracy ?? "",
        placeholder: "e.g. 68"
      })}
      <div class="input-group">
        <label>Law subjects completed today</label>
        <div class="checkbox-stack">
          ${
            lawSubjects.length
              ? lawSubjects
                  .map(
                    (subject, index) => `
                      <label class="checkbox-item">
                        <input
                          type="checkbox"
                          name="lawCompletedToday__${index}"
                          data-law-subject="${escapeHtml(subject)}"
                          ${lawCompletionMap[subject] ? "checked" : ""}
                        />
                        <span>${escapeHtml(subject)}</span>
                      </label>
                    `
                  )
                  .join("")
              : '<p class="muted">No law subjects available for today.</p>'
          }
        </div>
      </div>
      ${createInputGroup({
        label: "Topics completed",
        name: "lawTopicsCompleted",
        type: "text",
        value: tracking.lawTopicsCompleted ?? "",
        placeholder: "e.g. constitutional review, civil obligations"
      })}
      ${createInputGroup({
        label: "Mistake count",
        name: "lawMistakeCount",
        type: "number",
        value: tracking.lawMistakeCount ?? "",
        placeholder: "e.g. 17"
      })}
      ${createInputGroup({
        label: "Weak areas",
        name: "lawWeakAreas",
        type: "textarea",
        value: tracking.lawWeakAreas ?? "",
        placeholder: "One weak topic per line"
      })}
    </div>
    <button class="primary-button" type="submit">Save daily tracking</button>
  `;

  container.onsubmit = (event) => {
    event.preventDefault();
    const payload = formToObject(container);
    const lawCompletedToday = {};
    container.querySelectorAll("[data-law-subject]").forEach((input) => {
      lawCompletedToday[input.dataset.lawSubject] = input.checked;
    });
    payload.lawCompletedToday = lawCompletedToday;
    onSubmit(payload);
  };
}

export function renderReviewForm({ container, review, checklist, onSubmit }) {
  const sections = Array.isArray(checklist?.sections) ? checklist.sections : [];
  const chips = sections.flatMap((section) => section.items.map((item) => item.label));
  const fieldsMarkup = sections
    .map((section) =>
      section.items
        .map((item) =>
          createInputGroup({
            label: `${section.title}: ${item.label}`,
            name: item.field,
            type: "textarea",
            value: review[item.field] ?? "",
            placeholder: "One item per line"
          })
        )
        .join("")
    )
    .join("");

  container.innerHTML = `
    <div class="tag-row">
      ${chips.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
    </div>
    ${fieldsMarkup}
    <button class="primary-button" type="submit">Save evening review</button>
  `;

  container.onsubmit = (event) => {
    event.preventDefault();
    onSubmit(formToObject(container));
  };
}
