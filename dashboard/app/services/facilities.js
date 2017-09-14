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
 *
 * ******************************************************************************
 */

'use strict';

angular.module('app')

.factory('Facilities', ['$rootScope', '$location', '$http', '$q', 'APP_CONFIG', 'Notifications', function($rootScope, $location, $http, $q, APP_CONFIG, Notifications) {

	var factory = {},
		facilities = [],
		configRestEndpoint = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' + $location.host().replace(/^.*?\.(.*)/g,"$1") + '/api/facilities';

    var currentLine = null, currentFacility = null, currentMachine = null;

    $rootScope.$on("lines:selected", function(evt, line) {
        currentLine = line;
        currentMachine = null;
    });

    $rootScope.$on("facilities:selected", function(evt, fac) {
        currentFacility = fac;
        currentLine = currentMachine = null;
    });
    $rootScope.$on("machines:selected", function(evt, mac) {
        currentMachine = mac;
    });

    factory.getCurrentLine = function() {
        return currentLine;
    };
    factory.getCurrentMachine = function() {
        return currentMachine;
    };

    factory.getCurrentFacility = function() {
        return currentFacility;
    };

    factory.getFacilities = function() {
        return facilities;
    };

    factory.getFacilityById = function(id) {
        return facilities.find(function(el) {
            return el.fid === id;
        });
    };

    factory.getLines = function() {
        var lines = [];
        facilities.forEach(function(f) {
            Array.prototype.push.apply(lines, f.lines);
        });
        return lines;
    };

    factory.getLinesForFacility = function(facility) {
        var lines = [];
        facilities.forEach(function(f) {
            Array.prototype.push.apply(lines, f.lines.filter(function(l) {
                return l.currentFid === facility.fid;
            }));
        });
        return lines;
    };

    factory.resetStatus = function(facility) {
        $http({
            method: 'POST',
            url: configRestEndpoint + "/" + facility.fid + "/resetStatus"
        }).then(function (response) {
        }, function err(response) {
            console.log(JSON.stringify(response));
        });

    };

    factory.reset = function() {

        // get config
        $http({
            method: 'GET',
            url: configRestEndpoint + "/"
        }).then(function (response) {
            facilities = response.data;

            if ((facilities === undefined) || (facilities.constructor !== Array)) {
                Notifications.error("Error fetching Facilities (invalid data). Reload to retry");
                return;
            }

            // Sort the result
            facilities.sort(function(a, b) {
                return a.fid.localeCompare(b.fid);
            }).forEach(function(fac) {
                fac.lines.sort(function(a, b) {
                    return a.lid.localeCompare(b.lid);
                });
                fac.lines.forEach(function(line) {
                    line.machines.sort(function(a, b) {
                        return a.mid.localeCompare(b.mid);
                    });
                });
            });

            facilities.forEach(function(facility) {
                facility.lines.forEach(function(line) {
                    if (line.status !== 'ok') {
                        facility.status = line.status;
                    }
                });
            });

            $rootScope.$broadcast('facilities:updated');

        }, function err(response) {
            console.log(JSON.stringify(response));
            Notifications.error("Error fetching Facilities Configuration from [" + response.config.url + "]. Reload to retry");
        });

    };

	factory.reset();

	return factory;
}]);
