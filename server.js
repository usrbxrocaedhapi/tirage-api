import express from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// -------------------------
// Stock temporaire
// -------------------------
// tokens[token] = { userId, gain, used, createdAt }
// daily[userId] = timestamp du dernier tirage
const tokens = {};
const daily = {};

// -------------------------
// Définition des gains et probabilités
// -------------------------
const gains = [
  { id: "x1", prob: 0.01 },
  { id: "x2", prob: 0.19 },
  { id: "x3", prob: 1.8 },
  { id: "x4", prob: 18 },
  { id: "x5", prob: 80 }
];

// Mapping gain → page
const pages = {
  x1: "/x1-a9k2",
  x2: "/x2-zp81",
  x3: "/x3-lk90",
  x4: "/x4-qm21",
  x5: "/x5-rt77"
};

// -------------------------
// Endpoint /tirage : générer tirage
// -------------------------
app.post("/tirage", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });

  // Limite 1 tirage/jour
  const now = Date.now();
  const lastTirage = daily[userId];
  if (lastTirage && now - lastTirage < 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: "Vous avez déjà tiré aujourd'hui" });
  }

  // Calcul du gain
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

  // Génération du token
  const token = crypto.randomBytes(16).toString("hex");
  tokens[token] = { userId, gain: gainId, used: false, createdAt: now };

  // Mettre à jour le dernier tirage du joueur
  daily[userId] = now;

  res.json({ token, page: pages[gainId], gainId });
});

// -------------------------
// Endpoint /verify-token : vérifier token côté page
// -------------------------
app.post("/verify-token", (req, res) => {
  const { token, gainId } = req.body;
  if (!tokens[token]) return res.status(400).json({ valid: false });

  const t = tokens[token];
  if (t.used || t.gain !== gainId) return res.status(400).json({ valid: false });

  res.json({ valid: true });
});

// -------------------------
// Endpoint /consume : consommer token
// -------------------------
app.post("/consume", (req, res) => {
  const { token } = req.body;
  if (!tokens[token] || tokens[token].used)
    return res.status(400).json({ error: "Token invalide ou déjà utilisé" });

  tokens[token].used = true;
  res.json({ success: true });
});

// -------------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
