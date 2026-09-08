const fs = require('node:fs');
const path = require('node:path');

const Database = require('better-sqlite3');
const { db } = require('../database');

const dataDir = path.join(__dirname, '..', '..', 'data');
const backupDir = path.join(dataDir, 'backups');

function ensureBackupDir() {
    fs.mkdirSync(backupDir, { recursive: true });
}

async function createBackup(label = 'manual') {
    ensureBackupDir();

    const safeLabel = String(label)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40) || 'manual';

    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');

    const filename = `gakuran-${safeLabel}-${timestamp}.sqlite`;
    const destination = path.join(backupDir, filename);

    await db.backup(destination);

    return {
        filename,
        path: destination
    };
}

function listBackups() {
    ensureBackupDir();

    return fs.readdirSync(backupDir)
        .filter(name => name.endsWith('.sqlite'))
        .sort()
        .reverse();
}

function getBackupPath(filename) {
    ensureBackupDir();

    const safeName = path.basename(String(filename));

    if (!safeName.endsWith('.sqlite')) {
        throw new Error('INVALID_BACKUP_FILE');
    }

    const backupPath = path.join(backupDir, safeName);

    if (!fs.existsSync(backupPath)) {
        throw new Error('BACKUP_NOT_FOUND');
    }

    return backupPath;
}

async function restoreBackup(filename, destination) {
    const backupPath = getBackupPath(filename);

    const target = path.resolve(destination);

    await new Database(backupPath).backup(target);

    return {
        source: backupPath,
        destination: target
    };
}

module.exports = {
    createBackup,
    listBackups,
    getBackupPath,
    restoreBackup
};
