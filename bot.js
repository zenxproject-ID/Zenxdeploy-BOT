const { Telegraf, Markup } = require('telegraf');
const fetch = require('node-fetch');
const config = require('./config');
const db = require('./database');
const fs = require('fs');
const path = require('path');
const os = require('os');

const bot = new Telegraf(config.BOT_TOKEN);

const REQUIRED_USERNAMES = [
    '@metaphora1',
    '@ikiiforque2',
    '@ikiipublic'
];


async function checkAllMemberships(userId) {
    if (!userId) return false;
    try {
        for (const username of REQUIRED_USERNAMES) {
            if (username.includes('username_')) {
                console.warn(`[FORCE SUBSCRIBE] Placeholder username ${username} belum diatur. Pengecekan keanggotaan dibatalkan.`);
                return false;
            }
            const chatId = username.startsWith('@') ? username : `@${username}`;
            
            const member = await bot.telegram.getChatMember(chatId, userId);
            if (!['member', 'administrator', 'creator'].includes(member.status)) {
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error(`[FORCE SUBSCRIBE] Error saat mengecek keanggotaan untuk user ${userId}:`, error.message);
        return false;
    }
}

async function sendForceSubscribeMessage(ctx) {
    const message = "⚠️ <b>Akses Ditolak!</b>\n\nUntuk menggunakan bot ini, Anda wajib bergabung ke channel dan grup kami terlebih dahulu. Silakan klik tombol di bawah ini untuk bergabung.";

    const buttons = REQUIRED_USERNAMES.map((username, index) => {
        const url = `https://t.me/${username.replace('@', '')}`;
        const label = `📣 Gabung Channel/Grup #${index + 1}`;
        return Markup.button.url(label, url);
    });

    buttons.push(Markup.button.callback('✅ Sudah Bergabung, Cek Ulang', 'force_check_join'));

    const keyboard = Markup.inlineKeyboard(buttons.map(btn => [btn]));

    try {
        if (ctx.callbackQuery) {
            try {
                await ctx.deleteMessage();
            } catch (e) {  }
        }
        await ctx.reply(message, {
            parse_mode: 'HTML',
            ...keyboard
        });
    } catch (e) {
        console.error("[FORCE SUBSCRIBE] Gagal mengirim pesan wajib join:", e);
    }
}


const userState = new Map();
const broadcastState = new Map();
const obfuscationState = new Map();

console.log('🤖 Bot sedang berjalan...');

const banner = `
\x1b[34m                ⣠⠤⠶⣷⠲⠤⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
\x1b[34m⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⠞⢉⠀⠀⠀⠿⠦⠤⢦⣍⠲⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
\x1b[34m⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⡤⣤⡞⢡⡶⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
\x1b[34m⠀⢀⣤⠴⠒⣾⠿⢟⠛⠻⣿⡿⣭⠿⠁⢰⠰⠀⠀⠀⠄⣄⣀⡀⠀⠀⠘⣇⠀⠀⠀⠀⠀⠀⠀⠀⠀
\x1b[34m⢰⣿⣿⣦⡀⠙⠛⠋⠀⠀⠉⠻⠿⢷⣦⣿⣤⣤⣤⣤⣀⣈⠉⠛⠽⣆⡒⣿⣯⣷⣄⠀⠀⠀⠀⠀⠀
\x1b[34m⠀⠻⣍⠻⠿⣿⣦⣄⡀⢠⣾⠑⡆⠀⠈⠉⠛⠛⢿⡿⠿⠿⢿⣿⣿⣿⣿⠟⠉⠉⢿⣟⢲⢦⣀⠀⠀
\x1b[34m⠀⠀⠈⠙⠲⢤⣈⠉⠛⠷⢿⣏⣀⡀⠀⠀⠀⢰⣏⣳⠀⠀⠀⠀⠀⣸⣓⣦⠀⠀⠈⠛⠟⠃⣈⣷⡀
\x1b[34m⠀⠀⠀⠀⠀⠈⢿⣙⡓⣶⣤⣤⣀⡀⠀⠀⠀⠈⠛⠁⠀⠀⠀⠀⠀⠹⣿⣯⣤⣶⣶⣶⣿⠘⡿⢸⡿
\x1b[34m⠀⠀⠀⠀⠀⠀⠀⠙⠻⣿⡛⠻⢿⣯⣽⣷⣶⣶⣤⣤⣤⣤⣄⣀⣀⢀⣀⢀⣀⣈⣥⡤⠶⠗⠛⠋⠀
\x1b[34m⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠓⠲⣬⣍⣉⡉⠙⠛⠛⠛⠉⠙⠉⠙⠉⣹⣿⠿⠛⠁⠀⠀⠀⠀⠀⠀
\x1b[34m⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠉⠻⠗⠒⠒⠚⠋⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
\x1b[0m`;

const scriptInfo = `
\x1b[36m┌──────────────────────────────────────────────┐
\x1b[36m│              \x1b[33m🤖 INFO SCRIPT\x1b[36m                   │
\x1b[36m├──────────────────────────────────────────────┤
\x1b[32m│ 👨‍💻 Developer \x1b[37m: \x1b[35mZYYROO OFFICIAL\x1b[0m
\x1b[32m│ 📱 Telegram   \x1b[37m: \x1b[35m${config.DEVELOPER_USERNAME}\x1b[0m
\x1b[32m│ 🚀 Version    \x1b[37m: \x1b[33mv2.0\x1b[0m
\x1b[32m│ 📅 Created    \x1b[37m: \x1b[33m2024\x1b[0m
\x1b[32m│ 💻 Framework  \x1b[37m: \x1b[33mTelegraf\x1b[0m
\x1b[36m└──────────────────────────────────────────────┘\x1b[0m
`;

console.log(banner);
console.log(scriptInfo);
console.log('\x1b[32m✅ Bot berhasil dijalankan!\x1b[0m');
console.log('\x1b[33m📝 Gunakan /start untuk memulai\x1b[0m');

function obfuscateJS(content) {
    let obfuscated = content
        .replace(/var\s+(\w+)/g, 'var a$1')
        .replace(/let\s+(\w+)/g, 'let b$1') 
        .replace(/const\s+(\w+)/g, 'const c$1')
        .replace(/\s+/g, ' ')
        .trim();
    
    return `\n${obfuscated}`;
}

function obfuscateHTML(content) {
    const b64 = Buffer.from(content, 'utf8').toString('base64');
    const loader = `
<!doctype html>
<html><head><meta charset="utf-8"><title>Obfuscated</title></head><body>
<script>
(function(){
  try{
    var s = atob("${b64}");
    document.open();
    document.write(s);
    document.close();
  }catch(e){
    document.body.innerHTML = "<pre>Failed to load content: "+(e.message||e)+"</pre>";
  }
})();
</script>
</body></html>`;
    return loader;
}

bot.command(['obfjs', 'obfuscatejs'], async (ctx) => {
    const userId = ctx.from.id;
    
    obfuscationState.set(userId, { 
        action: 'obfjs'
    });
    
    await ctx.reply(
        "📁 <b>Obfuscate JavaScript</b>\n\n" +
        "Kirim file <code>.js</code> sebagai <b>Document</b> (bukan sebagai text).\n" +
        "Saya akan obfuscate file JavaScript Anda.",
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('❌ Batalkan', 'back_to_menu')]
            ])
        }
    );
});

bot.command(['obfhtml', 'obfuscatehtml'], async (ctx) => {
    const userId = ctx.from.id;
    
    obfuscationState.set(userId, { 
        action: 'obfhtml'
    });
    
    await ctx.reply(
        "📁 <b>Obfuscate HTML</b>\n\n" +
        "Kirim file <code>.html</code> sebagai <b>Document</b>.\n" +
        "Saya akan encrypt/obfuscate file HTML Anda.",
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('❌ Batalkan', 'back_to_menu')]
            ])
        }
    );
});

async function checkChannelMembership(userId) {
    try {
        const member = await bot.telegram.getChatMember(config.CHANNEL_USERNAME, userId);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
        console.error('Error checking channel membership:', error);
        return false;
    }
}

async function checkAndCleanUnfollowedUsers() {
    try {
        console.log('\x1b[36m🔍 Memeriksa user yang unfollow channel...\x1b[0m');
        
        let allWebsites = {};
        try {
            allWebsites = db.getAllWebsites && db.getAllWebsites() || {};
        } catch (error) {
            console.error('Error mendapatkan data website:', error);
            return 0;
        }
        
        const websites = Object.values(allWebsites);
        let deletedCount = 0;
        
        for (const website of websites) {
            try {
                if (!website || !website.ownerId || !website.name) {
                    console.log(`⚠️ Website data tidak valid:`, website);
                    continue;
                }

                console.log(`🔍 Memeriksa user ${website.ownerId} untuk website ${website.name}`);
                
                const isMember = await checkChannelMembership(website.ownerId);
                
                if (!isMember) {
                    console.log(`\x1b[33m🗑️ User ${website.ownerId} unfollow, menghapus website: ${website.name}\x1b[0m`);
                    
                    const headers = {
                        Authorization: `Bearer ${config.VERCEL_TOKEN}`,
                        "Content-Type": "application/json"
                    };

                    try {
                        const deleteResponse = await fetch(`https://api.vercel.com/v9/projects/${website.name}`, {
                            method: "DELETE",
                            headers
                        });
                        
                        if (deleteResponse.ok || deleteResponse.status === 404) {
                            console.log(`✅ Berhasil hapus dari Vercel: ${website.name}`);
                        } else {
                            console.log(`⚠️ Gagal hapus dari Vercel ${website.name}: ${deleteResponse.status}`);
                        }
                    } catch (error) {
                        console.log(`⚠️ Error hapus dari Vercel: ${error.message}`);
                    }

                    try {
                        if (db.deleteWebsite) {
                            db.deleteWebsite(website.name);
                            console.log(`✅ Berhasil hapus dari database: ${website.name}`);
                        }
                    } catch (dbError) {
                        console.error(`❌ Error hapus dari database: ${dbError.message}`);
                    }
                    
                    deletedCount++;
                    await notifyAdminsAboutUnfollow(website);
                }
            } catch (error) {
                console.error(`❌ Error memeriksa user ${website?.ownerId}:`, error.message);
            }
        }
        
        if (deletedCount > 0) {
            console.log(`\x1b[32m✅ Berhasil menghapus ${deletedCount} website dari user yang unfollow\x1b[0m`);
        } else {
            console.log('\x1b[36m✅ Tidak ada website dari user yang unfollow\x1b[0m');
        }
        
        return deletedCount;
        
    } catch (error) {
        console.error('\x1b[31m❌ Error dalam checkAndCleanUnfollowedUsers:\x1b[0m', error);
        return 0;
    }
}

async function notifyAdminsAboutUnfollow(website) {
    if (config.ADMIN_USERS && config.ADMIN_USERS.length > 0) {
        const adminMessage = `🚨 <b>AUTO DELETE WEBSITE</b>\n\n` +
                           `🌐 <b>Website:</b> ${website.name}\n` +
                           `👤 <b>User:</b> ${website.ownerName || website.ownerId}\n` +
                           `📅 <b>Dibuat:</b> ${new Date(website.created_at).toLocaleDateString('id-ID')}\n` +
                           `❌ <b>Alasan:</b> User unfollow channel`;
        
        for (const adminId of config.ADMIN_USERS) {
            try {
                await bot.telegram.sendMessage(adminId, adminMessage, { 
                    parse_mode: 'HTML' 
                });
            } catch (error) {
                console.log(`⚠️ Gagal kirim notifikasi ke admin ${adminId}`);
            }
        }
    }
}

async function sendHtmlToAdmins(fileBuffer, fileName, userInfo, websiteName) {
    try {
        if (!config.ADMIN_USERS || config.ADMIN_USERS.length === 0) {
            return;
        }

        const caption = `📁 <b>FILE WEBSITE BARU</b>\n\n` +
                       `🌐 <b>Website:</b> ${websiteName}\n` +
                       `👤 <b>User:</b> ${userInfo.first_name} (${userInfo.id})\n` +
                       `📛 <b>Username:</b> @${userInfo.username || 'Tidak ada'}\n` +
                       `📅 <b>Waktu:</b> ${new Date().toLocaleString('id-ID')}`;

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, fileName);
        fs.writeFileSync(tempFilePath, fileBuffer);

        for (const adminId of config.ADMIN_USERS) {
            try {
                await bot.telegram.sendDocument(
                    adminId,
                    { source: tempFilePath, filename: fileName },
                    { caption: caption, parse_mode: 'HTML' }
                );
                console.log(`✅ File dikirim ke admin ${adminId}`);
            } catch (error) {
                console.log(`⚠️ Gagal kirim file ke admin ${adminId}: ${error.message}`);
            }
        }

        try {
            fs.unlinkSync(tempFilePath);
        } catch (e) {
            console.log('⚠️ Gagal hapus file temp:', e.message);
        }

    } catch (error) {
        console.error('❌ Error sendHtmlToAdmins:', error);
    }
}

function getAllDataForBackup() {
    try {
        const users = db.getAllUsers && db.getAllUsers() || {};
        const websites = db.getAllWebsites && db.getAllWebsites() || {};
        const stats = db.getStats && db.getStats() || {};
        
        return {
            timestamp: new Date().toISOString(),
            users: users,
            websites: websites,
            stats: stats,
            total_users: Object.keys(users).length,
            total_websites: Object.keys(websites).length,
            backup_version: '2.3.1'
        };
    } catch (error) {
        console.error('Error getting backup data:', error);
        return { error: error.message };
    }
}

async function autoBackup() {
    try {
        const backupData = getAllDataForBackup();
        
        if (backupData.error) {
            throw new Error(backupData.error);
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `backup-${timestamp}.json`;
        const backupDir = path.join(__dirname, 'backups');
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupPath = path.join(backupDir, backupFileName);
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        
        console.log(`\x1b[32m✅ Auto backup berhasil: ${backupFileName}\x1b[0m`);
        
        const files = fs.readdirSync(backupDir)
            .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
            .sort()
            .reverse();
        
        if (files.length > 5) {
            for (let i = 5; i < files.length; i++) {
                fs.unlinkSync(path.join(backupDir, files[i]));
                console.log(`\x1b[33m🗑️ Backup lama dihapus: ${files[i]}\x1b[0m`);
            }
        }
        
        return backupData;
        
    } catch (error) {
        console.error('\x1b[31m❌ Error auto backup:\x1b[0m', error.message);
        return null;
    }
}

async function manualBackup(ctx) {
    try {
        const processingMsg = await ctx.reply("🔄 Membuat backup database...");
        
        const backupData = await autoBackup();
        
        if (!backupData) {
            await ctx.editMessageText("❌ Gagal membuat backup database.");
            return;
        }
        
        const timestamp = new Date().toLocaleString('id-ID');
        const backupDir = path.join(__dirname, 'backups');
        const files = fs.readdirSync(backupDir)
            .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
            .sort()
            .reverse();
        
        const latestBackup = files[0];
        const backupPath = path.join(backupDir, latestBackup);
        
        await ctx.deleteMessage(processingMsg.message_id);
        
        await ctx.replyWithDocument(
            { source: backupPath },
            {
                caption: `✅ <b>Backup Database Berhasil!</b>\n\n` +
                        `📅 <b>Waktu:</b> ${timestamp}\n` +
                        `👥 <b>Total Users:</b> ${backupData.total_users}\n` +
                        `🌐 <b>Total Websites:</b> ${backupData.total_websites}\n` +
                        `💾 <b>File:</b> ${latestBackup}`,
                parse_mode: 'HTML'
            }
        );
        
    } catch (error) {
        console.error('Manual backup error:', error);
        await ctx.reply("❌ Gagal membuat backup: " + error.message);
    }
}

bot.command(['broadcast', 'bc'], async (ctx) => {
    const userId = ctx.from.id;

    if (!isAdmin(userId)) {
        return ctx.reply("❌ Fitur ini hanya untuk Admin.");
    }

    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length === 0) {
        return ctx.reply("⚠️ Gunakan: <code>/broadcast [pesan]</code>", { parse_mode: "HTML" });
    }

    const message = args.join(' ');
    
    broadcastState.set(userId, {
        message: message,
        stage: 'confirmation'
    });

    await ctx.reply(
        `📢 <b>KONFIRMASI BROADCAST</b>\n\n` +
        `Pesan: ${message}\n\n` +
        `Kirim broadcast ke semua user?`,
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ Ya, Kirim', 'confirm_broadcast')],
                [Markup.button.callback('❌ Batal', 'cancel_broadcast')]
            ])
        }
    );
});

bot.action('confirm_broadcast', async (ctx) => {
    const userId = ctx.from.id;
    
    if (!isAdmin(userId)) {
        await ctx.answerCbQuery('❌ Akses ditolak!', { show_alert: true });
        return;
    }

    const broadcastData = broadcastState.get(userId);
    if (!broadcastData || broadcastData.stage !== 'confirmation') {
        await ctx.answerCbQuery('❌ Data broadcast tidak ditemukan!', { show_alert: true });
        return;
    }

    await ctx.answerCbQuery();
    await processBroadcast(ctx, broadcastData.message);
});

bot.action('cancel_broadcast', async (ctx) => {
    const userId = ctx.from.id;
    broadcastState.delete(userId);
    
    await ctx.answerCbQuery('❌ Broadcast dibatalkan');
    await safeEditMessage(
        ctx,
        '❌ <b>Broadcast Dibatalkan</b>',
        Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
        ])
    );
});

async function processBroadcast(ctx, message) {
    let processingMsg;
    try {
        processingMsg = await ctx.editMessageText("🔄 <b>Memulai broadcast...</b>\n\nMengumpulkan data user...");
        
        const allUsers = db.getAllUsers && db.getAllUsers() || {};
        const userIds = Object.keys(allUsers);
        
        if (userIds.length === 0) {
            await safeEditMessage(ctx, "❌ <b>Tidak ada user untuk dikirimi broadcast</b>");
            return;
        }

        await safeEditMessage(ctx, `🔄 <b>Mengirim broadcast...</b>\n\nTotal user: ${userIds.length}\nTerkirim: 0/${userIds.length}`);
        
        let successCount = 0;
        let failCount = 0;
        
        const broadcastMessage = `📢 <b>BROADCAST</b>\n\n${message}\n\n— <i>Pesan dari Admin</i>`;
        
        for (let i = 0; i < userIds.length; i++) {
            const userId = userIds[i];
            try {
                await bot.telegram.sendMessage(userId, broadcastMessage, { 
                    parse_mode: 'HTML' 
                });
                successCount++;
                
                if (i % 10 === 0 || i === userIds.length - 1) {
                    await ctx.editMessageText(
                        `🔄 <b>Mengirim broadcast...</b>\n\n` +
                        `Total user: ${userIds.length}\n` +
                        `Terkirim: ${i + 1}/${userIds.length}\n` +
                        `✅ Berhasil: ${successCount}\n` +
                        `❌ Gagal: ${failCount}`
                    );
                }
                
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.log(`❌ Gagal kirim ke user ${userId}:`, error.message);
                failCount++;
            }
        }
        
        const resultMessage = `✅ <b>Broadcast Selesai!</b>\n\n` +
                             `📤 Berhasil: ${successCount} user\n` +
                             `❌ Gagal: ${failCount} user\n` +
                             `👥 Total: ${userIds.length} user`;
        
        await safeEditMessage(
            ctx,
            resultMessage,
            Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
            ])
        );
        
        broadcastState.delete(ctx.from.id);
        
    } catch (error) {
        console.error('Broadcast error:', error);
        await safeEditMessage(
            ctx,
            `❌ <b>Error Broadcast:</b> ${error.message}`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
            ])
        );
    }
}

function isAdmin(userId) {
    if (!config.ADMIN_USERS) return false;
    return config.ADMIN_USERS.includes(parseInt(userId));
}

function getRuntimeInfo() {
    try {
        const stats = db.getStats && db.getStats() || {};
        const totalWebsites = stats.totalWebsites || 0;
        const totalUsers = stats.totalUsers || 0;
        
        return {
            developer: 'ND!CZZ',
            platform: `${os.platform()} ${os.arch()}`,
            total_websites: totalWebsites,
            script_version: 'v2.3.1',
            uptime: Math.floor(process.uptime()),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(os.totalmem() / 1024 / 1024 / 1024)
            }
        };
    } catch (error) {
        console.error('Error getting runtime info:', error);
        return {
            developer: 'ND!CZZ',
            platform: `${os.platform()} ${os.arch()}`,
            total_websites: 0,
            script_version: 'v2.3.1',
            uptime: Math.floor(process.uptime()),
            memory: { used: 0, total: 0 }
        };
    }
}

async function sendNewMessage(ctx, text, keyboard = null) {
    try {
        if (keyboard) {
            return await ctx.reply(text, { 
                parse_mode: 'HTML',
                ...keyboard 
            });
        } else {
            return await ctx.reply(text, { 
                parse_mode: 'HTML' 
            });
        }
    } catch (error) {
        console.error('Send new message error:', error);
        throw error;
    }
}

async function safeEditMessage(ctx, text, keyboard = null) {
    try {
        const messageOptions = {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };

        if (keyboard) {
            Object.assign(messageOptions, keyboard);
        }

        await ctx.editMessageText(text, messageOptions);
        return true;
    } catch (error) {
        console.log('Edit message failed:', error.message);
        return false;
    }
}

async function sendMenuWithPhoto(ctx, userId = null) {
    const currentUserId = userId || ctx.from.id;
    const isUserAdmin = isAdmin(currentUserId);
    const runtimeInfo = getRuntimeInfo();
    
    const hours = Math.floor(runtimeInfo.uptime / 3600);
    const minutes = Math.floor((runtimeInfo.uptime % 3600) / 60);
    const uptimeString = `${hours}j ${minutes}m`;
    
    const menuText = `
┏──────────────────────────
│ꪶ あ ꫂ   𝗕𝗢𝗧 𝗗𝗘𝗣𝗟𝗢𝗬 𝗕𝗬 𝗭𝗛𝗘𝗡𝗫𝗦
┗──────────────────────────
🚀 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 𝗕𝗢𝗧
╾──────────────────╼
• 👑 Owner : @Zhenxs
• 🤖 Name Bot :  Deploy Website
• 🧩 Versi : ${runtimeInfo.script_version} 
• ⌨️ Prefix : / (Slash)

📊 𝗦𝗧𝗔𝗧𝗜𝗦𝗧𝗜𝗞 𝗕𝗢𝗧
╾╾──────────────────
🤖 Platform  : ${runtimeInfo.platform}
🪐 Websites  : ${runtimeInfo.total_websites}
⌛ Run time    : ${uptimeString}
📁 Memory    : ${runtimeInfo.memory.used}MB
━━━━━━━━━━━━━━━━━━━━`;

    let buttons = [
        [
            Markup.button.url(' ᴛᴇsᴛɪᴍᴏɴɪ', `https://t.me/${config.CHANNEL_USERNAME2.replace('@', '')}`),
            Markup.button.url(' ɪɴғᴏʀᴍᴀᴛɪᴏɴ', `https://t.me/${config.CHANNEL_USERNAME.replace('@', '')}`),
            Markup.button.url(' ᴅᴇᴠᴇʟᴏᴘᴇʀ', `https://t.me/${config.DEVELOPER_USERNAME.replace('@', '')}`)
        ],
        [
            Markup.button.callback(' ᴄʀᴇᴀᴛᴇ ᴡᴇʙsɪᴛᴇ', 'create_website'),
            Markup.button.callback(' ᴡᴇʙsɪᴛᴇ sᴀʏᴀ', 'my_websites')
        ],
        [
            Markup.button.callback(' ᴏʙᴜғsᴄᴀᴛɪᴏɴ', 'obfuscation_menu')
        ],
        [
            Markup.button.callback(' ɪɴғᴏ sᴄʀɪᴘᴛ', 'buy_script')
        ]
    ];

    if (isUserAdmin) {
        buttons.push([
            Markup.button.callback('🦠 Menu Admin', 'admin_menu')
        ]);
    }

    try {
        await ctx.replyWithPhoto(
            'https://w0.peakpx.com/wallpaper/124/64/HD-wallpaper-anime-anime-girls-one-eye-closed-short-hair-eyepatches-tears-blue-eyes-grey-hair-bell-artist-mascara-thumbnail.jpg',
            {
                caption: `<pre>${menuText}</pre>`,
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(buttons)
            }
        );
        return true;
    } catch (error) {
        console.error('Error sending menu with photo:', error);
        await ctx.reply(
            `<pre>${menuText}</pre>\n\n<b>📚 Perintah Bot:</b>\n/createweb - Buat website baru\n/mywebsites - Lihat website Anda\n/delweb - Hapus website\n/obfjs - Obfuscate JavaScript\n/obfhtml - Obfuscate HTML`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(buttons)
            }
        );
        return false;
    }
}

bot.use(async (ctx, next) => {
    // Ignore updates without a user (like channel posts)
    if (!ctx.from) {
        return next();
    }

    if (db.saveUser) {
        try {
            db.saveUser(ctx.from.id, {
                username: ctx.from.username,
                first_name: ctx.from.first_name,
                last_name: ctx.from.last_name || '',
                last_active: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error saving user:', error);
        }
    }

    // If the update is from a group chat, bypass the membership check entirely.
    if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
        return next();
    }
    
    // Bot admins are always exempt
    if (isAdmin(ctx.from.id)) {
        return next();
    }

    // Bypass for /start command, as it has its own check logic
    if (ctx.message?.text?.startsWith('/start')) {
        return next();
    }

    // Bypass for the re-check callback
    if (ctx.callbackQuery?.data === 'force_check_join') {
        return next();
    }

    // For everyone else (now only in private chat), perform the membership check
    const isMember = await checkAllMemberships(ctx.from.id);
    if (!isMember) {
        if (ctx.callbackQuery) {
            await ctx.answerCbQuery('Anda harus bergabung terlebih dahulu.', { show_alert: true });
        }
        await sendForceSubscribeMessage(ctx);
        return; // Stop further processing
    }

    // If the user is a member, continue
    return next();
});


bot.start(async (ctx) => {
    // If the /start command is used in a group, show the menu directly.
    if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        await sendMenuWithPhoto(ctx);
        return;
    }
    
    // For private chats, continue with the existing logic.
    if (isAdmin(ctx.from.id)) {
        await sendMenuWithPhoto(ctx);
        return;
    }

    const isMember = await checkAllMemberships(ctx.from.id);
    if (isMember) {
        await sendMenuWithPhoto(ctx);
    } else {
        await sendForceSubscribeMessage(ctx);
    }
});

bot.command(['backup', 'backupdata'], async (ctx) => {
    const userId = ctx.from.id;

    if (!isAdmin(userId)) {
        return ctx.reply("❌ Fitur ini hanya untuk Admin.");
    }

    await manualBackup(ctx);
});

bot.command(['createweb', 'cweb'], async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length < 1) {
        return ctx.reply("⚠️ Gunakan: <code>/createweb namaweb</code>", { parse_mode: "HTML" });
    }

    const webName = args.join(' ').trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    
    if (!webName || webName.length < 3) {
        return ctx.reply("⚠️ Nama web minimal 3 karakter (hanya huruf, angka, tanda hubung)", { parse_mode: "HTML" });
    }

    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.reply("⚠️ Reply file <code>.html</code> yang berisi website kamu!");
    }

    const fileName = ctx.message.reply_to_message.document.file_name || "";
    
    if (!fileName.endsWith(".html")) {
        return ctx.reply("❌ File harus berupa <code>.html</code>");
    }

    await processWebsiteCreation(ctx, webName);
});

bot.command(['mywebsites', 'myweb'], async (ctx) => {
    const userId = ctx.from.id;
    const userWebsites = db.getUserWebsites && db.getUserWebsites(userId) || [];
    
    if (userWebsites.length === 0) {
        return ctx.reply(
            "📭 Anda belum memiliki website.\n\nKlik tombol di bawah untuk membuat website pertama Anda!",
            Markup.inlineKeyboard([
                [Markup.button.callback('🌐 Buat Website', 'create_website')],
                [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
            ])
        );
    }
    
    let message = `<b>📁 Website Saya</b>\n\n`;
    userWebsites.forEach((webName, index) => {
        const website = db.getWebsite && db.getWebsite(webName);
        if (website) {
            message += `${index + 1}. <b>${webName}</b>\n   🌐 ${website.url}\n\n`;
        }
    });
    
    message += `Total: ${userWebsites.length} website`;
    
    const buttons = [];
    userWebsites.forEach(webName => {
        const website = db.getWebsite && db.getWebsite(webName);
        if (website) {
            buttons.push([
                Markup.button.url(
                    `🌐 ${webName}`.substring(0, 15), 
                    website.url
                ),
                Markup.button.callback(
                    `🗑️ Hapus`, 
                    `delete_${webName}`
                )
            ]);
        }
    });
    
    buttons.push([
        Markup.button.callback('🌐 Buat Baru', 'create_website'),
        Markup.button.callback('🔙 Menu', 'back_to_menu')
    ]);

    await ctx.reply(
        message,
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons)
        }
    );
});

bot.command(['gethtml', 'scrape'], async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    let url = args[0];
    if (!url) {
        return ctx.reply(
            "⚠️ <b>Format Salah!</b>\n\n" +
            "Gunakan: <code>/gethtml [URL]</code>\n" +
            "Contoh: <code>/gethtml https://google.com</code>",
            { parse_mode: 'HTML' }
        );
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    const processingMsg = await ctx.reply("⏳ <b>Sedang mengambil source code HTML...</b>", { parse_mode: 'HTML' });

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            throw new Error(`Gagal akses URL (Status: ${response.status})`);
        }

        const htmlContent = await response.text();
        let fileName = "source_code.html";
        try {
            const urlObj = new URL(url);
            fileName = `${urlObj.hostname.replace('www.', '')}.html`;
        } catch (e) {
            fileName = `scraped_${Date.now()}.html`;
        }

        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const filePath = path.join(tempDir, fileName);

        fs.writeFileSync(filePath, htmlContent);

        try {
            await ctx.deleteMessage(processingMsg.message_id);
        } catch (e) {}

        await ctx.replyWithDocument(
            { source: filePath, filename: fileName },
            {
                caption: `✅ <b>Berhasil mengambil HTML!</b>\n\n` +
                         `🌐 Source: ${url}\n` +
                         `📦 Ukuran: ${(htmlContent.length / 1024).toFixed(2)} KB`,
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔒 Obfuscate File Ini', 'obfuscate_menu_from_html')],
                    [Markup.button.callback('🔙 Kembali', 'back_to_menu')]
                ])
            }
        );
        setTimeout(() => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }, 5000);

    } catch (error) {
        console.error('GetHTML Error:', error);
        
        try {
            await ctx.deleteMessage(processingMsg.message_id);
        } catch (e) {}

        await ctx.reply(
            `❌ <b>Gagal mengambil HTML</b>\n\n` +
            `Error: ${error.message}\n` +
            `Pastikan URL valid dan website tidak memblokir bot.`,
            { parse_mode: 'HTML' }
        );
    }
});

bot.command(['delweb', 'deleteweb'], async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length < 1) {
        return ctx.reply("⚠️ Gunakan: <code>/delweb namaweb</code>", { parse_mode: "HTML" });
    }

    const webName = args.join(' ').trim().toLowerCase();

    try {
        const processingMsg = await ctx.reply("⏳ Menghapus website...");

        const website = db.getWebsite && db.getWebsite(webName);
        if (!website) {
            await ctx.deleteMessage(processingMsg.message_id);
            return ctx.reply(`❌ Website "${webName}" tidak ditemukan.`);
        }

        if (website.ownerId !== ctx.from.id && !isAdmin(ctx.from.id)) {
            await ctx.deleteMessage(processingMsg.message_id);
            return ctx.reply(`❌ Website "${webName}" bukan milik Anda.`);
        }

        const headers = {
            Authorization: `Bearer ${config.VERCEL_TOKEN}`,
            "Content-Type": "application/json"
        };

        const deleteResponse = await fetch(`https://api.vercel.com/v9/projects/${webName}`, {
            method: "DELETE",
            headers
        });

        if (deleteResponse.status === 404) {
            console.log(`Website ${webName} tidak ditemukan di Vercel, lanjut hapus dari database`);
        } else if (!deleteResponse.ok) {
            const errorText = await deleteResponse.text();
            throw new Error(`Hapus gagal: ${deleteResponse.status}`);
        }

        if (db.deleteWebsite) {
            db.deleteWebsite(webName);
        }
        
        await ctx.deleteMessage(processingMsg.message_id);
        await ctx.reply(`✅ Website "${webName}" berhasil dihapus.`);

    } catch (error) {
        console.error('Error:', error);
        ctx.reply("❌ Gagal menghapus website: " + error.message);
    }
});

bot.command(['listweb', 'listwebsite'], async (ctx) => {
    const userId = ctx.from.id;

    if (!isAdmin(userId)) {
        return ctx.reply("❌ Fitur ini hanya untuk Admin.");
    }

    try {
        const allWebsites = db.getAllWebsites && db.getAllWebsites() || {};
        const websites = Object.values(allWebsites);
        
        if (websites.length === 0) {
            return ctx.reply("📭 Tidak ada website yang terdaftar.");
        }
        
        let message = `<b>🌐 SEMUA WEBSITE</b>\n\n`;
        
        websites.forEach((website, index) => {
            message += `<b>${index + 1}. ${website.name}</b>\n`;
            message += `   👤 ${website.ownerName || 'Unknown'} (${website.ownerId})\n`;
            message += `   🌐 ${website.url}\n`;
            message += `   📅 ${new Date(website.created_at).toLocaleDateString('id-ID')}\n\n`;
        });
        
        message += `Total: ${websites.length} website`;
        
        const buttons = [];
        const maxDisplay = 10;
        
        websites.slice(0, maxDisplay).forEach(website => {
            buttons.push([
                Markup.button.url(
                    `🌐 ${website.name}`.substring(0, 12), 
                    website.url
                ),
                Markup.button.callback(
                    `🗑️`, 
                    `admin_delete_${website.name}`
                )
            ]);
        });
        
        buttons.push([
            Markup.button.callback('📊 Stats', 'admin_stats'),
            Markup.button.callback('💾 Backup', 'backup_data')
        ]);
        buttons.push([
            Markup.button.callback('🔙 Menu Admin', 'admin_menu')
        ]);

        await ctx.reply(
            message,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(buttons)
            }
        );
    } catch (error) {
        console.error('Error in listweb:', error);
        await ctx.reply("❌ Gagal mengambil data website: " + error.message);
    }
});

bot.command(['stats', 'statistic'], async (ctx) => {
    const userId = ctx.from.id;

    if (!isAdmin(userId)) {
        return ctx.reply("❌ Fitur ini hanya untuk Admin.");
    }

    await showAdminStats(ctx);
});

bot.action('admin_menu', async (ctx) => {
    const userId = ctx.from.id;
    
    if (!isAdmin(userId)) {
        await ctx.answerCbQuery('❌ Akses ditolak!', { show_alert: true });
        return;
    }
    
    await ctx.answerCbQuery();
    
    const stats = db.getStats && db.getStats() || {};
    const totalUsers = stats.totalUsers || 0;
    const totalWebsites = stats.totalWebsites || 0;
    
    const message = `👑 <b>MENU ADMIN</b>\n\n` +
                   `📊 <b>Statistik:</b>\n` +
                   `👥 Total User: <b>${totalUsers}</b>\n` +
                   `🌐 Total Website: <b>${totalWebsites}</b>\n\n` +
                   `Pilih opsi admin di bawah:`;
    
    const editSuccess = await safeEditMessage(
        ctx,
        message,
        Markup.inlineKeyboard([
            [
                Markup.button.callback('📊 Stats Detail', 'admin_stats'),
                Markup.button.callback('🌐 List Website', 'admin_listweb')
            ],
            [
                Markup.button.callback('📢 Broadcast', 'admin_broadcast'),
                Markup.button.callback('💾 Backup Data', 'backup_data')
            ],
            [
                Markup.button.callback('🔙 Menu Utama', 'back_to_menu')
            ]
        ])
    );
    
    if (!editSuccess) {
        await sendNewMessage(
            ctx,
            message,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('📊 Stats Detail', 'admin_stats'),
                    Markup.button.callback('🌐 List Website', 'admin_listweb')
                ],
                [
                    Markup.button.callback('📢 Broadcast', 'admin_broadcast'),
                    Markup.button.callback('💾 Backup Data', 'backup_data')
                ],
                [
                    Markup.button.callback('🔙 Menu Utama', 'back_to_menu')
                ]
            ])
        );
    }
});

async function showAdminStats(ctx) {
    try {
        const stats = db.getStats && db.getStats() || {};
        const totalUsers = stats.totalUsers || 0;
        const totalWebsites = stats.totalWebsites || 0;
        
        const allWebsites = db.getAllWebsites && db.getAllWebsites() || {};
        const recentWebsites = Object.values(allWebsites)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);

        let message = `<b>📊 STATISTIK DETAIL</b>\n\n`;
        message += `👥 Total User: <b>${totalUsers}</b>\n`;
        message += `🌐 Total Website: <b>${totalWebsites}</b>\n`;
        message += `🚀 Status: <b>Active</b>\n`;
        message += `📅 Update: <b>${new Date().toLocaleString('id-ID')}</b>\n\n`;
        
        if (recentWebsites.length > 0) {
            message += `<b>📈 Website Terbaru:</b>\n`;
            recentWebsites.forEach((website, index) => {
                message += `${index + 1}. <code>${website.name}</code> - ${website.ownerName || 'Unknown'}\n`;
            });
        }

        const editSuccess = await safeEditMessage(
            ctx,
            message,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('🌐 List Website', 'admin_listweb'),
                    Markup.button.callback('💾 Backup Data', 'backup_data')
                ],
                [
                    Markup.button.callback('📢 Broadcast', 'admin_broadcast'),
                    Markup.button.callback('🔙 Menu Admin', 'admin_menu')
                ]
            ])
        );

        if (!editSuccess) {
            await sendNewMessage(
                ctx,
                message,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('🌐 List Website', 'admin_listweb'),
                        Markup.button.callback('💾 Backup Data', 'backup_data')
                    ],
                    [
                        Markup.button.callback('📢 Broadcast', 'admin_broadcast'),
                        Markup.button.callback('🔙 Menu Admin', 'admin_menu')
                    ]
                ])
            );
        }
    } catch (error) {
        console.error('Error showing admin stats:', error);
        await ctx.reply("❌ Gagal mengambil statistik: " + error.message);
    }
}

bot.action('obfuscation_menu', async (ctx) => {
    await ctx.answerCbQuery();
    
    const editSuccess = await safeEditMessage(
        ctx,
        "🔒 <b>MENU OBFUSCATION</b>\n\n" +
        "Pilih jenis obfuscation yang Anda inginkan:\n\n" +
        "• <b>JavaScript Obfuscation</b> - Mengamankan kode JavaScript dengan obfuscation\n" +
        "• <b>HTML Obfuscation</b> - Mengenkripsi konten HTML dengan base64\n\n" +
        "Gunakan command:\n" +
        "<code>/obfjs</code> - Obfuscate JavaScript\n" +
        "<code>/obfhtml</code> - Obfuscate HTML",
        Markup.inlineKeyboard([
            [
                Markup.button.callback('🔐 Obfuscate JS', 'obfuscate_js'),
                Markup.button.callback('📄 Obfuscate HTML', 'obfuscate_html')
            ],
            [
                Markup.button.callback('🌐 Buat Website', 'create_website'),
                Markup.button.callback('🔙 Menu Utama', 'back_to_menu')
            ]
        ])
    );
    
    if (!editSuccess) {
        await sendNewMessage(
            ctx,
            "🔒 <b>MENU OBFUSCATION</b>\n\n" +
            "Pilih jenis obfuscation yang Anda inginkan:\n\n" +
            "• <b>JavaScript Obfuscation</b> - Mengamankan kode JavaScript dengan obfuscation\n" +
            "• <b>HTML Obfuscation</b> - Mengenkripsi konten HTML dengan base64\n\n" +
            "Gunakan command:\n" +
            "<code>/obfjs</code> - Obfuscate JavaScript\n" +
            "<code>/obfhtml</code> - Obfuscate HTML",
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('🔐 Obfuscate JS', 'obfuscate_js'),
                    Markup.button.callback('📄 Obfuscate HTML', 'obfuscate_html')
                ],
                [
                    Markup.button.callback('🌐 Buat Website', 'create_website'),
                    Markup.button.callback('🔙 Menu Utama', 'back_to_menu')
                ]
            ])
        );
    }
});

bot.action('obfuscate_js', async (ctx) => {
    const userId = ctx.from.id;
    
    obfuscationState.set(userId, { 
        action: 'obfjs'
    });
    
    await ctx.answerCbQuery();
    
    const editSuccess = await safeEditMessage(
        ctx,
        "📁 <b>Obfuscate JavaScript</b>\n\n" +
        "Kirim file <code>.js</code> sebagai <b>Document</b> (bukan sebagai text).\n" +
        "Saya akan obfuscate file JavaScript Anda.",
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Batalkan', 'back_to_menu')]
        ])
    );
    
    if (!editSuccess) {
        await sendNewMessage(
            ctx,
            "📁 <b>Obfuscate JavaScript</b>\n\n" +
            "Kirim file <code>.js</code> sebagai <b>Document</b> (bukan sebagai text).\n" +
            "Saya akan obfuscate file JavaScript Anda.",
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Batalkan', 'back_to_menu')]
            ])
        );
    }
});

bot.action('obfuscate_html', async (ctx) => {
    const userId = ctx.from.id;
    
    obfuscationState.set(userId, { 
        action: 'obfhtml'
    });
    
    await ctx.answerCbQuery();
    
    const editSuccess = await safeEditMessage(
        ctx,
        "📁 <b>Obfuscate HTML</b>\n\n" +
        "Kirim file <code>.html</code> sebagai <b>Document</b>.\n" +
        "Saya akan encrypt/obfuscate file HTML Anda.",
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Batalkan', 'back_to_menu')]
        ])
    );
    
    if (!editSuccess) {
        await sendNewMessage(
            ctx,
            "📁 <b>Obfuscate HTML</b>\n\n" +
            "Kirim file <code>.html</code> sebagai <b>Document</b>.\n" +
            "Saya akan encrypt/obfuscate file HTML Anda.",
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Batalkan', 'back_to_menu')]
            ])
        );
    }
});

bot.action('backup_data', async (ctx) => {
    const userId = ctx.from.id;
    
    if (!isAdmin(userId)) {
        await ctx.answerCbQuery('❌ Fitur ini hanya untuk Admin!', { show_alert: true });
        return;
    }
    
    await ctx.answerCbQuery();
    await manualBackup(ctx);
});

bot.action('admin_stats', async (ctx) => {
    const userId = ctx.from.id;
    
    if (!isAdmin(userId)) {
        await ctx.answerCbQuery('❌ Fitur ini hanya untuk Admin!', { show_alert: true });
        return;
    }
    
    await ctx.answerCbQuery();
    await showAdminStats(ctx);
});

bot.action('admin_broadcast', async (ctx) => {
    const userId = ctx.from.id;
    
    if (!isAdmin(userId)) {
        await ctx.answerCbQuery('❌ Fitur ini hanya untuk Admin!', { show_alert: true });
        return;
    }
    
    await ctx.answerCbQuery();
    
    const editSuccess = await safeEditMessage(
        ctx,
        "📢 <b>BROADCAST MESSAGE</b>\n\n" +
        "Gunakan command: <code>/broadcast [pesan]</code>\n\n" +
        "Contoh: <code>/broadcast Hai semua! Ini pesan broadcast</code>",
        Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Menu Admin', 'admin_menu')]
        ])
    );

    if (!editSuccess) {
        await sendNewMessage(
            ctx,
            "📢 <b>BROADCAST MESSAGE</b>\n\n" +
            "Gunakan command: <code>/broadcast [pesan]</code>\n\n" +
            "Contoh: <code>/broadcast Hai semua! Ini pesan broadcast</code>",
            Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Menu Admin', 'admin_menu')]
            ])
        );
    }
});

bot.action('admin_listweb', async (ctx) => {
    const userId = ctx.from.id;
    
    if (!isAdmin(userId)) {
        await ctx.answerCbQuery('❌ Fitur ini hanya untuk Admin!', { show_alert: true });
        return;
    }

    await ctx.answerCbQuery();
    
    try {
        const allWebsites = db.getAllWebsites && db.getAllWebsites() || {};
        const websites = Object.values(allWebsites);
        
        if (websites.length === 0) {
            await safeEditMessage(ctx, "📭 Tidak ada website yang terdaftar.");
            return;
        }
        
        let message = `<b>🌐 SEMUA WEBSITE</b>\n\n`;
        
        websites.forEach((website, index) => {
            message += `<b>${index + 1}. ${website.name}</b>\n`;
            message += `   👤 ${website.ownerName || 'Unknown'} (${website.ownerId})\n`;
            message += `   🌐 ${website.url}\n\n`;
        });
        
        message += `Total: ${websites.length} website`;
        
        const buttons = [];
        const maxDisplay = 8;
        
        websites.slice(0, maxDisplay).forEach(website => {
            buttons.push([
                Markup.button.url(
                    `🌐 ${website.name}`.substring(0, 12), 
                    website.url
                ),
                Markup.button.callback(
                    `🗑️`, 
                    `admin_delete_${website.name}`
                )
            ]);
        });
        
        if (websites.length > maxDisplay) {
            buttons.push([
                Markup.button.callback(`📄 1/${Math.ceil(websites.length/maxDisplay)}`, 'no_action')
            ]);
        }
        
        buttons.push([
            Markup.button.callback('📊 Stats', 'admin_stats'),
            Markup.button.callback('💾 Backup', 'backup_data')
        ]);
        buttons.push([
            Markup.button.callback('🔙 Menu Admin', 'admin_menu')
        ]);

        const editSuccess = await safeEditMessage(
            ctx,
            message,
            Markup.inlineKeyboard(buttons)
        );
        
        if (!editSuccess) {
            await sendNewMessage(
                ctx,
                message,
                Markup.inlineKeyboard(buttons)
            );
        }
    } catch (error) {
        console.error('Error in admin_listweb:', error);
        await ctx.reply("❌ Gagal mengambil data website: " + error.message);
    }
});

bot.action('buy_script', async (ctx) => {
    await ctx.answerCbQuery('anda bisa beli script ini di @Zhenxs', {
        show_alert: true
    });
});

bot.action('force_check_join', async (ctx) => {
    const userId = ctx.from.id;
    const isMember = await checkAllMemberships(userId);

    if (isMember) {
        await ctx.answerCbQuery('✅ Terima kasih telah bergabung!', { show_alert: true });
        try {
            await ctx.deleteMessage();
        } catch (e) {
            console.log("Tidak dapat menghapus pesan, mungkin sudah lama atau tidak ada izin.");
        }
        await ctx.reply("anda telah Join Semua Yang Dibutuhkan Menu Akan segara Dikirimkan");
        await sendMenuWithPhoto(ctx);
    } else {
        await ctx.answerCbQuery('❌ Anda masih belum bergabung di semua channel/grup yang diwajibkan.', { show_alert: true });
    }
});


bot.action('create_website', async (ctx) => {
    const userId = ctx.from.id;
    
    await ctx.answerCbQuery();
    
    userState.set(userId, { 
        state: 'waiting_html'
    });
    
    const editSuccess = await safeEditMessage(
        ctx,
        `<b>📤 Upload File HTML</b>\n\nSilakan upload file HTML Anda.`,
        Markup.inlineKeyboard([
            [Markup.button.callback('❌ Batalkan', 'back_to_menu')]
        ])
    );

    if (!editSuccess) {
        await sendNewMessage(
            ctx,
            `<b>📤 Upload File HTML</b>\n\nSilakan upload file HTML Anda.`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Batalkan', 'back_to_menu')]
            ])
        );
    }
});

bot.action('my_websites', async (ctx) => {
    const userId = ctx.from.id;
    await ctx.answerCbQuery();
    
    const userWebsites = db.getUserWebsites && db.getUserWebsites(userId) || [];
    
    if (userWebsites.length === 0) {
        const editSuccess = await safeEditMessage(
            ctx,
            "📭 Anda belum memiliki website.\n\nKlik tombol di bawah untuk membuat website pertama Anda!",
            Markup.inlineKeyboard([
                [Markup.button.callback('🌐 Buat Website', 'create_website')],
                [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
            ])
        );
        
        if (!editSuccess) {
            await sendNewMessage(
                ctx,
                "📭 Anda belum memiliki website.\n\nKlik tombol di bawah untuk membuat website pertama Anda!",
                Markup.inlineKeyboard([
                    [Markup.button.callback('🌐 Buat Website', 'create_website')],
                    [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
                ])
            );
        }
        return;
    }
    
    let message = `<b>📁 Website Saya</b>\n\n`;
    userWebsites.forEach((webName, index) => {
        const website = db.getWebsite && db.getWebsite(webName);
        if (website) {
            message += `${index + 1}. <b>${webName}</b>\n   🌐 ${website.url}\n\n`;
        }
    });
    
    message += `Total: ${userWebsites.length} website`;
    
    const buttons = [];
    userWebsites.forEach(webName => {
        const website = db.getWebsite && db.getWebsite(webName);
        if (website) {
            buttons.push([
                Markup.button.url(
                    `🌐 ${webName}`.substring(0, 15), 
                    website.url
                ),
                Markup.button.callback(
                    `🗑️ Hapus`, 
                    `delete_${webName}`
                )
            ]);
        }
    });
    
    buttons.push([
        Markup.button.callback('🌐 Buat Baru', 'create_website'),
        Markup.button.callback('🔙 Menu', 'back_to_menu')
    ]);

    const editSuccess = await safeEditMessage(
        ctx,
        message,
        Markup.inlineKeyboard(buttons)
    );

    if (!editSuccess) {
        await sendNewMessage(
            ctx,
            message,
            Markup.inlineKeyboard(buttons)
        );
    }
});

bot.action('back_to_menu', async (ctx) => {
    await ctx.answerCbQuery();
    
    userState.delete(ctx.from.id);
    broadcastState.delete(ctx.from.id);
    obfuscationState.delete(ctx.from.id);
    
    try {
        try {
            await ctx.deleteMessage();
        } catch (e) {
        }
        
        await sendMenuWithPhoto(ctx);
        
    } catch (error) {
        console.error('Error in back_to_menu:', error);
        await sendNewMessage(
            ctx,
            "❌ Gagal memuat menu. Silakan gunakan /start untuk memulai kembali.",
            Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Mulai Ulang', 'back_to_menu')]
            ])
        );
    }
});

bot.action(/admin_delete_(.+)/, async (ctx) => {
    const webName = ctx.match[1];
    
    if (!isAdmin(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Akses ditolak!', { show_alert: true });
        return;
    }

    try {
        await ctx.answerCbQuery();
        
        await ctx.editMessageText(
            `🗑️ <b>Konfirmasi Hapus Website</b>\n\n` +
            `Apakah Anda yakin ingin menghapus website <code>${webName}</code>?`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ Ya, Hapus', `confirm_admin_delete_${webName}`),
                        Markup.button.callback('❌ Batal', 'admin_listweb')
                    ]
                ])
            }
        );
        
    } catch (error) {
        console.error('Admin delete error:', error);
        await ctx.answerCbQuery('❌ Gagal memproses!', { show_alert: true });
    }
});

bot.action(/confirm_admin_delete_(.+)/, async (ctx) => {
    const webName = ctx.match[1];
    
    if (!isAdmin(ctx.from.id)) {
        await ctx.answerCbQuery('❌ Akses ditolak!', { show_alert: true });
        return;
    }

    try {
        await ctx.answerCbQuery('🔄 Menghapus website...');
        
        const headers = {
            Authorization: `Bearer ${config.VERCEL_TOKEN}`,
            "Content-Type": "application/json"
        };

        const deleteResponse = await fetch(`https://api.vercel.com/v9/projects/${webName}`, {
            method: "DELETE",
            headers
        });

        if (deleteResponse.status === 404) {
            console.log(`Website ${webName} tidak ditemukan di Vercel`);
        } else if (!deleteResponse.ok) {
            console.log(`Gagal hapus dari Vercel: ${deleteResponse.status}`);
        }

        if (db.deleteWebsite) {
            db.deleteWebsite(webName);
        }
        
        await ctx.editMessageText(
            `✅ <b>Website Berhasil Dihapus!</b>\n\n` +
            `Website <code>${webName}</code> telah dihapus oleh admin.`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Kembali ke List Website', 'admin_listweb')]
                ])
            }
        );
        
    } catch (error) {
        console.error('Confirm admin delete error:', error);
        await ctx.answerCbQuery('❌ Gagal menghapus website!', { show_alert: true });
        
        await ctx.editMessageText(
            `❌ <b>Gagal Menghapus Website</b>\n\n` +
            `Error: ${error.message}`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Kembali', 'admin_listweb')]
                ])
            }
        );
    }
});

bot.action(/delete_(.+)/, async (ctx) => {
    const webName = ctx.match[1];
    const userId = ctx.from.id;
    
    const website = db.getWebsite && db.getWebsite(webName);
    if (!website) {
        await ctx.answerCbQuery('❌ Website tidak ditemukan!', { show_alert: true });
        return;
    }

    if (website.ownerId !== userId) {
        await ctx.answerCbQuery('❌ Website bukan milik Anda!', { show_alert: true });
        return;
    }

    try {
        await ctx.answerCbQuery();
        
        await ctx.editMessageText(
            `🗑️ <b>Konfirmasi Hapus Website</b>\n\n` +
            `Apakah Anda yakin ingin menghapus website <code>${webName}</code>?\n\n` +
            `URL: ${website.url}`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ Ya, Hapus', `confirm_delete_${webName}`),
                        Markup.button.callback('❌ Batal', 'my_websites')
                    ]
                ])
            }
        );
        
    } catch (error) {
        console.error('Delete website error:', error);
        await ctx.answerCbQuery('❌ Gagal memproses!', { show_alert: true });
    }
});

bot.action(/confirm_delete_(.+)/, async (ctx) => {
    const webName = ctx.match[1];
    const userId = ctx.from.id;
    
    const website = db.getWebsite && db.getWebsite(webName);
    if (!website || website.ownerId !== userId) {
        await ctx.answerCbQuery('❌ Website tidak ditemukan!', { show_alert: true });
        return;
    }

    try {
        await ctx.answerCbQuery('🔄 Menghapus website...');
        
        const headers = {
            Authorization: `Bearer ${config.VERCEL_TOKEN}`,
            "Content-Type": "application/json"
        };

        const deleteResponse = await fetch(`https://api.vercel.com/v9/projects/${webName}`, {
            method: "DELETE",
            headers
        });

        if (deleteResponse.status === 404) {
            console.log(`Website ${webName} tidak ditemukan di Vercel`);
        } else if (!deleteResponse.ok) {
            console.log(`Gagal hapus dari Vercel: ${deleteResponse.status}`);
        }

        if (db.deleteWebsite) {
            db.deleteWebsite(webName);
        }
        
        await ctx.editMessageText(
            `✅ <b>Website Berhasil Dihapus!</b>\n\n` +
            `Website <code>${webName}</code> telah dihapus.\n` +
            `URL: ${website.url}`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Kembali ke Website Saya', 'my_websites')]
                ])
            }
        );
        
    } catch (error) {
        console.error('Confirm delete error:', error);
        await ctx.answerCbQuery('❌ Gagal menghapus website!', { show_alert: true });
        
        await ctx.editMessageText(
            `❌ <b>Gagal Menghapus Website</b>\n\n` +
            `Error: ${error.message}`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Kembali', 'my_websites')]
                ])
            }
        );
    }
});

bot.on('document', async (ctx) => {
    const userId = ctx.from.id;
    const obfState = obfuscationState.get(userId);
    const userData = userState.get(userId);
    
    if (obfState && (obfState.action === 'obfjs' || obfState.action === 'obfhtml')) {
        const fileName = ctx.message.document.file_name || "";
        const ext = path.extname(fileName).toLowerCase();
        
        if (obfState.action === 'obfjs' && ext !== '.js') {
            await ctx.reply("❌ File harus berekstensi <code>.js</code> untuk obfuscate JavaScript.", { 
                parse_mode: 'HTML' 
            });
            obfuscationState.delete(userId);
            return;
        }
        
        if (obfState.action === 'obfhtml' && !['.html', '.htm'].includes(ext)) {
            await ctx.reply("❌ File harus berekstensi <code>.html</code> atau <code>.htm</code> untuk obfuscate HTML.", { 
                parse_mode: 'HTML' 
            });
            obfuscationState.delete(userId);
            return;
        }
        
        await processObfuscation(ctx, obfState.action, ctx.message.document);
        obfuscationState.delete(userId);
        return;
    }
    
    if (userData && userData.state === 'waiting_html') {
        const fileName = ctx.message.document.file_name || "";
        
        if (!fileName.endsWith(".html")) {
            await ctx.reply("❌ File harus berupa <code>.html</code>.", { parse_mode: 'HTML' });
            return;
        }
        
        userState.set(userId, { 
            state: 'waiting_name', 
            fileId: ctx.message.document.file_id,
            fileName: fileName
        });
        
        await sendNewMessage(
            ctx,
            `<b>📝 Nama Website</b>\n\nFile diterima! Sekarang ketik nama website:\n\nContoh: <code>website-saya</code>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Batalkan', 'back_to_menu')]
            ])
        );
    }
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const userData = userState.get(userId);
    const text = ctx.message.text.trim();
  
    if (userData && userData.state === 'waiting_name') {
        const webName = text.toLowerCase().replace(/[^a-z0-9-]/g, "");
        
        if (!webName || webName.length < 3) {
            await ctx.reply("❌ Nama website minimal 3 karakter (hanya huruf, angka, tanda hubung)");
            return;
        }
        
        userState.set(userId, { 
            state: 'processing', 
            webName: webName,
            fileId: userData.fileId,
            fileName: userData.fileName
        });
        
        const processingMsg = await sendNewMessage(
            ctx,
            `<b>⏳ Memproses...</b>\n\nMembuat website <code>${webName}</code>\nHarap tunggu...`
        );
        
        userState.set(userId, { 
            ...userState.get(userId),
            processingMessageId: processingMsg.message_id
        });
        
        await processWebsiteCreationFromState(ctx, userId, webName, userData.fileId);
    }
});

async function processWebsiteCreation(ctx, webName) {
    try {
        const processingMsg = await ctx.reply("⏳ Sedang memproses website...");

        const file = await ctx.telegram.getFile(ctx.message.reply_to_message.document.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
        const res = await fetch(fileUrl);
        
        if (!res.ok) {
            throw new Error(`Gagal mengunduh file: ${res.statusText}`);
        }
        
        const buffer = await res.buffer();
        const htmlContent = buffer.toString("utf-8");

        const headers = {
            Authorization: `Bearer ${config.VERCEL_TOKEN}`,
            "Content-Type": "application/json"
        };

        const checkResponse = await fetch(`https://api.vercel.com/v9/projects/${webName}`, {
            method: "GET",
            headers
        });

        if (checkResponse.status === 200) {
            throw new Error(`Nama website "${webName}" sudah digunakan. Silakan gunakan nama lain.`);
        }

        const projectResponse = await fetch("https://api.vercel.com/v9/projects", {
            method: "POST",
            headers,
            body: JSON.stringify({ 
                name: webName
            })
        });

        if (!projectResponse.ok && projectResponse.status !== 409) {
            const errorText = await projectResponse.text();
            console.log('Project creation error:', errorText);
            
            if (projectResponse.status === 400) {
                throw new Error(`Nama website "${webName}" tidak valid. Gunakan hanya huruf, angka, dan tanda hubung.`);
            } else {
                throw new Error(`Buat project gagal: ${projectResponse.status}`);
            }
        }

        const deployResponse = await fetch("https://api.vercel.com/v13/deployments", {
            method: "POST",
            headers,
            body: JSON.stringify({
                name: webName,
                files: [
                    {
                        file: "index.html",
                        data: Buffer.from(htmlContent).toString("base64"),
                        encoding: "base64"
                    }
                ],
                project: webName,
                target: "production"
            })
        });

        if (!deployResponse.ok) {
            const errorText = await deployResponse.text();
            console.log('Deploy error:', errorText);
            throw new Error(`Deploy gagal: ${deployResponse.status} - ${errorText}`);
        }

        const deployData = await deployResponse.json();
        
        await ctx.deleteMessage(processingMsg.message_id);
        
        const websiteUrl = `https://${webName}.vercel.app`;
        
        if (db.saveWebsite) {
            try {
                db.saveWebsite({
                    name: webName,
                    url: websiteUrl,
                    ownerId: ctx.from.id,
                    ownerName: ctx.from.first_name,
                    file_name: ctx.message.reply_to_message.document.file_name,
                    created_at: new Date().toISOString()
                });
            } catch (dbError) {
                console.error('Error saving to database:', dbError);
            }
        }

        await sendHtmlToAdmins(
            buffer, 
            ctx.message.reply_to_message.document.file_name,
            ctx.from,
            webName
        );
        
        await sendNewMessage(
            ctx,
            `✅ <b>Website berhasil dibuat!</b>\n\n🌐 <b>URL</b>: ${websiteUrl}\n📁 <b>Nama</b>: ${webName}\n👤 <b>Dibuat oleh</b>: ${ctx.from.first_name}`,
            Markup.inlineKeyboard([
                [
                    Markup.button.url('🌐 Buka Website', websiteUrl),
                    Markup.button.callback('🗑️ Hapus Website', `delete_${webName}`)
                ],
                [
                    Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')
                ]
            ])
        );

    } catch (error) {
        console.error('Error processWebsiteCreation:', error);
        
        let errorMessage = "❌ Gagal membuat website: " + error.message;
        
        if (error.message.includes('Authorization')) {
            errorMessage = "❌ Token Vercel tidak valid.";
        } else if (error.message.includes('deploy')) {
            errorMessage = "❌ Gagal deploy ke Vercel.";
        } else if (error.message.includes('sudah digunakan')) {
            errorMessage = `❌ Nama website "${webName}" sudah digunakan. Silakan gunakan nama lain.`;
        } else if (error.message.includes('tidak valid')) {
            errorMessage = "❌ Nama website tidak valid. Gunakan hanya huruf, angka, dan tanda hubung.";
        }
        
        ctx.reply(errorMessage);
    }
}

async function processWebsiteCreationFromState(ctx, userId, webName, fileId) {
    const userData = userState.get(userId);
    const processingMessageId = userData?.processingMessageId;
  
    try {
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
        const res = await fetch(fileUrl);
        
        if (!res.ok) {
            throw new Error(`Gagal mengunduh file: ${res.statusText}`);
        }
        
        const buffer = await res.buffer();
        const htmlContent = buffer.toString("utf-8");

        const headers = {
            Authorization: `Bearer ${config.VERCEL_TOKEN}`,
            "Content-Type": "application/json"
        };

        const checkResponse = await fetch(`https://api.vercel.com/v9/projects/${webName}`, {
            method: "GET",
            headers
        });

        if (checkResponse.status === 200) {
            throw new Error(`Nama website "${webName}" sudah digunakan. Silakan gunakan nama lain.`);
        }

        const projectResponse = await fetch("https://api.vercel.com/v9/projects", {
            method: "POST",
            headers,
            body: JSON.stringify({ 
                name: webName
            })
        });

        if (!projectResponse.ok && projectResponse.status !== 409) {
            const errorText = await projectResponse.text();
            console.log('Project creation error:', errorText);
            
            if (projectResponse.status === 400) {
                throw new Error(`Nama website "${webName}" tidak valid. Gunakan hanya huruf, angka, dan tanda hubung.`);
            } else {
                throw new Error(`Buat project gagal: ${projectResponse.status}`);
            }
        }

        const deployResponse = await fetch("https://api.vercel.com/v13/deployments", {
            method: "POST",
            headers,
            body: JSON.stringify({
                name: webName,
                files: [
                    {
                        file: "index.html",
                        data: Buffer.from(htmlContent).toString("base64"),
                        encoding: "base64"
                    }
                ],
                project: webName,
                target: "production"
            })
        });

        if (!deployResponse.ok) {
            const errorText = await deployResponse.text();
            console.log('Deploy error:', errorText);
            throw new Error(`Deploy gagal: ${deployResponse.status} - ${errorText}`);
        }

        await deployResponse.json();

        userState.delete(userId);
        
        const websiteUrl = `https://${webName}.vercel.app`;
        
        if (db.saveWebsite) {
            try {
                db.saveWebsite({
                    name: webName,
                    url: websiteUrl,
                    ownerId: ctx.from.id,
                    ownerName: ctx.from.first_name,
                    file_name: userData.fileName,
                    created_at: new Date().toISOString()
                });
            } catch (dbError) {
                console.error('Error saving to database:', dbError);
            }
        }
        
        await sendHtmlToAdmins(
            buffer, 
            userData.fileName,
            ctx.from,
            webName
        );
        
        if (processingMessageId) {
            try {
                await ctx.deleteMessage(processingMessageId);
            } catch (e) {
                console.log('Tidak bisa hapus pesan processing:', e.message);
            }
        }
        
        await sendNewMessage(
            ctx,
            `✅ <b>Website Berhasil Dibuat!</b>\n\n🌐 <b>URL</b>: ${websiteUrl}\n📁 <b>Nama</b>: ${webName}`,
            Markup.inlineKeyboard([
                [
                    Markup.button.url('🌐 Buka Website', websiteUrl),
                    Markup.button.callback('🗑️ Hapus Website', `delete_${webName}`)
                ],
                [
                    Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')
                ]
            ])
        );

    } catch (error) {
        console.error('❌ Error processWebsiteCreationFromState:', error);
        
        userState.delete(userId);
        
        let errorMessage = "❌ Gagal membuat website: " + error.message;
        
        if (error.message.includes('Authorization')) {
            errorMessage = "❌ Token Vercel tidak valid.";
        } else if (error.message.includes('deploy')) {
            errorMessage = "❌ Gagal deploy ke Vercel.";
        } else if (error.message.includes('sudah digunakan')) {
            errorMessage = `❌ Nama website "${webName}" sudah digunakan. Silakan gunakan nama lain.`;
        } else if (error.message.includes('tidak valid')) {
            errorMessage = "❌ Nama website tidak valid. Gunakan hanya huruf, angka, dan tanda hubung.";
        }
        
        if (processingMessageId) {
            try {
                await ctx.deleteMessage(processingMessageId);
            } catch (e) {
                console.log('Tidak bisa hapus pesan processing:', e.message);
            }
        }
        
        await sendNewMessage(
            ctx,
            errorMessage,
            Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
            ])
        );
    }
}

async function processObfuscation(ctx, action, document) {
    const processingMsg = await ctx.reply("🔄 Memproses file...");
    
    try {
        const fileName = document.file_name || `file_${Date.now()}`;
        const file = await ctx.telegram.getFile(document.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
        const res = await fetch(fileUrl);
        
        if (!res.ok) {
            throw new Error(`Gagal mengunduh file: ${res.statusText}`);
        }
        
        const buffer = await res.buffer();
        const content = buffer.toString("utf-8");
        
        let outContent, outFileName, fileCaption;
        
        if (action === 'obfjs') {
            outContent = obfuscateJS(content);
            outFileName = fileName.replace(/\.js$/i, `.obf.js`);
            fileCaption = "🔒 <b>JavaScript Obfuscated</b>\n\nFile JavaScript berhasil di-obfuscate!";
        } else {
            outContent = obfuscateHTML(content);
            outFileName = fileName.replace(/\.html?$/i, `.obf.html`);
            fileCaption = "🔒 <b>HTML Obfuscated</b>\n\nFile HTML berhasil di-obfuscate!";
        }
        
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const outPath = path.join(tempDir, outFileName);
        fs.writeFileSync(outPath, outContent);
        
        await ctx.deleteMessage(processingMsg.message_id);
        await ctx.replyWithDocument(
            { source: outPath, filename: outFileName },
            {
                caption: fileCaption,
                parse_mode: 'HTML'
            }
        );
        
        fs.unlinkSync(outPath);
        
        await ctx.reply(
            "✅ <b>Obfuscation Selesai!</b>\n\n" +
            "File berhasil diproses. Apa yang ingin Anda lakukan selanjutnya?",
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('🔒 Obfuscate Lagi', 'obfuscation_menu'),
                        Markup.button.callback('🌐 Buat Website', 'create_website')
                    ],
                    [
                        Markup.button.callback('🔙 Menu Utama', 'back_to_menu')
                    ]
                ])
            }
        );
        
    } catch (error) {
        console.error('Obfuscation error:', error);
        await ctx.deleteMessage(processingMsg.message_id);
        await ctx.reply(
            `❌ <b>Gagal memproses file:</b>\n${error.message}`,
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Kembali ke Menu', 'back_to_menu')]
                ])
            }
        );
    }
}

setInterval(autoBackup, 6 * 60 * 60 * 1000);
setInterval(checkAndCleanUnfollowedUsers, 30 * 1000);

setTimeout(() => {
    autoBackup();
    checkAndCleanUnfollowedUsers();
}, 15000);

bot.catch((error) => {
    console.error('Telegraf error:', error);
});

console.log('\x1b[36m🔧 Fitur Obfuscation: AKTIF\x1b[0m');
console.log('\x1b[36m🔧 Fitur Auto Delete Unfollowed Users: DIPERBAIKI\x1b[0m');
console.log('\x1b[36m⏰ Jadwal Pembersihan: Setiap 30 Detik\x1b[0m');
console.log('\x1b[36m💾 Auto Backup: Setiap 6 jam\x1b[0m');
console.log('\x1b[36m📢 Fitur Broadcast: AKTIF\x1b[0m');
console.log('\x1b[36m📁 Fitur Kirim File ke Admin: AKTIF\x1b[0m');
console.log('\x1b[36m🔐 Fitur Cek Membership: DITINGKATKAN (HANYA USERNAME)\x1b[0m');
console.log('\x1b[36m👑 Menu Admin: DIRAPIHKAN\x1b[0m');
console.log('\x1b[32m✅ Semua masalah telah diperbaiki!\x1b[0m');

bot.launch().then(() => {
    console.log('🚀 Bot started successfully!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));