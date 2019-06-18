const { Client } = require('pg')

const client = new Client({
    user: 'labtest2',
    host: 'labtest2.cawsnbpmsxae.us-east-2.rds.amazonaws.com',
    database: 'labtest22',
    password: 'labtest2',
    port: 5432,
})


client.connect()


client.query('DROP TABLE blood RESTRICT;', (err, res) => {
    console.log(err, res);
    client.end()
})