const express = require("express");

const app = express();

app.use(express.json());
app.use(express.static("."));


async function searchWeb(question) {
    try {
        const url =
            "https://en.wikipedia.org/w/api.php" +
            "?action=query" +
            "&generator=search" +
            "&gsrsearch=" + encodeURIComponent(question) +
            "&gsrlimit=5" +
            "&prop=extracts" +
            "&exintro=true" +
            "&explaintext=true" +
            "&format=json" +
            "&origin=*";

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Search returned ${response.status}`
            );
        }

        const data = await response.json();

        if (!data.query || !data.query.pages) {
            return [];
        }

        return Object.values(data.query.pages);

    } catch (error) {
        console.error("SEARCH ERROR:", error);
        return [];
    }
}


app.post("/ask", async (req, res) => {

    try {

        const question = req.body.question;
        const history = req.body.history || [];

        console.log("Question:", question);


        // SEARCH THE INTERNET
        const searchResults = await searchWeb(question);

        console.log(
            "Search results:",
            searchResults.length
        );


        const internetInfo = searchResults
            .map((result, index) => {

                return `
SOURCE ${index + 1}

Title:
${result.title}

Information:
${result.extract || "No information available."}
`;

            })
            .join("\n");


        const systemMessage = `
You are EriAI, a helpful AI assistant.

Your name is EriAI.

IMPORTANT WEB SEARCH RULES:

1. Internet information is provided below.

2. When answering the user's question, use the
   internet information as your PRIMARY source.

3. Do NOT rely on your old knowledge when the
   internet information provides a different answer.

4. NEVER invent facts.

5. If the internet information does not contain
   enough information to answer the question,
   clearly say:

   "I couldn't find enough information to answer
   that accurately."

6. If the user asks for current, latest, recent,
   or today's information and the provided sources
   don't contain current information, say that you
   don't have enough current information.

7. Do not claim that you searched the internet
   unless search results were actually provided.

8. Answer naturally and clearly.

INTERNET INFORMATION:

${internetInfo || "NO INTERNET RESULTS WERE FOUND."}
`;


        const messages = [

            {
                role: "system",
                content: systemMessage
            },

            ...history,

            {
                role: "user",
                content: question
            }

        ];


        console.log(
            "Sending information to EriAI..."
        );


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

            const errorText =
                await response.text();

            throw new Error(
                `Ollama returned ${response.status}: ${errorText}`
            );

        }


        const data =
            await response.json();


        const answer =
            data.message?.content ||
            "EriAI couldn't generate an answer.";


        console.log(
            "EriAI answer generated."
        );


        res.json({

            answer: answer,

            sources: searchResults.map(
                result => ({
                    title: result.title
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


app.listen(3000, () => {

    console.log(
        "EriAI is running at http://localhost:3000"
    );

});