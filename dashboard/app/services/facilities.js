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


    factory.getFacilities = function() {
        return facilities;
    };

    factory.reset = function() {

        // get config
        $http({
            method: 'GET',
            url: configRestEndpoint + "/"
        }).then(function (response) {
            facilities = response.data;
            if ((facilities == undefined) || (facilities.constructor !== Array)) {
                Notifications.error("Error fetching Facilities (invalid data). Reload to retry");
                return;
            }

            $rootScope.$broadcast('facilities:updated');

        }, function err(response) {
            console.log(JSON.stringify(response));
            Notifications.error("Error fetching Facilities Configuration from [" + response.config.url + "]. Reload to retry");
        });

    };

	factory.reset();

	return factory;
}]);
