import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import cors from "cors";
import crypto from "crypto";
import nodemailer from "nodemailer";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "https://maisonoclm.art" }));
app.use(express.json());

const PORT = process.env.PORT || 10000;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

let db;

(async () => {
  db = await open({
    filename: "./otk.db",
    driver: sqlite3.Database
  });

  await db.run(`
    CREATE TABLE IF NOT EXISTS otks (
      email TEXT PRIMARY KEY,
      otk TEXT,
      used INTEGER DEFAULT 0
    )
  `);
})();

const tokens = {};
const daily = {};

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

app.post("/tirage", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "missing userId" });

  const now = Date.now();

  if (daily[userId] && now - daily[userId] < 86400000) {
    return res.status(400).json({ error: "already used today" });
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

  tokens[token] = {
    userId,
    gain: gainId,
    used: false,
    createdAt: now
  };

  daily[userId] = now;

  res.json({ token, page: pages[gainId], gainId });
});

app.post("/login-box", async (req, res) => {
  try {
    const { email, otk } = req.body;

    if (!email || !otk) {
      return res.status(400).json({ success: false });
    }

    const row = await db.get(
      "SELECT * FROM otks WHERE email=? AND otk=?",
      [email, otk]
    );

    if (!row) {
      return res.status(401).json({ success: false });
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/send-email", async (req, res) => {
  try {
    const { clientEmail } = req.body;

    if (!clientEmail || clientEmail.length > 200) {
      return res.status(400).json({ success: false });
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "VIP Access Submission",
      text: `Email captured: ${clientEmail}`
    });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
