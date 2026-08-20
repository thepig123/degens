import { Client, TextChannel } from "discord.js";
import fs from "fs";

export async function scrapeChannel(client: Client) {

const channelId = process.env.CHANNEL_ID;

if (!channelId) {
    throw new Error("CHANNEL_ID is missing from .env");
}

const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) {
        throw new Error("Channel not found or not text channel");
    }

    const textChannel = channel as TextChannel;

    let allMessages = [];
    let lastId: string | undefined = undefined;

while (true) {
    const batch = await textChannel.messages.fetch({
        limit: 100,
        before: lastId
    });

    if (batch.size === 0) break;

const cleanedBatch = batch
    .filter(msg => !msg.author.bot)
    .filter(msg => msg.content.length > 10)
    .map(msg => ({
        author: msg.author.username,
        authorId: msg.author.id,
        content: msg.content,
        createdAt: msg.createdAt
    }));

    allMessages.push(...cleanedBatch);

    fs.writeFileSync(
        "messages.json",
        JSON.stringify(allMessages, null, 2)
    );

    lastId = batch.last()?.id;

    console.log(`Saved ${allMessages.length} messages`);
}
    console.log("Done!");
}