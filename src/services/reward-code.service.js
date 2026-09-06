const { db, now, txId } = require('../database');
const challenge = require('./challenge.service');

function normalizeCode(code) {
    return String(code || '').trim().toUpperCase();
}

function createCode({ code, amount, maxUses, expiresAt, createdBy }) {
    const normalized = normalizeCode(code);

    if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) {
        throw new Error('INVALID_CODE');
    }

    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error('INVALID_AMOUNT');
    }

    if (!Number.isInteger(maxUses) || maxUses <= 0) {
        throw new Error('INVALID_MAX_USES');
    }

    if (
        expiresAt !== null &&
        expiresAt !== undefined &&
        (!Number.isInteger(expiresAt) || expiresAt <= now())
    ) {
        throw new Error('INVALID_EXPIRES_AT');
    }

    try {
        const result = db.prepare(`
            INSERT INTO reward_codes
            (code, amount, max_uses, expires_at, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            normalized,
            amount,
            maxUses,
            expiresAt ?? null,
            createdBy,
            now()
        );

        return db.prepare(
            'SELECT * FROM reward_codes WHERE id=?'
        ).get(result.lastInsertRowid);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            throw new Error('CODE_ALREADY_EXISTS');
        }
        throw error;
    }
}

function redeemCode({ code, playerId }) {
    const normalized = normalizeCode(code);

    const transaction = db.transaction(() => {
        const rewardCode = db.prepare(
            'SELECT * FROM reward_codes WHERE code=?'
        ).get(normalized);

        if (!rewardCode) {
            throw new Error('CODE_NOT_FOUND');
        }

        if (rewardCode.disabled) {
            throw new Error('CODE_DISABLED');
        }

        if (
            rewardCode.expires_at !== null &&
            rewardCode.expires_at <= now()
        ) {
            throw new Error('CODE_EXPIRED');
        }

        if (rewardCode.uses_count >= rewardCode.max_uses) {
            throw new Error('CODE_LIMIT_REACHED');
        }

        const player = challenge.getPlayer(playerId);

        if (!player) {
            throw new Error('PLAYER_NOT_FOUND');
        }

        const used = db.prepare(`
            SELECT 1
            FROM reward_code_uses
            WHERE code_id=? AND player_id=?
        `).get(rewardCode.id, player.player_id);

        if (used) {
            throw new Error('CODE_ALREADY_USED');
        }

        const before = player.score;
        const after = before + rewardCode.amount;
        const transactionId = txId('CODE');

        db.prepare(`
            UPDATE players
            SET score=?, updated_at=?
            WHERE discord_id=?
        `).run(after, now(), playerId);

        db.prepare(`
            INSERT INTO reward_code_uses
            (code_id, player_id, amount, created_at)
            VALUES (?, ?, ?, ?)
        `).run(
            rewardCode.id,
            player.player_id,
            rewardCode.amount,
            now()
        );

        db.prepare(`
            UPDATE reward_codes
            SET uses_count=uses_count+1
            WHERE id=?
        `).run(rewardCode.id);

        db.prepare(`
            INSERT INTO score_logs
            (player_id, match_id, before_score, change, after_score,
             reason, source, admin_id, transaction_id, created_at)
            VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?)
        `).run(
            player.player_id,
            before,
            rewardCode.amount,
            after,
            `Reward Code: ${rewardCode.code}`,
            'REWARD_CODE',
            transactionId,
            now()
        );

        db.prepare(`
            INSERT INTO audit_logs
            (actor_id, action, target_type, target_id,
             before_json, after_json, reason, transaction_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            playerId,
            'REDEEM_REWARD_CODE',
            'PLAYER',
            player.player_id,
            JSON.stringify({ score: before }),
            JSON.stringify({ score: after }),
            `Reward Code: ${rewardCode.code}`,
            transactionId,
            now()
        );

        return {
            code: rewardCode.code,
            amount: rewardCode.amount,
            before,
            after,
            transactionId
        };
    });

    return transaction();
}

function listCodes() {
    return db.prepare(`
        SELECT *
        FROM reward_codes
        ORDER BY id DESC
    `).all();
}

function disableCode(code) {
    const normalized = normalizeCode(code);

    const result = db.prepare(`
        UPDATE reward_codes
        SET disabled=1
        WHERE code=?
    `).run(normalized);

    if (!result.changes) {
        throw new Error('CODE_NOT_FOUND');
    }

    return db.prepare(
        'SELECT * FROM reward_codes WHERE code=?'
    ).get(normalized);
}

module.exports = {
    normalizeCode,
    createCode,
    redeemCode,
    listCodes,
    disableCode
};
