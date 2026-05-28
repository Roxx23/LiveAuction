import { useState, useEffect } from 'react';
import '../styles/admin.css';

export default function AuctionHistory() {
  const [auctions, setAuctions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const token = localStorage.getItem('shopToken');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/auctions/history?page=${page}&limit=15`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setAuctions(data.auctions || []);
        setTotalPages(data.totalPages || 1);
      });
  }, [page, token]);

  return (
    <div className="admin-content">
      <h2>Auction History</h2>

      {auctions.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No auctions yet. Start your first one!</p>
      ) : (
        <>
          <table className="history-table">
            <thead>
              <tr>
                <th></th>
                <th>Product</th>
                <th>Starting</th>
                <th>Final Bid</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map((a) => (
                <tr key={a.id}>
                  <td>
                    <img src={a.productImage || '/placeholder.png'} alt="" />
                  </td>
                  <td>{a.productTitle}</td>
                  <td>${parseFloat(a.startingBid).toFixed(2)}</td>
                  <td style={{ color: a.status === 'sold' ? 'var(--green)' : 'var(--text-secondary)' }}>
                    {parseFloat(a.currentBid) > 0 ? `$${parseFloat(a.currentBid).toFixed(2)}` : '—'}
                  </td>
                  <td>
                    <span className={`status-badge ${a.status}`}>{a.status}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={page === i + 1 ? 'active' : ''}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
