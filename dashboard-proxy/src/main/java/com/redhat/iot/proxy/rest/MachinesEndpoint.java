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
package com.redhat.iot.proxy.rest;

import com.redhat.iot.proxy.model.Line;
import com.redhat.iot.proxy.model.Machine;
import com.redhat.iot.proxy.model.Point;
import com.redhat.iot.proxy.service.DGService;

import javax.annotation.Resource;
import javax.inject.Inject;
import javax.inject.Singleton;
import javax.sql.DataSource;
import javax.ws.rs.*;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * A simple REST service which proxies requests to a local datagrid.
 */

@Path("/machines")
@Singleton
public class MachinesEndpoint {

    @Inject
    DGService dgService;

    @Resource(name = "java:jboss/datasources/impala-ds", lookup = "java:jboss/datasources/impala-ds")
    DataSource dataSource;

    @GET
    @Path("/")
    @Produces({"application/json"})
    public List<Machine> getAll() {
        Map<String, Machine> cache = dgService.getMachines();
        return cache.keySet().stream()
                .map(cache::get)
                .collect(Collectors.toList());

    }

    @GET
    @Path("/{lid}")
    @Produces({"application/json"})
    public List<Machine> getByLine(@PathParam("lid") String lid) {

        Map<String, Line> lineCache = dgService.getProductionLines();

        return lineCache.get(lid).getMachines();
    }


    @GET
    @Path("/history/query")
    @Produces({"application/json"})
    public List<Point> getHistory(@QueryParam("topic") String topic, @QueryParam("metric") String metric) throws SQLException {

        Connection con = dataSource.getConnection();

        Statement stmt = con.createStatement();

        String query = "SELECT millis,avg(value) over " +
                "(partition by metric,motor_id order by millis rows between 150 preceding and 150 following) " +
                "as moving_average from iiot.telemetry where metric='"+metric+"' and motor_id REGEXP '" +
                topic + "' and millis >= ((unix_timestamp() * 1000) - (24 * 60 * 60 * 1000)) order by millis limit 500";

        ResultSet rs = stmt.executeQuery(query);

        ResultSetMetaData rsmd = rs.getMetaData();


        List<Point> temp = new ArrayList<>();
        while (rs.next()) {
            // the example query returns one String column
            temp.add(new Point(rs.getLong(1), rs.getDouble(2)));
        }

        return temp;
    }
}
