const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { performance } = require('perf_hooks');
const portfinder = require('portfinder');

portfinder.setBasePort(4000);    // default: 8000
portfinder.setHighestPort(65535); // default: 65535

portfinder.getPortPromise()
    .then((port) => {
        //
        // `port` is guaranteed to be a free port in this scope.
        //
        let time = performance.now();

        const user_dir = String.raw`/home/tri/Desktop/test`;

        const app = express();

        app.use(cors());
        app.use(express.json({limit: '50mb'}));
        app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 100000}));

        app.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header('Access-Control-Allow-Methods', 'DELETE, PUT, GET, POST');
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });

        app.post('/logWebData', (req, res) => {
            let urlResult = req.body;
            
            // save urlResult to data in user_dir
            let file = path.join(user_dir, 'webData');
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

        app.listen(port, () => {
            console.log('Server is running on found free port: ' + port);
            console.log('Make sure to also update base port in extension popup page to ' + port + ' if they are not matched.');
        });
    })
    .catch((err) => {
        //
        // Could not get a free port, `err` contains the reason.
        //
        console.log(err);
    });