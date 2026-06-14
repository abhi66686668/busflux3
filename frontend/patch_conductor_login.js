const fs = require('fs');

let html = fs.readFileSync('conductor.html', 'utf8');

const css = `
    /* LOGIN SCREEN STYLES */
    #loginScreen{
      position:fixed;inset:0;background:radial-gradient(circle at 30% 50%,#0f172a,#020617);
      display:none;align-items:center;justify-content:center;z-index:9999;
    }
    .login-box{
      background:rgba(30,41,59,.8);border:1px solid rgba(255,255,255,.08);
      backdrop-filter:blur(20px);border-radius:20px;padding:44px 40px;
      width:100%;max-width:420px;animation:fadeUp .5s ease forwards;
    }
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .login-logo{text-align:center;margin-bottom:28px}
    .login-logo i{font-size:2.4rem;color:#3c50e0;}
    .login-logo h1{font-size:1.7rem;font-weight:800;margin-top:8px;color:#fff;}
    .login-logo h1 span{color:#3c50e0;}
    .login-logo p{color:#94a3b8;font-size:.9rem;margin-top:4px}
    .l-group{margin-bottom:18px}
    .l-group label{display:block;font-size:.8rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
    .l-input{position:relative}
    .l-input i{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;font-size:.95rem}
    .l-input input{width:100%;padding:13px 14px 13px 42px;background:rgba(15,23,42,.7);border:1px solid rgba(255,255,255,.08);color:#fff;border-radius:10px;font-size:.95rem;font-family:inherit;transition:all .3s ease;}
    .l-input input:focus{outline:none;border-color:rgba(60,80,224,.5);box-shadow:0 0 0 3px rgba(60,80,224,.1)}
    .login-btn{width:100%;padding:14px;background:#3c50e0;border:none;border-radius:10px;color:#fff;font-size:1rem;font-weight:700;cursor:pointer;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .3s ease;}
    .login-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(60,80,224,.35)}
`;

const loginHtml = `
  <div id="loginScreen">
    <div class="login-box">
      <div class="login-logo">
        <i class="fas fa-bus-alt"></i>
        <h1><span>BusFlux</span> Conductor</h1>
        <p>Sign in to your conductor dashboard</p>
      </div>
      <div class="l-group">
        <label>Email Address</label>
        <div class="l-input"><i class="fas fa-envelope"></i><input type="email" id="cEmailInput" placeholder="conductor@busflux.com"></div>
      </div>
      <div class="l-group">
        <label>Password</label>
        <div class="l-input"><i class="fas fa-lock"></i><input type="password" id="cPasswordInput" placeholder="••••••••" onkeydown="if(event.key==='Enter')conductorLogin()"></div>
      </div>
      <button class="login-btn" onclick="conductorLogin()">
        <i class="fas fa-ticket-alt"></i> Sign In as Conductor
      </button>
    </div>
  </div>
`;

const loginScript = `
    async function conductorLogin() {
      const email = document.getElementById("cEmailInput").value;
      const password = document.getElementById("cPasswordInput").value;
      if(!email || !password) return alert("Fill in all fields");
      try {
        const res = await fetch(\`\${API}/auth/login\`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if(res.ok) {
          if(data.role !== 'conductor' && data.role !== 'admin') {
            return alert("Access denied. Conductor or Admin role required.");
          }
          localStorage.setItem("token", data.token);
          document.getElementById("loginScreen").style.display = "none";
          location.reload();
        } else {
          alert(data.message || "Login failed");
        }
      } catch(e) {
        alert("Server error. Is the backend running?");
      }
    }
`;

// Inject CSS
html = html.replace('</style>', css + '\n</style>');

// Inject HTML
html = html.replace('<body>', '<body>\n' + loginHtml);

// Inject JS Function
html = html.replace('// Initialize Dashboard', loginScript + '\n    // Initialize Dashboard');

// Replace redirects
html = html.replace(
  'if (!token) {\n      window.location.href = "login.html";\n    }',
  'if (!token) {\n      document.getElementById("loginScreen").style.display = "flex";\n    }'
);

html = html.replace(
  '.catch(err => {\n          console.error("Conductor auth error:", err);\n          localStorage.removeItem("token");\n          window.location.href = "login.html";\n        });',
  '.catch(err => {\n          console.error("Conductor auth error:", err);\n          localStorage.removeItem("token");\n          document.getElementById("loginScreen").style.display = "flex";\n        });'
);

html = html.replace(
  'function logout() {\n      localStorage.removeItem("token");\n      window.location.href = "login.html";\n    }',
  'function logout() {\n      localStorage.removeItem("token");\n      document.getElementById("loginScreen").style.display = "flex";\n    }'
);

fs.writeFileSync('conductor.html', html);
console.log('Conductor login patched!');
