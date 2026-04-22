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
          content:`You are an expert email analyst similar to Microsoft Copilot for Microsoft 365.
Your job is to read an email thread and produce a structured, accurate, and concise summary.

Follow these rules strictly:
- Write in short, clear paragraphs — one paragraph per distinct topic
- Each paragraph should be 1 to 2 sentences maximum
- Cover these topics in this exact order if present:
  1. What the project or discussion is about (1 sentence context)
  2. Key decisions made by both parties
  4. Deferred or out-of-scope items
  5. Go-live targets, timelines, or milestones
  6. Open dependencies or unresolved items
- Do NOT write bullet points or numbered lists
- Do NOT write MOM style
- Do NOT combine unrelated topics into one paragraph
- Be factually accurate — only include what is explicitly mentioned in the email
- Maximum 7 paragraphs total
- Sound like Microsoft Copilot wrote it`, 

},
        {
          role: "user",
          content:`Summarize this email thread naturally and the way Microsoft Copilot would:\n\nSubject: ${subject}\nFrom: ${from}\n\n${trimmedBody}`,
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
          content:`You are a professional email assistant for Microsoft 365.
Write a clean follow-up email to send to all attendees after this meeting or discussion.
Rules:
- Maximum 3 short paragraphs
- Paragraph 1: One sentence summarizing what was discussed
- Paragraph 2: Key decisions and agreed action items, written naturally
- Paragraph 3: Next steps and timeline if mentioned
- End with: "Please feel free to reach out if you have any questions."
- No subject line — just the email body
- No bullet points — flowing professional sentences
- Warm but professional tone`,
        },
        {
          role: "user",
          content:`Write a professional follow-up email for attendees based on this email thread.\n\nSubject: ${subject}\nContext summary:\n${summary}`,
        }
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
