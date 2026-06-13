const http = require('http');
const jwt = require('jsonwebtoken');

function doRequest(url, method, headers, body) {
  return new Promise(function(resolve, reject) {
    const req = http.request(url, {method:method, headers:headers}, function(res) {
      let data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        resolve({status: res.statusCode, data: data});
      });
    });
    req.on('error', function(e) { reject(e); });
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== TEST 1: Aktivasi dengan user inactive ===');
  
  // Login mobile sebagai owner
  const loginRes = await doRequest('http://localhost:7001/api/mobile/login', 'POST', {'Content-Type':'application/json'},
    JSON.stringify({username:'testowner', password:'test12345', deviceId:'device-owner-001', deviceName:'Samsung A14'}));
  
  const login = JSON.parse(loginRes.data);
  const token = login.data.token;
  const authHeaders = {'Authorization':'Bearer ' + token, 'Content-Type':'application/json'};
  console.log('Login OK, idMitra:', login.data.idMitra);

  // Cari user inactive dari list kasir
  const kasirRes = await doRequest('http://localhost:7001/api/owner/kasir?status=all', 'GET', authHeaders, null);
  const kasirAll = JSON.parse(kasirRes.data);
  const inactive = kasirAll.data.filter(function(u) { return u.statusAktif === 0; });
  
  if (inactive.length > 0) {
    const inactiveUser = inactive[0];
    console.log('Inactive user ditemukan:', inactiveUser.username);
    
    // Generate activation token
    const actToken = jwt.sign({ username: inactiveUser.username, type: 'activation' },
      process.env.JWT_SECRET || 'MJA_SECRET_KEY', { expiresIn: '24h' });
    
    // Test activation
    const actRes = await doRequest('http://localhost:7001/api/mobile/activateaccount', 'POST', {'Content-Type':'application/json'},
      JSON.stringify({ token: actToken, password: 'newpassword123', confirmPassword: 'newpassword123' }));
    
    console.log('Activation Status:', actRes.status);
    console.log('Activation Response:', actRes.data);
  } else {
    console.log('Tidak ada user inactive. Melewati test aktivasi.');
  }

  console.log('\n=== TEST 2: Akun sudah aktif ===');
  const actToken2 = jwt.sign({ username: 'testowner', type: 'activation' },
    process.env.JWT_SECRET || 'MJA_SECRET_KEY', { expiresIn: '24h' });
  const actRes2 = await doRequest('http://localhost:7001/api/mobile/activateaccount', 'POST', {'Content-Type':'application/json'},
    JSON.stringify({ token: actToken2, password: 'newpassword123', confirmPassword: 'newpassword123' }));
  console.log('Status:', actRes2.status);
  console.log('Response:', actRes2.data);

  console.log('\n=== TEST 3: Token tidak valid ===');
  const actRes3 = await doRequest('http://localhost:7001/api/mobile/activateaccount', 'POST', {'Content-Type':'application/json'},
    JSON.stringify({ token: 'tokengasal', password: 'newpassword123', confirmPassword: 'newpassword123' }));
  console.log('Status:', actRes3.status);
  console.log('Response:', actRes3.data);

  console.log('\n=== TEST 4: Password tidak cocok ===');
  const actRes4 = await doRequest('http://localhost:7001/api/mobile/activateaccount', 'POST', {'Content-Type':'application/json'},
    JSON.stringify({ token: actToken2, password: 'password123', confirmPassword: 'password456' }));
  console.log('Status:', actRes4.status);
  console.log('Response:', actRes4.data);

  console.log('\n=== TEST 5: Token dengan type reset_password (bukan activation) ===');
  const resetToken = jwt.sign({ username: 'testowner', type: 'reset_password' },
    process.env.JWT_SECRET || 'MJA_SECRET_KEY', { expiresIn: '24h' });
  const actRes5 = await doRequest('http://localhost:7001/api/mobile/activateaccount', 'POST', {'Content-Type':'application/json'},
    JSON.stringify({ token: resetToken, password: 'newpassword123', confirmPassword: 'newpassword123' }));
  console.log('Status:', actRes5.status);
  console.log('Response:', actRes5.data);

  console.log('\n=== TEST 6: Missing fields ===');
  const actRes6 = await doRequest('http://localhost:7001/api/mobile/activateaccount', 'POST', {'Content-Type':'application/json'},
    JSON.stringify({ token: actToken2 }));
  console.log('Status:', actRes6.status);
  console.log('Response:', actRes6.data);

  console.log('\n=== ALL TESTS DONE ===');
}

main().catch(function(e) { console.log('Error:', e.message); });
