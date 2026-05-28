const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// ── Shared CSS ──────────────────────────────────────────────────────────────
function getStyles() {
  return `
  #live-auction-root {
    font-family: var(--font-body-family, 'Inter', -apple-system, sans-serif);
    max-width: 960px; margin: 40px auto; padding: 0 20px;
    color: var(--la-text);
    --la-card: var(--color-background, #f3f3f3);
    --la-border: rgba(0,0,0,0.1);
    --la-accent: var(--color-button, #222);
    --la-accent-text: var(--color-button-text, #fff);
    --la-text: var(--color-foreground, #181818);
    --la-muted: rgba(0,0,0,0.5);
    --la-green: #16a34a; --la-red: #dc2626; --la-gold: #d97706;
  }
  .la-header{text-align:center;margin-bottom:32px}
  .la-header h1{font-family:var(--font-heading-family,inherit);font-size:1.8rem}
  .la-header p{color:var(--la-muted);font-size:.95rem}
  .la-login-prompt{text-align:center;padding:60px 20px}
  .la-login-prompt h2{font-family:var(--font-heading-family,inherit);font-size:1.5rem;margin-bottom:12px}
  .la-login-prompt p{color:var(--la-muted);margin-bottom:20px}
  .la-no-auction{text-align:center;padding:60px 20px}
  .la-no-auction h2{font-family:var(--font-heading-family,inherit);font-size:1.5rem;margin-bottom:8px}
  .la-no-auction p{color:var(--la-muted)}
  .la-grid{display:grid;grid-template-columns:1fr 360px;gap:24px}
  .la-product{background:var(--la-card);border-radius:12px;border:1px solid var(--la-border);overflow:hidden}
  .la-product img{width:100%;height:380px;object-fit:cover}
  .la-product-info{padding:20px}
  .la-product-info h2{font-family:var(--font-heading-family,inherit);font-size:1.3rem;margin-bottom:8px}
  .la-original-price{text-decoration:line-through;color:var(--la-muted)}
  .la-panel{display:flex;flex-direction:column;gap:16px}
  .la-box{background:var(--la-card);border-radius:12px;border:1px solid var(--la-border);padding:20px;text-align:center}
  .la-timer{font-size:3rem;font-weight:800;color:var(--la-gold);font-variant-numeric:tabular-nums}
  .la-timer.urgent{color:var(--la-red);animation:la-pulse .5s infinite}
  .la-label{font-size:.75rem;color:var(--la-muted);text-transform:uppercase;letter-spacing:.1em;margin-top:4px}
  .la-bid-amount{font-size:2.4rem;font-weight:800;color:var(--la-green)}
  .la-starting{color:var(--la-muted);font-size:.85rem}
  .la-bidder-info{font-size:.8rem;color:var(--la-muted);margin-bottom:8px}
  .la-quick-bids{display:flex;gap:8px;margin-bottom:10px}
  .la-quick-bids button{flex:1;padding:10px;background:#fff;color:var(--la-green);border:1px solid var(--la-border);border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;transition:all .15s}
  .la-quick-bids button:hover{border-color:var(--la-green);background:rgba(22,163,74,.08)}
  .la-bid-row{display:flex;gap:8px}
  .la-bid-row input{flex:1;font-size:1.1rem;font-weight:600;background:#fff;border:1px solid var(--la-border);border-radius:8px;color:var(--la-text);padding:10px 14px}
  .la-bid-row input:focus{border-color:var(--la-accent);outline:none}
  .la-btn{cursor:pointer;border:none;border-radius:8px;font-weight:600;padding:12px 24px;background:var(--la-accent);color:var(--la-accent-text);font-size:1rem;transition:all .2s;width:100%}
  .la-btn:hover{opacity:.9;transform:translateY(-1px)}
  .la-feed{max-height:220px;overflow-y:auto;text-align:left}
  .la-feed h4{font-size:.8rem;color:var(--la-muted);text-transform:uppercase;margin-bottom:10px}
  .la-feed-entry{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--la-border);font-size:.9rem;animation:la-slide .3s ease}
  .la-feed-entry .name{color:var(--la-muted)}
  .la-feed-entry .amt{color:var(--la-green);font-weight:600}
  .la-result{text-align:center;padding:48px 20px}
  .la-result.sold h2{color:var(--la-gold);font-size:2rem}
  .la-result.unsold h2{color:var(--la-red);font-size:2rem}
  .la-result .win-bid{font-size:2.8rem;font-weight:800;color:var(--la-green);margin:12px 0}
  .la-result .win-name{color:var(--la-muted);font-size:1.1rem}
  .la-result .next{color:var(--la-muted);font-style:italic;margin-top:20px}
  .la-error{color:var(--la-red);font-size:.85rem;margin-top:8px}
  .la-register-form{display:flex;flex-direction:column;gap:10px;text-align:left}
  .la-register-form input{background:#fff;border:1px solid var(--la-border);border-radius:8px;color:var(--la-text);padding:10px 14px;font-size:.95rem;width:100%;box-sizing:border-box}
  .la-register-form input:focus{border-color:var(--la-accent);outline:none}
  @keyframes la-pulse{0%,100%{opacity:1}50%{opacity:.4}}
  @keyframes la-slide{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
  @media(max-width:768px){.la-grid{grid-template-columns:1fr}.la-product img{height:260px}.la-timer{font-size:2.2rem}.la-bid-amount{font-size:1.8rem}}
  `;
}

// ── Shared auction JS (socket, state, rendering) ────────────────────────────
function getAuctionScript(serverUrl, shopDomain) {
  return `
  var SERVER = "${serverUrl}";
  var SHOP   = "${shopDomain}";
  var root   = document.getElementById('live-auction-root');

  var auction = null, secs = 0, bids = [], bidCount = 0, result = null, bidder = null, bidError = '';

  var socket = io(SERVER, { transports: ['websocket','polling'] });
  socket.on('connect', function() { socket.emit('join:auction', { shopDomain: SHOP }); });

  socket.on('auction:started', function(d) {
    auction = d; result = null;
    bids = d.recentBids || []; bidCount = d.bidCount || 0;
    secs = Math.max(0, Math.floor((new Date(d.endsAt).getTime() - Date.now()) / 1000));
    render();
  });
  socket.on('auction:newBid', function(d) {
    if (auction) auction.currentBid = d.currentBid;
    bidCount = d.bidCount;
    bids.unshift({ amount: d.currentBid, bidderName: d.bidderName });
    if (bids.length > 30) bids.pop();
    render();
  });
  socket.on('auction:tick',   function(d) {
    secs = d.secondsRemaining;
    // Only update timer element instead of full re-render (preserves bid input)
    var timerEl = document.querySelector('.la-timer');
    if (timerEl) {
      timerEl.textContent = secs + 's';
      timerEl.className = secs <= 10 ? 'la-timer urgent' : 'la-timer';
    } else {
      render();
    }
  });
  socket.on('auction:sold',   function(d) { result = { type:'sold',   product: d.product, winningBid: d.winningBid, winnerName: d.winnerName }; auction = null; render(); });
  socket.on('auction:unsold', function(d) { result = { type:'unsold', product: d.product }; auction = null; render(); });
  socket.on('bid:error',      function(d) { bidError = d.message; render(); });

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function renderAuction() {
    var curBid   = auction.currentBid || 0;
    var startBid = auction.startingBid || 0;
    var timerCls = secs <= 10 ? 'la-timer urgent' : 'la-timer';
    var defBid   = (Math.max(curBid, startBid) + 1).toFixed(2);

    var bidSection = '';
    if (bidder) {
      bidSection =
        '<div class="la-box">' +
          '<p class="la-bidder-info">Bidding as <strong>' + esc(bidder.displayName) + '</strong></p>' +
          '<div class="la-quick-bids">' +
            '<button onclick="laQuick(1)">+$1</button><button onclick="laQuick(5)">+$5</button><button onclick="laQuick(10)">+$10</button>' +
          '</div>' +
          '<div class="la-bid-row">' +
            '<input id="la-bid-amt" type="number" min="0.01" step="0.01" value="' + defBid + '" />' +
            '<button class="la-btn" style="width:auto;padding:10px 24px" onclick="laBid()">Place Bid</button>' +
          '</div>' +
          (bidError ? '<p class="la-error">' + esc(bidError) + '</p>' : '') +
        '</div>';
    } else {
      bidSection = getAuthSection();
    }

    var feedHtml = '';
    if (bids.length) {
      feedHtml = '<div class="la-box la-feed"><h4>Live Bids</h4>';
      for (var i = 0; i < bids.length; i++)
        feedHtml += '<div class="la-feed-entry"><span class="name">' + esc(bids[i].bidderName) + '</span><span class="amt">$' + bids[i].amount.toFixed(2) + '</span></div>';
      feedHtml += '</div>';
    }

    root.innerHTML =
      '<div class="la-header"><h1>\\u{1F528} Live Auction</h1><p>Bid now \\u2014 going once, going twice\\u2026</p></div>' +
      '<div class="la-grid">' +
        '<div class="la-product">' +
          '<img src="' + (auction.product?.image || '') + '" alt="' + esc(auction.product?.title) + '" />' +
          '<div class="la-product-info"><h2>' + esc(auction.product?.title) + '</h2>' +
            (auction.product?.originalPrice ? '<p class="la-original-price">Retail: $' + auction.product.originalPrice + '</p>' : '') +
            (auction.product?.description ? '<p class="la-product-desc">' + auction.product.description + '</p>' : '') +
          '</div>' +
        '</div>' +
        '<div class="la-panel">' +
          '<div class="la-box"><div class="' + timerCls + '">' + secs + 's</div><div class="la-label">Time Remaining</div></div>' +
          '<div class="la-box"><div class="la-bid-amount">$' + curBid.toFixed(2) + '</div><div class="la-starting">' +
            (curBid > 0 ? bidCount + ' bid' + (bidCount !== 1 ? 's' : '') : 'Starting at $' + startBid.toFixed(2)) +
          '</div></div>' +
          bidSection + feedHtml +
        '</div>' +
      '</div>';
  }

  function render() {
    if (result && !auction) {
      root.innerHTML =
        '<div class="la-header"><h1>\\u{1F528} Live Auction</h1></div>' +
        '<div class="la-result ' + result.type + '">' +
          (result.type === 'sold'
            ? '<h2>\\u{1F389} SOLD!</h2><p>' + esc(result.product?.title) + '</p><div class="win-bid">$' + (result.winningBid||0).toFixed(2) + '</div><p class="win-name">Won by ' + esc(result.winnerName) + '</p>'
            : '<h2>No Sale</h2><p>' + esc(result.product?.title) + ' went unsold</p>') +
          '<p class="next">Next auction starting in a few seconds\\u2026</p>' +
        '</div>';
      return;
    }
    if (!auction) {
      root.innerHTML =
        '<div class="la-header"><h1>\\u{1F528} Live Auction</h1></div>' +
        '<div class="la-no-auction"><h2>Next Auction Starting Soon</h2>' +
        '<p>Stay on this page \\u2014 a new product will be up for auction momentarily!</p></div>';
      return;
    }
    renderAuction();
  }

  window.laQuick = function(add) {
    var cur = auction?.currentBid || auction?.startingBid || 0;
    var el  = document.getElementById('la-bid-amt');
    if (el) el.value = (cur + add).toFixed(2);
  };
  window.laBid = function() {
    if (!bidder || !auction) return;
    var amt = parseFloat(document.getElementById('la-bid-amt')?.value || 0);
    bidError = '';
    socket.emit('bid:place', { auctionId: auction.auctionId, email: bidder.email, displayName: bidder.displayName, amount: amt });
  };
  `;
}

// ── Liquid page (via Shopify App Proxy — customer login required) ───────────
function buildLiquidPage(serverUrl, shopDomain) {
  return `{% if customer %}
  {% assign cust_name = customer.first_name | append: " " | append: customer.last_name %}
  {% assign cust_email = customer.email %}
{% endif %}

<div id="live-auction-root"></div>
<style>${getStyles()}</style>
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"><\/script>
<script>
(function() {
  ${getAuctionScript(serverUrl, shopDomain)}

  {% if customer %}
  function getAuthSection() {
    return '<div class="la-box"><p class="la-bidder-info">Setting up your profile\\u2026</p></div>';
  }
  fetch(SERVER + '/api/public/bidder/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: {{ cust_email | json }}, displayName: {{ cust_name | json }} })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) { if (d.bidder) { bidder = d.bidder; render(); } })
  .catch(function() {});
  {% else %}
  function getAuthSection() {
    return '<div class="la-box la-login-prompt"><h2>Sign in to bid</h2>' +
      '<p>You must be logged into your account to place bids.</p>' +
      '<a href="{{ routes.account_login_url }}" class="la-btn" style="text-decoration:none;display:inline-block;width:auto;padding:12px 32px">Sign In</a></div>';
  }
  {% endif %}

  render();
})();
<\/script>
`;
}

// ── Direct HTML page (localhost / standalone — register via form) ────────────
function buildDirectPage(serverUrl, shopDomain) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Live Auction \u2014 ${shopDomain}</title>
  <style>${getStyles()}</style>
</head>
<body style="background:#fff;margin:0">
<div id="live-auction-root"></div>
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"><\/script>
<script>
(function() {
  ${getAuctionScript(serverUrl, shopDomain)}

  function getAuthSection() {
    return '<div class="la-box la-register-form">' +
      '<h3 style="text-align:center;margin-bottom:4px">Join to Bid</h3>' +
      '<input id="la-name" placeholder="Display Name"/>' +
      '<input id="la-email" type="email" placeholder="Email"/>' +
      '<button class="la-btn" onclick="laRegister()">Join Auction</button>' +
      (bidError ? '<p class="la-error">' + esc(bidError) + '</p>' : '') +
    '</div>';
  }

  window.laRegister = function() {
    var name  = document.getElementById('la-name')?.value;
    var email = document.getElementById('la-email')?.value;
    if (!name || !email) { bidError = 'Name and email are required'; render(); return; }
    fetch(SERVER + '/api/public/bidder/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, displayName: name })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.bidder) { bidder = d.bidder; bidError = ''; render(); }
      else { bidError = d.error || 'Registration failed'; render(); }
    })
    .catch(function(e) { bidError = e.message; render(); });
  };

  render();
})();
<\/script>
</body>
</html>`;
}

// ── Route handler ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { signature, ...allParams } = req.query;
  const shop = req.query.shop;

  if (signature && process.env.SHOPIFY_API_SECRET) {
    // Shopify signs ALL params except 'signature' itself
    const sorted = Object.keys(allParams).sort().map(k => `${k}=${allParams[k]}`).join('');
    const expected = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(sorted).digest('hex');
    if (expected !== signature) return res.status(403).send('Invalid signature');
  }

  const shopDomain = shop || '';
  const serverUrl  = process.env.HOST || 'http://localhost:3000';

  if (signature) {
    // Via Shopify App Proxy → Liquid (customer must be logged in to bid)
    res.set('Content-Type', 'application/liquid');
    res.send(buildLiquidPage(serverUrl, shopDomain));
  } else {
    // Direct browser access → full HTML (register with name + email)
    res.set('Content-Type', 'text/html');
    res.send(buildDirectPage(serverUrl, shopDomain));
  }
});

module.exports = router;
