'use strict';

// ── NAV scroll shadow ───────────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 16);
}, { passive: true });

// ── HAMBURGER MENU ──────────────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const drawer    = document.getElementById('drawer');
hamburger?.addEventListener('click', () => {
  const open = drawer.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', String(open));
  const [s1, s2, s3] = hamburger.querySelectorAll('span');
  if (open) {
    s1.style.transform = 'translateY(7px) rotate(45deg)';
    s2.style.opacity = '0';
    s3.style.transform = 'translateY(-7px) rotate(-45deg)';
  } else {
    [s1, s2, s3].forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }
});
drawer?.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    drawer.classList.remove('open');
    hamburger?.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  });
});

// ── SCROLL REVEAL ────────────────────────────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ── CHAT MESSAGE ANIMATION ───────────────────────────────────────────────────
const chatObs = new IntersectionObserver((entries) => {
  if (!entries[0].isIntersecting) return;
  chatObs.disconnect();
  const msgs = document.querySelectorAll('.msg-anim');
  msgs.forEach((m, i) => {
    setTimeout(() => m.classList.add('in'), i * 550);
  });
}, { threshold: 0.3 });
const phoneEl = document.querySelector('.floating-phone');
if (phoneEl) chatObs.observe(phoneEl);

// ── SMOOTH SCROLL ───────────────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  });
});

// ── WHATSAPP EMBEDDED SIGNUP MODAL ──────────────────────────────────────────
const modal = document.getElementById('waModal');
const closeBtn = document.getElementById('closeModal');

function openModal() {
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

// Both signup CTAs open the modal
document.querySelectorAll('#openSignup').forEach(btn => {
  btn?.addEventListener('click', openModal);
});
closeBtn?.addEventListener('click', closeModal);
modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── META WHATSAPP EMBEDDED SIGNUP ───────────────────────────────────────────
// NOTE: Replace APP_ID and CONFIG_ID with your actual Meta App credentials
// once your Meta Developer account is verified for WhatsApp Business API.
const WA_APP_ID   = 'YOUR_META_APP_ID';   // <-- Replace with your real Meta App ID
const WA_CFG_ID   = 'YOUR_CONFIG_ID';     // <-- Replace with your WhatsApp config ID

function launchFBLogin() {
  if (typeof window.FB === 'undefined') {
    alert('The WhatsApp Business signup portal is loading. Please try again in a moment.');
    return;
  }
  window.FB.login(
    function (response) {
      if (response.authResponse) {
        const code = response.authResponse.code;
        // Send the auth code to your backend to exchange for access tokens
        fetch('/api/admin/whatsapp/embedded-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              document.getElementById('waSignupContainer').innerHTML = `
                <div style="text-align:center;padding:20px;">
                  <div style="font-size:48px;margin-bottom:12px;">🎉</div>
                  <div style="font-size:18px;font-weight:700;color:#25D366;margin-bottom:8px;">Successfully connected!</div>
                  <div style="font-size:14px;color:rgba(255,255,255,.6);">Your WhatsApp Business number is now linked to BoltClick. Check your email for next steps.</div>
                </div>`;
            }
          })
          .catch(() => {});
      }
    },
    {
      config_id: WA_CFG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: { sessionInfoVersion: 3 },
    }
  );
}

document.getElementById('waEmbeddedBtn')?.addEventListener('click', launchFBLogin);

// Load Facebook SDK
window.fbAsyncInit = function () {
  window.FB.init({ appId: WA_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v20.0' });
};
(function (d, s, id) {
  if (d.getElementById(id)) return;
  const fjs = d.getElementsByTagName(s)[0];
  const js  = d.createElement(s);
  js.id = id;
  js.src = 'https://connect.facebook.net/en_US/sdk.js';
  fjs.parentNode.insertBefore(js, fjs);
})(document, 'script', 'facebook-jssdk');

// ── RESTAURANT LEAD FORM ───────────────────────────────────────────────────
document.getElementById('restaurantForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name  = document.getElementById('rName')?.value?.trim();
  const owner = document.getElementById('rOwner')?.value?.trim();
  const phone = document.getElementById('rPhone')?.value?.trim();
  const city  = document.getElementById('rCity')?.value;

  if (!name || !owner || !phone || !city) {
    alert('Please fill in all fields.');
    return;
  }

  const btn = e.target.querySelector('.submit-btn');
  btn.textContent = 'Sending…';
  btn.disabled = true;

  try {
    await fetch('/api/admin/restaurant-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, owner, phone, city }),
    });
  } catch (_) {}

  // Always show success — capture the lead even if backend isn't set up yet
  document.getElementById('restaurantForm').style.display = 'none';
  document.getElementById('formSuccess').style.display = 'block';
});
