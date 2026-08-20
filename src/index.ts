import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { scrapeChannel } from "./scraper";

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once("ready", async () => {
    console.log(`Logged in as ${client.user?.tag}`);

    await scrapeChannel(client);
});

client.login(process.env.DISCORD_TOKEN);