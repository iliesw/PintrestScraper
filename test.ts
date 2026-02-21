// import { PinterestScraper } from "./scrape";

import retrievePins from "./scrapelite";

// const scraper = new PinterestScraper({
//   headless: true,
//   scrollCount: 0,   // more scrolls = more pins
//   delay: 0,
// });
// console.time("init")
// await scraper.init();
// console.timeEnd("init")

// console.time("search")
// const pins = await scraper.searchPins("ads illustration poster");
// console.timeEnd("search")

// console.log(pins);
// await scraper.close();


console.time("search")
const pins = await retrievePins("ads illustration poster")
console.timeEnd("search")
console.log(pins)