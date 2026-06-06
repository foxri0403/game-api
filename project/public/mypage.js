const user = JSON.parse(localStorage.getItem("loggedInUser"));

const myUsername = document.getElementById("myUsername");
const myEmail = document.getElementById("myEmail");
const myUserId = document.getElementById("myUserId");
const wishlist = document.getElementById("wishlist");

if (!user) {
  alert("로그인이 필요합니다.");
  location.href = "/login";
}

const userId = user.user_id || user.id;

myUsername.textContent = user.username || "정보 없음";
myEmail.textContent = user.email || "정보 없음";
myUserId.textContent = userId || "정보 없음";

function formatPrice(price) {
  if (price === 0) return "무료";
  if (!price || price < 0) return "가격 정보 없음";
  return `₩${(price / 100).toLocaleString()}`;
}

async function loadWishlist() {
  try {
    const res = await fetch(`/api/wishlist/${userId}`);
    const data = await res.json();

    if (!data.success) {
      wishlist.innerHTML = `<p>찜 목록을 불러오지 못했습니다.</p>`;
      return;
    }

    if (!data.results || data.results.length === 0) {
      wishlist.innerHTML = `<p>찜한 게임이 없습니다.</p>`;
      return;
    }

    wishlist.innerHTML = data.results.map(game => `
      <div class="game-card">
        ${
          game.image
            ? `<img src="${game.image}" alt="${game.game_name}">`
            : `<div class="no-image">이미지 없음</div>`
        }

        <h3>${game.game_name}</h3>

        <p class="sale-price">
          현재 가격: ${formatPrice(game.current_price || 0)}
        </p>

        <button onclick="deleteWishlist(${game.appid})">
          삭제
        </button>
      </div>
    `).join("");

  } catch (err) {
    console.error(err);
    wishlist.innerHTML = `<p>요청 실패</p>`;
  }
}

async function deleteWishlist(appid) {
  try {
    const res = await fetch("/api/wishlist", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: userId,
        appid
      })
    });

    const data = await res.json();

    if (data.success) {
      alert("찜 목록에서 삭제되었습니다.");
      loadWishlist();
    } else {
      alert(data.message || "삭제 실패");
    }

  } catch (err) {
    alert("삭제 요청 실패");
  }
}

loadWishlist();