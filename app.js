const express = require('express');
const app = express();

const port = 11382;

app.use('/', express.static(__dirname + '/public'))
   .listen(port, x => console.log(`Listen on ${port}`));
   