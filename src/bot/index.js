require('dotenv').config();
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
const adminScore = require('../services/admin-score.service');
const backupService = require('../services/backup.service');
const bonus = require('../services/bonus.service');
const discordRole = require('../services/discord-role.service');
const rewardCode = require('../services/reward-code.service');
const { createStudentCard } = require('../student-card');
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
        .setName('sync-ranks')
        .setDescription('ซิงค์ Role ตามคะแนนผู้เล่นทั้งหมด (Admin)'),

    new SlashCommandBuilder()
        .setName('create-code')
        .setDescription('สร้าง Code แจกคะแนน (Admin)')
        .addStringOption(o =>
            o.setName('code')
                .setDescription('Code เช่น GAKURAN100')
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('amount')
                .setDescription('จำนวนคะแนน')
                .setMinValue(1)
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('max_uses')
                .setDescription('จำนวนครั้งที่ใช้ได้')
                .setMinValue(1)
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('expires_minutes')
                .setDescription('หมดอายุในกี่นาที (ไม่ใส่ = ไม่มีวันหมดอายุ)')
                .setMinValue(1)
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('redeem-code')
        .setDescription('ใช้ Code รับคะแนน')
        .addStringOption(o =>
            o.setName('code')
                .setDescription('Reward Code')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('add-score')
        .setDescription('เพิ่มคะแนนให้ผู้เล่น (Admin)')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('ผู้เล่น')
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('amount')
                .setDescription('จำนวนคะแนนที่เพิ่ม')
                .setMinValue(1)
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName('reason')
                .setDescription('เหตุผล')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('remove-score')
        .setDescription('หักคะแนนผู้เล่น (Admin)')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('ผู้เล่น')
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('amount')
                .setDescription('จำนวนคะแนนที่หัก')
                .setMinValue(1)
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName('reason')
                .setDescription('เหตุผล')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('set-score')
        .setDescription('ตั้งคะแนนผู้เล่นโดยตรง (Admin)')
        .addUserOption(o =>
            o.setName('user')
                .setDescription('ผู้เล่น')
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('score')
                .setDescription('คะแนนใหม่')
                .setMinValue(50)
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName('reason')
                .setDescription('เหตุผล')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('backup')
        .setDescription('สร้าง Database Backup (Admin)'),

    new SlashCommandBuilder()
        .setName('backups')
        .setDescription('ดูรายการ Database Backup (Admin)'),

    new SlashCommandBuilder()
        .setName('restore')
        .setDescription('กู้คืน Database จาก Backup (Admin)')
        .addStringOption(o =>
            o.setName('file')
                .setDescription('ชื่อไฟล์ Backup')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('admin-player')
        .setDescription('ดูข้อมูลผู้เล่นสำหรับ Admin')
        .addUserOption(o =>
            o.setName('player')
                .setDescription('ผู้เล่นที่ต้องการดู')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('admin-dashboard')
        .setDescription('ดูภาพรวมระบบ GAKURAN (Admin)'),

    new SlashCommandBuilder()
        .setName('admin-history')
        .setDescription('ดูประวัติการแก้คะแนนของ Admin (Admin)')
        .addIntegerOption(o =>
            o.setName('limit')
                .setDescription('จำนวนรายการ')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName('codes')
        .setDescription('ดู Reward Codes ทั้งหมด (Admin)'),

    new SlashCommandBuilder()
        .setName('disable-code')
        .setDescription('ปิด Reward Code (Admin)')
        .addStringOption(o =>
            o.setName('code')
                .setDescription('Reward Code')
                .setRequired(true)
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
        .setName('student')
        .setDescription('แสดง Student Card'),

    new SlashCommandBuilder()
        .setName('verify-student')
        .setDescription('ตรวจสอบ Student ID')
        .addStringOption(o =>
            o.setName('id')
                .setDescription('Discord ID ของนักเรียน')
                .setRequired(true)
        ),



    new SlashCommandBuilder()
        .setName('help')
        .setDescription('คู่มือการใช้งาน GAKURAN'),

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

client.once('clientReady', () => {
    console.log(`Discord Bot Online: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    try {
        const cmd = interaction.commandName;

        if (cmd === 'sync-ranks') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                            .setFooter({ text: 'GAKURAN • System' })
                    ],
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const players = challenge.getAllPlayers();

            let synced = 0;
            let failed = 0;
            let notInServer = 0;
            let bots = 0;

            for (const player of players) {
                try {
                    if (!/^\d{17,20}$/.test(String(player.discord_id))) {
                        notInServer++;
                        continue;
                    }

                    const member = await interaction.guild.members.fetch(player.discord_id);

                    if (!member) {
                        notInServer++;
                        continue;
                    }

                    if (member.user.bot) {
                        bots++;
                        continue;
                    }

                    const result = await discordRole.syncRole(member, player.score);

                    if (result.success) {
                        synced++;
                    } else {
                        failed++;
                    }
                } catch (error) {
                    failed++;
                    console.error(
                        `Sync rank skipped for ${player.discord_id}:`,
                        error.message
                    );
                }
            }

            return interaction.editReply(
                `✅ Sync Rank สำเร็จ\n` +
                `👥 ผู้เล่นในฐานข้อมูล: ${players.length}\n` +
                `🎖️ อัปเดต Role: ${synced}\n` +
                `👤 ไม่อยู่ในเซิร์ฟเวอร์: ${notInServer}\n` +
                `🤖 Bot: ${bots}\n` +
                `❌ ล้มเหลว: ${failed}`
            );
        }

        if (cmd === 'set-score') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                    ],
                    ephemeral: true
                });
            }

            const target = interaction.options.getUser('user', true);
            const score = interaction.options.getInteger('score', true);
            const reason = interaction.options.getString('reason', true);

            const result = adminScore.setScore({
                playerId: target.id,
                score,
                reason,
                adminId: interaction.user.id
            });

            let roleText = 'ไม่ได้ซิงค์ Role';

            try {
                const member = await interaction.guild.members.fetch(target.id);
                const roleResult = await discordRole.syncRole(member, result.after);

                roleText = roleResult.success
                    ? 'อัปเดต Rank Role สำเร็จ'
                    : 'อัปเดต Rank Role ไม่สำเร็จ';
            } catch (roleError) {
                console.error('SET SCORE ROLE SYNC ERROR:', roleError);
                roleText = 'ไม่สามารถซิงค์ Rank Role ได้';
            }

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF69B4)
                        .setTitle('🎯 ตั้งคะแนนสำเร็จ')
                        .setDescription(`ตั้งคะแนนให้ <@${target.id}> เรียบร้อยแล้ว`)
                        .addFields(
                            {
                                name: '📊 คะแนน',
                                value: `**${result.before} → ${result.after}** (${result.change >= 0 ? '+' : ''}${result.change})`,
                                inline: false
                            },
                            {
                                name: '🏅 Rank',
                                value: `**${scoreService.class0f(result.after)}**`,
                                inline: true
                            },
                            {
                                name: '📝 เหตุผล',
                                value: result.reason,
                                inline: true
                            },
                            {
                                name: '🎖️ Role',
                                value: roleText,
                                inline: false
                            }
                        )
                        .setFooter({ text: `GAKURAN • Admin Score • ${result.transactionId}` })
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }

        if (cmd === 'remove-score') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                    ],
                    ephemeral: true
                });
            }

            const target = interaction.options.getUser('user', true);
            const amount = interaction.options.getInteger('amount', true);
            const reason = interaction.options.getString('reason', true);

            const result = adminScore.changeScore({
                playerId: target.id,
                amount: -amount,
                reason,
                adminId: interaction.user.id
            });

            let roleText = 'ไม่ได้ซิงค์ Role';

            try {
                const member = await interaction.guild.members.fetch(target.id);
                const roleResult = await discordRole.syncRole(member, result.after);
                roleText = roleResult.success
                    ? 'อัปเดต Rank Role สำเร็จ'
                    : 'อัปเดต Rank Role ไม่สำเร็จ';
            } catch (roleError) {
                console.error('REMOVE SCORE ROLE SYNC ERROR:', roleError);
                roleText = 'ไม่สามารถซิงค์ Rank Role ได้';
            }

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF69B4)
                        .setTitle('📉 หักคะแนนสำเร็จ')
                        .setDescription(`หักคะแนนจาก <@${target.id}> เรียบร้อยแล้ว`)
                        .addFields(
                            {
                                name: '📊 คะแนน',
                                value: `**${result.before} → ${result.after}** (${result.change})`,
                                inline: false
                            },
                            {
                                name: '🏅 Rank',
                                value: `**${scoreService.class0f(result.after)}**`,
                                inline: true
                            },
                            {
                                name: '📝 เหตุผล',
                                value: result.reason,
                                inline: true
                            },
                            {
                                name: '🎖️ Role',
                                value: roleText,
                                inline: false
                            }
                        )
                        .setFooter({ text: `GAKURAN • Admin Score • ${result.transactionId}` })
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }

        if (cmd === 'add-score') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                    ],
                    ephemeral: true
                });
            }

            const target = interaction.options.getUser('user', true);
            const amount = interaction.options.getInteger('amount', true);
            const reason = interaction.options.getString('reason', true);

            try {
                const result = adminScore.changeScore({
                    playerId: target.id,
                    amount,
                    reason,
                    adminId: interaction.user.id
                });

                let roleText = 'ไม่ได้ซิงค์ Role';

                try {
                    const member = await interaction.guild.members.fetch(target.id);
                    const roleResult = await discordRole.syncRole(member, result.after);

                    roleText = roleResult.success
                        ? 'อัปเดต Rank Role สำเร็จ'
                        : 'อัปเดต Rank Role ไม่สำเร็จ';
                } catch (roleError) {
                    console.error('ADD SCORE ROLE SYNC ERROR:', roleError);
                    roleText = 'ไม่สามารถซิงค์ Rank Role ได้';
                }

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF69B4)
                            .setTitle('💰 เพิ่มคะแนนสำเร็จ')
                            .setDescription(`เพิ่มคะแนนให้ <@${target.id}> เรียบร้อยแล้ว`)
                            .addFields(
                                {
                                    name: '📊 คะแนน',
                                    value: `**${result.before} → ${result.after}** (+${result.change})`,
                                    inline: false
                                },
                                {
                                    name: '🏅 Rank',
                                    value: `**${scoreService.class0f(result.after)}**`,
                                    inline: true
                                },
                                {
                                    name: '📝 เหตุผล',
                                    value: result.reason,
                                    inline: true
                                },
                                {
                                    name: '🎖️ Role',
                                    value: roleText,
                                    inline: false
                                }
                            )
                            .setFooter({ text: `GAKURAN • Admin Score • ${result.transactionId}` })
                            .setTimestamp()
                    ],
                    ephemeral: true
                });
            } catch (error) {
                throw error;
            }
        }

        if (cmd === 'backups') {
    if (!isAdmin(interaction)) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF1493)
                    .setTitle('❌ ไม่มีสิทธิ์')
                    .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
            ],
            ephemeral: true
        });
    }

    const backups = backupService.listBackups();

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0xFF69B4)
                .setTitle('📂 GAKURAN BACKUPS')
                .setDescription(
                    backups.length
                        ? backups.map((file, i) => `**${i + 1}.** \`${file}\``).join('\n')
                        : 'ยังไม่มี Backup'
                )
                .setFooter({ text: `GAKURAN • Backup System • ${backups.length} file(s)` })
                .setTimestamp()
        ],
        ephemeral: true
    });
}

if (cmd === 'admin-player') {
    if (!isAdmin(interaction)) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF1493)
                    .setTitle('❌ ไม่มีสิทธิ์')
                    .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
            ],
            ephemeral: true
        });
    }

    const user = interaction.options.getUser('player');

    const player = db.prepare(`
        SELECT display_name, discord_id, score, wins, losses, draws,
               win_streak, created_at
        FROM players
        WHERE discord_id = ?
        LIMIT 1
    `).get(user.id);

    if (!player) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF1493)
                    .setTitle('❌ ไม่พบผู้เล่น')
                    .setDescription(`ไม่พบข้อมูล <@${user.id}> ในระบบ GAKURAN`)
            ],
            ephemeral: true
        });
    }

    const rank = scoreService.class0f(player.score);

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0xFF69B4)
                .setTitle('👤 ADMIN PLAYER MANAGER')
                .setDescription(`ข้อมูลผู้เล่น <@${player.discord_id}>`)
                .addFields(
                    { name: '🏷️ NAME', value: `**${player.display_name}**`, inline: true },
                    { name: '💯 SCORE', value: `**${player.score}**`, inline: true },
                    { name: '🏆 RANK', value: `**${rank}**`, inline: true },
                    { name: '⚔️ WINS', value: `**${player.wins}**`, inline: true },
                    { name: '💥 LOSSES', value: `**${player.losses}**`, inline: true },
                    { name: '🤝 DRAWS', value: `**${player.draws}**`, inline: true },
                    { name: '🔥 WIN STREAK', value: `**${player.win_streak}**`, inline: true }
                )
                .setFooter({ text: 'GAKURAN • ADMIN PLAYER MANAGER' })
                .setTimestamp()
        ],
        ephemeral: true
    });
}

if (cmd === 'admin-dashboard') {
    if (!isAdmin(interaction)) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF1493)
                    .setTitle('❌ ไม่มีสิทธิ์')
                    .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
            ],
            ephemeral: true
        });
    }

    const stats = db.prepare(`
        SELECT
            (SELECT COUNT(*) FROM players) AS players,
            (SELECT COUNT(*) FROM matches) AS matches,
            (SELECT COUNT(*) FROM audit_logs) AS audits,
            (SELECT COUNT(*) FROM reward_codes WHERE disabled = 0) AS active_codes,
            (SELECT COUNT(*) FROM score_logs) AS score_logs
    `).get();

    const top = db.prepare(`
        SELECT display_name, score
        FROM players
        ORDER BY score DESC, id ASC
        LIMIT 1
    `).get();

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0xFF69B4)
                .setTitle('🎛️ GAKURAN ADMIN DASHBOARD')
                .setDescription('ภาพรวมระบบ GAKURAN')
                .addFields(
                    { name: '👥 PLAYERS', value: `**${stats.players}**`, inline: true },
                    { name: '⚔️ MATCHES', value: `**${stats.matches}**`, inline: true },
                    { name: '📋 AUDIT LOGS', value: `**${stats.audits}**`, inline: true },
                    { name: '🎟️ ACTIVE CODES', value: `**${stats.active_codes}**`, inline: true },
                    { name: '📊 SCORE LOGS', value: `**${stats.score_logs}**`, inline: true },
                    { name: '🏆 TOP PLAYER', value: top ? `**${top.display_name}** — ${top.score} คะแนน` : '**ไม่มีข้อมูล**', inline: true }
                )
                .setFooter({ text: 'GAKURAN • ADMIN DASHBOARD' })
                .setTimestamp()
        ],
        ephemeral: true
    });
}

if (cmd === 'admin-history') {
    if (!isAdmin(interaction)) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF1493)
                    .setTitle('❌ ไม่มีสิทธิ์')
                    .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
            ],
            ephemeral: true
        });
    }

    const limit = interaction.options.getInteger('limit') ?? 10;

    const rows = db.prepare(`
        SELECT action, target_id, reason, transaction_id, created_at
        FROM audit_logs
        WHERE action IN ('ADMIN_SCORE_CHANGE', 'ADMIN_SCORE_SET')
        ORDER BY id DESC
        LIMIT ?
    `).all(limit);

    const description = rows.length
        ? rows.map((row, i) =>
            `**${i + 1}. ${row.action}**\n` +
            `👤 Target: <@${row.target_id}>\n` +
            `📝 ${row.reason}\n` +
            `🔑 \`${row.transaction_id}\``
        ).join('\n\n')
        : 'ยังไม่มีประวัติการแก้คะแนน';

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0xFF69B4)
                .setTitle('📋 ADMIN SCORE HISTORY')
                .setDescription(description)
                .setFooter({ text: `GAKURAN • Admin History • ${rows.length} record(s)` })
                .setTimestamp()
        ],
        ephemeral: true
    });
}

if (cmd === 'restore') {
    if (!isAdmin(interaction)) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF1493)
                    .setTitle('❌ ไม่มีสิทธิ์')
                    .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
            ],
            ephemeral: true
        });
    }

    const file = interaction.options.getString('file', true);

    await interaction.deferReply({ ephemeral: true });

    try {
        await backupService.createBackup('pre-restore');

        const result = await backupService.restoreBackup(
            file,
            require('path').join(__dirname, '..', '..', 'data', 'gakuran-restored.sqlite')
        );

        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF69B4)
                    .setTitle('🔄 RESTORE สำเร็จ')
                    .setDescription('กู้คืน Database จาก Backup เรียบร้อยแล้ว')
                    .addFields(
                        {
                            name: '📁 Backup',
                            value: `\`${file}\``
                        },
                        {
                            name: '💾 Restore File',
                            value: `\`${result.destination}\``
                        }
                    )
                    .setFooter({ text: 'GAKURAN • Backup System' })
                    .setTimestamp()
            ]
        });
    } catch (error) {
        console.error('RESTORE ERROR:', error);
        throw error;
    }
}

if (cmd === 'backup') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                    ],
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const result = await backupService.createBackup('admin');

                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF69B4)
                            .setTitle('💾 BACKUP สำเร็จ')
                            .setDescription('สร้าง Database Backup เรียบร้อยแล้ว')
                            .addFields({
                                name: '📁 ไฟล์',
                                value: `\`${result.filename}\``
                            })
                            .setFooter({ text: 'GAKURAN • Backup System' })
                            .setTimestamp()
                    ]
                });
            } catch (error) {
                console.error('BACKUP ERROR:', error);
                throw error;
            }
        }

        if (cmd === 'create-code') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF69B4)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                    ],
                    ephemeral: true
                });
            }

            const code = interaction.options.getString('code', true);
            const amount = interaction.options.getInteger('amount', true);
            const maxUses = interaction.options.getInteger('max_uses', true);
            const expiresMinutes = interaction.options.getInteger('expires_minutes');

            const expiresAt = expiresMinutes
                ? Math.floor(Date.now() / 1000) + (expiresMinutes * 60)
                : null;

            try {
                const result = rewardCode.createCode({
                    code,
                    amount,
                    maxUses,
                    expiresAt,
                    createdBy: interaction.user.id
                });

                const expiryText = result.expires_at
                    ? `<t:${result.expires_at}:R>`
                    : 'ไม่มีวันหมดอายุ';

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF69B4)
                            .setTitle('🎁 สร้าง Reward Code สำเร็จ')
                            .addFields(
                                { name: '🎟️ Code', value: `\`${result.code}\``, inline: true },
                                { name: '💰 รางวัล', value: `+${result.amount} คะแนน`, inline: true },
                                { name: '👥 ใช้ได้', value: `${result.max_uses} ครั้ง`, inline: true },
                                { name: '⏳ หมดอายุ', value: expiryText, inline: false }
                            )
                            .setFooter({ text: 'GAKURAN • Reward System' })
                    ],
                    ephemeral: true
                });
            } catch (error) {
                const messages = {
                    INVALID_CODE: 'Code ต้องเป็น A-Z, 0-9, _ หรือ - และยาว 3-32 ตัวอักษร',
                    INVALID_AMOUNT: 'จำนวนคะแนนไม่ถูกต้อง',
                    INVALID_MAX_USES: 'จำนวนครั้งที่ใช้ไม่ถูกต้อง',
                    INVALID_EXPIRES_AT: 'เวลาหมดอายุไม่ถูกต้อง',
                    CODE_ALREADY_EXISTS: 'Code นี้มีอยู่แล้ว'
                };

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ สร้าง Reward Code ไม่สำเร็จ')
                            .setDescription(messages[error.message] || 'เกิดข้อผิดพลาดในการสร้าง Code')
                            .setFooter({ text: 'GAKURAN • Reward System' })
                    ],
                    ephemeral: true
                });
            }
        }

        if (cmd === 'redeem-code') {
            const code = interaction.options.getString('code', true);

            try {
                const result = rewardCode.redeemCode({
                    code,
                    playerId: interaction.user.id
                });

                let roleWarning = '';

                try {
                    const member = await interaction.guild.members.fetch(interaction.user.id);
                    await discordRole.syncRole(member, result.after);
                } catch (error) {
                    console.error(
                        `Reward Code role sync failed for ${interaction.user.id}:`,
                        error.message
                    );
                    roleWarning = '⚠️ ไม่สามารถอัปเดต Role อัตโนมัติได้';
                }

                const rank = scoreService.class0f(result.after);

                const embed = new EmbedBuilder()
                    .setColor(0xFF69B4)
                    .setTitle('🎁 ใช้ Reward Code สำเร็จ')
                    .addFields(
                        { name: '🎟️ Code', value: `\`${result.code}\``, inline: true },
                        { name: '💰 ได้รับ', value: `+${result.amount} คะแนน`, inline: true },
                        { name: '📊 คะแนน', value: `${result.before} → ${result.after}`, inline: true },
                        { name: '🏅 ชนชั้น', value: rank, inline: true }
                    )
                    .setFooter({ text: 'GAKURAN • Reward System' });

                if (roleWarning) {
                    embed.addFields({ name: '⚠️ แจ้งเตือน', value: roleWarning });
                }

                return interaction.reply({ embeds: [embed] });
            } catch (error) {
                const messages = {
                    CODE_NOT_FOUND: 'ไม่พบ Reward Code นี้',
                    CODE_DISABLED: 'Code นี้ถูกปิดใช้งานแล้ว',
                    CODE_EXPIRED: 'Code นี้หมดอายุแล้ว',
                    CODE_LIMIT_REACHED: 'Code นี้ถูกใช้ครบจำนวนแล้ว',
                    PLAYER_NOT_FOUND: 'คุณยังไม่ได้ลงทะเบียนผู้เล่น',
                    CODE_ALREADY_USED: 'คุณใช้ Code นี้ไปแล้ว'
                };

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่สามารถใช้ Reward Code')
                            .setDescription(messages[error.message] || 'เกิดข้อผิดพลาดในการใช้ Code')
                            .setFooter({ text: 'GAKURAN • Reward System' })
                    ],
                    ephemeral: true
                });
            }
        }

        if (cmd === 'codes') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                    ],
                    ephemeral: true
                });
            }

            const codes = rewardCode.listCodes();

            if (!codes.length) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF69B4)
                            .setTitle('🎟️ Reward Codes')
                            .setDescription('📭 ยังไม่มี Reward Code')
                            .setFooter({ text: 'GAKURAN • Reward System' })
                    ],
                    ephemeral: true
                });
            }

            const currentTime = Math.floor(Date.now() / 1000);

            const lines = codes.slice(0, 25).map(item => {
                let status = '🟢 ใช้งานได้';

                if (item.disabled) {
                    status = '🔴 ปิดใช้งาน';
                } else if (
                    item.expires_at !== null &&
                    item.expires_at <= currentTime
                ) {
                    status = '⏰ หมดอายุ';
                } else if (item.uses_count >= item.max_uses) {
                    status = '⚫ ใช้ครบแล้ว';
                }

                const expiry = item.expires_at
                    ? ` • <t:${item.expires_at}:R>`
                    : '';

                return `\`${item.code}\` • +${item.amount} • ${item.uses_count}/${item.max_uses}${expiry} • ${status}`;
            });

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF69B4)
                        .setTitle('🎟️ Reward Codes')
                        .setDescription(lines.join('\n'))
                        .setFooter({ text: 'GAKURAN • Reward System' })
                ],
                ephemeral: true
            });
        }

        if (cmd === 'disable-code') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                    ],
                    ephemeral: true
                });
            }

            const code = interaction.options.getString('code', true);

            try {
                const result = rewardCode.disableCode(code);

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF69B4)
                            .setTitle('🔒 ปิด Reward Code สำเร็จ')
                            .addFields({
                                name: '🎟️ Code',
                                value: `\`${result.code}\``
                            })
                            .setFooter({ text: 'GAKURAN • Reward System' })
                    ],
                    ephemeral: true
                });
            } catch (error) {
                const messages = {
                    CODE_NOT_FOUND: 'ไม่พบ Reward Code นี้'
                };

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ปิด Reward Code ไม่สำเร็จ')
                            .setDescription(messages[error.message] || 'เกิดข้อผิดพลาดในการปิด Code')
                            .setFooter({ text: 'GAKURAN • Reward System' })
                    ],
                    ephemeral: true
                });
            }
        }

        if (cmd === 'register') {

const player = challenge.ensurePlayer({ discordId: interaction.user.id, displayName: interaction.user.username });

return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF69B4)
                        .setTitle('📝 ลงทะเบียนสำเร็จ')
                        .setDescription(formatPlayer(player))
                        .setFooter({ text: 'GAKURAN • System' })
                ]
            });
        }

        if (cmd === 'score') {
            const id = getUserId(interaction);
            const player = challenge.getPlayer(id);

            if (!player) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ยังไม่ได้ลงทะเบียน')
                            .setDescription('กรุณาใช้ `/register` ก่อน')
                            .setFooter({ text: 'GAKURAN • System' })
                    ],
                    ephemeral: true
                });
            }

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#e8a0bf')
                        .setTitle('📊 ข้อมูลคะแนน')
                        .setDescription(formatPlayer(player))
                        .setFooter({ text: 'GAKURAN • System' })
                ]
            });
        }

        if (cmd === 'event-reward') {
          if (!isAdmin(interaction)) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xFF1493)
                  .setTitle('❌ ไม่มีสิทธิ์')
                  .setDescription('คำสั่งนี้ใช้ได้เฉพาะ Administrator เท่านั้น')
                  .setFooter({ text: 'GAKURAN • System' })
              ],
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
              embeds: [
                new EmbedBuilder()
                  .setColor(0xFF1493)
                  .setTitle('❌ ประเภทโบนัสไม่ถูกต้อง')
                  .setDescription('กรุณาเลือกประเภทโบนัสที่ระบบรองรับ')
                  .setFooter({ text: 'GAKURAN • Event Reward' })
              ],
              ephemeral: true
            });
          }

          const player = challenge.getPlayer(target.id);

          if (!player) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xFF1493)
                  .setTitle('❌ ผู้เล่นยังไม่ได้ลงทะเบียน')
                  .setDescription('ผู้เล่นคนนี้ต้องใช้ `/register` ก่อน')
                  .setFooter({ text: 'GAKURAN • Event Reward' })
              ],
              ephemeral: true
            });
          }

          const exists = db.prepare(
            'SELECT 1 FROM event_rewards WHERE event_id=? AND player_id=? AND reward_type=?'
          ).get(eventId, target.id, type);

          if (exists) {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xFF1493)
                  .setTitle('❌ รับโบนัสซ้ำไม่ได้')
                  .setDescription('ผู้เล่นได้รับโบนัสประเภทนี้ใน Event นี้ไปแล้ว')
                  .setFooter({ text: 'GAKURAN • Event Reward' })
              ],
              ephemeral: true
            });
          }

          const before = player.score;
          const after = before + amount;

          db.prepare(
            'UPDATE players SET score=? WHERE discord_id=?'
          ).run(after, target.id);

          const member = await interaction.guild.members.fetch(target.id);
          await discordRole.syncRole(member, after);

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
              embeds: [
                new EmbedBuilder()
                  .setColor(0xFF1493)
                  .setTitle('❌ รับ Daily Login แล้ว')
                  .setDescription('คุณได้รับ Daily Login ของวันนี้ไปแล้ว')
                  .setFooter({ text: 'GAKURAN • Daily Reward' })
              ],
              ephemeral: true
            });
          }

          const member = await interaction.guild.members.fetch(interaction.user.id);
          await discordRole.syncRole(member, result.after);

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
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ยังไม่ได้ลงทะเบียน')
                            .setDescription('กรุณาใช้ `/register` ก่อน')
                            .setFooter({ text: 'GAKURAN • System' })
                    ],
                    ephemeral: true
                });
            }

            const rank = scoreService.class0f(player.score);

            const leaderboardRank = db.prepare(`
                SELECT COUNT(*) + 1 AS rank
                FROM players
                WHERE score > ?
            `).get(player.score).rank;

            const totalMatches =
                Number(player.wins || 0) +
                Number(player.losses || 0) +
                Number(player.draws || 0);

            const winRate = totalMatches > 0
                ? ((Number(player.wins || 0) / totalMatches) * 100).toFixed(1)
                : '0.0';

            const avatar = interaction.user.displayAvatarURL({
                extension: 'png',
                size: 256
            });

            const serverLogo =
                interaction.guild?.iconURL({
                    extension: 'png',
                    size: 256
                });

            const embed = new EmbedBuilder()
                .setColor('#e8a0bf')
                .setAuthor({ name: 'GAKURAN ACADEMY' })
                .setTitle('🎓 STUDENT RANK PROFILE')
                .setDescription(
                    `**${player.display_name || interaction.user.username}**\n` +
                    'STUDENT RECORD • 学生プロフィール'
                )
                .setThumbnail(serverLogo || client.user.displayAvatarURL())
                .setImage(avatar)
                .addFields(
                    {
                        name: '🏅 CLASS',
                        value: `**${rank}**`,
                        inline: true
                    },
                    {
                        name: '🏆 LEADERBOARD',
                        value: `**#${leaderboardRank}**`,
                        inline: true
                    },
                    {
                        name: '⭐ SCORE',
                        value: `**${player.score}**`,
                        inline: true
                    },
                    {
                        name: '🥇 WINS',
                        value: `**${player.wins || 0}**`,
                        inline: true
                    },
                    {
                        name: '❌ LOSSES',
                        value: `**${player.losses || 0}**`,
                        inline: true
                    },
                    {
                        name: '🤝 DRAWS',
                        value: `**${player.draws || 0}**`,
                        inline: true
                    },
                    {
                        name: '🔥 WIN STREAK',
                        value: `**${player.win_streak || 0}**`,
                        inline: true
                    },
                    {
                        name: '📈 WIN RATE',
                        value: `**${winRate}%**`,
                        inline: true
                    },
                    {
                        name: '🟢 STATUS',
                        value: '**ACTIVE**',
                        inline: true
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

        if (cmd === 'student') {
            const id = interaction.user.id;
            const player = challenge.getPlayer(id);

            if (!player) {
                const embed = new EmbedBuilder()
                    .setColor('#FF1493')
                    .setTitle('❌ ไม่พบข้อมูลผู้เล่น')
                    .setDescription('กรุณาใช้ `/register` ก่อนสร้าง Student Card');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const rank = scoreService.class0f(player.score);

            const buffer = await createStudentCard({
                guildName: interaction.guild?.name || 'GAKURAN',
                guildIcon: interaction.guild?.iconURL({ extension: 'png', size: 128 }),
                avatar: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
                studentName: player.display_name,
                discordId: player.discord_id,
                score: player.score,
                rank
            });

            return interaction.reply({
                files: [
                    {
                        attachment: buffer,
                        name: 'student-card.png'
                    }
                ]
            });
        }

        if (cmd === 'verify-student') {
            const studentId = interaction.options.getString('id');
            const player = challenge.getPlayer(studentId);

            if (!player) {
                const embed = new EmbedBuilder()
                    .setColor('#FF1493')
                    .setTitle('❌ STUDENT NOT FOUND')
                    .setDescription('ไม่พบ Student ID นี้ในระบบ GAKURAN')
                    .addFields({
                        name: 'STUDENT ID',
                        value: `\`${studentId}\``,
                        inline: false
                    })
                    .setFooter({ text: 'GAKURAN ACADEMY • STUDENT VERIFICATION' })
                    .setTimestamp();

                return interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            const rank = scoreService.class0f(player.score);

            const embed = new EmbedBuilder()
                .setColor('#e8a0bf')
                .setAuthor({ name: 'GAKURAN ACADEMY' })
                .setTitle('🎓 STUDENT VERIFIED')
                .setDescription('พบข้อมูลนักเรียนในระบบ GAKURAN แล้ว')
                .addFields(
                    {
                        name: '👤 STUDENT',
                        value: `**${player.display_name}**`,
                        inline: true
                    },
                    {
                        name: '🪪 STUDENT ID',
                        value: `\`${player.discord_id}\``,
                        inline: true
                    },
                    {
                        name: '💰 SCORE',
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
                .setFooter({ text: 'GAKURAN ACADEMY • OFFICIAL STUDENT VERIFICATION' })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        if (cmd === 'help') {
            const embed = new EmbedBuilder()
                .setColor('#e8a0bf')
                .setAuthor({ name: 'GAKURAN ACADEMY' })
                .setTitle('📖 GAKURAN HELP CENTER')
                .setDescription(
                    'คู่มือคำสั่ง GAKURAN • 操作ガイド\n' +
                    '━━━━━━━━━━━━━━━━━━━━'
                )
                .addFields(
                    {
                        name: '🎓 PLAYER',
                        value:
                            '`/profile` — ดูโปรไฟล์และอันดับ\n' +
                            '`/stats` — ดูสถิติผู้เล่น\n' +
                            '`/history` — ดูประวัติการแข่งขัน\n' +
                            '`/leaderboard` — ดู TOP 10 Ranking\n' +
                            '`/rank` — ดูระบบชนชั้นทั้งหมด',
                        inline: false
                    },
                    {
                        name: '⚔️ MATCH',
                        value:
                            '`/challenge` — ท้าดวล\n' +
                            '`/accept` — ยอมรับคำท้า\n' +
                            '`/decline` — ปฏิเสธคำท้า\n' +
                            '`/start` — เริ่มการแข่งขัน\n' +
                            '`/match` — ดูข้อมูล Match\n' +
                            '`/submit` — ส่งหลักฐาน\n' +
                            '`/evidence` — ดูหลักฐาน\n' +
                            '`/verify` — ยืนยันผล\n' +
                            '`/draw` — บันทึกผลเสมอ\n' +
                            '`/cancel` — ยกเลิก Match',
                        inline: false
                    },
                    {
                        name: '🎁 REWARD',
                        value:
                            '`/daily` — รับคะแนนประจำวัน\n' +
                            '`/redeem-code` — ใช้ Reward Code\n' +
                            '`/event-reward` — รับรางวัลกิจกรรม',
                        inline: false
                    },
                    {
                        name: '🛡️ ADMIN',
                        value:
                            '`/register` — ลงทะเบียนผู้เล่น\n' +
                            '`/score` — ตรวจสอบคะแนน\n' +
                            '`/sync-ranks` — Sync Discord Roles\n' +
                            '`/create-code` — สร้าง Reward Code\n' +
                            '`/codes` — ดู Reward Codes\n' +
                            '`/disable-code` — ปิด Reward Code',
                        inline: false
                    }
                )
                .setFooter({
                    text: 'GAKURAN ACADEMY • OFFICIAL COMMAND GUIDE'
                })
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
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('📭 Ranking ว่าง')
                            .setDescription('ยังไม่มีผู้เล่นใน Ranking')
                            .setFooter({ text: 'GAKURAN • System' })
                    ],
                    ephemeral: true
                });
            }

            const medals = ['🥇', '🥈', '🥉'];

            const embed = new EmbedBuilder()
                .setColor('#e8a0bf')
                .setAuthor({ name: 'GAKURAN ACADEMY' })
                .setTitle('🏆 STUDENT RANKING')
                .setDescription(
                    'TOP 10 STUDENTS • 学生ランキング\n' +
                    '━━━━━━━━━━━━━━━━━━━━'
                )
                .addFields(
                    rows.map((p, i) => {
                        const rank = i + 1;
                        const prefix = medals[i] || `**#${rank}**`;

                        return {
                            name: `${prefix}  ${p.display_name || p.discord_id}`,
                            value:
                                `📊 **${p.score}** points\n` +
                                `🎖️ ${scoreService.class0f(p.score)}`,
                            inline: false
                        };
                    })
                )
                .setFooter({
                    text: 'GAKURAN ACADEMY • OFFICIAL RANKING • TOP 10'
                })
                .setTimestamp();

            return interaction.reply({
                embeds: [embed]
            });
        }

        if (cmd === 'history') {
            const id = getUserId(interaction);
            const player = challenge.getPlayer(id);

            if (!player) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ยังไม่ได้ลงทะเบียน')
                            .setDescription('กรุณาใช้ `/register` ก่อน')
                            .setFooter({ text: 'GAKURAN • System' })
                    ],
                    ephemeral: true
                });
            }

            const rows = db.prepare(`
                SELECT
                    m.match_code,
                    m.player_a_id,
                    m.player_b_id,
                    m.status,
                    m.result,
                    m.winner_id,
                    m.loser_id,
                    m.score_a_before,
                    m.score_b_before,
                    m.winner_change,
                    m.loser_change,
                    m.created_at
                FROM matches m
                WHERE m.player_a_id=? OR m.player_b_id=?
                ORDER BY m.id DESC
                LIMIT 10
            `).all(id, id);

            if (!rows.length) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('📭 ยังไม่มีประวัติการแข่งขัน')
                            .setDescription('ยังไม่มี Match History สำหรับผู้เล่นคนนี้')
                            .setFooter({ text: 'GAKURAN • Match History' })
                    ],
                    ephemeral: true
                });
            }

            const getName = (discordId) => {
                const p = challenge.getPlayer(discordId);
                return p?.display_name || discordId;
            };

            const embed = new EmbedBuilder()
                .setColor('#e8a0bf')
                .setAuthor({ name: 'GAKURAN ACADEMY' })
                .setTitle('📜 MATCH HISTORY')
                .setDescription(
                    `**${player.display_name || player.discord_id}**\n` +
                    'RECENT MATCHES • 試合履歴'
                )
                .addFields(
                    rows.map((m, i) => {
                        const opponentId =
                            m.player_a_id === id
                                ? m.player_b_id
                                : m.player_a_id;

                        let resultText = m.result || '-';

                        if (m.status === 'VERIFIED') {
                            if (m.result === 'DRAW') {
                                resultText = 'DRAW';
                            } else if (m.winner_id === id) {
                                resultText = 'WIN';
                            } else if (m.loser_id === id) {
                                resultText = 'LOSS';
                            }
                        }

                        let scoreText = 'Score change: -';

                        if (m.status === 'VERIFIED' && m.winner_id && m.loser_id) {
                            const change =
                                m.winner_id === id
                                    ? m.winner_change
                                    : m.loser_change;

                            scoreText =
                                `Score change: **${change > 0 ? '+' : ''}${change}**`;
                        }

                        return {
                            name: `#${i + 1} • MATCH ${m.match_code}`,
                            value:
                                `⚔️ Opponent: **${getName(opponentId)}**\n` +
                                `📌 Status: **${m.status}** • Result: **${resultText}**\n` +
                                `📈 ${scoreText}`,
                            inline: false
                        };
                    })
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

    if (target.id === interaction.user.id) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF1493)
            .setTitle('❌ ไม่สามารถท้าตัวเองได้')
            .setDescription('คุณไม่สามารถสร้าง Challenge กับตัวเองได้')
            .setFooter({ text: 'GAKURAN • Challenge System' })
        ],
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
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF1493)
          .setTitle('❌ ไม่สามารถดำเนินการได้')
          .setDescription(error.message)
          .setFooter({ text: 'GAKURAN • Challenge System' })
      ],
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
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF1493)
          .setTitle('❌ ไม่สามารถดำเนินการได้')
          .setDescription(error.message)
          .setFooter({ text: 'GAKURAN • Challenge System' })
      ],
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
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF1493)
          .setTitle('❌ ไม่สามารถดำเนินการได้')
          .setDescription(error.message)
          .setFooter({ text: 'GAKURAN • Challenge System' })
      ],
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

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#e8a0bf')
                        .setTitle('▶️ MATCH STARTED')
                        .setDescription('การแข่งขันเริ่มต้นแล้ว')
                        .addFields(
                            { name: '⚔️ MATCH', value: `**${code}**`, inline: true },
                            { name: '📌 STATUS', value: `**${result.status}**`, inline: true }
                        )
                        .setFooter({ text: 'GAKURAN ACADEMY • MATCH SYSTEM' })
                        .setTimestamp()
                ]
            });
        }

        if (cmd === 'submit') {
            const code = interaction.options.getString('code');
            const attachment = interaction.options.getAttachment('evidence');

            const result = match.submitEvidence(
                code,
                interaction.user.id,
                attachment.url
            );

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#e8a0bf')
                        .setTitle('📎 EVIDENCE SUBMITTED')
                        .setDescription('ส่งหลักฐานการแข่งขันเรียบร้อยแล้ว')
                        .addFields(
                            { name: '⚔️ MATCH', value: `**${code}**`, inline: true },
                            { name: '📌 STATUS', value: `**${result.status}**`, inline: true }
                        )
                        .setFooter({ text: 'GAKURAN ACADEMY • EVIDENCE SYSTEM' })
                        .setTimestamp()
                ]
            });
        }

        if (cmd === 'verify') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                            .setFooter({ text: 'GAKURAN • System' })
                    ],
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

            if (result.applied?.scored) {
                const { winnerId, winnerAfter, loserId, loserAfter } = result.applied;

                const winnerMember = await interaction.guild.members.fetch(winnerId);
                const loserMember = await interaction.guild.members.fetch(loserId);

                await discordRole.syncRole(winnerMember, winnerAfter);
                await discordRole.syncRole(loserMember, loserAfter);
            }

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#e8a0bf')
                        .setTitle('✅ MATCH VERIFIED')
                        .setDescription('ยืนยันผลการแข่งขันเรียบร้อยแล้ว')
                        .addFields(
                            { name: '⚔️ MATCH', value: `**${code}**`, inline: true },
                            { name: '📌 STATUS', value: `**${result.status}**`, inline: true }
                        )
                        .setFooter({ text: 'GAKURAN ACADEMY • VERIFY SYSTEM' })
                        .setTimestamp()
                ]
            });
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
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่พบ Match')
                            .setDescription(`ไม่พบ Match **${code}** ในระบบ`)
                            .setFooter({ text: 'GAKURAN • Match System' })
                    ],
                    ephemeral: true
                });
            }

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#e8a0bf')
                        .setTitle('⚔️ MATCH INFORMATION')
                        .setDescription(`ข้อมูล Match **${code}**`)
                        .addFields(
                            { name: '📌 STATUS', value: `**${result.status}**`, inline: false },
                            { name: '👤 PLAYER A', value: `<@${result.player_a_id}>`, inline: true },
                            { name: '👤 PLAYER B', value: `<@${result.player_b_id}>`, inline: true }
                        )
                        .setFooter({ text: 'GAKURAN ACADEMY • MATCH SYSTEM' })
                        .setTimestamp()
                ]
            });
        }

        if (cmd === 'evidence') {
            const code = interaction.options.getString('code');
            const result = match.evidence(code);

            if (!result) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่พบหลักฐาน')
                            .setDescription(`ไม่พบหลักฐานสำหรับ Match **${code}**`)
                            .setFooter({ text: 'GAKURAN • Evidence System' })
                    ],
                    ephemeral: true
                });
            }

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#e8a0bf')
                        .setTitle('📎 MATCH EVIDENCE')
                        .setDescription(`หลักฐานของ Match **${code}**`)
                        .addFields({
                            name: '📁 EVIDENCE',
                            value: result.length
                                ? result.map((e, i) => `**${i + 1}.** ${e.attachment_url}`).join('\n')
                                : 'ไม่มีหลักฐาน'
                        })
                        .setFooter({ text: 'GAKURAN ACADEMY • EVIDENCE SYSTEM' })
                        .setTimestamp()
                ]
            });
        }

        if (cmd === 'stats') {
            const id = getUserId(interaction);
            const player = challenge.getPlayer(id);

            if (!player) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ยังไม่ได้ลงทะเบียน')
                            .setDescription('กรุณาใช้ `/register` ก่อน')
                            .setFooter({ text: 'GAKURAN • System' })
                    ],
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
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                            .setFooter({ text: 'GAKURAN • System' })
                    ],
                    ephemeral: true
                });
            }

            const code = interaction.options.getString('code');
            const result = match.result(code, 'DRAW');

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#e8a0bf')
                        .setTitle('🤝 MATCH DRAW')
                        .setDescription(`Match **${code}** เป็นผลเสมอแล้ว`)
                        .addFields({
                            name: '📌 STATUS',
                            value: `**${result.status}**`
                        })
                        .setFooter({ text: 'GAKURAN ACADEMY • MATCH SYSTEM' })
                        .setTimestamp()
                ]
            });
        }

        if (cmd === 'cancel') {
            if (!isAdmin(interaction)) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFF1493)
                            .setTitle('❌ ไม่มีสิทธิ์')
                            .setDescription('คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น')
                            .setFooter({ text: 'GAKURAN • System' })
                    ],
                    ephemeral: true
                });
            }

            const code = interaction.options.getString('code');

            const result = match.cancel(
                code,
                interaction.user.id,
                'Cancelled by Administrator'
            );

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#e8a0bf')
                        .setTitle('🚫 MATCH CANCELLED')
                        .setDescription(`Match **${code}** ถูกยกเลิกแล้ว`)
                        .addFields({
                            name: '📌 STATUS',
                            value: `**${result.status}**`
                        })
                        .setFooter({ text: 'GAKURAN ACADEMY • MATCH SYSTEM' })
                        .setTimestamp()
                ]
            });
        }

    } catch (error) {
        console.error(error);

        const message = `ไม่สามารถดำเนินการได้: ${error.message}`;

        if (interaction.replied || interaction.deferred) {
            return interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF1493)
                        .setTitle('❌ ไม่สามารถดำเนินการได้')
                        .setDescription(message)
                        .setFooter({ text: 'GAKURAN • System' })
                ],
                ephemeral: true
            });
        }

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xFF1493)
                    .setTitle('❌ ไม่สามารถดำเนินการได้')
                    .setDescription(message)
                    .setFooter({ text: 'GAKURAN • System' })
            ],
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
