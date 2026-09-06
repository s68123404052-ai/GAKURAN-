const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');

const challenge = require('../services/challenge.service');
const match = require('../services/match.service');
const scoreService = require('../services/score.service');
const bonus = require('../services/bonus.service');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1545387353143640176';
const GUILD_ID = process.env.GUILD_ID || '1238930251044880394';

if (!TOKEN) {
    console.error('ไม่พบ DISCORD_TOKEN');
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const commands = [
    new SlashCommandBuilder()
        .setName('register')
        .setDescription('ลงทะเบียนผู้เล่น'),

    new SlashCommandBuilder()
        .setName('score')
        .setDescription('ดูคะแนน')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('ผู้เล่น')
                .setRequired(false)
        ),


    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('ดูโปรไฟล์ผู้เล่น')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('ผู้เล่น')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('ดูอันดับคะแนน'),

    new SlashCommandBuilder()
        .setName('history')
        .setDescription('ดูประวัติการแข่ง')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('ผู้เล่น')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('ท้าดวล')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('คู่แข่ง')
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName('reason')
                .setDescription('เหตุผล')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('accept')
        .setDescription('ยอมรับคำท้า')
        .addIntegerOption(o =>
            o.setName('id')
                .setDescription('Challenge ID')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('decline')
        .setDescription('ปฏิเสธคำท้า')
        .addIntegerOption(o =>
            o.setName('id')
                .setDescription('Challenge ID')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('start')
        .setDescription('เริ่มการแข่งขัน')
        .addStringOption(o =>
            o.setName('code')
                .setDescription('Match Code')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('submit')
        .setDescription('ส่งหลักฐานการแข่งขัน')
        .addStringOption(o =>
            o.setName('code')
                .setDescription('Match Code')
                .setRequired(true)
        )
        .addAttachmentOption(o =>
            o.setName('evidence')
                .setDescription('หลักฐาน')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('verify')
        .setDescription('ยืนยันผลการแข่งขัน')
        .addStringOption(o =>
            o.setName('code')
                .setDescription('Match Code')
                .setRequired(true)
        )
        .addUserOption(o =>
            o.setName('winner')
                .setDescription('ผู้ชนะ')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('ดูชนชั้น')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('ผู้เล่น')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('match')
        .setDescription('ดูข้อมูล Match')
        .addStringOption(o =>
            o.setName('code')
                .setDescription('Match Code')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('evidence')
        .setDescription('ดูหลักฐาน Match')
        .addStringOption(o =>
            o.setName('code')
                .setDescription('Match Code')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('ดูสถิติผู้เล่น')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('ผู้เล่น')
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('draw')
        .setDescription('บันทึกผลเสมอ')
        .addStringOption(o =>
            o.setName('code')
                .setDescription('Match Code')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('cancel')
        .setDescription('ยกเลิก Match')
        .addStringOption(o =>
            o.setName('code')
                .setDescription('Match Code')
                .setRequired(true)
        )
].map(c => c.toJSON());

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
    );

    console.log('ลงทะเบียนคำสั่ง Slash Commands สำเร็จ');
}

function isAdmin(interaction) {
  return interaction.memberPermissions?.has('Administrator') ?? false;
}

function getUserId(interaction, name = 'user') {
  return interaction.options.getUser(name)?.id || interaction.user.id;
}

function formatPlayer(player) {
  if (!player) return 'ไม่พบผู้เล่น';

  return [
    `ผู้เล่น: ${player.display_name || player.discord_id}`,
    `Discord ID: ${player.discord_id}`,
    `คะแนน: ${player.score}`,
    `ชนชั้น: ${scoreService.class0f(player.score)}`
  ].join('\\n');
}

client.once('ready', () => {
    console.log(`Discord Bot Online: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const cmd = interaction.commandName;

        if (cmd === 'register') { console.log('DEBUG CLASS0F:', typeof scoreService.class0f);

const player = challenge.ensurePlayer({ discordId: interaction.user.id, displayName: interaction.user.username });

return interaction.reply({
                content: `ลงทะเบียนสำเร็จ\n${formatPlayer(player)}`
            });
        }

        if (cmd === 'score') {
            const id = getUserId(interaction);
            const player = challenge.getPlayer(id);

            if (!player) {
                return interaction.reply({
                    content: 'ยังไม่ได้ลงทะเบียน',
                    ephemeral: true
                });
            }

            return interaction.reply({
                content: formatPlayer(player)
            });
        }

        if (cmd === 'profile') {
            const id = getUserId(interaction);
            const player = challenge.getPlayer(id);

            if (!player) {
                return interaction.reply({
                    content: 'ยังไม่ได้ลงทะเบียน',
                    ephemeral: true
                });
            }

            const rank = scoreService.class0f(player.score);
            const avatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
            const serverLogo = interaction.guild?.iconURL({ extension: 'png', size: 256 });

            const embed = new EmbedBuilder()
                .setTitle('🏫 GAKURAN ACADEMY')
                .setDescription('**STUDENT ID CARD**')
                .setThumbnail(serverLogo || client.user.displayAvatarURL())
                .setImage(avatar)
                .addFields(
                    {
                        name: '👤 STUDENT',
                        value: `**${player.display_name || interaction.user.username}**`
                    },
                    {
                        name: '🪪 DISCORD ID',
                        value: `\`${player.discord_id}\``
                    },
                    {
                        name: '⭐ SCORE',
                        value: `**${player.score}**`,
                        inline: true
                    },
                    {
                        name: '🏅 CLASS',
                        value: `**${rank}**`,
                        inline: true
                    },
                    {
                        name: '🟢 STATUS',
                        value: '**ACTIVE**',
                        inline: true
                    }
                )
                .setFooter({ text: 'GAKURAN ACADEMY • STUDENT RECORD' })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        if (cmd === 'leaderboard') {
            const { db } = require('../database');
            const rows = db.prepare(`
                SELECT discord_id, display_name, score
                FROM players
                ORDER BY score DESC, id ASC
                LIMIT 10
            `).all();

            if (!rows.length) {
                return interaction.reply('ยังไม่มีผู้เล่น');
            }

            const text = rows.map((p, i) =>
                `#${i + 1} ${p.display_name || p.discord_id} — ${p.score} (${scoreService.class0f(p.score)})`
            ).join('\n');

            return interaction.reply(`🏆 Leaderboard\n${text}`);
        }

        if (cmd === 'history') {
            const id = getUserId(interaction);
            const { db } = require('../database');

            const rows = db.prepare(`
                SELECT match_code, player_a_id, player_b_id, status,
                       result, winner_id, loser_id, created_at
                FROM matches
                WHERE player_a_id=? OR player_b_id=?
                ORDER BY id DESC
                LIMIT 10
            `).all(id, id);

            if (!rows.length) {
                return interaction.reply('ยังไม่มีประวัติการแข่งขัน');
            }

            const text = rows.map(m =>
                `Match ${m.match_code} | ${m.status} | ${m.result || '-'}`
            ).join('\n');

            return interaction.reply(`📜 History\n${text}`);
        }

if (cmd === 'challenge') {
  try {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || null;

    console.log('DEBUG CHALLENGE:', {
      caller: interaction.user.id,
      target: target?.id,
      callerName: interaction.user.username,
      targetName: target?.username
    });

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: 'ไม่สามารถท้าตัวเองได้',
        ephemeral: true
      });
    }

    const result = challenge.createChallenge({
      challengerId: interaction.user.id,
      targetId: target.id,
      reason
    });

    return interaction.reply({
      content: `สร้างคำท้าแล้ว\nChallenge ID: ${result.challenge_code}`
    });

  } catch (error) {
    console.error('CHALLENGE ERROR:', error);

    return interaction.reply({
      content: `ไม่สามารถดำเนินการได้: ${error.message}`,
      ephemeral: true
    });
  }
}

if (cmd === 'accept') {
  try {
    const id = interaction.options.getInteger('id');

    const result = challenge.acceptChallenge(
      String(id),
      interaction.user.id
    );

    return interaction.reply({
      content: `รับคำท้าแล้ว\nMatch Code: ${result.match_code}`
    });
  } catch (error) {
    console.error('ACCEPT ERROR:', error);

    return interaction.reply({
      content: `ไม่สามารถดำเนินการได้: ${error.message}`,
      ephemeral: true
    });
  }
}

if (cmd === 'decline') {
            const id = interaction.options.getInteger('id');

            challenge.decline(id, interaction.user.id);

            return interaction.reply('❌ ปฏิเสธคำท้าแล้ว');
        }

        if (cmd === 'start') {
            const code = interaction.options.getString('code');

            const result = match.start(
                code,
                interaction.user.id
            );

            return interaction.reply(
                `▶️ Match ${code} เริ่มแล้ว\nสถานะ: ${result.status}`
            );
        }

        if (cmd === 'submit') {
            const code = interaction.options.getString('code');
            const attachment = interaction.options.getAttachment('evidence');

            const result = match.submitEvidence(
                code,
                interaction.user.id,
                attachment.url
            );

            return interaction.reply(
                `📎 ส่งหลักฐานแล้ว\nMatch: ${code}\nสถานะ: ${result.status}`
            );
        }

        if (cmd === 'verify') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    content: 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น',
                    ephemeral: true
                });
            }

            const code = interaction.options.getString('code');
            const winner = interaction.options.getUser('winner');

            const result = match.verify(
                code,
                winner.id,
                interaction.user.id
            );

            return interaction.reply(
                `✅ ยืนยันผล Match ${code} แล้ว\nสถานะ: ${result.status}`
            );
        }

        if (cmd === 'rank') {
            const id = getUserId(interaction);
            const player = challenge.getPlayer(id);

            if (!player) {
                return interaction.reply({
                    content: 'ยังไม่ได้ลงทะเบียน',
                    ephemeral: true
                });
            }

            return interaction.reply(
                `🏅 ${player.display_name || player.discord_id}\nชนชั้น: ${scoreService.class0f(player.score)}\nคะแนน: ${player.score}`
            );
        }

        if (cmd === 'match') {
            const code = interaction.options.getString('code');
            const result = match.get(code);

            if (!result) {
                return interaction.reply({
                    content: 'ไม่พบ Match นี้',
                    ephemeral: true
                });
            }

            return interaction.reply(
                `⚔️ Match ${code}\nสถานะ: ${result.status}\nผู้เล่น A: ${result.player_a_id}\nผู้เล่น B: ${result.player_b_id}`
            );
        }

        if (cmd === 'evidence') {
            const code = interaction.options.getString('code');
            const result = match.evidence(code);

            if (!result) {
                return interaction.reply({
                    content: 'ไม่พบหลักฐาน',
                    ephemeral: true
                });
            }

            return interaction.reply(
                `📎 หลักฐาน Match ${code}\n${result.attachment_url || 'ไม่มีหลักฐาน'}`
            );
        }

        if (cmd === 'stats') {
            const id = getUserId(interaction);
            const player = challenge.getPlayer(id);

            if (!player) {
                return interaction.reply({
                    content: 'ยังไม่ได้ลงทะเบียน',
                    ephemeral: true
                });
            }

            const { db } = require('../database');

            const rows = db.prepare(`
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN winner_id=? THEN 1 ELSE 0 END) AS wins,
                    SUM(CASE WHEN loser_id=? THEN 1 ELSE 0 END) AS losses,
                    SUM(CASE WHEN result='DRAW' THEN 1 ELSE 0 END) AS draws
                FROM matches
                WHERE status='VERIFIED'
                  AND (player_a_id=? OR player_b_id=?)
            `).get(id, id, id, id);

            const total = rows.total || 0;
            const wins = rows.wins || 0;
            const losses = rows.losses || 0;
            const draws = rows.draws || 0;
            const winRate = total ? ((wins / total) * 100).toFixed(1) : '0.0';

            return interaction.reply(
                `📊 สถิติ ${player.display_name || player.discord_id}\n` +
                `อันดับคะแนน: ดูจาก Leaderboard\n` +
                `คะแนน: ${player.score}\n` +
                `ชนชั้น: ${scoreService.class0f(player.score)}\n` +
                `แมตช์ทั้งหมด: ${total}\n` +
                `ชนะ: ${wins}\n` +
                `แพ้: ${losses}\n` +
                `เสมอ: ${draws}\n` +
                `Win Rate: ${winRate}%`
            );
        }

        if (cmd === 'draw') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    content: 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น',
                    ephemeral: true
                });
            }

            const code = interaction.options.getString('code');
            const result = match.result(code, 'DRAW');

            return interaction.reply(
                `🤝 Match ${code} เป็นผลเสมอแล้ว\nสถานะ: ${result.status}`
            );
        }

        if (cmd === 'cancel') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    content: 'คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น',
                    ephemeral: true
                });
            }

            const code = interaction.options.getString('code');

            const result = match.cancel(
                code,
                interaction.user.id,
                'Cancelled by Administrator'
            );

            return interaction.reply(
                `🚫 Match ${code} ถูกยกเลิกแล้ว\nสถานะ: ${result.status}`
            );
        }

    } catch (error) {
        console.error(error);

        const message = `ไม่สามารถดำเนินการได้: ${error.message}`;

        if (interaction.replied || interaction.deferred) {
            return interaction.followUp({
                content: message,
                ephemeral: true
            });
        }

        return interaction.reply({
            content: message,
            ephemeral: true
        });
    }
});

registerCommands()
    .then(() => client.login(TOKEN))
    .catch(error => {
        console.error('ไม่สามารถเริ่ม Discord Bot ได้:', error);
        process.exit(1);
    });
