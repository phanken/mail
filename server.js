import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const TEMPMAIL_TOKEN = process.env.TEMPMAIL_TOKEN;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = "https://tempmail.id.vn/api";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function apiRequest(endpoint, options = {}) {
  if (!TEMPMAIL_TOKEN) {
    throw new Error("TEMPMAIL_TOKEN chưa được cấu hình");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${TEMPMAIL_TOKEN}`,
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || `API error: ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

/*
 * GET /api/user
 * Kiểm tra token / thông tin tài khoản
 */
app.get("/api/user", async (req, res) => {
  try {
    const data = await apiRequest("/user");
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message
    });
  }
});

/*
 * POST /api/mail/create
 *
 * Body:
 * {
 *   "user": "abc",
 *   "domain": "tempmail.id.vn"
 * }
 *
 * Nếu bỏ trống cả 2 -> API tạo mail random.
 */
app.post("/api/mail/create", async (req, res) => {
  try {
    const { user, domain } = req.body || {};

    const body = {};

    if (user && String(user).trim()) {
      body.user = String(user).trim();
    }

    if (domain && String(domain).trim()) {
      body.domain = String(domain).trim();
    }

    const data = await apiRequest("/email/create", {
      method: "POST",
      body: JSON.stringify(body)
    });

    res.json(data);
  } catch (error) {
    console.error(error);

    res.status(error.status || 500).json({
      error: error.message
    });
  }
});

/*
 * GET /api/mail
 *
 * Lấy danh sách email của tài khoản API.
 */
app.get("/api/mail", async (req, res) => {
  try {
    const data = await apiRequest("/email");
    res.json(data);
  } catch (error) {
    console.error(error);

    res.status(error.status || 500).json({
      error: error.message
    });
  }
});

/*
 * GET /api/mail/:mailId
 *
 * Lấy danh sách message của một mailbox.
 */
app.get("/api/mail/:mailId", async (req, res) => {
  try {
    const mailId = encodeURIComponent(req.params.mailId);

    const data = await apiRequest(`/email/${mailId}`);

    res.json(data);
  } catch (error) {
    console.error(error);

    res.status(error.status || 500).json({
      error: error.message
    });
  }
});

/*
 * GET /api/message/:messageId
 *
 * Đọc nội dung message.
 */
app.get("/api/message/:messageId", async (req, res) => {
  try {
    const messageId = encodeURIComponent(req.params.messageId);

    const data = await apiRequest(`/message/${messageId}`);

    res.json(data);
  } catch (error) {
    console.error(error);

    res.status(error.status || 500).json({
      error: error.message
    });
  }
});

/*
 * SPA fallback
 */
app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Temp Mail running on port ${PORT}`);
});
