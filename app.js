const API = "https://tempmail.id.vn/api";

// DÁN TOKEN MỚI VÀO ĐÂY
const API_TOKEN = "12672|8W9xj63jL3PNqqlQ6moV498qFiuk8xpAbRPBCVHM7db09a0d";

let currentMail = null;
let messages = [];

const $ = id => document.getElementById(id);

const emailAddress = $("emailAddress");
const status = $("status");
const messagesBox = $("messages");
const toast = $("toast");

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,

    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      message: text
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `API lỗi ${response.status}`
    );
  }

  return data;
}

function arrayFrom(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.emails)) {
    return data.emails;
  }

  if (Array.isArray(data?.messages)) {
    return data.messages;
  }

  return [];
}

function get(obj, keys) {
  for (const key of keys) {
    if (
      obj &&
      obj[key] !== undefined &&
      obj[key] !== null
    ) {
      return obj[key];
    }
  }

  return "";
}

function mailId(mail) {
  return get(mail, [
    "id",
    "mail_id",
    "mailId"
  ]);
}

function mailAddress(mail) {
  return get(mail, [
    "email",
    "address",
    "mail",
    "email_address"
  ]);
}

function messageId(message) {
  return get(message, [
    "id",
    "message_id",
    "messageId"
  ]);
}

function subject(message) {
  return get(message, [
    "subject",
    "title"
  ]) || "(Không có tiêu đề)";
}

function sender(message) {
  return get(message, [
    "from",
    "sender",
    "from_email"
  ]) || "Không rõ người gửi";
}

function messageDate(message) {
  return get(message, [
    "created_at",
    "createdAt",
    "date"
  ]);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function createMail() {
  $("createBtn").disabled = true;

  try {
    const data = await api(
      "/email/create",
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );

    const mail =
      data?.data ||
      data?.email ||
      data;

    currentMail = mail;

    const address = mailAddress(mail);

    if (!address) {
      throw new Error(
        "API không trả về địa chỉ email"
      );
    }

    emailAddress.textContent = address;

    messages = [];

    renderMessages();

    status.textContent =
      "Email đã được tạo";

    showToast("Đã tạo email mới");

    await loadInbox();

  } catch (error) {
    console.error(error);

    showToast(error.message);

  } finally {
    $("createBtn").disabled = false;
  }
}

async function loadMails() {
  try {
    const data = await api("/email");

    const mails = arrayFrom(data);

    if (!mails.length) {
      return;
    }

    currentMail = mails[0];

    const address =
      mailAddress(currentMail);

    if (address) {
      emailAddress.textContent =
        address;
    }

    await loadInbox();

  } catch (error) {
    console.error(error);
  }
}

async function loadInbox() {
  if (!currentMail) {
    renderMessages();
    return;
  }

  const id = mailId(currentMail);

  if (!id) {
    showToast(
      "Không tìm thấy ID email"
    );
    return;
  }

  $("inboxRefreshBtn").disabled = true;

  try {
    const data = await api(
      `/email/${encodeURIComponent(id)}`
    );

    messages = arrayFrom(data);

    status.textContent =
      `${messages.length} thư`;

    renderMessages();

  } catch (error) {
    console.error(error);

    showToast(error.message);

  } finally {
    $("inboxRefreshBtn").disabled = false;
  }
}

function renderMessages() {
  if (!messages.length) {

    messagesBox.innerHTML = `
      <div class="empty">
        <div>📭</div>
        <h3>Chưa có thư</h3>
        <p>Hệ thống sẽ tự động kiểm tra thư mới.</p>
      </div>
    `;

    return;
  }

  messagesBox.innerHTML =
    messages.map((message, index) => {

      return `
        <div class="message">

          <button
            class="message-button"
            data-index="${index}"
          >

            <div class="message-line">

              <div>
                <div class="message-subject">
                  ${escapeHtml(
                    subject(message)
                  )}
                </div>

                <div class="message-from">
                  ${escapeHtml(
                    sender(message)
                  )}
                </div>
              </div>

              <div class="message-date">
                ${escapeHtml(
                  messageDate(message)
                )}
              </div>

            </div>

          </button>

        </div>
      `;

    }).join("");

  document
    .querySelectorAll(".message-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(
              button.dataset.index
            );

          openMessage(
            messages[index]
          );
        }
      );

    });
}

async function openMessage(message) {
  const id = messageId(message);

  if (!id) {
    showToast(
      "Không tìm thấy ID thư"
    );
    return;
  }

  try {
    const data = await api(
      `/message/${encodeURIComponent(id)}`
    );

    const detail =
      data?.data ||
      data?.message ||
      data;

    $("subject").textContent =
      subject(detail);

    $("from").textContent =
      sender(detail);

    $("to").textContent =
      get(detail, [
        "to",
        "recipient",
        "to_email"
      ]) ||
      mailAddress(currentMail);

    const html =
      get(detail, [
        "html",
        "body_html",
        "content_html"
      ]);

    const text =
      get(detail, [
        "text",
        "body",
        "content"
      ]);

    if (html) {
      $("content").innerHTML =
        cleanHtml(html);
    } else {
      $("content").textContent =
        text ||
        "Email không có nội dung.";
    }

    $("modal").classList.remove(
      "hidden"
    );

  } catch (error) {
    console.error(error);

    showToast(error.message);
  }
}

function cleanHtml(html) {
  const template =
    document.createElement("template");

  template.innerHTML = html;

  template.content
    .querySelectorAll(
      "script, iframe, object, embed"
    )
    .forEach(el => el.remove());

  template.content
    .querySelectorAll("*")
    .forEach(el => {

      [...el.attributes]
        .forEach(attr => {

          if (
            attr.name
              .toLowerCase()
              .startsWith("on")
          ) {
            el.removeAttribute(
              attr.name
            );
          }

          if (
            attr.name
              .toLowerCase() === "href" &&
            attr.value
              .trim()
              .toLowerCase()
              .startsWith(
                "javascript:"
              )
          ) {
            el.removeAttribute(
              attr.name
            );
          }

        });

    });

  return template.innerHTML;
}

$("createBtn")
  .addEventListener(
    "click",
    createMail
  );

$("randomBtn")
  .addEventListener(
    "click",
    createMail
  );

$("copyBtn")
  .addEventListener(
    "click",
    async () => {

      const email =
        emailAddress.textContent;

      if (
        !email ||
        email === "Chưa có email"
      ) {
        showToast(
          "Chưa có email"
        );
        return;
      }

      try {
        await navigator.clipboard
          .writeText(email);

        showToast(
          "Đã sao chép email"
        );

      } catch {
        showToast(
          "Không thể sao chép"
        );
      }
    }
  );

$("refreshBtn")
  .addEventListener(
    "click",
    async () => {

      await loadMails();

      showToast(
        "Đã làm mới"
      );
    }
  );

$("inboxRefreshBtn")
  .addEventListener(
    "click",
    loadInbox
  );

$("closeModal")
  .addEventListener(
    "click",
    () => {
      $("modal")
        .classList.add("hidden");
    }
  );

$("modal")
  .addEventListener(
    "click",
    event => {

      if (
        event.target ===
        $("modal")
      ) {
        $("modal")
          .classList.add("hidden");
      }

    }
  );

setInterval(
  () => {

    if (currentMail) {
      loadInbox();
    }

  },
  10000
);

// Khởi động
loadMails();
