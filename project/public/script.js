console.log("script.js 로드됨");

const guestMenu = document.getElementById("guestMenu");
const userMenu = document.getElementById("userMenu");
const username = document.getElementById("username");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const genreSelect = document.getElementById("genreSelect");
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

function formatPrice(price) {
  if (price === null || price === undefined) return "가격 정보 없음";
  if (Number(price) === 0) return "무료";
  if (Number(price) < 0) return "가격 정보 없음";

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

  gameList.innerHTML = "<p>검색 중...</p>";

  try {
    const [steamRes, directgRes] = await Promise.all([
      fetch(`/api/steam/search?q=${encodeURIComponent(keyword)}&genre=${encodeURIComponent(genre)}`),
      fetch(`/api/directg/search?q=${encodeURIComponent(keyword)}`)
    ]);

    const steamData = await steamRes.json();
    const directgData = await directgRes.json();

    const steamResults = steamData.success ? steamData.results || [] : [];
    const directgResults = directgData.success ? directgData.results || [] : [];

    if (steamResults.length === 0 && directgResults.length === 0) {
      gameList.innerHTML = "<p>검색 결과 없음</p>";
      return;
    }

    const allGames = steamResults.map(steamGame => {
      const matchedDirectg = directgResults.find(dg =>
        dg.name &&
        steamGame.name &&
        dg.name.toLowerCase().includes(steamGame.name.toLowerCase().slice(0, 8))
      );

      return {
        steam: steamGame,
        directg: matchedDirectg || null
      };
    });

    directgResults.forEach(dg => {
      const alreadyMatched = allGames.some(item => item.directg && item.directg.name === dg.name);

      if (!alreadyMatched) {
        allGames.push({
          steam: null,
          directg: dg
        });
      }
    });

    gameList.innerHTML = allGames.map(item => {
      const steam = item.steam;
      const directg = item.directg;

      const mainName = steam?.name || directg?.name || "이름 없음";
      const mainImage = steam?.image || directg?.image || "";
      const appid = steam?.appid || 0;

      const safeName = escapeText(mainName);
      const safeImage = escapeText(mainImage);

      const steamSalePrice = steam?.salePrice ?? steam?.price ?? null;
      const steamOriginalPrice = steam?.originalPrice ?? steamSalePrice;
      const steamDiscount = steam?.discount || 0;

      const directgSalePrice = directg?.salePrice ?? null;
      const directgOriginalPrice = directg?.originalPrice ?? directgSalePrice;
      const directgDiscount = directg?.discount || 0;

      const discountStores = [];

      if (steamDiscount > 0) discountStores.push(`Steam ${steamDiscount}% 할인`);
      if (directgDiscount > 0) discountStores.push(`DirectG ${directgDiscount}% 할인`);

      return `
        <div class="game-card">
          ${
            steam
              ? `
                <a
                  href="https://store.steampowered.com/app/${appid}"
                  target="_blank"
                  class="game-link"
                >
                  <img src="${mainImage}" alt="${mainName}">
                  <h3>${mainName}</h3>
                </a>
              `
              : `
                <a
                  href="${directg?.url || "#"}"
                  target="_blank"
                  class="game-link"
                >
                  <img src="${mainImage}" alt="${mainName}">
                  <h3>${mainName}</h3>
                </a>
              `
          }

          ${
            steam
              ? `
                <button
                  class="wishlist-btn"
                  type="button"
                  onclick="addWishlist(${appid}, '${safeName}', '${safeImage}', ${steamSalePrice})">
                  ❤️ 찜하기
                </button>
              `
              : ""
          }

          <div class="price-box">
            <h4>Steam</h4>
            ${
              steam
                ? `
                  ${
                    steamDiscount > 0
                      ? `<p class="discount">🔥 Steam ${steamDiscount}% 할인 중</p>`
                      : `<p class="discount no-sale">Steam 할인 없음</p>`
                  }
                  <p>원가: ${
                    steamDiscount > 0
                      ? `<del>${formatSteamPrice(steamOriginalPrice)}</del>`
                      : formatSteamPrice(steamOriginalPrice)
                  }</p>
                  <p class="sale-price">
                    현재 가격: ${formatSteamPrice(steamSalePrice)}
                  </p>
                `
                : `<p>Steam 검색 결과 없음</p>`
            }
          </div>

          <div class="price-box">
            <h4>DirectG</h4>
            ${
              directg
                ? `
                  ${
                    directgDiscount > 0
                      ? `<p class="discount">🔥 DirectG ${directgDiscount}% 할인 중</p>`
                      : `<p class="discount no-sale">DirectG 할인 없음</p>`
                  }
                  <p>원가: ${
                    directgDiscount > 0
                      ? `<del>${formatPrice(directgOriginalPrice)}</del>`
                      : formatPrice(directgOriginalPrice)
                  }</p>
                  <p class="sale-price">
                    현재 가격: ${formatPrice(directgSalePrice)}
                  </p>
                `
                : `<p>DirectG 검색 결과 없음</p>`
            }
          </div>

          ${
            discountStores.length > 0
              ? `<p class="discount-store">할인 중인 곳: ${discountStores.join(", ")}</p>`
              : `<p class="discount no-sale">현재 할인 중인 스토어 없음</p>`
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

if (searchBtn) {
  searchBtn.addEventListener("click", searchSteam);
}

if (searchInput) {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchSteam();
  });
}