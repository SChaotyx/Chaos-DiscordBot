const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

async function executeHelp(interaction, cmdarg) {
    // Defer reply since we're loading files
    let deferred = false;
    if (interaction.isCommand?.()) {
        await interaction.deferReply();
        deferred = true;
    }
    const hosting = process.env.HOSTING || 'http://localhost/';
    const embed = new EmbedBuilder();
    const resourcesPath = path.join(__dirname, '../resources');
    const files = [];
    
    const commandsPath = path.join(__dirname);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    if (!cmdarg) {
        // Mostrar todos los comandos
        embed.setTitle('📚 Comandos Disponibles');
        
        // Cargar thumbnail como attachment
        const thumbnailPath = path.join(resourcesPath, 'misc/gdps.png');
        if (fs.existsSync(thumbnailPath)) {
            const thumbnailBuffer = fs.readFileSync(thumbnailPath);
            const thumbnailAttachment = new AttachmentBuilder(thumbnailBuffer, { name: 'gdps.png' });
            embed.setThumbnail('attachment://gdps.png');
            files.push(thumbnailAttachment);
        }
        
        embed.setFooter({ 
            text: 'Chaos-Bot v2.0.0',
            iconURL: `${hosting}resources/misc/gdpsbot.png` // iconURL no soporta attachments
        });
        embed.setTimestamp();
        
        embed.addFields({
            name: '───────────────────',
            value: `**Slash Commands:** Usa \`/\` para ver comandos\n**Usa:** \`/help <Comando>\` para ver información detallada.\n───────────────────`
        });
        
        const commandInfo = {
            'profile': `\`/profile [usuario]\`\nMuestra el perfil completo de un usuario`,
            'account': `\`/account [usuario]\`\nInformación detallada de cuentas registradas`,
            'level': `\`/level <nivel>\`\nBusca información de un nivel`,
            'daily': `\`/daily\`\nMuestra el nivel diario actual`,
            'weekly': `\`/weekly\`\nMuestra el nivel semanal actual`,
            'stats': `\`/stats\`\nMuestra las estadísticas generales del GDPS`,
            'top': `\`/top [tipo]\`\nTop 20 jugadores (stars, demons, diamonds, etc.)`,
            'modlist': `\`/modlist\`\nMuestra la lista de moderadores`,
            'ping': `\`/ping\`\nMuestra la latencia del bot`,
            'help': `\`/help [comando]\`\nMuestra esta ayuda`
        };
        
        commandFiles.forEach(file => {
            if (file.endsWith('.js') && file !== 'help.js') {
                const commandName = file.split('.')[0];
                if (commandInfo[commandName]) {
                    embed.addFields({
                        name: `📝 ${commandName}`,
                        value: commandInfo[commandName],
                        inline: false
                    });
                }
            }
        });
        
        const content = `<@${interaction.user.id}>, vista general de todos los comandos disponibles.`;
        if (deferred) {
            await interaction.editReply({ content, embeds: [embed], files: files });
        } else {
            await interaction.reply({ content, embeds: [embed], files: files });
        }
    } else {
        // Mostrar información de un comando específico
        const commandName = cmdarg.toLowerCase();
        const commandFile = interaction.client.slashCommands?.get(commandName);
        
        if (commandFile) {
            embed.setTitle(`📝 Comando: ${commandName}`);
            
            // Cargar thumbnail como attachment
            const thumbnailPath = path.join(resourcesPath, 'misc/gdps.png');
            const helpFiles = [];
            if (fs.existsSync(thumbnailPath)) {
                const thumbnailBuffer = fs.readFileSync(thumbnailPath);
                const thumbnailAttachment = new AttachmentBuilder(thumbnailBuffer, { name: 'gdps.png' });
                embed.setThumbnail('attachment://gdps.png');
                helpFiles.push(thumbnailAttachment);
            }
            
            embed.setTimestamp();
            
            const commandDescriptions = {
                'profile': `**Uso:** \`/profile [usuario]\`\n**Descripción:** Muestra el perfil completo de un usuario del GDPS, incluyendo estadísticas, rango y más información.`,
                'account': `**Uso:** \`/account [usuario]\`\n**Descripción:** Muestra información detallada de una cuenta registrada, incluyendo fecha de registro, email y más información.`,
                'level': `**Uso:** \`/level <nivel>\`\n**Descripción:** Busca y muestra información detallada de un nivel, incluyendo creador, dificultad, estrellas, descargas y más.`,
                'daily': `**Uso:** \`/daily\`\n**Descripción:** Muestra el nivel diario actual del GDPS con toda su información.`,
                'weekly': `**Uso:** \`/weekly\`\n**Descripción:** Muestra el nivel semanal actual del GDPS con toda su información.`,
                'stats': `**Uso:** \`/stats\`\n**Descripción:** Muestra las estadísticas generales del servidor, incluyendo usuarios, niveles, canciones y más.`,
                'top': `**Uso:** \`/top [tipo]\`\n**Descripción:** Muestra el top 20 jugadores según el tipo especificado.\n**Tipos disponibles:** stars, demons, creatorPoints, userCoins, coins, diamonds`,
                'modlist': `**Uso:** \`/modlist\`\n**Descripción:** Muestra la lista completa de moderadores del servidor, organizados por rango.`,
                'ping': `**Uso:** \`/ping\`\n**Descripción:** Muestra la latencia del bot y de la API de Discord.`
            };
            
            embed.setDescription(commandDescriptions[commandName] || 'No hay información detallada disponible para este comando.');
            
            const content = `<@${interaction.user.id}> Comando ${commandName}`;
            if (deferred) {
                await interaction.editReply({ content, embeds: [embed], files: helpFiles });
            } else {
                await interaction.reply({ content, embeds: [embed], files: helpFiles });
            }
        } else {
            const errorMsg = `<@${interaction.user.id}>, el comando \`${commandName}\` no existe. Usa \`/help\` para ver todos los comandos disponibles.`;
            if (deferred) {
                await interaction.editReply({ content: errorMsg, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: errorMsg, flags: MessageFlags.Ephemeral });
            }
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Muestra la ayuda de los comandos disponibles')
        .addStringOption(option =>
            option.setName('comando')
                .setDescription('Nombre del comando para ver información detallada')
                .setRequired(false)),
    async execute(interaction) {
        const cmdarg = interaction.options.getString('comando') || '';
        await executeHelp(interaction, cmdarg);
    }
};
