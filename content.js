// content.js - improved preprocessing, OCR with 5-char enforcement, auto-refresh on fail

let failCount = 0;
const MAX_FAILS = 3; // fewer fails before refresh

function waitForImageLoad(img) {
  return new Promise((resolve, reject) => {
    if (!img) return reject('No image element');
    if (img.complete && img.naturalWidth > 0) {
      resolve();
    } else {
      img.addEventListener('load', function onl() { img.removeEventListener('load', onl); resolve(); });
      img.addEventListener('error', function one() { img.removeEventListener('error', one); reject('Failed to load image'); });
    }
  });
}

function waitForTesseractReady(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check() {
      if (typeof Tesseract !== 'undefined' && Tesseract && typeof Tesseract.recognize === 'function') return resolve();
      if (Date.now() - start > timeout) return reject('Tesseract not ready in time');
      setTimeout(check, 200);
    })();
  });
}

function invertImageData(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i+1] = 255 - d[i+1];
    d[i+2] = 255 - d[i+2];
  }
  return imageData;
}

function preprocessCaptcha(captchaImg, invert = false) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const w = captchaImg.naturalWidth || captchaImg.width;
  const h = captchaImg.naturalHeight || captchaImg.height;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(captchaImg, 0, 0, w, h);

  let imageData = ctx.getImageData(0, 0, w, h);
  if (invert) {
    imageData = invertImageData(imageData);
    ctx.putImageData(imageData, 0, 0);
  }

  // upscale
  const scaled = document.createElement("canvas");
  const sctx = scaled.getContext("2d");
  scaled.width = w * 2;
  scaled.height = h * 2;
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);

  return scaled.toDataURL("image/png");
}

async function solveCaptchaAndSubmit() {
  try {
    const captchaImg = document.querySelector("img[src^='data:image/png']");
    const inputBox = document.querySelector("input[name=captcha]");
    const checkBtn = document.querySelector("input[type=submit][value*='Check For Available Assignments']");

    if (!captchaImg || !inputBox || !checkBtn) return false;

    await waitForImageLoad(captchaImg);
    await waitForTesseractReady();

    const imgNormal = preprocessCaptcha(captchaImg, false);
    const imgInverted = preprocessCaptcha(captchaImg, true);

    const [res1, res2] = await Promise.all([
      Tesseract.recognize(imgNormal, "eng"),
      Tesseract.recognize(imgInverted, "eng")
    ]);

    function clean(text) {
      return (text || "").replace(/[^A-Za-z0-9]/g, "").trim().slice(0, 5);
    }

    let candidate1 = clean(res1.data.text);
    let candidate2 = clean(res2.data.text);

    let chosen = candidate1.length === 5 ? candidate1 : candidate2;

    if (chosen.length === 5) {
      inputBox.value = chosen;
      inputBox.dispatchEvent(new Event("input", { bubbles: true }));
      inputBox.dispatchEvent(new Event("change", { bubbles: true }));
      checkBtn.click();
      console.log("✅ Submitted captcha:", chosen);
      failCount = 0;
      return true;
    } else {
      console.log("❌ OCR failed both attempts.");
      failCount++;
      return false;
    }
  } catch (e) {
    console.error("⚠️ Error:", e);
    failCount++;
    return false;
  }
}

async function runBot() {
  try {
    if (document.body.innerText.includes("Congrats! You'be been assigned a new order for top levels!")) {
      console.log("🎉 Success message found, stopping.");
      return;
    }
    const ok = await solveCaptchaAndSubmit();
    if (!ok && failCount >= MAX_FAILS) {
      console.log("🔄 Too many fails, refreshing page immediately...");
      location.reload();
      return;
    }
  } finally {
    setTimeout(runBot, 2000);
  }
}

window.addEventListener("load", () => {
  console.log("🤖 Bot started.");
  runBot();
});
