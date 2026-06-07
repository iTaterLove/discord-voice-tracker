# Discord Voice Tracker Bot

A Discord bot that tracks voice channel activity and generates detailed statistics about when and how long members are in voice channels.

## Features

✨ **Comprehensive Tracking**
- Automatically records when members join and leave voice channels
- Tracks session duration and frequency
- Stores all data in a local SQLite database

📊 **Detailed Statistics**
- Total voice time for each member
- Average daily voice time
- Most active days of the week
- Recent session history
- Guild-wide leaderboard

🎯 **Commands**
- `/stats [user]` - View voice statistics for yourself or another user
- `/leaderboard` - See the top 10 most active voice members

## Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- A Discord bot token and application ID

### Installation

1. **Clone or download the repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a `.env` file**
   ```bash
   cp .env.example .env
   ```

4. **Fill in your Discord credentials in `.env`**
   ```
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_GUILD_ID=your_guild_id_here  # Optional, for faster command updates during testing
   ```

### Getting Your Discord Credentials

1. **Bot Token:**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" section and click "Add Bot"
   - Copy the token

2. **Client ID:**
   - In the Developer Portal, go to "General Information"
   - Copy the Application ID

3. **Guild ID (Optional):**
   - Enable Developer Mode in Discord settings
   - Right-click your server and select "Copy Server ID"
   - Add this for faster command registration during testing

### Inviting the Bot

1. Go to Developer Portal → Your App → OAuth2 → URL Generator
2. Select these scopes: `bot`, `applications.commands`
3. Select these permissions:
   - ✅ Send Messages
   - ✅ Send Messages in Threads
   - ✅ Embed Links
   - ✅ Read Message History
4. Copy the generated URL and open it in your browser to invite the bot

### Running the Bot

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Database

The bot uses SQLite to store voice session data. The database file `voice_tracker.db` will be created automatically in the root directory.

### Data Structure

**voice_sessions table:**
- `id` - Unique session identifier
- `user_id` - Discord user ID
- `user_name` - Discord username
- `guild_id` - Discord guild/server ID
- `join_time` - Unix timestamp when user joined
- `leave_time` - Unix timestamp when user left
- `duration` - Session duration in seconds
- `created_at` - When the record was created

## Commands

### /stats [user]
View detailed voice statistics for a user.

**Options:**
- `user` (optional) - User to view stats for. Defaults to yourself.

**Output includes:**
- Total voice time
- Days active in voice
- Average daily voice time
- Current voice session (if active)
- Most active days
- Recent session history

**Example:**
```
/stats
/stats @username
```

### /leaderboard
Display the top 10 members by total voice time.

**Output includes:**
- Ranking with medals (🥇🥈🥉)
- Username
- Total voice time
- Number of sessions

## How It Works

1. **Joining Voice:** When a member joins a voice channel, the bot records the join time and creates a new session entry
2. **Leaving Voice:** When a member leaves a voice channel, the bot records the leave time and calculates the duration
3. **Switching Channels:** When a member switches channels, the previous session is ended and a new one begins
4. **Statistics Calculation:** Users can request statistics which queries the database to calculate:
   - Total time across all sessions
   - Average daily time (total time ÷ days active)
   - Most active days based on aggregate session time

## Troubleshooting

### Bot not showing up in server
- Ensure the bot has been invited with correct permissions
- Check that `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` are correct in `.env`

### Commands not appearing
- If using `DISCORD_GUILD_ID`, commands should appear immediately in that server
- If using global commands, it can take up to 1 hour for Discord to update
- Try restarting the bot and waiting a few minutes

### Database errors
- Ensure the bot has write permissions in its directory
- Delete `voice_tracker.db` to reset the database and start fresh

### No data being recorded
- Check the console logs for errors
- Ensure the bot has the `GUILD_VOICE_STATES` intent enabled
- Verify members are actually joining voice channels in the server

## Customization

### Adding More Statistics
Edit `database.js` to add new query functions, then add them to `commands/stats.js`

### Changing Time Format
Modify the `formatTime()` function in `index.js`

### Database Location
Change the database path in `database.js`:
```javascript
const db = new sqlite3.Database(path.join(__dirname, 'your_path.db'));
```

## Performance Notes

- The bot uses indexes on frequently queried columns for fast lookups
- Database queries are async and non-blocking
- Suitable for servers with hundreds to thousands of members

## License

MIT

## Support

For issues or feature requests, please open an issue on the repository.
