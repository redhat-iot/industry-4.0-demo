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

    .filter('reverse', function () {
        return function (items) {
            return items.slice().reverse();
        };
    })

    .filter('capitalize', function () {
        return function (input) {
            return (!!input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
        }
    })

    .controller("ExecHomeController",
        ['$scope', '$routeParams',
            function ($scope, $routeParams) {


            }])

    .controller("TechTasksController",
        ['$scope', '$http', '$filter', 'Notifications', 'SensorData', 'Facilities',
            function ($scope, $http, $filter, Notifications, SensorData, Facilities) {

                $scope.selectedFacility = null;
                $scope.selectedLine = null;

                $scope.selectedFacility = Facilities.getCurrentFacility();
                $scope.selectedLine = Facilities.getCurrentLine();

            }])

    .controller("ExecBizStateController",
        ['$scope', '$http', '$filter', 'Notifications', 'SensorData', 'Reports',
            function ($scope, $http, $filter, Notifications, SensorData, Reports) {

                $scope.stateTimeFrame = 'Last Month';
                var today = new Date();
                var dates = ['dates'];
                var yTemp = ['used'];
                for (var d = 20 - 1; d >= 0; d--) {
                    dates.push(new Date(today.getTime() - (d * 24 * 60 * 60 * 1000)));
                    yTemp.push('');
                }

                var actuals = ["Retention", "Margin", "Facilities", "P/E Ratio", "Closed"];

                function fill(data) {
                    return data.map(function (v, idx) {
                        if (idx == 0) {
                            return v;
                        } else {
                            return 80 + Math.floor(Math.random() * 20);
                        }
                    });
                }

                $scope.setBizStatePeriod = function (period) {

                    if (period == 'month') {
                        $scope.stateTimeFrame = "Last Month";
                    } else if (period == 'year') {
                        $scope.stateTimeFrame = "Year to Date";
                    } else {
                        $scope.stateTimeFrame = "Beginning of Time";
                    }

                    $scope.bizStates.forEach(function (bizState) {
                        bizState.data.yData = fill(bizState.data.yData);
                    });
                };

                $scope.bizStates = actuals.map(function (name) {
                    return {
                        config: {
                            'chartId': name.replace(/[^A-Za-z0-9]/g, ''),
                            'layout': 'inline',
                            'trendLabel': name,
                            'tooltipType': 'percentage',
                            'valueType': 'actual'
                        },
                        data: {
                            'total': '100',
                            'xData': dates,
                            'yData': fill(yTemp)

                        }
                    };
                });


            }])

    .controller("ExecMaintainEventsController",
        ['$scope', '$http', '$filter', 'Notifications', 'SensorData', 'Reports',
            function ($scope, $http, $filter, Notifications, SensorData, Reports) {
                $scope.timeframe = "Last Year";
                $scope.period = "year";
                var MS_IN_DAY = 24 * 60 * 60 * 1000;

                var now = new Date().getTime();

                $scope.setPeriod = function (period) {
                    $scope.period = period;
                    switch (period) {
                        case 'week':
                            $scope.timeframe = "Last Week";
                            break;
                        case 'month':
                            $scope.timeframe = "Last Month";
                            break;
                        case 'year':
                        default:
                            $scope.timeframe = "Last Year";
                    }
                };

                function genFixedEvents(startTime, period, count, details) {
                    var result = [];
                    for (var i = 0; i < count; i++) {
                        var date = startTime + (i * period);
                        result.push({
                            "date": date,
                            "details": details
                        });
                    }
                    return result;
                }

                function genWeightedEvents(startTime, count, details, defDate, pctBefore) {
                    var result = [], now = new Date().getTime();

                    var beforeCount = Math.floor(count * pctBefore);
                    var afterCount = count - beforeCount;
                    var beforeTimeDiff = defDate - startTime;
                    var afterTimeDiff = now - defDate;
                    var date;

                    for (var i = 0; i < beforeCount; i++) {
                        date = startTime + (Math.random() * beforeTimeDiff);
                        result.push({
                            "date": date,
                            "details": details
                        });
                    }
                    for (i = 0; i < afterCount; i++) {
                        date = defDate + (Math.random() * afterTimeDiff);
                        result.push({
                            "date": date,
                            "details": details
                        });
                    }

                    return result;
                }

                var eventTypes = [
                    {
                        name: 'Planned Maintenance',
                        color: '#2d7623'
                    },
                    {
                        name: 'Unplanned Maintenance',
                        color: '#b35c00'
                    },
                    {
                        name: 'Warning Event',
                        color: '#005c73'
                    },
                    {
                        name: 'Line Shutdown',
                        color: '#8b0000'
                    }

                ];

                $scope.timelineData = [];

                var fixedPreEvents = genFixedEvents(now - (450 * MS_IN_DAY),
                    (60 * MS_IN_DAY),
                    5,
                    {
                        event: 'Planned Maintenance',
                        color: '#2d7623',
                        facility: "Atlanta",
                        line: "Line 3",
                        comments: "None"
                    });

                var fixedPostEvents = genFixedEvents(now - (180 * MS_IN_DAY),
                    (40 * MS_IN_DAY),
                    6,
                    {
                        event: 'Planned Maintenance Post',
                        color: '#2d7623',
                        facility: "Atlanta",
                        line: "Line 3",
                        comments: "None"
                    });

                $scope.timelineData.push({
                    "name": 'Planned Maintenance',
                    "data": fixedPreEvents.concat(fixedPostEvents)
                });


                $scope.timelineData.push({
                    "name": 'Unplanned Maintenance',
                    "data": genWeightedEvents(now - (450 * MS_IN_DAY),
                        30,
                        {
                            event: 'Unplanned Maintenance',
                            color: '#b35c00',
                            facility: "Atlanta",
                            line: "Line 3",
                            comments: "None"
                        },
                        (now - (180 * MS_IN_DAY)),
                        0.9)
                });

                $scope.timelineData.push({
                    "name": 'Warning Event',
                    "data": genWeightedEvents(now - (450 * MS_IN_DAY),
                        15,
                        {
                            event: 'Warning Event: Machine 4',
                            color: '#005c73',
                            facility: "Atlanta",
                            line: "Line 3",
                            comments: "High Temperature reading"
                        },
                        (now - (180 * MS_IN_DAY)),
                        0.9)
                });

                $scope.timelineData.push({
                    "name": 'Line Shutdown',
                    "data": genWeightedEvents(now - (450 * MS_IN_DAY),
                        15,
                        {
                            event: 'Line Shutdown',
                            color: '#8b0000',
                            facility: "Atlanta",
                            line: "Line 3",
                            comments: "High Temperature reading"
                        },
                        (now - (180 * MS_IN_DAY)),
                        0.95)
                });


            }])

    .controller("ExecFacilityUtilizationController",
        ['$scope', '$http', '$filter', 'Notifications', 'Facilities',
            function ($scope, $http, $filter, Notifications, Facilities) {
                var MS_IN_DAY = 24 * 60 * 60 * 1000;

                $scope.config = {
                    units: 'units/mo.'
                };

                $scope.donutConfig = {
                    chartId: 'chart-util'
                };

                $scope.sparklineConfig = {
                    chartId: 'chart-spark',
                    tooltipType: 'percentage',
                    units: 'units/mo.'
                };

                $scope.centerLabel = "percent";
                $scope.custChartHeight = 60;
                $scope.custShowXAxis = false;
                $scope.custShowYAxis = false;

                $scope.utilData = {};

                function processFacilityUtilization(facilities) {
                    var totalCapacity = 0;
                    var usedCapacity = 0;
                    facilities.forEach(function (facility) {
                        totalCapacity += facility.capacity;
                        usedCapacity += (facility.utilization * facility.capacity);
                    });

                    var today = new Date();
                    var dates = ['dates'];
                    var yData = ['used'];

                    for (var d = 20 - 1; d >= 1; d--) {
                        dates.push(new Date(today.getTime() - (d * MS_IN_DAY)));
                        yData.push(Math.floor(totalCapacity * (.90 + (.10 * Math.random()))));
                    }

                    // add one more representing today
                    dates.push(new Date(today.getTime()));
                    yData.push(Math.floor(usedCapacity));

                    $scope.utilData = {
                        dataAvailable: true,
                        used: Math.floor(usedCapacity),
                        total: Math.floor(totalCapacity),
                        xData: dates,
                        yData: yData
                    };
                }

                processFacilityUtilization(Facilities.getFacilities());

                $scope.$on('facilities:updated', function (event, facilities) {
                    processFacilityUtilization(facilities);
                });

            }])

    .controller("ExecTopFacilitiesController",
        ['$scope', '$modal', 'Facilities',
            function ($scope, $modal, Facilities) {

                $scope.facilities = Facilities.getFacilities();
                $scope.data = {};
                $scope.titles = {};
                $scope.units = "";
                $scope.donutData = {};
                $scope.donutConfig = {};
                $scope.facTimeFrame = "Last Month";

                $scope.setFacPeriod = function (period) {
                    $scope.facPeriod = period;
                    switch (period) {
                        case 'year':
                            $scope.facTimeFrame = "Year to Date";
                            break;
                        case 'month':
                            $scope.facTimeFrame = "Last Month";
                            break;
                        default:
                            $scope.facTimeFrame = "Beginning of Time";
                    }
                };

                var colorPal = [
                    patternfly.pfPaletteColors.blue,
                    patternfly.pfPaletteColors.green,
                    patternfly.pfPaletteColors.orange,
                    patternfly.pfPaletteColors.red,
                    '#3B0083'
                ];

                function processFacilities(facilities) {

                    $scope.facilities = facilities.sort(function (f1, f2) {
                        return (f2.utilization - f1.utilization);
                    });

                    $scope.donutData = {
                        type: 'donut',
                        columns: $scope.facilities.map(function (facility) {
                            return [
                                facility.name, facility.utilization
                            ]
                        }),
                        colors: {}
                    };

                    $scope.facilities.forEach(function (facility, idx) {
                        $scope.donutData.colors[facility.name] = colorPal[idx % colorPal.length];
                    });

                    $scope.donutConfig = {
                        'chartId': 'noneChart',
                        'thresholds': {'warning': '60', 'error': '90'}
                    };

                    $scope.facilities.forEach(function (facility) {
                        $scope.data[facility.name] = {
                            used: facility.utilization * 100,
                            total: 100
                        };

                        $scope.titles[facility.name] = facility.name;
                    });


                    var donutConfig = patternfly.c3ChartDefaults().getDefaultDonutConfig();
                    donutConfig.bindto = '#donut-chart-8';
                    donutConfig.tooltip = {show: true};
                    donutConfig.data = $scope.donutData;
                    donutConfig.data.columns = donutConfig.data.columns.slice(0, 5);
                    donutConfig.data.onclick = function (d) {
                        var facName = d.name;
                        var foundFacility = null;
                        facilities.forEach(function (f) {
                            if (f.name == facName) {
                                foundFacility = f;
                            }
                        });
                        if (foundFacility) {
                            $scope.viewFacility(foundFacility);
                        }
                    };

                    donutConfig.legend = {
                        show: true,
                        position: 'right'
                    };
                    // donutConfig.size = {
                    //     width: 251,
                    //     height: 161
                    // };

                    c3.generate(donutConfig);
                    patternfly.pfSetDonutChartTitle("#donut-chart-8", "4", "Facilities");

                }

                if ($scope.facilities && $scope.facilities.length > 0) {
                    processFacilities($scope.facilities);
                }

                $scope.$on('facilities:updated', function (event, facilities) {
                    if (facilities && facilities.length > 0) {
                        processFacilities(facilities);
                    }
                });

                $scope.viewFacility = function (facility) {
                    $modal.open({
                        templateUrl: 'partials/facility.html',
                        controller: 'FacilityViewController',
                        size: 'lg',
                        resolve: {
                            facility: function () {
                                return facility;
                            }
                        }
                    });

                }
            }])

    .controller("FacilityViewController",
        ['$scope', '$http', '$filter', 'Notifications', 'SensorData', 'facility', 'APP_CONFIG',
            function ($scope, $http, $filter, Notifications, SensorData, facility, APP_CONFIG) {
                $scope.facility = facility;
                $scope.mapsUrl = 'https://maps.googleapis.com/maps/api/js?key=' + APP_CONFIG.GOOGLE_MAPS_API_KEY;


                $scope.size = {
                    "name": 'Sq. Ft.',
                    "title": 'Sq. Ft.',
                    "count": $filter('number')(facility.size, 1),
                    "iconClass": 'fa fa-2x fa-arrows',
                    "notifications": [{
                        "iconClass": "pficon pficon-ok"
                    }]
                };
                $scope.age = {
                    "name": 'Years',
                    "title": 'Years',
                    "count": "13.4",
                    "iconClass": 'fa fa-2x fa-calendar',
                    "notifications": [{
                        "iconClass": "pficon pficon-warning-triangle-o"
                    }]
                };
                $scope.utilization = {
                    "name": '%',
                    "title": '%',
                    "count": Math.round(facility.utilization * 100 * 2.5),
                    "iconClass": 'fa fa-2x fa-line-chart',
                    "notifications": [{
                        "iconClass": "pficon pficon-ok"
                    }]
                };

            }])

    .controller("ExecBizTrendsController",
        ['$scope', '$http', '$filter', 'Notifications', 'SensorData',
            function ($scope, $http, $filter, Notifications, SensorData) {

                var now = new Date().getTime();

                $scope.chartConfig = patternfly.c3ChartDefaults().getDefaultAreaConfig();

                // pca, cpu, rpu, upm
                $scope.selected = 'cpu';
                $scope.period = 'year';

                $scope.setPeriod = function (period) {
                    $scope.period = period;

                    if ($scope.selected === 'maintenance') {
                        $scope.setMaintenance(period);
                        return;
                    }

                    var xPoints = ['x'];
                    var currentUse = ['Current Period'];
                    var previousUse = ['Previous Period'];
                    var min, max, pt, hrsPerPt, oldStart, oldEnd, newStart, newEnd, oldDef, newDef, units;

                    switch ($scope.selected) {
                        case 'pca':
                            min = 2000;
                            max = 10000;
                            units = "units/hr";
                            break;
                        case 'cpu':
                            min = 0;
                            max = 1;
                            units = "$";
                            break;
                        case 'rev':
                            min = 0;
                            max = 1000;
                            units = "thousand $";
                            break;
                        case 'mar':
                            min = 0;
                            max = 1;
                            units = "$";
                            break;
                        default:
                            console.log("error: unrecognized selected time scope: " + $scope.selected);
                    }

                    switch (period) {
                        case 'month':
                            $scope.timeFrame = "Last Month";
                            pt = 30;
                            hrsPerPt = 24;
                            oldDef = newDef = 1.0;
                            switch ($scope.selected) {
                                case 'pca':
                                    oldStart = oldEnd = 3000;
                                    newStart = newEnd = 6000;
                                    break;
                                case 'cpu':
                                    oldStart = oldEnd = 0.5;
                                    newStart = newEnd = 0.2;
                                    break;
                                case 'rev':
                                    oldStart = oldEnd = 300;
                                    newStart = newEnd = 830;
                                    break;
                                case 'mar':
                                    oldStart = oldEnd = -0.1;
                                    newStart = newEnd = 0.6;
                                    break;
                                default:
                                    console.log("error: unrecognized selected time scope: " + $scope.selected);
                            }
                            break;
                        case 'year':
                            $scope.timeFrame = "Last Year";
                            pt = 12;
                            hrsPerPt = (24 * 30);
                            oldDef = 1.0;
                            newDef = 0.5;
                            switch ($scope.selected) {
                                case 'pca':
                                    oldStart = oldEnd = newStart = 3000;
                                    newEnd = 6000;
                                    break;
                                case 'cpu':
                                    oldStart = oldEnd = newStart = 0.5;
                                    newEnd = 0.2;
                                    break;
                                case 'rev':
                                    oldStart = oldEnd = newStart = 300;
                                    newEnd = 830;
                                    break;
                                case 'mar':
                                    oldStart = oldEnd = newStart = 0.1;
                                    newEnd = 0.6;
                                    break;
                                default:
                                    console.log("error: unrecognized selected time scope: " + $scope.selected);
                            }
                            break;
                        default:
                            $scope.timeFrame = "Beginning of Time";
                            pt = 60;
                            hrsPerPt = (24 * 30);
                            oldDef = 1;
                            newDef = 54 / 60;
                            switch ($scope.selected) {
                                case 'pca':
                                    oldStart = oldEnd = newStart = 3000;
                                    newEnd = 6000;
                                    break;
                                case 'cpu':
                                    oldStart = oldEnd = newStart = 0.5;
                                    newEnd = 0.2;
                                    break;
                                case 'rev':
                                    oldStart = oldEnd = newStart = 300;
                                    newEnd = 830;
                                    break;
                                case 'mar':
                                    oldStart = oldEnd = newStart = -0.1;
                                    newEnd = 0.6;
                                    break;
                                default:
                                    console.log("error: unrecognized selected time scope: " + $scope.selected);
                            }

                    }

                    var oldData = SensorData.genTrend(min, max, pt + 1, oldStart, oldEnd, oldDef, 0.09);
                    var newData = SensorData.genTrend(min, max, pt + 1, newStart, newEnd, newDef, 0.05);

                    for (var i = pt; i >= 0; i--) {
                        xPoints.push(now - (i * hrsPerPt * 60 * 60 * 1000));
                        currentUse.push(newData[pt - i]);
                        previousUse.push(oldData[pt - i]);
                    }

                    $scope.chartConfig.data = {
                        x: 'x',
                        columns: [
                            xPoints, currentUse, previousUse
                        ],
                        type: 'area-spline',
                        colors: {
                            'Previous Period': '#cccccc'
                        }

                    };

                    $scope.chartConfig.axis = {
                        x: {
                            type: 'timeseries',
                            tick: {
                                format: (period == 'month') ? '%b %d' : (period == 'year' ? '%b' : '%b %Y')
                            }
                        },
                        y: {
                            label: {
                                text: units,
                                position: 'outer-middle'
                            }
                        }
                    };

                    // pca, cpu, rpu, upm
                    $scope.chartConfig.tooltip = {
                        format: {
                            value: function (value) {
                                switch ($scope.selected) {
                                    case 'pca':
                                        return ( value.toFixed(1) + ' ' + units);
                                    case 'rev':
                                        return $filter('currency')(value * 1000, '$')
                                    case 'cpu':
                                    case 'mar':
                                        return $filter('currency')(value, '$')
                                    default:
                                        return value.toFixed(1);
                                }
                            }
                        }
                    };
                };

                $scope.setMaintenance = function (period) {
                    $scope.period = period;
                    var now = new Date().getTime(),
                        xPoints = ['x'],
                        planned = ['Planned'],
                        plannedCostPerHr = 200,
                        unplanned = ['Unplanned'],
                        unplannedCostPerHr = 800,
                        totalCost = ['Total Maintenance Cost'];

                    var plannedPerMonthBeforeIoT = 2;
                    var plannedPerMonthAfterIoT = 5;
                    var unplannedPerMonthBeforeIoT = 8;
                    var unplannedPerMonthAfterIoT = 1;

                    var pt, hrsPerPt, plannedStart, plannedEnd, unplannedStart, unplannedEnd, plannedDef, unplannedDef;

                    switch (period) {
                        case 'month':
                            $scope.timeFrame = "Last Month";
                            pt = 30;
                            hrsPerPt = 24;
                            unplannedStart = unplannedEnd = unplannedPerMonthAfterIoT / pt;
                            plannedStart = plannedEnd = plannedPerMonthAfterIoT / pt;
                            plannedDef = unplannedDef = 1;
                            break;
                        case 'year':
                            $scope.timeFrame = "Last Year";
                            pt = 12;
                            hrsPerPt = (24 * 30);
                            unplannedStart = unplannedPerMonthBeforeIoT;
                            unplannedEnd = unplannedPerMonthAfterIoT;
                            unplannedDef = 0.5;

                            plannedStart = plannedPerMonthBeforeIoT;
                            plannedEnd = plannedPerMonthAfterIoT;
                            plannedDef = 0.5;
                            break;
                        default:
                            $scope.timeFrame = "Beginning of Time";
                            pt = 60;
                            hrsPerPt = (24 * 30);
                            unplannedStart = unplannedPerMonthBeforeIoT;
                            unplannedEnd = unplannedPerMonthAfterIoT;
                            unplannedDef = (54 / 60);

                            plannedStart = plannedPerMonthBeforeIoT;
                            plannedEnd = plannedPerMonthAfterIoT;
                            plannedDef = (54 / 60);

                    }


                    var plannedData = SensorData.genTrend(plannedPerMonthBeforeIoT, plannedPerMonthAfterIoT, pt + 1, plannedStart, plannedEnd, plannedDef, 0.2);
                    var unplannedData = SensorData.genTrend(unplannedPerMonthAfterIoT, unplannedPerMonthBeforeIoT, pt + 1, unplannedStart, unplannedEnd, unplannedDef, 0.2);
                    var totalCostData = plannedData.map(function (plannedAmt, idx) {
                        return ((plannedData[idx] * plannedCostPerHr) + (unplannedData[idx] * unplannedCostPerHr));
                    });

                    for (var i = pt; i >= 0; i--) {
                        xPoints.push(now - (i * hrsPerPt * 60 * 60 * 1000));
                        unplanned.push(unplannedData[pt - i]);
                        planned.push(plannedData[pt - i]);
                        totalCost.push(totalCostData[pt - i]);
                    }

                    var types = {};
                    types[unplanned[0]] = 'spline';
                    types[planned[0]] = 'spline';

                    var axes = {};
                    axes[unplanned[0]] = 'y';
                    axes[planned[0]] = 'y';
                    axes[totalCost[0]] = 'y2';

                    var colors = {};
                    colors[planned[0]] = '#39a5dc';
                    colors[unplanned[0]] = '#004368';
                    colors[totalCost[0]] = '#39a5dc';

                    $scope.chartConfig.data = {
                        x: 'x',
                        columns: [
                            xPoints, planned, unplanned, totalCost
                        ],
                        type: 'bar',
                        types: types,
                        axes: axes,
                        colors: colors


                    };

                    $scope.chartConfig.tooltip = {
                        format: {
                            value: function (value, ratio, id) {
                                switch (id) {
                                    case planned[0]:
                                        return value.toFixed(1) + " hours";
                                    case unplanned[0]:
                                        return value.toFixed(1) + " hours";
                                    case totalCost[0]:
                                    default:
                                        return $filter('currency')(value * 1000, '$')
                                }
                            }
                        }
                    };

                    $scope.chartConfig.axis = {
                        x: {
                            type: 'timeseries',
                            tick: {
                                format: (period == 'month') ? '%b %d' : (period == 'year' ? '%b' : '%b %Y')
                            }
                        },
                        y: {
                            label: {
                                text: "hours",
                                position: 'outer-middle'
                            }
                        },
                        y2: {
                            show: true,
                            label: {
                                text: "thousands $",
                                position: 'outer-middle'
                            }
                        }
                    };

                    // // pca, cpu, rpu, upm
                    // $scope.chartConfig.tooltip = {
                    //     format: {
                    //         value: function (value) {
                    //             switch ($scope.selected) {
                    //                 case 'pca':
                    //                     return ( value.toFixed(1) + ' ' + units);
                    //                 case 'rev':
                    //                     return ( value.toFixed(1) + ' ' + units);
                    //                 case 'cpu':
                    //                     return ( '$' + value.toFixed(2));
                    //                 default:
                    //                     return value.toFixed(1);
                    //             }
                    //         }
                    //     }
                    // };
                };

                $scope.getSelected = function () {
                    return $scope.selected;
                };

                $scope.setSelected = function (selected) {
                    $scope.selected = selected;
                    if (selected === 'maintenance') {
                        $scope.setMaintenance($scope.period);
                    } else {
                        $scope.setPeriod($scope.period);
                    }
                };


                $scope.setPeriod($scope.period);
                $scope.timeFrame = "Last Year";


            }])

    .controller("ExecSummaryController",
        ['$scope', '$http', '$filter', 'Notifications', 'SensorData', 'Reports',
            function ($scope, $http, $filter, Notifications, SensorData, Reports) {

                $scope.summaries = Reports.getSummaries();

                var icons = {
                    'customers': 'fa fa-user',
                    'runs': 'fa fa-play',
                    "lines": 'fa fa-subway',
                    'operators': 'fa fa-group',
                    'facilities': 'fa fa-building',
                    'machines': 'fa fa-group'
                };

                function processSummaries(summaries) {
                    $scope.summaries = summaries;
                    summaries.forEach(function (summary) {
                        $scope.summaries[summary.name] = {
                            "name": summary.name,
                            "title": summary.title,
                            "count": summary.count,
                            "iconClass": icons[summary.name],
                            "notifications": []
                        };


                        if (summary.warningCount <= 0 && summary.errorCount <= 0) {
                            $scope.summaries[summary.name].notifications = [{
                                "iconClass": "pficon pficon-ok"
                            }]
                        }

                        if (summary.warningCount > 0) {
                            $scope.summaries[summary.name].notifications.push({
                                "iconClass": "pficon pficon-warning-triangle-o",
                                "count": summary.warningCount,
                                "href": "#/"
                            })
                        }
                        if (summary.errorCount > 0) {
                            $scope.summaries[summary.name].notifications.push({
                                "iconClass": "pficon pficon pficon-error-circle-o",
                                "count": summary.errorCount,
                                "href": "#/"
                            })
                        }
                    });

                }

                $scope.$on("summaries:updated", function (event, summaries) {
                    processSummaries(summaries);
                });

                processSummaries($scope.summaries);

            }])


    .controller("HomeController",
        ['$scope', '$http', '$filter', 'Notifications', 'SensorData',
            function ($scope, $http, $filter, Notifications, SensorData) {

                $scope.showDialog = false;

            }])


    .controller("LineListController",
        ['$routeParams', '$timeout', '$rootScope', '$scope', '$http', 'Notifications', 'SensorData', 'Facilities',
            function ($routeParams, $timeout, $rootScope, $scope, $http, Notifications, SensorData, Facilities) {

                $rootScope.autoFid = $routeParams.fid;
                $scope.selectedLine = null;
                $scope.selectedFacility = null;
                $scope.lines = null;


                $scope.resetAll = function () {
                    $rootScope.$broadcast("resetAll");
                };

                $scope.isFacilitySelected = function (fac) {
                    if (!$scope.selectedFacility || !fac) {
                        return false;
                    }
                    return $scope.selectedFacility.fid === fac.fid;
                };

                $scope.isLineSelected = function (line) {

                    if (!$scope.selectedLine || !line) {
                        return false;
                    }
                    return ($scope.selectedLine.lid === line.lid && $scope.selectedFacility &&
                    $scope.selectedFacility.fid === $scope.selectedLine.currentFid);
                };


                $scope.selectLine = function (line) {
                    $scope.selectedLine = line;
                    $rootScope.$broadcast("lines:selected", line);
                };

                $scope.$on("lines:selected", function (evt, line) {
                    $scope.selectedLine = line;
                });

                $scope.$on("facilities:selected", function (evt, fac) {
                    $scope.selectedFacility = fac;
                    $scope.lines = Facilities.getLinesForFacility(fac);
                });

                $scope.selectFacility = function (fac) {
                    $scope.selectedFacility = fac;
                    $scope.lines = Facilities.getLinesForFacility(fac);
                    $rootScope.$broadcast("facilities:selected", fac);
                };

                $scope.$on('facilities:updated', function (event) {
                    $scope.facilities = Facilities.getFacilities();
                    if (!$scope.selectedFacility) {
                        var autoSel = getAutoSelectedFacility();
                        if (!autoSel) {
                            autoSel = $scope.facilities[0];
                        }
                        $scope.selectFacility(autoSel);
                    }
                });

                $scope.$on("line:alert", function (evt, al) {
                    $scope.lines.forEach(function (l) {
                        if (l.lid === al.lid) {
                            l.status = "warning";
                            l.statusMsg = al.message;
                        }
                    });
                });

                function getAutoSelectedFacility() {
                    var autoSelectFacility;

                    if ($routeParams.fid) {

                        autoSelectFacility =
                            $scope.facilities.find(function(fac) {
                                return fac.fid === $routeParams.fid;
                            });

                    }

                    if (!autoSelectFacility) {
                        autoSelectFacility = $scope.facilities[0];
                    }

                    return autoSelectFacility;
                }

                $scope.facilities = Facilities.getFacilities();

                var selectedFacility = Facilities.getCurrentFacility();
                if (!selectedFacility) {
                    selectedFacility = getAutoSelectedFacility();
                    if (selectedFacility) {
                        $scope.selectFacility(selectedFacility);
                    }
                } else {
                    $scope.facilities.forEach(function (fac) {
                        if (fac.fid === selectedFacility.fid) {
                            $scope.selectFacility(selectedFacility);
                        }
                    });
                }
                var selectedLine = Facilities.getCurrentLine();
                if (selectedLine) {
                    $scope.selectLine(selectedLine);
                }


            }])

    .controller("TelemetryController",
        ['$routeParams', '$filter', '$interval', '$rootScope', '$scope', '$modal', '$http', 'Notifications', 'SensorData', 'APP_CONFIG', 'Facilities',
            function ($routeParams, $filter, $interval, $rootScope, $scope, $modal, $http, Notifications, SensorData, APP_CONFIG, Facilities) {

                var MAX_POINTS = 20;

                $scope.selectedMachine = null;
                $scope.selectedFacility = null;

                function addData(machine, data) {

                    if (machine != $scope.selectedMachine) {
                        return;
                    }

                    data.forEach(function (metric) {

                        var dataSet = $scope.n3data[metric.name];
                        var config = $scope.n3options[metric.name];

                        dataSet.hasData = true;
                        dataSet.dataset0.push({
                            x: new Date(),
                            val_0: metric.value.toFixed(3)
                        });
                        dataSet.value = metric.value.toFixed(1);
                        if (dataSet.dataset0.length > (MAX_POINTS + 1)) {
                            // remove the earliest value
                            dataSet.dataset0.splice(0, 1);
                        }

                        if (metric.value > dataSet.upperLimit || metric.value < dataSet.lowerLimit) {
                            config.warning = true;
                            config.series[0].color = '#ec7a08';
                        } else {
                            config.warning = false;
                            config.series[0].color = '#1f77b4';
                        }
                    });
                }

                $scope.n3options = [];
                $scope.n3data = [];

                function showTelemetry(machine) {
                    machine.telemetry.forEach(function (telemetry) {
                        $scope.n3options[telemetry.name] = {
                            warning: false,
                            series: [
                                {
                                    axis: "y",
                                    dataset: "dataset0",
                                    key: "val_0",
                                    label: telemetry.name,
                                    color: "#1f77b4",
                                    type: ['area'],
                                    id: 'mySeries0',
                                    interpolation: {mode: "bundle", tension: 0.98}
                                }
                            ],
                            axes: {
                                x: {
                                    key: "x",
                                    type: 'date',
                                    tickFormat: function (value, idx) {
                                        return ($filter('date')(value, 'H:mm:ss'));
                                    }
                                }
                            },
                            margin: {
                                top: 0,
                                right: 0,
                                bottom: 0,
                                left: 0
                            }
                        };

                        if (APP_CONFIG.STATIC_TELEMETRY_GRAPHS) {
                            var statics = APP_CONFIG.STATIC_TELEMETRY_GRAPHS.split(',');
                            if (statics.indexOf(telemetry.name) != -1) {
                                $scope.n3options[telemetry.name].axes.y = {
                                    min: telemetry.min,
                                    max: telemetry.max
                                }
                            }
                        }

                        $scope.n3data[telemetry.name] = {
                            hasData: false,
                            upperLimit: telemetry.max,
                            lowerLimit: telemetry.min,
                            value: 0,
                            dataset0: []
                        };

                    });
                    if ($scope.selectedMachine) {
                        SensorData.unsubscribeMachine($scope.selectedMachine);
                    }

                    $scope.selectedMachine = machine;
                    SensorData.subscribeMachine(machine, function (data) {
                        $scope.$apply(function () {
                            addData(machine, data);
                        });
                    });

                }

                $scope.$on('machines:selected', function (event, machine) {
                    showTelemetry(machine);
                });

                $scope.$on('facilities:selected', function (event, fac) {
                    $scope.selectedFacility = fac;
                });

                var autoSelect = Facilities.getCurrentMachine();
                if (autoSelect) {
                    showTelemetry(autoSelect);
                }

                function getAutoSelectedFacility() {
                    var autoSelectFacility;

                    if ($routeParams.fid) {

                        autoSelectFacility =
                            Facilities.getFacilities().find(function(fac) {
                                return fac.fid === $routeParams.fid;
                            });

                    }

                    if (!autoSelectFacility) {
                        autoSelectFacility = Facilities.getFacilities()[0];
                    }

                    return autoSelectFacility;
                }

                var selectedFacility = Facilities.getCurrentFacility();
                if (!selectedFacility) {
                    selectedFacility = getAutoSelectedFacility();
                }

                if (selectedFacility) {
                    $scope.selectedFacility = selectedFacility;
                }


                $scope.showHistory = function (telemetry) {

                    if (!$scope.selectedMachine) {
                        alert("You must choose a machine!");
                        return;
                    }

                    $modal.open({
                        templateUrl: 'partials/history.html',
                        controller: 'HistoryController',
                        size: 'lg',
                        resolve: {
                            machine: function () {
                                return $scope.selectedMachine
                            },
                            dataFunc: function () {

                                return function (cbData) {
                                    var newData = {
                                        hasData: true,
                                        upperLimit: telemetry.max,
                                        lowerLimit: telemetry.min,
                                        value: 0,
                                        dataset0: []
                                    };

                                    cbData.forEach(function (pt) {
                                        newData.dataset0.push({
                                            x: new Date(pt.timestamp),
                                            val_0: pt.value
                                        });
                                    });
                                    return newData;
                                }
                            },
                            telemetry: function () {
                                return telemetry
                            },
                            config: function () {
                                return {
                                    series: [
                                        {
                                            axis: "y",
                                            dataset: "dataset0",
                                            key: "val_0",
                                            label: telemetry.name,
                                            color: "#1f77b4",
                                            type: ['area'],
                                            id: 'mySeries0',
                                            interpolation: {mode: "bundle", tension: 0.98}
                                        }
                                    ],
                                    axes: {
                                        x: {
                                            key: "x",
                                            type: 'date',
                                            tickFormat: function (value, idx) {
                                                return ($filter('date')(value, 'medium'));
                                            }
                                        }
                                    },
                                    margin: {
                                        top: 0,
                                        right: 0,
                                        bottom: 0,
                                        left: 0
                                    },
                                    symbols: [
                                        {
                                            type: 'hline',
                                            value: telemetry.min,
                                            color: '#FF0000',
                                            axis: 'y'
                                        },
                                        {
                                            type: 'hline',
                                            value: telemetry.max,
                                            color: '#FF0000',
                                            axis: 'y'
                                        }

                                    ]

                                }
                            }

                        }
                    });

                }
            }])

    .controller("HistoryController",
        ['$scope', '$http', 'Notifications', 'SensorData', 'machine', 'telemetry', 'dataFunc', 'config',
            function ($scope, $http, Notifications, SensorData, machine, telemetry, dataFunc, config) {

                $scope.telemetry = telemetry;
                $scope.config = config;
                $scope.machine = machine;
                $scope.data = null;

                SensorData.getRecentData(machine, telemetry, function (cbData) {
                    $scope.data = dataFunc(cbData);
                });


            }])

    .controller("AlertController",
        ['$scope', '$http', 'Notifications', 'alertObj',
            function ($scope, $http, Notifications, alertObj) {

                $scope.alertObj = alertObj;


            }])

    .controller("FloorplanController",
        ['$routeParams', '$timeout', '$scope', '$rootScope', '$http', 'Notifications', "SensorData", "NgMap", "APP_CONFIG", "Facilities",
            function ($routeParams, $timeout, $scope, $rootScope, $http, Notifications, SensorData, NgMap, APP_CONFIG, Facilities) {

                $scope.selectedLine = null;
                $scope.selectedFacility = null;
                $scope.selectedMachine = null;
                $scope.lines = null;

                $scope.$on("lines:selected", function (evt, line) {
                    $scope.selectedLine = line;
                });
                $scope.$on("facilities:selected", function (evt, fac) {
                    $scope.selectedFacility = fac;
                    $scope.lines = Facilities.getLinesForFacility(fac);
                    $scope.selectedLine = $scope.selectedMachine = null;
                });

                $scope.$on("alert", function (evt, alert) {
                    $scope.render($scope.selectedLine);
                });

                $scope.selectMachine = function (m) {
                    $scope.selectedMachine = m;
                    $rootScope.$broadcast("machines:selected", m);
                };
                $scope.selectLine = function (line) {
                    $scope.selectedLine = line;
                    $rootScope.$broadcast("lines:selected", line);
                };

                function getAutoSelectedFacility() {
                    var autoSelectFacility;

                    if ($routeParams.fid) {

                        autoSelectFacility =
                            Facilities.getFacilities().find(function(fac) {
                                return fac.fid === $routeParams.fid;
                            });

                    }

                    if (!autoSelectFacility) {
                        autoSelectFacility = Facilities.getFacilities()[0];
                    }

                    return autoSelectFacility;
                }

                var selectedFacility = Facilities.getCurrentFacility();
                if (!selectedFacility) {
                    selectedFacility = getAutoSelectedFacility();
                }

                if (selectedFacility) {
                    $scope.selectedFacility = selectedFacility;
                    $scope.lines = Facilities.getLinesForFacility(selectedFacility);
                }

                var autoSelect = Facilities.getCurrentLine();
                if (autoSelect) {
                    $scope.selectedLine = autoSelect;
                }
                autoSelect = Facilities.getCurrentMachine();
                if (autoSelect) {
                    $scope.selectedMachine = autoSelect;
                }


            }])

    .controller("LineDetailsController",
        ['$routeParams', '$rootScope', '$scope', '$interval', '$http', 'Notifications', "SensorData", "Facilities",
            function ($routeParams, $rootScope, $scope, $interval, $http, Notifications, SensorData, Facilities) {

                var MS_IN_DAY = 24 * 60 * 60 * 1000;
                var intervalTimer = null;

                $scope.lineQuery = '';
                $scope.total = 1;
                $scope.completed = 0;
                $scope.bizStates = [];

                $scope.selectedLine = null;
                $scope.selectedFacility = null;

                var today = new Date();
                var dates = ['dates'];
                var yTemp = ['used'];
                for (var d = 0; d < 20; d++) {
                    dates.push(d);
                    yTemp.push('');
                }

                function fill(data, start, end, defl, jitter) {
                    return data.map(function (v, idx, arr) {
                        if (idx === 0) {
                            return v;
                        } else {
                            var val = 0;
                            if ((idx / arr.length) > defl) {
                                val = end + ((0 - (jitter / 2)) + (Math.random() * jitter));
                            } else {
                                val = start + ((0 - (jitter / 2)) + (Math.random() * jitter));
                            }
                            if (val > 100) {
                                return 100;
                            } else if (val < 0) {
                                return 0;
                            } else {
                                return Math.round(val);
                            }
                        }
                    });
                }


                var actuals = [
                    {
                        name: "Throughput",
                        normal: 97,
                        warning: 50,
                        error: 0
                    },
                    {
                        name: "Uptime",
                        normal: 95,
                        warning: 50,
                        error: 0
                    },
                    {
                        name: "% Pass",
                        normal: 100,
                        warning: 50,
                        error: 0
                    }
                ];


                $scope.linealerts = [];

                $scope.$on('alert', function (evt, alert) {

                    if (alert.fid === $scope.selectedFacility.fid &&
                        alert.lid === $scope.selectedLine.lid) {
                        switch (alert.type) {
                            case 'warning':
                            case 'maintenance':
                                if ($scope.selectedLine.status === 'ok') {
                                    $scope.selectedLine.status = 'warning';
                                }
                                break;
                            case 'error':
                                $scope.selectedLine.status = 'error';
                                break;
                            case 'ok':
                            default:
                                $scope.selectedLine.status = 'ok';
                        }
                    }
                });

                function showLineDetails(line) {
                    $scope.total = Math.floor(500 + Math.random() * 500);
                    $scope.completed = Math.floor(Math.random() * 300);

                    var warning = line.status === 'warning';
                    var error = line.status === 'error';

                    //                function fill(data, start, end, defl, jitter) {

                    $scope.bizStates = actuals.map(function (actual) {
                        return {
                            config: {
                                'chartId': actual.name.replace(/[^A-Za-z0-9]/g, ''),
                                'layout': 'inline',
                                'trendLabel': actual.name,
                                'tooltipType': 'percentage',
                                'valueType': 'actual'
                            },
                            data: {
                                'total': '100',
                                'xData': dates,
                                'yData': fill(yTemp,
                                    actual.normal,
                                    warning ? actual.warning : (error ? actual.error : actual.normal),
                                    (warning || error) ? .5 : 1,
                                    10),
                                'colors': {
                                    used: 'red',
                                    'yData': 'red'
                                }

                            }
                        };
                    });

                    if (intervalTimer) {
                        $interval.cancel(intervalTimer);
                    }
                    intervalTimer = $interval(function () {
                        $scope.bizStates.forEach(function (state) {
                            var name = state.config.trendLabel;
                            var actual = actuals.find(function (act) {
                                return act.name === name;
                            });
                            var newVal = 0;
                            switch (line.status) {
                                case 'ok':
                                    newVal = actual.normal;
                                    state.config.color = undefined;
                                    break;
                                case 'warning':
                                    newVal = actual.warning;
                                    state.config.color = {
                                        pattern: ['orange']
                                    };
                                    break;
                                case 'error':
                                default:
                                    state.config.color = {
                                        pattern: ['red']
                                    };
                                    newVal = actual.error;
                            }
                            newVal = Math.round(newVal + (-5 + Math.random() * 10));
                            if (newVal > 100) {
                                newVal = 100;
                            } else if (newVal < 0) {
                                newVal = 0;
                            }

                            var latestDate = state.data.xData[state.data.xData.length - 1];

                            state.data.xData.splice(1, 1);
                            state.data.xData.push(latestDate + 1);
                            state.data.yData.splice(1, 1);
                            state.data.yData.push(newVal);
                        });
                        if (line.status !== 'error') {
                            $scope.completed++;
                        }

                    }, 10000);

                }

                $scope.$on('lines:selected', function (event, line) {
                    $scope.selectedLine = line;
                    showLineDetails(line);

                });

                $scope.$on('facilities:selected', function (event, fac) {
                    $scope.selectedFacility = fac;
                });

                $scope.isSelected = function (line) {
                    if (!$scope.selectedLine) {
                        return false;
                    }
                    return $scope.selectedLine.lid === line.lid;
                };

                var autoSelect = Facilities.getCurrentLine();
                if (autoSelect) {
                    $scope.selectedLine = autoSelect;
                    showLineDetails(autoSelect);
                }
                function getAutoSelectedFacility() {
                    var autoSelectFacility;

                    if ($routeParams.fid) {

                        autoSelectFacility =
                            Facilities.getFacilities().find(function(fac) {
                                return fac.fid === $routeParams.fid;
                            });

                    }

                    if (!autoSelectFacility) {
                        autoSelectFacility = Facilities.getFacilities()[0];
                    }

                    return autoSelectFacility;
                }

                var selectedFacility = Facilities.getCurrentFacility();
                if (!selectedFacility) {
                    selectedFacility = getAutoSelectedFacility();
                }

                if (selectedFacility) {
                    $scope.selectedFacility = selectedFacility;
                }
            }])

    .controller("TaskReviewController",
        ['$routeParams', '$rootScope', '$scope', '$location',
            function ($routeParams, $rootScope, $scope, $location) {

                $scope.autoFid = $routeParams.fid;

                $scope.closeAndOpen = function (loc) {
                    $scope.$close();
                    $location.path(loc + ($scope.autoFid ? ('/'+ $scope.autoFid) : ''));
                }
            }])
    .controller("ImgPopupController",
        ['$rootScope', '$scope', '$location', 'filename', 'title',
            function ($rootScope, $scope, $location, filename, title) {

                $scope.filename = filename;
                $scope.title = title;
            }])

    .controller("CalEntryController",
        ['$routeParams', '$rootScope', '$scope', '$modal', 'entry', 'SensorData',
            function ($routeParams, $rootScope, $scope, $modal, entry, SensorData) {

                $scope.reviewTask = true;
                $scope.autoFid = $routeParams.fid;

                $scope.entry = entry;
                if (entry.details) {
                    try {
                        entry.details = JSON.parse(entry.details);
                    } catch (ignored) {

                    }
                    if (entry.details.desc && entry.details.desc.indexOf("ROTOR_LOCK") >= 0) {
                        $scope.reviewTask = false;
                    }
                }

                $scope.completeTask = function () {
                    $scope.$close();
                    SensorData.resetStatus($scope.entry.facility);
                    if ($scope.reviewTask) {
                        $modal.open({
                            templateUrl: 'partials/taskreview.html',
                            controller: 'TaskReviewController',
                            windowClass: 'modal-fullscreen',
                            size: 'lg'
                        });
                    }
                }
            }])


    .controller("CalendarController",
        ['$routeParams', '$rootScope', '$scope', '$http', '$modal', 'Notifications', "SensorData", "Facilities",
            function ($routeParams, $rootScope, $scope, $http, $modal, Notifications, SensorData, Facilities) {

                $scope.selectedFacility = null;
                $scope.$on('facilities:selected', function (event, fac) {
                    $scope.selectedFacility = fac;
                });

                $scope.eventPopup = function (cal) {
                    $modal.open({
                        templateUrl: 'partials/calentry.html',
                        controller: 'CalEntryController',
                        size: 'md',
                        resolve: {
                            entry: function () {
                                return cal;
                            }
                        }
                    });
                };

                function getAutoSelectedFacility() {
                    var autoSelectFacility;

                    if ($routeParams.fid) {

                        autoSelectFacility =
                            Facilities.getFacilities().find(function(fac) {
                                return fac.fid === $routeParams.fid;
                            });

                    }

                    if (!autoSelectFacility) {
                        autoSelectFacility = Facilities.getFacilities()[0];
                    }

                    return autoSelectFacility;
                }

                var selectedFacility = Facilities.getCurrentFacility();
                if (!selectedFacility) {
                    selectedFacility = getAutoSelectedFacility();
                }

                if (selectedFacility) {
                    $scope.selectedFacility = selectedFacility;
                }

            }])
    .controller("TasklistController",
        ['$routeParams', '$rootScope', '$scope', '$http', '$modal', 'Notifications', "SensorData", "Facilities",
            function ($routeParams, $rootScope, $scope, $http, $modal, Notifications, SensorData, Facilities) {

                $scope.selectedFacility = null;
                $scope.facilities = Facilities.getFacilities();

                $scope.$on('facilities:selected', function (event, fac) {
                    $scope.selectedFacility = fac;
                });

                $scope.selectFacility = function (fac) {
                    $scope.selectedFacility = fac;
                    $rootScope.$broadcast("facilities:selected", fac);
                };

                $scope.eventPopup = function (cal) {
                    $modal.open({
                        templateUrl: 'partials/calentry.html',
                        controller: 'CalEntryController',
                        size: 'md',
                        resolve: {
                            entry: function () {
                                return cal;
                            }
                        }
                    });
                };

                function getAutoSelectedFacility() {
                    var autoSelectFacility;

                    if ($routeParams.fid) {

                        autoSelectFacility =
                            $scope.facilities.find(function(fac) {
                                return fac.fid === $routeParams.fid;
                            });

                    }

                    if (!autoSelectFacility) {
                        autoSelectFacility = $scope.facilities[0];
                    }

                    return autoSelectFacility;
                }

                var selectedFacility = Facilities.getCurrentFacility();
                if (!selectedFacility) {
                    selectedFacility = getAutoSelectedFacility();
                }

                if (selectedFacility) {
                    $scope.selectedFacility = selectedFacility;
                }

            }])

    .controller("HeaderController",
        ['$routeParams', '$rootScope', '$scope', '$window', '$location', '$modal', '$timeout', '$http', 'APP_CONFIG', 'Notifications', 'SensorData', 'Facilities',
            function ($routeParams, $rootScope, $scope, $window, $location, $modal, $timeout, $http, APP_CONFIG, Notifications, SensorData, Facilities) {

                $scope.autoFid = $rootScope.autoFid;
                $scope.predictiveMaintenanceColor = 'orange';
                $scope.unpredictedErrorColor = 'red';

                $scope.selectedFacility = null;
                $scope.selectedLine = null;
                $scope.selectedMachine = null;

                $scope.headerTitle = $window.document.title = APP_CONFIG.DASHBOARD_WEB_TITLE;

                $rootScope.$watch('autoFid', function(newVal, oldVal) {
                    $scope.autoFid = newVal;
                });
                $scope.$on('lines:selected', function (evt, line) {
                    $scope.selectedLine = line;
                });
                $scope.$on('facilities:selected', function (evt, fac) {
                    $scope.selectedFacility = fac;
                });
                $scope.$on('machines:selected', function (evt, mac) {
                    $scope.selectedMachine = mac;
                });

                $scope.userInfo = {
                    fullName: "Mary Q. Operator"
                };
                $scope.$on("resetAll", function (evt) {
                    $scope.resetAll();
                });

                $scope.isActive = function (loc) {
                    return loc === $location.path();
                };

                $scope.resetAll = function () {
                    var resetUrl = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' + $location.host().replace(/^.*?\.(.*)/g, "$1") + '/api/utils/resetAll';

                    if (!confirm("Are you sure? This will reset all demo content, for all facilities, potentially interfering with others using this demo instance.")) {
                        return false;
                    }

                    // reset the machines in all facilities
                    Facilities.getFacilities().forEach(function (fac) {
                        SensorData.resetStatus(fac);
                    });

                    $http({
                        method: 'POST',
                        url: resetUrl
                    }).then(function (response) {
                        Notifications.success("Complete Reset successful, reloading page");
                        location.reload();
                    }, function err(response) {
                        Notifications.error("Error resetting. Reload to retry");
                    });


                };

                $scope.resetFacility = function () {
                    var resetUrl = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' + $location.host().replace(/^.*?\.(.*)/g, "$1") + '/api/utils/reset/' + $scope.selectedFacility.fid;

                    // reset the machines in the facilities
                    SensorData.resetStatus($scope.selectedFacility);

                    $http({
                        method: 'POST',
                        url: resetUrl
                    }).then(function (response) {
                        Notifications.success("Reset of " + $scope.selectedFacility.name + " successful, reloading page");
                        location.reload();
                    }, function err(response) {
                        Notifications.error("Error resetting. Reload to retry");
                    });


                };

                function pickDefaults() {
                    var facAuto = Facilities.getFacilityById($routeParams.fid);
                    var fac1 = Facilities.getFacilityById("facility-1");

                    if (!facAuto) {
                        facAuto = fac1;
                    }

                    var lin1 = facAuto.lines.find(function (lin) {
                        return lin.lid === "line-1";
                    });
                    var mac1 = lin1.machines.find(function (mac) {
                        return mac.mid === "machine-1";
                    });
                    var mac2 = lin1.machines.find(function (mac) {
                        return mac.mid === "machine-2";
                    });
                    var mac3 = lin1.machines.find(function (mac) {
                        return mac.mid === "machine-3";
                    });

                    if (!$scope.selectedFacility || $scope.selectedFacility.fid !== facAuto.fid) {
                        $rootScope.$broadcast("facilities:selected", facAuto);
                        $rootScope.$broadcast("lines:selected", lin1);
                        $rootScope.$broadcast("machines:selected", mac1);
                    }
                    if (!$scope.selectedLine || $scope.selectedLine.lid !== lin1.lid) {
                        $rootScope.$broadcast("lines:selected", lin1);
                        $rootScope.$broadcast("machines:selected", mac1);
                    }
                    if (!$scope.selectedMachine ||
                        ($scope.selectedMachine.mid !== mac1.mid &&
                        $scope.selectedMachine.mid !== mac2.mid &&
                        $scope.selectedMachine.mid !== mac3.mid)) {
                        $rootScope.$broadcast("machines:selected", mac1);
                    }

                }

                $scope.predictiveMaintenance = function () {
                    pickDefaults();

                    Notifications.info('Starting maintenance simulation: Facility "' + $scope.selectedFacility.name +
                    '" Line "' + $scope.selectedLine.name + '" Machine "' + $scope.selectedMachine.name + '"');

                    $scope.predictiveMaintenanceColor = 'gray';
                    $timeout(function () {
                        $scope.predictiveMaintenanceColor = 'orange';
                    }, 1000);
                    SensorData.predictiveMaintenance($scope.selectedFacility, $scope.selectedLine, $scope.selectedMachine);
                };

                $scope.unpredictedError = function () {
                    pickDefaults();

                    Notifications.info('Starting safety hazard simulation: Facility "' + $scope.selectedFacility.name +
                        '" Line "' + $scope.selectedLine.name + '" Machine "' + $scope.selectedMachine.name + '"');

                    $scope.unpredictedErrorColor = 'gray';
                    $timeout(function () {
                        $scope.unpredictedErrorColor = 'red';
                    }, 1000);
                    SensorData.unpredictedError($scope.selectedFacility, $scope.selectedLine, $scope.selectedMachine);
                };

                $scope.showImage = function(filename, title) {
                    $modal.open({
                        templateUrl: 'partials/img-popup.html',
                        controller: 'ImgPopupController',
                        windowClass: 'modal-fullscreen',
                        size: 'lg',
                        resolve: {
                            filename: function () {
                                return filename;
                            },
                            title: function() {
                                return title;
                            }
                        }
                    });
                }

            }]);

