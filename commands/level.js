const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const { emojis, charCount, embedColor } = require('../utils/gdpsUtils');
const { generateLevelThumbnail, resourcesPath } = require('../utils/imageGenerator');
require('dotenv').config();

const hosting = process.env.HOSTING || 'http://localhost/';
const iconhost = hosting.endsWith('/') ? hosting : hosting + '/';

// Official songs list (same as in PHP)
const officialSongs = [
    "Stereo Madness by ForeverBound", "Back on Track by DJVI", "Polargeist by Step",
    "Dry Out by DJVI", "Base after Base by DJVI", "Can't Let Go by DJVI",
    "Jumper by Waterflame", "Time Machine by Waterflame", "Cycles by DJVI",
    "xStep by DJVI", "Clutterfunk by Waterflame", "Theory of Everything by DJ Nate",
    "Electroman Adventures by Waterflame", "Club Step by DJ Nate", "Electrodynamix by DJ Nate",
    "Hexagon Force by Waterflame", "Blast Processing by Waterflame", "Theory of Everything 2 by DJ Nate",
    "Geometrical Dominator by Waterflame", "Deadlocked by F-777", "Fingerbang by MDK"
];

async function buildLevelEmbed(levelID, tagID) {
    // Get level data
    const level = await db.queryOne('SELECT * FROM levels WHERE levelID = ?', [levelID]);
    
    if (!level) {
        return null;
    }

    const levelName = level.levelName;
    const userName = level.userName;
    const levelDesc = level.levelDesc;
    const desc = levelDesc ? Buffer.from(levelDesc, 'base64').toString('utf-8') : ' No description provided ';
    const coins = level.coins;
    const starCoins = level.starCoins;
    const downloads = level.downloads;
    const likes = level.likes;
    const levelLength = level.levelLength;
    const levelVersion = level.levelVersion;
    const objects = level.objects;
    const requestedStars = level.requestedStars;
    const original = level.original;
    const originalReup = level.originalReup;
    const audioTrack = level.audioTrack;
    const songID = level.songID;

    // Calculate CP (simplified - would need mainLib's calculateLevelCP in PHP)
    const cpCount = 0; // Placeholder

    // Song Info
    let songInfo = "";
    let songDesc = "";
    if (songID == 0) {
        songDesc = `__**${officialSongs[audioTrack] || 'Unknown Song'}**__`;
    } else {
        const song = await db.queryOne('SELECT * FROM songs WHERE ID = ?', [songID]);
        if (song) {
            songDesc = `__${song.name}__ by ${song.authorName}`;
            songInfo = `SongID: ${songID} - Size: ${song.size}MB`;
            if (songID < 5000000) {
                songInfo += `\n${emojis.icon_play}[Play on Newgrounds](https://www.newgrounds.com/audio/listen/${songID})`;
            }
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

    // Set like/dislike icon
    const likeIcon = likes < 0 ? emojis.icon_dislike : emojis.icon_like;

    // Level Length
    const lengthMap = ["TINY", "SHORT", "MEDIUM", "LONG", "XL"];
    const lengthText = lengthMap[levelLength] || "NA";

    // +40K objects icon
    const overObjectsIcon = objects > 40000 ? emojis.icon_objecto : "";

    // Copy level indicator
    let copyLevelText = "";
    let copyLevelIcon = "";
    if (original && original != 0) {
        if (original == 1) {
            copyLevelText = `${emojis.icon_copy}**Original Reupload:** ${originalReup}`;
        } else {
            copyLevelText = `${emojis.icon_copy}**Original:** ${original}`;
        }
        copyLevelIcon = emojis.icon_copy;
    }

    const cpCountStr = cpCount != 0 ? `${emojis.icon_cp} \`${charCount(cpCount)}\`\n` : "";

    // Prepare display strings (embed type 6 - Full with user tag)
    const levelBy = `${emojis.icon_play} __${levelName}__ by ${userName}`;
    const description = `**Description:** ${desc}`;
    const userCoinsDisplay = `Coins: ${coinsDisplay}`;
    const stats = `${emojis.icon_download2} \`${charCount(downloads)}\` \n ${likeIcon} \`${charCount(likes)}\` \n ${emojis.icon_length} \`${charCount(lengthText)}\`\n${cpCountStr}───────────────────\n`;
    const songDataDisplay = `:musical_note: ${songDesc}`;
    const extraInfoDisplay = `${songInfo} \n───────────────────\n**Level ID:** ${levelID} \n**Level Version:** ${levelVersion} \n**Objects count:** ${objects} ${overObjectsIcon} \n**Stars requested:** ${requestedStars} \n${copyLevelText}`;
    const levelInfoFooter = ` | Level ID: ${levelID}`;

    const embed = new EmbedBuilder()
        .setTitle(`${emojis.icon_search} Search result.`)
        .addFields(
            { name: levelBy, value: description },
            { name: userCoinsDisplay, value: stats },
            { name: songDataDisplay, value: extraInfoDisplay }
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
        content: `<@${tagID}>, here is the result of your search.`,
        embeds: [embed],
        files: files
    };
}

async function executeLevel(interactionOrMessage, level, authorId, channelId) {
    try {
        if (!level || level.trim() === '') {
            const errorMsg = `<@${authorId}>, The server did not receive data`;
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

        // Buscar level por nombre o ID
        const levelData = await db.queryOne(
            'SELECT levelID FROM levels WHERE levelName = ? OR levelID = ? LIMIT 1',
            [level, level]
        );

        if (!levelData) {
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

        const levelID = levelData.levelID;

        // Construir y enviar el embed
        const messageData = await buildLevelEmbed(levelID, authorId);

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
        console.error('Error en comando level:', error);
        const errorMsg = '❌ Error al buscar el nivel.';
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
        .setName('level')
        .setDescription('Busca información de un nivel por nombre o ID')
        .addStringOption(option =>
            option.setName('nivel')
                .setDescription('Nombre o ID del nivel')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply(); // Defer reply since image generation takes time
        const level = interaction.options.getString('nivel');
        await executeLevel(interaction, level, interaction.user.id, interaction.channel.id);
    }
};
