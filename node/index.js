const PORT = process.env.PORT || 5000;

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cp = require('child_process');
const fs = require('fs');

const user_dir = String.raw`/Users/pham/Desktop/test-web`;

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/log', (req, res) => {
    let urlResult = req.body;
    
    // save urlResult to data in user_dir
    let file = path.join(user_dir, 'data');
    let data = JSON.stringify(urlResult, undefined, 4); 
    
    // if user_dir already has data
    if (fs.existsSync(file)) {
        let fileData = JSON.parse(fs.readFileSync(file));
        let concatData = fileData.concat(urlResult);
        fs.writeFileSync(file, JSON.stringify(concatData, undefined, 4), (err) => {
            if (err) throw err;
            console.log('The file has been appended and saved!');
        });
    } else {
        fs.writeFileSync(file, data, (err) => {
            if (err) throw err;
            console.log('The file has been created and saved!');
        });
    }
});

app.get('/', function (req, res) {
    res.send('GET request to homepage')
})

app.listen(PORT, () => {
    console.log('Server is running on port: ' + PORT);
});