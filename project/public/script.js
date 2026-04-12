const guestMenu = document.getElementById("guestMenu");
const userMenu = document.getElementById("userMenu");
const username = document.getElementById("username");
const logoutBtn = document.getElementById("logoutBtn");

const savedUser = localStorage.getItem("loggedInUser");

if (savedUser) {
  const user = JSON.parse(savedUser);
  if (guestMenu) guestMenu.style.display = "none";
  if (userMenu) userMenu.style.display = "flex";
  if (username) username.textContent = user.username + "님";
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    location.reload();
  });
}

async function searchSteam() {
  const input = document.getElementById("searchInput");
  const list = document.getElementById("gameList");

  const keyword = input.value.trim();

  if (!keyword) {
    alert("검색어 입력해");
    return;
  }

  try {
    const res = await fetch(`/api/steam/search?q=${encodeURIComponent(keyword)}`);
    const data = await res.json();

    if (!data.success) {
      list.innerHTML = `<p>오류: ${data.message || data.error}</p>`;
      return;
    }

    list.innerHTML = data.results.map(g => `
      <div class="game-card">
        <img src="${g.image}" alt="${g.name}">
        <h3>${g.name}</h3>
        <p class="price">₩${(g.price / 100).toLocaleString()}</p>
        ${g.discount > 0 ? `<p class="discount">🔥 -${g.discount}%</p>` : ""}
      </div>
    `).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = `<p>요청 실패</p>`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("searchBtn");
  if (btn) {
    btn.addEventListener("click", searchSteam);
  }
});