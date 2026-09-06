const { createCanvas, loadImage } = require('@napi-rs/canvas');

async function loadImageSafe(url) {
    if (!url) return null;

    try {
        return await loadImage(url);
    } catch {
        return null;
    }
}

async function createStudentCard({
    guildName,
    guildIcon,
    avatar,
    studentName,
    discordId,
    score,
    rank,
    status = 'ACTIVE',
    season = 'SEASON 01'
}) {
    const canvas = createCanvas(1200, 675);
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, 1200, 675);
    bg.addColorStop(0, '#111827');
    bg.addColorStop(1, '#020617');

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 675);

    // Border
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 1160, 635);

    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(guildName || 'GAKURAN', 70, 85);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px sans-serif';
    ctx.fillText('私立学園  •  STUDENT ID CARD', 70, 125);

    // Server icon
    const serverImg = await loadImageSafe(guildIcon);

    if (serverImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(1090, 85, 45, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(serverImg, 1045, 40, 90, 90);
        ctx.restore();
    }

    // Avatar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(70, 170, 270, 270);

    const avatarImg = await loadImageSafe(avatar);

    if (avatarImg) {
        ctx.drawImage(avatarImg, 85, 185, 240, 240);
    }

    // Student
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px sans-serif';
    ctx.fillText('STUDENT', 390, 205);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(String(studentName || 'Unknown').slice(0, 25), 390, 250);

    // Discord ID
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px sans-serif';
    ctx.fillText('DISCORD ID', 390, 305);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '24px monospace';
    ctx.fillText(String(discordId), 390, 345);

    // Divider
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(390, 380);
    ctx.lineTo(1130, 380);
    ctx.stroke();

    // Stats
    drawStat(ctx, 'SCORE', String(score), 390, 455);
    drawStat(ctx, 'CLASS', String(rank), 650, 455);
    drawStat(ctx, 'STATUS', String(status), 390, 555);
    drawStat(ctx, 'SEASON', String(season), 650, 555);

    // Footer
    ctx.fillStyle = '#64748b';
    ctx.font = '18px sans-serif';
    ctx.fillText(`${guildName || 'GAKURAN'} ACADEMY`, 70, 620);

    ctx.textAlign = 'right';
    ctx.fillText('STUDENT RECORD', 1130, 620);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
}

function drawStat(ctx, label, value, x, y) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px sans-serif';
    ctx.fillText(label, x, y);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(value, x, y + 38);
}

module.exports = {
    createStudentCard
};
