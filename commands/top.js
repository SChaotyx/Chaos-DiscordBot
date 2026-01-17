const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const { emojis, charCount, embedColor } = require('../utils/gdpsUtils');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const hosting = process.env.HOSTING || 'http://localhost/';
const iconhost = hosting.endsWith('/') ? hosting : hosting + '/';
const resourcesPath = path.join(__dirname, '../resources');

async function executeTop(interactionOrMessage, type, authorId, channelId) {
    try {
        if (!type || type.trim() === '') {
            type = 'stars';
        }

        type = type.toLowerCase();

        // Construir query según el tipo
        let querypart3 = "";
        switch (type) {
            case 'stars':
                querypart3 = "stars > 9 AND isRegistered = 1 AND isBanned = 0 ORDER BY stars DESC, demons DESC, userCoins DESC, coins DESC, diamonds DESC ";
                break;
            case 'demons':
                querypart3 = "demons > 0 AND isRegistered = 1 AND isBanned = 0 ORDER BY demons DESC, stars DESC, userCoins DESC, coins DESC, diamonds DESC ";
                break;
            case 'coins':
                querypart3 = "coins > 0 AND isRegistered = 1 AND isBanned = 0 ORDER BY coins DESC, stars DESC, demons DESC, userCoins DESC, diamonds DESC ";
                break;
            case 'usercoins':
            case 'user_coins':
                querypart3 = "userCoins > 0 AND isRegistered = 1 AND isBanned = 0 ORDER BY userCoins DESC, stars DESC, demons DESC, coins DESC, diamonds DESC ";
                type = 'userCoins'; // Normalizar
                break;
            case 'diamonds':
                querypart3 = "diamonds > 99 AND isRegistered = 1 AND isBanned = 0 ORDER BY diamonds DESC, stars DESC, demons DESC, userCoins DESC, coins DESC ";
                break;
            case 'creatorpoints':
            case 'creator_points':
            case 'cp':
                querypart3 = "creatorPoints > 0 AND isCreatorBanned = 0 ORDER BY creatorPoints DESC, stars DESC, demons DESC, userCoins DESC, coins DESC, diamonds DESC ";
                type = 'creatorPoints'; // Normalizar
                break;
            default:
                querypart3 = "stars > 9 AND isRegistered = 1 AND isBanned = 0 ORDER BY stars DESC, demons DESC, userCoins DESC, coins DESC, diamonds DESC ";
                type = 'stars';
                break;
        }

        const query = `SELECT * FROM users WHERE ${querypart3} LIMIT 20`;
        const users = await db.query(query);

        if (!users || users.length === 0) {
            const errorMsg = `<@${authorId}>, Nothing Found`;
            if (interactionOrMessage.isCommand?.()) {
                await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
            } else {
                await interactionOrMessage.reply(errorMsg);
            }
            return;
        }

        // Definir tipo y icono
        let Ltype = "";
        let Licon = "";
        switch(type) {
            case "creatorPoints":
                Ltype = "Creator Points";
                Licon = emojis.icon_cp;
                break;
            case "stars":
                Ltype = "Stars";
                Licon = emojis.icon_star;
                break;
            case "demons":
                Ltype = "Demons";
                Licon = emojis.icon_demon;
                break;
            case "userCoins":
                Ltype = "User Coins";
                Licon = emojis.icon_verifycoins;
                break;
            case "coins":
                Ltype = "Secret Coins";
                Licon = emojis.icon_secretcoin;
                break;
            case "diamonds":
                Ltype = "Diamonds";
                Licon = emojis.icon_diamond;
                break;
        }

        // Construir lista
        let lol = "";
        const iconMap = {
            1: { icon: emojis.icon_top1, posn: "1 #" },
            2: { icon: emojis.icon_top10, posn: "2 #" },
            3: { icon: emojis.icon_top50, posn: "3 #" },
            4: { icon: emojis.icon_top100, posn: "4 #" },
            5: { icon: emojis.icon_top200, posn: "5 #" },
            6: { icon: emojis.icon_top500, posn: "6 #" },
            7: { icon: emojis.icon_top500, posn: "7 #" },
            8: { icon: emojis.icon_top500, posn: "8 #" },
            9: { icon: emojis.icon_top500, posn: "9 #" },
            10: { icon: emojis.icon_top1000, posn: "10#" },
            11: { icon: emojis.icon_top1000, posn: "11#" },
            12: { icon: emojis.icon_top1000, posn: "12#" },
            13: { icon: emojis.icon_top1000, posn: "13#" },
            14: { icon: emojis.icon_top1000, posn: "14#" },
            15: { icon: emojis.icon_globalrank, posn: "15#" },
            16: { icon: emojis.icon_globalrank, posn: "16#" },
            17: { icon: emojis.icon_globalrank, posn: "17#" },
            18: { icon: emojis.icon_globalrank, posn: "18#" },
            19: { icon: emojis.icon_globalrank, posn: "19#" },
            20: { icon: emojis.icon_globalrank, posn: "20#" }
        };

        users.forEach((row, index) => {
            const pos = index + 1;
            const iconData = iconMap[pos] || { icon: emojis.icon_globalrank, posn: `${pos}#` };
            lol += `${iconData.icon} \`${iconData.posn}\` | ${Licon} \`${charCount(row[type])}\` | __**${row.userName}**__\n`;
        });

        const now = new Date();
        const embed = new EmbedBuilder()
            .setTitle(`${Licon} __Top 20 Leaderboards!!!__`)
            .setDescription(`───────────────────\n${lol}───────────────────`)
            .setFooter({ text: `Leaderboard dated on: ${now.toISOString().slice(0, 19).replace('T', ' ')}` });
        
        // Cargar thumbnail como attachment
        const thumbnailPath = path.join(resourcesPath, 'misc/gdpsthumb.png');
        const files = [];
        if (fs.existsSync(thumbnailPath)) {
            const thumbnailBuffer = fs.readFileSync(thumbnailPath);
            const thumbnailAttachment = new AttachmentBuilder(thumbnailBuffer, { name: 'gdpsthumb.png' });
            embed.setThumbnail('attachment://gdpsthumb.png');
            files.push(thumbnailAttachment);
        }

        const content = `<@${authorId}>, Here TOP 20 Leaderboard based on ${Ltype}`;

        if (interactionOrMessage.isCommand?.()) {
            await interactionOrMessage.reply({ content, embeds: [embed], files: files });
        } else {
            await interactionOrMessage.channel.send({ content, embeds: [embed], files: files });
        }
    } catch (error) {
        console.error('Error en comando top:', error);
        const errorMsg = '❌ Error al buscar el leaderboard.';
        if (interactionOrMessage.isCommand?.()) {
            await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
        } else {
            interactionOrMessage.reply(errorMsg).catch(console.error);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Muestra el top 20 leaderboard según estadística')
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de leaderboard (stars, demons, coins, usercoins, diamonds, creatorpoints)')
                .setRequired(false)
                .addChoices(
                    { name: 'Stars', value: 'stars' },
                    { name: 'Demons', value: 'demons' },
                    { name: 'Secret Coins', value: 'coins' },
                    { name: 'User Coins', value: 'usercoins' },
                    { name: 'Diamonds', value: 'diamonds' },
                    { name: 'Creator Points', value: 'creatorpoints' }
                )),
    async execute(interaction) {
        const type = interaction.options.getString('tipo') || 'stars';
        await executeTop(interaction, type, interaction.user.id, interaction.channel.id);
    }
};
