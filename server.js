import express from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Stock temporaire (OK pour test)
const tokens = {};

app.post("/tirage", (req, res) => {
  const userId = req.body.userId;

  if (!userId) {
    return res.status(400).json({ error: "userId manquant" });
  }

  const gains = [
    { id: "x1", prob: 0.01 },
    { id: "x2", prob: 0.19 },
    { id: "x3", prob: 1.8 },
    { id: "x4", prob: 18 },
    { id: "x5", prob: 80 }
  ];

  const r = Math.random() * 100;
  let cumul = 0;
  let gainId = gains[gains.length - 1].id;

  for (const g of gains) {
    cumul += g.prob;
    if (r < cumul) {
      gainId = g.id;
      break;
    }
  }

  const token = crypto.randomBytes(16).toString("hex");

  tokens[token] = {
    userId,
    gain: gainId,
    used: false,
    createdAt: Date.now()
  };

  res.json({ token, gainId });
});

app.post("/consume", (req, res) => {
  const { token } = req.body;

  if (!tokens[token] || tokens[token].used) {
    return res.status(400).json({ error: "Token invalide ou déjà utilisé" });
  }

  tokens[token].used = true;

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
