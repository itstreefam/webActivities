const PORT = process.env.PORT || 5000;

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cp = require('child_process');
const fs = require('fs');
const cors = require('cors');

const user_dir = String.raw`C:\Users\thien\Desktop\test_web`;

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/log', (req, res) => {
    let urlResult = req.body;
    
    // save urlResult to data in user_dir
    let file = path.join(user_dir, 'data');
    let data = JSON.stringify(urlResult, undefined, 4); 
    
    // if user_dir already has data
    if (fs.existsSync(file)) {
        // delete content of file
        fs.writeFileSync(file, '');
        // append new data to file
        fs.writeFileSync(file, data, (err) => {
            if (err) throw err;
        });
    } else {
        fs.writeFileSync(file, data, (err) => {
            if (err) throw err;
        });
    }
    res.send('ok');
});

app.listen(PORT, () => {
    console.log('Server is running on port: ' + PORT);
});