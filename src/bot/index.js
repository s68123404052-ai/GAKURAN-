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
const { db } = require('../database');

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
        .addStringOption(o =>
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
        .setName('daily')
        .setDescription('รับคะแนน Daily Login +10'),

    new SlashCommandBuilder()
        .setName('event-reward')
        .setDescription('แจกคะแนนกิจกรรม (Admin)')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('ผู้เล่น')
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName('event_id')
                .setDescription('รหัสกิจกรรม')
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName('type')
                .setDescription('ประเภทโบนัส')
                .setRequired(true)
                .addChoices(
                    { name: 'เข้าร่วม +15', value: 'PARTICIPATE' },
                    { name: 'ชนะทีม +30', value: 'WINNER' },
                    { name: 'MVP +45', value: 'MVP' }
                )
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

        if (cmd === 'event-reward') {
          if (!isAdmin(interaction)) {
            return interaction.reply({
              content: '❌ เฉพาะ Administrator เท่านั้น',
              ephemeral: true
            });
          }

          const target = interaction.options.getUser('user');
          const eventId = interaction.options.getString('event_id');
          const type = interaction.options.getString('type');

          const amounts = {
            PARTICIPATE: 15,
            WINNER: 30,
            MVP: 45
          };

          const amount = amounts[type];
          if (!amount) {
            return interaction.reply({
              content: '❌ ประเภทโบนัสไม่ถูกต้อง',
              ephemeral: true
            });
          }

          const player = challenge.getPlayer(target.id);

          if (!player) {
            return interaction.reply({
              content: '❌ ผู้เล่นยังไม่ได้ลงทะเบียน',
              ephemeral: true
            });
          }

          const exists = db.prepare(
            'SELECT 1 FROM event_rewards WHERE event_id=? AND player_id=? AND reward_type=?'
          ).get(eventId, target.id, type);

          if (exists) {
            return interaction.reply({
              content: '❌ ผู้เล่นได้รับโบนัสประเภทนี้ใน Event นี้ไปแล้ว',
              ephemeral: true
            });
          }

          const before = player.score;
          const after = before + amount;

          db.prepare(
            'UPDATE players SET score=? WHERE discord_id=?'
          ).run(after, target.id);

          db.prepare(
            'INSERT INTO event_rewards(event_id,player_id,reward_type,amount,created_at) VALUES(?,?,?,?,?)'
          ).run(eventId, target.id, type, amount, Math.floor(Date.now() / 1000));

          const embed = new EmbedBuilder()
            .setColor('#e8a0bf')
            .setAuthor({ name: 'GAKURAN ACADEMY' })
            .setTitle('EVENT REWARD')
            .setDescription('Event Bonus • イベント報酬')
            .addFields(
              { name: 'PLAYER', value: `<@${target.id}>`, inline: true },
              { name: 'TYPE', value: `**${type}**`, inline: true },
              { name: 'BONUS', value: `**+${amount} POINTS**`, inline: true },
              { name: 'SCORE', value: `**${before} → ${after}**`, inline: true },
              { name: 'EVENT', value: `\`${eventId}\``, inline: true }
            )
            .setFooter({
              text: 'GAKURAN ACADEMY • EVENT REWARD'
            })
            .setTimestamp();

          return interaction.reply({
            embeds: [embed]
          });
        }

        if (cmd === 'daily') {
          const result = bonus.claimDaily(interaction.user.id);

          if (!result.claimed) {
            return interaction.reply({
              content: '❌ คุณรับ Daily Login ไปแล้ววันนี้',
              ephemeral: true
            });
          }

          const embed = new EmbedBuilder()
            .setColor('#e8a0bf')
            .setAuthor({ name: 'GAKURAN ACADEMY' })
            .setTitle('☀️ DAILY LOGIN')
            .setDescription('Daily Login Bonus • デイリーログイン')
            .addFields(
              { name: 'BONUS', value: '**+10 POINTS**', inline: true },
              { name: 'SCORE', value: `**${result.before} → ${result.after}**`, inline: true }
            )
            .setFooter({
              text: 'GAKURAN ACADEMY • DAILY REWARD'
            })
            .setTimestamp();

          return interaction.reply({
            embeds: [embed]
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
            const rows = db.prepare(`
                SELECT discord_id, display_name, score
                FROM players
                ORDER BY score DESC, id ASC
                LIMIT 10
            `).all();

            if (!rows.length) {
                return interaction.reply('ยังไม่มีผู้เล่น');
            }

            const embed = new EmbedBuilder()
                .setColor('#e8a0bf')
                .setAuthor({ name: 'GAKURAN ACADEMY' })
                .setTitle('🏆 STUDENT RANKING')
                .setDescription('TOP 10 STUDENTS • 学生ランキング')
                .addFields(
                    rows.map((p, i) => ({
                        name: `#${i + 1}  ${p.display_name || p.discord_id}`,
                        value: `**${p.score}** points • ${scoreService.class0f(p.score)}`,
                        inline: false
                    }))
                )
                .setFooter({
                    text: 'GAKURAN ACADEMY • OFFICIAL RANKING'
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        if (cmd === 'history') {
            const id = getUserId(interaction);

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

            const embed = new EmbedBuilder()
                .setColor('#e8a0bf')
                .setAuthor({ name: 'GAKURAN ACADEMY' })
                .setTitle('📜 MATCH HISTORY')
                .setDescription('RECENT MATCHES • 試合履歴')
                .addFields(
                    rows.map((m, i) => ({
                        name: `#${i + 1}  MATCH ${m.match_code}`,
                        value: `Status: **${m.status}** • Result: **${m.result || '-'}**`,
                        inline: false
                    }))
                )
                .setFooter({
                    text: 'GAKURAN ACADEMY • OFFICIAL MATCH RECORD'
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
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

    const embed = new EmbedBuilder()
      .setColor('#e8a0bf')
      .setAuthor({ name: 'GAKURAN ACADEMY' })
      .setTitle('⚔️ CHALLENGE REQUEST')
      .setDescription('対戦申請 • MATCH CHALLENGE')
      .addFields(
        {
          name: '👤 CHALLENGER',
          value: `**${interaction.user.username}**`,
          inline: true
        },
        {
          name: '🎯 TARGET',
          value: `**${target.username}**`,
          inline: true
        },
        {
          name: '🆔 CHALLENGE ID',
          value: `**${result.challenge_code}**`,
          inline: false
        },
        {
          name: '📝 REASON',
          value: reason || '-',
          inline: false
        }
      )
      .setFooter({
        text: 'GAKURAN ACADEMY • OFFICIAL CHALLENGE'
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
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
    const id = interaction.options.getString('id');

    const result = challenge.acceptChallenge(
      String(id),
      interaction.user.id
    );

    const embed = new EmbedBuilder()
      .setColor('#e8a0bf')
      .setAuthor({ name: 'GAKURAN ACADEMY' })
      .setTitle('✅ CHALLENGE ACCEPTED')
      .setDescription('対戦承認 • CHALLENGE ACCEPTED')
      .addFields(
        {
          name: '🆔 CHALLENGE ID',
          value: `**${id}**`,
          inline: true
        },
        {
          name: '⚔️ MATCH CODE',
          value: `**${result.match_code}**`,
          inline: true
        },
        {
          name: '👤 STUDENT',
          value: `**${interaction.user.username}**`,
          inline: false
        },
        {
          name: '📌 STATUS',
          value: '**ACCEPTED**',
          inline: false
        }
      )
      .setFooter({
        text: 'GAKURAN ACADEMY • OFFICIAL CHALLENGE'
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
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
  try {
    const id = interaction.options.getString('id');

    challenge.decline(id, interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor('#e8a0bf')
      .setAuthor({ name: 'GAKURAN ACADEMY' })
      .setTitle('❌ CHALLENGE DECLINED')
      .setDescription('対戦辞退 • CHALLENGE DECLINED')
      .addFields(
        {
          name: '🆔 CHALLENGE ID',
          value: `**${id}**`,
          inline: true
        },
        {
          name: '👤 STUDENT',
          value: `**${interaction.user.username}**`,
          inline: true
        },
        {
          name: '📌 STATUS',
          value: '**DECLINED**',
          inline: false
        }
      )
      .setFooter({
        text: 'GAKURAN ACADEMY • OFFICIAL CHALLENGE'
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });

  } catch (error) {
    console.error('DECLINE ERROR:', error);

    return interaction.reply({
      content: `ไม่สามารถดำเนินการได้: ${error.message}`,
      ephemeral: true
    });
  }
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
            const embed = new EmbedBuilder()
                .setColor('#e8a0bf')
                .setAuthor({ name: 'GAKURAN ACADEMY' })
                .setTitle('🎓 RANK SYSTEM')
                .setDescription('CLASS RANKING • 学生ランクシステム')
                .addFields(
                    { name: '01 • UNRANKED', value: '**0 – 99** points', inline: true },
                    { name: '02 • ROOKIE', value: '**100 – 199** points', inline: true },
                    { name: '03 • STUDENT', value: '**200 – 299** points', inline: true },
                    { name: '04 • ELITE STUDENT', value: '**300 – 399** points', inline: true },
                    { name: '05 • PREFECT', value: '**400 – 499** points', inline: true },
                    { name: '06 • EXECUTIVE', value: '**500 – 599** points', inline: true },
                    { name: '07 • VETERAN', value: '**600 – 699** points', inline: true },
                    { name: '08 • ELITE', value: '**700 – 799** points', inline: true },
                    { name: '09 • MASTER', value: '**800 – 899** points', inline: true },
                    { name: '10 • CHAMPION', value: '**900 – 999** points', inline: true },
                    { name: '11 • GRAND CHAMPION', value: '**1000 – 1099** points', inline: true },
                    { name: '12 • OVERLORD', value: '**1100 – 1199** points', inline: true },
                    { name: '13 • IMMORTAL', value: '**1200 – 1299** points', inline: true },
                    { name: '14 • SUPREME', value: '**1300 – 1399** points', inline: true },
                    { name: '15 • ASCENDANT', value: '**1400 – 1499** points', inline: true },
                    { name: '16 • EMPEROR', value: '**1500 – 1599** points', inline: true },
                    { name: '17 • MYTHIC', value: '**1600 – 1699** points', inline: true },
                    { name: '18 • LEGEND', value: '**1700 – 1799** points', inline: true },
                    { name: '19 • LEGENDARY', value: '**1800 – 1899** points', inline: true },
                    { name: '20 • GOD', value: '**1900 – 1999** points', inline: true },
                    { name: '21 • GODLIKE', value: '**2000+** points', inline: true }
                )
                .setFooter({
                    text: 'GAKURAN ACADEMY • OFFICIAL RANK SYSTEM'
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
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

            const embed = new EmbedBuilder()
                .setColor('#e8a0bf')
                .setAuthor({
                    name: 'GAKURAN ACADEMY'
                })
                .setTitle('📊 STUDENT STATS')
                .setDescription(
                    `**${player.display_name || player.discord_id}**\n` +
                    `個人成績 • Personal Statistics`
                )
                .addFields(
                    {
                        name: '🏆 SCORE',
                        value: `**${player.score}**`,
                        inline: true
                    },
                    {
                        name: '🎓 CLASS',
                        value: `**${scoreService.class0f(player.score)}**`,
                        inline: true
                    },
                    {
                        name: '⚔️ MATCHES',
                        value: `**${total}**`,
                        inline: true
                    },
                    {
                        name: '✅ WINS',
                        value: `**${wins}**`,
                        inline: true
                    },
                    {
                        name: '❌ LOSSES',
                        value: `**${losses}**`,
                        inline: true
                    },
                    {
                        name: '➖ DRAWS',
                        value: `**${draws}**`,
                        inline: true
                    },
                    {
                        name: '📈 WIN RATE',
                        value: `**${winRate}%**`,
                        inline: false
                    }
                )
                .setFooter({
                    text: 'GAKURAN ACADEMY • OFFICIAL STUDENT RECORD'
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
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
