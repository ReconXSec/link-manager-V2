// ══════════════════════════════════
// PROFILE DROPDOWN
// ══════════════════════════════════
function toggleProfileMenu() {
  const menu = document.getElementById('profile-menu');
  menu.classList.toggle('show');
}

// إغلاق القائمة عند النقر خارجها
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    document.getElementById('profile-menu').classList.remove('show');
  }
});

// ══════════════════════════════════
// THEME TOGGLE (وضع مظلم/فاتح)
// ══════════════════════════════════
function toggleTheme() {
  const body = document.body;
  const isLight = body.classList.toggle('light-theme');
  const icon = document.getElementById('theme-icon');
  const settingsIcon = document.getElementById('settings-theme-icon');
  const settingsText = document.getElementById('settings-theme-text');
  
  if (isLight) {
    icon.className = 'fas fa-sun';
    if (settingsIcon) settingsIcon.className = 'fas fa-sun';
    if (settingsText) settingsText.textContent = 'الوضع الفاتح';
    localStorage.setItem('nexus-theme', 'light');
  } else {
    icon.className = 'fas fa-moon';
    if (settingsIcon) settingsIcon.className = 'fas fa-moon';
    if (settingsText) settingsText.textContent = 'الوضع المظلم';
    localStorage.setItem('nexus-theme', 'dark');
  }
}

// تحميل الثيم المحفوظ
function loadTheme() {
  const theme = localStorage.getItem('nexus-theme');
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    document.getElementById('theme-icon').className = 'fas fa-sun';
  }
}

// ══════════════════════════════════
// EXPORT CSV
// ══════════════════════════════════
function exportCSV() {
  if (!links.length) {
    showToast('⚠️ لا توجد روابط للتصدير', 'error');
    return;
  }
  
  let csv = 'العنوان,الرابط,التصنيف,الوسوم,الوصف,الزيارات,التاريخ\n';
  links.forEach(l => {
    const tags = (l.tags||[]).join(';');
    const date = new Date(l.ts).toLocaleDateString('ar-SA');
    csv += `"${l.title}","${l.url}","${l.cat}","${tags}","${l.desc||''}",${l.visits||0},"${date}"\n`;
  });
  
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nexus-links-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('📊 تم تصدير CSV', 'success');
}

// ══════════════════════════════════
// PROFILE MODAL
// ══════════════════════════════════
function showProfile() {
  const user = window.auth?.currentUser;
  if (!user) {
    showToast('❌ لم يتم تسجيل الدخول', 'error');
    return;
  }
  
  document.getElementById('profile-avatar').src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'مستخدم') + '&background=7c3aed&color=fff&size=128';
  document.getElementById('profile-name').textContent = user.displayName || 'مستخدم';
  document.getElementById('profile-email').textContent = user.email || 'بريد غير متوفر';
  document.getElementById('profile-uid').textContent = user.uid;
  document.getElementById('profile-total').textContent = links.length;
  document.getElementById('profile-visits').textContent = links.reduce((s,l) => s + (l.visits||0), 0);
  
  document.getElementById('profile-modal').style.display = 'flex';
  document.getElementById('profile-menu').classList.remove('show');
}

// ══════════════════════════════════
// UPDATE PROFILE IN HEADER
// ══════════════════════════════════
function updateProfileUI(user) {
  const avatar = document.getElementById('user-avatar');
  const nameDisplay = document.getElementById('user-name-display');
  
  if (user) {
    avatar.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'مستخدم') + '&background=7c3aed&color=fff&size=64';
    nameDisplay.textContent = user.displayName || 'مستخدم';
  } else {
    avatar.src = '';
    nameDisplay.textContent = '';
  }
}

// ══════════════════════════════════
// MODIFIED: ENTER APP
// ══════════════════════════════════
function enterApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const user = window.auth?.currentUser;
  if (user) updateProfileUI(user);
  renderLinks();
}

// ══════════════════════════════════
// MODIFIED: DO LOGOUT
// ══════════════════════════════════
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
  document.getElementById('profile-menu').classList.remove('show');
}

// ══════════════════════════════════
// MODIFIED: saveLink (مع إضافة expiry)
// ══════════════════════════════════
async function saveLink() {
  const title = document.getElementById('f-title').value.trim();
  const url = document.getElementById('f-url').value.trim();
  if (!title || !url) { showToast('⚠️ العنوان والرابط مطلوبان', 'error'); return; }
  const rawTags = document.getElementById('f-tags').value.trim();
  const tags = rawTags ? rawTags.split(',').map(t=>t.trim()).filter(Boolean) : [];
  const expiry = document.getElementById('f-expiry').value || null;

  if (editId) {
    const idx = links.findIndex(l=>l.id===editId);
    if (idx>-1) {
      links[idx] = { ...links[idx], title, url,
        cat: document.getElementById('f-cat').value,
        tags, desc: document.getElementById('f-desc').value.trim(),
        notes: document.getElementById('f-notes').value.trim(),
        image: coverImg !== null ? coverImg : links[idx].image,
        expiry: expiry,
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
      image: coverImg, fav:false, visits:0, ts:Date.now(),
      expiry: expiry
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
// MODIFIED: renderLinks (مع إظهار expiry)
// ══════════════════════════════════
// أضف هذا داخل بطاقة الرابط بعد وصف الكارد:
// ${l.expiry ? `<div style="font-size:11px;color:var(--amber);margin-top:4px;">⏳ ينتهي: ${new Date(l.expiry).toLocaleDateString('ar-SA')}</div>` : ''}

// ══════════════════════════════════
// BOOT - تحميل الثيم
// ══════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadAll();
  initAuth();
  loadTheme();

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
