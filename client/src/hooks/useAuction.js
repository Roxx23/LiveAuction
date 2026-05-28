import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

export function useAuction(shopDomain) {
  const socket = useSocket();
  const [auction, setAuction] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [recentBids, setRecentBids] = useState([]);
  const [bidCount, setBidCount] = useState(0);
  const [result, setResult] = useState(null); // { type: 'sold'|'unsold', data }

  useEffect(() => {
    if (!socket || !shopDomain) return;

    socket.emit('join:auction', { shopDomain });

    const onStarted = (data) => {
      setAuction(data);
      setResult(null);
      setRecentBids(data.recentBids || []);
      setBidCount(data.bidCount || 0);
      const ends = new Date(data.endsAt).getTime();
      setSecondsRemaining(Math.max(0, Math.floor((ends - Date.now()) / 1000)));
    };

    const onNewBid = (data) => {
      setAuction((prev) => prev ? { ...prev, currentBid: data.currentBid } : prev);
      setBidCount(data.bidCount);
      setRecentBids((prev) => [
        { amount: data.currentBid, bidderName: data.bidderName, createdAt: new Date().toISOString() },
        ...prev,
      ].slice(0, 30));
    };

    const onTick = (data) => {
      setSecondsRemaining(data.secondsRemaining);
    };

    const onSold = (data) => {
      setResult({ type: 'sold', ...data });
      setAuction(null);
      setSecondsRemaining(0);
    };

    const onUnsold = (data) => {
      setResult({ type: 'unsold', ...data });
      setAuction(null);
      setSecondsRemaining(0);
    };

    socket.on('auction:started', onStarted);
    socket.on('auction:newBid', onNewBid);
    socket.on('auction:tick', onTick);
    socket.on('auction:sold', onSold);
    socket.on('auction:unsold', onUnsold);

    return () => {
      socket.off('auction:started', onStarted);
      socket.off('auction:newBid', onNewBid);
      socket.off('auction:tick', onTick);
      socket.off('auction:sold', onSold);
      socket.off('auction:unsold', onUnsold);
    };
  }, [socket, shopDomain]);

  const placeBid = useCallback(
    ({ auctionId, email, displayName, amount }) => {
      if (socket) {
        socket.emit('bid:place', { auctionId, email, displayName, amount });
      }
    },
    [socket]
  );

  return { auction, secondsRemaining, recentBids, bidCount, result, placeBid };
}
