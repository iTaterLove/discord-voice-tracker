require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const { 
  addVoiceSession, 
  completeVoiceSession, 
  getTotalVoiceTime,
  getAverageDailyVoiceTime,
  getMostActiveDays,
  getSessionHistory,
  getActiveSession
} = require('./database');
const fs = require('fs');
const path = require('path');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ] 
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath);
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
}

// Helper function to format seconds into readable time
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  let result = [];
  if (hours > 0) result.push(`${hours}h`);
  if (minutes > 0) result.push(`${minutes}m`);
  if (secs > 0 || result.length === 0) result.push(`${secs}s`);
  
  return result.join(' ');
}

// Listen for ready event
client.on('ready', () => {
  console.log(`✓ Bot logged in as ${client.user.tag}`);
  client.user.setActivity('voice channels', { type: 'WATCHING' });
});

// Handle voice state updates
client.on('voiceStateUpdate', async (oldState, newState) => {
  const userId = newState.id;
  const guildId = newState.guild.id;
  const member = newState.member;

  // User joined a voice channel
  if (!oldState.channelId && newState.channelId) {
    try {
      await addVoiceSession(userId, member.user.username, guildId);
      console.log(`✓ ${member.user.username} joined voice channel`);
    } catch (err) {
      console.error('Error recording voice join:', err);
    }
  }
  
  // User left a voice channel
  if (oldState.channelId && !newState.channelId) {
    try {
      await completeVoiceSession(userId, guildId);
      console.log(`✓ ${member.user.username} left voice channel`);
    } catch (err) {
      console.error('Error recording voice leave:', err);
    }
  }
  
  // User switched channels (treat as leave + join)
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    try {
      await completeVoiceSession(userId, guildId);
      await addVoiceSession(userId, member.user.username, guildId);
      console.log(`✓ ${member.user.username} switched voice channels`);
    } catch (err) {
      console.error('Error recording voice channel switch:', err);
    }
  }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, {
      getTotalVoiceTime,
      getAverageDailyVoiceTime,
      getMostActiveDays,
      getSessionHistory,
      getActiveSession,
      formatTime
    });
  } catch (err) {
    console.error('Command error:', err);
    await interaction.reply({ 
      content: '❌ An error occurred while executing that command.', 
      ephemeral: true 
    });
  }
});

// Register commands
async function registerCommands() {
  try {
    const commands = client.commands.map(cmd => cmd.data.toJSON());
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    console.log('⟳ Refreshing slash commands...');
    
    if (process.env.DISCORD_GUILD_ID) {
      // Guild commands (instant update, for testing)
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
        { body: commands }
      );
      console.log('✓ Guild commands registered');
    } else {
      // Global commands (can take up to 1 hour to update)
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
        { body: commands }
      );
      console.log('✓ Global commands registered');
    }
  } catch (err) {
    console.error('Error registering commands:', err);
  }
}

client.once('ready', registerCommands);

client.login(process.env.DISCORD_TOKEN);
