const imageInput = document.getElementById('image-input');
const displayImage = document.getElementById('display-image');
const displayImageBg = document.getElementById('display-image-bg');
const imageLightbox = document.getElementById('image-lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxClose = document.getElementById('lightbox-close');

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

imageInput.addEventListener('change', function() {
  const file = this.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      displayImage.src = e.target.result;
      // Optionally, store in localStorage to persist
      localStorage.setItem('uploadedImage', e.target.result);
    }
    reader.readAsDataURL(file);
  }
});

// Load saved image on start
window.addEventListener('load', () => {
  const savedImage = localStorage.getItem('uploadedImage');
  if (savedImage) {
    displayImage.src = savedImage;
  }

  if (displayImage.complete) {
    syncPreviewBackground();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('SW registered', reg))
      .catch(err => console.log('SW registration failed', err));
  });
}
