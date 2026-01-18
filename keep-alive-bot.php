<?php
/**
 * keep-alive-bot.php
 * 
 * Cron job para mantener activo el bot de Discord en Render
 * Evita que el bot entre en hibernación (Render Free tier hiberna después de 15 minutos)
 * 
 * Configurar en crontab: */10 * * * * /usr/bin/php /ruta/completa/keep-alive-bot.php
 * O ejecutar cada 10 minutos desde el panel de control de tu hosting
 */

// URL del bot en Render (cambia esto por tu URL real)
$botUrl = "https://tu-app.onrender.com/health";

// Configurar timeout
$timeout = 10; // segundos

// Inicializar cURL
$ch = curl_init($botUrl);

// Configurar opciones de cURL
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_USERAGENT, 'GDPS-Cron-KeepAlive/1.0');

// Ejecutar petición
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// Verificar resultado
if ($httpCode == 200) {
    // Éxito - el bot está activo
    error_log("✅ [Keep-Alive Bot] Ping exitoso - HTTP $httpCode - " . date('Y-m-d H:i:s'));
    exit(0);
} else {
    // Error - registrar pero no fallar
    error_log("⚠️ [Keep-Alive Bot] Ping falló - HTTP $httpCode" . ($error ? " - Error: $error" : "") . " - " . date('Y-m-d H:i:s'));
    exit(1);
}
?>
