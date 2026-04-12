class BaccaratAnalyzer {
  constructor() {
    this.history = [];
    this.cardHistory = [];
    this.runningCount = 0;
    this.decksRemaining = 6;
    this.cardsPlayed = 0;
    this.lastResult = null;
    this.learningProfile = {
      bAfterB: 0.5,
      bAfterP: 0.5,
      samples: 0,
      lastLearnedOn: null
    };
  }

  addResult(result) {
    this.history.push(result);
    this.lastResult = result;
    return this;
  }

  generateBeadRoad() {
    const filtered = this.history.filter((r) => r !== 'T');
    const bead = [];
    let col = 0;
    let row = 0;

    filtered.forEach((r, i) => {
      if (i > 0 && filtered[i - 1] !== r) {
        col++;
        row = 0;
      }
      if (!bead[col]) bead[col] = [];
      bead[col][row] = r;
      row++;
      if (row >= 6) {
        col++;
        row = 0;
      }
    });

    return bead;
  }

  generateBigRoad() {
    const filtered = this.history.filter((r) => r !== 'T');
    const big = [];
    let col = 0;
    let row = 0;

    filtered.forEach((r, i) => {
      if (i > 0 && filtered[i - 1] !== r) {
        col++;
        row = 0;
      }
      if (!big[col]) big[col] = [];
      big[col][row] = r;
      row++;
    });

    return big;
  }

  getColumnHeights(bigRoad) {
    return bigRoad.map((col) => col.filter(Boolean).length);
  }

  generateBigEyeBoy(bigRoad) {
    const heights = this.getColumnHeights(bigRoad);
    const bigEye = [];
    let col = 0;

    for (let i = 2; i < heights.length; i++) {
      const prev1 = heights[i - 1];
      const prev2 = heights[i - 2];
      if (!bigEye[col]) bigEye[col] = [];

      for (let j = 0; j < heights[i]; j++) {
        let color;
        if (j === 0) {
          const simulatedPrev = Math.max(prev1, j + 1);
          color = simulatedPrev === prev2 ? 'blue' : 'red';
        } else if (j + 1 <= prev1) {
          color = 'red';
        } else if (j + 1 === prev1 + 1) {
          color = 'blue';
        } else {
          color = 'red';
        }
        bigEye[col][j] = color;
      }
      col++;
    }

    return bigEye;
  }

  updateCardCounting(cardString) {
    const cards = cardString
      .toUpperCase()
      .split(/[\s,]+/)
      .filter(Boolean);

    let roundCount = 0;
    cards.forEach((c) => {
      const val = this.cardValue(c);
      if (val !== null) {
        this.runningCount += val;
        roundCount++;
      }
    });

    this.cardsPlayed += roundCount;
    this.decksRemaining = Math.max(0.5, 6 - this.cardsPlayed / 52);
    this.cardHistory.push(cards);

    return { rc: this.runningCount, decks: this.decksRemaining };
  }

  cardValue(card) {
    if (['2', '3', '4', '5', '6'].includes(card)) return 1;
    if (['7', '8', '9'].includes(card)) return 0;
    if (['T', 'J', 'Q', 'K', 'A', '10'].includes(card)) return -1;
    return null;
  }

  getTrueCount() {
    return this.decksRemaining > 0 ? this.runningCount / this.decksRemaining : 0;
  }

  resetShoe() {
    this.runningCount = 0;
    this.cardsPlayed = 0;
    this.decksRemaining = 6;
    this.cardHistory = [];
  }

  nightlyLearn(dateLabel = new Date().toISOString().slice(0, 10)) {
    const filtered = this.history.filter((r) => r !== 'T');
    if (filtered.length < 20) {
      return { updated: false, reason: '样本不足(至少20局)' };
    }

    const transitions = { BB: 1, BP: 1, PB: 1, PP: 1 };
    for (let i = 1; i < filtered.length; i++) {
      const prev = filtered[i - 1];
      const curr = filtered[i];
      const key = `${prev}${curr}`;
      if (transitions[key] !== undefined) transitions[key] += 1;
    }

    const bAfterB = transitions.BB / (transitions.BB + transitions.BP);
    const bAfterP = transitions.PB / (transitions.PB + transitions.PP);
    this.learningProfile = {
      bAfterB,
      bAfterP,
      samples: filtered.length,
      lastLearnedOn: dateLabel
    };

    return { updated: true, profile: this.learningProfile };
  }

  weightedAnalyze(weights) {
    const filtered = this.history.filter((r) => r !== 'T');
    const len = filtered.length;
    if (len < 5) return { bet: null, reason: '数据不足', confidence: 0, score: 0 };

    const last = filtered[len - 1];
    const bigRoad = this.generateBigRoad();
    const heights = this.getColumnHeights(bigRoad);
    const bead = this.generateBeadRoad();

    const features = { streak: 0, uniform: 0, slope: 0, jump: 0, pair: 0, crowd: 0, learn: 0 };

    let streakCount = 1;
    for (let i = len - 2; i >= 0; i--) {
      if (filtered[i] === last) streakCount++;
      else break;
    }
    if (streakCount >= 3) features.streak = (last === 'B' ? 1 : -1) * Math.min(streakCount / 8, 1);

    if (heights.length >= 3) {
      const last3 = heights.slice(-3);
      const avg = last3.reduce((a, b) => a + b, 0) / 3;
      const variance = last3.reduce((a, b) => a + (b - avg) ** 2, 0) / 3;
      const uniformity = Math.max(0, 1 - variance / 4);
      const bCols = bigRoad.filter((col) => col[0] === 'B').length;
      const pCols = bigRoad.filter((col) => col[0] === 'P').length;
      features.uniform = bCols > pCols ? uniformity : -uniformity;
    }

    let bH = 0;
    let pH = 0;
    bigRoad.forEach((col) => {
      const h = col.filter(Boolean).length;
      if (col[0] === 'B') bH += h;
      else pH += h;
    });
    const slopeVal = (bH - pH) / Math.max(1, bH + pH);
    features.slope = Math.max(-1, Math.min(1, slopeVal * 2));

    let jumpSeq = 0;
    for (let i = len - 1; i > 0; i--) {
      if (filtered[i] !== filtered[i - 1]) jumpSeq++;
      else break;
    }
    if (jumpSeq >= 3) features.jump = last === 'B' ? -0.8 : 0.8;

    if (len >= 6) {
      const last6 = filtered.slice(-6).join('');
      if (last6 === 'BBPPBB') features.pair = -0.9;
      else if (last6 === 'PPBBPP') features.pair = 0.9;
    }

    const lastCol = bead[bead.length - 1];
    if (lastCol && lastCol.length >= 5) features.crowd = lastCol[0] === 'B' ? -0.6 : 0.6;

    if (this.learningProfile.samples > 0) {
      const pB = last === 'B' ? this.learningProfile.bAfterB : this.learningProfile.bAfterP;
      features.learn = Math.max(-1, Math.min(1, (pB - 0.5) * 2));
    }

    let total = 0;
    total += features.streak * (weights.streak / 100);
    total += features.uniform * (weights.uniform / 100);
    total += features.slope * (weights.slope / 100);
    total += features.jump * (weights.jump / 100);
    total += features.pair * (weights.pair / 100);
    total += features.crowd * (weights.crowd / 100);
    total += features.learn * 0.35;

    const maxWeight = Object.values(weights).reduce((a, b) => a + b / 100, 0);
    const normScore = maxWeight > 0 ? total / maxWeight : 0;

    const tc = this.getTrueCount();
    let adjustedScore = normScore;
    if (tc > 1.5) adjustedScore += 0.1;
    else if (tc < -1.5) adjustedScore -= 0.1;

    let bet = null;
    let confidence = 0;
    let reason = '';

    if (adjustedScore > 0.2) {
      bet = 'B';
      confidence = Math.min(85, 50 + Math.round(adjustedScore * 35));
      reason = '综合评分偏庄';
    } else if (adjustedScore < -0.2) {
      bet = 'P';
      confidence = Math.min(85, 50 + Math.round(Math.abs(adjustedScore) * 35));
      reason = '综合评分偏闲';
    } else {
      reason = '趋势中性，建议观望';
    }

    return {
      bet,
      reason,
      confidence,
      rawScore: adjustedScore,
      features,
      tc: this.getTrueCount().toFixed(2),
      learning: this.learningProfile
    };
  }
}

if (typeof module !== 'undefined') module.exports = BaccaratAnalyzer;
if (typeof window !== 'undefined') window.BaccaratAnalyzer = BaccaratAnalyzer;
