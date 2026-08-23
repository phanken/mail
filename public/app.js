let currentMail = null;
let messages = [];

const emailAddress =
  document.getElementById("emailAddress");

const createBtn =
  document.getElementById("createBtn");

const randomBtn =
  document.getElementById("randomBtn");

const copyBtn =
  document.getElementById("copyBtn");

const refreshBtn =
  document.getElementById("refreshBtn");

const inboxRefreshBtn =
  document.getElementById("inboxRefreshBtn");

const messageList =
  document.getElementById("messageList");

const mailStatus =
  document.getElementById("mailStatus");

const toast =
  document.getElementById("toast");

const modal =
  document.getElementById("messageModal");

const closeModal =
  document.getElementById("closeModal");

const modalSubject =
  document.getElementById("modalSubject");

const modalFrom =
  document.getElementById("modalFrom");

const modalTo =
  document.getElementById("modalTo");

const modalBody =
  document.getElementById("modalBody");


function showToast(text) {
  toast.textContent = text;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}


function setLoading(button, loading) {
  if (!button) return;

  button.disabled = loading;

  if (loading) {
    button.dataset.oldText = button.textContent;
    button.textContent = "Đang xử lý...";
  } else if (button.dataset.oldText) {
    button.textContent = button.dataset.oldText;
  }
}


async function api(url, options = {}) {

  const response = await fetch(url, {
    ...options,

    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      "Có lỗi xảy ra"
    );
  }

  return data;
}


function findValue(object, keys) {

  for (const key of keys) {
    if (
      object &&
      object[key] !== undefined &&
      object[key] !== null
    ) {
      return object[key];
    }
  }

  return "";
}


function getMailId(mail) {
  return findValue(mail, [
    "id",
    "mail_id",
    "mailId"
  ]);
}


function getMailAddress(mail) {
  return findValue(mail, [
    "email",
    "address",
    "mail",
    "email_address"
  ]);
}


function getMessageId(message) {
  return findValue(message, [
    "id",
    "message_id",
    "messageId"
  ]);
}


function getMessageSubject(message) {
  return findValue(message, [
    "subject",
    "title"
  ]) || "(Không có tiêu đề)";
}


function getMessageFrom(message) {
  return findValue(message, [
    "from",
    "sender",
    "from_email"
  ]) || "Không rõ";
}


function getMessageDate(message) {
  return findValue(message, [
    "created_at",
    "createdAt",
    "date"
  ]);
}


function normalizeArray(data) {

  if (Array.isArray(data)) {
    return data;
  }

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


async function createMail(user = "", domain = "") {

  setLoading(createBtn, true);

  try {

    const body = {};

    if (user.trim()) {
      body.user = user.trim();
    }

    if (domain.trim()) {
      body.domain = domain.trim();
    }

    const data = await api(
      "/api/mail/create",
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    );

    const mail =
      data?.data ||
      data?.email ||
      data;

    currentMail = mail;

    const address = getMailAddress(mail);

    if (!address) {
      throw new Error(
        "API không trả về địa chỉ email"
      );
    }

    emailAddress.textContent = address;

    mailStatus.textContent =
      "Email đã được tạo";

    messages = [];

    renderMessages();

    showToast("Đã tạo email thành công");

    await loadMessages();

  } catch (error) {

    console.error(error);

    showToast(error.message);

  } finally {

    setLoading(createBtn, false);
  }
}


async function loadMailList() {

  try {

    const data = await api("/api/mail");

    const mails = normalizeArray(data);

    if (!mails.length) {
      return;
    }

    let mail = mails[0];

    if (currentMail) {

      const currentId =
        getMailId(currentMail);

      mail =
        mails.find(
          item => getMailId(item) === currentId
        ) || mail;
    }

    currentMail = mail;

    const address =
      getMailAddress(mail);

    if (address) {
      emailAddress.textContent =
        address;
    }

    await loadMessages();

  } catch (error) {

    console.error(error);
  }
}


async function loadMessages() {

  if (!currentMail) {

    renderMessages();

    return;
  }

  const mailId =
    getMailId(currentMail);

  if (!mailId) {

    showToast(
      "Không tìm thấy ID email"
    );

    return;
  }

  inboxRefreshBtn.disabled = true;

  try {

    const data =
      await api(
        `/api/mail/${encodeURIComponent(mailId)}`
      );

    messages = normalizeArray(data);

    mailStatus.textContent =
      `${messages.length} thư`;

    renderMessages();

  } catch (error) {

    console.error(error);

    showToast(error.message);

  } finally {

    inboxRefreshBtn.disabled = false;
  }
}


function renderMessages() {

  if (!messages.length) {

    messageList.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📭</div>

        <h3>Chưa có thư</h3>

        <p>
          Inbox sẽ tự động cập nhật khi có email.
        </p>
      </div>
    `;

    return;
  }

  messageList.innerHTML =
    messages.map((message, index) => {

      const subject =
        escapeHtml(
          getMessageSubject(message)
        );

      const from =
        escapeHtml(
          getMessageFrom(message)
        );

      const date =
        escapeHtml(
          getMessageDate(message)
        );

      return `
        <div class="message">

          <button
            data-index="${index}"
            class="message-btn"
          >

            <div class="message-top">

              <div>

                <div class="message-subject">
                  ${subject}
                </div>

                <div class="message-from">
                  ${from}
                </div>

              </div>

              <div class="message-date">
                ${date}
              </div>

            </div>

          </button>

        </div>
      `;

    }).join("");

  document
    .querySelectorAll(".message-btn")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(button.dataset.index);

          openMessage(messages[index]);

        }
      );

    });
}


async function openMessage(message) {

  const id = getMessageId(message);

  if (!id) {

    showToast(
      "Không tìm thấy ID của thư"
    );

    return;
  }

  try {

    const data =
      await api(
        `/api/message/${encodeURIComponent(id)}`
      );

    const detail =
      data?.data ||
      data?.message ||
      data;

    const subject =
      getMessageSubject(detail);

    const from =
      getMessageFrom(detail);

    const to =
      findValue(detail, [
        "to",
        "recipient",
        "to_email"
      ]) ||
      getMailAddress(currentMail) ||
      "";

    const body =
      findValue(detail, [
        "html",
        "body_html",
        "content_html"
      ]);

    const text =
      findValue(detail, [
        "text",
        "body",
        "content"
      ]);

    modalSubject.textContent =
      subject;

    modalFrom.textContent =
      from;

    modalTo.textContent =
      to;

    if (body) {

      modalBody.innerHTML =
        sanitizeBasicHtml(body);

    } else {

      modalBody.textContent =
        text || "Thư không có nội dung.";
    }

    modal.classList.remove("hidden");

  } catch (error) {

    console.error(error);

    showToast(error.message);
  }
}


function sanitizeBasicHtml(html) {

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

      [...el.attributes].forEach(attr => {

        if (
          attr.name.toLowerCase()
            .startsWith("on")
        ) {
          el.removeAttribute(attr.name);
        }

        if (
          attr.name.toLowerCase() === "href" &&
          attr.value
            .trim()
            .toLowerCase()
            .startsWith("javascript:")
        ) {
          el.removeAttribute(attr.name);
        }

      });

    });

  return template.innerHTML;
}


function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


copyBtn.addEventListener(
  "click",
  async () => {

    const email =
      emailAddress.textContent;

    if (
      !email ||
      email === "Chưa có email"
    ) {
      showToast(
        "Chưa có email để sao chép"
      );

      return;
    }

    try {

      await navigator.clipboard.writeText(
        email
      );

      showToast("Đã sao chép email");

    } catch {

      showToast(
        "Không thể sao chép"
      );
    }
  }
);


createBtn.addEventListener(
  "click",
  () => createMail()
);


randomBtn.addEventListener(
  "click",
  () => createMail()
);


refreshBtn.addEventListener(
  "click",
  async () => {

    await loadMailList();

    showToast("Đã làm mới");
  }
);


inboxRefreshBtn.addEventListener(
  "click",
  loadMessages
);


closeModal.addEventListener(
  "click",
  () => {
    modal.classList.add("hidden");
  }
);


modal.addEventListener(
  "click",
  event => {

    if (event.target === modal) {
      modal.classList.add("hidden");
    }

  }
);


// Tự động kiểm tra inbox mỗi 10 giây.
setInterval(
  () => {

    if (currentMail) {
      loadMessages();
    }

  },
  10000
);


// Khởi động
loadMailList();
