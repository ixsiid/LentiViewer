// const express = require('express');
const fs = require('fs');

const images_path = './public/image';

/**
 * サーバー開始関数
 * ----------------
 * サーバーは同期的に実行され、処理が戻ってきません。
 * 必要に応じて、async化してください
 * @param {number} port - listen port of static web page
 * @param {number} ws_port - listen port of web socket
 * 
 */
module.exports = (port = 80, ws_port = 81) => {
    // const app = express();

    const WebSocket = require('ws');
    const wss = new WebSocket.Server({
        port: ws_port,
        perMessageDeflate: {
            zlibDeflateOptions: {
                chunkSize: 1024,
                memLevel: 7,
                level: 3,
            },
            zlibInflateOptions: {
                chunkSize: 10 * 1024,
            },
            // Other options settable:
            clientNoContextTakeover: true, // Defaults to negotiated value.
            serverNoContextTakeover: true, // Defaults to negotiated value.
            serverMaxWindowBits: 10, // Defaults to negotiated value.
            // Below options specified as default values.
            concurrencyLimit: 10, // Limits zlib concurrency for perf.
            threshold: 1024 // Size (in bytes) below which messages
            // should not be compressed.
        }
    });

    const devices = [];
    const panels = [];
    let id = 0;

    const messages = (data, ws) => {
        if (data.target == 'any') {
            devices.forEach(x => x.socket.send(JSON.stringify({
                command: data.command,
                value: data.value,
            })));
        } else {
            const target = devices.find(x => x.id == data.target);
            if (target) target.socket.send(JSON.stringify({
                command: data.command,
                value: data.value
            }));
        }
    };
    Object.assign(messages, {
        // view device command
        regist: (data, ws) => {
            data.socket = ws;
            panels.filter(x => (
                x.place[0] == data.place[0] &&
                x.place[1] == data.place[1]) ||
                x.id == data.id)
                .forEach(x => panels.splice(panels.indexOf(x), 1));
            panels.push(data);

            devices.filter(x => x.id == data.id)
                .forEach(x => devices.splice(devices.indexOf(x), 1));
            devices.push(data);
        },

        // controller command
        ids: (data, ws) => {
            ws.send(JSON.stringify({
                command: 'ids',
                value: devices.map(x => ({ id: x.id, place: x.place })),
            }));
        },
        panels: (data, ws) => {
            ws.send(JSON.stringify({
                command: 'panels',
                value: panels.map(x => ({ id: x.id, place: x.place })),
            }));
        },
        images: (data, ws) => {
            fs.readdir(images_path, { withFileTypes: true }, (err, dirents) => {
                if (err) {
                    console.log('Error: cannot get image list');
                    return;
                }

                const d = { command: 'images', value: [] };
                for (const dirent of dirents) {
                    if (dirent.isDirectory()) d.value.push(dirent.name);
                }

                ws.send(JSON.stringify(d));
            });
        },
    });

    setInterval(() => {
        const fails = devices.filter(x => x.socket.readyState >= 2); // CLOSING or CLOSED
        fails.forEach(x => {
            devices.splice(devices.indexOf(x), 1);
            const n = panels.indexOf(x);
            if (n >= 0) panels.splice(n, 1);
        });
    }, 10000);

    wss.on('connection', ws => {
        const socket_id = ++id;
        ws.send(JSON.stringify({ command: 'id', value: socket_id }));
        ws.on('message', message => {
            const data = JSON.parse(message);
            console.log(data);

            (data.command in messages ? messages[data.command] : messages)(data, ws);
        });
        ws.on('close', event => {
            devices.filter(x => x.id == socket_id)
                .forEach(x => devices.splice(devices.indexOf(x), 1));
            panels.filter(x => x.id == socket_id)
                .forEach(x => panels.splice(panels.indexOf(x), 1));
        });
    });

    //app.use('/', express.static(__dirname + '/../public'))
    //    .listen(port, x => console.log(`Listen on ${port}`));
}

