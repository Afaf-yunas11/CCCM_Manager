import React, { useEffect, useRef, useState } from 'react';
import { inputStyle, btnStyle } from './ui';
import { polygonAreaM2, polygonCentroid } from '../../utils/geo';

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

export default function MapPicker({ value, onChange, polygon = [], onPolygonChange }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const poly = useRef(null);
  const line = useRef(null);
  const cornerMarkers = useRef([]);
  const provider = useRef('');
  const drawingRef = useRef(false);
  const callbacks = useRef({});
  callbacks.current = { onChange, onPolygonChange };
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [manual, setManual] = useState({ lat: '', lng: '' });

  function getPolygonPoints() {
    if (provider.current === 'google') {
      return poly.current?.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() })) || [];
    }
    if (provider.current === 'leaflet') {
      return (poly.current?.getLatLngs()[0] || []).map((point) => ({ lat: point.lat, lng: point.lng }));
    }
    return [];
  }

  function syncPolygon() {
    const points = getPolygonPoints();
    if (provider.current === 'google') {
      line.current?.setPath(points);
      cornerMarkers.current.forEach((corner) => corner.setMap(null));
      cornerMarkers.current = points.map((point) => new window.google.maps.Marker({
        map: map.current,
        position: point,
        clickable: false,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeColor: '#2563eb',
          strokeWeight: 2,
        },
      }));
    } else if (provider.current === 'leaflet') {
      line.current?.setLatLngs(points.map((point) => [point.lat, point.lng]));
      cornerMarkers.current.forEach((corner) => map.current.removeLayer(corner));
      cornerMarkers.current = points.map((point) => window.L.circleMarker([point.lat, point.lng], {
        radius: 5,
        color: '#2563eb',
        weight: 2,
        fillColor: '#ffffff',
        fillOpacity: 1,
      }).addTo(map.current));
    }
    callbacks.current.onPolygonChange?.(points);
  }

  function placeGoogle(lat, lng, name = '') {
    map.current.panTo({ lat, lng });
    if (map.current.getZoom() < 12) map.current.setZoom(14);
    if (!marker.current) {
      marker.current = new window.google.maps.Marker({
        map: map.current,
        position: { lat, lng },
        draggable: true,
      });
      marker.current.addListener('dragend', (event) => place(event.latLng.lat(), event.latLng.lng()));
    } else {
      marker.current.setPosition({ lat, lng });
    }
    callbacks.current.onChange({ lat, lng, name });
    if (!name) {
      new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          callbacks.current.onChange({ lat, lng, name: results[0].formatted_address });
        } else {
          reversePlace(lat, lng).then((resolvedName) => {
            if (resolvedName) callbacks.current.onChange({ lat, lng, name: resolvedName });
          });
        }
      });
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
    callbacks.current.onChange({ lat, lng, name });
  }

  function place(lat, lng, name = '') {
    if (provider.current === 'google') return placeGoogle(lat, lng, name);
    if (provider.current === 'leaflet') {
      placeLeaflet(lat, lng, name);
      if (!name) {
        reversePlace(lat, lng).then((resolvedName) => {
          if (resolvedName) callbacks.current.onChange({ lat, lng, name: resolvedName });
        });
      }
    }
  }

  function initGoogleMaps() {
    const google = window.google.maps;
    provider.current = 'google';
    map.current = new google.Map(box.current, {
      center: value ? { lat: value.lat, lng: value.lng } : { lat: 30.3753, lng: 69.3451 },
      zoom: value ? 14 : 5,
      streetViewControl: false,
    });
    poly.current = new google.Polygon({
      map: map.current,
      paths: [],
      editable: true,
      clickable: false,
      strokeColor: '#2563eb',
      strokeWeight: 2,
      fillColor: '#2563eb',
      fillOpacity: 0.2,
    });
    line.current = new google.Polyline({
      map: map.current,
      path: polygon,
      strokeColor: '#2563eb',
      strokeWeight: 2,
      clickable: false,
    });
    if (polygon.length) poly.current.setPath(polygon);
    const path = poly.current.getPath();
    ['insert_at', 'set_at', 'remove_at'].forEach((eventName) => {
      google.event.addListener(path, eventName, syncPolygon);
    });
    map.current.addListener('click', (event) => {
      if (drawingRef.current) path.push(event.latLng);
      else place(event.latLng.lat(), event.latLng.lng());
    });
    if (value) placeGoogle(value.lat, value.lng, value.name);
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
      poly.current = window.L.polygon([], {
        color: '#2563eb',
        fillColor: '#2563eb',
        fillOpacity: 0.2,
      }).addTo(map.current);
      line.current = window.L.polyline(polygon.map((point) => [point.lat, point.lng]), {
        color: '#2563eb',
        weight: 2,
      }).addTo(map.current);
      if (polygon.length) poly.current.setLatLngs(polygon.map((point) => [point.lat, point.lng]));
      map.current.on('click', (event) => {
        if (drawingRef.current) {
          const points = poly.current.getLatLngs()[0] || [];
          points.push(event.latlng);
          poly.current.setLatLngs(points);
          syncPolygon();
        } else {
          place(event.latlng.lat, event.latlng.lng);
        }
      });
      if (value) placeLeaflet(value.lat, value.lng, value.name);
      setError(GOOGLE_KEY ? 'Google Maps unavailable. OpenStreetMap fallback is active.' : '');
    });
  }

  useEffect(() => {
    let active = true;
    if (GOOGLE_KEY) {
      loadGoogleMaps()
        .then(() => {
          if (active) initGoogleMaps();
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
      cornerMarkers.current.forEach((corner) => {
        if (provider.current === 'google') corner.setMap(null);
        else map.current?.removeLayer(corner);
      });
      if (provider.current === 'google') {
        line.current?.setMap(null);
        poly.current?.setMap(null);
      }
      map.current = null;
      marker.current = null;
      poly.current = null;
      line.current = null;
      cornerMarkers.current = [];
      provider.current = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDraw() {
    if (!map.current || !poly.current) return setError('Wait for the map to finish loading.');
    if (!drawing) {
      setError('');
      drawingRef.current = true;
      setDrawing(true);
      return;
    }
    const points = getPolygonPoints();
    if (points.length < 3) return setError('Click at least 3 corners of the site, then press Finish.');
    drawingRef.current = false;
    setDrawing(false);
    const center = polygonCentroid(points);
    place(center.lat, center.lng);
  }

  function undo() {
    if (provider.current === 'google') poly.current?.getPath().pop();
    else if (provider.current === 'leaflet') {
      const points = poly.current?.getLatLngs()[0] || [];
      points.pop();
      poly.current?.setLatLngs(points);
      syncPolygon();
    }
  }

  function clearPolygon() {
    if (provider.current === 'google') poly.current?.getPath().clear();
    else if (provider.current === 'leaflet') {
      poly.current?.setLatLngs([]);
      syncPolygon();
    }
    drawingRef.current = false;
    setDrawing(false);
  }

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
    callbacks.current.onChange({ lat, lng, name: '' });
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
      <div ref={box} style={{ height: 340, borderRadius: 8, border: '1px solid #cbd5e1', background: '#e2e8f0' }} />
      <div style={{ display: 'flex', gap: 8, margin: '8px 0 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" style={btnStyle(drawing)} onClick={toggleDraw}>{drawing ? 'Finish boundary' : 'Draw site boundary'}</button>
        {drawing && <button type="button" style={btnStyle(false)} onClick={undo}>Undo last corner</button>}
        {polygon.length > 0 && <button type="button" style={btnStyle(false)} onClick={clearPolygon}>Clear boundary</button>}
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {drawing
            ? 'Click each corner of the site on the map.'
            : polygon.length >= 3
              ? `Boundary: ${polygon.length} corners, ${polygonAreaM2(polygon).toLocaleString()} m².`
              : 'Click the map to place the pin, or draw the site boundary to measure the area.'}
        </span>
      </div>
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
