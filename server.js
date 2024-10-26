const express = require("express");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sanitizeHtml = require('sanitize-html');

const app = express();
const PORT = process.env.PORT || 3001;
let contacts = fs.readFileSync("contacts.txt", "utf8").split("\n").filter(Boolean);

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
  return digits.startsWith("+") ? digits : `+${digits}`;
};

const formattedNumberForMessage = (phoneNumber) => {
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

// Set up multer for handling file uploads
const upload = multer({ dest: "uploads/" });

app.post("/send", upload.single("image"), async (req, res) => {
  if (!isReady) {
    return res.status(503).json({ error: "WhatsApp client not ready" });
  }

  const { message } = req.body;
  const imageFile = req.file;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Sanitize the HTML content
  const sanitizedMessage = sanitizeHtml(message, {
    allowedTags: ['b', 'i', 'u', 'strong', 'em', 'p', 'br'],
    allowedAttributes: {}
  });

  let media;
  if (imageFile) {
    const imageBuffer = fs.readFileSync(imageFile.path);
    media = new MessageMedia(imageFile.mimetype, imageBuffer.toString("base64"));
    fs.unlinkSync(imageFile.path); // Clean up the uploaded file
  }

  const results = await Promise.all(
    contacts.map(async (contact) => {
      try {
        const formattedNumber = formattedNumberForMessage(contact);
        const chatId = `${formattedNumber}@c.us`;

        const chat = await client.getChatById(chatId);
        if (!chat) {
          throw new Error(`No WhatsApp account found for ${contact}`);
        }

        if (media) {
          await client.sendMessage(chatId, media, { caption: sanitizedMessage });
        } else {
          await client.sendMessage(chatId, sanitizedMessage);
        }
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

// Add a new route to update contacts
app.post("/update-contacts", (req, res) => {
  const { contacts: newContacts } = req.body;
  if (!Array.isArray(newContacts)) {
    return res.status(400).json({ error: "Contacts must be an array" });
  }

  const formattedContacts = newContacts
    .filter(contact => /^\d+$/.test(contact)) // Only allow numbers
    .map(formatPhoneNumber);

  contacts.push(...formattedContacts);
  // Remove duplicates
  contacts = [...new Set(contacts)];

  // Update the contacts.txt file
  fs.writeFileSync("contacts.txt", contacts.join("\n"));
  
  res.json({ message: "Contacts updated successfully", count: contacts.length });
});

// Add a new route to delete a contact
app.delete("/delete-contact", (req, res) => {
  let { contact } = req.body;
  if (!contact) {
    return res.status(400).json({ error: "Contact is required" });
  }
  
  contact = formatPhoneNumber(contact);
  const index = contacts.indexOf(contact);
  if (index > -1) {
    contacts.splice(index, 1);
    
    // Update the contacts.txt file
    fs.writeFileSync("contacts.txt", contacts.join("\n"));
    
    res.json({ message: "Contact deleted successfully", count: contacts.length });
  } else {
    res.status(404).json({ error: "Contact not found" });
  }
});
