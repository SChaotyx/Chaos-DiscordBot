const mysql = require('mysql2/promise');
require('dotenv').config();

// Validar variables de entorno de base de datos
function validateDbConfig() {
    const required = ['DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(`Variables de entorno faltantes para la BD: ${missing.join(', ')}`);
    }
}

// Crear pool de conexiones
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

/**
 * Valida la conexión a la base de datos
 * @returns {Promise<boolean>} true si la conexión es exitosa
 */
async function testConnection() {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error.message);
        return false;
    }
}

/**
 * Ejecuta una query y retorna los resultados
 * @param {string} sql - Query SQL con placeholders (?)
 * @param {array} params - Parámetros para la query
 * @returns {Promise<Array>} Resultados de la query
 * @throws {Error} Si la query falla o los parámetros son inválidos
 */
async function query(sql, params = []) {
    if (!sql || typeof sql !== 'string') {
        throw new Error('SQL query debe ser una cadena de texto válida');
    }
    
    if (!Array.isArray(params)) {
        throw new Error('Los parámetros deben ser un array');
    }
    
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('Error en query a la BD:', {
            message: error.message,
            code: error.code,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage
        });
        throw error;
    }
}

/**
 * Ejecuta una query y retorna solo la primera fila
 * @param {string} sql - Query SQL con placeholders (?)
 * @param {array} params - Parámetros para la query
 * @returns {Promise<Object|null>} Primera fila o null si no hay resultados
 * @throws {Error} Si la query falla
 */
async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

/**
 * Cierra el pool de conexiones de forma ordenada
 * @returns {Promise<void>}
 */
async function closePool() {
    try {
        await pool.end();
        console.log('Pool de conexiones cerrado correctamente');
    } catch (error) {
        console.error('Error al cerrar el pool de conexiones:', error);
        throw error;
    }
}

// Validar configuración al cargar el módulo
try {
    validateDbConfig();
} catch (error) {
    console.warn('⚠️ Advertencia de configuración de BD:', error.message);
}

module.exports = {
    pool,
    query,
    queryOne,
    testConnection,
    closePool
};
