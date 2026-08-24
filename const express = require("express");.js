const express = require("express");
const { search } = require("duck-duck-scrape");

const app = express();

app.use(express.json());
app.use(express.static("."));

async function webSearch(query) {
    try {
        const results = await search(query);

        return results.results
            .slice(0, 5)
            .map(result => ({
                title: result.title,
                description: result.description,
                url: result.url
            }));

    } catch (error) {
        console.error("SEARCH ERROR:", error);
        return [];
    }
}

app.post("/ask", async (req, res) => {
    try {
        const question = req.body.question;
        const history = req.body.history || [];

        // Search the web for the question
        const searchResults = await webSearch(question);

        const webInformation = searchResults.length
            ? searchResults.map(result =>
                `Title: ${result.title}\nDescription: ${result.description}\nURL: ${result.url}`
              ).join("\n\n")
            : "No web search results were found.";

        const systemMessage = {
            role: "system",
            content: `You are EriAI, a helpful AI assistant.

Your name is EriAI.

You can use web search results provided to you.

Important rules:
- Use the web results when they are useful.
- Do not pretend you searched the web if there are no results.
- Do not invent sources or URLs.
- If the search results don't contain enough information, say so.
- Be honest and helpful.
- Keep answers clear and understandable.

WEB SEARCH RESULTS:

${webInformation}`
        };

        const messages = [
            systemMessage,
            ...history,
            {
                role: "user",
                content: question
            }
        ];

        const response = await fetch(
            "http://localhost:11434/api/chat",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "eriai",
                    messages: messages,
                    stream: false
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const data = await response.json();

        res.json({
            answer: data.message.content,
            sources: searchResults
        });

    } catch (error) {
        console.error("ERIAI ERROR:", error);

        res.status(500).json({
            answer: "EriAI error: " + error.message
        });
    }
});

app.listen(3000, () => {
    console.log("EriAI is running at http://localhost:3000");
});