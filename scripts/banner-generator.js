/**
 * Banner Generator - overlays a text skeleton on top of a background template and exports a PNG.
 *
 * This library does NOT recreate your layout; it draws a minimal "frame" panel and places text
 * like in your example. You provide the template (your designed image), and we overlay the text.
 *
 * Usage example (browser):
 *   const out = await BannerGenerator.generate({
 *     template: '/images/your-template.png',  // or HTMLImageElement
 *     deviceName: 'Device Name\nHere',
 *     maintainer: 'Maintainer',
 *     manufacturer: 'Manufacturer',
 *     codename: 'Device Codename',
 *     release: '4.x update'
 *   });
 *   // Download file:
 *   await BannerGenerator.download(out.blob, 'alphadroid-banner.png');
 *
 * The function returns:
 *   { canvas, blob, dataURL }
 *
 * Notes:
 * - Make sure any custom fonts are loaded via CSS. This module will wait for them if you specify families.
 * - If your template image is hosted on another domain, ensure it sends CORS headers and set crossOrigin='anonymous'.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BannerGenerator = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const DEFAULT_WIDTH = 1920;
  const DEFAULT_HEIGHT = 1080;

  const defaultOpts = {
    // Canvas and export
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    quality: 1.0, // PNG export (lossless compression for perfect color preservation)
    dpr: 1, // Force DPR to 1 to preserve original skeleton image format exactly

    // Content
    deviceName: "Device Name\nHere", // you can use \n to force break
    maintainer: "Maintainer",
    manufacturer: "Manufacturer",
    codename: "Device Codename",
    brand: "AlphaDroid",
    isOfficial: false, // Whether device is official (found in JSON data)

    // Frame (left panel) styling (over the template)
    frame: {
      // Insets from canvas edges
      insetX: 40, // overall horizontal margin
      insetY: 28, // overall vertical margin
      widthRatio: 0.58, // width of the left frame as portion of canvas width
      radius: 28,
      fill: "rgba(0,0,0,0.0)", // translucent dark overlay
      blur: 0, // set to >0 for subtle blur (requires filter on ctx draw)
      border: { color: "rgba(255,255,255,0.0)", width: 1 },
      shadow: { x: 0, y: 10, blur: 30, color: "rgba(0,0,0,0.0)" },
    },

    // Typography (choose families that exist in your page)
    fonts: {
      // Families should be loaded via CSS. We'll wait for them if document.fonts exists.
      family:
        "Fredoka, 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      headerWeight: 800,
      deviceWeight: 800,
      smallWeight: 700,
      brandWeight: 800,
      // Sizes are scaled relative to height; these act as starting ratios.
      headerSizeRatio: 0.055, // ~42px at 768
      deviceMaxSizeRatio: 0.17, // cap for largest device title size
      smallSizeRatio: 0.032, // ~24-26px
      brandSizeRatio: 0.046, // ~35px
      // Letter spacing for device name text (as percentage of font size, e.g., 0.02 = 2%)
      deviceLetterSpacing: -0.04,
    },

    // Colors
    colors: {
      textPrimary: "#ECEAF2",
      textSecondary: "#E1DEEA",
      textMuted: "rgba(255,255,255,0.82)",
      pillBg1: "rgba(255,255,255,0.20)",
      pillBg2: "rgba(108,99,255,0.25)",
      pillText: "#FFFFFF",
    },

    // Layout paddings within the frame (in pixels before DPR scaling)
    paddings: {
      top: 36,
      left: 36,
      right: 36,
      bottom: 36,
      gapAfterHeader: 16,
      gapAfterDevice: 28,
      gapPills: 14,
      pillPadX: 20,
      pillPadY: 10,
    },

    // Optional debug grid
    debug: false,
  };

  // Utilities

  function mergeDeep(target, source) {
    const out = { ...target };
    for (const k in source) {
      if (Object.prototype.hasOwnProperty.call(source, k)) {
        if (isPlainObject(source[k]) && isPlainObject(target[k])) {
          out[k] = mergeDeep(target[k], source[k]);
        } else {
          out[k] = source[k];
        }
      }
    }
    return out;
  }

  function isPlainObject(v) {
    return Object.prototype.toString.call(v) === "[object Object]";
  }

  function createCanvas(width, height, dpr = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return { canvas, ctx };
  }

  function loadImage(srcOrImg) {
    return new Promise((resolve, reject) => {
      if (!srcOrImg) return reject(new Error("template is required"));
      if (
        typeof HTMLImageElement !== "undefined" &&
        srcOrImg instanceof HTMLImageElement
      ) {
        if (srcOrImg.complete && srcOrImg.naturalWidth > 0) {
          resolve(srcOrImg);
        } else {
          srcOrImg.onload = () => resolve(srcOrImg);
          srcOrImg.onerror = reject;
        }
        return;
      }
      const img = new Image();
      // Only set crossOrigin for external URLs, not local files
      if (srcOrImg.startsWith("http://") || srcOrImg.startsWith("https://")) {
        img.crossOrigin = "anonymous";
      }
      img.decoding = "async";
      img.loading = "eager";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = srcOrImg;
    });
  }

  async function waitForFonts(familyList) {
    // Only works if document.fonts is supported and families are on the page.
    if (
      typeof document === "undefined" ||
      !document.fonts ||
      !document.fonts.load
    )
      return;
    const samples = [
      `400 14px ${familyList}`,
      `700 14px ${familyList}`,
      `800 14px ${familyList}`,
    ];
    try {
      await Promise.all(samples.map((s) => document.fonts.load(s)));
      await document.fonts.ready;
    } catch (_) {
      /* ignore */
    }
  }

  // Data helpers: fetch JSON and resolve device fields from local databases
  async function loadJSON(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load " + url);
    return await res.json();
  }

  async function resolveDeviceFields(lookup, custom) {
    const code = String(lookup?.codename || "").toLowerCase();
    const devicesUrl = lookup?.devicesUrl || "data/devices.json";
    const deviceDbUrl = lookup?.deviceDbUrl || "data/device_db.json";

    // Create cache key including custom fields
    const cacheKey = JSON.stringify({ code, devicesUrl, deviceDbUrl, custom });
    if (cache.deviceFields.has(cacheKey)) {
      return cache.deviceFields.get(cacheKey);
    }

    const out = {
      deviceName: null,
      codename: code || null,
      maintainer: null,
      manufacturer: null,
      isOfficial: false, // Track if device is found in JSON data
    };

    let db = null,
      devices = null;
    try {
      db = await loadJSON(deviceDbUrl);
    } catch (_) {}
    try {
      devices = await loadJSON(devicesUrl);
    } catch (_) {}

    // Prefer device_db overrides (includes aliases)
    if (db && db.overrides && code) {
      let entry = db.overrides[code];
      if (!entry) {
        for (const k in db.overrides) {
          const o = db.overrides[k];
          const aliases = Array.isArray(o?.aliases)
            ? o.aliases.map((a) => String(a).toLowerCase())
            : [];
          if (aliases.includes(code)) {
            entry = o;
            break;
          }
        }
      }
      if (entry) {
        out.deviceName = entry.model ?? out.deviceName;
        out.manufacturer = entry.oem ?? out.manufacturer;
        out.maintainer = entry.maintainer ?? out.maintainer;
        out.codename = entry.codename ?? out.codename;
        out.isOfficial = true; // Found in device_db.json
      }
    }

    // Fallback to data/devices.json
    if (devices && Array.isArray(devices.devices) && code) {
      const match = devices.devices.find(
        (it) => String(it?.name || it?.filename || "").toLowerCase() === code,
      );
      const r = match?.data?.response;
      if (r) {
        out.deviceName = r.device ?? out.deviceName; // model name in feed
        out.manufacturer = r.oem ?? out.manufacturer; // OEM/manufacturer
        out.maintainer = r.maintainer ?? out.maintainer; // maintainer
        if (!out.isOfficial) out.isOfficial = true; // Found in devices.json
      }
    }

    // Custom field overrides from caller
    if (custom && typeof custom === "object") {
      if (custom.deviceName != null) out.deviceName = custom.deviceName;
      if (custom.manufacturer != null) out.manufacturer = custom.manufacturer;
      if (custom.maintainer != null) out.maintainer = custom.maintainer;
      if (custom.codename != null) out.codename = custom.codename;
      if (custom.isOfficial != null) out.isOfficial = custom.isOfficial;
    }

    // Cache the result
    cache.deviceFields.set(cacheKey, out);
    return out;
  }

  function drawRoundedRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawFrame(ctx, rect, opts) {
    // Shadow
    if (opts.shadow && opts.shadow.blur > 0) {
      ctx.save();
      ctx.shadowColor = opts.shadow.color;
      ctx.shadowBlur = opts.shadow.blur;
      ctx.shadowOffsetX = opts.shadow.x;
      ctx.shadowOffsetY = opts.shadow.y;
      drawRoundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, opts.radius);
      ctx.fillStyle = opts.fill;
      ctx.fill();
      ctx.restore();
    } else {
      drawRoundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, opts.radius);
      ctx.fillStyle = opts.fill;
      ctx.fill();
    }

    // Border
    if (opts.border && opts.border.width > 0) {
      ctx.save();
      ctx.lineWidth = opts.border.width;
      ctx.strokeStyle = opts.border.color;
      drawRoundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, opts.radius);
      ctx.stroke();
      ctx.restore();
    }
  }

  function setFont(ctx, sizePx, weight, family) {
    ctx.font = `${weight} ${Math.round(sizePx)}px ${family}`;
  }

  function drawText(
    ctx,
    text,
    x,
    y,
    color,
    align = "left",
    baseline = "alphabetic",
    shadow = null,
  ) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
      ctx.shadowColor = shadow.color || "rgba(0,0,0,0.5)";
      ctx.shadowBlur = shadow.blur || 0;
      ctx.shadowOffsetX = shadow.x || 0;
      ctx.shadowOffsetY = shadow.y || 0;
    }
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * Draw text with custom letter spacing
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} text - Text to draw
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} letterSpacing - Letter spacing as percentage of font size (0-1)
   * @param {number} fontSize - Font size in pixels
   */
  function fillTextWithSpacing(
    ctx,
    text,
    x,
    y,
    letterSpacing = 0,
    fontSize = 0,
  ) {
    if (!letterSpacing || letterSpacing === 0 || !fontSize) {
      ctx.fillText(text, x, y);
      return;
    }

    const chars = Array.from(text);
    let currentX = x;
    const spacingPx = fontSize * letterSpacing;

    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], currentX, y);
      const charWidth = ctx.measureText(chars[i]).width;
      currentX += charWidth + spacingPx;
    }
  }

  /**
   * Measure text width with custom letter spacing
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} text - Text to measure
   * @param {number} letterSpacing - Letter spacing as percentage of font size (0-1)
   * @param {number} fontSize - Font size in pixels
   * @returns {number} Total width including letter spacing
   */
  function measureTextWithSpacing(ctx, text, letterSpacing = 0, fontSize = 0) {
    if (!letterSpacing || letterSpacing === 0 || !fontSize) {
      return ctx.measureText(text).width;
    }

    const chars = Array.from(text);
    let totalWidth = 0;
    const spacingPx = fontSize * letterSpacing;

    for (let i = 0; i < chars.length; i++) {
      totalWidth += ctx.measureText(chars[i]).width;
      if (i < chars.length - 1) {
        totalWidth += spacingPx;
      }
    }

    return totalWidth;
  }

  function breakLines(
    ctx,
    text,
    maxWidth,
    maxLines = 2,
    letterSpacing = 0,
    fontSize = 0,
  ) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let current = "";

    const push = (s) => {
      lines.push(s.trim());
      current = "";
    };

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const test = current ? current + " " + word : word;
      if (
        measureTextWithSpacing(ctx, test, letterSpacing, fontSize) <= maxWidth
      ) {
        current = test;
      } else {
        if (current) push(current);
        // If single word is too long, break hard
        if (
          measureTextWithSpacing(ctx, word, letterSpacing, fontSize) > maxWidth
        ) {
          let w = "";
          for (const ch of word) {
            const test2 = w + ch;
            if (
              measureTextWithSpacing(ctx, test2, letterSpacing, fontSize) >
                maxWidth &&
              w
            ) {
              push(w);
              w = ch;
            } else {
              w = test2;
            }
          }
          current = w;
        } else {
          current = word;
        }
      }
      if (lines.length === maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);

    // If overflowed, clamp the last line with ellipsis
    if (lines.length > maxLines) {
      lines.length = maxLines;
    }
    if (lines.length === maxLines) {
      const last = lines[maxLines - 1];
      const ell = "…";
      if (
        measureTextWithSpacing(ctx, last, letterSpacing, fontSize) > maxWidth
      ) {
        let trimmed = last;
        while (
          trimmed.length > 1 &&
          measureTextWithSpacing(ctx, trimmed + ell, letterSpacing, fontSize) >
            maxWidth
        ) {
          trimmed = trimmed.slice(0, -1);
        }
        lines[maxLines - 1] = trimmed + ell;
      }
    }
    return lines;
  }

  function fitTitleLines(
    ctx,
    text,
    areaWidth,
    startSize,
    maxSize,
    minSize,
    family,
    weight,
  ) {
    let size = Math.min(maxSize, Math.max(minSize, startSize));
    for (; size >= minSize; size -= 2) {
      setFont(ctx, size, weight, family);
      const lines = breakLines(ctx, text, areaWidth, 2);
      const maxLineWidth = Math.max(
        ...lines.map((l) => ctx.measureText(l).width),
        0,
      );
      if (maxLineWidth <= areaWidth) {
        return { size, lines };
      }
    }
    setFont(ctx, minSize, weight, family);
    return { size: minSize, lines: breakLines(ctx, text, areaWidth, 2) };
  }

  function drawPill(ctx, label, x, y, opts) {
    const {
      fontSize,
      fontWeight,
      family,
      padX = 20,
      padY = 10,
      radius = 999,
      fill = "rgba(255,255,255,0.2)",
      color = "#fff",
      shadow = null,
    } = opts;

    setFont(ctx, fontSize, fontWeight, family);
    const textW = ctx.measureText(label).width;
    const w = Math.round(textW + padX * 2);
    const h = Math.round(fontSize + padY * 2);

    ctx.save();
    if (shadow) {
      ctx.shadowColor = shadow.color || "rgba(0,0,0,0.35)";
      ctx.shadowBlur = shadow.blur || 0;
      ctx.shadowOffsetX = shadow.x || 0;
      ctx.shadowOffsetY = shadow.y || 0;
    }
    drawRoundedRectPath(ctx, x, y, w, h, Math.min(radius, h / 2));
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();

    drawText(ctx, label, x + w / 2, y + h / 2 + 0.2, color, "center", "middle");
    return { width: w, height: h };
  }

  function drawDebug(ctx, rect) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,255,0,0.5)";
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  // Core generator
  async function generate(userOptions = {}) {
    const opts = mergeDeep(defaultOpts, userOptions || {});

    // Auto-populate fields from local JSONs when a codename is provided,
    // with optional custom field overrides.
    if (
      userOptions &&
      (userOptions.codename ||
        (userOptions.lookup && userOptions.lookup.codename))
    ) {
      try {
        const fields = await resolveDeviceFields(
          {
            ...(userOptions.lookup || {}),
            codename: userOptions.codename || userOptions.lookup.codename,
          },
          userOptions.customFields || null,
        );
        if (fields) {
          // For fields populated from database, prioritize: user explicit > detected from DB > defaults
          // Use strict undefined checks to ensure DB values take priority over defaults
          if (userOptions.deviceName !== undefined) {
            opts.deviceName = userOptions.deviceName;
          } else if (
            fields.deviceName !== undefined &&
            fields.deviceName !== null
          ) {
            opts.deviceName = fields.deviceName;
          }

          if (userOptions.codename !== undefined) {
            opts.codename = userOptions.codename;
          } else if (
            fields.codename !== undefined &&
            fields.codename !== null
          ) {
            opts.codename = fields.codename;
          }

          if (userOptions.maintainer !== undefined) {
            opts.maintainer = userOptions.maintainer;
          } else if (
            fields.maintainer !== undefined &&
            fields.maintainer !== null
          ) {
            opts.maintainer = fields.maintainer;
          }

          if (userOptions.manufacturer !== undefined) {
            opts.manufacturer = userOptions.manufacturer;
          } else if (
            fields.manufacturer !== undefined &&
            fields.manufacturer !== null
          ) {
            opts.manufacturer = fields.manufacturer;
          }

          // For isOfficial, prioritize: explicit user value > detected from fields > false
          if (userOptions.isOfficial !== undefined) {
            opts.isOfficial = userOptions.isOfficial;
          } else if (fields.isOfficial !== undefined) {
            opts.isOfficial = fields.isOfficial;
          }
          // else keep the merged value from opts (default: false)
        }
      } catch (_) {
        /* ignore populate errors */
      }
    }

    if (!opts.template) {
      throw new Error('Please provide a "template" (URL or HTMLImageElement)');
    }

    await waitForFonts(opts.fonts.family);
    const img = await loadImage(opts.template);
    const { canvas, ctx } = createCanvas(opts.width, opts.height, opts.dpr);

    // Draw template as full-bleed background
    ctx.save();
    // Disable image smoothing to preserve original image format exactly
    ctx.imageSmoothingEnabled = false;

    const cw = opts.width,
      ch = opts.height;

    // If image dimensions match canvas exactly, draw at 1:1 to preserve original quality
    if (img.width === cw && img.height === ch) {
      ctx.drawImage(img, 0, 0);
    } else {
      // Cover strategy: scale image to cover canvas while preserving aspect
      const ir = img.width / img.height;
      const cr = cw / ch;
      let dw, dh, dx, dy;
      if (ir > cr) {
        // image is wider than canvas: height matches canvas, width overflows
        dh = ch;
        dw = dh * ir;
        dx = (cw - dw) / 2;
        dy = 0;
      } else {
        // image is taller or equal: width matches canvas, height overflows
        dw = cw;
        dh = dw / ir;
        dx = 0;
        dy = (ch - dh) / 2;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
    }
    ctx.restore();

    // Compute frame rect
    const insetX = opts.frame.insetX;
    const insetY = opts.frame.insetY;
    const frameW = Math.round(
      (opts.width - insetX * 2) * opts.frame.widthRatio,
    );
    const frameH = Math.round(opts.height - insetY * 2);
    const frameX = insetX;
    const frameY = insetY;
    const frameRect = { x: frameX, y: frameY, w: frameW, h: frameH };

    // Draw translucent frame - REMOVED (not needed as skeleton already has the frame)
    // drawFrame(ctx, frameRect, opts.frame);
    if (opts.debug) drawDebug(ctx, frameRect);

    // Internal padding box for text in frame
    const pad = opts.paddings;
    const textX = frameRect.x + pad.left;
    let cursorY = frameRect.y + pad.top;

    // Establish dynamic sizes
    const H = opts.height;
    const fontHeaderSize = Math.max(
      14,
      Math.round(H * opts.fonts.headerSizeRatio),
    );
    const fontDeviceStart = Math.round(H * opts.fonts.deviceMaxSizeRatio);
    const fontDeviceMax = Math.round(H * opts.fonts.deviceMaxSizeRatio);
    const fontDeviceMin = Math.max(28, Math.round(fontDeviceMax * 0.55));
    const fontSmall = Math.max(14, Math.round(H * opts.fonts.smallSizeRatio));
    const fontBrand = Math.max(18, Math.round(H * opts.fonts.brandSizeRatio));

    // Device name - fixed positioning and styling with wrapping within max width
    const MAX_TEXT_WIDTH = 924;
    const deviceX = 131;
    const deviceY = 205;
    const deviceFontSize = 128;
    const deviceLineHeight = 1.0; // 100%
    const deviceColor = "#E0DFEC";

    // Set up device name text styling
    ctx.font = `400 ${deviceFontSize}px ${opts.fonts.family}`;
    ctx.fillStyle = deviceColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    // Wrap device name to MAX_TEXT_WIDTH
    const deviceText = String(opts.deviceName || "");
    const deviceLetterSpacing = opts.fonts.deviceLetterSpacing || 0;
    const deviceLines = breakLines(
      ctx,
      deviceText,
      MAX_TEXT_WIDTH,
      3,
      deviceLetterSpacing,
      deviceFontSize,
    );
    let currentY = deviceY;
    for (let i = 0; i < deviceLines.length; i++) {
      fillTextWithSpacing(
        ctx,
        deviceLines[i],
        deviceX,
        currentY,
        deviceLetterSpacing,
        deviceFontSize,
      );
      currentY += deviceFontSize * deviceLineHeight;
    }

    // Bottom content baseline inside frame
    const bottomY = frameRect.y + frameRect.h - pad.bottom;

    // Brand at bottom-left - REMOVED (already in skeleton)
    // setFont(ctx, fontBrand, opts.fonts.brandWeight, opts.fonts.family);
    // drawText(
    //   ctx,
    //   opts.brand,
    //   textX,
    //   bottomY,
    //   opts.colors.textPrimary,
    //   "left",
    //   "alphabetic",
    //   { color: "rgba(0,0,0,0.50)", blur: 2, x: 0, y: 2 },
    // );

    // Maintainer text - fixed positioning and styling (removed "Maintained by" label)
    const maintainerX = 317.5;
    const maintainerY = 783;
    const maintainerFontSize = 27.6;
    const maintainerColor = opts.colors.textPrimary;

    // Maintainer name only (clamped to max width)
    ctx.font = `600 ${maintainerFontSize}px ${opts.fonts.family}`;
    ctx.fillStyle = maintainerColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    {
      const maintText = String(opts.maintainer || "");
      const maintLines = breakLines(ctx, maintText, MAX_TEXT_WIDTH, 1);
      ctx.fillText(maintLines[0] || "", maintainerX, maintainerY);
    }

    // OEM Info pills - fixed positioning and styling
    const pillsX = 131;
    const pillsY = 837.4;
    const pillFontSize = 27.6;
    const pillPadX = 32.2;
    const pillPadTop = 16;
    const pillPadBottom = 4;
    const manufacturerColor = "#55555E";
    const codenameColor = "#3C3960";
    const pillTextColor = "#FFFFFF";
    const pillGap = 33; // gap between pills

    // Manufacturer pill
    const manufacturerText = String(opts.manufacturer || "");
    ctx.font = `600 ${pillFontSize}px ${opts.fonts.family}`;
    const manufacturerTextWidth = ctx.measureText(manufacturerText).width;
    const manufacturerPillWidth = manufacturerTextWidth + pillPadX * 2;
    const manufacturerPillHeight = pillFontSize + pillPadTop + pillPadBottom;

    // Draw manufacturer pill background
    ctx.fillStyle = manufacturerColor;
    drawRoundedRectPath(
      ctx,
      pillsX,
      pillsY,
      manufacturerPillWidth,
      manufacturerPillHeight,
      Math.min(999, manufacturerPillHeight / 2),
    );
    ctx.fill();

    // Draw manufacturer pill text
    ctx.fillStyle = pillTextColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      manufacturerText,
      pillsX + manufacturerPillWidth / 2,
      pillsY + manufacturerPillHeight / 2,
    );

    // Codename pill
    const codenameText = String(opts.codename || "");
    ctx.font = `600 ${pillFontSize}px ${opts.fonts.family}`;
    const codenameTextWidth = ctx.measureText(codenameText).width;
    const codenamePillWidth = codenameTextWidth + pillPadX * 2;
    const codenamePillHeight = pillFontSize + pillPadTop + pillPadBottom;
    const codenamePillX = pillsX + manufacturerPillWidth + pillGap;

    // Draw codename pill background
    ctx.fillStyle = codenameColor;
    drawRoundedRectPath(
      ctx,
      codenamePillX,
      pillsY,
      codenamePillWidth,
      codenamePillHeight,
      Math.min(999, codenamePillHeight / 2),
    );
    ctx.fill();

    // Draw codename pill text
    ctx.fillStyle = pillTextColor;
    ctx.fillText(
      codenameText,
      codenamePillX + codenamePillWidth / 2,
      pillsY + codenamePillHeight / 2,
    );

    // Official/Unofficial pill
    const statusText = opts.isOfficial ? "Official" : "Unofficial";
    const statusColor = opts.isOfficial ? "#2D6B3F" : "#6B2D2D"; // Green for official, red for unofficial
    ctx.font = `600 ${pillFontSize}px ${opts.fonts.family}`;
    const statusTextWidth = ctx.measureText(statusText).width;
    const statusPillWidth = statusTextWidth + pillPadX * 2;
    const statusPillHeight = pillFontSize + pillPadTop + pillPadBottom;
    const statusPillX = codenamePillX + codenamePillWidth + pillGap;

    // Draw status pill background
    ctx.fillStyle = statusColor;
    drawRoundedRectPath(
      ctx,
      statusPillX,
      pillsY,
      statusPillWidth,
      statusPillHeight,
      Math.min(999, statusPillHeight / 2),
    );
    ctx.fill();

    // Draw status pill text
    ctx.fillStyle = pillTextColor;
    ctx.fillText(
      statusText,
      statusPillX + statusPillWidth / 2,
      pillsY + statusPillHeight / 2,
    );

    if (opts.debug) {
      // Guide for text area used by header + device name
      drawDebug(ctx, {
        x: textX,
        y: frameRect.y + pad.top,
        w: MAX_TEXT_WIDTH,
        h: cursorY - (frameRect.y + pad.top),
      });
    }

    // Export as PNG to preserve original colors exactly (no lossy compression)
    const dataURL = canvas.toDataURL("image/png");
    const blob = await dataURLtoBlob(dataURL);

    return { canvas, blob, dataURL };
  }

  async function dataURLtoBlob(dataURL) {
    // Use Fetch to convert data URL to Blob (works broadly)
    const res = await fetch(dataURL);
    return await res.blob();
  }

  async function download(blob, filename = "banner.png") {
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return {
    // Main API
    generate,
    download,

    // Helper: check whether a codename exists in local JSON sources
    async isOfficialCodename(codename, devicesUrl = "data/devices.json", deviceDbUrl = "data/device_db.json") {
      try {
        const fields = await resolveDeviceFields({ codename, devicesUrl, deviceDbUrl }, null);
        return !!(fields && fields.isOfficial);
      } catch (_) {
        return false;
      }
    },

    // Convenience: one-shot helper
    async generateAndDownload(options, filename = "banner.png") {
      const out = await generate(options);
      await download(out.blob, filename);
      return out;
    },
  };
});
