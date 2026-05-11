import dns from "dns";                  // IPv4 first
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import cors from "cors";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "https://maisonoclm.art" }));
app.use(express.json());

const PORT = process.env.PORT || 10000;

// -------------------------
// Stock temporaire tirage existant
// -------------------------
const tokens = {};
const daily = {};

// -------------------------
// Définition des gains et probabilités
// -------------------------
const gains = [
  { id: "x1", prob: 0.01 },
  { id: "x2", prob: 20 },
  { id: "x3", prob: 25 },
  { id: "x4", prob: 27 },
  { id: "x5", prob: 27.99 }
];

const pages = {
  x1: "/555-a9k2",
  x2: "/555-zp81",
  x3: "/555-lk90",
  x4: "/555-qm21",
  x5: "/555-rt77"
};

// -------------------------
// Endpoint /tirage
// -------------------------
app.post("/tirage", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId manquant" });

  const now = Date.now();
  const lastTirage = daily[userId];
  if (lastTirage && now - lastTirage < 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: "Vous avez déjà tiré aujourd'hui" });
  }

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
  tokens[token] = { userId, gain: gainId, used: false, createdAt: now };

  daily[userId] = now;

  res.json({ token, page: pages[gainId], gainId });
});

// -------------------------
// Endpoint /verify-token
// -------------------------
app.post("/verify-token", (req, res) => {
  const { token, gainId } = req.body;
  if (!tokens[token]) return res.status(400).json({ valid: false });

  const t = tokens[token];
  if (t.used || t.gain !== gainId) return res.status(400).json({ valid: false });

  res.json({ valid: true });
});

// -------------------------
// Endpoint /consume
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
