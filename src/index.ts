import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import QRCode from 'qrcode';
import path from 'path';
import os from 'os';

const app = express();
const server = http.createServer(app);
const MAX_HTTP_BUFFER = Number(process.env.SENDROP_MAX_BUFFER) || 64 * 1024 * 1024;
const io = new SocketIOServer(server, {
    // File chunks go through socket.io; bump the per-message limit so larger
    // individual chunks do not get dropped.
    maxHttpBufferSize: MAX_HTTP_BUFFER,
});

const PORT = Number(process.env.PORT) || 3000;

interface ConnectedDevice {
    ip: string | string[] | undefined;
    userAgent: string | undefined;
}

const connectedDevices: { [key: string]: ConnectedDevice } = {}; // 접속된 기기 정보를 저장

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', async (req, res) => {
    if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
        const networkInterfaces = os.networkInterfaces();
        let lanAddress = '';

        for (const iface of Object.values(networkInterfaces)) {
            if (!iface) continue;
            const filtered = iface.filter(alias =>
                alias.family === 'IPv4' &&
                !alias.internal &&
                !alias.address.endsWith('.1') &&
                alias.netmask !== '255.0.0.0'
            );
            if(filtered.length !== 0) lanAddress = `http://${filtered[0].address}:${PORT}`;
            if (lanAddress) break;
        }

        // QR 코드 생성
        const qrCode = await QRCode.toDataURL(lanAddress);
        res.send(`
            <html>
            <head>
                <title>Sendrop</title>
                <link rel="stylesheet" href="local.css" />
            </head>
            <body>
                <img src="${qrCode}" alt="QR Code" />
                <p>LAN Address: <a href="${lanAddress}">${lanAddress}</a></p>
            </body>
            </html>
        `);
    } else {
        res.redirect('/main.html');
    }
});


// Socket.IO 이벤트 처리
io.on('connection', (socket: Socket) => {
    const userAgentAll = socket.handshake.headers['user-agent']; // User-Agent 정보 가져오기
    const osMatch = userAgentAll?.match(/\(([^)]+)\)/);
    const browserMatch = userAgentAll?.match(/(?:Chrome|Firefox|Safari|Edge|Opera)\/(\d+\.\d+)/);
    const isMobile = /Mobile|Android|iP(ad|hone)/.test(userAgentAll || '') ? 'Mobile' : 'Desktop';
    const userAgent = `${osMatch ? osMatch[1] : 'Unknown OS'} - ${browserMatch ? browserMatch[0] : 'Unknown Browser'} - ${isMobile}`;
    const ip = socket.handshake.address; // IP 주소 가져오기

    // 기기 정보 저장
    connectedDevices[socket.id] = { ip, userAgent };

    socket.on("log", (...args) => {
        console.log(...args);
    });

    // 접속된 모든 기기에 업데이트
    io.emit('updateDevices', connectedDevices);

    // 파일 전송 요청
    socket.on('requestFile', ({ targetId, fileName }) => {
        io.to(targetId).emit('receiveFileRequest', { fileName, sender: connectedDevices[socket.id].userAgent, senderId: socket.id });
    });

    // 텍스트 전송 요청
    socket.on('requestText', ({ targetId }) => {
        io.to(targetId).emit('receiveTextRequest', { sender: connectedDevices[socket.id].userAgent, senderId: socket.id });
    });

    // 파일 전송 수락
    socket.on('acceptFile', ({ targetId }) => {
        io.to(targetId).emit('receiveFileAccept');
    });

    // 텍스트 전송 수락
    socket.on('acceptText', ({ targetId }) => {
        io.to(targetId).emit('receiveTextAccept');
    });

    // 파일 전송 거부
    socket.on('rejectFile', ({ targetId }) => {
        io.to(targetId).emit('receiveFileReject');
    });

    // 텍스트 전송 거부
    socket.on('rejectText', ({ targetId }) => {
        io.to(targetId).emit('receiveTextReject');
    });

    // 파일 전송 이벤트
    socket.on('sendFile', ({ targetId, fileName, fileContent, chunkIndex, totalChunks }) => {
        io.to(targetId).emit('receiveFile', { fileName, fileContent, chunkIndex, totalChunks });
    });

    // 텍스트 전송 이벤트
    socket.on('sendText', ({ targetId, text }) => {
        io.to(targetId).emit('receiveText', { text });
    });

    // 연결 해제 처리
    socket.on('disconnect', () => {
        delete connectedDevices[socket.id];
        io.emit('updateDevices', connectedDevices);
    });
});


function lanAddresses(): string[] {
    const addrs: string[] = [];
    const ifaces = os.networkInterfaces();
    for (const iface of Object.values(ifaces)) {
        if (!iface) continue;
        for (const alias of iface) {
            if (alias.family === 'IPv4' && !alias.internal) {
                addrs.push(`http://${alias.address}:${PORT}`);
            }
        }
    }
    return addrs;
}

server.listen(PORT, () => {
    console.log(`[*] Sendrop listening on :${PORT}`);
    const addrs = lanAddresses();
    if (addrs.length > 0) {
        console.log('[*] Reachable at:');
        for (const a of addrs) console.log(`      ${a}`);
    } else {
        console.log(`[*] Open http://localhost:${PORT}/ in your browser`);
    }
});

const shutdown = (signal: string) => {
    console.log(`received ${signal}, shutting down...`);
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
