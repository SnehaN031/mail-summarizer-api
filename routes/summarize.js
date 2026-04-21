const express = require("express");
const router = express.Router();
const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");

const openaiClient = new OpenAIClient(
  process.env.AZURE_OPENAI_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_OPENAI_KEY)
);

router.post("/", async (req, res) => {
  const { emailBody, subject, from } = req.body;

  if (!emailBody || !subject) {
    return res.status(400).json({ error: "emailBody and subject are required" });
  }

  // Trim email body to avoid token limit
  const trimmedBody = emailBody.length > 8000
    ? emailBody.substring(0, 8000) + "... [truncated]"
    : emailBody;

  try {
    const summaryResponse = await openaiClient.getChatCompletions(
      process.env.AZURE_OPENAI_DEPLOYMENT,
      [
        {
          role: "system",
          content: `You are a professional email assistant.
Summarize emails concisely in 3-5 bullet points.
Focus on: key decisions, action items, deadlines, and important people mentioned.
Keep each bullet point to one clear sentence.`,
        },
        {
          role: "user",
          content: `Please summarize this email:\n\nSubject: ${subject}\nFrom: ${from}\n\n${trimmedBody}`,
        },
      ],
      { maxTokens: 500, temperature: 0.3 }
    );

    const summary = summaryResponse.choices[0].message.content;

    const draftResponse = await openaiClient.getChatCompletions(
      process.env.AZURE_OPENAI_DEPLOYMENT,
      [
        {
          role: "system",
          content: `You are a professional email assistant.
Write a clear, concise meeting summary email to send to attendees.
Use this structure:
- Short intro line
- Key points discussed (bullet points)
- Action items with owners if mentioned
- Next steps or follow-up date if mentioned
Keep the tone professional but friendly.
Do not add a subject line — just the email body.`,
        },
        {
          role: "user",
          content: `Write a summary email for attendees based on this:\n\nSubject: ${subject}\nSummary:\n${summary}\n\nOriginal email:\n${trimmedBody}`,
        },
      ],
      { maxTokens: 800, temperature: 0.4 }
    );

    const draft = draftResponse.choices[0].message.content;

    res.json({
      summary,
      draft,
      tenantId: req.tenantId,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({
      error: "Failed to generate summary",
      detail: error.message,
    });
  }
});

module.exports = router;