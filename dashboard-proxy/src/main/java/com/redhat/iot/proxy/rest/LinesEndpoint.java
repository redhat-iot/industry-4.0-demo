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

import com.redhat.iot.proxy.model.Alert;
import com.redhat.iot.proxy.model.Line;
import com.redhat.iot.proxy.model.Machine;
import com.redhat.iot.proxy.service.AlertsService;
import com.redhat.iot.proxy.service.DGService;

import javax.inject.Inject;
import javax.inject.Singleton;
import javax.ws.rs.*;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * A simple REST service which proxies requests to a local datagrid.
 */
@Path("/lines")
@Singleton
public class LinesEndpoint {

    @Inject
    DGService dgService;

    @Inject
    AlertsService alertsService;

    @GET
    @Path("/{id}")
    @Produces({"application/json"})
    public Line get(@PathParam("id") String id) {
        return dgService.getProductionLines().get(id);
    }

    @PUT
    @Path("/{id}")
    public void put(@PathParam("id") String id, Line value) {
        dgService.getProductionLines().put(id, value);
    }

    @GET
    @Path("/")
    @Produces({"application/json"})
    public List<Line> getAll() {

        Map<String, Line> cache = dgService.getProductionLines();

        return cache.keySet().stream()
            .map(cache::get)
            .collect(Collectors.toList());

    }

    @GET
    @Path("/{lid}/alerts")
    @Produces({"application/json"})
    public List<Alert> getAlerts(@PathParam("lid") String lid) {

        Map<String, Line> cache = dgService.getProductionLines();
        List<Alert> alerts = alertsService.getAlerts();

        Line v = cache.get(lid);

        List<Alert> finalAlerts = alerts.stream()
                .filter(a -> lid.equals(a.getLine().getLid()))
                .collect(Collectors.toList());

        alertsService.clearAlertsForLine(v);

        return finalAlerts;
    }

    @POST
    @Path("/{lid}/resetStatus")
    public void clearAll(@PathParam("lid") String lid) {
        Map<String, Line> cache = dgService.getProductionLines();
        Line l = cache.get(lid);
        l.setStatus("ok");
        cache.put(l.getLid(), l);

    }

    @POST
    @Path("/{lid}/{mid}/resetStatus")
    public void clearMachine(@PathParam("lid") String lid, @PathParam("mid") String mid) {

        Map<String, Machine> machineCache = dgService.getMachines();

        Machine machine = machineCache.get(mid);
        machine.setStatus("ok");
        machineCache.put(machine.getMid(), machine);

    }

}

