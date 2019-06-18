'use strict'

const Api = require('claudia-api-builder');
const api = new Api();
const searchTable = require('./handlers/searchTable');
const upload = require('./handlers/upload');
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



module.exports = api;
