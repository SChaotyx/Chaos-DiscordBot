const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

async function executePing(interactionOrMessage, client) {
    let sent;
    let timeDiff;
    
    if (interactionOrMessage.isCommand?.()) {
        const startTime = Date.now();
        await interactionOrMessage.reply({ content: '🏓 Calculando...' });
        const endTime = Date.now();
        timeDiff = endTime - startTime;
    } else {
        sent = await interactionOrMessage.channel.send('🏓 Calculando...');
        timeDiff = sent.createdTimestamp - interactionOrMessage.createdTimestamp;
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('🏓 Pong!')
        .addFields(
            {
                name: '⏱️ Latencia del Bot',
                value: `${timeDiff}ms`,
                inline: true
            },
            {
                name: '💓 Latencia de la API',
                value: `${Math.round(client.ws.ping)}ms`,
                inline: true
            }
        )
        .setTimestamp();
    
    if (interactionOrMessage.isCommand?.()) {
        await interactionOrMessage.editReply({ content: null, embeds: [embed] });
    } else {
        sent.edit({ content: null, embeds: [embed] });
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Muestra la latencia del bot y de la API de Discord'),
    async execute(interaction) {
        await executePing(interaction, interaction.client);
    }
};
