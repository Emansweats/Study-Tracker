const ACCENTS = {
  blue: { line: '#4f8ff0', fill: 'rgba(79,143,240,0.18)' },
  coral: { line: '#ef7a52', fill: 'rgba(239,122,82,0.18)' },
  green: { line: '#5cc38a', fill: 'rgba(92,195,138,0.18)' },
};

const TIERS = {
  bronze: { label: 'Bronze' },
  silver: { label: 'Silver' },
  gold: { label: 'Gold' },
};

function tierFor(score) {
  if (score >= 80) return 'gold';
  if (score >= 60) return 'silver';
  return 'bronze';
}

const STORAGE_KEY = 'study-tracker-state-v1';
const GH_SETTINGS_KEY = 'study-tracker-gh-settings-v1';
const charts = {};
const historyCharts = {};
const timers = {};

let state = null;

async function loadState() {
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) return JSON.parse(cached);
  const res = await fetch('data/data.json');
  const fresh = await res.json();
  Object.values(fresh.subjects).forEach((s) => {
    if (!s.history) s.history = [];
    if (!s.pastPapers) s.pastPapers = [];
  });
  return fresh;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  setStatus('Saved to this browser', false);
}

function setStatus(msg, unsaved) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.classList.toggle('unsaved', !!unsaved);
}

function overallScore(topics) {
  return Math.round(topics.reduce((sum, t) => sum + t.score, 0) / topics.length);
}

function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function formatTimer(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function snapshotHistory(key, subject) {
  const today = todayISO();
  const score = overallScore(subject.topics);
  const existing = subject.history.find((h) => h.date === today);
  if (existing) {
    existing.score = score;
  } else {
    subject.history.push({ date: today, score });
  }
  subject.history.sort((a, b) => a.date.localeCompare(b.date));
  if (historyCharts[key]) {
    historyCharts[key].data.labels = subject.history.map((h) => h.date.slice(5));
    historyCharts[key].data.datasets[0].data = subject.history.map((h) => h.score);
    historyCharts[key].update();
  }
}

function pastPaperAvg(subject) {
  if (!subject.pastPapers.length) return null;
  const total = subject.pastPapers.reduce((sum, p) => sum + (p.marks / p.total) * 100, 0);
  return Math.round(total / subject.pastPapers.length);
}

function renderPastPapers(key, subject) {
  const list = document.getElementById(`papers-list-${key}`);
  const sorted = [...subject.pastPapers].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = sorted.length
    ? sorted.map((p) => {
        const pct = Math.round((p.marks / p.total) * 100);
        const mark = pct >= 70 ? 'pass' : 'flag';
        return `
          <div class="paper-row" data-id="${p.id}">
            <div class="paper-main">
              <span class="paper-name">${escapeHTML(p.name)}</span>
              <span class="paper-date">${p.date}</span>
            </div>
            <span class="paper-score">${p.marks}/${p.total} <span class="paper-pct ${mark}">${pct}%</span></span>
            <button class="paper-del" data-action="delete-paper" data-subject="${key}" data-id="${p.id}" aria-label="Delete ${escapeHTML(p.name)}">&times;</button>
          </div>
          ${p.notes ? `<p class="paper-notes">${escapeHTML(p.notes)}</p>` : ''}
        `;
      }).join('')
    : '<p class="paper-empty">No past papers logged yet.</p>';

  const avg = pastPaperAvg(subject);
  document.getElementById(`papers-avg-${key}`).textContent = avg === null ? '—' : `${avg}%`;
  document.getElementById(`papers-count-${key}`).textContent = subject.pastPapers.length;

  if (charts[`papers-${key}`]) {
    const ordered = [...subject.pastPapers].sort((a, b) => a.date.localeCompare(b.date));
    charts[`papers-${key}`].data.labels = ordered.map((p) => p.date.slice(5));
    charts[`papers-${key}`].data.datasets[0].data = ordered.map((p) => Math.round((p.marks / p.total) * 100));
    charts[`papers-${key}`].update();
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function buildSubjectCard(key, subject) {
  const accent = ACCENTS[subject.accent];
  const card = document.createElement('section');
  card.className = 'card';
  card.dataset.accent = subject.accent;
  const startTier = tierFor(overallScore(subject.topics));
  card.dataset.tier = startTier;
  card.innerHTML = `
    <div class="folder-tab">${subject.name.replace('Advanced Higher ', '').slice(0, 1)}</div>
    <div class="card-head">
      <div>
        <p class="course-label">Advanced Higher</p>
        <h2>${subject.name.replace('Advanced Higher ', '')}</h2>
      </div>
      <div class="rating-badge" id="badge-${key}">
        <span class="rating-num">${overallScore(subject.topics)}</span>
        <span class="rating-tier">${TIERS[startTier].label}</span>
      </div>
    </div>
    <div class="card-body">
      <div class="chart-wrap">
        <canvas id="chart-${key}" role="img" aria-label="Radar chart of ${subject.name} topic skill levels"></canvas>
      </div>
      <div class="topics" id="topics-${key}"></div>
    </div>

    <div class="subsection">
      <div class="subsection-head">
        <h3>Progress over time</h3>
      </div>
      <div class="chart-wrap small">
        <canvas id="history-${key}" role="img" aria-label="Line chart of ${subject.name} overall score over time"></canvas>
      </div>
    </div>

    <div class="tracker">
      <div class="timer-display" id="timer-${key}">00:00</div>
      <div class="tracker-controls">
        <button data-action="toggle" data-subject="${key}" class="primary-${subject.accent}">Start</button>
        <button data-action="reset" data-subject="${key}">Reset timer</button>
      </div>
      <div class="manual-log">
        <span>Add</span>
        <input type="number" min="1" step="1" id="manual-${key}" placeholder="min" />
        <button data-action="log" data-subject="${key}">Log</button>
      </div>
      <div class="total-time">
        Total studied
        <strong id="total-${key}">${formatMinutes(subject.studyMinutes)}</strong>
      </div>
    </div>

    <div class="subsection">
      <div class="subsection-head">
        <h3>Past papers</h3>
        <div class="paper-stats">
          <span><strong id="papers-count-${key}">${subject.pastPapers.length}</strong> logged</span>
          <span>avg <strong id="papers-avg-${key}">${pastPaperAvg(subject) === null ? '—' : pastPaperAvg(subject) + '%'}</strong></span>
        </div>
      </div>
      <div class="chart-wrap small">
        <canvas id="papers-chart-${key}" role="img" aria-label="Line chart of ${subject.name} past paper percentages over time"></canvas>
      </div>
      <form class="paper-form" data-subject="${key}">
        <input type="text" placeholder="Paper (e.g. 2022 P1)" id="paper-name-${key}" required />
        <input type="date" id="paper-date-${key}" value="${todayISO()}" required />
        <input type="number" min="0" placeholder="Marks" id="paper-marks-${key}" required />
        <input type="number" min="1" placeholder="Out of" id="paper-total-${key}" required />
        <input type="text" placeholder="Notes (optional)" id="paper-notes-${key}" class="paper-notes-input" />
        <button type="submit" class="primary-${subject.accent}">Add paper</button>
      </form>
      <div class="papers-list" id="papers-list-${key}"></div>
    </div>
  `;
  document.getElementById('cards').appendChild(card);

  const topicsWrap = card.querySelector(`#topics-${key}`);
  subject.topics.forEach((topic, i) => {
    const row = document.createElement('div');
    row.className = 'topic-row';
    row.innerHTML = `
      <label for="slider-${key}-${i}">${topic.name}</label>
      <span class="val" id="val-${key}-${i}">${topic.score}</span>
      <input type="range" min="0" max="100" value="${topic.score}" id="slider-${key}-${i}" />
    `;
    topicsWrap.appendChild(row);
    row.querySelector('input').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      subject.topics[i].score = v;
      row.querySelector('.val').textContent = v;
      const overall = overallScore(subject.topics);
      const tier = tierFor(overall);
      card.dataset.tier = tier;
      document.getElementById(`badge-${key}`).querySelector('.rating-num').textContent = overall;
      document.getElementById(`badge-${key}`).querySelector('.rating-tier').textContent = TIERS[tier].label;
      charts[key].data.datasets[0].data = subject.topics.map((t) => t.score);
      charts[key].update();
      snapshotHistory(key, subject);
      setStatus('Unsaved change', true);
      saveState();
    });
  });

  charts[key] = new Chart(document.getElementById(`chart-${key}`), {
    type: 'radar',
    data: {
      labels: subject.topics.map((t) => t.name),
      datasets: [{
        data: subject.topics.map((t) => t.score),
        borderColor: accent.line,
        backgroundColor: accent.fill,
        pointBackgroundColor: accent.line,
        borderWidth: 2,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { display: false },
          pointLabels: { font: { size: 11 }, color: '#9aa4b8' },
          grid: { color: 'rgba(154,164,184,0.15)' },
          angleLines: { color: 'rgba(154,164,184,0.15)' },
        },
      },
    },
  });

  historyCharts[key] = new Chart(document.getElementById(`history-${key}`), {
    type: 'line',
    data: {
      labels: subject.history.map((h) => h.date.slice(5)),
      datasets: [{
        data: subject.history.map((h) => h.score),
        borderColor: accent.line,
        backgroundColor: accent.fill,
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.25,
        fill: true,
      }],
    },
    options: lineOptions(),
  });

  charts[`papers-${key}`] = new Chart(document.getElementById(`papers-chart-${key}`), {
    type: 'line',
    data: {
      labels: subject.pastPapers.map((p) => p.date.slice(5)),
      datasets: [{
        data: subject.pastPapers.map((p) => Math.round((p.marks / p.total) * 100)),
        borderColor: accent.line,
        backgroundColor: accent.fill,
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.25,
        fill: true,
      }],
    },
    options: lineOptions(),
  });

  renderPastPapers(key, subject);

  card.querySelector('.paper-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById(`paper-name-${key}`).value.trim();
    const date = document.getElementById(`paper-date-${key}`).value;
    const marks = Number(document.getElementById(`paper-marks-${key}`).value);
    const total = Number(document.getElementById(`paper-total-${key}`).value);
    const notes = document.getElementById(`paper-notes-${key}`).value.trim();
    if (!name || !date || !total || marks < 0 || marks > total) {
      setStatus('Check the past paper fields — marks must be between 0 and the total', true);
      return;
    }
    subject.pastPapers.push({ id: crypto.randomUUID(), name, date, marks, total, notes });
    renderPastPapers(key, subject);
    e.target.reset();
    document.getElementById(`paper-date-${key}`).value = todayISO();
    setStatus('Unsaved change', true);
    saveState();
  });

  timers[key] = { running: false, startedAt: null, elapsedMs: 0 };
}

function lineOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { min: 0, max: 100, ticks: { color: '#626d82', font: { size: 10 } }, grid: { color: 'rgba(154,164,184,0.1)' } },
      x: { ticks: { color: '#626d82', font: { size: 10 } }, grid: { display: false } },
    },
  };
}

function tickTimers() {
  Object.keys(timers).forEach((key) => {
    const t = timers[key];
    if (t.running) {
      const elapsed = t.elapsedMs + (Date.now() - t.startedAt);
      document.getElementById(`timer-${key}`).textContent = formatTimer(elapsed);
    }
  });
  requestAnimationFrame(tickTimers);
}

function toggleTimer(key) {
  const t = timers[key];
  const btn = document.querySelector(`button[data-action="toggle"][data-subject="${key}"]`);
  if (!t.running) {
    t.running = true;
    t.startedAt = Date.now();
    btn.textContent = 'Pause';
  } else {
    t.elapsedMs += Date.now() - t.startedAt;
    t.running = false;
    btn.textContent = 'Start';
  }
}

function resetTimer(key) {
  timers[key] = { running: false, startedAt: null, elapsedMs: 0 };
  document.getElementById(`timer-${key}`).textContent = '00:00';
  document.querySelector(`button[data-action="toggle"][data-subject="${key}"]`).textContent = 'Start';
}

function logTime(key, minutes) {
  if (!minutes || minutes <= 0) return;
  state.subjects[key].studyMinutes += minutes;
  document.getElementById(`total-${key}`).textContent = formatMinutes(state.subjects[key].studyMinutes);
  setStatus('Unsaved change', true);
  saveState();
}

function logTimerElapsed(key) {
  const t = timers[key];
  let elapsed = t.elapsedMs + (t.running ? Date.now() - t.startedAt : 0);
  const minutes = elapsed / 60000;
  if (minutes < 0.1) return;
  logTime(key, minutes);
  resetTimer(key);
}

function exportData() {
  state.updated = new Date().toISOString();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      state = JSON.parse(e.target.result);
      Object.values(state.subjects).forEach((s) => {
        if (!s.history) s.history = [];
        if (!s.pastPapers) s.pastPapers = [];
      });
      saveState();
      location.reload();
    } catch (err) {
      alert('That file could not be read as valid data.json');
    }
  };
  reader.readAsText(file);
}

// --- Optional: push straight to GitHub via the Contents API ---

function loadGhSettings() {
  const cached = localStorage.getItem(GH_SETTINGS_KEY);
  return cached ? JSON.parse(cached) : { owner: '', repo: '', branch: 'main', path: 'data/data.json', token: '' };
}

function saveGhSettings(settings) {
  localStorage.setItem(GH_SETTINGS_KEY, JSON.stringify(settings));
}

async function pushToGitHub() {
  const settings = {
    owner: document.getElementById('gh-owner').value.trim(),
    repo: document.getElementById('gh-repo').value.trim(),
    branch: document.getElementById('gh-branch').value.trim() || 'main',
    path: document.getElementById('gh-path').value.trim() || 'data/data.json',
    token: document.getElementById('gh-token').value.trim(),
  };
  if (!settings.owner || !settings.repo || !settings.token) {
    setStatus('Fill in owner, repo, and token to push to GitHub', true);
    return;
  }
  saveGhSettings(settings);
  setStatus('Pushing to GitHub…', true);

  state.updated = new Date().toISOString();
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));
  const apiUrl = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${settings.path}`;

  try {
    let sha;
    const getRes = await fetch(`${apiUrl}?ref=${settings.branch}`, {
      headers: { Authorization: `Bearer ${settings.token}`, Accept: 'application/vnd.github+json' },
    });
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData.sha;
    }
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${settings.token}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({
        message: `Update progress ${todayISO()}`,
        content,
        branch: settings.branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || 'GitHub API error');
    }
    setStatus('Pushed to GitHub — Pages will redeploy shortly', false);
  } catch (err) {
    setStatus(`Push failed: ${err.message}`, true);
  }
}

function initGhPanel() {
  const settings = loadGhSettings();
  document.getElementById('gh-owner').value = settings.owner;
  document.getElementById('gh-repo').value = settings.repo;
  document.getElementById('gh-branch').value = settings.branch;
  document.getElementById('gh-path').value = settings.path;
  document.getElementById('gh-token').value = settings.token;

  document.getElementById('gh-toggle').addEventListener('click', () => {
    document.getElementById('gh-panel').classList.toggle('open');
  });
  document.getElementById('gh-push-btn').addEventListener('click', pushToGitHub);
}

async function init() {
  state = await loadState();
  Object.entries(state.subjects).forEach(([key, subject]) => buildSubjectCard(key, subject));
  requestAnimationFrame(tickTimers);
  initGhPanel();

  document.getElementById('cards').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, subject, id } = btn.dataset;
    if (action === 'toggle') toggleTimer(subject);
    if (action === 'reset') resetTimer(subject);
    if (action === 'log') {
      const manualInput = document.getElementById(`manual-${subject}`);
      const manualVal = Number(manualInput.value);
      if (manualVal > 0) {
        logTime(subject, manualVal);
        manualInput.value = '';
      } else {
        logTimerElapsed(subject);
      }
    }
    if (action === 'delete-paper') {
      const s = state.subjects[subject];
      s.pastPapers = s.pastPapers.filter((p) => p.id !== id);
      renderPastPapers(subject, s);
      setStatus('Unsaved change', true);
      saveState();
    }
  });

  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });
  document.getElementById('reset-cache-btn').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
}

init();
