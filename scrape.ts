import puppeteer, { Browser, Page } from "puppeteer";

export interface Pin {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  link: string;
  pinterestUrl: string;
  board?: string;
  repins?: number;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  pinCount: number;
  url: string;
  coverImage: string;
}

export interface UserProfile {
  username: string;
  fullName: string;
  bio: string;
  followers: string;
  following: string;
  monthlyViews: string;
  boards: Board[];
}

export interface ScraperOptions {
  headless?: boolean;
  scrollCount?: number; // how many times to scroll for more results
  delay?: number; // ms between scrolls
}

const DEFAULT_OPTIONS: ScraperOptions = {
  headless: true,
  scrollCount: 3,
  delay: 2000,
};

export class PinterestScraper {
  private browser: Browser | null = null;
  private options: ScraperOptions;

  constructor(options: ScraperOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async init(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ],
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async newPage(): Promise<Page> {
    if (!this.browser)
      throw new Error("Browser not initialized. Call init() first.");
    const page = await this.browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1280, height: 800 });
    // Block images/fonts to speed up scraping
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["font", "stylesheet"].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
    return page;
  }

  private async scroll(page: Page): Promise<void> {
    for (let i = 0; i < (this.options.scrollCount ?? 3); i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise((r) => setTimeout(r, this.options.delay ?? 2000));
    }
  }

  /**
   * Search Pinterest by keyword and return pins
   */
  async searchPins(query: string): Promise<Pin[]> {
    const page = await this.newPage();
    const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await this.scroll(page);

      const pins = await page.evaluate(() => {
        const pinElements = document.querySelectorAll('[data-test-id="pin"]');
        const results: any[] = [];

        pinElements.forEach((el: { querySelector: (arg0: string) => any }) => {
          const imgEl = el.querySelector("img");
          const linkEl = el.querySelector("a");
          const href = linkEl?.getAttribute("href") ?? "";
          const pinId = href.match(/\/pin\/(\d+)/)?.[1] ?? "";

          if (!pinId) return;

          results.push(
            (
              imgEl?.getAttribute("src") ??
              imgEl?.getAttribute("data-src") ??
              ""
            ).replace("236x", "1200x"),
          );
        });

        return results;
      });

      return pins.filter(e=>e!="");
    } finally {
      await page.close();
    }
  }

  /**
   * Get all pins from a board URL
   * e.g. https://www.pinterest.com/username/boardname/
   */
  async getBoardPins(boardUrl: string): Promise<Pin[]> {
    const page = await this.newPage();

    try {
      await page.goto(boardUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await this.scroll(page);

      const pins = await page.evaluate(() => {
        const pinElements = document.querySelectorAll('[data-test-id="pin"]');
        const results: any[] = [];

        pinElements.forEach((el: { querySelector: (arg0: string) => any }) => {
          const imgEl = el.querySelector("img");
          const linkEl = el.querySelector("a");
          const titleEl =
            el.querySelector('[data-test-id="pinTitle"]') ||
            el.querySelector("h3");

          const href = linkEl?.getAttribute("href") ?? "";
          const pinId = href.match(/\/pin\/(\d+)/)?.[1] ?? "";

          if (!pinId) return;

          results.push({
            id: pinId,
            title: titleEl?.textContent?.trim() ?? "",
            description: "",
            imageUrl: imgEl?.getAttribute("src") ?? "",
            link: "",
            pinterestUrl: `https://www.pinterest.com${href}`,
          });
        });

        return results;
      });

      return pins;
    } finally {
      await page.close();
    }
  }

  /**
   * Get details of a single pin
   */
  async getPinDetails(pinUrl: string): Promise<Pin | null> {
    const page = await this.newPage();

    try {
      await page.goto(pinUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2000));

      const pin = await page.evaluate((url) => {
        const imgEl =
          document.querySelector('[data-test-id="pin-closeup-image"] img') ||
          document.querySelector("img[srcset]");
        const titleEl =
          document.querySelector('[data-test-id="pinTitle"]') ||
          document.querySelector("h1");
        const descEl = document.querySelector(
          '[data-test-id="pin-closeup-description"]',
        );
        const linkEl = document.querySelector(
          '[data-test-id="pin-closeup-link"] a',
        );
        const repinsEl = document.querySelector('[data-test-id="save-count"]');

        const pinId = url.match(/\/pin\/(\d+)/)?.[1] ?? "";

        return {
          id: pinId,
          title: titleEl?.textContent?.trim() ?? "",
          description: descEl?.textContent?.trim() ?? "",
          imageUrl: imgEl?.getAttribute("src") ?? "",
          link: linkEl?.getAttribute("href") ?? "",
          pinterestUrl: url,
          repins:
            parseInt(repinsEl?.textContent?.replace(/\D/g, "") ?? "0") || 0,
        };
      }, pinUrl);

      return pin.id ? pin : null;
    } finally {
      await page.close();
    }
  }

  /**
   * Get user profile info and their boards
   */
  async getUserProfile(username: string): Promise<UserProfile | null> {
    const page = await this.newPage();
    const url = `https://www.pinterest.com/${username}/`;

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2000));
      await this.scroll(page);

      const profile = await page.evaluate((uname) => {
        const nameEl =
          document.querySelector('[data-test-id="profile-name"]') ||
          document.querySelector("h1");
        const bioEl = document.querySelector(
          '[data-test-id="profile-description"]',
        );
        const statsEls = document.querySelectorAll(
          '[data-test-id="profile-follower-count"], [data-test-id="profile-following-count"]',
        );
        const monthlyEl = document.querySelector(
          '[data-test-id="monthly-views"]',
        );

        const boardEls = document.querySelectorAll(
          '[data-test-id="board-row"]',
        );
        const boards: any[] = [];

        boardEls.forEach((el: { querySelector: (arg0: string) => any }) => {
          const nameEl =
            el.querySelector('[data-test-id="board-name"]') ||
            el.querySelector("h2");
          const linkEl = el.querySelector("a");
          const imgEl = el.querySelector("img");
          const countEl = el.querySelector('[data-test-id="board-pin-count"]');

          boards.push({
            id: linkEl?.getAttribute("href")?.split("/")[2] ?? "",
            name: nameEl?.textContent?.trim() ?? "",
            description: "",
            pinCount:
              parseInt(countEl?.textContent?.replace(/\D/g, "") ?? "0") || 0,
            url: `https://www.pinterest.com${linkEl?.getAttribute("href") ?? ""}`,
            coverImage: imgEl?.getAttribute("src") ?? "",
          });
        });

        return {
          username: uname,
          fullName: nameEl?.textContent?.trim() ?? "",
          bio: bioEl?.textContent?.trim() ?? "",
          followers: statsEls[0]?.textContent?.trim() ?? "",
          following: statsEls[1]?.textContent?.trim() ?? "",
          monthlyViews: monthlyEl?.textContent?.trim() ?? "",
          boards,
        };
      }, username);

      return profile;
    } finally {
      await page.close();
    }
  }
}
