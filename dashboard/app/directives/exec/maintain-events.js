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


angular.module('app').directive('execMaintainEvents', function () {


	return {
        restrict: 'E',
        replace: false,
        scope: {
            timeLineData: "=?",
            period: "=?",
            timeframe: "=?"
        },
        templateUrl: 'partials/exec/maintain-events.html',
        controller: 'ExecMaintainEventsController',
        link: function (scope, element, attrs) {

        	scope.$watch('period', function(){
                var chart = d3.select(element[0]).select("#timelinediv");

                var daysPast;

                switch (scope.period) {
					case 'week':
						daysPast = 7;
                        break;
                    case 'month':
                        daysPast = 30;
                        break;
                    case 'year':
                    default:
                        daysPast = 365;
				}

                var timelineChart = d3.chart.timeline()
                    .slider(false)
                    .context(true)
                    .eventColor(function (evt) {
                        if (evt.hasOwnProperty("events")) {
                            // grouped event
                            return evt.events[0].details.color;
                        } else {
                            return evt.details.color;
                        }
                    })
                    .eventHover(function (el) {

                    })
                    .start(new Date().getTime() - (daysPast * 24 * 60 * 60 * 1000))
                    .end(new Date().getTime());

                d3.select('#timelinediv')
                    .datum(scope.timelineData)
                    .call(timelineChart);

                $('[data-toggle="popover"]').popover({
                    'container': chart,
                    'placement': 'auto'
                });


            });

        }
    }});
