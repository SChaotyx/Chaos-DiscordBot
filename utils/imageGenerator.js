const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const db = require('./database');
require('dotenv').config();

const resourcesPath = path.join(__dirname, '../resources');

// Quality settings from environment variables
// If variable is undefined (not set), use 'hd' (medium quality) as default
// If variable is empty string '', use '' (low quality)
// Otherwise use the specified value ('uhd', 'hd', or '')
const ICON_PROFILE_QUALITY = process.env.ICON_PROFILE_QUALITY !== undefined ? process.env.ICON_PROFILE_QUALITY : 'hd';
const ICON_SET_QUALITY = process.env.ICON_SET_QUALITY !== undefined ? process.env.ICON_SET_QUALITY : 'hd';

/**
 * Genera thumbnail de dificultad de un nivel (replica diffthumbnail de PHP)
 * Combina imágenes de rating (featured/epic/legendary/mythic), dificultad y estrellas
 * @param {number} levelID - ID del nivel a generar thumbnail
 * @returns {Promise<Buffer|null>} Buffer de la imagen PNG o null si el nivel no existe o hay error
 * @throws {Error} Si hay error al cargar imágenes o crear canvas
 */
async function generateLevelThumbnail(levelID) {
    try {
        const level = await db.queryOne(
            'SELECT starStars, starFeatured, starEpic, starDemonDiff, starDifficulty, starAuto, starDemon FROM levels WHERE levelID = ?',
            [levelID]
        );

        if (!level) return null;

        // Determine rating flair
        let rateImage = "ratena";
        if (level.starFeatured == 1) rateImage = "ratefeat";
        if (level.starEpic == 1) rateImage = "rateepic";
        if (level.starEpic == 2) rateImage = "ratelegendary";
        if (level.starEpic == 3) rateImage = "ratemythic";

        // Determine difficulty face
        let diffImage = "diff" + (level.starDifficulty || 0);
        if (level.starAuto == 1) diffImage = "auto";
        if (level.starDemon == 1) {
            const demonMap = { 0: "demon0", 3: "demon3", 4: "demon4", 5: "demon5", 6: "demon6" };
            diffImage = demonMap[level.starDemonDiff] || 'demon0';
        }

        // Determine star value image
        const stars = Math.min(level.starStars || 0, 10);
        const starImage = "str" + stars;

        // Load images
        const rateImg = await loadImage(path.join(resourcesPath, `${rateImage}.png`));
        const diffImg = await loadImage(path.join(resourcesPath, `${diffImage}.png`));
        const starImg = await loadImage(path.join(resourcesPath, `${starImage}.png`));

        // Create canvas with rate image dimensions
        const canvas = createCanvas(rateImg.width, rateImg.height);
        const ctx = canvas.getContext('2d');

        // Draw rate image as base
        ctx.drawImage(rateImg, 0, 0);

        // Draw diff image on top
        ctx.drawImage(diffImg, 0, 0, canvas.width, canvas.height);

        // Draw star image on top
        ctx.drawImage(starImg, 0, 0, canvas.width, canvas.height);

        // Return buffer directly
        return canvas.toBuffer('image/png');
    } catch (error) {
        console.error(`Error generando thumbnail de nivel ${levelID}:`, error);
        return null;
    }
}

/**
 * Aplica tint (tinte de color) a una imagen canvas
 * Multiplica los canales RGB de cada píxel por los valores del color especificado
 * @param {Canvas} canvas - Canvas con la imagen a teñir
 * @param {Array<number>} color - Array con valores RGB [R, G, B] (0-255) para aplicar el tint
 * @returns {Canvas} El mismo canvas modificado con el tint aplicado
 * @throws {Error} Si el canvas es inválido o el color tiene formato incorrecto
 */
function tintImage(canvas, color) {
    if (canvas.width === 0 || canvas.height === 0) {
        return canvas; // Skip tint if canvas has invalid dimensions
    }
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Skip fully transparent pixels
        if (data[i + 3] === 0) continue;

        // Multiply RGB channels
        data[i] = Math.min(255, (color[0] / 255) * data[i]);     // R
        data[i + 1] = Math.min(255, (color[1] / 255) * data[i + 1]); // G
        data[i + 2] = Math.min(255, (color[2] / 255) * data[i + 2]); // B
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * Genera un icono de perfil de usuario desde los assets del juego
 * Genera el icono principal que el usuario tiene equipado según su iconType e icon
 * @param {number} accountID - ID de la cuenta (extID) del usuario
 * @param {string|null} imageRes - Calidad de imagen ('uhd', 'hd', '' para baja, o null para usar ICON_PROFILE_QUALITY). Por defecto usa variable de entorno
 * @returns {Promise<Buffer|null>} Buffer de la imagen PNG del icono o null si el usuario no existe
 * @throws {Error} Si hay error al generar el icono o cargar assets
 */
async function generateProfileIcon(accountID, imageRes = null) {
    // Use environment variable if imageRes is not provided
    if (imageRes === null) {
        imageRes = ICON_PROFILE_QUALITY;
    }
    try {
        const user = await db.queryOne(
            'SELECT iconType, icon, color1, color2, color3, accGlow FROM users WHERE extID = ?',
            [accountID]
        );

        if (!user) return null;

        // Use buildIcon (handles both multipart and simple icons) with specified quality
        const iconImage = await buildIcon(
            user.iconType,
            user.icon,
            user.color1,
            user.color2,
            user.color3,
            user.accGlow == 1,
            imageRes
        );

        if (!iconImage) return null;

        // Return buffer directly
        return iconImage.toBuffer('image/png');
    } catch (error) {
        console.error(`Error generando icono de perfil ${accountID}:`, error);
        return null;
    }
}

/**
 * Genera el conjunto completo de iconos de perfil
 * Muestra todos los iconos del usuario (ship, ball, bird, etc.) en una sola imagen
 * @param {number|null} accountID - ID de la cuenta (extID) del usuario, o null para usar parámetros personalizados
 * @param {string|null} imageRes - Calidad de imagen ('uhd', 'hd', '' para baja, o null para usar ICON_SET_QUALITY). Por defecto usa variable de entorno
 * @param {boolean} includeJetpack - Si incluir el jetpack (tipo 8) en el conjunto. Por defecto false
 * @param {Object|null} customParams - Parámetros personalizados cuando accountID es null: { accs: {0: icon, 1: ship, ...}, color1, color2, color3, glow, iconType }
 * @param {boolean} excludeEquipped - Si excluir el icono equipado del conjunto. Por defecto false (incluir todos)
 * @returns {Promise<Buffer|null>} Buffer de la imagen PNG con todos los iconos o null si hay error
 * @throws {Error} Si hay error al generar los iconos o cargar assets
 */
async function generateProfileIconSet(accountID = null, imageRes = null, includeJetpack = false, customParams = null, excludeEquipped = false) {
    // Use environment variable if imageRes is not provided
    if (imageRes === null) {
        imageRes = ICON_SET_QUALITY;
    }
    try {
        let glow, accs, color1, color2, color3, iconType;
        
        if (accountID !== null) {
            // Get user data from database
            const user = await db.queryOne('SELECT * FROM users WHERE extID = ?', [accountID]);
            if (!user) return null;

            glow = user.accGlow == 1;
            color1 = user.color1;
            color2 = user.color2;
            color3 = user.color3;
            iconType = user.iconType;
            // Ensure all types have valid iconIDs (use 1 as default if null/0)
            accs = {
                0: user.accIcon || 1,
                1: user.accShip || 1,
                2: user.accBall || 1,
                3: user.accBird || 1,
                4: user.accDart || 1,
                5: user.accRobot || 1,
                6: user.accSpider || 1,
                7: user.accSwing || 1,
                8: user.accJetpack || 1
            };
        } else if (customParams) {
            // Use custom parameters
            glow = customParams.glow || false;
            color1 = customParams.color1;
            color2 = customParams.color2;
            color3 = customParams.color3;
            iconType = customParams.iconType || 0;
            accs = customParams.accs || {};
        } else {
            return null; // Need either accountID or customParams
        }

        const iconsToDraw = [];
        // Define all icon types that should be included
        // For iconset: types 0-7 (player, ship, ball, bird, dart, robot, spider, swing)
        // For iconsetfull: types 0-8 (all including jetpack)
        const maxType = includeJetpack ? 8 : 7;
        
        for (let typeInt = 0; typeInt <= maxType; typeInt++) {
            // Skip the equipped icon type only if excludeEquipped is true (e.g., when shown as thumbnail in profile)
            if (excludeEquipped && typeInt === iconType) {
                continue;
            }
            // Get iconID from accs, use 1 as default if not found or is 0/null
            let iconID = accs[typeInt] || accs[String(typeInt)];
            // Ensure we have a valid iconID (at least 1)
            if (!iconID || iconID === 0) {
                iconID = 1;
            }
            iconsToDraw.push({ type: typeInt, iconID });
        }

        // Calculate canvas dimensions based on horizontal alignment
        // Spacing scales with quality: base 25 for HD (x2), so x1 = 12.5, x2 = 25, x4 = 50
        // PHP: $iconSpacing = (int)($baseSpacing * ($qualityScale / 2.0));
        let qualityScale = 2.0; // Default to HD (x2)
        if (imageRes === '') {
            qualityScale = 1.0; // Low quality (x1)
        } else if (imageRes === 'uhd') {
            qualityScale = 4.0; // UHD quality (x4)
        } else if (imageRes === 'hd') {
            qualityScale = 2.0; // HD quality (x2)
        }
        const baseSpacing = 25; // Base spacing for HD (x2)
        const iconSpacing = Math.floor(baseSpacing * (qualityScale / 2.0)); // Scale spacing based on quality (use floor like PHP (int))
        
        let maxIconHeight = 0;
        let totalWidth = 0;
        const iconImages = [];
        
        // First pass: get all icon images and calculate dimensions
        for (const { type, iconID } of iconsToDraw) {
            // Use buildIcon (handles both multipart and simple icons) with medium quality
            const iconImage = await buildIcon(type, iconID, color1, color2, color3, glow, imageRes);
            
            if (iconImage) {
                const pW = iconImage.width;
                const pH = iconImage.height;
                iconImages.push({
                    image: iconImage,
                    width: pW,
                    height: pH
                });
                if (pH > maxIconHeight) {
                    maxIconHeight = pH;
                }
                totalWidth += pW;
            }
        }
        
        // Calculate total canvas width: sum of all icon widths + spacing between them (no side margins)
        const iconCount = iconImages.length;
        const canvasW = totalWidth + (iconSpacing * (iconCount - 1));
        const canvasH = maxIconHeight; // Height is the tallest icon

        const canvas = createCanvas(canvasW, canvasH);
        const ctx = canvas.getContext('2d');

        // Fill transparent background
        ctx.clearRect(0, 0, canvasW, canvasH);

        // Align icons horizontally with spacing (no side margins)
        let currentX = 0;
        for (const iconData of iconImages) {
            const iconImage = iconData.image;
            const pW = iconData.width;
            const pH = iconData.height;
            
            // Align vertically (center in canvas height)
            const offsetY = (canvasH - pH) / 2;
            
            ctx.drawImage(iconImage, currentX, offsetY, pW, pH);
            
            // Move to next position (icon width + spacing)
            currentX += pW + iconSpacing;
        }

        // Return buffer directly
        return canvas.toBuffer('image/png');
    } catch (error) {
        console.error(`Error generando icon set de perfil ${accountID}:`, error);
        return null;
    }
}

/**
 * Genera un icono desde assets del juego (replica iconGenerator de PHP)
 * Parsea archivos PLIST, aplica tinting de colores y ensambla los componentes del icono
 * @param {number} iconType - Tipo de icono (0:cube, 1:ship, 2:ball, 3:bird, 4:dart, 5:robot, 6:spider, 7:swing, 8:jetpack)
 * @param {number} id - ID del asset de icono (formato: 01, 02, etc.)
 * @param {number} color1Id - ID del color primario desde la paleta
 * @param {number} color2Id - ID del color secundario desde la paleta
 * @param {number} color3Id - ID del color de glow desde la paleta
 * @param {boolean} glowEnabled - Si el glow debe renderizarse (acGlow)
 * @param {number|null} targetPart - Para iconos multiparte (robot/spider), qué parte renderizar (null = todas)
 * @param {boolean} glowOnly - Si solo renderizar capas de glow (para robots/arañas)
 * @param {string|null} imageRes - Calidad de imagen ('uhd', 'hd', '' para baja, o null para auto-detección)
 * @returns {Promise<Object|false>} Objeto con los iconos generados { 'full': Canvas, '01': Canvas, ... } o false si hay error
 * @throws {Error} Si los archivos PLIST/PNG no existen o hay error al parsear
 */
async function generateIcon(iconType, id, color1Id, color2Id, color3Id, glowEnabled, targetPart, glowOnly = false, imageRes = null) {
    try {
        // Load color palette
        const colorsJson = fs.readFileSync(path.join(resourcesPath, 'colors.json'), 'utf8');
        const colorsData = JSON.parse(colorsJson);
        const palette = {};
        colorsData.forEach(c => {
            palette[c.id] = [c.r, c.g, c.b];
        });

        // Configure paths & names
        const types = { 0: 'player', 1: 'ship', 2: 'player_ball', 3: 'bird', 4: 'dart', 5: 'robot', 6: 'spider', 7: 'swing', 8: 'jetpack' };
        const typeName = types[iconType] || 'player';
        const formattedId = String(id).padStart(2, '0');
        const baseName = `${typeName}_${formattedId}`;

        // Determinar qué calidad usar
        // Si imageRes es null, usar calidad media (hd) por defecto
        let plistFile = null;
        let spriteSheetFile = null;
        
        // Default to 'hd' (medium quality) if imageRes is null
        const qualityToUse = imageRes !== null ? imageRes : 'hd';
        
        // Usar calidad específica solicitada
        const qualitySuffix = qualityToUse === '' ? '' : '-' + qualityToUse;
        const testPlist = path.join(resourcesPath, 'icons', `${baseName}${qualitySuffix}.plist`);
        const testPng = path.join(resourcesPath, 'icons', `${baseName}${qualitySuffix}.png`);
        
        if (fs.existsSync(testPlist) && fs.existsSync(testPng)) {
            plistFile = testPlist;
            spriteSheetFile = testPng;
        } else {
            // Fallback: si no existe la calidad solicitada, intentar auto-detección
            const qualities = ['-hd', '', '-uhd']; // Prefer hd, then low, then uhd
            
            for (const quality of qualities) {
                const fallbackPlist = path.join(resourcesPath, 'icons', `${baseName}${quality}.plist`);
                const fallbackPng = path.join(resourcesPath, 'icons', `${baseName}${quality}.png`);
                
                if (fs.existsSync(fallbackPlist) && fs.existsSync(fallbackPng)) {
                    plistFile = fallbackPlist;
                    spriteSheetFile = fallbackPng;
                    break;
                }
            }
        }
        
        if (!plistFile || !spriteSheetFile) {
            return false;
        }

        // Load sprite sheet
        const spriteSheet = await loadImage(spriteSheetFile);

        // Parse plist XML - using xml2js with explicitArray to handle arrays properly
        const xml2js = require('xml2js');
        const parser = new xml2js.Parser({ explicitArray: false });
        const plistContent = fs.readFileSync(plistFile, 'utf8');
        const xmlData = await parser.parseStringPromise(plistContent);

        const c1 = palette[color1Id] || [255, 255, 255];
        const c2 = palette[color2Id] || [255, 255, 255];
        const c3 = palette[color3Id] || [255, 255, 255];
        const rawLayers = [];

        // Extract frames dict from plist structure
        // Structure: plist.dict.key = ["frames", "metadata"], plist.dict.dict = [framesDict, metadataDict]
        const plistDict = xmlData.plist?.dict || {};
        const keys = Array.isArray(plistDict.key) ? plistDict.key : [plistDict.key];
        const dicts = Array.isArray(plistDict.dict) ? plistDict.dict : [plistDict.dict];
        
        // Find frames dict (first dict corresponds to "frames" key)
        const framesDictIdx = keys.indexOf('frames');
        if (framesDictIdx === -1 || !dicts[framesDictIdx]) {
            return false;
        }
        const framesDict = dicts[framesDictIdx];

        // Extract frame names and their data
        const frameKeys = Array.isArray(framesDict.key) ? framesDict.key : [framesDict.key];
        const frameDicts = Array.isArray(framesDict.dict) ? framesDict.dict : [framesDict.dict];

        // Process each frame
        for (let i = 0; i < frameKeys.length && i < frameDicts.length; i++) {
            const keyName = frameKeys[i];
            const frameDict = frameDicts[i];
            if (!frameDict || typeof frameDict !== 'object') continue;

            // Extract frame data - PHP iterates children and pairs keys with following values
            // PHP: foreach ($node->children() as $s) {
            //       if ($s->getName() == 'key') $lastKey = (string)$s;
            //       else $data[$lastKey] = ($s->getName() == 'true' ? true : ($s->getName() == 'false' ? false : (string)$s));
            //      }
            // xml2js groups keys/values separately, but we need to pair them by position
            const data = {};
            const dataKeys = Array.isArray(frameDict.key) ? frameDict.key : [frameDict.key];
            const strings = frameDict.string ? (Array.isArray(frameDict.string) ? frameDict.string : [frameDict.string]) : [];
            const hasTrue = frameDict.true !== undefined;
            
            // Pair keys with values in order (skip 'aliases' as it's an array)
            let stringIdx = 0;
            let seenAliases = false;
            for (const propKey of dataKeys) {
                if (propKey === 'aliases') {
                    seenAliases = true;
                    continue; // aliases is an array, skip it
                } else if (propKey === 'spriteOffset' && strings.length > stringIdx) {
                    data[propKey] = strings[stringIdx++];
                } else if (propKey === 'spriteSize' && strings.length > stringIdx) {
                    data[propKey] = strings[stringIdx++];
                } else if (propKey === 'spriteSourceSize' && strings.length > stringIdx) {
                    data[propKey] = strings[stringIdx++];
                } else if (propKey === 'textureRect' && strings.length > stringIdx) {
                    data[propKey] = strings[stringIdx++];
                } else if (propKey === 'textureRotated') {
                    data[propKey] = hasTrue;
                }
            }

            const pieceNum = (iconType == 5 || iconType == 6) && keyName.match(new RegExp(`${baseName}_(\\d{2})`)) 
                ? keyName.match(new RegExp(`${baseName}_(\\d{2})`))[1] 
                : "full";

            if (targetPart !== null && pieceNum !== "full" && pieceNum !== String(targetPart).padStart(2, '0')) {
                continue;
            }

            const n = keyName.toLowerCase();
            let order = 4;
            let tint = c1;
            let useTint = true;
            const isGlow = n.includes('_glow_');

            if (isGlow) {
                // Glow layer handling
                if (!glowEnabled) continue; // Skip if glow not enabled
                if (glowOnly) {
                    // glowOnly mode: only process glow layers
                    order = 1;
                    tint = c3;
                } else {
                    // Normal mode: include glow layers normally
                    order = 1;
                    tint = c3;
                }
            } else {
                // Non-glow layer handling
                if (glowOnly) continue; // Skip non-glow in glowOnly mode
                
                if (n.includes('_3_')) {
                    order = 2;
                    useTint = false;
                } else if (n.includes('_2_')) {
                    order = 3;
                    tint = c2;
                } else if (n.includes('extra')) {
                    order = 5;
                    useTint = false;
                }
            }

            // Parse textureRect - PHP: $rect = explode(',', str_replace(['{','}',' '], '', $data['textureRect']));
            // Converts {{69,2},{61,60}} to ["69", "2", "61", "60"]
            // rect[0]=x, rect[1]=y, rect[2]=width, rect[3]=height
            const textureRect = data.textureRect || '{{0,0},{0,0}}';
            const cleaned = textureRect.replace(/[{}\s]/g, '');
            const parts = cleaned.split(',');
            let rect = [0, 0, 0, 0];
            if (parts.length >= 4) {
                rect = [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]), parseInt(parts[3])];
            }
            
            const isRot = data.textureRotated === true || data.textureRotated === 'true';

            // PHP: $w = $isRot ? (int)$rect[3] : (int)$rect[2];
            // PHP: $h = $isRot ? (int)$rect[2] : (int)$rect[3];
            // Swap dimensions if rotated (like PHP does)
            const w = isRot ? rect[3] : rect[2];
            const h = isRot ? rect[2] : rect[3];
            
            // Skip if dimensions are invalid
            if (w <= 0 || h <= 0 || rect[2] <= 0 || rect[3] <= 0) {
                continue;
            }

            // PHP: $piece = imagecreatetruecolor($w, $h);
            const pieceCanvas = createCanvas(w, h);
            const pieceCtx = pieceCanvas.getContext('2d');
            
            // PHP: imagealphablending($piece, false); imagesavealpha($piece, true);
            // PHP: imagefill($piece, 0, 0, imagecolorallocatealpha($piece, 0, 0, 0, 127));
            // Canvas is transparent by default, but clear it explicitly
            pieceCtx.clearRect(0, 0, w, h);

            // PHP: imagecopy($piece, $spriteSheet, 0, 0, (int)$rect[0], (int)$rect[1], $w, $h);
            // Important: PHP uses swapped dimensions ($w, $h) when rotated, but these are the dimensions
            // of the sprite as stored in the sheet (rotated). We copy using rect[2] and rect[3] (original)
            // then rotate, not the swapped w/h.
            // Actually wait - PHP uses $w and $h which ARE swapped. So if textureRect says 61x60 but rotated,
            // w=60, h=61, and it copies a 60x61 region. But the sprite is actually 61x60 rotated 90° in the sheet.
            // Let me think... textureRect {{69,2},{61,60}} means 61x60 sprite at position 69,2
            // If rotated=true, PHP sets w=60, h=61 and copies 60x61 region starting at 69,2
            // This means the sprite is stored as 60x61 in the sheet, but it's a 61x60 sprite rotated.
            // So we should copy using w and h (swapped dimensions)
            pieceCtx.drawImage(spriteSheet, rect[0], rect[1], w, h, 0, 0, w, h);

            // PHP: if ($isRot) { $piece = imagerotate($piece, 90, ...); }
            // imagerotate(90) rotates 90° COUNTER-CLOCKWISE
            // Canvas rotate() rotates CLOCKWISE for positive angles
            // To replicate imagerotate(90), use -Math.PI/2 in canvas
            // After rotation, dimensions swap: w x h becomes h x w
            if (isRot) {
                // Create rotated canvas with swapped dimensions
                const rotatedCanvas = createCanvas(h, w);
                const rotatedCtx = rotatedCanvas.getContext('2d');
                
                // imagerotate rotates counter-clockwise around center
                // Canvas rotate() is clockwise, so use negative angle
                rotatedCtx.translate(h / 2, w / 2);
                rotatedCtx.rotate(-Math.PI / 2); // Counter-clockwise 90° (opposite of canvas default)
                rotatedCtx.translate(-w / 2, -h / 2);
                rotatedCtx.drawImage(pieceCanvas, 0, 0);
                
                // Replace pieceCanvas with rotated version
                pieceCanvas.width = h;
                pieceCanvas.height = w;
                pieceCtx.clearRect(0, 0, h, w);
                pieceCtx.drawImage(rotatedCanvas, 0, 0);
            }

            // Apply tint
            if (useTint) {
                tintImage(pieceCanvas, tint);
            }

            // Parse spriteOffset - PHP: $offset = explode(',', str_replace(['{','}',' '], '', $data['spriteOffset']));
            // Converts {x,y} to [x, y]
            const spriteOffset = data.spriteOffset || '{0,0}';
            const cleanedOffset = spriteOffset.replace(/[{}\s]/g, '');
            const offsetParts = cleanedOffset.split(',');
            // PHP: 'offX' => (int)$offset[0], 'offY' => (int)$offset[1]
            const offX = offsetParts.length > 0 ? parseInt(offsetParts[0]) || 0 : 0;
            const offY = offsetParts.length > 1 ? parseInt(offsetParts[1]) || 0 : 0;

            rawLayers.push({
                img: pieceCanvas,
                order,
                num: pieceNum,
                offX: offX,
                offY: offY
            });
        }

        // Final assembly - group by piece number
        const groups = {};
        rawLayers.forEach(layer => {
            if (!groups[layer.num]) groups[layer.num] = [];
            groups[layer.num].push(layer);
        });

        const result = {};
        for (const [num, components] of Object.entries(groups)) {
            // Sort by order
            components.sort((a, b) => a.order - b.order);

            // Calculate bounds - PHP uses 9999/-9999 for min/max initialization
            let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
            components.forEach(c => {
                const w = c.img.width;
                const h = c.img.height;
                // PHP: $x1 = $c['offX'] - ($w / 2); $x2 = $c['offX'] + ($w / 2);
                const x1 = c.offX - (w / 2);
                const x2 = c.offX + (w / 2);
                // PHP: $y1 = $c['offY'] - ($h / 2); $y2 = $c['offY'] + ($h / 2);
                const y1 = c.offY - (h / 2);
                const y2 = c.offY + (h / 2);
                // PHP: if ($x1 < $minX) $minX = $x1; if ($x2 > $maxX) $maxX = $x2;
                if (x1 < minX) minX = x1;
                if (x2 > maxX) maxX = x2;
                // PHP: if ($y1 < $minY) $minY = $y1; if ($y2 > $maxY) $maxY = $y2;
                if (y1 < minY) minY = y1;
                if (y2 > maxY) maxY = y2;
            });

            // PHP: $finalW = (int)ceil($maxX - $minX);
            // PHP: $finalH = (int)ceil($maxY - $minY);
            const finalW = Math.ceil(maxX - minX);
            const finalH = Math.ceil(maxY - minY);

            const finalCanvas = createCanvas(finalW, finalH);
            const finalCtx = finalCanvas.getContext('2d');
            // PHP: imagealphablending($final, false); imagesavealpha($final, true);
            // PHP: imagefill($final, 0, 0, imagecolorallocatealpha($final, 0, 0, 0, 127));
            // PHP: imagealphablending($final, true);
            finalCtx.clearRect(0, 0, finalW, finalH);

            components.forEach(c => {
                const w = c.img.width;
                const h = c.img.height;
                // PHP: $posX = ($c['offX'] - ($w / 2)) - $minX;
                // PHP uses integer arithmetic - ensure we calculate exactly as PHP does
                const posX = (c.offX - (w / 2)) - minX;
                // PHP: $posY = $finalH - (($c['offY'] + ($h / 2)) - $minY);
                // This inverts Y axis because GD uses top-left origin but offsets use bottom-left
                const posY = finalH - ((c.offY + (h / 2)) - minY);
                // PHP: imagecopy($final, $c['img'], $posX, $posY, 0, 0, $w, $h);
                // Use Math.round to ensure pixel-perfect positioning like PHP
                finalCtx.drawImage(c.img, Math.round(posX), Math.round(posY), w, h);
            });

            result[num] = finalCanvas;
        }

        return result;
    } catch (error) {
        console.error(`Error generando icono type=${iconType} id=${id}:`, error);
        return false;
    }
}

/**
 * Helper function to parse a Vector2 string like "{x, y}" into an object
 * @param {string} vectorString - The vector string to parse
 * @returns {{x: number, y: number}} An object with x and y keys
 */
function parseVector2(vectorString) {
    const cleaned = vectorString.replace(/[{}\s]/g, '');
    const parts = cleaned.split(',');
    return {
        x: parseFloat(parts[0] || 0),
        y: parseFloat(parts[1] || 0)
    };
}

/**
 * Crops an image to its edges, removing all transparent space around it
 * @param {Canvas} image - The canvas to crop
 * @returns {Canvas} The cropped canvas (or original if no crop needed)
 */
function cropToEdges(image) {
    const cropData = getCropBounds(image);
    if (!cropData) {
        return image; // Return original if no content found
    }
    
    // Check if crop is needed
    const w = image.width;
    const h = image.height;
    if (cropData.x === 0 && cropData.y === 0 && 
        cropData.width === w && cropData.height === h) {
        return image; // No crop needed
    }
    
    const cropped = createCanvas(cropData.width, cropData.height);
    const ctx = cropped.getContext('2d');
    ctx.clearRect(0, 0, cropData.width, cropData.height);
    
    ctx.drawImage(image, cropData.x, cropData.y, cropData.width, cropData.height, 
                  0, 0, cropData.width, cropData.height);
    
    return cropped;
}

/**
 * Gets the bounding box of non-transparent pixels in an image
 * @param {Canvas} image - The canvas to analyze
 * @returns {{x: number, y: number, width: number, height: number}|null} Bounding box or null if fully transparent
 */
function getCropBounds(image) {
    const w = image.width;
    const h = image.height;
    const ctx = image.getContext('2d');
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    let hasContent = false;
    
    // Find bounding box of non-transparent pixels
    // PHP uses: if ($rgba['alpha'] < 125) - very strict threshold
    // Alpha in GD: 0 (opaque) to 127 (transparent)
    // Alpha in Canvas: 0 (transparent) to 255 (opaque)
    // Conversion: GD alpha 0-127 maps to Canvas alpha 255-0 (inverted)
    // GD alpha < 125 means "not fully transparent" = "has some opacity"
    // In GD: alpha 0 = fully opaque, alpha 127 = fully transparent
    // In Canvas: alpha 0 = fully transparent, alpha 255 = fully opaque
    // To convert: Canvas alpha = 255 - (GD alpha * 255 / 127)
    // GD alpha 124 (not fully transparent) ≈ Canvas alpha 2 (almost transparent but visible)
    // So we check: alpha > 2 to detect visible pixels (not fully transparent)
    const alphaThreshold = 2; // Equivalent to GD's alpha < 125 (not fully transparent = visible)
    for (let y = h - 1; y >= 0; y--) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const alpha = data[idx + 3];
            // Consider pixels that are not fully transparent (alpha > threshold for strict detection)
            // In Canvas, alpha 0 = fully transparent, alpha 255 = fully opaque
            // PHP checks alpha < 125 (in GD, 0-127 scale), which means not fully transparent = visible
            // In Canvas (0-255), this translates to alpha > 2 (approximately)
            if (alpha > alphaThreshold) {
                hasContent = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    
    if (!hasContent) {
        return null;
    }
    
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    
    // Ensure minimum size
    if (width < 1 || height < 1) {
        return null;
    }
    
    return {
        x: minX,
        y: minY,
        width: width,
        height: height
    };
}

/**
 * Applies transformations (scale, rotation, flip) to a piece image
 * @param {Canvas} image - The source canvas
 * @param {{x: number, y: number}} scale - Scale values
 * @param {number} rotation - Rotation in degrees
 * @param {{x: number, y: number}} flipped - Flip flags (0 or 1)
 * @returns {Canvas} The transformed canvas
 */
function transformPiece(image, scale, rotation, flipped) {
    if (!image || image.width === 0 || image.height === 0) {
        return image;
    }
    
    const w = image.width;
    const h = image.height;
    
    // Apply scale
    const scaledW = Math.max(1, Math.round(w * scale.x));
    const scaledH = Math.max(1, Math.round(h * scale.y));
    
    const scaled = createCanvas(scaledW, scaledH);
    const scaledCtx = scaled.getContext('2d');
    scaledCtx.clearRect(0, 0, scaledW, scaledH);
    scaledCtx.drawImage(image, 0, 0, w, h, 0, 0, scaledW, scaledH);
    
    // Apply flip (like PHP imageflip - simpler approach)
    // PHP: if (($flipped['x'] ?? 0) == 1) { imageflip($scaled, IMG_FLIP_HORIZONTAL); }
    // PHP: if (($flipped['y'] ?? 0) == 1) { imageflip($scaled, IMG_FLIP_VERTICAL); }
    let finalScaled = scaled;
    if ((flipped.x || 0) === 1) {
        const flippedCanvas = createCanvas(scaledW, scaledH);
        const flippedCtx = flippedCanvas.getContext('2d');
        flippedCtx.clearRect(0, 0, scaledW, scaledH);
        flippedCtx.translate(scaledW, 0);
        flippedCtx.scale(-1, 1);
        flippedCtx.drawImage(scaled, 0, 0);
        finalScaled = flippedCanvas;
    }
    if ((flipped.y || 0) === 1) {
        const flippedCanvas = createCanvas(finalScaled.width, finalScaled.height);
        const flippedCtx = flippedCanvas.getContext('2d');
        flippedCtx.clearRect(0, 0, finalScaled.width, finalScaled.height);
        flippedCtx.translate(0, finalScaled.height);
        flippedCtx.scale(1, -1);
        flippedCtx.drawImage(finalScaled, 0, 0);
        finalScaled = flippedCanvas;
    }
    
    // Apply rotation (after scale and flip)
    // PHP: $rotated = @imagerotate($scaled, -$normalizedRotation, $transparent);
    // imagerotate rotates counter-clockwise for positive angles, but we pass negative
    // So -$normalizedRotation means: if rotation is positive, we rotate clockwise
    if (Math.abs(rotation) > 0.01) {
        // Normalize rotation to -180 to 180 range (like PHP fmod)
        let normalizedRotation = rotation % 360;
        if (normalizedRotation > 180) {
            normalizedRotation -= 360;
        } else if (normalizedRotation < -180) {
            normalizedRotation += 360;
        }
        
        // Only rotate if significant (handle near-360 rotations as near-0)
        if (Math.abs(normalizedRotation) > 0.1) {
            const rotW = finalScaled.width;
            const rotH = finalScaled.height;
            
            // Double-check dimensions are valid and reasonable
            if (rotW > 0 && rotH > 0 && rotW <= 10000 && rotH <= 10000) {
                // PHP uses -$normalizedRotation, so we need to negate it
                // imagerotate rotates counter-clockwise for positive, so -angle rotates clockwise
                // Canvas rotate() rotates clockwise for positive, so we use the angle directly (not negated)
                const rad = (normalizedRotation * Math.PI) / 180;
                
                // Calculate rotated dimensions (imagerotate creates a canvas that fits the rotated image)
                const cos = Math.abs(Math.cos(rad));
                const sin = Math.abs(Math.sin(rad));
                const newW = Math.ceil(rotW * cos + rotH * sin);
                const newH = Math.ceil(rotW * sin + rotH * cos);
                
                if (newW > 0 && newH > 0) {
                    const rotated = createCanvas(newW, newH);
                    const rotatedCtx = rotated.getContext('2d');
                    rotatedCtx.clearRect(0, 0, newW, newH);
                    
                // Rotate around center (like imagerotate does)
                // PHP: $rotated = @imagerotate($scaled, -$normalizedRotation, $transparent);
                // imagerotate rotates COUNTER-CLOCKWISE for positive angles
                // So -$normalizedRotation means: if normalizedRotation is 30, we pass -30
                // imagerotate with -30 rotates 30 degrees CLOCKWISE
                // Canvas rotate() with positive angle rotates CLOCKWISE
                // So to match PHP's -$normalizedRotation, we use rad directly (not negated)
                // Because: PHP's -30 -> imagerotate rotates 30° clockwise -> Canvas rotate(30°) also rotates 30° clockwise
                rotatedCtx.translate(newW / 2, newH / 2);
                rotatedCtx.rotate(rad); // Use rad directly to match PHP's -$normalizedRotation behavior
                rotatedCtx.translate(-rotW / 2, -rotH / 2);
                rotatedCtx.drawImage(finalScaled, 0, 0);
                    
                    return rotated;
                }
            }
        }
    }
    
    return finalScaled;
}

/**
 * Darkens an image by a given factor (0.0 to 1.0)
 * Factor 1.0 = no change, 0.5 = 50% brightness, 0.0 = black
 * @param {Canvas} image - The source canvas
 * @param {number} factor - Darkening factor (1.0 = no change, lower = darker)
 * @returns {Canvas} The darkened canvas
 */
function darkenImage(image, factor) {
    if (!image || image.width === 0 || image.height === 0) {
        return image;
    }
    
    const w = image.width;
    const h = image.height;
    const darkened = createCanvas(w, h);
    const ctx = darkened.getContext('2d');
    
    // Get source image data first
    const sourceCtx = image.getContext('2d');
    const sourceImageData = sourceCtx.getImageData(0, 0, w, h);
    const sourceData = sourceImageData.data;
    
    // Create new image data for darkened image
    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;
    
    // Process each pixel
    // PHP: if ($a < 127) - only darken non-transparent pixels
    // In GD: alpha 0 = opaque, alpha 127 = transparent
    // In Canvas: alpha 0 = transparent, alpha 255 = opaque
    // PHP checks: if ($a < 127) means "not fully transparent" = "has some opacity"
    // In Canvas, this translates to: if (alpha > 0) means "not fully transparent" = "has some opacity"
    for (let i = 0; i < data.length; i += 4) {
        const r = sourceData[i];
        const g = sourceData[i + 1];
        const b = sourceData[i + 2];
        const alpha = sourceData[i + 3];
        
        // Only darken non-transparent pixels (PHP: if ($a < 127))
        // In Canvas, alpha 0 = fully transparent, alpha 255 = fully opaque
        // So we check alpha > 0 to detect pixels with any opacity
        if (alpha > 0) {
            // Apply darkening factor (PHP: $r = (int)($r * $factor))
            // PHP keeps the same alpha value, so we keep alpha unchanged
            data[i] = Math.max(0, Math.min(255, Math.round(r * factor)));     // R
            data[i + 1] = Math.max(0, Math.min(255, Math.round(g * factor))); // G
            data[i + 2] = Math.max(0, Math.min(255, Math.round(b * factor))); // B
            data[i + 3] = alpha; // Keep original alpha unchanged (PHP: $a stays the same)
        } else {
            // Keep full transparency (PHP: imagesetpixel with alpha 127 = transparent)
            // In Canvas, alpha 0 = fully transparent
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 0; // Fully transparent
        }
    }
    
    // Put the modified image data back
    ctx.putImageData(imageData, 0, 0);
    return darkened;
}

/**
 * Icon builder that handles both multipart icons (Robot/Spider) and simple icons
 * For multipart icons, composes multiple pieces based on an AnimDesc JSON file
 * For simple icons, uses generateIcon directly
 * This function uses generateIcon as a provider for individual pieces
 * @param {number} iconType - The icon type (5 for Robot, 6 for Spider, others for simple icons)
 * @param {number} iconID - The icon ID to use
 * @param {number} color1 - Primary color ID
 * @param {number} color2 - Secondary color ID
 * @param {number} color3 - Glow color ID
 * @param {boolean} glowEnabled - Whether glow is enabled
 * @param {string|null} imageRes - Image resolution quality ('uhd', 'hd', '' for low, or null for auto-detect)
 * @returns {Promise<Canvas|null>} A canvas for the icon, or null on failure
 */
async function buildIcon(iconType, iconID, color1, color2, color3, glowEnabled, imageRes = null) {
    // Default to 'hd' (medium quality) if imageRes is null
    if (imageRes === null) {
        imageRes = 'hd';
    }
    
    // Determine AnimDesc key name from iconType
    const animDescKeyMap = {
        5: 'robot',
        6: 'spider'
    };
    
    // Map icon types to names
    const typeNames = {
        0: 'player', 1: 'ship', 2: 'player_ball', 3: 'bird',
        4: 'dart', 5: 'robot', 6: 'spider', 7: 'swing', 8: 'jetpack'
    };
    const typeName = typeNames[iconType] || 'player';
    
    // If not a multipart icon type, use generateIcon directly
    if (!animDescKeyMap[iconType]) {
        const iconArray = await generateIcon(
            iconType,
            iconID,
            color1,
            color2,
            color3,
            glowEnabled,
            null,
            false,
            imageRes
        );
        
        if (!iconArray) return null;
        
        // Get the full icon or first piece
        const iconImage = iconArray['full'] || Object.values(iconArray)[0];
        
        if (!iconImage) return null;
        
        // Crop to edges to remove any extra transparent space
        return cropToEdges(iconImage);
    }
    
    const animDescKey = animDescKeyMap[iconType];
    
    // Load AnimDesc JSON file
    const jsonPath = path.join(resourcesPath, 'AnimDesc.json');
    if (!fs.existsSync(jsonPath)) {
        return null;
    }
    
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const animDescData = JSON.parse(jsonContent);
    if (!animDescData || !animDescData[animDescKey]) {
        return null;
    }
    
    // Get the sprite data for the requested icon type
    const animDesc = animDescData[animDescKey];
    
    if (!animDesc || Object.keys(animDesc).length === 0) {
        return null;
    }
    
    // Parse sprites and apply transformations (without glow first)
    const sprites = [];
    const glowSprites = [];
    
    for (const spriteKey of Object.keys(animDesc)) {
        const spriteData = animDesc[spriteKey];
        
        // Extract data
        const pieceNum = parseInt(spriteData.piece);
        const position = parseVector2(spriteData.position);
        const scale = parseVector2(spriteData.scale);
        const rotation = parseFloat(spriteData.rotation);
        const flipped = parseVector2(spriteData.flipped);
        const zValue = parseInt(spriteData.zValue);
        
        // Get piece from generateIcon (without glow)
        const iconResult = await generateIcon(
            iconType,
            iconID,
            color1,
            color2,
            color3,
            false, // No glow for main pieces
            pieceNum,
            false, // glowOnly = false
            imageRes
        );
        
        if (iconResult) {
            // Get the piece (it should be in the array with key matching the piece number)
            const pieceKey = String(pieceNum).padStart(2, '0');
            const originalPiece = iconResult[pieceKey] || Object.values(iconResult)[0];
            
            if (originalPiece) {
                // Crop piece to edges to remove empty space before transformation
                const piece = cropToEdges(originalPiece);
                
                // Apply transformations
                const transformed = transformPiece(piece, scale, rotation, flipped);
                
                sprites.push({
                    image: transformed,
                    position: position,
                    scale: scale,
                    flipped: flipped,
                    rotation: rotation,
                    piece: pieceNum,
                    zValue: zValue
                });
                
                // Clean up if cropped piece is different from original
                if (piece !== originalPiece) {
                    // Canvas cleanup handled by GC
                }
            }
        }
        
        // Get glow piece if glow is enabled
        if (glowEnabled) {
            const glowResult = await generateIcon(
                iconType,
                iconID,
                color1,
                color2,
                color3,
                true, // Glow enabled
                pieceNum,
                true, // glowOnly = true
                imageRes
            );
            
            if (glowResult) {
                const pieceKey = String(pieceNum).padStart(2, '0');
                const originalGlowPiece = glowResult[pieceKey] || Object.values(glowResult)[0];
                
                if (originalGlowPiece) {
                    // Crop glow piece to edges to remove empty space before transformation
                    const glowPiece = cropToEdges(originalGlowPiece);
                    
                    // Apply same transformations
                    const transformedGlow = transformPiece(glowPiece, scale, rotation, flipped);
                    
                    glowSprites.push({
                        image: transformedGlow,
                        position: position,
                        scale: scale,
                        flipped: flipped,
                        rotation: rotation,
                        piece: pieceNum,
                        zValue: -1 // Glow goes behind everything
                    });
                    
                    // Clean up if cropped glow piece is different from original
                    if (glowPiece !== originalGlowPiece) {
                        // Canvas cleanup handled by GC
                    }
                }
            }
        }
    }
    
    if (sprites.length === 0 && glowSprites.length === 0) {
        return null;
    }
    
    // Combine glow sprites (behind) with main sprites
    const allSprites = [...glowSprites, ...sprites];
    
    // Sort by zValue (ascending - lower zValue renders first/behind)
    allSprites.sort((a, b) => a.zValue - b.zValue);
    
    // Calculate scale factors based on image resolution
    // AnimDesc coordinates are based on HD (2x scale)
    // Quality scales: '' = 1x (low), 'hd' = 2x (medium), 'uhd' = 4x (high)
    let qualityScale = 2.0; // Default to HD (2x)
    if (imageRes === '') {
        qualityScale = 1.0; // Low quality (1x)
    } else if (imageRes === 'uhd') {
        qualityScale = 4.0; // UHD quality (4x)
    } else if (imageRes === 'hd') {
        qualityScale = 2.0; // HD quality (2x)
    }
    // If imageRes is null, use the actual loaded quality from generateIcon
    // We'll default to HD (2x) in this case
    
    // Base constants for HD (2x scale)
    const BASE_ICON_SIZE = 300;
    const BASE_SCALE_FACTOR = 2.15;
    
    // Scale constants based on quality
    const ICON_SIZE = BASE_ICON_SIZE * (qualityScale / 2.0);
    const SCALE_FACTOR = BASE_SCALE_FACTOR * (qualityScale / 2.0);
    
    // Calculate canvas size based on all transformed sprites
    let minX = 9999;
    let maxX = -9999;
    let minY = 9999;
    let maxY = -9999;
    
    for (const sprite of allSprites) {
        // Image is already transformed (scaled, flipped, rotated)
        const finalW = sprite.image.width;
        const finalH = sprite.image.height;
        const pos = sprite.position;
        const scale = sprite.scale;
        const flipped = sprite.flipped || { x: 0, y: 0 };
        const pieceNum = sprite.piece || -1;
        
        // Apply Java transformation: translate(position.x * 4.0, -position.y * 4.0)
        const translatedX = pos.x * SCALE_FACTOR;
        const translatedY = -pos.y * SCALE_FACTOR; // Y is inverted
        
        // After scale, adjust center: translate(ICON_WIDTH * (1 / (2 * scale.x) - 0.5), ...)
        // Avoid division by zero
        const scaleX = scale.x !== 0 ? scale.x : 1.0;
        const scaleY = scale.y !== 0 ? scale.y : 1.0;
        let centerAdjustX = ICON_SIZE * ((1 / (2 * scaleX)) - 0.5);
        let centerAdjustY = ICON_SIZE * ((1 / (2 * scaleY)) - 0.5);
        
        // For piece 02 (spider legs), try without center adjustment to fix displacement
        let finalX, finalY;
        if (pieceNum === 2) {
            finalX = translatedX;
            finalY = translatedY;
        } else {
            // If flipped horizontally, invert the center adjustment X
            if ((flipped.x || 0) === 1) {
                centerAdjustX = -centerAdjustX;
            }
            
            finalX = translatedX + centerAdjustX;
            finalY = translatedY + centerAdjustY;
        }
        
        // Calculate bounding box (position is center, use final dimensions)
        // For rotated images, we need to consider the diagonal to ensure we capture all corners
        const halfW = finalW / 2;
        const halfH = finalH / 2;
        
        // If rotated, calculate diagonal distance to ensure we capture all corners
        const rotation = sprite.rotation || 0;
        let x1, x2, y1, y2;
        if (rotation !== 0) {
            // Calculate diagonal to handle rotation
            const diagonal = Math.sqrt(halfW * halfW + halfH * halfH);
            x1 = finalX - diagonal;
            x2 = finalX + diagonal;
            y1 = finalY - diagonal;
            y2 = finalY + diagonal;
        } else {
            x1 = finalX - halfW;
            x2 = finalX + halfW;
            y1 = finalY - halfH;
            y2 = finalY + halfH;
        }
        
        if (x1 < minX) minX = x1;
        if (x2 > maxX) maxX = x2;
        if (y1 < minY) minY = y1;
        if (y2 > maxY) maxY = y2;
        
        // Special handling for spider (iconType 6) piece 02 - ensure we capture bottom edge correctly
        if (pieceNum === 2) {
            // For spider legs (piece 02), add extra buffer to bottom to ensure we capture all pixels
            const extraBottom = finalH * 0.5; // 50% extra buffer for bottom
            const y2WithBuffer = y2 + extraBottom;
            if (y2WithBuffer > maxY) maxY = y2WithBuffer;
        }
    }
    
    // Calculate canvas dimensions with padding to avoid clipping
    // Scale padding based on quality (like everything else)
    // Base padding of 50 for HD (2x), so scale accordingly
    const basePadding = 50;
    const padding = Math.ceil(basePadding * (qualityScale / 2.0));
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Ensure minimum size
    const canvasW = Math.max(1, Math.ceil(contentWidth + (padding * 2)));
    const canvasH = Math.max(1, Math.ceil(contentHeight + (padding * 2)));
    
    // Calculate offset to position content with padding
    const offsetX = -minX + padding;
    const offsetY = -minY + padding;
    
    // Create canvas with padding (we'll crop it later)
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);
    
    // Render all sprites (glow first, then main pieces)
    // Darkening factor for first 3 non-glow sprites
    const darkeningFactor = 0.50; // 50% brightness (50% darker)
    
    // Count non-glow sprites to identify first 3
    let nonGlowSpriteIndex = 0;
    
    for (const sprite of allSprites) {
        let img = sprite.image;
        const zValue = sprite.zValue || 0;
        const pos = sprite.position;
        const scale = sprite.scale || { x: 1.0, y: 1.0 };
        const flipped = sprite.flipped || { x: 0, y: 0 };
        
        // Darken first 3 non-glow sprites (zValue >= 0)
        if (zValue >= 0) {
            if (nonGlowSpriteIndex < 3) {
                const darkenedImg = darkenImage(img, darkeningFactor);
                if (darkenedImg && darkenedImg !== img) {
                    img = darkenedImg;
                }
            }
            nonGlowSpriteIndex++;
        }
        
        const w = img.width;
        const h = img.height;
        
        // Apply Java transformation logic
        // 1. translate(position.x * 4.0, -position.y * 4.0)
        const translatedX = pos.x * SCALE_FACTOR;
        const translatedY = -pos.y * SCALE_FACTOR; // Y is inverted
        
        // 2. scale(scale.x, scale.y) - already applied in transformPiece
        // 3. translate(ICON_WIDTH * (1 / (2 * scale.x) - 0.5), ICON_HEIGHT * (1 / (2 * scale.y) - 0.5))
        const scaleX = scale.x !== 0 ? scale.x : 1.0;
        const scaleY = scale.y !== 0 ? scale.y : 1.0;
        let centerAdjustX = ICON_SIZE * ((1 / (2 * scaleX)) - 0.5);
        let centerAdjustY = ICON_SIZE * ((1 / (2 * scaleY)) - 0.5);
        
        // Get piece number to check if special handling is needed
        const pieceNum = sprite.piece || -1;
        
        // For piece 02 (spider legs), try without center adjustment to fix displacement
        let finalX, finalY;
        if (pieceNum === 2) {
            finalX = translatedX;
            finalY = translatedY;
        } else {
            // If flipped horizontally, invert the center adjustment X
            if ((flipped.x || 0) === 1) {
                centerAdjustX = -centerAdjustX;
            }
            
            finalX = translatedX + centerAdjustX;
            finalY = translatedY + centerAdjustY;
        }
        
        // Get final dimensions (image is already scaled)
        const finalW = img.width;
        const finalH = img.height;
        
        // Convert to canvas coordinates (add offset to move from negative to positive)
        // Position is center, so subtract half width/height
        const canvasX = Math.round(finalX + offsetX - (finalW / 2));
        const canvasY = Math.round(finalY + offsetY - (finalH / 2));
        
        ctx.drawImage(img, canvasX, canvasY);
    }
    
    // Use getCropBounds to find actual content bounds and crop to remove all empty space
    const cropData = getCropBounds(canvas);
    if (cropData) {
        const croppedCanvas = createCanvas(cropData.width, cropData.height);
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCtx.clearRect(0, 0, cropData.width, cropData.height);
        
        croppedCtx.drawImage(canvas, cropData.x, cropData.y, cropData.width, cropData.height,
                            0, 0, cropData.width, cropData.height);
        return croppedCanvas;
    }
    
    return canvas;
}

module.exports = {
    generateLevelThumbnail,
    generateProfileIcon,
    generateProfileIconSet,
    resourcesPath
};
