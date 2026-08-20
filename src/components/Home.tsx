"use client";

import { useEffect, useState } from "react";

import DiscordMessage from "./DiscordMessage";
import { createQuestion } from "../lib/game";
import { DiscordMessage as Message } from "../types/messages";

type Question = {
    message: Message;
    answers: string[];
};

const TOTAL_QUESTIONS = 10;

export default function Home() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [question, setQuestion] = useState<Question | null>(null);

    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);

    const [questionNumber, setQuestionNumber] = useState(1);

    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [answered, setAnswered] = useState(false);

    const [loading, setLoading] = useState(true);
    const [gameOver, setGameOver] = useState(false);

    useEffect(() => {
        fetch("/messages.json")
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                return res.json();
            })
            .then((data: Message[]) => {
                setMessages(data);
                setQuestion(createQuestion(data));
                setLoading(false);
            })
            .catch(error => {
                console.error(error);
                setLoading(false);
            });
    }, []);

    function handleAnswer(answer: string) {
        if (!question || answered) return;

        setSelectedAnswer(answer);
        setAnswered(true);

        const correct = answer === question.message.author;

        if (correct) {
            setScore(prev => prev + 1);

            setStreak(prev => {
                const next = prev + 1;

                setBestStreak(best =>
                    Math.max(best, next)
                );

                return next;
            });
        } else {
            setStreak(0);
        }
    }

    function nextQuestion() {
        if (questionNumber >= TOTAL_QUESTIONS) {
            setGameOver(true);
            return;
        }

        setQuestion(createQuestion(messages));

        setQuestionNumber(prev => prev + 1);
        setSelectedAnswer(null);
        setAnswered(false);
    }

    function restartGame() {
        setScore(0);
        setStreak(0);
        setBestStreak(0);
        setQuestionNumber(1);
        setSelectedAnswer(null);
        setAnswered(false);
        setGameOver(false);

        setQuestion(createQuestion(messages));
    }

    if (loading) {
        return (
            <main className="game">
                <div className="loading">
                    <div className="loading-spinner" />

                    <h2>
                        Loading the degeneracy...
                    </h2>

                    <p>
                        Fetching Discord lore
                    </p>
                </div>
            </main>
        );
    }

    if (!question) {
        return (
            <main className="game">
                <div className="error-card">
                    <h2>
                        💀 Something went wrong
                    </h2>

                    <p>
                        No messages available.
                    </p>
                </div>
            </main>
        );
    }

    if (gameOver) {
        const percentage = Math.round(
            (score / TOTAL_QUESTIONS) * 100
        );

        return (
            <main className="game">
                <div className="game-container">

                    <header className="header">
                        <div className="logo">
                            <span>GUESS</span>
                            <strong>WHO</strong>
                        </div>
                    </header>

                    <div className="results-card">

                        <div className="results-icon">
                            {percentage >= 80
                                ? "🏆"
                                : percentage >= 50
                                    ? "😎"
                                    : "💀"}
                        </div>

                        <h1>
                            Game Over
                        </h1>

                        <div className="results-score">
                            {score}/{TOTAL_QUESTIONS}
                        </div>

                        <p className="results-percentage">
                            {percentage}% correct
                        </p>

                        <div className="stats">

                            <div>
                                <span>
                                    Best streak
                                </span>

                                <strong>
                                    🔥 {bestStreak}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    Questions
                                </span>

                                <strong>
                                    {TOTAL_QUESTIONS}
                                </strong>
                            </div>

                        </div>

                        <button
                            className="primary-button"
                            onClick={restartGame}
                        >
                            Play Again
                        </button>

                    </div>

                </div>
            </main>
        );
    }

    const correct =
        selectedAnswer === question.message.author;

    return (
        <main className="game">

            <div className="game-container">

                <header className="header">

                    <div className="logo">
                        <span>GUESS</span>
                        <strong>WHO</strong>
                    </div>

                    <div className="header-stats">

                        <div className="stat">
                            <span>Score</span>
                            <strong>{score}</strong>
                        </div>

                        <div className="stat">
                            <span>Streak</span>
                            <strong>🔥 {streak}</strong>
                        </div>

                    </div>

                </header>


                <div className="progress-wrapper">

                    <div className="progress-text">
                        <span>
                            Quote {questionNumber}
                        </span>

                        <span>
                            {TOTAL_QUESTIONS}
                        </span>
                    </div>

                    <div className="progress-bar">

                        <div
                            className="progress-fill"
                            style={{
                                width: `${
                                    (questionNumber /
                                        TOTAL_QUESTIONS) *
                                    100
                                }%`
                            }}
                        />

                    </div>

                </div>


                <section className="quote-card">

                    <div className="quote-header">

                        <div className="discord-dot" />

                        <span>
                            Someone in the server said...
                        </span>

                    </div>

                    <div className="quote-content">

                        <span className="quote-mark">
                            “
                        </span>

                        <DiscordMessage
                            content={
                                question.message.content
                            }
                        />

                        <span className="quote-mark closing">
                            ”
                        </span>

                    </div>

                    {answered && (

                        <div
                            className={
                                correct
                                    ? "result correct"
                                    : "result incorrect"
                            }
                        >

                            <span>
                                {correct ? "✓" : "✕"}
                            </span>

                            <div>

                                <strong>
                                    {correct
                                        ? "Correct!"
                                        : "Wrong!"}
                                </strong>

                                <p>
                                    Said by{" "}
                                    <b>
                                        {question.message.author}
                                    </b>
                                </p>

                            </div>

                        </div>

                    )}

                </section>


                {!answered && (
                    <div className="question-heading">
                        Who said this?
                    </div>
                )}


                <div className="answers">

                    {question.answers.map(
                        (answer, index) => {

                            const isSelected =
                                selectedAnswer === answer;

                            const isCorrect =
                                answer ===
                                question.message.author;

                            let className =
                                "answer-button";

                            if (answered) {

                                if (isCorrect) {
                                    className +=
                                        " answer-correct";
                                } else if (isSelected) {
                                    className +=
                                        " answer-wrong";
                                } else {
                                    className +=
                                        " answer-disabled";
                                }
                            }

                            return (
                                <button
                                    key={answer}
                                    className={className}
                                    onClick={() =>
                                        handleAnswer(answer)
                                    }
                                    disabled={answered}
                                >

                                    <span className="answer-number">
                                        {index + 1}
                                    </span>

                                    <span className="answer-name">
                                        {answer}
                                    </span>

                                    {answered &&
                                        isCorrect && (
                                            <span>
                                                ✓
                                            </span>
                                        )}

                                    {answered &&
                                        isSelected &&
                                        !isCorrect && (
                                            <span>
                                                ✕
                                            </span>
                                        )}

                                </button>
                            );
                        }
                    )}

                </div>


                {answered && (
                    <button
                        className="next-button"
                        onClick={nextQuestion}
                    >
                        {questionNumber >= TOTAL_QUESTIONS
                            ? "See Results"
                            : "Next Quote →"}
                    </button>
                )}


                {!answered && (
                    <p className="keyboard-hint">
                        Press{" "}
                        <kbd>1</kbd>{" "}
                        <kbd>2</kbd>{" "}
                        <kbd>3</kbd>{" "}
                        <kbd>4</kbd>{" "}
                        to answer
                    </p>
                )}

            </div>

        </main>
    );
}