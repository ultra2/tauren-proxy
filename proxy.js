"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
console.log("Start proxy..."); 
const express = require("express");
const bodyParser = require("body-parser");
const websocket = require("websocket");
const request = require('request');
const utils_1 = require('./utils');
class Server {
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initApp();
        });
    }
    initApp() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connectionToV8 = null
            this.app = express();
            this.server = require('http').Server(this.app);
            let router = express.Router();

            router.get("/", function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    res.send("start");
                    res.end();
                });
            });

            router.get("/debug", function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {

                    request('http://localhost:9229/json/list', function (error, response, body) {
                        
                        console.log("body:" + body);
                        console.log("error:" + error);

                        if (error){
                            res.send(error);
                            res.end();
                            return
                        }       
                    
                        var client = new websocket.client();
                        client.on('connectFailed', function (error) {
                            console.log('Connect Error: ' + error.toString());
                        });
                        client.on('connect', function (connection) {
                            console.log('connectionToV8 is live!');
                            this.connectionToV8 = connection;

                            this.connectionToV8.on('error', function (error) {
                                console.log("Connection Error: " + error.toString());
                            });
                            this.connectionToV8.on('close', function () {
                                console.log('echo-protocol Connection Closed');
                            });
                            this.connectionToV8.on('message', function (message) {
                                if (message.type === 'utf8') {
                                    //console.log("Received from Debugger: '" + message.utf8Data + "'");
                                    connectionToChromeDebugger.sendUTF(message.utf8Data);
                                }
                            });
                        });
                        
                        var url = "ws://localhost:9229/" + JSON.parse(body)[0].id;
                        client.connect(url);

                        res.send("ok");
                        res.end();
                    })
                });
            });

            router.get('/:application/:controller/:method/:url(*)?', function (req, res, next) {
                return __awaiter(this, void 0, void 0, function* () {
                    console.log("proxy get " + req.originalUrl);
                    request("http://localhost:3000"+req.url, function (error, response, body) {
                        console.log(error)
                        for (var key in response.headers){
                            res.setHeader(key, response.headers[key]);
                        }
                        res.send(body)
                    })
                });
            }.bind(this));

            router.post('/:application/:controller/:method/:url(*)?', function (req, res, next) {
                
            }.bind(this));

            this.app.use(bodyParser.json({ type: 'application/json', limit: '5mb' }));
            this.app.use(bodyParser.raw({ type: 'application/vnd.custom-type' }));
            this.app.use(bodyParser.text({ type: 'text/*', limit: '5mb' }));
            this.app.use(router);
            this.app.use(function (err, req, res, next) {
                var error = new Error("Not Found");
                err.status = 404;
                next(err);
            });
            var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 4000;
            var ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0'
            this.server.listen(port, ip, function () {
                console.log('Proxy listen on %s ...', port);
            });

            var wsServer = new websocket.server({
                httpServer: this.server,
                // You should not use autoAcceptConnections for production 
                // applications, as it defeats all standard cross-origin protection 
                // facilities built into the protocol and the browser.  You should 
                // *always* verify the connection's origin and decide whether or not 
                // to accept it. 
                autoAcceptConnections: false
            });

            function originIsAllowed(origin) {
                // put logic here to detect whether the specified origin is allowed. 
                return true;
            }

            var connectionToChromeDebugger = null

            wsServer.on('request', function(request) {
                console.log("wsServer on request")
                if (!originIsAllowed(request.origin)) {
                    // Make sure we only accept requests from an allowed origin 
                    request.reject();
                    console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
                    return;
                }
                
                connectionToChromeDebugger = request.accept(null, request.origin);
                console.log('connectionToChromeDebugger is live!');

                connectionToChromeDebugger.on('message', function(message) {
                    if (message.type === 'utf8') {
                        console.log('Received Message: ' + message.utf8Data);
                        connectionToV8.sendUTF(message.utf8Data);
                        //connection.sendUTF(message.utf8Data);
                    }
                    else if (message.type === 'binary') {
                        console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
                        //connection.sendBytes(message.binaryData);
                    }
                });
                connectionToChromeDebugger.on('close', function(reasonCode, description) {
                    console.log((new Date()) + ' Peer ' + connectionToChromeDebugger.remoteAddress + ' disconnected.');
                });
            });
        })
    }
}
var server = new Server();
server.run();
