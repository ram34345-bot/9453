const analyzer = new BaccaratAnalyzer();
let currentRoad = 'bead';
const STORAGE_KEY = 'baccarat-assistant-state-v1';
const NIGHTLY_LEARN_KEY = 'baccarat-nightly-learn-date-v1';

let weights = { streak: 75, uniform: 65, slope: 50, jump: 45, pair: 55, crowd: 30 };

document.addEventListener('DOMContentLoaded', () => {
  hydrateFromStorage();
  syncSlidersFromWeights();
  loadWeightsFromSliders();
  updateUI();
  renderRoadmap();
  maybeRunNightlyLearning();
  reanalyze();

  document.getElementById('recordB').addEventListener('click', () => record('B'));
  document.getElementById('recordP').addEventListener('click', () => record('P'));
  document.getElementById('recordT').addEventListener('click', () => record('T'));
  document.getElementById('resetBtn').addEventListener('click', resetAll);
  document.getElementById('shoeResetBtn').addEventListener('click', () => {
    analyzer.resetShoe();
    updateCountDisplay();
    reanalyze();
    persistState();
  });

  document.getElementById('updateCountBtn').addEventListener('click', () => {
    const inp = document.getElementById('cardInput');
    if (inp.value.trim()) {
      analyzer.updateCardCounting(inp.value);
      inp.value = '';
      updateCountDisplay();
      reanalyze();
      persistState();
    }
  });
  document.getElementById('cardInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('updateCountBtn').click();
    }
  });

  document.getElementById('applyWeightsBtn').addEventListener('click', () => {
    loadWeightsFromSliders();
    reanalyze();
    persistState();
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      e.target.classList.add('active');
      currentRoad = e.target.dataset.road;
      renderRoadmap();
    });
  });
});

function loadWeightsFromSliders() {
  weights.streak = +document.getElementById('wStreak').value;
  weights.uniform = +document.getElementById('wUniform').value;
  weights.slope = +document.getElementById('wSlope').value;
  weights.jump = +document.getElementById('wJump').value;
  weights.pair = +document.getElementById('wPair').value;
  weights.crowd = +document.getElementById('wCrowd').value;
}

function syncSlidersFromWeights() {
  document.getElementById('wStreak').value = weights.streak;
  document.getElementById('wUniform').value = weights.uniform;
  document.getElementById('wSlope').value = weights.slope;
  document.getElementById('wJump').value = weights.jump;
  document.getElementById('wPair').value = weights.pair;
  document.getElementById('wCrowd').value = weights.crowd;
}

function hydrateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (Array.isArray(state.history)) analyzer.history = state.history;
    if (typeof state.runningCount === 'number') analyzer.runningCount = state.runningCount;
    if (typeof state.decksRemaining === 'number') analyzer.decksRemaining = state.decksRemaining;
    if (typeof state.cardsPlayed === 'number') analyzer.cardsPlayed = state.cardsPlayed;
    if (Array.isArray(state.cardHistory)) analyzer.cardHistory = state.cardHistory;
    if (state.weights && typeof state.weights === 'object') {
      weights = { ...weights, ...state.weights };
    }
    if (state.learningProfile && typeof state.learningProfile === 'object') {
      analyzer.learningProfile = { ...analyzer.learningProfile, ...state.learningProfile };
    }
  } catch (_) {
    // ignore invalid local data
  }
}

function persistState() {
  const payload = {
    history: analyzer.history,
    runningCount: analyzer.runningCount,
    decksRemaining: analyzer.decksRemaining,
    cardsPlayed: analyzer.cardsPlayed,
    cardHistory: analyzer.cardHistory,
    learningProfile: analyzer.learningProfile,
    weights
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function maybeRunNightlyLearning() {
  const today = new Date().toISOString().slice(0, 10);
  const lastLearnDate = localStorage.getItem(NIGHTLY_LEARN_KEY);
  if (lastLearnDate === today) return;
  const result = analyzer.nightlyLearn(today);
  if (result.updated) {
    localStorage.setItem(NIGHTLY_LEARN_KEY, today);
    persistState();
  }
}

function record(result) {
  analyzer.addResult(result);
  updateUI();
  renderRoadmap();
  reanalyze();

  const played = analyzer.history.length;
  document.getElementById('shoeProgress').innerText = played;
  persistState();
}

function resetAll() {
  analyzer.history = [];
  analyzer.resetShoe();
  updateUI();
  renderRoadmap();
  reanalyze();
  document.getElementById('shoeProgress').innerText = '0';
  persistState();
}

function reanalyze() {
  const analysis = analyzer.weightedAnalyze(weights);
  displayDecision(analysis);
  updateCountDisplay();
}

function displayDecision(analysis) {
  const mainEl = document.querySelector('.decision-main');
  const detailEl = document.querySelector('.decision-detail');
  const badge = document.getElementById('confidenceBadge');
  const featDiv = document.getElementById('featureDetails');

  if (analysis.bet) {
    mainEl.innerHTML = analysis.bet === 'B' ? '🔴 建议庄家 (B)' : '🔵 建议闲家 (P)';
    badge.innerText = `信心 ${analysis.confidence}%`;
    detailEl.innerText = analysis.reason;
  } else {
    mainEl.innerHTML = '⏸️ 观望';
    badge.innerText = '--';
    detailEl.innerText = analysis.reason;
  }

  const f = analysis.features || {};
  const learnDate = analysis.learning?.lastLearnedOn || '未学习';
  featDiv.innerHTML = `长龙:${f.streak?.toFixed(2) || 0} 整齐:${f.uniform?.toFixed(2) || 0} 坡度:${f.slope?.toFixed(2) || 0} 单跳:${f.jump?.toFixed(2) || 0} 学习:${f.learn?.toFixed(2) || 0} | TC:${analysis.tc || '0.00'} | 学习日:${learnDate}`;
}

function updateCountDisplay() {
  document.getElementById('rcValue').innerText = analyzer.runningCount;
  document.getElementById('decksLeft').innerText = analyzer.decksRemaining.toFixed(1);

  const tc = analyzer.getTrueCount().toFixed(2);
  document.getElementById('tcValue').innerText = tc;

  const sug = tc > 1.0 ? '偏向庄家' : tc < -1.0 ? '偏向闲家' : '中性';
  document.getElementById('countSuggestion').innerText = sug;
  document.getElementById('runningCountDisplay').innerText = `🏷️ RC: ${analyzer.runningCount}`;
}

function updateStats() {
  const hist = analyzer.history;
  const filtered = hist.filter((r) => r !== 'T');

  const total = hist.length;
  const bCnt = hist.filter((r) => r === 'B').length;
  const pCnt = hist.filter((r) => r === 'P').length;
  const tCnt = hist.filter((r) => r === 'T').length;

  document.getElementById('totalHands').innerText = total;
  document.getElementById('bankerCount').innerText = bCnt;
  document.getElementById('playerCount').innerText = pCnt;
  document.getElementById('tieCount').innerText = tCnt;

  const recent = filtered.slice(-20);
  const bR = recent.filter((r) => r === 'B').length;
  const pR = recent.filter((r) => r === 'P').length;

  document.getElementById('bankerRate').innerText = recent.length ? `${((bR / recent.length) * 100).toFixed(1)}%` : '0%';
  document.getElementById('playerRate').innerText = recent.length ? `${((pR / recent.length) * 100).toFixed(1)}%` : '0%';

  let streak = 0;
  let last = null;
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (last === null) {
      last = filtered[i];
      streak = 1;
    } else if (filtered[i] === last) {
      streak++;
    } else {
      break;
    }
  }

  document.getElementById('streakInfo').innerText = streak > 0 ? `${streak}连${last}` : '-';
}

function renderRoadmap() {
  const container = document.getElementById('roadmapContainer');
  const hist = analyzer.history;

  if (hist.length === 0) {
    container.innerHTML = '<div class="roadmap-placeholder">点击上方按钮开始记录</div>';
    return;
  }

  if (currentRoad === 'bead') container.innerHTML = renderBead();
  else if (currentRoad === 'big') container.innerHTML = renderBigRoad();
  else container.innerHTML = renderBigEye();
}

function renderBead() {
  const bead = analyzer.generateBeadRoad();
  let html = '<div class="bead-road">';
  bead.forEach((col, ci) => {
    col.forEach((cell, ri) => {
      if (cell) {
        const cls = cell === 'B' ? 'red' : 'blue';
        html += `<span class="bead ${cls}" style="grid-column:${ci + 1};grid-row:${ri + 1}">●</span>`;
      }
    });
  });
  return `${html}</div>`;
}

function renderBigRoad() {
  const big = analyzer.generateBigRoad();
  let html = '<div class="big-road">';
  big.forEach((col, ci) => {
    col.forEach((cell, ri) => {
      if (cell) {
        const cls = cell === 'B' ? 'red' : 'blue';
        html += `<span class="big ${cls}" style="grid-column:${ci + 1};grid-row:${ri + 1}">●</span>`;
      }
    });
  });
  return `${html}</div>`;
}

function renderBigEye() {
  const big = analyzer.generateBigRoad();
  const eye = analyzer.generateBigEyeBoy(big);
  let html = '<div class="bigeye-road">';
  eye.forEach((col, ci) => {
    col.forEach((cell, ri) => {
      if (cell) {
        html += `<span class="bigeye ${cell}" style="grid-column:${ci + 1};grid-row:${ri + 1}">●</span>`;
      }
    });
  });
  return `${html}</div>`;
}

function updateUI() {
  updateStats();
  updateCountDisplay();
  document.getElementById('shoeProgress').innerText = analyzer.history.length;
}
