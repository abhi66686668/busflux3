
const API = window.location.protocol === 'file:' ? ((window.location.protocol === "file:" ? "http://localhost:5000/api" : "/api") + "") : '/api';
let adminToken = localStorage.getItem("adminToken") || "";
let allUsersGrouped = {};
let allBookingsData = [];
let allConductorsData = [];
let allBusesData = [];

function getImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('data:')) return path;
  if (path.startsWith('http')) return path;
  let clean = path.replace(/\\/g, '/').trim();
  if (!clean.startsWith('/')) clean = '/' + clean;
  return (window.location.protocol === "file:" ? "http://localhost:5000" : "") + clean;
}

// ── Toast ──
function toast(msg, type="info") {
  const icons = { success:"fa-check-circle", error:"fa-exclamation-circle", warning:"fa-exclamation-triangle", info:"fa-info-circle" };
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fas ${icons[type]||icons.info}"></i> ${msg}`;
  document.getElementById("toastContainer").appendChild(t);
  setTimeout(()=>t.remove(), 4000);
}

// ── Auth guard ──
function checkAuth() {
  if (adminToken) {
    document.getElementById("loginScreen").style.display = "none";
    loadDashboard();
    loadBuses();
    loadUsers();
    loadConductors();
    loadBookings();
    loadTransactions();
    const savedPage = sessionStorage.getItem("adminCurrentPage") || "dashboard";
    showPage(savedPage);
  }
}

// ── Admin Login ──
async function adminLogin() {
  const email    = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;
  if (!email || !password) return toast("Fill in all fields","warning");
  try {
    const res  = await fetch(`${API}/admin/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({email,password}) });
    const data = await res.json();
    if (res.ok) {
      adminToken = data.token;
      localStorage.setItem("adminToken", adminToken);
      document.getElementById("adminNameDisplay").textContent = data.name || "Administrator";
      document.getElementById("adminEmail").value = "";
      document.getElementById("adminPassword").value = "";
      document.getElementById("loginScreen").style.display = "none";
      toast("Welcome back, " + (data.name||"Admin"), "success");
      loadDashboard(); loadBuses(); loadUsers(); loadConductors(); loadBookings(); loadTransactions();
      const savedPage = sessionStorage.getItem("adminCurrentPage") || "dashboard";
      showPage(savedPage);
    } else {
      toast(data.message || "Login failed", "error");
    }
  } catch(e) {
    toast("Server error - is the backend running?", "error");
  }
}

function adminLogout() {
  adminToken = "";
  localStorage.removeItem("adminToken");
  document.getElementById("loginScreen").style.display = "flex";
  toast("Logged out successfully", "info");
}

// ── Page navigation ──
function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  if (sb) sb.classList.toggle("open");
}
function showPage(name, btn) {
  const sb = document.getElementById("sidebar");
  if (sb) sb.classList.remove("open");

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".sb-item").forEach(b => b.classList.remove("active"));
  
  const pageElem = document.getElementById("page-"+name);
  if (pageElem) pageElem.classList.add("active");
  
  if (btn) {
    btn.classList.add("active");
  } else {
    const targetBtn = document.querySelector(`.sb-item[onclick="showPage('${name}',this)"]`) || document.querySelector(`.sb-item[onclick="showPage('${name}')"]`);
    if (targetBtn) targetBtn.classList.add("active");
  }

  document.getElementById("topbarTitle").textContent = {
    dashboard:"Dashboard", buses:"Bus Fleet", users:"Users", conductors:"Conductors", bookings:"Bookings", transactions:"Wallet Transactions"
  }[name] || name;
  
  sessionStorage.setItem("adminCurrentPage", name);
}

// ── Dashboard Stats ──
async function loadDashboard() {
  try {
    const res  = await fetch(`${API}/admin/stats`, { headers:{ Authorization:`Bearer ${adminToken}` }});
    const data = await res.json();
    document.getElementById("sTotalBuses").textContent      = data.totalBuses ?? "--";
    document.getElementById("sTotalUsers").textContent      = data.totalUsers ?? "--";
    document.getElementById("sTotalBookings").textContent   = data.totalBookings ?? "--";
    document.getElementById("sTotalRevenue").textContent    = data.totalRevenue ? "₹" + data.totalRevenue.toLocaleString() : "₹0";
    document.getElementById("sTotalConductors").textContent = data.totalConductors ?? "--";

    // Age group cards
    const colors = ["purple","green","orange","blue","pink","teal"];
    const icons  = ["fa-child","fa-person","fa-user","fa-person-walking","fa-person-cane","fa-person-shelter"];
    const el = document.getElementById("ageGroupStats");
    el.innerHTML = "";
    (data.ageGroups || []).forEach((g, i) => {
      el.innerHTML += `
        <div class="stat-card">
          <div class="stat-icon ${colors[i%colors.length]}"><i class="fas ${icons[i%icons.length]}"></i></div>
          <div><div class="stat-val">${g.count}</div><div class="stat-label">${g._id}</div></div>
        </div>`;
    });
    if (!data.ageGroups?.length) el.innerHTML = `<div class="empty" style="grid-column:1/-1"><i class="fas fa-users"></i><p>No user data yet</p></div>`;
  } catch(e) { console.error(e); }
}

// ── Buses ──
async function loadBuses() {
  try {
    const res   = await fetch(`${API}/buses/admin/all`, { headers:{ Authorization:`Bearer ${adminToken}` }});
    allBusesData = await res.json();
    const buses = allBusesData;
    const grid  = document.getElementById("busGrid");
    if (!buses.length) { grid.innerHTML = `<div class="empty"><i class="fas fa-bus"></i><p>No buses added yet</p></div>`; return; }
    grid.innerHTML = buses.map(b => `
      <div class="bus-card-admin">
        ${b.busPhoto
          ? `<img class="bca-img" src="${getImageUrl(b.busPhoto)}" onerror="this.style.display='none'" alt="Bus">`
          : `<div class="bca-img-placeholder"><i class="fas fa-bus fa-3x"></i></div>`}
        <div class="bca-body">
          <div class="bca-top">
            <div>
              <div class="bca-name">${b.busName}</div>
              <div class="bca-num"><i class="fas fa-hashtag" style="font-size:.7rem"></i> ${b.busNumber}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
              <span class="badge ${b.isActive?'badge-green':'badge-red'}">${b.isActive?'Active':'Inactive'}</span>
              <span class="badge ${b.busType==='Express'?'badge-purple':(b.busType==='Mediate'?'badge-teal':'badge-blue')}">${b.busType||'Ordinary'}</span>
            </div>
          </div>
          <div class="bca-route">
            <strong>${b.from}</strong>
            <i class="fas fa-arrow-right" style="font-size:.7rem"></i>
            <strong>${b.to}</strong>
            <span style="margin-left:auto">₹${b.price}</span>
          </div>
          ${b.stops?.length ? `<div style="font-size:.75rem;color:var(--muted)"><i class="fas fa-map-pin" style="margin-right:4px"></i>${b.stops.join(' â†’ ')}</div>` : ''}
          <div class="bca-staff">
            <div class="staff-mini">
              ${b.driverPhoto ? `<img src="${getImageUrl(b.driverPhoto)}" onerror="this.outerHTML='<div style=width:32px;height:32px;border-radius:50%;background:rgba(99,102,241,.15);display:flex;align-items:center;justify-content:center><i class=fas fa-user style=color:var(--primary);font-size:.8rem></i></div>'" alt="">` : `<div style="width:32px;height:32px;border-radius:50%;background:rgba(99,102,241,.15);display:flex;align-items:center;justify-content:center"><i class="fas fa-user" style="color:var(--primary);font-size:.8rem"></i></div>`}
              <div class="si-info"><div class="si-role">Driver</div><div class="si-name">${b.driverName||'"”'}</div>${b.driverPhone?`<div style="font-size:.68rem;color:var(--muted)">${b.driverPhone}</div>`:''}</div>
            </div>
            <div class="staff-mini">
              ${b.conductorPhoto ? `<img src="${getImageUrl(b.conductorPhoto)}" onerror="this.outerHTML='<div style=width:32px;height:32px;border-radius:50%;background:rgba(168,85,247,.15);display:flex;align-items:center;justify-content:center><i class=fas fa-user style=color:var(--primary2);font-size:.8rem></i></div>'" alt="">` : `<div style="width:32px;height:32px;border-radius:50%;background:rgba(168,85,247,.15);display:flex;align-items:center;justify-content:center"><i class="fas fa-user" style="color:var(--primary2);font-size:.8rem"></i></div>`}
              <div class="si-info"><div class="si-role">Conductor</div><div class="si-name">${b.conductorName||'"”'}</div>${b.conductorPhone?`<div style="font-size:.68rem;color:var(--muted)">${b.conductorPhone}</div>`:''}</div>
            </div>
          </div>

          <div class="bca-actions">
            <button class="bca-btn edit" onclick="editBus('${b._id}')"><i class="fas fa-pen"></i> Edit</button>
            <button class="bca-btn del" onclick="deleteBus('${b._id}')"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </div>
      </div>
    `).join("");

    if (allConductorsData && allConductorsData.length) {
      renderConductorsGrid();
    }
  } catch(e) { console.error(e); }
}

// ── Users ──
async function loadUsers() {
  try {
    const res  = await fetch(`${API}/admin/users`, { headers:{ Authorization:`Bearer ${adminToken}` }});
    const data = await res.json();
    allUsersGrouped = data.grouped || {};

    // Build tabs
    const tabsEl = document.getElementById("ageTabs");
    const groups = Object.keys(allUsersGrouped);
    tabsEl.innerHTML = `<button class="age-tab active" onclick="filterUsers('All',this)">All <span class="cnt">${data.users?.length||0}</span></button>`;
    groups.forEach(g => {
      tabsEl.innerHTML += `<button class="age-tab" onclick="filterUsers('${g}',this)">${g} <span class="cnt">${allUsersGrouped[g].length}</span></button>`;
    });

    renderUsers(data.users || []);
  } catch(e) { console.error(e); }
}

function filterUsers(group, btn) {
  document.querySelectorAll(".age-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  if (group === "All") {
    const all = Object.values(allUsersGrouped).flat();
    renderUsers(all);
  } else {
    renderUsers(allUsersGrouped[group] || []);
  }
}

const ageBadgeColor = { Children:"badge-blue", Youth:"badge-green", "Young Adults":"badge-teal", "Middle Age":"badge-orange", Elderly:"badge-purple", Seniors:"badge-red" };

function renderUsers(users) {
  const grid = document.getElementById("usersGrid");
  if (!users.length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><i class="fas fa-users"></i><p>No users in this group</p></div>`; return; }
  grid.innerHTML = users.map(u => `
    <div class="user-card">
      ${u.userPhoto
        ? `<img class="uc-avatar" src="${getImageUrl(u.userPhoto)}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" alt="">`
        : `<div class="uc-avatar" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;background:rgba(99,102,241,.15);color:var(--primary)">${(u.name||'U')[0].toUpperCase()}</div>`}
      <div class="uc-info">
        <div class="uc-name">${u.name||'"”'}</div>
        <div class="uc-email">${u.email}</div>
        <div class="uc-meta">
          <span class="badge ${ageBadgeColor[u.ageGroup]||'badge-blue'}">${u.ageGroup||'Unknown'}</span>
          ${u.age ? `<span class="badge badge-blue">Age ${u.age}</span>` : ''}
          ${u.phone ? `<span class="badge badge-green"><i class="fas fa-phone" style="font-size:.65rem"></i> ${u.phone}</span>` : ''}
        </div>
        ${u.collegeId ? `<div style="font-size:.72rem;color:var(--muted);margin-top:6px"><i class="fas fa-building" style="margin-right:3px"></i>${u.collegeId}</div>` : ''}
        <button class="uc-del" onclick="deleteUser('${u._id}',this)"><i class="fas fa-trash"></i> Remove user</button>
      </div>
    </div>
  `).join("");
}

async function deleteUser(id, btn) {
  if (!confirm("Delete this user?")) return;
  try {
    const res = await fetch(`${API}/admin/users/${id}`, { method:"DELETE", headers:{ Authorization:`Bearer ${adminToken}` }});
    const d   = await res.json();
    if (res.ok) { toast("User deleted","success"); btn.closest(".user-card").remove(); loadDashboard(); }
    else toast(d.message||"Error","error");
  } catch(e) { toast("Error","error"); }
}

// ── Bookings ──
async function loadBookings() {
  try {
    const res       = await fetch(`${API}/admin/bookings`, { headers:{ Authorization:`Bearer ${adminToken}` }});
    allBookingsData = await res.json();
    populateConductorFilter();
    filterBookings();
  } catch(e) { console.error(e); }
}

function populateConductorFilter() {
  try {
    const select = document.getElementById("filterBookingConductor");
    if (!select) return;

    const currentSelection = select.value;
    
    select.innerHTML = `
      <option value="all">All Bookings</option>
      <option value="passenger">Passenger (Online Booking)</option>
    `;
    
    const conductorMap = new Map();
    
    // 1. Add from registered conductors list
    if (Array.isArray(allConductorsData)) {
      allConductorsData.forEach(c => {
        if (c && c._id) {
          conductorMap.set(c._id.toString(), { name: c.name, email: c.email });
        }
      });
    }
    
    // 2. Add from existing bookings (in case a conductor has scans but is not currently in the registered list)
    if (Array.isArray(allBookingsData)) {
      allBookingsData.forEach(b => {
        if (b && b.scannedBy && b.scannedBy._id) {
          const id = b.scannedBy._id.toString();
          if (!conductorMap.has(id)) {
            conductorMap.set(id, { name: b.scannedBy.name, email: b.scannedBy.email });
          }
        }
      });
    }
    
    conductorMap.forEach((conductor, id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${conductor.name} (${conductor.email})`;
      select.appendChild(opt);
    });

    // Restore selection if it still exists
    if (Array.from(select.options).some(opt => opt.value === currentSelection)) {
      select.value = currentSelection;
    }
  } catch (err) {
    console.error("Error populating filter:", err);
    toast("Error populating filter: " + err.message, "error");
  }
}

function filterBookings() {
  try {
    const select = document.getElementById("filterBookingConductor");
    if (!select) return;
    const filterVal = select.value;
    
    let filtered = [];
    let totalBalance = 0;
    
    if (filterVal === "all") {
      filtered = allBookingsData;
    } else if (filterVal === "passenger") {
      filtered = allBookingsData.filter(b => !b.scannedBy);
    } else {
      filtered = allBookingsData.filter(b => b && b.scannedBy && b.scannedBy._id && b.scannedBy._id.toString() === filterVal);
    }
    
    // Calculate total balance for non-failed bookings
    const successfulBookings = filtered.filter(b => b && b.status !== "failed");
    totalBalance = successfulBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    
    const card = document.getElementById("conductorSummaryCard");
    const photoEl = document.getElementById("summaryConductorPhoto");
    const iconEl = document.getElementById("summaryConductorFallbackIcon");
    const busEl = document.getElementById("summaryConductorBus");
    
    if (filterVal !== "all" && filterVal !== "passenger") {
      let condName = "Conductor";
      let condEmail = "";
      let condPhoto = "";
      
      const condObj = allConductorsData.find(c => c && c._id && c._id.toString() === filterVal);
      if (condObj) {
        condName = condObj.name;
        condEmail = condObj.email;
        condPhoto = condObj.userPhoto || "";
      } else {
        const bookingWithConductor = allBookingsData.find(b => b && b.scannedBy && b.scannedBy._id && b.scannedBy._id.toString() === filterVal);
        if (bookingWithConductor && bookingWithConductor.scannedBy) {
          condName = bookingWithConductor.scannedBy.name;
          condEmail = bookingWithConductor.scannedBy.email;
          condPhoto = bookingWithConductor.scannedBy.userPhoto || "";
        }
      }
      
      document.getElementById("summaryConductorName").textContent = condName;
      document.getElementById("summaryConductorEmail").textContent = condEmail;
      document.getElementById("summaryConductorTotal").textContent = "₹" + totalBalance.toLocaleString("en-IN");
      
      // Update photo/icon display
      if (iconEl) {
        iconEl.innerHTML = `<i class="fas fa-user-tie"></i>`;
        iconEl.style.background = "rgba(168,85,247,.15)";
        iconEl.style.color = "#a855f7";
      }
      if (condPhoto && photoEl) {
        photoEl.src = getImageUrl(condPhoto);
        photoEl.style.display = "block";
        if (iconEl) iconEl.style.display = "none";
      } else {
        if (photoEl) photoEl.style.display = "none";
        if (iconEl) iconEl.style.display = "flex";
      }
      
      // Resolve assigned bus name
      const assignedBus = Array.isArray(allBusesData) 
        ? allBusesData.find(b => b.conductorName && b.conductorName.trim().toLowerCase() === condName.trim().toLowerCase()) 
        : null;
      if (busEl) {
        if (assignedBus) {
          busEl.innerHTML = `<span class="badge badge-teal" style="font-size:0.75rem;padding:4px 10px"><i class="fas fa-bus" style="font-size:.65rem;margin-right:4px"></i>Assigned Bus: ${assignedBus.busName} (${assignedBus.busNumber})</span>`;
        } else {
          busEl.innerHTML = `<span class="badge badge-orange" style="font-size:0.75rem;padding:4px 10px"><i class="fas fa-bus" style="font-size:.65rem;margin-right:4px"></i>No Assigned Bus</span>`;
        }
      }
      
      card.style.display = "block";
    } else if (filterVal === "passenger") {
      document.getElementById("summaryConductorName").textContent = "Online Passenger Bookings";
      document.getElementById("summaryConductorEmail").textContent = "Direct self-bookings by passengers via app";
      document.getElementById("summaryConductorTotal").textContent = "₹" + totalBalance.toLocaleString("en-IN");
      
      if (photoEl) photoEl.style.display = "none";
      if (iconEl) {
        iconEl.innerHTML = `<i class="fas fa-globe"></i>`;
        iconEl.style.background = "rgba(99,102,241,.15)";
        iconEl.style.color = "var(--primary)";
        iconEl.style.display = "flex";
      }
      if (busEl) busEl.innerHTML = "";
      
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
    
    renderBookingsTable(filtered);
  } catch (err) {
    console.error("Error filtering bookings:", err);
    toast("Error filtering: " + err.message, "error");
  }
}

function renderBookingsTable(bookings) {
  try {
    const tbody = document.getElementById("bookingsBody");
    if (!bookings || !bookings.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--muted)">No bookings found</td></tr>`;
      return;
    }
    
    tbody.innerHTML = bookings.map(b => {
      if (!b) return "";
      const tid    = b._id ? b._id.slice(-8).toUpperCase() : "--";
      const uname  = b.userId?.name || "--";
      const uemail = b.userId?.email || "--";
      const ugrp   = b.userId?.ageGroup || "--";
      const bname  = b.busId?.busName || "--";
      const bnum   = b.busId?.busNumber || "";
      const route  = b.busId ? `${b.busId.from || ""} â†’ ${b.busId.to || ""}` : "--";
      const dateObj = b.createdAt ? new Date(b.createdAt) : null;
      const dateStr = dateObj ? dateObj.toLocaleDateString("en-IN") : "--";
      const timeStr = dateObj ? dateObj.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true }) : "";
      const isFailed = b.status === "failed";
      const statusBadge = isFailed ? '<span class="badge badge-red">Failed</span>' : '<span class="badge badge-green">Paid</span>';
      
      const userPhotoHtml = b.userId?.userPhoto
        ? `<img src="${getImageUrl(b.userId.userPhoto)}" class="thumb thumb-circle" style="width:32px;height:32px;flex-shrink:0" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" alt="">`
        : `<div class="thumb thumb-circle" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;background:rgba(99,102,241,.15);color:var(--primary);flex-shrink:0">${(uname||'U')[0].toUpperCase()}</div>`;
      
      let billedByHtml = "";
      if (b.scannedBy) {
        const condPhotoHtml = b.scannedBy.userPhoto
          ? `<img src="${getImageUrl(b.scannedBy.userPhoto)}" class="thumb thumb-circle" style="width:28px;height:28px;flex-shrink:0" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" alt="">`
          : `<div class="thumb thumb-circle" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;background:rgba(168,85,247,.15);color:#a855f7;flex-shrink:0">${(b.scannedBy.name||'C')[0].toUpperCase()}</div>`;
        
        billedByHtml = `
          <div style="display:flex;align-items:center;gap:8px">
            ${condPhotoHtml}
            <div>
              <div style="font-weight:600;display:flex;align-items:center;gap:4px">
                <span>${b.scannedBy.name || "--"}</span>
              </div>
              <div style="font-size:0.7rem;color:var(--muted)">${b.scannedBy.email || "--"}</div>
            </div>
          </div>
        `;
      } else {
        billedByHtml = `<span class="badge badge-blue"><i class="fas fa-globe" style="font-size:0.65rem;margin-right:4px"></i>Online</span>`;
      }
      
      return `<tr>
        <td><span style="font-family:monospace;font-size:.8rem">#${tid}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            ${userPhotoHtml}
            <div>
              <div style="font-weight:600">${uname}</div>
              <div style="font-size:.75rem;color:var(--muted)">${uemail}</div>
            </div>
          </div>
        </td>
        <td><span class="badge ${ageBadgeColor[ugrp]||'badge-blue'}">${ugrp}</span></td>
        <td><div>${bname}</div>${bnum?`<div style="font-size:.72rem;color:var(--muted)">${bnum}</div>`:''}</td>
        <td style="font-size:.85rem">${route}</td>
        <td><span class="badge badge-blue">${b.seatsBooked || 0} seat(s)</span></td>
        <td>${billedByHtml}</td>
        <td style="font-weight:700;color:${isFailed ? 'var(--danger)' : '#a855f7'}">₹${b.totalPrice || 0}</td>
        <td>${statusBadge}</td>
        <td>
          <div>${dateStr}</div>
          ${timeStr ? `<div style="font-size:.72rem;color:var(--muted);margin-top:2px">${timeStr}</div>` : ''}
        </td>
      </tr>`;
    }).join("");
  } catch (err) {
    console.error("Error rendering table:", err);
    toast("Error rendering table: " + err.message, "error");
  }
}

// ── Transactions ──
async function loadTransactions() {
  try {
    const res = await fetch(`${API}/admin/transactions`, { headers:{ Authorization:`Bearer ${adminToken}` }});
    const transactions = await res.json();
    const tbody = document.getElementById("transactionsBody");
    if (!transactions.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--muted)">No transactions found</td></tr>`; return; }
    
    tbody.innerHTML = transactions.map(t => {
      const date = new Date(t.createdAt).toLocaleString("en-IN", {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const uname = t.userId?.name || "Unknown User";
      const uemail = t.userId?.email || "--";
      const method = t.method || "Bank Transfer";
      
      let methodColor = "badge-blue";
      if(method.toLowerCase().includes("google")) methodColor = "badge-teal";
      if(method.toLowerCase().includes("phonepe")) methodColor = "badge-purple";
      if(method.toLowerCase().includes("paytm")) methodColor = "badge-blue";

      return `<tr>
        <td style="font-size:.8rem;color:var(--muted)">${date}</td>
        <td style="font-weight:600">${uname}</td>
        <td style="font-size:.75rem;color:var(--muted)">${uemail}</td>
        <td><span class="badge ${methodColor}">${method}</span></td>
        <td style="font-weight:600">₹${t.amount}</td>
        <td style="color:var(--success)">+₹${t.bonus}</td>
        <td style="font-weight:800;color:var(--primary)">₹${t.totalCredit}</td>
        <td><span class="badge badge-green"><i class="fas fa-check"></i> ${t.status}</span></td>
      </tr>`;
    }).join("");
  } catch(e) { console.error("Error loading transactions:", e); }
}

// ── Bus Modal ──
function populateBusConductorSelect(selectedConductorName = "") {
  try {
    const select = document.getElementById("fb_conductorSelect");
    if (!select) return;
    
    select.innerHTML = '<option value="">No Conductor (Unassigned)</option>';
    
    if (Array.isArray(allConductorsData)) {
      allConductorsData.forEach(c => {
        if (c && c.name) {
          const opt = document.createElement("option");
          opt.value = c._id.toString();
          opt.textContent = `${c.name} (${c.email})`;
          select.appendChild(opt);
        }
      });
    }
    
    if (selectedConductorName) {
      const matched = allConductorsData.find(c => c && c.name && c.name.trim().toLowerCase() === selectedConductorName.trim().toLowerCase());
      if (matched) {
        select.value = matched._id.toString();
      } else {
        select.value = "";
      }
    } else {
      select.value = "";
    }
    
    onBusConductorSelectChange();
  } catch (err) {
    console.error("Error populating bus conductor select:", err);
  }
}

function onBusConductorSelectChange() {
  try {
    const select = document.getElementById("fb_conductorSelect");
    const preview = document.getElementById("busConductorPreview");
    if (!select || !preview) return;
    
    const val = select.value;
    if (val) {
      const cond = allConductorsData.find(c => c && c._id.toString() === val);
      if (cond) {
        document.getElementById("busConductorPrevName").textContent = cond.name || "--";
        document.getElementById("busConductorPrevPhone").innerHTML = `<i class="fas fa-phone" style="font-size:0.65rem;margin-right:3px"></i>${cond.phone || '"”'}`;
        document.getElementById("busConductorPrevExp").textContent = `${cond.experience || 0} years exp`;
        
        const photoEl = document.getElementById("busConductorPrevPhoto");
        if (cond.userPhoto) {
          photoEl.src = getImageUrl(cond.userPhoto);
          photoEl.style.display = "block";
        } else {
          photoEl.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
          photoEl.style.display = "block";
        }
        preview.style.display = "block";
        return;
      }
    }
    preview.style.display = "none";
  } catch (err) {
    console.error("Error in onBusConductorSelectChange:", err);
  }
}

function openBusModal(busData=null) {
  document.getElementById("busModal").classList.add("open");
  document.getElementById("busForm").reset();
  clearZonePreviews();
  
  // Populate the registered conductors select dropdown
  populateBusConductorSelect(busData ? busData.conductorName : "");
  
  if (busData) {
    document.getElementById("busModalTitle").innerHTML = '<i class="fas fa-pen" style="color:var(--primary);margin-right:8px"></i>Edit Bus';
    document.getElementById("busEditId").value           = busData._id;
    document.getElementById("f_busName").value           = busData.busName||"";
    document.getElementById("f_busNumber").value         = busData.busNumber||"";
    document.getElementById("f_isActive").value          = busData.isActive?"true":"false";
    document.getElementById("f_busType").value           = busData.busType||"Ordinary";
    document.getElementById("f_from").value              = busData.from||"";
    document.getElementById("f_to").value                = busData.to||"";
    document.getElementById("f_stops").value             = (busData.stops||[]).join(", ");
    document.getElementById("f_price").value             = busData.price||"";
    document.getElementById("f_childPrice").value        = busData.childPrice||"";
    document.getElementById("f_youthPrice").value        = busData.youthPrice||"";
    document.getElementById("f_youngAdultPrice").value   = busData.youngAdultPrice||"";
    document.getElementById("f_middleAgePrice").value    = busData.middleAgePrice||"";
    document.getElementById("f_elderlyPrice").value      = busData.elderlyPrice||"";
    document.getElementById("f_seniorPrice").value       = busData.seniorPrice||"";
    document.getElementById("f_driverName").value        = busData.driverName||"";
    document.getElementById("f_driverPhone").value       = busData.driverPhone||"";
    document.getElementById("f_driverAddress").value     = busData.driverAddress||"";
    document.getElementById("f_driverExperience").value  = busData.driverExperience||"";
  } else {
    document.getElementById("busModalTitle").innerHTML = '<i class="fas fa-bus" style="color:var(--primary);margin-right:8px"></i>Add New Bus';
    document.getElementById("busEditId").value = "";
  }
}

function closeBusModal() {
  document.getElementById("busModal").classList.remove("open");
}

function clearZonePreviews() {
  ["busPhotoRev","driverPhotoRev","conductorPhotoRev"].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display="none";
  });
  ["busPhotoName","driverPhotoName","conductorPhotoName"].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent="";
  });
}

function zonePreview(input, zoneId, revId, nameId) {
  const file = input.files[0]; if (!file) return;
  document.getElementById(nameId).textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById(revId);
    img.src = e.target.result; img.style.display = "block";
  };
  reader.readAsDataURL(file);
}

// ── Save Bus ──
document.getElementById("busForm").addEventListener("submit", async e => {
  e.preventDefault();
  const editId = document.getElementById("busEditId").value;
  const fd = new FormData();
  
  // Loop basic/driver fields (no conductor fields here, we handle them from select dropdown)
  const fields = ["busName","busNumber","totalSeats","isActive","busType","from","to","departureTime","arrivalTime","stops",
    "price","childPrice","youthPrice","youngAdultPrice","middleAgePrice","elderlyPrice","seniorPrice",
    "driverName","driverPhone","driverAddress","driverExperience"];
  fields.forEach(f => {
    const el = document.getElementById("f_"+f);
    if (el) fd.append(f, el.value);
  });
  
  const typeVal = document.getElementById("f_busType")?.value;
  fd.append("isExpress", typeVal === "Express" ? "true" : "false");
  
  ["busPhoto","driverPhoto"].forEach(f => {
    const el = document.getElementById("f_"+f);
    if (el?.files[0]) fd.append(f, el.files[0]);
  });
  
  // Set Conductor Details from selection dropdown
  const conductorSelect = document.getElementById("fb_conductorSelect");
  if (conductorSelect && conductorSelect.value) {
    const cond = allConductorsData.find(c => c && c._id.toString() === conductorSelect.value);
    if (cond) {
      fd.append("conductorName", cond.name || "");
      fd.append("conductorPhone", cond.phone || "");
      fd.append("conductorExperience", cond.experience ? cond.experience + " years" : "0 years");
      if (cond.userPhoto) {
        fd.append("conductorPhoto", cond.userPhoto);
      }
    }
  } else {
    fd.append("conductorName", "");
    fd.append("conductorPhone", "");
    fd.append("conductorExperience", "");
    fd.append("conductorPhoto", "");
  }

  // Also set availableSeats = totalSeats on new bus
  if (!editId) fd.append("availableSeats", 40);

  const url    = editId ? `${API}/buses/${editId}` : `${API}/buses/add`;
  const method = editId ? "PUT" : "POST";
  try {
    const res  = await fetch(url, { method, headers:{ Authorization:`Bearer ${adminToken}` }, body:fd });
    const data = await res.json();
    if (res.ok) {
      toast(data.message || "Saved!", "success");
      closeBusModal();
      loadBuses();
      loadDashboard();
    } else {
      toast(data.message || "Error saving bus", "error");
    }
  } catch(e) {
    toast("Network error","error");
  }
});

// ── Edit Bus ──
async function editBus(id) {
  try {
    const res = await fetch(`${API}/buses/${id}`, { headers:{ Authorization:`Bearer ${adminToken}` }});
    const bus = await res.json();
    openBusModal(bus);
  } catch(e) { toast("Failed to load bus","error"); }
}

// ── Delete Bus ──
async function deleteBus(id) {
  if (!confirm("Permanently delete this bus?")) return;
  try {
    const res  = await fetch(`${API}/buses/${id}`, { method:"DELETE", headers:{ Authorization:`Bearer ${adminToken}` }});
    const data = await res.json();
    if (res.ok) { toast("Bus deleted","success"); loadBuses(); loadDashboard(); }
    else toast(data.message||"Error","error");
  } catch(e) { toast("Error","error"); }
}

// ── Conductor JavaScript Functions ──
async function loadConductors() {
  try {
    const res = await fetch(`${API}/admin/conductors`, { headers:{ Authorization:`Bearer ${adminToken}` }});
    allConductorsData = await res.json();
    populateConductorFilter();
    renderConductorsGrid();
  } catch(e) { console.error(e); }
}

function renderConductorsGrid() {
  try {
    const grid = document.getElementById("conductorsGrid");
    if (!grid) return;
    const conductors = allConductorsData || [];
    if (!conductors.length) { grid.innerHTML = `<div class="empty"><i class="fas fa-user-tie"></i><p>No conductors registered yet</p></div>`; return; }
    
    grid.innerHTML = conductors.map(c => {
      if (!c) return "";
      
      const assignedBus = Array.isArray(allBusesData) ? allBusesData.find(b => b.conductorName && b.conductorName.trim().toLowerCase() === c.name.trim().toLowerCase()) : null;
      
      const busHtml = assignedBus 
        ? `<span class="badge badge-teal" style="margin-top:6px"><i class="fas fa-bus" style="font-size:.65rem;margin-right:4px"></i>${assignedBus.busName}</span>`
        : `<span class="badge badge-orange" style="margin-top:6px"><i class="fas fa-bus" style="font-size:.65rem;margin-right:4px"></i>No Assigned Bus</span>`;

      return `
        <div class="user-card">
          ${c.userPhoto
            ? `<img class="uc-avatar" src="${getImageUrl(c.userPhoto)}" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'" alt="">`
            : `<div class="uc-avatar" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;background:rgba(168,85,247,.15);color:#a855f7">${(c.name||'C')[0].toUpperCase()}</div>`}
          <div class="uc-info">
            <div class="uc-name">${c.name||'"”'}</div>
            <div class="uc-email">${c.email}</div>
            <div class="uc-meta">
              <span class="badge badge-purple">${c.experience || 0} years exp</span>
              ${c.phone ? `<span class="badge badge-green"><i class="fas fa-phone" style="font-size:.65rem"></i> ${c.phone}</span>` : ''}
              ${busHtml}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.05)">
              <button class="btn-icon edit" onclick="editConductor('${c._id}')" style="background:rgba(99,102,241,.12);color:var(--primary);width:30px;height:30px;border-radius:6px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:var(--tr)" title="Edit Conductor"><i class="fas fa-pen"></i></button>
              <button class="uc-del" onclick="deleteConductor('${c._id}',this)" style="margin-top:0;font-size:0.8rem"><i class="fas fa-trash" style="margin-right:4px"></i>Remove</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error rendering conductors grid:", err);
  }
}

function openConductorModal(conductorData = null) {
  document.getElementById("conductorModal").classList.add("open");
  document.getElementById("conductorForm").reset();
  
  const rev = document.getElementById("cPhotoRev"); if(rev) rev.style.display = "none";
  const name = document.getElementById("cPhotoName"); if(name) name.textContent = "";
  
  const titleEl = document.querySelector("#conductorModal h3");
  const pwdInput = document.getElementById("fc_password");
  const editIdEl = document.getElementById("fc_editId");

  if (conductorData) {
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-user-tie" style="color:var(--primary);margin-right:8px"></i>Edit Conductor';
    editIdEl.value = conductorData._id;
    document.getElementById("fc_name").value = conductorData.name || "";
    document.getElementById("fc_email").value = conductorData.email || "";
    document.getElementById("fc_phone").value = conductorData.phone || "";
    document.getElementById("fc_experience").value = conductorData.experience || 0;
    
    pwdInput.required = false;
    pwdInput.placeholder = "Leave blank to keep current";
    
    if (conductorData.userPhoto) {
      if (rev) {
        rev.src = getImageUrl(conductorData.userPhoto);
        rev.style.display = "block";
      }
      if (name) {
        name.textContent = "Current profile photo";
      }
    }
  } else {
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-user-tie" style="color:var(--primary);margin-right:8px"></i>Add New Conductor';
    editIdEl.value = "";
    pwdInput.required = true;
    pwdInput.placeholder = "••••••••";
  }
}

function closeConductorModal() {
  document.getElementById("conductorModal").classList.remove("open");
}

function editConductor(id) {
  try {
    const conductor = allConductorsData.find(c => c && c._id === id);
    if (!conductor) {
      toast("Conductor not found in memory", "error");
      return;
    }
    openConductorModal(conductor);
  } catch (err) {
    console.error("Error editing conductor:", err);
  }
}

document.getElementById("conductorForm").addEventListener("submit", async e => {
  e.preventDefault();
  const editId = document.getElementById("fc_editId").value;
  const fd = new FormData();
  
  fd.append("name", document.getElementById("fc_name").value);
  fd.append("email", document.getElementById("fc_email").value);
  
  const pwdVal = document.getElementById("fc_password").value;
  if (pwdVal) {
    fd.append("password", pwdVal);
  }
  
  fd.append("phone", document.getElementById("fc_phone").value);
  fd.append("experience", document.getElementById("fc_experience").value);
  
  const photoInput = document.getElementById("fc_photo");
  if (photoInput?.files[0]) {
    fd.append("userPhoto", photoInput.files[0]);
  }
  
  const url = editId ? `${API}/admin/conductors/${editId}` : `${API}/admin/conductors/add`;
  const method = editId ? "PUT" : "POST";
  
  try {
    const res = await fetch(url, {
      method: method,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: fd
    });
    const data = await res.json();
    if (res.ok) {
      toast(editId ? "Conductor updated successfully" : "Conductor added successfully", "success");
      closeConductorModal();
      loadConductors();
      loadDashboard();
    } else {
      toast(data.message || "Error saving conductor", "error");
    }
  } catch(e) {
    toast("Network error", "error");
  }
});

async function deleteConductor(id, btn) {
  if (!confirm("Permanently remove this conductor?")) return;
  try {
    const res = await fetch(`${API}/admin/conductors/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (res.ok) {
      toast("Conductor deleted", "success");
      btn.closest(".user-card").remove();
      loadDashboard();
    } else {
      toast(data.message || "Error deleting conductor", "error");
    }
  } catch(e) {
    toast("Error", "error");
  }
}

// ── Click outside modal to close ──
document.getElementById("busModal").addEventListener("click", function(e) {
  if (e.target === this) closeBusModal();
});

document.getElementById("conductorModal").addEventListener("click", function(e) {
  if (e.target === this) closeConductorModal();
});

// Close notification dropdown when clicking outside
document.addEventListener("click", function(e) {
  const notiWrap = document.getElementById("adminNotiWrapper");
  const notiDrop = document.getElementById("adminNotiDropdown");
  if (notiWrap && notiDrop && !notiWrap.contains(e.target)) {
    notiDrop.style.display = "none";
  }
});

// ── Notifications ──
let adminNotifications = [];
let notiPollingInterval = null;

async function fetchAdminNotifications() {
  if (!adminToken) return;
  try {
    const res = await fetch(`${API}/admin/notifications`, { headers: { Authorization: `Bearer ${adminToken}` } });
    if (res.ok) {
      adminNotifications = await res.json();
      renderAdminNotifications();
    }
  } catch (err) {
    console.error("Error fetching notifications", err);
  }
}

function renderAdminNotifications() {
  const listEl = document.getElementById("adminNotiList");
  const dotEl = document.getElementById("adminNotiDot");
  
  if (!adminNotifications || adminNotifications.length === 0) {
    listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted);">No notifications</div>';
    dotEl.style.display = 'none';
    return;
  }
  
  const unreadCount = adminNotifications.filter(n => !n.read).length;
  if (unreadCount > 0) {
    dotEl.style.display = 'block';
  } else {
    dotEl.style.display = 'none';
  }
  
  listEl.innerHTML = adminNotifications.map(n => {
    let icon = "fa-info-circle";
    let color = "var(--info)";
    if (n.type === 'success') { icon = "fa-check-circle"; color = "var(--success)"; }
    else if (n.type === 'warning') { icon = "fa-exclamation-triangle"; color = "var(--warning)"; }
    else if (n.type === 'error') { icon = "fa-times-circle"; color = "var(--danger)"; }
    
    return `
      <div style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; gap:12px; align-items:flex-start; ${n.read ? 'opacity:0.6;' : 'background:rgba(255,255,255,0.02);'}" onclick="markAdminNotiRead('${n._id}', event)">
        <i class="fas ${icon}" style="color:${color}; margin-top:3px;"></i>
        <div style="flex:1;">
          <div style="font-weight:700; color:var(--text); margin-bottom:2px;">${n.title}</div>
          <div style="color:var(--muted); font-size:0.8rem; line-height:1.4;">${n.message}</div>
          <div style="font-size:0.7rem; color:rgba(255,255,255,0.3); margin-top:4px;">${new Date(n.createdAt).toLocaleString()}</div>
        </div>
      </div>
    `;
  }).join("");
}

function toggleAdminNotifications(e) {
  const notiDrop = document.getElementById("adminNotiDropdown");
  if (notiDrop.style.display === "none") {
    notiDrop.style.display = "block";
    fetchAdminNotifications();
  } else {
    notiDrop.style.display = "none";
  }
}

async function markAdminNotiRead(id, e) {
  if (e) {
    e.stopPropagation(); // prevent dropdown from closing if clicking individual notification
  }
  try {
    const res = await fetch(`${API}/admin/notifications/read`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}` 
      },
      body: JSON.stringify({ id })
    });
    if (res.ok) {
      await fetchAdminNotifications();
    }
  } catch (err) {
    console.error("Failed to mark notification read", err);
  }
}

// ── Init ──
checkAuth();

// WebSocket connection for real-time notifications
const SOCKET_URL = API.replace('/api', '');
const socket = io(SOCKET_URL);

if (adminToken) {
  fetchAdminNotifications();
  
  socket.on('new_admin_notification', (notif) => {
    // Show toast for immediate alert
    toast("New Alert: " + notif.message, notif.type || "info");
    // Fetch updated list
    fetchAdminNotifications();
  });
  
  socket.on('admin_data_updated', () => {
    // Silently refresh data
    loadDashboard();
    loadTransactions();
    loadBookings();
  });
}

// ================= THEME TOGGLE =================
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = savedTheme === 'light' ? 'fas fa-sun theme-icon' : 'fas fa-moon theme-icon';
    icon.style.color = savedTheme === 'light' ? '#f59e0b' : '#6366f1';
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = newTheme === 'light' ? 'fas fa-sun theme-icon' : 'fas fa-moon theme-icon';
    icon.style.color = newTheme === 'light' ? '#f59e0b' : '#6366f1';
  }
}

document.addEventListener("DOMContentLoaded", initTheme);

