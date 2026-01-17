const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const { emojis, charCount, embedColor } = require('../utils/gdpsUtils');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const hosting = process.env.HOSTING || 'http://localhost/';
const iconhost = hosting.endsWith('/') ? hosting : hosting + '/';
const resourcesPath = path.join(__dirname, '../resources');

async function executeStats(interactionOrMessage, authorId, channelId) {
    try {
        let stars = 190; // RobTop base stars
        let usercoins = 0;
        let secretcoins = 66; // RobTop base coins
        let demons = 3; // RobTop base demons

        // Calculate stars from rated levels
        const levelstuff = await db.query('SELECT starStars, coins, starCoins, starDemon FROM levels');
        for (const level of levelstuff) {
            stars += level.starStars;
            if (level.starCoins != 0) {
                usercoins += level.coins;
            }
            if (level.starDemon != 0) {
                demons++;
            }
        }

        // Calculate stars from daily/weekly levels (optimizado: una sola query con JOIN)
        const dailylevels = await db.query(`
            SELECT l.starStars, l.coins, l.starCoins, l.starDemon 
            FROM dailyfeatures d 
            INNER JOIN levels l ON d.levelID = l.levelID
        `);
        for (const dailystars of dailylevels) {
            stars += dailystars.starStars;
            if (dailystars.starCoins != 0) {
                usercoins += dailystars.coins;
            }
            if (dailystars.starDemon != 0) {
                demons++;
            }
        }

        // Calculate stars from gauntlets (optimizado: recopilar IDs primero, luego una query)
        const gauntlets = await db.query('SELECT level1, level2, level3, level4, level5 FROM gauntlets');
        const gauntletLevelIds = [];
        for (const gauntlet of gauntlets) {
            for (let x = 1; x < 6; x++) {
                const levelID = gauntlet[`level${x}`];
                if (levelID) {
                    gauntletLevelIds.push(levelID);
                }
            }
        }
        
        // Una sola query para todos los niveles de gauntlets
        if (gauntletLevelIds.length > 0) {
            const placeholders = gauntletLevelIds.map(() => '?').join(',');
            const gauntletlevels = await db.query(
                `SELECT starStars, coins, starCoins, starDemon FROM levels WHERE levelID IN (${placeholders})`,
                gauntletLevelIds
            );
            for (const gauntletstars of gauntletlevels) {
                stars += gauntletstars.starStars;
                if (gauntletstars.starCoins != 0) {
                    usercoins += gauntletstars.coins;
                }
                if (gauntletstars.starDemon != 0) {
                    demons++;
                }
            }
        }

        // Calculate stars from mappacks
        const mappacks = await db.query('SELECT stars, coins FROM mappacks');
        for (const pack of mappacks) {
            stars += pack.stars;
            secretcoins += pack.coins;
        }

        const starsMax = charCount(stars);
        const usercMax = charCount(usercoins);
        const demonsMax = charCount(demons);
        const secretcoinsMax = charCount(secretcoins);

        // Accounts stats
        const totalaccountsData = await db.queryOne('SELECT count(*) as count FROM accounts');
        const totalaccounts = totalaccountsData?.count || 0;

        const timeago = Math.floor(Date.now() / 1000) - 86400;
        const activeusersData = await db.queryOne(
            'SELECT count(*) as count FROM users WHERE lastPlayed > ?',
            [timeago]
        );
        const activeusers = activeusersData?.count || 0;

        const levelcountData = await db.queryOne('SELECT count(*) as count FROM levels');
        const levelcount = levelcountData?.count || 0;

        const ratedlevelcountData = await db.queryOne('SELECT count(*) as count FROM levels WHERE starStars != 0');
        const ratedlevelcount = ratedlevelcountData?.count || 0;

        const tag = `<@${authorId}>, Here Geometry Dash Chaos Stats:`;
        const info = "These are the maximum leaderboard stats to date";
        const gdpsstats = `${emojis.icon_star} \`${starsMax}\`\n${emojis.icon_diamond} \`      ???\`\n${emojis.icon_secretcoin} \`${secretcoinsMax}\`\n${emojis.icon_verifycoins} \`${usercMax}\`\n${emojis.icon_demon} \`${demonsMax}\``;
        const gdpsinfo = `
${emojis.icon_play} __Levels__
**Total levels:** ${levelcount}
**Rated levels:** ${ratedlevelcount}
${emojis.icon_friends} __Accounts__
**Registered:** ${totalaccounts}
**Active users:** ${activeusers}`;

        const embed = new EmbedBuilder()
            .setTitle(`${emojis.icon_profile} Server Stats`)
            .setDescription(info)
            .addFields(
                { name: '────────────', value: gdpsstats, inline: true },
                { name: '────────────', value: gdpsinfo, inline: true }
            )
            .setColor(embedColor(7))
            .setFooter({ 
                iconURL: iconhost + 'resources/misc/gdpsbot.png', // iconURL no soporta attachments
                text: 'Chaos-Bot' 
            });
        
        // Cargar imágenes como attachments
        const files = [];
        const thumbnailPath = path.join(resourcesPath, 'misc/gdpsthumb.png');
        const imagePath = path.join(resourcesPath, 'misc/gdpslogo.png');
        
        if (fs.existsSync(thumbnailPath)) {
            const thumbnailBuffer = fs.readFileSync(thumbnailPath);
            const thumbnailAttachment = new AttachmentBuilder(thumbnailBuffer, { name: 'gdpsthumb.png' });
            embed.setThumbnail('attachment://gdpsthumb.png');
            files.push(thumbnailAttachment);
        }
        
        if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            const imageAttachment = new AttachmentBuilder(imageBuffer, { name: 'gdpslogo.png' });
            embed.setImage('attachment://gdpslogo.png');
            files.push(imageAttachment);
        }

        if (interactionOrMessage.isCommand?.()) {
            await interactionOrMessage.reply({ content: tag, embeds: [embed], files: files });
        } else {
            await interactionOrMessage.channel.send({ content: tag, embeds: [embed], files: files });
        }
    } catch (error) {
        console.error('Error en comando stats:', error);
        const errorMsg = '❌ Error al obtener las estadísticas del servidor.';
        if (interactionOrMessage.isCommand?.()) {
            await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
        } else {
            interactionOrMessage.reply(errorMsg).catch(console.error);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Muestra las estadísticas generales del GDPS'),
    async execute(interaction) {
        await executeStats(interaction, interaction.user.id, interaction.channel.id);
    }
};
