const { Client } = require('pg')

const client = new Client({
    user: 'labtest2',
    host: 'labtest2.cawsnbpmsxae.us-east-2.rds.amazonaws.com',
    database: 'labtest22',
    password: 'labtest2',
    port: 5432,
})

//const conn = 'postgres://labtest1:labtest1@labtest1.cawsnbpmsxae.us-east-2.rds.amazonaws.com/labtest1';
//const pool = new pg.Pool(conn);


client.connect()


client.query('CREATE TABLE IF NOT EXISTS saliva_cortisol(\
    ID serial PRIMARY KEY, \
    Barcodes_or_Sample_Names VARCHAR(20) NOT NULL,\
    Bagids VARCHAR(20),\
    Cortisol_abs FLOAT4 NOT NULL, \
    Cortisol_absolute FLOAT4 NOT NULL, \
    Cortisol_ab_CV FLOAT4 NOT NULL,\
    Total_protein_abs FLOAT4 NOT NULL, \
    Total_protein FLOAT4 NOT NULL, \
    Total_protein_CV FLOAT4 NOT NULL,\
    Cortisol_ratio_norm FLOAT4 NOT NULL, \
    Cortisol_ratio_cross FLOAT4 NOT NULL, \
    Cortisol_ratio_CV FLOAT4 NOT NULL,\
    rowjson jsonb, \
    filename VARCHAR NOT NULL\
    );', (err, res) => {
    console.log(err, res);
    client.end()
})
