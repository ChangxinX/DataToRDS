'use strict'

const Api = require('claudia-api-builder');
const api = new Api();
const showTables = require('./handlers/showTables');
const searchTable = require('./handlers/searchTable');
const test = require('./handlers/test');
const upload = require('./handlers/upload');
const upload2 = require('./handlers/upload2');
const upload1 = require('./handlers/upload1');
const update = require('./handlers/update');


api.get("/", (request) => 'Welcome to data uploading center');

api.get('/getData/{table}', (request) => {
    return searchTable(request);
    
api.post('/upload', (request) => {
    return upload(request);
});
api.put('/update', (request) => {
    return update(request);
});

api.get('/upload', () => {
    'use strict'
    return new api.ApiResponse('<html><head></head><body>\
     <form method="POST" enctype="multipart/form-data">\
     <input type="text" name="sampleType" placeholder="Sample Type"><br />\
      <input type="text" name="dataUploadKey" placeholder="Data upload key"><br />\
       <input type="file" name="labfile"><br />\
      <input type="submit"> </form> </body></html>',
         {'Content-Type': 'text/html'}, 202 );})


module.exports = api;
