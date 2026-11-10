import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import type { DeliveryLocation } from '../shared/domain';
import 'leaflet/dist/leaflet.css';

export function DeliveryMap({ value, onChange }: { value?: DeliveryLocation; onChange: (point?: DeliveryLocation) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [draft, setDraft] = useState<DeliveryLocation | undefined>(value);
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const change = useRef(onChange); change.current = onChange;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const pick = useRef<(point: DeliveryLocation, invalidate?: boolean) => void>(() => {});
  useEffect(() => {
    if (!enabled || !container.current) return;
    let disposed = false; let marker: Leaflet.Marker | null = null;
    void import('leaflet').then(L => {
      if (disposed || !container.current) return;
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView(value ? [value.latitude, value.longitude] : [-3.7383, -43.3536], value ? 17 : 14);
      map.current = instance;
      const icon = L.divIcon({ className: 'delivery-pin', html: '<span aria-hidden="true">●</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
      pick.current = (point, invalidate = true) => {
        if (invalidate) change.current(undefined);
        const wrapped = L.latLng(point.latitude, point.longitude).wrap();
        point = { latitude: wrapped.lat, longitude: wrapped.lng };
        setDraft(point);
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
      if (value) pick.current(value, false);
      setReady(true);
    }).catch(() => { if (!disposed) setError('Não foi possível abrir o mapa. Continue com o endereço escrito.'); });
    return () => { disposed = true; map.current?.remove(); map.current = null; pick.current = () => {}; };
  }, [enabled]);

  function locate() {
    if (!navigator.geolocation) { setError('Este navegador não oferece GPS. Marque o ponto manualmente no mapa.'); return; }
    setWaiting(true); setError(''); setNotice('');
    navigator.geolocation.getCurrentPosition(position => {
      if (!map.current) return;
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      pick.current(point); map.current.setView([point.latitude, point.longitude], 17); setWaiting(false);
      setNotice(`Localização aproximada (precisão de ${Math.round(position.coords.accuracy)} m). Confira o ponto antes de confirmar.`);
    }, () => {
      if (!map.current) return;
      setWaiting(false); setError('Não foi possível obter o GPS. Permita a localização no navegador ou marque o ponto manualmente.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  return <section className="delivery-location" aria-label="Localização de entrega opcional">
    <h3>Ponto de entrega no mapa <span>(opcional · teste)</span></h3>
    <p>Rua, número e referência continuam valendo. O mapa ajuda a encontrar o ponto exato; a loja confirma a área de entrega.</p>
    {!enabled ? <><p className="hint">Ao abrir, seu navegador acessa os mapas do OpenStreetMap. O GPS só será solicitado se você escolher usá-lo.</p><button type="button" className="outline-button" onClick={() => setEnabled(true)}>Abrir mapa opcional</button></> : <>
      <p>Clique no local de entrega ou arraste o marcador. Você também pode mover o mapa com o teclado e marcar o centro.</p>
      <div ref={container} className="delivery-map" tabIndex={0} aria-label="Mapa: use as setas para mover e os botões para marcar a entrega"/>
      <div className="map-actions"><button type="button" className="outline-button" disabled={!ready || waiting} onClick={locate}>{waiting ? 'Buscando localização…' : 'Usar minha localização'}</button><button type="button" className="outline-button" disabled={!ready} onClick={() => { const center = map.current?.getCenter(); if (center) pick.current({ latitude: center.lat, longitude: center.lng }); }}>Marcar centro do mapa</button></div>
      {notice && <p className="hint" role="status">{notice}</p>}
      {draft && <><p className="hint">Ponto marcado: {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}</p><button type="button" className="primary full" onClick={() => { onChange(draft); setNotice('Ponto de entrega confirmado. Confira também o endereço escrito.'); }}>Confirmar ponto de entrega</button></>}
    </>}
    {value && <p className="map-confirmed" role="status">Ponto incluído no pedido. <button type="button" className="text-button" onClick={() => { onChange(undefined); setNotice('Ponto removido. O pedido seguirá com o endereço escrito.'); }}>Remover localização do pedido</button></p>}
    {error && <p className="warning" role="status">{error}</p>}
  </section>;
}
