renderNav('map');

let map, markersLayer;
let userLocation = null;
let allDesigners = [];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const AVAILABILITY_LABELS = { accepting: 'Accepting orders', limited: 'Limited availability', booked: 'Fully booked' };

function initMap() {
  map = L.map('map-canvas').setView([7.9465, -1.0232], 6.4); // centered on Ghana
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

function renderMarkers() {
  markersLayer.clearLayers();
  const category = document.getElementById('f-category').value;
  const availability = document.getElementById('f-availability').value;
  const radius = document.getElementById('f-radius').value;

  let list = allDesigners.filter(d => d.latitude && d.longitude);
  if (category) list = list.filter(d => d.category === category);
  if (availability) list = list.filter(d => d.availability === availability);
  if (userLocation && radius) {
    list = list.filter(d => haversine(userLocation.lat, userLocation.lng, d.latitude, d.longitude) <= Number(radius));
  }

  list.forEach(d => {
    const dotColor = d.availability === 'accepting' ? '#1F4D3D' : d.availability === 'limited' ? '#C9A24B' : '#C77B4D';
    const icon = L.divIcon({
      className: '', html: `<div style="width:16px;height:16px;border-radius:50%;background:${dotColor};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8]
    });
    const marker = L.marker([d.latitude, d.longitude], { icon }).addTo(markersLayer);
    marker.bindPopup(`
      <div style="font-family:'Work Sans',sans-serif; min-width:180px;">
        <strong style="font-family:'Fraunces',serif;">${d.name}</strong><br>
        <span style="font-size:.82rem; color:#7A7364;">${d.category} · ${d.location}</span><br>
        <span style="font-size:.82rem;">★ ${d.rating} · ${AVAILABILITY_LABELS[d.availability]}</span><br>
        <a href="/designer.html?id=${d.id}" style="font-size:.82rem; color:#1F4D3D; font-weight:600;">View profile →</a>
      </div>
    `);
  });

  document.getElementById('map-note').textContent = `Showing ${list.length} designer${list.length === 1 ? '' : 's'}${userLocation && radius ? ' within ' + radius + ' km' : ''}.`;
}

async function load() {
  if (typeof L === 'undefined') {
    document.getElementById('map-canvas').innerHTML = `<div class="empty-state" style="padding:80px 20px;">Map couldn't load — check your internet connection and refresh. (This page loads map tiles from OpenStreetMap, which needs a live connection.)</div>`;
    return;
  }
  const [designers, categories] = await Promise.all([api('/api/designers'), api('/api/categories')]);
  allDesigners = designers;
  document.getElementById('f-category').innerHTML = `<option value="">All categories</option>` + categories.map(c => `<option value="${c}">${c}</option>`).join('');

  initMap();
  renderMarkers();

  document.getElementById('f-category').addEventListener('change', renderMarkers);
  document.getElementById('f-availability').addEventListener('change', renderMarkers);
  document.getElementById('f-radius').addEventListener('change', renderMarkers);

  document.getElementById('locate-btn').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Location isn\'t available in this browser'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        document.getElementById('f-radius').style.display = 'inline-block';
        map.setView([userLocation.lat, userLocation.lng], 11);
        L.marker([userLocation.lat, userLocation.lng], {
          icon: L.divIcon({ className: '', html: `<div style="width:14px;height:14px;border-radius:50%;background:#C9A24B;border:2px solid white;"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] })
        }).addTo(map).bindPopup('You are here');
        renderMarkers();
        toast('Location found');
      },
      () => toast('Could not get your location — showing all designers instead')
    );
  });
}

load().catch(err => { document.getElementById('map-note').textContent = err.message; });
