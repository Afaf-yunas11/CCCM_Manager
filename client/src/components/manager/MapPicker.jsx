import React, { useEffect, useRef, useState } from 'react';
import { inputStyle, btnStyle } from './ui';

const configuredKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_KEY = configuredKey && !/^your[-_]/i.test(configuredKey) ? configuredKey : '';

let googleLoader;
function loadGoogleMaps() {
  if (!GOOGLE_KEY) return Promise.reject(new Error('Google Maps is not configured.'));
  if (window.google?.maps) return Promise.resolve();
  if (!googleLoader) {
    googleLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps could not load.'));
      document.head.appendChild(script);
    });
  }
  return googleLoader;
}

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.dataset.leaflet = 'true';
      document.head.appendChild(css);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('OpenStreetMap could not load.'));
    document.head.appendChild(script);
  });
}

async function searchPlace(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en&countrycodes=pk&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Place search failed.');
  const results = await response.json();
  if (!results.length) throw new Error('Place not found. Try a more specific name.');
  return { lat: Number(results[0].lat), lng: Number(results[0].lon), name: results[0].display_name };
}

async function reversePlace(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&accept-language=en&lat=${lat}&lon=${lng}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return '';
    const result = await response.json();
    return result.display_name || '';
  } catch {
    return '';
  }
}

export default function MapPicker({ value, onChange }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const provider = useRef('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState({ lat: '', lng: '' });

  function placeGoogle(lat, lng, name = '') {
    map.current.panTo({ lat, lng });
    if (map.current.getZoom() < 12) map.current.setZoom(14);
    if (!marker.current) {
      marker.current = new window.google.maps.Marker({
        map: map.current,
        position: { lat, lng },
        draggable: true,
      });
      marker.current.addListener('dragend', (event) =>
        place(event.latLng.lat(), event.latLng.lng())
      );
    } else {
      marker.current.setPosition({ lat, lng });
    }
    onChange({ lat, lng, name });
    if (!name) {
      new window.google.maps.Geocoder().geocode(
        { location: { lat, lng } },
        (results, status) => {
          if (status === 'OK' && results[0]) onChange({ lat, lng, name: results[0].formatted_address });
          else {
            reversePlace(lat, lng).then((resolvedName) => {
              if (resolvedName) onChange({ lat, lng, name: resolvedName });
            });
          }
        }
      );
    }
  }

  function placeLeaflet(lat, lng, name = '') {
    map.current.setView([lat, lng], 14);
    if (!marker.current) {
      marker.current = window.L.marker([lat, lng], { draggable: true }).addTo(map.current);
      marker.current.on('dragend', (event) => {
        const point = event.target.getLatLng();
        place(point.lat, point.lng);
      });
    } else {
      marker.current.setLatLng([lat, lng]);
    }
    onChange({ lat, lng, name });
  }

  function place(lat, lng, name = '') {
    if (provider.current === 'google') return placeGoogle(lat, lng, name);
    if (provider.current === 'leaflet') {
      placeLeaflet(lat, lng, name);
      if (!name) {
        reversePlace(lat, lng).then((resolvedName) => {
          if (resolvedName) onChange({ lat, lng, name: resolvedName });
        });
      }
    }
  }

  function initLeaflet() {
    return loadLeaflet().then(() => {
      provider.current = 'leaflet';
      map.current = window.L.map(box.current).setView(
        value ? [value.lat, value.lng] : [30.3753, 69.3451],
        value ? 14 : 5
      );
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map.current);
      map.current.on('click', (event) => place(event.latlng.lat, event.latlng.lng));
      if (value) placeLeaflet(value.lat, value.lng, value.name);
      setError(GOOGLE_KEY ? 'Google Maps unavailable. OpenStreetMap fallback is active.' : '');
    });
  }

  useEffect(() => {
    let active = true;
    if (GOOGLE_KEY) {
      loadGoogleMaps()
        .then(() => {
          if (!active) return;
          provider.current = 'google';
          map.current = new window.google.maps.Map(box.current, {
            center: value ? { lat: value.lat, lng: value.lng } : { lat: 30.3753, lng: 69.3451 },
            zoom: value ? 14 : 5,
            streetViewControl: false,
          });
          map.current.addListener('click', (event) => place(event.latLng.lat(), event.latLng.lng()));
          if (value) placeGoogle(value.lat, value.lng, value.name);
        })
        .catch(() => {
          if (active) initLeaflet().catch((leafletError) => setError(leafletError.message));
        });
    } else {
      initLeaflet().catch((leafletError) => setError(leafletError.message));
    }

    return () => {
      active = false;
      if (provider.current === 'leaflet' && map.current) map.current.remove();
      map.current = null;
      marker.current = null;
      provider.current = '';
    };
    // eslint-disable-next-line react-hooks.exhaustive-deps
  }, []);

  async function search() {
    if (!query.trim()) return;
    setError('');
    try {
      if (provider.current === 'google') {
        new window.google.maps.Geocoder().geocode({ address: `${query}, Pakistan` }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            place(location.lat(), location.lng(), results[0].formatted_address);
          } else {
            searchPlace(query)
              .then((found) => {
                place(found.lat, found.lng, found.name);
                setError('Google place search unavailable; location found with OpenStreetMap.');
              })
              .catch((searchError) => setError(searchError.message));
          }
        });
      } else {
        const found = await searchPlace(query);
        place(found.lat, found.lng, found.name);
      }
    } catch (searchError) {
      setError(searchError.message);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError('Location is not supported by this browser.');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setError('');
        place(position.coords.latitude, position.coords.longitude);
      },
      () => setError('Could not get your location. Allow location access or enter coordinates.')
    );
  }

  function applyManual() {
    const lat = Number(manual.lat);
    const lng = Number(manual.lng);
    if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) || manual.lat === '' || manual.lng === '') {
      return setError('Enter a valid latitude and longitude.');
    }
    setError('');
    place(lat, lng);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
          placeholder="Search a place, e.g. Peshawar"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), search())}
        />
        <button type="button" style={btnStyle()} onClick={search}>Search</button>
        <button type="button" style={btnStyle(false)} onClick={useMyLocation}>Use my location</button>
      </div>
      <div ref={box} style={{ height: 320, borderRadius: 8, border: '1px solid #cbd5e1', background: '#e2e8f0' }} />
      <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0' }}>Click the map or drag the pin to the exact site.</p>

      <div style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: 12, marginTop: 8 }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b' }}>Or enter coordinates directly:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, width: 150 }} placeholder="Latitude" value={manual.lat} onChange={(event) => setManual({ ...manual, lat: event.target.value })} />
          <input style={{ ...inputStyle, width: 150 }} placeholder="Longitude" value={manual.lng} onChange={(event) => setManual({ ...manual, lng: event.target.value })} />
          <button type="button" style={btnStyle(false)} onClick={applyManual}>Set location</button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: '#92400e', fontSize: 13, margin: '6px 0 0' }}>{error}</p>}
      {value && (
        <p style={{ fontSize: 13, margin: '8px 0 0' }}>
          <strong>Selected:</strong> {value.name || 'Pinned location'} ({value.lat.toFixed(5)}, {value.lng.toFixed(5)})
        </p>
      )}
    </div>
  );
}
