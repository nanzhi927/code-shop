const pool = require('../db');

function notify(userId, type, title, content) {
  if (!userId) return;
  pool.query(
    'INSERT INTO notifications (user_id, type, title, content) VALUES (?,?,?,?)',
    [userId, type, title, content]
  ).catch(() => {});
}

module.exports = { notify };
