const SHEETS = [
  {
    id: 'boys', image: 'assets/boys.jpg', accent: '#6f8da7', filename: '男生信件統計.png',
    people: ['顧星辰', '秋亦帆', '林澤宇', '江叙白']
  },
  {
    id: 'girls', image: 'assets/girls.jpg', accent: '#db6b9a', filename: '女生信件統計.png',
    people: ['蘇晚晴', '夏知柚', '溫以寧', '許星眠']
  }
];

const STORAGE_KEY = 'letter-stat-editor-v1';
const initialState = {
  fontSize: 10,
  activeSheet: 'boys',
  letters: Object.fromEntries(SHEETS.flatMap(sheet => sheet.people.map(name => [name, []]))),
  drafts: Object.fromEntries(SHEETS.flatMap(sheet => sheet.people.map(name => [name, ''])))
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      ...initialState,
      ...saved,
      letters: { ...initialState.letters, ...(saved.letters || {}) },
      drafts: { ...initialState.drafts, ...(saved.drafts || {}) }
    };
  } catch (_) {
    return structuredClone(initialState);
  }
}

let state = loadState();
let toastTimer;
const app = document.querySelector('#app');
const fontSizeInput = document.querySelector('#fontSize');
const fontValue = document.querySelector('#fontValue');

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function buildUI() {
  app.innerHTML = SHEETS.map((sheet) => `
    <section class="sheet-section ${sheet.id === state.activeSheet ? 'active' : ''}" data-sheet="${sheet.id}" style="--accent:${sheet.accent}">
      <div class="canvas-wrap" aria-label="${sheet.id === 'boys' ? '男生' : '女生'}信件底圖">
        <img class="background-image" src="${sheet.image}" alt="" draggable="false">
        ${sheet.people.map((name) => `
          <div class="letter-column" data-person="${name}"></div>
        `).join('')}
      </div>
      <div class="editor-grid">
        ${sheet.people.map((name) => `
          <div class="composer">
            <label for="draft-${name}">${name}</label>
            <textarea id="draft-${name}" data-draft="${name}" maxlength="2500" placeholder="輸入要放進格子裡的信件…">${escapeHTML(state.drafts[name] || '')}</textarea>
            <div class="composer-footer">
              <small>自動換行 · Ctrl/⌘＋Enter 添加</small>
              <button class="add-letter" data-add="${name}">添加</button>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `).join('');

  renderLetters();
  bindDynamicEvents();
  syncFontSize();
}

function escapeHTML(value) {
  const node = document.createElement('div');
  node.textContent = value;
  return node.innerHTML;
}

function renderLetters() {
  document.querySelectorAll('.letter-column').forEach(column => {
    const person = column.dataset.person;
    const entries = state.letters[person] || [];
    if (!entries.length) {
      column.innerHTML = '<div class="empty-hint">文字會顯示在這裡</div>';
      return;
    }
    column.innerHTML = entries.map((text, index) => `
      <div class="letter-entry">
        <div class="entry-text">${escapeHTML(text)}</div>
        <button class="delete-entry" data-delete="${person}" data-index="${index}" aria-label="刪除${person}的這段文字" title="刪除此段">×</button>
      </div>
    `).join('');
  });

  document.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => {
      state.letters[button.dataset.delete].splice(Number(button.dataset.index), 1);
      saveState();
      renderLetters();
      showToast('已刪除這段文字');
    });
  });
}

function bindDynamicEvents() {
  document.querySelectorAll('[data-draft]').forEach(textarea => {
    textarea.addEventListener('input', () => {
      state.drafts[textarea.dataset.draft] = textarea.value;
      saveState();
    });
    textarea.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        addLetter(textarea.dataset.draft);
      }
    });
  });

  document.querySelectorAll('[data-add]').forEach(button => {
    button.addEventListener('click', () => addLetter(button.dataset.add));
  });
}

function addLetter(person) {
  const textarea = document.querySelector(`[data-draft="${person}"]`);
  const value = textarea.value.trim();
  if (!value) {
    textarea.focus();
    showToast('請先輸入文字');
    return;
  }
  state.letters[person].push(value);
  state.drafts[person] = '';
  textarea.value = '';
  saveState();
  renderLetters();
  showToast(`已添加至 ${person}`);
}

function setActiveSheet(id) {
  state.activeSheet = id;
  saveState();
  document.querySelectorAll('.tab').forEach(tab => {
    const active = tab.dataset.target === id;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.sheet-section').forEach(section => {
    section.classList.toggle('active', section.dataset.sheet === id);
  });
}

function syncFontSize() {
  state.fontSize = Math.max(8, Math.min(24, Number(state.fontSize) || 10));
  fontSizeInput.value = state.fontSize;
  fontValue.value = state.fontSize;
  document.documentElement.style.setProperty('--letter-size', state.fontSize);
  saveState();
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => setActiveSheet(tab.dataset.target)));
fontSizeInput.addEventListener('input', () => { state.fontSize = Number(fontSizeInput.value); syncFontSize(); });
document.querySelector('#fontMinus').addEventListener('click', () => { state.fontSize -= 1; syncFontSize(); });
document.querySelector('#fontPlus').addEventListener('click', () => { state.fontSize += 1; syncFontSize(); });

const confirmDialog = document.querySelector('#confirmDialog');
document.querySelector('#clearAll').addEventListener('click', () => confirmDialog.showModal());
confirmDialog.addEventListener('close', () => {
  if (confirmDialog.returnValue !== 'confirm') return;
  Object.keys(state.letters).forEach(person => { state.letters[person] = []; state.drafts[person] = ''; });
  saveState();
  buildUI();
  showToast('所有文字已清除');
});

document.querySelector('#exportCurrent').addEventListener('click', async () => {
  const sheet = SHEETS.find(item => item.id === state.activeSheet);
  await exportSheet(sheet);
});

document.querySelector('#exportAll').addEventListener('click', async () => {
  showToast('正在準備兩張圖片…');
  for (const sheet of SHEETS) {
    await exportSheet(sheet, false);
    await new Promise(resolve => setTimeout(resolve, 220));
  }
  showToast('兩張圖片已匯出');
});

async function exportSheet(sheet, announce = true) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1536;
  const context = canvas.getContext('2d');
  const image = await loadImage(sheet.image);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const areas = [
    { x: 42, width: 198 },
    { x: 292, width: 194 },
    { x: 540, width: 193 },
    { x: 786, width: 196 }
  ];

  context.fillStyle = '#27333c';
  context.textBaseline = 'top';
  context.font = `${state.fontSize}px "Microsoft JhengHei", "Noto Sans CJK TC", "Noto Sans CJK SC", sans-serif`;

  sheet.people.forEach((person, index) => {
    const entries = state.letters[person] || [];
    let y = 560;
    entries.forEach((entry, entryIndex) => {
      if (entryIndex > 0) y += Math.max(6, state.fontSize * .72);
      y = drawWrappedText(context, entry, areas[index].x, y, areas[index].width, state.fontSize * 1.62, 1410);
    });
  });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sheet.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (announce) showToast('圖片已匯出');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawWrappedText(context, text, x, startY, maxWidth, lineHeight, maxY) {
  let y = startY;
  const paragraphs = text.replace(/\r/g, '').split('\n');
  for (let p = 0; p < paragraphs.length; p++) {
    const chars = Array.from(paragraphs[p]);
    let line = '';
    for (const char of chars) {
      const testLine = line + char;
      if (line && context.measureText(testLine).width > maxWidth) {
        if (y + lineHeight > maxY) return y;
        context.fillText(line, x, y);
        y += lineHeight;
        line = char;
      } else {
        line = testLine;
      }
    }
    if (y + lineHeight > maxY) return y;
    if (line) context.fillText(line, x, y);
    y += lineHeight;
    if (p < paragraphs.length - 1 && !line) y += lineHeight;
  }
  return y;
}

buildUI();
