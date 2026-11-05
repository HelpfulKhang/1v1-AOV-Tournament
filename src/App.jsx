import React, { useEffect, useMemo, useRef, useState } from "react";

const POOL_SIZE = 5;
const SPIN_DURATION = 5000;
const SPIN_INTERVAL = 90;

function PlayerPanel({
  player,
  playerName,
  setPlayerName,
  selectedHeroes,
  onToggleHero,
  heroes,
}) {
  const [search, setSearch] = useState("");
  const filteredHeroes = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return heroes.filter((hero) =>
      hero.name.toLocaleLowerCase("vi").includes(keyword),
    );
  }, [heroes, search]);

  const isSelected = (heroId) =>
    selectedHeroes.some((hero) => hero.id === heroId);

  return (
    <section className={`player-panel team-${player.toLowerCase()}`}>
      <div className="player-heading">
        <span className="player-label">PLAYER {player}</span>
        <span className="pool-count">
          {selectedHeroes.length}/{POOL_SIZE}
        </span>
      </div>
      <input
        className="player-name-input"
        value={playerName}
        onChange={(event) => setPlayerName(event.target.value)}
        placeholder={`Nhập tên tuyển thủ ${player}`}
        maxLength={30}
      />

      <div className="selected-pool">
        {Array.from({ length: POOL_SIZE }).map((_, index) => {
          const hero = selectedHeroes[index];
          return (
            <div className="pool-slot" key={index}>
              {hero ? (
                <>
                  <img src={hero.icon} alt={hero.name} />
                  <span title={hero.name}>{hero.name}</span>
                  <button
                    type="button"
                    className="remove-hero"
                    onClick={() => onToggleHero(hero)}
                    title="Bỏ chọn"
                    aria-label={`Bỏ chọn ${hero.name}`}
                  >
                    ×
                  </button>
                </>
              ) : (
                <span className="empty-slot">{index + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      <input
        className="hero-search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Tìm tướng..."
      />

      <div className="hero-grid">
        {filteredHeroes.map((hero) => {
          const selected = isSelected(hero.id);
          const disabled = !selected && selectedHeroes.length >= POOL_SIZE;
          return (
            <button
              type="button"
              key={hero.id}
              className={`hero-option ${selected ? "selected" : ""}`}
              onClick={() => onToggleHero(hero)}
              disabled={disabled}
              title={hero.name}
            >
              <img src={hero.icon} alt={hero.name} />
              <span>{hero.name}</span>
              {selected && <span className="selected-mark">✓</span>}
            </button>
          );
        })}
      </div>
      {filteredHeroes.length === 0 && (
        <p className="empty-message">Không tìm thấy tướng phù hợp.</p>
      )}
    </section>
  );
}

function RandomPool({ player, playerName, pool, usedIds }) {
  const remaining = pool.length - usedIds.length;
  return (
    <div className={`random-pool team-${player.toLowerCase()}`}>
      <div className="random-pool-title">
        <span>POOL CỦA {playerName ? playerName.toUpperCase() : `PLAYER ${player}`}</span>
        <small>{remaining}/{POOL_SIZE} KHẢ DỤNG</small>
      </div>
      <div className="random-pool-grid compact-5-slots">
        {Array.from({ length: POOL_SIZE }).map((_, idx) => {
          const hero = pool[idx];
          if (!hero) {
            return (
              <div className="random-pool-card empty" key={`empty-${idx}`}>
                <div className="empty-avatar">{idx + 1}</div>
                <span>TRỐNG</span>
              </div>
            );
          }
          const used = usedIds.includes(hero.id);
          return (
            <div
              className={`random-pool-card ${used ? "used" : ""}`}
              key={`${player}-${hero.id}`}
            >
              <div className="pool-card-avatar">
                <img src={hero.icon} alt={hero.name} />
                {used && <small className="badge-used">ĐÃ ĐẤU</small>}
              </div>
              <span title={hero.name}>{hero.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [heroes, setHeroes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Poster luôn hiện khi mở/reload web; controller có thể ẩn/hiện trong phiên hiện tại.
  const [posterVisible, setPosterVisible] = useState(false);

  // Màn hình thi đấu thực tế: nhận hình điện thoại qua OBS Virtual Camera.
  const [showGameplay, setShowGameplay] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [phoneStream, setPhoneStream] = useState(null);
  const [phoneCameraError, setPhoneCameraError] = useState("");
  const phoneVideoRef = useRef(null);

  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [poolA, setPoolA] = useState([]);
  const [poolB, setPoolB] = useState([]);

  const [matchCreated, setMatchCreated] = useState(false);
  const [matchStarted, setMatchStarted] = useState(false);
  const [matchComplete, setMatchComplete] = useState(false);

  // Coin toss states (có spinning 5s)
  const [coinWinner, setCoinWinner] = useState(null);
  const [coinSpinning, setCoinSpinning] = useState(false);
  const [coinDisplaySide, setCoinDisplaySide] = useState("A");

  const [usedA, setUsedA] = useState([]);
  const [usedB, setUsedB] = useState([]);
  const [gameRound, setGameRound] = useState(1);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  const [spinning, setSpinning] = useState(false);
  const [pendingHero, setPendingHero] = useState(null);
  const [confirmedHero, setConfirmedHero] = useState(null);
  const [roundLocked, setRoundLocked] = useState(false);
  const [roundWinner, setRoundWinner] = useState(null);
  const [previousRoundLoser, setPreviousRoundLoser] = useState(null);

  const spinIntervalRef = useRef(null);
  const spinTimeoutRef = useRef(null);
  const coinIntervalRef = useRef(null);
  const coinTimeoutRef = useRef(null);
  const soundWindowRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch("/assets/heroes/heroes.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Không thể tải danh sách tướng.");
        }
        return response.json();
      })
      .then((data) => {
        if (active) {
          if (!Array.isArray(data)) {
            throw new Error("Dữ liệu heroes.json không đúng định dạng.");
          }
          setHeroes(data);
        }
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || "Xảy ra lỗi khi tải tướng.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncPosterState = (event) => {
      if (event.key === "aov-poster-state") {
        setPosterVisible(event.newValue !== "visible");
      }
    };

    window.addEventListener("storage", syncPosterState);
    return () => window.removeEventListener("storage", syncPosterState);
  }, []);

  // Gắn luồng OBS vào video sau khi màn hình thi đấu được render.
  useEffect(() => {
    const video = phoneVideoRef.current;
    if (!video || !phoneStream) return;

    video.srcObject = phoneStream;
    video.play().catch(() => {
      setPhoneCameraError("Không phát được hình. Hãy kiểm tra OBS Virtual Camera.");
    });
  }, [phoneStream, showGameplay]);

  // Thử mở Sound Controller khi vào web. Chrome cần cho phép popup từ localhost.
  useEffect(() => {
    if (soundWindowRef.current && !soundWindowRef.current.closed) return;

    const controllerWindow = window.open(
      "/controller.html",
      "AOVSoundController",
      "popup=yes,width=460,height=760,resizable=yes,scrollbars=yes",
    );

    if (controllerWindow) soundWindowRef.current = controllerWindow;
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(spinIntervalRef.current);
      clearTimeout(spinTimeoutRef.current);
      clearInterval(coinIntervalRef.current);
      clearTimeout(coinTimeoutRef.current);
      phoneStream?.getTracks().forEach((track) => track.stop());
    };
  }, [phoneStream]);

  function toggleHero(pool, setPool, hero) {
    const exists = pool.some((item) => item.id === hero.id);
    if (exists) {
      setPool((current) => current.filter((item) => item.id !== hero.id));
      return;
    }
    if (pool.length < POOL_SIZE) {
      setPool((current) => [...current, hero]);
    }
  }

  function createMatch() {
    if (!playerA.trim() || !playerB.trim()) {
      window.alert("Vui lòng nhập tên cả hai tuyển thủ.");
      return;
    }
    if (poolA.length !== POOL_SIZE || poolB.length !== POOL_SIZE) {
      window.alert("Mỗi tuyển thủ phải chọn đủ 5 vị tướng.");
      return;
    }
    setMatchCreated(true);
  }

  function startMatch() {
    setMatchStarted(true);
  }

  // Tung đồng xu hiệu ứng 5 giây
  function tossCoin() {
    if (coinWinner || coinSpinning || spinning || pendingHero) return;

    setCoinSpinning(true);
    let currentSide = "A";

    coinIntervalRef.current = window.setInterval(() => {
      currentSide = currentSide === "A" ? "B" : "A";
      setCoinDisplaySide(currentSide);
    }, 100);

    coinTimeoutRef.current = window.setTimeout(() => {
      clearInterval(coinIntervalRef.current);
      coinIntervalRef.current = null;
      const finalWinner = Math.random() < 0.5 ? "A" : "B";
      setCoinDisplaySide(finalWinner);
      setCoinWinner(finalWinner);
      setCoinSpinning(false);
      coinTimeoutRef.current = null;
    }, SPIN_DURATION);
  }

  function getRoundPool() {
    if (gameRound === 1) {
      if (!coinWinner) return [];
      return (coinWinner === "A" ? poolA : poolB).map((hero) => ({
        ...hero,
        owner: coinWinner,
      }));
    }

    if (gameRound >= 2 && gameRound <= 6) {
      if (!previousRoundLoser) return [];
      const pool = previousRoundLoser === "A" ? poolA : poolB;
      return pool.map((hero) => ({ ...hero, owner: previousRoundLoser }));
    }

    // Ván 7: gộp toàn bộ tướng còn lại của cả hai bên.
    return [
      ...poolA.map((hero) => ({ ...hero, owner: "A" })),
      ...poolB.map((hero) => ({ ...hero, owner: "B" })),
    ];
  }

  function isHeroUsed(hero) {
    return hero.owner === "A"
      ? usedA.includes(hero.id)
      : usedB.includes(hero.id);
  }

  function startRandom() {
    if (spinning || pendingHero || roundLocked || matchComplete || coinSpinning) return;
    if (gameRound === 1 && !coinWinner) {
      window.alert("Vui lòng tung đồng xu trước.");
      return;
    }
    if (gameRound >= 2 && gameRound <= 6 && !previousRoundLoser) {
      window.alert("Chưa xác định người thua ván trước.");
      return;
    }
    const candidates = getRoundPool().filter((hero) => !isHeroUsed(hero));
    if (candidates.length === 0) {
      window.alert("Không còn tướng hợp lệ để random.");
      return;
    }

    const pickRandom = () =>
      candidates[Math.floor(Math.random() * candidates.length)];

    setSpinning(true);
    setPendingHero(pickRandom());

    spinIntervalRef.current = window.setInterval(() => {
      setPendingHero(pickRandom());
    }, SPIN_INTERVAL);

    spinTimeoutRef.current = window.setTimeout(() => {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
      setPendingHero(pickRandom());
      setSpinning(false);
      spinTimeoutRef.current = null;
    }, SPIN_DURATION);
  }

  async function connectPhoneFeed() {
    setPhoneCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhoneCameraError("Trình duyệt không hỗ trợ camera. Hãy mở web bằng localhost hoặc HTTPS.");
      return;
    }

    let permissionStream = null;
    try {
      // Cấp quyền camera trước để Chrome hiển thị tên thiết bị trong enumerateDevices.
      permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      permissionStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const obsCamera = devices.find(
        (device) =>
          device.kind === "videoinput" &&
          /obs virtual camera/i.test(device.label),
      );

      if (!obsCamera) {
        setPhoneCameraError(
          "Không tìm thấy OBS Virtual Camera. Hãy mở OBS, chọn đúng Scene có ApowerMirror rồi nhấn Start Virtual Camera.",
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: obsCamera.deviceId } },
        audio: false,
      });

      setPhoneStream((current) => {
        current?.getTracks().forEach((track) => track.stop());
        return stream;
      });
      setPhoneCameraError("");
    } catch (cameraError) {
      permissionStream?.getTracks().forEach((track) => track.stop());
      setPhoneCameraError(
        cameraError?.name === "NotAllowedError"
          ? "Bạn chưa cấp quyền Camera cho trang web."
          : "Không kết nối được OBS Virtual Camera. Kiểm tra OBS và thử lại.",
      );
    }
  }

  function disconnectPhoneFeed() {
    phoneStream?.getTracks().forEach((track) => track.stop());
    setPhoneStream(null);
    setPhoneCameraError("");
  }

  function confirmHero() {
    if (!pendingHero || spinning || roundLocked) return;
    const selectedHero = pendingHero;
    if (selectedHero.owner === "A") {
      setUsedA((current) =>
        current.includes(selectedHero.id)
          ? current
          : [...current, selectedHero.id],
      );
    } else {
      setUsedB((current) =>
        current.includes(selectedHero.id)
          ? current
          : [...current, selectedHero.id],
      );
    }
    setConfirmedHero(selectedHero);
    setRoundLocked(true);
    setShowGameplay(true);
  }

  function declareRoundWinner(winner) {
    if (!roundLocked || !confirmedHero || roundWinner || matchComplete) return;
    const nextScoreA = scoreA + (winner === "A" ? 1 : 0);
    const nextScoreB = scoreB + (winner === "B" ? 1 : 0);

    setScoreA(nextScoreA);
    setScoreB(nextScoreB);
    setRoundWinner(winner);
    setPreviousRoundLoser(winner === "A" ? "B" : "A");

    if (nextScoreA === 4 || nextScoreB === 4 || gameRound === 7) {
      setMatchComplete(true);
    }
  }

  function nextRound() {
    if (!roundWinner || matchComplete || gameRound >= 7) return;
    const nextRoundNumber = gameRound + 1;
    setGameRound(nextRoundNumber);
    setShowGameplay(false);
    setPendingHero(null);
    setConfirmedHero(null);
    setRoundLocked(false);
    setRoundWinner(null);
  }

  function resetMatch() {
    phoneStream?.getTracks().forEach((track) => track.stop());
    setPhoneStream(null);
    setPhoneCameraError("");
    setShowGameplay(false);

    clearInterval(spinIntervalRef.current);
    clearTimeout(spinTimeoutRef.current);
    clearInterval(coinIntervalRef.current);
    clearTimeout(coinTimeoutRef.current);
    spinIntervalRef.current = null;
    spinTimeoutRef.current = null;
    coinIntervalRef.current = null;
    coinTimeoutRef.current = null;

    setMatchCreated(false);
    setMatchStarted(false);
    setMatchComplete(false);
    setPlayerA("");
    setPlayerB("");
    setPoolA([]);
    setPoolB([]);
    setCoinWinner(null);
    setCoinSpinning(false);
    setCoinDisplaySide("A");
    setUsedA([]);
    setUsedB([]);
    setGameRound(1);
    setScoreA(0);
    setScoreB(0);
    setSpinning(false);
    setPendingHero(null);
    setConfirmedHero(null);
    setRoundLocked(false);
    setRoundWinner(null);
    setPreviousRoundLoser(null);
  }

  const rulesUI = (
    <>
      <button
        type="button"
        className="rules-toggle-button"
        onClick={() => setShowRules(true)}
        aria-label="Hiển thị luật thi đấu"
      >
        📜 LUẬT THI ĐẤU
      </button>

      {showRules && (
        <div className="rules-modal-backdrop" onClick={() => setShowRules(false)}>
          <section
            className="rules-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="rules-modal-close"
              onClick={() => setShowRules(false)}
              aria-label="Đóng luật thi đấu"
            >
              ×
            </button>

            <h2 id="rules-modal-title">⚔️ THỂ THỨC SOLO 1V1</h2>

            <section className="rules-block">
              <h3>🎯 I. THỂ THỨC TỔNG THỂ</h3>
              <ul>
                <li>Trước trận, mỗi tuyển thủ chọn 1 Pool gồm 5 vị tướng (được phép trùng nhau).</li>
                <li>Thể thức thi đấu: <strong>BO7</strong>.</li>
                <li>🥇 <strong>Ván 1:</strong> Tung đồng xu chọn tuyển thủ A được random trước. Hệ thống chọn 1 tướng trong Pool của A.</li>
                <li>🥈 <strong>Ván 2–6:</strong> Người thua ván trước sẽ được hệ thống random 1 tướng để thi đấu.</li>
                <li>🔥 <strong>Ván 7 (nếu hòa 3–3):</strong> Gộp các tướng còn lại của hai Pool thành 4 tướng, random 1 tướng để thi đấu.</li>
              </ul>
            </section>

            <section className="rules-block">
              <h3>⚔️ II. LUẬT SOLO</h3>
              <ul>
                <li>🗺️ Map: Solo 5v5.</li>
                <li>⏱️ Thời gian: Tối đa 6 phút/ván.</li>
                <li>🚫 Không được ăn gói máu giữa map. Vi phạm: xử thua ván.</li>
                <li>🚫 Không được về tế đàn hồi máu sau phút thứ 4. Vi phạm: xử thua ván.</li>
                <li>🚫 Không được ăn quái rừng. Vi phạm: xử thua ván.</li>
                <li>🛠️ Được phép sử dụng trang bị nhánh phụ trợ.</li>
              </ul>
            </section>

            <section className="rules-block">
              <h3>🏆 III. ĐIỀU KIỆN CHIẾN THẮNG</h3>
              <ol>
                <li><strong>Trước phút thứ 6, trụ bên nào bị phá</strong> thì bên đó thua.</li>
                <li>Nếu trụ không bị phá, tuyển thủ có <strong>nhiều mạng hạ gục hơn</strong> thắng.</li>
                <li>Nếu hòa mạng, tuyển thủ có <strong>lượng vàng cao hơn tại 06:00</strong> thắng.</li>
                <li>🔄 Nếu hòa tất cả điều kiện, <strong>đấu lại với cùng vị tướng</strong>.</li>
              </ol>
            </section>
          </section>
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <>
        <img className="site-logo" src="/logo.png" alt="Hot Seat & 1V1 Championship" />
        {posterVisible && (
          <div className="poster-overlay">
            <img src="/poster.png" alt="Hot Seat & 1V1 Championship poster" />
          </div>
        )}
        <div className="loading-screen">ĐANG TẢI DỮ LIỆU TƯỚNG...</div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <img className="site-logo" src="/logo.png" alt="Hot Seat & 1V1 Championship" />
        {posterVisible && (
          <div className="poster-overlay">
            <img src="/poster.png" alt="Hot Seat & 1V1 Championship poster" />
          </div>
        )}
      <div className="loading-screen error-screen">
        <div>
          <strong>KHÔNG THỂ TẠO TRẬN ĐẤU</strong>
          <p>{error}</p>
          <small>Kiểm tra thư mục public/assets/heroes/heroes.json rồi tải lại trang.</small>
        </div>
      </div>
      </>
    );
  }

  if (matchCreated && !matchStarted) {
    return (
      <main className="app">
        {rulesUI}
        <img className="site-logo" src="/logo.png" alt="Hot Seat & 1V1 Championship" />
        {posterVisible && (
          <div className="poster-overlay">
            <img src="/poster.png" alt="Hot Seat & 1V1 Championship poster" />
          </div>
        )}
        <div className="match-created">
          <h1>SẴN SÀNG TRANH TÀI</h1>
          <p className="match-format">SOLO 1V1 — BEST OF 7</p>

          <div className="match-preview">
            <div className="match-player team-a">
              <h2>{playerA}</h2>
              <div className="preview-pool">
                {poolA.map((hero) => (
                  <div className="preview-hero-slot" key={hero.id}>
                    <img src={hero.icon} alt={hero.name} />
                    <span title={hero.name}>{hero.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="versus">VS</div>
            <div className="match-player team-b">
              <h2>{playerB}</h2>
              <div className="preview-pool">
                {poolB.map((hero) => (
                  <div className="preview-hero-slot" key={hero.id}>
                    <img src={hero.icon} alt={hero.name} />
                    <span title={hero.name}>{hero.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="success-message">Hai tuyển thủ đã đăng ký 5 tướng hợp lệ.</p>

          <div className="match-actions">
            <button type="button" className="secondary-button" onClick={resetMatch}>
              HỦY TRẬN
            </button>
            <button type="button" className="primary-button" onClick={startMatch}>
              BẮT ĐẦU TRẬN ĐẤU
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (matchCreated && matchStarted) {
    const finalWinner = scoreA === 4 ? "A" : scoreB === 4 ? "B" : null;
    const roundPool = getRoundPool();

    if (showGameplay && !matchComplete) {
      return (
        <main className="app match-control live-game-mode">
          {rulesUI}
          <img className="site-logo" src="/logo.png" alt="Hot Seat & 1V1 Championship" />
          {posterVisible && (
            <div className="poster-overlay">
              <img src="/poster.png" alt="Hot Seat & 1V1 Championship poster" />
            </div>
          )}

          <header className="top-header">
            <div>
              <div className="eyebrow">AOV TOURNAMENT · LIVE GAMEPLAY</div>
              <h1>ĐANG THI ĐẤU — VÁN {gameRound}</h1>
              <p>{playerA} <strong>VS</strong> {playerB}</p>
            </div>
            <div className="format-badge">BEST OF 7</div>
          </header>

          <section className="live-game-layout">
            <div className="live-phone-panel">
              <div className="live-phone-heading">
                <div>
                  <span className="eyebrow">PHONE SCREEN</span>
                  <h2>MÀN HÌNH ĐIỆN THOẠI</h2>
                </div>
                <span className={`live-connection-state ${phoneStream ? "is-connected" : ""}`}>
                  {phoneStream ? "ĐÃ KẾT NỐI" : "CHƯA KẾT NỐI"}
                </span>
              </div>

              <div className="live-phone-frame">
                {phoneStream ? (
                  <video ref={phoneVideoRef} autoPlay muted playsInline />
                ) : (
                  <div className="live-phone-placeholder">
                    <span>📱</span>
                    <strong>CHƯA CÓ TÍN HIỆU ĐIỆN THOẠI</strong>
                    <p>Kết nối ApowerMirror với OBS, sau đó bật OBS Virtual Camera.</p>
                  </div>
                )}
              </div>

              <div className="live-phone-actions">
                {!phoneStream ? (
                  <button type="button" className="primary-button" onClick={connectPhoneFeed}>
                    KẾT NỐI OBS VIRTUAL CAMERA
                  </button>
                ) : (
                  <button type="button" className="secondary-button" onClick={disconnectPhoneFeed}>
                    NGẮT KẾT NỐI
                  </button>
                )}
                {phoneCameraError && <p className="live-phone-error">{phoneCameraError}</p>}
              </div>
            </div>

            <aside className="live-game-sidebar">
              <div className="live-score-card">
                <span>ĐANG DIỄN RA · VÁN {gameRound}</span>
                <div className="live-score-row">
                  <div className="team-a">
                    <small>PLAYER A</small>
                    <strong>{playerA}</strong>
                    <b>{scoreA}</b>
                  </div>
                  <em>VS</em>
                  <div className="team-b">
                    <small>PLAYER B</small>
                    <strong>{playerB}</strong>
                    <b>{scoreB}</b>
                  </div>
                </div>
              </div>

              <div className="live-confirmed-hero">
                <span>TƯỚNG ĐÃ XÁC NHẬN</span>
                {confirmedHero && (
                  <>
                    <img src={confirmedHero.card || confirmedHero.icon} alt={confirmedHero.name} />
                    <strong>{confirmedHero.name}</strong>
                    <small>PLAYER {confirmedHero.owner}</small>
                  </>
                )}
              </div>

              <div className="live-game-note">
                <strong>ĐANG TRONG VÁN ĐẤU</strong>
                <p>Khi ván đấu kết thúc, nhấn nút bên dưới để quay lại màn hình nhập kết quả.</p>
              </div>

              <button
                type="button"
                className="primary-button live-end-button"
                onClick={() => setShowGameplay(false)}
              >
                KẾT THÚC VÁN · NHẬP KẾT QUẢ
              </button>
            </aside>
          </section>
        </main>
      );
    }

    return (
      <main className="app match-control">
          {rulesUI}
        <img className="site-logo" src="/logo.png" alt="Hot Seat & 1V1 Championship" />
        {posterVisible && (
          <div className="poster-overlay">
            <img src="/poster.png" alt="Hot Seat & 1V1 Championship poster" />
          </div>
        )}
        <header className="top-header">
          <div>
            <div className="eyebrow">AOV TOURNAMENT MANAGEMENT</div>
            <h1>ĐIỀU KHIỂN TRẬN ĐẤU</h1>
          </div>
          <div className="format-badge">BEST OF 7</div>
        </header>

        <div className="scoreboard">
          <div className="score-player team-a">
            <span>PLAYER A</span>
            <h2>{playerA}</h2>
            <strong>{scoreA}</strong>
          </div>
          <div className="score-versus">VS</div>
          <div className="score-player team-b">
            <span>PLAYER B</span>
            <h2>{playerB}</h2>
            <strong>{scoreB}</strong>
          </div>
        </div>

        {matchComplete ? (
          <section className="match-finished">
            <div className="eyebrow">MATCH COMPLETED</div>
            <h2>{finalWinner ? `PLAYER ${finalWinner} (${finalWinner === "A" ? playerA : playerB}) CHIẾN THẮNG!` : "TRẬN ĐẤU KẾT THÚC"}</h2>
            <p className="final-score">{scoreA} - {scoreB}</p>
            <button type="button" className="secondary-button" onClick={resetMatch}>
              TẠO TRẬN MỚI
            </button>
          </section>
        ) : (
          <section className="control-section">
            <div className="section-heading">
              <span>ROUND 0{gameRound}</span>
              <h2>
                {gameRound === 1
                  ? "TUNG ĐỒNG XU · RANDOM TƯỚNG"
                  : gameRound === 7
                    ? "POOL CUỐI · RANDOM TƯỚNG"
                    : "NGƯỜI THUA VÁN TRƯỚC RANDOM"}
              </h2>
              <p>
                {gameRound === 1
                  ? "NGƯỜI THẮNG TUNG ĐỒNG XU ĐƯỢC RANDOM"
                  : gameRound === 7
                    ? "POOL GỒM TƯỚNG CÒN LẠI CỦA HAI BÊN"
                    : `PLAYER ${previousRoundLoser || "?"} THUA VÁN TRƯỚC · ĐƯỢC RANDOM`}
              </p>
            </div>

            {gameRound === 1 && (
              <div className="coin-area">
                <div className={`coin-display ${coinSpinning ? "spinning-coin" : ""}`}>
                  {coinSpinning ? (
                    <>
                      <div className="coin-spinner-graphic">
                        <span className={`coin-side ${coinDisplaySide.toLowerCase()}`}>
                          {coinDisplaySide}
                        </span>
                      </div>
                      <strong>ĐANG TUNG ĐỒNG XU (5s)...</strong>
                      <p>Hệ thống đang xoay xác định tuyển thủ ưu tiên</p>
                    </>
                  ) : coinWinner ? (
                    <>
                      <span className="coin-result">KẾT QUẢ: PLAYER {coinWinner}</span>
                      <strong>{coinWinner === "A" ? playerA : playerB}</strong>
                      <p>Được ưu tiên mở đầu lượt Random tướng</p>
                    </>
                  ) : (
                    <>
                      <span className="coin-icon">🪙</span>
                      <strong>CHƯA TUNG ĐỒNG XU</strong>
                      <p>Nhấn nút để bắt đầu tung 5 giây</p>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={tossCoin}
                  disabled={Boolean(coinWinner) || coinSpinning || spinning || Boolean(pendingHero)}
                >
                  {coinSpinning ? "ĐANG TUNG..." : "TUNG ĐỒNG XU (5s)"}
                </button>
              </div>
            )}

            {/* Khu vực hiển thị 5 Slot Pool Tướng trước khi random */}
            <div className="random-pools">
              {gameRound === 7 ? (
                <>
                  <RandomPool player="A" playerName={playerA} pool={poolA} usedIds={usedA} />
                  <RandomPool player="B" playerName={playerB} pool={poolB} usedIds={usedB} />
                </>
              ) : roundPool.length === 0 ? (
                <div className="random-pool random-pool-waiting">
                  <strong>{gameRound === 1 ? "CHỜ KẾT QUẢ TUNG ĐỒNG XU" : "CHỜ XÁC ĐỊNH NGƯỜI THUA VÁN TRƯỚC"}</strong>
                  <span>{gameRound === 1 ? "Tung đồng xu để xác định người được random tướng." : "Hoàn tất ván trước để mở pool của người thua."}</span>
                </div>
              ) : (
                <RandomPool
                  player={roundPool[0].owner}
                  playerName={roundPool[0].owner === "A" ? playerA : playerB}
                  pool={roundPool.map(({ owner, ...hero }) => hero)}
                  usedIds={roundPool[0].owner === "A" ? usedA : usedB}
                />
              )}
            </div>

            {/* Khu vực Random Tướng */}
            <div className="random-area">
              <div className="random-result-stage">
                {pendingHero ? (
                  <div
                    className={`random-result-card ${spinning ? "spinning" : ""} ${
                      confirmedHero ? "confirmed" : ""
                    }`}
                  >
                    <img
                      src={pendingHero.card || pendingHero.icon}
                      alt={pendingHero.name}
                    />
                    <div className="random-hero-info">
                      <span>
                        {spinning
                          ? "RANDOMING..."
                          : confirmedHero
                            ? "CONFIRMED HERO"
                            : "RANDOM RESULT"}
                      </span>
                      <h2>{pendingHero.name}</h2>
                      <p>
                        POOL CỦA PLAYER {pendingHero.owner} (
                        {pendingHero.owner === "A" ? playerA : playerB})
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="random-placeholder">
                    <span>?</span>
                    <p>CHƯA RANDOM TƯỚNG</p>
                  </div>
                )}
              </div>

              {!pendingHero && (
                <button
                  type="button"
                  className="primary-button random-button"
                  onClick={startRandom}
                  disabled={spinning || roundLocked || (gameRound === 1 && !coinWinner) || (gameRound >= 2 && gameRound <= 6 && !previousRoundLoser) || coinSpinning}
                >
                  RANDOM TƯỚNG VÁN {gameRound} (5s)
                </button>
              )}

              {spinning && (
                <div className="spin-status">
                  <span className="spin-indicator" /> ĐANG RANDOM TƯỚNG...
                </div>
              )}

              {pendingHero && !spinning && !roundLocked && (
                <button
                  type="button"
                  className="primary-button confirm-button"
                  onClick={confirmHero}
                >
                  XÁC NHẬN TƯỚNG
                </button>
              )}

              {roundLocked && !roundWinner && (
                <div className="winner-selection">
                  <p>CHỌN TUYỂN THỦ THẮNG VÁN {gameRound}</p>
                  <div className="winner-buttons">
                    <button
                      type="button"
                      className="winner-button team-a-button"
                      onClick={() => declareRoundWinner("A")}
                    >
                      {playerA.toUpperCase() || "PLAYER A"} THẮNG
                    </button>
                    <button
                      type="button"
                      className="winner-button team-b-button"
                      onClick={() => declareRoundWinner("B")}
                    >
                      {playerB.toUpperCase() || "PLAYER B"} THẮNG
                    </button>
                  </div>
                </div>
              )}

              {roundWinner && (
                <div className="confirmed-status">
                  ✓ {roundWinner === "A" ? playerA : playerB} CHIẾN THẮNG VÁN {gameRound}
                </div>
              )}

              {roundWinner && !matchComplete && (
                <button
                  type="button"
                  className="primary-button next-round-button"
                  onClick={nextRound}
                >
                  CHUYỂN SANG VÁN {gameRound + 1}
                </button>
              )}
            </div>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="app">
        {rulesUI}
      <img className="site-logo" src="/logo.png" alt="Hot Seat & 1V1 Championship" />
      {posterVisible && (
        <div className="poster-overlay">
          <img src="/poster.png" alt="Hot Seat & 1V1 Championship poster" />
        </div>
      )}
      <header className="top-header">
        <div>
          <div className="eyebrow">AOV TOURNAMENT MANAGEMENT</div>
          <h1>TẠO TRẬN SOLO 1V1</h1>
          <p>Thiết lập trận đấu và chọn đủ 5 vị tướng cho mỗi bên.</p>
        </div>
        <div className="format-badge">BEST OF 7</div>
      </header>

      <div className="versus-divider">
        <span>PLAYER A</span>
        <strong>VS</strong>
        <span>PLAYER B</span>
      </div>

      <div className="players-container">
        <PlayerPanel
          player="A"
          playerName={playerA}
          setPlayerName={setPlayerA}
          selectedHeroes={poolA}
          onToggleHero={(hero) => toggleHero(poolA, setPoolA, hero)}
          heroes={heroes}
        />
        <PlayerPanel
          player="B"
          playerName={playerB}
          setPlayerName={setPlayerB}
          selectedHeroes={poolB}
          onToggleHero={(hero) => toggleHero(poolB, setPoolB, hero)}
          heroes={heroes}
        />
      </div>

      <footer className="create-footer">
        <div className="footer-progress">
          <span>POOL A: {poolA.length}/5</span>
          <span>POOL B: {poolB.length}/5</span>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={createMatch}
          disabled={
            !playerA.trim() ||
            !playerB.trim() ||
            poolA.length !== POOL_SIZE ||
            poolB.length !== POOL_SIZE
          }
        >
          TẠO TRẬN ĐẤU
        </button>
      </footer>
    </main>
  );
}