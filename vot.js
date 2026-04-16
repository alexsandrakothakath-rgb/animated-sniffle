require("dotenv").config();

const Eris = require("eris");
const axios = require("axios");

// 🔐 CONFIG
const bot = new Eris(process.env.TOKEN, {
    intents: ["guilds", "guildMessages", "directMessages", "messageContent"]
});

const PREFIX = process.env.PREFIX || "!";
const API = process.env.API_URL;        // your Codespace URL
const SECRET = process.env.API_SECRET;  // same as server.js

// 🛡 Anti-duplicate
const handledMessages = new Set();

// 🎨 Embed helper
function embed(title, desc, color = 0x00ffcc) {
    return {
        embeds: [{
            title,
            description: desc,
            color,
            footer: { text: "SGHost VPS" },
            timestamp: new Date()
        }]
    };
}

// 🔐 Admin check
function isAdmin(msg) {
    return msg.member && msg.member.permissions.has("administrator");
}

// 🧼 Clean username
function cleanName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// 🧠 Parse args
function parseResources(args) {
    let ram = "512m";
    let cpu = "0.5";
    let disk = "10";

    args.forEach(arg => {
        if (arg.startsWith("RAM:")) ram = arg.split(":")[1].toLowerCase();
        if (arg.startsWith("CPU:")) cpu = arg.split(":")[1];
        if (arg.startsWith("DISK:")) disk = arg.split(":")[1];
    });

    return { ram, cpu, disk };
}

// 🚀 BOT READY
bot.on("ready", () => {
    console.log("✅ SGHost Bot Online (Railway)");
});

// 🛡 Stability
bot.on("error", (err) => console.log("⚠️ Error:", err));
bot.on("disconnect", () => console.log("🔌 Disconnected"));
bot.on("resume", () => console.log("🔄 Reconnected"));

// 📩 COMMAND HANDLER
bot.on("messageCreate", async (msg) => {
    if (!msg.content.startsWith(PREFIX)) return;
    if (msg.author.bot) return;

    // 🛡 prevent duplicate execution
    if (handledMessages.has(msg.id)) return;
    handledMessages.add(msg.id);

    const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift();

    if (cmd !== "vps") return;

    const sub = args[0];

    // 📖 HELP
    if (!sub || sub === "help") {
        await bot.createMessage(msg.channel.id, embed(
            "📖 VPS Commands",
            `
!vps create @user RAM: CPU: DISK
!vps start @user
!vps enter @user
!vps delete @user
!vps list

Example:
!vps create @john RAM:2G CPU:1 DISK:50
            `
        ));
        return;
    }

    if (!isAdmin(msg)) {
        await bot.createMessage(msg.channel.id, embed("❌ Access Denied", "Admin only", 0xff0000));
        return;
    }

    // 🆕 CREATE
    if (sub === "create") {
        const user = msg.mentions[0];
        if (!user) {
            await bot.createMessage(msg.channel.id, embed("❌ Error", "Mention a user"));
            return;
        }

        const name = cleanName(user.username);
        const { ram, cpu, disk } = parseResources(args);

        try {
            await axios.post(`${API}/create`, {
                name, ram, cpu, disk
            }, {
                headers: { authorization: SECRET }
            });

            await bot.createMessage(msg.channel.id, embed(
                "✅ VPS Created",
                `👤 ${user.username}
🖥 ${name}
💾 RAM: ${ram}
⚡ CPU: ${cpu}
💿 Disk: ${disk}`
            ));
        } catch {
            await bot.createMessage(msg.channel.id, embed("❌ Error", "Creation failed", 0xff0000));
        }
        return;
    }

    // 🚀 START (RESTORE)
    if (sub === "start") {
        const user = msg.mentions[0];
        if (!user) return;

        const name = cleanName(user.username);

        try {
            await axios.post(`${API}/start`, { name }, {
                headers: { authorization: SECRET }
            });

            await bot.createMessage(msg.channel.id, embed(
                "🔄 VPS Restored",
                `👤 ${user.username}`
            ));
        } catch {
            await bot.createMessage(msg.channel.id, embed("❌ VPS Not Found", "No saved VPS", 0xff0000));
        }
        return;
    }

    // 🚀 ENTER (SSH)
    if (sub === "enter") {
        const user = msg.mentions[0];
        if (!user) return;

        const name = cleanName(user.username);

        try {
            const res = await axios.post(`${API}/enter`, { name }, {
                headers: { authorization: SECRET }
            });

            const ssh = res.data;

            const dm = await bot.getDMChannel(user.id);
            await dm.createMessage(embed("🎉 VPS SSH", "```" + ssh + "```"));

            await bot.createMessage(msg.channel.id, embed("📩 SSH Sent", user.username));
        } catch {
            await bot.createMessage(msg.channel.id, embed("❌ Error", "SSH failed", 0xff0000));
        }
        return;
    }

    // 🗑 DELETE
    if (sub === "delete") {
        const user = msg.mentions[0];
        if (!user) return;

        const name = cleanName(user.username);

        try {
            await axios.post(`${API}/delete`, { name }, {
                headers: { authorization: SECRET }
            });

            await bot.createMessage(msg.channel.id, embed("🗑 VPS Deleted", user.username));
        } catch {
            await bot.createMessage(msg.channel.id, embed("❌ Error", "Delete failed", 0xff0000));
        }
        return;
    }

    // 📦 LIST
    if (sub === "list") {
        try {
            const res = await axios.get(`${API}/list`, {
                headers: { authorization: SECRET }
            });

            await bot.createMessage(msg.channel.id, embed(
                "📦 VPS List",
                "```" + (res.data || "None") + "```"
            ));
        } catch {
            await bot.createMessage(msg.channel.id, embed("❌ Error", "Failed to fetch VPS list", 0xff0000));
        }
        return;
    }
});

// 🔁 SAFE START
function startBot() {
    try {
        bot.connect();
    } catch {
        setTimeout(startBot, 5000);
    }
}

startBot();
