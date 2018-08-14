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

  .factory('SensorData', ['$http', '$modal', '$filter', '$timeout', '$interval', '$rootScope', '$location', '$q', 'APP_CONFIG', 'Facilities', 'Notifications',
    function ($http, $modal, $filter, $timeout, $interval, $rootScope, $location, $q, APP_CONFIG, Facilities, Notifications, Sim) {
      var factory = {},
        client = null,
        connected = false,
        currentFacility = null,
        msgproto = null,
        listeners = [],
        telemetryRegex = /[^\/]*\/[^\/]*\/[^\/]*\/facilities\/([^\/]*)\/lines\/([^\/]*)\/machines\/([^\/]*)$/,
        alertTopicRegex = /[^\/]*\/[^\/]*\/[^\/]*\/facilities\/([^\/]*)\/lines\/([^\/]*)\/machines\/([^\/]*)\/alerts$/,
        simTimers = [],
        simStates = [],
        simFailInProgress = false,
        simFallbackTimer = undefined,
        ignoreAlerts = false;

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
            stopSimAll();
            client.unsubscribe(listener.topic);
            console.log("unsubscribed from " + listener.topic);
          });
        } else {
          // doc played
          listeners.forEach(function (listener) {
            if (!connected) {
              startSimAll();
            }
            client.subscribe(listener.topic);
            console.log("subscribed to " + listener.topic);
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
        connected = false;
        if (responseObject.errorCode !== 0) {
          console.log("onConnectionLost:" + responseObject.errorMessage);
          $rootScope.$broadcast("activity:gateway", {type: "warning", duration: 5000});
          // start sim for listening machines
          listeners.forEach(function(listener) {
            if (listener.objType === 'machines') {
              startSim(listener.machine.currentFid, listener.machine.currentLid, listener.machine.mid);
            }
          });
          connectClient(1);

        }
      }

      function sendJSONObjectMsg(jsonObj, topic) {
        var message = new Paho.MQTT.Message(JSON.stringify(jsonObj));
        message.destinationName = topic;
        client.send(message);

      }

      function handleAlert(destination, alertObj) {
        console.log("recieved alert on topic: " + destination + " -- " + JSON.stringify(alertObj));
        if (ignoreAlerts) {
          if (alertObj.type === 'ok') {
            // stop ignoring alerts after a while
            console.log("will start showing alerts in about 10s");
            $timeout(function() {
              ignoreAlerts = false;
            }, 10000);
          }
          console.log("ignoring alerts until all clear is sent");
          return;
        }
        if (simFailInProgress && !alertObj.sim) {
          console.log("ignoring real alert; frontend sim already triggered");

          // ignore real alerts if simulated failure was triggered while disconnected
          // and then real alerts starts coming in
          return;
        }

        var matches = alertTopicRegex.exec(destination);
        var fid = matches[1];
        var lid = matches[2];
        var mid = matches[3];

        Facilities.getFacilities().forEach(function (facility) {
          facility.lines.forEach(function (line) {
            line.machines.forEach(function (machine) {

              switch (alertObj.type) {
                case 'maintenance':
                  // if we are waiting to initiate a simulation and we get a real alert, cancel simulation!
                  if (!alertObj.sim && simFallbackTimer) {
                    $timeout.cancel(simFallbackTimer);
                    simFallbackTimer = undefined;
                    console.log("received real alert; cancelling frontend sim");
                  }
                  if (fid === facility.fid &&
                    mid === machine.mid &&
                    lid === line.lid) {
                    if (facility.status === 'ok' || line.status === 'ok' || machine.status === 'ok') {
                      facility.status = 'warning';
                      line.status = 'warning';
                      machine.status = 'warning';
                      machine.statusMsg = alertObj.description;
                    }
                    alertObj.machine = machine;
                    alertObj.line = line;
                    alertObj.facility = facility;
                    // wait a few seconds for dramatic effect
                    ignoreAlerts = true;
                    $timeout(function() {
                      $rootScope.$broadcast("alert", alertObj);
                    }, 2000);
                  }
                  break;
                case 'error':
                  // if we are waiting to initiate a simulation and we get a real alert, cancel simulation!
                  if (!alertObj.sim && simFallbackTimer) {
                    $timeout.cancel(simFallbackTimer);
                    simFallbackTimer = undefined;
                    console.log("received real alert; cancelling frontend sim");
                  }
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
                    // wait a few seconds for dramatic effect
                    ignoreAlerts = true;
                    $timeout(function() {
                      $rootScope.$broadcast("alert", alertObj);
                    }, 2000);
                  }
                  break;
                case 'warning':
                  // if we are waiting to initiate a simulation and we get a real alert, cancel simulation!
                  if (!alertObj.sim && simFallbackTimer) {
                    $timeout.cancel(simFallbackTimer);
                    simFallbackTimer = undefined;
                    console.log("received real alert; cancelling frontend sim");
                  }
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
                    $rootScope.$broadcast("alert", alertObj);
                  }
                  break;
                case 'ok':
                default:
                  // if we are waiting to initiate a simulation and we get a real alert, cancel simulation!
                  if (!alertObj.sim && simFallbackTimer) {
                    $timeout.cancel(simFallbackTimer);
                    simFallbackTimer = undefined;
                    console.log("received real alert; cancelling frontend sim");
                  }
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

      $rootScope.$on('alert', function (evt, alertObj) {

        if (alertObj.type === 'maintenance' || alertObj.type === 'error') {

          if (alertObj.type === 'error' && !alertObj.details.start) {
              alertObj.details.start = new Date().getTime();
              alertObj.details.end = new Date().getTime() + (1 * 60 * 60 * 1000);
          }

          // ignore multiple popups
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

      function handleTelemetry(message, destination) {
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

          var isSimData = decoded.metric.find(function(el) {
            return (el.name === 'sim')
          });

          if (simFailInProgress && !isSimData) {
            // ignore unsimulated data when simulated failure is in progress
            return;
          }
          decoded.metric.forEach(function (decodedMetric) {
            targetObj.telemetry.forEach(function (objTel) {
              var telName = objTel.name;
              var telMetricName = objTel.metricName;
              var value = decodedMetric.doubleValue;
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

      function onMessageArrived(message) {
        if (connected) {
         // stopSim();
          $rootScope.$broadcast("activity:gateway", {});
        } else {
          $rootScope.$broadcast("activity:gateway", {type: "warning"});
        }
        var destination = message.destinationName;

        if (alertTopicRegex.test(destination)) {
          $rootScope.$apply(function () {
            handleAlert(destination, JSON.parse(message.payloadString));
          });
        } else {
          handleTelemetry(message, destination);
        }
      }

      factory.resetStatus = function (facility) {
        var msg = {
          id: guid(),
          timestamp: new Date().getTime(),
          command: 'reset'
        };

        Facilities.getFacilities().forEach(function (fac) {
          if (fac.fid === facility.fid) {
            fac.status = 'ok';
          }
        });

        facility.status = 'ok';

        Facilities.getLinesForFacility(facility).forEach(function (line) {
          line.status = 'ok';
          line.statusMsg = 'ok';
          line.machines.forEach(function (machine) {
            machine.status = 'ok';
            machine.statusMsg = 'ok';
            try {
              sendJSONObjectMsg(msg,
                APP_CONFIG.CONTROL_TOPIC_PREFIX +
                "/facilities/" + facility.fid +
                "/lines/" + line.lid +
                "/machines/" + machine.mid +
                "/control");
            } catch (err) {
              console.log("Error sending control message to reset machine, ignoring. " + err);
            }

            if (simFailInProgress) {
              // reset simulator to good data and tell proxy
              factory.setSimState(0, facility.fid, line.lid, machine.mid);
              var simAlertEndpoint = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' +
                $location.host().replace(/^.*?\.(.*)/g, "$1") + '/api/utils/simulator/alert/' + facility.fid + '/' + line.lid + '/' + machine.mid;
              var simAlertControl = {
                id: guid(),
                timestamp: new Date().getTime(),
                type: 'ok',
                description: "Everything OK",
                details: JSON.stringify({
                  reason: "Problem corrected."
                })
              };

              $http({
                method: 'POST',
                url: simAlertEndpoint,
                data: simAlertControl
              }).then(function () {
                console.log("ok alert sent successfully to proxy");
              }, function err(response) {
                console.log("error sending ok alert to proxy: " + JSON.stringify(response));
              });

              simFailInProgress = false;
              if (connected) {
                stopSimAll();
                if (simFallbackTimer) {
                  $timeout.cancel(simFallbackTimer);
                  simFallbackTimer = undefined;
                }
              }

            }
          });
        });

        Facilities.resetStatus(facility);
      };

      $rootScope.$on('resetAll', function () {

        Facilities.getFacilities().forEach(function (facility) {
          factory.resetStatus(facility);
        });
      });

      $rootScope.$on("facilities:selected", function (evt, fac) {
        factory.unsubscribeAll();
        if (currentFacility) {
          var oldTopicName = "+/+/+/facilities/" + currentFacility.fid + "/lines/+/machines/+/alerts";
          if (connected) {
           // stopSim();
            client.unsubscribe(oldTopicName);
            console.log("unsubscribed from " + oldTopicName);
          } else {
           // startSim();
          }
        }
        currentFacility = fac;
        var topicName = "+/+/+/facilities/" + fac.fid + "/lines/+/machines/+/alerts";
        if (connected) {
         // stopSim();
          client.subscribe(topicName);
          console.log("subscribed to " + topicName);
        } else {
         // startSim();
        }
      });


      function connectClient(attempt) {

        var MAX_ATTEMPTS = 100;

        if (attempt > MAX_ATTEMPTS) {
          console.log("Cannot connect to broker after " + MAX_ATTEMPTS + " attempts, reload to retry");
          $rootScope.$broadcast("activity:gateway", {type: "warning", duration: 2000});
          return;
        }

        if (attempt > 1) {
          console.log("Trouble connecting to broker, will keep trying (reload to re-start the count)");
          $rootScope.$broadcast("activity:gateway", {type: "warning", duration: 2000});
        }
        var brokerHostname = APP_CONFIG.BROKER_HOSTNAME + '.' + $location.host().replace(/^.*?\.(.*)/g, "$1");
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
              connected = true;
              stopSimAll();
              $rootScope.$broadcast("activity:gateway", {duration: 5000});
              if (attempt > 1) {
                Notifications.success("Connected to the IoT cloud!");
              }
              var cur = Facilities.getCurrentFacility();
              if (cur) {
                currentFacility = cur;
                var topicName = "+/+/+/facilities/" + cur.fid + "/lines/+/machines/+/alerts";
                client.subscribe(topicName);
                console.log("subscribed to " + topicName);
                factory.subscribeAll();
              }
            },
            userName: APP_CONFIG.BROKER_USERNAME,
            password: APP_CONFIG.BROKER_PASSWORD,
            onFailure: function (err) {
              console.log("Failed to connect to broker (attempt " + attempt + "), retrying. Error code:" + err.errorCode + " message:" + err.errorMessage);
              $rootScope.$broadcast("activity:gateway", {type: "warning", duration: 2000});
             // startSim();
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

        try {
          client.subscribe(topicName);
          console.log("subscribed to " + topicName);
        } catch (err) {
          console.log("cannot subscribe to " + topicName + ": " + JSON.stringify(err));
        }
        listeners.push({
          machine: machine,
          topic: topicName,
          objType: 'machines',
          objId: machine.mid,
          listener: listener
        });
        if (!connected) {
          console.log("broker not connected. starting simulation for " + topicName);
          startSim(machine.currentFid, machine.currentLid, machine.mid);
        }
      };

      factory.unsubscribeMachine = function (machine) {
        var topicName = '+/+/+/facilities/' +
          machine.currentFid + '/lines/' + machine.currentLid + '/machines/' + machine.mid;
        try {
          client.unsubscribe(topicName);
          console.log("UNsubscribed from " + topicName);
        } catch (err) {
          console.log("cannot UNsubscribe from " + topicName + ": " + JSON.stringify(err));
        }
        listeners = listeners.filter(function (listener) {
          return ((!listener.machine) || (listener.topic !== topicName));
        });
        stopSim(machine.currentFid, machine.currentLid, machine.mid);
      };


      factory.unsubscribeAll = function () {
        listeners.forEach(function (listener) {
          client.unsubscribe(listener.topic);
          stopSimAll();
          console.log("unsubscribed from " + listener.topic);
        });

        listeners = [];
      };

      factory.subscribeAll = function () {
        listeners.forEach(function (listener) {
          client.subscribe(listener.topic);
          console.log("subscribed to " + listener.topic);
          if (!connected) {
            startSimAll();
          }
        });
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

          if (!response.data || response.data.length <= 0) {
            $rootScope.$broadcast("activity:cloud", {type: "warning", duration: 4000});
            cb(getSimHistory());
            return;
          }
          $rootScope.$broadcast("activity:cloud", {duration: 4000});

          cb(response.data);

        }, function err(response) {
          $rootScope.$broadcast("activity:cloud", {type: "warning", duration: 4000});
          cb(getSimHistory());
        });
      };

      function getSimHistory() {

        var points = factory.genTrend(20, 100, 100, 50, 70, .1, .1);

        return points.map(function(pt, idx, arr) {
          return {
            timestamp: new Date() - (24 * 60 * 60 * 1000) + ((idx/arr.length) * (24 * 60 * 60 * 1000)),
            value: pt
          }
        })

      }

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

        if (!connected) {
          simFailInProgress = true;
          predictiveMaintenanceSim(facility, line, machine);
          return;
        }

        var msg = {
          id: guid(),
          timestamp: new Date().getTime(),
          command: 'simulate_maintenance_required'
        };
        try {

          sendJSONObjectMsg(msg,
            APP_CONFIG.CONTROL_TOPIC_PREFIX +
            "/facilities/" + facility.fid +
            "/lines/" + line.lid +
            "/machines/" + machine.mid +
            "/control");
        } catch (err) {
          console.log("error starting predictive maintenance demo: " + err);
        }

        // start fallback timer to handle case where alerts just arent working for whatever reason
        simFallbackTimer = $timeout(function() {
          simFailInProgress = true;
          startSim(facility.fid, line.lid, machine.mid);
          predictiveMaintenanceSim(facility, line, machine);
        }, 10000);
      };

      function predictiveMaintenanceSim(facility, line, machine) {

        $timeout(function() {
          // switch telemetry
          factory.setSimState(1, facility.fid, line.lid, machine.mid);
          $timeout(function() {
            // send alert
            var alertObj = {
              sim: true,
              id: guid(),
              timestamp: new Date().getTime(),
              type: 'maintenance',
              description: "Maintenance Alert: Bad Power Supply",
              details: {
                reason: "Bad Power Supply Detected.",
                start: new Date().getTime() + (4 * 60 * 60 * 1000),
                end: new Date().getTime() + (5 * 60 * 60 * 1000)
              }
            };

            handleAlert('x/y/z/facilities/' + facility.fid + '/lines/' + line.lid + '/machines/' + machine.mid + '/alerts',
              alertObj);

            var simAlertEndpoint = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' +
              $location.host().replace(/^.*?\.(.*)/g, "$1") + '/api/utils/simulator/alert/' + facility.fid + '/' + line.lid + '/' + machine.mid;
            var simAlertControl = {
              id: guid(),
              timestamp: new Date().getTime(),
              type: 'maintenance',
              description: "Maintenance Alert: Bad Power Supply",
              details: JSON.stringify({
                reason: "Bad Power Supply Detected.",
                start: new Date().getTime() + (4 * 60 * 60 * 1000),
                end: new Date().getTime() + (5 * 60 * 60 * 1000)
              })
            };


            $http({
              method: 'POST',
              url: simAlertEndpoint,
              data: simAlertControl
            }).then(function () {
              console.log("alert sent successfully to proxy");
            }, function err(response) {
              console.log("error sending alert to proxy: " + JSON.stringify(response));
            });


          }, 10000);
        }, 2000);
      }

      factory.unpredictedError = function (facility, line, machine) {

        if (!connected) {
          simFailInProgress = true;
          unpredictedErrorSim(facility, line, machine);
          return;
        }
        var msg = {
          id: guid(),
          timestamp: new Date().getTime(),
          command: 'simulate_safety_hazard'
        };
        try {
          sendJSONObjectMsg(msg,
            APP_CONFIG.CONTROL_TOPIC_PREFIX +
            "/facilities/" + facility.fid +
            "/lines/" + line.lid +
            "/machines/" + machine.mid +
            "/control");
        } catch (err) {
          console.log("error starting predictive maintenance demo: " + err);
        }
        // start fallback timer to handle case where alerts just arent working for whatever reason
        simFallbackTimer = $timeout(function() {
          simFailInProgress = true;
          startSim(facility.fid, line.lid, machine.mid);
          unpredictedErrorSim(facility, line, machine);
        }, 10000);
      };

      function unpredictedErrorSim(facility, line, machine) {
          // switch telemetry to rotor locked immediately
        console.log("Starting UNpredicted error simulator");
          factory.setSimState(2, facility.fid, line.lid, machine.mid);
          $timeout(function() {
            // send alert
            var alertObj = {
              sim: true,
              id: guid(),
              timestamp: new Date().getTime(),
              type: 'error',
              description: "Maintenance Safety Hazard",
              details: {
                reason: "Automatic safety control has halted line due to safety hazard. Immediate maintenance required.",
                start: new Date().getTime(),
                end: new Date().getTime() + (1 * 60 * 60 * 1000)
              }
            };

            handleAlert('x/y/z/facilities/' + facility.fid + '/lines/' + line.lid + '/machines/' + machine.mid + '/alerts',
              alertObj);

            var simAlertEndpoint = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' +
              $location.host().replace(/^.*?\.(.*)/g, "$1") + '/api/utils/simulator/alert/' + facility.fid + '/' + line.lid + '/' + machine.mid;
            var simAlertControl = {
              id: guid(),
              timestamp: new Date().getTime(),
              type: 'error',
              description: "Maintenance Safety Hazard",
              details: JSON.stringify({
                reason: "Automatic safety control has halted line due to safety hazard. Immediate maintenance required.",
                start: new Date().getTime(),
                end: new Date().getTime() + (1 * 60 * 60 * 1000)
              })
            };


            $http({
              method: 'POST',
              url: simAlertEndpoint,
              data: simAlertControl
            }).then(function () {
              console.log("error alert sent successfully to proxy");
            }, function err(response) {
              console.log("error sending error alert to proxy: " + JSON.stringify(response));
            });


          }, 5000);

      }

      // Simulator

      function getTimer(fid, lid, mid) {
        var tid = fid+'/'+lid+'/'+mid;

        return simTimers.find(function(el) {
          return el.tid === tid;
        });
      }

      function getSimState(fid, lid, mid) {
        var tid = fid+'/'+lid+'/'+mid;

        return simStates.find(function(el) {
          return el.tid === tid;
        });
      }

      function startSim(fid, lid, mid) {
        var timerObj = getTimer(fid, lid, mid);

        if (timerObj) {
          if (!timerObj.timer) {
            timerObj.timer = $interval(function () {
              genPoint(fid, lid, mid);
            }, 2000, 0, false);
          }
        } else {
          var newTimer = {
            tid: fid + '/' + lid + '/' + mid,
            fid: fid,
            lid: lid,
            mid: mid,
            timer: $interval(function () {
              genPoint(fid, lid, mid);
            }, 2000, 0, false)
          };
          simTimers.push(newTimer);
        }
      }

      function startSimAll() {
        simTimers.forEach(function(simObj) {
          startSim(simObj.fid, simObj.lid, simObj.mid);
        })

      }

      function stopSim(fid, lid, mid) {
        var timerObj = getTimer(fid, lid, mid);
        if (!timerObj) return;
        $interval.cancel(timerObj.timer);
        timerObj.timer = undefined;
      }


      function stopSimAll() {
        simTimers.forEach(function(simObj) {
          stopSim(simObj.fid, simObj.lid, simObj.mid);
        })
      }


      factory.setSimState = function(newState, fid, lid, mid) {
        var stateObj = getSimState(fid, lid, mid);

        if (!stateObj) {
          simStates.push({tid: fid + '/' + lid + '/' + mid, state: newState});
        } else {
          stateObj.state = newState;
        }
      };

      // "timestamp", "motorid", "speed", "voltage", "current", "temp", "noise", "vibration"
      //       0          1          2        3          4         5       6          7

      var okDataCursor = 0;

      var okData = [
        [1503346643510, "motor=01", 1646.9899736122097, 213.66728310547808, 49.052685616206176, 85.71294438835459, 38.937879683346516, 0.21582625419915652],
        [1503346644510, "motor=01", 1645.3001213011657, 213.51040858718582, 49.132691620535226, 85.71002859151434, 38.91760145561399, 0.1848708544026738],
        [1503346645510, "motor=01", 1648.0612951570815, 213.7667373892575, 49.00196393147867, 85.70584774852084, 38.95073554188498, 0.13272320624345987],
        [1503346646510, "motor=01", 1633.4054179112923, 212.40618435864204, 49.69584597709256, 85.70857814620885, 38.77486501493551, 0.22709322685691072],
        [1503346647510, "motor=01", 1649.6250684577685, 213.9119075805578, 48.92792713391552, 85.70367884337253, 38.96950082149323, 0.15441160452648273],
        [1503346648510, "motor=01", 1650.3762008479794, 213.981637657629, 48.89236479460921, 85.69847646640544, 38.97851441017575, 0.1372103530744524],
        [1503346649510, "motor=01", 1649.6659654710438, 213.91570418409245, 48.92599086611284, 85.6936590113159, 38.96999158565252, 0.2236963053392621],
        [1503346650510, "motor=01", 1648.8094214252928, 213.83618839818908, 48.96654391692357, 85.68929120598028, 38.959713057103514, 0.13277678518017547],
        [1503346651510, "motor=01", 1642.4368270625669, 213.24459961590856, 49.26825419588663, 85.68795401045976, 38.883241924750806, 0.1307382959277669],
        [1503346652510, "motor=01", 1634.6795593062866, 212.52446707262223, 49.63552179296266, 85.69026613610549, 38.79015471167544, 0.13588938012319796],
        [1503346653510, "motor=01", 1639.1788980020578, 212.94215540308744, 49.422500744425406, 85.69044623211425, 38.844146776024694, 0.13234719582686233],
        [1503346654510, "motor=01", 1630.9054191944265, 212.1741012991484, 49.81420833743431, 85.6945024323337, 38.744865030333116, 0.20851572966767837],
        [1503346655510, "motor=01", 1633.9660597989523, 212.45823057918236, 49.669302404617, 85.69708350181608, 38.78159271758743, 0.2683351846986082],
        [1503346656510, "motor=01", 1633.2198420746854, 212.3889567466288, 49.70463205921931, 85.69998852418419, 38.772638104896224, 0.14859037779800982],
        [1503346657510, "motor=01", 1648.5004700650438, 213.80750743269996, 48.98117120932301, 85.69570223391464, 38.956005640780525, 0.15103131290745173],
        [1503346658510, "motor=01", 1633.0201742106428, 212.3704209256074, 49.714085327940225, 85.69871465632211, 38.77024209052772, 0.26801113616562233],
        [1503346659510, "motor=01", 1646.3331652307538, 213.60630943471534, 49.083782188295174, 85.695456953423, 38.929997982769045, 0.1363216113280806],
        [1503346660510, "motor=01", 1630.070410039696, 212.09658466762866, 49.85374181950938, 85.69985442790191, 38.73484492047635, 0.26968100910141635],
        [1503346661510, "motor=01", 1646.3903956756221, 213.6116223241387, 49.08107261468926, 85.69655850250831, 38.93068474810747, 0.2574996150294818],
        [1503346662510, "motor=01", 1643.4987234483533, 213.34317893133615, 49.217978745018556, 85.69465090705891, 38.89598468138024, 0.2815999577929029],
        [1503346663510, "motor=01", 1641.5408518112463, 213.16142330219517, 49.31067411588046, 85.69368007173554, 38.87249022173496, 0.16848352390750088],
        [1503346664510, "motor=01", 1648.1500091264315, 213.77497299725505, 48.99776377139992, 85.68962113235504, 38.95180010951718, 0.19396803503611265],
        [1503346665510, "motor=01", 1637.0066549074381, 212.7404989702412, 49.52534552517699, 85.69082584173074, 38.818079858889256, 0.22352633710336844],
        [1503346666510, "motor=01", 1648.0426705055725, 213.76500840192838, 49.00284571501652, 85.6868457558921, 38.95051204606687, 0.1887777966242289],
        [1503346667510, "motor=01", 1638.8138369711683, 212.90826559331308, 49.439784547410326, 85.68723116535253, 38.83976604365402, 0.17803641959502814],
        [1503346668510, "motor=01", 1642.521068992101, 213.25242006981998, 49.26426576439181, 85.68587508476648, 38.884252827905215, 0.14987602892310864],
        [1503346669510, "motor=01", 1638.5105129223425, 212.88010702955276, 49.45414541492809, 85.68641237352661, 38.836126155068115, 0.1264735452152644],
        [1503346670510, "motor=01", 1635.572770788826, 212.60738681663813, 49.59323272351455, 85.68832125375414, 38.80087324946591, 0.28423085302301043],
        [1503346671510, "motor=01", 1640.401351486379, 213.05563975922567, 49.3646237227949, 85.68794781607227, 38.85881621783655, 0.14997254945792285],
        [1503346672510, "motor=01", 1638.1013960213618, 212.8421273692315, 49.47351504169194, 85.68865613682429, 38.83121675225634, 0.1368711571721088],
        [1503346673510, "motor=01", 1637.9163685649087, 212.8249506651419, 49.48227516077763, 85.68944409954774, 38.8289964227789, 0.157147126286385],
        [1503346674510, "motor=01", 1630.3183665524707, 212.1196032818855, 49.842002326238386, 85.69378548158203, 38.73782039862965, 0.1289228575104929],
        [1503346675510, "motor=01", 1648.640202531482, 213.8204792546864, 48.97455558010992, 85.68949572700929, 38.95768243037779, 0.2955231138089964]
      ];

      var badPowerDataCursor = 0;

      var badPowerData = [
        [1503348002707, "motor-03", 1398.318956720434, 190.58233909398757, 60.82600706206634, 86.16399371535118, 35.95382748064521, 0.1033749164341573],
        [1503348003707, "motor-03", 1370.8844030323473, 188.0354997245031, 62.12489514050341, 86.28519024008865, 35.62461283638817, 0.2146848734569625],
        [1503348004707, "motor-03", 1409.9809061290175, 191.66495600900646, 60.2738724354067, 86.3868496747983, 36.09377087354821, 0.12668438933975928],
        [1503348005707, "motor-03", 1366.523215049314, 187.63063637665374, 62.33137544790658, 86.50786179498459, 35.57227858059177, 0.2457925460935794],
        [1503348006707, "motor-03", 1404.9612799892507, 191.19896769302363, 60.51152647655795, 86.60964728915268, 36.03353535987101, 0.2856324305509724],
        [1503348007707, "motor-03", 1384.4739678427984, 189.29706348336413, 61.48149762348429, 86.72001764273364, 35.78768761411358, 0.14941467142012352],
        [1503348008707, "motor-03", 1363.8264429013511, 187.38028619581797, 62.45905404013283, 86.83896210130362, 35.539917314816215, 0.10805245037617231],
        [1503348009707, "motor-03", 1396.720131455937, 190.4339149142162, 60.90170339374974, 86.9412993438887, 35.93464157747124, 0.2446973851038964],
        [1503348010707, "motor-03", 1353.5007558756663, 186.42171888931176, 62.94792336645099, 87.06287079177768, 35.416009070508, 0.11286059784599917],
        [1503348011707, "motor-03", 1400.5048269343838, 190.78526057690158, 60.722517105780184, 87.16119500320713, 35.980057923212605, 0.21025206596420695],
        [1503348012707, "motor-03", 1374.4153324472677, 188.36328745332972, 61.95772339880183, 87.2707645148232, 35.66698398936721, 0.16195902924462988],
        [1503348013707, "motor-03", 1373.3398571919574, 188.26344756702167, 62.008641740818945, 87.37974242290908, 35.65407828630349, 0.20984328218378595],
        [1503348014707, "motor-03", 1405.3573961704092, 191.23574045399266, 60.49277236846373, 87.47262344512778, 36.03828875404491, 0.17387706714204693],
        [1503348015707, "motor-03", 1378.0443261507205, 188.70017881087267, 61.78590880645493, 87.5773777078604, 35.710531913808644, 0.15046902839838858],
        [1503348016707, "motor-03", 1404.3255211551614, 191.1399481206054, 60.54162645849124, 87.66876603272087, 36.02590625386193, 0.11602804087058641],
        [1503348017707, "motor-03", 1354.7902957836739, 186.54143109763032, 62.88687014020853, 87.78245838678173, 35.431483549404085, 0.24169737603151814],
        [1503348018707, "motor-03", 1386.806537304224, 189.51360353733978, 61.37106219595671, 87.88000731865388, 35.81567844765069, 0.28956863245789854],
        [1503348019707, "motor-03", 1401.5382260367514, 190.88119439628215, 60.6735908578961, 87.96967579496051, 35.99245871244102, 0.10946136156634552],
        [1503348020707, "motor-03", 1377.2601474116739, 188.62738093312976, 61.82303572410382, 88.06982709067952, 35.701121768940084, 0.11773328011802318],
        [1503348021707, "motor-03", 1376.4387298157187, 188.55112605047518, 61.86192571425765, 88.16936188434389, 35.69126475778862, 0.2541208481607766],
        [1503348022707, "motor-03", 1383.3385138287397, 189.19165557266427, 61.53525565794122, 88.26466729651406, 35.774062165944876, 0.2408214045481593],
        [1503348023707, "motor-03", 1360.0378608919643, 187.02857973375086, 62.63842433578705, 88.3699410244732, 35.494454330703576, 0.1995560576540536],
        [1503348024707, "motor-03", 1357.6604623353073, 186.807878048209, 62.7509821954134, 88.47527633796307, 35.46592554802369, 0.16632614566089926],
        [1503348025707, "motor-03", 1366.6415031278639, 187.6416174459584, 62.32577510256121, 88.57534874809879, 35.57369803753437, 0.22719062483681965],
        [1503348026707, "motor-03", 1398.7941887131778, 190.62645643456906, 60.803507218369774, 88.65934998207966, 35.95953026455813, 0.18545506869631262],
        [1503348027707, "motor-03", 1380.5759225233505, 188.93519518412091, 61.66605045609833, 88.75105038177423, 35.740911070280205, 0.2431498395164302],
        [1503348028707, "motor-03", 1349.900572853823, 186.08750212159515, 63.118373917986474, 88.85621177974456, 35.372806874245875, 0.12447942292897118],
        [1503348029707, "motor-03", 1350.939667597787, 186.1839646860181, 63.06917801013077, 88.9598345242474, 35.385276011173445, 0.25213186657171993],
        [1503348030707, "motor-03", 1381.551978723307, 189.02580567427654, 61.61983910611896, 89.0480725861555, 35.75262374467968, 0.22464201548923018],
        [1503348031707, "motor-03", 1371.490401423621, 188.09175653765513, 62.09620416579588, 89.14014428153533, 35.63188481708345, 0.24157656964760754],
        [1503348032707, "motor-03", 1397.1201029635358, 190.47104557775117, 60.88276675534689, 89.21928222959791, 35.93944123556243, 0.20971485277711743],
        [1503348033707, "motor-03", 1373.4389506123978, 188.27264673341978, 62.003950165955914, 89.3087285139449, 35.655267407348774, 0.10594996065059603],
        [1503348034707, "motor-03", 1360.9265450115818, 187.11107918785572, 62.59634961419357, 89.40314508998597, 35.50511854013898, 0.18851569533387944],
        [1503348035707, "motor-03", 1359.762207995798, 187.0029899736166, 62.65147511345553, 89.49716324270932, 35.49114649594958, 0.1741984181144017],
        [1503348036707, "motor-03", 1401.9513764753578, 190.9195485030967, 60.65403026342068, 89.5704665098901, 35.997416517704295, 0.1111128706190288],
        [1503348037707, "motor-03", 1396.8117284044947, 190.44241815860516, 60.89736673911136, 89.64544577550839, 35.93574074085394, 0.23398160101837773],
        [1503348038707, "motor-03", 1355.7073778355489, 186.6265668246889, 62.84345091940865, 89.73894148185545, 35.44248853402659, 0.2647303857244483],
        [1503348039707, "motor-03", 1355.7757233844407, 186.6329115655812, 62.84021510155358, 89.83147019654227, 35.443308680613285, 0.22419913799005203],
        [1503348040707, "motor-03", 1373.0164013814265, 188.23342010596235, 62.0239557459592, 89.91499265646185, 35.65019681657712, 0.1853689585776742],
        [1503348041707, "motor-03", 1402.8582496599429, 191.00373650760702, 60.61109438112041, 89.98369256427033, 36.00829899591932, 0.2374861146341263],
        [1503348042707, "motor-03", 1363.6338573688276, 187.36240785080093, 62.46817199609151, 90.07009054138894, 35.537606288425934, 0.20945658676939766],
        [1503348043707, "motor-03", 1355.155009938115, 186.5752887057292, 62.869602760078095, 90.15959870329982, 35.435860119257384, 0.10507062171397884],
        [1503348044707, "motor-03", 1408.706487129606, 191.54664752410008, 60.33420976270895, 90.22311139291764, 36.07847784555527, 0.2615552129688795],
        [1503348045707, "motor-03", 1379.7707461233872, 188.86044802482243, 61.70417150734056, 90.29955157691114, 35.731248953480645, 0.1271758590945366],
        [1503348046707, "motor-03", 1357.6858338901611, 186.8102333726477, 62.74978097994966, 90.38557889284353, 35.46623000668193, 0.2078005202282715],
        [1503348047707, "motor-03", 1380.447079139586, 188.92323423130208, 61.672150542035936, 90.46007739428124, 35.739364949675036, 0.27308376350449043],
        [1503348048707, "motor-03", 1394.4512091865076, 190.22328343729183, 61.00912544698116, 90.52726696226354, 35.90741451023809, 0.22641200833231928],
        [1503348049707, "motor-03", 1356.8304745981236, 186.73082757130743, 62.79027793863321, 90.61141804423337, 35.45596569517748, 0.23378314863989472],
        [1503348050707, "motor-03", 1350.1269902912748, 186.10852119302587, 63.107654191556804, 90.69786964028745, 35.3755238834953, 0.10409122117588915],
        [1503348051707, "motor-03", 1359.164924848393, 186.94754222506432, 62.67975346521719, 90.77922050319023, 35.48397909818071, 0.2870776385174628],
        [1503348052707, "motor-03", 1410.9773056023123, 191.75745503177797, 60.22669793379323, 90.83547260770288, 36.10572766722775, 0.18155344109609692],
        [1503348053707, "motor-03", 1413.0657280952228, 191.9513301239531, 60.12782163678391, 90.89018331583001, 36.13078873714267, 0.1751518994406145],
        [1503348054707, "motor-03", 1401.7876495352812, 190.9043491956258, 60.66178191023084, 90.949633123583, 35.995451794423374, 0.21542215471403278],
        [1503348055707, "motor-03", 1408.9104475301979, 191.56558183533213, 60.324553263980604, 91.00514986966057, 36.08092537036238, 0.13057471555696437],
        [1503348056707, "motor-03", 1390.3506023884688, 189.8426106933224, 61.20326854640557, 91.06881072957339, 35.85820722866163, 0.254753109232416],
        [1503348057707, "motor-03", 1359.3480903638651, 186.96454607908143, 62.67108149966846, 91.14636632912438, 35.48617708436638, 0.22192316951094426],
        [1503348058707, "motor-03", 1371.0513657732222, 188.05099942194784, 62.1169902948066, 91.21766086975171, 35.62661638927867, 0.2617621810849916],
        [1503348059707, "motor-03", 1353.2940072502297, 186.40252573804582, 62.95771187359662, 91.2965656086028, 35.41352808700276, 0.2967677177120586],
        [1503348060707, "motor-03", 1372.8424679961904, 188.21727330079747, 62.03219061659328, 91.36551863962104, 35.64810961595428, 0.17610599433225455],
        [1503348061707, "motor-03", 1376.20695136867, 188.52960929898532, 61.872899257517474, 91.43220515587426, 35.688483416424035, 0.16091850479273112],
        [1503348062707, "motor-03", 1366.9582382495278, 187.67102100348382, 62.310779288223245, 91.50255981926892, 35.57749885899433, 0.1285830589027849],
        [1503348063707, "motor-03", 1355.5314165048064, 186.61023175870835, 62.85178180305874, 91.57756686092651, 35.44037699805767, 0.18289717352311632],
        [1503348064707, "motor-03", 1395.855784284288, 190.35367473860822, 60.9426258833098, 91.63292318856202, 35.92426941141146, 0.1865123845599314],
        [1503348065707, "motor-03", 1374.1235299077105, 188.3361984689668, 61.97153878082692, 91.69791219060659, 35.66348235889252, 0.17773377615269567],
        [1503348066707, "motor-03", 1397.6652967728214, 190.52165770263844, 60.8569545716544, 91.7512169189599, 35.945983561273856, 0.12061498324781557],
        [1503348067707, "motor-03", 1401.467223251174, 190.87460297541534, 60.67695248253817, 91.80220657934743, 35.99160667901408, 0.26951436942344603],
        [1503348068707, "motor-03", 1405.3468183544028, 191.23475848072806, 60.49327317482869, 91.85086791798476, 36.03816182025283, 0.11878605514366113],
        [1503348069707, "motor-03", 1409.3345874834154, 191.60495613473964, 60.304472371282785, 91.89717351528061, 36.086015049800984, 0.2604601474899959],
        [1503348070707, "motor-03", 1404.3273798460332, 191.14012066895964, 60.54153845883057, 91.94536301087022, 36.0259285581524, 0.15477418011692995]
      ];

      var rotorLockedCursor = 0;

      var rotorLockedData = [
        [1503348144710, "motor-03", 0, 212.92109610384657, 149.9418310041466, 86.22351831892671, 119.51508047377385, 1.3356586428106842],
        [1503348145710, "motor-03", 0, 212.85485508844303, 149.51905469249795, 87.20932177719317, 122.82256267780912, 1.3988518082573587],
        [1503348146710, "motor-03", 0, 213.27391359638085, 151.42291195913938, 88.20411538781671, 111.14372215321035, 1.284754718333613],
        [1503348147710, "motor-03", 0, 212.62330938127917, 148.61171274337119, 89.16113019009792, 123.94866581103852, 1.2845750679531194],
        [1503348148710, "motor-03", 0, 213.44638163448832, 149.81215407196044, 90.12045921350935, 52.819481152142316, 0.017237379328038212],
        [1503348149710, "motor-03", 0, 212.13565977223803, 150.4371758895402, 91.0763826626807, 46.92938669068902, 0.010093777596297891],
        [1503348150710, "motor-03", 0, 213.59183418227212, 148.80383647404912, 92.00657681714698, 51.13777234579729, 0.012846672258273115],
        [1503348151710, "motor-03", 0, 213.2398682696325, 148.16940392825347, 92.92118814786522, 50.65570420164144, 0.01706854597371575],
        [1503348152710, "motor-03", 0, 212.39914836532577, 149.87967789494238, 93.8435850775465, 48.07682489241679, 0.017156985523449762],
        [1503348153710, "motor-03", 0, 212.46647676846106, 151.6104881345619, 94.7738930593032, 59.06437535169417, 0.013195115974826038],
        [1503348154710, "motor-03", 0, 212.64721431470204, 150.49418454283037, 95.6838465556842, 43.47353543891431, 0.012129728459165823],
        [1503348155710, "motor-03", 0, 213.99625115002647, 150.14286834279275, 96.581222486721, 46.98576831815231, 0.014257836822992004],
        [1503348156710, "motor-03", 0, 213.34261587930033, 149.2658103104024, 97.46094178392677, 51.466445701956914, 0.013338119610322618],
        [1503348157710, "motor-03", 0, 212.35409358293558, 148.9175587264023, 98.32841619747889, 59.41739321767557, 0.0153989745681706],
        [1503348158710, "motor-03", 0, 212.2840728626608, 148.07404192263357, 99.17886505053816, 44.06537530404519, 0.014644804459393052],
        [1503348159710, "motor-03", 0, 212.72138692306777, 150.9648621100484, 100.04942853492226, 53.882515437930664, 0.01839483571908666],
        [1503348160710, "motor-03", 0, 213.33989227907983, 151.19531482500233, 100.91356786634056, 51.1625724002694, 0.015031457656193382],
        [1503348161710, "motor-03", 0, 0, 0, 207.20397450256704, 0, 0],
        [1503348162710, "motor-03", 0, 0, 0, 204.73037561314342, 0, 0],
        [1503348163710, "motor-03", 0, 0, 0, 200.38674880208754, 0, 0],
        [1503348164710, "motor-03", 0, 0, 0, 215.04315004431655, 0, 0],
        [1503348165710, "motor-03", 0, 0, 0, 212.46719965276603, 0, 0],
        [1503348166710, "motor-03", 0, 0, 0, 214.25648787411012, 0, 0],
        [1503348167710, "motor-03", 0, 0, 0, 210.5158925356572, 0, 0],
        [1503348168710, "motor-03", 0, 0, 0, 201.15127274457882, 0, 0],
        [1503348169710, "motor-03", 0, 0, 0, 219.59714787091013, 0, 0],
        [1503348170710, "motor-03", 0, 0, 0, 207.03725342123641, 0, 0],
        [1503348171710, "motor-03", 0, 0, 0, 217.31222125888567, 0, 0],
        [1503348172710, "motor-03", 0, 0, 0, 213.19329764128045, 0, 0],
        [1503348173710, "motor-03", 0, 0, 0, 217.5049971815437, 0, 0],
        [1503348174710, "motor-03", 0, 0, 0, 218.88291023528603, 0, 0],
        [1503348175710, "motor-03", 0, 0, 0, 219.014359365132, 0, 0],
        [1503348176710, "motor-03", 0, 0, 0, 206.41616211171873, 0, 0],
        [1503348177710, "motor-03", 0, 0, 0, 215.3537002209503, 0, 0],
        [1503348178710, "motor-03", 0, 0, 0, 212.45066489756516, 0, 0],
        [1503348179710, "motor-03", 0, 0, 0, 215.31815452287685, 0, 0],
        [1503348180710, "motor-03", 0, 0, 0, 210.22084376079644, 0, 0],
        [1503348181710, "motor-03", 0, 0, 0, 203.2671867670188, 0, 0],
        [1503348182710, "motor-03", 0, 0, 0, 200.02207013275284, 0, 0],
        [1503348183710, "motor-03", 0, 0, 0, 210.132327729128, 0, 0],
        [1503348184710, "motor-03", 0, 0, 0, 210.56857764511398, 0, 0],
        [1503348185710, "motor-03", 0, 0, 0, 202.5972591310718, 0, 0],
        [1503348186710, "motor-03", 0, 0, 0, 218.3206667635805, 0, 0],
        [1503348187710, "motor-03", 0, 0, 0, 218.07687857382987, 0, 0],
        [1503348188710, "motor-03", 0, 0, 0, 200.40175072337476, 0, 0],
        [1503348189710, "motor-03", 0, 0, 0, 203.97872652326234, 0, 0],
        [1503348190710, "motor-03", 0, 0, 0, 211.0739006721629, 0, 0],
        [1503348191710, "motor-03", 0, 0, 0, 212.04741500563125, 0, 0],
        [1503348192710, "motor-03", 0, 0, 0, 204.6546456883316, 0, 0],
        [1503348193710, "motor-03", 0, 0, 0, 208.84787176815865, 0, 0],
        [1503348194710, "motor-03", 0, 0, 0, 213.23696707145808, 0, 0],
        [1503348195710, "motor-03", 0, 0, 0, 209.02866327789653, 0, 0],
        [1503348196710, "motor-03", 0, 0, 0, 203.13755985825975, 0, 0],
        [1503348197710, "motor-03", 0, 0, 0, 212.59286900923777, 0, 0],
        [1503348198710, "motor-03", 0, 0, 0, 210.20247434792347, 0, 0],
        [1503348199710, "motor-03", 0, 0, 0, 219.79331551091406, 0, 0],
        [1503348200710, "motor-03", 0, 0, 0, 218.64585854275992, 0, 0],
        [1503348201710, "motor-03", 0, 0, 0, 218.2670076216231, 0, 0],
        [1503348202710, "motor-03", 0, 0, 0, 204.42803492575794, 0, 0],
        [1503348203710, "motor-03", 0, 0, 0, 211.42771134890327, 0, 0],
        [1503348204710, "motor-03", 0, 0, 0, 210.05411707402413, 0, 0],
        [1503348205710, "motor-03", 0, 0, 0, 203.8573764636174, 0, 0],
        [1503348206710, "motor-03", 0, 0, 0, 200.62443593615873, 0, 0],
        [1503348207710, "motor-03", 0, 0, 0, 217.2885570767402, 0, 0],
        [1503348208710, "motor-03", 0, 0, 0, 202.44029817999754, 0, 0],
        [1503348209710, "motor-03", 0, 0, 0, 202.04177985129692, 0, 0],
        [1503348210710, "motor-03", 0, 0, 0, 213.15574600750756, 0, 0],
        [1503348211710, "motor-03", 0, 0, 0, 214.86852724198116, 0, 0],
        [1503348212710, "motor-03", 0, 0, 0, 204.40355987023995, 0, 0],
        [1503348213710, "motor-03", 0, 0, 0, 203.36563632559069, 0, 0],
        [1503348214710, "motor-03", 0, 0, 0, 219.49563339707856, 0, 0],
        [1503348215710, "motor-03", 0, 0, 0, 200.42585892945766, 0, 0],
        [1503348216710, "motor-03", 0, 0, 0, 206.47957427332733, 0, 0],
        [1503348217710, "motor-03", 0, 0, 0, 214.20347261223077, 0, 0],
        [1503348218710, "motor-03", 0, 0, 0, 200.24738832532182, 0, 0],
        [1503348219710, "motor-03", 0, 0, 0, 200.36639753245424, 0, 0],
        [1503348220710, "motor-03", 0, 0, 0, 203.895774059864, 0, 0],
        [1503348221710, "motor-03", 0, 0, 0, 211.96418908604608, 0, 0],
        [1503348222710, "motor-03", 0, 0, 0, 207.17190771271612, 0, 0],
        [1503348223710, "motor-03", 0, 0, 0, 219.8725297635735, 0, 0],
        [1503348224710, "motor-03", 0, 0, 0, 218.4814674619676, 0, 0],
        [1503348225710, "motor-03", 0, 0, 0, 217.8607093489358, 0, 0],
        [1503348226710, "motor-03", 0, 0, 0, 205.77766335255092, 0, 0],
        [1503348227710, "motor-03", 0, 0, 0, 217.48411478250569, 0, 0],
        [1503348228710, "motor-03", 0, 0, 0, 212.5048464349621, 0, 0],
        [1503348229710, "motor-03", 0, 0, 0, 212.94080065434966, 0, 0],
        [1503348230710, "motor-03", 0, 0, 0, 207.94059589604214, 0, 0],
        [1503348231710, "motor-03", 0, 0, 0, 201.2108624547672, 0, 0],
        [1503348232710, "motor-03", 0, 0, 0, 206.43747739506114, 0, 0],
        [1503348233710, "motor-03", 0, 0, 0, 217.23499909850804, 0, 0],
        [1503348234710, "motor-03", 0, 0, 0, 211.68798227283565, 0, 0],
        [1503348235710, "motor-03", 0, 0, 0, 209.21635646386218, 0, 0],
        [1503348236710, "motor-03", 0, 0, 0, 213.01849744088665, 0, 0],
        [1503348237710, "motor-03", 0, 0, 0, 203.06507537213247, 0, 0],
        [1503348238710, "motor-03", 0, 0, 0, 215.29905080186188, 0, 0],
        [1503348239710, "motor-03", 0, 0, 0, 216.65497219900504, 0, 0],
        [1503348240710, "motor-03", 0, 0, 0, 202.0649590363497, 0, 0],
        [1503348241710, "motor-03", 0, 0, 0, 203.94782625595982, 0, 0],
        [1503348242710, "motor-03", 0, 0, 0, 212.11523132121187, 0, 0],
        [1503348243710, "motor-03", 0, 0, 0, 217.46041497270824, 0, 0]
      ];

      var dataSets = [okData, badPowerData, rotorLockedData];
      var dataCursors = [okDataCursor, badPowerDataCursor, rotorLockedCursor];

      var genPoint = function(fid, lid, mid) {
        var state = 0;
        var stateObj = getSimState(fid, lid, mid);
        if (stateObj) {
          state = stateObj.state;
        }

        if (state !== 0 && state !== 1 && state !== 2) {
          state = 0;
        }
        var obj = {
          sim: true,
          metric: [
            { name: "sim",
              boolValue: true
            },
            {
              name: "speed",
              doubleValue: dataSets[state][dataCursors[state]][2]
            },
            {
              name: "voltage",
              doubleValue: dataSets[state][dataCursors[state]][3]
            },
            {
              name: "current",
              doubleValue: dataSets[state][dataCursors[state]][4]
            },
            {
              name: "temp",
              doubleValue: dataSets[state][dataCursors[state]][5]
            },
            {
              name: "noise",
              doubleValue: dataSets[state][dataCursors[state]][6]
            },
            {
              name: "vibration",
              doubleValue: dataSets[state][dataCursors[state]][7]
            }
          ]

        };

        dataCursors[state]++;
        if (dataCursors[state] >= dataSets[state].length) {
          dataCursors[state] = 0;
        }

        var payload = msgproto.encode(obj).finish();
        var message = new Paho.MQTT.Message(payload);
        message.destinationName = 'x/y/z/facilities/' + fid + '/lines/' + lid + '/machines/' + mid;
        onMessageArrived(message);


      };
      connectClient(1);

      return factory;
    }]);
