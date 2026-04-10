const analyzer = new BaccaratAnalyzer();
let currentRoad = 'bead';

let weights = { streak: 75, uniform: 65, slope: 50, jump: 45, pair: 55, crowd: 30 };

document.addEventListener('DOMContentLoaded', () => {
  loadWeightsFromSliders();
  updateUI();

  document.getElementById('recordB').addEventListener('click', () => record('B'));
  document.getElementById('recordP').addEventListener('click', () => record('P'));
  document.getElementById('recordT').addEventListener('click', () => record('T'));
  document.getElementById('resetBtn').addEventListener('click', resetAll);
  document.getElementById('shoeResetBtn').addEventListener('click', () => {
    analyzer.resetShoe();
    updateCountDisplay();
  });

  document.getElementById('updateCountBtn').addEventListener('click', () => {
    const inp = document.getElementById('cardInput');
    if (inp.value.trim()) {
      analyzer.updateCardCounting(inp.value);
      inp.value = '';
      updateCountDisplay();
      reanalyze();
    }
  });

  document.getElementById('applyWeightsBtn').addEventListener('click', () => {
    loadWeightsFromSliders();
    reanalyze();
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

function record(result) {
  analyzer.addResult(result);
  updateUI();
  renderRoadmap();
  reanalyze();

  const played = analyzer.history.length;
  document.getElementById('shoeProgress').innerText = played;
}

function resetAll() {
  analyzer.history = [];
  analyzer.resetShoe();
  updateUI();
  renderRoadmap();
  reanalyze();
  document.getElementById('shoeProgress').innerText = '0';
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
  featDiv.innerHTML = `长龙:${f.streak?.toFixed(2) || 0} 整齐:${f.uniform?.toFixed(2) || 0} 坡度:${f.slope?.toFixed(2) || 0} 单跳:${f.jump?.toFixed(2) || 0} | TC:${analysis.tc || '0.00'}`;
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
}
