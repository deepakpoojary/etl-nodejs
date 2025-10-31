import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import jwt from "jsonwebtoken";
import { Client } from "@elastic/elasticsearch";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8000;

// ✅ Connect to Elasticsearch
const client = new Client({
  node: process.env.ELASTICSEARCH_URL || "https://localhost:9200",
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || "elastic",
    password: process.env.ELASTICSEARCH_PASSWORD || "4_xp0IVXI8-3cAdodBeV",
  },
  tls: {
    ca: fs.readFileSync("http_ca.crt"),
    rejectUnauthorized: false,
  },
});

const INDEX = "pdf_content";

// ✅ Simple JWT middleware
function checkJwt(req, res, next) {
  const authHeader = req.header("Authorization");
  if (!authHeader) return res.status(401).json({ detail: "Missing token" });

  const token = authHeader.replace("Bearer ", "");
  jwt.verify(token, process.env.JWT_SECRET || "mysecret", (err, decoded) => {
    if (err) return res.status(403).json({ detail: "Invalid token" });
    req.user = decoded; // optional, if you want user info
    next();
  });
}

// ✅ Simple endpoint to generate a JWT token (for testing)
app.get("/token", (req, res) => {
  const token = jwt.sign(
    { user: "demo" },
    process.env.JWT_SECRET || "mysecret",
    {
      expiresIn: "5h",
    }
  );
  res.json({ token });
});

// ✅ Search endpoint (protected by JWT)
app.get("/search", checkJwt, async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) {
    return res.status(400).json({ detail: "Query too short (min length 2)" });
  }

  try {
    const query = {
      query: {
        multi_match: {
          query: q,
          fields: ["text", "ocr_text", "csv", "cells.text"],
        },
      },
    };

    const result = await client.search({ index: INDEX, body: query });

    const hits = result.hits.hits;
    if (!hits.length) {
      return res.status(404).json({ detail: "No results found" });
    }

    const results = hits.map((hit) => ({
      id: hit._id,
      type: hit._source?.type,
      text:
        hit._source?.text || hit._source?.ocr_text || hit._source?.csv || "",
      page: hit._source?.page,
      bbox: hit._source?.bbox,
      score: hit._score,
    }));

    res.json({ query: q, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: err.message });
  }
});

// ✅ Ping (no auth)
app.get("/ping", async (req, res) => {
  try {
    const info = await client.info();
    res.json({ cluster: info.cluster_name, version: info.version.number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
