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


angular.module('app').directive('calendar', ['APP_CONFIG', '$location',
	function (APP_CONFIG, $location) {


	return {
        restrict: 'E',
        replace: false,
        scope: {
        	selectedFacility: '=?'
		},
        templateUrl: 'partials/calendar.html',
        controller: 'CalendarController',
        link: function (scope, element, attrs) {

            var calEndpoint = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' + $location.host().replace(/^.*?\.(.*)/g,"$1") + '/api/facilities/calendar';

            scope.$watch('selectedFacility', function() {
                if (!scope.selectedFacility) {
                	console.log("cal: no facility");
                    return;
                }

                function render(fac) {
                    $('#fullcalendar').fullCalendar({
                        defaultView: 'agendaDay',
                        contentHeight: 600,
                        nowIndicator: true,
                        allDaySlot: false,
						weekends: false,
						navLinks: true,
						timezone: 'local',
						header: {
                            left:   'title',
                            center: 'agendaWeek agendaDay',
                            right:  'today prev,next'
                        },
                        eventSources: [
							{
                                url: calEndpoint + '/' + fac.fid
                            }
                        ],
                        eventClick: function(calEvent, jsEvent, view) {

                            scope.eventPopup(calEvent);

                        }


                    })
                }

                render(scope.selectedFacility);


			});
        }
    }
}]);
