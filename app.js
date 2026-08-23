```javascript
const API = "https://tempmail.id.vn/api";

// ⚠️ TẠO TOKEN MỚI TRÊN TEMPMAIL.ID.VN
const API_TOKEN = "12673|NZISXaC0einZP6fWnJh5IJvPPOAQ2FfIkhUXkISV2c718576";

const POLL_INTERVAL = 3000;
const REQUEST_TIMEOUT = 15000;

let currentMail = null;
let messages = [];
let polling = false;
let initialized = false;

const $ = id => document.getElementById(id);

const emailAddress = $("emailAddress");
const status = $("status");
const messagesBox = $("messages");
const toast = $("toast");

function showToast(text) {
    if (!toast) return;

    toast.textContent = text;
    toast.classList.add("show");

    clearTimeout(window.toastTimer);

    window.toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

async function api(path, options = {}) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT);

    try {
        const response = await fetch(API + path, {
            ...options,
            signal: controller.signal,
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
            data = text ? JSON.parse(text) : {};
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

    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error("API phản hồi quá lâu");
        }

        throw error;

    } finally {
        clearTimeout(timeout);
    }
}

function arrayFrom(data) {
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
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function messageKey(message) {
    const id = messageId(message);

    if (id) {
        return String(id);
    }

    return [
        sender(message),
        subject(message),
        messageDate(message)
    ].join("|");
}

function saveCurrentMail() {
    try {
        if (!currentMail) return;

        localStorage.setItem(
            "tempmail_current_mail",
            JSON.stringify(currentMail)
        );

    } catch (error) {
        console.warn("Không thể lưu email:", error);
    }
}

function restoreCurrentMail() {
    try {
        const raw = localStorage.getItem(
            "tempmail_current_mail"
        );

        if (!raw) {
            return false;
        }

        const mail = JSON.parse(raw);

        if (!mail || !mailId(mail)) {
            return false;
        }

        currentMail = mail;

        const address = mailAddress(mail);

        if (address) {
            emailAddress.textContent = address;
        }

        return true;

    } catch (error) {
        console.warn(
            "Không thể khôi phục email:",
            error
        );

        return false;
    }
}

async function createMail() {
    const button = $("createBtn");

    if (button) {
        button.disabled = true;
    }

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

        const address = mailAddress(mail);
        const id = mailId(mail);

        if (!address) {
            throw new Error(
                "API không trả về địa chỉ email"
            );
        }

        if (!id) {
            throw new Error(
                "API không trả về ID email"
            );
        }

        currentMail = mail;

        messages = [];

        saveCurrentMail();

        emailAddress.textContent = address;

        status.textContent = "Email đã được tạo";

        renderMessages();

        showToast("Đã tạo email mới");

        await loadInbox(true);

    } catch (error) {
        console.error(
            "createMail:",
            error
        );

        showToast(error.message);

    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}

async function loadMails() {
    try {
        const data = await api("/email");

        const mails = arrayFrom(data);

        if (!mails.length) {
            return false;
        }

        currentMail = mails[0];

        const address = mailAddress(
            currentMail
        );

        if (address) {
            emailAddress.textContent = address;
        }

        saveCurrentMail();

        await loadInbox(true);

        return true;

    } catch (error) {
        console.error(
            "loadMails:",
            error
        );

        return false;
    }
}

async function loadInbox(force = false) {
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

    // Không cho phép nhiều request inbox chạy cùng lúc
    if (polling && !force) {
        return;
    }

    polling = true;

    try {
        const data = await api(
            `/email/${encodeURIComponent(id)}`
        );

        const newMessages = arrayFrom(data);

        const oldKeys = new Set(
            messages.map(messageKey)
        );

        const newKeys = new Set(
            newMessages.map(messageKey)
        );

        const hasNewMessage =
            newMessages.some(
                message =>
                    !oldKeys.has(
                        messageKey(message)
                    )
            );

        const hasChanged =
            newMessages.length !==
                messages.length ||
            newMessages.some(
                message =>
                    !oldKeys.has(
                        messageKey(message)
                    )
            ) ||
            messages.some(
                message =>
                    !newKeys.has(
                        messageKey(message)
                    )
            );

        // Chỉ cập nhật giao diện khi dữ liệu thực sự thay đổi
        if (hasChanged || force) {
            messages = newMessages;

            status.textContent =
                `${messages.length} thư`;

            renderMessages();
        }

        if (
            hasNewMessage &&
            initialized
        ) {
            showToast(
                "📨 Có thư mới!"
            );
        }

        initialized = true;

    } catch (error) {
        console.error(
            "loadInbox:",
            error
        );

        // Không xóa inbox hiện tại khi API lỗi.
        // Chỉ báo lỗi ở console để tránh làm giao diện nhấp nháy.

    } finally {
        polling = false;
    }
}

function renderMessages() {
    if (!messagesBox) return;

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
        messages.map(
            (message, index) => `
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
            `
        ).join("");

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

                    if (
                        messages[index]
                    ) {
                        openMessage(
                            messages[index]
                        );
                    }
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

        $("modal")
            .classList
            .remove("hidden");

    } catch (error) {
        console.error(
            "openMessage:",
            error
        );

        showToast(
            error.message
        );
    }
}

function cleanHtml(html) {
    const template =
        document.createElement(
            "template"
        );

    template.innerHTML = html;

    template.content
        .querySelectorAll(
            "script, iframe, object, embed"
        )
        .forEach(
            element =>
                element.remove()
        );

    template.content
        .querySelectorAll("*")
        .forEach(element => {
            [...element.attributes]
                .forEach(attribute => {
                    const name =
                        attribute.name
                            .toLowerCase();

                    if (
                        name.startsWith("on")
                    ) {
                        element.removeAttribute(
                            attribute.name
                        );
                    }

                    if (
                        name === "href" &&
                        attribute.value
                            .trim()
                            .toLowerCase()
                            .startsWith(
                                "javascript:"
                            )
                    ) {
                        element.removeAttribute(
                            attribute.name
                        );
                    }
                });
        });

    return template.innerHTML;
}

// ============================
// EVENTS
// ============================

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
        async () => {
            await loadInbox(true);

            showToast(
                "Đã kiểm tra thư"
            );
        }
    );

$("closeModal")
    .addEventListener(
        "click",
        () => {
            $("modal")
                .classList
                .add("hidden");
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
                    .classList
                    .add("hidden");
            }
        }
    );

// ============================
// AUTO POLLING
// ============================

setInterval(
    async () => {
        if (!currentMail) {
            return;
        }

        await loadInbox(false);

    },
    POLL_INTERVAL
);

// ============================
// KHỞI ĐỘNG
// ============================

(async function init() {
    const restored =
        restoreCurrentMail();

    if (restored) {
        status.textContent =
            "Đang kiểm tra thư...";

        await loadInbox(true);

        initialized = true;

        return;
    }

    await loadMails();

    initialized = true;
})();
```
