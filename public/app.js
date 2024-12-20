const socket = io();

const deviceList = document.getElementById('deviceList');
const overlay = document.getElementById('overlay');

const textSelection = document.getElementById('textSelection');
const fileSelection = document.getElementById('fileSelection');

const textTab = document.getElementById('onText');
const fileTab = document.getElementById('onFile');

const textInput = document.getElementById('textInput');
const fileInput = document.getElementById('fileInput');

const formMessage = document.getElementById('formMessage');

const sendButton = document.getElementById('sendButton');
const acceptButton = document.getElementById('acceptButton');
const rejectButton = document.getElementById('rejectButton');
const copyButton = document.getElementById('copyButton');

let selectedDeviceId = null;
let tab = 'text';
let requestType = "text";
let requestFrom = null;

socket.on('updateDevices', (devices) => {
    deviceList.innerHTML = '';

    Object.entries(devices).forEach(([id, { userAgent, ip }]) => {
        const listItem = document.createElement('div');
        listItem.classList.add('device');
        listItem.textContent = `${userAgent} (${ip})`;
        listItem.id = id;
        deviceList.appendChild(listItem);
    });
});

deviceList.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('device')) {
        selectedDeviceId = target.id
        showOverlay('sendform');
    }
});

overlay.addEventListener('mousedown', (event) => {
    if (event.target === event.currentTarget) {
        hideOverlay();
    }
});

socket.on('receiveFileRequest', ({ sender, senderId, fileName }) => {
    showOverlay('requestform');
    document.getElementById('requestMessage').textContent = `${sender} wants to send you a file: ${fileName}`;
    requestType = "file";
    requestFrom = senderId;
});

socket.on('receiveTextRequest', ({ sender, senderId, text }) => {
    showOverlay('requestform');
    document.getElementById('requestMessage').textContent = `${sender} wants to send you a text`;
    requestType = "text";
    requestFrom = senderId;
});

acceptButton.addEventListener('click', (event) => {
    socket.emit(requestType === "text" ? 'acceptText' : 'acceptFile', { targetId: requestFrom });
    hideOverlay();
});

rejectButton.addEventListener('click', (event) => {
    socket.emit(requestType === "text" ? 'rejectText' : 'rejectFile', { targetId: requestFrom })
    hideOverlay();
})

socket.on('receiveText', ({ text }) => {
    showOverlay('messageform')
    formMessage.value = text;
    // window.navigator.clipboard.writeText(text);
})

copyButton.addEventListener('click', e => {
    window.navigator.clipboard.writeText(formMessage)
    new Clipboard().writeText(formMessage)
})

let fileChunks = [];
socket.on('receiveFile', ({ fileName, fileContent, chunkIndex, totalChunks }) => {
    showOverlay('messageform')
    fileChunks[chunkIndex] = fileContent;
    formMessage.textContent = `Download ${fileName} (${chunkIndex + 1}/${totalChunks})`
    if (fileChunks.length === totalChunks) {
        const blob = new Blob(fileChunks);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        fileChunks = [];
    }
})

function showOverlay(name) {
    overlay.style.display = 'block';
    Array.from(overlay.children).forEach((child) => {
        if (child.id === name) {
            child.style.display = 'block';
        }
    });
}

function hideOverlay() {
    overlay.style.display = 'none';
    Array.from(overlay.children).forEach((child) => {
        child.style.display = 'none';
    });
    
    selectedDeviceId = null;
    tab = 'text';
    requestType = "text";
    requestFrom = null;
}

textSelection.addEventListener('click', (event) => {
    textTab.style.display = 'block';
    fileTab.style.display = 'none';
    tab = 'text';
});

fileSelection.addEventListener('click', (event) => {
    textTab.style.display = 'none';
    fileTab.style.display = 'block';
    tab = 'file';
});

sendButton.addEventListener('click', (event) => {
    const text = textInput.value;
    const file = fileInput.files[0];
    const targetId = selectedDeviceId;

    if (tab === 'text') {
        if (!text.trim()) {
            alert('No text entered');
            return;
        }
        socket.emit('requestText', { targetId })
        socket.once('receiveTextAccept', () => {
            socket.emit('sendText', { targetId, text });
        })
    } else if (tab === 'file') {
        if (!file) {
            alert('No file selected');
            return;
        }
        socket.emit('requestFile', { targetId, fileName: file.name })
        socket.once('receiveTextAccept', () => {
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
        })
    }
});
