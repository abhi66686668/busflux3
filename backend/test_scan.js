const axios = require('axios');

async function test() {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'conductor@busflux.com',
      password: 'conductor123'
    });
    const token = loginRes.data.token;
    console.log("Token:", token);
    console.log("Role:", loginRes.data.role);

    try {
      const scanRes = await axios.post('http://localhost:5000/api/conductor/scan', {
        ticketId: 'A1B2C3D4'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Scan success:", scanRes.data);
    } catch(err) {
      console.log("Scan error:", err.response ? err.response.data : err.message);
    }
  } catch(err) {
    console.log("Login error:", err.message);
  }
}
test();
