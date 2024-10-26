const express = require("express");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const sanitizeHtml = require("sanitize-html");

const app = express();
const PORT = process.env.PORT || 3001;
let contacts = fs
  .readFileSync("contacts.txt", "utf8")
  .split("\n")
  .filter(Boolean);

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
    timeout: 60000, // Increase timeout to 60 seconds
  },
});

let isReady = false;
let qrCodeData = null;

const INITIALIZATION_TIMEOUT = 60000; // 60 seconds

client.initialize().catch((err) => {
  console.error("Failed to initialize client:", err);
  // You might want to implement a retry mechanism here
});

const formatPhoneNumber = (phoneNumber) => {
  const digits = phoneNumber.replace(/\D/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
};

const getContacts = async () => {
  return fs.readFileSync("contacts.txt", "utf8").split("\n").filter(Boolean);
};

const getFormattedContacts = async () => {
  const contacts = await getContacts();

  return contacts.map((phoneNumber) => {
    const digits = phoneNumber.replace(/\D/g, "");
    return digits.startsWith("351") ? digits : `351${digits}`;
  });
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

client.on("auth_failure", (err) => {
  console.error("Authentication failed:", err);
  // Implement appropriate error handling, such as retrying or notifying the user
});

client.on("disconnected", (reason) => {
  console.log("Client was disconnected", reason);
  isReady = false;
  qrCodeData = null;
  // Implement a delay before reinitializing
  setTimeout(() => {
    client.initialize().catch((err) => {
      console.error("Failed to reinitialize client:", err);
    });
  }, 5000); // Wait for 5 seconds before reinitializing
});

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
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
});

const upload = multer({ storage: storage });

app.post("/send", upload.single("image"), async (req, res) => {
  if (!isReady) {
    return res.status(500).json({ error: "WhatsApp client is not ready" });
  }

  const { message } = req.body;
  const image = req.file;
  const contacts = await getFormattedContacts();

  const results = [];

  for (const contact of contacts) {
    try {
      const chatId = await client.getNumberId(contact);
      if (!chatId) {
        results.push({ contact, status: "failed", error: "Invalid number" });
        continue;
      }

      if (message) {
        await client.sendMessage(chatId._serialized, message);
      }

      if (image) {
        const media = MessageMedia.fromFilePath(image.path);
        await client.sendMessage(chatId._serialized, media, { caption: message });
      }

      results.push({ contact, status: "success" });
    } catch (error) {
      console.error(`Error sending message to ${contact}:`, error);
      results.push({ contact, status: "failed", error: error.message });
    }
  }

  // Clean up the uploaded file
  if (image) {
    fs.unlinkSync(image.path);
  }

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
    .filter((contact) => /^\d+$/.test(contact)) // Only allow numbers
    .map(formatPhoneNumber);

  contacts.push(...formattedContacts);
  // Remove duplicates
  contacts = [...new Set(contacts)];

  // Update the contacts.txt file
  fs.writeFileSync("contacts.txt", contacts.join("\n"));

  res.json({
    message: "Contacts updated successfully",
    count: contacts.length,
  });
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

    res.json({
      message: "Contact deleted successfully",
      count: contacts.length,
    });
  } else {
    res.status(404).json({ error: "Contact not found" });
  }
});

// Add a new route to handle contacts file upload
app.post("/upload-contacts", upload.single("contactsFile"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const fileContent = fs.readFileSync(req.file.path, "utf8");
    const newContacts = fileContent.split("\n").filter(Boolean);

    const formattedContacts = newContacts
      .filter((contact) => /^\d+$/.test(contact.trim())) // Only allow numbers
      .map((contact) => formatPhoneNumber(contact.trim()));

    // Merge new contacts with existing ones and remove duplicates
    contacts = [...new Set([...contacts, ...formattedContacts])];

    // Update the contacts.txt file
    fs.writeFileSync("contacts.txt", contacts.join("\n"));

    // Delete the uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: "Contacts uploaded and merged successfully",
      count: contacts.length,
    });
  } catch (error) {
    console.error("Error processing contacts file:", error);
    res.status(500).json({ error: "Failed to process contacts file" });
  }
});
