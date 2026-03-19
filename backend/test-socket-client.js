const io = require('socket.io-client');

// 1. Get this from your Step 1 (HTTP POST /device/generate-code)
// It's the 'temp_auth_key' in your database.
const AUTH_KEY = 'faba4ac4fc229276128a83e82ef4f670'; 
const SERVER_URL = 'http://localhost:5000';

console.log('🔌 Connecting to:', SERVER_URL);

const socket = io(SERVER_URL, {
    auth: {
        authKey: AUTH_KEY,
        timestamp: Date.now()
    },
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log('✅ CONNECTED TO AEKADS SERVER');
    
    // STEP 2: Poll for pairing status
    console.log('🔍 Checking for pairing...');
    socket.emit('checkForPairing');

    // STEP 2/RESTART: Request playlist data
    console.log('📥 Requesting player data...');
    socket.emit('playerData');
});

// IMPORTANT: Your server sends EVERYTHING via the "message" event
socket.on('message', (payload) => {
    console.log('📩 New Message Received:');

    // Case 1: Plain JSON (Step 4 - Pairing Confirmation)
    if (payload.message && payload.message[0].response_type === 'screen_linked') {
        console.log('🔗 SCREEN LINKED SUCCESSFULLY:', payload.message[0]);
    } 
    // Case 2: Encrypted Data (Step 5/6 - Playlist or Commands)
    else {
        console.log('🔐 RECEIVED ENCRYPTED PAYLOAD (Playlist/Command)');
        console.log('Payload:', payload);
        // Use your AES Secret Key here to decrypt the 'payload'
    }
});

socket.on('connect_error', (err) => {
    console.log('❌ Auth/Connection Error:', err.message);
});

socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected:', reason);
});

