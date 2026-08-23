const API_TOKEN = "12672|8W9xj63jL3PNqqlQ6moV498qFiuk8xpAbRPBCVHM7db09a0d";
const API = "https://tempmail.id.vn/api";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || `API error ${response.status}`
    );
  }

  return data;
}

async function createMail() {
  return request("/email/create", {
    method: "POST",
    body: JSON.stringify({})
  });
}

async function getMails() {
  return request("/email");
}

async function getInbox(mailId) {
  return request(`/email/${mailId}`);
}

async function getMessage(messageId) {
  return request(`/message/${messageId}`);
}
