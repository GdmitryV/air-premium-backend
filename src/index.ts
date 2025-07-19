import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import multer from "multer";

const app = express();
const PORT = 5000;
const DATA_FILE = path.join(__dirname, "products.json");
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const SETTINGS_FILE = path.join(__dirname, "settings.json");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

const readProducts = (): any[] => {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const writeProducts = (products: any[]) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
};

// Upload setup
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.get("/api/products", (req, res) => {
  res.json(readProducts());
});

app.post("/api/products", (req, res) => {
  const products = readProducts();
  const { name, price, description, image } = req.body;
  const newProduct = { id: Date.now(), name, price, description, image };
  products.push(newProduct);
  writeProducts(products);
  res.status(201).json(newProduct);
});

app.put("/api/products/:id", (req, res) => {
  const id = +req.params.id;
  const products = readProducts();
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return res.status(404).send("Not found");
  products[index] = { ...products[index], ...req.body };
  writeProducts(products);
  res.json(products[index]);
});

app.delete("/api/products/:id", (req, res) => {
  const id = +req.params.id;
  let products = readProducts();
  const initialLength = products.length;
  products = products.filter((p) => p.id !== id);
  if (products.length === initialLength)
    return res.status(404).send("Not found");
  writeProducts(products);
  res.status(204).end();
});

app.post("/api/upload", upload.single("image"), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send("No file");
  const url = `http://localhost:${PORT}/uploads/${file.filename}`;
  res.status(201).json({ url });
});

app.get("/api/telegram/store", (req, res) => {
  res.json(readProducts());
});

// Settings //
const readSettings = (): any => {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
  } catch {
    return { receiver: "" };
  }
};
const writeSettings = (settings: any) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
};

app.get("/api/settings", (req, res) => {
  res.json(readSettings());
});

app.post("/api/settings", (req, res) => {
  writeSettings(req.body);
  res.status(200).send("OK");
});

// Заказ //
app.post("/api/order", async (req, res) => {
  const { product, name, phone } = req.body;

  const settingsPath = path.join(__dirname, "settings.json");
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  const { botToken, chatId } = settings;

  if (!botToken || !chatId) {
    return res.status(400).send("Telegram Bot settings not configured");
  }

  const message = `🛒 Новый заказ:
📦 Товар: ${product.name}
💰 Цена: ${product.price}₽
🙍‍♂️ Имя: ${name}
📞 Телефон: ${phone}`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    res.status(200).send("Order sent to Telegram");
  } catch (err) {
    console.error("Failed to send Telegram message", err);
    res.status(500).send("Failed to send order");
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
