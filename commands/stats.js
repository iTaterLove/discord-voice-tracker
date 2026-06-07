const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your voice channel statistics')
    .addUserOption(option => 
      option
        .setName('user')
        .setDescription('The user to view stats for (default: yourself)')
        .setRequired(false)
    ),
  
  async execute(interaction, utils) {
    const { 
      getTotalVoiceTime, 
      getAverageDailyVoiceTime, 
      getMostActiveDays,
      getSessionHistory,
      getActiveSession,
      formatTime 
    } = utils;

    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    try {
      const [totalTime, dailyStats, activeDays, history, activeSession] = await Promise.all([
        getTotalVoiceTime(targetUser.id, guildId),
        getAverageDailyVoiceTime(targetUser.id, guildId),
        getMostActiveDays(targetUser.id, guildId),
        getSessionHistory(targetUser.id, guildId, 5),
        getActiveSession(targetUser.id, guildId)
      ]);

      const embed = new EmbedBuilder()
        .setColor('#00b0f4')
        .setTitle(`📊 Voice Statistics for ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: '⏱️ Total Voice Time',
            value: formatTime(totalTime) || 'No data yet',
            inline: true
          },
          {
            name: '📅 Days Active',
            value: `${dailyStats.days_active} days`,
            inline: true
          },
          {
            name: '📈 Average Daily Time',
            value: formatTime(dailyStats.average_seconds) || 'No data yet',
            inline: true
          }
        );

      // Add active session if exists
      if (activeSession) {
        const currentDuration = Math.floor(Date.now() / 1000) - activeSession.join_time;
        embed.addFields({
          name: '🎙️ Currently In Voice',
          value: `Duration: ${formatTime(currentDuration)}`,
          inline: false
        });
      }

      // Add most active days
      if (activeDays.length > 0) {
        const daysText = activeDays
          .slice(0, 3)
          .map(day => `**${day.day_name}** - ${formatTime(day.total_seconds)} (${day.session_count} sessions)`)
          .join('\n');
        
        embed.addFields({
          name: '📊 Most Active Days',
          value: daysText || 'No data yet',
          inline: false
        });
      }

      // Add recent sessions
      if (history.length > 0) {
        const sessionsText = history
          .map(session => {
            const joinTime = session.join_time ? new Date(session.join_time).toLocaleDateString() : 'N/A';
            return `${joinTime} - ${formatTime(session.duration)}`;
          })
          .join('\n');
        
        embed.addFields({
          name: '📋 Recent Sessions',
          value: sessionsText || 'No sessions recorded',
          inline: false
        });
      } else {
        embed.addFields({
          name: '📋 Recent Sessions',
          value: 'No sessions recorded yet',
          inline: false
        });
      }

      embed.setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error fetching stats:', err);
      await interaction.editReply({
        content: '❌ Error fetching statistics. Please try again later.',
        ephemeral: true
      });
    }
  }
};
