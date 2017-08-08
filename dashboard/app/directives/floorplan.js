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


angular.module('app').directive('floorplan', function () {


	return {
		restrict: 'E',
		scope: true,
		replace: false,
		templateUrl: 'partials/floorplan.html',
		controller: 'FloorplanController',
        link: function(scope, element, attrs) {
            var chart = d3.select("#diagram");

            var tip = d3.tip()
                .attr('class', 'd3-tip')
                .html(function(d) {
                    return '<div class="modal-content">' +
                        '\n    <div class="modal-header">\n        ' +
                        '<h4 class="modal-title" id="myModalLabel">Modal Title</h4>\n    ' +
                        '</div>' +
                        '\n    \n    <div class="modal-body container-fluid">\n        <div class="row">\n            <div class="col-md-6">\n                <center>\n\n                    <img style="width: 200px;" src="app/imgs/chiller.jpg" alt="Chiller" class="img-rounded">\n                </center>\n            </div>\n            <div class="col-md-6">\n                <center>\n                    <h2>Chiller By The Numbers</h2>\n                    <hr>\n                    <div class="row">\n                        <div class="col-md-4">\n                            <div pf-aggregate-status-card status="size" show-top-border="true"></div>\n                        </div>\n                        <div class="col-md-4" pf-aggregate-status-card status="age" show-top-border="true"></div>\n                        <div class="col-md-4" pf-aggregate-status-card status="utilization" show-top-border="true"></div>\n                    </div>\n                    <!--<p><span style="font-size: 3em">654 sq. ft. total heated</p>-->\n                    <!--<p><span style="font-size: 3em">13.4</span> years old</p>-->\n                </center>\n            </div>\n        </div>\n\n    ' +
                        '</div>' +
                        '\n</div>'
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

            svg.append("rect")
                .attr("x", "35%")
                .attr("y", "1.5%")
                .attr("rx", "8")
                .attr("ry", "8")
                .attr("width", "8%")
                .attr("height", "20%")
                .attr("fill", "green")
                .attr("fill-opacity", 0.4 + (Math.random() * 0.2));

            svg.append("rect")
                .attr("x", "25%")
                .attr("y", "22%")
                .attr("rx", "8")
                .attr("ry", "8")
                .attr("width", "20%")
                .attr("height", "20%")
                .attr("fill", "green")
                .attr("fill-opacity",  0.4 + (Math.random() * 0.2));

            svg.append("rect")
                .attr("x", "25%")
                .attr("y", "43%")
                .attr("rx", "8")
                .attr("ry", "8")
                .attr("width", "20%")
                .attr("height", "20%")
                .attr("fill", "green")
                .attr("fill-opacity",  0.4 + (Math.random() * 0.2));

            svg.append("rect")
                .attr("x", "24%")
                .attr("y", "69%")
                .attr("rx", "8")
                .attr("ry", "8")
                .attr("width", "9%")
                .attr("height", "18%")
                .attr("fill", "green")
                .attr("fill-opacity",  0.4 + (Math.random() * 0.2))
                .on('mouseover', tip.show)
                .on('mouseout', tip.hide)
                .on('click', function() {
                    console.log("click!");
                    //TODO
                    scope.selectMachine("TODO");
                })

        }
	}
});
