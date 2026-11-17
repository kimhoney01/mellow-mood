const params = new URLSearchParams(location.search);
const nextQuery = params.toString();

function showFormNote(form, message) {
  const note = form.querySelector(".entry-note");
  note.hidden = !message;
  note.textContent = message || "";
}

const signupLink = document.querySelector("#signup-link");
if (signupLink && nextQuery) {
  signupLink.href = `signup.html?${nextQuery}`;
}

const loginLink = document.querySelector("#login-link");
if (loginLink && nextQuery) {
  loginLink.href = `login.html?${nextQuery}`;
}

const loginForm = document.querySelector("#login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(loginForm);
    const result = await loginAccount(data.get("email"), data.get("password"));
    if (!result.ok) {
      showFormNote(loginForm, result.message);
      return;
    }
    continueAfterAuth();
  });
}

const signupForm = document.querySelector("#signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(signupForm);
    if (data.get("password") !== data.get("confirm")) {
      showFormNote(signupForm, "비밀번호가 서로 달라요.");
      return;
    }
    const result = await registerAccount(data.get("email"), data.get("password"));
    if (!result.ok) {
      showFormNote(signupForm, result.message);
      return;
    }
    continueAfterAuth();
  });
}
