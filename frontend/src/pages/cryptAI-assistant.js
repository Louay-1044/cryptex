import React, { useState } from "react";
import Navbar from "../Components/Navbar";
import "../styles/CryptAI.css";
import ReactMarkdown from "react-markdown";
import {wait} from "@testing-library/user-event/dist/utils";

const HINTS = [
    "How has bitcoin been performing over the last couple of weeks?",
    "Analyse my trading algorithm and tell me its weaknesses",
    "What has the demand for Ethirium been over the past year?",
];

const CryptAIAssistant = () => {
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [hintsActive, setHintsActive] = useState(true);
    const [responses, setResponses] = useState([]);

    const sendQuery = async () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        let successful = false;

        setHintsActive(false);
        setIsLoading(true);

        try {
            const res = await fetch("http://localhost:8000/api/cryptAI/query/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Token ${localStorage.getItem("token")}`,
                },
                body: JSON.stringify({ type: "market", prompt: trimmed }),
            });

            if (!res.ok) {
                console.error("Request failed", res.status);
                return;
            }

            const data = await res.json();
            const answer = data.response || JSON.stringify(data); // adjust key if needed

            setResponses(prev => [...prev, { role: "user", content: trimmed }]);
            setResponses(prev => [...prev, { role: "assistant", content: answer }]);
            successful = true;
            console.log(answer);
        } catch (err) {
            console.error("sendQuery error:", err);
            wait(8);
            sendQuery();
        } finally {
            if (successful) {
                setIsLoading(false);
                setQuery("");
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendQuery();
        }
    };

    //
    //const hasResponses = responses.length > 0;

    return (
        <div className="navWrapper">
            <Navbar dark={true} />
            <div className="cryptai-page">
                <h1 className="cryptai-title fade-up">CryptAI Assistant</h1>

                <div
                    className={
                        "cryptai-main " + ((responses.length > 0) ? "has-responses" : "no-responses")
                    }
                >

                    {hintsActive && !isLoading && !(responses.length > 0) && (
                        <div className="cryptai-hints">
                            <span className="hint-text hint-1">{HINTS[0]}</span>
                            <span className="hint-text hint-2">{HINTS[1]}</span>
                            <span className="hint-text hint-3">{HINTS[2]}</span>
                        </div>
                    )}


                    <div className="cryptai-responses">
                        {responses.map((m, i) => (
                            <div
                                key={i}
                                className={
                                    "cryptai-response-card " +
                                    (m.role === "user" ? "message-user" : "message-assistant")
                                }
                            >
                                {m.role === "assistant" ? (
                                    <ReactMarkdown
                                        components={{
                                            li({ node, children, ...props }) {
                                                // first child might be the <strong> heading, rest is the text
                                                const [maybeStrong, ...rest] = children;

                                                return (
                                                    <li {...props}>
                                                        {typeof maybeStrong === "object" && maybeStrong.type === "strong" ? (
                                                            <>
                                                                <div className="li-heading">{maybeStrong}</div>
                                                                {rest.length > 0 && (
                                                                    <div className="li-body">
                                                                        {rest}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            children
                                                        )}
                                                    </li>
                                                );
                                            },
                                        }}
                                    >{m.content}</ReactMarkdown>
                                ) : (
                                    <p>{m.content}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {isLoading && (
                        <div className="cryptai-typing">
                            <span className="dot dot-1" />
                            <span className="dot dot-2" />
                            <span className="dot dot-3" />
                        </div>
                    )}

                    <div
                        className={
                            "cryptai-search-wrap fade-up-delay " +
                            ((responses.length > 0) ? "search-top" : "search-center")
                        }
                    >
                        <input
                            className="cryptai-search"
                            type="text"
                            placeholder="Ask CryptAI"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CryptAIAssistant;