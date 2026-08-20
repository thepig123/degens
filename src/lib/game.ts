import { DiscordMessage } from "../types/messages";
function shuffle<T>(array: T[]): T[]  {
    return [...array].sort(() => Math.random() - 0.5);
}

export function createQuestion(messages: DiscordMessage[]) {
        const usableMessages = messages.filter(
        isUsableMessage
    );
       const message =
        usableMessages[
            Math.floor(
                Math.random() * usableMessages.length
            )
        ];

    const possibleAnswers = [
        ...new Set(
            messages
                .filter(
                    msg => msg.authorId !== message.authorId
                )
                .map(
                    msg => msg.author
                )
        )
    ];


    const wrongAnswers =
        shuffle(possibleAnswers)
            .slice(0, 3);


    return {
        message,
        answers: shuffle([
            message.author,
            ...wrongAnswers
        ])
    };

    function isUsableMessage(message: DiscordMessage) {
    const text = message.content
        .replace(/<a?:\w+:\d+>/g, "")
        .replace(/\p{Extended_Pictographic}/gu, "")
        .trim();

    return text.length > 3;
}
}