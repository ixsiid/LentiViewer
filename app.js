const express = require('express');
const app = express();

const port = 11385;

const WebSocket = require('ws');
const wss = new WebSocket.Server({
   port: 11388,
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
let id = 0;

const messages = {
   // view device command
   regist: (data, ws) => {
      data.socket = ws;
      devices.filter(x => x.place[0] == data.place[0] && x.place[1] == data.place[1])
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
   calibration: (data, ws) => {
      const target = devices.find(x => x.id == data.target);
      if (target) target.socket.send(JSON.stringify({ command: 'calibration', value: data.value }));
   },
};

wss.on('connection', ws => {
   const socket_id = ++id;
   ws.send(JSON.stringify({ command: 'id', value: socket_id }));
   ws.on('message', message => {
      const data = JSON.parse(message);
      console.log(data);

      const proc = Object.keys(messages).find(x => data.command == x);
      if (proc) messages[proc](data, ws);
      else console.log('Unknown command');
   });
   ws.on('close', event => {
      devices.filter(x => x.id == socket_id)
         .map(x => devices.splice(devices.indexOf(x), 1));
   });
});

app.use('/', express.static(__dirname + '/public'))
   .listen(port, x => console.log(`Listen on ${port}`));
