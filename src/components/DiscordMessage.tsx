"use client"

type Props = {
    content: string;
};

export default function DiscordMessage({
    content
}: Props) {

    const parts = content.split(
        /(<a?:\w+:\d+>)/
    );


    return (
        <>
            {parts.map((part, index) => {

                const match = part.match(
                    /<(a?):\w+:(\d+)>/
                );


                if (!match) {
                    return (
                        <span key={index}>
                            {part}
                        </span>
                    );
                }


                const animated = match[1] === "a";
                const id = match[2];


                return (
                    <img
                        key={index}
                        src={
                            `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`
                        }
                        width={32}
                        height={32}
                        alt="emoji"
                        style={{
                            display: "inline",
                            verticalAlign: "middle"
                        }}
                    />
                );
            })}
        </>
    );
}