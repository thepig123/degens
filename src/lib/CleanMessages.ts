import fs from "fs";

const messages = JSON.parse(
    fs.readFileSync("public/messages.json", "utf-8")
);

function isUsableMessage(message: any) {

    let text = message.content;

    // Remove Discord custom emojis
    text = text.replace(
        /<a?:\w+:\d+>/g,
        ""
    );

    // Remove normal Unicode emojis
    text = text.replace(
        /\p{Extended_Pictographic}/gu,
        ""
    );

    text = text.trim();

    // Reject empty / extremely short messages
    if (text.length < 4) {
        return false;
    }

    // Remove Tenor URLs
    text = text.replace(
        /https?:\/\/(?:www\.)?tenor\.com\/\S+/gi,
        ""
    ).trim();

    // Reject messages that were ONLY a Tenor URL
    if (text.length === 0) {
        return false;
    }

    return true;
}

const cleaned = messages.filter(
    isUsableMessage
);

fs.writeFileSync(
    "public/quiz-messages.json",
    JSON.stringify(cleaned, null, 2)
);

console.log(
    `Filtered ${messages.length} → ${cleaned.length} messages`
);