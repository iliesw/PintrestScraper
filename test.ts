import { PinterestScraper } from "./scrape";

const scraper = new PinterestScraper({
  headless: true,
  scrollCount: 1,   // more scrolls = more pins
  delay: 2000,
});

await scraper.init();

const pins = await scraper.searchPins("ads illustration poster");

console.log(pins);
await scraper.close();