import {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    ChatInputCommandInteraction
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
        GatewayIntentBits.Guilds
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


async function handleCommand(
    interaction: ChatInputCommandInteraction
) {

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