const PORT = process.env.PORT || 3000;

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { performance } = require('perf_hooks');

let time = performance.now();

const user_dir = String.raw`C:\Users\Tin Pham\Desktop\test_ML_Flask`;

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'DELETE, PUT, GET, POST');
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.post('/log', (req, res) => {
    let urlResult = req.body;
    
    // save urlResult to data in user_dir
    let file = path.join(user_dir, 'data');
    let data = JSON.stringify(urlResult, undefined, 4);
    
    // if user_dir already has data
    if (fs.existsSync(file)) {
        // if file is empty
        if (fs.readFileSync(file).length === 0) {
            fs.writeFileSync(file, data);
        } else {
            let oldData = JSON.parse(fs.readFileSync(file, 'utf-8'));
            
            // merge oldData and urlResult
            let newData = oldData.concat(urlResult);

            // remove duplicate objects in newData
            newData = Array.from(new Set(newData.map(JSON.stringify))).map(JSON.parse);

            // write newData to file
            fs.writeFileSync(file, JSON.stringify(newData, undefined, 4));
        }
    } else {
        fs.writeFileSync(file, data, (err) => {
            if (err) throw err;
        });
    }
    // console.log(`${(performance.now() - time) / 1000} seconds`);
    res.send('ok');
});

app.listen(PORT, () => {
    console.log('Server is running on port: ' + PORT);
});