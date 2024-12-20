import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import QRCode from 'qrcode';
import path from 'path';
import os from 'os';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

const PORT = process.env.PORT || 3000;

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

    console.log(`Device connected: ${ip} - ${userAgent}`);

    // 기기 정보 저장
    connectedDevices[socket.id] = { ip, userAgent };

    // 접속된 모든 기기에 업데이트
    io.emit('updateDevices', connectedDevices);

    // 파일 전송 요청
    socket.on('requestFile', ({ targetId, fileName }) => {
        io.to(targetId).emit('receiveFileRequest', { fileName, sender: connectedDevices[socket.id].userAgent });
    });

    // 텍스트 전송 요청
    socket.on('requestText', ({ targetId }) => {
        io.to(targetId).emit('receiveTextRequest', { sender: connectedDevices[socket.id].userAgent });
    });

    // 파일 전송 수락
    socket.on('acceptFile', ({ targetId, fileName }) => {
        io.to(targetId).emit('receiveFileAccept', { fileName });
    });

    // 텍스트 전송 수락
    socket.on('acceptText', ({ targetId }) => {
        io.to(targetId).emit('receiveTextAccept');
    });

    // 파일 전송 거부
    socket.on('rejectFile', ({ targetId, fileName }) => {
        io.to(targetId).emit('receiveFileReject', { fileName });
    });

    // 텍스트 전송 거부
    socket.on('rejectText', ({ targetId }) => {
        io.to(targetId).emit('receiveTextReject');
    });

    // 파일 전송 이벤트
    socket.on('sendFile', ({ targetId, fileName, fileContent, chunkIndex, totalChunk }) => {
        io.to(targetId).emit('receiveFile', { fileName, fileContent, chunkIndex, totalChunk });
    });

    // 텍스트 전송 이벤트
    socket.on('sendText', ({ targetId, text }) => {
        io.to(targetId).emit('receiveText', { text });
    });

    // 연결 해제 처리
    socket.on('disconnect', () => {
        console.log(`Device disconnected: ${socket.id}`);
        delete connectedDevices[socket.id];
        io.emit('updateDevices', connectedDevices);
    });
});

server.listen(PORT, () => {
    console.log(`[*] Server running on port 127.0.0.1:${PORT}`);
});
