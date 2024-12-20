const socket = io();

function socketLog(...args){
  socket.emit("log", ...args);
};

const timeoutMs = 3000;

const deviceList = document.getElementById('deviceList');
const overlay = document.getElementById('overlay');
const alerts = document.getElementById('alerts');

const textSelection = document.getElementById('textSelection');
const fileSelection = document.getElementById('fileSelection');

const textTab = document.getElementById('onText');
const fileTab = document.getElementById('onFile');

const textInput = document.getElementById('textInput');
const fileInput = document.getElementById('fileInput');

const formMessage = document.getElementById('formMessage');

const sendButton = document.getElementById('sendButton');
const copyButton = document.getElementById('copyButton');

let selectedDeviceId = null;
let tab = 'text';
let requestType = "text";
let requestFrom = null;

socket.on('updateDevices', (devices) => {
    deviceList.innerHTML = '';

    Object.entries(devices)
    .filter(([id, { userAgent, ip }]) => id !== socket.id)
    .forEach(([id, { userAgent, ip }]) => {
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
    addAlert(`File request from ${sender} for ${fileName}`, 'request');
    requestType = "file";
    requestFrom = senderId;
});

socket.on('receiveTextRequest', ({ sender, senderId }) => {
    addAlert(`Text request from ${sender}`, 'request');
    requestType = "text";
    requestFrom = senderId;
});

function addAlert(message, type, del = false, progress = 0) {
    if(del) Array.from(alerts.children).forEach((child, i) => {
        if(i === alerts.children.length - 1) child.remove();
    })
    const alert = document.createElement('div')
    alert.classList.add('alert');
    const col = document.createElement('div');
    col.classList.add('col');
    const alertMessage = document.createElement('p');
    alertMessage.textContent = message;
    col.appendChild(alertMessage);
    switch (type) {
        case 'request':
            const row = document.createElement('div');
            row.classList.add('row');
            const acceptButton = document.createElement('button');
            acceptButton.textContent = 'Accept';
            acceptButton.addEventListener('click', (event) => {
                socket.emit(requestType === "text" ? 'acceptText' : 'acceptFile', { targetId: requestFrom });
                alert.remove();
            }, {once: true});
            const rejectButton = document.createElement('button');
            rejectButton.textContent = 'Reject';
            rejectButton.addEventListener('click', (event) => {
                socket.emit(requestType === "text" ? 'rejectText' : 'rejectFile', { targetId: requestFrom });
                alert.remove();
            }, {once: true});
            row.appendChild(acceptButton);
            row.appendChild(rejectButton);
            col.appendChild(row);
            break;
        case 'progress':
            const progressBar = document.createElement('div');
            progressBar.classList.add('progress-bar');
            const progressFill = document.createElement('div');
            progressBar.appendChild(progressFill);
            progressFill.style.width = `${progress * 100}%`
            col.appendChild(progressBar);
            break;
        default:
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            closeButton.addEventListener('click', (event) => {
                alert.remove();
            }, {once: true});
            col.append(closeButton);
            break;
    }
    alert.append(col);
    alerts.append(alert);
    setTimeout(() => {
        if(alert) alert.remove()
    }, timeout);
}

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
    addAlert(`Receiving ${fileName} (${chunkIndex + 1}/${totalChunks})`, 'progress', true, (chunkIndex + 1) / totalChunks);
    fileChunks[chunkIndex] = fileContent;
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
            addAlert('No text entered', 'error');
            return;
        }
        socket.emit('requestText', { targetId })
        socket.once('receiveTextReject', () => {
            addAlert('Text transfer rejected', 'error');
            socket.removeAllListeners('receiveTextAccept');
        });
        socket.once('receiveTextAccept', () => {
            socket.removeAllListeners('receiveTextReject');
            socket.emit('sendText', { targetId, text });
        })
    } else if (tab === 'file') {
        if (!file) {
            addAlert('No file selected', 'error');
            return;
        }
        socket.emit('requestFile', { targetId, fileName: file.name })
        socket.once('receiveFileReject', () => {
            addAlert('File transfer rejected', 'error');
            socket.removeAllListeners('receiveFileAccept');
        })
        socket.once('receiveFileAccept', () => {
            socket.removeAllListeners('receiveFileReject');
            const chunkSize = 1024 * 4; // 4KB per chunk
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
                addAlert(`Sending file (${chunkIndex}/${totalChunks})`, 'progress', true, chunkIndex / totalChunks)
                const start = chunkIndex * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const blob = file.slice(start, end);
                reader.readAsArrayBuffer(blob);
            };
    
            loadNextChunk();
        })
    }
    addAlert('Request sent', 'info');
    hideOverlay();
});
