// ── Constants ─────────────────────────────────────────────────────────────────
const DATABASE_NAME = 'oneshot-image-store';
const STORE_NAME    = 'images';
const CARDS_KEY     = 'oneshot-card-ids';
const DEFAULT_IMAGE = 'res/oneshot.png';
const IMAGE_TTL_MS  = 24 * 60 * 60 * 1000;
const TOUCH_OR_COARSE_POINTER = window.matchMedia('(hover: none), (pointer: coarse)').matches;

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.addEventListener('upgradeneeded', () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error',   () => reject(request.error));
  });
}

async function saveCardImage(cardId, file) {
  const buffer = await file.arrayBuffer();
  const payload = { buffer, type: file.type, savedAt: Date.now() };
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(payload, `card-${cardId}`);
    tx.addEventListener('complete', () => { db.close(); resolve(); });
    tx.addEventListener('error',    () => { db.close(); reject(tx.error); });
  });
}

async function loadCardImage(cardId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(`card-${cardId}`);
    req.addEventListener('success', () => { db.close(); resolve(req.result || null); });
    req.addEventListener('error',   () => { db.close(); reject(req.error); });
  });
}

async function deleteCardImage(cardId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(`card-${cardId}`);
    tx.addEventListener('complete', () => { db.close(); resolve(); });
    tx.addEventListener('error',    () => { db.close(); reject(tx.error); });
  });
}

// ── Card-ID persistence ───────────────────────────────────────────────────────
function getSavedCardIds() {
  try { return JSON.parse(localStorage.getItem(CARDS_KEY)) || []; }
  catch { return []; }
}

function saveCardIds(ids) {
  localStorage.setItem(CARDS_KEY, JSON.stringify(ids));
}

function generateCardId() {
  return Date.now().toString(36);
}

// ── Object-URL tracking (prevent leaks) ──────────────────────────────────────
const cardObjectUrls = new Map();

function setCardObjectUrl(cardId, url) {
  const prev = cardObjectUrls.get(cardId);
  if (prev) URL.revokeObjectURL(prev);
  cardObjectUrls.set(cardId, url);
}

// ── Card image display ────────────────────────────────────────────────────────
function setCardImage(card, src, isDefault) {
  const img   = card.querySelector('.display-image');
  const imgBg = card.querySelector('.display-image-bg');
  img.src   = src;
  imgBg.src = src;
  img.classList.toggle('object-cover',   isDefault);
  img.classList.toggle('object-contain', !isDefault);
}

function isExpiredPayload(payload) {
  if (!payload || !payload.buffer) {
    return false;
  }

  if (typeof payload.savedAt !== 'number') {
    return false;
  }

  return Date.now() - payload.savedAt >= IMAGE_TTL_MS;
}

function hideAllDeleteButtons() {
  if (!TOUCH_OR_COARSE_POINTER) {
    return;
  }

  document.querySelectorAll('.clear-card-btn').forEach((button) => {
    button.classList.remove('opacity-100', 'pointer-events-auto');
    button.classList.add('opacity-0', 'pointer-events-none');
  });
}

function showDeleteButton(card) {
  const button = card.querySelector('.clear-card-btn');
  if (!button) {
    return;
  }

  button.classList.remove('opacity-0', 'pointer-events-none');
  button.classList.add('opacity-100', 'pointer-events-auto');
}

// ── Card DOM factory ──────────────────────────────────────────────────────────
function createCardElement(cardId) {
  const imgInputId = `img-${cardId}`;
  const camInputId = `cam-${cardId}`;

  const card = document.createElement('div');
  card.className = 'group rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_20px_80px_-30px_rgba(15,23,42,0.45)] backdrop-blur-sm';
  card.dataset.cardId = cardId;

  card.innerHTML = `
    <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <img class="display-image-bg pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-80"
           src="${DEFAULT_IMAGE}" alt="" aria-hidden="true">
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-black/20"></div>
      <img class="display-image relative z-10 h-56 w-full cursor-zoom-in object-cover sm:h-64"
           src="${DEFAULT_IMAGE}" alt="Image" tabindex="0" role="button" aria-label="Open full image">
      <button type="button" class="clear-card-btn absolute right-2 top-2 z-20 rounded-lg border border-white/50 bg-black/40 p-1.5 text-white opacity-0 transition hover:bg-black/60 focus:opacity-100 group-hover:opacity-100" aria-label="Clear or delete card">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M6 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
          <path d="M4 5a1 1 0 011-1h3.586a1 1 0 00.707-.293l.414-.414A1 1 0 0110.414 3h1.172a1 1 0 01.707.293l.414.414A1 1 0 0013.414 4H17a1 1 0 110 2h-1v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 010-2h1z"/>
        </svg>
      </button>
    </div>
    <div class="mt-3 flex gap-2">
      <label for="${imgInputId}" class="flex-1 cursor-pointer">
        <input type="file" id="${imgInputId}" class="image-input sr-only" accept="image/*">
        <span class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
          </svg>
          Upload
        </span>
      </label>
      <label for="${camInputId}" class="flex-1 cursor-pointer md:hidden">
        <input type="file" id="${camInputId}" class="camera-input sr-only" accept="image/*" capture="environment">
        <span class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-orange-400 bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
          </svg>
          Camera
        </span>
      </label>
    </div>
  `;

  function handleFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCardObjectUrl(cardId, url);
    setCardImage(card, url, false);
    requestPersistentStorage();
    saveCardImage(cardId, file).catch(err => console.error('Failed to save image', err));
  }

  card.querySelector('.image-input').addEventListener('change', function () {
    handleFile(this.files[0]);
    this.value = '';
  });
  card.querySelector('.camera-input').addEventListener('change', function () {
    handleFile(this.files[0]);
    this.value = '';
  });

  const displayImage = card.querySelector('.display-image');
  if (TOUCH_OR_COARSE_POINTER) {
    displayImage.addEventListener('click', (event) => {
      const clearCardBtn = card.querySelector('.clear-card-btn');
      if (clearCardBtn && clearCardBtn.classList.contains('opacity-0')) {
        event.preventDefault();
        event.stopPropagation();
        hideAllDeleteButtons();
        showDeleteButton(card);
        return;
      }

      openLightbox(displayImage.src);
    });
  } else {
    displayImage.addEventListener('click', () => openLightbox(displayImage.src));
  }
  displayImage.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(displayImage.src); }
  });

  const clearCardBtn = card.querySelector('.clear-card-btn');
  if (TOUCH_OR_COARSE_POINTER) {
    clearCardBtn.classList.add('pointer-events-none');
  }

  clearCardBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideAllDeleteButtons();
    if (cardsContainer.children.length > 1) {
      removeCard(cardId, card);
      return;
    }
    clearCardImage(cardId, card);
  });

  return card;
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
const imageLightbox = document.getElementById('image-lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxClose = document.getElementById('lightbox-close');

function openLightbox(src) {
  if (!imageLightbox || !lightboxImage) return;
  lightboxImage.src = src;
  imageLightbox.classList.remove('hidden');
  imageLightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');
}

function closeLightbox() {
  if (!imageLightbox) return;
  imageLightbox.classList.add('hidden');
  imageLightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('overflow-hidden');
}

if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
if (lightboxImage) lightboxImage.addEventListener('click', closeLightbox);
if (imageLightbox) imageLightbox.addEventListener('click', e => {
  if (e.target === imageLightbox) closeLightbox();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && imageLightbox && !imageLightbox.classList.contains('hidden')) {
    closeLightbox();
  }
});

// ── Add-card button ───────────────────────────────────────────────────────────
const cardsContainer = document.getElementById('cards-container');
const addCardBtn     = document.getElementById('add-card-btn');

function addCard() {
  const newId = generateCardId();
  const ids   = getSavedCardIds();
  ids.push(newId);
  saveCardIds(ids);
  const card = createCardElement(newId);
  cardsContainer.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearCardImage(cardId, card) {
  const previousUrl = cardObjectUrls.get(cardId);
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
    cardObjectUrls.delete(cardId);
  }

  setCardImage(card, DEFAULT_IMAGE, true);
  deleteCardImage(cardId).catch((error) => {
    console.error('Failed to clear image', error);
  });
}

function removeCard(cardId, card) {
  clearCardImage(cardId, card);

  const nextIds = getSavedCardIds().filter((id) => id !== cardId);
  saveCardIds(nextIds);
  card.remove();
}

if (addCardBtn) addCardBtn.addEventListener('click', addCard);

if (TOUCH_OR_COARSE_POINTER) {
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.clear-card-btn') && !event.target.closest('.display-image')) {
      hideAllDeleteButtons();
    }
  });
}

// ── Persistent storage ────────────────────────────────────────────────────────
async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    if (!granted) {
      console.warn('Persistent storage not granted — images may be evicted by the browser.');
    }
  }
}

// ── Initial load ──────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  let ids = getSavedCardIds();
  if (ids.length === 0) {
    ids = [generateCardId()];
  }

  const activeIds = [];

  for (const cardId of ids) {
    let payload = null;

    try {
      payload = await loadCardImage(cardId);
    } catch (err) {
      console.error('Failed to restore image for card', cardId, err);
    }

    if (isExpiredPayload(payload)) {
      deleteCardImage(cardId).catch((error) => {
        console.error('Failed to delete expired image', error);
      });
      continue;
    }

    const card = createCardElement(cardId);
    cardsContainer.appendChild(card);
    activeIds.push(cardId);

    if (payload && payload.buffer) {
      try {
        const blob = new Blob([payload.buffer], { type: payload.type || 'image/jpeg' });
        const url  = URL.createObjectURL(blob);
        setCardObjectUrl(cardId, url);
        setCardImage(card, url, false);
      } catch (err) {
        console.error('Failed to render image for card', cardId, err);
      }
    }
  }

  if (activeIds.length === 0) {
    const fallbackId = generateCardId();
    const fallbackCard = createCardElement(fallbackId);
    cardsContainer.appendChild(fallbackCard);
    activeIds.push(fallbackId);
  }

  saveCardIds(activeIds);
});

// ── Service Worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg  => console.log('SW registered', reg))
      .catch(err => console.log('SW registration failed', err));
  });
}
