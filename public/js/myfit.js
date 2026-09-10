// MyFit: reusable measurement profiles (e.g. "Me", "Mum", "Kwame") stored
// locally in the browser. No account system yet, so profiles live on this
// device only — a real build would sync these to a customer account.
const MYFIT_KEY = 'atadee_myfit_profiles';

// General body measurements a profile can hold. Garment-specific fields
// (lengths, wrist, ankle, inseam, etc.) still get entered per order, since
// they depend on the specific garment rather than the body.
const MYFIT_FIELDS = [
  { key: 'chest', label: 'Chest / Bust (in)' },
  { key: 'waist', label: 'Waist (in)' },
  { key: 'hip', label: 'Hip (in)' },
  { key: 'shoulder', label: 'Shoulder (in)' },
  { key: 'neck', label: 'Neck (in)' },
  { key: 'sleeve', label: 'Sleeve length (in)' },
  { key: 'height', label: 'Height (in)' }
];

function getMyFitProfiles() {
  try { return JSON.parse(localStorage.getItem(MYFIT_KEY) || '[]'); } catch { return []; }
}

function saveMyFitProfiles(list) {
  localStorage.setItem(MYFIT_KEY, JSON.stringify(list));
}

function upsertMyFitProfile(profile) {
  const list = getMyFitProfiles();
  const idx = list.findIndex(p => p.id === profile.id);
  if (idx >= 0) list[idx] = profile; else list.push(profile);
  saveMyFitProfiles(list);
  return list;
}

function deleteMyFitProfile(id) {
  const list = getMyFitProfiles().filter(p => p.id !== id);
  saveMyFitProfiles(list);
  return list;
}

// Map a MyFit body profile onto whichever fields the current garment
// actually asks for (garment field keys like 'bust' vs 'chest' both read
// from the same profile.chest slot — they're the same body measurement).
function applyMyFitToGarment(profile, garmentFields) {
  const alias = { bust: 'chest' };
  const result = {};
  garmentFields.forEach(f => {
    const sourceKey = alias[f.key] || f.key;
    if (profile[sourceKey] !== undefined && profile[sourceKey] !== null && profile[sourceKey] !== '') {
      result[f.key] = profile[sourceKey];
    }
  });
  return result;
}
