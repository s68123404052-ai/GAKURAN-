const express = require('express');
const challenge = require('./services/challenge.service');
const scoreService = require('./services/score.service');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/verify/:id', (req, res) => {
    const studentId = req.params.id;
    const player = challenge.getPlayer(studentId);

    if (!player) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>GAKURAN Verification</title>
            </head>
            <body style="font-family:sans-serif;text-align:center;padding:60px">
                <h1 style="color:#FF1493">❌ INVALID</h1>
                <p>ไม่พบ Student ID นี้ในระบบ GAKURAN</p>
            </body>
            </html>
        `);
    }

    const rank = scoreService.class0f(player.score);

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>GAKURAN Student Verification</title>
        </head>
        <body style="font-family:sans-serif;background:#111827;color:white;text-align:center;padding:40px">
            <div style="max-width:500px;margin:auto;background:#1e293b;padding:30px;border-radius:20px">
                <h1 style="color:#FF69B4">🎓 GAKURAN ACADEMY</h1>
                <h2 style="color:#e8a0bf">✓ STUDENT VERIFIED</h2>

                <p><b>STUDENT</b></p>
                <p>${escapeHtml(player.display_name)}</p>

                <p><b>STUDENT ID</b></p>
                <p>${escapeHtml(player.discord_id)}</p>

                <p><b>SCORE</b></p>
                <p>${player.score}</p>

                <p><b>CLASS</b></p>
                <p>${escapeHtml(rank)}</p>

                <p style="color:#86efac">🟢 ACTIVE</p>
            </div>
        </body>
        </html>
    `);
});

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

app.listen(PORT, () => {
    console.log(`GAKURAN Verification Web Online: ${PORT}`);
});
