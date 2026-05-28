import { BrowserRouter, Routes, Route, NavLink, useSearchParams } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import { useEffect } from 'react';
import AdminDashboard from './pages/AdminDashboard';
import AuctionHistory from './pages/AuctionHistory';
import Settings from './pages/Settings';
import AuctionPage from './pages/AuctionPage';
import './styles/global.css';
import './styles/admin.css';

// Capture token from OAuth redirect
function TokenCapture({ children }) {
  const [params] = useSearchParams();
  useEffect(() => {
    const token = params.get('token');
    if (token) {
      localStorage.setItem('shopToken', token);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [params]);
  return children;
}

function AdminLayout() {
  return (
    <TokenCapture>
      <div className="admin-layout">
        <nav className="sidebar">
          <h1>🔨 LiveAuction</h1>
          <NavLink to="/admin" end className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink>
          <NavLink to="/admin/history" className={({ isActive }) => isActive ? 'active' : ''}>History</NavLink>
          <NavLink to="/admin/settings" className={({ isActive }) => isActive ? 'active' : ''}>Settings</NavLink>
        </nav>
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="history" element={<AuctionHistory />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </div>
    </TokenCapture>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/*" element={<AdminLayout />} />
          <Route path="/auction/:shopDomain" element={<AuctionPage />} />
          <Route path="/" element={
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
              <h1 style={{ color: 'var(--accent)' }}>🔨 LiveAuction</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Real-time auctions for Shopify stores</p>
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}
