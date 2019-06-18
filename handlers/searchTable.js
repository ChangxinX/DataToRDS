'use strict'
const Api = require('claudia-api-builder');
const api = new Api();

const { Pool } = require('pg');
const pool = new Pool({
    user: 'labtest2',
    host: 'labtest2.cawsnbpmsxae.us-east-2.rds.amazonaws.com',
    database: 'labtest22',
    password: 'labtest2',
    port: 5432
});

async function searchTable(request) {

    if (request.headers.dataAccessKey != process.env.DATA_ACCESS_KEY) throw new api.ApiResponse({error:'Wrong data access key'}, {'Content-Type': 'application/json' }, 401)

    await pool.connect();
    let table = request.pathParams.table.toLowerCase();

    let res = await pool.query(`SELECT * FROM ${table};`);
   
    return res;
};


module.exports = searchTable;
