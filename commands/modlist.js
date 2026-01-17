const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const { emojis, embedColor } = require('../utils/gdpsUtils');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const hosting = process.env.HOSTING || 'http://localhost/';
const iconhost = hosting.endsWith('/') ? hosting : hosting + '/';
const resourcesPath = path.join(__dirname, '../resources');

async function executeModlist(interactionOrMessage, authorId, channelId) {
    try {
        const moddata = await db.query('SELECT * FROM roleassign ORDER BY roleID DESC');

        if (!moddata || moddata.length === 0) {
            const errorMsg = `<@${authorId}>, Nothing Found`;
            if (interactionOrMessage.isCommand?.()) {
                await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
            } else {
                await interactionOrMessage.reply(errorMsg);
            }
            return;
        }

        // Nuevos rangos: public -> moderator -> headmoderator -> eldermod -> admin
        // public no tiene roleID (no se muestra en modlist)
        // roleID 1 = demoted (demoteados)
        // roleID 2 = moderator
        // roleID 3 = headmoderator
        // roleID 4 = eldermod
        // roleID 5 = admin
        let demotedlist = "";
        let modelist = "";
        let headmoderatorlist = "";
        let eldermodlist = "";
        let adminlist = "";

        for (const mod of moddata) {
            const accountData = await db.queryOne(
                'SELECT userName FROM accounts WHERE accountID = ?',
                [mod.accountID]
            );
            
            if (!accountData) continue;

            const userName = accountData.userName;
            const modlist = `\`─\` ${emojis.icon_modstar}  \`${userName}\`\n`;
            
            switch(mod.roleID) {
                case 1: // demoted
                    demotedlist += modlist;
                    break;
                case 2: // moderator
                    modelist += modlist;
                    break;
                case 3: // headmoderator
                    headmoderatorlist += modlist;
                    break;
                case 4: // eldermod
                    eldermodlist += modlist;
                    break;
                case 5: // admin
                    adminlist += modlist;
                    break;
                // roleID 0, 6, 7 no se muestran según la nueva estructura
            }
        }

        const demoted = demotedlist ? `${emojis.icon_brokenmodstar} **Demoted:**\n${demotedlist}──────────\n` : "";
        const mode = modelist ? `${emojis.icon_mod} **Moderators:**\n${modelist}` : "";
        const headmod = headmoderatorlist ? `${emojis.icon_head} **Head Moderators:**\n${headmoderatorlist}──────────\n` : "";
        const eldermod = eldermodlist ? `${emojis.icon_elder} **Elder Moderators:**\n${eldermodlist}──────────\n` : "";
        const admin = adminlist ? `${emojis.icon_admin} **Admin:**\n${adminlist}──────────\n` : "";

        // Orden: admin (mayor) -> eldermod -> headmoderator -> moderator -> demoted (menor)
        const lel = `───────────────────\n${admin}${eldermod}${headmod}${mode}${demoted}───────────────────`;

        const now = new Date();
        const embed = new EmbedBuilder()
            .setTitle(`<a:Mod:536710033589665803> __Moderator List.__`)
            .setDescription(lel)
            .setFooter({ text: now.toISOString().slice(0, 19).replace('T', ' ') });
        
        // Cargar thumbnail como attachment
        const thumbnailPath = path.join(resourcesPath, 'misc/gdpsthumb.png');
        const files = [];
        if (fs.existsSync(thumbnailPath)) {
            const thumbnailBuffer = fs.readFileSync(thumbnailPath);
            const thumbnailAttachment = new AttachmentBuilder(thumbnailBuffer, { name: 'gdpsthumb.png' });
            embed.setThumbnail('attachment://gdpsthumb.png');
            files.push(thumbnailAttachment);
        }

        const content = `<@${authorId}>, here the full list of moderators in the GDPS`;

        if (interactionOrMessage.isCommand?.()) {
            await interactionOrMessage.reply({ content, embeds: [embed], files: files });
        } else {
            await interactionOrMessage.channel.send({ content, embeds: [embed], files: files });
        }
    } catch (error) {
        console.error('Error en comando modlist:', error);
        const errorMsg = '❌ Error al obtener la lista de moderadores.';
        if (interactionOrMessage.isCommand?.()) {
            await interactionOrMessage.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
        } else {
            interactionOrMessage.reply(errorMsg).catch(console.error);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modlist')
        .setDescription('Muestra la lista completa de moderadores del GDPS'),
    async execute(interaction) {
        await executeModlist(interaction, interaction.user.id, interaction.channel.id);
    }
};
