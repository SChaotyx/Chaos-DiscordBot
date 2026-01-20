const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const { emojis, charCount, embedColor, timeElapsed } = require('../utils/gdpsUtils');
const { generateProfileIcon, generateProfileIconSet, resourcesPath } = require('../utils/imageGenerator');
require('dotenv').config();

const hosting = process.env.HOSTING || 'http://localhost/';
const iconhost = hosting.endsWith('/') ? hosting : hosting + '/';

async function buildProfileEmbed(targetAccID, tagID) {
    try {
        // Get user social links
        const userLinks = await db.queryOne(
            'SELECT youtubeurl, twitter, twitch FROM accounts WHERE accountID = ?',
            [targetAccID]
        );

        let socials = "";
        if (userLinks) {
            if (userLinks.youtubeurl) {
                socials += `${emojis.icon_youtube} [**YouTube**](https://www.youtube.com/channel/${userLinks.youtubeurl})\n`;
            }
            if (userLinks.twitter) {
                socials += `${emojis.icon_twitter} [**Twitter**](https://www.twitter.com/${userLinks.twitter})\n`;
            }
            if (userLinks.twitch) {
                socials += `${emojis.icon_twitch} [**Twitch**](https://www.twitch.tv/${userLinks.twitch})\n`;
            }
        }

        // Get user stats
        const userStats = await db.queryOne(
            'SELECT * FROM users WHERE extID = ?',
            [targetAccID]
        );

        if (!userStats) {
            return {
                content: "This account exists but does not have a profile."
            };
        }

        // Get user rank
        const roleData = await db.queryOne(
            'SELECT roleID FROM roleassign WHERE accountID = ? LIMIT 1',
            [targetAccID]
        );
        const roleID = roleData?.roleID || 0;
        
        const rankMap = {
            1: `${emojis.icon_brokenmodstar} **DEMOTED :(**\n`,
            2: `${emojis.icon_mod} **MODERATOR**\n`,
            3: `${emojis.icon_head} **HEAD MOD**\n`,
            4: `${emojis.icon_elder} **ELDER MOD**\n`,
            5: `${emojis.icon_admin} **ADMIN**\n`,
        };
        const rank = rankMap[roleID] || "";

        // Get global leaderboard rank
        let globalRank = "";
        if (userStats.stars > 25) {
            await db.query('SET @rownum := 0');
            const rankData = await db.queryOne(
                `SELECT rank FROM (
                    SELECT @rownum := @rownum + 1 AS rank, extID 
                    FROM users 
                    WHERE isBanned = '0' AND gameVersion > 19 AND stars > 25 
                    ORDER BY stars DESC
                ) as result WHERE extID = ?`,
                [targetAccID]
            );
            
            if (rankData && rankData.rank) {
                const globalPos = rankData.rank;
                // Trophy map ordenado de mayor a menor para comparación correcta
                const trophyMap = [
                    { rank: 1, icon: emojis.icon_top1 },
                    { rank: 10, icon: emojis.icon_top10 },
                    { rank: 50, icon: emojis.icon_top50 },
                    { rank: 100, icon: emojis.icon_top100 },
                    { rank: 200, icon: emojis.icon_top200 },
                    { rank: 500, icon: emojis.icon_top500 },
                    { rank: 1000, icon: emojis.icon_top1000 }
                ];
                let globalTrophy = emojis.icon_globalrank;
                // Encontrar el trophy apropiado (el rank más cercano pero menor o igual)
                for (const trophy of trophyMap) {
                    if (globalPos <= trophy.rank) {
                        globalTrophy = trophy.icon;
                        break;
                    }
                }
                globalRank = `${globalTrophy} **Global Rank:** ${globalPos} \n`;
            }
        }

        // Get creator leaderboard rank
        let creatorRank = "";
        if (userStats.creatorPoints > 0) {
            await db.query('SET @rownum := 0');
            const creatorRankData = await db.queryOne(
                `SELECT rank FROM (
                    SELECT @rownum := @rownum + 1 AS rank, extID 
                    FROM users 
                    WHERE isCreatorBanned = '0' AND gameVersion > 19 AND creatorPoints > 0 
                    ORDER BY creatorPoints DESC
                ) as result WHERE extID = ?`,
                [targetAccID]
            );
            
            if (creatorRankData && creatorRankData.rank) {
                const creatorPos = creatorRankData.rank;
                creatorRank = `${emojis.icon_creatorrank} **Creator Rank:** ${creatorPos} \n`;
            }
        }

        // Build embed
        const userTitle = `**:chart_with_upwards_trend: ${userStats.userName}'s stats**`;
        const statsDisplay = `${emojis.icon_star} \`${charCount(userStats.stars)}\` \n ${emojis.icon_diamond} \`${charCount(userStats.diamonds)}\` \n ${emojis.icon_secretcoin} \`${charCount(userStats.coins)}\` \n ${emojis.icon_verifycoins} \`${charCount(userStats.userCoins)}\` \n ${emojis.icon_demon} \`${charCount(userStats.demons)}\` \n ${emojis.icon_cp} \`${charCount(userStats.creatorPoints)}\``;
        const leaderboardInfo = rank + globalRank + creatorRank + socials;
        const userInfoFooter = ` | UserID: ${userStats.userID} | AccID: ${targetAccID}`;

        const embed = new EmbedBuilder()
            .setTitle(`${emojis.icon_profile} User profile`)
            .setDescription(userTitle)
            .addFields(
                { name: '────────────', value: statsDisplay, inline: true },
                { name: '────────────', value: leaderboardInfo || 'No additional info', inline: true }
            )
            .setColor(embedColor(7))
            .setFooter({ 
                iconURL: iconhost + 'resources/misc/auto.png', 
                text: `Chaos-Bot${userInfoFooter}` 
            });

        // Generar imágenes de perfil en Node.js (como PHP)
        const thumbnailBuffer = await generateProfileIcon(targetAccID);
        // Excluir el icono equipado del iconset porque ya se muestra como thumbnail
        const iconSetBuffer = await generateProfileIconSet(targetAccID, null, false, null, true);
        
        const files = [];
        if (thumbnailBuffer) {
            const thumbnailAttachment = new AttachmentBuilder(thumbnailBuffer, { name: 'thumbnail.png' });
            embed.setThumbnail('attachment://thumbnail.png');
            files.push(thumbnailAttachment);
        }
        if (iconSetBuffer) {
            const iconSetAttachment = new AttachmentBuilder(iconSetBuffer, { name: 'iconset.png' });
            embed.setImage('attachment://iconset.png');
            files.push(iconSetAttachment);
        }

        return {
            content: `<@${tagID}>, here is the profile of user **${userStats.userName}**:`,
            embeds: [embed],
            files: files
        };
    } catch (error) {
        console.error(`Error en buildProfileEmbed para accountID ${targetAccID}:`, error);
        // Retornar un mensaje de error en lugar de lanzar excepción
        return {
            content: `❌ Error al generar el perfil: ${error.message || 'Error desconocido'}`
        };
    }
}

async function executeProfile(interactionOrMessage, userName, authorId, channelId) {
    try {
        let targetAccID = null;

        // El usuario debe proporcionar userName
        if (!userName || userName.trim() === '') {
            const errorMsg = `<@${authorId}>, debes especificar un usuario. Usa \`/profile <nombreUsuario>\`.`;
            if (interactionOrMessage.isCommand?.()) {
                if (interactionOrMessage.deferred || interactionOrMessage.replied) {
                    await interactionOrMessage.editReply({ content: errorMsg });
                } else {
                    await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
                }
            } else {
                await interactionOrMessage.reply(errorMsg);
            }
            return;
        }

        // Buscar por userName o userID
        const userData = await db.queryOne(
            'SELECT extID FROM users WHERE userName = ? OR userID = ? LIMIT 1',
            [userName, userName]
        );

        if (!userData) {
            const errorMsg = `<@${authorId}>, Usuario no encontrado`;
            if (interactionOrMessage.isCommand?.()) {
                if (interactionOrMessage.deferred || interactionOrMessage.replied) {
                    await interactionOrMessage.editReply({ content: errorMsg });
                } else {
                    await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
                }
            } else {
                await interactionOrMessage.reply(errorMsg);
            }
            return;
        }

        targetAccID = userData.extID;

        // Verificar que existe la cuenta
        const accountCheck = await db.queryOne(
            'SELECT accountID FROM accounts WHERE accountID = ?',
            [targetAccID]
        );

        if (!accountCheck) {
            const errorMsg = `<@${authorId}>, Usuario no encontrado`;
            if (interactionOrMessage.isCommand?.()) {
                if (interactionOrMessage.deferred || interactionOrMessage.replied) {
                    await interactionOrMessage.editReply({ content: errorMsg });
                } else {
                    await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
                }
            } else {
                await interactionOrMessage.reply(errorMsg);
            }
            return;
        }

        // Construir y enviar el embed
        const messageData = await buildProfileEmbed(targetAccID, authorId);

        // Si buildProfileEmbed retorna solo content (sin embeds), significa que no se encontró el perfil
        if (messageData && messageData.content && !messageData.embeds) {
            if (interactionOrMessage.isCommand?.()) {
                if (interactionOrMessage.deferred || interactionOrMessage.replied) {
                    await interactionOrMessage.editReply({ content: messageData.content });
                } else {
                    await interactionOrMessage.reply({ content: messageData.content, flags: MessageFlags.Ephemeral });
                }
            } else {
                await interactionOrMessage.reply(messageData.content);
            }
            return;
        }

        if (interactionOrMessage.isCommand?.()) {
            // For deferred interactions, use editReply
            if (interactionOrMessage.deferred || interactionOrMessage.replied) {
                await interactionOrMessage.editReply(messageData);
            } else {
                await interactionOrMessage.reply(messageData);
            }
        } else {
            await interactionOrMessage.channel.send(messageData);
        }
    } catch (error) {
        console.error('Error en comando profile:', error);
        const errorMsg = `<@${authorId}>, Usuario no encontrado`;
        try {
            if (interactionOrMessage.isCommand?.()) {
                if (interactionOrMessage.deferred || interactionOrMessage.replied) {
                    await interactionOrMessage.editReply({ content: errorMsg });
                } else {
                    await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
                }
            } else {
                await interactionOrMessage.reply(errorMsg);
            }
        } catch (replyError) {
            console.error('Error al enviar mensaje de error:', replyError);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Muestra el perfil completo de un usuario del GDPS')
        .addStringOption(option =>
            option.setName('usuario')
                .setDescription('Nombre de usuario o UserID del GDPS')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply(); // Defer reply since image generation takes time
        const userName = interaction.options.getString('usuario') || '';
        await executeProfile(interaction, userName, interaction.user.id, interaction.channel.id);
    }
};
