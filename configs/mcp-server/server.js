import express from "express";
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/tools/call", async (req, res) => {
  const { name, arguments: args } = req.body;
  switch (name) {
    case "vault_read":
      res.json({ result: "mock vault read" });
      break;
    case "llm_chat":
      res.json({ result: "mock llm response" });
      break;
    default:
      res.status(400).json({ error: `unknown tool: ${name}` });
  }
});

const PORT = process.env.MCP_PORT || 3100;
app.listen(PORT, () => console.log(`MCP server on :${PORT}`));
