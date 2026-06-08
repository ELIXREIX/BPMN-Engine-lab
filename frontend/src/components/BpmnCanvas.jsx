import { useEffect, useRef, useState } from 'react';
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';

const MARKER_CSS = `
.monitor-active .djs-visual > :nth-child(1) {
  stroke: #16a34a !important;
  stroke-width: 3px !important;
  fill: #dcfce7 !important;
}
.monitor-active .djs-visual {
  animation: monitorPulse 1.4s ease-in-out infinite;
}
@keyframes monitorPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
.bpmn-pick .djs-element { cursor: pointer; }
.pick-active .djs-visual > :nth-child(1) {
  stroke-width: 4px !important;
}
`;

function Overlay({ color, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 14 }}>
      {children}
    </div>
  );
}

// Read-only BPMN diagram with optional live highlight + click-to-select.
// highlightIds: green pulse markers (monitor). pickId: flow-color "selected" outline.
export default function BpmnCanvas({ file, color, highlightIds = [], pickId = null, onElementClick }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const markedRef = useRef([]);
  const pickedRef = useRef(null);
  const clickRef = useRef(onElementClick);
  clickRef.current = onElementClick;

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      setReady(false);
      try {
        const xml = await fetch(file).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        });
        if (viewerRef.current) viewerRef.current.destroy();
        const viewer = new BpmnViewer({ container: containerRef.current });
        viewerRef.current = viewer;
        markedRef.current = [];
        pickedRef.current = null;
        await viewer.importXML(xml);
        if (cancelled) return;
        viewer.get('canvas').zoom('fit-viewport', 'auto');
        const reg = viewer.get('elementRegistry');
        reg.forEach(el => {
          if (el.type === 'bpmn:UserTask' || el.type === 'bpmn:ServiceTask') {
            const gfx = reg.getGraphics(el);
            const rect = gfx?.querySelector('.djs-visual rect');
            if (rect) rect.style.stroke = color;
          }
        });
        viewer.get('eventBus').on('element.click', e => {
          const id = e.element?.id;
          if (id && clickRef.current) clickRef.current(id);
        });
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (containerRef.current) load();
    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      setReady(false);
    };
  }, [file, color]);

  // green live-monitor markers
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!ready || !viewer) return;
    const canvas = viewer.get('canvas');
    const reg = viewer.get('elementRegistry');
    markedRef.current.forEach(id => { try { canvas.removeMarker(id, 'monitor-active'); } catch { /* gone */ } });
    markedRef.current = [];
    highlightIds.forEach(id => {
      if (reg.get(id)) { try { canvas.addMarker(id, 'monitor-active'); markedRef.current.push(id); } catch { /* skip */ } }
    });
  }, [ready, highlightIds]);

  // flow-color "selected" outline for form-edit picking
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!ready || !viewer) return;
    const canvas = viewer.get('canvas');
    const reg = viewer.get('elementRegistry');
    if (pickedRef.current) { try { canvas.removeMarker(pickedRef.current, 'pick-active'); } catch { /* gone */ } }
    pickedRef.current = null;
    if (pickId && reg.get(pickId)) {
      try { canvas.addMarker(pickId, 'pick-active'); pickedRef.current = pickId; } catch { /* skip */ }
    }
  }, [ready, pickId]);

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <style>{MARKER_CSS}</style>
      {loading && <Overlay color="#94a3b8">Loading diagram...</Overlay>}
      {error && <Overlay color="#ef4444">Error: {error}</Overlay>}
      <div ref={containerRef} className={onElementClick ? 'bpmn-pick' : undefined} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
