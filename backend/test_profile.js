const axios = require('axios');
const FormData = require('form-data');

async function test() {
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'abhishekpoojary225@gmail.com',
      password: '9900344328' // Based on task-306 logs, this seems to be the user password
    });
    const token = loginRes.data.token;
    
    const form = new FormData();
    form.append('name', 'RAKSHA');
    form.append('phone', '9900344564');
    form.append('age', '25');

    try {
      const res = await axios.put('http://localhost:5000/api/auth/me', form, {
        headers: { 
          Authorization: `Bearer ${token}`,
          ...form.getHeaders()
        }
      });
      console.log("Success:", res.data);
    } catch(err) {
      console.log("Update error:", err.response ? err.response.data : err.message);
    }
  } catch(err) {
    console.log("Login error:", err.response ? err.response.data : err.message);
  }
}
test();
