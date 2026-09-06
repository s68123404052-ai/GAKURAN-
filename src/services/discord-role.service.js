const scoreService = require('./score.service');

const ROLE_NAMES = [
    'UNRANKED',
    'ROOKIE',
    'STUDENT',
    'ELITE STUDENT',
    'PREFECT',
    'EXECUTIVE',
    'VETERAN',
    'ELITE',
    'MASTER',
    'CHAMPION',
    'GRAND CHAMPION',
    'OVERLORD',
    'IMMORTAL',
    'SUPREME',
    'ASCENDANT',
    'EMPEROR',
    'MYTHIC',
    'LEGEND',
    'LEGENDARY',
    'GOD',
    'GODLIKE'
];

async function syncRole(member, score) {
    const rank = scoreService.class0f(score);

    const rankRoles = member.guild.roles.cache.filter(role =>
        ROLE_NAMES.includes(role.name)
    );

    const targetRole = rankRoles.find(role => role.name === rank);

    if (!targetRole) {
        return {
            success: false,
            reason: 'ROLE_NOT_FOUND',
            rank
        };
    }

    const oldRoles = rankRoles.filter(role =>
        member.roles.cache.has(role.id) && role.id !== targetRole.id
    );

    for (const role of oldRoles.values()) {
        await member.roles.remove(role);
    }

    if (!member.roles.cache.has(targetRole.id)) {
        await member.roles.add(targetRole);
    }

    return {
        success: true,
        rank,
        roleId: targetRole.id
    };
}

module.exports = {
    ROLE_NAMES,
    syncRole
};
