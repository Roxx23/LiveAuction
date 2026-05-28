import { useState, useEffect } from 'react';
import '../styles/admin.css';

export default function Settings() {
  const [settings, setSettings] = useState({
    defaultStartingBid: 1.0,
    auctionDurationSeconds: 60,
    autoStartNext: false,
  });
  const [saved, setSaved] = useState(false);
  const token = localStorage.getItem('shopToken');

  useEffect(() => {
    if (!token) return;
    fetch('/api/shop', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.auctionSettings) setSettings(data.auctionSettings);
      });
  }, [token]);

  const handleSave = async () => {
    const res = await fetch('/api/shop/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="admin-content">
      <h2>Settings</h2>

      <div className="settings-form">
        <div className="form-group">
          <label>Default Starting Bid ($)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={settings.defaultStartingBid}
            onChange={(e) => setSettings({ ...settings, defaultStartingBid: parseFloat(e.target.value) })}
          />
        </div>

        <div className="form-group">
          <label>Auction Duration (seconds)</label>
          <input
            type="number"
            min="10"
            max="600"
            value={settings.auctionDurationSeconds}
            onChange={(e) => setSettings({ ...settings, auctionDurationSeconds: parseInt(e.target.value, 10) })}
          />
        </div>

        <div className="form-group toggle-row">
          <label>Auto-start next auction</label>
          <input
            type="checkbox"
            checked={settings.autoStartNext}
            onChange={(e) => setSettings({ ...settings, autoStartNext: e.target.checked })}
            style={{ width: 'auto' }}
          />
        </div>

        <button className="btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
