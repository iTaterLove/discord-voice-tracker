const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the voice channel leaderboard'),
  
  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guildId;

    try {
      // Get top 10 users by total voice time
      const leaderboard = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            user_id,
            user_name,
            COUNT(*) as session_count,
            COALESCE(SUM(duration), 0) as total_seconds
           FROM voice_sessions 
           WHERE guild_id = ? AND duration IS NOT NULL
           GROUP BY user_id
           ORDER BY total_seconds DESC
           LIMIT 10`,
          [guildId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      if (leaderboard.length === 0) {
        await interaction.editReply({
          content: '📭 No voice statistics recorded yet.',
          ephemeral: true
        });
        return;
      }

      const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        let result = [];
        if (hours > 0) result.push(`${hours}h`);
        if (minutes > 0) result.push(`${minutes}m`);
        if (secs > 0 || result.length === 0) result.push(`${secs}s`);
        
        return result.join(' ');
      };

      const leaderboardText = leaderboard
        .map((entry, index) => {
          const medal = ['🥇', '🥈', '🥉'][index] || `#${index + 1}`;
          return `${medal} **${entry.user_name}** - ${formatTime(entry.total_seconds)} (${entry.session_count} sessions)`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Voice Channel Leaderboard')
        .setDescription(leaderboardText)
        .setFooter({ text: `Updated at ${new Date().toLocaleTimeString()}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      await interaction.editReply({
        content: '❌ Error fetching leaderboard. Please try again later.',
        ephemeral: true
      });
    }
  }
};
