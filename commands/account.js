const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const { emojis, charCount, embedColor, timeElapsed } = require('../utils/gdpsUtils');
const { generateProfileIconSet } = require('../utils/imageGenerator');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const hosting = process.env.HOSTING || 'http://localhost/';
const iconhost = hosting.endsWith('/') ? hosting : hosting + '/';
const resourcesPath = path.join(__dirname, '../resources');

async function executeAccount(interactionOrMessage, userName, authorId, channelId) {
    try {
        if (!userName || userName.trim() === '') {
            const errorMsg = `<@${authorId}>, The server did not receive data`;
            if (interactionOrMessage.isCommand?.()) {
                await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
            } else {
                await interactionOrMessage.reply(errorMsg);
            }
            return;
        }

        // Buscar cuenta
        const account = await db.queryOne(
            'SELECT * FROM accounts WHERE userName = ? OR accountID = ? LIMIT 1',
            [userName, userName]
        );

        if (!account) {
            const errorMsg = `<@${authorId}>, Nothing Found`;
            if (interactionOrMessage.isCommand?.()) {
                await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
            } else {
                await interactionOrMessage.reply(errorMsg);
            }
            return;
        }

        const accountID = account.accountID;
        const email = account.email;
        const registerDate = account.registerDate;
        const friends = account.friendsCount;

        // Buscar perfil de usuario
        const profile = await db.queryOne(
            'SELECT * FROM users WHERE extID = ? LIMIT 1',
            [accountID]
        );

        let userID = "????";
        let PuserName = "Unknown";
        let Pstats = "This Account don't have a user profile.";

        if (profile) {
            userID = profile.userID;
            PuserName = profile.userName;
            const userstars = profile.stars;
            const usermoons = (profile.moons !== null && profile.moons !== undefined) ? profile.moons : 0;
            const userdiamonds = profile.diamonds;
            const userscoins = profile.coins;
            const userucoins = profile.userCoins;
            const userdemons = profile.demons;
            const usercp = profile.creatorPoints;
            const userorbs = profile.orbs;
            const lastplayed = profile.lastPlayed;
            const completedLvls = profile.completedLvls;
            const isbanned = profile.isBanned;
            const isCbanned = profile.isCreatorBanned;

            const banStatus = isbanned == 1 ? "Banned." : "No.";
            const cbanStatus = isCbanned == 1 ? "Banned." : "No.";

            Pstats = `${emojis.icon_star} \`${userstars}\` | ${emojis.icon_moon} \`${usermoons}\` | ${emojis.icon_secretcoin} \`${userscoins}\` | ${emojis.icon_verifycoins} \`${userucoins}\` \n ${emojis.icon_demon} \`${userdemons}\` | ${emojis.icon_cp} \`${usercp}\` | ${emojis.icon_diamond} \`${userdiamonds}\` | ${emojis.icon_orbs} \`${userorbs}\`\n───────────────────\n` +
                `${emojis.icon_friends} **Friends Count:** \`${friends}\`\n` +
                `${emojis.icon_length} **Last Time Online:** \`${timeElapsed(lastplayed)} ago\`\n` +
                `${emojis.icon_play} **Completed Levels:** \`${completedLvls}\`\n` +
                `${emojis.icon_globalrank} **Is Banned:** \`${banStatus}\`\n` +
                `${emojis.icon_creatorrank} **Is Creator Banned:** \`${cbanStatus}\``;
        }

        // Formatear fecha de registro
        const regDate = new Date(registerDate * 1000);
        const dateStr = regDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
        
        const content = `<@${authorId}>, here is the full account info for **${account.userName}**:`;
        const title = `${emojis.icon_friends} Account info`;
        const name1 = `${emojis.icon_profile} ${account.userName}'s account info:`;
        const value1 = `**UserName:** \`${account.userName}\`\n**Password:** ||( ͡° ͜ʖ ͡°)||`;
        const name2 = "───────────────────";
        const value2 = `:calendar: **Register Date:** \`${dateStr} (${timeElapsed(registerDate)} ago)\` \n ${emojis.icon_message} **Email:** \`${email}\`\n───────────────────`;
        const name3 = `${emojis.icon_profile} Profile: ${PuserName}`;
        const value3 = Pstats;
        const footicon = iconhost + 'resources/misc/auto.png'; // iconURL no soporta attachments
        const userinfo = `Chaos Bot | UserID: ${userID} | AccID: ${accountID}`;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .addFields(
                { name: name1, value: value1 },
                { name: name2, value: value2 },
                { name: name3, value: value3 }
            )
            .setColor(embedColor(7))
            .setFooter({ iconURL: footicon, text: userinfo });
        
        // Cargar thumbnail como attachment
        const thumbnailPath = path.join(resourcesPath, 'buttons/user_button.png');
        const files = [];
        if (fs.existsSync(thumbnailPath)) {
            const thumbnailBuffer = fs.readFileSync(thumbnailPath);
            const thumbnailAttachment = new AttachmentBuilder(thumbnailBuffer, { name: 'user_button.png' });
            embed.setThumbnail('attachment://user_button.png');
            files.push(thumbnailAttachment);
        }

        // Generar iconset (sin jetpack)
        if (profile) {
            const iconSetBuffer = await generateProfileIconSet(accountID, null, false);
            if (iconSetBuffer) {
                const iconSetAttachment = new AttachmentBuilder(iconSetBuffer, { name: 'iconset.png' });
                embed.setImage('attachment://iconset.png');
                files.push(iconSetAttachment);
            }
        }

        if (interactionOrMessage.isCommand?.()) {
            await interactionOrMessage.reply({ content, embeds: [embed], files: files });
        } else {
            await interactionOrMessage.channel.send({ content, embeds: [embed], files: files });
        }
    } catch (error) {
        console.error('Error en comando account:', error);
        const errorMsg = '❌ Error al buscar la cuenta del usuario.';
        if (interactionOrMessage.isCommand?.()) {
            await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
        } else {
            interactionOrMessage.reply(errorMsg).catch(console.error);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('account')
        .setDescription('Muestra información detallada de una cuenta registrada')
        .addStringOption(option =>
            option.setName('usuario')
                .setDescription('Nombre de usuario o AccountID del GDPS')
                .setRequired(false)),
    async execute(interaction) {
        const userName = interaction.options.getString('usuario') || '';
        await executeAccount(interaction, userName, interaction.user.id, interaction.channel.id);
    }
};
