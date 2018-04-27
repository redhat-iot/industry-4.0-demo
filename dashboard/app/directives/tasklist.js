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


angular.module('app').directive('tasklist', ['APP_CONFIG', '$location',
	function (APP_CONFIG, $location) {


	return {
        restrict: 'E',
        replace: false,
        scope: {
        	selectedFacility: '=?'
		},
        templateUrl: 'partials/tasklist.html',
        controller: 'TasklistController',
        link: function (scope, element, attrs) {

            var calEndpoint = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' + $location.host().replace(/^.*?\.(.*)/g,"$1") + '/api/facilities/calendar';

            scope.$watch('selectedFacility', function() {
                if (!scope.selectedFacility) {
                    $('#tasklist').innerHTML = '';
                    return;
                }

                function render(fac) {
                    $('#tasklist').fullCalendar({
                        defaultView: 'basicDay',
                        contentHeight: 600,
                        nowIndicator: true,
                        allDaySlot: false,
						weekends: true,
						navLinks: true,
						timezone: 'local',
						header: {
                            left:   'title',
                            //center: 'agendaWeek agendaDay',
                            right:  'today prev,next'
                        },
                        eventClick: function(calEvent, jsEvent, view) {

                            scope.eventPopup(calEvent);

                        }


                    }).fullCalendar('removeEventSources');

                    $('#tasklist').fullCalendar('addEventSource',
                        {
                            url: calEndpoint + '/' + fac.fid + '/maintenance'
                        }
                    );
                }

                render(scope.selectedFacility);


			});

            scope.$on('facilities:reset', function (evt, facility) {
                // reset non-run cal entry color
                $('#tasklist').fullCalendar('clientEvents').forEach(function(evt) {
                    if ((evt.type === 'maintenance' || evt.type === 'error') && evt.facility.fid === facility.fid) {
                        evt.color = 'lightgray';
                        evt.title = 'COMPLETED: ' + evt.title;
                        $('#tasklist').fullCalendar('updateEvent', evt);
                    }
                })
            });

        }
    }
}]);
