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


async function upload(request) {

    // Parsing multipart/form-data
    let files = await multipart.parse(request, false);

    // Check dataUploadKey for access control
    let dataUploadKey = request.headers.dataUploadKey;    
    if (dataUploadKey != process.env.DATA_UPLOAD_KEY) throw new api.ApiResponse({error:'Wrong access key'}, {'Content-Type': 'application/json' }, 401);



    let fileSaved = [];  // to trace file successfully saved

    // processing uploaded files in loop

    for (let file in files) {
        let fileName = files[file].filename;
        
        let contentOriginal =  files[file].content;

        let s3ObjectExists
        try {
            s3ObjectExists = await s3.getObject({
                Bucket: 'labdataupload-teststring',
                Key: fileName
                }).promise();
        } catch(err) {
            console.log(err);
        };
        if (s3ObjectExists) throw new api.ApiResponse({errorMassage: fileName + 
            ' has name conflict. Not saved.'}, {'Content-Type': 'application/json' }, 409);

        // determining sample type based on file name
        let sampleType;
        if (fileName.indexOf('raw') > -1) {
            await s3.putObject({
                Bucket: "labdataupload-teststring",
                Key: fileName,
                Body: contentOriginal,
            }).promise();
            return fileName + ' saved to s3'
        } else if (fileName.indexOf('SL') == 0 && fileName.indexOf('Prc') > -1) {
            sampleType = 'urine';
        } else if (fileName.indexOf('ST') == 0 && fileName.indexOf('Prc') > -1) {
            sampleType = 'stool';
        } else if (fileName.indexOf('BL') == 0 && fileName.indexOf('Prc') > -1) {
            sampleType = 'blood';
        } else if (fileName.indexOf('UR') == 0 && fileName.indexOf('Prc') > -1) {
            sampleType = 'blood';
        } else {
            throw new api.ApiResponse({error: fileName +' didn\'t  follow naming convention. Can not determine sample type.'}, {'Content-Type': 'application/json' }, 409); 
        }       

        // check sample uniqueness
        let sampleNameList = values.map(x => x[0])
        let uniqueSampleNameList = [ ...new Set(sampleNameList) ]
        if (sampleNameList.length > uniqueSampleNameList.length) {
            let duplicatedSample = uniqueSampleNameList.filter(x => sampleNameList.filter(y => y==x).length > 1)

            throw new api.ApiResponse({error: duplicatedSample + ' are not unique. Please check and correct.'+ fileName + ' not saved!'}, {'Content-Type': 'application/json' }, 409);
        }
        
        
        
        
        // parse file to json format
        
        let content = contentOriginal.split(/[\n\r]+/);
        content = content.filter(row => row.split(/[\s,\t]+/).length > 1);

        let keys = content[0].split(/[\s,\t]+/);
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


        const dbClient = await pool.connect();

        // check if sample already exist.
        
        let barcodes = rawjson.map( x => Object.values(x)[0] );

        let barcodeString = barcodes.join("','")

        let colName = keys[0]
        let barcodeCheck = await dbClient.query(`SELECT ${colName} FROM ${sampleType} WHERE ${colName} in ('${barcodeString}')`);
        if (barcodeCheck.rowCount>0) {
            let conflictBarcode = barcodeCheck.rows.map(x => Object.values(x)[0]);
            conflictBarcode = [ ...new Set(conflictBarcode) ];
            throw new api.ApiResponse({error: 'barcodes: ' + conflictBarcode +' in '+ fileName + ' conflict with records in database! ' + fileSaved.length +' files saved. List of saved file: '+ fileSaved }, {'Content-Type': 'application/json' }, 409);
        };


        async function loopInsert(rawjson, sampleType, fileName) {
            // function to insert each record based on barcode and sample type
            for (let row of rawjson) {
                let cols = Object.keys(row);
                cols.push('rowjson');
                cols.push('filename');
                cols = cols.join(',');
                cols = cols.replace(/"/g,"");
                let values = Object.values(row);
                values.push(JSON.stringify(row));
                values.push(fileName);
                values = values.join("','");
                await dbClient.query(`INSERT INTO ${sampleType} (${cols}) VALUES ( '${values}')`);
                    
            };
        };


        await dbClient.query('BEGIN');
        // database transaction 
        try {
            await loopInsert(rawjson, sampleType, fileName);

            await s3.putObject({
                Bucket: "labdataupload-teststring",
                Key: fileName,
                Body: contentOriginal,
            }).promise();
            
            await dbClient.query('COMMIT');
            fileSaved.push(fileName);
        } catch (err) {
            await dbClient.query('ROLLBACK');
            throw new api.ApiResponse({
                Error: err,
                Message: fileSaved.length +' files saved. List of saved file: '+ fileSaved
            }, {'Content-Type': 'application/json' }, 500)
        } finally {
            dbClient.release();
        } 
        
    }
   
    return new api.ApiResponse({ Message: 'All files saved!' }, {'Content-Type': 'application/json' }, 200);

};


module.exports = upload;
