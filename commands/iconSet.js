const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const { emojis } = require('../utils/gdpsUtils');
const { generateProfileIconSet } = require('../utils/imageGenerator');
const { getIconLimits } = require('../utils/iconLimits');
require('dotenv').config();

const hosting = process.env.HOSTING || 'http://localhost/';
const iconhost = hosting.endsWith('/') ? hosting : hosting + '/';

/**
 * Genera valores aleatorios para iconos, colores y glow
 * Usa los límites reales de IDs disponibles para cada tipo
 * @param {boolean} includeJetpack - Si incluir el jetpack (tipo 8)
 */
function generateRandomIconSet(includeJetpack = false) {
    // Obtener límites reales de IDs disponibles para cada tipo
    const limits = getIconLimits();
    
    // Include all types (0-7), and 8 only if includeJetpack is true
    // Asegurar que los límites sean al menos 1 para evitar errores
    const accs = {
        0: Math.floor(Math.random() * Math.max(1, limits[0])) + 1, // player
        1: Math.floor(Math.random() * Math.max(1, limits[1])) + 1, // ship
        2: Math.floor(Math.random() * Math.max(1, limits[2])) + 1, // ball
        3: Math.floor(Math.random() * Math.max(1, limits[3])) + 1, // bird
        4: Math.floor(Math.random() * Math.max(1, limits[4])) + 1, // dart
        5: Math.floor(Math.random() * Math.max(1, limits[5])) + 1, // robot
        6: Math.floor(Math.random() * Math.max(1, limits[6])) + 1, // spider
        7: Math.floor(Math.random() * Math.max(1, limits[7])) + 1  // swing
    };
    
    // Include jetpack only if requested
    if (includeJetpack) {
        accs[8] = Math.floor(Math.random() * Math.max(1, limits[8])) + 1; // jetpack
    }
    
    // Random colors (assuming color IDs go from 0 to ~50)
    const color1 = Math.floor(Math.random() * 50);
    const color2 = Math.floor(Math.random() * 50);
    const color3 = Math.floor(Math.random() * 50);
    
    // Random glow (true/false)
    const glow = Math.random() > 0.5;
    
    // Random icon type (0-7, or 0-8 if includeJetpack)
    const maxType = includeJetpack ? 8 : 7;
    const iconType = Math.floor(Math.random() * (maxType + 1));
    
    return {
        accs,
        color1,
        color2,
        color3,
        glow,
        iconType
    };
}

async function executeIconSet(interaction, userName, includeJetpack) {
    try {
        await interaction.deferReply(); // Defer reply since image generation takes time
        
        let iconSetBuffer = null;
        
        if (!userName || userName.trim() === '') {
            // Generate random icon set with all types (except jetpack unless includeJetpack is true)
            const randomParams = generateRandomIconSet(includeJetpack);
            iconSetBuffer = await generateProfileIconSet(null, null, includeJetpack, randomParams);
        } else {
            // Get user data
            const userData = await db.queryOne(
                'SELECT extID FROM users WHERE userName = ? OR userID = ? LIMIT 1',
                [userName, userName]
            );

            if (!userData) {
                const errorMsg = `<@${interaction.user.id}>, usuario no encontrado.`;
                await interaction.editReply({ content: errorMsg });
                return;
            }

            const targetAccID = userData.extID;

            // Verify account exists
            const accountCheck = await db.queryOne(
                'SELECT accountID FROM accounts WHERE accountID = ?',
                [targetAccID]
            );

            if (!accountCheck) {
                const errorMsg = `<@${interaction.user.id}>, usuario no encontrado.`;
                await interaction.editReply({ content: errorMsg });
                return;
            }

            iconSetBuffer = await generateProfileIconSet(targetAccID, null, includeJetpack);
        }

        if (!iconSetBuffer) {
            const errorMsg = `<@${interaction.user.id}>, error al generar el icon set.`;
            await interaction.editReply({ content: errorMsg });
            return;
        }

        // Embed solo con la imagen, sin título, descripción ni footer
        const embed = new EmbedBuilder();
        const iconSetAttachment = new AttachmentBuilder(iconSetBuffer, { name: 'iconset.png' });
        embed.setImage('attachment://iconset.png');

        await interaction.editReply({
            embeds: [embed],
            files: [iconSetAttachment]
        });
    } catch (error) {
        console.error('Error en comando iconSet:', error);
        const errorMsg = '❌ Error al generar el icon set.';
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMsg });
            } else {
                await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
            }
        } catch (replyError) {
            console.error('Error al responder:', replyError);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('iconset')
        .setDescription('Muestra el conjunto de iconos de un usuario (sin jetpack)')
        .addStringOption(option =>
            option.setName('usuario')
                .setDescription('Nombre de usuario o UserID del GDPS (dejar vacío para aleatorio)')
                .setRequired(false)),
    async execute(interaction) {
        const userName = interaction.options.getString('usuario') || '';
        await executeIconSet(interaction, userName, false);
    }
};
