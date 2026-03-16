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
// Transporteur mail Gmail
// -------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// -------------------------
// SQLite setup
// -------------------------
let db;
(async () => {
  db = await open({
    filename: './otk.db',
    driver: sqlite3.Database
  });

  // Table pour stocker email + OTK + consommé
  await db.run(`
    CREATE TABLE IF NOT EXISTS otks (
      email TEXT PRIMARY KEY,
      otk TEXT,
      used INTEGER DEFAULT 0
    )
  `);
})();

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
  { id: "x2", prob: 5 },
  { id: "x3", prob: 28 },
  { id: "x4", prob: 30 },
  { id: "x5", prob: 36.99 }
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
// Endpoint générer OTK pour un email
// -------------------------
// -------------------------
// Endpoint générer OTK pour un email (version dégradée)
// -------------------------
app.post("/generate-otk", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email manquant" });

    // Génération d'une OTK aléatoire
    const otk = crypto.randomBytes(8).toString("hex");

    // Stocker ou remplacer si déjà existant
    await db.run(`
      INSERT INTO otks(email, otk, used) VALUES(?, ?, 0)
      ON CONFLICT(email) DO UPDATE SET otk=excluded.otk, used=0
    `, [email, otk]);

    // -------------------------
    // ENVOI DU MAIL SUSPENDU
    // -------------------------
    /*
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Votre One-Time Key pour la Box",
      text: `Bonjour,\n\nVoici votre OTK : ${otk}\n\nMerci !`
    });
    */

    // Au lieu de l'envoyer par mail, on renvoie l'email et l'OTK directement
    console.log(`OTK générée pour ${email} : ${otk}`); // utile pour debug / logs Render

    res.json({
      success: true,
      email, // on renvoie l'email pour info
      otk    // l'OTK générée, que tu peux envoyer toi-même au client
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------
// Endpoint debug : lister toutes les OTK
// -------------------------
app.get("/debug-otks", async (req, res) => {
  const rows = await db.all("SELECT * FROM otks");
  res.json(rows);
});

// -------------------------
// Endpoint login box
// -------------------------
app.post("/login-box", async (req, res) => {
  try {
    const { email, otk } = req.body;
    if (!email || !otk) return res.status(400).json({ error: "Email ou OTK manquant" });

    const row = await db.get("SELECT * FROM otks WHERE email=? AND otk=? AND used=0", [email, otk]);
    if (!row) return res.status(400).json({ error: "Email ou OTK invalide" });

    await db.run("UPDATE otks SET used=1 WHERE email=? AND otk=?", [email, otk]);

    res.json({ success: true, message: "Accès à la box autorisé" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------
// Vider la table OTK après fermeture de la box
app.post("/reset-otks", async (req, res) => {
  try {
    await db.run("DELETE FROM otks");
    res.json({ success: true, message: "Table OTK vidée" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
