console.log("script.js 로드됨");

const guestMenu = document.getElementById("guestMenu");
const userMenu = document.getElementById("userMenu");
const username = document.getElementById("username");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const genreSelect = document.getElementById("genreSelect");
const searchBtn = document.getElementById("searchBtn");
const gameList = document.getElementById("gameList");
const top100List = document.getElementById("top100List");
const searchResultSection = document.getElementById("searchResultSection");

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

function formatPrice(price) {
  if (price === null || price === undefined) return "가격 정보 없음";
  if (Number(price) === 0) return "무료";
  return `₩${Number(price).toLocaleString()}`;
}

function formatSteamPrice(price) {
  if (price === null || price === undefined) return "가격 정보 없음";
  if (Number(price) === 0) return "무료";
  return `₩${(Number(price) / 100).toLocaleString()}`;
}

function escapeText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;");
}

async function searchSteam() {
  const keyword = searchInput ? searchInput.value.trim() : "";
  const genre = genreSelect ? genreSelect.value : "";

  if (!keyword && !genre) {
    alert("검색어 또는 장르를 선택해");
    return;
  }

  if (searchResultSection) {
    searchResultSection.style.display = "block";
  }

  gameList.innerHTML = "<p>검색 중...</p>";

  try {
    const res = await fetch(
      `/api/steam/search?q=${encodeURIComponent(keyword)}&genre=${encodeURIComponent(genre)}`
    );

    const data = await res.json();

    if (!data.success) {
      gameList.innerHTML = `<p>오류: ${data.message || data.error}</p>`;
      return;
    }

    if (!data.results || data.results.length === 0) {
      gameList.innerHTML = "<p>검색 결과 없음</p>";
      return;
    }

    gameList.innerHTML = data.results.map(g => {
      const salePrice = g.salePrice ?? g.price ?? null;
      const originalPrice = g.originalPrice ?? salePrice;
      const discount = g.discount || 0;
      const safeName = escapeText(g.name);
      const safeImage = escapeText(g.image || "");

      return `
        <div class="game-card">
          <a
            href="https://store.steampowered.com/app/${g.appid}"
            target="_blank"
            class="game-link"
          >
            <img src="${g.image}" alt="${g.name}">
            <h3>${g.name}</h3>
          </a>

          <button
            class="wishlist-btn"
            type="button"
            onclick="addWishlist(${g.appid}, '${safeName}', '${safeImage}', ${salePrice})">
            ❤️ 찜하기
          </button>

          ${
            discount > 0
              ? `
                <p class="discount">🔥 ${discount}% 할인</p>
                <p class="original-price">
                  원가: <del>${formatSteamPrice(originalPrice)}</del>
                </p>
                <p class="sale-price">
                  현재 가격: ${formatSteamPrice(salePrice)}
                </p>
              `
              : `
                <p class="discount no-sale">할인 없음</p>
                <p class="sale-price">
                  가격: ${formatSteamPrice(salePrice)}
                </p>
              `
          }
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("검색 실패:", err);
    gameList.innerHTML = "<p>요청 실패</p>";
  }
}

async function addWishlist(appid, gameName, gameImage, currentPrice) {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));

  if (!user) {
    alert("로그인 후 찜하기를 사용할 수 있어.");
    return;
  }

  const userId = user.user_id || user.id;

  if (!userId) {
    alert("로그인 정보에 user_id가 없어.");
    return;
  }

  try {
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: userId,
        appid,
        game_name: gameName,
        image: gameImage,
        current_price: currentPrice
      })
    });

    const data = await res.json();

    if (data.success) {
      alert("❤️ 찜 목록에 추가됨");
    } else {
      alert(data.message || data.error || "찜하기 실패");
    }

  } catch (err) {
    console.error("찜하기 실패:", err);
    alert("찜하기 요청 실패");
  }
}

async function loadTop100() {
  if (!top100List) return;

  top100List.innerHTML = "<p>인기순위 불러오는 중...</p>";

  try {
    const res = await fetch("/api/steam/top100");
    const data = await res.json();

    if (!data.success || !data.results || data.results.length === 0) {
      top100List.innerHTML = "<p>인기순위를 불러오지 못했습니다.</p>";
      return;
    }

    top100List.innerHTML = data.results.map(g => `
      <div class="game-card">
        <a
          href="https://store.steampowered.com/app/${g.appid}"
          target="_blank"
          class="game-link"
        >
          <img src="${g.image}" alt="${g.name}">
          <h3>${g.rank}. ${g.name}</h3>
        </a>

        ${
          g.discount > 0
            ? `
              <p class="discount">🔥 ${g.discount}% 할인</p>
              <p class="original-price">
                원가: <del>${formatPrice(g.originalPrice)}</del>
              </p>
              <p class="sale-price">
                현재 가격: ${formatPrice(g.salePrice)}
              </p>
            `
            : `
              <p class="discount no-sale">할인 없음</p>
              <p class="sale-price">
                가격: ${formatPrice(g.salePrice)}
              </p>
            `
        }
      </div>
    `).join("");

  } catch (err) {
    console.error("TOP100 불러오기 실패:", err);
    top100List.innerHTML = "<p>요청 실패</p>";
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

loadTop100();