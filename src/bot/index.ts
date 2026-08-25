import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    ChatInputCommandInteraction,
    SnowflakeUtil
} from "discord.js";

import dotenv from "dotenv";

import { commands } from "./commands";

import {
    startGame,
    handleVote,
    stopGame,
    getLeaderboard
} from "./game";

dotenv.config();

const token =
    process.env.DISCORD_TOKEN;

const clientId =
    process.env.CLIENT_ID;

const guildId =
    process.env.GUILD_ID;

// Replace this with the Discord user ID that should be allowed to use /deleteword.
const DELETE_WORD_USER_ID =
    "249708693896167436";

if (!token) {
    throw new Error(
        "DISCORD_TOKEN is missing from .env"
    );
}

if (!clientId) {
    throw new Error(
        "CLIENT_ID is missing from .env"
    );
}

if (!guildId) {
    throw new Error(
        "GUILD_ID is missing from .env"
    );
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

declare global {
    var discordClient:
        | Client
        | undefined;
}

globalThis.discordClient = client;

async function registerCommands() {

    const rest = new REST({
        version: "10"
    }).setToken(token);

    console.log(
        "Registering slash commands..."
    );

    await rest.put(
        Routes.applicationGuildCommands(
            clientId,
            guildId
        ),
        {
            body: commands
        }
    );

    console.log(
        "Slash commands registered."
    );
}

client.once(
    "clientReady",
    async readyClient => {

        console.log(
            `Logged in as ${readyClient.user.tag}`
        );

        await registerCommands();
    }
);

client.on(
    "interactionCreate",
    async interaction => {

        try {

            // Slash commands
            if (
                interaction.isChatInputCommand()
            ) {

                await handleCommand(
                    interaction
                );

                return;
            }

            // Answer buttons
            if (
                interaction.isButton()
            ) {

                await handleVote(
                    interaction
                );

                return;
            }

        } catch (error) {

            console.error(
                "Interaction error:",
                error
            );

            if (
                interaction.isChatInputCommand() ||
                interaction.isButton()
            ) {

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.followUp({
                        content:
                            "❌ Something went wrong.",
                        ephemeral: true
                    });

                } else {

                    await interaction.reply({
                        content:
                            "❌ Something went wrong.",
                        ephemeral: true
                    });
                }
            }
        }
    }
);


function escapeRegExp(value: string) {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


function parseDateBoundary(
    value: string
) {

    const normalized =
        /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T00:00:00.000Z`
            : value;

    const timestamp =
        Date.parse(normalized);

    if (
        Number.isNaN(timestamp) ||
        timestamp < 1420070400000
    ) {
        return null;
    }

    return timestamp;
}


async function deleteMessagesContainingWord(
    interaction: ChatInputCommandInteraction
) {

    if (
        interaction.user.id !==
        DELETE_WORD_USER_ID
    ) {

        await interaction.reply({
            content:
                "❌ You are not allowed to use this command.",
            ephemeral: true
        });

        return;
    }

    const channel =
        interaction.channel;

    if (
        !channel ||
        !channel.isTextBased() ||
        !("messages" in channel)
    ) {

        await interaction.reply({
            content:
                "❌ This command can only be used in a text channel.",
            ephemeral: true
        });

        return;
    }

    const word =
        interaction.options
            .getString("word", true)
            .trim();

    if (!word) {

        await interaction.reply({
            content:
                "❌ Enter a word to delete.",
            ephemeral: true
        });

        return;
    }

    const beforeInput =
        interaction.options
            .getString("before")
            ?.trim();

    const afterInput =
        interaction.options
            .getString("after")
            ?.trim();

    const beforeTimestamp =
        beforeInput
            ? parseDateBoundary(beforeInput)
            : null;

    const afterTimestamp =
        afterInput
            ? parseDateBoundary(afterInput)
            : null;

    if (
        (beforeInput && beforeTimestamp === null) ||
        (afterInput && afterTimestamp === null)
    ) {

        await interaction.reply({
            content:
                "❌ Invalid date. Use YYYY-MM-DD or a full ISO timestamp, such as 2025-08-25T18:30:00Z.",
            ephemeral: true
        });

        return;
    }

    if (
        beforeTimestamp !== null &&
        afterTimestamp !== null &&
        afterTimestamp >= beforeTimestamp
    ) {

        await interaction.reply({
            content:
                "❌ The `after` boundary must be earlier than the `before` boundary.",
            ephemeral: true
        });

        return;
    }

    const exactWord =
        new RegExp(
            `(?<![\\p{L}\\p{N}_])${escapeRegExp(word)}(?![\\p{L}\\p{N}_])`,
            "iu"
        );

    await interaction.deferReply({
        ephemeral: true
    });

    let before:
        string |
        undefined =
            beforeTimestamp !== null
                ? SnowflakeUtil
                    .generate({
                        timestamp:
                            beforeTimestamp
                    })
                    .toString()
                : undefined;

    let reachedAfterBoundary =
        false;

    let scanned = 0;
    let deleted = 0;
    let failed = 0;

    do {

        const messages =
            await channel.messages.fetch({
                limit: 100,
                before
            });

        if (messages.size === 0) {
            break;
        }

        const oldestMessage =
            messages.last();

        before =
            oldestMessage?.id;

        reachedAfterBoundary =
            afterTimestamp !== null &&
            oldestMessage !== undefined &&
            oldestMessage.createdTimestamp <=
                afterTimestamp;

        scanned +=
            messages.size;

        for (
            const message
            of messages.values()
        ) {

            if (
                afterTimestamp !== null &&
                message.createdTimestamp <=
                    afterTimestamp
            ) {
                continue;
            }

            if (
                !exactWord.test(
                    message.content
                )
            ) {
                continue;
            }

            try {

                await message.delete();
                deleted++;

            } catch (error) {

                failed++;

                console.error(
                    `Could not delete message ${message.id}:`,
                    error
                );
            }
        }

        if (
            scanned % 1000 === 0
        ) {

            await interaction.editReply(
                `🔎 Scanned ${scanned} messages; deleted ${deleted} so far...`
            );
        }

    } while (
        before &&
        !reachedAfterBoundary
    );

    const rangeDescription = [
        afterInput
            ? `after **${afterInput}**`
            : "",
        beforeInput
            ? `before **${beforeInput}**`
            : ""
    ]
        .filter(Boolean)
        .join(" and ");

    await interaction.editReply(
        [
            `✅ Finished scanning ${scanned} messages${rangeDescription ? ` ${rangeDescription}` : ""}.`,
            `Deleted **${deleted}** messages containing the exact word **${word}**.`,
            failed > 0
                ? `⚠️ Failed to delete **${failed}** matching messages.`
                : ""
        ]
            .filter(Boolean)
            .join("\n")
    );
}


async function handleCommand(
    interaction: ChatInputCommandInteraction
) {

    if (
        interaction.commandName ===
        "deleteword"
    ) {

        await deleteMessagesContainingWord(
            interaction
        );

        return;
    }

    if (
        interaction.commandName !==
        "guesswho"
    ) {
        return;
    }

    const subcommand =
        interaction.options.getSubcommand();

    if (subcommand === "start") {

        await startGame(
            interaction
        );

        return;
    }

    if (subcommand === "stop") {

        const stopped =
            stopGame(
                interaction.channelId
            );

        await interaction.reply({
            content: stopped
                ? "🛑 Game stopped."
                : "❌ There isn't a game running here.",
            ephemeral: true
        });

        return;
    }

    if (
        subcommand === "leaderboard"
    ) {

        const scores =
            getLeaderboard();

        const entries =
            Object.entries(scores)
                .sort(
                    ([, a], [, b]) =>
                        b.score - a.score
                )
                .slice(0, 10);

        if (entries.length === 0) {

            await interaction.reply(
                "🏆 No scores yet!"
            );

            return;
        }

        const leaderboard =
            entries
                .map(
                    ([userId, stats], index) =>
                        `${index + 1}. <@${userId}> — **${stats.score}**`
                )
                .join("\n");

        await interaction.reply({
            content: [
                "# 🏆 GUESS WHO LEADERBOARD",
                "",
                leaderboard
            ].join("\n")
        });
    }
}
    
client.login(token);
