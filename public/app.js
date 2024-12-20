const socket = io();

const deviceList = document.getElementById('deviceList');
const dataTypeSelect = document.getElementById('dataType');
const textInput = document.getElementById('textInput');
const fileInput = document.getElementById('fileInput');
const textMessage = document.getElementById('textMessage');
const fileUpload = document.getElementById('fileUpload');
const sendButton = document.getElementById('sendButton');
const acceptButton = document.getElementById('acceptButton');
const rejectButton = document.getElementById('rejectButton');

// 기기 리스트 업데이트
socket.on('updateDevices', (devices) => {
    deviceList.innerHTML = '';
    targetDeviceSelect.innerHTML = '';

    Object.entries(devices).forEach(([id, { userAgent, ip }]) => {
        const listItem = document.createElement('li');
        listItem.textContent = `${userAgent} (${ip})`;
        deviceList.appendChild(listItem);

        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${userAgent} (${ip})`;
        targetDeviceSelect.appendChild(option);
    });
});

// 데이터 타입 변경 이벤트
dataTypeSelect.addEventListener('change', () => {
    const type = dataTypeSelect.value;
    textInput.style.display = type === 'text' ? 'block' : 'none';
    fileInput.style.display = type === 'file' ? 'block' : 'none';
});

// 데이터 전송 처리
sendForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const targetId = targetDeviceSelect.value;
    const type = dataTypeSelect.value;

    if (type === 'text') {
        const text = document.getElementById('textMessage').value;
        socket.emit('sendText', { targetId, text });
    } else if (type === 'file') {
        const file = document.getElementById('fileUpload').files[0];
        const chunkSize = 1024 * 1024; // 1MB per chunk
        const totalChunks = Math.ceil(file.size / chunkSize);

        const reader = new FileReader();
        let chunkIndex = 0;

        reader.onload = () => {
            socket.emit('sendFile', {
                targetId,
                fileName: file.name,
                fileContent: reader.result,
                chunkIndex,
                totalChunks,
            });
            chunkIndex++;
            if (chunkIndex < totalChunks) {
                loadNextChunk();
            }
        };

        const loadNextChunk = () => {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const blob = file.slice(start, end);
            reader.readAsArrayBuffer(blob);
        };

        loadNextChunk();
    }
});

// 수신 이벤트 처리
socket.on('receiveText', ({ text }) => {
    alert(`Received text: ${text}`);
});

socket.on('receiveFile', ({ fileName, fileContent }) => {
    const blob = new Blob([fileContent]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
});
