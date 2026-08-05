function parseRefRangeText(text: string) {
  if (!text) return { min: null, max: null };
  const str = text.toString().toLowerCase().replace(/,/g, '');
  let match = str.match(/<\s*([\d.]+)/);
  if (match) return { min: null, max: parseFloat(match[1]) };
  match = str.match(/>\s*([\d.]+)/);
  if (match) return { min: parseFloat(match[1]), max: null };
  match = str.match(/up to\s*([\d.]+)/);
  if (match) return { min: null, max: parseFloat(match[1]) };
  match = str.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (match) return { min: parseFloat(match[1]), max: parseFloat(match[2]) };
  match = str.match(/([\d.]+)\s*to\s*([\d.]+)/);
  if (match) return { min: parseFloat(match[1]), max: parseFloat(match[2]) };
  return { min: null, max: null };
}

let refRangeText = "6 to 14.8";
const parsed = parseRefRangeText(refRangeText);
console.log(parsed);
