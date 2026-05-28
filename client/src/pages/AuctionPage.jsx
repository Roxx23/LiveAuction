import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuction } from '../hooks/useAuction';
import { useSocket } from '../context/SocketContext';
import '../styles/auction.css';

export default function AuctionPage() {
  const { shopDomain } = useParams();
  const socket = useSocket();
  const { auction, secondsRemaining, recentBids, bidCount, result, placeBid } =
    useAuction(shopDomain);

  const [bidder, setBidder] = useState(() => {
    const saved = localStorage.getItem('bidder');
    return saved ? JSON.parse(saved) : null;
  });
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState('');
  const [shopName, setShopName] = useState('');

  // Fetch shop name
  useEffect(() => {
    fetch(`/api/public/${shopDomain}/auction`)
      .then((r) => r.json())
      .then((data) => setShopName(data.shopName || shopDomain));
  }, [shopDomain]);

  // Listen for bid errors
  useEffect(() => {
    if (!socket) return;
    const onError = (data) => setBidError(data.message);
    socket.on('bid:error', onError);
    return () => socket.off('bid:error', onError);
  }, [socket]);

  // Update bid amount when current bid changes
  useEffect(() => {
    if (auction) {
      const current = auction.currentBid || auction.startingBid || 0;
      setBidAmount((current + 1).toFixed(2));
    }
  }, [auction?.currentBid]);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/public/bidder/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('bidder', JSON.stringify(data.bidder));
      setBidder(data.bidder);
    } catch (err) {
      setBidError(err.message);
    }
  };

  const handleBid = () => {
    if (!bidder || !auction) return;
    setBidError('');
    placeBid({
      auctionId: auction.auctionId,
      email: bidder.email,
      displayName: bidder.displayName,
      amount: parseFloat(bidAmount),
    });
  };

  const quickBid = (add) => {
    const current = auction?.currentBid || auction?.startingBid || 0;
    const amount = current + add;
    setBidAmount(amount.toFixed(2));
  };

  // Result screen
  if (result) {
    return (
      <div className="auction-page">
        <div className="header">
          <h1>🔨 {shopName}</h1>
        </div>
        <div className={`result-overlay ${result.type}`}>
          {result.type === 'sold' ? (
            <>
              <h2>🎉 SOLD!</h2>
              <p>{result.product?.title}</p>
              <div className="winning-bid">${result.winningBid?.toFixed(2)}</div>
              <p className="winner-name">Won by {result.winnerName}</p>
            </>
          ) : (
            <>
              <h2>No Sale</h2>
              <p>{result.product?.title} went unsold.</p>
            </>
          )}
          <p className="next-msg">Next auction starting soon...</p>
        </div>
      </div>
    );
  }

  // No active auction
  if (!auction) {
    return (
      <div className="auction-page">
        <div className="header">
          <h1>🔨 {shopName}</h1>
        </div>
        <div className="no-live-auction">
          <h2>No Auction Live</h2>
          <p>Check back soon — the next auction could start any moment!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auction-page">
      <div className="header">
        <h1>🔨 {shopName}</h1>
        <p>Live Auction</p>
      </div>

      <div className="live-auction">
        {/* Left: Product */}
        <div className="product-card">
          <img src={auction.product?.image || '/placeholder.png'} alt={auction.product?.title} />
          <div className="product-info">
            <h2>{auction.product?.title}</h2>
            {auction.product?.originalPrice && (
              <p className="original-price">Retail: ${auction.product.originalPrice}</p>
            )}
            {auction.product?.description && (
              <p
                style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 8 }}
                dangerouslySetInnerHTML={{ __html: auction.product.description }}
              />
            )}
          </div>
        </div>

        {/* Right: Bid Panel */}
        <div className="bid-panel">
          {/* Countdown */}
          <div className="countdown">
            <div className={`time ${secondsRemaining <= 10 ? 'urgent' : ''}`}>
              {secondsRemaining}s
            </div>
            <div className="label">Time Remaining</div>
          </div>

          {/* Current Bid */}
          <div className="current-bid-display">
            <div className="amount">
              ${(auction.currentBid || 0).toFixed(2)}
            </div>
            <div className="starting">
              {auction.currentBid > 0
                ? `${bidCount} bid${bidCount !== 1 ? 's' : ''}`
                : `Starting at $${auction.startingBid?.toFixed(2)}`}
            </div>
          </div>

          {/* Register or Bid */}
          {!bidder ? (
            <form className="register-form" onSubmit={handleRegister}>
              <h3>Join to Bid</h3>
              <input
                placeholder="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="btn-primary" type="submit">Join Auction</button>
              {bidError && <p className="bid-error">{bidError}</p>}
            </form>
          ) : (
            <div className="bid-input-section">
              <div className="quick-bids">
                <button type="button" onClick={() => quickBid(1)}>+$1</button>
                <button type="button" onClick={() => quickBid(5)}>+$5</button>
                <button type="button" onClick={() => quickBid(10)}>+$10</button>
              </div>
              <div className="bid-row">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                />
                <button className="btn-primary" onClick={handleBid}>
                  Bid ${parseFloat(bidAmount || 0).toFixed(2)}
                </button>
              </div>
              {bidError && <p className="bid-error">{bidError}</p>}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                Bidding as {bidder.displayName}
              </p>
            </div>
          )}

          {/* Bid Feed */}
          {recentBids.length > 0 && (
            <div className="bid-feed">
              <h4>Live Bids</h4>
              {recentBids.map((b, i) => (
                <div key={i} className="bid-entry">
                  <span className="bidder">{b.bidderName}</span>
                  <span className="bid-amount">${b.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
