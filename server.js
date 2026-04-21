require("dotenv").config();
const express = require("express");
const cors = require("cors");

const summarizeRoute = require("./routes/summarize");
const sendDraftRoute = require("./routes/sendDraft");
const { validateToken } = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Health check — lets Azure know the app is running
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Protected routes — token is validated before reaching the route
app.use("/api/summarize", summarizeRoute);
app.use("/api/send-draft", sendDraftRoute);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});