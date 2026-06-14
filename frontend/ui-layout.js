const UI_API_BASE_URL = window.location.protocol === 'file:' ? ((window.location.protocol === "file:" ? "http://localhost:5000/api" : "/api") + "") : '/api';

// ── Sidebar ──
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

// ── Theme ──
function toggleTheme() {
  // Uses script.js toggleTheme if available
  const icon = document.querySelector('#themeBtn i');
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  if (newTheme === 'dark') {
    if (icon) { icon.classList.replace('fa-moon', 'fa-sun'); }
    localStorage.setItem('theme', 'dark');
  } else {
    if (icon) { icon.classList.replace('fa-sun', 'fa-moon'); }
    localStorage.setItem('theme', 'light');
  }
}

// Apply saved theme on load
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  const icon = document.querySelector('#themeBtn i');
  if (icon) { icon.classList.replace('fa-moon', 'fa-sun'); }
}

// ── Trip Tabs ──
function setTripTab(btn) {
  document.querySelectorAll('.trip-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

// ── Swap Locations ──
function swapLocations() {
  const from = document.getElementById('searchFrom');
  const to = document.getElementById('searchTo');
  const tmp = from.value;
  from.value = to.value;
  to.value = tmp;
}

// ── Search Buses ──
function searchBuses() {
  const from = document.getElementById('searchFrom').value.trim();
  const to = document.getElementById('searchTo').value.trim();
  const date = document.getElementById('searchDate').value;
  const passengers = document.getElementById('searchPassengers').value;

  let url = 'buses.html?';
  if (from) url += `from=${encodeURIComponent(from)}&`;
  if (to) url += `to=${encodeURIComponent(to)}&`;
  if (date) url += `date=${encodeURIComponent(date)}&`;
  if (passengers) url += `passengers=${encodeURIComponent(passengers)}`;

  window.location.href = url;
}

// Set default date to today
const today = new Date().toISOString().split('T')[0];
const sd = document.getElementById('searchDate'); if(sd) sd.value = today;
if(sd) sd.min = today;

// ── Global Search ──
function handleGlobalSearch(val) {
  const isOnBusesPage = !!document.getElementById('busList');

  if (isOnBusesPage) {
    // Live filter bus cards already rendered on buses.html
    const query = val.trim().toLowerCase();
    const cards = document.querySelectorAll('#busList .bus-card');
    let visibleCount = 0;

    cards.forEach(card => {
      const text = card.innerText.toLowerCase();
      const matches = !query || text.includes(query);
      card.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });

    // Show no-results message if nothing matches
    let noRes = document.getElementById('searchNoResults');
    if (!noRes) {
      noRes = document.createElement('div');
      noRes.id = 'searchNoResults';
      noRes.className = 'empty-state';
      noRes.innerHTML = '<i class="fas fa-search"></i><p>No buses match your search. Try a different route or city.</p>';
      document.getElementById('busList').appendChild(noRes);
    }
    noRes.style.display = (query && visibleCount === 0) ? 'flex' : 'none';

  } else {
    // On index.html — redirect to buses.html with search query on Enter or after short delay
    clearTimeout(window._searchRedirectTimer);
    if (val.trim().length > 1) {
      window._searchRedirectTimer = setTimeout(() => {
        window.location.href = `buses.html?search=${encodeURIComponent(val.trim())}`;
      }, 800);
    }
  }
}


// On buses.html — auto-apply search query from URL on page load
// Uses readyState check because ui-layout.js loads after DOM is already parsed
function applyUrlSearch() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('search');
  if (!q || !document.getElementById('busList')) return;

  const searchInput = document.getElementById('globalSearch');
  if (searchInput) searchInput.value = q;

  // Poll until bus cards are rendered (loadBuses has a ~1200ms delay)
  const tryFilter = () => {
    const cards = document.querySelectorAll('#busList .bus-card');
    if (cards.length === 0) {
      setTimeout(tryFilter, 300);
    } else {
      handleGlobalSearch(q);
    }
  };
  tryFilter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyUrlSearch);
} else {
  applyUrlSearch();
}


// ── Populate city datalists from backend ──
async function populateCities() {
  try {
    const res = await fetch(`${UI_API_BASE_URL}/buses`);
    if (!res.ok) return;
    const buses = await res.json();
    const froms = [...new Set(buses.map(b => b.from).filter(Boolean))];
    const tos = [...new Set(buses.map(b => b.to).filter(Boolean))];
    const allCities = [...new Set([...froms, ...tos])];

    const fromList = document.getElementById('fromCities');
    const toList = document.getElementById('toCities');
    allCities.forEach(city => {
      if(fromList) fromList.innerHTML += `<option value="${city}">`;
      if(toList) toList.innerHTML += `<option value="${city}">`;
    });
  } catch(e) { /* silent */ }
}
populateCities();

// ── Notification dropdown ──
function toggleNotiDropdown(e) {
  console.log('toggleNotiDropdown click event triggered');
  e.stopPropagation();
  const d = document.getElementById('userNotiDropdown');
  if (d) {
    d.classList.toggle('open');
    console.log('Dropdown open class toggled, is open:', d.classList.contains('open'));
    if (d.classList.contains('open')) {
      d.style.display = 'block';
      fetchUserNotifications();
    } else {
      d.style.display = 'none';
    }
  } else {
    console.error('userNotiDropdown element not found!');
  }
}

document.addEventListener('click', (e) => {
  const d = document.getElementById('userNotiDropdown');
  if (d && !e.target.closest('#notiWrap')) {
    d.classList.remove('open');
    d.style.display = 'none';
  }
});

// ── Booking access check ──
function checkBookingAccess() {
  const token = localStorage.getItem('token');
  if (!token) {
    showToast('Please login first to view your bookings.', 'warning');
    setTimeout(() => window.location.href = 'login.html', 1500);
  } else {
    window.location.href = 'bookings.html';
  }
}

// ── Misc UI helpers ──
// ================= OFFERS MODAL =================
window.showOffersToast = function() {
  const existingModal = document.getElementById('offersModal');
  if (existingModal) existingModal.remove();

  const isDark = document.body.getAttribute('data-theme') === 'dark';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#1e293b';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';

  const modalHtml = `
    <div id="offersModal" style="display:flex; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:99999; align-items:center; justify-content:center; backdrop-filter:blur(5px); opacity: 0; transition: opacity 0.3s ease;">
      <div style="background:${cardBg}; border-radius:16px; width:90%; max-width:450px; padding:30px; box-shadow:0 20px 40px rgba(0,0,0,0.3); transform: translateY(30px); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); position:relative;">
        <button onclick="closeOffersModal()" style="position:absolute; top:20px; right:20px; background:transparent; border:none; color:${mutedColor}; font-size:1.4rem; cursor:pointer; transition: color 0.2s;"><i class="fas fa-times"></i></button>
        
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="display:inline-flex; align-items:center; justify-content:center; width:60px; height:60px; border-radius:50%; background:linear-gradient(135deg, #8b5cf6, #ec4899); color:#fff; font-size:1.8rem; margin-bottom:15px; box-shadow:0 10px 20px rgba(236, 72, 153, 0.3);">
            <i class="fas fa-gift"></i>
          </div>
          <h2 style="font-size:1.6rem; font-weight:800; margin:0 0 5px 0; color:${textColor};">Exclusive Offers</h2>
          <p style="color:${mutedColor}; font-size:0.95rem; margin:0;">Grab these amazing deals on your next ride.</p>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:16px;">
          <!-- Offer 1 -->
          <div style="background:${isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4'}; border:1px dashed #22c55e; border-radius:12px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#22c55e; color:#fff; width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
              <i class="fas fa-percent"></i>
            </div>
            <div style="flex:1;">
              <h4 style="color:${isDark ? '#4ade80' : '#166534'}; margin:0 0 4px 0; font-weight:700; font-size:1.05rem;">First Ride Free</h4>
              <p style="color:${isDark ? '#86efac' : '#15803d'}; margin:0; font-size:0.85rem; line-height:1.4;">Get 100% off (up to ₹50) on your very first BusFlux booking.</p>
            </div>
          </div>
          
          <!-- Offer 2 -->
          <div style="background:${isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb'}; border:1px dashed #f59e0b; border-radius:12px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#f59e0b; color:#fff; width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
              <i class="fas fa-wallet"></i>
            </div>
            <div style="flex:1;">
              <h4 style="color:${isDark ? '#fbbf24' : '#b45309'}; margin:0 0 4px 0; font-weight:700; font-size:1.05rem;">Cashback Fiesta</h4>
              <p style="color:${isDark ? '#fcd34d' : '#b45309'}; margin:0; font-size:0.85rem; line-height:1.4;">Recharge wallet with ₹500+ and get a flat ₹50 instant cashback.</p>
            </div>
          </div>

          <!-- Offer 3 -->
          <div style="background:${isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff'}; border:1px dashed #3b82f6; border-radius:12px; padding:16px; display:flex; align-items:center; gap:15px;">
            <div style="background:#3b82f6; color:#fff; width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
              <i class="fas fa-route"></i>
            </div>
            <div style="flex:1;">
              <h4 style="color:${isDark ? '#60a5fa' : '#1d4ed8'}; margin:0 0 4px 0; font-weight:700; font-size:1.05rem;">Weekend Getaway</h4>
              <p style="color:${isDark ? '#93c5fd' : '#1e40af'}; margin:0; font-size:0.85rem; line-height:1.4;">20% discount on all weekend rides starting from State Bank terminal.</p>
            </div>
          </div>
        </div>

        <button onclick="closeOffersModal()" style="width:100%; margin-top:25px; padding:14px; background:linear-gradient(135deg, #6366f1, #8b5cf6); color:#fff; border:none; border-radius:10px; font-weight:700; font-size:1.05rem; cursor:pointer; box-shadow:0 6px 15px rgba(99, 102, 241, 0.3); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(99, 102, 241, 0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 6px 15px rgba(99, 102, 241, 0.3)';">Awesome, let's ride!</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Animate in
  setTimeout(() => {
    const modal = document.getElementById("offersModal");
    if (modal) {
      modal.style.opacity = "1";
      modal.children[0].style.transform = "translateY(0)";
    }
  }, 10);
};

window.closeOffersModal = function() {
  const modal = document.getElementById("offersModal");
  if (modal) {
    modal.style.opacity = "0";
    modal.children[0].style.transform = "translateY(30px)";
    setTimeout(() => modal.remove(), 300);
  }
};

// ── Help center toast ──
function showHelpToast() {
  showToast('📞 Help Center coming soon! Email us at support@busflux.in', 'info');
}

function scrollToStats() {
  const el = document.getElementById('statsSection');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
  else showToast('Track Bus feature coming soon!', 'info');
}

// ── Enhanced Navbar updater for sidebar ──
async function updateSidebarUser() {
  const token = localStorage.getItem('token');
  const loginBtn = document.getElementById('topLoginBtn');
  const notiWrap = document.getElementById('notiWrap');
  const qrBtn = document.getElementById('qrBtn');
  const sidebarOffer = document.getElementById('sidebarOffer');

  if (!token) {
    // Show sidebar offer when logged out
    if (sidebarOffer) sidebarOffer.style.display = 'block';
    if (loginBtn) loginBtn.style.display = '';
    if (notiWrap) notiWrap.style.display = 'none';
    if (qrBtn) qrBtn.style.display = 'none';
    return;
  }

  // Hide offer, hide login btn, show noti and qr
  if (sidebarOffer) sidebarOffer.style.display = 'none';
  if (loginBtn) loginBtn.style.display = 'none';
  if (notiWrap) notiWrap.style.display = '';
  if (qrBtn) qrBtn.style.display = '';

  try {
    const res = await fetch(`${UI_API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { localStorage.removeItem('token'); location.reload(); return; }
    const user = await res.json();
    window.currentUserProfileQr = user.profileQr;

    // Update sidebar user info
    const nameEl = document.getElementById('sidebarUserName');
    const actionEl = document.getElementById('sidebarUserAction');
    const avatarEl = document.getElementById('sidebarAvatar');

    if (nameEl) nameEl.textContent = `Hi, ${user.name?.split(' ')[0] || 'Traveler'} 👋`;
    if (actionEl) {
      actionEl.textContent = 'Log out';
      actionEl.href = '#';
      actionEl.style.color = '#ef4444';
      actionEl.onclick = function(e) { 
        e.preventDefault(); 
        e.stopPropagation(); 
        logout(); 
      };
    }
    if (avatarEl && user.userPhoto) {
      avatarEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = typeof window.getImageUrl === 'function' ? window.getImageUrl(user.userPhoto) : user.userPhoto.replace(/\\/g, '/');
      img.alt = user.name || 'User';
      img.onerror = () => {
        avatarEl.innerHTML = '<i class="fas fa-user"></i>';
      };
      avatarEl.appendChild(img);
    }

    // Wallet balance hidden from sidebar nav

    // Conductor / Admin redirects (unless on register page to allow staff to register new users)
    const currentPath = window.location.pathname.toLowerCase();
    if (!currentPath.includes('register.html')) {
      if (user.role === 'conductor') {
        window.location.href = 'conductor.html'; return;
      }
      if (user.role === 'admin') {
        window.location.href = 'admin.html'; return;
      }
    }

    // Fetch notifications
    fetchUserNotifications();
    if (user._id) initUserWebSocket(user._id);

  } catch(e) { console.error('Sidebar user update failed:', e); }
}

function handleSidebarUserClick() {
  const token = localStorage.getItem('token');
  if (token) window.location.href = 'profile.html';
  else window.location.href = 'login.html';
}

// Run on load — handle case where DOMContentLoaded already fired (e.g. wallet.html with inline scripts)
function uiLayoutInit() {
  updateSidebarUser();
  if (typeof updateNavbar === 'function') updateNavbar();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', uiLayoutInit);
} else {
  // DOM already loaded — run immediately
  uiLayoutInit();
}
