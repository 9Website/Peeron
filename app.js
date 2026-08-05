/**
 * Peeron v5.4 - Main Application JavaScript
 * A P2P video chat and collaborative workspace application
 * License: GNU AGPL v3.0
 */

// ============================================
// Configuration & Constants
// ============================================

const APP_VERSION = '5.4';
const APP_NAME = 'Peeron';

const peerGlobalConfig = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    sdpSemantics: 'unified-plan'
  }
};

const CHUNK_SIZE = 16384;

// ============================================
// Application State
// ============================================

let myUser = { name: 'User', emoji: '😀', isChatMuted: false, originalPeerId: '' };
let peer = null, roomCode = '', isHost = false;
let globalPrivacyBlurred = false, isRoomLocked = false, isWaitingRoomEnabled = true;
let connections = [], participantsProfileMap = {}, selectedTargetPeerId = null, whisperTargetPeerId = null;
let bannedHardwareTokens = [], tokenToNameMapping = {};
const myDeviceHardwareToken = localStorage.getItem('p2p_device_token') || 
  ('DEV-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
localStorage.setItem('p2p_device_token', myDeviceHardwareToken);

let localCamStream = null, localMicStream = null, localScreenStream = null;
let fileTransferReceivers = {};
let peerRestrictions = {};
let roomRestrictions = { noMic: false, noCam: false, noShare: false, noChat: false, noFile: false, noReply: false, noReact: false };
let messageReactions = {}, processedMessageIds = new Set();
let ctxTargetMsgId = null, ctxTargetMsgEl = null;
let replyTargetMsgId = null, replyTargetSender = null, replyTargetText = null;
let pendingKnockers = {};

// ============================================
// Constants
// ============================================

const REACTION_EMOJIS = ['👍','👎','🤏','❤️','🔥','💯','✅','❌','😂','😭','👀','😮','🎉','😳','😢','😱','😤','😴','👋','🤩','😷','😫','🤯','🤗','🤔','👌','💪','🙏','🎯'];
const PERM_DEFS = [
  { key: 'noMic', label: '🎤 Disable Microphone' },
  { key: 'noCam', label: '📷 Disable Camera' },
  { key: 'noShare', label: '🖥️ Disable Screen Share' },
  { key: 'noChat', label: '💬 Disable Chat' },
  { key: 'noFile', label: '📎 Disable File Attach' },
  { key: 'noReply', label: '🔄 Disable Replies' },
  { key: 'noReact', label: '😶 Disable Reactions' }
];
let SLASH_COMMANDS = [
  { cmd: '/announce', syntax: '/announce (colour) (size%) (message)', desc: 'Styled announcement to everyone — host only' },
  { cmd: '/clear', syntax: '/clear', desc: 'Clear the entire chat for everyone — host only' }
];

// ============================================
// Utility Functions
// ============================================

function genCode() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; }
function getCryptoKey() { return roomCode || 'LocalFallbackKey!'; }
function enc(text, bin = false) { let k = getCryptoKey(), pt = bin ? text : unescape(encodeURIComponent(text)), r = ''; for (let i = 0; i < pt.length; i++) r += String.fromCharCode(pt.charCodeAt(i) ^ k.charCodeAt(i % k.length)); return btoa(r); }
function dec(b64, bin = false) { try { let k = getCryptoKey(), t = atob(b64), r = ''; for (let i = 0; i < t.length; i++) r += String.fromCharCode(t.charCodeAt(i) ^ k.charCodeAt(i % k.length)); return bin ? r : decodeURIComponent(escape(r)); } catch { return '[⚠️ Decryption Failure]'; } }
function nowTS() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function contrastCol(hex) { try { const cv = document.createElement('canvas').getContext('2d'); cv.fillStyle = hex; const h = cv.fillStyle; const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#111' : '#fff'; } catch { return '#fff'; } }
function parseAnnounce(text) { const m = text.trim().match(/^\/announce\s+(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\s+(\d{1,4})%?\s+([\s\S]+)$/); if (!m) return null; return { colour: m[1], sizePct: Math.min(1000, Math.max(100, parseInt(m[2], 10))), message: m[3].trim() }; }
function getDeviceInfo() { return { browser: navigator.userAgent.substring(0, 100), platform: navigator.platform || 'Unknown', screen: `${screen.width}x${screen.height}`, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: navigator.language }; }
function getMyRestrictions() { const pr = peerRestrictions[peer?.id] || {}; return { noMic: pr.noMic || roomRestrictions.noMic, noCam: pr.noCam || roomRestrictions.noCam, noShare: pr.noShare || roomRestrictions.noShare, noChat: pr.noChat || roomRestrictions.noChat || myUser.isChatMuted, noFile: pr.noFile || roomRestrictions.noFile, noReply: pr.noReply || roomRestrictions.noReply, noReact: pr.noReact || roomRestrictions.noReact }; }
function iAmEffectivelyMuted() { return !isHost && getMyRestrictions().noChat; }
function isVanished(peerId) { return !!(peerRestrictions[peerId] && peerRestrictions[peerId].vanished); }

// ============================================
// DOM Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initEmojiGrid();
  initReactionGrid();
  loadSettings();
  setupEventListeners();
  document.title = `${APP_NAME} v${APP_VERSION}`;
});

function initEmojiGrid() {
  const grid = document.getElementById('emoji-grid');
  if (!grid) return;
  let emojis = [];
  for (let i = 0x1F600; i <= 0x1F64F; i++) emojis.push(String.fromCodePoint(i));
  for (let i = 0x1F910; i <= 0x1F96F; i++) emojis.push(String.fromCodePoint(i));
  for (let i = 0x1F440; i <= 0x1F499; i++) emojis.push(String.fromCodePoint(i));
  emojis.slice(0, 240).forEach((emoji, idx) => {
    const opt = document.createElement('div');
    opt.className = 'emoji-opt' + (idx === 0 ? ' selected' : '');
    opt.innerText = emoji;
    opt.onclick = () => {
      document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
      opt.classList.add('selected');
      myUser.emoji = emoji;
    };
    grid.appendChild(opt);
  });
}

function initReactionGrid() {
  const rg = document.getElementById('ctx-reaction-grid');
  if (!rg) return;
  REACTION_EMOJIS.forEach(e => {
    const b = document.createElement('div');
    b.className = 'ctx-emoji-btn';
    b.innerText = e;
    b.onclick = () => applyReaction(e);
    rg.appendChild(b);
  });
}

function loadSettings() {
  if (localStorage.getItem('p2p_dark') === '1') { applyDarkMode(true); document.getElementById('toggle-darkmode').checked = true; }
  if (localStorage.getItem('p2p_timestamps') === '1') { applyTimestamps(true); document.getElementById('toggle-timestamps').checked = true; }
}

function setupEventListeners() {
  document.addEventListener('click', (e) => { if (!document.getElementById('ctx-menu').contains(e.target)) closeCtxMenu(); });
  window.addEventListener('beforeunload', (e) => { if (roomCode) { e.preventDefault(); e.returnValue = 'Leave?'; return e.returnValue; } });
}

// ============================================
// Profile & Settings
// ============================================

function applyCustomEmoji() { const v = document.getElementById('custom-emoji-input').value.trim(); if (!v) return alert('Paste an emoji first!'); document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected')); myUser.emoji = v; }
function saveProfile() { const n = document.getElementById('username-input').value.trim(); if (!n) return alert('Enter a username!'); myUser.name = n; document.getElementById('profile-screen').style.display = 'none'; document.getElementById('lobby-screen').style.display = 'block'; initPeerNetwork(); }
function openSettings() { document.getElementById('settings-waiting-row').style.display = isHost ? 'flex' : 'none'; document.getElementById('toggle-waitingroom').checked = isWaitingRoomEnabled; document.getElementById('settings-modal').style.display = 'block'; document.getElementById('modal-backdrop').style.display = 'block'; }
function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; document.getElementById('modal-backdrop').style.display = 'none'; }
function applyDarkMode(on) { document.body.classList.toggle('dark-mode', on); localStorage.setItem('p2p_dark', on ? '1' : '0'); }
function applyTimestamps(on) { document.body.classList.toggle('timestamps-on', on); localStorage.setItem('p2p_timestamps', on ? '1' : '0'); }
function toggleWaitingRoomSetting(on) { if (!isHost) return; isWaitingRoomEnabled = on; showAlertBanner(on ? '🚪 Waiting room enabled.' : '🚪 Waiting room disabled.'); }

// ============================================
// Room Management
// ============================================

function initPeerNetwork() { peer = new Peer(peerGlobalConfig); peer.on('connection', setupIncomingDataConnection); peer.on('call', setupIncomingMediaCall); }

function createRoom() {
  roomCode = genCode(); isHost = true; myUser.originalPeerId = roomCode;
  if (peer) peer.destroy();
  peer = new Peer(roomCode, peerGlobalConfig);
  peer.on('open', id => {
    document.getElementById('room-code-output').innerText = id;
    document.getElementById('host-code-area').style.display = 'block';
    document.getElementById('pardon-box-root').style.display = 'block';
    document.getElementById('apply-all-btn').style.display = 'inline-flex';
    document.getElementById('host-indicator').innerText = `Host: ${myUser.emoji} ${myUser.name}`;
    enterRoomUI(id); rebuildPeopleRoster();
  });
  peer.on('connection', setupIncomingDataConnection); peer.on('call', setupIncomingMediaCall);
}

function joinRoom() {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (!code) return alert('Enter a room code.');
  let chk = peer.connect(code);
  let to = setTimeout(() => { chk.close(); alert('Room inactive, locked, or code invalid.'); }, 3500);
  chk.on('open', () => {
    clearTimeout(to); chk.close();
    roomCode = code; isHost = false; enterRoomUI(roomCode);
    document.getElementById('waiting-overlay').classList.add('visible');
    let real = peer.connect(roomCode);
    setupOutgoingDataConnection(real);
    real.on('open', () => { real.send({ type: 'get-peers', senderId: peer.id }); });
  });
}

function enterRoomUI(code) {
  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('room-screen').style.display = 'block';
  document.getElementById('header-code-txt').innerText = code;
  document.getElementById('room-nav-bar').style.display = 'flex';
  updatePrivacyBtns(); updateInputPlaceholder();
}

function updatePrivacyBtns() {
  const pb = document.getElementById('privacy-toggle-btn');
  const lb = document.getElementById('lock-toggle-btn');
  if (pb) pb.style.display = isHost ? 'inline-block' : 'none';
  if (lb) lb.style.display = isHost ? 'inline-block' : 'none';
  updateInputPlaceholder();
}

function updateInputPlaceholder() { const ta = document.getElementById('msg-input'); if (!ta) return; ta.placeholder = isHost ? 'Type a message… Use @ to whisper, / for commands' : 'Type a message… Use @ to whisper'; }
function clickLockToggle() { if (!isHost) return; isRoomLocked = !isRoomLocked; const btn = document.getElementById('lock-toggle-btn'); if (btn) btn.innerText = isRoomLocked ? '🔒' : '🔓'; showAlertBanner(isRoomLocked ? '🔒 Room locked.' : '🔓 Room unlocked.'); }
function clickPrivacyToggle() { if (!isHost) return; globalPrivacyBlurred = !globalPrivacyBlurred; applyBlurUI(globalPrivacyBlurred); broadcastToMesh({ type: 'global-privacy-sync', blur: globalPrivacyBlurred }); }
function applyBlurUI(b) { const c = document.getElementById('header-code-txt'), btn = document.getElementById('privacy-toggle-btn'); if (c) { if (b) c.classList.add('blur-code'); else c.classList.remove('blur-code'); } if (btn) btn.innerText = b ? '👁️ Show' : '👁️ Hide'; }

// ============================================
// Connection Management
// ============================================

function setupIncomingDataConnection(conn) {
  if (isHost && isRoomLocked) { setTimeout(() => conn.close(), 500); return; }
  conn.on('open', () => {
    if (localCamStream && peer.id) peer.call(conn.peer, localCamStream, { metadata: { id: peer.id + '-cam', label: `${myUser.emoji} ${myUser.name}` } });
    if (localScreenStream && peer.id) peer.call(conn.peer, localScreenStream, { metadata: { id: peer.id + '-screen', label: `${myUser.name}'s Screen` } });
  });
  if (isHost && isWaitingRoomEnabled) {
    conn.on('data', data => { if (data.type === 'knock') { pendingKnockers[conn.peer] = { conn, user: data.user, hwToken: data.hwToken, deviceInfo: data.deviceInfo, entryPerms: {} }; addKnockCard(conn.peer); } else { handleData(data, conn); } });
    conn.on('close', () => { removeKnockCard(conn.peer); delete pendingKnockers[conn.peer]; }); return;
  }
  connections.push(conn); conn.on('data', data => handleData(data, conn)); conn.on('close', () => { connections = connections.filter(c => c !== conn); });
}

function setupOutgoingDataConnection(conn) {
  if (connections.some(c => c.peer === conn.peer)) return;
  connections.push(conn);
  conn.on('open', () => {
    myUser.originalPeerId = peer.id;
    if (!isHost) { const hostConn = connections.find(c => c.peer === roomCode); if (hostConn === conn) { conn.send({ type: 'knock', user: myUser, hwToken: myDeviceHardwareToken, deviceInfo: getDeviceInfo() }); return; } }
    sendHandshake(conn);
  });
  conn.on('data', data => handleData(data, conn));
  conn.on('close', () => {
    const profile = participantsProfileMap[conn.peer];
    if (profile && !isVanished(conn.peer)) appendSysMsg(`${profile.emoji} ${profile.name} left.`, 'leave');
    connections = connections.filter(c => c.peer !== conn.peer); delete participantsProfileMap[conn.peer];
    removeMediaWrapper(conn.peer + '-cam'); removeMediaWrapper(conn.peer + '-screen');
    if (isHost) broadcastRosterState(); else rebuildPeopleRoster();
  });
}

function sendHandshake(conn) {
  conn.send({ type: 'handshake-identity', user: myUser, isHost, hwToken: myDeviceHardwareToken });
  if (isHost) { conn.send({ type: 'global-privacy-sync', blur: globalPrivacyBlurred }); const peerList = connections.map(c => c.peer).filter(id => id !== conn.peer); conn.send({ type: 'mesh-intro', peers: peerList }); const pr = peerRestrictions[conn.peer] || {}; conn.send({ type: 'peer-restrictions', restrictions: pr, roomRestrictions }); broadcastRosterState(); }
}

// ============================================
// Data Handling
// ============================================

function handleData(data, conn) {
  switch (data.type) {
    case 'knock-response':
      if (data.admitted) { if (data.restrictions) peerRestrictions[peer.id] = data.restrictions; if (data.roomRestrictions) roomRestrictions = data.roomRestrictions; updateAttachBtn(); updateMutedLabel(); document.getElementById('waiting-overlay').classList.remove('visible'); sendHandshake(conn); }
      else { document.getElementById('waiting-title').innerText = 'Entry Denied'; document.getElementById('waiting-msg').innerText = 'The host has denied your request to join this room.'; document.getElementById('waiting-overlay').classList.add('visible'); }
      break;
    case 'handshake-identity':
      if (isHost && bannedHardwareTokens.includes(data.hwToken)) { conn.send({ type: 'admin-command', command: 'ban' }); conn.close(); return; }
      if (data.hwToken) { conn.hardwareDeviceToken = data.hwToken; tokenToNameMapping[data.hwToken] = data.user.name; }
      const wasNew = !participantsProfileMap[conn.peer]; participantsProfileMap[conn.peer] = { ...data.user, isHost: data.isHost, pId: conn.peer };
      if (wasNew && !isVanished(conn.peer)) appendSysMsg(`${data.user.emoji} ${data.user.name} joined.`, 'join');
      if (isHost) broadcastRosterState(); else rebuildPeopleRoster(); break;
    case 'roster-broadcast':
      const oldMute = myUser.isChatMuted;
      if (data.map[peer.id]) { myUser.name = data.map[peer.id].name; myUser.emoji = data.map[peer.id].emoji; myUser.isChatMuted = data.map[peer.id].isChatMuted || false; const oldHost = isHost; isHost = data.map[peer.id].isHost || false; if (oldHost !== isHost) { updatePrivacyBtns(); if (isHost) { document.getElementById('pardon-box-root').style.display = 'block'; document.getElementById('apply-all-btn').style.display = 'inline-flex'; showAlertBanner('👑 You are now the Host.'); } else { document.getElementById('pardon-box-root').style.display = 'none'; document.getElementById('apply-all-btn').style.display = 'none'; } } }
      if (oldMute !== myUser.isChatMuted) { showAlertBanner(myUser.isChatMuted ? '⚠️ Host muted your chat.' : '✅ Host restored your chat.'); updateMutedLabel(); }
      participantsProfileMap = data.map; for (let k in participantsProfileMap) { if (participantsProfileMap[k].isHost) document.getElementById('host-indicator').innerText = `Host: ${participantsProfileMap[k].emoji} ${participantsProfileMap[k].name}`; } rebuildPeopleRoster(); break;
    case 'chat':
      if (data.msgId) { if (processedMessageIds.has(data.msgId)) return; processedMessageIds.add(data.msgId); } appendMessage(dec(data.payload), 'them', data.user, false, data.msgId, data.senderPeerId, data.replyTo); if (isHost) broadcastToMesh(data, data.senderPeerId); break;
    case 'whisper': appendMessage(`[Private Whisper] ${dec(data.payload)}`, 'them', data.user, true, data.msgId, data.senderPeerId, null); break;
    case 'global-msg-edit': handleRemoteEdit(data); break;
    case 'global-identity-override': document.querySelectorAll('.msg').forEach(m => { if (m.getAttribute('data-sender-peer-id') === data.targetPeerId) { const s = m.querySelector('.sender-tag'); if (s) s.innerText = `${data.newEmoji} ${data.newName}`; } }); break;
    case 'file-chunk': handleIncomingFileChunk(data); break;
    case 'mesh-intro': data.peers.forEach(pId => { if (pId !== peer.id) { const nc = peer.connect(pId); setupOutgoingDataConnection(nc); } }); break;
    case 'get-peers': const peerIds = connections.map(c => c.peer); conn.send({ type: 'peer-list', peers: peerIds }); break;
    case 'peer-list': data.peers.forEach(remoteId => { if (remoteId !== peer.id && !connections.some(c => c.peer === remoteId)) { const newConn = peer.connect(remoteId); setupOutgoingDataConnection(newConn); } }); break;
    case 'global-privacy-sync': applyBlurUI(data.blur); break;
    case 'media-disconnect': removeMediaWrapper(data.targetId); break;
    case 'admin-command': handleAdminCommand(data.command); break;
    case 'announcement': appendAnnouncement(data.message, data.colour, data.sizePct, data.msgId); break;
    case 'reaction-update': applyReactionData(data.msgId, data.reactions); break;
    case 'peer-restrictions': if (data.restrictions) peerRestrictions[peer.id] = data.restrictions; if (data.roomRestrictions) roomRestrictions = data.roomRestrictions; updateAttachBtn(); updateMutedLabel(); break;
    case 'room-restrictions': roomRestrictions = data.restrictions; applyRoomRestrictionsLocally(data.restrictions, data.immediate); break;
    case 'clear-chat': document.getElementById('chat-box').innerHTML = ''; messageReactions = {}; break;
    case 'fake-sys-msg': appendSysMsg(data.text, data.msgType); break;
    case 'vanish-sync': if (!peerRestrictions[data.peerId]) peerRestrictions[data.peerId] = {}; peerRestrictions[data.peerId].vanished = data.vanished; rebuildPeopleRoster(); break;
  }
}

function showAlertBanner(msg) { const b = document.getElementById('system-alert-banner'), t = document.getElementById('system-alert-text'); if (b && t) { t.innerText = msg; b.style.display = 'flex'; } }
function broadcastToMesh(p, excludePeerId = null) { connections.forEach(c => { if (c.open && c.peer !== excludePeerId) c.send(p); }); }

// ============================================
// Message Functions
// ============================================

function appendSysMsg(text, type) {
  const box = document.getElementById('chat-box'); if (!box) return;
  const el = document.createElement('div'); const mid = 'sys-' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  el.className = `msg system-${type}`; el.id = mid; el.setAttribute('data-msg-type', 'system'); el.innerText = text;
  if (isHost) { el.style.cursor = 'pointer'; el.addEventListener('contextmenu', e => { e.preventDefault(); openCtxMenu(e, mid, el); }); }
  box.appendChild(el); box.scrollTop = box.scrollHeight;
}

function broadcastRosterState() {
  let m = {}; connections.forEach(c => { if (c.peer && participantsProfileMap[c.peer]) m[c.peer] = participantsProfileMap[c.peer]; }); m[peer.id] = { ...myUser, isHost, pId: peer.id };
  broadcastToMesh({ type: 'roster-broadcast', map: m }); rebuildPeopleRoster();
}

function rebuildPeopleRoster() {
  const container = document.getElementById('people-list'); if (!container) return; container.innerHTML = '';
  const peerIds = isHost ? new Set(connections.filter(c => c.open).map(c => c.peer)) : new Set(Object.keys(participantsProfileMap).filter(pId => pId !== peer.id));
  let visCount = 1; peerIds.forEach(pId => { if (isHost || !isVanished(pId)) visCount++; });
  const countEl = document.getElementById('people-count'); if (countEl) countEl.innerText = visCount;
  const selfItem = document.createElement('div'); selfItem.className = 'person-item';
  const selfVTag = isVanished(peer.id) ? '<span style="color:#888;font-size:10px;margin-left:4px;">[Vanished]</span>' : '';
  const selfHostTag = isHost ? '<strong style="color:var(--danger);"> (Host)</strong>' : '';
  if (isHost) { selfItem.classList.add('clickable'); selfItem.onclick = () => openAdminModal(peer.id, myUser); }
  selfItem.innerHTML = `<span>${myUser.emoji}</span><span class="${myUser.isChatMuted ? 'muted-style' : ''}">${myUser.name}${selfHostTag} (You)${selfVTag}</span>`; container.appendChild(selfItem);
  peerIds.forEach(pId => { const vanished = isVanished(pId); if (!isHost && vanished) return; const p = participantsProfileMap[pId] || { name: 'Joining…', emoji: '👤', isHost: false, isChatMuted: false }; const item = document.createElement('div'); item.className = 'person-item'; const hostTag = p.isHost ? '<strong style="color:var(--danger);"> (Host)</strong>' : ''; const vTag = vanished ? '<span style="color:#888;font-size:10px;margin-left:4px;">[Vanished]</span>' : ''; item.innerHTML = `<span>${p.emoji}</span><span class="${p.isChatMuted ? 'muted-style' : ''}">${p.name}${hostTag}${vTag}</span>`; if (isHost) { item.classList.add('clickable'); item.onclick = () => openAdminModal(pId, p); } container.appendChild(item); });
}

function updateAttachBtn() { const btn = document.getElementById('attach-btn'); if (btn) btn.style.display = (isHost || !getMyRestrictions().noFile) ? 'flex' : 'none'; }
function updateMutedLabel() { const label = document.getElementById('muted-label'); if (label) label.classList.toggle('visible', iAmEffectivelyMuted()); }

// ============================================
// File Transfer
// ============================================

function handleFileSelected(input) {
  if (!isHost && getMyRestrictions().noFile) { showAlertBanner('❌ File sharing disabled by host.'); return; }
  const file = input.files[0]; if (!file) return;
  const txId = 'TX-' + Math.random().toString(36).substring(2, 9); const msgId = 'msg-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  const reader = new FileReader(); appendProgressBarMsg(file.name, 'me', myUser, msgId);
  reader.onload = e => { const raw = e.target.result; let bin = ''; const bytes = new Uint8Array(raw); for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]); const encrypted = enc(bin, true); const total = encrypted.length; let offset = 0, idx = 0; const chunks = Math.ceil(total / CHUNK_SIZE);
    function next() { if (offset < total) { const pkt = { type: 'file-chunk', transferId: txId, fileName: file.name, chunkIndex: idx, totalChunks: chunks, data: encrypted.substring(offset, offset + CHUNK_SIZE), user: myUser, msgId, senderPeerId: peer.id }; if (whisperTargetPeerId) { const dc = connections.find(c => c.peer === whisperTargetPeerId); if (dc && dc.open) dc.send(pkt); } else broadcastToMesh(pkt); idx++; offset += CHUNK_SIZE; updateProgressUI(msgId, Math.min(100, Math.floor((idx / chunks) * 100))); setTimeout(next, 5); } else { convertBarToLink(msgId, file.name, 'data:application/octet-stream;base64,' + btoa(bin)); whisperTargetPeerId = null; } } next(); }; reader.readAsArrayBuffer(file); input.value = ''; }

function handleIncomingFileChunk(p) { const tId = p.transferId; if (!fileTransferReceivers[tId]) { const mid = p.msgId || ('msg-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36)); appendProgressBarMsg(p.fileName, 'them', p.user, mid); fileTransferReceivers[tId] = { fileName: p.fileName, totalChunks: p.totalChunks, chunks: [], msgId: mid }; } const tr = fileTransferReceivers[tId]; tr.chunks[p.chunkIndex] = p.data; const got = tr.chunks.filter(Boolean).length; updateProgressUI(tr.msgId, Math.min(100, Math.floor((got / tr.totalChunks) * 100))); if (got === tr.totalChunks) { const joined = tr.chunks.join(''); const decBin = dec(joined, true); const bytes = new Uint8Array(decBin.length); for (let i = 0; i < decBin.length; i++) bytes[i] = decBin.charCodeAt(i); convertBarToLink(tr.msgId, tr.fileName, URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }))); delete fileTransferReceivers[tId]; } }

function appendProgressBarMsg(fileName, dir, user, msgId) {
  const box = document.getElementById('chat-box'); if (!box) return; const msg = document.createElement('div'); msg.className = `msg ${dir}`; msg.id = msgId; msg.setAttribute('data-msg-type', 'file'); msg.setAttribute('data-sender-peer-id', user.originalPeerId || peer?.id || ''); msg.addEventListener('contextmenu', e => { e.preventDefault(); openCtxMenu(e, msgId, msg); }); const sTag = document.createElement('span'); sTag.className = 'sender-tag'; sTag.innerText = dir === 'me' ? 'You' : `${user.emoji} ${user.name}`; const info = document.createElement('span'); info.className = 'file-info-label'; info.innerText = `Sending: "${fileName}"`; const pw = document.createElement('div'); pw.className = 'progress-wrapper'; pw.style.display = 'block'; const pf = document.createElement('div'); pf.className = 'progress-fill'; pf.id = 'FILL-' + msgId; pw.appendChild(pf); const ts = document.createElement('span'); ts.className = 'msg-timestamp'; ts.innerText = nowTS(); const rb = document.createElement('div'); rb.className = 'reaction-bar'; rb.id = 'rbar-' + msgId; msg.appendChild(sTag); msg.appendChild(info); msg.appendChild(pw); msg.appendChild(ts); msg.appendChild(rb); box.appendChild(msg); box.scrollTop = box.scrollHeight; }

function updateProgressUI(id, pct) { const f = document.getElementById('FILL-' + id); if (f) f.style.width = pct + '%'; }
function convertBarToLink(id, fileName, url) { const el = document.getElementById(id); if (!el) return; const pw = el.querySelector('.progress-wrapper'); if (pw) pw.remove(); const lbl = el.querySelector('.file-info-label'); if (lbl) lbl.remove(); const a = document.createElement('a'); a.href = url; a.download = fileName; a.className = 'file-download-btn'; a.innerHTML = `📎 "${fileName}"`; el.appendChild(a); const chatBox = document.getElementById('chat-box'); if (chatBox) chatBox.scrollTop = 99999; }

// ============================================
// Chat Input
// ============================================

function handleChatInput(ta) { const val = ta.value; const mentionDD = document.getElementById('mention-dropdown'); const slashDD = document.getElementById('slash-dropdown'); if (val.startsWith('/')) { const partial = val.toLowerCase(); const matches = SLASH_COMMANDS.filter(c => c.cmd.startsWith(partial) || partial === '/'); if (matches.length > 0 && isHost) { slashDD.innerHTML = ''; matches.forEach(sc => { const item = document.createElement('div'); item.className = 'slash-item'; item.innerHTML = `<span class="slash-cmd">${sc.cmd}</span><span class="slash-desc">&nbsp;${sc.syntax} — ${sc.desc}</span>`; item.onclick = () => { ta.value = sc.cmd + ' '; slashDD.style.display = 'none'; ta.focus(); }; slashDD.appendChild(item); }); slashDD.style.display = 'block'; if (mentionDD) mentionDD.style.display = 'none'; return; } } if (slashDD) slashDD.style.display = 'none'; const atIdx = val.lastIndexOf('@'); if (atIdx !== -1 && atIdx === val.length - 1) { if (mentionDD) { mentionDD.innerHTML = ''; let cnt = 0; connections.forEach(c => { if (!c.open) return; const p = participantsProfileMap[c.peer] || { name: 'Unknown', emoji: '👤' }; const opt = document.createElement('div'); opt.className = 'mention-item'; opt.innerHTML = `<span>${p.emoji}</span><span>${p.name}</span>`; opt.onclick = () => applyWhisperTarget(c.peer, p.name); mentionDD.appendChild(opt); cnt++; }); mentionDD.style.display = cnt > 0 ? 'block' : 'none'; } if (slashDD) slashDD.style.display = 'none'; } else if (!val.includes('@')) { if (mentionDD) mentionDD.style.display = 'none'; whisperTargetPeerId = null; } }

function handleChatKeydown(e) { if (e.key === 'Escape') { const md = document.getElementById('mention-dropdown'), sd = document.getElementById('slash-dropdown'); if (md) md.style.display = 'none'; if (sd) sd.style.display = 'none'; } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function applyWhisperTarget(pId, name) { const inp = document.getElementById('msg-input'); whisperTargetPeerId = pId; const atIdx = inp.value.lastIndexOf('@'); inp.value = inp.value.substring(0, atIdx) + `@${name} [Private]: `; const md = document.getElementById('mention-dropdown'); if (md) md.style.display = 'none'; inp.focus(); }
function triggerMuteShake() { const ta = document.getElementById('msg-input'); if (ta) { ta.classList.remove('muted-shake'); void ta.offsetWidth; ta.classList.add('muted-shake'); setTimeout(() => ta.classList.remove('muted-shake'), 400); } }

function sendMessage() {
  const input = document.getElementById('msg-input'); if (!input) return; const text = input.value.trim(); if (!text) return;
  if (!isHost && iAmEffectivelyMuted()) { triggerMuteShake(); showAlertBanner('🔇 You are muted and cannot send messages.'); return; }
  if (text === '/clear') { if (!isHost) { showAlertBanner('Only the host can clear the chat.'); input.value = ''; return; } document.getElementById('chat-box').innerHTML = ''; messageReactions = {}; broadcastToMesh({ type: 'clear-chat' }); input.value = ''; return; }
  if (text.startsWith('/announce')) { if (!isHost) { showAlertBanner('❌ Only the host can send announcements.'); input.value = ''; return; } const p = parseAnnounce(text); if (!p) { showAlertBanner('⚠️ Usage: /announce (colour) (size%) (message) — e.g. /announce #e74c3c 150% Welcome!'); return; } const mid = 'msg-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36); appendAnnouncement(p.message, p.colour, p.sizePct, mid); broadcastToMesh({ type: 'announcement', message: p.message, colour: p.colour, sizePct: p.sizePct, msgId: mid }); input.value = ''; return; }
  const encrypted = enc(text); const mid = 'msg-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36); processedMessageIds.add(mid);
  const replyData = replyTargetMsgId ? { msgId: replyTargetMsgId, sender: replyTargetSender, text: replyTargetText } : null;
  if (whisperTargetPeerId) { const dc = connections.find(c => c.peer === whisperTargetPeerId); if (dc && dc.open) { dc.send({ type: 'whisper', payload: encrypted, user: myUser, msgId: mid, senderPeerId: peer.id }); appendMessage(`[You Whispered]: ${text}`, 'me', myUser, true, mid, peer.id, null); } else alert('Target not available.'); whisperTargetPeerId = null; } else { broadcastToMesh({ type: 'chat', payload: encrypted, user: myUser, msgId: mid, senderPeerId: peer.id, replyTo: replyData }); appendMessage(text, 'me', myUser, false, mid, peer.id, replyData); }
  input.value = ''; cancelReply(); const sd = document.getElementById('slash-dropdown'), md = document.getElementById('mention-dropdown'); if (sd) sd.style.display = 'none'; if (md) md.style.display = 'none';
}

function appendMessage(text, dir, user, isWhisper = false, msgId = '', senderId = '', replyTo = null) {
  const box = document.getElementById('chat-box'); if (!box) return; const msg = document.createElement('div'); msg.className = `msg ${dir} ${isWhisper ? 'whisper' : ''}`; if (msgId) msg.id = msgId; if (senderId) msg.setAttribute('data-sender-peer-id', senderId); msg.addEventListener('contextmenu', e => { e.preventDefault(); openCtxMenu(e, msgId, msg); }); const sTag = document.createElement('span'); sTag.className = 'sender-tag'; sTag.innerText = dir === 'me' ? 'You' : `${user.emoji} ${user.name}`; msg.appendChild(sTag); if (replyTo) { const rq = document.createElement('div'); rq.className = 'reply-quote'; rq.innerHTML = `<div class="rq-sender">🔄 ${replyTo.sender || 'Unknown'}</div><div class="rq-text">${String(replyTo.text || '').replace(/</g, '&lt;')}</div>`; msg.appendChild(rq); } msg.appendChild(document.createTextNode(text)); const ts = document.createElement('span'); ts.className = 'msg-timestamp'; ts.innerText = nowTS(); msg.appendChild(ts); const rb = document.createElement('div'); rb.className = 'reaction-bar'; rb.id = 'rbar-' + msgId; msg.appendChild(rb); box.appendChild(msg); box.scrollTop = box.scrollHeight; }

function appendAnnouncement(message, colour, sizePct, msgId) {
  const box = document.getElementById('chat-box'); if (!box) return; const fg = contrastCol(colour); const msg = document.createElement('div'); msg.className = 'msg announcement'; if (msgId) msg.id = msgId; msg.setAttribute('data-msg-type', 'announcement'); msg.setAttribute('data-sender-peer-id', peer ? peer.id : ''); msg.style.background = colour; msg.style.color = fg; const fontSize = Math.max(11, Math.round(13 * (sizePct / 100))); msg.style.fontSize = fontSize + 'px'; const lbl = document.createElement('span'); lbl.className = 'announce-label'; lbl.style.color = fg; lbl.style.fontSize = '9px'; lbl.innerText = '📢 Announcement'; const txt = document.createElement('span'); txt.className = 'announce-text'; txt.innerText = message; const ts = document.createElement('span'); ts.className = 'msg-timestamp'; ts.style.color = fg; ts.style.opacity = '.6'; ts.innerText = nowTS(); msg.appendChild(lbl); msg.appendChild(txt); msg.appendChild(ts); msg.addEventListener('contextmenu', e => { e.preventDefault(); openCtxMenu(e, msgId, msg); }); box.appendChild(msg); box.scrollTop = box.scrollHeight; }

// ============================================
// Message Editing
// ============================================

function handleRemoteEdit(data) {
  const el = document.getElementById(data.msgId); if (!el) return;
  if (data.action === 'delete') { el.remove(); delete messageReactions[data.msgId]; return; }
  if (data.action === 'edit') { const ann = el.querySelector('.announce-text'); if (ann) { ann.innerText = data.newText; return; } const sTag = el.querySelector('.sender-tag'), rBar = el.querySelector('.reaction-bar'), ts = el.querySelector('.msg-timestamp'), rq = el.querySelector('.reply-quote'); el.innerHTML = ''; if (sTag) el.appendChild(sTag); if (rq) el.appendChild(rq); el.appendChild(document.createTextNode(data.newText)); if (ts) el.appendChild(ts); if (rBar) el.appendChild(rBar); }
  if (data.action === 'reaction-clear') { messageReactions[data.msgId] = {}; renderReactionBar(data.msgId); }
}

// ============================================
// Reactions
// ============================================

function applyReaction(emoji) {
  if (!ctxTargetMsgId) return; if (!isHost && getMyRestrictions().noReact) { showAlertBanner('❌ Reactions disabled by host.'); closeCtxMenu(); return; }
  const targetEl = document.getElementById(ctxTargetMsgId); if (targetEl) { const ts = targetEl.getAttribute('data-sender-peer-id'); if (ts && ts !== peer?.id) { const tp = peerRestrictions[ts] || {}; if (tp.noReact && !isHost) { showAlertBanner('❌ The sender has reactions disabled.'); closeCtxMenu(); return; } } }
  const msgId = ctxTargetMsgId; closeCtxMenu(); if (!messageReactions[msgId]) messageReactions[msgId] = {}; if (!messageReactions[msgId][emoji]) messageReactions[msgId][emoji] = [];
  if (!isHost) { let wasToggle = false; for (const e in messageReactions[msgId]) { const idx = messageReactions[msgId][e].findIndex(r => r.peerId === peer.id); if (idx !== -1) { if (e === emoji) wasToggle = true; messageReactions[msgId][e].splice(idx, 1); if (!messageReactions[msgId][e].length) delete messageReactions[msgId][e]; } } if (wasToggle) { renderReactionBar(msgId); broadcastToMesh({ type: 'reaction-update', msgId, reactions: messageReactions[msgId] }); return; } }
  if (!messageReactions[msgId][emoji].some(r => r.peerId === peer.id)) messageReactions[msgId][emoji].push({ peerId: peer.id, userName: myUser.name, emoji }); renderReactionBar(msgId); broadcastToMesh({ type: 'reaction-update', msgId, reactions: messageReactions[msgId] });
}
function addCustomReactionFromCtx() { const v = document.getElementById('ctx-custom-emoji-input').value.trim(); if (!v) return; applyReaction(v); }
function applyReactionData(msgId, reactions) { messageReactions[msgId] = reactions; renderReactionBar(msgId); }
function renderReactionBar(msgId) { const bar = document.getElementById('rbar-' + msgId); if (!bar) return; bar.innerHTML = ''; const data = messageReactions[msgId] || {}; Object.entries(data).forEach(([emoji, reactors]) => { if (!reactors.length) return; const pill = document.createElement('div'); pill.className = 'reaction-pill'; if (reactors.some(r => r.peerId === peer.id)) pill.classList.add('mine'); pill.title = reactors.map(r => r.userName).join(', '); pill.innerHTML = `${emoji} <span class="r-count">${reactors.length}</span>`; pill.onclick = () => { ctxTargetMsgId = msgId; applyReaction(emoji); }; bar.appendChild(pill); }); }

// ============================================
// Context Menu
// ============================================

function openCtxMenu(e, msgId, el) { ctxTargetMsgId = msgId; ctxTargetMsgEl = el; const menu = document.getElementById('ctx-menu'); if (!menu) return; const ri = document.getElementById('ctx-reply-item'), hs = document.getElementById('ctx-host-section'); if (ri) ri.style.display = (!isHost && getMyRestrictions().noReply) ? 'none' : 'flex'; if (hs) hs.style.display = isHost ? 'block' : 'none'; menu.classList.add('open'); menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px'; requestAnimationFrame(() => { const r = menu.getBoundingClientRect(); if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 8) + 'px'; if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 8) + 'px'; }); const ci = document.getElementById('ctx-custom-emoji-input'); if (ci) ci.value = ''; }
function closeCtxMenu() { const menu = document.getElementById('ctx-menu'); if (menu) menu.classList.remove('open'); ctxTargetMsgId = null; ctxTargetMsgEl = null; }
function ctxReply() { if (!ctxTargetMsgId || !ctxTargetMsgEl) return; if (!isHost && getMyRestrictions().noReply) { showAlertBanner('❌ Replies disabled by host.'); closeCtxMenu(); return; } const sTag = ctxTargetMsgEl.querySelector('.sender-tag'); const textNode = [...ctxTargetMsgEl.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()); const annText = ctxTargetMsgEl.querySelector('.announce-text'); replyTargetMsgId = ctxTargetMsgId; replyTargetSender = sTag ? sTag.innerText : 'Unknown'; replyTargetText = annText ? annText.innerText : (textNode ? textNode.textContent.trim() : '[file]'); const pt = document.getElementById('reply-preview-text'); if (pt) pt.innerText = `🔄 ${replyTargetSender}: "${replyTargetText.substring(0, 60)}"`; const pb = document.getElementById('reply-preview-bar'); if (pb) pb.classList.add('active'); const mi = document.getElementById('msg-input'); if (mi) mi.focus(); closeCtxMenu(); }
function cancelReply() { replyTargetMsgId = null; replyTargetSender = null; replyTargetText = null; const pb = document.getElementById('reply-preview-bar'); if (pb) pb.classList.remove('active'); }
function ctxHostEdit() { if (!isHost || !ctxTargetMsgId || !ctxTargetMsgEl) return; const msgId = ctxTargetMsgId, el = ctxTargetMsgEl; closeCtxMenu(); if (el.getAttribute('data-msg-type') === 'file') { alert('File messages can only be deleted, not edited.'); return; } const annText = el.querySelector('.announce-text'); const textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()); const old = annText ? annText.innerText : (textNode ? textNode.textContent.trim() : ''); const nv = prompt('Edit content:', old); if (nv === null) return; if (annText) { annText.innerText = nv; } else { const sTag = el.querySelector('.sender-tag'), rBar = el.querySelector('.reaction-bar'), ts = el.querySelector('.msg-timestamp'), rq = el.querySelector('.reply-quote'); el.innerHTML = ''; if (sTag) el.appendChild(sTag); if (rq) el.appendChild(rq); el.appendChild(document.createTextNode(nv)); if (ts) el.appendChild(ts); if (rBar) el.appendChild(rBar); } broadcastToMesh({ type: 'global-msg-edit', action: 'edit', msgId, newText: nv }); }
function ctxHostDelete() { if (!isHost || !ctxTargetMsgId) return; const msgId = ctxTargetMsgId; closeCtxMenu(); const el = document.getElementById(msgId); if (el) el.remove(); delete messageReactions[msgId]; broadcastToMesh({ type: 'global-msg-edit', action: 'delete', msgId }); }
function ctxHostManageReactions() { if (!isHost || !ctxTargetMsgId) return; const msgId = ctxTargetMsgId; closeCtxMenu(); const data = messageReactions[msgId] || {}; if (!Object.keys(data).length) { alert('No reactions on this message.'); return; } let lines = []; Object.entries(data).forEach(([emoji, reactors]) => reactors.forEach(r => lines.push({ emoji, peerId: r.peerId, userName: r.userName }))); const summary = 'Reactions:\n' + lines.map((l, i) => `${i + 1}. ${l.emoji} by ${l.userName}`).join('\n') + '\n\nType number to remove, or "clear" to wipe all:'; const ans = prompt(summary); if (ans === null) return; if (ans.trim().toLowerCase() === 'clear') { messageReactions[msgId] = {}; renderReactionBar(msgId); broadcastToMesh({ type: 'global-msg-edit', action: 'reaction-clear', msgId }); return; } const idx = parseInt(ans, 10) - 1; if (isNaN(idx) || idx < 0 || idx >= lines.length) { alert('Invalid.'); return; } const l = lines[idx]; const arr = messageReactions[msgId][l.emoji]; if (arr) { const i = arr.findIndex(r => r.peerId === l.peerId); if (i !== -1) arr.splice(i, 1); if (!arr.length) delete messageReactions[msgId][l.emoji]; } renderReactionBar(msgId); broadcastToMesh({ type: 'reaction-update', msgId, reactions: messageReactions[msgId] || {} }); }

// ============================================
// Waiting Room
// ============================================

function addKnockCard(connId) { const k = pendingKnockers[connId]; if (!k) return; PERM_DEFS.forEach(d => { k.entryPerms[d.key] = false; }); const stack = document.getElementById('knock-stack'); if (!stack) return; const card = document.createElement('div'); card.className = 'knock-card'; card.id = 'knock-' + connId; card.innerHTML = `<div class="knock-header">🚪 Wants to join</div><div class="knock-name">${k.user.emoji} ${k.user.name}</div><div class="knock-btn-row"><button class="btn-success" onclick="admitKnocker('${connId}')">✅ Admit</button><button class="btn-danger" onclick="denyKnocker('${connId}')">❌ Deny</button></div><div class="knock-toggle-row"><span class="knock-toggle" onclick="toggleKnockInfo('${connId}')">ℹ️ Device info</span><span class="knock-toggle" onclick="toggleKnockMoreActions('${connId}')">⚙️ More actions</span></div><div id="knock-info-${connId}" class="knock-device-info">${formatDeviceInfo(k.deviceInfo)}</div><div id="knock-actions-${connId}" class="knock-more-actions"><div style="font-size:11px;font-weight:bold;color:var(--text3);margin-bottom:4px;">Entry restrictions for this user:</div>${PERM_DEFS.map(d => `<div class="knock-perm-row"><span>${d.label}</span><label class="toggle-switch"><input type="checkbox" id="kp-${connId}-${d.key}" onchange="setKnockPerm('${connId}','${d.key}',this.checked)"><span class="toggle-slider"></span></label></div>`).join('')}</div>`; stack.appendChild(card); updateKnockCountBar(); }
function removeKnockCard(connId) { const el = document.getElementById('knock-' + connId); if (el) el.remove(); updateKnockCountBar(); }
function updateKnockCountBar() { const n = Object.keys(pendingKnockers).length; const bar = document.getElementById('knock-count-bar'); if (bar) { if (n > 1) { bar.innerText = `${n} people waiting to join`; bar.style.display = 'block'; } else { bar.style.display = 'none'; } } }
function toggleKnockInfo(connId) { const el = document.getElementById('knock-info-' + connId); if (el) el.classList.toggle('open'); }
function toggleKnockMoreActions(connId) { const el = document.getElementById('knock-actions-' + connId); if (el) el.classList.toggle('open'); }
function setKnockPerm(connId, key, val) { if (pendingKnockers[connId]) pendingKnockers[connId].entryPerms[key] = val; }
function formatDeviceInfo(d) { if (!d) return 'No info available.'; return `🌐 <b>Browser:</b> ${d.browser||'?'}<br>💻 <b>Platform:</b> ${d.platform||'?'}<br>📺 <b>Screen:</b> ${d.screen||'?'}<br>🕐 <b>Timezone:</b> ${d.timezone||'?'}<br>🌍 <b>Language:</b> ${d.language||'?'}`; }
function admitKnocker(connId) { const k = pendingKnockers[connId]; if (!k) return; peerRestrictions[k.conn.peer] = k.entryPerms; k.conn.send({ type: 'knock-response', admitted: true, restrictions: k.entryPerms, roomRestrictions }); setupOutgoingDataConnection(k.conn); removeKnockCard(connId); delete pendingKnockers[connId]; }
function denyKnocker(connId) { const k = pendingKnockers[connId]; if (!k) return; k.conn.send({ type: 'knock-response', admitted: false }); k.conn.close(); removeKnockCard(connId); delete pendingKnockers[connId]; }

// ============================================
// Room Restrictions
// ============================================

function openApplyAll() { const rows = document.getElementById('apply-all-perm-rows'); if (!rows) return; rows.innerHTML = ''; PERM_DEFS.forEach(def => { const row = document.createElement('div'); row.className = 'perm-row'; row.innerHTML = `<span>${def.label}</span><label class="toggle-switch"><input type="checkbox" id="aa-${def.key}" ${roomRestrictions[def.key] ? 'checked' : ''}><span class="toggle-slider"></span></label>`; rows.appendChild(row); }); document.getElementById('apply-all-modal').style.display = 'block'; document.getElementById('modal-backdrop').style.display = 'block'; }
function confirmApplyAll() { const immediate = document.getElementById('apply-all-immediate').checked; PERM_DEFS.forEach(def => { roomRestrictions[def.key] = document.getElementById('aa-' + def.key).checked; }); broadcastToMesh({ type: 'room-restrictions', restrictions: roomRestrictions, immediate }); applyRoomRestrictionsLocally(roomRestrictions, immediate); closeAllModals(); showAlertBanner('📋 Room restrictions updated.'); }
function applyRoomRestrictionsLocally(r, immediate) { updateAttachBtn(); updateMutedLabel(); if (!immediate || isHost) return; if (r.noMic && localMicStream) toggleMicrophone(); if (r.noCam && localCamStream) toggleCamera(); if (r.noShare && localScreenStream) toggleScreenShare(); }

// ============================================
// Admin Modal
// ============================================

function openAdminModal(pId, profile) { if (!isHost && pId !== peer.id) return; selectedTargetPeerId = pId; document.getElementById('admin-modal-title').innerText = `Manage: ${profile.name}`; document.getElementById('admin-edit-name').value = profile.name; document.getElementById('admin-edit-emoji').value = profile.emoji; const isSelf = pId === peer.id; document.getElementById('admin-owner-btn').style.display = isSelf ? 'none' : 'block'; document.getElementById('admin-functional-controls').style.display = isSelf ? 'none' : 'flex'; const vb = document.getElementById('admin-vanish-btn'); if (vb) vb.innerText = isVanished(pId) ? '👻 Un-Vanish' : '👻 Vanish'; const pr = peerRestrictions[pId] || {}; const rows = document.getElementById('admin-perm-rows'); if (rows) { rows.innerHTML = ''; if (!isSelf) { PERM_DEFS.forEach(def => { if (def.key === 'noChat') return; const row = document.createElement('div'); row.className = 'admin-perm-item'; row.innerHTML = `<span>${def.label}</span><label class="toggle-switch"><input type="checkbox" id="pr-${def.key}" ${pr[def.key] ? 'checked' : ''} onchange="updatePeerRestriction('${pId}','${def.key}',this.checked)"><span class="toggle-slider"></span></label>`; rows.appendChild(row); }); } } const cmb = document.getElementById('admin-toggle-chat-btn'); if (cmb) cmb.innerText = profile.isChatMuted ? '✅ Unmute Chat' : '🚫 Mute Chat'; document.getElementById('modal-backdrop').style.display = 'block'; document.getElementById('admin-modal').style.display = 'block'; }
function updatePeerRestriction(pId, key, val) { if (!peerRestrictions[pId]) peerRestrictions[pId] = {}; peerRestrictions[pId][key] = val; const conn = connections.find(c => c.peer === pId); if (conn && conn.open) { conn.send({ type: 'peer-restrictions', restrictions: peerRestrictions[pId], roomRestrictions }); if (val) { const cmd = key === 'noMic' ? 'mute' : key === 'noCam' ? 'stop-cam' : key === 'noShare' ? 'stop-share' : null; if (cmd) conn.send({ type: 'admin-command', command: cmd }); } } }
function closeAllModals() { ['admin-modal','settings-modal','apply-all-modal'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; }); document.getElementById('modal-backdrop').style.display = 'none'; selectedTargetPeerId = null; }
function executeProfileChange() { if (!selectedTargetPeerId) return; const nn = document.getElementById('admin-edit-name').value.trim(), ne = document.getElementById('admin-edit-emoji').value.trim(); if (!nn || !ne) return alert('Values cannot be empty.'); const past = document.getElementById('admin-affect-past').checked; if (selectedTargetPeerId === peer.id) { myUser.name = nn; myUser.emoji = ne; } else { const tp = participantsProfileMap[selectedTargetPeerId]; if (tp) { tp.name = nn; tp.emoji = ne; } } if (past) { document.querySelectorAll('.msg').forEach(m => { if (m.getAttribute('data-sender-peer-id') === selectedTargetPeerId) { const s = m.querySelector('.sender-tag'); if (s) s.innerText = `${ne} ${nn}`; } }); broadcastToMesh({ type: 'global-identity-override', targetPeerId: selectedTargetPeerId, newName: nn, newEmoji: ne }); } if (isHost) broadcastRosterState(); else { connections.forEach(c => { if (c.open) c.send({ type: 'handshake-identity', user: myUser, isHost, hwToken: myDeviceHardwareToken }); }); rebuildPeopleRoster(); } closeAllModals(); }
function executeVanishToggle() { if (!isHost || !selectedTargetPeerId) return; const pId = selectedTargetPeerId; if (!peerRestrictions[pId]) peerRestrictions[pId] = {}; peerRestrictions[pId].vanished = !peerRestrictions[pId].vanished; const isNowVanished = peerRestrictions[pId].vanished; const vb = document.getElementById('admin-vanish-btn'); if (vb) vb.innerText = isNowVanished ? '👻 Un-Vanish' : '👻 Vanish'; broadcastToMesh({ type: 'vanish-sync', peerId: pId, vanished: isNowVanished }); const vProf = pId === peer.id ? myUser : (participantsProfileMap[pId] || { name: 'User', emoji: '👤' }); const fakeText = isNowVanished ? `${vProf.emoji} ${vProf.name} left.` : `${vProf.emoji} ${vProf.name} joined.`; const fakeMsgType = isNowVanished ? 'leave' : 'join'; appendSysMsg(fakeText, fakeMsgType); broadcastToMesh({ type: 'fake-sys-msg', text: fakeText, msgType: fakeMsgType }); rebuildPeopleRoster(); closeAllModals(); showAlertBanner(isNowVanished ? '👻 User is now vanished.' : '👻 User is now visible again.'); }
function executeOwnershipTransfer() { if (!isHost || !selectedTargetPeerId || selectedTargetPeerId === peer.id) return; const tp = participantsProfileMap[selectedTargetPeerId]; const name = tp ? tp.name : 'this user'; if (!confirm(`[1/3] Transfer ownership to ${name}?`)) return; if (!confirm('[2/3] You will lose ALL admin powers. Continue?')) return; if (!confirm(`[3/3] FINAL: Transfer to ${name}?`)) return; isHost = false; document.getElementById('pardon-box-root').style.display = 'none'; document.getElementById('apply-all-btn').style.display = 'none'; updatePrivacyBtns(); participantsProfileMap[selectedTargetPeerId].isHost = true; participantsProfileMap[peer.id] = { ...myUser, isHost: false, pId: peer.id }; broadcastRosterState(); closeAllModals(); showAlertBanner(`👑 Ownership passed to: ${tp.emoji} ${tp.name}`); }
function executeRemoteCommand(cmd) { if (!isHost || !selectedTargetPeerId || selectedTargetPeerId === peer.id) return; const tc = connections.find(c => c.peer === selectedTargetPeerId); if (cmd === 'toggle-chat-mute') { if (participantsProfileMap[selectedTargetPeerId]) participantsProfileMap[selectedTargetPeerId].isChatMuted = !participantsProfileMap[selectedTargetPeerId].isChatMuted; broadcastRosterState(); closeAllModals(); return; } if (cmd === 'ban' && tc && tc.hardwareDeviceToken) { const tok = tc.hardwareDeviceToken; if (!bannedHardwareTokens.includes(tok)) { bannedHardwareTokens.push(tok); const sel = document.getElementById('pardon-select'); if (sel) { const opt = document.createElement('option'); opt.value = tok; opt.innerText = `${tokenToNameMapping[tok] || 'Banned'} [${tok.substring(0, 8)}]`; sel.appendChild(opt); } } } connections.forEach(c => { if (c.peer === selectedTargetPeerId && c.open) { c.send({ type: 'admin-command', command: cmd }); if (cmd === 'kick' || cmd === 'ban') c.close(); } }); closeAllModals(); }
function executePardon() { if (!isHost) return; const sel = document.getElementById('pardon-select'); if (!sel) return; const tok = sel.value; if (!tok) return alert('Select a banned device.'); bannedHardwareTokens = bannedHardwareTokens.filter(t => t !== tok); sel.remove(sel.selectedIndex); alert('Ban lifted.'); }
function handleAdminCommand(cmd) { switch (cmd) { case 'mute': if (localMicStream) toggleMicrophone(); break; case 'stop-cam': if (localCamStream) toggleCamera(); break; case 'stop-share': if (localScreenStream) toggleScreenShare(); break; case 'kick-limit': roomCode = ''; alert('This room is full (5 person limit). Please try again later.'); window.location.reload(); break; case 'kick': roomCode = ''; alert('You were kicked.'); window.location.reload(); break; case 'ban': roomCode = ''; alert('You were kicked and banned.'); window.location.reload(); break; } }

// ============================================
// Vanish System
// ============================================

function vanishWarnAndProceed(action) { if (isVanished(peer.id)) { if (!confirm(`⚠️ You are vanished. Starting ${action} will reveal your presence to the room. Continue?`)) return false; if (peerRestrictions[peer.id]) peerRestrictions[peer.id].vanished = false; broadcastToMesh({ type: 'vanish-sync', peerId: peer.id, vanished: false }); appendSysMsg(`${myUser.emoji} ${myUser.name} joined.`, 'join'); broadcastToMesh({ type: 'fake-sys-msg', text: `${myUser.emoji} ${myUser.name} joined.`, msgType: 'join' }); rebuildPeopleRoster(); } return true; }

// ============================================
// Media Functions
// ============================================

async function toggleCamera() { if (!isHost && (peerRestrictions[peer.id] || {}).noCam && !localCamStream) { showAlertBanner('❌ Camera disabled by host.'); return; } if (!localCamStream && !vanishWarnAndProceed('camera')) return; const btn = document.getElementById('cam-btn'); if (!btn) return; if (localCamStream) { localCamStream.getTracks().forEach(t => t.stop()); removeMediaWrapper(peer.id + '-cam'); localCamStream = null; btn.innerText = '📷 Turn Camera On'; btn.className = ''; broadcastToMesh({ type: 'media-disconnect', targetId: peer.id + '-cam' }); } else await startCamera(480); }
async function startCamera(h) { const btn = document.getElementById('cam-btn'); if (!btn) return; const w = Math.round(h * 16 / 9); try { localCamStream = await navigator.mediaDevices.getUserMedia({ video: { width: { exact: w }, height: { exact: h } }, audio: false }); } catch (e) { try { localCamStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: w }, height: { ideal: h } }, audio: false }); } catch (e2) { alert('Camera rejected.'); return; } } btn.innerText = '📷 Turn Camera Off'; btn.className = 'btn-danger'; addMediaWrapper(peer.id + '-cam', localCamStream, `${myUser.emoji} ${myUser.name} (You)`); connections.forEach(c => { if (c.open) peer.call(c.peer, localCamStream, { metadata: { id: peer.id + '-cam', label: `${myUser.emoji} ${myUser.name}` } }); }); }
async function toggleMicrophone() { if (!isHost && (peerRestrictions[peer.id] || {}).noMic && !localMicStream) { showAlertBanner('❌ Mic disabled by host.'); return; } if (!localMicStream && !vanishWarnAndProceed('microphone')) return; const btn = document.getElementById('mic-btn'); if (!btn) return; if (localMicStream) { localMicStream.getTracks().forEach(t => t.stop()); localMicStream = null; btn.innerText = '🎤 Turn Mic On'; btn.className = ''; } else { try { localMicStream = await navigator.mediaDevices.getUserMedia({ audio: true }); btn.innerText = '🎤 Turn Mic Off'; btn.className = 'btn-danger'; connections.forEach(c => { if (c.open) peer.call(c.peer, localMicStream, { metadata: { id: peer.id + '-mic' } }); }); } catch (e) { alert('Mic failed.'); } } }
async function toggleScreenShare() { if (!isHost && (peerRestrictions[peer.id] || {}).noShare && !localScreenStream) { showAlertBanner('❌ Screen share disabled by host.'); return; } if (!localScreenStream && !vanishWarnAndProceed('screen share')) return; const btn = document.getElementById('share-btn'); if (!btn) return; if (localScreenStream) { localScreenStream.getTracks().forEach(t => t.stop()); removeMediaWrapper(peer.id + '-screen'); localScreenStream = null; btn.innerText = '🖥️ Share Screen'; btn.className = ''; broadcastToMesh({ type: 'media-disconnect', targetId: peer.id + '-screen' }); } else { try { localScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true }); btn.innerText = '🛑 Stop Sharing'; btn.className = 'btn-danger'; addMediaWrapper(peer.id + '-screen', localScreenStream, `${myUser.name}'s Screen`); connections.forEach(c => { if (c.open) peer.call(c.peer, localScreenStream, { metadata: { id: peer.id + '-screen', label: `${myUser.name}'s Screen` } }); }); localScreenStream.getVideoTracks()[0].onended = () => { if (!localScreenStream) return; removeMediaWrapper(peer.id + '-screen'); localScreenStream = null; btn.innerText = '🖥️ Share Screen'; btn.className = ''; broadcastToMesh({ type: 'media-disconnect', targetId: peer.id + '-screen' }); }; } catch (err) { console.error(err); } } }
function setupIncomingMediaCall(call) { call.answer(); call.on('stream', stream => { const id = call.metadata?.id || call.peer, lbl = call.metadata?.label || 'Remote'; if (id.endsWith('-mic')) { const a = document.createElement('audio'); a.srcObject = stream; a.autoplay = true; document.body.appendChild(a); } else addMediaWrapper(id, stream, lbl); }); }
function addMediaWrapper(id, stream, label) { if (document.getElementById(id)) return; const wrap = document.createElement('div'); wrap.id = id; wrap.className = 'video-wrapper'; const vid = document.createElement('video'); vid.srcObject = stream; vid.autoplay = true; vid.playsInline = true; const lbl = document.createElement('div'); lbl.className = 'video-tag'; lbl.innerText = label; const fs = document.createElement('button'); fs.className = 'fullscreen-btn'; fs.innerText = '⛶ Fullscreen'; fs.onclick = () => { if (vid.requestFullscreen) vid.requestFullscreen(); else if (vid.webkitRequestFullscreen) vid.webkitRequestFullscreen(); }; wrap.appendChild(vid); wrap.appendChild(lbl); wrap.appendChild(fs); const mediaGrid = document.getElementById('media-grid'); if (mediaGrid) mediaGrid.appendChild(wrap); }
function removeMediaWrapper(id) { const el = document.getElementById(id); if (el) el.remove(); }
