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

                var calEndpoint = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' + $location.host().replace(/^.*?\.(.*)/g, "$1") + '/api/facilities/calendar';

                // handleAlert: {"id":"foo","description":"the dest","timestamp":1503599719963,"type":"maintenance","details":{"reason":"the reason","start":1503599719963,"end":1503599719963}}

                scope.$on('alert', function (evt, alert) {
                    if (alert.type === 'maintenance' && alert.facility.fid === scope.selectedFacility.fid) {
                        $('#fullcalendar').fullCalendar('addEventSource',
                            {
                                events: [
                                    {
                                        type: alert.type,
                                        title: alert.description,
                                        start: alert.details.start,
                                        end: alert.details.end,
                                        color: '#cc0000',
                                        details: {
                                            desc: alert.details.reason,
                                            links: [
                                                {
                                                    name: "Installation Guide",
                                                    link: "http://redhat.com"
                                                },
                                                {
                                                    name: "Repair Guide",
                                                    link: "http://developers.redhat.com"
                                                }
                                            ]
                                        },
                                        facility: alert.facility
                                    }
                                ]
                            }
                        );
                    }
                });

                scope.$watch('selectedFacility', function () {
                    if (!scope.selectedFacility) {
                        return;
                    }

                    function render(fac) {

                        var scrollTime = (new Date().getHours() - 1) + ':00:00';

                        $('#fullcalendar').fullCalendar({
                            defaultView: 'agendaDay',
                            contentHeight: 400,
                            nowIndicator: true,
                            allDaySlot: false,
                            weekends: true,
                            navLinks: true,
                            timezone: 'local',
                            scrollTime: scrollTime,
                            header: {
                                left: 'title',
                                center: 'agendaWeek agendaDay',
                                right: 'today prev,next'
                            },
                            eventClick: function (calEvent, jsEvent, view) {

                                scope.eventPopup(calEvent);

                            }


                        }).fullCalendar('removeEventSources');

                        $('#fullcalendar').fullCalendar('addEventSource',
                            {
                                url: calEndpoint + '/' + fac.fid + '/all'
                            }
                        );

                    }

                    render(scope.selectedFacility);


                });

                scope.$on('facilities:reset', function (evt, facility) {
                    // reset non-run cal entry color
                    $('#fullcalendar').fullCalendar('clientEvents').forEach(function(evt) {
                        if (evt.type === 'maintenance' && evt.facility.fid === facility.fid) {
                            evt.color = 'lightgray';
                            evt.title = 'COMPLETED: ' + evt.title;
                            $('#fullcalendar').fullCalendar('updateEvent', evt);
                        }
                    })
                });

            }
        }
    }]);
