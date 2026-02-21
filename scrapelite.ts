import googlethis from "googlethis";
export default async function retrievePins(q?: string) {
  const query: string = `${q}    site:"pinterest.com"`;
  const pins: any[] = [];
  const V2 = await googlethis.image(query);
  for (const response of V2) {
    pins.push({
      title: response.origin.title,
      image: (response.url).replace("236x","1200x"),
      url: response.origin.website.url,
    });
  }
  return pins;
}