/*
 * ******************************************************************************
 * Copyright (c) 2017 Red Hat, Inc. and others
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     Red Hat Inc. - initial API and implementation
 *     Benjamin Cabé (Eclipse Foundation) - #1 ES histogram should be showing history for the selected package only
 *
 * ******************************************************************************
 */

'use strict';

// Red-Hat/simulator-1/cloudera-demo/facilities/facility-1/lines/line-1/machines/machine-2/alert

angular.module('app')

    .factory('SensorData', ['$http', '$filter', '$timeout', '$interval', '$rootScope', '$location', '$q', 'APP_CONFIG', 'Notifications', 'Reports', 'Lines',
        function ($http, $filter, $timeout, $interval, $rootScope, $location, $q, APP_CONFIG, Notifications, Reports, Lines) {
        var factory = {},
            client = null,
            msgproto = null,
            listeners = [],
            topicRegex = /[^\/]*\/[^\/]*\/[^\/]*\/facilities\/([^\/]*)\/lines\/([^\/]*)\/machines\/([^\/]*)$/,
            alertTopicRegex = /[^\/]*\/[^\/]*\/[^\/]*\/facilities\/([^\/]*)\/lines\/([^\/]*)\/machines\/([^\/]*)\/alerts$/,
            metricOverrides = {};

            // Set the name of the hidden property and the change event for visibility
            var hidden, visibilityChange;
            if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
                hidden = "hidden";
                visibilityChange = "visibilitychange";
            } else if (typeof document.msHidden !== "undefined") {
                hidden = "msHidden";
                visibilityChange = "msvisibilitychange";
            } else if (typeof document.webkitHidden !== "undefined") {
                hidden = "webkitHidden";
                visibilityChange = "webkitvisibilitychange";
            }

            // If the page/tab is hidden, pause the data stream;
            // if the page/tab is shown, restart the stream
            function handleVisibilityChange() {
                if (document[hidden]) {
                    listeners.forEach(function(listener) {
                        client.unsubscribe(listener.topic);
                    });
                } else {
                    // doc played
                    listeners.forEach(function(listener) {
                        client.subscribe(listener.topic);
                    });
                }
            }

            // Warn if the browser doesn't support addEventListener or the Page Visibility API
            if (typeof document.addEventListener === "undefined" || typeof document[hidden] === "undefined") {
                console.log("This demo requires a browser, such as Google Chrome or Firefox, that supports the Page Visibility API.");
            } else {
                // Handle page visibility change
                document.addEventListener(visibilityChange, handleVisibilityChange, false);
            }

        function onConnectionLost(responseObject) {
            if (responseObject.errorCode !== 0) {
                console.log("onConnectionLost:"+responseObject.errorMessage);
                Notifications.warn("Lost connection to broker, attempting to reconnect (" + responseObject.errorMessage);
                connectClient(1);

            }
        }

        function handleAlert(destination, alertObj) {

                // TODO
            // if (alertObj.type == 'VEHICLE') {
            //     $rootScope.$broadcast('line:alert', {
            //         vin: alertObj.truckid,
            //         message: $filter('date')(alertObj.date, 'medium') + ": " +
            //                     alertObj.desc + ": " + alertObj.message
            //     });
            // } else if (alertObj.type == 'PACKAGE') {
            //     $rootScope.$broadcast('package:alert', {
            //         vin: alertObj.truckid,
            //         sensor_id: alertObj.sensorid,
            //         message: $filter('date')(alertObj.date, 'medium') + ": " +
            //                     alertObj.desc + ": " + alertObj.message
            //     });
            // }
            //
            // Reports.refresh();

        }

        function onMessageArrived(message) {
            var destination = message.destinationName;

            if (alertTopicRegex.test(destination)) {
                handleAlert(destination, JSON.parse(message.payloadString));
            } else {
                var payload = message.payloadBytes;
                var decoded =  msgproto.decode(payload);
                var matches = topicRegex.exec(destination);
                var fid = matches[1];
                var lid = matches[2];
                var mid = matches[3];

                listeners.filter(function(listener) {
                    return (listener.objType === 'machines' && listener.objId === mid);
                }).forEach(function(listener) {
                    var targetObj = listener.machine;
                    var cb = listener.listener;

                    var data = [];

                    decoded.metric.forEach(function(decodedMetric) {
                        targetObj.telemetry.forEach(function(objTel) {
                            var telName = objTel.name;
                            var telMetricName = objTel.metricName;
                            var value = decodedMetric.doubleValue.toFixed(1);
                            if (telMetricName === decodedMetric.name) {
                                data.push({
                                    name: telName,
                                    value: value,
                                    timestamp: new Date()
                                });
                            }
                        });
                    });
                    cb(data);
                });
            }
        }

        function connectClient(attempt) {

            var MAX_ATTEMPTS = 100;

            if (attempt > MAX_ATTEMPTS) {
                Notifications.error("Cannot connect to broker after " + MAX_ATTEMPTS +" attempts, reload to retry");
                return;
            }

            if (attempt > 1) {
                Notifications.warn("Trouble connecting to broker, will keep trying (reload to re-start the count)");
            }
            var brokerHostname = APP_CONFIG.BROKER_WEBSOCKET_HOSTNAME + '.' + $location.host().replace(/^.*?\.(.*)/g,"$1");

            // TODO: delete me
            if (APP_CONFIG.BROKER_WEBSOCKET_HOSTNAME_OVERRIDE) {
                brokerHostname = APP_CONFIG.BROKER_WEBSOCKET_HOSTNAME_OVERRIDE;
            }
            client = new Paho.MQTT.Client(brokerHostname, Number(APP_CONFIG.BROKER_WEBSOCKET_PORT), "demo-client-" + guid());

            client.onConnectionLost = onConnectionLost;
            client.onMessageArrived = onMessageArrived;

            protobuf.load("kurapayload.proto", function(err, root) {
                if (err) throw err;

                msgproto = root.lookup("kuradatatypes.KuraPayload");
                // connect the client
                client.connect({
                    onSuccess: function() {
                        console.log("Connected to broker");
                        if (attempt > 1) {
                            Notifications.success("Connected to the IoT cloud!");
                        }
                        var topicName = "+/+/+/facilities/+/lines/+/machines/+/alerts";
                        client.subscribe(topicName);
                    },
                    userName: APP_CONFIG.BROKER_USERNAME,
                    password: APP_CONFIG.BROKER_PASSWORD,
                    onFailure: function(err) {
                        console.log("Failed to connect to broker (attempt " + attempt + "), retrying. Error code:" + err.errorCode + " message:" + err.errorMessage);
                        $timeout(function() {
                            connectClient(attempt+1);
                        }, 10000);
                    }
                });
            });
        }

        function guid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        }

        factory.subscribeMachine = function (machine, listener) {

                // Red-Hat/simulator-1/cloudera-demo/facilities/facility-1/lines/line-1/machines/machine-2

            var topicName = '+/+/+/facilities/' +
                machine.currentFid + '/lines/' + machine.currentLid + '/machines/' + machine.mid;

            client.subscribe(topicName);
            console.log("subscribed to " + topicName);
            listeners.push({
                machine: machine,
                topic: topicName,
                objType: 'machines',
                objId: machine.mid,
                listener: listener
            });
        };

        factory.unsubscribeMachine = function (machine) {
            var topicName = '+/+/+/facilities/' +
                machine.currentFid + '/lines/' + machine.currentLid + '/machines/' + machine.mid;
            client.unsubscribe(topicName);
            console.log("UNsubscribed from " + topicName);
            listeners = listeners.filter(function(listener) {
                return ((!listener.machine)  || (listener.topic !== topicName));
            });
        };


        factory.unsubscribeAll = function () {
            listeners.forEach(function(listener) {
               client.unsubscribe(listener.topic);
            });

            listeners = [];
        };

        factory.getRecentData = function (machine, telemetry, cb) {

            var configRestEndpoint = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' +
                $location.host().replace(/^.*?\.(.*)/g,"$1") + '/api/machines/history/query';

            var topicReg = "[^/]*/[^/]*/[^/]*/facilities/" + machine.currentFid + "/lines/" + machine.currentLid + "/machines/" + machine.mid;

            configRestEndpoint += ("?topic=" + encodeURIComponent(topicReg));

            configRestEndpoint += ("&metric=" + telemetry.metricName);

            $http({
                method: 'GET',
                url: configRestEndpoint
            }).then(function (response) {

                if (!response.data) {
                    cb([]);
                    return;
                }
                cb(response.data);

            }, function err(response) {
                console.log(JSON.stringify(response));
                Notifications.error("Error fetching history for machine: " + machine.mid + ". Reload to retry");
            });
        };

        function sendJSONObjectMsg(jsonObj, topic) {
            var message = new Paho.MQTT.Message(JSON.stringify(jsonObj));
            message.destinationName = topic;
            client.send(message);

        }

        function sendKuraMsg(kuraObj, topic) {
            var payload = msgproto.encode(kuraObj).finish();
            var message = new Paho.MQTT.Message(payload);
            message.destinationName = topic;
            client.send(message);

        }

        factory.predictiveMaintenance = function(vehicle) {

            var intervals = [];

            function stopAll() {
                intervals.forEach(function(i) {
                    $interval.cancel(i);
                    i = undefined;
                });
                intervals = [];
            }

            var hitemp =
                {
                    timestamp: new Date().getTime(),
                    metric: [
                        {
                            name: 'temp',
                            type: 'DOUBLE',
                            doubleValue: 265
                        }
                    ]
                };

            var hipress =
                {
                    timestamp: new Date().getTime(),
                    metric: [
                        {
                            name: 'oilpress',
                            type: 'DOUBLE',
                            doubleValue: 95
                        }
                    ]
                };

            metricOverrides[vehicle.vin] = {};

            intervals.push($interval(function() {
                metricOverrides[vehicle.vin]['temp'] = 265;
                sendKuraMsg(hitemp, 'Red-Hat/sim-truck/iot-demo/trucks/' + vehicle.vin)
            }, 5000));

            $timeout(function() {
                intervals.push($interval(function() {
                    metricOverrides[vehicle.vin]['oilpress'] = 95;
                    sendKuraMsg(hipress, 'Red-Hat/sim-truck/iot-demo/trucks/' + vehicle.vin);
                }, 5000));
                var hitempalert = {
                    date: new Date().getTime(),
                    from: "Operations",
                    desc: "Truck Maintenance Required",
                    message: "Your line is in need of maintenance. A maintenance crew has been dispatched to the " + vehicle.destination.name + " facility (bay 4), please arrive no later than 10:0am EDT",
                    type: 'VEHICLE',
                    truckid: vehicle.vin,
                    sensorid: null
                };

                sendJSONObjectMsg(hitempalert, 'Red-Hat/sim-truck/iot-demo/trucks/' + vehicle.vin + '/alerts');
            }, 10000);

            // stop everything after 2 minutes
            $timeout(function() {
                stopAll();
            }, 120000);

            };

        factory.unpredictedError = function(vehicle, pkg) {

            var intervals = [];

            function stopAll() {
                intervals.forEach(function(i) {
                    $interval.cancel(i);
                    i = undefined;
                });
                intervals = [];
            }

            var hipkgtemp =
                {
                    timestamp: new Date().getTime(),
                    metric: [
                        {
                            name: 'Ambient',
                            type: 'DOUBLE',
                            doubleValue: 42.2
                        }
                    ]
                };

            $timeout(function() {
                intervals.push($interval(function() {
                    sendKuraMsg(hipkgtemp, 'Red-Hat/sim-truck/iot-demo/packages/' + pkg.sensor_id);
                    metricOverrides[pkg.sensor_id] = {};
                    metricOverrides[pkg.sensor_id]['Ambient'] = 42.2;
                }, 5000));
            }, 5000);


            $timeout(function() {
                var hitempalert = {
                    date: new Date().getTime(),
                    from: "Operations",
                    desc: "Client Package Alert",
                    message: 'Temperature on package ' + pkg.sensor_id + ' (' + pkg.desc + ' for client ' + pkg.customer.name + ') on shelf 12 is out of spec (42.2°C), please verify condition',
                    type: 'PACKAGE',
                    truckid: vehicle.vin,
                    sensorid: pkg.sensor_id
                };

                sendJSONObjectMsg(hitempalert, 'Red-Hat/sim-truck/iot-demo/packages/' + pkg.sensor_id + '/alerts');

            }, 8000);

            // start looking to clear alerts after 20s
            $timeout(function() {
                intervals.push($interval(function() {
                    Vehicles.reset();
                    Shipments.getCurrentShipments().filter(function(s) { return s.sensor_id == pkg.sensor_id }).forEach(function(s) {
                        if (s.status == 'ok') {
                            stopAll();
                            metricOverrides[s.sensor_id] = null;
                        }
                    });
                }, 5000));
            }, 20000);

            // stop everything after a 2 minutes
            $timeout(function() {
                stopAll();
            }, 120000);
        };

        connectClient(1);

        return factory;
    }]);
