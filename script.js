// ══════════════════════════════════
// CANVAS BACKGROUND
// ══════════════════════════════════
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
const particles = [];

function resizeBG() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
resizeBG();
window.addEventListener('resize', resizeBG);

class BgParticle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * bgCanvas.width;
    this.y = Math.random() * bgCanvas.height;
    this.r = Math.random() * 1.5 + .3;
    this.vx = (Math.random() - .5) * .3;
    this.vy = (Math.random() - .5) * .3;
    this.life = 1;
    this.hue = Math.random() > .5 ? 260 : 190;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    if (this.x<0||this.x>bgCanvas.width||this.y<0||this.y>bgCanvas.height) this.reset();
  }
  draw() {
    bgCtx.beginPath();
    bgCtx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    bgCtx.fillStyle = `hsla(${this.hue},80%,65%,.6)`;
    bgCtx.fill();
  }
}

for (let i = 0; i < 120; i++) particles.push(new BgParticle());

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i+1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if (dist < 120) {
        bgCtx.beginPath();
        bgCtx.moveTo(particles[i].x, particles[i].y);
        bgCtx.lineTo(particles[j].x, particles[j].y);
        bgCtx.strokeStyle = `rgba(124,58,237,${(1-dist/120)*.15})`;
        bgCtx.lineWidth = .5;
        bgCtx.stroke();
      }
    }
  }
}

function animateBG() {
  bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  particles.forEach(p => { p.update(); p.draw(); });
  drawConnections();
  requestAnimationFrame(animateBG);
}
animateBG();

// ══════════════════════════════════
// CARD CANVAS PLACEHOLDERS
// ══════════════════════════════════
const CAT_COLORS = {
  course:    ['#ec4899','#f43f5e'],
  tool:      ['#00e5ff','#00b4d8'],
  article:   ['#f59e0b','#ef4444'],
  important: ['#10b981','#06b6d4'],
  other:     ['#7c3aed','#a855f7']
};

function drawCardCanvas(canvas, cat) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth || 280;
  const h = canvas.height = canvas.offsetHeight || 170;
  const [c1, c2] = CAT_COLORS[cat] || ['#7c3aed','#a855f7'];

  const grad = ctx.createLinearGradient(0,0,w,h);
  grad.addColorStop(0, c1 + '33');
  grad.addColorStop(1, c2 + '22');
  ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);

  ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 28) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 28) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
  }

  const rg = ctx.createRadialGradient(w*.3,h*.4,0,w*.3,h*.4,w*.5);
  rg.addColorStop(0, c1 + '55'); rg.addColorStop(1,'transparent');
  ctx.fillStyle = rg; ctx.fillRect(0,0,w,h);

  const rg2 = ctx.createRadialGradient(w*.75,h*.7,0,w*.75,h*.7,w*.4);
  rg2.addColorStop(0, c2 + '44'); rg2.addColorStop(1,'transparent');
  ctx.fillStyle = rg2; ctx.fillRect(0,0,w,h);
}

// ══════════════════════════════════
// APP STATE & STORAGE
// ══════════════════════════════════
let links = [];
let currentFilter = 'all';
let currentView = 'grid';
let editId = null;
let coverImg = null;
let currentUserId = null;
let unsubscribe = null;

const LS = {
  get: k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k,v) => localStorage.setItem(k, JSON.stringify(v)),
  str: k => localStorage.getItem(k),
  setStr: (k,v) => localStorage.setItem(k,v),
  rm: k => localStorage.removeItem(k)
};

function loadAll() {
  links = LS.get('nx_links') || [];
}

function saveLinksLocal() {
  LS.set('nx_links', links);
}

// ══════════════════════════════════
// FIRESTORE SYNC
// ══════════════════════════════════
window.loadLinksFromFirestore = function(userId) {
  currentUserId = userId;
  if (unsubscribe) unsubscribe();
  
  const db = window.db;
  const colRef = window.collection(db, 'users', userId, 'links');
  
  // استماع فوري للتغييرات
  unsubscribe = window.onSnapshot(colRef, (snapshot) => {
    const newLinks = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      newLinks.push({ ...data, id: doc.id });
    });
    links = newLinks;
    saveLinksLocal(); // نسخة احتياطية محلية
    renderLinks();
    showToast('🔄 تم تحديث البيانات من السحاب', 'info');
  }, (error) => {
    console.error('Firestore error:', error);
    showToast('⚠️ خطأ في تحميل البيانات من السحاب', 'error');
  });
};

async function syncToFirestore(link) {
  if (!currentUserId) return;
  const db = window.db;
  const docRef = window.doc(db, 'users', currentUserId, 'links', link.id);
  try {
    await window.setDoc(docRef, link);
  } catch (e) {
    console.error('Save to Firestore failed:', e);
    showToast('❌ فشل الحفظ في السحاب', 'error');
  }
}

async function deleteFromFirestore(id) {
  if (!currentUserId) return;
  const db = window.db;
  const docRef = window.doc(db, 'users', currentUserId, 'links', id);
  try {
    await window.deleteDoc(docRef);
  } catch (e) {
    console.error('Delete from Firestore failed:', e);
    showToast('❌ فشل الحذف من السحاب', 'error');
  }
}

// تعديل saveLinks لتحديث السحاب
function saveLinks() {
  saveLinksLocal();
  // تحديث كل رابط في السحاب (يمكن تحسينه بإرسال التغييرات فقط)
  if (currentUserId) {
    links.forEach(link => {
      syncToFirestore(link);
    });
  }
}

// ══════════════════════════════════
// AUTH
// ══════════════════════════════════
function initAuth() {
  checkLock();
  const stored = LS.str('nx_pw');
  if (!stored) {
    document.getElementById('setup-badge').style.display = 'flex';
    document.getElementById('confirm-row').style.display = 'block';
    document.getElementById('login-btn-text').textContent = 'إنشاء الحساب ←';
  }
}

function checkLock() {
  const until = LS.str('nx_lock');
  if (!until) return;
  const lockDate = new Date(until);
  if (new Date() < lockDate) {
    showLocked(lockDate);
  } else {
    LS.rm('nx_lock');
    LS.setStr('nx_attempts','0');
  }
}

function showLocked(lockDate) {
  document.getElementById('login-form').style.display = 'none';
  const days = Math.ceil((lockDate - new Date()) / 86400000);
  document.getElementById('locked-text').textContent = `سيُرفع القفل بعد ${days} يوم`;
  document.getElementById('locked-state').style.display = 'block';
}

function doLogin() {
  const pw = document.getElementById('pw-inp').value.trim();
  const stored = LS.str('nx_pw');
  const errEl = document.getElementById('login-error');
  const attEl = document.getElementById('attempts-bar');
  errEl.style.display = 'none';

  if (!pw) { showErr(errEl, '⚠️ يرجى إدخال كلمة المرور'); return; }

  if (!stored) {
    const conf = document.getElementById('pw-confirm').value.trim();
    if (pw.length < 4) { showErr(errEl,'⚠️ 4 أحرف على الأقل'); return; }
    if (pw !== conf) { showErr(errEl,'⚠️ كلمتا المرور غير متطابقتين'); return; }
    LS.setStr('nx_pw', btoa(unescape(encodeURIComponent(pw))));
    enterApp();
  } else {
    let decoded;
    try { decoded = decodeURIComponent(escape(atob(stored))); } catch { decoded = atob(stored); }
    if (pw === decoded) {
      LS.setStr('nx_attempts','0');
      enterApp();
    } else {
      const att = parseInt(LS.str('nx_attempts') || '0') + 1;
      LS.setStr('nx_attempts', att.toString());
      if (att >= 8) {
        const lock = new Date(); lock.setMonth(lock.getMonth()+1);
        LS.setStr('nx_lock', lock.toISOString());
        showLocked(lock);
      } else {
        attEl.style.display = 'block';
        attEl.textContent = `⚠️ باقي ${8-att} محاولات قبل القفل لشهر كامل`;
        showErr(errEl,'❌ كلمة المرور غير صحيحة');
      }
    }
  }
}

function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }

function enterApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  // إذا كان المستخدم مسجلاً في Firebase، سيتم تحميل البيانات تلقائياً
  renderLinks();
}

function doLogout() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (window.auth && window.signOut) {
    window.signOut(window.auth).catch(() => {});
  }
  currentUserId = null;
  links = [];
  saveLinksLocal();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('pw-inp').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('attempts-bar').style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-page').style.display !== 'none') doLogin();
});

// ══════════════════════════════════
// RENDER (نفس الكود السابق مع تعديل طفيف)
// ══════════════════════════════════
function getDisplayLinks() {
  const q = document.getElementById('search-inp')?.value.toLowerCase().trim();
  let list = [...links];
  if (currentFilter === 'favorite') list = list.filter(l => l.fav);
  else if (currentFilter !== 'all') list = list.filter(l => l.cat === currentFilter);
  if (q) list = list.filter(l =>
    l.title.toLowerCase().includes(q) ||
    l.url.toLowerCase().includes(q) ||
    (l.desc||'').toLowerCase().includes(q) ||
    (l.tags||[]).some(t => t.toLowerCase().includes(q))
  );
  const sort = document.getElementById('sort-sel')?.value || 'newest';
  if (sort === 'newest') list.sort((a,b) => b.ts - a.ts);
  else if (sort === 'oldest') list.sort((a,b) => a.ts - b.ts);
  else if (sort === 'az') list.sort((a,b) => a.title.localeCompare(b.title, 'ar'));
  else if (sort === 'visits') list.sort((a,b) => (b.visits||0) - (a.visits||0));
  return list;
}

function updateStats() {
  document.getElementById('hs-total').textContent = links.length;
  document.getElementById('hs-visits').textContent = links.reduce((s,l)=>s+(l.visits||0),0);
  document.getElementById('hs-favs').textContent = links.filter(l=>l.fav).length;
  document.getElementById('sc-all').textContent = links.length;
  document.getElementById('sc-course').textContent = links.filter(l=>l.cat==='course').length;
  document.getElementById('sc-tool').textContent = links.filter(l=>l.cat==='tool').length;
  document.getElementById('sc-article').textContent = links.filter(l=>l.cat==='article').length;
  document.getElementById('sc-important').textContent = links.filter(l=>l.cat==='important').length;
  document.getElementById('sc-fav').textContent = links.filter(l=>l.fav).length;
  document.getElementById('sc-other').textContent = links.filter(l=>l.cat==='other').length;
}

const CAT_NAMES = {course:'كورس تعليمي',tool:'أداة مهمة',article:'مقال',important:'موقع مهم',other:'أخرى'};
const CAT_EMOJI = {course:'🎓',tool:'🔧',article:'📄',important:'⭐',other:'📁'};

function renderLinks() {
  updateStats();
  const list = getDisplayLinks();
  const container = document.getElementById('cards-container');
  container.className = currentView === 'list' ? 'cards-list' : 'cards-grid';
  document.getElementById('results-count').innerHTML = list.length
    ? `عرض <span>${list.length}</span> من ${links.length}`
    : '';
  if (!list.length) {
    container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
      </div>
      <h3>لا توجد روابط هنا</h3>
      <p>${links.length ? 'جرّب تغيير التصفية أو البحث' : 'أضف أول رابط لك الآن!'}</p>
      <button class="h-btn-add" onclick="openAddModal()" style="margin:0 auto">+ إضافة رابط</button>
    </div>`;
    return;
  }
  const listMode = currentView === 'list' ? 'list-mode' : '';
  container.innerHTML = list.map((l, i) => `
  <div class="link-card ${l.cat} ${listMode}" style="animation-delay:${i*.04}s" id="card-${l.id}">
    <div class="card-img">
      ${l.image
        ? `<img src="${l.image}" alt="${l.title}">`
        : `<div class="card-img-ph"><canvas id="ph-${l.id}" style="position:absolute;inset:0;width:100%;height:100%"></canvas><span class="ph-icon">${CAT_EMOJI[l.cat]||'🔗'}</span></div>`
      }
      <div class="card-img-overlay"></div>
      <div class="card-actions-float">
        <button class="ca-btn ${l.fav?'fav-on':''}" onclick="toggleFav('${l.id}',event)" title="${l.fav?'إزالة من المفضلة':'إضافة للمفضلة'}">
          <svg viewBox="0 0 24 24" fill="${l.fav?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button class="ca-btn" onclick="openEditModal('${l.id}',event)" title="تعديل">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="ca-btn" onclick="openQR('${l.url}',event)" title="QR Code">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/><rect x="18" y="18" width="3" height="3"/></svg>
        </button>
        <button class="ca-btn del-btn" onclick="deleteLink('${l.id}',event)" title="حذف">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
      <span class="card-cat-badge ${l.cat}">${CAT_NAMES[l.cat]||l.cat}</span>
    </div>
    <div class="card-body">
      <div class="card-title">${l.title}</div>
      <div class="card-url" onclick="copyUrl('${l.url}',event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        ${l.url.length > 45 ? l.url.slice(0,45)+'…' : l.url}
      </div>
      ${l.desc ? `<div class="card-desc">${l.desc}</div>` : ''}
      ${l.tags?.length ? `<div class="card-tags">${l.tags.slice(0,4).map(t=>`<span class="card-tag">#${t}</span>`).join('')}</div>` : ''}
      <div class="card-footer">
        <div class="card-meta">
          <span class="card-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ${l.visits||0}
          </span>
          <span class="card-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${fmtDate(l.ts)}
          </span>
        </div>
        <button class="card-visit-btn" onclick="visitLink('${l.id}','${l.url}',event)">
          زيارة
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </button>
      </div>
    </div>
  </div>`).join('');
  requestAnimationFrame(() => {
    list.forEach(l => {
      if (!l.image) {
        const c = document.getElementById('ph-'+l.id);
        if (c) drawCardCanvas(c, l.cat);
      }
    });
  });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('ar-SA', {year:'numeric',month:'short',day:'numeric'});
}

// ══════════════════════════════════
// FILTER & SORT (نفسه)
// ══════════════════════════════════
function filterCat(cat, el) {
  currentFilter = cat;
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active-filter'));
  if (el) el.classList.add('active-filter');
  renderLinks();
}
function handleSearch() { renderLinks(); }
function setView(v) {
  currentView = v;
  document.getElementById('vt-grid').classList.toggle('active', v==='grid');
  document.getElementById('vt-list').classList.toggle('active', v==='list');
  renderLinks();
}

// ══════════════════════════════════
// CRUD (مع تعديل لحفظ Firestore)
// ══════════════════════════════════
function visitLink(id, url, e) {
  if (e) e.stopPropagation();
  const l = links.find(x=>x.id===id);
  if (l) { l.visits=(l.visits||0)+1; l.lastVisit=Date.now(); saveLinks(); updateStats(); }
  window.open(url,'_blank');
}

function toggleFav(id, e) {
  if (e) e.stopPropagation();
  const l = links.find(x=>x.id===id);
  if (l) {
    l.fav = !l.fav;
    saveLinks(); renderLinks();
    showToast(l.fav?'❤️ أُضيف للمفضلة':'💔 أُزيل من المفضلة', 'info');
  }
}

function copyUrl(url, e) {
  if (e) e.stopPropagation();
  navigator.clipboard.writeText(url).then(() => showToast('📋 تم نسخ الرابط', 'success'));
}

async function deleteLink(id, e) {
  if (e) e.stopPropagation();
  if (!confirm('هل أنت متأكد من حذف هذا الرابط؟')) return;
  // حذف من Firestore
  if (currentUserId) {
    await deleteFromFirestore(id);
  }
  links = links.filter(l=>l.id!==id);
  saveLinksLocal();
  renderLinks();
  showToast('🗑️ تم الحذف', 'error');
}

// ══════════════════════════════════
// ADD / EDIT MODAL (نفسه مع تعديل saveLink)
// ══════════════════════════════════
function openAddModal() {
  editId = null; coverImg = null;
  document.getElementById('modal-title').textContent = '✨ إضافة رابط جديد';
  document.getElementById('save-btn-text').textContent = '💾 حفظ الرابط';
  ['f-title','f-url','f-tags','f-desc','f-notes'].forEach(id => document.getElementById(id).value='');
  document.getElementById('f-cat').value = 'course';
  document.getElementById('img-preview').style.display='none';
  document.getElementById('img-zone').style.display='block';
  document.getElementById('add-modal').style.display='flex';
}

function openEditModal(id, e) {
  if (e) e.stopPropagation();
  const l = links.find(x=>x.id===id);
  if (!l) return;
  editId = id; coverImg = l.image||null;
  document.getElementById('modal-title').textContent = '✏️ تعديل الرابط';
  document.getElementById('save-btn-text').textContent = '💾 حفظ التعديلات';
  document.getElementById('f-title').value = l.title;
  document.getElementById('f-url').value = l.url;
  document.getElementById('f-cat').value = l.cat;
  document.getElementById('f-tags').value = (l.tags||[]).join(', ');
  document.getElementById('f-desc').value = l.desc||'';
  document.getElementById('f-notes').value = l.notes||'';
  if (l.image) {
    document.getElementById('preview-img').src = l.image;
    document.getElementById('img-preview').style.display='block';
    document.getElementById('img-zone').style.display='none';
  } else {
    document.getElementById('img-preview').style.display='none';
    document.getElementById('img-zone').style.display='block';
  }
  document.getElementById('add-modal').style.display='flex';
}

function closeAddModal() {
  document.getElementById('add-modal').style.display='none';
  editId = null; coverImg = null;
}

function handleImg(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    coverImg = ev.target.result;
    document.getElementById('preview-img').src = coverImg;
    document.getElementById('img-preview').style.display='block';
    document.getElementById('img-zone').style.display='none';
  };
  r.readAsDataURL(file);
}

function removeImg() {
  coverImg = null;
  document.getElementById('img-preview').style.display='none';
  document.getElementById('img-zone').style.display='block';
  document.getElementById('img-file').value='';
}

async function saveLink() {
  const title = document.getElementById('f-title').value.trim();
  const url = document.getElementById('f-url').value.trim();
  if (!title || !url) { showToast('⚠️ العنوان والرابط مطلوبان', 'error'); return; }
  const rawTags = document.getElementById('f-tags').value.trim();
  const tags = rawTags ? rawTags.split(',').map(t=>t.trim()).filter(Boolean) : [];

  if (editId) {
    const idx = links.findIndex(l=>l.id===editId);
    if (idx>-1) {
      links[idx] = { ...links[idx], title, url,
        cat: document.getElementById('f-cat').value,
        tags, desc: document.getElementById('f-desc').value.trim(),
        notes: document.getElementById('f-notes').value.trim(),
        image: coverImg !== null ? coverImg : links[idx].image,
        updated: Date.now()
      };
      if (currentUserId) {
        await syncToFirestore(links[idx]);
      }
    }
    showToast('✅ تم تحديث الرابط', 'success');
  } else {
    const newLink = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
      title, url,
      cat: document.getElementById('f-cat').value,
      tags, desc: document.getElementById('f-desc').value.trim(),
      notes: document.getElementById('f-notes').value.trim(),
      image: coverImg, fav:false, visits:0, ts:Date.now()
    };
    links.unshift(newLink);
    if (currentUserId) {
      await syncToFirestore(newLink);
    }
    showToast('🚀 تم إضافة الرابط', 'success');
  }
  saveLinksLocal();
  renderLinks();
  closeAddModal();
}

// ══════════════════════════════════
// QR CODE (نفسه)
// ══════════════════════════════════
function openQR(url, e) {
  if (e) e.stopPropagation();
  document.getElementById('qr-url-text').textContent = url;
  document.getElementById('qr-modal').style.display='flex';
  genQR(url);
}

function genQR(text) {
  const canvas = document.getElementById('qr-canvas');
  const ctx = canvas.getContext('2d');
  const size = 180; canvas.width=size; canvas.height=size;
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,size,size);
  ctx.fillStyle='#000';
  const cell = size/25;
  for (let i=0;i<25;i++) for (let j=0;j<25;j++) {
    if (Math.random()>.5 || (i<7&&j<7) || (i<7&&j>17) || (i>17&&j<7))
      ctx.fillRect(i*cell,j*cell,cell,cell);
  }
  [0, 18*cell].forEach(x => [0, (x?0:18*cell)].forEach(y => {
    ctx.fillStyle='#000'; ctx.fillRect(x||0,x===0&&y===18*cell?18*cell:y===0?0:y,7*cell,7*cell);
    ctx.fillStyle='#fff'; ctx.fillRect((x||0)+cell,(x===0&&y===18*cell?18*cell:y===0?0:y)+cell,5*cell,5*cell);
    ctx.fillStyle='#000'; ctx.fillRect((x||0)+2*cell,(x===0&&y===18*cell?18*cell:y===0?0:y)+2*cell,3*cell,3*cell);
  }));
  const [c1,c2] = CAT_COLORS['other'];
  const grd = ctx.createLinearGradient(8*cell,8*cell,17*cell,17*cell);
  grd.addColorStop(0,c1); grd.addColorStop(1,c2);
  ctx.fillStyle=grd; ctx.fillRect(8*cell,8*cell,9*cell,9*cell);
}

function downloadQR() {
  const a=document.createElement('a'); a.download='qr.png';
  a.href=document.getElementById('qr-canvas').toDataURL(); a.click();
  showToast('⬇️ تم التحميل','success');
}

// ══════════════════════════════════
// SETTINGS (نفسه)
// ══════════════════════════════════
function openSettingsModal() {
  document.getElementById('settings-modal').style.display='flex';
}

function changePw() {
  const p = document.getElementById('set-pw').value;
  const p2 = document.getElementById('set-pw2').value;
  if (p.length < 4) { showToast('⚠️ 4 أحرف على الأقل','error'); return; }
  if (p !== p2) { showToast('⚠️ كلمتا المرور غير متطابقتين','error'); return; }
  LS.setStr('nx_pw', btoa(unescape(encodeURIComponent(p))));
  document.getElementById('set-pw').value='';
  document.getElementById('set-pw2').value='';
  showToast('🔑 تم تغيير كلمة المرور','success');
}

function exportData() {
  const blob = new Blob([JSON.stringify({links,exported:new Date().toISOString(),v:'4.0'},null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nexus-backup-${Date.now()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  showToast('📦 تم التصدير','success');
}

function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.links) {
        if (confirm(`استيراد ${data.links.length} رابط؟\nOK = دمج | Cancel = استبدال`)) {
          const ids = new Set(links.map(l=>l.id));
          links = [...links, ...data.links.filter(l=>!ids.has(l.id))];
        } else { links = data.links; }
        saveLinksLocal();
        // إذا كان المستخدم مسجلاً، نزامن جميع الروابط مع السحاب
        if (currentUserId) {
          links.forEach(l => syncToFirestore(l));
        }
        renderLinks();
        showToast(`✅ تم استيراد ${data.links.length} رابط`,'success');
      }
    } catch { showToast('❌ ملف غير صالح','error'); }
  };
  r.readAsText(file);
}

async function clearAll() {
  if (!confirm('سيتم حذف جميع الروابط نهائياً!')) return;
  if (!confirm('هذا الإجراء لا يمكن التراجع عنه. متأكد؟')) return;
  if (currentUserId) {
    // حذف كل رابط من Firestore
    for (const l of links) {
      await deleteFromFirestore(l.id);
    }
  }
  links = [];
  saveLinksLocal();
  renderLinks();
  showToast('🗑️ تم مسح جميع البيانات','error');
}

function closeModal(id) {
  document.getElementById(id).style.display='none';
}

// ══════════════════════════════════
// TOAST
// ══════════════════════════════════
let toastTimer;
function showToast(msg, type='info') {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ══════════════════════════════════
// BOOT
// ══════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  initAuth();

  const hr = new Date().getHours();
  const g = hr < 12 ? 'صباح الخير ☀️' : hr < 18 ? 'مساء النور 🌤️' : 'مساء الخير 🌙';
  const heroEl = document.getElementById('hero-greeting');
  if (heroEl) heroEl.textContent = g;

  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => {
      if (e.target === o) o.style.display='none';
    });
  });
});
