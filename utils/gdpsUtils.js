// Emojis de Discord (copiados de emojis.php)
const emojis = {
    // MODBADGE
    icon_mod: "<:mod:588245549015236618>",
    icon_elder: "<:elder:588245548436422667>",
    icon_head: "<:head:588246856484782090>",
    icon_admin: "<:admin:588246857545941012>",
    icon_dev: "<:dev:588246858460037121>",
    icon_owner: "<:owner:588246858384801793>",
    // BUTTONS
    icon_play: "<:play:588245551787802634>",
    icon_profile: "<:profile:588247765751169051>",
    icon_download1: "<:down1:588245550210613267>",
    icon_modstar: "<:modstar:588254713766739978>",
    icon_brokenmodstar: "<:broken_modstar:588254714060341259>",
    icon_friends: "<:sqfriends:588245550302756870>",
    icon_message: "<:message:588245550256619521>",
    // SOCIAL
    icon_discord: "<:discord:588248737684520971>",
    icon_twitch: "<:twitch:588248741094621186>",
    icon_twitter: "<:twitter:588248740200972288>",
    icon_youtube: "<:youtube:588249043596083200>",
    // PLAYER
    icon_star: "<:rate:588245546268098568>",
    icon_moon: "<:moon:1463307687537152254>",
    icon_diamond: "<:diamond:588245544863006730>",
    icon_unverifycoins: "<:unverify:588245549107380244>",
    icon_verifycoins: "<:verify:588245548528697344>",
    icon_secretcoin: "<:secret:588245549149323283>",
    icon_demon: "<:demon:588245544451833856>",
    icon_cp: "<:cp:588245543600390184>",
    icon_orbs: "<:orbs:622293318516080650>",
    icon_creatorrank: "<:creatorrank:588247074068234240>",
    icon_globalrank: "<:global:588247074236137502>",
    icon_top1000: "<:top1000:588251140572053527>",
    icon_top500: "<:top500:588251140479778826>",
    icon_top200: "<:top200:588251139900964876>",
    icon_top100: "<:top100:588251141104467968>",
    icon_top50: "<:top50:588251139074555955>",
    icon_top10: "<:top10:588251138600599553>",
    icon_top1: "<:top1:588251137900150787>",
    // LEVELS
    icon_objecto: "<:objecto:588245546423025664>",
    icon_like: "<:like:588245545915777045>",
    icon_dislike: "<:dislike:588245545550741524>",
    icon_length: "<:length:588245546108583946>",
    icon_download2: "<:down2:588245545303408671>",
    icon_copy: "<:copy:588245543445331968>",
    // MISC
    icon_succes: "<:succes:588245546469294111>",
    icon_lock: "<:lock:588245548742606849>",
    icon_info: "<:info:588245545643016224>",
    icon_failed: "<:failed:588245545559130114>",
    icon_cross: "<:cross:588245544200175621>",
    icon_approved: "<:approved:588253185018298378>",
    icon_auto: "<:auto:588254712017584139>",
    icon_search: "<:search:596447805040492546>",
    // DAILY WEEKLY
    icon_daily: "<:daily:596415463370653698>",
    icon_weekly: "<:weekly:596415467053252635>"
};

/**
 * Formatea un número delta de tiempo en formato legible (similar a makeTime de PHP)
 * @param {number} delta - Segundos de diferencia
 * @returns {string} Tiempo formateado
 */
function makeTime(delta) {
    if (delta < 60) {
        return `${delta} second${delta === 1 ? '' : 's'}`;
    } else if (delta < 3600) {
        const minutes = Math.floor(delta / 60);
        return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    } else if (delta < 86400) {
        const hours = Math.floor(delta / 3600);
        return `${hours} hour${hours === 1 ? '' : 's'}`;
    } else if (delta < 604800) {
        const days = Math.floor(delta / 86400);
        return `${days} day${days === 1 ? '' : 's'}`;
    } else if (delta < 2628000) {
        const weeks = Math.floor(delta / 604800);
        return `${weeks} week${weeks === 1 ? '' : 's'}`;
    } else if (delta < 31536000) {
        const months = Math.floor(delta / 2628000);
        return `${months} month${months === 1 ? '' : 's'}`;
    } else {
        const years = Math.floor(delta / 31536000);
        return `${years} year${years === 1 ? '' : 's'}`;
    }
}

/**
 * Calcula el tiempo transcurrido desde un timestamp
 * @param {number} timestamp - Timestamp Unix
 * @returns {string} Tiempo transcurrido formateado
 */
function timeElapsed(timestamp) {
    const delta = Math.floor(Date.now() / 1000) - timestamp;
    if (delta < 1) {
        return '0 seconds';
    }
    return makeTime(delta);
}

/**
 * Formatea un número con padding a la izquierda (charCount - similar a PHP)
 * @param {number|string} value - Valor a formatear
 * @returns {string} Valor con padding de 9 espacios a la izquierda
 */
function charCount(value) {
    return String(value).padStart(9, ' ');
}

/**
 * Formatea un número con padding a la derecha (charCount2 - similar a PHP)
 * @param {number|string} value - Valor a formatear
 * @returns {string} Valor con padding de 5 espacios a la derecha
 */
function charCount2(value) {
    return String(value).padEnd(5, ' ');
}

/**
 * Retorna el color del embed según el ID
 * @param {number} colorId - ID del color
 * @returns {number} Color en formato decimal
 */
function embedColor(colorId) {
    // Mapeo básico de colores comunes
    const colors = {
        7: 0x00AE86, // Verde principal
        // Agregar más colores según sea necesario
    };
    return colors[colorId] || 0x00AE86;
}

module.exports = {
    emojis,
    makeTime,
    timeElapsed,
    charCount,
    charCount2,
    embedColor
};
