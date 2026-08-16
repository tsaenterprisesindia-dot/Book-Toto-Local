import { useEffect, useState } from 'react';
import client from '../../api/client.js';

const FIELDS = [
  { key: 'base', label: 'Base fare (₹)' },
  { key: 'perKm', label: 'Per kilometre (₹)' },
  { key: 'perMin', label: 'Per minute (₹)' },
  { key: 'minimum', label: 'Minimum fare (₹)' },
  { key: 'avgSpeedKmh', label: 'Avg speed for ETA (km/h)' },
  { key: 'searchRadiusKm', label: 'Driver search radius (km)' },
  { key: 'surgeFloor', label: 'Surge floor (×)' },
  { key: 'surgeCeil', label: 'Surge ceiling (×)' },
  { key: 'gstRate', label: 'GST rate (%)', pct: true },
  { key: 'commissionRate', label: 'Platform commission (%)', pct: true },
  { key: 'cancellationFee', label: 'Cancellation fee (₹)' },
];

export default function AdminSettings() {
  const [form, setForm] = useState({});
  const [defaults, setDefaults] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const toPct = (v, f) => (f?.pct ? Math.round(v * 1000) / 10 : v);

  useEffect(() => {
    client
      .get('/admin/settings')
      .then(({ data }) => {
        setDefaults(data.defaults);
        const init = {};
        for (const f of FIELDS) init[f.key] = toPct(data.settings[f.key], f);
        setForm(init);
      })
      .catch(() => {});
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (values) => {
    setSaving(true);
    setMsg('');
    try {
      const payload = {};
      for (const f of FIELDS) {
        const n = Number(values[f.key]);
        if (!Number.isFinite(n)) {
          setMsg(`Invalid value for ${f.label}`);
          setSaving(false);
          return;
        }
        payload[f.key] = f.pct ? n / 100 : n;
      }
      const { data } = await client.put('/admin/settings', payload);
      for (const f of FIELDS) setField(f.key, toPct(data.settings[f.key], f));
      setMsg('Settings saved — new fares, surge and fees apply immediately.');
    } catch (e) {
      setMsg(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    const init = {};
    for (const f of FIELDS) init[f.key] = toPct(defaults[f.key], f);
    submit(init);
  };

  return (
    <div className="fade-in">
      <h2 style={{ marginTop: 0 }}>⚙️ Settings</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Pricing configuration — applies to new fares, surge multipliers, cancellation fees and driver
        dispatch radius. Existing rides keep their locked-in fare.
      </p>

      {msg && <div className={`alert mb ${msg.includes('Invalid') ? 'alert-warn' : 'alert-green'}`}>{msg}</div>}

      <div className="card" style={{ maxWidth: 520 }}>
        {FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`f-${f.key}`}>{f.label}</label>
            <input
              id={`f-${f.key}`}
              className="input"
              type="number"
              step="any"
              min="0"
              value={form[f.key] ?? ''}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          </div>
        ))}

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" disabled={saving} onClick={() => submit(form)}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <button className="btn btn-ghost" disabled={saving} onClick={resetToDefaults}>
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
