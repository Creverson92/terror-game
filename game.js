const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const screens = {
  menu: document.getElementById("menu"),
  help: document.getElementById("help"),
  game: document.getElementById("game"),
};

const ui = {
  battery: document.getElementById("batteryMeter"),
  sanity: document.getElementById("sanityMeter"),
  level: document.getElementById("levelLabel"),
  score: document.getElementById("scoreLabel"),
  objective: document.getElementById("objective"),
  prompt: document.getElementById("prompt"),
  note: document.getElementById("note"),
  noteText: document.getElementById("noteText"),
  pause: document.getElementById("pause"),
  ending: document.getElementById("ending"),
  endingTitle: document.getElementById("endingTitle"),
  endingText: document.getElementById("endingText"),
  endingRanking: document.getElementById("endingRanking"),
  playerName: document.getElementById("playerName"),
  onlinePlayers: document.getElementById("onlinePlayers"),
  rankingList: document.getElementById("rankingList"),
};

const keys = new Set();
const touchMove = { x: 0, y: 0, run: false };
let lastTime = 0;
let audio;
let ambientNodes;
let nextScareSound = 0;
let nextMenuSound = 0;
let finalBossCalled = false;
let sessionId = localStorage.getItem("euzebiosSessionId") || Math.random().toString(36).slice(2);
localStorage.setItem("euzebiosSessionId", sessionId);
let onlineTimer;
let scoreSent = false;

const tile = 64;
const map = [
  "####################",
  "#....#.......#.....#",
  "#.N..#..K....#..N..#",
  "#....#.......#.....#",
  "#....####D####.....#",
  "#..................#",
  "###D######..#####D##",
  "#........#..#......#",
  "#..N.....D..D...N..#",
  "#........#..#......#",
  "######D###..###D####",
  "#..................#",
  "#....#.......#.....#",
  "#..P.#..E....#..B..#",
  "#....#.......#.....#",
  "####################",
];

const levelSetups = [
  { notes: [[2, 2], [16, 2], [3, 8], [16, 8]], key: [8, 2], basement: [17, 13], exit: [8, 13], player: [3.5, 13.5], entity: [17.5, 2.5], tint: "rgba(80, 58, 38, 0.10)" },
  { notes: [[3, 3], [11, 2], [2, 11], [15, 12]], key: [17, 8], basement: [2, 13], exit: [10, 8], player: [2.5, 2.5], entity: [17.5, 13.5], tint: "rgba(61, 91, 82, 0.12)" },
  { notes: [[8, 2], [16, 3], [7, 8], [3, 13]], key: [2, 8], basement: [17, 2], exit: [11, 13], player: [10.5, 13.5], entity: [2.5, 2.5], tint: "rgba(90, 44, 48, 0.14)" },
  { notes: [[2, 2], [10, 5], [17, 8], [8, 13]], key: [16, 13], basement: [3, 8], exit: [11, 2], player: [17.5, 13.5], entity: [2.5, 8.5], tint: "rgba(45, 70, 104, 0.12)" },
  { notes: [[16, 2], [2, 3], [11, 8], [17, 13]], key: [3, 13], basement: [8, 2], exit: [2, 8], player: [11.5, 13.5], entity: [17.5, 2.5], tint: "rgba(93, 79, 38, 0.12)" },
  { notes: [[3, 2], [17, 3], [2, 8], [10, 13]], key: [11, 8], basement: [16, 13], exit: [8, 2], player: [2.5, 13.5], entity: [17.5, 8.5], tint: "rgba(72, 50, 86, 0.14)" },
  { notes: [[8, 2], [2, 8], [17, 8], [3, 13]], key: [16, 2], basement: [11, 13], exit: [2, 2], player: [17.5, 13.5], entity: [3.5, 8.5], tint: "rgba(35, 87, 78, 0.14)" },
  { notes: [[2, 3], [11, 2], [16, 8], [8, 13]], key: [3, 8], basement: [17, 13], exit: [16, 2], player: [8.5, 13.5], entity: [2.5, 2.5], tint: "rgba(95, 38, 64, 0.14)" },
  { notes: [[17, 2], [3, 3], [8, 8], [16, 13]], key: [2, 13], basement: [11, 2], exit: [3, 8], player: [16.5, 8.5], entity: [2.5, 13.5], tint: "rgba(94, 30, 30, 0.16)" },
  { notes: [[2, 2], [17, 2], [2, 13], [17, 13]], key: [10, 8], basement: [8, 13], exit: [11, 2], player: [10.5, 13.5], entity: [10.5, 2.5], tint: "rgba(177, 29, 40, 0.18)" },
];

const state = {
  mode: "menu",
  paused: false,
  won: false,
  lost: false,
  level: 1,
  score: 0,
  levelStart: Date.now(),
  battery: 100,
  sanity: 100,
  foundNotes: 0,
  hasKey: false,
  flashlight: true,
  shake: 0,
  messageTime: 0,
  prompt: "",
};

const player = { x: 3.5 * tile, y: 13.5 * tile, r: 15, speed: 150, facing: -Math.PI / 2, noise: 0 };
const entity = { x: 17.5 * tile, y: 2.5 * tile, r: 18, speed: 80, awake: false, pulse: 0 };
const notes = [];
let keyItem = null;
let exitItem = null;
let basementItem = null;

const noteTexts = [
  "A mae escreveu que Euzebio trancava o porao quando a tempestade chegava. Ninguem podia ouvir o que respondia la embaixo.",
  "Fotografia rasgada: quatro pessoas na sala, mas cinco sombras no chao.",
  "Gravacao: 'Se a luz falhar, fique parado. Ela aprende pelo barulho.'",
  "Bilhete final: 'A chave nao abre a saida. Ela abre a culpa.'",
];

const levels = Array.from({ length: 10 }, (_, index) => ({
  number: index + 1,
  notesNeeded: Math.min(4, 2 + Math.floor(index / 3)),
  batteryDrain: 3.8 + index * 0.55,
  entitySpeed: 72 + index * 10,
  sanityDrain: 5.5 + index * 0.65,
  title: [
    "Entrada da Casa",
    "Corredor das Fotos",
    "Quarto Trancado",
    "Sala do Relogio",
    "Cozinha Fria",
    "Sotao dos Passos",
    "Porao Aberto",
    "Capela de Euzebio",
    "A Casa Acordada",
    "Ultima Porta",
  ][index],
}));

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("screen-active"));
  screens[name].classList.add("screen-active");
  state.mode = name;
}

function initWorld() {
  notes.length = 0;
  keyItem = null;
  exitItem = null;
  basementItem = null;
  const setup = levelSetups[state.level - 1] || levelSetups[0];
  setup.notes.forEach(([x, y], index) => {
    notes.push({ x: (x + 0.5) * tile, y: (y + 0.5) * tile, taken: false, text: noteTexts[index] });
  });
  keyItem = { x: (setup.key[0] + 0.5) * tile, y: (setup.key[1] + 0.5) * tile, taken: false };
  exitItem = { x: (setup.exit[0] + 0.5) * tile, y: (setup.exit[1] + 0.5) * tile, taken: false };
  basementItem = { x: (setup.basement[0] + 0.5) * tile, y: (setup.basement[1] + 0.5) * tile, taken: false };
}

function playerName() {
  return (ui.playerName.value || localStorage.getItem("euzebiosPlayerName") || "Jogador").trim().slice(0, 18) || "Jogador";
}

function resetStage(levelNumber = 1, keepScore = false) {
  const level = levels[levelNumber - 1];
  const setup = levelSetups[levelNumber - 1] || levelSetups[0];
  Object.assign(state, {
    mode: "game",
    paused: false,
    won: false,
    lost: false,
    level: levelNumber,
    score: keepScore ? state.score : 0,
    levelStart: Date.now(),
    battery: Math.max(48, 100 - (levelNumber - 1) * 4),
    sanity: 100,
    foundNotes: 0,
    hasKey: false,
    flashlight: true,
    shake: 0,
    messageTime: 0,
    prompt: "",
  });
  finalBossCalled = false;
  Object.assign(player, { x: setup.player[0] * tile, y: setup.player[1] * tile, facing: -Math.PI / 2, noise: 0 });
  Object.assign(entity, { x: setup.entity[0] * tile, y: setup.entity[1] * tile, speed: level.entitySpeed, awake: levelNumber > 5, pulse: 0 });
  initWorld();
  ui.pause.hidden = true;
  ui.ending.hidden = true;
  ui.note.hidden = true;
  showScreen("game");
  state.prompt = `${level.title}: encontre ${level.notesNeeded} pistas.`;
  state.messageTime = 3;
  updateOnline();
  startAudio();
}

function resetGame() {
  localStorage.setItem("euzebiosPlayerName", playerName());
  scoreSent = false;
  joinOnline();
  resetStage(1, false);
}

function startAudio() {
  if (audio?.state === "suspended") audio.resume();
  if (audio) {
    startAmbient();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio = new AudioContext();
  startAmbient();
}

function unlockMenuAudio() {
  startAudio();
  if (audio?.state === "running") {
    tone(45, 0.45, 0.035, "sawtooth");
    nextMenuSound = 0.8;
  }
}

function startAmbient() {
  if (!audio || ambientNodes) return;
  const drone = audio.createOscillator();
  const wobble = audio.createOscillator();
  const droneGain = audio.createGain();
  const wobbleGain = audio.createGain();
  drone.type = "sawtooth";
  wobble.type = "sine";
  drone.frequency.value = 38;
  wobble.frequency.value = 74;
  droneGain.gain.value = 0.012;
  wobbleGain.gain.value = 0.006;
  drone.connect(droneGain).connect(audio.destination);
  wobble.connect(wobbleGain).connect(audio.destination);
  drone.start();
  wobble.start();
  ambientNodes = { drone, wobble, droneGain, wobbleGain };
}

function tone(freq, duration, gain = 0.03, type = "sine") {
  if (!audio || audio.state !== "running") return;
  const osc = audio.createOscillator();
  const vol = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.value = gain;
  osc.connect(vol).connect(audio.destination);
  osc.start();
  vol.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.stop(audio.currentTime + duration);
}

function noiseBurst(duration = 0.35, gain = 0.035) {
  if (!audio || audio.state !== "running") return;
  const buffer = audio.createBuffer(1, audio.sampleRate * duration, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = audio.createBufferSource();
  const vol = audio.createGain();
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 720;
  vol.gain.value = gain;
  source.buffer = buffer;
  source.connect(filter).connect(vol).connect(audio.destination);
  source.start();
  vol.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
}

function scream(duration = 0.9, gain = 0.055) {
  if (!audio || audio.state !== "running") return;
  const oscA = audio.createOscillator();
  const oscB = audio.createOscillator();
  const oscC = audio.createOscillator();
  const filter = audio.createBiquadFilter();
  const vol = audio.createGain();
  const now = audio.currentTime;
  oscA.type = "sawtooth";
  oscB.type = "square";
  oscC.type = "triangle";
  filter.type = "bandpass";
  filter.frequency.value = 1450;
  filter.Q.value = 8;
  oscA.frequency.setValueAtTime(620 + Math.random() * 120, now);
  oscB.frequency.setValueAtTime(760 + Math.random() * 180, now);
  oscC.frequency.setValueAtTime(930 + Math.random() * 220, now);
  oscA.frequency.exponentialRampToValueAtTime(260, now + duration);
  oscB.frequency.exponentialRampToValueAtTime(330, now + duration);
  oscC.frequency.exponentialRampToValueAtTime(410, now + duration);
  vol.gain.setValueAtTime(0.0001, now);
  vol.gain.exponentialRampToValueAtTime(gain, now + 0.05);
  vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscA.connect(filter);
  oscB.connect(filter);
  oscC.connect(filter);
  filter.connect(vol).connect(audio.destination);
  oscA.start();
  oscB.start();
  oscC.start();
  oscA.stop(now + duration);
  oscB.stop(now + duration);
  oscC.stop(now + duration);
}

function wallAt(x, y) {
  const col = Math.floor(x / tile);
  const row = Math.floor(y / tile);
  const cell = map[row]?.[col] || "#";
  return cell === "#";
}

function moveActor(actor, dx, dy) {
  const nx = actor.x + dx;
  const ny = actor.y + dy;
  if (!wallAt(nx + Math.sign(dx) * actor.r, actor.y) && !wallAt(nx + Math.sign(dx) * actor.r, actor.y - actor.r) && !wallAt(nx + Math.sign(dx) * actor.r, actor.y + actor.r)) {
    actor.x = nx;
  }
  if (!wallAt(actor.x, ny + Math.sign(dy) * actor.r) && !wallAt(actor.x - actor.r, ny + Math.sign(dy) * actor.r) && !wallAt(actor.x + actor.r, ny + Math.sign(dy) * actor.r)) {
    actor.y = ny;
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestInteractable() {
  const items = [
    ...notes.filter((note) => !note.taken).map((note) => ({ type: "note", item: note })),
    !keyItem?.taken && { type: "key", item: keyItem },
    !basementItem?.taken && { type: "basement", item: basementItem },
    { type: "exit", item: exitItem },
  ].filter(Boolean);
  return items.find(({ item }) => distance(player, item) < 52);
}

function interact() {
  if (state.paused || state.lost || state.won || !ui.note.hidden) return;
  const target = nearestInteractable();
  if (!target) return;
  if (target.type === "note") {
    target.item.taken = true;
    state.foundNotes += 1;
    ui.noteText.textContent = target.item.text;
    ui.note.hidden = false;
    tone(220, 0.25, 0.025, "triangle");
  }
  if (target.type === "key") {
    target.item.taken = true;
    state.hasKey = true;
    state.prompt = "Chave do porao encontrada.";
    state.messageTime = 2.2;
    entity.awake = true;
    tone(130, 0.3, 0.04, "sawtooth");
  }
  if (target.type === "basement") {
    if (!state.hasKey) {
      state.prompt = "A porta do porao esta trancada.";
      state.messageTime = 1.8;
      return;
    }
    target.item.taken = true;
    state.prompt = "Voce abriu o porao. A saida rangeu no corredor.";
    state.messageTime = 2.5;
    entity.speed = 112;
    tone(80, 0.55, 0.05, "sawtooth");
    noiseBurst(0.45, 0.045);
  }
  if (target.type === "exit") {
    const needed = levels[state.level - 1].notesNeeded;
    if (state.foundNotes < needed || !basementItem.taken) {
      state.prompt = "A porta nao cede. Falta entender a casa.";
      state.messageTime = 2;
      return;
    }
    completeLevel();
  }
}

function completeLevel() {
  if (finalBossCalled) return;
  const timeBonus = Math.max(0, 900 - Math.floor((Date.now() - state.levelStart) / 1000) * 8);
  state.score += 600 + state.level * 160 + state.foundNotes * 90 + Math.floor(state.battery * 4) + Math.floor(state.sanity * 5) + timeBonus;
  if (state.level === 10 && !finalBossCalled) {
    finalBossCalled = true;
    state.prompt = "CREVELSON apareceu na ultima porta.";
    state.messageTime = 3.2;
    crevelsonCall();
    setTimeout(() => finish(true), 1800);
    return;
  }
  state.level += 1;
  tone(360, 0.25, 0.035, "triangle");
  resetStage(state.level, true);
}

function crevelsonCall() {
  tone(38, 1.1, 0.09, "sawtooth");
  tone(57, 1.4, 0.075, "square");
  noiseBurst(0.9, 0.06);
  scream(1.35, 0.08);
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const voice = new SpeechSynthesisUtterance("CREVELLLLLLSOOOON");
    voice.lang = "pt-BR";
    voice.rate = 0.55;
    voice.pitch = 0.35;
    voice.volume = 1;
    window.speechSynthesis.speak(voice);
  }
}

function finish(win) {
  state.won = win;
  state.lost = !win;
  if (!win) state.score += Math.max(0, state.level - 1) * 120;
  ui.endingTitle.textContent = win ? "Voce zerou as 10 fases" : "A casa decorou seus passos";
  ui.endingText.textContent = win
    ? `Pontuacao final: ${state.score} pts. Seu nome entrou no ranking online.`
    : `Voce caiu na fase ${state.level}. Pontuacao: ${state.score} pts.`;
  ui.ending.hidden = false;
  sendScore(win);
  tone(win ? 330 : 55, 0.9, 0.06, win ? "triangle" : "sawtooth");
}

function update(dt) {
  if ((state.mode === "menu" || state.mode === "help") && audio?.state === "running") {
    updateMenuAudio(dt);
  }
  if (state.mode !== "game" || state.paused || state.won || state.lost || !ui.note.hidden) return;
  let dx = 0;
  let dy = 0;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;
  dx += touchMove.x;
  dy += touchMove.y;
  const length = Math.hypot(dx, dy) || 1;
  const running = (keys.has("shift") || touchMove.run) && (dx || dy);
  const speed = player.speed * (running ? 1.65 : 1);
  if (dx || dy) {
    player.facing = Math.atan2(dy, dx);
    moveActor(player, (dx / length) * speed * dt, (dy / length) * speed * dt);
    player.noise = Math.min(100, player.noise + (running ? 70 : 24) * dt);
  } else {
    player.noise = Math.max(0, player.noise - 45 * dt);
  }

  const level = levels[state.level - 1];
  if (state.flashlight) state.battery = Math.max(0, state.battery - level.batteryDrain * dt);
  if (state.battery <= 0) state.flashlight = false;

  const fearDistance = distance(player, entity);
  if (fearDistance < 190 || !state.flashlight) state.sanity -= (fearDistance < 190 ? level.sanityDrain : 2.5) * dt;
  else state.sanity = Math.min(100, state.sanity + 1.2 * dt);
  if (state.sanity <= 0) finish(false);

  entity.awake = entity.awake || state.foundNotes >= Math.max(1, level.notesNeeded - 1) || player.noise > 60;
  if (entity.awake) {
    const chaseBoost = player.noise > 40 ? 1.35 : 1;
    const angle = Math.atan2(player.y - entity.y, player.x - entity.x);
    moveActor(entity, Math.cos(angle) * entity.speed * chaseBoost * dt, Math.sin(angle) * entity.speed * chaseBoost * dt);
    entity.pulse += dt;
    if (Math.sin(entity.pulse * 8) > 0.97) tone(46 + Math.random() * 15, 0.12, 0.015, "sawtooth");
  }
  if (fearDistance < 34) finish(false);
  updateTerrorAudio(fearDistance, dt);

  state.messageTime = Math.max(0, state.messageTime - dt);
  updateUi();
}

function updateMenuAudio(dt) {
  if (ambientNodes) {
    ambientNodes.drone.frequency.setTargetAtTime(34, audio.currentTime, 0.4);
    ambientNodes.droneGain.gain.setTargetAtTime(0.018, audio.currentTime, 0.4);
    ambientNodes.wobbleGain.gain.setTargetAtTime(0.008, audio.currentTime, 0.4);
  }
  nextMenuSound -= dt;
  if (nextMenuSound > 0) return;
  const roll = Math.random();
  if (roll < 0.28) {
    noiseBurst(0.55, 0.035);
    tone(31, 0.8, 0.045, "sawtooth");
    if (Math.random() < 0.45) scream(0.7, 0.04);
  } else if (roll < 0.62) {
    tone(82 + Math.random() * 18, 0.18, 0.018, "triangle");
    tone(44, 0.28, 0.018, "sine");
  } else {
    tone(116 + Math.random() * 35, 0.12, 0.012, "square");
  }
  nextMenuSound = 3.2 + Math.random() * 4.8;
}

function updateTerrorAudio(fearDistance, dt) {
  if (!audio || audio.state !== "running") return;
  if (ambientNodes) {
    const danger = Math.max(0, 1 - fearDistance / 360);
    ambientNodes.drone.frequency.setTargetAtTime(38 + state.level * 1.4 + danger * 18, audio.currentTime, 0.2);
    ambientNodes.droneGain.gain.setTargetAtTime(0.01 + danger * 0.025, audio.currentTime, 0.2);
    ambientNodes.wobbleGain.gain.setTargetAtTime(0.004 + danger * 0.016, audio.currentTime, 0.2);
  }
  nextScareSound -= dt;
  if (nextScareSound <= 0) {
    if (fearDistance < 150) {
      tone(52 + Math.random() * 18, 0.18, 0.04, "sawtooth");
      noiseBurst(0.18, 0.018);
      if (Math.random() < 0.38) scream(0.75, 0.048);
      nextScareSound = 1.1 + Math.random() * 1.2;
    } else if (Math.random() < 0.28) {
      tone(95 + Math.random() * 40, 0.22, 0.012, "triangle");
      nextScareSound = 4 + Math.random() * 6;
    } else {
      nextScareSound = 2;
    }
  }
}

function updateUi() {
  ui.battery.value = state.battery;
  ui.sanity.value = state.sanity;
  ui.level.textContent = `Fase ${state.level}/10`;
  ui.score.textContent = `${state.score} pts`;
  const target = nearestInteractable();
  ui.prompt.textContent = state.messageTime > 0 ? state.prompt : "";
  if (target && state.messageTime <= 0) {
    const labels = {
      note: "E - ler pista",
      key: "E - pegar chave do porao",
      basement: state.hasKey ? "E - abrir porao" : "E - porta trancada",
      exit: "E - tentar sair",
    };
    ui.prompt.textContent = labels[target.type];
  }
  const needed = levels[state.level - 1].notesNeeded;
  if (state.foundNotes < needed) ui.objective.textContent = `${levels[state.level - 1].title}: pistas ${state.foundNotes}/${needed}`;
  else if (!state.hasKey) ui.objective.textContent = "Encontre a chave.";
  else if (!basementItem.taken) ui.objective.textContent = "Abra o porao.";
  else ui.objective.textContent = state.level === 10 ? "Escape pela ultima porta." : "Volte para avancar de fase.";
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const camX = player.x - w / 2;
  const camY = player.y - h / 2;
  ctx.save();
  const shake = state.shake * Math.random();
  ctx.translate(-camX + shake, -camY - shake);

  ctx.fillStyle = "#111211";
  ctx.fillRect(0, 0, map[0].length * tile, map.length * tile);
  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[y].length; x += 1) {
      const cell = map[y][x];
      if (cell === "#") {
        ctx.fillStyle = "#252525";
        ctx.fillRect(x * tile, y * tile, tile, tile);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x * tile + 4, y * tile + 4, tile - 8, tile - 8);
      } else {
        ctx.fillStyle = (x + y) % 2 ? "#151715" : "#181916";
        ctx.fillRect(x * tile, y * tile, tile, tile);
        ctx.strokeStyle = "rgba(255,255,255,0.025)";
        ctx.strokeRect(x * tile, y * tile, tile, tile);
      }
      if (cell === "D") {
        ctx.fillStyle = "#4c3825";
        ctx.fillRect(x * tile + 7, y * tile + 26, tile - 14, 12);
      }
    }
  }

  drawItem(exitItem, "#d8a646", "SAIDA");
  if (!basementItem.taken) drawItem(basementItem, "#6a4632", "PORAO");
  if (!keyItem.taken) drawItem(keyItem, "#d6bd72", "CHAVE");
  notes.filter((note) => !note.taken).forEach((note) => drawItem(note, "#e6dfc6", "PISTA"));

  drawEntity();
  drawPlayer();
  drawLighting(w, h, camX, camY);
  ctx.restore();

  const setup = levelSetups[state.level - 1] || levelSetups[0];
  ctx.fillStyle = setup.tint;
  ctx.fillRect(0, 0, w, h);
  drawVignette(w, h);
}

function drawItem(item, color, label) {
  if (!item) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.font = "10px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(label, item.x, item.y - 16);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing);
  ctx.fillStyle = "#d8d4c7";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -11);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-12, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEntity() {
  const alpha = entity.awake ? 0.9 : 0.32;
  ctx.save();
  ctx.translate(entity.x, entity.y);
  const isBoss = state.level === 10;
  ctx.fillStyle = isBoss ? `rgba(80, 0, 8, ${Math.max(alpha, 0.75)})` : `rgba(10, 10, 10, ${alpha})`;
  ctx.beginPath();
  ctx.arc(0, 0, (isBoss ? 34 : 22) + Math.sin(entity.pulse * 6) * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(177, 29, 40, 0.75)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-9, -3);
  ctx.lineTo(9, -3);
  ctx.stroke();
  if (isBoss) {
    ctx.fillStyle = "#f2efe9";
    ctx.font = "900 13px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("CREVELSON", 0, -42);
  }
  ctx.restore();
}

function drawLighting(w, h, camX, camY) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const darkness = ctx.createRadialGradient(player.x, player.y, 35, player.x, player.y, state.flashlight ? 270 : 96);
  darkness.addColorStop(0, "rgba(0,0,0,0)");
  darkness.addColorStop(0.64, "rgba(0,0,0,0.58)");
  darkness.addColorStop(1, "rgba(0,0,0,0.94)");
  ctx.fillStyle = darkness;
  ctx.fillRect(camX, camY, w, h);

  if (state.flashlight && state.battery > 0) {
    ctx.globalCompositeOperation = "lighter";
    const beamLength = 285;
    const angle = player.facing;
    const grad = ctx.createRadialGradient(player.x, player.y, 0, player.x + Math.cos(angle) * 150, player.y + Math.sin(angle) * 150, beamLength);
    grad.addColorStop(0, "rgba(229, 210, 150, 0.22)");
    grad.addColorStop(1, "rgba(229, 210, 150, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.arc(player.x, player.y, beamLength, angle - 0.42, angle + 0.42);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette(w, h) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.68);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  if (state.flashlight && state.battery < 18 && Math.random() > 0.86) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, w, h);
  }
}

function loop(time) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

document.getElementById("startBtn").addEventListener("click", (event) => {
  event.preventDefault();
  unlockMenuAudio();
  resetGame();
});
document.getElementById("startBtn").addEventListener("pointerup", (event) => {
  event.preventDefault();
  unlockMenuAudio();
  resetGame();
});
document.getElementById("howBtn").addEventListener("click", () => showScreen("help"));
document.getElementById("backBtn").addEventListener("click", () => showScreen("menu"));
document.getElementById("closeNoteBtn").addEventListener("click", () => {
  ui.note.hidden = true;
  entity.awake = true;
});
document.getElementById("resumeBtn").addEventListener("click", () => {
  state.paused = false;
  ui.pause.hidden = true;
});
document.getElementById("restartBtn").addEventListener("click", resetGame);
document.getElementById("endingRestartBtn").addEventListener("click", resetGame);

document.querySelectorAll("[data-touch]").forEach((button) => {
  const direction = button.dataset.touch;
  const setDirection = (active) => {
    const value = active ? 1 : 0;
    if (direction === "up") touchMove.y = -value;
    if (direction === "down") touchMove.y = value;
    if (direction === "left") touchMove.x = -value;
    if (direction === "right") touchMove.x = value;
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    setDirection(true);
  });
  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    setDirection(false);
  });
  button.addEventListener("pointercancel", () => setDirection(false));
  button.addEventListener("pointerleave", () => setDirection(false));
});

document.getElementById("touchRun").addEventListener("pointerdown", (event) => {
  event.preventDefault();
  touchMove.run = true;
});
document.getElementById("touchRun").addEventListener("pointerup", (event) => {
  event.preventDefault();
  touchMove.run = false;
});
document.getElementById("touchLight").addEventListener("click", () => {
  if (state.mode === "game" && state.battery > 0) {
    state.flashlight = !state.flashlight;
    tone(state.flashlight ? 240 : 120, 0.08, 0.02, "square");
  }
});
document.getElementById("touchUse").addEventListener("click", interact);

async function api(path, data) {
  try {
    const options = data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {};
    const response = await fetch(path, options);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function renderOnline(data) {
  if (!data) return;
  const online = data.online || [];
  const ranking = data.ranking || [];
  ui.onlinePlayers.innerHTML = online.length
    ? online.map((player) => `<li><span>${escapeHtml(player.name)}</span><strong>F${player.level} - ${player.score} pts</strong></li>`).join("")
    : "<li>Nenhum jogador conectado</li>";
  const rankingHtml = ranking.length
    ? ranking.slice(0, 10).map((entry) => `<li><span>${escapeHtml(entry.name)}</span><strong>${entry.score} pts - ${entry.result}</strong></li>`).join("")
    : "<li>Sem pontuacao ainda</li>";
  ui.rankingList.innerHTML = rankingHtml;
  ui.endingRanking.innerHTML = rankingHtml;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
}

async function joinOnline() {
  const data = await api("/api/join", { id: sessionId, name: playerName() });
  renderOnline(data);
  if (!onlineTimer) onlineTimer = setInterval(updateOnline, 4000);
}

async function updateOnline() {
  const data = await api("/api/heartbeat", { id: sessionId, name: playerName(), level: state.level, score: state.score });
  renderOnline(data);
}

async function sendScore(win) {
  if (scoreSent) return;
  scoreSent = true;
  const data = await api("/api/score", { id: sessionId, name: playerName(), level: state.level, score: state.score, win });
  renderOnline(data);
}

api("/api/state").then(renderOnline);

window.addEventListener("keydown", (event) => {
  unlockMenuAudio();
  const key = event.key.toLowerCase();
  keys.add(key);
  if (key === "e") interact();
  if (key === "f" && state.mode === "game" && state.battery > 0) {
    state.flashlight = !state.flashlight;
    tone(state.flashlight ? 240 : 120, 0.08, 0.02, "square");
  }
  if (key === "escape" && state.mode === "game" && ui.note.hidden && !state.won && !state.lost) {
    state.paused = !state.paused;
    ui.pause.hidden = !state.paused;
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("pointerdown", unlockMenuAudio, { once: true });
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
initWorld();
requestAnimationFrame(loop);
