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

.factory('Machines', ['$rootScope', '$location', '$http', '$q', 'APP_CONFIG', 'Notifications',
    function($rootScope, $location, $http, $q, APP_CONFIG, Notifications) {

	var factory = {},
		machines = [],
        allMachines = [],
		configRestEndpoint = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' + $location.host().replace(/^.*?\.(.*)/g,"$1") + '/api/machines';

	    factory.getCurrentMachines = function() {
	        return machines;
        };

        factory.getMachines = function(line, cb) {
            // get config
            $http({
                method: 'GET',
                url: configRestEndpoint + '/' + line.lid
            }).then(function (response) {
                machines = response.data;
                if ((machines == undefined) || (machines.constructor !== Array)) {
                    Notifications.error("Error fetching Machines for line:" + line.lid + " (invalid data). Reload to retry");
                    return;
                }

                cb(lines);

            }, function err(response) {
                console.log(JSON.stringify(response));
                Notifications.error("Error fetching Machines for line: " + line.lid + ". Reload to retry");
            });

        };

        factory.getAllMachines = function(cb) {
            // get config
            $http({
                method: 'GET',
                url: configRestEndpoint
            }).then(function (response) {
                allMachines = response.data;
                if ((allMachines == undefined) || (allMachines.constructor !== Array)) {
                    Notifications.error("Error fetching ALL Machines (invalid data). Reload to retry");
                    return;
                }

                cb(allMachines);

            }, function err(response) {
                console.log(JSON.stringify(response));
                Notifications.error("Error fetching ALL Machines. Reload to retry");
            });

        };

        return factory;
}]);
