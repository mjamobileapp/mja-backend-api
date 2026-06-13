const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function main() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'db_monitoring',
    waitForConnections: true
  });

  const rand = Math.floor(Math.random() * 90000) + 10000;
  const username = 'testactivate' + rand;
  const hashedPassword = await bcrypt.hash('dummypass', 10);

  // Insert user dengan statusAktif = 0
  await pool.execute(
    "INSERT INTO tbl_users_mobile (username, password, role, idMitra, cabangId, namaLengkap, noTelp, email, createdBy, createdDate, statusAktif) VALUES (?, ?, 'owner', 9, 1, 'Test Activate', ?, ?, 'system', NOW(), 0)",
    [username, hashedPassword, '0811' + rand, username + '@test.com']
  );

  console.log('User created:', username);

  // Generate activation token
  const token = jwt.sign({ username: username, type: 'activation' }, process.env.JWT_SECRET || 'MJA_SECRET_KEY', { expiresIn: '24h' });
  console.log('Token:', token);

  // Test activate account
  const http = require('http');
  const body = JSON.stringify({ token: token, password: 'password123', confirmPassword: 'password123' });

  const req = http.request('http://localhost:7001/api/mobile/activateaccount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, function(res) {
    let data = '';
    res.on('data', function(c) { data += c; });
    res.on('end', function() {
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
      pool.end();
    });
  });
  req.on('error', function(e) { console.log('Error:', e.message); pool.end(); });
  req.write(body);
  req.end();
}

main().catch(function(e) { console.log('Error:', e.message); });
