const CARDS = [
  { rank: '6',  value: 6,  suit: '♠', color: 'black' },
  { rank: '7',  value: 7,  suit: '♥', color: 'red'   },
  { rank: '8',  value: 8,  suit: '♣', color: 'black' },
  { rank: '9',  value: 9,  suit: '♦', color: 'red'   },
  { rank: '10', value: 10, suit: '♠', color: 'black' },
  { rank: 'J',  value: 2,  suit: '♥', color: 'red'   },
  { rank: 'Q',  value: 3,  suit: '♣', color: 'black' },
  { rank: 'K',  value: 4,  suit: '♦', color: 'red'   },
  { rank: 'A',  value: 11, suit: '♠', color: 'black' }
];

const ROUNDS = 3;
const TARGET = 21;
const CARD_SPACING = 44;
const CARD_ROTATION = 7;

const $ = (id) => document.getElementById(id);
const userPanel    = $('userPanel');
const botPanel     = $('botPanel');
const userCardsEl  = $('userCards');
const botCardsEl   = $('botCards');
const userScoreEl  = $('userScore');
const botScoreEl   = $('botScore');
const userNameEl   = $('userName');
const statusBar    = $('statusBar');
const statusText   = $('statusText');
const startBtn     = $('startBtn');
const drawBtn      = $('drawBtn');
const modal        = $('modal');
const modalEmoji   = $('modalEmoji');
const modalTitle   = $('modalTitle');
const modalSubtitle = $('modalSubtitle');
const modalUser    = $('modalUser');
const modalBot     = $('modalBot');
const playAgainBtn = $('playAgainBtn');
const diffBtns     = document.querySelectorAll('.diff-btn');
const diffIndicator = $('diffIndicator');

let state = {
  playerName: '',
  userCards: [],
  botCards: [],
  userTotal: 0,
  botTotal: 0,
  playerTurns: 0,
  botTurns: 0,
  playing: false,
  waitingForPlayer: false,
  difficulty: 'easy'
};

const DIFFICULTY_CONFIG = {
  easy:   { randomChance: 0.65, smartFallbackChance: 0.5 },
  medium: { randomChance: 0.35, smartFallbackChance: 0.25 },
  hard:   { randomChance: 0.05, smartFallbackChance: 0.05 }
};

document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5) * 2;
  const y = (e.clientY / window.innerHeight - 0.5) * 2;

  const layers = document.querySelectorAll('[data-speed]');
  layers.forEach(layer => {
    const speed = parseFloat(layer.getAttribute('data-speed'));
    const moveX = x * speed * 100;
    const moveY = y * speed * 100;
    layer.style.transform = `translate(${moveX}px, ${moveY}px)`;
  });
});

const randomCard = () => CARDS[Math.floor(Math.random() * CARDS.length)];
const sumValues = (arr) => arr.reduce((s, c) => s + c.value, 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function askName() {
  let name = '';
  while (true) {
    name = prompt('Введи своє ім\'я (2–20 символів):', state.playerName || '');
    if (name === null) { name = 'Гравець'; break; }
    name = name.trim();
    if (name.length >= 2 && name.length <= 20) break;
    alert('Ім\'я має містити від 2 до 20 символів. Спробуй ще раз.');
  }
  return name;
}

function createCardElement(card) {
  const el = document.createElement('div');
  el.className = `card card--${card.color} deal`;
  el.innerHTML = `
    <div class="card-rank">${card.rank}</div>
    <div class="card-suit">${card.suit}</div>
    <div class="card-value-badge">${card.value}</div>
  `;
  el.title = `${card.rank} — ${card.value} очок`;

  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--mx', x + '%');
    el.style.setProperty('--my', y + '%');
  });

  return el;
}

function layoutCards(container) {
  const cards = Array.from(container.children);
  const total = cards.length;
  cards.forEach((card, i) => {
    const offset = (i - (total - 1) / 2) * CARD_SPACING;
    const rotation = (i - (total - 1) / 2) * CARD_ROTATION;
    card.style.setProperty('--offset-x', `${offset}px`);
    card.style.setProperty('--rotation', `${rotation}deg`);
    card.style.zIndex = i + 1;
  });
}

async function addCard(container, card) {
  const el = createCardElement(card);
  container.appendChild(el);
  layoutCards(container);
  await sleep(1150);
  el.classList.remove('deal');
  return el;
}

function updateScore(el, value) {
  el.textContent = value;
  el.classList.remove('pop', 'bust');
  void el.offsetWidth;
  if (value > TARGET) { el.classList.add('bust'); } 
  else { el.classList.add('pop'); }
}

function setActive(panel) {
  userPanel.classList.remove('active');
  botPanel.classList.remove('active');
  if (panel) panel.classList.add('active');
}

function setStatus(text, mode = '') {
  statusText.textContent = text;
  statusBar.className = 'status-bar' + (mode ? ' ' + mode : '');
}

function resetBoard() {
  userCardsEl.innerHTML = '';
  botCardsEl.innerHTML = '';
  userScoreEl.textContent = '0';
  botScoreEl.textContent = '0';
  userScoreEl.classList.remove('pop', 'bust');
  botScoreEl.classList.remove('pop', 'bust');
  state.userCards = [];
  state.botCards = [];
  state.userTotal = 0;
  state.botTotal = 0;
  state.playerTurns = 0;
  state.botTurns = 0;
  state.waitingForPlayer = false;
  setActive(null);
  setStatus('Натисни «Почати гру», щоб роздати карти');
}

function showDrawButton(show) {
  drawBtn.classList.toggle('hidden', !show);
  drawBtn.disabled = !show;
  state.waitingForPlayer = show;
}

async function startGame() {
  if (state.playing) return;
  state.playerName = askName();
  userNameEl.textContent = state.playerName;
  resetBoard();
  state.playing = true;
  startBtn.disabled = true;
  showDrawButton(false);
  await nextPlayerTurn();
}

async function nextPlayerTurn() {
  if (state.playerTurns >= ROUNDS) { await botTurn(); return; }
  setActive(userPanel);
  setStatus(`${state.playerName}, твій хід (${state.playerTurns + 1}/${ROUNDS}). Натисни «Взяти карту»`);
  showDrawButton(true);
}

async function handleDraw() {
  if (!state.waitingForPlayer || !state.playing) return;
  if (state.playerTurns >= ROUNDS) return;

  showDrawButton(false);
  state.waitingForPlayer = false;
  state.playerTurns++;

  const card = randomCard();
  state.userCards.push(card);
  setStatus(`${state.playerName} тягне карту...`);
  await addCard(userCardsEl, card);
  state.userTotal = sumValues(state.userCards);
  updateScore(userScoreEl, state.userTotal);
  await sleep(250);

  if (state.playerTurns < ROUNDS) { await nextPlayerTurn(); } 
  else { await botTurn(); }
}

async function botTurn() {
  setActive(botPanel);
  setStatus('Комп\'ютер тягне карти...');
  showDrawButton(false);

  while (state.botTurns < ROUNDS) {
    state.botTurns++;
    await sleep(700);
    const card = chooseBotCard();
    state.botCards.push(card);
    await addCard(botCardsEl, card);
    state.botTotal = sumValues(state.botCards);
    updateScore(botScoreEl, state.botTotal);

    if (state.botTotal > TARGET) {
      setStatus(`Комп'ютер перебрав! (${state.botTotal})`);
      await sleep(600);
      break;
    }
  }

  await sleep(400);
  setActive(null);
  showResult();
  state.playing = false;
  startBtn.disabled = false;
}

function chooseBotCard() {
  const config = DIFFICULTY_CONFIG[state.difficulty];
  const needed = TARGET - state.botTotal;

  if (Math.random() < config.randomChance) {
    return randomCard();
  }

  const safeCards = CARDS.filter(c => c.value <= needed);
  if (safeCards.length > 0) {
    if (Math.random() < config.smartFallbackChance) {
      return randomCard();
    }
    safeCards.sort((a, b) => b.value - a.value);
    return safeCards[0];
  }

  const sorted = [...CARDS].sort((a, b) => a.value - b.value);
  return sorted[0];
}

function showResult() {
  const u = state.userTotal;
  const b = state.botTotal;
  const userBust = u > TARGET;
  const botBust = b > TARGET;

  let emoji, title, subtitle, mode;

  if (userBust && botBust) {
    if (u < b) {
      emoji = '🏆'; title = 'ПЕРЕМОГА'; subtitle = 'Обидва перебрали, але ти ближче до 21';
      mode = 'win'; setStatus(`${state.playerName}, ти переміг! (перебір: ${u} проти ${b})`, 'win');
    } else if (u > b) {
      emoji = '💀'; title = 'ПОРАЗКА'; subtitle = 'Обидва перебрали, але бот ближче';
      mode = 'lose'; setStatus(`Поразка. Перебір: ${u} проти ${b}`, 'lose');
    } else {
      emoji = '🤝'; title = 'НІЧИЯ'; subtitle = 'Обидва перебрали з однаковим результатом';
      mode = 'draw'; setStatus(`Нічия! ${u} : ${b}`, 'draw');
    }
  } else if (userBust) {
    emoji = '💀'; title = 'ПЕРЕБІР'; subtitle = `Ти набрав ${u} — це більше 21`;
    mode = 'lose'; setStatus(`Перебір! ${u} > 21. Комп'ютер виграв`, 'lose');
  } else if (botBust) {
    emoji = '🏆'; title = 'ПЕРЕМОГА'; subtitle = `Комп'ютер перебрав (${b} > 21)`;
    mode = 'win'; setStatus(`${state.playerName}, комп'ютер перебрав! ${u} : ${b}`, 'win');
  } else if (u > b) {
    emoji = '🏆'; title = 'ПЕРЕМОГА'; subtitle = 'Ти переміг комп\'ютер';
    mode = 'win'; setStatus(`${state.playerName}, ти переміг! ${u} : ${b}`, 'win');
  } else if (u < b) {
    emoji = '💀'; title = 'ПОРАЗКА'; subtitle = 'Комп\'ютер виграв цього разу';
    mode = 'lose'; setStatus(`${u} : ${b} — комп'ютер сильніший`, 'lose');
  } else {
    emoji = '🤝'; title = 'НІЧИЯ'; subtitle = 'Однакова кількість очок';
    mode = 'draw'; setStatus(`Нічия! ${u} : ${b}`, 'draw');
  }

  modalEmoji.textContent = emoji;
  modalTitle.textContent = title;
  modalSubtitle.textContent = subtitle;
  modalUser.textContent = u + (userBust ? ' (перебір)' : '');
  modalBot.textContent = b + (botBust ? ' (перебір)' : '');

  setTimeout(() => modal.classList.add('show'), 350);
}

function updateIndicator(btn) {
  if (!diffIndicator) return;
  const btnRect = btn.getBoundingClientRect();
  const parentRect = btn.parentElement.getBoundingClientRect();
  
  diffIndicator.style.width = `${btnRect.width}px`;
  diffIndicator.style.transform = `translateX(${btnRect.left - parentRect.left - 4}px)`;
}

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    state.difficulty = btn.dataset.diff;
    
    updateIndicator(btn);
  });
});

window.addEventListener('DOMContentLoaded', () => {
  userNameEl.textContent = 'Гравець';
  
  const activeBtn = document.querySelector('.diff-btn.active');
  if (activeBtn) updateIndicator(activeBtn);
  
  window.addEventListener('resize', () => {
    layoutCards(userCardsEl);
    layoutCards(botCardsEl);
    const currentActive = document.querySelector('.diff-btn.active');
    if (currentActive) updateIndicator(currentActive);
  });
});

startBtn.addEventListener('click', startGame);
drawBtn.addEventListener('click', handleDraw);

playAgainBtn.addEventListener('click', () => {
  modal.classList.remove('show');
  setTimeout(() => {
    resetBoard();
    startBtn.disabled = false;
    showDrawButton(false);
  }, 350);
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.remove('show');
});