const imageInput = document.getElementById('image-input');
const displayImage = document.getElementById('display-image');
const displayImageBg = document.getElementById('display-image-bg');
const imageLightbox = document.getElementById('image-lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxClose = document.getElementById('lightbox-close');
const DATABASE_NAME = 'husk-image-store';
const STORE_NAME = 'images';
const IMAGE_KEY = 'uploaded-image';

let currentObjectUrl = null;

function revokeCurrentObjectUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

function setDisplayedImage(src) {
  displayImage.src = src;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);

    request.addEventListener('upgradeneeded', () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    });

    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
}

async function saveImage(file) {
  const buffer = await file.arrayBuffer();
  const payload = { buffer, type: file.type };
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    transaction.addEventListener('complete', () => {
      database.close();
      resolve();
    });

    transaction.addEventListener('error', () => {
      database.close();
      reject(transaction.error);
    });

    store.put(payload, IMAGE_KEY);
  });
}

async function loadSavedImage() {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(IMAGE_KEY);

    request.addEventListener('success', () => {
      database.close();
      resolve(request.result || null);
    });

    request.addEventListener('error', () => {
      database.close();
      reject(request.error);
    });
  });
}

async function restoreImage() {
  try {
    const payload = await loadSavedImage();

    if (!payload || !payload.buffer) {
      return;
    }

    const blob = new Blob([payload.buffer], { type: payload.type || 'image/jpeg' });
    revokeCurrentObjectUrl();
    currentObjectUrl = URL.createObjectURL(blob);
    setDisplayedImage(currentObjectUrl);
  } catch (error) {
    console.error('Failed to restore saved image', error);
  }
}

function openLightbox() {
  if (!imageLightbox || !lightboxImage) {
    return;
  }

  lightboxImage.src = displayImage.src;
  imageLightbox.classList.remove('hidden');
  imageLightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overflow-hidden');
}

function closeLightbox() {
  if (!imageLightbox) {
    return;
  }

  imageLightbox.classList.add('hidden');
  imageLightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('overflow-hidden');
}

function syncPreviewBackground() {
  if (displayImageBg) {
    displayImageBg.src = displayImage.src;
  }

  if (lightboxImage) {
    lightboxImage.src = displayImage.src;
  }
}

displayImage.addEventListener('load', syncPreviewBackground);
displayImage.addEventListener('click', openLightbox);
displayImage.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openLightbox();
  }
});

if (lightboxClose) {
  lightboxClose.addEventListener('click', closeLightbox);
}

if (lightboxImage) {
  lightboxImage.addEventListener('click', closeLightbox);
}

if (imageLightbox) {
  imageLightbox.addEventListener('click', (event) => {
    if (event.target === imageLightbox) {
      closeLightbox();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && imageLightbox && !imageLightbox.classList.contains('hidden')) {
    closeLightbox();
  }
});

async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    if (!granted) {
      console.warn('Persistent storage not granted — image may be evicted by the browser.');
    }
  }
}

imageInput.addEventListener('change', function() {
  const file = this.files[0];
  if (file) {
    revokeCurrentObjectUrl();
    currentObjectUrl = URL.createObjectURL(file);
    setDisplayedImage(currentObjectUrl);

    requestPersistentStorage();
    saveImage(file).catch((error) => {
      console.error('Failed to save image', error);
    });
  }
});

// Load saved image on start
window.addEventListener('load', async () => {
  await restoreImage();

  if (displayImage.complete) {
    syncPreviewBackground();
  }
});

window.addEventListener('beforeunload', revokeCurrentObjectUrl);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW registered', reg))
      .catch(err => console.log('SW registration failed', err));
  });
}
