import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import type { DeliveryLocation } from '../shared/domain';
import 'leaflet/dist/leaflet.css';

export function DeliveryMap({ value, onChange, onSelectionChange }: { value?: DeliveryLocation; onChange: (point?: DeliveryLocation) => void; onSelectionChange: (selected: boolean) => void }) {
  const [selected, setSelected] = useState(!!value);
  const selectedRef = useRef(!!value);
  const [draft, setDraft] = useState<DeliveryLocation | undefined>(value);
  const draftRef = useRef(value);
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const change = useRef(onChange); change.current = onChange;
  const selection = useRef(onSelectionChange); selection.current = onSelectionChange;
  const gpsAttempt = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const pick = useRef<(point: DeliveryLocation, fromGps?: boolean) => void>(() => {});
  useEffect(() => {
    selection.current(selectedRef.current);
    if (!container.current) return;
    let disposed = false; let marker: Leaflet.Marker | null = null;
    void import('leaflet').then(L => {
      if (disposed || !container.current) return;
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView(value ? [value.latitude, value.longitude] : [-3.7383, -43.3536], value ? 17 : 14);
      map.current = instance;
      const icon = L.divIcon({ className: 'delivery-pin', html: '<span aria-hidden="true">●</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
      pick.current = (point, fromGps = false) => {
        if (!fromGps) { gpsAttempt.current++; setWaiting(false); }
        const wrapped = L.latLng(point.latitude, point.longitude).wrap();
        point = { latitude: wrapped.lat, longitude: wrapped.lng };
        draftRef.current = point; setDraft(point);
        change.current(selectedRef.current ? point : undefined);
        if (marker) marker.setLatLng([point.latitude, point.longitude]);
        else {
          marker = L.marker([point.latitude, point.longitude], { draggable: true, icon, title: 'Ponto de entrega: arraste para ajustar' }).addTo(instance);
          marker.on('dragend', () => { const p = marker!.getLatLng(); pick.current({ latitude: p.lat, longitude: p.lng }); });
        }
      };
      instance.on('click', e => pick.current({ latitude: e.latlng.lat, longitude: e.latlng.lng }));
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      }).on('tileerror', () => { if (!disposed) setError('O mapa não carregou completamente. Você pode continuar usando o endereço escrito.'); }).addTo(instance);
      if (value) pick.current(value);
      setReady(true);
    }).catch(() => { if (!disposed) setError('Não foi possível abrir o mapa. Continue com o endereço escrito.'); });
    return () => { disposed = true; gpsAttempt.current++; map.current?.remove(); map.current = null; pick.current = () => {}; };
  }, []);

  function toggle(checked: boolean) {
    gpsAttempt.current++;
    selectedRef.current = checked; setSelected(checked); selection.current(checked);
    setError(''); setNotice(''); setWaiting(false);
    if (!checked) { change.current(undefined); return; }
    if (draftRef.current) { change.current(draftRef.current); return; }
    if (!navigator.geolocation) { setError('GPS indisponível. Marque o local de entrega no mapa ou desmarque a caixa para continuar sem localização.'); return; }
    setWaiting(true);
    const attempt = gpsAttempt.current;
    navigator.geolocation.getCurrentPosition(position => {
      if (!map.current || !selectedRef.current || gpsAttempt.current !== attempt) return;
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      pick.current(point, true); map.current.setView([point.latitude, point.longitude], 17); setWaiting(false);
      setNotice(`GPS aproximado (precisão de ${Math.round(position.coords.accuracy)} m). Ajuste o marcador se necessário.`);
    }, () => {
      if (!map.current || !selectedRef.current || gpsAttempt.current !== attempt) return;
      setWaiting(false); setError('Não foi possível obter o GPS. Marque o local no mapa ou desmarque a caixa para concluir sem localização.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  return <section className="delivery-location" aria-label="Localização de entrega opcional">
    <h3>Marque seu local de entrega</h3>
    <p>Clique no mapa ou arraste o marcador até o local correto. Marque <strong>Usar minha localização</strong> para incluir o ponto no pedido; desmarque para não enviá-lo. Rua e número continuam obrigatórios.</p>
    <div ref={container} className="delivery-map" tabIndex={0} aria-label="Mapa: use as setas para mover e o botão para marcar o centro"/>
    <label className="location-checkbox"><input type="checkbox" checked={selected} disabled={!ready && !selected} onChange={e => toggle(e.target.checked)}/><span>Usar minha localização</span></label>
    <p className="hint">Se ainda não marcou um ponto, selecionar a caixa solicita a permissão do GPS. O mapa é fornecido pelo OpenStreetMap.</p>
    <button type="button" className="outline-button" disabled={!ready} onClick={() => { const center = map.current?.getCenter(); if (center) pick.current({ latitude: center.lat, longitude: center.lng }); }}>Marcar centro do mapa</button>
    {waiting && <p className="hint" role="status">Buscando sua localização… Você também pode marcar o ponto manualmente.</p>}
    {notice && <p className="hint" role="status">{notice}</p>}
    {draft && <p className="hint">Ponto marcado: {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}</p>}
    <p className="map-confirmed" role="status">{selected ? value ? 'Este ponto será incluído ao concluir o pedido.' : 'Marque um ponto ou aguarde o GPS. A caixa também pode ser desmarcada.' : 'A localização não será enviada. O pedido seguirá com o endereço escrito.'}</p>
    {error && <p className="warning" role="status">{error}</p>}
  </section>;
}
