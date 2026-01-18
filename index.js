const { Client, GatewayIntentBits, Collection, Events, REST, Routes, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config();

// Crear servidor HTTP simple para health check (permite que cron jobs externos mantengan activo el bot)
function startHealthCheckServer() {
    const PORT = process.env.PORT || 3000;
    
    const server = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'OK', 
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            }));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });
    
    server.listen(PORT, () => {
        console.log(`🌐 Health check server running on port ${PORT}`);
        console.log(`📍 Endpoint disponible: /health`);
    });
    
    return server;
}

// Crear el cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Colección de comandos slash
client.slashCommands = new Collection();

// Cargar comandos
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

console.log('-----------Cargando comandos slash.-----------');
const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Solo registrar comandos que tengan definición de slash command
    if ('data' in command && 'execute' in command) {
        client.slashCommands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`✓ Slash command ${command.data.name} registrado`);
    } else {
        console.log(`⚠ El comando en ${filePath} no tiene la definición de slash command requerida.`);
    }
}

// Evento: Bot listo
client.once(Events.ClientReady, async () => {
    console.log('\n✅ CONECTADO.');
    console.log(`🤖 Bot: ${client.user.tag}`);
    console.log(`📊 Servidores: ${client.guilds.cache.size}`);
    console.log(`🔧 Slash commands: ${client.slashCommands.size}\n`);
    
    // Registrar slash commands
    if (commands.length > 0) {
        const rest = new REST().setToken(process.env.BOT_TOKEN);
        
        try {
            console.log(`🔄 Registrando ${commands.length} slash command(s)...`);
            
            // Si hay GUILD_ID en .env, usar comandos de servidor (aparecen inmediatamente)
            // Si no, usar comandos globales (pueden tardar hasta 1 hora)
            const guildId = process.env.GUILD_ID;
            
            let data;
            if (guildId) {
                console.log(`📌 Registrando comandos en servidor específico (ID: ${guildId})...`);
                
                // Eliminar comandos globales si existen para evitar duplicados
                try {
                    const globalCommands = await rest.get(Routes.applicationCommands(client.user.id));
                    if (globalCommands && globalCommands.length > 0) {
                        console.log(`🗑️ Eliminando ${globalCommands.length} comando(s) global(es) para evitar duplicados...`);
                        for (const cmd of globalCommands) {
                            await rest.delete(Routes.applicationCommand(client.user.id, cmd.id));
                        }
                    }
                } catch (err) {
                    // Ignorar errores al eliminar comandos globales
                }
                
                data = await rest.put(
                    Routes.applicationGuildCommands(client.user.id, guildId),
                    { body: commands }
                );
                console.log(`✅ ${data.length} slash command(s) registrado(s) en el servidor.\n`);
            } else {
                console.log(`🌐 Registrando comandos globalmente (puede tardar hasta 1 hora en aparecer)...`);
                
                // Eliminar comandos de guild si existen para evitar duplicados
                try {
                    const guilds = client.guilds.cache;
                    for (const [guildIdValue, guild] of guilds) {
                        const guildCommands = await rest.get(Routes.applicationGuildCommands(client.user.id, guildIdValue));
                        if (guildCommands && guildCommands.length > 0) {
                            console.log(`🗑️ Eliminando ${guildCommands.length} comando(s) del servidor ${guildIdValue}...`);
                            for (const cmd of guildCommands) {
                                await rest.delete(Routes.applicationGuildCommand(client.user.id, guildIdValue, cmd.id));
                            }
                        }
                    }
                } catch (err) {
                    // Ignorar errores al eliminar comandos de guild
                }
                
                data = await rest.put(
                    Routes.applicationCommands(client.user.id),
                    { body: commands }
                );
                console.log(`✅ ${data.length} slash command(s) registrado(s) globalmente.\n`);
                console.log(`💡 Tip: Agrega GUILD_ID en .env para registro inmediato por servidor.`);
            }
        } catch (error) {
            console.error('❌ Error al registrar slash commands:', error);
        }
    }
    
    // Establecer actividad
    client.user.setActivity(`Usa /help para ver comandos`, { type: 0 }); // PLAYING
    
    // Enviar mensaje de conexión al canal de log (si está configurado)
    if (process.env.CHANNEL_LOG) {
        client.channels.cache.get(process.env.CHANNEL_LOG)?.send('```Conectado.```').catch(console.error);
    }
});

// Manejo de interacciones (slash commands)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    const command = client.slashCommands.get(interaction.commandName);
    
    if (!command) {
        console.error(`No se encontró el comando: ${interaction.commandName}`);
        return;
    }
    
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error ejecutando slash command ${interaction.commandName}:`, error);
        
        const errorMessage = { content: '❌ Hubo un error al ejecutar este comando.', flags: MessageFlags.Ephemeral };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Manejo de errores
client.on(Events.Error, error => {
    console.error('Error del cliente:', error);
});

process.on('unhandledRejection', error => {
    console.error('Error no manejado:', error);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n⚠️ Recibida señal SIGINT, cerrando bot...');
    const db = require('./utils/database');
    await db.closePool().catch(console.error);
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⚠️ Recibida señal SIGTERM, cerrando bot...');
    const db = require('./utils/database');
    await db.closePool().catch(console.error);
    client.destroy();
    process.exit(0);
});

// Validar variables de entorno antes de iniciar
function validateEnvironment() {
    const required = ['BOT_TOKEN', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ ERROR: Variables de entorno faltantes:', missing.join(', '));
        console.error('📝 Verifica tu archivo .env y asegúrate de tener todas las variables necesarias.');
        process.exit(1);
    }
    
    // Validar formato del token (aproximado)
    if (process.env.BOT_TOKEN && process.env.BOT_TOKEN.length < 50) {
        console.warn('⚠️ ADVERTENCIA: El BOT_TOKEN parece ser inválido (muy corto)');
    }
}

// Iniciar bot
async function startBot() {
    validateEnvironment();
    
    // Iniciar servidor HTTP para health check (necesario para cron jobs externos)
    startHealthCheckServer();
    
    // Probar conexión a la base de datos
    const db = require('./utils/database');
    console.log('🔌 Probando conexión a la base de datos...');
    const dbConnected = await db.testConnection();
    
    if (!dbConnected) {
        console.error('❌ ERROR: No se pudo conectar a la base de datos. Verifica las credenciales en .env');
        process.exit(1);
    }
    
    console.log('✅ Conexión a la base de datos establecida correctamente\n');
    
    // Conectar bot a Discord
    try {
        await client.login(process.env.BOT_TOKEN);
    } catch (error) {
        console.error('❌ ERROR: No se pudo conectar el bot a Discord:', error.message);
        await db.closePool().catch(console.error);
        process.exit(1);
    }
}

startBot();
