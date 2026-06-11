const dbPool = require('../src/config/database');

async function main() {
  const [rows] = await dbPool.execute('SELECT id, username, statusAktif FROM tbl_users_mobile WHERE statusAktif = 0 ORDER BY id DESC LIMIT 1');
  if (rows.length > 0) {
    console.log('Found inactive user:', JSON.stringify(rows[0]));
  } else {
    console.log('No inactive user found');
  }
  process.exit(0);
}
main().catch(function(e) { console.log('Error:', e.message); process.exit(1); });
