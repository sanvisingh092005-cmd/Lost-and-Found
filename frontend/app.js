'use strict';

const API_BASE = 'http://localhost:3000/api';

/* =====================================================
   Session (token + user kept in localStorage)
===================================================== */
const Session = {
  get token() {
    return localStorage.getItem('lf_token');
  },
  get user() {
    try {
      return JSON.parse(localStorage.getItem('lf_user'));
    } catch (e) {
      return null;
    }
  },
  save(token, user) {
    localStorage.setItem('lf_token', token);
    localStorage.setItem('lf_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('lf_token');
    localStorage.removeItem('lf_user');
  }
};

/* =====================================================
   API helper
===================================================== */
async function api(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth && Session.token) headers['Authorization'] = 'Bearer ' + Session.token;

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    throw new Error('Cannot reach the server. Make sure the backend is running on http://localhost:3000');
  }

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      Session.clear();
      window.location.href = 'index.html';
    }
    throw new Error((data && data.error) || 'Request failed (' + res.status + ')');
  }
  return data;
}

/* =====================================================
   Small utilities
===================================================== */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPosted(ts) {
  if (!ts) return '';
  const d = new Date(String(ts).replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

let toastTimer = null;
function toast(message, isError = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3000);
}

function showError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}
function hideError(el) {
  el.textContent = '';
  el.classList.add('hidden');
}

/* =====================================================
   Shared navbar (user name + logout) and login guard
===================================================== */
function requireLogin() {
  if (!Session.token || !Session.user) {
    Session.clear();
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function initNav() {
  const user = Session.user;
  const nameEl = document.getElementById('userName');
  if (nameEl && user) {
    nameEl.innerHTML =
      escapeHtml(user.name) +
      (user.role === 'ADMIN' ? '<span class="role-badge">ADMIN</span>' : '');
  }
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Session.clear();
      window.location.href = 'index.html';
    });
  }
}

/* =====================================================
   PAGE: index.html  (login + sign up)
===================================================== */
function initLoginPage() {
  if (Session.token && Session.user) {
    window.location.href = 'dashboard.html';
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginError = document.getElementById('loginError');
  const signupError = document.getElementById('signupError');

  // Tabs
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      loginForm.classList.toggle('hidden', !isLogin);
      signupForm.classList.toggle('hidden', isLogin);
      hideError(loginError);
      hideError(signupError);
    });
  });

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(loginError);
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');

    if (!email || !password) {
      showError(loginError, 'Please enter your email and password.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Logging in…';
    try {
      const data = await api('/login', { method: 'POST', body: { email, password }, auth: false });
      Session.save(data.token, data.user);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError(loginError, err.message);
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  });

  // Sign up
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(signupError);
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    const btn = document.getElementById('signupBtn');

    if (!name || !email || !password) {
      showError(signupError, 'Please fill in all the fields.');
      return;
    }
    if (password.length < 6) {
      showError(signupError, 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      showError(signupError, 'Passwords do not match.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      const data = await api('/register', {
        method: 'POST',
        body: { name, email, password },
        auth: false
      });
      Session.save(data.token, data.user);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError(signupError, err.message);
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  });
}

/* =====================================================
   PAGE: dashboard.html  (browse / filter / claim / manage)
===================================================== */
let items = [];
let loadSeq = 0;
let claimItem = null;

function buildItemCard(it) {
  const user = Session.user;
  const isOwner = user.user_id === it.user_id;
  const canManage = isOwner || user.role === 'ADMIN';
  const claimed = it.status === 'CLAIMED';

  const typeBadge =
    it.type === 'LOST'
      ? '<span class="badge badge-lost">Lost</span>'
      : '<span class="badge badge-found">Found</span>';
  const statusBadge = claimed
    ? '<span class="badge badge-claimed">Claimed</span>'
    : '<span class="badge badge-open">Open</span>';
  const mineBadge = isOwner ? '<span class="badge badge-mine">Your post</span>' : '';

  const actions = [];
  if (!claimed && !isOwner) {
    const label = it.type === 'FOUND' ? 'This is mine' : 'I found this';
    actions.push(
      '<button type="button" class="btn btn-primary btn-sm" data-action="claim" data-id="' +
        it.item_id + '">' + label + '</button>'
    );
  }
  if (!claimed && canManage) {
    actions.push(
      '<button type="button" class="btn btn-secondary btn-sm" data-action="mark" data-id="' +
        it.item_id + '">Mark as claimed</button>'
    );
  }
  if (canManage) {
    actions.push(
      '<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="' +
        it.item_id + '">Delete</button>'
    );
  }

  return (
    '<article class="card item-card' + (claimed ? ' is-claimed' : '') + '">' +
      '<div class="item-top">' +
        typeBadge + statusBadge +
        '<span class="badge badge-category">' + escapeHtml(it.category) + '</span>' +
        mineBadge +
      '</div>' +
      '<h3>' + escapeHtml(it.title) + '</h3>' +
      '<p class="item-desc">' + escapeHtml(it.description) + '</p>' +
      '<div class="item-meta">' +
        '<span>📍 ' + escapeHtml(it.location) + '</span>' +
        '<span>📅 ' + (it.type === 'LOST' ? 'Lost' : 'Found') + ' on ' + escapeHtml(formatDate(it.item_date)) + '</span>' +
        '<span>👤 Posted by ' + escapeHtml(it.poster_name) + ' · ' + escapeHtml(formatPosted(it.created_at)) + '</span>' +
      '</div>' +
      (actions.length ? '<div class="item-actions">' + actions.join('') + '</div>' : '') +
    '</article>'
  );
}

function renderItems() {
  const grid = document.getElementById('itemsGrid');
  const count = document.getElementById('resultCount');

  if (!items.length) {
    grid.innerHTML = '<div class="empty">No items match your search. Try changing the filters.</div>';
    count.textContent = '';
    return;
  }
  count.textContent = items.length + (items.length === 1 ? ' item found' : ' items found');
  grid.innerHTML = items.map(buildItemCard).join('');
}

async function loadItems() {
  const seq = ++loadSeq;
  const grid = document.getElementById('itemsGrid');

  const params = new URLSearchParams();
  const search = document.getElementById('searchInput').value.trim();
  const type = document.getElementById('typeFilter').value;
  const category = document.getElementById('categoryFilter').value;
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  if (category) params.set('category', category);
  const qs = params.toString();

  try {
    const data = await api('/items' + (qs ? '?' + qs : ''));
    if (seq !== loadSeq) return; // a newer request already started
    items = data;
    renderItems();
  } catch (err) {
    if (seq !== loadSeq) return;
    grid.innerHTML = '<div class="empty">' + escapeHtml(err.message) + '</div>';
    document.getElementById('resultCount').textContent = '';
  }
}

/* ----- Claim modal ----- */
function openClaimModal(item) {
  claimItem = item;
  document.getElementById('claimTitle').textContent =
    (item.type === 'FOUND' ? 'Claim: ' : 'Found it? ') + item.title;
  document.getElementById('claimQuestion').textContent = item.verification_question;
  document.getElementById('claimAnswer').value = '';
  document.getElementById('claimStep1').classList.remove('hidden');
  document.getElementById('claimStep2').classList.add('hidden');
  document.getElementById('claimModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('claimAnswer').focus(), 50);
}

function closeClaimModal() {
  document.getElementById('claimModal').classList.add('hidden');
  claimItem = null;
}

function showClaimContact(answer) {
  const item = claimItem;
  const user = Session.user;
  const contact = item.contact_info || 'No contact info provided.';

  document.getElementById('claimContact').textContent = contact;

  const mailto = document.getElementById('claimMailto');
  const emailMatch = contact.match(/[^\s|,;]+@[^\s|,;]+\.[^\s|,;]+/);
  if (emailMatch) {
    const intro =
      item.type === 'FOUND'
        ? 'I believe this item is mine.'
        : 'I think I have found your item.';
    const subject = 'Lost & Found: ' + item.title;
    const bodyText =
      'Hi ' + item.poster_name + ',\n\n' + intro + '\n\n' +
      'Item: ' + item.title + '\n' +
      'Your question: ' + item.verification_question + '\n' +
      'My answer: ' + answer + '\n\n' +
      'Thanks,\n' + user.name;
    mailto.href =
      'mailto:' + emailMatch[0] +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(bodyText);
    mailto.classList.remove('hidden');
  } else {
    mailto.classList.add('hidden');
  }

  document.getElementById('claimStep1').classList.add('hidden');
  document.getElementById('claimStep2').classList.remove('hidden');
}

/* ----- Dashboard setup ----- */
function initDashboard() {
  if (!requireLogin()) return;
  initNav();

  const grid = document.getElementById('itemsGrid');
  const searchInput = document.getElementById('searchInput');
  const typeFilter = document.getElementById('typeFilter');
  const categoryFilter = document.getElementById('categoryFilter');

  // Filters (search is debounced)
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadItems, 300);
  });
  typeFilter.addEventListener('change', loadItems);
  categoryFilter.addEventListener('change', loadItems);
  document.getElementById('clearFilters').addEventListener('click', () => {
    searchInput.value = '';
    typeFilter.value = '';
    categoryFilter.value = '';
    loadItems();
  });

  // Card buttons (event delegation)
  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = items.find((i) => i.item_id === id);
    if (!item) return;

    const action = btn.dataset.action;

    if (action === 'claim') {
      openClaimModal(item);
      return;
    }

    if (action === 'mark') {
      if (!confirm('Mark "' + item.title + '" as claimed?')) return;
      btn.disabled = true;
      try {
        await api('/items/' + id + '/claim', { method: 'PATCH' });
        toast('Item marked as claimed.');
        loadItems();
      } catch (err) {
        toast(err.message, true);
        btn.disabled = false;
      }
      return;
    }

    if (action === 'delete') {
      if (!confirm('Delete "' + item.title + '"? This cannot be undone.')) return;
      btn.disabled = true;
      try {
        await api('/items/' + id, { method: 'DELETE' });
        toast('Item deleted.');
        loadItems();
      } catch (err) {
        toast(err.message, true);
        btn.disabled = false;
      }
    }
  });

  // Claim modal events
  document.getElementById('claimClose').addEventListener('click', closeClaimModal);
  document.getElementById('claimModal').addEventListener('click', (e) => {
    if (e.target.id === 'claimModal') closeClaimModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeClaimModal();
  });
  document.getElementById('claimForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const answer = document.getElementById('claimAnswer').value.trim();
    if (!answer) {
      toast('Please type your answer first.', true);
      return;
    }
    showClaimContact(answer);
  });

  loadItems();
}

/* =====================================================
   PAGE: post-item.html
===================================================== */
function initPostPage() {
  if (!requireLogin()) return;
  initNav();

  const form = document.getElementById('postForm');
  const errorBox = document.getElementById('postError');
  const dateInput = document.getElementById('itemDate');

  dateInput.value = todayStr();
  dateInput.max = todayStr();
  document.getElementById('contactInfo').value = Session.user.email;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(errorBox);

    const payload = {
      type: form.querySelector('input[name="type"]:checked').value,
      title: document.getElementById('title').value.trim(),
      category: document.getElementById('category').value,
      item_date: dateInput.value,
      location: document.getElementById('location').value.trim(),
      description: document.getElementById('description').value.trim(),
      verification_question: document.getElementById('verificationQuestion').value.trim(),
      contact_info: document.getElementById('contactInfo').value.trim()
    };

    const missing = Object.keys(payload).some((k) => !payload[k]);
    if (missing) {
      showError(errorBox, 'Please fill in all the fields.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const btn = document.getElementById('postBtn');
    btn.disabled = true;
    btn.textContent = 'Posting…';
    try {
      await api('/items', { method: 'POST', body: payload });
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError(errorBox, err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      btn.disabled = false;
      btn.textContent = 'Post item';
    }
  });
}

/* =====================================================
   Boot: pick the right setup for the current page
===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'login') initLoginPage();
  else if (page === 'dashboard') initDashboard();
  else if (page === 'post') initPostPage();
});