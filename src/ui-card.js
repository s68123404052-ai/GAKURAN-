const { createCanvas } = require('@napi-rs/canvas');

function createCard({ title, subtitle, color = '#e8a0bf', lines = [], width = 1200, height = 675 }) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f7f4f5';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(45, 45, width - 90, height - 90);

    ctx.strokeStyle = '#ddd5d8';
    ctx.lineWidth = 2;
    ctx.strokeRect(45, 45, width - 90, height - 90);

    ctx.fillStyle = '#222222';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText('GAKURAN ACADEMY', 80, 105);

    ctx.fillStyle = '#8d7b83';
    ctx.font = '18px sans-serif';
    ctx.fillText('PRIVATE SCHOOL  •  OFFICIAL RECORD', 82, 135);

    ctx.fillStyle = color;
    ctx.fillRect(80, 160, 1040, 4);

    ctx.fillStyle = '#222222';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(title, 80, 215);

    ctx.fillStyle = '#777777';
    ctx.font = '19px sans-serif';
    ctx.fillText(String(subtitle || '').slice(0, 70), 82, 247);

    let y = 285;

    for (const line of lines.slice(0, 7)) {
        const text = String(line);
        const parts = text.split(':');
        const label = parts.shift().trim();
        const value = parts.join(':').trim();

        ctx.strokeStyle = '#e7e0e3';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(80, y + 52);
        ctx.lineTo(1120, y + 52);
        ctx.stroke();

        ctx.fillStyle = '#8d7b83';
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(label.toUpperCase(), 85, y + 30);

        ctx.fillStyle = '#222222';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(value.slice(0, 55), 1110, y + 30);
        ctx.textAlign = 'left';

        y += 58;
    }

    return canvas.toBuffer('image/png');
}

module.exports = { createCard };
