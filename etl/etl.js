import fs from "fs";
import { readFile } from "fs/promises";
import { Client } from "@elastic/elasticsearch";

// --- 1️⃣ Connect to Elasticsearch ---
const client = new Client({
  node: "https://localhost:9200",
  auth: {
    username: "elastic",
    password: "4_xp0IVXI8-3cAdodBeV",
  },
  tls: {
    ca: fs.readFileSync("http_ca.crt"),
    rejectUnauthorized: false, // allow self-signed certs for localhost
  },
});

const INDEX = "pdf_content"; // name of the index

// --- schema for indexing
const mapping = {
  mappings: {
    properties: {
      type: { type: "keyword" },
      page: { type: "integer" },
      bbox: { type: "integer" },
      text: { type: "text" },
      uri: { type: "keyword" },
      ocr_text: { type: "text" },
      cells: {
        type: "nested",
        properties: {
          text: { type: "text" },
          bbox: { type: "integer" },
        },
      },
      csv: { type: "text" },
    },
  },
};

// --- 3️⃣ Create index if it doesn't exist ---
try {
  await client.indices.create({ index: INDEX, body: mapping });
  console.log(`Index '${INDEX}' created successfully.`);
} catch (err) {
  if (err.meta?.body?.error?.type === "resource_already_exists_exception") {
    console.log(`Index '${INDEX}' already exists.`);
  } else {
    console.error("Error creating index:", err);
    process.exit(1);
  }
}

const data = JSON.parse(await readFile("sample_parsed.json", "utf8"));

for (let i = 0; i < data.length; i++) {
  const item = data[i];
  await client.index({
    index: INDEX,
    id: i + 1,
    document: item,
  });
}

console.log("✅ Done indexing.");
