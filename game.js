const STORAGE_KEY = 'shanhai_walker_save_v1';

const soulDatabase = {
  fox: { id: 'fox', name: '小燈狐', passive: '增加尋寶提示。' },
  mountain: { id: 'mountain', name: '山鬼', passive: '生命低於 30% 時自動護盾。' },
  river: { id: 'river', name: '河伯', passive: '水系技能冷卻減少。' }
};

const mapZones = [
  { id: 'qingzhou', name: '青州小鎮', x: 0, y: 0, w: 360, h: 640, color: '#4f6f78' },
  { id: 'forest', name: '妖霧森林', x: 360, y: 0, w: 360, h: 640, color: '#3f5f3d' },
  { id: 'ferry', name: '河邊渡口', x: 720, y: 0, w: 304, h: 640, color: '#4b6483' }
];

const player = {
  x: 110, y: 180, r: 16, speed: 2.5,
  level: 1, exp: 0, nextExp: 100,
  hpMax: 120, mpMax: 60, hp: 120, mp: 60,
  silver: 300, infamy: 0, mapId: 'qingzhou',
  gear: { weapon: '木劍', armor: '布衣', durability: 100 },
  bag: { potion: 2, talisman: 1, herb: 0 },
  quests: {
    main_1: { name: '主線：妖霧初探', done: false, step: '前往妖霧森林調查異變' },
    side_1: { name: '支線：渡口失物', done: false, step: '幫渡口商人找回失物' }
  },
  souls: [],
  mount: false,
  debuffTimer: 0,
  shield: 0,
  waterSkillCd: 0
};

const world = {
  keys: {},
  monsters: [
    spawnMonster('霧狼', 440, 150, 'normal'),
    spawnMonster('燈狐妖', 550, 280, 'fox'),
    spawnMonster('山鬼', 650, 480, 'mountain'),
    spawnMonster('河精', 810, 280, 'river')
  ],
  npcs: [
    { id: 'elder', name: '鎮長', x: 150, y: 260, zone: 'qingzhou', dialog: '妖霧愈發濃重，請前去調查。' },
    { id: 'merchant', name: '符藥商', x: 250, y: 420, zone: 'qingzhou', dialog: '藥品與符紙，童叟無欺。按 E 可購買。', shop: true },
    { id: 'boatman', name: '渡口商人', x: 860, y: 180, zone: 'ferry', dialog: '我的貨被河妖奪走了…' }
  ],
  shrines: [
    { x: 130, y: 130, zone: 'qingzhou' },
    { x: 500, y: 330, zone: 'forest' },
    { x: 860, y: 500, zone: 'ferry' }
  ],
  wanted: null,
  captureCandidate: null,
  logs: []
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('playerStats');
const questEl = document.getElementById('questList');
const soulEl = document.getElementById('soulList');
const logEl = document.getElementById('log');
const hintEl = document.getElementById('hintText');

function spawnMonster(name, x, y, soulType) {
  return { name, x, y, hp: 50, maxHp: 50, alive: true, soulType, atk: 8, cd: 0 };
}

function log(msg) {
  world.logs.unshift(`【${new Date().toLocaleTimeString()}】${msg}`);
  world.logs = world.logs.slice(0, 25);
  logEl.innerHTML = world.logs.map((m) => `<div>${m}</div>`).join('');
}

function saveGame() {
  const data = {
    level: player.level,
    exp: player.exp,
    hpMax: player.hpMax,
    mpMax: player.mpMax,
    hp: player.hp,
    mp: player.mp,
    silver: player.silver,
    gear: player.gear,
    bag: player.bag,
    quests: player.quests,
    souls: player.souls,
    mapId: player.mapId,
    infamy: player.infamy,
    x: player.x,
    y: player.y
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  log('已存檔到 localStorage。');
}

function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return log('沒有找到存檔。');
  const data = JSON.parse(raw);
  Object.assign(player, data);
  log('讀取存檔成功。');
  renderUI();
}

function resetGame() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function nearestZone() {
  const z = mapZones.find((zone) => player.x >= zone.x && player.x < zone.x + zone.w);
  player.mapId = z?.id || 'qingzhou';
  return z;
}

function renderMap() {
  for (const zone of mapZones) {
    ctx.fillStyle = zone.color;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.fillStyle = '#ffffffcc';
    ctx.font = '20px sans-serif';
    ctx.fillText(zone.name, zone.x + 18, 30);
  }

  world.shrines.forEach((s) => {
    ctx.fillStyle = '#e6d58d';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1c2f';
    ctx.fillText('神龕', s.x - 20, s.y - 14);
  });
}

function renderEntities() {
  world.npcs.forEach((n) => {
    ctx.fillStyle = '#f3f4ff';
    ctx.fillRect(n.x - 10, n.y - 10, 20, 20);
    ctx.fillStyle = '#111';
    ctx.fillText(n.name, n.x - 26, n.y - 14);
  });

  world.monsters.forEach((m) => {
    if (!m.alive) return;
    ctx.fillStyle = '#9d2f2f';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(m.name, m.x - 22, m.y - 18);
  });

  if (world.wanted) {
    ctx.fillStyle = '#3f6fd2';
    ctx.beginPath();
    ctx.arc(world.wanted.x, world.wanted.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(world.wanted.name, world.wanted.x - 28, world.wanted.y - 18);
  }
}

function renderPlayer() {
  ctx.fillStyle = player.mount ? '#f5d08f' : '#f0f2ff';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r + (player.mount ? 6 : 0), 0, Math.PI * 2);
  ctx.fill();

  if (player.shield > 0) {
    ctx.strokeStyle = '#69d2ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r + 12, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function interact() {
  const npc = world.npcs.find((n) => dist(player, n) < 54);
  if (!npc) return log('附近沒有可互動對象。');
  log(`${npc.name}：${npc.dialog}`);

  if (npc.id === 'elder' && !player.quests.main_1.done) {
    player.quests.main_1.step = '擊敗任意 2 隻妖怪並回報鎮長';
    log('主線更新：' + player.quests.main_1.step);
  }

  if (npc.shop) {
    if (player.silver >= 30) {
      player.silver -= 30;
      player.bag.potion += 1;
      player.bag.talisman += 1;
      log('購買成功：藥品+1、符紙+1（-30銀兩）');
    } else {
      log('銀兩不足，無法購買。');
    }
  }
}

function attack() {
  const target = world.monsters.find((m) => m.alive && dist(player, m) < 70);
  if (!target) return log('攻擊落空。');
  const dmg = 20 + Math.floor(Math.random() * 8);
  target.hp -= dmg;
  log(`你對 ${target.name} 造成 ${dmg} 傷害。`);
  if (target.hp <= 0) {
    target.alive = false;
    player.exp += 30;
    player.silver += 18;
    player.infamy += 4;
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
    }
  }
}

function castSkill() {
  const cdMod = player.souls.some((s) => s.id === 'river') ? 0.6 : 1;
  if (player.waterSkillCd > 0) return log('水系技能冷卻中。');
  if (player.mp < 12) return log('法力不足。');
  player.mp -= 12;
  player.waterSkillCd = 160 * cdMod;

  world.monsters.forEach((m) => {
    if (m.alive && dist(player, m) < 110) {
      m.hp -= 26;
      if (m.hp <= 0) m.alive = false;
    }
  });
  log('施放「滄浪符」，附近妖怪受到水系傷害。');
}

function updateWanted() {
  if (player.infamy >= 50 && !world.wanted) {
    world.wanted = { name: '城隍司捕快', x: player.x + 80, y: player.y + 30, atk: 12 };
    log('惡名過高！城隍司開始追捕你。');
  }
  if (world.wanted) {
    const dx = player.x - world.wanted.x;
    const dy = player.y - world.wanted.y;
    const len = Math.hypot(dx, dy) || 1;
    world.wanted.x += (dx / len) * 1.2;
    world.wanted.y += (dy / len) * 1.2;
    if (dist(player, world.wanted) < 22) {
      damagePlayer(world.wanted.atk);
      log('你被追捕者擊中！');
    }
  }
}

function damagePlayer(amount) {
  let dmg = amount;
  if (player.shield > 0) {
    const blocked = Math.min(player.shield, dmg);
    player.shield -= blocked;
    dmg -= blocked;
  }
  player.hp -= dmg;
  if (player.hp <= player.hpMax * 0.3 && player.souls.some((s) => s.id === 'mountain') && player.shield <= 0) {
    player.shield = 28;
    log('山鬼妖魂觸發：自動生成護盾！');
  }
  if (player.hp <= 0) handleDeath();
}

function handleDeath() {
  player.silver = Math.max(0, player.silver - 50);
  player.gear.durability = Math.max(0, player.gear.durability - 15);
  player.debuffTimer = 600;

  const shrine = nearestShrine();
  player.x = shrine.x + 20;
  player.y = shrine.y + 20;
  player.hp = Math.floor(player.hpMax * 0.65);
  player.mp = Math.floor(player.mpMax * 0.65);

  log('你已陣亡，於最近神龕復活。死亡懲罰：銀兩減少、耐久下降、短暫虛弱。');
}

function nearestShrine() {
  return world.shrines.reduce((prev, cur) => (dist(player, cur) < dist(player, prev) ? cur : prev), world.shrines[0]);
}

function movePlayer() {
  const speed = player.mount ? player.speed * 1.7 : player.speed;
  const weakened = player.debuffTimer > 0 ? 0.75 : 1;
  if (world.joy) {
    player.x += world.joy.x * speed * weakened;
    player.y += world.joy.y * speed * weakened;
  }
  if (world.keys['w'] || world.keys['arrowup']) player.y -= speed * weakened;
  if (world.keys['s'] || world.keys['arrowdown']) player.y += speed * weakened;
  if (world.keys['a'] || world.keys['arrowleft']) player.x -= speed * weakened;
  if (world.keys['d'] || world.keys['arrowright']) player.x += speed * weakened;

  player.x = Math.max(16, Math.min(canvas.width - 16, player.x));
  player.y = Math.max(16, Math.min(canvas.height - 16, player.y));
}

function updateMonsters() {
  world.monsters.forEach((m) => {
    if (!m.alive) return;
    const dx = player.x - m.x;
    const dy = player.y - m.y;
    const len = Math.hypot(dx, dy) || 1;
    if (len < 140) {
      m.x += (dx / len) * 0.8;
      m.y += (dy / len) * 0.8;
      if (len < 26 && m.cd <= 0) {
        damagePlayer(m.atk);
        m.cd = 50;
      }
    }
    if (m.cd > 0) m.cd--;
  });
}

function updateQuestProgress() {
  const killed = world.monsters.filter((m) => !m.alive).length;
  if (killed >= 2 && !player.quests.main_1.done) {
    player.quests.main_1.done = true;
    player.quests.main_1.step = '已完成，回青州小鎮領賞';
  }
  if (!player.quests.side_1.done && !world.monsters.find((m) => m.name === '河精' && m.alive)) {
    player.quests.side_1.done = true;
    player.quests.side_1.step = '已尋回渡口失物';
  }
}

function renderUI() {
  const zone = nearestZone();
  const foxHint = player.souls.some((s) => s.id === 'fox') ? '（小燈狐提示：妖霧森林北側有寶箱）' : '';
  hintEl.textContent = `${zone?.name || ''}｜${foxHint}`;

  statsEl.innerHTML = `
    <div>等級：${player.level}</div><div>經驗：${player.exp}/${player.nextExp}</div>
    <div>生命：${Math.max(0, Math.floor(player.hp))}/${player.hpMax}</div><div>法力：${Math.max(0, Math.floor(player.mp))}/${player.mpMax}</div>
    <div>銀兩：${player.silver}</div><div>惡名值：${player.infamy}</div>
    <div>裝備：${player.gear.weapon}/${player.gear.armor}</div><div>耐久：${player.gear.durability}%</div>
    <div>背包：藥${player.bag.potion} 符${player.bag.talisman}</div><div>目前地圖：${zone?.name || '-'}</div>
  `;

  questEl.innerHTML = Object.values(player.quests)
    .map((q) => `<li>${q.name}：${q.step}${q.done ? ' ✅' : ''}</li>`)
    .join('');

  soulEl.innerHTML = player.souls.length
    ? player.souls.map((s) => `<li>${s.name} - ${s.passive}</li>`).join('')
    : '<li>尚未締結妖魂契約</li>';
}

function openChoiceModal(monster) {
  const modal = document.getElementById('choiceModal');
  document.getElementById('choiceTitle').textContent = `處置 ${monster.name}`;
  document.getElementById('choiceDesc').textContent = '你可選擇斬殺獲取材料，或收服締結妖魂契約。';
  modal.classList.remove('hidden');
}

function setupChoiceModal() {
  const modal = document.getElementById('choiceModal');
  document.getElementById('killChoice').onclick = () => {
    if (!world.captureCandidate) return;
    player.bag.herb += 1;
    log('你選擇斬殺，獲得妖材。');
    world.captureCandidate = null;
    modal.classList.add('hidden');
  };
  document.getElementById('captureChoice').onclick = () => {
    const c = world.captureCandidate;
    if (!c) return;
    const soul = soulDatabase[c.soulType];
    if (soul) {
      player.souls.push(soul);
      log(`締結契約成功：${soul.name} 加入。被動：${soul.passive}`);
    }
    world.captureCandidate = null;
    modal.classList.add('hidden');
  };
}

function bindInput() {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    world.keys[k] = true;
    if (k === 'j') attack();
    if (k === 'e') interact();
    if (k === 'm') { player.mount = !player.mount; log(player.mount ? '已上馬。' : '已下馬。'); }
    if (k === 'k') castSkill();
    if (k === 'b' && player.bag.potion > 0) {
      player.bag.potion--;
      player.hp = Math.min(player.hpMax, player.hp + 45);
      log('使用藥品恢復生命。');
    }
  });
  window.addEventListener('keyup', (e) => { world.keys[e.key.toLowerCase()] = false; });

  document.getElementById('saveBtn').onclick = saveGame;
  document.getElementById('loadBtn').onclick = loadGame;
  document.getElementById('resetBtn').onclick = resetGame;

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

  const moveStick = (clientX, clientY) => {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    const max = 35;
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

function tick() {
  movePlayer();
  updateMonsters();
  updateWanted();
  updateQuestProgress();

  if (player.debuffTimer > 0) player.debuffTimer--;
  if (player.waterSkillCd > 0) player.waterSkillCd--;
  if (player.mp < player.mpMax) player.mp += 0.02;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderMap();
  renderEntities();
  renderPlayer();
  renderUI();

  requestAnimationFrame(tick);
}

bindInput();
renderUI();
log('歡迎來到《山海行者》原型。');
requestAnimationFrame(tick);
