'use strict'

const { Pool } = require('pg');
const Api = require('claudia-api-builder');
const api = new Api();
const aws = require('aws-sdk');
const s3 = new aws.S3();

const pool = new Pool({
    user: 'labtest2',
    host: 'labtest2.cawsnbpmsxae.us-east-2.rds.amazonaws.com',
    database: 'labtest22',
    password: process.env.RDS_PASSCODE,
    port: 5432
});

const multipart = require('aws-lambda-multipart-parser');


async function update(request) {

    // Parsing multipart/form-data
    let file = await multipart.parse(request, false);
    
    // check dataUploadKey for access control
    let dataUploadKey = request.headers.dataUploadKey;    
    if (dataUploadKey != process.env.DATA_UPLOAD_KEY) throw new api.ApiResponse({error:'Wrong access key'}, {'Content-Type': 'application/json' }, 401);
    
    
    let name = Object.keys(file);
    let fileName = file[name].filename;
    let contentOriginal = file[name].content;


    let nameCheck
    try {
        nameCheck = await s3.getObject({
            Bucket: 'labdataupload-teststring',
            Key: fileName
            }).promise()
    } catch(err) {
        console.log(err)
    }
    if (nameCheck) throw new api.ApiResponse({errorMassage: fileName + 
        ' has file name conflict. Not saved.'}, {'Content-Type': 'application/json' }, 409)


    let content = contentOriginal.split(/[\n\r]+/);
    content = content.filter(row => row.split(/[\s,\t]+/).length > 1);
    //return content    
    let keys = content[0].split(/[\s,\t]+/);

    
    // Decide sample type based on file header
    let sampleType;
    if (keys.indexOf('u1') > -1 && keys.indexOf('u2') > -1) {
        sampleType = 'urine';
    } else if (keys.indexOf('b1') > -1 && keys.indexOf('b2') > -1) {
        sampleType = 'blood';
    } else if (keys.indexOf('Cortisol_absolute') > -1 && keys.indexOf('Total_protein_abs') > -1) {
        sampleType = 'saliva_cortisol';
    } else if (keys.indexOf('Signal') > -1) {
        await s3.putObject({
            Bucket: "labdataupload-teststring",
            Key: fileName,
            Body: contentOriginal,
        }).promise();
        return fileName + 'saved to s3'
    } else {
        throw new api.ApiResponse({error: 'Wrong headers in file: ' + fileName + '. ' +
         fileSaved.length +' files saved. List of saved file: '+ 
         fileSaved}, {'Content-Type': 'application/json' }, 409); 
    }


    // parse file to json
    let values = content.slice(1).map(x=>x.split(/[\s,\t]+/));
    values = values.map(x =>  x.map((y) => {
        if (y.indexOf('%') > -1) {
            y = y.replace('%', '');
            return  (Number(y) / 100).toPrecision(4);
        } else {
            return y;
        }
    }));
        

    
    let rawjson = [];
    for (let i=0; i< values.length; i++) {
        let rowJson = {};
        for (let j=0; j<keys.length; j++) {
            rowJson[keys[j]] = values[i][j];         
        }
        rawjson.push(rowJson);
    };


    const client = await pool.connect();

    // Check barcode uniqueness in uploaded file
    let barcodes = rawjson.map( x => Object.values(x)[0] );
    let uniquebarcodes = [ ...new Set(barcodes) ];
    //if (barcodes.length != uniquebarcodes.length) throw new api.ApiResponse({error: 'Duplicate barcode in the file. No record updated!'}, { 'Content-Type': 'application/json' }, 409);
    
    // Check of all barcodes exist in database 
    let colName = keys[0]      
    let barcodesString = uniquebarcodes.join("','")
    let barcodeCheck = await client.query(`SELECT ${colName} FROM ${sampleType} WHERE ${colName} in ('${barcodesString}')`);
    let barcodeExist = barcodeCheck.rows.map(x => Object.values(x)[0]);
    barcodeExist = [...new Set(barcodeExist)]

    if (barcodeExist.length != uniquebarcodes.length) {
        
        let barcodeNotExist = uniquebarcodes.filter(x => barcodeExist.indexOf(x) == -1)
        throw new api.ApiResponse({error: 'Sample: ' + barcodeNotExist + ' not found in database.'}, { 'Content-Type': 'application/json' }, 409);
    };

    async function loopupdate(rawjson, sampleType, fileName, colName, barcodesString) {

        await client.query(`DELETE FROM ${sampleType} WHERE ${colName} in ('${barcodesString}')`);
        // function to update records
        for (let row of rawjson) {
            let cols = Object.keys(row);
            
            cols.push('rowjson');
            cols.push('filename');
            cols = cols.join(',');
            cols = cols.replace(/"/g,"");
            let values = Object.values(row);
            //let toDelete = values[0];
            values.push(JSON.stringify(row));
            values.push(fileName);
            values = values.join("','");
            //await client.query(`DELETE FROM ${sampleType} WHERE ${colName} = $1;`, [toDelete]);
            await client.query(`INSERT INTO ${sampleType} (${cols}) VALUES ( '${values}');`);
           
        }
    };

    // Database transaction
    await client.query('BEGIN');

    try {
        await loopupdate(rawjson, sampleType, fileName, colName, barcodesString);

        await s3.putObject({
            Bucket: "labdataupload-teststring",
            Key: fileName,
            Body: contentOriginal,
        }).promise();
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    
    
    return new api.ApiResponse({Message: 'Data updated!'}, {'Content-Type': 'application/json' }, 200);


};



module.exports = update;
