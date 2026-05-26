import * as cheerio from "cheerio";

export type Scraped = {
  title: string;
  image_url: string | null;
  price_amount: number | null;
  price_currency: string | null;
  vendor: string | null;
  category: string;
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  books: ["book", "novel", "paperback", "hardcover", "kindle", "audiobook"],
  tech: ["headphone", "laptop", "keyboard", "mouse", "monitor", "ssd", "gpu", "phone", "tablet", "camera", "speaker", "earbud", "console"],
  home: ["lamp", "chair", "sofa", "rug", "vase", "candle", "kitchen", "cookware", "pillow", "blanket", "decor", "furniture", "shelf"],
  clothing: ["shirt", "pants", "jacket", "coat", "dress", "shoe", "sneaker", "hoodie", "sweater", "jeans", "hat", "cap"],
  beauty: ["perfume", "cologne", "skincare", "serum", "lipstick", "fragrance", "makeup"],
  games: ["game", "playstation", "xbox", "switch", "steam", "boardgame", "lego"],
  food: ["chocolate", "coffee", "tea", "wine", "snack", "gourmet"],
  outdoor: ["bike", "tent", "hike", "ski", "camping", "backpack"],
};

function inferCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return cat;
  }
  return "other";
}

function attr($: cheerio.CheerioAPI, sel: string): string | null {
  const el = $(sel).first();
  if (!el.length) return null;
  return el.attr("content") || el.attr("value") || null;
}

function parsePrice(raw: string | null | undefined): { amount: number | null; currency: string | null } {
  if (!raw) return { amount: null, currency: null };
  const s = String(raw).trim();
  // ISO currency code prefix/suffix or symbol
  const currencyMatch =
    s.match(/\b(USD|EUR|GBP|NOK|SEK|DKK|JPY|CHF|CAD|AUD)\b/i) ||
    (s.includes("$") ? [null, "USD"] : null) ||
    (s.includes("€") ? [null, "EUR"] : null) ||
    (s.includes("£") ? [null, "GBP"] : null) ||
    (s.includes("kr") ? [null, "NOK"] : null) ||
    (s.includes("¥") ? [null, "JPY"] : null);

  // Strip everything that isn't digit/decimal separator; pick the longest numeric run
  const numMatch = s.match(/(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!numMatch) return { amount: null, currency: currencyMatch ? currencyMatch[1] : null };

  let numStr = numMatch[0].replace(/\s/g, "");
  // Heuristic: if both . and , present, the last one is decimal
  if (numStr.includes(",") && numStr.includes(".")) {
    if (numStr.lastIndexOf(",") > numStr.lastIndexOf(".")) {
      numStr = numStr.replace(/\./g, "").replace(",", ".");
    } else {
      numStr = numStr.replace(/,/g, "");
    }
  } else if (numStr.includes(",")) {
    // Single comma: treat as decimal if followed by 1-2 digits, else thousands
    if (/,\d{1,2}$/.test(numStr)) numStr = numStr.replace(",", ".");
    else numStr = numStr.replace(/,/g, "");
  }
  const amount = parseFloat(numStr);
  return {
    amount: Number.isFinite(amount) ? amount : null,
    currency: currencyMatch ? (currencyMatch[1] as string).toUpperCase() : null,
  };
}

function fromJsonLd($: cheerio.CheerioAPI): Partial<Scraped> {
  const out: Partial<Scraped> = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).contents().text();
    if (!txt) return;
    try {
      const parsed = JSON.parse(txt);
      const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] || [parsed];
      for (const node of nodes) {
        const type = node?.["@type"];
        const typeStr = Array.isArray(type) ? type.join(",") : String(type || "");
        if (typeStr.toLowerCase().includes("product")) {
          if (!out.title && node.name) out.title = String(node.name);
          if (!out.image_url) {
            const img = node.image;
            out.image_url = Array.isArray(img) ? img[0] : typeof img === "string" ? img : img?.url || null;
          }
          if (!out.vendor && node.brand) {
            out.vendor = typeof node.brand === "string" ? node.brand : node.brand.name || null;
          }
          const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
          if (offers) {
            const priceStr = offers.price ?? offers.lowPrice ?? offers.highPrice;
            const cur = offers.priceCurrency;
            if (priceStr && out.price_amount == null) {
              const { amount } = parsePrice(String(priceStr));
              if (amount != null) out.price_amount = amount;
            }
            if (cur && !out.price_currency) out.price_currency = String(cur);
          }
        }
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  });
  return out;
}

export async function scrapeProduct(url: string): Promise<Scraped> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        // Pretend to be a regular browser so most sites serve full HTML
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      // 8s ceiling — Vercel will kill us otherwise
      signal: AbortSignal.timeout(8000),
    });
    html = await res.text();
  } catch (e) {
    throw new Error(`Couldn't reach that URL: ${(e as Error).message}`);
  }

  const $ = cheerio.load(html);
  const host = new URL(url).hostname.replace(/^www\./, "");

  // JSON-LD product takes priority (cleanest data)
  const ld = fromJsonLd($);

  const title =
    ld.title ||
    attr($, 'meta[property="og:title"]') ||
    attr($, 'meta[name="twitter:title"]') ||
    $("title").first().text().trim() ||
    "Untitled item";

  const image_url =
    ld.image_url ||
    attr($, 'meta[property="og:image:secure_url"]') ||
    attr($, 'meta[property="og:image"]') ||
    attr($, 'meta[name="twitter:image"]') ||
    attr($, 'link[rel="image_src"]');

  const ogPrice =
    attr($, 'meta[property="product:price:amount"]') ||
    attr($, 'meta[property="og:price:amount"]') ||
    attr($, 'meta[itemprop="price"]') ||
    attr($, 'meta[name="twitter:data1"]');
  const ogCurrency =
    attr($, 'meta[property="product:price:currency"]') ||
    attr($, 'meta[property="og:price:currency"]') ||
    attr($, 'meta[itemprop="priceCurrency"]');

  let price_amount = ld.price_amount ?? null;
  let price_currency = ld.price_currency ?? null;
  if (price_amount == null) {
    const p = parsePrice(ogPrice);
    price_amount = p.amount;
    price_currency = price_currency || p.currency || ogCurrency;
  }
  if (!price_currency && ogCurrency) price_currency = ogCurrency;

  const vendor =
    ld.vendor ||
    attr($, 'meta[property="og:site_name"]') ||
    host;

  const category = inferCategory(`${title} ${vendor || ""}`);

  // Resolve relative image URLs
  let finalImage = image_url;
  if (finalImage && !/^https?:/i.test(finalImage)) {
    try {
      finalImage = new URL(finalImage, url).toString();
    } catch {
      finalImage = null;
    }
  }

  return {
    title: title.replace(/\s+/g, " ").trim().slice(0, 300),
    image_url: finalImage,
    price_amount,
    price_currency: price_currency ? price_currency.toUpperCase() : null,
    vendor: vendor ? vendor.slice(0, 80) : null,
    category,
  };
}
