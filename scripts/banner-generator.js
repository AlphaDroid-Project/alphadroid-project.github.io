/**
 * Banner Generator - overlays a text skeleton on top of a background template and exports a JPEG.
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
 *   await BannerGenerator.download(out.blob, 'alphadroid-banner.jpg');
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
    quality: 1.0, // JPEG quality (0..1) - 100% quality
    dpr: Math.max(
      1,
      (typeof window !== "undefined" && window.devicePixelRatio) || 1,
    ),

    // Content
    deviceName: "Device Name\nHere", // you can use \n to force break
    maintainer: "Maintainer",
    manufacturer: "Manufacturer",
    codename: "Device Codename",
    brand: "AlphaDroid",

    // Frame (left panel) styling (over the template)
    frame: {
      // Insets from canvas edges
      insetX: 40, // overall horizontal margin
      insetY: 28, // overall vertical margin
      widthRatio: 0.58, // width of the left frame as portion of canvas width
      radius: 28,
      fill: "rgba(0,0,0,0.40)", // translucent dark overlay
      blur: 0, // set to >0 for subtle blur (requires filter on ctx draw)
      border: { color: "rgba(255,255,255,0.06)", width: 1 },
      shadow: { x: 0, y: 10, blur: 30, color: "rgba(0,0,0,0.35)" },
    },

    // Typography (choose families that exist in your page)
    fonts: {
      // Families should be loaded via CSS. We’ll wait for them if document.fonts exists.
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
      if (srcOrImg.startsWith('http://') || srcOrImg.startsWith('https://')) {
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

  function breakLines(ctx, text, maxWidth, maxLines = 2) {
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
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) push(current);
        // If single word is too long, break hard
        if (ctx.measureText(word).width > maxWidth) {
          let w = "";
          for (const ch of word) {
            const test2 = w + ch;
            if (ctx.measureText(test2).width > maxWidth && w) {
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
      if (ctx.measureText(last).width > maxWidth) {
        let trimmed = last;
        while (
          trimmed.length > 1 &&
          ctx.measureText(trimmed + ell).width > maxWidth
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
    if (!opts.template) {
      throw new Error('Please provide a "template" (URL or HTMLImageElement)');
    }

    await waitForFonts(opts.fonts.family);
    const img = await loadImage(opts.template);
    const { canvas, ctx } = createCanvas(opts.width, opts.height, opts.dpr);

    // Draw template as full-bleed background
    ctx.save();
    // Cover strategy: scale image to cover canvas while preserving aspect
    const cw = opts.width,
      ch = opts.height;
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

    // Device name - fixed positioning and styling with proper line breaks
    const deviceX = 131;
    const deviceY = 214;
    const deviceWidth = 924;
    const deviceFontSize = 128;
    const deviceLineHeight = 1.0; // 100%
    const deviceLetterSpacing = -0.04; // -4%
    const deviceColor = "#E0DFEC";

    // Set up device name text styling
    ctx.font = `400 ${deviceFontSize}px ${opts.fonts.family}`;
    ctx.fillStyle = deviceColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    
    // Handle line breaks in device name
    const deviceText = String(opts.deviceName || "");
    const lines = deviceText.split('\n');
    let currentY = deviceY;
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const words = line.split(/\s+/);
      let currentX = deviceX;
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        ctx.fillText(word, currentX, currentY);
        const wordWidth = ctx.measureText(word).width;
        currentX += wordWidth + (deviceFontSize * deviceLetterSpacing);
        
        // Add space between words (except for last word)
        if (i < words.length - 1) {
          const spaceWidth = ctx.measureText(' ').width;
          currentX += spaceWidth + (deviceFontSize * deviceLetterSpacing);
        }
      }
      
      // Move to next line
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
    const maintainerY = 782;
    const maintainerFontSize = 27.6;
    const maintainerColor = opts.colors.textPrimary;

    // Maintainer name only
    ctx.font = `600 ${maintainerFontSize}px ${opts.fonts.family}`;
    ctx.fillStyle = maintainerColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(opts.maintainer || "", maintainerX, maintainerY);

    // OEM Info pills - fixed positioning and styling
    const pillsX = 131;
    const pillsY = 837.4;
    const pillFontSize = 27.6;
    const pillPadX = 32.2;
    const pillPadY = 13.8;
    const manufacturerColor = "#55555E";
    const codenameColor = "#3C3960";
    const pillTextColor = "#FFFFFF";
    const pillGap = 14; // gap between pills

    // Manufacturer pill
    const manufacturerText = String(opts.manufacturer || "");
    ctx.font = `600 ${pillFontSize}px ${opts.fonts.family}`;
    const manufacturerTextWidth = ctx.measureText(manufacturerText).width;
    const manufacturerPillWidth = manufacturerTextWidth + (pillPadX * 2);
    const manufacturerPillHeight = pillFontSize + (pillPadY * 2);

    // Draw manufacturer pill background
    ctx.fillStyle = manufacturerColor;
    drawRoundedRectPath(ctx, pillsX, pillsY, manufacturerPillWidth, manufacturerPillHeight, Math.min(999, manufacturerPillHeight / 2));
    ctx.fill();

    // Draw manufacturer pill text
    ctx.fillStyle = pillTextColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(manufacturerText, pillsX + manufacturerPillWidth / 2, pillsY + manufacturerPillHeight / 2);

    // Codename pill
    const codenameText = String(opts.codename || "");
    ctx.font = `600 ${pillFontSize}px ${opts.fonts.family}`;
    const codenameTextWidth = ctx.measureText(codenameText).width;
    const codenamePillWidth = codenameTextWidth + (pillPadX * 2);
    const codenamePillHeight = pillFontSize + (pillPadY * 2);
    const codenamePillX = pillsX + manufacturerPillWidth + pillGap;

    // Draw codename pill background
    ctx.fillStyle = codenameColor;
    drawRoundedRectPath(ctx, codenamePillX, pillsY, codenamePillWidth, codenamePillHeight, Math.min(999, codenamePillHeight / 2));
    ctx.fill();

    // Draw codename pill text
    ctx.fillStyle = pillTextColor;
    ctx.fillText(codenameText, codenamePillX + codenamePillWidth / 2, pillsY + codenamePillHeight / 2);

    if (opts.debug) {
      // Guide for text area used by header + device name
      drawDebug(ctx, {
        x: textX,
        y: frameRect.y + pad.top,
        w: maxDeviceWidth,
        h: cursorY - (frameRect.y + pad.top),
      });
    }

    // Export
    const dataURL = canvas.toDataURL("image/jpeg", opts.quality);
    const blob = await dataURLtoBlob(dataURL);

    return { canvas, blob, dataURL };
  }

  async function dataURLtoBlob(dataURL) {
    // Use Fetch to convert data URL to Blob (works broadly)
    const res = await fetch(dataURL);
    return await res.blob();
  }

  async function download(blob, filename = "banner.jpg") {
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

    // Convenience: one-shot helper
    async generateAndDownload(options, filename = "banner.jpg") {
      const out = await generate(options);
      await download(out.blob, filename);
      return out;
    },
  };
});
