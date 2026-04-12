console.log("script.js 로드됨");

const guestMenu = document.getElementById("guestMenu");
const userMenu = document.getElementById("userMenu");
const username = document.getElementById("username");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const gameList = document.getElementById("gameList");

const savedUser = localStorage.getItem("loggedInUser");

if (savedUser) {
  const user = JSON.parse(savedUser);
  if (guestMenu) guestMenu.style.display = "none";
  if (userMenu) userMenu.style.display = "flex";
  if (username) username.textContent = `${user.username}님`;
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    location.reload();
  });
}

async function searchSteam() {
  console.log("검색 버튼 눌림");

  const keyword = searchInput ? searchInput.value.trim() : "";
  console.log("검색어:", keyword);

  if (!keyword) {
    alert("검색어 입력해");
    return;
  }

  gameList.innerHTML = "<p>검색 중...</p>";

  try {
    const res = await fetch(`/api/steam/search?q=${encodeURIComponent(keyword)}`);
    const data = await res.json();

    console.log("검색 결과:", data);

    if (!data.success) {
      gameList.innerHTML = `<p>오류: ${data.message || data.error}</p>`;
      return;
    }

    if (!data.results || data.results.length === 0) {
      gameList.innerHTML = "<p>검색 결과 없음</p>";
      return;
    }

    gameList.innerHTML = data.results.map(g => `
      <div class="game-card">
        <img src="${g.image}" alt="${g.name}">
        <h3>${g.name}</h3>
        <p class="price">₩${((g.price || 0) / 100).toLocaleString()}</p>
        ${g.discount > 0 ? `<p class="discount">🔥 -${g.discount}%</p>` : ""}
      </div>
    `).join("");
  } catch (err) {
    console.error("검색 실패:", err);
    gameList.innerHTML = "<p>요청 실패</p>";
  }
}

if (searchBtn) {
  searchBtn.addEventListener("click", searchSteam);
}

if (searchInput) {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      searchSteam();
    }
  });
}