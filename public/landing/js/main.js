'use strict';

// ── NAV: scroll shadow ─────────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── NAV: mobile hamburger ──────────────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const drawer    = document.getElementById('drawer');
hamburger.addEventListener('click', () => {
  const open = drawer.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', open);
  const spans = hamburger.querySelectorAll('span');
  if (open) {
    spans[0].style.transform = 'translateY(7px) rotate(45deg)';
    spans[1].style.opacity   = '0';
    spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
  } else {
    spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  }
});
// Close drawer on nav link click
drawer.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    drawer.classList.remove('open');
    hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
  });
});

// ── SCROLL REVEAL ──────────────────────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px'
});

document.querySelectorAll('.reveal-up').forEach((el, i) => {
  // Stagger sibling cards naturally via their own inline animation-delay
  // but still run the intersection observer for the trigger
  revealObserver.observe(el);
});

// ── ANIMATED CHAT MESSAGES ────────────────────────────────────────────────
// Messages already have animation-delay via CSS, but we want them
// to only start animating once the hero is in view
const msgs = document.querySelectorAll('.chat-messages .msg');
const heroObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    msgs.forEach(m => m.style.animationPlayState = 'running');
    heroObserver.disconnect();
  }
}, { threshold: 0.3 });
document.querySelector('.hero-phones') && heroObserver.observe(document.querySelector('.hero-phones'));
// Pause initially
msgs.forEach(m => m.style.animationPlayState = 'paused');

// ── SMOOTH SCROLL for all # links ─────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const y = target.getBoundingClientRect().top + window.scrollY - (window.innerWidth < 640 ? 0 : 80);
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
});
