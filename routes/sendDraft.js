const express = require("express");
const router = express.Router();
const { ClientSecretCredential } = require("@azure/identity");
const { Client } = require("@microsoft/microsoft-graph-client");
const { TokenCredentialAuthenticationProvider } = require(
  "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials"
);

router.post("/", async (req, res) => {
  const { draft, attendees, subject } = req.body;

  if (!draft || !attendees || !Array.isArray(attendees) || attendees.length === 0) {
    return res.status(400).json({ error: "draft and attendees array are required" });
  }

  try {
    // Use app credentials (client credentials flow)
    const credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID,
      process.env.AZURE_CLIENT_ID,
      process.env.AZURE_CLIENT_SECRET
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ["https://graph.microsoft.com/.default"],
    });

    const graphClient = Client.initWithMiddleware({ authProvider });

    const toRecipients = attendees.map((email) => ({
      emailAddress: { address: email },
    }));

    // Send on behalf of Sneha's account
    await graphClient.api("/users/Sneha.N@skysecure.ai/sendMail").post({
      message: {
        subject: subject || "Meeting Summary",
        body: {
          contentType: "Text",
          content: draft,
        },
        toRecipients,
      },
      saveToSentItems: true,
    });

    res.json({
      status: "sent",
      recipientCount: attendees.length,
      sentAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Graph API error:", error);
    res.status(500).json({
      error: "Failed to send draft",
      detail: error.message,
    });
  }
});

module.exports = router;