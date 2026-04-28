const STORAGE_KEY = 'shanhai_walker_save_v1';

const soulDatabase = {
  fox: { id: 'fox', name: '小燈狐', passive: '增加尋寶提示。' },
  mountain: { id: 'mountain', name: '山鬼', passive: '生命低於 30% 時自動護盾。' },
  river: { id: 'river', name: '河伯', passive: '水系技能冷卻減少。' }
};

const mapZones = [
  { id: 'qingzhou', name: '青州小鎮', x: 0, y: 0, w: 360, h: 640, colorA: '#3f5e6f', colorB: '#557d8b' },
  { id: 'forest', name: '妖霧森林', x: 360, y: 0, w: 360, h: 640, colorA: '#24422f', colorB: '#335f41' },
  { id: 'ferry', name: '河邊渡口', x: 720, y: 0, w: 304, h: 640, colorA: '#345477', colorB: '#50739a' }
];

const player = {
  x: 110, y: 180, r: 13, speed: 2.5,
  level: 1, exp: 0, nextExp: 100,
  hpMax: 120, mpMax: 60, hp: 120, mp: 60,
  silver: 300, infamy: 0, mapId: 'qingzhou',
  gear: { weapon: '木劍', armor: '布衣', durability: 100 },
  bag: { potion: 2, talisman: 1, herb: 0 },
  quests: {
    main_1: { name: '主線：妖霧初探', done: false, step: '去青州小鎮找鎮長接任務' },
    side_1: { name: '支線：渡口失物', done: false, step: '幫渡口商人找回失物' }
  },
  souls: [],
  mount: false,
  debuffTimer: 0,
  shield: 0,
  waterSkillCd: 0
};

const world = {
  keys: {}, joy: { x: 0, y: 0 },
  monsters: [
    spawnMonster('霧狼', 440, 140, 'normal'),
    spawnMonster('燈狐妖', 570, 290, 'fox'),
    spawnMonster('山鬼', 645, 500, 'mountain'),
    spawnMonster('河精', 830, 280, 'river')
  ],
  npcs: [
    { id: 'elder', name: '鎮長', x: 140, y: 250, dialog: '年輕人，先去森林調查妖霧。按 E 接任務。' },
    { id: 'merchant', name: '符藥商', x: 260, y: 420, dialog: '藥品與符紙，按 E 購買。', shop: true },
    { id: 'boatman', name: '渡口商人', x: 860, y: 180, dialog: '我的貨被河妖奪走了，拜託你！' }
  ],
  shrines: [
    { x: 120, y: 125 },
    { x: 510, y: 330 },
    { x: 860, y: 520 }
  ],
  captureCandidate: null,
  wanted: null,
  particles: [],
  logs: []
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('playerStats');
const questEl = document.getElementById('questList');
const soulEl = document.getElementById('soulList');
const logEl = document.getElementById('log');
const hintEl = document.getElementById('hintText');
const guideEl = document.getElementById('guidePanel');

function spawnMonster(name, x, y, soulType) {
  return { name, x, y, hp: 50, maxHp: 50, alive: true, soulType, atk: 8, cd: 0, wander: Math.random() * 999 };
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function emitParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    world.particles.push({ x, y, life: 24 + Math.random() * 16, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, color });
  }
}

function log(msg) {
  world.logs.unshift(`【${new Date().toLocaleTimeString()}】${msg}`);
  world.logs = world.logs.slice(0, 26);
  logEl.innerHTML = world.logs.map((m) => `<div>${m}</div>`).join('');
}

function saveGame() {
  const data = {
    level: player.level, exp: player.exp,
    hpMax: player.hpMax, mpMax: player.mpMax, hp: player.hp, mp: player.mp,
    silver: player.silver, gear: player.gear, bag: player.bag,
    quests: player.quests, souls: player.souls,
    mapId: player.mapId, infamy: player.infamy,
    x: player.x, y: player.y
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  log('已存檔到 localStorage。');
}

function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return log('沒有找到存檔。');
  Object.assign(player, JSON.parse(raw));
  log('讀取存檔成功。');
}

function resetGame() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function nearestZone() {
  const z = mapZones.find((zone) => player.x >= zone.x && player.x < zone.x + zone.w) || mapZones[0];
  player.mapId = z.id;
  return z;
}

function nearestShrine() {
  return world.shrines.reduce((prev, cur) => (dist(player, cur) < dist(player, prev) ? cur : prev), world.shrines[0]);
}

function renderMap(time) {
  for (const zone of mapZones) {
    const g = ctx.createLinearGradient(zone.x, 0, zone.x + zone.w, zone.h);
    g.addColorStop(0, zone.colorA);
    g.addColorStop(1, zone.colorB);
    ctx.fillStyle = g;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    ctx.fillStyle = '#ffffff24';
    for (let i = 0; i < 10; i++) {
      const px = zone.x + (i * zone.w) / 10;
      const wobble = Math.sin(time * 0.001 + i) * 4;
      ctx.fillRect(px, 0 + wobble, 1, zone.h);
    }

    ctx.fillStyle = '#ffffffdd';
    ctx.font = '18px sans-serif';
    ctx.fillText(zone.name, zone.x + 14, 26);
  }

  // 視覺地標
  drawLandmark(160, 120, '#f1cd79', '神龕', 16);
  drawLandmark(510, 320, '#f1cd79', '神龕', 16);
  drawLandmark(860, 500, '#f1cd79', '神龕', 16);
  drawLandmark(260, 420, '#8bd8ff', '商店', 14);
  drawLandmark(140, 250, '#b4ffab', '任務', 14);

  // 渡口水波
  ctx.strokeStyle = '#9ec9ff77';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const y = 230 + i * 28 + Math.sin(time * 0.003 + i) * 5;
    ctx.moveTo(760, y);
    ctx.quadraticCurveTo(860, y - 10, 980, y);
    ctx.stroke();
  }
}

function drawLandmark(x, y, color, label, r = 12) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = '14px sans-serif';
  ctx.fillText(label, x - 16, y - r - 5);
}

function drawBar(x, y, w, h, value, max, c1, c2) {
  const p = Math.max(0, Math.min(1, value / max));
  ctx.fillStyle = '#00000088';
  ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w * p, h);
}

function renderEntities(time) {
  world.npcs.forEach((n) => {
    ctx.fillStyle = '#ecefff';
    ctx.fillRect(n.x - 8, n.y - 12, 16, 24);
    ctx.fillStyle = '#12131d';
    ctx.fillText(n.name, n.x - 26, n.y - 16);
  });

  world.monsters.forEach((m) => {
    if (!m.alive) return;
    const pulse = Math.sin(time * 0.01 + m.wander) * 2;
    ctx.fillStyle = '#af2f35';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 12 + pulse, 0, Math.PI * 2);
    ctx.fill();
    drawBar(m.x - 18, m.y - 24, 36, 4, m.hp, m.maxHp, '#f69090', '#d52f2f');
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(m.name, m.x - 18, m.y - 30);
  });

  if (world.wanted) {
    ctx.fillStyle = '#5b79e2';
    ctx.beginPath();
    ctx.arc(world.wanted.x, world.wanted.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(world.wanted.name, world.wanted.x - 30, world.wanted.y - 17);
  }
}

function renderPlayer(time) {
  if (player.mount) {
    ctx.fillStyle = '#bf8f57';
    ctx.fillRect(player.x - 18, player.y + 2, 36, 12);
  }

  ctx.fillStyle = '#f4f7ff';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  if (player.shield > 0) {
    ctx.strokeStyle = '#79e2ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 22 + Math.sin(time * 0.02) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawBar(player.x - 20, player.y - 30, 40, 5, player.hp, player.hpMax, '#97ff90', '#39cf48');
}

function renderParticles() {
  world.particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    ctx.globalAlpha = Math.max(0, p.life / 30);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
    ctx.globalAlpha = 1;
  });
  world.particles = world.particles.filter((p) => p.life > 0);
}

function renderHud() {
  const zone = nearestZone();
  ctx.fillStyle = '#00000066';
  ctx.fillRect(10, 10, 250, 62);
  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText(`地區：${zone.name}`, 16, 30);
  ctx.fillText(`等級 ${player.level} ｜ 銀兩 ${player.silver} ｜ 惡名 ${player.infamy}`, 16, 50);
}

function interact() {
  const npc = world.npcs.find((n) => dist(player, n) < 58);
  if (!npc) return log('附近沒有可互動對象。');
  log(`${npc.name}：${npc.dialog}`);

  if (npc.id === 'elder' && !player.quests.main_1.done) {
    player.quests.main_1.step = '擊敗任意 2 隻妖怪並回報鎮長';
    log('主線更新：' + player.quests.main_1.step);
  }

  if (npc.shop) {
    if (player.silver >= 30) {
      player.silver -= 30;
      player.bag.potion++;
      player.bag.talisman++;
      log('購買成功：藥品+1、符紙+1（-30銀兩）');
      emitParticles(npc.x, npc.y, '#ffe895', 16);
    } else log('銀兩不足，無法購買。');
  }
}

function openChoiceModal(monster) {
  const modal = document.getElementById('choiceModal');
  document.getElementById('choiceTitle').textContent = `處置 ${monster.name}`;
  document.getElementById('choiceDesc').textContent = '斬殺可拿妖材；收服可獲得妖魂被動。';
  modal.classList.remove('hidden');
}

function attack() {
  const target = world.monsters.find((m) => m.alive && dist(player, m) < 72);
  if (!target) return log('攻擊落空。');
  const dmg = 20 + Math.floor(Math.random() * 8);
  target.hp -= dmg;
  emitParticles(target.x, target.y, '#ff7f7f', 12);
  log(`你對 ${target.name} 造成 ${dmg} 傷害。`);

  if (target.hp <= 0) {
    target.alive = false;
    player.exp += 30;
    player.silver += 18;
    player.infamy += 4;
    emitParticles(target.x, target.y, '#ffd19e', 24);
    log(`擊敗 ${target.name}，獲得經驗與銀兩。`);

    if (target.soulType !== 'normal' && !player.souls.some((s) => s.id === target.soulType)) {
      world.captureCandidate = target;
      openChoiceModal(target);
    }

    if (player.exp >= player.nextExp) {
      player.level++;
      player.exp -= player.nextExp;
      player.nextExp += 50;
      player.hpMax += 20;
      player.mpMax += 10;
      player.hp = player.hpMax;
      player.mp = player.mpMax;
      log(`升級！目前等級 ${player.level}`);
      emitParticles(player.x, player.y, '#8fd5ff', 30);
    }
  }
}

function castSkill() {
  const cdMod = player.souls.some((s) => s.id === 'river') ? 0.6 : 1;
  if (player.waterSkillCd > 0) return log('水系技能冷卻中。');
  if (player.mp < 12) return log('法力不足。');
  player.mp -= 12;
  player.waterSkillCd = 160 * cdMod;
  emitParticles(player.x, player.y, '#90d7ff', 36);

  world.monsters.forEach((m) => {
    if (m.alive && dist(player, m) < 115) {
      m.hp -= 26;
      emitParticles(m.x, m.y, '#a7e3ff', 10);
      if (m.hp <= 0) m.alive = false;
    }
  });
  log('施放「滄浪符」，附近妖怪受到水系傷害。');
}

function damagePlayer(amount) {
  let dmg = amount;
  if (player.shield > 0) {
    const blocked = Math.min(player.shield, dmg);
    player.shield -= blocked;
    dmg -= blocked;
  }

  player.hp -= dmg;
  emitParticles(player.x, player.y, '#ff9494', 10);

  if (player.hp <= player.hpMax * 0.3 && player.souls.some((s) => s.id === 'mountain') && player.shield <= 0) {
    player.shield = 28;
    emitParticles(player.x, player.y, '#91e4ff', 24);
    log('山鬼妖魂觸發：自動生成護盾！');
  }

  if (player.hp <= 0) handleDeath();
}

function handleDeath() {
  player.silver = Math.max(0, player.silver - 50);
  player.gear.durability = Math.max(0, player.gear.durability - 15);
  player.debuffTimer = 600;

  const shrine = nearestShrine();
  player.x = shrine.x + 24;
  player.y = shrine.y + 24;
  player.hp = Math.floor(player.hpMax * 0.65);
  player.mp = Math.floor(player.mpMax * 0.65);

  emitParticles(player.x, player.y, '#f5d287', 40);
  log('你已陣亡，於最近神龕復活。保留等級、裝備、任務、背包與妖魂。');
}

function updateWanted() {
  if (player.infamy >= 50 && !world.wanted) {
    world.wanted = { name: '城隍司捕快', x: player.x + 80, y: player.y + 30, atk: 11 };
    log('惡名過高！城隍司開始追捕你。');
  }

  if (world.wanted) {
    const dx = player.x - world.wanted.x;
    const dy = player.y - world.wanted.y;
    const len = Math.hypot(dx, dy) || 1;
    world.wanted.x += (dx / len) * 1.25;
    world.wanted.y += (dy / len) * 1.25;
    if (dist(player, world.wanted) < 22) damagePlayer(world.wanted.atk);
  }
}

function movePlayer() {
  const speed = (player.mount ? player.speed * 1.7 : player.speed) * (player.debuffTimer > 0 ? 0.75 : 1);
  player.x += world.joy.x * speed;
  player.y += world.joy.y * speed;

  if (world.keys.w || world.keys.arrowup) player.y -= speed;
  if (world.keys.s || world.keys.arrowdown) player.y += speed;
  if (world.keys.a || world.keys.arrowleft) player.x -= speed;
  if (world.keys.d || world.keys.arrowright) player.x += speed;

  player.x = Math.max(16, Math.min(canvas.width - 16, player.x));
  player.y = Math.max(16, Math.min(canvas.height - 16, player.y));
}

function updateMonsters(time) {
  world.monsters.forEach((m) => {
    if (!m.alive) return;
    const dx = player.x - m.x;
    const dy = player.y - m.y;
    const len = Math.hypot(dx, dy) || 1;

    if (len < 150) {
      m.x += (dx / len) * 0.8;
      m.y += (dy / len) * 0.8;
      if (len < 28 && m.cd <= 0) {
        damagePlayer(m.atk);
        m.cd = 50;
      }
    } else {
      m.x += Math.sin(time * 0.001 + m.wander) * 0.3;
      m.y += Math.cos(time * 0.001 + m.wander) * 0.3;
    }

    if (m.cd > 0) m.cd--;
  });
}

function updateQuestProgress() {
  const killed = world.monsters.filter((m) => !m.alive).length;
  if (killed >= 2 && !player.quests.main_1.done) {
    player.quests.main_1.done = true;
    player.quests.main_1.step = '已完成，回青州小鎮找鎮長';
  }
  if (!player.quests.side_1.done && !world.monsters.find((m) => m.name === '河精' && m.alive)) {
    player.quests.side_1.done = true;
    player.quests.side_1.step = '已尋回渡口失物';
  }
}

function renderUI() {
  const zone = nearestZone();
  const foxHint = player.souls.some((s) => s.id === 'fox') ? '小燈狐提示：森林北側有寶物靈氣。' : '提示：先跟鎮長說話。';
  hintEl.textContent = `${zone.name}｜${foxHint}`;

  statsEl.innerHTML = `
    <div>等級：${player.level}</div><div>經驗：${player.exp}/${player.nextExp}</div>
    <div>生命：${Math.max(0, Math.floor(player.hp))}/${player.hpMax}</div><div>法力：${Math.max(0, Math.floor(player.mp))}/${player.mpMax}</div>
    <div>銀兩：${player.silver}</div><div>惡名值：${player.infamy}</div>
    <div>裝備：${player.gear.weapon}/${player.gear.armor}</div><div>耐久：${player.gear.durability}%</div>
    <div>背包：藥${player.bag.potion} 符${player.bag.talisman} 材${player.bag.herb}</div><div>地圖：${zone.name}</div>
  `;

  questEl.innerHTML = Object.values(player.quests).map((q) => `<li>${q.name}：${q.step}${q.done ? ' ✅' : ''}</li>`).join('');
  soulEl.innerHTML = player.souls.length ? player.souls.map((s) => `<li>${s.name} - ${s.passive}</li>`).join('') : '<li>尚未締結妖魂契約</li>';
}

function setupChoiceModal() {
  const modal = document.getElementById('choiceModal');
  document.getElementById('killChoice').onclick = () => {
    if (!world.captureCandidate) return;
    player.bag.herb += 1;
    log('你選擇斬殺，取得妖材。');
    world.captureCandidate = null;
    modal.classList.add('hidden');
  };

  document.getElementById('captureChoice').onclick = () => {
    const c = world.captureCandidate;
    if (!c) return;
    const soul = soulDatabase[c.soulType];
    if (soul && !player.souls.some((s) => s.id === soul.id)) {
      player.souls.push(soul);
      log(`締結契約成功：${soul.name}（${soul.passive}）`);
      emitParticles(player.x, player.y, '#8fffb3', 26);
    }
    world.captureCandidate = null;
    modal.classList.add('hidden');
  };
}

function setupInput() {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    world.keys[k] = true;
    if (k === 'j') attack();
    if (k === 'e') interact();
    if (k === 'k') castSkill();
    if (k === 'm') { player.mount = !player.mount; log(player.mount ? '已上馬，移動加速。' : '已下馬。'); }
    if (k === 'b' && player.bag.potion > 0) {
      player.bag.potion--;
      player.hp = Math.min(player.hpMax, player.hp + 45);
      emitParticles(player.x, player.y, '#8dffaa', 12);
      log('使用藥品恢復生命。');
    }
  });

  window.addEventListener('keyup', (e) => { world.keys[e.key.toLowerCase()] = false; });

  document.getElementById('saveBtn').onclick = saveGame;
  document.getElementById('loadBtn').onclick = loadGame;
  document.getElementById('resetBtn').onclick = resetGame;
  document.getElementById('toggleGuideBtn').onclick = () => guideEl.classList.toggle('hide');

  document.getElementById('btnAttack').onclick = attack;
  document.getElementById('btnInteract').onclick = interact;
  document.getElementById('btnSkill').onclick = castSkill;
  document.getElementById('btnMount').onclick = () => { player.mount = !player.mount; };

  setupJoystick();
}

function setupJoystick() {
  const base = document.getElementById('joystickBase');
  const stick = document.getElementById('joystickStick');
  let active = false;

  const moveStick = (x, y) => {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = x - cx;
    let dy = y - cy;
    const max = 35;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    world.joy = { x: dx / max, y: dy / max };
  };

  base.addEventListener('pointerdown', (e) => { active = true; moveStick(e.clientX, e.clientY); });
  window.addEventListener('pointermove', (e) => { if (active) moveStick(e.clientX, e.clientY); });
  window.addEventListener('pointerup', () => {
    active = false;
    stick.style.transform = 'translate(0px, 0px)';
    world.joy = { x: 0, y: 0 };
  });
}

function tick(time = 0) {
  movePlayer();
  updateMonsters(time);
  updateWanted();
  updateQuestProgress();
  if (player.debuffTimer > 0) player.debuffTimer--;
  if (player.waterSkillCd > 0) player.waterSkillCd--;
  if (player.mp < player.mpMax) player.mp += 0.02;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderMap(time);
  renderEntities(time);
  renderPlayer(time);
  renderParticles();
  renderHud();
  renderUI();

  requestAnimationFrame(tick);
}

setupInput();
setupChoiceModal();
log('歡迎來到《山海行者》：先找鎮長接任務，再去森林戰鬥。');
requestAnimationFrame(tick);
