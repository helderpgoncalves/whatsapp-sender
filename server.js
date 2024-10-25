const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3001;
const contacts = JSON.parse(fs.readFileSync("contacts.json", "utf8"));

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ["--no-sandbox"] },
});

let isReady = false;
let qrCodeData = null;

const formatPhoneNumber = (phoneNumber) => {
  const digits = phoneNumber.replace(/\D/g, "");
  return digits.startsWith("351") ? digits : `351${digits}`;
};

client.on("qr", async (qr) => {
  console.log("QR RECEIVED");
  qrCodeData = await qrcode.toDataURL(qr);
});

client.on("ready", () => {
  console.log("Client is ready!");
  isReady = true;
  qrCodeData = null;
});

client.on("disconnected", (reason) => {
  console.log("Client was disconnected", reason);
  isReady = false;
  qrCodeData = null;
  client.initialize();
});

client.initialize();

app.get("/status", (req, res) => {
  try {
    res.json({
      ready: isReady,
      qrCode: qrCodeData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /status route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/contacts", (req, res) => {
  res.json(contacts);
});

app.post("/send", async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: "WhatsApp client not ready" });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const results = await Promise.all(
    contacts.map(async (contact) => {
      try {
        const formattedNumber = formatPhoneNumber(contact);
        const chatId = `${formattedNumber}@c.us`;

        const chat = await client.getChatById(chatId);
        if (!chat) {
          throw new Error(`No WhatsApp account found for ${contact}`);
        }

        await client.sendMessage(chatId, message);
        return { contact, status: "success" };
      } catch (error) {
        console.error(`Error sending message to ${contact}:`, error);
        return { contact, status: "failed", error: error.message };
      }
    })
  );

  res.json({ results });
});

app.get("/end", (req, res) => {
  client.destroy();
  res.json({ message: "WhatsApp client destroyed" });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
