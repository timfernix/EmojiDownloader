const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { token, clientId } = require('./config.json');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

client.once('ready', async () => {
    console.log(`Bot logged in as ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('emojis')
            .setDescription('Download all emojis of this server.')
            .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        // For faster update during development, register per guild:
        // Replace 'YOUR_GUILD_ID' with your server id
        await rest.put(
            Routes.applicationGuildCommands(clientId, 'YOUR_GUILD_ID'),
            { body: commands }
        );
        console.log('Slash command registered.');
    } catch (error) {
        console.error('Error registering slash command:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'emojis') {
        if (!interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const emojis = interaction.guild.emojis.cache;
        if (emojis.size === 0) {
            await interaction.editReply({ content: 'No emojis found on this server.' });
            return;
        }

        const tempDir = path.join(__dirname, 'temp_emojis');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const total = emojis.size;
        let processed = 0;

        function getProgressBar(current, max, length = 20) {
            const percent = current / max;
            const filled = Math.round(length * percent);
            const empty = length - filled;
            return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${current}/${max}`;
        }

        await interaction.editReply({ content: `Downloading emojis...\n${getProgressBar(0, total)}` });

        for (const emoji of emojis.values()) {
            const ext = emoji.animated ? 'gif' : 'png';
            const url = emoji.animated
                ? `https://cdn.discordapp.com/emojis/${emoji.id}.gif`
                : `https://cdn.discordapp.com/emojis/${emoji.id}.png`;
            const filePath = path.join(tempDir, `${emoji.name}_${emoji.id}.${ext}`);
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                fs.writeFileSync(filePath, response.data);
            } catch (err) {
                console.error(`Error downloading ${emoji.name}:`, err);
            }
            processed++;
            if (processed % 5 === 0 || processed === total) {
                await interaction.editReply({ content: `Downloading emojis...\n${getProgressBar(processed, total)}` });
            }
        }

        await interaction.editReply({ content: `Done! Downloaded ${total} emojis to temp_emojis folder.` });
    }
});

client.login(token);
