const accountBar = document.querySelector("#account-bar");
const homeList = document.querySelector("#home-list");
const homeNote = document.querySelector("#home-note");
const user = currentUser();

function accountLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  return link;
}

if (!user) {
  accountBar.append(
    accountLink("login.html", "로그인"),
    accountLink("signup.html", "회원가입")
  );
  homeNote.textContent = "로그인하면 저장한 플레이리스트를 볼 수 있어요.";
} else {
  const email = document.createElement("span");
  email.className = "account-email";
  email.textContent = user;
  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "로그아웃";
  logout.addEventListener("click", () => {
    clearSession();
    location.reload();
  });
  accountBar.append(email, logout);

  const playlists = listPlaylists(user);
  homeNote.textContent = playlists.length
    ? `${playlists.length} / 5`
    : "저장된 플레이리스트가 없어요.";

  playlists.forEach((playlist) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "home-card";
    link.href = `playlist.html?id=${encodeURIComponent(playlist.id)}`;
    const title = document.createElement("span");
    title.className = "home-card-title";
    title.textContent = playlist.title || "플레이리스트 제목";
    const meta = document.createElement("span");
    const tagCount = (playlist.tags || []).length;
    const trackCount = (playlist.tracks || []).length;
    meta.textContent = `태그 ${tagCount} · 음악 ${trackCount}`;
    link.append(title, meta);
    item.append(link);
    homeList.append(item);
  });
}
