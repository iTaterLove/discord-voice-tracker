const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserPrivacy, setUserPrivacy, addAllowedUser, removeAllowedUser } = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('privacy')
    .setDescription('Manage your voice statistics privacy settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View your current privacy settings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set your privacy level')
        .addStringOption(option =>
          option
            .setName('level')
            .setDescription('Privacy level for your stats')
            .addChoices(
              { name: 'Private - Only you and admins can view', value: 'private' },
              { name: 'Friends - Share with specific people', value: 'friends' },
              { name: 'Public - Anyone can view', value: 'public' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('allow')
        .setDescription('Allow a friend to view your stats')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to allow access')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('deny')
        .setDescription('Revoke a friend\'s access to your stats')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to deny access')
            .setRequired(true)
        )
    ),
  
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    try {
      if (subcommand === 'view') {
        const privacy = await getUserPrivacy(userId, guildId);
        const privacyLevel = privacy?.privacy_level || 'private';
        const allowedUsers = privacy?.allowed_user_ids ? privacy.allowed_user_ids.split(',') : [];

        const embed = new EmbedBuilder()
          .setColor('#00b0f4')
          .setTitle('🔒 Your Privacy Settings')
          .addFields(
            {
              name: 'Privacy Level',
              value: this.getPrivacyDescription(privacyLevel),
              inline: false
            }
          );

        if (allowedUsers.length > 0 && allowedUsers[0] !== '') {
          embed.addFields({
            name: 'Friends Allowed to View',
            value: allowedUsers.map(id => `<@${id}>`).join(', ') || 'None',
            inline: false
          });
        }

        await interaction.editReply({ embeds: [embed] });
      }

      else if (subcommand === 'set') {
        const level = interaction.options.getString('level');
        await setUserPrivacy(userId, guildId, level);

        const embed = new EmbedBuilder()
          .setColor('#00b0f4')
          .setTitle('✅ Privacy Settings Updated')
          .setDescription(this.getPrivacyDescription(level));

        await interaction.editReply({ embeds: [embed] });
      }

      else if (subcommand === 'allow') {
        const allowUser = interaction.options.getUser('user');
        
        if (allowUser.id === userId) {
          await interaction.editReply({
            content: '❌ You cannot add yourself to your own allowed list.'
          });
          return;
        }

        await addAllowedUser(userId, guildId, allowUser.id);

        const embed = new EmbedBuilder()
          .setColor('#00b0f4')
          .setTitle('✅ Access Granted')
          .setDescription(`${allowUser.username} can now view your voice statistics.`)
          .addFields({
            name: 'Note',
            value: 'Your privacy level has been set to "Friends". Only people on your allowed list can view your stats.',
            inline: false
          });

        await interaction.editReply({ embeds: [embed] });
      }

      else if (subcommand === 'deny') {
        const denyUser = interaction.options.getUser('user');
        await removeAllowedUser(userId, guildId, denyUser.id);

        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('✅ Access Revoked')
          .setDescription(`${denyUser.username} can no longer view your voice statistics.`);

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Error in privacy command:', err);
      await interaction.editReply({
        content: '❌ An error occurred while updating your privacy settings.'
      });
    }
  },

  getPrivacyDescription(level) {
    const descriptions = {
      private: '🔒 **Private** - Only you and guild administrators can view your statistics.',
      friends: '👥 **Friends** - Only people you explicitly allow can view your statistics.',
      public: '🌐 **Public** - Anyone in the server can view your statistics.'
    };
    return descriptions[level] || descriptions.private;
  }
};
