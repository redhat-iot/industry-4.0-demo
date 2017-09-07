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

    .factory('SensorData', ['$http', '$modal', '$filter', '$timeout', '$interval', '$rootScope', '$location', '$q', 'APP_CONFIG', 'Facilities', 'Notifications', 'Reports',
        function ($http, $modal, $filter, $timeout, $interval, $rootScope, $location, $q, APP_CONFIG, Facilities, Notifications, Reports) {
            var factory = {},
                client = null,
                msgproto = null,
                listeners = [],
                telemetryRegex = /[^\/]*\/[^\/]*\/[^\/]*\/facilities\/([^\/]*)\/lines\/([^\/]*)\/machines\/([^\/]*)$/,
                alertTopicRegex = /[^\/]*\/[^\/]*\/[^\/]*\/facilities\/([^\/]*)\/lines\/([^\/]*)\/machines\/([^\/]*)\/alerts$/,
                controlTopicPrefix = APP_CONFIG.CONTROL_TOPIC_PREFIX;

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
                    listeners.forEach(function (listener) {
                        client.unsubscribe(listener.topic);
                    });
                } else {
                    // doc played
                    listeners.forEach(function (listener) {
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
                    console.log("onConnectionLost:" + responseObject.errorMessage);
                    Notifications.warn("Lost connection to broker, attempting to reconnect (" + responseObject.errorMessage);
                    connectClient(1);

                }
            }

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

            function handleAlert(destination, alertObj) {
                console.log("recieved alert: " + JSON.stringify(alertObj));
                var matches = alertTopicRegex.exec(destination);
                var fid = matches[1];
                var lid = matches[2];
                var mid = matches[3];

                    Facilities.getFacilities().forEach(function(facility) {
                        facility.lines.forEach(function(line) {
                            line.machines.forEach(function(machine) {

                                switch (alertObj.type) {
                                    case 'maintenance':
                                        if (fid === facility.fid &&
                                            mid === machine.mid &&
                                            lid === line.lid) {
                                            alertObj.machine = machine;
                                            alertObj.line = line;
                                            alertObj.facility = facility;
                                            $rootScope.$broadcast("alert", alertObj);
                                        }
                                        break;
                                    case 'error':
                                        if (fid === facility.fid &&
                                            mid === machine.mid &&
                                            lid === line.lid) {
                                            facility.status = 'error';
                                            line.status = 'error';
                                            machine.status = 'error';
                                            machine.statusMsg = alertObj.description;
                                            alertObj.machine = machine;
                                            alertObj.line = line;
                                            alertObj.facility = facility;
                                            $rootScope.$broadcast("alert", alertObj);
                                        }
                                        break;
                                    case 'warning':
                                        if (fid === facility.fid &&
                                            mid === machine.mid &&
                                            lid === line.lid) {
                                            facility.status = 'warning';
                                            line.status = 'warning';
                                            machine.status = 'warning';
                                            machine.statusMsg = alertObj.description;
                                            alertObj.machine = machine;
                                            alertObj.line = line;
                                            alertObj.facility = facility;
                                            console.log("broadcasting warning");
                                            $rootScope.$broadcast("alert", alertObj);
                                        }
                                        break;
                                    case 'ok':
                                    default:
                                        if (fid === facility.fid &&
                                            mid === machine.mid &&
                                            lid === line.lid) {
                                            facility.status = 'ok';
                                            line.status = 'ok';
                                            machine.status = 'ok';
                                            machine.statusMsg = 'ok';
                                            alertObj.machine = machine;
                                            alertObj.line = line;
                                            alertObj.facility = facility;
                                            $rootScope.$broadcast("alert", alertObj);
                                        }
                                }

                            });
                        });
                    });

            }

            $rootScope.$on('alert', function(evt, alertObj) {

                if (alertObj.type === 'maintenance' || alertObj.type === 'error') {
                    $modal.open({
                        templateUrl: 'partials/alert.html',
                        controller: 'AlertController',
                        size: 'lg',
                        resolve: {
                            alertObj: function () {
                                return alertObj;
                            }
                        }
                    });
                }
            });

            function onMessageArrived(message) {
                var destination = message.destinationName;

                if (alertTopicRegex.test(destination)) {
                    $rootScope.$apply(function() {
                        handleAlert(destination, JSON.parse(message.payloadString));
                    })
                } else {
                    var payload;
                    try {
                        payload = pako.inflate(message.payloadBytes);
                    } catch (err) {
                        // Not compressed
                        payload = message.payloadBytes;
                    }
                    var decoded = msgproto.decode(payload);
                    var matches = telemetryRegex.exec(destination);
                    var fid = matches[1];
                    var lid = matches[2];
                    var mid = matches[3];

                    listeners.filter(function (listener) {
                        return (listener.objType === 'machines' && listener.objId === mid);
                    }).forEach(function (listener) {
                        var targetObj = listener.machine;
                        var cb = listener.listener;

                        var data = [];

                        decoded.metric.forEach(function (decodedMetric) {
                            targetObj.telemetry.forEach(function (objTel) {
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

            factory.resetStatus = function(facility) {
                var msg = {
                    id: guid(),
                    timestamp: new Date().getTime(),
                    command: 'reset'
                };

                Facilities.getFacilities().forEach(function(fac) {
                    if (fac.fid === facility.fid) {
                        fac.status = 'ok';
                    }
                });

                facility.status = 'ok';

                Facilities.getLinesForFacility(facility).forEach(function(line) {
                    line.status = 'ok';
                    line.statusMsg = 'ok';
                    line.machines.forEach(function(machine) {
                        machine.status = 'ok';
                        machine.statusMsg = 'ok';
                        sendJSONObjectMsg(msg,
                            APP_CONFIG.CONTROL_TOPIC_PREFIX +
                            "/facilities/" + facility.fid +
                            "/lines/" + line.lid +
                            "/machines/" + machine.mid +
                            "/control");
                    });
                });

                Facilities.resetStatus(facility);
            };

            $rootScope.$on('resetAll', function() {

                Facilities.getFacilities().forEach(function(facility) {
                    factory.resetStatus(facility);
                });
            });

            function connectClient(attempt) {

                var MAX_ATTEMPTS = 100;

                if (attempt > MAX_ATTEMPTS) {
                    Notifications.error("Cannot connect to broker after " + MAX_ATTEMPTS + " attempts, reload to retry");
                    return;
                }

                if (attempt > 1) {
                    Notifications.warn("Trouble connecting to broker, will keep trying (reload to re-start the count)");
                }
                var brokerHostname = APP_CONFIG.BROKER_HOSTNAME;
                var brokerPort = APP_CONFIG.BROKER_WS_PORT;

                client = new Paho.MQTT.Client(brokerHostname, Number(brokerPort), "dashboard-ui-client-" + guid());

                client.onConnectionLost = onConnectionLost;
                client.onMessageArrived = onMessageArrived;

                protobuf.load("kurapayload.proto", function (err, root) {
                    if (err) throw err;

                    msgproto = root.lookup("kuradatatypes.KuraPayload");
                    // connect the client
                    client.connect({
                        onSuccess: function () {
                            console.log("Connected to broker");
                            if (attempt > 1) {
                                Notifications.success("Connected to the IoT cloud!");
                            }
                            var topicName = "+/+/+/facilities/+/lines/+/machines/+/alerts";
                            client.subscribe(topicName);
                        },
                        userName: APP_CONFIG.BROKER_USERNAME,
                        password: APP_CONFIG.BROKER_PASSWORD,
                        onFailure: function (err) {
                            console.log("Failed to connect to broker (attempt " + attempt + "), retrying. Error code:" + err.errorCode + " message:" + err.errorMessage);
                            $timeout(function () {
                                connectClient(attempt + 1);
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
                listeners = listeners.filter(function (listener) {
                    return ((!listener.machine) || (listener.topic !== topicName));
                });
            };


            factory.unsubscribeAll = function () {
                listeners.forEach(function (listener) {
                    client.unsubscribe(listener.topic);
                });

                listeners = [];
            };

            factory.getRecentData = function (machine, telemetry, cb) {

                var configRestEndpoint = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' +
                    $location.host().replace(/^.*?\.(.*)/g, "$1") + '/api/machines/history/query';

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

            factory.genTrend = function (min, max, numPoints, initial, final, deflection, jitter) {

                var result = [], diff = max - min, halfJitter = diff * jitter;

                for (var i = 0; i < numPoints; i++) {
                    var lowJitter, hiJitter;

                    if ((i / numPoints) < deflection) {
                        lowJitter = initial - halfJitter;
                        hiJitter = initial + halfJitter;
                    } else {
                        lowJitter = final - halfJitter;
                        hiJitter = final + halfJitter;

                    }
                    var diffJitter = hiJitter - lowJitter;
                    result[i] = lowJitter + ((Math.random() * diffJitter));
                    if (result[i] < 0) {
                        result[i] = 0;
                    }
                }
                return result;
            };


            factory.predictiveMaintenance = function (facility, line, machine) {

                var msg = {
                    id: guid(),
                    timestamp: new Date().getTime(),
                    command: 'simulate_maintenance_required'
                };
                sendJSONObjectMsg(msg,
                    APP_CONFIG.CONTROL_TOPIC_PREFIX +
                    "/facilities/" + facility.fid +
                    "/lines/" + line.lid +
                    "/machines/" + machine.mid +
                    "/control");

            };

            factory.unpredictedError = function (facility, line, machine) {
                var msg = {
                    id: guid(),
                    timestamp: new Date().getTime(),
                    command: 'simulate_safety_hazard'
                };
                sendJSONObjectMsg(msg,
                    APP_CONFIG.CONTROL_TOPIC_PREFIX +
                    "/facilities/" + facility.fid +
                    "/lines/" + line.lid +
                    "/machines/" + machine.mid +
                    "/control");

            };

            connectClient(1);

            return factory;
        }]);
