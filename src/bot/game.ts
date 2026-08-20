import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    TextChannel,
} from "discord.js";

import fs from "fs";
import path from "path";

import { DiscordMessage } from "../types/messages";

type Question = {
    message: DiscordMessage;
    answers: string[];
};

type PlayerStats = {
    username: string;
    score: number;
    games: number;
};

type Game = {
    questions: Question[];
    votes: Map<string, string>;

    round: number;
    totalRounds: number;

    scores: Map<string, number>;
    streaks: Map<string, number>;

    channelId: string;
    messageId: string;

    roundId: string;
    timer?: NodeJS.Timeout;
};

const games = new Map<string, Game>();

const messagesPath = path.join(
    process.cwd(),
    "public",
    "quiz-messages.json"
);

const scoresPath = path.join(
    process.cwd(),
    "data",
    "scores.json"
);


/*
 * Cache the entire message pool.
 *
 * The huge JSON file is only read and parsed
 * once while the bot is running.
 */

let messageCache: DiscordMessage[] | null = null;

function getMessages(): DiscordMessage[] {

    if (messageCache) {
        return messageCache;
    }

    console.log(
        "Loading quiz messages..."
    );

    messageCache = JSON.parse(
        fs.readFileSync(
            messagesPath,
            "utf-8"
        )
    );

    console.log(
        `Loaded ${messageCache.length} messages.`
    );

    return messageCache;
}


/*
 * Create exactly 10 questions for a game.
 *
 * These are selected when the game starts.
 * The game then reuses these questions and
 * never touches the 150k-message pool again.
 */

function createGameQuestions(
    messages: DiscordMessage[]
): Question[] {

    const selectedMessages =
        [...messages]
            .sort(
                () =>
                    Math.random() -
                    0.5
            )
            .slice(0, 10);


    return selectedMessages.map(
        message => {

            const possibleAnswers =
                [
                    ...new Set(
                        messages
                            .filter(
                                msg =>
                                    msg.authorId !==
                                    message.authorId
                            )
                            .map(
                                msg =>
                                    msg.author
                            )
                    )
                ];


            const wrongAnswers =
                possibleAnswers
                    .sort(
                        () =>
                            Math.random() -
                            0.5
                    )
                    .slice(0, 3);


            return {

                message,

                answers:
                    [
                        message.author,
                        ...wrongAnswers
                    ].sort(
                        () =>
                            Math.random() -
                            0.5
                    )
            };
        }
    );
}


/*
 * Leaderboard
 */

function loadScores():
    Record<string, PlayerStats> {

    if (
        !fs.existsSync(
            scoresPath
        )
    ) {
        return {};
    }

    return JSON.parse(
        fs.readFileSync(
            scoresPath,
            "utf-8"
        )
    );
}


function saveScores(
    scores: Record<string, PlayerStats>
) {

    const directory =
        path.dirname(
            scoresPath
        );


    if (
        !fs.existsSync(
            directory
        )
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        );
    }


    fs.writeFileSync(
        scoresPath,
        JSON.stringify(
            scores,
            null,
            2
        )
    );
}


/*
 * Answer buttons
 */

function createAnswerButtons(
    game: Game,
    disabled = false
) {

    const currentQuestion =
        game.questions[
            game.round - 1
        ];


    const buttons =
        currentQuestion.answers.map(
            (
                answer,
                index
            ) => {

                return new ButtonBuilder()

                    .setCustomId(
                        `guesswho_${game.roundId}_${index}`
                    )

                    .setLabel(
                        answer.slice(
                            0,
                            80
                        )
                    )

                    .setStyle(
                        ButtonStyle.Secondary
                    )

                    .setDisabled(
                        disabled
                    );
            }
        );


    return new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            buttons
        );
}


/*
 * Start game
 */

export async function startGame(
    interaction: ChatInputCommandInteraction
) {

    const channel =
        interaction.channel;


    if (
        !channel ||
        !(channel instanceof TextChannel)
    ) {

        await interaction.reply({
            content:
                "❌ Guess Who can only be played in a text channel.",
            ephemeral: true
        });

        return;
    }


    if (
        games.has(
            channel.id
        )
    ) {

        await interaction.reply({
            content:
                "🎮 There's already a game running in this channel!",
            ephemeral: true
        });

        return;
    }


    /*
     * Load the big JSON.
     *
     * This happens only once because
     * getMessages() caches it.
     */

    const availableMessages =
        getMessages();


    if (
        availableMessages.length === 0
    ) {

        await interaction.reply({
            content:
                "❌ No usable messages were found.",
            ephemeral: true
        });

        return;
    }


    /*
     * Pick all 10 questions now.
     */

    const questions =
        createGameQuestions(
            availableMessages
        );


    const game: Game = {

        questions,

        votes:
            new Map(),

        round:
            1,

        totalRounds:
            10,

        scores:
            new Map(),

        streaks:
            new Map(),

        channelId:
            channel.id,

        messageId:
            "",

        roundId:
            crypto.randomUUID()
    };


    games.set(
        channel.id,
        game
    );


    const message =
        await interaction.reply({

            content:
                createQuestionText(
                    game
                ),

            components: [
                createAnswerButtons(
                    game
                )
            ],

            fetchReply:
                true
        });


    game.messageId =
        message.id;


    startTimer(
        game
    );
}


/*
 * Question text
 */

function createQuestionText(
    game: Game
) {

    const currentQuestion =
        game.questions[
            game.round - 1
        ];


    return [

        "🎭 **GUESS WHO**",

        "",

        `> ${currentQuestion.message.content}`,

        "",

        "**Who said it?**",

        "",

        `Round ${game.round}/${game.totalRounds}`,

        "⏱️ **10 seconds** to vote!"

    ].join("\n");
}


/*
 * Timer
 */

function startTimer(
    game: Game
) {

    game.timer =
        setTimeout(
            () => {

                finishRound(
                    game
                ).catch(
                    console.error
                );

            },
            10_000
        );
}


/*
 * Handle votes
 */

export async function handleVote(
    interaction: ButtonInteraction
) {

    /*
     * Acknowledge immediately.
     *
     * This prevents expired interaction
     * errors when Discord is busy.
     */

    await interaction.deferReply({
        ephemeral: true
    });


    const parts =
        interaction.customId.split(
            "_"
        );


    if (
        parts.length !== 3 ||
        parts[0] !== "guesswho"
    ) {

        await interaction.editReply(
            "❌ Invalid button."
        );

        return;
    }


    const roundId =
        parts[1];


    const index =
        Number(
            parts[2]
        );


    const game =
        games.get(
            interaction.channelId
        );


    if (!game) {

        await interaction.editReply(
            "❌ There isn't a game running here."
        );

        return;
    }


    /*
     * Prevent votes from old rounds.
     */

    if (
        roundId !==
        game.roundId
    ) {

        await interaction.editReply(
            "⏰ That round has already ended."
        );

        return;
    }


    const currentQuestion =
        game.questions[
            game.round - 1
        ];


    const answer =
        currentQuestion.answers[
            index
        ];


    if (!answer) {

        await interaction.editReply(
            "❌ Invalid answer."
        );

        return;
    }


    /*
     * Prevent double voting.
     */

    if (
        game.votes.has(
            interaction.user.id
        )
    ) {

        await interaction.editReply(
            "🗳️ You've already voted!"
        );

        return;
    }


    game.votes.set(
        interaction.user.id,
        answer
    );


    await interaction.editReply(
        `🗳️ Vote registered: **${answer}**`
    );
}


/*
 * Finish round
 */

async function finishRound(
    game: Game
) {

    if (game.timer) {

        clearTimeout(
            game.timer
        );

        game.timer =
            undefined;
    }


    const channel =
        await getChannel(
            game.channelId
        );


    if (!channel) {

        games.delete(
            game.channelId
        );

        return;
    }


    const currentQuestion =
        game.questions[
            game.round - 1
        ];


    const correctAnswer =
        currentQuestion.message.author;


    const scores =
        loadScores();


    const roundResults:
        string[] = [];


    for (
        const [
            userId,
            answer
        ]
        of game.votes
    ) {

        const correct =
            answer ===
            correctAnswer;


        if (
            !game.scores.has(
                userId
            )
        ) {

            game.scores.set(
                userId,
                0
            );
        }


        if (
            !game.streaks.has(
                userId
            )
        ) {

            game.streaks.set(
                userId,
                0
            );
        }


        if (correct) {

            game.scores.set(

                userId,

                game.scores.get(
                    userId
                )! + 1

            );


            game.streaks.set(

                userId,

                game.streaks.get(
                    userId
                )! + 1

            );


            const existing =
                scores[userId] ?? {

                    username:
                        "Unknown",

                    score:
                        0,

                    games:
                        0
                };


            existing.username =
                `User ${userId}`;


            existing.score += 1;


            scores[userId] =
                existing;


            roundResults.push(
                `✅ <@${userId}> **+1**`
            );

        } else {

            game.streaks.set(
                userId,
                0
            );


            roundResults.push(
                `❌ <@${userId}> **+0**`
            );
        }
    }


    saveScores(
        scores
    );


    const resultText =
        roundResults.length > 0
            ? roundResults.join("\n")
            : "Nobody voted 😭";


    await channel.send({

        content: [

            "━━━━━━━━━━━━━━━━━━━━",

            `## 🎯 ${correctAnswer} said it!`,

            "",

            `> ${currentQuestion.message.content}`,

            "",

            "### 🏆 Round results",

            resultText,

            "",

            `Round ${game.round}/${game.totalRounds}`

        ].join("\n")
    });


    /*
     * Game over
     */

    if (
        game.round >=
        game.totalRounds
    ) {

        await finishGame(
            game
        );

        return;
    }


    /*
     * Move to next question.
     *
     * IMPORTANT:
     * We do NOT call getMessages()
     * here anymore.
     */

    game.round += 1;

    game.votes.clear();

    game.roundId =
        crypto.randomUUID();


    setTimeout(
        () => {

            sendNextRound(
                game
            ).catch(
                console.error
            );

        },
        2_000
    );
}


/*
 * Send next round
 */

async function sendNextRound(
    game: Game
) {

    const channel =
        await getChannel(
            game.channelId
        );


    if (!channel) {

        games.delete(
            game.channelId
        );

        return;
    }


    const message =
        await channel.send({

            content:
                createQuestionText(
                    game
                ),

            components: [
                createAnswerButtons(
                    game
                )
            ]
        });


    game.messageId =
        message.id;


    startTimer(
        game
    );
}


/*
 * Finish entire game
 */

async function finishGame(
    game: Game
) {

    const channel =
        await getChannel(
            game.channelId
        );


    if (!channel) {

        games.delete(
            game.channelId
        );

        return;
    }


    const leaderboard =
        [
            ...game.scores.entries()
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    b[1] -
                    a[1]
            )
            .slice(
                0,
                5
            );


    let results =
        "Nobody scored! 💀";


    if (
        leaderboard.length > 0
    ) {

        results =
            leaderboard
                .map(
                    (
                        [
                            userId,
                            score
                        ],
                        index
                    ) =>
                        `${index + 1}. <@${userId}> — **${score}**`
                )
                .join("\n");
    }


    await channel.send({

        content: [

            "# 🏁 GAME OVER",

            "",

            `**${game.totalRounds} rounds completed.**`,

            "",

            "## 🏆 Final Scores",

            results,

            "",

            "Use `/guesswho start` to play again!"

        ].join("\n")
    });


    games.delete(
        game.channelId
    );
}


/*
 * Stop game
 */

export function stopGame(
    channelId: string
) {

    const game =
        games.get(
            channelId
        );


    if (!game) {
        return false;
    }


    if (game.timer) {

        clearTimeout(
            game.timer
        );
    }


    games.delete(
        channelId
    );


    return true;
}


/*
 * Get leaderboard
 */

export function getLeaderboard() {

    return loadScores();
}


/*
 * Get Discord channel
 */

async function getChannel(
    channelId: string
): Promise<TextChannel | null> {

    const client =
        globalThis.discordClient;


    if (!client) {
        return null;
    }


    const channel =
        await client.channels.fetch(
            channelId
        );


    if (!channel) {
        return null;
    }


    if (
        !(channel instanceof TextChannel)
    ) {

        return null;
    }


    return channel;
}