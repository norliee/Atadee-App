// Garment-specific measurement engine.
// Each garment only asks for the fields it needs, and sizes off one primary
// measurement (chest or hip) against a standard chart, matching the PDR's
// "your measurements correspond approximately to XL" behaviour.

const SHIRT_CHART = [
  { size: 'XS', min: 0, max: 34 },
  { size: 'S', min: 34, max: 37 },
  { size: 'M', min: 37, max: 40 },
  { size: 'L', min: 40, max: 42 },
  { size: 'XL', min: 42, max: 44 },
  { size: 'XXL', min: 44, max: 47 },
  { size: 'XXXL', min: 47, max: 999 }
];

const DRESS_CHART = [
  { size: 'XS', min: 0, max: 33 },
  { size: 'S', min: 33, max: 35 },
  { size: 'M', min: 35, max: 37 },
  { size: 'L', min: 37, max: 40 },
  { size: 'XL', min: 40, max: 43 },
  { size: 'XXL', min: 43, max: 46 },
  { size: 'XXXL', min: 46, max: 999 }
];

function chartLookup(chart, value) {
  const v = Number(value);
  if (!v || v <= 0) return null;
  const row = chart.find(r => v >= r.min && v < r.max) || chart[chart.length - 1];
  return { size: row.size, note: `${v}" falls in the ${row.size} range (${row.min}"–${row.max === 999 ? '46+' : row.max + '"'}).` };
}

// Plain-language "how to measure" guidance, shown under each field in guided
// measurement mode. Keyed by measurement field key, reused across garments.
const GUIDES = {
  neck: 'Wrap the tape around the base of your neck, where a shirt collar would sit. Keep it snug but not tight.',
  chest: 'Wrap the tape around the fullest part of your chest, under the arms and across the shoulder blades. Keep it level and comfortably loose — not pulled tight.',
  bust: 'Wrap the tape around the fullest part of your bust, keeping it level across your back. Don\u2019t pull it tight.',
  shoulder: 'Measure straight across your back from the edge of one shoulder to the other.',
  sleeve: 'With your arm slightly bent, measure from the shoulder edge down to the wrist bone.',
  wrist: 'Wrap the tape around your wrist bone, just loose enough to slide a finger under.',
  shirt_length: 'Measure from the base of the neck (back) straight down to where you want the shirt to end.',
  waist: 'Wrap the tape around your natural waist — the narrowest part, usually just above the belly button. Keep it comfortably loose.',
  jacket_length: 'Measure from the base of the neck (back) down to where you want the jacket to end, usually mid-seat.',
  trouser_waist: 'Wrap the tape where you\u2019ll actually wear your trousers, not necessarily your natural waist.',
  inseam: 'Measure from the crotch seam straight down the inside of the leg to the ankle bone.',
  garment_length: 'Measure from the shoulder straight down to where you want the garment to end.',
  ankle: 'Wrap the tape around your ankle, just above the ankle bone.',
  hip: 'Wrap the tape around the fullest part of your hips, roughly 8 inches below your waist.',
  dress_length: 'Measure from the shoulder straight down to where you want the hem to fall.',
  skirt_length: 'Measure from the waist straight down to where you want the skirt to end.',
  height: 'Measure standing straight, from the top of the head to the floor, without shoes.'
};

function withGuides(fields) {
  return fields.map(f => ({ ...f, guide: GUIDES[f.key] || 'Keep the tape level and measure over light clothing for the most accurate result.' }));
}

const GARMENTS = {
  mens_shirt: {
    label: "Men's Shirt",
    sizeField: 'chest',
    chart: SHIRT_CHART,
    fields: withGuides([
      { key: 'neck', label: 'Neck (in)' },
      { key: 'chest', label: 'Chest (in)' },
      { key: 'shoulder', label: 'Shoulder (in)' },
      { key: 'sleeve', label: 'Sleeve length (in)' },
      { key: 'wrist', label: 'Wrist (in)' },
      { key: 'shirt_length', label: 'Shirt length (in)' }
    ])
  },
  mens_suit: {
    label: "Men's Suit",
    sizeField: 'chest',
    chart: SHIRT_CHART,
    fields: withGuides([
      { key: 'chest', label: 'Chest (in)' },
      { key: 'shoulder', label: 'Shoulder (in)' },
      { key: 'waist', label: 'Waist (in)' },
      { key: 'sleeve', label: 'Sleeve length (in)' },
      { key: 'jacket_length', label: 'Jacket length (in)' },
      { key: 'trouser_waist', label: 'Trouser waist (in)' },
      { key: 'inseam', label: 'Inseam (in)' }
    ])
  },
  kaftan_agbada: {
    label: 'Kaftan / Agbada',
    sizeField: 'chest',
    chart: SHIRT_CHART,
    fields: withGuides([
      { key: 'chest', label: 'Chest (in)' },
      { key: 'shoulder', label: 'Shoulder (in)' },
      { key: 'sleeve', label: 'Sleeve length (in)' },
      { key: 'garment_length', label: 'Garment length (in)' },
      { key: 'trouser_waist', label: 'Trouser waist (in)' },
      { key: 'ankle', label: 'Ankle (in)' }
    ])
  },
  womens_dress: {
    label: "Women's Dress",
    sizeField: 'bust',
    chart: DRESS_CHART,
    fields: withGuides([
      { key: 'bust', label: 'Bust (in)' },
      { key: 'waist', label: 'Waist (in)' },
      { key: 'hip', label: 'Hip (in)' },
      { key: 'shoulder', label: 'Shoulder (in)' },
      { key: 'dress_length', label: 'Dress length (in)' }
    ])
  },
  kaba_slit: {
    label: 'Kaba & Slit',
    sizeField: 'bust',
    chart: DRESS_CHART,
    fields: withGuides([
      { key: 'bust', label: 'Bust (in)' },
      { key: 'waist', label: 'Waist (in)' },
      { key: 'hip', label: 'Hip (in)' },
      { key: 'shoulder', label: 'Shoulder (in)' },
      { key: 'skirt_length', label: 'Skirt length (in)' }
    ])
  },
  kids_outfit: {
    label: "Children's Outfit",
    sizeField: 'chest',
    chart: [
      { size: '2-3Y', min: 0, max: 21 },
      { size: '4-5Y', min: 21, max: 23 },
      { size: '6-7Y', min: 23, max: 25 },
      { size: '8-9Y', min: 25, max: 27 },
      { size: '10-11Y', min: 27, max: 29 },
      { size: '12-13Y', min: 29, max: 999 }
    ],
    fields: withGuides([
      { key: 'chest', label: 'Chest (in)' },
      { key: 'height', label: 'Height (in)' },
      { key: 'waist', label: 'Waist (in)' }
    ])
  }
};

function recommendSize(garmentType, measurements) {
  const garment = GARMENTS[garmentType];
  if (!garment || !measurements) return null;
  const value = measurements[garment.sizeField];
  const result = chartLookup(garment.chart, value);
  if (!result) return null;
  return { size: result.size, note: result.note, basedOn: garment.sizeField };
}

module.exports = { GARMENTS, recommendSize };
