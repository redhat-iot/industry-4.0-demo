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
        ['$scope', '$http', '$filter', 'Notifications', 'SensorData',
            function ($scope, $http, $filter, Notifications, SensorData) {


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
                $scope.footerConfig = {
                    'iconClass': 'fa fa-wrench',
                    'text': 'View All Events',
                    'callBackFn': function () {
                        alert("Footer Callback Fn Called");
                    }
                };

                $scope.filterConfig = {
                    'filters': [{label: 'Last Year', value: 'year'},
                        {label: 'Last Month', value: 'month'},
                        {label: 'Last Week', value: 'week'}],
                    'callBackFn': function (f) {
                        var yVals = ['Calls'];
                        for (var d = 12 - 1; d >= 0; d--) {
                            yVals.push(Math.round(Math.random() * 10));
                        }
                        $scope.mdata.yData = yVals;

                    },
                    'defaultFilter': '1'
                };

                var today = new Date();
                var dates = ['dates'];
                var yVals = ['Calls'];
                for (var d = 12 - 1; d >= 0; d--) {
                    dates.push(new Date(today.getTime() - (d * 24 * 60 * 60 * 1000)));
                    yVals.push(Math.round(Math.random() * 10));
                }

                //tooltip: [{"x":"2017-04-10T01:37:32.215Z","value":8,"id":"Calls","index":9,"name":"Calls"}]

                $scope.mconfig = {
                    'title': 'This Period',
                    'layout': 'compact',
                    'valueType': 'actual',
                    'units': 'Events',
                    'tooltipType': 'used',
                    'tooltipFn': function (d) {
                        return (d[0].value + " Calls on " + $filter('date')(d[0].x, 'mediumDate'))
                    }
                };

                $scope.mdata = {
                    'total': '250',
                    'xData': dates,
                    'yData': yVals
                };


            }])

    .controller("ExecFacilityUtilizationController",
        ['$scope', '$http', '$filter', 'Notifications', 'SensorData', 'Reports',
            function ($scope, $http, $filter, Notifications, SensorData, Reports) {

                $scope.facilities = Reports.getFacilities();

                $scope.config = {
                    units: 'sq. ft.'
                };

                $scope.donutConfig = {
                    chartId: 'chart-util',
                    thresholds: {'warning': '60'}
                };

                $scope.sparklineConfig = {
                    chartId: 'chart-spark',
                    tooltipType: 'percentage',
                    units: 'sq. ft.'
                };

                $scope.centerLabel = "used";
                $scope.custChartHeight = 60;
                $scope.custShowXAxis = false;
                $scope.custShowYAxis = false;

                $scope.utilData = {};

                function processFacilityUtilization(facilities) {

                    // figure total sq ft and utilization
                    var totalSize = 0;
                    var usedSize = 0;
                    facilities.forEach(function (facility) {
                        totalSize += facility.size;
                        usedSize += (facility.utilization * facility.size);
                    });

                    var today = new Date();
                    var dates = ['dates'];
                    var yData = ['used'];

                    for (var d = 20 - 1; d >= 1; d--) {
                        dates.push(new Date(today.getTime() - (d * 24 * 60 * 60 * 1000)));
                        yData.push(Math.floor(totalSize * Math.random()));
                    }

                    // add one more representing today
                    dates.push(new Date(today.getTime()));
                    yData.push(Math.floor(usedSize));

                    $scope.utilData = {
                        dataAvailable: true,
                        used: Math.floor(usedSize),
                        total: Math.floor(totalSize),
                        xData: dates,
                        yData: yData
                    };
                }

                processFacilityUtilization($scope.facilities);

                $scope.$on('facilities:updated', function (event, facilities) {
                    processFacilityUtilization(facilities);
                });

            }])

    .controller("ExecTopFacilitiesController",
        ['$scope', '$modal', '$http', '$filter', 'Notifications', 'SensorData', 'Reports',
            function ($scope, $modal, $http, $filter, Notifications, SensorData, Reports) {

                $scope.facilities = Reports.getFacilities();
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

                $scope.chartConfig = patternfly.c3ChartDefaults().getDefaultAreaConfig();

                $scope.selected = 'fuel';
                $scope.period = 'year';

                $scope.setPeriod = function (period) {
                    $scope.period = period;
                    xPoints = ['x'];
                    currentUse = ['Current Period'];
                    previousUse = ['Previous Period'];

                    if (period == 'month') {
                        $scope.timeFrame = "Last Month";
                        for (var i = 30; i >= 0; i--) {
                            xPoints.push(now - (i * 24 * 60 * 60 * 1000));
                            currentUse.push(Math.random() * 200);
                            previousUse.push(Math.random() * 200);
                        }
                    } else if (period == 'year') {
                        $scope.timeFrame = "Last Year";
                        for (var i = 12; i >= 0; i--) {
                            xPoints.push(now - (i * 30 * 24 * 60 * 60 * 1000));
                            currentUse.push(Math.random() * 200);
                            previousUse.push(Math.random() * 200);
                        }
                    } else {
                        $scope.timeFrame = "Beginning of Time";
                        for (var i = 60; i >= 0; i--) {
                            xPoints.push(now - (i * 30 * 24 * 60 * 60 * 1000));
                            currentUse.push(Math.random() * 200);
                            previousUse.push(Math.random() * 200);
                        }
                    }

                    $scope.chartConfig.data = {
                        x: 'x',
                        columns: [
                            xPoints, currentUse, previousUse
                        ],
                        type: 'area-spline',
                        colors: {
                            'Previous Period': '#dddddd'
                        }

                    };

                    $scope.chartConfig.axis = {
                        x: {
                            type: 'timeseries',
                            tick: {
                                format: (period == 'month') ? '%b %d' : (period == 'year' ? '%b' : '%b %Y')
                            }
                        }
                    };

                    $scope.chartConfig.tooltip = {
                        format: {
                            value: function (value, ratio, id, index) {
                                switch ($scope.selected) {
                                    case 'fuel':
                                        return ( value.toFixed(1) + " m.p.g.");
                                    case 'value':
                                        return ( '$' + value.toFixed(2));
                                    case 'timeperf':
                                    case 'custsat':
                                        return (value.toFixed(1) + '%');
                                    default:
                                        return value.toFixed(1);
                                }
                            }
                        }
                    };
                };

                $scope.getSelected = function () {
                    return $scope.selected;
                };

                $scope.setSelected = function (selected) {
                    $scope.selected = selected;
                    $scope.setPeriod($scope.period);
                };


                var now = new Date().getTime();
                var xPoints = ['x'], currentUse = ['Current Period'], previousUse = ['Previous Period'];

                $scope.setPeriod('year');
                $scope.timeFrame = "Last Year";


            }])

    .controller("ExecSummaryController",
        ['$scope', '$http', '$filter', 'Notifications', 'SensorData', 'Reports',
            function ($scope, $http, $filter, Notifications, SensorData, Reports) {

                $scope.summaries = Reports.getSummaries();

                var icons = {
                    'clients': 'fa fa-user',
                    'packages': 'fa fa-tag',
                    "lines": 'fa fa-truck',
                    'operators': 'fa fa-group',
                    'facilities': 'fa fa-building',
                    'managers': 'fa fa-group'
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
        ['$timeout', '$rootScope', '$scope', '$http', 'Notifications', 'SensorData', 'Lines', 'Facilities',
            function ($timeout, $rootScope, $scope, $http, Notifications, SensorData, Lines, Facilities) {

                $scope.selectedLine = null;

                $scope.facilities = null;
                $scope.lines = null;

                $scope.selectedFacility = null;


                $scope.resetAll = function () {
                    $rootScope.$broadcast("resetAll");
                };

                $scope.isFacilitySelected = function(fac) {
                    if (!$scope.selectedFacility || !fac) {
                        return false;
                    }
                    return $scope.selectedFacility.fid === fac.fid;
                };

                $scope.isLineSelected = function (line) {

                    if (!$scope.selectedLine || !line) {
                        return false;
                    }
                    return $scope.selectedLine.lid === line.lid;
                };


                $scope.selectLine = function (line) {
                    $scope.selectedLine = line;
                    $rootScope.$broadcast("lines:selected", line);
                    console.log("broadcasted line selected: " + JSON.stringify(line));
                };

                $scope.selectFacility = function (fac) {
                    $scope.selectedFacility = fac;
                    $scope.lines = Lines.getLinesForFacility(fac);
                    $rootScope.$broadcast("facilities:selected", fac);
                };

                $scope.$on('facilities:updated', function (event) {
                    $scope.facilities = Facilities.getFacilities();
                    if (!$scope.selectedFacility) {
                        $scope.selectFacility($scope.facilities[0]);
                    }
                });

                $scope.$on("line:alert", function (evt, al) {
                    $scope.lines.forEach(function (l) {
                        if (l.lid == al.lid) {
                            l.status = "warning";
                            l.statusMsg = al.message;
                        }
                    });
                })
            }])

    .controller("TelemetryController",
        ['$filter', '$interval', '$rootScope', '$scope', '$modal', '$http', 'Notifications', 'SensorData', 'APP_CONFIG', 'Machines',
            function ($filter, $interval, $rootScope, $scope, $modal, $http, Notifications, SensorData, APP_CONFIG, Machines) {

                var MAX_POINTS = 20;

                $scope.selectedMachine = null;

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
                            val_0: metric.value
                        });
                        dataSet.value = metric.value;
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

                $scope.$on('machine:selected', function (event, machine) {
                    console.log("got machine selected");
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

                });

                $scope.showHistory = function (telemetry) {

                    if (!$scope.selectedMachine) {
                        alert("You must choose a machine!");
                        return;
                    }

                    SensorData.getRecentData($scope.selectedMachine, telemetry, function (cbData) {
                        $modal.open({
                            templateUrl: 'partials/history.html',
                            controller: 'HistoryController',
                            size: 'lg',
                            resolve: {
                                machine: function () {
                                    return $scope.selectedMachine
                                },
                                data: function () {
                                    var newData = {
                                        hasData: false,
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

                    });


                }
            }])

    .controller("HistoryController",
        ['$scope', '$http', 'Notifications', 'SensorData', 'machine', 'telemetry', 'data', 'config',
            function ($scope, $http, Notifications, SensorData, machine, telemetry, data, config) {

                $scope.data = data;
                $scope.telemetry = telemetry;
                $scope.config = config;
                $scope.machine = machine;

            }])

    .controller("FloorplanController",
        ['$timeout', '$scope', '$rootScope', '$http', 'Notifications', "SensorData", "NgMap", "APP_CONFIG", "Lines",
            function ($timeout, $scope, $rootScope, $http, Notifications, SensorData, NgMap, APP_CONFIG, Lines) {

                $scope.selectMachine = function () {
                    Lines.getLines().forEach(function (line) {
                        line.machines.forEach(function (m) {
                            if (m.mid === "machine-1" && m.currentLid === "line-1" && m.currentFid === "facility-1") {
                                $rootScope.$broadcast("machine:selected", m);
                            }
                        })
                    });
                }

            }])

    .controller("LineDetailsController",
        ['$rootScope', '$scope', '$http', 'Notifications', "SensorData", "Lines", "Machines",
            function ($rootScope, $scope, $http, Notifications, SensorData, Lines, Machines) {

                $scope.lineQuery = '';

                $scope.selectedLine = null;
                $scope.linealerts = [];

                $scope.$on('lines:selected', function (event, line) {
                    console.log("got the message");
                    $scope.selectedLine = line;
                });

                $scope.$on("line:alert", function (evt, al) {

                });

                $scope.isSelected = function (line) {
                    if (!$scope.selectedLine) {
                        return false;
                    }
                    return $scope.selectedLine.lid === line.lid;
                };

            }])

    .controller("MachineDetailsController",
        ['$rootScope', '$scope', '$http', 'Notifications', "SensorData", "Lines",
            function ($rootScope, $scope, $http, Notifications, SensorData, Lines) {

                $scope.selectedMachine = null;
                $scope.$on('machines:selected', function (event, machine) {
                    $scope.selectedMachine = machine;
                });

                $scope.$on("machine:alert", function (evt, al) {

                });

                $scope.isSelected = function (machine) {
                    if (!$scope.selectedMachine) {
                        return false;
                    }
                    return $scope.Machine.mid == machine.mid;
                };

            }])

    .controller("HeaderController",
        ['$scope', '$window', '$location', '$timeout', '$http', 'APP_CONFIG', 'Notifications', 'SensorData', 'Reports',
            function ($scope, $window, $location, $timeout, $http, APP_CONFIG, Notifications, SensorData, Reports) {

                $scope.predictiveMaintenanceColor = 'orange';
                $scope.unpredictedErrorColor = 'green';

                $scope.headerTitle = $window.document.title = APP_CONFIG.DASHBOARD_WEB_TITLE;

                $scope.$on('lines:selected', function (evt, veh) {
                    $scope.veh = veh;
                });
                $scope.$on('package:selected', function (evt, pkg) {
                    $scope.machine = pkg;
                });
                $scope.userInfo = {
                    fullName: "Mary Q. Operator"
                };

                $scope.$on("resetAll", function (evt) {
                    $scope.resetAll();
                });

                $scope.resetAll = function () {
                    var resetUrl = "http://" + APP_CONFIG.DASHBOARD_PROXY_HOSTNAME + '.' + $location.host().replace(/^.*?\.(.*)/g, "$1") + '/api/utils/resetAll';
                    $http({
                        method: 'POST',
                        url: resetUrl
                    }).then(function (response) {
                        Notifications.success("Reset successful.");
                        location.reload();
                    }, function err(response) {
                        Notifications.error("Error resetting. Reload to retry");
                    });
                };
                $scope.shipmentCount = Reports.getShipCount();

                $scope.$watch(function () {
                    return Reports.getShipCount();
                }, function (newVal, oldVal) {
                    $scope.shipmentCount = newVal;
                });


                $scope.predictiveMaintenance = function () {
                    $scope.predictiveMaintenanceColor = 'gray';
                    $timeout(function () {
                        $scope.predictiveMaintenanceColor = 'orange';
                    }, 1000);
                    SensorData.predictiveMaintenance();
                };

                $scope.unpredictedError = function () {
                    $scope.unpredictedErrorColor = 'gray';
                    $timeout(function () {
                        $scope.unpredictedErrorColor = 'green';
                    }, 1000);
                    SensorData.unpredictedError();
                };

            }])

