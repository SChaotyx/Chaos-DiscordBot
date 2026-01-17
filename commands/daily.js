const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const { emojis, charCount, embedColor } = require('../utils/gdpsUtils');
const { generateLevelThumbnail, resourcesPath } = require('../utils/imageGenerator');
require('dotenv').config();

const hosting = process.env.HOSTING || 'http://localhost/';
const iconhost = hosting.endsWith('/') ? hosting : hosting + '/';

const officialSongs = [
    "Stereo Madness by ForeverBound", "Back on Track by DJVI", "Polargeist by Step",
    "Dry Out by DJVI", "Base after Base by DJVI", "Can't Let Go by DJVI",
    "Jumper by Waterflame", "Time Machine by Waterflame", "Cycles by DJVI",
    "xStep by DJVI", "Clutterfunk by Waterflame", "Theory of Everything by DJ Nate",
    "Electroman Adventures by Waterflame", "Club Step by DJ Nate", "Electrodynamix by DJ Nate",
    "Hexagon Force by Waterflame", "Blast Processing by Waterflame", "Theory of Everything 2 by DJ Nate",
    "Geometrical Dominator by Waterflame", "Deadlocked by F-777", "Fingerbang by MDK"
];

async function buildLevelEmbedCompact(levelID, tagID, title) {
    const level = await db.queryOne('SELECT * FROM levels WHERE levelID = ?', [levelID]);
    
    if (!level) return null;

    const levelName = level.levelName;
    const userName = level.userName;
    const coins = level.coins;
    const starCoins = level.starCoins;
    const downloads = level.downloads;
    const likes = level.likes;
    const levelLength = level.levelLength;
    const objects = level.objects;
    const original = level.original;
    const originalReup = level.originalReup;
    const audioTrack = level.audioTrack;
    const songID = level.songID;

    // Song Info
    let songDesc = "";
    if (songID == 0) {
        songDesc = `__**${officialSongs[audioTrack] || 'Unknown Song'}**__`;
    } else {
        const song = await db.queryOne('SELECT * FROM songs WHERE ID = ?', [songID]);
        if (song) {
            songDesc = `__${song.name}__ by ${song.authorName}`;
        } else {
            songDesc = "*unknown*";
        }
    }

    // Handle coins
    let coinsDisplay = "None";
    if (coins > 0) {
        const coinIcon = starCoins == 1 ? emojis.icon_verifycoins : emojis.icon_unverifycoins;
        coinsDisplay = coinIcon.repeat(coins) + " ";
    }

    const likeIcon = likes < 0 ? emojis.icon_dislike : emojis.icon_like;
    const lengthMap = ["TINY", "SHORT", "MEDIUM", "LONG", "XL"];
    const lengthText = lengthMap[levelLength] || "NA";
    const overObjectsIcon = objects > 40000 ? emojis.icon_objecto : "";
    let copyLevelIcon = "";
    if (original && original != 0) {
        copyLevelIcon = emojis.icon_copy;
    }

    const levelByCompact = `${emojis.icon_play} __${levelName}__ by ${userName} ${copyLevelIcon} ${overObjectsIcon}`;
    const stats = `${emojis.icon_download2} \`${charCount(downloads)}\` \n ${likeIcon} \`${charCount(likes)}\` \n ${emojis.icon_length} \`${charCount(lengthText)}\`\n`;
    const userCoinsDisplay = `Coins: ${coinsDisplay}`;
    const songDataDisplay = `:musical_note: ${songDesc}`;
    const levelInfoFooter = ` | Level ID: ${levelID}`;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .addFields(
            { name: levelByCompact, value: stats },
            { name: userCoinsDisplay, value: songDataDisplay }
        )
        .setColor(embedColor(7))
        .setFooter({ 
            iconURL: iconhost + 'resources/misc/auto.png', 
            text: `Chaos-Bot${levelInfoFooter}` 
        });
    
    // Generar thumbnail en Node.js (como PHP)
    const thumbnailBuffer = await generateLevelThumbnail(levelID);
    const files = [];
    if (thumbnailBuffer) {
        const thumbnailAttachment = new AttachmentBuilder(thumbnailBuffer, { name: 'thumbnail.png' });
        embed.setThumbnail('attachment://thumbnail.png');
        files.push(thumbnailAttachment);
    }

    return {
        content: `<@${tagID}>, here is the current Daily/Weekly level.`,
        embeds: [embed],
        files: files
    };
}

async function executeDaily(interactionOrMessage, authorId, channelId) {
    try {
        const current = Math.floor(Date.now() / 1000);
        
        // Buscar el daily actual (type = 0)
        const dailyData = await db.queryOne(
            'SELECT levelID FROM dailyfeatures WHERE timestamp < ? AND type = 0 ORDER BY timestamp DESC LIMIT 1',
            [current]
        );

        if (!dailyData) {
            const errorMsg = `<@${authorId}>, Nothing Found`;
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

        const levelID = dailyData.levelID;
        const messageData = await buildLevelEmbedCompact(levelID, authorId, `${emojis.icon_daily} Current Daily Level`);

        if (!messageData) {
            const errorMsg = `<@${authorId}>, Nothing Found`;
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

        if (interactionOrMessage.isCommand?.()) {
            if (interactionOrMessage.deferred || interactionOrMessage.replied) {
                await interactionOrMessage.editReply(messageData);
            } else {
                await interactionOrMessage.reply(messageData);
            }
        } else {
            await interactionOrMessage.channel.send(messageData);
        }
    } catch (error) {
        console.error('Error en comando daily:', error);
        const errorMsg = '❌ Error al buscar el daily.';
        if (interactionOrMessage.isCommand?.()) {
            if (interactionOrMessage.deferred || interactionOrMessage.replied) {
                await interactionOrMessage.editReply({ content: errorMsg });
            } else {
                await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
            }
        } else {
            interactionOrMessage.reply(errorMsg).catch(console.error);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Muestra el nivel Daily actual'),
    async execute(interaction) {
        await interaction.deferReply(); // Defer reply since image generation takes time
        await executeDaily(interaction, interaction.user.id, interaction.channel.id);
    }
};
