require("dotenv").config();

const express = require("express");

const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(express.json());
app.use(express.static("."));

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


/* =========================
   WEB SEARCH
========================= */

async function searchWeb(question) {

    try {

        const url =
            "https://en.wikipedia.org/w/api.php" +
            "?action=query" +
            "&generator=search" +
            "&gsrsearch=" +
            encodeURIComponent(question) +
            "&gsrlimit=5" +
            "&prop=extracts" +
            "&exintro=true" +
            "&explaintext=true" +
            "&format=json" +
            "&origin=*";

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                `Search returned ${response.status}`
            );
        }

        const data =
            await response.json();

        if (
            !data.query ||
            !data.query.pages
        ) {

            return [];
        }

        return Object.values(
            data.query.pages
        );

    } catch (error) {

        console.error(
            "SEARCH ERROR:",
            error
        );

        return [];
    }
}


/* =========================
   ASK ERIAI
========================= */

app.post("/ask", async (req, res) => {

    try {

        const question =
            req.body.question;

        const history =
            req.body.history || [];


        if (!question) {

            return res.status(400).json({
                answer:
                    "Please enter a question."
            });
        }


        console.log(
            "Question:",
            question
        );


        /* =========================
           SEARCH
        ========================= */

        const searchResults =
            await searchWeb(question);


        console.log(
            "Search results:",
            searchResults.length
        );


        const internetInfo =
            searchResults
                .map(result => {

                    return `
Title: ${result.title}

Information:
${result.extract || ""}
`;

                })
                .join("\n");


        /* =========================
           CONVERSATION
        ========================= */

        const conversation =
            history
                .map(message => {

                    return `${message.role}: ${message.content}`;

                })
                .join("\n\n");


        /* =========================
           ERIAI PROMPT
        ========================= */

        const prompt = `You are EriAI, a powerful and helpful AI assistant.

Your name is EriAI.

You are designed to give useful, accurate, detailed answers.

IMPORTANT BEHAVIOR:

- Answer the user's actual question directly.
- Do not give vague tutorials when the user asks you to create something.
- If the user asks for code, actually provide the code.
- If the user asks you to build a website, create the website code.
- When a task is complex, break it into clear sections.
- Give detailed answers when the question requires detail.
- Do not artificially make answers short.
- Avoid unnecessary repetition.
- Be friendly and natural.
- If you do not know something, say so.
- Never pretend that you searched the internet if you did not.
- Use the provided internet information when it is relevant.
- Treat the conversation history as context.
- Follow the user's instructions carefully.

You are also a strong programming assistant.

When writing code:
- Make it complete and usable.
- Explain important parts when useful.
- Do not replace requested code with a high-level description.
- If multiple files are required, clearly label each file.
- Prefer clean, modern, maintainable code.

CONVERSATION HISTORY:

${conversation || "No previous conversation."}


INTERNET INFORMATION:

${internetInfo || "No relevant internet information was found."}


USER'S CURRENT QUESTION:

${question}
`;


        console.log(
            "Sending request to Gemini..."
        );


        /* =========================
           GEMINI
        ========================= */

        const response =
            await ai.models.generateContent({

                model:
                    "gemini-2.5-flash",

                contents:
                    prompt,

                config: {

                    temperature: 0.7,

                    maxOutputTokens:
                        8192

                }

            });


        const answer =
            response.text ||
            "EriAI couldn't generate an answer.";


        console.log(
            "Gemini response received."
        );


        res.json({

            answer:

                answer,

            sources:

                searchResults.map(
                    result => ({
                        title:
                            result.title
                    })
                )

        });


    } catch (error) {

        console.error(
            "ERIAI ERROR:",
            error
        );


        res.status(500).json({

            answer:
                "EriAI error: " +
                error.message

        });

    }

});


/* =========================
   START SERVER
========================= */

app.listen(
    3000,
    () => {

        console.log(
            "EriAI is running at http://localhost:3000"
        );

    }
);