/**
 * Configuration file for security and permissions
 * This file stores guild-specific settings for permissions and privacy levels
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const configDb = new sqlite3.Database(path.join(__dirname, 'config.db'), (err) => {
  if (err) {
    console.error('Error opening config database:', err);
  } else {
    console.log('Connected to config database');
    initializeConfigDatabase();
  }
});

function initializeConfigDatabase() {
  configDb.serialize(() => {
    // Guild settings table
    configDb.run(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        privacy_level TEXT DEFAULT 'private',
        admin_role_id TEXT,
        stats_viewer_role_id TEXT,
        leaderboard_enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User privacy preferences table
    configDb.run(`
      CREATE TABLE IF NOT EXISTS user_privacy (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        privacy_level TEXT DEFAULT 'private',
        allowed_user_ids TEXT,
        PRIMARY KEY (user_id, guild_id)
      )
    `);
  });
}

/**
 * Privacy Levels:
 * - 'private': Only the user and guild admins can view their stats
 * - 'friends': Only specific friends and guild admins can view
 * - 'public': Anyone can view stats
 */

// Get guild settings
function getGuildSettings(guildId) {
  return new Promise((resolve, reject) => {
    configDb.get(
      `SELECT * FROM guild_settings WHERE guild_id = ?`,
      [guildId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

// Initialize guild with default settings
async function initializeGuildSettings(guildId) {
  return new Promise((resolve, reject) => {
    configDb.run(
      `INSERT OR IGNORE INTO guild_settings (guild_id, privacy_level) 
       VALUES (?, 'private')`,
      [guildId],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

// Update guild settings
function updateGuildSettings(guildId, updates) {
  return new Promise((resolve, reject) => {
    const allowedFields = ['privacy_level', 'admin_role_id', 'stats_viewer_role_id', 'leaderboard_enabled'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      resolve(0);
      return;
    }

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);
    values.push(guildId);

    configDb.run(
      `UPDATE guild_settings SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
       WHERE guild_id = ?`,
      values,
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

// Get user privacy settings
function getUserPrivacy(userId, guildId) {
  return new Promise((resolve, reject) => {
    configDb.get(
      `SELECT * FROM user_privacy WHERE user_id = ? AND guild_id = ?`,
      [userId, guildId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      }
    );
  });
}

// Set user privacy level
function setUserPrivacy(userId, guildId, privacyLevel) {
  return new Promise((resolve, reject) => {
    configDb.run(
      `INSERT OR REPLACE INTO user_privacy (user_id, guild_id, privacy_level) 
       VALUES (?, ?, ?)`,
      [userId, guildId, privacyLevel],
      function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}

// Allow user to share stats with specific users
function addAllowedUser(userId, guildId, allowedUserId) {
  return new Promise(async (resolve, reject) => {
    try {
      const privacy = await getUserPrivacy(userId, guildId);
      let allowedList = privacy?.allowed_user_ids ? privacy.allowed_user_ids.split(',') : [];
      
      if (!allowedList.includes(allowedUserId)) {
        allowedList.push(allowedUserId);
      }

      configDb.run(
        `INSERT OR REPLACE INTO user_privacy (user_id, guild_id, privacy_level, allowed_user_ids) 
         VALUES (?, ?, 'friends', ?)`,
        [userId, guildId, allowedList.join(',')],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

// Remove user from allowed list
function removeAllowedUser(userId, guildId, allowedUserId) {
  return new Promise(async (resolve, reject) => {
    try {
      const privacy = await getUserPrivacy(userId, guildId);
      if (!privacy?.allowed_user_ids) {
        resolve(0);
        return;
      }

      let allowedList = privacy.allowed_user_ids.split(',').filter(id => id !== allowedUserId);

      configDb.run(
        `UPDATE user_privacy SET allowed_user_ids = ? 
         WHERE user_id = ? AND guild_id = ?`,
        [allowedList.join(','), userId, guildId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

// Check if user can view another user's stats
async function canViewStats(viewerId, targetUserId, guildId, member) {
  try {
    // User can always view their own stats
    if (viewerId === targetUserId) return true;

    // Check if viewer is a guild admin
    if (member && member.permissions.has('ADMINISTRATOR')) return true;

    // Get guild settings
    const guildSettings = await getGuildSettings(guildId);
    if (!guildSettings) await initializeGuildSettings(guildId);

    // Check guild privacy level
    const settings = guildSettings || { privacy_level: 'private' };
    
    if (settings.privacy_level === 'public') return true;

    // Check if viewer has the stats_viewer role
    if (settings.stats_viewer_role_id && member) {
      if (member.roles.cache.has(settings.stats_viewer_role_id)) {
        return true;
      }
    }

    // Check user-specific privacy settings
    const userPrivacy = await getUserPrivacy(targetUserId, guildId);
    if (!userPrivacy) {
      // Default to private if no settings found
      return false;
    }

    if (userPrivacy.privacy_level === 'public') return true;

    if (userPrivacy.privacy_level === 'friends' && userPrivacy.allowed_user_ids) {
      return userPrivacy.allowed_user_ids.split(',').includes(viewerId);
    }

    return false;
  } catch (err) {
    console.error('Error checking view permissions:', err);
    return false;
  }
}

module.exports = {
  configDb,
  initializeGuildSettings,
  getGuildSettings,
  updateGuildSettings,
  getUserPrivacy,
  setUserPrivacy,
  addAllowedUser,
  removeAllowedUser,
  canViewStats
};
