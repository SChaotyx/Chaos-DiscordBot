# 🤖 Bot de Discord - Chaos GDPS v2.0

Bot de Discord independiente para el servidor Chaos GDPS. Versión moderna con soporte para discord.js v14, comandos slash y generación de imágenes en Node.js.

Este es un proyecto independiente que puede ejecutarse por separado del servidor GDPS principal. Solo requiere acceso a la base de datos MySQL del GDPS.

## 📋 Requisitos

- Node.js 18.0.0 o superior
- npm o yarn
- Token de bot de Discord
- Acceso a la base de datos MySQL del GDPS

## 🚀 Instalación

1. **Navegar a la carpeta del bot:**
   ```bash
   cd Chaos-DiscordBot
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   - Copia el archivo `config.example.txt` y renómbralo a `.env`
   - Edita el archivo `.env` con tus credenciales:
     ```env
     BOT_TOKEN=tu_token_de_discord
     HOSTING=http://tu-dominio.com/
     DB_HOST=localhost
     DB_USER=usuario
     DB_PASSWORD=contraseña
     DB_NAME=nombre_base_datos
     CHANNEL_LOG=  # Opcional: ID del canal para logs
     GUILD_ID=  # Opcional: ID del servidor para registro inmediato de comandos
     ```

4. **Obtener el token del bot:**
   - Ve a [Discord Developer Portal](https://discord.com/developers/applications)
   - Crea una nueva aplicación o selecciona una existente
   - Ve a la sección "Bot" y crea un bot
   - Copia el token y pégalo en `.env`

5. **Invitar el bot a tu servidor:**
   - En Discord Developer Portal, ve a "OAuth2" > "URL Generator"
   - Selecciona los scopes: `bot` y `applications.commands`
   - Selecciona los permisos necesarios: `Send Messages`, `Read Message History`, `Embed Links`, `Attach Files`
   - Copia la URL generada y ábrela en tu navegador para invitar el bot

## ▶️ Ejecución

**Modo producción:**
```bash
npm start
```

**Modo desarrollo (con auto-reload):**
```bash
npm run dev
```

## 📝 Comandos Disponibles

Todos los comandos son **slash commands** (usa `/` para ver la lista):

### 👤 Usuario
- `/profile [usuario]` - Perfil completo de usuario con estadísticas, rango e iconos
- `/account [usuario]` - Información detallada de cuenta registrada

### 📊 Estadísticas
- `/stats` - Estadísticas generales del servidor
- `/top [tipo]` - Top 20 jugadores (stars, demons, creatorPoints, userCoins, coins, diamonds)
- `/daily` - Nivel diario actual con thumbnail
- `/weekly` - Nivel semanal actual con thumbnail

### 🔍 Búsqueda
- `/level <nivel>` - Información detallada de un nivel con thumbnail de dificultad

### 👮 Moderación
- `/modlist` - Lista de moderadores organizados por rango

### ℹ️ Utilidades
- `/help [comando]` - Lista de comandos o información detallada de un comando
- `/ping` - Latencia del bot y de la API de Discord

## 🛠️ Estructura del Proyecto

```
discord-bot/
├── commands/              # Comandos slash del bot
│   ├── profile.js        # Perfil de usuario con iconos generados
│   ├── account.js        # Información de cuenta
│   ├── level.js          # Información de nivel con thumbnails
│   ├── stats.js          # Estadísticas del servidor
│   ├── daily.js          # Nivel diario
│   ├── weekly.js         # Nivel semanal
│   ├── top.js            # Leaderboard
│   ├── modlist.js        # Lista de moderadores
│   ├── help.js           # Ayuda
│   └── ping.js           # Latencia
├── utils/                # Utilidades
│   ├── database.js       # Conexión a MySQL
│   ├── gdpsUtils.js      # Utilidades del GDPS (formato, colores, etc.)
│   └── imageGenerator.js # Generación de imágenes (thumbnails, iconos)
├── resources/            # Recursos del bot
│   ├── misc/            # Imágenes misceláneas (logos, thumbnails)
│   ├── buttons/         # Imágenes de botones
│   ├── icons/           # Sprites de iconos del juego (.plist y .png)
│   ├── colors.json      # Paleta de colores para tinting
│   ├── diff*.png        # Caras de dificultad
│   ├── demon*.png       # Caras de demonios
│   ├── str*.png         # Imágenes de estrellas
│   └── rate*.png        # Ratings (featured, epic, legendary, mythic)
├── index.js             # Archivo principal
├── package.json         # Dependencias
├── .env                 # Variables de entorno (no incluido en git)
└── README.md            # Este archivo
```

## 🔧 Funcionalidades Técnicas

### Generación de Imágenes

El bot genera imágenes dinámicamente en Node.js usando `canvas`:

- **Thumbnails de niveles**: Combina rating (featured/epic/legendary/mythic), cara de dificultad y estrellas
- **Iconos de usuario**: Genera iconos de perfil desde sprites del juego con tinting de colores
- **Conjuntos de iconos**: Muestra todos los iconos de un usuario (ship, ball, bird, etc.)

Todas las imágenes se envían como attachments (no URLs) para garantizar su visualización.

### Conexión Directa a MySQL

El bot accede directamente a la base de datos MySQL del GDPS, sin necesidad de proxy PHP:

- Conexión mediante `mysql2/promise`
- Consultas optimizadas para cada comando
- Manejo de errores y reconexión automática

### Comandos Slash

Todos los comandos usan el sistema de slash commands de Discord:

- Registro automático al iniciar el bot
- Soporte para comandos globales o por servidor (configurable con `GUILD_ID`)
- Validación y autocompletado integrado

### Manejo de Interacciones

- Los comandos que cargan archivos o generan imágenes usan `deferReply()` para evitar timeouts
- Mensajes efímeros usando `MessageFlags.Ephemeral` (recomendado por Discord.js v14)
- Manejo robusto de errores con respuestas apropiadas

## ➕ Agregar Nuevos Comandos

1. Crea un nuevo archivo en la carpeta `commands/`

2. Usa esta estructura:

```javascript
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nombre')
        .setDescription('Descripción del comando')
        .addStringOption(option =>
            option.setName('parametro')
                .setDescription('Descripción del parámetro')
                .setRequired(true)),
    async execute(interaction) {
        // Defer reply si el comando puede tardar
        await interaction.deferReply();
        
        try {
            // Tu lógica aquí
            const resultado = await db.queryOne('SELECT * FROM tabla WHERE campo = ?', [valor]);
            
            const embed = new EmbedBuilder()
                .setTitle('Título')
                .setDescription('Descripción')
                .setColor(0x00AE86);
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply({ content: '❌ Error al ejecutar el comando.' });
        }
    }
};
```

3. El bot cargará automáticamente el comando al reiniciarse

## 🔧 Configuración Avanzada

### Base de Datos

Configura las credenciales de MySQL en `.env`:
- `DB_HOST`: Host de la base de datos (por defecto: localhost)
- `DB_USER`: Usuario de MySQL
- `DB_PASSWORD`: Contraseña de MySQL
- `DB_NAME`: Nombre de la base de datos

### Comandos Globales vs. Servidor

- **Sin `GUILD_ID`**: Los comandos se registran globalmente (pueden tardar hasta 1 hora en aparecer)
- **Con `GUILD_ID`**: Los comandos se registran solo en ese servidor (aparecen inmediatamente)

### Canal de Log

Configura `CHANNEL_LOG` con el ID del canal donde quieres recibir logs de errores y actividad. Si lo dejas vacío, no se enviarán logs.

## 🐛 Solución de Problemas

### El bot no responde
- Verifica que el token en `.env` sea correcto (`BOT_TOKEN`)
- Asegúrate de que el bot tenga permisos para leer y enviar mensajes, y adjuntar archivos
- Revisa la consola para ver errores

### Error de conexión a la base de datos
- Verifica que `DB_HOST`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` sean correctos
- Asegúrate de que MySQL esté corriendo y accesible
- Verifica que el usuario tenga permisos para leer las tablas necesarias

### Comandos no aparecen
- Si usas `GUILD_ID`, espera unos segundos después de iniciar el bot
- Si no usas `GUILD_ID`, los comandos globales pueden tardar hasta 1 hora
- Revisa la consola para ver errores al registrar comandos

### Imágenes no se muestran
- Verifica que la carpeta `resources/` esté completa (misc/, buttons/, icons/, etc.)
- Asegúrate de que el bot tenga permisos para leer archivos
- Revisa la consola para ver errores al generar imágenes

### Error "Unknown interaction"
- Este error puede ocurrir si el bot tarda más de 3 segundos en responder
- Los comandos que generan imágenes ya usan `deferReply()` automáticamente
- Si ocurre en otros comandos, añade `await interaction.deferReply()` al inicio

## 📄 Cambios desde la versión anterior

- ✅ Actualizado a discord.js v14
- ✅ Sistema de comandos slash (/) en lugar de prefijos
- ✅ Conexión directa a MySQL (sin proxy PHP)
- ✅ Generación de imágenes en Node.js con `canvas`
- ✅ Todas las imágenes se envían como attachments
- ✅ Eliminado sistema de linkeo de cuentas Discord
- ✅ Mejorado el manejo de interacciones con `deferReply()`
- ✅ Uso de `MessageFlags.Ephemeral` (recomendado por Discord.js v14)
- ✅ Código más limpio y mantenible
- ✅ Soporte para Node.js 18+
- ✅ Mejor documentación

## 📄 Licencia

Este proyecto es parte de Chaos GDPS.
