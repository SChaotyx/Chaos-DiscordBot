const fs = require('fs');
const path = require('path');

const resourcesPath = path.join(__dirname, '../resources/icons');

// Cache para los límites de iconos
let iconLimitsCache = null;

/**
 * Escanea los archivos de iconos disponibles y determina los IDs máximos para cada tipo
 * @returns {Object} Objeto con los IDs máximos por tipo { 0: maxID, 1: maxID, ... }
 */
function getIconLimits() {
    // Retornar cache si ya existe
    if (iconLimitsCache !== null) {
        return iconLimitsCache;
    }

    const limits = {
        0: 1, // player
        1: 1, // ship
        2: 1, // player_ball
        3: 1, // bird
        4: 1, // dart
        5: 1, // robot
        6: 1, // spider
        7: 1, // swing
        8: 1  // jetpack
    };

    const typeNames = {
        0: 'player',
        1: 'ship',
        2: 'player_ball',
        3: 'bird',
        4: 'dart',
        5: 'robot',
        6: 'spider',
        7: 'swing',
        8: 'jetpack'
    };

    try {
        if (!fs.existsSync(resourcesPath)) {
            return limits;
        }

        const files = fs.readdirSync(resourcesPath);
        
        // Buscar archivos .plist para cada tipo
        for (const [type, typeName] of Object.entries(typeNames)) {
            const typeInt = parseInt(type);
            let maxID = 0;
            
            // Escapar caracteres especiales en el nombre del tipo para regex
            const escapedTypeName = typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Patrón para buscar archivos: typeName_ID.plist, typeName_ID-hd.plist, typeName_ID-uhd.plist
            // Ejemplo: player_01.plist, player_01-hd.plist, player_ball_01.plist
            const pattern = new RegExp(`^${escapedTypeName}_(\\d+)(?:-hd|-uhd)?\\.plist$`);
            
            for (const file of files) {
                if (file.endsWith('.plist')) {
                    const match = file.match(pattern);
                    if (match) {
                        const iconID = parseInt(match[1]);
                        if (iconID > maxID) {
                            maxID = iconID;
                        }
                    }
                }
            }
            
            // Si encontramos algún ID, usarlo; si no, mantener 1 como mínimo
            if (maxID > 0) {
                limits[typeInt] = maxID;
            }
        }
        
        // Guardar en cache
        iconLimitsCache = limits;
        return limits;
    } catch (error) {
        console.error('Error escaneando límites de iconos:', error);
        return limits;
    }
}

module.exports = {
    getIconLimits
};
