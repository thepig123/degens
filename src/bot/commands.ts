import { SlashCommandBuilder } from "discord.js";

export const commands = [
    new SlashCommandBuilder()
        .setName("guesswho")
        .setDescription("Play Guess Who with messages from the server")
        .addSubcommand(subcommand =>
            subcommand
                .setName("start")
                .setDescription("Start a new Guess Who game")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("stop")
                .setDescription("Stop the current Guess Who game")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("leaderboard")
                .setDescription("Show the Guess Who leaderboard")
        )
        .toJSON()
];