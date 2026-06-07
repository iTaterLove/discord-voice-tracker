const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'voice_tracker.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Create voice sessions table
    db.run(`
      CREATE TABLE IF NOT EXISTS voice_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        user_name TEXT,
        guild_id TEXT NOT NULL,
        join_time INTEGER NOT NULL,
        leave_time INTEGER,
        duration INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create an index for faster queries
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_user_guild 
      ON voice_sessions(user_id, guild_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_leave_time 
      ON voice_sessions(leave_time)
    `);
  });
}

// Add a new voice session
function addVoiceSession(userId, userName, guildId) {
  return new Promise((resolve, reject) => {
    const joinTime = Math.floor(Date.now() / 1000);
    db.run(
      `INSERT INTO voice_sessions (user_id, user_name, guild_id, join_time) 
       VALUES (?, ?, ?, ?)`,
      [userId, userName, guildId, joinTime],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// Update session with leave time and calculate duration
function completeVoiceSession(userId, guildId) {
  return new Promise((resolve, reject) => {
    const leaveTime = Math.floor(Date.now() / 1000);
    
    // First, get the most recent incomplete session
    db.get(
      `SELECT id FROM voice_sessions 
       WHERE user_id = ? AND guild_id = ? AND leave_time IS NULL
       ORDER BY join_time DESC LIMIT 1`,
      [userId, guildId],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!row) {
          resolve(0); // No session to complete
          return;
        }
        
        // Now update that specific session
        db.run(
          `UPDATE voice_sessions 
           SET leave_time = ?, duration = (? - join_time)
           WHERE id = ?`,
          [leaveTime, leaveTime, row.id],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      }
    );
  });
}

// Get total voice time for a user
function getTotalVoiceTime(userId, guildId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COALESCE(SUM(duration), 0) as total_seconds 
       FROM voice_sessions 
       WHERE user_id = ? AND guild_id = ? AND duration IS NOT NULL`,
      [userId, guildId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row.total_seconds);
      }
    );
  });
}

// Get average daily voice time for a user
function getAverageDailyVoiceTime(userId, guildId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT 
        COUNT(DISTINCT DATE(datetime(join_time, 'unixepoch'))) as days_active,
        COALESCE(SUM(duration), 0) as total_seconds
       FROM voice_sessions 
       WHERE user_id = ? AND guild_id = ? AND duration IS NOT NULL`,
      [userId, guildId],
      (err, row) => {
        if (err) reject(err);
        else {
          const average = row.days_active > 0 ? Math.floor(row.total_seconds / row.days_active) : 0;
          resolve({
            average_seconds: average,
            days_active: row.days_active,
            total_seconds: row.total_seconds
          });
        }
      }
    );
  });
}

// Get most active days for a user
function getMostActiveDays(userId, guildId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        strftime('%w', datetime(join_time, 'unixepoch')) as day_num,
        CASE strftime('%w', datetime(join_time, 'unixepoch'))
          WHEN '0' THEN 'Sunday'
          WHEN '1' THEN 'Monday'
          WHEN '2' THEN 'Tuesday'
          WHEN '3' THEN 'Wednesday'
          WHEN '4' THEN 'Thursday'
          WHEN '5' THEN 'Friday'
          WHEN '6' THEN 'Saturday'
        END as day_name,
        COUNT(*) as session_count,
        COALESCE(SUM(duration), 0) as total_seconds
       FROM voice_sessions 
       WHERE user_id = ? AND guild_id = ? AND duration IS NOT NULL
       GROUP BY day_num
       ORDER BY total_seconds DESC`,
      [userId, guildId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

// Get session history for a user
function getSessionHistory(userId, guildId, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT 
        user_name,
        datetime(join_time, 'unixepoch') as join_time,
        datetime(leave_time, 'unixepoch') as leave_time,
        duration
       FROM voice_sessions 
       WHERE user_id = ? AND guild_id = ? AND duration IS NOT NULL
       ORDER BY join_time DESC
       LIMIT ?`,
      [userId, guildId, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

// Get active session (session without leave_time)
function getActiveSession(userId, guildId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM voice_sessions 
       WHERE user_id = ? AND guild_id = ? AND leave_time IS NULL
       ORDER BY join_time DESC LIMIT 1`,
      [userId, guildId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

module.exports = {
  db,
  addVoiceSession,
  completeVoiceSession,
  getTotalVoiceTime,
  getAverageDailyVoiceTime,
  getMostActiveDays,
  getSessionHistory,
  getActiveSession
};
