const form = document.querySelector("#generatorForm");
const photoInput = document.querySelector("#photoInput");
const subjectInput = document.querySelector("#subjectInput");
const eraSelect = document.querySelector("#eraSelect");
const wardrobeSelect = document.querySelector("#wardrobeSelect");
const plateSelect = document.querySelector("#plateSelect");
const toneSelect = document.querySelector("#toneSelect");
const ageRange = document.querySelector("#ageRange");
const grainToggle = document.querySelector("#grainToggle");
const scratchToggle = document.querySelector("#scratchToggle");
const fadeToggle = document.querySelector("#fadeToggle");
const portraitPreview = document.querySelector("#portraitPreview");
const promptOutput = document.querySelector("#promptOutput");
const plateCaption = document.querySelector("#plateCaption");
const eraChip = document.querySelector("#eraChip");
const toneChip = document.querySelector("#toneChip");
const ageChip = document.querySelector("#ageChip");
const historyList = document.querySelector("#historyList");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");
const resetButton = document.querySelector("#resetButton");
const canvas = document.querySelector("#renderCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const sampleImage = "assets/sample-portrait.png";
let sourceImage = sampleImage;
let currentRender = sampleImage;

const toneLabels = {
  sepia: "Sepia",
  mono: "Black and white",
  cool: "Silver gray",
};

const renderState = {
  history: JSON.parse(localStorage.getItem("timeportrait-history") || "[]"),
};

function getSettings() {
  return {
    subject: subjectInput.value.trim() || subjectInput.placeholder,
    era: eraSelect.value,
    wardrobe: wardrobeSelect.value,
    plate: plateSelect.value,
    tone: toneSelect.value,
    age: Number(ageRange.value),
    grain: grainToggle.checked,
    scratches: scratchToggle.checked,
    fading: fadeToggle.checked,
  };
}

function composePrompt(settings) {
  const imperfections = [
    settings.grain ? "fine analog film grain" : "",
    settings.scratches ? "hairline scratches and dust specks" : "",
    settings.fading ? "slight fading, patina, uneven exposure, soft vignette" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return `Transform the reference person into a realistic ${settings.era}.

Subject:
${settings.subject}

Historical styling:
- Preserve facial features, identity, bone structure, and realistic skin texture.
- Adapt hairstyle, grooming, and styling to the 1800s.
- Dress the person in ${settings.wardrobe}.
- Keep the expression serious or neutral with a static formal pose.

Photography style:
- ${settings.plate}.
- ${toneLabels[settings.tone]} color grading.
- Soft natural studio lighting, subtle blur from old optics, historically plausible neutral backdrop.
- Add ${imperfections || "subtle authentic photographic imperfections"}.
- Aging intensity: ${settings.age}%.

Avoid:
- Modern clothing, modern haircuts, modern objects, visible logos, text, smiling pose, glossy digital sharpness, fantasy costume details.`;
}

function updateLabels(settings) {
  const eraLabel = eraSelect.options[eraSelect.selectedIndex].textContent;
  plateCaption.textContent = settings.era;
  eraChip.textContent = eraLabel;
  toneChip.textContent = toneLabels[settings.tone];
  ageChip.textContent = `${settings.age}% aged`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function applyTone(data, tone, age) {
  const pixels = data.data;
  const ageMix = age / 100;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    let nr = gray;
    let ng = gray;
    let nb = gray;

    if (tone === "sepia") {
      nr = gray * (1.12 + ageMix * 0.1);
      ng = gray * (0.94 - ageMix * 0.04);
      nb = gray * (0.72 - ageMix * 0.1);
    }

    if (tone === "cool") {
      nr = gray * 0.9;
      ng = gray * 0.96;
      nb = gray * 1.08;
    }

    const contrast = 0.92 - ageMix * 0.18;
    const fade = 18 + ageMix * 42;
    pixels[i] = clamp((nr - 128) * contrast + 128 + fade);
    pixels[i + 1] = clamp((ng - 128) * contrast + 128 + fade);
    pixels[i + 2] = clamp((nb - 128) * contrast + 128 + fade);
  }
}

function drawVignette(width, height, age) {
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.44,
    width * 0.18,
    width * 0.5,
    height * 0.5,
    width * 0.72
  );
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(0.62, "rgba(42,31,23,0.05)");
  vignette.addColorStop(1, `rgba(20,16,13,${0.28 + age / 260})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function drawGrain(width, height, age) {
  const count = Math.floor((width * height * (age / 100)) / 80);
  for (let i = 0; i < count; i += 1) {
    const shade = Math.random() > 0.55 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * 0.075})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
  }
}

function drawScratches(width, height, age) {
  const count = Math.floor(7 + age / 8);
  ctx.lineCap = "round";

  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const length = 40 + Math.random() * height * 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + Math.random() * 18 - 9,
      y + length * 0.3,
      x + Math.random() * 20 - 10,
      y + length * 0.7,
      x + Math.random() * 18 - 9,
      y + length
    );
    ctx.strokeStyle = `rgba(255,250,230,${0.09 + Math.random() * 0.14})`;
    ctx.lineWidth = Math.random() > 0.78 ? 1.2 : 0.55;
    ctx.stroke();
  }
}

function drawFading(width, height, age) {
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = `rgba(235,220,190,${0.06 + age / 620})`;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 10; i += 1) {
    ctx.fillStyle = `rgba(255,245,220,${Math.random() * 0.045})`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * width,
      Math.random() * height,
      28 + Math.random() * 110,
      18 + Math.random() * 86,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
}

async function renderPortrait() {
  const settings = getSettings();
  promptOutput.value = composePrompt(settings);
  updateLabels(settings);

  if (sourceImage === sampleImage && window.location.protocol === "file:") {
    portraitPreview.src = sampleImage;
    currentRender = sampleImage;
    return;
  }

  const image = await loadImage(sourceImage);
  const targetRatio = 4 / 5;
  const width = 1080;
  const height = Math.round(width / targetRatio);
  canvas.width = width;
  canvas.height = height;

  const sourceRatio = image.width / image.height;
  let drawWidth = width;
  let drawHeight = height;
  let dx = 0;
  let dy = 0;

  if (sourceRatio > targetRatio) {
    drawHeight = height;
    drawWidth = height * sourceRatio;
    dx = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / sourceRatio;
    dy = (height - drawHeight) / 2;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#241d18";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);

  const imageData = ctx.getImageData(0, 0, width, height);
  applyTone(imageData, settings.tone, settings.age);
  ctx.putImageData(imageData, 0, 0);

  if (settings.fading) {
    drawFading(width, height, settings.age);
  }

  drawVignette(width, height, settings.age);

  if (settings.grain) {
    drawGrain(width, height, settings.age);
  }

  if (settings.scratches) {
    drawScratches(width, height, settings.age);
  }

  currentRender = canvas.toDataURL("image/png");
  portraitPreview.src = currentRender;
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function addHistory(settings) {
  const item = {
    id: Date.now(),
    era: eraSelect.options[eraSelect.selectedIndex].textContent,
    tone: toneLabels[settings.tone],
    age: settings.age,
  };

  renderState.history = [item, ...renderState.history].slice(0, 4);
  localStorage.setItem("timeportrait-history", JSON.stringify(renderState.history));
  paintHistory();
}

function paintHistory() {
  historyList.innerHTML = "";

  if (!renderState.history.length) {
    const empty = document.createElement("div");
    empty.className = "history-item";
    empty.innerHTML = "<strong>No runs yet</strong><small>Your generated briefs will appear here.</small>";
    historyList.append(empty);
    return;
  }

  renderState.history.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";
    row.innerHTML = `<strong>${item.era}</strong><small>${item.tone}, ${item.age}% aged</small>`;
    historyList.append(row);
  });
}

photoInput.addEventListener("change", () => {
  const [file] = photoInput.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    sourceImage = reader.result;
    await renderPortrait();
  };
  reader.readAsDataURL(file);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await renderPortrait();
  addHistory(getSettings());
});

[subjectInput, eraSelect, wardrobeSelect, plateSelect, toneSelect, ageRange, grainToggle, scratchToggle, fadeToggle].forEach(
  (control) => {
    control.addEventListener("input", () => {
      promptOutput.value = composePrompt(getSettings());
      updateLabels(getSettings());
    });
  }
);

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(promptOutput.value);
  } catch (error) {
    promptOutput.focus();
    promptOutput.select();
    document.execCommand("copy");
  }

  copyButton.textContent = "Copied";
  window.setTimeout(() => {
    copyButton.textContent = "Copy";
  }, 1400);
});

downloadButton.addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = currentRender;
  link.download = "timeportrait-proof.png";
  link.click();
});

resetButton.addEventListener("click", async () => {
  form.reset();
  sourceImage = sampleImage;
  await renderPortrait();
});

renderPortrait();
paintHistory();
