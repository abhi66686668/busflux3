
    const API = window.location.protocol === 'file:' ? ((window.location.protocol === "file:" ? "http://localhost:5000/api" : "/api") + "") : '/api';
    window.getImageUrl = function(path) {
      if (!path) return '';
      if (path.startsWith('http') || path.startsWith('data:')) return path;
      return `${window.location.protocol === "file:" ? "http://localhost:5000/" : "/"}` + `${path.replace(/^\/+/, '')}`;
    };
    const token = localStorage.getItem("token");
    let buses = [];
    let conductorHistory = [];
    let allHistoryLogs = [];
    let currentPassenger = null;

    // Chart instances
    let barSalesChart = null;
    let targetGaugeChart = null;
    let areaTripChart = null;

    // Camera scanner state
    let activeScanner = null;
    let scannerTargetType = "";

    // Theme state
    if (localStorage.getItem("theme") === "dark") {
      document.body.classList.add("dark-mode");
      document.getElementById("themeIcon").className = "fas fa-sun";
    }

    // Authenticate Conductor
    if (!token) {
      window.location.href = "login.html";
    } else {
      fetch(`${API}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } })
        .then(res => res.json())
        .then(user => {
          if (user.role !== 'conductor' && user.role !== 'admin') {
            window.location.href = "index.html";
          } else {
            document.getElementById("cName").textContent = user.name || "Conductor";
            document.getElementById("cEmail").textContent = user.email || "Staff";
            if (user.userPhoto) {
              document.getElementById("cPhoto").src = `${window.getImageUrl(user.userPhoto)}`;
            }
            
            // Populate Conductor profile details form fields
            document.getElementById("profileName").value = user.name || "";
            document.getElementById("profileEmail").value = user.email || "";
            document.getElementById("profileAge").value = user.age || "";
            document.getElementById("profileExperience").value = user.experience || "";
            document.getElementById("profilePhone").value = user.phone || "";
            if (user.userPhoto) {
              document.getElementById("profilePreviewImg").src = `${window.getImageUrl(user.userPhoto)}`;
            }
            
            loadBusesList();
            refreshDashboardData();
            addNotification("Conductor Connected", `Successfully authenticated as Conductor ${user.name || 'Staff'}.`, "success");

            // Initialize WebSockets
            try {
              const SOCKET_URL = API.replace('/api', '');
              const socket = io(SOCKET_URL);
              
              socket.on('connect', () => {
                socket.emit('join_room', user._id);
                console.log("WebSocket connected and joined room:", user._id);
              });
              
              socket.on('new_notification', (notif) => {
                addNotification(notif.title || "Alert", notif.message, notif.type || "info");
              });
              
              socket.on('admin_data_updated', () => {
                refreshDashboardData();
                loadHistoryTable();
              });
            } catch(e) {
              console.error("Failed to initialize WebSocket for Conductor:", e);
            }
          }
        })
        .catch(err => {
          console.error("Conductor auth error:", err);
          localStorage.removeItem("token");
          window.location.href = "login.html";
        });
    }

    function logout() {
      localStorage.removeItem("token");
      window.location.href = "login.html";
    }

    // Toggle Theme (Dark/Light)
    function toggleTheme() {
      const isDark = document.body.classList.toggle("dark-mode");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      document.getElementById("themeIcon").className = isDark ? "fas fa-sun" : "fas fa-moon";
      
      // Reload charts to update styling
      initCharts();
    }

    // Toggle sidebar for mobile
    function toggleSidebar() {
      document.getElementById("sidebar").classList.toggle("open");
    }

    // Tab switcher
    function switchTab(tabId, el) {
      // Gracefully stop active camera scanner when switching tabs
      closeCameraScanner();

      document.querySelectorAll(".dashboard-page").forEach(p => p.classList.remove("active"));
      document.querySelectorAll(".menu-link").forEach(l => l.classList.remove("active"));
      
      if (tabId === 'dashboard') {
        document.getElementById("page-dashboard").classList.add("active");
        document.getElementById("linkDashboard").classList.add("active");
        refreshDashboardData();
      } else if (tabId === 'billing') {
        document.getElementById("page-billing").classList.add("active");
        document.getElementById("linkBilling").classList.add("active");
      } else if (tabId === 'history') {
        document.getElementById("page-history").classList.add("active");
        document.getElementById("linkHistory").classList.add("active");
        loadHistoryTable();
      } else if (tabId === 'scan-ticket') {
        document.getElementById("page-scan-ticket").classList.add("active");
        document.getElementById("linkScanTicket").classList.add("active");
        resetScanTicketArea();
      } else if (tabId === 'profile') {
        document.getElementById("page-profile").classList.add("active");
        document.getElementById("linkProfile").classList.add("active");
      }
      
      // Close sidebar on mobile after clicking
      document.getElementById("sidebar").classList.remove("open");
    }

    // --- LIVE CAMERA QR CODE SCANNER UTILITIES ---
    function startCameraScanner(targetType) {
      scannerTargetType = targetType;
      
      const modal = document.getElementById("cameraScannerModal");
      modal.style.display = "flex";
      // Clear status
      document.getElementById("cameraScannerStatus").innerHTML = `<i class="fas fa-spinner fa-spin"></i> Initializing camera...`;
      
      setTimeout(() => {
        modal.style.opacity = "1";
      }, 10);

      // Enumerating cameras
      Html5Qrcode.getCameras().then(devices => {
        const select = document.getElementById("cameraSourceSelect");
        select.innerHTML = "";
        
        if (devices && devices.length > 0) {
          let preferredCameraId = null;
          
          devices.forEach((device, index) => {
            const option = document.createElement("option");
            option.value = device.id;
            option.text = device.label || `Camera ${index + 1}`;
            select.appendChild(option);
            
            // Check for rear-facing cameras
            const labelLower = (device.label || "").toLowerCase();
            if (labelLower.includes("back") || labelLower.includes("rear") || labelLower.includes("environment")) {
              preferredCameraId = device.id;
            }
          });
          
          const activeCameraId = preferredCameraId || devices[0].id;
          select.value = activeCameraId;
          
          startScanning(activeCameraId);
        } else {
          document.getElementById("cameraScannerStatus").innerText = "No cameras detected on this device.";
        }
      }).catch(err => {
        console.error("Camera access failed:", err);
        document.getElementById("cameraScannerStatus").innerHTML = `<span style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Permission Denied or Access Failed</span>`;
      });
    }

    async function startScanning(cameraId) {
      try {
        if (activeScanner) {
          await activeScanner.stop().catch(() => {});
        }
        
        activeScanner = new Html5Qrcode("cameraScannerPreview");
        
        const config = {
          fps: 15
        };

        await activeScanner.start(
          cameraId,
          config,
          (decodedText) => {
            handleScannerSuccess(decodedText);
          },
          (errorMessage) => {
            // Frame parse warning, ignore
          }
        );
        
        document.getElementById("cameraScannerStatus").innerText = "Point your camera at a QR code";
      } catch (err) {
        console.error("Error starting camera stream:", err);
        document.getElementById("cameraScannerStatus").innerHTML = `<span style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Failed to open camera stream</span>`;
      }
    }

    function changeCameraSource() {
      const select = document.getElementById("cameraSourceSelect");
      if (select.value) {
        startScanning(select.value);
      }
    }

    function handleScannerSuccess(decodedText) {
      document.getElementById("cameraScannerStatus").innerHTML = `<span style="color: var(--success); font-weight: 700;"><i class="fas fa-check-circle"></i> QR Code Detected!</span>`;
      
      // Play a short high-pitch confirmation beep using Web Audio API
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.12);
      } catch (e) {
        // Fallback if audio context block or unsupported
      }

      // Briefly wait to let the success feedback render, then stop stream and trigger processing
      setTimeout(() => {
        closeCameraScanner();
        
        const cleanText = decodedText.trim();
        if (scannerTargetType === "passenger") {
          processPassDeduction(cleanText);
        } else if (scannerTargetType === "ticket") {
          processTicketScan(cleanText);
        }
      }, 500);
    }

    function closeCameraScanner() {
      const modal = document.getElementById("cameraScannerModal");
      modal.style.opacity = "0";
      setTimeout(() => {
        modal.style.display = "none";
      }, 300);
      
      if (activeScanner) {
        activeScanner.stop().then(() => {
          activeScanner = null;
        }).catch(err => {
          console.error("Error stopping scanner stream:", err);
          activeScanner = null;
        });
      }
    }

    // Load buses
    async function loadBusesList() {
      try {
        const res = await fetch(`${API}/buses`);
        if (res.ok) {
          buses = await res.json();
          const select = document.getElementById("busSelect");
          select.innerHTML = buses.map(b => `<option value="${b._id}">${b.busName} (${b.busNumber})</option>`).join("");
          handleBusChange();
        }
      } catch (err) {
        console.error("Failed to load buses:", err);
      }
    }

    function handleBusChange() {
      const busId = document.getElementById("busSelect").value;
      const bus = buses.find(b => b._id === busId);
      if (!bus) return;

      const allStops = [bus.from, ...(bus.stops || []), bus.to];
      const bSelect = document.getElementById("boardingSelect");
      bSelect.innerHTML = allStops.slice(0, -1).map(stop => `<option value="${stop}">${stop}</option>`).join("");
      
      handleBoardingChange();

      if (currentPassenger) {
        renderPassengerReview(currentPassenger);
      }
    }

    function handleBoardingChange() {
      const busId = document.getElementById("busSelect").value;
      const bus = buses.find(b => b._id === busId);
      if (!bus) return;

      const allStops = [bus.from, ...(bus.stops || []), bus.to];
      const boardingStop = document.getElementById("boardingSelect").value;
      const bIndex = allStops.indexOf(boardingStop);

      const dSelect = document.getElementById("droppingSelect");
      dSelect.innerHTML = allStops.slice(bIndex + 1).map(stop => `<option value="${stop}">${stop}</option>`).join("");

      if (currentPassenger) {
        renderPassengerReview(currentPassenger);
      }
    }

    function handleDroppingChange() {
      if (currentPassenger) {
        renderPassengerReview(currentPassenger);
      }
    }

    function renderPassengerReview(passenger) {
      if (!passenger) return;
      
      const busId = document.getElementById("busSelect").value;
      const boardingPoint = document.getElementById("boardingSelect").value;
      const droppingPoint = document.getElementById("droppingSelect").value;

      if (!busId || !boardingPoint || !droppingPoint) {
        return;
      }

      const bus = buses.find(b => b._id === busId);
      if (!bus) return;

      // Calculate pricing
      const basePrice = getAgeGroupPrice(bus, passenger.ageGroup || "");
      const ratio = getStopRatio(bus, boardingPoint, droppingPoint);
      const totalPrice = Math.round(basePrice * ratio);

      const photoUrl = passenger.userPhoto 
        ? `${window.getImageUrl(passenger.userPhoto)}` 
        : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

      const resArea = document.getElementById("billingResultArea");
      resArea.innerHTML = `
        <div class="passenger-review-card" style="width:100%; animation: fadeUp 0.3s ease;">
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
            <img src="${photoUrl}" style="width: 65px; height: 65px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
            <div style="text-align: left;">
              <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">${passenger.name}</h4>
              <p style="font-size: 0.8rem; color: var(--text-muted);">${passenger.email}</p>
              <span style="display: inline-block; font-size: 0.75rem; font-weight: 600; padding: 2px 8px; border-radius: 12px; background: var(--primary-light); color: var(--primary); margin-top: 4px;">
                ${passenger.ageGroup || 'General'} (${passenger.age || passenger.ageGroup || 'N/A'} yrs)
              </span>
            </div>
          </div>

          <div style="background: var(--bg-body); border-radius: var(--radius); padding: 16px; margin-bottom: 20px; text-align: left; transition: background-color 0.3s;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.85rem;">
              <span style="color: var(--text-muted);">Route:</span>
              <span style="font-weight: 600; color: var(--text-main);">${bus.busName}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.85rem;">
              <span style="color: var(--text-muted);">Stops:</span>
              <span style="font-weight: 600; color: var(--text-main);">${boardingPoint} &rarr; ${droppingPoint}</span>
            </div>
            <hr style="border: none; border-top: 1px solid var(--border-color); margin: 10px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">Calculated Fare:</span>
              <span style="font-size: 1.1rem; font-weight: 800; color: var(--primary);">₹${totalPrice}</span>
            </div>
            <div style="display: none; justify-content: space-between;">
              <span style="color: var(--text-muted); font-size: 0.9rem;">Wallet Balance:</span>
              <span style="font-size: 1.1rem; font-weight: 700; color: ${passenger.balance >= totalPrice ? 'var(--success)' : 'var(--danger)'};">₹${passenger.balance}</span>
            </div>
          </div>

          ${totalPrice <= 0 ? `
            <div style="display: flex; align-items: center; gap: 8px; color: var(--danger); font-size: 0.85rem; font-weight: 700; background-color: var(--danger-light); padding: 10px 14px; border-radius: var(--radius); margin-bottom: 12px; justify-content: center;">
              <i class="fas fa-exclamation-circle"></i> INVALID FARE: ₹0 CANNOT BE PAID
            </div>
            <button class="btn-action" disabled style="background: var(--border-color); color: var(--text-muted); cursor: not-allowed;">
              Deduction Locked
            </button>
          ` : passenger.balance >= totalPrice ? `
            <button class="btn-action" onclick="confirmDeductPass('${passenger.email}', '${busId}', '${boardingPoint}', '${droppingPoint}', ${passenger.balance}, ${totalPrice}, '${passenger.name}')" style="background: linear-gradient(135deg, var(--success), #34d399); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">
              <i class="fas fa-check-circle"></i> Confirm & Deduct ₹${totalPrice}
            </button>
          ` : `
            <div style="display: flex; align-items: center; gap: 8px; color: var(--danger); font-size: 0.85rem; font-weight: 700; background-color: var(--danger-light); padding: 10px 14px; border-radius: var(--radius); margin-bottom: 12px; justify-content: center;">
              <i class="fas fa-exclamation-circle"></i> INSUFFICIENT PASSENGER BALANCE
            </div>
            <button class="btn-action" disabled style="background: var(--border-color); color: var(--text-muted); cursor: not-allowed;">
              Deduction Locked
            </button>
          `}
        </div>
      `;
    }

    // Issue Ticket by manual email
    function verifyPassengerEmail() {
      const email = document.getElementById("manualEmail").value.trim();
      if (!email) {
        alert("Please enter passenger email.");
        return;
      }
      processPassDeduction(email);
    }

    // Handle uploaded QR Pass
    async function handleFileUpload(event) {
      if (event.target.files.length === 0) return;
      const file = event.target.files[0];
      const html5QrCode = new Html5Qrcode("hiddenReader");
      
      const resArea = document.getElementById("billingResultArea");
      resArea.innerHTML = `
        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
        <div style="font-weight:700;">Reading QR Image...</div>
      `;

      try {
        const decodedText = await html5QrCode.scanFile(file, false);
        processPassDeduction(decodedText.trim());
      } catch (err) {
        console.error(err);
        resArea.innerHTML = `
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger); margin-bottom: 15px;"></i>
          <div style="font-weight:700; color: var(--danger);">QR Code Not Found</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px; text-align: center;">Could not find a valid QR ticket in the uploaded image.</div>
        `;
        addNotification("QR Scanner", "Failed to read QR image. Invalid format.", "danger");
      }
      event.target.value = "";
    }

    function getAgeGroupPrice(bus, ageGroup) {
      const map = {
        "Children": bus.childPrice,
        "Youth": bus.youthPrice,
        "Young Adults": bus.youngAdultPrice,
        "Middle Age": bus.middleAgePrice,
        "Elderly": bus.elderlyPrice,
        "Seniors": bus.seniorPrice,
      };
      const p = map[ageGroup];
      return p && p > 0 ? p : bus.price;
    }

    function getStopRatio(bus, boardingPoint, droppingPoint) {
      const allStops = [bus.from, ...(bus.stops || []), bus.to];
      const total = allStops.length - 1;
      if (total === 0) return 1;
      const bIdx = allStops.findIndex(s => s.toLowerCase() === boardingPoint.toLowerCase());
      const dIdx = allStops.findIndex(s => s.toLowerCase() === droppingPoint.toLowerCase());
      if (bIdx === -1 || dIdx === -1 || dIdx <= bIdx) return 1;
      return (dIdx - bIdx) / total;
    }

    // Spot Ticket - Step 1: Search Passenger
    async function processPassDeduction(email) {
      const busId = document.getElementById("busSelect").value;
      const boardingPoint = document.getElementById("boardingSelect").value;
      const droppingPoint = document.getElementById("droppingSelect").value;

      if (!busId || !boardingPoint || !droppingPoint) {
        const rArea = document.getElementById("billingResultArea");
        if (rArea) {
          rArea.innerHTML = `
            <div style="animation: fadeUp 0.4s ease; text-align: center; width: 100%;">
              <i class="fas fa-exclamation-triangle" style="font-size: 3.5rem; color: var(--warning); margin-bottom: 15px;"></i>
              <div style="font-weight:800; color: var(--warning); font-size: 1.1rem; margin-bottom: 12px; letter-spacing: 0.5px;">ROUTE SELECTION REQUIRED</div>
              <div style="font-size: 0.88rem; color: var(--text-main); font-weight: 600; margin-bottom: 8px;">Please select Bus and Route Stops first.</div>
              <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">We need the boarding and dropping points to calculate the correct fare.</div>
            </div>
          `;
        }
        alert("Please select Bus and Route Stops first.");
        return;
      }

      const bus = buses.find(b => b._id === busId);
      if (!bus) {
        alert("Selected bus not found.");
        return;
      }

      const resArea = document.getElementById("billingResultArea");
      resArea.innerHTML = `
        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
        <div style="font-weight:700;">Searching Passenger...</div>
      `;

      try {
        const res = await fetch(`${API}/conductor/search-passenger?email=${encodeURIComponent(email)}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          const errData = await res.json();
          resArea.innerHTML = `
            <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: var(--danger); margin-bottom: 15px;"></i>
            <div style="font-weight:700; color: var(--danger);">Passenger Not Found</div>
            <div style="font-size: 0.82rem; margin-top: 5px; text-align: center;">${errData.message || "Could not find passenger profile."}</div>
          `;
          currentPassenger = null;
          return;
        }

        const passenger = await res.json();
        currentPassenger = passenger;
        renderPassengerReview(currentPassenger);
      } catch (err) {
        console.error(err);
        resArea.innerHTML = `
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger); margin-bottom: 15px;"></i>
          <div style="font-weight:700; color: var(--danger);">Network Error</div>
        `;
        currentPassenger = null;
      }
    }

    function animateValue(obj, start, end, duration) {
      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = "₹" + Math.floor(start - (progress * (start - end)));
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          obj.innerHTML = "₹" + end;
        }
      };
      window.requestAnimationFrame(step);
    }

    async function confirmDeductPass(email, busId, boardingPoint, droppingPoint, currentBalance, fare, name) {
      const resArea = document.getElementById("billingResultArea");
      const targetBalance = currentBalance - fare;

      // 1. Show the deducting animation stage
      resArea.innerHTML = `
        <div class="deducting-stage" style="animation: fadeUp 0.3s ease;">
          <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 15px; color: var(--primary); letter-spacing: 0.5px;">PROCESSING PAYMENT...</div>
          
          <!-- Wallet Card -->
          <div class="wallet-card-anim">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="chip"></div>
              <div class="brand" style="color: rgba(255,255,255,0.7); font-size: 0.65rem;">PASS WALLET</div>
            </div>
            <div class="balance" id="animBalance">₹${currentBalance}</div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 0.75rem; opacity: 0.9;">
              <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${name}</div>
              <div style="font-weight: 800;">BUSFLUX</div>
            </div>
          </div>

          <!-- Coin Flight Container -->
          <div class="coin-container">
            <i class="fas fa-coins coin-gold coin-1"></i>
            <i class="fas fa-coins coin-gold coin-2"></i>
            <i class="fas fa-coins coin-gold coin-3"></i>
          </div>

          <!-- Ticket Printer Icon -->
          <i class="fas fa-receipt ticket-machine-icon" id="animPrinter"></i>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 10px;">Printing spot ticket...</div>
        </div>
      `;

      const animBalanceEl = document.getElementById("animBalance");
      
      // Start Countdown Animation
      const animationDuration = 1500; // 1.5 seconds
      animateValue(animBalanceEl, currentBalance, targetBalance, animationDuration);

      // Create a promise for minimum animation duration
      const animPromise = new Promise(resolve => setTimeout(resolve, animationDuration));

      // 2. Perform the API call in parallel
      const apiPromise = fetch(`${API}/conductor/deduct-pass`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ email, busId, boardingPoint, droppingPoint })
      }).then(async res => {
        const ok = res.ok;
        const data = await res.json();
        return { ok, data };
      }).catch(err => {
        return { ok: false, data: { message: "Network error occurred." } };
      });

      // 3. Wait for both animation and API request to finish
      try {
        const [_, apiResult] = await Promise.all([animPromise, apiPromise]);
        const { ok, data } = apiResult;

        if (ok) {
          // Success
          const photoUrl = data.passenger.userPhoto 
            ? `${window.getImageUrl(data.passenger.userPhoto)}` 
            : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

          resArea.innerHTML = `
            <div style="animation: fadeUp 0.4s ease; text-align: center; width: 100%;">
              <i class="fas fa-check-circle" style="font-size: 3.5rem; color: var(--success); margin-bottom: 15px;"></i>
              <div style="font-weight:800; color: var(--success); font-size: 1.15rem; margin-bottom: 12px; letter-spacing: 0.5px;">DEDUCTION SUCCESSFUL</div>
              <img src="${photoUrl}" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid var(--success); margin-bottom: 12px;">
              <div style="font-weight:700; font-size: 1.1rem; color: var(--text-main);">${data.passenger.name}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">${data.passenger.email}</div>
              <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; justify-content: center; margin-bottom: 15px;">
                <div style="font-size: 0.85rem; font-weight: 700; padding: 6px 16px; background-color: var(--primary-light); color: var(--primary); border-radius: 20px;">
                  Deducted: ₹${data.booking.totalPrice}
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">Wallet Balance: ₹${data.passenger.balance}</div>
              </div>
              <button class="btn-action" onclick="resetBillingArea()" style="background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.85rem; height: 38px; width: auto; padding: 0 20px;">
                Issue Another Ticket
              </button>
            </div>
          `;
          document.getElementById("manualEmail").value = "";
          
          // Trigger working notification
          addNotification("Ticket Issued", `Deducted ₹${data.booking.totalPrice} from ${data.passenger.name}.`, "success");
          
          // Refresh stats
          refreshDashboardData();

          // Auto reset for next passenger
          setTimeout(() => {
            const currentHtml = document.getElementById("billingResultArea").innerHTML;
            if (currentHtml.includes("DEDUCTION SUCCESSFUL")) {
              resetBillingArea();
            }
          }, 4000);
        } else {
          // Failure
          if (data.insufficientBalance) {
            const photoUrl = data.passenger.userPhoto 
              ? `${window.getImageUrl(data.passenger.userPhoto)}` 
              : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

            resArea.innerHTML = `
              <div style="animation: fadeUp 0.4s ease; text-align: center; width: 100%;">
                <i class="fas fa-times-circle" style="font-size: 3.5rem; color: var(--danger); margin-bottom: 12px;"></i>
                <div style="font-weight:800; color: var(--danger); font-size: 1.05rem; margin-bottom: 12px;">DECLINED: INSUFFICIENT BALANCE</div>
                <img src="${photoUrl}" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid var(--danger); margin-bottom: 10px;">
                <div style="font-weight:700; font-size: 1.1rem; color: var(--text-main);">${data.passenger.name}</div>
                <div style="font-size: 0.85rem; color: var(--danger); font-weight: bold; margin-top: 5px;">Fare: ₹${data.requiredAmount} (Has: ₹${data.currentBalance})</div>
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 10px; margin-bottom: 15px;">Failed log written to dashboard logs.</div>
                <button class="btn-action" onclick="resetBillingArea()" style="background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.85rem; height: 38px; width: auto; padding: 0 20px;">
                  Try Again
                </button>
              </div>
            `;
            
            // Trigger working notification
            addNotification("Declined: Insufficient Balance", `Fare ₹${data.requiredAmount} failed for ${data.passenger.name} (Has ₹${data.currentBalance}).`, "danger");
            
            setTimeout(() => {
              if (document.getElementById("billingResultArea").innerHTML.includes("DECLINED")) resetBillingArea();
            }, 5000);
          } else {
            resArea.innerHTML = `
              <div style="animation: fadeUp 0.4s ease; text-align: center; width: 100%;">
                <i class="fas fa-exclamation-circle" style="font-size: 3.5rem; color: var(--danger); margin-bottom: 15px;"></i>
                <div style="font-weight:700; color: var(--danger);">Deduction Failed</div>
                <div style="font-size: 0.82rem; margin-top: 5px; text-align: center; margin-bottom: 15px;">${data.message || "Error issuing spot ticket."}</div>
                <button class="btn-action" onclick="resetBillingArea()" style="background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.85rem; height: 38px; width: auto; padding: 0 20px;">
                  Try Again
                </button>
              </div>
            `;
            
            // Trigger working notification
            addNotification("Deduction Failed", data.message || "Error issuing spot ticket.", "danger");
            
            setTimeout(() => {
              if (document.getElementById("billingResultArea").innerHTML.includes("Deduction Failed")) resetBillingArea();
            }, 5000);
          }
          refreshDashboardData();
        }
      } catch (err) {
        console.error(err);
        resArea.innerHTML = `
          <div style="animation: fadeUp 0.4s ease; text-align: center; width: 100%;">
            <i class="fas fa-exclamation-triangle" style="font-size: 3.5rem; color: var(--danger); margin-bottom: 15px;"></i>
            <div style="font-weight:700; color: var(--danger);">Network / Connection Error</div>
            <div style="font-size: 0.82rem; margin-top: 5px; text-align: center; margin-bottom: 15px; color: var(--text-muted);">Please check the backend server and try again.</div>
            <button class="btn-action" onclick="resetBillingArea()" style="background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.85rem; height: 38px; width: auto; padding: 0 20px;">
              Try Again
            </button>
          </div>
        `;
        
        // Trigger working notification
        addNotification("Connection Error", "Network or server connection issue.", "danger");
      }
    }

    function resetBillingArea() {
      currentPassenger = null;
      const resArea = document.getElementById("billingResultArea");
      resArea.innerHTML = `
        <i class="fas fa-id-card" style="font-size: 3.5rem; color: var(--text-muted); opacity: 0.3; margin-bottom: 15px;"></i>
        <div style="color: var(--text-muted); font-weight: 600; font-size: 0.95rem; text-align: center;">Waiting for Passenger scan</div>
        <div style="color: var(--text-muted); font-size: 0.78rem; margin-top: 5px; text-align: center;">Set route, then upload/enter passenger details.</div>
      `;
    }

    // Refresh dashboard stats & load Chart.js
    async function refreshDashboardData() {
      try {
        const res = await fetch(`${API}/conductor/history`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          conductorHistory = await res.json();
          calculateDashboardMetrics();
          initCharts();
        }
      } catch (err) {
        console.error("Failed to load history metrics:", err);
      }
    }

    // Calculate analytics metrics
    function calculateDashboardMetrics() {
      const totalRides = conductorHistory.length;
      
      let totalRevenue = 0;
      let failedRidesCount = 0;
      let todayCount = 0;
      
      const now = new Date();
      const todayString = now.toDateString();

      conductorHistory.forEach(b => {
        const isFailed = b.status === "failed";
        const logDate = new Date(b.scannedAt || b.createdAt);
        
        if (!isFailed) {
          totalRevenue += (b.totalPrice || 0);
          if (logDate.toDateString() === todayString) {
            todayCount++;
          }
        } else {
          failedRidesCount++;
        }
      });

      const successRides = totalRides - failedRidesCount;
      const ratio = totalRides > 0 ? Math.round((successRides / totalRides) * 100) : 100;

      // Update indicators
      document.getElementById("statRides").textContent = totalRides.toLocaleString();
      document.getElementById("statRevenue").textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;
      document.getElementById("statFailed").textContent = failedRidesCount.toLocaleString();
      document.getElementById("statRatio").textContent = `${ratio}%`;

      // Target circular progress indicators
      const targetQuota = 100; // Monthly ticket target
      const completedPercent = Math.min(100, Math.round((successRides / targetQuota) * 100));
      document.getElementById("targetPercent").textContent = `${completedPercent}%`;
      document.getElementById("targetQuota").textContent = targetQuota;
      document.getElementById("targetRevenue").textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;
      document.getElementById("targetToday").textContent = todayCount;
    }

    // Initializing charts using historical seeded logs
    function initCharts() {
      const isDark = document.body.classList.contains("dark-mode");
      const textColor = isDark ? "#94a3b8" : "#64748b";
      const gridColor = isDark ? "#24304f" : "#f1f5f9";

      // Grouping data by Month (for Monthly Sales Bar Chart)
      // We will show last 6 months (ending with current month)
      const monthsLabel = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
      // Mock data for previous months, actual successful billing sum for current month (June)
      const monthlySalesData = [65, 80, 50, 110, 140, 0];
      
      // Calculate current month's actual sales
      const currentMonthIndex = new Date().getMonth(); // June is 5
      let activeMonthCount = 0;
      conductorHistory.forEach(b => {
        const date = new Date(b.scannedAt || b.createdAt);
        if (date.getMonth() === currentMonthIndex && b.status !== "failed") {
          activeMonthCount++;
        }
      });
      // Scale actual count so it fits visually into the mock graph
      monthlySalesData[5] = activeMonthCount;

      // Reset monthly sales chart
      if (barSalesChart) barSalesChart.destroy();
      const ctxBar = document.getElementById("barSalesChart").getContext("2d");
      barSalesChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: monthsLabel,
          datasets: [{
            label: 'Pass Tickets Issued',
            data: monthlySalesData,
            backgroundColor: '#3c50e0',
            borderRadius: 6,
            barThickness: 18,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor } },
            y: { grid: { color: gridColor }, ticks: { color: textColor } }
          }
        }
      });

      // Target doughnut circular progress gauge
      const targetQuota = 100;
      const successRides = conductorHistory.filter(b => b.status !== "failed").length;
      const completedPercent = Math.min(100, Math.round((successRides / targetQuota) * 100));

      if (targetGaugeChart) targetGaugeChart.destroy();
      const ctxGauge = document.getElementById("targetGaugeChart").getContext("2d");
      targetGaugeChart = new Chart(ctxGauge, {
        type: 'doughnut',
        data: {
          labels: ['Completed', 'Remaining'],
          datasets: [{
            data: [completedPercent, 100 - completedPercent],
            backgroundColor: ['#3c50e0', isDark ? '#2c3a58' : '#e2e8f0'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '80%',
          circumference: 180,
          rotation: 270,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          }
        }
      });

      // Grouping success vs failures for the last 7 days (Area Trip Chart)
      const daysOfWeek = [];
      const successCounts = [];
      const failedCounts = [];
      
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const dayDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        daysOfWeek.push(dayDate.toLocaleDateString('en-US', { weekday: 'short' }));
        
        const dayString = dayDate.toDateString();
        let success = 0;
        let failed = 0;
        
        conductorHistory.forEach(b => {
          const logDate = new Date(b.scannedAt || b.createdAt);
          if (logDate.toDateString() === dayString) {
            if (b.status === "failed") failed++;
            else success++;
          }
        });
        
        successCounts.push(success);
        failedCounts.push(failed);
      }

      // Reset Trip Statistics Area Chart
      if (areaTripChart) areaTripChart.destroy();
      const ctxArea = document.getElementById("areaTripChart").getContext("2d");
      areaTripChart = new Chart(ctxArea, {
        type: 'line',
        data: {
          labels: daysOfWeek,
          datasets: [
            {
              label: 'Successful Rides',
              data: successCounts,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              fill: true,
              tension: 0.35,
              borderWidth: 3
            },
            {
              label: 'Declined Passes',
              data: failedCounts,
              borderColor: '#f43f5e',
              backgroundColor: 'rgba(244, 63, 94, 0.08)',
              fill: true,
              tension: 0.35,
              borderWidth: 3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: isDark ? '#fff' : '#1c2434', font: { weight: '600' } }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor } },
            y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 } }
          }
        }
      });
    }

    // Load History Table log
    async function loadHistoryTable() {
      const tbody = document.getElementById("historyTableBody");
      try {
        const res = await fetch(`${API}/conductor/history`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok) {
          allHistoryLogs = data;
          document.getElementById("historyDateFilter").value = "";
          document.getElementById("historyStatusFilter").value = "all";
          renderHistoryTable(allHistoryLogs);
        } else {
          tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger); text-align:center; padding:30px;">${data.message || "Failed to load"}</td></tr>`;
        }
      } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger); text-align:center; padding:30px;">Network error loading logs.</td></tr>`;
      }
    }

    function renderHistoryTable(dataList) {
      const tbody = document.getElementById("historyTableBody");
      
      // Calculate summary metrics for the currently rendered list (filtered or unfiltered)
      let successfulRides = 0;
      let totalRevenue = 0;
      
      dataList.forEach(b => {
        if (b.status !== "failed" && b.status !== "refunded") {
          successfulRides++;
          totalRevenue += (b.totalPrice || 0);
        }
      });
      
      document.getElementById("histSummaryRides").textContent = successfulRides;
      document.getElementById("histSummaryRevenue").textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;

      if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px;">No trips logged for the selection.</td></tr>`;
        return;
      }

      tbody.innerHTML = dataList.map(b => {
        const isFailed = b.status === "failed";
        const isRefunded = b.status === "refunded";
        
        const rawDate = b.scannedAt || b.createdAt;
        const dateObj = new Date(rawDate);
        const date = dateObj.toLocaleDateString("en-IN", { day: '2-digit', month: 'short' });
        const time = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const photoUrl = b.userId?.userPhoto 
          ? `${window.getImageUrl(b.userId.userPhoto)}` 
          : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

        const amount = b.totalPrice || 0;
        const from = b.boardingPoint || "Unknown";
        const to = b.droppingPoint || "Unknown";
        
        let badgeClass = "table-badge paid";
        let badgeText = "Paid";
        let amountStyle = "color: var(--primary); font-weight: 800;";
        if (isFailed) {
          badgeClass = "table-badge failed";
          badgeText = "Declined";
          amountStyle = "color: var(--danger); font-weight: 700;";
        } else if (isRefunded) {
          badgeClass = "table-badge refunded";
          badgeText = "Refunded";
          amountStyle = "color: var(--text-muted); font-weight: 700; text-decoration: line-through;";
        }

        return `
          <tr>
            <td style="cursor: pointer;" onclick="openPassengerDetails('${b.userId?._id}')">
              <div class="table-passenger">
                <img src="${photoUrl}" alt="Avatar" style="border: 2px solid ${isFailed ? 'var(--danger)' : isRefunded ? 'var(--border-color)' : 'var(--success)'};">
                <div>
                  <div class="name" style="font-weight: 600; color: var(--primary);">${b.userId?.name || "Passenger"}</div>
                  <div class="email">${b.userId?.email || ""}</div>
                </div>
              </div>
            </td>
            <td>
              <div style="font-weight: 500;">${from} &rarr; ${to}</div>
            </td>
            <td>
              <div>${date}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${time}</div>
            </td>
            <td>
              <span style="font-family: monospace; font-size: 0.8rem; background-color: var(--bg-body); padding: 3px 8px; border-radius: 4px;">
                #${b._id.slice(-8).toUpperCase()}
              </span>
            </td>
            <td>
              <span style="${amountStyle}">₹${amount}</span>
            </td>
            <td>
              <span class="${badgeClass}">${badgeText}</span>
            </td>
            <td>
              ${(!isFailed && !isRefunded) ? `
                <button onclick="refundPassengerBooking('${b._id}', event)" style="background: linear-gradient(135deg, var(--danger), #ff6b8b); color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; cursor: pointer; font-weight: 700; transition: opacity 0.2s; box-shadow: 0 2px 6px rgba(244,63,94,0.2);"><i class="fas fa-undo"></i> Refund</button>
              ` : `
                <span style="color: var(--text-muted); font-size: 0.75rem; font-weight: 600;">-</span>
              `}
            </td>
          </tr>
        `;
      }).join("");
    }

    function applyHistoryFilters() {
      const dateVal = document.getElementById("historyDateFilter").value;
      const statusVal = document.getElementById("historyStatusFilter").value;
      const searchVal = document.getElementById("historySearchInput").value.trim().toLowerCase();
      
      const filtered = allHistoryLogs.filter(b => {
        // Search query match
        if (searchVal) {
          const uname = (b.userId?.name || "").toLowerCase();
          const uemail = (b.userId?.email || "").toLowerCase();
          const busName = (b.busId?.busName || "").toLowerCase();
          const routeFrom = (b.busId?.from || "").toLowerCase();
          const routeTo = (b.busId?.to || "").toLowerCase();
          const ticketId = b._id ? b._id.toLowerCase() : "";
          const ticketIdShort = b._id ? b._id.slice(-8).toLowerCase() : "";
          
          const matchSearch = uname.includes(searchVal) ||
                              uemail.includes(searchVal) ||
                              busName.includes(searchVal) ||
                              routeFrom.includes(searchVal) ||
                              routeTo.includes(searchVal) ||
                              ticketId.includes(searchVal) ||
                              ticketIdShort.includes(searchVal);
                              
          if (!matchSearch) return false;
        }

        // Date match
        if (dateVal) {
          const rawDate = b.scannedAt || b.createdAt;
          if (!rawDate) return false;
          const dateObj = new Date(rawDate);
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          const localDateStr = `${year}-${month}-${day}`;
          if (localDateStr !== dateVal) return false;
        }
        
        // Status match
        if (statusVal !== "all") {
          if (statusVal === "paid" && (b.status === "failed" || b.status === "refunded")) return false;
          if (statusVal === "failed" && b.status !== "failed") return false;
          if (statusVal === "refunded" && b.status !== "refunded") return false;
        }
        
        return true;
      });
      
      renderHistoryTable(filtered);
    }

    function clearHistoryFilters() {
      document.getElementById("historyDateFilter").value = "";
      document.getElementById("historyStatusFilter").value = "all";
      document.getElementById("historySearchInput").value = "";
      renderHistoryTable(allHistoryLogs);
    }

    async function refundPassengerBooking(bookingId, event) {
      if (event) event.stopPropagation(); // Stop click propagation to passenger details modal
      
      if (!confirm("Are you sure you want to refund this ticket? The ticket fare will be refunded back to the passenger's wallet balance.")) {
        return;
      }
      
      try {
        const res = await fetch(`${API}/conductor/refund-booking`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ bookingId })
        });
        
        const data = await res.json();
        if (res.ok) {
          addNotification("Ticket Refunded", `Refunded ₹${data.refundAmount} to passenger wallet.`, "success");
          alert("Ticket refunded successfully!");
          
          // Re-load data to update logs and stats
          loadHistoryTable();
          refreshDashboardData();
        } else {
          alert(data.message || "Failed to process refund.");
          addNotification("Refund Failed", data.message || "Error processing refund.", "danger");
        }
      } catch (err) {
        console.error(err);
        alert("Network error processing refund.");
        addNotification("Refund Error", "Connection or server error during refund.", "danger");
      }
    }

    // Passenger details modal logic
    function openPassengerDetails(passengerId) {
      if (!passengerId) return;
      
      const booking = allHistoryLogs.find(b => b.userId && b.userId._id === passengerId);
      if (!booking) return;
      
      const user = booking.userId;
      
      let paidCount = 0;
      let failedCount = 0;
      allHistoryLogs.forEach(b => {
        if (b.userId && b.userId._id === passengerId) {
          if (b.status === "failed") {
            failedCount++;
          } else {
            paidCount++;
          }
        }
      });
      
      const photoUrl = user.userPhoto 
        ? `${window.getImageUrl(user.userPhoto)}` 
        : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
        
      document.getElementById("modalPassengerPhoto").src = photoUrl;
      document.getElementById("modalPassengerName").textContent = user.name || "Passenger";
      document.getElementById("modalPassengerAgeGroup").textContent = user.ageGroup || "General";
      document.getElementById("modalPassengerEmail").textContent = user.email || "N/A";
      document.getElementById("modalPassengerPhone").textContent = user.phone || "N/A";
      document.getElementById("modalPassengerAge").textContent = user.age ? `${user.age} years` : "N/A";
      document.getElementById("modalPassengerBalance").textContent = `₹${user.balance || 0}`;
      
      document.getElementById("modalPassengerPaidTrips").textContent = paidCount;
      document.getElementById("modalPassengerFailedTrips").textContent = failedCount;
      
      document.getElementById("passengerModal").style.display = "flex";
    }
    
    function closePassengerModal() {
      document.getElementById("passengerModal").style.display = "none";
    }

    // Conductor profile setup logic
    let selectedProfileFile = null;

    function previewProfilePhoto(event) {
      if (event.target.files.length === 0) return;
      selectedProfileFile = event.target.files[0];
      const reader = new FileReader();
      reader.onload = function(e) {
        document.getElementById("profilePreviewImg").src = e.target.result;
      }
      reader.readAsDataURL(selectedProfileFile);
    }

    async function saveConductorProfile() {
      const btn = document.getElementById("saveProfileBtn");
      const alertArea = document.getElementById("profileAlertArea");
      
      const name = document.getElementById("profileName").value.trim();
      const age = document.getElementById("profileAge").value.trim();
      const experience = document.getElementById("profileExperience").value.trim();
      const phone = document.getElementById("profilePhone").value.trim();
      
      if (!name) {
        showAlert("Full Name is required.", "danger");
        return;
      }
      
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
      
      const formData = new FormData();
      formData.append("name", name);
      formData.append("age", age);
      formData.append("experience", experience);
      formData.append("phone", phone);
      if (selectedProfileFile) {
        formData.append("userPhoto", selectedProfileFile);
      }
      
      try {
        const res = await fetch(`${API}/auth/me`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`
          },
          body: formData
        });
        
        const data = await res.json();
        if (res.ok) {
          showAlert("Profile updated successfully!", "success");
          
          // Update header details immediately
          document.getElementById("cName").textContent = data.user.name || "Conductor";
          if (data.user.userPhoto) {
            document.getElementById("cPhoto").src = `${window.getImageUrl(data.user.userPhoto)}`;
          }
          selectedProfileFile = null;
        } else {
          showAlert(data.message || "Failed to update profile.", "danger");
        }
      } catch (err) {
        console.error(err);
        showAlert("Network error updating profile.", "danger");
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-save"></i> Save Profile Details`;
      }
    }

    function showAlert(msg, type) {
      const alertArea = document.getElementById("profileAlertArea");
      alertArea.style.display = "block";
      alertArea.textContent = msg;
      if (type === "success") {
        alertArea.style.backgroundColor = "var(--success-light)";
        alertArea.style.color = "var(--success)";
        alertArea.style.border = "1px solid var(--success)";
      } else {
        alertArea.style.backgroundColor = "var(--danger-light)";
        alertArea.style.color = "var(--danger)";
        alertArea.style.border = "1px solid var(--danger)";
      }
      setTimeout(() => {
        alertArea.style.display = "none";
      }, 5000);
    }

    // --- NOTIFICATION UTILITIES ---
    let notificationsList = [];

    function addNotification(title, message, type = 'info') {
      const id = Date.now();
      notificationsList.unshift({ id, title, message, type, read: false, time: new Date() });
      updateNotiUI();
    }

    function updateNotiUI() {
      const listEl = document.getElementById("notiList");
      const dotEl = document.getElementById("notiDot");
      if (!listEl || !dotEl) return;
      
      const unreadCount = notificationsList.filter(n => !n.read).length;
      if (unreadCount > 0) {
        dotEl.style.display = "block";
      } else {
        dotEl.style.display = "none";
      }
      
      if (notificationsList.length === 0) {
        listEl.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 20px 0;">No new notifications.</div>`;
        return;
      }
      
      listEl.innerHTML = notificationsList.map(n => {
        const timeStr = new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let iconClass = 'fa-info-circle';
        let iconColor = 'var(--primary)';
        if (n.type === 'success') {
          iconClass = 'fa-check-circle';
          iconColor = 'var(--success)';
        } else if (n.type === 'danger') {
          iconClass = 'fa-times-circle';
          iconColor = 'var(--danger)';
        }
        
        const bg = n.read ? 'transparent' : 'var(--primary-light)';
        
        return `
          <div onclick="markNotiRead(${n.id}, event)" style="background: ${bg}; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); display: flex; gap: 10px; cursor: pointer; align-items: flex-start; transition: background-color 0.2s;">
            <i class="fas ${iconClass}" style="color: ${iconColor}; font-size: 1.1rem; margin-top: 2px; flex-shrink:0;"></i>
            <div style="flex: 1; min-width: 0; text-align: left;">
              <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 2px;">${n.title}</div>
              <div style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.3; word-break: break-word;">${n.message}</div>
              <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 4px; font-weight: 500;">${timeStr}</div>
            </div>
          </div>
        `;
      }).join("");
    }

    function toggleNotiDropdown(event) {
      event.stopPropagation();
      const dropdown = document.getElementById("notiDropdown");
      if (!dropdown) return;
      const isVisible = dropdown.style.display === "block";
      dropdown.style.display = isVisible ? "none" : "block";
      
      if (!isVisible) {
        // Mark all as read when opening dropdown
        notificationsList.forEach(n => n.read = true);
        updateNotiUI();
      }
    }

    function clearAllNotifications(event) {
      if (event) event.stopPropagation();
      notificationsList = [];
      updateNotiUI();
    }

    function markNotiRead(id, event) {
      event.stopPropagation();
      const noti = notificationsList.find(n => n.id === id);
      if (noti) {
        noti.read = true;
        updateNotiUI();
      }
    }

    // --- CONFIRM BOOKING (SCAN TICKET) UTILITIES ---
    async function handleTicketFileUpload(event) {
      if (event.target.files.length === 0) return;
      const file = event.target.files[0];
      const html5QrCode = new Html5Qrcode("hiddenReader");
      
      const resArea = document.getElementById("scanResultArea");
      resArea.innerHTML = `
        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
        <div style="font-weight:700;">Reading Ticket QR...</div>
      `;

      try {
        const decodedText = await html5QrCode.scanFile(file, false);
        processTicketScan(decodedText.trim());
      } catch (err) {
        console.error(err);
        resArea.innerHTML = `
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger); margin-bottom: 15px;"></i>
          <div style="font-weight:700; color: var(--danger);">QR Code Not Found</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 5px; text-align: center;">Could not read ticket QR. Ensure the image is clear.</div>
        `;
        addNotification("Ticket Scanner", "Failed to decode ticket QR code.", "danger");
      }
      event.target.value = "";
    }

    function verifyTicketIdManual() {
      const ticketId = document.getElementById("manualTicketId").value.trim();
      if (!ticketId) {
        alert("Please enter a Ticket ID.");
        return;
      }
      processTicketScan(ticketId);
    }

    async function processTicketScan(ticketId) {
      const resArea = document.getElementById("scanResultArea");
      resArea.innerHTML = `
        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary); margin-bottom: 15px;"></i>
        <div style="font-weight:700;">Validating Ticket #${ticketId}...</div>
      `;

      try {
        const res = await fetch(`${API}/conductor/scan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ ticketId })
        });

        const data = await res.json();

        if (res.ok) {
          // Ticket successfully validated and boarded
          const passenger = data.passenger || {};
          const booking = data.booking || {};
          const bus = booking.busId || {};
          
          const photoUrl = passenger.userPhoto 
            ? `${window.getImageUrl(passenger.userPhoto)}` 
            : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

          resArea.innerHTML = `
            <div style="animation: fadeUp 0.4s ease; text-align: center; width: 100%;">
              <i class="fas fa-check-circle" style="font-size: 3.5rem; color: var(--success); margin-bottom: 15px;"></i>
              <div style="font-weight:800; color: var(--success); font-size: 1.15rem; margin-bottom: 12px; letter-spacing: 0.5px;">TICKET VALIDATED</div>
              <img src="${photoUrl}" style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid var(--success); margin-bottom: 12px;">
              <div style="font-weight:700; font-size: 1.1rem; color: var(--text-main);">${passenger.name || 'Passenger'}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 15px;">${passenger.email || ''}</div>
              
              <div style="background: var(--bg-body); border-radius: var(--radius); padding: 16px; margin-bottom: 20px; text-align: left; font-size: 0.85rem; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: var(--text-muted);">Route:</span>
                  <span style="font-weight: 600; color: var(--text-main);">${bus.busName || 'Bus Route'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: var(--text-muted);">Stops:</span>
                  <span style="font-weight: 600; color: var(--text-main);">${booking.boardingPoint || 'N/A'} &rarr; ${booking.droppingPoint || 'N/A'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: var(--text-muted);">Ticket ID:</span>
                  <span style="font-weight: 700; font-family: monospace; color: var(--primary);">#${ticketId.toUpperCase()}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Boarding Status:</span>
                  <span style="font-weight: 700; color: var(--success); text-transform: uppercase;">Scanned / Boarded</span>
                </div>
              </div>

              <button class="btn-action" onclick="resetScanTicketArea()" style="background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.85rem; height: 38px; width: auto; padding: 0 20px;">
                Scan Another Ticket
              </button>
            </div>
          `;
          
          document.getElementById("manualTicketId").value = "";
          addNotification("Ticket Confirmed", `Passenger ${passenger.name || ''} boarded successfully. Ticket #${ticketId}.`, "success");
          refreshDashboardData(); // Refresh history counts
        } else {
          // Validation failed
          if (res.status === 400 && data.message.toLowerCase().includes("already scanned")) {
            resArea.innerHTML = `
              <div style="animation: fadeUp 0.4s ease; text-align: center; width: 100%;">
                <i class="fas fa-exclamation-circle" style="font-size: 3.5rem; color: var(--warning); margin-bottom: 15px;"></i>
                <div style="font-weight:800; color: var(--warning); font-size: 1.1rem; margin-bottom: 12px; letter-spacing: 0.5px;">ALREADY SCANNED</div>
                <div style="font-size: 0.88rem; color: var(--text-main); font-weight: 600; margin-bottom: 8px;">Ticket #${ticketId.toUpperCase()} has already been used.</div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 20px; line-height: 1.4;">This boarding pass was already scanned and marked as boarded by this or another conductor. Do not permit boarding.</div>
                
                <button class="btn-action" onclick="resetScanTicketArea()" style="background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.85rem; height: 38px; width: auto; padding: 0 20px;">
                  Try Another Ticket
                </button>
              </div>
            `;
            addNotification("Double Boarding Alert", `Ticket #${ticketId} was already scanned previously.`, "danger");
          } else {
            resArea.innerHTML = `
              <div style="animation: fadeUp 0.4s ease; text-align: center; width: 100%;">
                <i class="fas fa-times-circle" style="font-size: 3.5rem; color: var(--danger); margin-bottom: 15px;"></i>
                <div style="font-weight:800; color: var(--danger); font-size: 1.1rem; margin-bottom: 12px; letter-spacing: 0.5px;">INVALID TICKET</div>
                <div style="font-size: 0.88rem; color: var(--text-main); font-weight: 600; margin-bottom: 8px;">${data.message || 'Validation failed.'}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 20px;">Could not find a booking matching this ticket identifier.</div>
                
                <button class="btn-action" onclick="resetScanTicketArea()" style="background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.85rem; height: 38px; width: auto; padding: 0 20px;">
                  Try Another Ticket
                </button>
              </div>
            `;
            addNotification("Invalid Ticket Scan", `Ticket #${ticketId} failed validation.`, "danger");
          }
        }
      } catch (err) {
        console.error(err);
        resArea.innerHTML = `
          <div style="animation: fadeUp 0.4s ease; text-align: center; width: 100%;">
            <i class="fas fa-exclamation-triangle" style="font-size: 3.5rem; color: var(--danger); margin-bottom: 15px;"></i>
            <div style="font-weight:700; color: var(--danger);">Network / Connection Error</div>
            <div style="font-size: 0.82rem; margin-top: 5px; text-align: center; margin-bottom: 15px; color: var(--text-muted);">Check your backend server connection.</div>
            <button class="btn-action" onclick="resetScanTicketArea()" style="background: var(--bg-body); color: var(--text-main); border: 1px solid var(--border-color); font-size: 0.85rem; height: 38px; width: auto; padding: 0 20px;">
              Try Again
            </button>
          </div>
        `;
      }
    }

    function resetScanTicketArea() {
      document.getElementById("manualTicketId").value = "";
      const resArea = document.getElementById("scanResultArea");
      if (resArea) {
        resArea.innerHTML = `
          <i class="fas fa-receipt" style="font-size: 3.5rem; color: var(--text-muted); opacity: 0.3; margin-bottom: 15px;"></i>
          <div style="color: var(--text-muted); font-weight: 600; font-size: 0.95rem; text-align: center;">Waiting for Ticket scan</div>
          <div style="color: var(--text-muted); font-size: 0.78rem; margin-top: 5px; text-align: center;">Upload the ticket QR image or type the ID manually.</div>
        `;
      }
    }

    // Close notifications dropdown when clicking outside
    document.addEventListener("click", () => {
      const drop = document.getElementById("notiDropdown");
      if (drop) drop.style.display = "none";
    });
  