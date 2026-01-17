const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const resourcesPath = path.join(__dirname, '../resources');

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
 * @returns {Promise<Buffer|null>} Buffer de la imagen PNG del icono o null si el usuario no existe
 * @throws {Error} Si hay error al generar el icono o cargar assets
 */
async function generateProfileIcon(accountID) {
    try {
        const user = await db.queryOne(
            'SELECT iconType, icon, color1, color2, color3, accGlow FROM users WHERE extID = ?',
            [accountID]
        );

        if (!user) return null;

        const iconArray = await generateIcon(user.iconType, user.icon, user.color1, user.color2, user.color3, user.accGlow == 1, null, false);

        if (!iconArray) return null;

        // For normal icons, 'full' will exist. For multipart (robot/spider), it won't.
        const icon = iconArray['full'] || Object.values(iconArray)[0];
        if (!icon) return null;

        // Return buffer directly
        return icon.toBuffer('image/png');
    } catch (error) {
        console.error(`Error generando icono de perfil ${accountID}:`, error);
        return null;
    }
}

/**
 * Genera el conjunto completo de iconos de perfil (todos los tipos excepto el equipado)
 * Muestra todos los iconos secundarios del usuario (ship, ball, bird, etc.) en una sola imagen
 * @param {number} accountID - ID de la cuenta (extID) del usuario
 * @returns {Promise<Buffer|null>} Buffer de la imagen PNG con todos los iconos o null si hay error
 * @throws {Error} Si hay error al generar los iconos o cargar assets
 */
async function generateProfileIconSet(accountID) {
    try {
        const user = await db.queryOne('SELECT * FROM users WHERE extID = ?', [accountID]);
        if (!user) return null;

        const glow = user.accGlow == 1;
        const accs = {
            0: user.accIcon,
            1: user.accShip,
            2: user.accBall,
            3: user.accBird,
            4: user.accDart,
            5: user.accRobot,
            6: user.accSpider,
            7: user.accSwing
        };

        const iconsToDraw = [];
        for (const [type, iconID] of Object.entries(accs)) {
            if (parseInt(type) != user.iconType) {
                iconsToDraw.push({ type: parseInt(type), iconID });
            }
        }

        const iconW = 100;
        const iconH = 115;
        const sideMargin = 5;
        const canvasW = (iconsToDraw.length * iconW) + (sideMargin * 2);
        const canvasH = iconH;

        const canvas = createCanvas(canvasW, canvasH);
        const ctx = canvas.getContext('2d');

        // Fill transparent background
        ctx.clearRect(0, 0, canvasW, canvasH);

        let currentX = sideMargin;
        for (const { type, iconID } of iconsToDraw) {
            const iconResult = await generateIcon(type, iconID, user.color1, user.color2, user.color3, glow, 1, false);
            if (!iconResult) continue;

            const parts = iconResult['full'] ? [iconResult['full']] : Object.values(iconResult);
            for (const part of parts) {
                if (part) {
                    const pW = part.width;
                    const pH = part.height;
                    const posY = (canvasH - pH) / 2;
                    const offsetX = (iconW - pW) / 2;
                    ctx.drawImage(part, currentX + offsetX, posY, pW, pH);
                }
            }
            currentX += iconW;
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
 * @param {boolean} saveImage - Si guardar la imagen en disco (no usado actualmente, mantiene compatibilidad)
 * @returns {Promise<Object|false>} Objeto con los iconos generados { 'full': Canvas, '01': Canvas, ... } o false si hay error
 * @throws {Error} Si los archivos PLIST/PNG no existen o hay error al parsear
 */
async function generateIcon(iconType, id, color1Id, color2Id, color3Id, glowEnabled, targetPart, saveImage) {
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

        const plistFile = path.join(resourcesPath, 'icons', `${baseName}-hd.plist`);
        const spriteSheetFile = path.join(resourcesPath, 'icons', `${baseName}-hd.png`);

        if (!fs.existsSync(plistFile) || !fs.existsSync(spriteSheetFile)) {
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

            if (n.includes('_glow_')) {
                if (!glowEnabled) continue;
                order = 1;
                tint = c3;
            } else if (n.includes('_3_')) {
                order = 2;
                useTint = false;
            } else if (n.includes('_2_')) {
                order = 3;
                tint = c2;
            } else if (n.includes('extra')) {
                order = 5;
                useTint = false;
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

module.exports = {
    generateLevelThumbnail,
    generateProfileIcon,
    generateProfileIconSet,
    resourcesPath
};
