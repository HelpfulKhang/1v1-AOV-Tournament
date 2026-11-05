
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DATA_URL =
  "https://cdn.jsdelivr.net/gh/MLuc24/lien-quan-data@main/data/heroes.json";

const OUTPUT_DIR = path.join(
  __dirname,
  "..",
  "public",
  "assets",
  "heroes"
);

const CONCURRENCY = 5;

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.json();
}

async function downloadImage(url) {
  if (!url || !url.startsWith("https://")) {
    throw new Error("URL ảnh không hợp lệ");
  }

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length === 0) {
        throw new Error("Ảnh tải về bị rỗng");
      }

      return buffer;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw lastError;
}

function getDefaultSkin(hero) {
  const skins = hero.skins || [];

  return (
    skins.find(skin => skin.index === 1) ||
    skins.find(skin =>
      /mặc định|default/i.test(
        `${skin.name || ""} ${skin.shortName || ""}`
      )
    ) ||
    skins[0] ||
    null
  );
}

async function saveIcon(url, outputPath) {
  // Nếu icon đã tồn tại thì không tải lại
  if (fs.existsSync(outputPath)) {
    return;
  }

  const buffer = await downloadImage(url);

  await sharp(buffer)
    .resize(512, 512, {
      fit: "cover",
      position: "centre"
    })
    .webp({ quality: 88 })
    .toFile(outputPath);
}


async function saveCard(url, outputPath) {
  const buffer = await downloadImage(url);

  await sharp(buffer)
    .rotate()
    .resize({
      width: 1200,
      withoutEnlargement: true
    })
    .webp({ quality: 90 })
    .toFile(outputPath);
}


async function processHero(hero) {
  const id = hero.slug;

  if (!id || !hero.name) {
    return {
      hero: null,
      errors: ["Thiếu slug hoặc tên tướng"]
    };
  }

  const folder = path.join(OUTPUT_DIR, id);
  fs.mkdirSync(folder, { recursive: true });

  const skin = getDefaultSkin(hero);

  if (!skin) {
    return {
      hero: {
        id,
        name: hero.name,
        icon: null,
        card: null
      },
      errors: ["Không tìm thấy skin"]
    };
  }

  const iconPath = path.join(folder, "icon.webp");
  const cardPath = path.join(folder, "card.webp");

  const result = {
    hero: {
      id,
      name: hero.name,
      icon: null,
      card: null
    },
    errors: []
  };

  try {
    await saveIcon(skin.thumb, iconPath);
    result.hero.icon = `/assets/heroes/${id}/icon.webp`;
  } catch (error) {
    result.errors.push(`Icon: ${error.message}`);
  }

  try {
    await saveCard(skin.splash, cardPath);
    result.hero.card = `/assets/heroes/${id}/card.webp`;
  } catch (error) {
    result.errors.push(`Splash Art: ${error.message}`);
  }

  return result;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("==================================");
  console.log("       AOV HERO ASSET SYNC");
  console.log("==================================");
  console.log("Đang tải dữ liệu tướng...");

  const heroes = await fetchJson(DATA_URL);

  console.log(`Tìm thấy ${heroes.length} tướng.`);
  console.log("Bắt đầu tải ảnh...\n");

  const results = new Array(heroes.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;

      if (index >= heroes.length) {
        return;
      }

      const result = await processHero(heroes[index]);
      results[index] = result;

      const name = result.hero?.name || heroes[index].name;
      const status = result.errors.length === 0 ? "OK" : "WARNING";

      console.log(
        `[${index + 1}/${heroes.length}] ${name}: ${status}`
      );

      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(CONCURRENCY, heroes.length) },
      () => worker()
    )
  );

  const heroData = results
    .filter(result => result && result.hero)
    .map(result => result.hero);

  const jsonPath = path.join(OUTPUT_DIR, "heroes.json");

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(heroData, null, 2),
    "utf8"
  );

  const failed = results.filter(
    result => result && result.errors.length > 0
  );

  const success = results.length - failed.length;

  console.log("\n==================================");
  console.log("             KẾT QUẢ");
  console.log("==================================");
  console.log(`Tổng số tướng: ${heroes.length}`);
  console.log(`Hoàn tất đầy đủ: ${success}`);
  console.log(`Có ảnh bị lỗi: ${failed.length}`);
  console.log(`JSON: ${jsonPath}`);
  console.log("==================================");
}

main().catch(error => {
  console.error("\nĐỒNG BỘ THẤT BẠI:");
  console.error(error);
  process.exitCode = 1;
});
