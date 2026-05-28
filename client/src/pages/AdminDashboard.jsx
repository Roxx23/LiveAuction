import { useState, useEffect } from 'react';
import { useAuction } from '../hooks/useAuction';
import '../styles/admin.css';

export default function AdminDashboard() {
  const [shop, setShop] = useState(null);
  const [startingBid, setStartingBid] = useState('1.00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('shopToken');

  // Fetch shop info
  useEffect(() => {
    if (!token) return;
    fetch('/api/shop', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setShop)
      .catch(() => setError('Failed to load shop info'));
  }, [token]);

  const { auction, secondsRemaining, recentBids, bidCount, result } = useAuction(
    shop?.shopDomain
  );

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auctions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ startingBid: parseFloat(startingBid) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const publicUrl = shop
    ? `${window.location.origin}/auction/${shop.shopDomain}`
    : '';

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
  };

  if (!token) {
    return (
      <div className="admin-content">
        <div className="no-auction">
          <p>Not authenticated. Install the app on your Shopify store first.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Visit: /auth?shop=yourstore.myshopify.com
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-content">
      <h2>Dashboard</h2>

      {shop && (
        <div className="shop-status">
          <span className="dot"></span>
          Connected: {shop.shopName || shop.shopDomain}
        </div>
      )}

      {error && <p style={{ color: 'var(--red)', marginBottom: 16 }}>{error}</p>}

      {/* Result banner */}
      {result && !auction && (
        <div className="card" style={{ marginBottom: 24, textAlign: 'center' }}>
          {result.type === 'sold' ? (
            <>
              <h3 style={{ color: 'var(--gold)' }}>🎉 SOLD!</h3>
              <p>{result.product?.title} — ${result.winningBid?.toFixed(2)} to {result.winnerName}</p>
            </>
          ) : (
            <>
              <h3 style={{ color: 'var(--red)' }}>Unsold</h3>
              <p>{result.product?.title} received no bids.</p>
            </>
          )}
        </div>
      )}

      {/* Start Auction */}
      {!auction && (
        <div className="start-section">
          <span style={{ color: 'var(--text-secondary)' }}>Starting bid: $</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={startingBid}
            onChange={(e) => setStartingBid(e.target.value)}
          />
          <button className="btn-primary" onClick={handleStart} disabled={loading}>
            {loading ? 'Starting...' : '🔨 Start Auction'}
          </button>
        </div>
      )}

      {/* Active Auction */}
      {auction && (
        <div className="active-auction-card">
          <img src={auction.product?.image || '/placeholder.png'} alt={auction.product?.title} />
          <div className="auction-info">
            <h3>{auction.product?.title}</h3>
            <div className="auction-stats">
              <div className="stat">
                <div className={`value bid`}>
                  ${(auction.currentBid || 0).toFixed(2)}
                </div>
                <div className="label">Current Bid</div>
              </div>
              <div className="stat">
                <div className={`value timer ${secondsRemaining <= 10 ? 'urgent' : ''}`}>
                  {secondsRemaining}s
                </div>
                <div className="label">Remaining</div>
              </div>
              <div className="stat">
                <div className="value">{bidCount}</div>
                <div className="label">Bids</div>
              </div>
            </div>

            <div className="share-link">
              <span>Public link:</span>
              <input readOnly value={publicUrl} />
              <button className="btn-primary" onClick={copyLink} style={{ padding: '8px 14px' }}>
                Copy
              </button>
            </div>

            {/* Recent bids */}
            {recentBids.length > 0 && (
              <div style={{ marginTop: 16, maxHeight: 150, overflowY: 'auto' }}>
                {recentBids.slice(0, 10).map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{b.bidderName}</span>
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>${b.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!auction && !result && (
        <div className="no-auction">
          <p>No active auction</p>
          <p style={{ fontSize: '0.85rem' }}>Set a starting bid and click "Start Auction" to begin.</p>
        </div>
      )}
    </div>
  );
}
