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


angular.module('app').directive('floorplan', ['$compile', '$rootScope', '$templateRequest', '$timeout', 'Facilities',
    function ($compile, $rootScope, $templateRequest, $timeout, Facilities) {


        return {
            restrict: 'E',
            scope: {
                selectedLine: "=?",
                selectedFacility: "=?",
                lines: "=?"
            },
            templateUrl: 'partials/floorplan.html',
            replace: false,
            controller: 'FloorplanController',
            link: function (scope, element, attrs) {

                var chart = d3.select(element[0]).select("#floorplan");

                var tip = d3.tip()
                    .attr('class', 'd3-tip')
                    .html(function (d) {
                        return d;
                    });

                var svg = chart
                    .append("svg")
                    .attr("preserveAspectRatio", "xMinYMin meet")
                    .attr("viewBox", "0 0 600 600")
                    .call(tip);

                var imgs = svg.selectAll("image").data([0]);
                imgs.enter()
                    .append("svg:image")
                    .attr("width", "100%")
                    .attr("xlink:href", "/app/imgs/floorplan.jpg");

                var rects = [
                    // left side
                    {
                        "x": "35%",
                        "y": "1.5%",
                        "rx": "8",
                        "ry": "8",
                        "width": "8%",
                        "height": "20%",
                        "fill": "green",
                        "fill-opacity": 0.4 + (Math.random() * 0.2)
                    },
                    {
                        "x": "25%",
                        "y": "22%",
                        "rx": "8",
                        "ry": "8",
                        "width": "20%",
                        "height": "20%",
                        "fill": "green",
                        "fill-opacity": 0.4 + (Math.random() * 0.2)
                    },
                    {
                        "x": "25%",
                        "y": "43%",
                        "rx": "8",
                        "ry": "8",
                        "width": "20%",
                        "height": "20%",
                        "fill": "green",
                        "fill-opacity": 0.4 + (Math.random() * 0.2)
                    },
                    {
                        "x": "24%",
                        "y": "69%",
                        "rx": "8",
                        "ry": "8",
                        "width": "9%",
                        "height": "18%",
                        "fill": "green",
                        "fill-opacity": 0.4 + (Math.random() * 0.2)
                    },
                    // right side
                    {
                        "x": "59%",
                        "y": "1.5%",
                        "rx": "8",
                        "ry": "8",
                        "width": "8%",
                        "height": "20%",
                        "fill": "green",
                        "fill-opacity": 0.4 + (Math.random() * 0.2)
                    },
                    {
                        "x": "49%",
                        "y": "22%",
                        "rx": "8",
                        "ry": "8",
                        "width": "20%",
                        "height": "20%",
                        "fill": "green",
                        "fill-opacity": 0.4 + (Math.random() * 0.2)
                    },
                    {
                        "x": "49%",
                        "y": "43%",
                        "rx": "8",
                        "ry": "8",
                        "width": "20%",
                        "height": "20%",
                        "fill": "green",
                        "fill-opacity": 0.4 + (Math.random() * 0.2)
                    },
                    {
                        "x": "62%",
                        "y": "69%",
                        "rx": "8",
                        "ry": "8",
                        "width": "9%",
                        "height": "18%",
                        "fill": "green",
                        "fill-opacity": 0.4 + (Math.random() * 0.2)
                    }
                ];

                scope.render = function (line) {

                    if (line === undefined || !line) {
                        svg.selectAll("line").data([]).exit().remove();
                        svg.selectAll("rect").data([]).exit().remove();
                        return;
                    }

                    svg.selectAll("line").data([]).exit().remove();

                    svg.append("line")
                        .attr("x1", "35%")
                        .attr("y1", "10%")
                        .attr("x2", "2%")
                        .attr("y2", "10%")
                        .attr("stroke", "green")
                        .attr("stroke-width", 5)
                        .style("stroke-dasharray", 10)
                        .style("stroke-dashoffset", 2)
                        .style("animation", "dash 20s linear")
                        .style("animation-iteration-count", "infinite");

                    svg.append("line")
                        .attr("x1", "55%")
                        .attr("y1", "10%")
                        .attr("x2", "98%")
                        .attr("y2", "10%")
                        .attr("stroke", "green")
                        .attr("stroke-width", 5)
                        .style("stroke-dasharray", 10)
                        .style("stroke-dashoffset", 2)
                        .style("animation", "dash 20s linear")
                        .style("animation-iteration-count", "infinite");


                    var data = line.machines.slice(0, rects.length);


                    svg.selectAll("rect").data([]).exit().remove();

                    var rectObjs = svg.selectAll("rect").data(data);
                    var timer = null;

                    function isSelected(machine) {
                        var cm = Facilities.getCurrentMachine();
                        var cl = Facilities.getCurrentLine();
                        var cf = Facilities.getCurrentFacility();
                        if (!cm || !cl || !cf) {
                            return false;
                        }

                        return (machine.currentLid === cl.lid && machine.currentFid === cf.fid && machine.mid === cm.mid);
                    }

                    rectObjs.enter().append("rect")
                        .attr("stroke-width", function (d) {
                            return isSelected(d) ? 3 : 0;
                        })

                        .attr("stroke", "red")

                        .attr("x", function (d, i) {
                            return rects[i].x
                        })
                        .attr("y", function (d, i) {
                            return rects[i].y
                        })
                        .attr("rx", function (d, i) {
                            return rects[i].rx
                        })
                        .attr("ry", function (d, i) {
                            return rects[i].ry
                        })
                        .attr("width", function (d, i) {
                            return rects[i].width
                        })
                        .attr("height", function (d, i) {
                            return rects[i].height
                        })
                        .attr("fill", function (d, i) {
                            switch (d.status) {
                                case 'ok':
                                    return 'green';
                                    break;
                                case 'warning':
                                    return 'yellow';
                                    break;
                                case 'error':
                                default:
                                    return 'red';
                            }
                        })
                        .attr("fill-opacity", function (d, i) {
                            return rects[i]["fill-opacity"];
                        })
                        .on('mouseover', function (d, i) {
                            var target = d3.event.target;
                            $templateRequest('partials/machine-popup.html').then(function (partial) {
                                var tmpScope = $rootScope.$new();
                                tmpScope.machine = d;
                                tmpScope.line = scope.selectedLine;
                                tmpScope.facility = scope.selectedFacility;
                                tmpScope.size = {
                                    title: "Hi",
                                    count: 20,
                                    iconClass: "fa fa-building",
                                    notifications: [{
                                        "iconClass": "pficon pficon-ok"
                                    }]

                                };
                                var compiled = $compile(partial)(tmpScope);
                                timer = $timeout(function () {
                                    var html = compiled[0].outerHTML;
                                    tip.html(function () {
                                        return html;
                                    });
                                    tip.direction('e');

                                    tip.show(d, i, target);
                                    timer = null;
                                }, 500);

                            });

                        })
                        .on('mouseout', function (d) {
                            if (timer) {
                                $timeout.cancel(timer);
                                timer = null;
                            }
                            tip.hide(d);
                        })
                        .on('click', function (d, i) {
                            d3.selectAll("rect")
                                .attr("stroke-width", 0);

                            d3.select(this)
                                .attr("stroke", "red")
                                .attr("stroke-width", "3");
                            scope.selectMachine(d);
                        });

                    rectObjs.exit().remove();

                };

                scope.$watch('selectedLine', function () {
                    scope.render(scope.selectedLine);
                });

            }
        }
    }]);
