import { PinterestScraper } from "./scrape";

const scraper = new PinterestScraper({
  headless: true,
  scrollCount: 0,   // more scrolls = more pins
  delay: 0,
});

await scraper.init();

console.time("search")
const pins = await scraper.searchPins("ads illustration poster");
console.timeEnd("search")

console.log(pins);
await scraper.close();